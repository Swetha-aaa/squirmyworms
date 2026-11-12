// MixEngine: plays N clips at exactly the same time through one output.
//
//   AudioContext
//     track[i]: AudioBufferSourceNode -> GainNode (level) -> AnalyserNode -> master
//     master: GainNode -> DynamicsCompressor -> destination
//
// All tracks are started with the same AudioContext timestamp, so they are sample
// aligned. Pause stops every source and remembers the offset; resume recreates the
// sources at that offset. There are intentionally no per-track play/mute controls.

import { loadSongClip } from './sources.js';
import { measureLoudness, measurePresence } from './loudness.js';
import { mulberry32 } from '../util/seed.js';

export class MixEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.tracks = [];
    this.duration = 30; // full clip length
    this.limit = 30;    // playable boundary (progressive reveal); playback stops here
    this.state = 'idle'; // idle | loading | ready | playing | paused | ended
    this._envelopes = null;
    this._offset = 0;
    this._startedAt = 0;
    this._listeners = new Map();
    this._raf = null;
    this._endTimer = null;
    this.warnings = [];
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event).delete(fn);
  }

  _emit(event, payload) {
    const set = this._listeners.get(event);
    if (set) for (const fn of set) fn(payload);
  }

  _setState(s) {
    if (this.state === s) return;
    this.state = s;
    this._emit('statechange', s);
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 12;
      comp.ratio.value = 3;
      comp.attack.value = 0.005;
      comp.release.value = 0.2;
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /**
   * Load clips for a set of songs. Resolves when every track is ready.
   * @param {Array} songs
   * @param {{duration?: number, seed?: number}} opts
   */
  /**
   * @param {{duration?: number, seed?: number, fallback?: 'synth'|'none'}} opts
   *   fallback 'synth': a clip that fails to load is replaced by a placeholder (dev mode)
   *   fallback 'none':  throws MixLoadError listing the failed songs, nothing is loaded
   */
  async load(songs, { duration = 30, seed = Date.now(), fallback = 'synth' } = {}) {
    this.stop();
    this.ensureContext();
    this.duration = duration;
    this.limit = duration; // callers (the reveal state) narrow this after load
    this._envelopes = null;
    this.warnings = [];
    this._setState('loading');

    const rand = mulberry32(seed >>> 0);
    const results = await Promise.all(
      songs.map(async (song) => {
        try {
          return { song, ...(await loadSongClip(song, this.ctx, duration)) };
        } catch (err) {
          if (fallback === 'none') return { song, error: err?.message || String(err), failed: true };
          // Degrade gracefully: fall back to a placeholder clip so the round still works.
          this.warnings.push(`Audio for "${song.title}" failed to load, using placeholder.`);
          const fb = await loadSongClip({ ...song, audio: { type: 'synth' } }, this.ctx, duration);
          return { song, ...fb, failed: true };
        }
      })
    );

    const failed = results.filter((r) => !r.buffer);
    if (failed.length) {
      this._setState('idle');
      const err = new Error(`${failed.length} of ${songs.length} previews could not be loaded.`);
      err.name = 'MixLoadError';
      err.failed = failed.map((f) => ({ song: f.song, reason: f.error }));
      throw err;
    }

    // Real previews may be shorter than requested (e.g. 15 s). The round uses the
    // shortest clip so all five always play together for the whole unlocked span.
    const shortest = Math.min(...results.map((r) => r.buffer.duration));
    if (shortest < duration - 0.05) {
      this.duration = Math.floor(shortest * 10) / 10;
      this.limit = this.duration;
    }

    // Loudness matching. Each clip is rendered offline through the same levelling
    // compressor the live chain uses, then measured with a K-weighted, gated
    // loudness estimate (see loudness.js) over the playable span. Gain is set so
    // every track lands on one target after compression, with only a tiny seeded
    // spread (96-100%) so the mix isn't dead flat.
    const TARGET = 0.075;
    const measured = await Promise.all(results.map((r) => this._measureThroughChain(r.buffer)));
    // Presence compensation: after loudness matching, compare each track's energy
    // in the 1-4 kHz band to the others and pull sparse tracks up (dense ones
    // down) by half the difference, within +/-3 dB. Keeps a quiet acoustic song
    // audible under three full productions without making it louder overall.
    const base = measured.map((m) => (m.loudness > 1e-4 ? Math.min(10, Math.max(0.1, TARGET / m.loudness)) : 1));
    const presence = measured.map((m, i) => m.presence * base[i]);
    const sorted = presence.slice().sort((a, b) => a - b);
    const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const levels = base.map((g, i) => {
      const ratio = presence[i] > 1e-5 && median > 1e-5 ? Math.sqrt(median / presence[i]) : 1;
      const comp = Math.min(1.68, Math.max(0.71, ratio)); // up to +4.5 dB lift for sparse tracks
      const trim = Math.pow(10, (results[i].song.audio?.gainDb || 0) / 20); // per-clip manual trim
      return g * comp * trim * (0.96 + rand() * 0.04);
    });
    const n = results.length;
    this.master.gain.value = Math.min(1, 0.95 / Math.sqrt(n * 0.6));

    this.tracks = results.map((r, i) => {
      // source -> levelling compressor -> gain -> analyser -> master
      const comp = MixEngine.compressorSettings(this.ctx.createDynamicsCompressor());
      const gain = this.ctx.createGain();
      gain.gain.value = levels[i];
      gain._base = levels[i];
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      comp.connect(gain).connect(analyser).connect(this.master);
      return { song: r.song, buffer: r.buffer, placeholder: r.placeholder, failed: !!r.failed, input: comp, gain, analyser, source: null };
    });

    this._offset = 0;
    this._setState('ready');
    this._emit('timeupdate', 0);
  }

  get isPlaying() {
    return this.state === 'playing';
  }

  get currentTime() {
    if (this.state === 'playing') {
      return Math.min(this.limit, this._offset + Math.max(0, this.ctx.currentTime - this._startedAt));
    }
    return Math.min(this._offset, this.limit);
  }

  /**
   * Set the playable boundary in seconds. Playback never runs past it.
   * If currently playing, sources are re-scheduled so the stop stays sample accurate.
   */
  setLimit(seconds) {
    const next = Math.max(0.05, Math.min(this.duration, seconds));
    if (Math.abs(next - this.limit) < 1e-6) return;
    const wasPlaying = this.state === 'playing';
    const at = this.currentTime;
    this.limit = next;
    if (wasPlaying) {
      if (at >= next - 0.01) {
        this._stopSources();
        this._offset = next;
        this._setState('ended');
        this._emit('timeupdate', next);
        this._emit('ended');
      } else {
        this._stopSources();
        this._offset = at;
        this._start();
      }
    } else if (this.state === 'ended' && next > this._offset) {
      // More audio was unlocked after hitting the boundary: allow resuming from there.
      this._setState('paused');
    } else if (this._offset > next) {
      this._offset = next;
      if (this.state === 'paused') this._setState('ended');
    }
    this._emit('limitchange', next);
    this._emit('timeupdate', this.currentTime);
  }

  play() {
    if (!this.tracks.length || this.state === 'playing') return;
    if (this.state === 'ended' || this._offset >= this.limit) this._offset = 0;
    this.ensureContext();
    this._start();
  }

  // Start every source at the same context time from this._offset, stopping at the limit.
  _start() {
    const when = this.ctx.currentTime + 0.05; // tiny lead so all 5 are scheduled together
    const offset = this._offset;
    const span = Math.max(0.01, this.limit - offset);
    const stopAt = when + span;
    for (const t of this.tracks) {
      const src = this.ctx.createBufferSource();
      src.buffer = t.buffer;
      src.connect(t.input);
      src.start(when, offset);
      src.stop(stopAt); // sample-accurate boundary
      t.source = src;
    }
    this._startedAt = when;
    this._setState('playing');
    this._tick();

    clearTimeout(this._endTimer);
    this._endTimer = setTimeout(() => this._onEnded(), span * 1000 + 60);
  }

  /** Move the playhead within the unlocked section. Keeps playing if it was. */
  seek(seconds) {
    if (!this.tracks.length) return;
    const t = Math.max(0, Math.min(this.limit - 0.02, seconds));
    if (this.state === 'playing') {
      this._stopSources();
      this._offset = t;
      this._start();
    } else {
      this._offset = t;
      if (this.state === 'ended' || this.state === 'ready') this._setState('paused');
    }
    this._emit('timeupdate', t);
  }

  pause() {
    if (this.state !== 'playing') return;
    this._offset = this.currentTime;
    this._stopSources();
    this._setState('paused');
    this._emit('timeupdate', this._offset);
  }

  toggle() {
    if (this.state === 'playing') this.pause();
    else this.play();
  }

  replay() {
    this._stopSources();
    this._offset = 0;
    this._setState('ready');
    this.play();
  }

  stop() {
    this._stopSources();
    this._offset = 0;
    if (this.tracks.length) this._setState('ready');
    else this._setState('idle');
    this._emit('timeupdate', 0);
  }

  // Release everything. Call between rounds.
  unload() {
    this._stopSources();
    for (const t of this.tracks) {
      try { t.input.disconnect(); t.gain.disconnect(); t.analyser.disconnect(); } catch (_) {}
    }
    this.tracks = [];
    this._offset = 0;
    this._setState('idle');
  }

  _onEnded() {
    if (this.state !== 'playing') return;
    this._stopSources();
    this._offset = this.limit;
    this._setState('ended');
    this._emit('timeupdate', this.limit);
    this._emit('ended');
  }

  /**
   * Peak envelope per track over the whole clip (for the timeline). Computed once.
   * @returns {Float32Array[]} one array of `bins` values in 0..1 per track
   */
  getEnvelopes(bins = 480) {
    if (this._envelopes && this._envelopes[0]?.length === bins) return this._envelopes;
    this._envelopes = this.tracks.map((t) => {
      const data = t.buffer.getChannelData(0);
      const out = new Float32Array(bins);
      const usable = Math.min(data.length, Math.floor(this.duration * t.buffer.sampleRate));
      const per = Math.max(1, Math.floor(usable / bins));
      let max = 0;
      for (let b = 0; b < bins; b++) {
        let m = 0;
        const start = b * per;
        for (let i = start; i < start + per; i += 4) {
          const v = Math.abs(data[i]);
          if (v > m) m = v;
        }
        out[b] = m;
        if (m > max) max = m;
      }
      if (max > 0) for (let b = 0; b < bins; b++) out[b] /= max;
      return out;
    });
    return this._envelopes;
  }

  _stopSources() {
    clearTimeout(this._endTimer);
    cancelAnimationFrame(this._raf);
    for (const t of this.tracks) {
      if (t.source) {
        try { t.source.stop(); } catch (_) {}
        try { t.source.disconnect(); } catch (_) {}
        t.source = null;
      }
    }
  }

  _tick() {
    cancelAnimationFrame(this._raf);
    const loop = () => {
      if (this.state !== 'playing') return;
      const t = this.currentTime;
      this._emit('timeupdate', t);
      if (t >= this.limit) { this._onEnded(); return; }
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  static compressorSettings(comp) {
    comp.threshold.value = -28;
    comp.knee.value = 10;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    return comp;
  }

  // Render a buffer through the per-track compressor offline and measure loudness.
  async _measureThroughChain(buffer) {
    const length = Math.min(buffer.length, Math.floor(this.duration * buffer.sampleRate));
    const off = new OfflineAudioContext(1, length, buffer.sampleRate);
    const src = off.createBufferSource();
    src.buffer = buffer;
    src.connect(MixEngine.compressorSettings(off.createDynamicsCompressor())).connect(off.destination);
    src.start(0);
    const rendered = await off.startRendering();
    return { loudness: measureLoudness(rendered, this.duration), presence: measurePresence(rendered, this.duration) };
  }

  /**
   * Play only some tracks: a single index, a list/Set of indices to layer, or
   * null (or an empty list) for the full mix. Smooth, no clicks.
   */
  setSolo(which) {
    if (!this.ctx) return;
    const on = which == null ? null : new Set(typeof which === 'number' ? [which] : which);
    const full = !on || on.size === 0;
    const now = this.ctx.currentTime;
    this.tracks.forEach((t, i) => {
      const target = full || on.has(i) ? t.gain._base ?? t.gain.gain.value : 0;
      t.gain.gain.cancelScheduledValues(now);
      t.gain.gain.setTargetAtTime(target, now, 0.03);
    });
    this.solo = full ? null : on;
  }

  /** Time-domain samples per track, for the visualiser. */
  readWaveforms(out) {
    for (let i = 0; i < this.tracks.length; i++) {
      const a = this.tracks[i].analyser;
      if (!out[i] || out[i].length !== a.fftSize) out[i] = new Uint8Array(a.fftSize);
      a.getByteTimeDomainData(out[i]);
    }
    return out;
  }
}
