import { h, icon } from '../ui/dom.js';
import { CATEGORIES } from '../data/categories.js';
import { wordmark, categoryTile } from './shared.js';
import { doodleStar, doodleArrow, tape, note, sketchIcon, connector } from '../components/doodles.js';
import { createCassette } from '../components/cassette.js';
import { createWorm, createMascot, createStandingWorm } from '../components/worms.js';
import { createBoombox } from '../components/boombox.js';
import { dataSource } from '../data/index.js';
import { createLights } from '../components/lights.js';

export function renderHome({ engine, category, onPlay, onPickCategory, onAllMixes, onDuel }) {
  const steps = [
    ['Listen', 'Four songs, all at once.', '#45D9FF', { mood: 'sing', acc: ['headphones', 'notes'], noteColor: '#FF4FA3' }],
    ['Search', 'Type a title or an artist.', '#6BE38A', { mood: 'happy', acc: ['magnifier'] }],
    ['Lock in', 'One at a time. Three wrong and it\'s over.', '#FF4FA3', { mood: 'excited', acc: ['padlock'] }],
    ['Score', 'The faster you finish, the bigger the bonus.', '#FFC857', { mood: 'excited', acc: ['trophy', 'sparkles'] }],
  ];

  // The boombox is the one moving thing up top: notes drift out of its speakers
  // (each with its own colour, size and path), and tapping it makes the worm hop
  // and throws out a burst of notes.
  const NOTE_COLORS = ['#FF4FA3', '#45D9FF', '#FFC857', '#A98CFF', '#6BE38A'];
  // chunky outlined notes drawn to match the boombox (font glyphs vary by device)
  const NOTE_SVGS = [
    (c) => `<svg viewBox="0 0 24 30"><path d="M16 3 V20" stroke="#22122E" stroke-width="5" stroke-linecap="round"/><path d="M16 3 V20" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/><path d="M16 3 q6 2 6 8" fill="none" stroke="#22122E" stroke-width="5" stroke-linecap="round"/><path d="M16 3 q6 2 6 8" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="10.5" cy="21.5" rx="7" ry="5.5" transform="rotate(-20 10.5 21.5)" fill="${c}" stroke="#22122E" stroke-width="2.6"/></svg>`,
    (c) => `<svg viewBox="0 0 34 30"><path d="M11 6 L28 2" stroke="#22122E" stroke-width="7" stroke-linecap="round"/><path d="M11 6 L28 2" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/><path d="M11 6 V21 M28 2 V17" stroke="#22122E" stroke-width="5" stroke-linecap="round"/><path d="M11 6 V21 M28 2 V17" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="6.5" cy="22" rx="6" ry="4.8" transform="rotate(-20 6.5 22)" fill="${c}" stroke="#22122E" stroke-width="2.4"/><ellipse cx="23.5" cy="18" rx="6" ry="4.8" transform="rotate(-20 23.5 18)" fill="${c}" stroke="#22122E" stroke-width="2.4"/></svg>`,
  ];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const timers = [];
  const notesLayer = h('span', { class: 'note-fx-layer', 'aria-hidden': 'true' });

  function spawnNote(burst = false) {
    const fromLeft = Math.random() < .5;
    const n = h('span', {
      class: 'note-fx',
      style: [
        `left:${fromLeft ? rand(14, 30) : rand(70, 86)}%`,
        `top:${rand(52, 66)}%`,
        `width:${rand(burst ? 22 : 18, burst ? 36 : 30).toFixed(0)}px`,
        `--dx:${((fromLeft ? -1 : 1) * rand(burst ? 40 : 14, burst ? 120 : 60)).toFixed(0)}px`,
        `--dy:${(-rand(burst ? 90 : 110, burst ? 170 : 190)).toFixed(0)}px`,
        `--rot:${rand(-35, 35).toFixed(0)}deg`,
        `--dur:${rand(burst ? 1.2 : 2.6, burst ? 1.8 : 3.8).toFixed(2)}s`,
      ].join(';'),
    });
    n.innerHTML = pick(NOTE_SVGS)(pick(NOTE_COLORS));
    notesLayer.append(n);
    n.addEventListener('animationend', () => n.remove());
  }
  function drift() {
    if (!el.isConnected) return;
    spawnNote();
    timers.push(setTimeout(drift, rand(700, 1600)));
  }

  const boombox = createBoombox({ palette: 'hero', className: 'hero-boombox' });
  boombox.setPlaying(true);
  const mascot = createMascot({ color: '#FF4FA3' });

  const el = h('main', { class: 'screen screen-home' },
    createLights(),
    h('section', { class: 'hero' },
      doodleStar('star-a', 0), doodleStar('star-b', 1), doodleStar('star-c', 2),
      h('div', { class: 'hero-mark' }, wordmark('xl')),
      h('div', { class: 'hero-copy' },
        h('p', { class: 'tagline' }, 'Four songs. One mix.'),
        h('p', { class: 'lede' }, 'Hear through the chaos. Name every track.'),
        h('div', { class: 'hero-actions' },
          h('button', { class: 'btn btn-primary btn-lg btn-skew', type: 'button', onClick: onPlay },
            h('span', { class: 'btn-inner' }, icon('play'), 'Play now')),
          h('button', { class: 'btn btn-lg btn-skew btn-duel', type: 'button', onClick: onDuel },
            h('span', { class: 'btn-inner' }, icon('duel'), 'Duel a friend')),
        ),
      ),
      h('div', { class: 'hero-object' },
        h('button', { class: 'boombox-btn', type: 'button', 'aria-label': 'Turn it up', onClick: hype }, mascot, boombox.el, notesLayer)),
    ),

    h('section', { class: 'tiles-section' },
      h('div', { class: 'section-head' },
        h('h2', {}, 'Choose your mix'),
      ),
      h('div', { class: 'tiles tiles-duo' },
        CATEGORIES.map((c, i) => categoryTile(c, c.id === category.id, () => onPickCategory(c), i)),
      ),
    ),

    h('section', { class: 'howto' },
      h('div', { class: 'section-head' },
        h('h2', {}, 'How to play'),
      ),
      h('ol', { class: 'steps steps-worms' },
        steps.map(([title, body, color, look], i) =>
          h('li', { class: 'step', style: `--c:${color}; --rot:${[-1.2, 0.8, -0.6, 1.1][i]}deg` },
            h('div', { class: 'step-stage' },
              h('span', { class: 'step-num' }, String(i + 1)),
              createStandingWorm({ color, ...look, className: 'step-worm' }),
            ),
            h('h3', { class: 'step-title' }, title),
            h('p', { class: 'step-body' }, body),
          )
        ),
      ),
    ),

    h('footer', { class: 'foot' },
      h('span', {}, dataSource().config.attribution),
    ),
  );

  function hype() {
    if (reduceMotion) return;
    mascot.classList.remove('is-hop'); void mascot.offsetWidth; mascot.classList.add('is-hop');
    boombox.el.classList.remove('is-boom'); void boombox.el.offsetWidth; boombox.el.classList.add('is-boom');
    for (let i = 0; i < 9; i++) spawnNote(true);
  }
  if (!reduceMotion) timers.push(setTimeout(drift, 600));

  return { el, destroy() { timers.forEach(clearTimeout); } };
}
