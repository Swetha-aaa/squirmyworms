// Hand-drawn bits: wobbly stars, a scribbled arrow, masking tape, marker notes.
// Deliberately imperfect paths; nothing here is a perfect circle or straight line.

import { h } from '../ui/dom.js';

const STARS = [
  'M12 2.4 C13.1 6.2 14.3 8.6 17 9.3 C19.6 10 20.8 10.2 21.5 11.6 C18.9 12.7 15.6 13.2 14.6 15.9 C13.7 18.7 13.4 20.6 12.3 21.5 C11.2 18.1 10.4 15.2 7.4 14.2 C4.8 13.3 3.1 12.9 2.4 11.8 C5.6 10.5 8.9 10.4 10.1 7.5 C11 5.3 11.3 3.6 12 2.4 Z',
  'M12 3 C12.6 7.4 13.2 10.2 16.2 11.1 C18.7 11.9 20.3 12 21 12.4 C17.9 13.4 14.8 13.9 13.4 16.8 C12.5 18.7 12.4 20.1 12.1 21 C11.5 17.4 10.6 14.3 7.3 13.3 C5.2 12.7 3.6 12.5 3 12.1 C6.4 11 9.8 10.7 10.9 7.4 C11.4 5.6 11.7 4 12 3 Z',
  'M12 2.8 C12.9 5.9 13.1 9.6 15.9 10.6 C18.4 11.5 20.7 11.3 21.3 12.3 C18.2 13.5 15.1 13.3 14 16.4 C13.2 18.6 13.1 20.4 12.6 21.2 C11.6 18 11 14.6 8 13.4 C5.5 12.4 3.5 12.6 2.6 11.9 C5.9 10.8 9.2 11 10.5 7.8 C11.2 5.9 11.4 4.1 12 2.8 Z',
];

export function doodleStar(cls = '', variant = 0) {
  const el = h('span', { class: 'doodle doodle-star ' + cls, 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 24 24"><path d="${STARS[variant % STARS.length]}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  return el;
}

/**
 * A scribbled arrow. 'down' curls from top-left down to the right;
 * 'left' is a wavy horizontal arrow whose head points left.
 */
export function doodleArrow(cls = '', dir = 'down') {
  const el = h('span', { class: 'doodle doodle-arrow ' + cls, 'aria-hidden': 'true' });
  el.innerHTML = dir === 'left'
    ? `<svg viewBox="0 0 120 40"><path d="M114 22 C 96 8, 80 36, 62 20 C 48 8, 34 30, 12 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M22 10 C 18 14, 14 18, 10 20 C 14 23, 18 27, 21 31" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 120 70"><path d="M6 8 C 30 4, 52 14, 58 34 C 62 48, 74 58, 104 56" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M92 46 C 98 50, 102 54, 106 56 C 100 58, 96 62, 92 66" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return el;
}

/** Masking tape strip. Position with CSS; rotation is per-strip for variety. */
export function tape(cls = '', rotate = -6) {
  return h('span', { class: 'tape ' + cls, 'aria-hidden': 'true', style: `--rot:${rotate}deg` });
}

/** Marker-pen note in the handwriting face. */
export function note(text, cls = '', rotate = -3) {
  return h('span', { class: 'marker-note ' + cls, style: `--rot:${rotate}deg` }, text);
}

export function doodleCrown(cls = '') {
  const el = h('span', { class: 'doodle doodle-crown ' + cls, 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 60 44"><path d="M6 36 C 5 26, 4 18, 3 10 C 10 16, 15 20, 19 22 C 23 14, 26 8, 30 3 C 34 8, 37 14, 41 22 C 45 20, 50 16, 57 10 C 56 18, 55 26, 54 36 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 40 c 14 2, 28 2, 42 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  return el;
}

export function doodleHeadphones(cls = '') {
  const el = h('span', { class: 'doodle doodle-headphones ' + cls, 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 80 70"><path d="M12 48 C 8 30, 14 12, 40 10 C 66 12, 72 30, 68 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10 42 c -6 2, -7 18, 0 22 c 6 2, 12 0, 12 -4 l -1 -16 c -1 -4, -7 -4, -11 -2 z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M70 42 c 6 2, 7 18, 0 22 c -6 2, -12 0, -12 -4 l 1 -16 c 1 -4, 7 -4, 11 -2 z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
  return el;
}

/** Scribbled ring to loop around a wordmark: two overlapping, slightly off ellipses. */
export function scribbleRing(cls = '') {
  const el = h('span', { class: 'doodle scribble-ring ' + cls, 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 400 160" preserveAspectRatio="none"><path d="M60 118 C 10 96, 30 30, 150 22 C 270 14, 390 30, 384 78 C 378 126, 250 150, 130 146 C 70 144, 40 134, 48 116" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M74 128 C 26 110, 36 44, 160 32 C 280 22, 374 44, 370 84 C 366 120, 262 142, 142 138" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/></svg>`;
  return el;
}

export function heart(filled = true) {
  const el = h('span', { class: 'heart' + (filled ? ' is-filled' : ''), 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 24 22"><path d="M12 20.5 C 6 16, 1.5 12, 1.5 7 C 1.5 3.6, 4.2 1.5, 7 1.5 C 9.2 1.5, 11 2.8, 12 4.6 C 13 2.8, 14.8 1.5, 17 1.5 C 19.8 1.5, 22.5 3.6, 22.5 7 C 22.5 12, 18 16, 12 20.5 Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  return el;
}

// Ink-sketch icons for the how-to panels (wobbly single strokes, light ink).
const SKETCH_ICONS = {
  listen: `<svg viewBox="0 0 80 80"><path d="M14 52 C 9 34, 16 14, 40 13 C 64 14, 71 34, 66 52" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M13 44 c -7 2, -8 20, -1 24 c 7 2, 13 0, 13 -5 l -1 -17 c -1 -4, -8 -4, -11 -2 z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M67 44 c 7 2, 8 20, 1 24 c -7 2, -13 0, -13 -5 l 1 -17 c 1 -4, 8 -4, 11 -2 z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M30 30 c 3 -6, 6 -6, 9 0 s 6 6, 9 0 M26 38 c 4 -7, 8 -7, 12 0 s 8 7, 12 0 s 6 -5, 8 -2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></svg>`,
  search: `<svg viewBox="0 0 80 80"><path d="M46 46 C 60 41, 64 22, 50 13 C 38 6, 20 12, 16 26 C 12 40, 24 53, 38 50 C 41 50, 44 48, 46 46 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M48 48 l 18 18 M50 46 l 18 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M24 24 c 4 -5, 10 -7, 16 -5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".7"/><path d="M28 36 l 4 -4 l 4 3 l 5 -6 l 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  lock: `<svg viewBox="0 0 80 80"><path d="M20 36 C 19 46, 19 58, 21 66 C 34 68, 48 68, 60 66 C 62 56, 62 46, 61 36 C 48 34, 33 34, 20 36 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M27 36 C 26 24, 30 13, 41 13 C 52 13, 55 24, 54 35" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M41 46 c -4 0, -5 6, -1 8 l -2 7 l 6 0 l -1 -7 c 4 -2, 2 -8, -2 -8 z" fill="currentColor" opacity=".85"/><path d="M24 40 c 10 -1, 22 -1, 34 0" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5"/><path d="M60 24 l 6 -4 M63 31 l 7 -1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".7"/></svg>`,
  trophy: `<svg viewBox="0 0 80 80"><path d="M24 14 C 34 13, 46 13, 56 14 C 57 28, 54 44, 40 46 C 26 44, 23 28, 24 14 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 20 c -8 0, -12 4, -10 10 c 2 6, 7 8, 12 8 M56 20 c 8 0, 12 4, 10 10 c -2 6, -7 8, -12 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M40 46 c 0 5, 0 9, 0 13 M30 62 c 7 -1, 13 -1, 20 0 M28 68 c 8 -1, 16 -1, 24 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M36 24 l 4 -5 l 4 5 l -3 4 l 3 4 l -4 5 l -4 -5 l 3 -4 z" fill="currentColor" opacity=".8"/><path d="M14 8 l 3 3 M66 8 l -3 3 M40 4 l 0 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".7"/></svg>`,
};

export function sketchIcon(name, cls = '') {
  const el = h('span', { class: 'sketch-icon ' + cls, 'aria-hidden': 'true' });
  el.innerHTML = SKETCH_ICONS[name] || '';
  return el;
}

/** A dotted, hand-drawn connector that runs behind a row of panels. */
export function connector(cls = '') {
  const el = h('span', { class: 'doodle connector ' + cls, 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 800 60" preserveAspectRatio="none"><path d="M10 40 C 120 10, 220 60, 310 30 S 480 10, 560 36 S 720 50, 790 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 7"/></svg>`;
  return el;
}
