// Placeholder clip renderer.
//
// Renders a short synthesized "song" (lead, bass, pad, drums) into an AudioBuffer
// using an OfflineAudioContext. Every parameter is seeded from the song id, so a
// given song always sounds the same, and five different songs sound different
// enough to tell apart in a mix. These are NOT the real recordings; they exist so
// the full game loop works before licensed audio is wired in via audio/sources.js.

import { hashString, mulberry32, pick } from '../util/seed.js';

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixo: [0, 2, 4, 5, 7, 9, 10],
  penta: [0, 2, 4, 7, 9],
};

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function degreeToMidi(root, scale, degree) {
  const octave = Math.floor(degree / scale.length);
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  return root + octave * 12 + scale[idx];
}

function makeNoise(ctx, seconds = 1) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(ctx, node, t, a, d, s, r, peak = 1) {
  const g = node.gain;
  g.setValueAtTime(0.0001, t);
  g.linearRampToValueAtTime(peak, t + a);
  g.exponentialRampToValueAtTime(Math.max(peak * s, 0.0001), t + a + d);
  g.setValueAtTime(Math.max(peak * s, 0.0001), t + a + d);
  g.exponentialRampToValueAtTime(0.0001, t + a + d + r);
}

export async function renderPlaceholderClip(song, duration = 30, sampleRate = 44100) {
  const rand = mulberry32(hashString(song.id));
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);

  // Master chain
  const master = ctx.createGain();
  master.gain.value = 0.6;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  // Song "DNA"
  const bpm = 92 + Math.floor(rand() * 44);
  const beat = 60 / bpm;
  const step = beat / 2;
  const scaleName = pick(rand, Object.keys(SCALES));
  const scale = SCALES[scaleName];
  const root = 50 + Math.floor(rand() * 12); // D3..C#4
  const leadType = pick(rand, ['sine', 'triangle', 'square', 'sawtooth']);
  const leadOct = pick(rand, [12, 12, 24]);
  const padType = pick(rand, ['sawtooth', 'triangle']);
  const hasPad = rand() < 0.75;
  const hasDrums = rand() < 0.85;
  const hatDensity = pick(rand, [1, 2]); // 8ths or 16ths
  const swing = rand() < 0.35 ? 0.12 : 0;
  const progression = [0, pick(rand, [3, 5, 2]), pick(rand, [4, 3, 5]), pick(rand, [5, 4, 1, 2])];

  // 16-step motif, with a variation for the B section
  const motifA = Array.from({ length: 16 }, () => (rand() < 0.28 ? null : Math.floor(rand() * 9)));
  const motifB = motifA.map((d) => (d === null || rand() < 0.4 ? (rand() < 0.3 ? null : Math.floor(rand() * 9)) : d));
  const noteLen = pick(rand, [0.5, 0.8, 1.1]);

  const noise = makeNoise(ctx);

  const bars = Math.ceil(duration / (beat * 4));
  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * beat * 4;
    const chordDegree = progression[bar % progression.length];
    const section = Math.floor(bar / 4) % 2; // alternate A/B every 4 bars
    const motif = section === 0 ? motifA : motifB;

    // Pad: two detuned oscillators holding the chord
    if (hasPad) {
      const chordNotes = [0, 2, 4].map((d) => degreeToMidi(root, scale, chordDegree + d));
      chordNotes.forEach((m, i) => {
        const o = ctx.createOscillator();
        o.type = padType;
        o.frequency.value = midiToHz(m);
        o.detune.value = i % 2 ? 7 : -7;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        const g = ctx.createGain();
        env(ctx, g, barStart, 0.3, 0.4, 0.7, 0.5, 0.07);
        o.connect(f).connect(g).connect(master);
        o.start(barStart);
        o.stop(barStart + beat * 4 + 0.6);
      });
    }

    // Bass: root on beats 1 and 3, fifth on 2+ sometimes
    for (let b = 0; b < 4; b++) {
      const t = barStart + b * beat;
      const isRoot = b % 2 === 0;
      if (!isRoot && rand() < 0.45) continue;
      const m = degreeToMidi(root - 12, scale, chordDegree + (isRoot ? 0 : 4));
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = midiToHz(m);
      const g = ctx.createGain();
      env(ctx, g, t, 0.01, 0.15, 0.5, beat * 0.5, 0.35);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + beat + 0.1);
    }

    // Lead melody
    for (let s = 0; s < 16; s++) {
      const degree = motif[s % 16];
      if (degree === null) continue;
      if (s % 2 === 0 && s >= 8 && rand() < 0.08) continue; // occasional dropout
      const sw = s % 2 ? swing * step : 0;
      const t = barStart + (s / 16) * beat * 4 + sw;
      const m = degreeToMidi(root + leadOct, scale, degree + chordDegree);
      const o = ctx.createOscillator();
      o.type = leadType;
      o.frequency.value = midiToHz(m);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3200, t);
      f.frequency.exponentialRampToValueAtTime(900, t + step * noteLen);
      const g = ctx.createGain();
      const peak = leadType === 'sine' ? 0.42 : leadType === 'triangle' ? 0.34 : 0.18;
      env(ctx, g, t, 0.008, step * 0.4 * noteLen, 0.45, step * 0.5 * noteLen, peak);
      o.connect(f).connect(g).connect(master);
      o.start(t);
      o.stop(t + step * noteLen + 0.3);
    }

    // Drums
    if (hasDrums) {
      for (let b = 0; b < 4; b++) {
        const t = barStart + b * beat;
        // Kick on 1 and 3 (and sometimes the "and" of 2)
        if (b === 0 || b === 2 || (b === 1 && rand() < 0.2)) {
          const o = ctx.createOscillator();
          o.frequency.setValueAtTime(150, t);
          o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
          const g = ctx.createGain();
          env(ctx, g, t, 0.002, 0.08, 0.2, 0.15, 0.7);
          o.connect(g).connect(master);
          o.start(t);
          o.stop(t + 0.4);
        }
        // Snare / clap on 2 and 4
        if (b === 1 || b === 3) {
          const n = ctx.createBufferSource();
          n.buffer = noise;
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = 1800;
          f.Q.value = 0.8;
          const g = ctx.createGain();
          env(ctx, g, t, 0.001, 0.06, 0.15, 0.12, 0.22);
          n.connect(f).connect(g).connect(master);
          n.start(t);
          n.stop(t + 0.3);
        }
        // Hats
        for (let h = 0; h < 2 * hatDensity; h++) {
          const th = t + (h * beat) / (2 * hatDensity);
          const n = ctx.createBufferSource();
          n.buffer = noise;
          const f = ctx.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = 7000;
          const g = ctx.createGain();
          env(ctx, g, th, 0.001, 0.02, 0.05, 0.04, h % 2 ? 0.05 : 0.09);
          n.connect(f).connect(g).connect(master);
          n.start(th);
          n.stop(th + 0.12);
        }
      }
    }
  }

  // Fade out the last second so the clip ends cleanly
  master.gain.setValueAtTime(0.6, duration - 1);
  master.gain.linearRampToValueAtTime(0.0001, duration - 0.02);

  return ctx.startRendering();
}
