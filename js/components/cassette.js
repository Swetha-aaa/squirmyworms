// A cassette drawn like an ink sketch: wobbly double-stroked outlines, cross-hatched
// shading, big dark tape spools, a script label and a few music notes drifting off
// it. Strokes are light ink on the dark board. Hubs spin while `.is-spinning` is set.

import { mulberry32 } from '../util/seed.js';

let uid = 0;
const INK = '#F1EAF7';

export function createCassette({ label = 'side A', title = 'Pop mix', size = 'lg', notes = true } = {}) {
  const id = `cs${++uid}`;
  const rand = mulberry32(0x5eed + uid);
  const wrap = document.createElement('div');
  wrap.className = `cassette cassette-${size}`;
  wrap.setAttribute('aria-hidden', 'true');

  // Wobbly rounded rectangle path: many short segments with a little hand jitter.
  function sketchRect(x, y, w, h, r, jitter = 0.9) {
    const pts = [];
    const step = 7;
    const push = (px, py) => pts.push([px + (rand() - 0.5) * jitter * 2, py + (rand() - 0.5) * jitter * 2]);
    for (let t = x + r; t <= x + w - r; t += step) push(t, y);
    arc(x + w - r, y + r, r, -Math.PI / 2, 0, push);
    for (let t = y + r; t <= y + h - r; t += step) push(x + w, t);
    arc(x + w - r, y + h - r, r, 0, Math.PI / 2, push);
    for (let t = x + w - r; t >= x + r; t -= step) push(t, y + h);
    arc(x + r, y + h - r, r, Math.PI / 2, Math.PI, push);
    for (let t = y + h - r; t >= y + r; t -= step) push(x, t);
    arc(x + r, y + r, r, Math.PI, Math.PI * 1.5, push);
    return 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ') + ' Z';
  }
  function arc(cx, cy, r, a0, a1, push) {
    const n = 6;
    for (let i = 1; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  }
  function sketchCircle(cx, cy, r, jitter = 0.7) {
    const pts = [];
    const n = Math.max(18, Math.round(r * 1.2));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r + (rand() - 0.5) * jitter * 2;
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
    }
    return 'M' + pts.join(' L ') + ' Z';
  }
  // Short hatch strokes filling a rect region, for shading.
  function hatch(x, y, w, h, gap = 5, angle = 45, len = 0) {
    const out = [];
    const L = len || Math.hypot(w, h);
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * L, dy = Math.sin(rad) * L;
    for (let t = -h; t < w + h; t += gap) {
      const x0 = x + t + (rand() - 0.5), y0 = y + (rand() - 0.5);
      out.push(`M${x0.toFixed(1)} ${y0.toFixed(1)} l ${(-dx).toFixed(1)} ${dy.toFixed(1)}`);
    }
    return out.join(' ');
  }
  const twice = (d, w = 1.6, o = 0.9) =>
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-opacity="${o}" stroke-linejoin="round" stroke-linecap="round"/>
     <path d="${d}" fill="none" stroke="${INK}" stroke-width="${w * 0.6}" stroke-opacity="${o * 0.45}" stroke-linejoin="round" stroke-linecap="round" transform="translate(0.8 0.6)"/>`;

  const shell = sketchRect(10, 14, 300, 176, 16);
  const shellInner = sketchRect(16, 20, 288, 164, 12, 0.6);
  const labelRect = sketchRect(38, 32, 244, 58, 5);
  const window = sketchRect(94, 96, 132, 58, 26, 0.6);
  const bottom = `M 90 188 L 106 162 L 214 162 L 230 188`;

  wrap.innerHTML = `
  <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="${id}-shell"><path d="${shell}"/></clipPath>
      <clipPath id="${id}-win"><rect x="96" y="98" width="128" height="54" rx="24"/></clipPath>
      <clipPath id="${id}-label"><rect x="40" y="34" width="240" height="54" rx="4"/></clipPath>
    </defs>

    <!-- shadow hatching under the shell -->
    <path d="${hatch(20, 190, 290, 6, 6, 55, 10)}" stroke="${INK}" stroke-opacity=".28" stroke-width="1"/>
    <path d="${hatch(306, 30, 6, 160, 6, 35, 9)}" stroke="${INK}" stroke-opacity=".22" stroke-width="1"/>

    <!-- shell -->
    <path d="${shell}" fill="#120C1B" fill-opacity=".85"/>
    ${twice(shell, 2.2, 0.95)}
    ${twice(shellInner, 1, 0.45)}
    <!-- edge shading inside the shell -->
    <g clip-path="url(#${id}-shell)">
      <path d="${hatch(14, 170, 300, 18, 5, 40, 12)}" stroke="${INK}" stroke-opacity=".22" stroke-width="1"/>
      <path d="${hatch(290, 20, 18, 170, 5, 70, 12)}" stroke="${INK}" stroke-opacity=".18" stroke-width="1"/>
    </g>

    <!-- screws -->
    ${screw(24, 28)}${screw(296, 28)}${screw(24, 178)}${screw(296, 178)}

    <!-- label -->
    <path d="${labelRect}" fill="${INK}" fill-opacity=".1"/>
    ${twice(labelRect, 1.4, 0.85)}
    <g clip-path="url(#${id}-label)">
      <path d="${hatch(40, 34, 240, 12, 4, 50, 14)}" stroke="#FF4FA3" stroke-opacity=".85" stroke-width="1.3"/>
      <path d="${hatch(40, 46, 240, 4, 4, 50, 7)}" stroke="#8A5CFF" stroke-opacity=".8" stroke-width="1.2"/>
      <path d="M50 84 c 60 -1 120 2 170 -1" fill="none" stroke="${INK}" stroke-opacity=".3" stroke-width="1"/>
    </g>
    ${title ? `<text x="160" y="72" text-anchor="middle" font-family="'Caveat', cursive" font-weight="700" font-size="${title.length > 9 ? 26 : 30}" fill="${INK}" transform="rotate(-2 160 72)">${esc(title)}</text>` : ''}
    ${label ? `<text x="272" y="87" text-anchor="end" font-family="'Caveat', cursive" font-weight="700" font-size="13" fill="${INK}" fill-opacity=".75" transform="rotate(-2 272 87)">${esc(label)}</text>` : ''}

    <!-- window with spools -->
    <path d="${window}" fill="#0A0710"/>
    <g clip-path="url(#${id}-win)">
      <!-- tape spools: dense hatching reads as black tape -->
      <path d="${sketchCircle(128, 125, 26)}" fill="#0A0710"/>
      
      <path d="${sketchCircle(192, 125, 16)}" fill="#0A0710"/>
      <path d="M128 99 Q160 110 192 109" fill="none" stroke="${INK}" stroke-opacity=".6" stroke-width="1.6"/>
      <path d="M128 151 Q160 140 192 141" fill="none" stroke="${INK}" stroke-opacity=".6" stroke-width="1.6"/>
    </g>
    ${spool(id, 128, 125, 26, sketchCircle, hatch)}
    ${spool(id, 192, 125, 16, sketchCircle, hatch)}
    ${twice(window, 1.6, 0.9)}
    <!-- hubs -->
    ${hub(128, 125)}${hub(192, 125)}

    <!-- bottom guide and holes -->
    ${twice(bottom, 1.6, 0.85)}
    ${twice(sketchCircle(128, 177, 4.5, 0.4), 1.2, 0.8)}
    ${twice(sketchCircle(192, 177, 4.5, 0.4), 1.2, 0.8)}
    ${twice(sketchRect(152, 171, 16, 12, 2, 0.4), 1.2, 0.8)}
    ${notes ? `
    <!-- music notes drifting off the top-left corner -->
    <g fill="${INK}" fill-opacity=".9" font-family="'DM Sans', sans-serif">
      <text x="6" y="16" font-size="18" transform="rotate(-12 6 16)">♪</text>
      <text x="26" y="8" font-size="14" transform="rotate(8 26 8)">♫</text>
      <text x="300" y="12" font-size="13" transform="rotate(10 300 12)">♪</text>
    </g>` : ''}
  </svg>`;
  return {
    el: wrap,
    setSpinning(on) { wrap.classList.toggle('is-spinning', !!on); },
  };
}

function screw(cx, cy) {
  return `<circle cx="${cx}" cy="${cy}" r="4.5" fill="none" stroke="${INK}" stroke-width="1.4" stroke-opacity=".85"/>
    <path d="M${cx - 2.6} ${cy - 1.8} l 5.2 3.6 M${cx - 2.2} ${cy + 2.2} l 4.4 -4.4" stroke="${INK}" stroke-width="1.1" stroke-opacity=".8" stroke-linecap="round"/>`;
}

// A spool: dark disc with dense circular-ish hatching and a double-stroked rim.
function spool(id, cx, cy, r, sketchCircle, hatch) {
  const cid = `${id}-sp${cx}`;
  const rim = sketchCircle(cx, cy, r, 0.8);
  const rim2 = sketchCircle(cx, cy, r - 4, 0.6);
  return `
    <clipPath id="${cid}"><circle cx="${cx}" cy="${cy}" r="${r - 1}"/></clipPath>
    <g clip-path="url(#${cid})">
      <rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="#0A0710"/>
      <path d="${hatch(cx - r, cy - r, r * 2, r * 2, 2.4, 45, r * 3)}" stroke="${INK}" stroke-opacity=".5" stroke-width=".9"/>
      <path d="${hatch(cx - r, cy - r, r * 2, r * 2, 3.2, 135, r * 3)}" stroke="${INK}" stroke-opacity=".32" stroke-width=".8"/>
    </g>
    <path d="${rim}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-opacity=".95" stroke-linejoin="round"/>
    <path d="${rim2}" fill="none" stroke="${INK}" stroke-width=".9" stroke-opacity=".5" stroke-linejoin="round"/>`;
}

function hub(cx, cy) {
  let s = `<g class="reel" style="transform-origin:${cx}px ${cy}px">
    <circle cx="${cx}" cy="${cy}" r="10.5" fill="#120C1B" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="${cx}" cy="${cy}" r="7.5" fill="none" stroke="${INK}" stroke-width=".9" stroke-opacity=".6"/>`;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 360;
    s += `<rect x="${cx - 1.4}" y="${cy - 10}" width="2.8" height="5.5" rx="1" fill="${INK}" transform="rotate(${a} ${cx} ${cy})"/>`;
  }
  return s + `<circle cx="${cx}" cy="${cy}" r="2.4" fill="${INK}"/></g>`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
