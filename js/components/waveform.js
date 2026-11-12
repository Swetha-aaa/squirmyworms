// Waveform visualiser: five strands, one per track, drawn from each track's
// AnalyserNode so the picture is the actual audio. Strands braid together into
// one mix; a playhead and dimmed region show playback progress.

export const STRAND_COLORS = ['#8A5CFF', '#FF4FA3', '#45D9FF', '#C9A6FF', '#FF8A5C'];

export function createWaveform(engine, { idleAmp = 0.06, idleAlpha = 0.35 } = {}) {
  const el = document.createElement('div');
  el.className = 'wave';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  el.append(canvas);

  const ctx2d = canvas.getContext('2d');
  const buffers = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1;
  let raf = null;
  let lastFrame = null;
  let phase = 0;

  function resize() {
    const rect = el.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(el);

  // Per-strand adaptive gain: each track sits at a different level in the mix, but
  // every strand should be legible, so scale by a slowly decaying running peak.
  const peaks = [0.2, 0.2, 0.2, 0.2, 0.2];

  function strand(data, color, i, amp, alpha, t, adapt = true) {
    const n = data.length;
    const mid = H / 2;
    const drift = Math.sin(t * 0.0006 + i * 1.3) * (H * 0.05);
    if (adapt) {
      let m = 0;
      for (let k = 0; k < n; k += 2) m = Math.max(m, Math.abs(data[k] - 128) / 128);
      peaks[i] = Math.max(m, peaks[i] * 0.985, 0.04);
    }
    const scale = 0.9 / peaks[i];
    ctx2d.beginPath();
    for (let x = 0; x < W; x++) {
      const idx = Math.floor((x / W) * (n - 1));
      const v = Math.max(-1, Math.min(1, ((data[idx] - 128) / 128) * scale));
      const y = mid + drift + v * amp;
      if (x === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.strokeStyle = color;
    ctx2d.globalAlpha = alpha;
    ctx2d.lineWidth = 1.8;
    ctx2d.shadowColor = color;
    ctx2d.shadowBlur = 12;
    ctx2d.stroke();
  }

  function idleStrand(color, i, t) {
    const mid = H / 2;
    ctx2d.beginPath();
    for (let x = 0; x < W; x++) {
      const k = x / W;
      const y = mid + Math.sin(k * 9 + t * 0.0009 + i * 1.1) * (H * idleAmp) * Math.sin(k * Math.PI)
        + Math.sin(t * 0.0005 + i) * H * 0.03;
      if (x === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.strokeStyle = color;
    ctx2d.globalAlpha = idleAlpha;
    ctx2d.lineWidth = 1.4;
    ctx2d.shadowColor = color;
    ctx2d.shadowBlur = 8;
    ctx2d.stroke();
  }

  function draw(t = performance.now()) {
    ctx2d.clearRect(0, 0, W, H);
    const state = engine.state;
    const progress = engine.duration ? engine.currentTime / engine.duration : 0;
    const count = engine.tracks.length || 5;

    ctx2d.save();
    ctx2d.globalCompositeOperation = 'lighter';

    if (state === 'playing') {
      engine.readWaveforms(buffers);
      lastFrame = buffers.map((b) => b.slice());
      for (let i = 0; i < count; i++) strand(buffers[i], STRAND_COLORS[i % 5], i, H * 0.42, 0.9, t);
    } else if ((state === 'paused' || state === 'ended') && lastFrame) {
      for (let i = 0; i < count; i++) strand(lastFrame[i], STRAND_COLORS[i % 5], i, H * 0.42, 0.32, phase, false);
    } else {
      for (let i = 0; i < count; i++) idleStrand(STRAND_COLORS[i % 5], i, reduceMotion ? 0 : t);
    }
    ctx2d.restore();

    // Progress: dim what hasn't played yet, then a playhead.
    if (state !== 'idle' && state !== 'loading') {
      const px = Math.round(progress * W);
      ctx2d.globalAlpha = 1;
      ctx2d.fillStyle = 'rgba(13, 9, 18, 0.55)';
      ctx2d.fillRect(px, 0, W - px, H);
      if (progress > 0 && progress < 1) {
        ctx2d.fillStyle = '#F4EFFA';
        ctx2d.fillRect(px - 0.5, 0, 1, H);
      }
    }
    ctx2d.globalAlpha = 1;
    ctx2d.shadowBlur = 0;
  }

  function loop(t) {
    draw(t);
    const animate = engine.state === 'playing' || (!reduceMotion && (engine.state === 'ready' || engine.state === 'idle'));
    if (animate) raf = requestAnimationFrame(loop);
    else raf = null;
  }

  function start() {
    if (raf == null) raf = requestAnimationFrame(loop);
  }

  const offState = engine.on('statechange', (s) => {
    if (s === 'paused' || s === 'ended') phase = performance.now();
    start();
    if (s === 'paused' || s === 'ended') requestAnimationFrame(() => draw());
  });
  const offTime = engine.on('timeupdate', () => { if (engine.state !== 'playing') draw(); });

  start();

  return {
    el,
    destroy() {
      cancelAnimationFrame(raf);
      raf = null;
      ro.disconnect();
      offState();
      offTime();
    },
  };
}
