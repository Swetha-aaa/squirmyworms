// Catalogue service: builds and caches a per-category track pool from the
// provider, removes duplicate versions, picks rounds, and verifies playability.
// Only metadata is cached (in memory). Audio is never stored.

import { getSeeds } from './categories.js';
import { POP_SONGS } from '../js/data/songs.pop.js';

const BUNDLED = { pop: POP_SONGS };

const POOL_TTL_MS = 6 * 60 * 60 * 1000;
const pools = new Map(); // categoryId -> { builtAt, tracks, building }

const VERSION_WORDS = /\b(remix|remixed|live|acoustic|instrumental|karaoke|sped ?up|slowed|demo|radio edit|edit|version|mix|remaster(ed)?|re-?recorded|taylor's version|from the vault|commentary|stripped|unplugged|orchestral|extended|club|dub|cover)\b/i;

export function normalise(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s*[\(\[\{].*?[\)\]\}]/g, ' ')      // drop (...) and [...] qualifiers
    .replace(/\s+-\s+.*$/, ' ')                    // drop " - Live", " - Remix" tails
    .replace(/\b(feat|ft|featuring|with)\b\.?.*$/, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function primaryArtist(artist) {
  return normalise(String(artist).split(/,|&| x | and |feat\.|ft\./i)[0]);
}

// Every credited artist: "Luis Fonsi & Daddy Yankee ft. Justin Bieber" -> 3 names.
function artistsOf(artist) {
  return String(artist)
    .split(/\s*(?:,|&|\bft\.?|\bfeat\.?|\bfeaturing\b|\bx\b|\band\b|\bwith\b)\s*/i)
    .map((a) => normalise(a))
    .filter(Boolean);
}

export function versionKey(track) {
  return `${normalise(track.title)}|${primaryArtist(track.artist)}`;
}

function isAlternateVersion(track) {
  const raw = `${track.title}`;
  const qualifiers = (raw.match(/[\(\[].*?[\)\]]/g) || []).join(' ') + ' ' + (raw.split(' - ')[1] || '');
  return VERSION_WORDS.test(qualifiers) || /\b(karaoke|instrumental|sped up|slowed)\b/i.test(raw);
}

/** Keep one entry per song (the most popular), drop alternate versions. */
export function dedupe(tracks) {
  const best = new Map();
  for (const t of tracks) {
    if (isAlternateVersion(t)) continue;
    if (!normalise(t.title)) continue;
    const key = versionKey(t);
    const cur = best.get(key);
    if (!cur || (t.rank || 0) > (cur.rank || 0)) best.set(key, t);
  }
  return [...best.values()];
}

export async function getPool(provider, categoryId, { force = false, log = () => {} } = {}) {
  const seeds = getSeeds(categoryId);
  const cached = pools.get(categoryId);
  if (!force && cached && Date.now() - cached.builtAt < POOL_TTL_MS) return cached.tracks;
  if (cached?.building) return cached.building;

  const building = (async () => {
    const t0 = Date.now();
    const raw = await provider.buildPool(categoryId, seeds || { artists: [] }, { log });
    const tracks = dedupe(raw).sort((a, b) => (b.rank || 0) - (a.rank || 0));
    log(`pool ${categoryId}: ${raw.length} raw -> ${tracks.length} unique in ${Date.now() - t0}ms`);
    pools.set(categoryId, { builtAt: Date.now(), tracks });
    return tracks;
  })();
  pools.set(categoryId, { ...(cached || {}), building });
  try { return await building; } finally { const p = pools.get(categoryId); if (p) delete p.building; }
}

/**
 * The answer catalogue for autocomplete. Small pools (your own files) are padded
 * with the bundled metadata catalogue as distractors, so the dropdown doesn't
 * give the round away. Distractors are metadata only (availability 'metadata').
 */
export async function getCatalogue(provider, categoryId, opts = {}) {
  const pool = await getPool(provider, categoryId, opts);
  if (!provider.mergeBundledCatalogue) return pool;
  const seen = new Set(pool.map(versionKey));
  const extras = [];
  for (const s of BUNDLED[categoryId] || []) {
    const key = versionKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
    extras.push({ ...s, provider: 'bundled', providerId: s.id, audio: null, availability: 'metadata' });
  }
  return pool.concat(extras);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Pick `n` verified, distinct songs (one per primary artist) from the pool.
 * Unplayable candidates are replaced before the round is returned.
 */
/**
 * @param exclude  song ids to avoid (recently played); relaxed when the pool is small
 * @param current  song ids already in the round (for replacements)
 */
export async function pickRound(provider, categoryId, { n = 4, exclude = new Set(), current = new Set(), log = () => {} } = {}) {
  const pool = await getPool(provider, categoryId, { log });
  if (pool.length < n) throw new Error(`Category "${categoryId}" has only ${pool.length} playable candidates.`);

  // Small pools (your own files): allow more than one song per artist, and only
  // honour "recently played" exclusions while enough candidates remain.
  const distinctArtists = new Set(pool.flatMap((t) => artistsOf(t.artist))).size;
  const maxPerArtist = Math.max(1, Math.ceil(n / Math.max(1, distinctArtists)));
  // Remember up to ~half the pool as "recently played" so every song sits out a while.
  const keep = Math.max(n * 2, Math.floor(pool.length * 0.55));
  if (exclude.size > keep) exclude = new Set([...exclude].slice(0, keep)); // newest first
  if (exclude.size && pool.filter((t) => !exclude.has(t.id)).length < n + 2) {
    log(`pool ${categoryId}: too small to honour ${exclude.size} exclusions, relaxing`);
    exclude = new Set();
  }

  // Favour recognisable songs: draw from the top 70% by popularity when the pool is big.
  // Only when popularity actually varies (provider data); your own files are all equal.
  const ranksVary = new Set(pool.map((t) => t.rank || 0)).size > 1;
  const head = ranksVary && pool.length > 60 ? pool.slice(0, Math.ceil(pool.length * 0.7)) : pool;
  let candidates = shuffle(head).concat(shuffle(pool.filter((t) => !head.includes(t))));

  // Spread artists out without starving the big ones. An artist from the last
  // round sinks hard; otherwise the penalty is how many of their songs were heard
  // recently relative to how many they have, so each song (not each artist) gets
  // a fair share. Random jitter stops it feeling like a fixed rotation.
  const songsBy = new Map();
  for (const t of pool) for (const a of artistsOf(t.artist)) songsBy.set(a, (songsBy.get(a) || 0) + 1);
  const recentArtist = new Map();
  for (const t of pool) if (exclude.has(t.id)) for (const a of artistsOf(t.artist)) recentArtist.set(a, (recentArtist.get(a) || 0) + 1);
  const lastIds = new Set([...exclude].slice(0, n)); // the browser sends newest first
  const lastArtists = new Set(pool.filter((t) => lastIds.has(t.id)).flatMap((t) => artistsOf(t.artist)));
  if (recentArtist.size) {
    candidates = candidates
      .map((t) => {
        const arts = artistsOf(t.artist);
        const share = Math.max(0, ...arts.map((a) => (recentArtist.get(a) || 0) / (songsBy.get(a) || 1)));
        return { t, k: (arts.some((a) => lastArtists.has(a)) ? 10 : 0) + share * 2 + Math.random() * 1.5 };
      })
      .sort((a, b) => a.k - b.k)
      .map((x) => x.t);
  }

  const chosen = [];
  const artistCount = new Map();
  const usedKeys = new Set();
  const rejected = [];

  // Replacements must respect the songs already in the round (`current`): the
  // per-artist cap and no other version of a song already picked.
  // Soft songs (ballads, acoustic) get drowned by a wall of loud ones, so a
  // round with any soft song holds at most MAX_LOUD_WITH_SOFT loud songs:
  // 2 loud + 2 soft is fine, 3 loud + 1 soft never happens.
  const MAX_LOUD_WITH_SOFT = 2;
  let softCount = 0, loudCount = 0;
  const tally = (t) => { if (t.energy === 'soft') softCount++; else if (t.energy === 'loud') loudCount++; };
  const breaksEnergyMix = (t) =>
    (t.energy === 'loud' && softCount > 0 && loudCount >= MAX_LOUD_WITH_SOFT) ||
    (t.energy === 'soft' && loudCount > MAX_LOUD_WITH_SOFT);

  for (const t of pool) {
    if (!current.has(t.id)) continue;
    for (const a of artistsOf(t.artist)) artistCount.set(a, (artistCount.get(a) || 0) + 1);
    usedKeys.add(versionKey(t));
    tally(t);
  }

  for (const t of candidates) {
    if (chosen.length >= n) break;
    if (exclude.has(t.id) || current.has(t.id)) continue;
    const credited = artistsOf(t.artist);
    const key = versionKey(t);
    if (credited.some((a) => (artistCount.get(a) || 0) >= maxPerArtist) || usedKeys.has(key)) continue;
    if (breaksEnergyMix(t)) continue;
    const probe = await provider.probe(t.providerId);
    if (!probe.ok) { t.availability = 'unavailable'; rejected.push({ id: t.id, reason: probe.reason }); continue; }
    t.availability = 'ok';
    chosen.push(t);
    tally(t);
    for (const a of credited) artistCount.set(a, (artistCount.get(a) || 0) + 1);
    usedKeys.add(key);
  }
  if (chosen.length < n) throw new Error(`Only ${chosen.length} of ${n} candidates were playable.`);
  return { songs: chosen, rejected };
}

export function poolStats() {
  const out = {};
  for (const [k, v] of pools) out[k] = { tracks: v.tracks?.length || 0, builtAt: v.builtAt ? new Date(v.builtAt).toISOString() : null };
  return out;
}
