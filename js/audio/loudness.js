// Perceptual loudness estimate, modelled on ITU-R BS.1770 (the basis of LUFS):
// K-weighting (a high-shelf lift above ~1.5 kHz and a high-pass below ~40 Hz)
// followed by gated mean-square over 400 ms blocks. Returns a linear "RMS-like"
// value so gains can be computed as target / measured.
//
// Why not plain RMS: a dense, bright pop chorus and a sparse vocal verse can have
// the same RMS yet sound very different in level; K-weighting and gating bring
// the estimate much closer to what the ear hears.

function biquad(b0, b1, b2, a1, a2) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

// RBJ cookbook filters, normalised so a0 = 1.
function highShelf(fs, f0, gainDb, q = 0.7071) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * f0 / fs;
  const cos = Math.cos(w0), sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const sq = 2 * Math.sqrt(A) * alpha;
  const b0 = A * ((A + 1) + (A - 1) * cos + sq);
  const b1 = -2 * A * ((A - 1) + (A + 1) * cos);
  const b2 = A * ((A + 1) + (A - 1) * cos - sq);
  const a0 = (A + 1) - (A - 1) * cos + sq;
  const a1 = 2 * ((A - 1) - (A + 1) * cos);
  const a2 = (A + 1) - (A - 1) * cos - sq;
  return biquad(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

function highPass(fs, f0, q = 0.5) {
  const w0 = 2 * Math.PI * f0 / fs;
  const cos = Math.cos(w0), sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const b0 = (1 + cos) / 2, b1 = -(1 + cos), b2 = (1 + cos) / 2;
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  return biquad(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

/**
 * @param {AudioBuffer} buffer
 * @param {number} seconds  span to measure from the start
 * @returns {number} gated, K-weighted RMS (linear)
 */
export function measureLoudness(buffer, seconds = buffer.duration) {
  const fs = buffer.sampleRate;
  const n = Math.min(buffer.length, Math.floor(seconds * fs));
  const channels = Math.min(2, buffer.numberOfChannels);
  const block = Math.floor(fs * 0.4);
  const step = 2; // decimate for speed; plenty for a level estimate
  const blocks = [];

  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    const shelf = highShelf(fs, 1681, 4);
    const hp = highPass(fs, 38);
    let acc = 0, count = 0, b = 0;
    for (let i = 0; i < n; i += step) {
      const v = hp(shelf(data[i]));
      acc += v * v; count++;
      if (count * step >= block) {
        blocks[b] = (blocks[b] || 0) + acc / count;
        b++; acc = 0; count = 0;
      }
    }
  }
  if (!blocks.length) return 0;
  const perBlock = blocks.map((ms) => ms / channels);

  // Absolute gate (-70 dBFS) then relative gate (10 dB below the ungated mean).
  const abs = perBlock.filter((ms) => ms > 1e-7);
  if (!abs.length) return 0;
  const mean1 = abs.reduce((a, v) => a + v, 0) / abs.length;
  const kept = abs.filter((ms) => ms > mean1 / 10);
  const mean2 = kept.reduce((a, v) => a + v, 0) / kept.length;
  return Math.sqrt(mean2);
}

function lowPass(fs, f0, q = 0.7071) {
  const w0 = 2 * Math.PI * f0 / fs;
  const cos = Math.cos(w0), sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const b0 = (1 - cos) / 2, b1 = 1 - cos, b2 = (1 - cos) / 2;
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  return biquad(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

/**
 * RMS of the "presence" band (where voices and lead melodies live). Used to keep
 * sparse tracks audible next to dense ones: two tracks can match in overall
 * loudness while one has far less energy where the ear picks out a song.
 */
export function measurePresence(buffer, seconds = buffer.duration, lo = 1000, hi = 4000) {
  const fs = buffer.sampleRate;
  const n = Math.min(buffer.length, Math.floor(seconds * fs));
  const data = buffer.getChannelData(0);
  const hp1 = highPass(fs, lo, 0.7071), hp2 = highPass(fs, lo, 0.7071);
  const lp1 = lowPass(fs, hi), lp2 = lowPass(fs, hi);
  let acc = 0, count = 0;
  for (let i = 0; i < n; i += 2) {
    const v = lp2(lp1(hp2(hp1(data[i]))));
    acc += v * v; count++;
  }
  return count ? Math.sqrt(acc / count) : 0;
}
