// Data source. Two modes, same interface:
//   remote  a backend with a music provider (see server/) supplies the catalogue,
//           the round's songs and the preview audio
//   local   the bundled metadata catalogue with synthesized placeholder audio
//
// To add a genre locally: create data/songs.<genre>.js, register it below, mark it
// available in categories.js. In remote mode, add seeds in server/categories.js.

import { POP_SONGS } from './songs.pop.js';
import { fetchConfig, fetchCatalogue, fetchRound, fetchReplacements } from './remote.js';
import { shuffle } from '../util/seed.js';

const LOCAL_SONGS = { pop: POP_SONGS };

const source = {
  mode: 'local',
  config: {
    provider: 'synth',
    providerName: 'Placeholder audio',
    attribution: 'Placeholder audio in this build, not the original recordings.',
    attributionUrl: null,
    previewSeconds: 30,
  },
  catalogues: new Map(),
};

export async function initDataSource() {
  const cfg = await fetchConfig();
  if (cfg && cfg.provider && cfg.provider !== 'synth') {
    source.mode = 'remote';
    source.config = cfg;
  }
  return source;
}

export const dataSource = () => source;
export const isRemote = () => source.mode === 'remote';

export async function loadCatalogue(categoryId) {
  if (source.catalogues.has(categoryId)) return source.catalogues.get(categoryId);
  let songs;
  if (isRemote()) {
    const r = await fetchCatalogue(categoryId);
    songs = r.songs;
  } else {
    songs = LOCAL_SONGS[categoryId] || [];
  }
  source.catalogues.set(categoryId, songs);
  return songs;
}

export function getSongsForCategory(categoryId) {
  return source.catalogues.get(categoryId) || LOCAL_SONGS[categoryId] || [];
}

// Recently played songs are avoided in the next rounds so the same mix doesn't
// come back too often. Kept per category in this browser (last RECENT_KEEP ids).
const RECENT_KEEP = 64; // the server keeps up to ~55% of the pool of these
function recentKey(categoryId) { return `mixtape.recent.${categoryId}`; }
export function getRecent(categoryId) {
  try { return JSON.parse(localStorage.getItem(recentKey(categoryId)) || '[]'); } catch { return []; }
}
export function rememberPlayed(categoryId, songs) {
  const next = [...songs.map((s) => s.id), ...getRecent(categoryId)].filter((id, i, a) => a.indexOf(id) === i).slice(0, RECENT_KEEP);
  try { localStorage.setItem(recentKey(categoryId), JSON.stringify(next)); } catch { /* ignore */ }
}

/** Pick n distinct songs for a round, avoiding recent ones. Remote mode verifies playability server-side. */
export async function pickRoundSongs(categoryId, n = 4) {
  const recent = getRecent(categoryId);
  if (isRemote()) {
    const r = await fetchRound(categoryId, n, recent);
    mergeIntoCatalogue(categoryId, r.songs);
    return { songs: r.songs, previewSeconds: r.previewSeconds || source.config.previewSeconds };
  }
  const pool = (await loadCatalogue(categoryId)).filter((s) => s.audio);
  let fresh = pool.filter((s) => !recent.includes(s.id));
  if (fresh.length < n + 2) fresh = pool;
  return { songs: shuffle(fresh).slice(0, n), previewSeconds: 30 };
}

/** Replacements for songs whose audio turned out to be unplayable in the browser. */
export async function pickReplacements(categoryId, currentIds, excludeIds, n = 1) {
  if (isRemote()) {
    const r = await fetchReplacements(categoryId, currentIds, excludeIds, n);
    mergeIntoCatalogue(categoryId, r.songs);
    return r.songs;
  }
  const pool = (await loadCatalogue(categoryId)).filter((s) => s.audio);
  const ex = new Set([...currentIds, ...excludeIds]);
  return shuffle(pool.filter((s) => !ex.has(s.id))).slice(0, n);
}

function mergeIntoCatalogue(categoryId, songs) {
  const list = source.catalogues.get(categoryId);
  if (!list) return;
  const ids = new Set(list.map((s) => s.id));
  for (const s of songs) if (!ids.has(s.id)) list.push(s);
}

export function getSongById(id) {
  for (const list of source.catalogues.values()) {
    const hit = list.find((s) => s.id === id);
    if (hit) return hit;
  }
  for (const list of Object.values(LOCAL_SONGS)) {
    const hit = list.find((s) => s.id === id);
    if (hit) return hit;
  }
  return null;
}
