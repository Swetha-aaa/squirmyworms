// String lights draped across the top of the page: a dark wire in a few loose
// swoops with glowing bulbs, mostly green with the game's pink, cyan, gold and
// lilac mixed in. A few bulbs twinkle at a time, out of step with each other.

const NS = 'http://www.w3.org/2000/svg';
const INK = '#22122E';
const BULBS = ['#6BE38A', '#6BE38A', '#FF4FA3', '#6BE38A', '#45D9FF', '#FFC857', '#6BE38A', '#A98CFF'];

const cubic = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

/** @returns {HTMLElement} */
export function createLights({ width = 1600, swoops = 4, perSwoop = 7 } = {}) {
  const H = 110;
  const segs = [];
  for (let i = 0; i < swoops; i++) {
    const x0 = (width / swoops) * i, x1 = (width / swoops) * (i + 1);
    const sag = 58 + (i % 2) * 14;
    segs.push([[x0, 6], [x0 + (x1 - x0) * 0.3, sag], [x0 + (x1 - x0) * 0.7, sag], [x1, 6]]);
  }
  const d = segs.map((s, i) => `${i ? '' : `M${s[0][0]} ${s[0][1]}`} C ${s[1].join(' ')}, ${s[2].join(' ')}, ${s[3].join(' ')}`).join(' ');

  let bulbs = '', n = 0;
  segs.forEach((s) => {
    for (let k = 0; k < perSwoop; k++) {
      const t = (k + 0.5) / perSwoop;
      const [x, y] = cubic(...s, t);
      const c = BULBS[n % BULBS.length];
      const tilt = (t - 0.5) * -40;
      bulbs += `<g class="bulb" style="--d:${((n * 0.73) % 4).toFixed(2)}s; --c:${c}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(1)})">
        <circle class="bulb-glow" cx="0" cy="14" r="15" fill="${c}"/>
        <rect x="-4" y="-1" width="8" height="7" rx="1.5" fill="#3A2A40" stroke="${INK}" stroke-width="1.8"/>
        <path class="bulb-glass" d="M0 5 C -7 5 -8 13 -6 18 C -4 23 4 23 6 18 C 8 13 7 5 0 5 Z" fill="${c}" stroke="${INK}" stroke-width="2"/>
        <path d="M-3 10 q -1.5 3 -0.5 6" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round"/>
      </g>`;
      n++;
    }
  });

  const el = document.createElement('div');
  el.className = 'lights';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
  <svg viewBox="0 0 ${width} ${H}" preserveAspectRatio="xMidYMin slice" xmlns="${NS}">
    <path d="${d}" fill="none" stroke="#0A0710" stroke-width="3.4" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#4A3A58" stroke-width="1.6" stroke-linecap="round"/>
    ${bulbs}
  </svg>`;
  return el;
}
