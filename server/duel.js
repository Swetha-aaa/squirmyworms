// Duel mode: two players hear the same mix, first to name a song claims it.
// A duel is one round (ROUNDS); it plays out until all 4 songs are claimed
// or the clock runs out. Most songs wins; level is a draw.
//
// Rooms live in memory. Each player holds a private token. The server is the
// referee: it picks the songs, judges every guess and decides the winner, and
// pushes the room state to both players over Server-Sent Events.
//
//   POST /api/duel/create  {name}            -> {code, token}       private room, share the code
//   POST /api/duel/join    {code, name}      -> {code, token}
//   POST /api/duel/quick   {name}            -> {code, token}       random opponent (public queue)
//   GET  /api/duel/events?code&token         SSE stream of room snapshots
//   POST /api/duel/ready   {code, token}     ready up (both ready -> 3-round duel starts)
//   POST /api/duel/loaded  {code, token}     audio decoded on this client
//   POST /api/duel/guess   {code, token, id} -> {result: correct|taken|wrong|cooldown|closed}
//   POST /api/duel/giveup  {code, token}     vote to end the round early (both must agree)
//   POST /api/duel/decline {code, token}     turn down a rematch
//   POST /api/duel/rematch {code, token}
//   POST /api/duel/leave   {code, token}
//   GET  /api/duel/audio?code&token&slot     the clip for a slot (urls don't give answers away)
//   GET  /api/duel/info                      LAN addresses, so a link works for friends nearby

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pickRound } from './catalog.js';

const SONGS = 4;
const ROUNDS = 1;               // one round decides it (set higher for best-of-N)
const BETWEEN_MS = 4500;        // round result on screen before the next one loads
const SAFETY_SECONDS = 30 * 60; // no time limit; this only cleans up abandoned rounds
const WRONG_COOLDOWN_MS = 2000; // a wrong guess freezes you briefly
const LOAD_TIMEOUT_MS = 15000;  // start anyway if a client never reports loaded
const COUNTDOWN_MS = 2400;     // 3, 2, 1 at 0.8s each
const FORFEIT_MS = 20000;       // disconnected mid-round this long = forfeit
const ROOM_IDLE_MS = 10 * 60 * 1000;
const COLORS = ['#FF4FA3', '#45D9FF'];

const rooms = new Map();
const quickQueue = []; // codes of public rooms waiting for a second player

const now = () => Date.now();
const token = () => crypto.randomBytes(16).toString('hex');
function newCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
  for (;;) {
    let c = '';
    for (let i = 0; i < 5; i++) c += A[crypto.randomInt(A.length)];
    if (!rooms.has(c)) return c;
  }
}
const cleanName = (n) => String(n || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 16) || 'Mystery worm';

const cleanCategory = (c) => (['pop', 'kpop'].includes(c) ? c : 'pop');

function makeRoom({ isPublic, category }) {
  const room = {
    code: newCode(), isPublic, category,
    phase: 'waiting', // waiting -> loading -> countdown -> playing -> done -> (rematch) loading ...
    players: [],
    round: null,
    result: null,
    match: { round: 0, results: [], betweenUntil: null },
    recent: [],
    touched: now(),
    timers: {},
  };
  rooms.set(room.code, room);
  return room;
}

function addPlayer(room, name) {
  const p = { token: token(), name: cleanName(name), score: 0, wins: 0, roundWins: 0, total: 0, ready: false, loaded: false, rematch: false,
    color: COLORS[room.players.length], clients: new Set(), connected: false, goneAt: null, cooldownUntil: 0, wrong: 0 };
  room.players.push(p);
  return p;
}

const find = (code, tok) => {
  const room = rooms.get(String(code || '').toUpperCase());
  if (!room) return { error: 'That room code does not exist (or it has closed).' };
  const idx = room.players.findIndex((p) => p.token === tok);
  return { room, idx, player: room.players[idx] };
};

// ---- snapshots -------------------------------------------------------------

function snapshot(room, you) {
  const r = room.round;
  const reveal = room.phase === 'done' || room.phase === 'between';
  return {
    code: room.code, isPublic: room.isPublic, category: room.category, phase: room.phase, you, serverNow: now(),
    match: { round: room.match.round, of: ROUNDS, results: room.match.results, betweenUntil: room.match.betweenUntil },
    players: room.players.map((p) => ({ name: p.name, score: p.score, wins: p.wins, roundWins: p.roundWins, total: p.total, ready: p.ready, rematch: p.rematch, color: p.color, connected: p.connected, wrong: p.wrong, giveUp: !!p.giveUp, declined: !!p.declined, left: !!p.left })),
    round: r && {
      startAt: r.startAt, endsAt: r.endsAt, duration: r.duration,
      slots: r.songs.map((s, i) => ({
        claimedBy: r.claims[i]?.by ?? null,
        at: r.claims[i]?.at ?? null,
        song: r.claims[i] || reveal ? pub(s) : null,
      })),
    },
    result: room.result,
  };
}
const pub = (s) => ({ id: s.id, title: s.title, artist: s.artist, album: s.album, year: s.year });

function send(res, room, you) {
  res.write(`data: ${JSON.stringify(snapshot(room, you))}\n\n`);
}
function broadcast(room) {
  room.touched = now();
  room.players.forEach((p, i) => p.clients.forEach((res) => send(res, room, i)));
}

// ---- game flow -------------------------------------------------------------

function newMatch(room) {
  room.match = { round: 0, results: [], betweenUntil: null };
  room.players.forEach((p) => { p.roundWins = 0; p.total = 0; });
}

async function startLoading(room, provider, log) {
  room.phase = 'loading';
  room.result = null;
  room.match.round += 1;
  room.match.betweenUntil = null;
  room.players.forEach((p) => { p.score = 0; p.loaded = false; p.ready = false; p.rematch = false; p.cooldownUntil = 0; p.wrong = 0; p.giveUp = false; p.declined = false; });
  try {
    const { songs } = await pickRound(provider, room.category, { n: SONGS, exclude: new Set(room.recent), log });
    room.recent = songs.map((s) => s.id).concat(room.recent).slice(0, 60);
    room.round = { songs, claims: songs.map(() => null), startAt: null, endsAt: null, duration: provider.previewSeconds || 30 };
  } catch (err) {
    room.phase = 'waiting';
    room.result = { error: `Couldn't pick songs: ${err.message}` };
    return broadcast(room);
  }
  broadcast(room);
  clearTimeout(room.timers.load);
  room.timers.load = setTimeout(() => beginCountdown(room), LOAD_TIMEOUT_MS);
}

function beginCountdown(room) {
  if (room.phase !== 'loading') return;
  clearTimeout(room.timers.load);
  room.phase = 'countdown';
  room.round.startAt = now() + COUNTDOWN_MS;
  room.round.endsAt = null; // no clock: ends when all 4 are claimed or both players agree
  broadcast(room);
  clearTimeout(room.timers.play);
  room.timers.play = setTimeout(() => { if (room.phase === 'countdown') { room.phase = 'playing'; broadcast(room); } }, COUNTDOWN_MS);
  clearTimeout(room.timers.end);
  room.timers.end = setTimeout(() => finish(room, 'time'), COUNTDOWN_MS + SAFETY_SECONDS * 1000);
}

// End of one round. Rounds 1-2 lead to a short break, then the next round
// loads by itself. After round 3 (or a forfeit) the duel is decided:
// most rounds won, then most songs overall, else a draw.
function finish(room, reason, forfeiter = null, provider = room.provider, log = room.log) {
  if (room.phase === 'done' || room.phase === 'between') return;
  ['load', 'play', 'end', 'next'].forEach((k) => clearTimeout(room.timers[k]));
  const [a, b] = room.players;
  let roundWinner = null;
  if (forfeiter == null && a && b && a.score !== b.score) roundWinner = a.score > b.score ? 0 : 1;
  if (room.round) {
    room.match.results.push({ scores: room.players.map((p) => p.score), winner: roundWinner, reason });
    room.players.forEach((p) => { p.total += p.score; });
    if (roundWinner != null) room.players[roundWinner].roundWins += 1;
  }

  if (forfeiter == null && room.match.round < ROUNDS) {
    room.phase = 'between';
    room.match.betweenUntil = now() + BETWEEN_MS;
    room.result = { round: room.match.round, winner: roundWinner, draw: roundWinner == null, reason };
    broadcast(room);
    room.timers.next = setTimeout(() => { if (room.phase === 'between') startLoading(room, provider, log); }, BETWEEN_MS);
    return;
  }

  let winner = null;
  if (forfeiter != null) winner = forfeiter === 0 ? 1 : 0;
  else if (a && b) {
    if (a.roundWins !== b.roundWins) winner = a.roundWins > b.roundWins ? 0 : 1;
    else if (a.total !== b.total) winner = a.total > b.total ? 0 : 1;
  }
  if (winner != null && room.players[winner]) room.players[winner].wins += 1;
  room.phase = 'done';
  room.result = { winner, reason: forfeiter != null ? 'left' : reason === 'agreed' ? 'agreed' : 'match', draw: winner == null,
    tiebreak: winner != null && forfeiter == null && a.roundWins === b.roundWins };
  broadcast(room);
}

// A round always plays out: it ends when every song is claimed or time is up.
function checkEnd(room) {
  if (room.round.claims.every(Boolean)) finish(room, 'all');
}

// ---- matchmaking & housekeeping -------------------------------------------

function dropFromQueue(code) {
  const i = quickQueue.indexOf(code);
  if (i >= 0) quickQueue.splice(i, 1);
}

function closeRoom(room) {
  ['load', 'play', 'end', 'next'].forEach((k) => clearTimeout(room.timers[k]));
  dropFromQueue(room.code);
  room.players.forEach((p) => p.clients.forEach((res) => res.end()));
  rooms.delete(room.code);
}

setInterval(() => {
  const t = now();
  for (const room of rooms.values()) {
    if (room.players.every((p) => !p.connected) && t - room.touched > 60000) { closeRoom(room); continue; }
    if (t - room.touched > ROOM_IDLE_MS && room.players.every((p) => !p.connected)) { closeRoom(room); continue; }
    // forfeit if someone vanished mid-round
    if (['playing', 'countdown', 'loading', 'between'].includes(room.phase)) {
      const gone = room.players.findIndex((p) => !p.connected && p.goneAt && t - p.goneAt > FORFEIT_MS);
      if (gone >= 0) { if (room.phase === 'between') room.phase = 'playing'; finish(room, 'left', gone); }
    }
  }
}, 5000).unref();

function lanUrls(port) {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${port}`);
  }
  return out;
}

// ---- HTTP ------------------------------------------------------------------

async function readJson(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 10000) break; }
  try { return JSON.parse(body || '{}'); } catch { return {}; }
}

export function createDuelHandler({ provider, root, port, log, sendJson }) {
  return async function handleDuel(req, res, url) {
    const q = url.searchParams;
    const route = url.pathname.slice('/api/duel/'.length);

    if (route === 'info') return sendJson(res, 200, { lan: lanUrls(port), roundSeconds: null, rounds: ROUNDS });

    if (route === 'events') {
      const { room, idx, player, error } = find(q.get('code'), q.get('token'));
      if (error || !player) return sendJson(res, 404, { error: error || 'Not in this room.' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 1500\n\n');
      player.clients.add(res);
      player.connected = true; player.goneAt = null;
      broadcast(room);
      const ping = setInterval(() => res.write(': ping\n\n'), 15000);
      req.on('close', () => {
        clearInterval(ping);
        player.clients.delete(res);
        if (!player.clients.size) { player.connected = false; player.goneAt = now(); if (rooms.has(room.code)) broadcast(room); }
      });
      return;
    }

    if (route === 'audio') {
      const { room, player, error } = find(q.get('code'), q.get('token'));
      const slot = Number(q.get('slot'));
      const song = room?.round?.songs?.[slot];
      if (error || !player || !song) return sendJson(res, 404, { error: 'No clip.' });
      const src = song.audio?.src;
      if (src && src.startsWith('/')) {
        const file = path.join(root, decodeURIComponent(src));
        if (!file.startsWith(root)) return sendJson(res, 403, { error: 'no' });
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
        return fs.createReadStream(file).pipe(res);
      }
      const stream = await provider.openPreviewStream?.(song.providerId);
      if (!stream) return sendJson(res, 404, { error: 'Preview unavailable.' });
      res.writeHead(200, { 'Content-Type': stream.type, 'Cache-Control': 'no-store' });
      return Readable.fromWeb(stream.body).pipe(res);
    }

    // automated tests only: start the server with SQUIRMY_TEST=1 to read the answers
    if (route === 'peek' && process.env.SQUIRMY_TEST === '1') {
      const room = rooms.get(q.get('code'));
      return sendJson(res, 200, { ids: room?.round?.songs.map((s) => ({ id: s.id, title: s.title })) || [] });
    }

    if (route === 'clip-meta') {
      // what the engine needs to load each slot, without titles
      const { room, player, error } = find(q.get('code'), q.get('token'));
      if (error || !player || !room.round) return sendJson(res, 404, { error: 'No round.' });
      return sendJson(res, 200, {
        duration: room.round.duration,
        clips: room.round.songs.map((s, i) => {
          const a = s.audio || {};
          const remote = (a.src && a.src.startsWith('/')) || s.providerId;
          return {
            id: `slot-${i}`, title: `Track ${i + 1}`, artist: '',
            audio: remote && a.type !== 'synth'
              ? { type: 'url', src: `/api/duel/audio?code=${room.code}&token=${q.get('token')}&slot=${i}`, start: a.start || 0, seconds: a.seconds || 30, gainDb: a.gainDb || 0 }
              : a,
          };
        }),
      });
    }

    if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
    const body = await readJson(req);

    if (route === 'create') {
      const room = makeRoom({ isPublic: false, category: cleanCategory(body.category) });
      const p = addPlayer(room, body.name);
      log(`duel ${room.code} created`);
      return sendJson(res, 200, { code: room.code, token: p.token });
    }

    if (route === 'quick') {
      const category = cleanCategory(body.category);
      while (quickQueue.length) {
        const room = rooms.get(quickQueue[0]);
        if (room && room.players.length === 1 && room.players[0].connected && room.category === category) {
          quickQueue.shift();
          const p = addPlayer(room, body.name);
          log(`duel ${room.code} matched`);
          broadcast(room);
          return sendJson(res, 200, { code: room.code, token: p.token });
        }
        quickQueue.shift(); // stale
      }
      const room = makeRoom({ isPublic: true, category });
      const p = addPlayer(room, body.name);
      quickQueue.push(room.code);
      return sendJson(res, 200, { code: room.code, token: p.token, waiting: true });
    }

    if (route === 'join') {
      const room = rooms.get(String(body.code || '').toUpperCase().trim());
      if (!room) return sendJson(res, 404, { error: 'That room code does not exist (or it has closed).' });
      if (room.players.length >= 2) return sendJson(res, 409, { error: 'That room is already full.' });
      dropFromQueue(room.code);
      const p = addPlayer(room, body.name);
      broadcast(room);
      return sendJson(res, 200, { code: room.code, token: p.token });
    }

    const { room, idx, player, error } = find(body.code, body.token);
    if (error || !player) return sendJson(res, 404, { error: error || 'Not in this room.' });

    if (route === 'ready') {
      if (room.phase !== 'waiting' || room.players.length < 2) return sendJson(res, 200, { ok: false });
      player.ready = !player.ready;
      broadcast(room);
      if (room.players.every((p) => p.ready)) { room.provider = provider; room.log = log; newMatch(room); startLoading(room, provider, log); }
      return sendJson(res, 200, { ok: true });
    }

    if (route === 'loaded') {
      player.loaded = true;
      if (room.phase === 'loading' && room.players.every((p) => p.loaded || !p.connected)) beginCountdown(room);
      return sendJson(res, 200, { ok: true });
    }

    if (route === 'guess') {
      if (room.phase !== 'playing' && !(room.phase === 'countdown' && now() >= room.round.startAt)) return sendJson(res, 200, { result: 'closed' });
      if (now() < player.cooldownUntil) return sendJson(res, 200, { result: 'cooldown', until: player.cooldownUntil - now() });
      const r = room.round;
      const slot = r.songs.findIndex((s) => s.id === body.id);
      if (slot < 0) {
        player.cooldownUntil = now() + WRONG_COOLDOWN_MS;
        player.wrong += 1;
        broadcast(room);
        return sendJson(res, 200, { result: 'wrong', cooldown: WRONG_COOLDOWN_MS });
      }
      if (r.claims[slot]) return sendJson(res, 200, { result: r.claims[slot].by === idx ? 'mine' : 'taken', slot });
      r.claims[slot] = { by: idx, at: Math.max(0, (now() - r.startAt) / 1000) };
      player.score += 1;
      broadcast(room);
      checkEnd(room);
      return sendJson(res, 200, { result: 'correct', slot, song: pub(r.songs[slot]) });
    }

    // Both players can't find the rest: each votes, and when both agree the round ends.
    if (route === 'giveup') {
      if (room.phase !== 'playing' && room.phase !== 'countdown') return sendJson(res, 200, { ok: false });
      player.giveUp = !player.giveUp;
      broadcast(room);
      if (room.players.length === 2 && room.players.every((p) => p.giveUp)) finish(room, 'agreed');
      return sendJson(res, 200, { ok: true, giveUp: player.giveUp });
    }

    // Say no to a rematch: the other player gets told, and nobody can start one now.
    if (route === 'decline') {
      if (room.phase !== 'done') return sendJson(res, 200, { ok: false });
      player.declined = true;
      room.players.forEach((p) => { p.rematch = false; });
      broadcast(room);
      return sendJson(res, 200, { ok: true });
    }

    if (route === 'rematch') {
      if (room.players.some((p) => p.declined)) return sendJson(res, 200, { ok: false, error: 'Rematch was turned down.' });
      if (room.phase !== 'done') return sendJson(res, 200, { ok: false });
      if (room.players.length < 2 || room.players.some((p) => !p.connected)) return sendJson(res, 200, { ok: false, error: 'Your opponent has left.' });
      player.rematch = true;
      broadcast(room);
      if (room.players.every((p) => p.rematch)) { newMatch(room); startLoading(room, provider, log); }
      return sendJson(res, 200, { ok: true });
    }

    if (route === 'leave') {
      if (['playing', 'countdown', 'loading', 'between'].includes(room.phase)) { room.phase = room.phase === 'between' ? 'playing' : room.phase; finish(room, 'left', idx); }
      player.clients.forEach((c) => c.end());
      if (room.phase === 'waiting') {
        room.players.splice(idx, 1);
        room.players.forEach((p, i) => { p.color = COLORS[i]; p.ready = false; });
        if (!room.players.length) closeRoom(room); else broadcast(room);
      } else {
        player.connected = false; player.goneAt = now(); player.left = true;
        broadcast(room);
      }
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: 'not found' });
  };
}
