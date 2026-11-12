// RevealBand: the full 30 s timeline of the five-track mix, with a draggable
// boundary that controls how much audio is unlocked.
//
//   revealed  [0 .. unlocked]  five coloured envelopes, live strands while playing
//   hidden    [unlocked .. 30] grey, hatched, muted
//
// The x axis uses a mild power curve (t/max)^0.6 so the first few seconds, where
// the game is actually won, get a fair share of the width. The pink handle sets
// the reveal duration; dragging anywhere in the revealed area moves the white playhead.

import { STRAND_COLORS } from './waveform.js';
import { formatSeconds } from '../game/round.js';

const PAD = 14;      // px inside the band where the scale starts/ends
const CURVE = 0.6;

export function createRevealBand({ engine, reveal, curve = CURVE }) {
  const el = document.createElement('div');
  el.className = 'reveal-band';

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');

  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'reveal-handle';
  handle.setAttribute('role', 'slider');
  handle.setAttribute('aria-label', 'Audio unlocked');
  handle.setAttribute('aria-valuemin', '0.1');
  handle.setAttribute('aria-valuemax', String(reveal.maxSeconds));
  handle.innerHTML = `<span class="reveal-grip"><i></i><i></i><i></i></span><span class="reveal-handle-label"></span>`;
  const handleLabel = handle.querySelector('.reveal-handle-label');

  const ticks = document.createElement('div');
  ticks.className = 'reveal-ticks';
  let tickEls = [];
  let tickMax = -1;
  function buildTicks() {
    ticks.innerHTML = '';
    tickEls = reveal.milestones.map((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'reveal-tick';
      b.dataset.value = String(m);
      b.setAttribute('aria-label', `Unlock ${formatSeconds(m)}`);
      b.innerHTML = `<i></i><span>${m < 1 ? m : Math.round(m * 10) / 10}s</span>`;
      b.addEventListener('click', () => reveal.set(m));
      ticks.append(b);
      return b;
    });
    tickMax = reveal.maxSeconds;
    handle.setAttribute('aria-valuemax', String(reveal.maxSeconds));
  }
  buildTicks();

  el.append(canvas, handle, ticks);

  const ctx2d = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1;
  let raf = null;
  let scrubbing = false;
  let shown = reveal.unlocked;   // tweened boundary (seconds)
  let flashUntil = 0, flashFrom = 0, flashTo = 0;
  const live = [];
  let hatch = null;

  const max = () => reveal.maxSeconds;
  const xOf = (t) => PAD + (W - PAD * 2) * Math.pow(Math.max(0, t) / max(), curve);
  const tOf = (x) => max() * Math.pow(Math.max(0, Math.min(1, (x - PAD) / (W - PAD * 2))), 1 / curve);

  function makeHatch() {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(244,239,250,0.07)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-2, 10); g.lineTo(10, -2); g.stroke();
    g.beginPath(); g.moveTo(-2, 2); g.lineTo(2, -2); g.stroke();
    g.beginPath(); g.moveTo(6, 10); g.lineTo(10, 6); g.stroke();
    return ctx2d.createPattern(c, 'repeat');
  }

  function resize() {
    const r = el.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.floor(r.width));
    H = Math.max(1, Math.floor(canvas.clientHeight || r.height * 0.78));
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    hatch = makeHatch();
    positionChrome();
    draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  function positionChrome() {
    if (tickMax !== reveal.maxSeconds) buildTicks();
    handle.style.left = xOf(reveal.unlocked) + 'px';
    handleLabel.textContent = formatSeconds(reveal.unlocked);
    handle.setAttribute('aria-valuenow', String(reveal.unlocked));
    handle.setAttribute('aria-valuetext', `${formatSeconds(reveal.unlocked)} of ${max()} seconds unlocked`);
    const ms = reveal.milestones;
    tickEls.forEach((b, i) => {
      const m = ms[i];
      b.style.left = xOf(m) + 'px';
      b.classList.toggle('is-unlocked', m <= reveal.unlocked + 1e-9);
      b.classList.toggle('is-current', Math.abs(m - reveal.unlocked) < 0.05);
    });
  }

  // ---- drawing
  function envelopePath(env, i, x0, x1, amp) {
    const mid = H / 2 + (i - 2) * (H * 0.045);
    const n = env.length;
    ctx2d.beginPath();
    let started = false;
    for (let b = 0; b < n; b++) {
      const x = xOf((b / (n - 1)) * max());
      if (x < x0 - 2 || x > x1 + 2) continue;
      const y = mid - env[b] * amp;
      if (!started) { ctx2d.moveTo(x, y); started = true; } else ctx2d.lineTo(x, y);
    }
    for (let b = n - 1; b >= 0; b--) {
      const x = xOf((b / (n - 1)) * max());
      if (x < x0 - 2 || x > x1 + 2) continue;
      ctx2d.lineTo(x, mid + env[b] * amp);
    }
    ctx2d.closePath();
  }

  function liveStrand(data, color, i, x0, x1, t) {
    const n = data.length;
    const mid = H / 2 + (i - 2) * (H * 0.045);
    let m = 0;
    for (let k = 0; k < n; k += 2) m = Math.max(m, Math.abs(data[k] - 128) / 128);
    const scale = 0.9 / Math.max(m, 0.06);
    const span = Math.max(8, x1 - x0);
    ctx2d.beginPath();
    for (let x = x0; x <= x1; x++) {
      const idx = Math.floor(((x - x0) / span) * (n - 1));
      const v = Math.max(-1, Math.min(1, ((data[idx] - 128) / 128) * scale));
      const y = mid + v * H * 0.36 + Math.sin(t * 0.0007 + i) * 2;
      if (x === x0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
    }
    ctx2d.strokeStyle = color;
    ctx2d.lineWidth = 1.4;
    ctx2d.globalAlpha = 0.55;
    ctx2d.shadowColor = color;
    ctx2d.shadowBlur = 8;
    ctx2d.stroke();
    ctx2d.shadowBlur = 0;
  }

  function draw(now = performance.now()) {
    ctx2d.clearRect(0, 0, W, H);
    const target = reveal.unlocked;
    if (reduceMotion) shown = target;
    else shown += (target - shown) * 0.18;
    if (Math.abs(shown - target) < 0.005) shown = target;

    const xr = xOf(shown);
    const envs = engine.tracks.length ? engine.getEnvelopes(Math.min(640, Math.max(160, W))) : null;
    const amp = H * 0.38;

    // Hidden region: grey envelopes under hatching
    ctx2d.save();
    ctx2d.beginPath(); ctx2d.rect(xr, 0, W - xr, H); ctx2d.clip();
    if (envs) {
      envs.forEach((env, i) => {
        envelopePath(env, i, xr, W, amp * 0.9);
        ctx2d.fillStyle = 'rgba(120, 104, 150, 0.14)';
        ctx2d.fill();
      });
    }
    ctx2d.fillStyle = hatch || 'transparent';
    ctx2d.fillRect(xr, 0, W - xr, H);
    ctx2d.restore();

    // Revealed region: coloured envelopes, additive
    ctx2d.save();
    ctx2d.beginPath(); ctx2d.rect(0, 0, xr, H); ctx2d.clip();
    ctx2d.globalCompositeOperation = 'lighter';
    if (envs) {
      envs.forEach((env, i) => {
        envelopePath(env, i, 0, xr, amp);
        ctx2d.fillStyle = STRAND_COLORS[i % 5];
        ctx2d.globalAlpha = 0.32;
        ctx2d.fill();
        ctx2d.globalAlpha = 0.9;
        ctx2d.lineWidth = 1;
        ctx2d.strokeStyle = STRAND_COLORS[i % 5];
        ctx2d.stroke();
      });
    }
    // Live motion while playing
    if (engine.state === 'playing') {
      engine.readWaveforms(live);
      for (let i = 0; i < engine.tracks.length; i++) liveStrand(live[i], STRAND_COLORS[i % 5], i, 0, xr, now);
    }
    ctx2d.restore();

    // Flash on newly revealed audio
    if (now < flashUntil) {
      const k = (flashUntil - now) / 420;
      ctx2d.fillStyle = `rgba(255, 79, 163, ${0.28 * k})`;
      ctx2d.fillRect(xOf(flashFrom), 0, Math.max(2, xOf(flashTo) - xOf(flashFrom)), H);
    }

    // Playhead
    if (engine.state === 'playing' || engine.state === 'paused' || scrubbing) {
      const px = xOf(engine.currentTime);
      ctx2d.fillStyle = 'rgba(244,239,250,0.95)';
      ctx2d.shadowColor = '#fff';
      ctx2d.shadowBlur = scrubbing ? 10 : 4;
      ctx2d.fillRect(px - 1, 0, 2, H);
      // grab knob at the top so it reads as draggable
      ctx2d.beginPath(); ctx2d.arc(px, 9, scrubbing ? 8 : 6.5, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.shadowBlur = 0;
      ctx2d.fillStyle = '#0D0912';
      ctx2d.beginPath(); ctx2d.arc(px, 9, 2.2, 0, Math.PI * 2); ctx2d.fill();
    }

    // Boundary line
    ctx2d.fillStyle = '#FF4FA3';
    ctx2d.shadowColor = '#FF4FA3';
    ctx2d.shadowBlur = 10;
    ctx2d.fillRect(xr - 1, 0, 2, H);
    ctx2d.shadowBlur = 0;
    ctx2d.globalAlpha = 1;
  }

  function loop(t) {
    draw(t);
    const animating = engine.state === 'playing' || Math.abs(shown - reveal.unlocked) > 0.004 || t < flashUntil;
    raf = animating ? requestAnimationFrame(loop) : null;
  }
  function kick() { if (raf == null) raf = requestAnimationFrame(loop); }

  // ---- reveal changes
  let prevUnlocked = reveal.unlocked;
  const offReveal = reveal.on((v) => {
    if (v > prevUnlocked) {
      flashFrom = prevUnlocked; flashTo = v; flashUntil = performance.now() + 420;
      el.classList.add('is-bump');
      setTimeout(() => el.classList.remove('is-bump'), 260);
    }
    prevUnlocked = v;
    positionChrome();
    kick();
  });
  const offState = engine.on('statechange', () => { kick(); requestAnimationFrame(() => draw()); });
  const offTime = engine.on('timeupdate', () => { if (engine.state !== 'playing') draw(); });

  // ---- scrubbing the playhead: press/drag anywhere on the waveform
  function scrubTo(e) {
    const r = canvas.getBoundingClientRect();
    const t = Math.min(tOf(e.clientX - r.left), reveal.unlocked - 0.02);
    engine.seek(t);
    draw();
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!engine.tracks.length || !engine.seek) return;
    engine.ensureContext?.();
    scrubbing = true;
    canvas.setPointerCapture(e.pointerId);
    el.classList.add('is-scrubbing');
    scrubTo(e);
    kick();
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (scrubbing) { scrubTo(e); return; }
    const r = canvas.getBoundingClientRect();
    el.classList.toggle('can-scrub', engine.tracks.length > 0 && e.clientX - r.left < xOf(reveal.unlocked) - 6);
  });
  const endScrub = (e) => {
    if (!scrubbing) return;
    scrubbing = false;
    el.classList.remove('is-scrubbing');
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    draw();
  };
  canvas.addEventListener('pointerup', endScrub);
  canvas.addEventListener('pointercancel', endScrub);

  // ---- dragging
  let dragging = false;
  function snap(t, x) {
    for (const m of reveal.milestones) if (Math.abs(xOf(m) - x) < 7) return m;
    return Math.round(t * 10) / 10;
  }
  function pointerTo(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    reveal.set(snap(tOf(x), x));
  }
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => { if (dragging) pointerTo(e); });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 1 : 0.1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); reveal.set(reveal.unlocked + step); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); reveal.set(reveal.unlocked - step); }
    else if (e.key === 'Home') { e.preventDefault(); reveal.set(0.1); }
    else if (e.key === 'End') { e.preventDefault(); reveal.set(max()); }
    else if (e.key === 'PageUp') { e.preventDefault(); reveal.revealNext(); }
  });

  kick();

  return {
    el,
    redraw: () => { positionChrome(); kick(); draw(); },
    destroy() {
      cancelAnimationFrame(raf); raf = null;
      ro.disconnect(); offReveal(); offState(); offTime();
    },
  };
}
