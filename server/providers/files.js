// Files provider: your own audio files, served from audio/<category>/.
//
// Filename convention:  "Artist - Title.mp3"  (also .m4a, .ogg, .wav, .flac)
// Optional audio/<category>/manifest.json can override or add fields per file:
//   { "Artist - Title.mp3": { "title": "...", "artist": "...", "album": "...", "year": 2014, "start": 45 } }
//
// Album and year are filled in from the bundled metadata catalogue when the
// title and artist match. Clips may be full songs or short extracts; the engine
// trims a 30 s window from `start` (default 0).
//
// Only use files you have the rights to. This mode is for private, personal play.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POP_SONGS } from '../../js/data/songs.pop.js';
import { normalise } from '../catalog.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIO_DIR = path.join(ROOT, 'audio');
const EXT = new Set(['.mp3', '.m4a', '.ogg', '.wav', '.flac', '.aac']);

const bundledByKey = new Map();
for (const s of POP_SONGS) bundledByKey.set(`${normalise(s.title)}|${normalise(s.artist.split(/ ft\.| & |, /)[0])}`, s);

function parseName(file) {
  const base = file.replace(/\.[^.]+$/, '');
  const m = base.match(/^(.+?)\s+-\s+(.+)$/);
  if (!m) return { artist: 'Unknown artist', title: base };
  return { artist: m[1].trim(), title: m[2].trim() };
}

export const filesProvider = {
  id: 'files',
  name: 'Your audio files',
  attribution: '',
  attributionUrl: null,
  previewSeconds: 30,
  mergeBundledCatalogue: true, // small pools get the bundled catalogue as autocomplete distractors

  async buildPool(categoryId, _seeds, { log = () => {} } = {}) {
    const dir = path.join(AUDIO_DIR, categoryId);
    let entries = [];
    try { entries = await fs.readdir(dir); } catch { log(`no folder ${dir}`); return []; }
    let manifest = {};
    try { manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8')); } catch { /* optional */ }
    // energy.json labels each clip soft / mid / loud so quiet songs aren't buried
    // under too many loud ones. A manifest entry { "energy": ... } wins.
    let energy = {};
    try { energy = JSON.parse(await fs.readFile(path.join(dir, 'energy.json'), 'utf8')); } catch { /* optional */ }

    const out = [];
    for (const file of entries.sort()) {
      if (!EXT.has(path.extname(file).toLowerCase())) continue;
      const parsed = parseName(file);
      const override = manifest[file] || {};
      const title = override.title || parsed.title;
      const artist = override.artist || parsed.artist;
      const bundled = bundledByKey.get(`${normalise(title)}|${normalise(artist.split(/ ft\.| & |, /)[0])}`);
      const id = `files:${categoryId}:${file}`;
      out.push({
        id,
        provider: 'files',
        providerId: `${categoryId}/${file}`,
        title: bundled?.title || title,
        artist,
        album: override.album || bundled?.album || '',
        year: override.year || bundled?.year,
        category: categoryId,
        artwork: override.artwork || null,
        rank: 1,
        energy: override.energy || energy[file] || 'mid',
        audio: { type: 'url', src: `/audio/${encodeURIComponent(categoryId)}/${encodeURIComponent(file)}`, start: override.start || 0, seconds: 30, gainDb: override.gainDb || 0 },
        availability: 'ok',
      });
    }
    log(`files provider: ${out.length} tracks in ${dir}`);
    return out;
  },

  async probe(providerId) {
    try {
      await fs.access(path.join(AUDIO_DIR, providerId));
      return { ok: true };
    } catch {
      return { ok: false, reason: 'file missing' };
    }
  },

  async openPreviewStream() { return null; }, // files are served statically from /audio
};
