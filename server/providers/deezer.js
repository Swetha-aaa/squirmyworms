// Deezer provider (Simple API, token-free read endpoints).
//
// What this does: looks up seed artists, pulls their top tracks, keeps tracks that
// carry a 30-second preview, and streams a preview through to the browser on
// demand (never written to disk; preview URLs are signed and expire in ~15 min,
// so a fresh one is minted per request).
//
// Licensing reminder (developers.deezer.com/termsofuse): strictly non-commercial,
// content is for private use, no ads or revenue, tell users of these conditions,
// follow Deezer's trademark guidelines. Deezer gives no formal approvals. If this
// game goes public or commercial, get written permission or a licensed provider.

const API_BASE = process.env.DEEZER_API_BASE || 'https://api.deezer.com';
const UA = 'Mixtape/1.0 (non-commercial music guessing game)';

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Deezer ${res.status} for ${path}`);
  const json = await res.json();
  if (json && json.error) throw new Error(`Deezer error ${json.error.code || ''}: ${json.error.message || 'unknown'}`);
  return json;
}

function mapTrack(t, categoryId) {
  if (!t || !t.preview) return null;
  return {
    id: `deezer:${t.id}`,
    provider: 'deezer',
    providerId: String(t.id),
    title: t.title_short || t.title,
    artist: t.artist?.name || '',
    album: t.album?.title || '',
    year: t.release_date ? Number(String(t.release_date).slice(0, 4)) : undefined,
    category: categoryId,
    artwork: t.album?.cover_medium || t.album?.cover || null,
    rank: t.rank || 0,
    explicit: !!t.explicit_lyrics,
    // Never hand the signed CDN URL to the client as the primary source: it expires.
    // The client asks /api/preview?id=... which mints a fresh one and streams it.
    audio: { type: 'url', src: `/api/preview?id=${t.id}`, start: 0, seconds: 30 },
    availability: 'unknown', // becomes 'ok' | 'unavailable' after verification
    link: t.link || `https://www.deezer.com/track/${t.id}`,
  };
}

export const deezerProvider = {
  id: 'deezer',
  name: 'Deezer',
  attribution: 'Song previews, metadata and artwork by Deezer. Non-commercial use, private listening only.',
  attributionUrl: 'https://www.deezer.com',
  previewSeconds: 30,

  async findArtistId(name) {
    const r = await getJson(`/search/artist?q=${encodeURIComponent(name)}&limit=1`);
    return r.data?.[0]?.id || null;
  },

  async artistTopTracks(artistId, limit = 25) {
    const r = await getJson(`/artist/${artistId}/top?limit=${limit}`);
    return r.data || [];
  },

  /** Build a pool of candidate tracks for a category from its seeds. */
  async buildPool(categoryId, seeds, { concurrency = 4, log = () => {} } = {}) {
    const names = seeds.artists.slice();
    const out = [];
    let i = 0;
    async function worker() {
      while (i < names.length) {
        const name = names[i++];
        try {
          const id = await this.findArtistId(name);
          if (!id) { log(`no artist match for "${name}"`); continue; }
          const tracks = await this.artistTopTracks(id, seeds.topTracksPerArtist || 25);
          for (const t of tracks) { const m = mapTrack(t, categoryId); if (m) out.push(m); }
        } catch (err) {
          log(`seed "${name}" failed: ${err.message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker.call(this)));
    return out;
  },

  /** Fresh signed preview URL for a track id. */
  async freshPreviewUrl(providerId) {
    const t = await getJson(`/track/${encodeURIComponent(providerId)}`);
    return t.preview || null;
  },

  /** Cheap playability probe: HEAD/ranged GET on a fresh preview URL. */
  async probe(providerId) {
    try {
      const url = await this.freshPreviewUrl(providerId);
      if (!url) return { ok: false, reason: 'no preview' };
      const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1023', 'User-Agent': UA } });
      if (!(res.status === 200 || res.status === 206)) return { ok: false, reason: `HTTP ${res.status}` };
      const type = res.headers.get('content-type') || '';
      try { await res.body?.cancel(); } catch (_) {}
      if (!/audio|octet-stream|mpeg/i.test(type)) return { ok: false, reason: `not audio (${type})` };
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  },

  /** Open a stream of preview bytes for pass-through to the browser. */
  async openPreviewStream(providerId) {
    const url = await this.freshPreviewUrl(providerId);
    if (!url) return null;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok || !res.body) return null;
    return { body: res.body, type: res.headers.get('content-type') || 'audio/mpeg', length: res.headers.get('content-length') };
  },
};
