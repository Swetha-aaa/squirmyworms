// Duel connection: talks to /api/duel/* and keeps the latest room snapshot.
// One live connection at a time. Survives a page refresh via sessionStorage.

const KEY = 'squirmy.duel';
const NAME_KEY = 'squirmy.name';
const WORM_NAMES = ['Wiggles', 'Noodle', 'Squiggle', 'Slinky', 'Spaghetti', 'Mr Wriggle', 'Gummy', 'Twisty', 'Doodle', 'Sprout'];

let conn = null;   // { code, token }
let es = null;
let state = null;
let offset = 0;    // serverNow - Date.now()
const listeners = new Set();

export const duelState = () => state;
export const duelConn = () => conn;
export const serverNow = () => Date.now() + offset;

export function getName() {
  try { const n = localStorage.getItem(NAME_KEY); if (n) return n; } catch { /* ignore */ }
  return WORM_NAMES[Math.floor(Math.random() * WORM_NAMES.length)];
}
export function setName(n) { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } }

export function onDuel(fn) { listeners.add(fn); if (state) fn(state); return () => listeners.delete(fn); }

async function post(route, body) {
  const r = await fetch(`/api/duel/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

function open(c) {
  close(false);
  conn = c;
  try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
  es = new EventSource(`/api/duel/events?code=${encodeURIComponent(c.code)}&token=${encodeURIComponent(c.token)}`);
  es.onmessage = (e) => {
    const s = JSON.parse(e.data);
    offset = s.serverNow - Date.now();
    state = s;
    listeners.forEach((fn) => fn(s));
  };
  es.onerror = () => {
    // the browser retries by itself; if the room is gone the server answers 404 and we stop
    if (es && es.readyState === EventSource.CLOSED) {
      state = state && { ...state, gone: true };
      listeners.forEach((fn) => fn(state || { gone: true }));
    }
  };
}

export function close(forget = true) {
  if (es) { es.close(); es = null; }
  if (forget) {
    conn = null; state = null;
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  }
}

/** Reconnect after a refresh, if this tab was in a room. */
export function resume() {
  if (conn) return true;
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (c?.code && c?.token) { open(c); return true; }
  } catch { /* ignore */ }
  return false;
}

export async function createRoom(name, category) { open(await post('create', { name, category })); return conn; }
export async function joinRoom(code, name) { open(await post('join', { code, name })); return conn; }
export async function quickMatch(name, category) { open(await post('quick', { name, category })); return conn; }

const withConn = (route, extra = {}) => post(route, { code: conn?.code, token: conn?.token, ...extra });
export const toggleReady = () => withConn('ready');
export const reportLoaded = () => withConn('loaded');
export const guess = (id) => withConn('guess', { id });
export const askRematch = () => withConn('rematch');
export const voteGiveUp = () => withConn('giveup');
export const declineRematch = () => withConn('decline');
export async function leave() {
  if (conn) { try { await withConn('leave'); } catch { /* ignore */ } }
  close(true);
}

export async function clipMeta() {
  const r = await fetch(`/api/duel/clip-meta?code=${encodeURIComponent(conn.code)}&token=${encodeURIComponent(conn.token)}`);
  if (!r.ok) throw new Error('Could not load the clips.');
  return r.json();
}

export async function serverInfo() {
  try { return await (await fetch('/api/duel/info')).json(); } catch { return { lan: [] }; }
}

/** The link to send a friend. On localhost, prefer the Wi-Fi address so it works on their device. */
export async function inviteLink(code) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  let base = location.origin;
  if (local) {
    const info = await serverInfo();
    if (info.lan?.length) base = info.lan[0];
  }
  return { url: `${base}/#duel/${code}`, local, lanOnly: local };
}
