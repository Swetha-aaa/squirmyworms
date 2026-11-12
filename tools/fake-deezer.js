// A stand-in for the Deezer Simple API, for offline testing of the pipeline.
// Speaks the same JSON shapes the real API returns and serves generated WAV
// "previews" (tones, not music). It exists so the discovery, dedupe, probing,
// replacement and mixing paths can be exercised without network access.
//
//   node tools/fake-deezer.js            (port 8790)
//   MIXTAPE_PROVIDER=deezer DEEZER_API_BASE=http://127.0.0.1:8790 node server/index.js
//
// Deliberate faults, to test handling:
//   Adele   -> preview URLs 404                          (rejected by server probe)
//   Sia     -> preview returns text/html                 (rejected by server probe)
//   Lorde   -> audio/mpeg content-type but garbage bytes (passes probe, fails browser decode -> replaced)
//   Halsey  -> 15-second previews                         (round narrows to 15 s)
//   Taylor Swift has duplicate versions and a null preview (dedupe / skip)

import http from 'node:http';

const PORT = Number(process.env.FAKE_DEEZER_PORT || 8790);
const BASE = `http://127.0.0.1:${PORT}`;

const ARTISTS = [
  'Taylor Swift', 'Ed Sheeran', 'Bruno Mars', 'Ariana Grande', 'The Weeknd', 'Dua Lipa',
  'Billie Eilish', 'Olivia Rodrigo', 'Harry Styles', 'Adele', 'Sia', 'Lorde', 'Halsey', 'Coldplay',
];
const TITLES = ['Midnight Drive', 'Paper Hearts', 'Neon Rain', 'Golden Hour', 'Static', 'Velvet', 'Afterglow', 'Satellite', 'Honey', 'Ghost Town', 'Wildfire', 'Blue Light'];

const artists = ARTISTS.map((name, i) => ({ id: 1000 + i, name }));
const tracks = new Map();
let nextId = 50000;

function addTrack(artist, title, opts = {}) {
  const id = nextId++;
  tracks.set(id, {
    id, title, title_short: title.replace(/\s*[\(\[].*$/, ''), artist: { id: artist.id, name: artist.name },
    album: { id: 9000 + id, title: `${artist.name} Album`, cover_medium: `${BASE}/cover/${id}.svg` },
    rank: 100000 + Math.floor(Math.random() * 900000), release_date: '2020-01-01', explicit_lyrics: false,
    link: `https://www.deezer.com/track/${id}`,
    _preview: opts.preview === null ? null : `${BASE}/preview/${id}.wav`,
    _mode: opts.mode || 'ok', _seconds: opts.seconds || 30,
  });
}

for (const a of artists) {
  for (let i = 0; i < 12; i++) {
    const title = `${TITLES[i]} ${a.name.split(' ')[0]}`;
    const mode = a.name === 'Adele' ? '404' : a.name === 'Sia' ? 'html' : a.name === 'Lorde' ? 'garbage' : 'ok';
    addTrack(a, title, { mode, seconds: a.name === 'Halsey' ? 15 : 30 });
  }
}
const ts = artists[0];
addTrack(ts, 'cardigan');
addTrack(ts, 'cardigan (Live from Paris)');
addTrack(ts, 'cardigan - Acoustic Version');
addTrack(ts, 'willow', { preview: null });

function wav(seconds, freq) {
  const sr = 22050, n = sr * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = 0.5 + 0.5 * Math.sin(t * 2.1); // slow tremolo so envelopes look varied
    const v = Math.sin(2 * Math.PI * freq * t) * 0.35 * env + Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.12;
    buf.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, 44 + i * 2);
  }
  return buf;
}
const wavCache = new Map();

function json(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function publicTrack(t) {
  const { _preview, _mode, _seconds, ...rest } = t;
  const preview = _preview ? `${_preview}?hdnea=exp%3D${Date.now() + 900000}~fake&sig=${Math.random().toString(36).slice(2)}` : null;
  return { ...rest, preview };
}

http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  const p = url.pathname;
  let m;
  if (p === '/search/artist') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const hit = artists.filter((a) => a.name.toLowerCase().includes(q));
    return json(res, { data: hit.map((a) => ({ id: a.id, name: a.name, type: 'artist' })), total: hit.length });
  }
  if ((m = p.match(/^\/artist\/(\d+)\/top$/))) {
    const id = Number(m[1]);
    const limit = Number(url.searchParams.get('limit') || 10);
    const list = [...tracks.values()].filter((t) => t.artist.id === id).slice(0, limit);
    return json(res, { data: list.map(publicTrack), total: list.length });
  }
  if ((m = p.match(/^\/track\/(\d+)$/))) {
    const t = tracks.get(Number(m[1]));
    if (!t) return json(res, { error: { type: 'DataException', message: 'no data', code: 800 } });
    return json(res, publicTrack(t));
  }
  if ((m = p.match(/^\/preview\/(\d+)\.wav$/))) {
    const t = tracks.get(Number(m[1]));
    if (!t || t._mode === '404') { res.writeHead(404); return res.end('not found'); }
    if (t._mode === 'html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html>geo-blocked</html>'); }
    if (t._mode === 'garbage') { res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); return res.end(Buffer.alloc(4096, 0x5a)); }
    if (!wavCache.has(t.id)) wavCache.set(t.id, wav(t._seconds, 180 + (t.id % 40) * 22));
    const body = wavCache.get(t.id);
    const range = req.headers.range;
    if (range) {
      const [a, b] = range.replace('bytes=', '').split('-').map(Number);
      const end = Math.min(isNaN(b) ? body.length - 1 : b, body.length - 1);
      res.writeHead(206, { 'Content-Type': 'audio/wav', 'Content-Range': `bytes ${a}-${end}/${body.length}`, 'Content-Length': end - a + 1 });
      return res.end(body.subarray(a, end + 1));
    }
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': body.length });
    return res.end(body);
  }
  if ((m = p.match(/^\/cover\/(\d+)\.svg$/))) {
    const hue = (Number(m[1]) * 37) % 360;
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${hue} 60% 40%)"/><circle cx="50" cy="50" r="22" fill="hsl(${(hue + 60) % 360} 80% 65%)"/></svg>`);
  }
  json(res, { error: { message: 'unknown endpoint' } }, 404);
}).listen(PORT, () => console.log(`fake deezer on ${BASE} (${tracks.size} tracks, ${artists.length} artists)`));
