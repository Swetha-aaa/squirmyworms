// Album artwork. Uses song.artwork when present, otherwise a deterministic
// procedural cover (seeded by song id) so every track has a stable, distinct look
// without shipping any copyrighted images.

import { hashString, mulberry32, pick } from '../util/seed.js';

const cache = new Map();

function initials(song) {
  const words = song.title.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const a = (words[0] || '?')[0];
  const b = words.length > 1 ? words[1][0] : '';
  return (a + b).toUpperCase();
}

function proceduralCover(song) {
  const rand = mulberry32(hashString(song.id));
  const hue = Math.floor(rand() * 360);
  const hue2 = (hue + 40 + Math.floor(rand() * 60)) % 360;
  const bg = `hsl(${hue} 42% 16%)`;
  const c1 = `hsl(${hue} 70% 56%)`;
  const c2 = `hsl(${hue2} 80% 62%)`;
  const motif = pick(rand, ['ring', 'bars', 'diag', 'dots', 'arc']);
  const x = 20 + rand() * 60;
  const y = 20 + rand() * 60;

  let shape = '';
  if (motif === 'ring') {
    shape = `<circle cx="${x}" cy="${y}" r="34" fill="none" stroke="${c1}" stroke-width="12"/>
             <circle cx="${x}" cy="${y}" r="10" fill="${c2}"/>`;
  } else if (motif === 'bars') {
    const w = 14;
    shape = [0, 1, 2, 3].map((i) =>
      `<rect x="${12 + i * 22}" y="${20 + (rand() * 40)}" width="${w}" height="${30 + rand() * 50}" fill="${i % 2 ? c1 : c2}"/>`
    ).join('');
  } else if (motif === 'diag') {
    shape = `<polygon points="0,100 100,0 100,45 45,100" fill="${c1}"/>
             <polygon points="0,70 70,0 100,0 0,100" fill="${c2}" opacity="0.6"/>`;
  } else if (motif === 'dots') {
    shape = [0, 1, 2].map((i) =>
      `<circle cx="${18 + i * 32}" cy="${y}" r="${8 + rand() * 8}" fill="${i === 1 ? c2 : c1}"/>`
    ).join('');
  } else {
    shape = `<path d="M -10 90 Q 50 ${10 + rand() * 30} 110 90" fill="none" stroke="${c1}" stroke-width="16"/>
             <path d="M -10 110 Q 50 ${40 + rand() * 30} 110 110" fill="none" stroke="${c2}" stroke-width="10"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${bg}"/>
    ${shape}
    <text x="8" y="92" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="18"
      fill="#fff" opacity="0.9">${initials(song)}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export function getArtwork(song) {
  if (song.artwork) return song.artwork;
  if (!cache.has(song.id)) cache.set(song.id, proceduralCover(song));
  return cache.get(song.id);
}

export function artworkEl(song, size = 40) {
  const img = document.createElement('img');
  img.className = 'artwork';
  img.width = size;
  img.height = size;
  img.alt = '';
  img.loading = 'lazy';
  img.src = getArtwork(song);
  return img;
}
