import { createBoombox } from '../components/boombox.js';
import { createStandingWorm } from '../components/worms.js';
import { h } from '../ui/dom.js';

export function wordmark(size = 'md') {
  return h('div', { class: `wordmark wordmark-${size}`, 'aria-label': 'SquirmyWorms' },
    size === 'xl'
      // each letter wiggles a little out of step with the next, like a worm
      ? h('span', { class: 'wordmark-text wordmark-wiggle', 'aria-hidden': 'true' },
          [...'SquirmyWorms'].map((c, i) => h('span', { style: `--i:${i}` }, c)))
      : h('span', { class: 'wordmark-text' }, 'SquirmyWorms'));
}

// Genre glyphs for the category tiles. Simple line icons, one per category.
const GENRE_ICONS = {
  vinyl: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/><circle cx="16" cy="16" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/></svg>`,
  lightstick: `<svg viewBox="0 0 32 32"><path d="M16 4l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L16 17.4l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 20v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12.5 28h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  lantern: `<svg viewBox="0 0 32 32"><path d="M16 4v3M12 7h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="16" cy="16" rx="8.5" ry="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8v16M10.5 10.5c3 3.5 8 3.5 11 0M10.5 21.5c3-3.5 8-3.5 11 0" stroke="currentColor" stroke-width="1.2" opacity=".6"/><path d="M12 25h8M16 25v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  blossom: `<svg viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M16 15c-1-5 2-9 4-9s2 6-4 9z"/><path d="M16 15c4-3 9-3 10-1s-5 5-10 1z"/><path d="M16 15c5 1 8 5 7 7s-6-1-7-7z"/><path d="M16 15c1 5-2 9-4 9s-2-6 4-9z"/><path d="M16 15c-4 3-9 3-10 1s5-5 10-1z"/></g><circle cx="16" cy="15" r="1.6" fill="currentColor"/></svg>`,
  disc: `<svg viewBox="0 0 32 32"><rect x="5" y="4" width="22" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><path d="M9 8h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  pick: `<svg viewBox="0 0 32 32"><path d="M16 28C9 22 5 15 6 8c4-3 16-3 20 0 1 7-3 14-10 20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 12c2.5-1 5.5-1 8 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></svg>`,
};

export function genreIcon(name) {
  const span = document.createElement('span');
  span.className = 'genre-icon';
  span.innerHTML = GENRE_ICONS[name] || GENRE_ICONS.vinyl;
  return span;
}

const TILE_TILT = [-1.4, 1.1, -0.7, 1.6, -1, 0.9];

function reel() {
  const s = document.createElement('span');
  s.className = 'cas-reel';
  s.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  return s;
}

// Each mix gets its own flat retro boombox and colour, plus its own worm.
const MIX_LOOKS = {
  pop: { worm: { mood: 'happy', acc: ['headphones', 'notes'], noteColor: '#FFC857' } },
  kpop: { worm: { mood: 'excited', acc: ['lightstick', 'sparkles'] } },
};

export function categoryTile(category, selected, onPick, index = 0) {
  const look = MIX_LOOKS[category.id] || { worm: { mood: 'happy', acc: [] } };
  const worm = createStandingWorm({ color: category.accent, ...look.worm, className: 'tile-worm-svg' });
  const box = createBoombox({ palette: category.id === 'kpop' ? 'kpop' : 'pop', className: 'mix-boombox' });
  box.setPlaying(selected);
  return h('button', {
    class: `mix-card theme-${category.id}` + (selected ? ' is-selected' : '') + (category.available ? '' : ' is-soon'),
    type: 'button',
    style: `--tile-accent:${category.accent}`,
    'aria-pressed': selected ? 'true' : 'false',
    'aria-label': `${category.name}${category.available ? '' : ', coming soon'}`,
    disabled: !category.available,
    onClick: category.available ? onPick : null,
  },
    h('span', { class: 'mix-bg', 'aria-hidden': 'true' }),
    h('span', { class: 'mix-art', 'aria-hidden': 'true' },
      box.el,
      h('span', { class: 'tile-worm' }, worm),
      category.id === 'pop'
        ? [h('span', { class: 'sticker sticker-heart' }, '♥'), h('span', { class: 'sticker sticker-star' }, '★')]
        : [h('span', { class: 'sticker sticker-spark' }, '✦'), h('span', { class: 'sticker sticker-spark2' }, '✧')],
    ),
    h('span', { class: 'mix-text' },
      h('span', { class: 'mix-name' }, category.name),
      h('span', { class: 'mix-status' }, selected ? 'Playing this mix' : category.available ? 'Tap to play' : 'Coming soon'),
    ),
  );
}

export function sparkle(cls) {
  const s = document.createElement('span');
  s.className = 'sparkle ' + cls;
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z" fill="currentColor"/></svg>`;
  return s;
}
