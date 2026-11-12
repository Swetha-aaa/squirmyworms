// Client for the Mixtape backend (/api). Keys and provider calls live server-side.

async function getJson(path, { timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(path, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** null when there is no backend (static hosting, the claude.ai artifact, file://). */
export async function fetchConfig() {
  try {
    return await getJson('/api/config', { timeout: 4000 });
  } catch {
    return null;
  }
}

export const fetchCatalogue = (categoryId) => getJson(`/api/catalog?category=${encodeURIComponent(categoryId)}`);
const ids = (list) => encodeURIComponent((list || []).join('|')); // ids can contain commas
export const fetchRound = (categoryId, n = 4, excludeIds = []) =>
  getJson(`/api/round?category=${encodeURIComponent(categoryId)}&n=${n}&exclude=${ids(excludeIds)}`);
export const fetchReplacements = (categoryId, currentIds, excludeIds, n = 1) =>
  getJson(`/api/replace?category=${encodeURIComponent(categoryId)}&n=${n}&current=${ids(currentIds)}&exclude=${ids(excludeIds)}`);
