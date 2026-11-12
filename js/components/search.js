// SongSearch: debounced autocomplete over a song list.
//
//   const search = createSongSearch({ songs, isTaken, onSelect });
//   container.append(search.el);
//
// Matching is case/diacritic-insensitive, partial, on title and artist, ranked:
// title starts with > word in title starts with > title contains > artist matches.

import { artworkEl } from './artwork.js';

const DEBOUNCE_MS = 110;
const MAX_RESULTS = 12;

export function normalise(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Bounded Levenshtein distance (returns max+1 when exceeded).
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

// Does query token `t` match a field token `w`? Exact prefix first, then a typo
// allowance that grows with the token length ("cardigen" -> "cardigan").
function tokenMatch(t, w, fuzzy = true) {
  if (w.startsWith(t)) return 1;
  if (!fuzzy || t.length < 4) return 0;
  const allow = t.length >= 10 ? 2 : 1;
  // compare against the whole word and against a prefix of similar length
  if (editDistance(t, w, allow) <= allow) return 0.7;
  if (w.length > t.length && editDistance(t, w.slice(0, t.length + 1), allow) <= allow) return 0.6;
  return 0;
}

const indexCache = new WeakMap();
function indexSong(song) {
  let ix = indexCache.get(song);
  if (!ix) {
    const title = normalise(song.title);
    const artist = normalise(song.artist.replace(/\b(ft|feat|featuring)\b\.?/g, ' '));
    const album = normalise(song.album || '');
    ix = {
      title, artist, album,
      titleWords: title.split(' ').filter(Boolean),
      artistWords: artist.split(' ').filter(Boolean),
      albumWords: album.split(' ').filter(Boolean),
    };
    indexCache.set(song, ix);
  }
  return ix;
}

export function rankSongs(songs, query) {
  const q = normalise(query);
  if (!q) return [];
  const qTokens = q.split(' ').filter(Boolean);
  const hits = [];

  for (const song of songs) {
    const ix = indexSong(song);
    let score = 0;

    // Whole-phrase matches
    if (ix.title === q) score = 130;
    else if (ix.title.startsWith(q)) score = 120;
    else if (ix.title.includes(' ' + q)) score = 100;
    else if (ix.title.includes(q)) score = 85;
    else if (ix.artist.startsWith(q)) score = 75;
    else if (ix.artist.includes(' ' + q) || ix.artist.includes(q)) score = 65;
    else if (ix.album.startsWith(q) || ix.album.includes(' ' + q)) score = 45;

    // Token matches: every query word must match some word of title, artist or album,
    // in any order, with typo tolerance.
    if (!score) {
      let total = 0;
      let counted = 0;
      let ok = true;
      const required = qTokens.filter((t) => t.length > 1);
      for (const t of required.length ? required : qTokens) {
        let best = 0;
        for (const w of ix.titleWords) best = Math.max(best, tokenMatch(t, w) * 1.0);
        if (best < 1) for (const w of ix.artistWords) best = Math.max(best, tokenMatch(t, w) * 0.85);
        if (best < 1) for (const w of ix.albumWords) best = Math.max(best, tokenMatch(t, w, false) * 0.6);
        if (!best) { ok = false; break; }
        total += best;
        counted++;
      }
      if (ok && counted) score = 20 + (total / counted) * 40;
    }

    if (score) hits.push({ song, score });
  }

  // Same match quality: songs with playable audio first (so an artist search
  // surfaces the clips you can actually pick), then newest, then alphabetical.
  const playable = (s) => (s.availability === 'ok' || s.audio?.type === 'synth' ? 1 : 0);
  hits.sort((a, b) =>
    b.score - a.score ||
    playable(b.song) - playable(a.song) ||
    (b.song.year || 0) - (a.song.year || 0) ||
    a.song.title.localeCompare(b.song.title));
  return hits.slice(0, MAX_RESULTS).map((h) => h.song);
}

export function createSongSearch({ songs, isTaken = () => false, onSelect, placeholder = 'Search for a song' }) {
  const el = document.createElement('div');
  el.className = 'search';

  const inputWrap = document.createElement('div');
  inputWrap.className = 'search-input';
  inputWrap.innerHTML = `
    <svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.8 12.8 17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    <input type="text" autocomplete="off" autocorrect="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" />
    <button type="button" class="search-clear" aria-label="Clear" hidden>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>`;
  const input = inputWrap.querySelector('input');
  input.placeholder = placeholder;
  const clearBtn = inputWrap.querySelector('.search-clear');

  const list = document.createElement('ul');
  list.className = 'search-results';
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  el.append(inputWrap, list);

  let results = [];
  let active = -1;
  let timer = null;
  let open = false;

  function close() {
    open = false;
    list.hidden = true;
    list.innerHTML = '';
    results = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
  }

  function render() {
    list.innerHTML = '';
    const q = input.value.trim();
    if (!q) return close();
    open = true;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');

    if (!results.length) {
      const li = document.createElement('li');
      li.className = 'search-empty';
      li.textContent = `Nothing in this mix's catalogue matches "${q}". Try the artist, or check the spelling.`;
      list.append(li);
      return;
    }

    results.forEach((song, i) => {
      const li = document.createElement('li');
      li.className = 'search-item' + (i === active ? ' is-active' : '');
      li.setAttribute('role', 'option');
      const taken = isTaken(song.id);
      if (taken) li.classList.add('is-taken');
      li.append(artworkEl(song, 40));
      const text = document.createElement('div');
      text.className = 'search-text';
      text.innerHTML = `<span class="search-title"></span><span class="search-artist"></span>`;
      text.querySelector('.search-title').textContent = song.title;
      text.querySelector('.search-artist').textContent = song.album ? `${song.artist}  ·  ${song.album}` : song.artist;
      li.append(text);
      if (taken) {
        const tag = document.createElement('span');
        tag.className = 'search-tag';
        tag.textContent = 'In another slot';
        li.append(tag);
      }
      li.addEventListener('mousedown', (e) => e.preventDefault()); // keep input focus
      li.addEventListener('click', () => choose(i));
      list.append(li);
    });
  }

  function choose(i) {
    const song = results[i];
    if (!song || isTaken(song.id)) return;
    close();
    input.value = '';
    clearBtn.hidden = true;
    onSelect(song);
  }

  function runSearch() {
    results = rankSongs(songs, input.value);
    active = results.findIndex((s) => !isTaken(s.id));
    render();
  }

  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(runSearch, DEBOUNCE_MS);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim()) runSearch();
  });

  input.addEventListener('blur', () => setTimeout(close, 120));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (open) { e.preventDefault(); close(); } else input.blur();
      return;
    }
    if (!open) {
      if (e.key === 'ArrowDown' && input.value.trim()) { e.preventDefault(); runSearch(); }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let next = active;
      for (let n = 0; n < results.length; n++) {
        next = (next + dir + results.length) % results.length;
        if (!isTaken(results[next].id)) break;
      }
      active = next;
      render();
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) choose(active);
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    close();
    input.focus();
  });

  return {
    el,
    input,
    focus: () => input.focus(),
    clear: () => { input.value = ''; clearBtn.hidden = true; close(); },
  };
}
