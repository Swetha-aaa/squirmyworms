// Worms: the SquirmyWorms mascot and the worms crawling behind the hero.
// Cartoon style: chunky bodies built from overlapping outlined segments (so the
// rings show up for free), big googly eyes, blush and little antennae.
// The crawl is a travelling wave: each segment lifts a little after the one behind it.

const NS = 'http://www.w3.org/2000/svg';
const INK = '#22122E';
const f = (n) => n.toFixed(1);

// Lighten a hex colour toward white (for belly shine).
function tint(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * amt);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function segment(cx, cy, r, color, anim = '') {
  return `<g>${anim ? '' : ''}
    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${color}" stroke="${INK}" stroke-width="2.4">${anim}</circle>
  </g>`;
}

function face({ x, y, r, look = 0, mood = 'happy' }) {
  // eyes sit in the upper half of the head, nudged toward where it's looking
  const ex = r * 0.42, ey = y - r * 0.08;
  const big = mood === 'excited' || mood === 'star';
  const rx = r * (big ? 0.33 : 0.3), ry = r * (big ? 0.42 : 0.38);
  const px = look * rx * 0.35;
  const blink = `<animate attributeName="ry" dur="4.6s" repeatCount="indefinite" values="${f(ry)};${f(ry)};0.8;${f(ry)}" keyTimes="0;.93;.96;1"/>`;
  const star = (cx, cy, s) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.45 : s;
      d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
    }
    return `<path d="${d}Z" fill="#FFC857" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
  };
  const eye = (cx) => {
    if (mood === 'sing') // happy closed eyes: ^ ^
      return `<path d="M${f(cx - rx)} ${f(ey + 2)} Q${f(cx)} ${f(ey - ry)} ${f(cx + rx)} ${f(ey + 2)}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    if (mood === 'sleep') // closed, drooping
      return `<path d="M${f(cx - rx)} ${f(ey)} Q${f(cx)} ${f(ey + ry * 0.9)} ${f(cx + rx)} ${f(ey)}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    if (mood === 'dizzy') { // x x
      const s = rx * 0.8;
      return `<path d="M${f(cx - s)} ${f(ey - s)} L${f(cx + s)} ${f(ey + s)} M${f(cx + s)} ${f(ey - s)} L${f(cx - s)} ${f(ey + s)}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    }
    const still = mood === 'chill';
    const white = `<ellipse cx="${f(cx)}" cy="${f(ey)}" rx="${f(rx)}" ry="${f(ry)}" fill="#fff" stroke="${INK}" stroke-width="2">${still ? '' : blink}</ellipse>`;
    if (mood === 'star') return white + star(cx, ey + 1, rx * 0.85);
    const pupil = `<ellipse cx="${f(cx + px)}" cy="${f(ey + ry * 0.18)}" rx="${f(rx * 0.55)}" ry="${f(ry * 0.55)}" fill="${INK}">${still ? '' :
      `<animate attributeName="ry" dur="4.6s" repeatCount="indefinite" values="${f(ry * 0.55)};${f(ry * 0.55)};0.4;${f(ry * 0.55)}" keyTimes="0;.93;.96;1"/>`}</ellipse>
      <circle cx="${f(cx + px - rx * 0.18)}" cy="${f(ey - ry * 0.08 + (still ? ry * 0.3 : 0))}" r="${f(rx * 0.2)}" fill="#fff"/>`;
    const lid = still // sleepy half-closed lid
      ? `<path d="M${f(cx - rx - 1)} ${f(ey + 1)} A${f(rx + 1)} ${f(ry + 1)} 0 0 1 ${f(cx + rx + 1)} ${f(ey + 1)} Z" fill="var(--wc)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
      : '';
    return white + pupil + lid;
  };
  const shades = `
    <path d="M${f(x - r * 0.86)} ${f(ey - r * 0.24)} H${f(x + r * 0.86)}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M${f(x - r * 0.84)} ${f(ey - r * 0.24)} h${f(r * 0.7)} q0 ${f(r * 0.5)} ${f(-r * 0.36)} ${f(r * 0.5)} q${f(-r * 0.36)} 0 ${f(-r * 0.34)} ${f(-r * 0.5)}Z" fill="${INK}"/>
    <path d="M${f(x + r * 0.14)} ${f(ey - r * 0.24)} h${f(r * 0.7)} q0 ${f(r * 0.5)} ${f(-r * 0.36)} ${f(r * 0.5)} q${f(-r * 0.36)} 0 ${f(-r * 0.34)} ${f(-r * 0.5)}Z" fill="${INK}"/>
    <path d="M${f(x - r * 0.7)} ${f(ey - r * 0.1)} l${f(r * 0.18)} ${f(-r * 0.08)} M${f(x + r * 0.28)} ${f(ey - r * 0.1)} l${f(r * 0.18)} ${f(-r * 0.08)}" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>`;
  const mx = x + look * r * 0.12, my = y + r * 0.42;
  const mw = r * (mood === 'excited' ? 0.38 : mood === 'shades' ? 0.4 : mood === 'chill' ? 0.2 : 0.3);
  let mouth;
  if (mood === 'sing') {
    mouth = `<ellipse cx="${f(mx)}" cy="${f(my + r * 0.04)}" rx="${f(r * 0.15)}" ry="${f(r * 0.2)}" fill="${INK}"/><ellipse cx="${f(mx)}" cy="${f(my + r * 0.14)}" rx="${f(r * 0.09)}" ry="${f(r * 0.07)}" fill="#FF6F9C"/>`;
  } else if (mood === 'chill') {
    mouth = `<path d="M${f(mx - mw)} ${f(my)} Q${f(mx)} ${f(my + mw * 0.9)} ${f(mx + mw)} ${f(my - 1)}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
  } else if (mood === 'sleep') {
    mouth = `<ellipse cx="${f(mx)}" cy="${f(my + 1)}" rx="${f(r * 0.08)}" ry="${f(r * 0.1)}" fill="${INK}"/>`;
  } else if (mood === 'dizzy') {
    const w = r * 0.3;
    mouth = `<path d="M${f(mx - w)} ${f(my + 2)} q${f(w / 2)} -4 ${f(w)} 0 t${f(w)} 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
  } else {
    const deep = mood === 'excited' ? 1.7 : 1.3, tongue = mood === 'excited' ? 0.85 : 0.55;
    mouth = `<path d="M${f(mx - mw)} ${f(my - 2)} Q${f(mx)} ${f(my + mw * deep)} ${f(mx + mw)} ${f(my - 2)} Z" fill="${INK}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M${f(mx - mw * 0.45)} ${f(my + mw * tongue)} Q${f(mx)} ${f(my + mw * 0.2)} ${f(mx + mw * 0.45)} ${f(my + mw * tongue)}" fill="#FF6F9C"/>`;
  }
  return `
    <ellipse cx="${f(x - r * 0.62)}" cy="${f(y + r * 0.36)}" rx="${f(r * 0.17)}" ry="${f(r * 0.1)}" fill="#FF3D7F" fill-opacity=".45"/>
    <ellipse cx="${f(x + r * 0.62)}" cy="${f(y + r * 0.36)}" rx="${f(r * 0.17)}" ry="${f(r * 0.1)}" fill="#FF3D7F" fill-opacity=".45"/>
    ${mood === 'shades' ? shades : eye(x - ex) + eye(x + ex)}
    ${mouth}`;
}

function antennae(x, y, r, color) {
  const a = (dx, lean) => {
    const bx = x + dx, by = y - r * 0.86;
    const tx = bx + lean, ty = by - r * 0.62;
    return `<path d="M${f(bx)} ${f(by + 3)} Q${f(bx + lean * 0.2)} ${f(ty + 4)} ${f(tx)} ${f(ty)}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="${f(tx)}" cy="${f(ty)}" r="${f(r * 0.15)}" fill="${color}" stroke="${INK}" stroke-width="2"/>`;
  };
  return a(-r * 0.32, -r * 0.3) + a(r * 0.32, r * 0.3);
}

/**
 * A crawling worm (side view, head on the right). Size via CSS width.
 * @param {{color?: string, speed?: number, delay?: number}} opts
 */
export function createWorm({ color = '#FF4FA3', speed = 1.4, delay = 0 } = {}) {
  const ground = 78;
  const frames = 12, lift = 6.5;
  // tail -> neck; the last two rise toward the head
  const body = [
    [18, 6], [30, 7.5], [43, 9], [57, 10.2], [71, 11.2], [86, 12], [101, 12.6], [116, 13.2], [130, 13.6],
  ];
  const segs = body.map(([x, r], i) => {
    const base = ground - r;
    const phase = (i / body.length) * Math.PI * 2;
    const vals = Array.from({ length: frames + 1 }, (_, k) =>
      f(base - lift * Math.max(0, Math.sin((k / frames) * Math.PI * 2 - phase)) * (0.5 + 0.5 * (r / 14))));
    const anim = `<animate attributeName="cy" dur="${speed}s" begin="${delay}s" repeatCount="indefinite" values="${vals.join(';')}"/>`;
    return segment(x, base, r, color, anim);
  }).join('');
  const neck = segment(143, 56, 14.2, color) + segment(152, 44, 15, color);
  const hx = 163, hy = 33, hr = 20;
  const el = document.createElement('span');
  el.className = 'worm';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
  <svg viewBox="0 0 200 86" xmlns="${NS}">
    <ellipse cx="96" cy="${ground + 2}" rx="88" ry="4.5" fill="#000" fill-opacity=".28"/>
    ${segs}
    <g>
      <animateTransform attributeName="transform" type="translate" dur="${speed}s" begin="${delay}s" repeatCount="indefinite" values="0 0;1.5 -2.5;0 0"/>
      ${neck}
      ${antennae(hx, hy, hr, color)}
      <circle cx="${hx}" cy="${hy}" r="${hr}" fill="${color}" stroke="${INK}" stroke-width="2.4"/>
      <ellipse cx="${hx - 9}" cy="${hy - 12}" rx="5" ry="2.6" fill="${tint(color, 0.7)}" fill-opacity=".8" transform="rotate(-25 ${hx - 9} ${hy - 12})"/>
      ${face({ x: hx, y: hy, r: hr, look: 1 })}
    </g>
  </svg>`;
  return el;
}

/**
 * A worm standing up front-on, tail curled along the ground.
 * `mood` sets the face, `acc` lists props (headphones, showerCap, bubbles, radio,
 * glasses, arms, crown, sparkles, notes).
 */
export function createStandingWorm({ color = '#FF4FA3', mood = 'happy', acc = [], className = 'mascot', noteColor = '#FFC857' } = {}) {
  const has = (k) => acc.includes(k);
  const path = [
    [12, 141, 5], [21, 140, 7], [31, 138.5, 9], [43, 136.5, 11], [55, 133.5, 13],
    [63, 125, 15], [65, 113, 16], [65, 101, 17], [64, 89, 17.5], [63, 78, 18],
  ];
  const segs = path.map(([x, y, r]) => segment(x, y, r, color)).join('');
  const hx = 63, hy = 54, hr = 25;
  const arm = (x0, y0, x1, y1, cx, cy) => `
    <path d="M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <path d="M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}" fill="none" stroke="${color}" stroke-width="5.4" stroke-linecap="round"/>
    <circle cx="${x1}" cy="${y1}" r="5.5" fill="${color}" stroke="${INK}" stroke-width="2.2"/>`;
  const star = (cx, cy, s, fill) => {
    let d = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, rr = i % 2 ? s * 0.32 : s;
      d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
    }
    return `<path d="${d}Z" fill="${fill}"/>`;
  };
  const cap = () => {
    // scalloped shower cap
    let edge = '';
    const n = 7, x0 = hx - 28, w = 56;
    for (let i = 0; i < n; i++) edge += ` q${f(w / n / 2)} 5 ${f(w / n)} 0`;
    return `<path d="M${x0} ${hy - 6} C ${x0 - 2} ${hy - 44}, ${x0 + w + 2} ${hy - 44}, ${x0 + w} ${hy - 6} Z" fill="#E9F9FF" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M${x0} ${hy - 6}${edge}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="${hx - 12}" cy="${hy - 26}" r="3" fill="#45D9FF" fill-opacity=".5"/><circle cx="${hx + 6}" cy="${hy - 30}" r="2.4" fill="#FF4FA3" fill-opacity=".5"/><circle cx="${hx + 15}" cy="${hy - 20}" r="2.6" fill="#FFC857" fill-opacity=".6"/>`;
  };
  const bubbles = `<g class="wk-float" fill="#fff" fill-opacity=".14" stroke="#BFF3FF" stroke-width="1.6">
      <circle cx="100" cy="30" r="8"/><circle cx="108" cy="56" r="5"/><circle cx="16" cy="46" r="6"/><circle cx="24" cy="20" r="4"/>
      <path d="M96 26 q3 -3 6 -1" fill="none" stroke="#fff" stroke-opacity=".8"/></g>`;
  const radio = `<g transform="rotate(-6 98 128)">
      <path d="M90 116 L112 100" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><circle cx="112" cy="100" r="2.5" fill="${INK}"/>
      <rect x="82" y="114" width="34" height="27" rx="6" fill="#FF8A4C" stroke="${INK}" stroke-width="2.4"/>
      <circle cx="93" cy="128" r="7.5" fill="#FFE3D2" stroke="${INK}" stroke-width="2"/>
      <circle cx="93" cy="128" r="2.4" fill="${INK}"/>
      <rect x="104" y="120" width="8" height="4" rx="2" fill="${INK}"/><rect x="104" y="128" width="8" height="4" rx="2" fill="${INK}"/></g>`;
  const glasses = (() => {
    const ey = hy + 1 - hr * 0.08, ex = hr * 0.42, gr = hr * 0.33;
    return `<circle cx="${f(hx - ex)}" cy="${f(ey)}" r="${f(gr)}" fill="#fff" fill-opacity=".12" stroke="${INK}" stroke-width="2.8"/>
      <circle cx="${f(hx + ex)}" cy="${f(ey)}" r="${f(gr)}" fill="#fff" fill-opacity=".12" stroke="${INK}" stroke-width="2.8"/>
      <path d="M${f(hx - ex + gr)} ${f(ey - 1)} q${f(ex - gr)} -4 ${f((ex - gr) * 2)} 0" fill="none" stroke="${INK}" stroke-width="2.6"/>
      <path d="M${f(hx - ex - gr)} ${f(ey - 2)} L${hx - hr + 1} ${f(ey - 5)} M${f(hx + ex + gr)} ${f(ey - 2)} L${hx + hr - 1} ${f(ey - 5)}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
  })();
  const headphones = `
      <path d="M${hx - 26} ${hy - 2} C ${hx - 28} ${hy - 36}, ${hx + 28} ${hy - 36}, ${hx + 26} ${hy - 2}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
      <path d="M${hx - 26} ${hy - 2} C ${hx - 28} ${hy - 36}, ${hx + 28} ${hy - 36}, ${hx + 26} ${hy - 2}" fill="none" stroke="#45D9FF" stroke-width="3.6" stroke-linecap="round"/>
      <rect x="${hx - 34}" y="${hy - 8}" width="13" height="21" rx="6" fill="#45D9FF" stroke="${INK}" stroke-width="2.4"/>
      <rect x="${hx + 21}" y="${hy - 8}" width="13" height="21" rx="6" fill="#45D9FF" stroke="${INK}" stroke-width="2.4"/>`;
  const crown = `<g transform="rotate(12 ${hx + 6} ${hy - 30})">
      <path d="M${hx - 10} ${hy - 22} L${hx - 13} ${hy - 40} L${hx - 3} ${hy - 31} L${hx + 6} ${hy - 44} L${hx + 14} ${hy - 31} L${hx + 24} ${hy - 40} L${hx + 22} ${hy - 22} Z" fill="#FFC857" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="${hx + 6}" cy="${hy - 27}" r="2.6" fill="#FF4FA3" stroke="${INK}" stroke-width="1.4"/></g>`;
  const sparkles = `<g class="wk-twinkle">${star(104, 30, 9, '#FFC857')}${star(16, 50, 7, '#45D9FF')}${star(98, 82, 5, '#fff')}</g>`;
  const holdArm = has('trophy') || has('lightstick') ? arm(78, 98, 100, 70, 100, 96) : arm(78, 100, 101, 86, 96, 104);
  const magnifier = `<path d="M101 85 L108 76" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M101 85 L108 76" stroke="#C9A06A" stroke-width="3" stroke-linecap="round"/>
      <circle cx="113" cy="67" r="11.5" fill="#CFF4FF" fill-opacity=".9" stroke="${INK}" stroke-width="3.4"/>
      <path d="M106 63 q3 -5 9 -4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
  const padlock = `<g class="wk-shake"><path d="M98 76 v-7 a8 8 0 0 1 16 0 v7" fill="none" stroke="${INK}" stroke-width="5"/><path d="M98 76 v-7 a8 8 0 0 1 16 0 v7" fill="none" stroke="#D9D2E6" stroke-width="2.4"/>
      <rect x="93" y="75" width="26" height="20" rx="4" fill="#FFC857" stroke="${INK}" stroke-width="2.4"/>
      <circle cx="106" cy="83" r="2.8" fill="${INK}"/><path d="M106 84 v5" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/></g>`;
  const trophy = `<g transform="translate(0 -2)"><path d="M90 42 h22 v6 a11 11 0 0 1 -22 0 Z" fill="#FFC857" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M90 45 q-7 0 -6 6 q1 5 8 4 M112 45 q7 0 6 6 q-1 5 -8 4" fill="none" stroke="${INK}" stroke-width="2.2"/>
      <path d="M99 59 h4 v6 h-4 Z M94 65 h14 v4 h-14 Z" fill="#FFC857" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M96 46 v6" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/></g>`;
  // K-pop lightstick: stick in the raised hand, glowing heart bulb on top
  const lightstick = `<g class="wk-wave">
      <path d="M100 70 L103 46" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M100 70 L103 46" stroke="#F4EFFA" stroke-width="3.6" stroke-linecap="round"/>
      <circle cx="104" cy="34" r="17" fill="#C9A8FF" fill-opacity=".28"/>
      <circle cx="104" cy="35" r="11" fill="#E9DDFF" stroke="${INK}" stroke-width="2.4"/>
      <path d="M104 41 c-6 -4 -7 -8 -4 -10 c2 -1 3.5 0 4 1.6 c.5 -1.6 2 -2.6 4 -1.6 c3 2 2 6 -4 10 Z" fill="#FF4FA3" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/></g>`;
  const zzz = `<g class="wk-zzz" fill="#D9D2E6" font-family="'Caveat', cursive" font-weight="700">
      <text x="92" y="34" font-size="16">z</text><text x="102" y="22" font-size="20">z</text><text x="112" y="8" font-size="24">Z</text></g>`;
  const notes = `<g class="mascot-notes" fill="${noteColor}" stroke="${INK}" stroke-width=".8" font-family="'DM Sans', sans-serif" font-weight="700">
      <text x="98" y="30" font-size="18">♪</text><text x="4" y="26" font-size="15">♫</text></g>`;

  const el = document.createElement('span');
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
  <svg viewBox="0 0 120 150" xmlns="${NS}" style="--wc:${color}">
    <ellipse cx="50" cy="147" rx="44" ry="4" fill="#000" fill-opacity=".3"/>
    ${has('radio') ? radio : ''}
    <g class="mascot-body">
      ${segs}
      <path d="M57 120 Q 56 104 57 90" fill="none" stroke="${tint(color, 0.7)}" stroke-opacity=".7" stroke-width="4" stroke-linecap="round"/>
      ${has('arms') ? arm(50, 98, 26, 66, 30, 92) + arm(78, 98, 102, 66, 98, 92) : ''}
      ${has('magnifier') || has('padlock') || has('trophy') ? holdArm : ''}
      ${has('showerCap') ? '' : antennae(hx, hy, hr, color)}
      <circle cx="${hx}" cy="${hy}" r="${hr}" fill="${color}" stroke="${INK}" stroke-width="2.6"/>
      <ellipse cx="${hx - 11}" cy="${hy - 14}" rx="6" ry="3" fill="${tint(color, 0.7)}" fill-opacity=".8" transform="rotate(-25 ${hx - 11} ${hy - 14})"/>
      ${face({ x: hx, y: hy + 1, r: hr, look: 0, mood })}
      ${has('glasses') ? glasses : ''}
      ${has('headphones') ? headphones : ''}
      ${has('showerCap') ? cap() : ''}
      ${has('crown') ? crown : ''}
    </g>
    ${has('magnifier') ? magnifier : ''}${has('padlock') ? padlock : ''}${has('trophy') ? trophy : ''}${has('lightstick') ? lightstick : ''}${has('zzz') ? zzz : ''}
    ${has('bubbles') ? bubbles : ''}
    ${has('sparkles') ? sparkles : ''}
    ${has('notes') ? notes : ''}
  </svg>`;
  return el;
}

/** The home-page mascot. */
export function createMascot({ color = '#FF4FA3' } = {}) {
  return createStandingWorm({ color, mood: 'happy', acc: ['headphones', 'notes'] });
}

/** One look per listener rank, lowest first: colour, face and props. */
export const RANK_LOOKS = [
  { color: '#45D9FF', mood: 'sing',    acc: ['showerCap', 'bubbles'] },      // Shower singer
  { color: '#5CE0A0', mood: 'chill',   acc: ['radio', 'notes'], noteColor: '#FF8A4C' }, // Casual radio listener
  { color: '#FFC857', mood: 'happy',   acc: ['glasses', 'notes'], noteColor: '#45D9FF' }, // Playlist curator
  { color: '#FF8A4C', mood: 'excited', acc: ['arms', 'sparkles'] },          // Front-row fan
  { color: '#A98CFF', mood: 'star',    acc: ['headphones', 'sparkles'] },    // Human Shazam
  { color: '#FF4FA3', mood: 'shades',  acc: ['crown', 'sparkles'] },         // Secret pop star
];

export function createRankWorm(level, className = 'rank-worm') {
  const look = RANK_LOOKS[Math.max(0, Math.min(RANK_LOOKS.length - 1, level - 1))];
  return createStandingWorm({ ...look, className });
}

/** Just a worm head, for small spots like the tracklist. mood: happy | dizzy */
export function createWormHead({ color = '#FF4FA3', mood = 'happy' } = {}) {
  const el = document.createElement('span');
  el.className = 'worm-head-mini';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
  <svg viewBox="0 0 60 62" xmlns="${NS}" style="--wc:${color}">
    ${antennae(30, 38, 20, color)}
    <circle cx="30" cy="38" r="20" fill="${color}" stroke="${INK}" stroke-width="2.4"/>
    ${face({ x: 30, y: 39, r: 20, look: 0, mood })}
  </svg>`;
  return el;
}
