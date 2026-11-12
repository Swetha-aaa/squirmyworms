// Round state and scoring. Pure data, no DOM, no audio.

import { shuffle } from '../util/seed.js';
import { initialRevealState } from './reveal.js';

export const ROUND_RULES = {
  songsPerRound: 4,
  wrongGuessPenalty: 25, // per wrong lock-in, total score floored at 0
  maxWrongGuesses: 3,    // the round ends and the mix is revealed after this many
  clipSeconds: 30,
  pointsPerSong: 100,
  perfectBonus: 250,
  // Time bonus by how long the round took (seconds from the first play to the
  // finish). Scaled by the share of songs identified, so a blind rush earns nothing.
  timeTiers: [
    [30, 400], [60, 300], [120, 200], [180, 150], [300, 100], [Infinity, 50],
  ],
};

export function timeTierBonus(seconds) {
  for (const [upTo, bonus] of ROUND_RULES.timeTiers) {
    if (seconds <= upTo) return bonus;
  }
  return 0;
}

/**
 * @param songs   candidate pool (local mode) or exactly the chosen songs (`picked: true`)
 * @param duration clip length in seconds; shorter previews (15 s) narrow the reveal range
 */
export function createRound({ category, songs, number, picked = false, duration = ROUND_RULES.clipSeconds }) {
  if (songs.length < ROUND_RULES.songsPerRound) {
    throw new Error(`Category "${category.id}" needs at least ${ROUND_RULES.songsPerRound} songs.`);
  }
  const chosen = picked ? songs.slice(0, ROUND_RULES.songsPerRound) : shuffle(songs).slice(0, ROUND_RULES.songsPerRound);
  const clip = Math.min(ROUND_RULES.clipSeconds, Math.max(1, duration));
  return {
    number,
    category,
    songs: chosen,
    seed: (Date.now() ^ (number * 7919)) >>> 0,
    duration: clip,
    picks: Array(ROUND_RULES.songsPerRound).fill(null),   // current (unlocked) selections
    locked: Array(ROUND_RULES.songsPerRound).fill(null),  // confirmed correct answers per slot
    lockTimes: Array(ROUND_RULES.songsPerRound).fill(null), // seconds after first play each slot was locked
    wrongPicks: [],                                        // songs locked in that were not in the mix
    reveal: initialRevealState(clip),
    createdAt: Date.now(),
    firstPlayAt: null,
    submittedAt: null,
    result: null,
  };
}

export function roundIsComplete(round) {
  return round.locked.every(Boolean);
}

/**
 * Lock in the pick in one slot. Correct if the song is in the mix and not already
 * locked in another slot. A wrong lock-in clears the slot and counts against score.
 * @returns {'correct'|'wrong'|'empty'}
 */
export function lockSlot(round, index) {
  const pick = round.picks[index];
  if (!pick || round.locked[index]) return 'empty';
  const inMix = round.songs.some((s) => s.id === pick.id);
  const alreadyLocked = round.locked.some((s) => s && s.id === pick.id);
  if (inMix && !alreadyLocked) {
    round.locked[index] = pick;
    const started = round.firstPlayAt || round.createdAt;
    round.lockTimes[index] = Math.max(0, (Date.now() - started) / 1000);
    return 'correct';
  }
  round.wrongPicks.push(pick);
  round.picks[index] = null;
  return 'wrong';
}

export function scoreRound(round) {
  const r = ROUND_RULES;
  const lockedIds = new Set(round.locked.filter(Boolean).map((s) => s.id));

  const identified = round.songs.map((song) => ({ song, correct: lockedIds.has(song.id) }));
  const wrongPicks = round.wrongPicks || [];
  const correctCount = identified.filter((x) => x.correct).length;
  const perfect = correctCount === round.songs.length;

  const started = round.firstPlayAt || round.createdAt;
  const seconds = Math.max(0, (round.submittedAt - started) / 1000);

  const lockTimes = (round.lockTimes || []).filter((t) => t != null);
  const avgLockSeconds = lockTimes.length ? lockTimes.reduce((a, t) => a + t, 0) / lockTimes.length : 0;

  const base = correctCount * r.pointsPerSong;
  const bonus = perfect ? r.perfectBonus : 0;
  const timeBonus = Math.round(timeTierBonus(seconds) * (correctCount / round.songs.length));
  const penalty = wrongPicks.length * r.wrongGuessPenalty;

  return {
    identified,
    wrongPicks,
    wrongCount: wrongPicks.length,
    correctCount,
    total: round.songs.length,
    perfect,
    seconds,
    base,
    perfectBonus: bonus,
    timeBonus,
    avgLockSeconds,
    penalty,
    points: Math.max(0, base + bonus + timeBonus - penalty),
  };
}

// Listener ranks by round points. Max in a round is about 1050
// (4 x 100 + 250 perfect + 400 time bonus).
export const RANKS = [
  [0,   'Shower singer',        'Knows every chorus. None of the titles.'],
  [100, 'Casual radio listener', 'Hums along, changes station mid-song.'],
  [300, 'Playlist curator',     'Has opinions about track order.'],
  [500, 'Front-row fan',        'Screams the words before the beat drops.'],
  [700, 'Human Shazam',         'Heard half a second and just knew.'],
  [900, 'Secret pop star',      'Are you sure you did not write these?'],
];

export function rankFor(points) {
  let hit = RANKS[0];
  for (const r of RANKS) if (points >= r[0]) hit = r;
  const idx = RANKS.indexOf(hit);
  const next = RANKS[idx + 1] || null;
  return { title: hit[1], blurb: hit[2], min: hit[0], next: next ? { title: next[1], at: next[0] } : null, level: idx + 1, of: RANKS.length };
}

export function formatSeconds(s) {
  return `${(Math.round(s * 10) / 10).toFixed(1)}s`;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
