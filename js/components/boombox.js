// Flat retro boombox: thick ink outlines, flat fills, two big speakers, a tape
// deck in the middle and a row of chunky keys. Speakers pulse and reels spin
// while "playing". Palettes give each mix its own look.

const NS = 'http://www.w3.org/2000/svg';
const INK = '#2A1B2E';

export const BOOMBOX_PALETTES = {
  pop:  { body: '#FFB547', strip: '#FF6B4A', ring: '#FFF1D6', cone: '#FF4FA3', handle: '#6B5BD6', deck: '#3A2A40', window: '#FFF1D6', keys: ['#FF4FA3', '#45D9FF', '#FFE066', '#8A5CFF'] },
  kpop: { body: '#B8A6FF', strip: '#FF8AD0', ring: '#F4EEFF', cone: '#6B5BD6', handle: '#FF8AD0', deck: '#2F2450', window: '#E9FBFF', keys: ['#FF8AD0', '#7FE3D6', '#FFE066', '#6B5BD6'] },
  hero: { body: '#FFB547', strip: '#3FC1B5', ring: '#FFF1D6', cone: '#FF6B4A', handle: '#FF4FA3', deck: '#3A2A40', window: '#FFF1D6', keys: ['#FF4FA3', '#3FC1B5', '#FFE066', '#8A5CFF', '#FF6B4A'] },
};

function speaker(cx, cy, p) {
  return `<g class="bb-speaker" style="transform-origin:${cx}px ${cy}px">
    <circle cx="${cx}" cy="${cy}" r="44" fill="${p.ring}" stroke="${INK}" stroke-width="4"/>
    <circle cx="${cx}" cy="${cy}" r="34" fill="${INK}"/>
    <g class="bb-cone" style="transform-origin:${cx}px ${cy}px">
      <circle cx="${cx}" cy="${cy}" r="24" fill="${p.cone}" stroke="${INK}" stroke-width="3"/>
      <circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="${INK}" stroke-width="2" stroke-opacity=".45"/>
      <circle cx="${cx}" cy="${cy}" r="7" fill="${p.ring}" stroke="${INK}" stroke-width="2.5"/>
    </g>
    <path d="M${cx - 30} ${cy - 22} a38 38 0 0 1 24 -14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-opacity=".7"/>
  </g>`;
}

function reel(cx, cy) {
  return `<g class="bb-reel" style="transform-origin:${cx}px ${cy}px">
    <circle cx="${cx}" cy="${cy}" r="8" fill="#fff" stroke="${INK}" stroke-width="2.4"/>
    <path d="M${cx} ${cy - 5}v10M${cx - 5} ${cy}h10" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  </g>`;
}

/**
 * @param {{palette?: keyof BOOMBOX_PALETTES | object, className?: string}} opts
 * @returns {{el: HTMLElement, setPlaying: (on: boolean) => void}}
 */
export function createBoombox({ palette = 'pop', className = '' } = {}) {
  const p = typeof palette === 'string' ? BOOMBOX_PALETTES[palette] || BOOMBOX_PALETTES.pop : palette;
  const keys = p.keys.map((c, i, a) => {
    const w = 64 / a.length;
    return `<rect x="${f(128 + i * w)}" y="160" width="${f(w - 3)}" height="16" rx="3" fill="${c}" stroke="${INK}" stroke-width="2.5"/>`;
  }).join('');
  const el = document.createElement('span');
  el.className = `boombox ${className}`.trim();
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
  <svg viewBox="0 0 320 214" xmlns="${NS}">
    <ellipse cx="160" cy="206" rx="140" ry="7" fill="#000" fill-opacity=".25"/>
    <!-- handle -->
    <path d="M78 44 V22 a8 8 0 0 1 8 -8 H234 a8 8 0 0 1 8 8 V44" fill="none" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
    <path d="M78 44 V22 a8 8 0 0 1 8 -8 H234 a8 8 0 0 1 8 8 V44" fill="none" stroke="#9A93A8" stroke-width="5" stroke-linejoin="round"/>
    <rect x="112" y="6" width="96" height="16" rx="8" fill="${p.handle}" stroke="${INK}" stroke-width="4"/>
    <!-- feet -->
    <rect x="34" y="190" width="30" height="12" rx="3" fill="${INK}"/><rect x="256" y="190" width="30" height="12" rx="3" fill="${INK}"/>
    <!-- body -->
    <rect x="8" y="40" width="304" height="154" rx="20" fill="${p.body}" stroke="${INK}" stroke-width="5"/>
    <path d="M24 52 H120" stroke="#fff" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/>
    <!-- top strip: tuner + buttons -->
    <rect x="24" y="58" width="272" height="26" rx="7" fill="${p.strip}" stroke="${INK}" stroke-width="3.5"/>
    <rect x="112" y="63" width="96" height="16" rx="3" fill="${p.window}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M118 71 H202" stroke="${INK}" stroke-width="1.5" stroke-dasharray="2 4"/>
    <path class="bb-needle" d="M150 65 V77" stroke="#E5383B" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="34" y="65" width="14" height="12" rx="3" fill="${p.ring}" stroke="${INK}" stroke-width="2.2"/>
    <rect x="54" y="65" width="14" height="12" rx="3" fill="${p.ring}" stroke="${INK}" stroke-width="2.2"/>
    <rect x="74" y="65" width="14" height="12" rx="3" fill="${p.ring}" stroke="${INK}" stroke-width="2.2"/>
    <circle cx="236" cy="71" r="7" fill="${p.ring}" stroke="${INK}" stroke-width="2.2"/>
    <circle cx="258" cy="71" r="7" fill="${p.ring}" stroke="${INK}" stroke-width="2.2"/>
    <circle class="bb-led" cx="281" cy="71" r="4" fill="#5BE37A" stroke="${INK}" stroke-width="1.6"/>
    <!-- speakers -->
    ${speaker(70, 138, p)}${speaker(250, 138, p)}
    <!-- tape deck -->
    <rect x="124" y="96" width="72" height="58" rx="7" fill="${p.deck}" stroke="${INK}" stroke-width="3.5"/>
    <rect x="132" y="104" width="56" height="30" rx="5" fill="${p.window}" stroke="${INK}" stroke-width="2.5"/>
    <rect x="146" y="112" width="28" height="14" rx="3" fill="#7A5A48" stroke="${INK}" stroke-width="1.8"/>
    ${reel(145, 119)}${reel(175, 119)}
    <rect x="140" y="140" width="40" height="7" rx="3" fill="${p.window}" fill-opacity=".35"/>
    <!-- keys -->
    ${keys}
  </svg>`;
  return {
    el,
    setPlaying(on) { el.classList.toggle('is-playing', !!on); },
  };
}

function f(n) { return Number(n.toFixed(1)); }
