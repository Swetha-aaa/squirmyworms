// Mixtape backend: static files + /api. No dependencies, Node 18+.
//
//   MIXTAPE_PROVIDER=files node server/index.js       your own files in audio/<category>/
//   MIXTAPE_PROVIDER=deezer node server/index.js      Deezer previews (non-commercial use only)
//   node server/index.js                              placeholder audio (default)
//
// Endpoints
//   GET /api/config                       provider id, attribution, preview length
//   GET /api/catalog?category=pop         the answer catalogue (metadata only)
//   GET /api/round?category=pop&n=4       four verified, distinct songs
//   GET /api/round?category=pop&n=4&exclude=<recent ids>      four verified songs, avoiding recent ones
//   GET /api/replace?category=pop&current=<round ids>&exclude=<failed ids>&n=1   replacements
//   GET /api/preview?id=<providerId>      streams preview bytes through (no caching)
//   GET /api/health                       pool stats
//   /api/duel/*                           two-player duels (see duel.js)

import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { getProvider } from './providers/index.js';
import { getCatalogue, pickRound, poolStats } from './catalog.js';
import { createDuelHandler } from './duel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const provider = getProvider();
const log = (...a) => console.log(new Date().toISOString(), ...a);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.aac': 'audio/aac' };

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function publicSong(t) {
  // Only what the client needs. providerId stays so /api/preview can mint a fresh URL.
  const { rank, link, ...rest } = t;
  return rest;
}

let handleDuel = null;

async function handleApi(req, res, url) {
  if (url.pathname.startsWith('/api/duel/')) return handleDuel(req, res, url);
  const q = url.searchParams;
  const category = q.get('category') || 'pop';

  if (url.pathname === '/api/config') {
    return sendJson(res, 200, {
      provider: provider.id,
      providerName: provider.name,
      attribution: provider.attribution,
      attributionUrl: provider.attributionUrl,
      previewSeconds: provider.previewSeconds,
    });
  }

  if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true, provider: provider.id, pools: poolStats() });

  if (url.pathname === '/api/catalog') {
    const songs = await getCatalogue(provider, category, { log });
    return sendJson(res, 200, { category, count: songs.length, songs: songs.map(publicSong) });
  }

  if (url.pathname === '/api/round' || url.pathname === '/api/replace') {
    const n = Math.max(1, Math.min(8, Number(q.get('n') || 4)));
    // Id lists are '|'-separated: file names (and so ids) can contain commas,
    // but never '|' on Windows. Plain commas still work for older clients.
    const idList = (v) => (v || '').split((v || '').includes('|') ? '|' : ',').filter(Boolean);
    const exclude = new Set(idList(q.get('exclude'))); // recently played, newest first
    const current = new Set(idList(q.get('current'))); // already in this round
    const { songs, rejected } = await pickRound(provider, category, { n, exclude, current, log });
    return sendJson(res, 200, { category, songs: songs.map(publicSong), rejected, previewSeconds: provider.previewSeconds });
  }

  if (url.pathname === '/api/preview') {
    const id = q.get('id');
    if (!id) return sendJson(res, 400, { error: 'id required' });
    const stream = await provider.openPreviewStream(id);
    if (!stream) return sendJson(res, 404, { error: 'preview unavailable' });
    const headers = { 'Content-Type': stream.type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'none' };
    if (stream.length) headers['Content-Length'] = stream.length;
    res.writeHead(200, headers);
    Readable.fromWeb(stream.body).pipe(res); // pass-through, nothing written to disk
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}server${path.sep}`) || file.includes(`${path.sep}tools${path.sep}`)) {
    res.writeHead(403); return res.end();
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

handleDuel = createDuelHandler({ provider, root: ROOT, port: PORT, log, sendJson });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (err) {
    log('error', url.pathname, err.message);
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
    else res.end();
  }
}).listen(PORT, () => {
  log(`SquirmyWorms on http://localhost:${PORT}  provider=${provider.id}`);
  const lan = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => `http://${a.address}:${PORT}`);
  if (lan.length) log(`Friends on the same Wi-Fi can open: ${lan.join('  ')}`);
  if (provider.id === 'deezer') log('Deezer mode: non-commercial use only; previews are streamed through, never stored.');
  if (provider.id === 'files') log('Files mode: serving audio/<category>/ for private play.');
});
