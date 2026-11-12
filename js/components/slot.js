// AnswerSlot: one numbered slot. States:
//   empty    shows a SongSearch
//   picked   shows the chosen song with "Lock in" and remove
//   correct  locked, green, no further edits
//   wrong    brief red flash, then back to empty (the pick is cleared by the round)
//   taken    duel only: the opponent claimed this song, shown with their name

import { createSongSearch } from './search.js';
import { artworkEl } from './artwork.js';

export function createAnswerSlot({ index, songs, isTaken, onChange, onLock }) {
  const el = document.createElement('div');
  el.className = 'slot';
  el.dataset.index = String(index);

  const num = document.createElement('div');
  num.className = 'slot-num marker';
  num.textContent = `${index + 1}.`;

  const body = document.createElement('div');
  body.className = 'slot-body';

  el.append(num, body);

  let song = null;
  let state = 'empty';
  const search = createSongSearch({
    songs,
    isTaken,
    placeholder: 'Search for a song',
    onSelect: (s) => setSong(s, true),
  });

  function setState(next) {
    state = next;
    el.classList.toggle('is-filled', next !== 'empty');
    el.classList.toggle('is-correct', next === 'correct');
    el.classList.toggle('is-wrong', next === 'wrong');
    el.classList.toggle('is-taken', next === 'taken');
  }

  function renderEmpty() {
    body.innerHTML = '';
    body.append(search.el);
    setState('empty');
  }

  function renderPicked(kind) {
    body.innerHTML = '';
    const chip = document.createElement('div');
    chip.className = 'slot-pick';
    chip.append(artworkEl(song, 44));
    const text = document.createElement('div');
    text.className = 'slot-text';
    text.innerHTML = `<span class="slot-title"></span><span class="slot-artist"></span>`;
    text.querySelector('.slot-title').textContent = song.title;
    text.querySelector('.slot-artist').textContent = song.artist;
    chip.append(text);

    if (kind === 'picked') {
      const lock = document.createElement('button');
      lock.type = 'button';
      lock.className = 'btn btn-lock';
      lock.textContent = 'Lock in';
      lock.addEventListener('click', () => onLock(index, song));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'slot-remove';
      remove.setAttribute('aria-label', `Remove ${song.title}`);
      remove.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
      remove.addEventListener('click', () => { setSong(null, true); search.focus(); });
      chip.append(lock, remove);
    } else {
      const mark = document.createElement('span');
      mark.className = 'slot-mark';
      mark.setAttribute('aria-label', kind === 'correct' ? 'Correct' : 'Not in the mix');
      mark.innerHTML = kind === 'correct'
        ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
      const label = document.createElement('span');
      label.className = 'slot-verdict';
      label.textContent = kind === 'correct' ? 'Locked in' : 'You were in fact not locked in';
      chip.append(label, mark);
    }
    body.append(chip);
    setState(kind);
  }

  function setSong(s, emit = false) {
    song = s;
    if (song) renderPicked('picked');
    else renderEmpty();
    if (emit) onChange(index, song);
  }

  renderEmpty();

  return {
    el,
    get song() { return song; },
    get state() { return state; },
    setSong: (s) => setSong(s, false),
    markCorrect() { if (song) renderPicked('correct'); },
    /** Show the wrong verdict briefly, then clear the slot. */
    markWrong(ms = 1600) {
      if (!song) return;
      renderPicked('wrong');
      const lock = (el.dataset.wrongToken = String(Date.now()));
      setTimeout(() => {
        if (el.dataset.wrongToken !== lock) return;
        song = null;
        renderEmpty();
        search.focus();
      }, ms);
    },
    /** Duel: the other player claimed `s`. Shows it with their name, locked. */
    markTakenBy(s, name, color) {
      song = s;
      body.innerHTML = '';
      const chip = document.createElement('div');
      chip.className = 'slot-pick';
      chip.append(artworkEl(song, 44));
      const text = document.createElement('div');
      text.className = 'slot-text';
      text.innerHTML = `<span class="slot-title"></span><span class="slot-artist"></span>`;
      text.querySelector('.slot-title').textContent = song.title;
      text.querySelector('.slot-artist').textContent = song.artist;
      const tag = document.createElement('span');
      tag.className = 'slot-taker';
      tag.style.setProperty('--pc', color);
      tag.textContent = name;
      chip.append(text, tag);
      body.append(chip);
      el.style.setProperty('--pc', color);
      setState('taken');
    },
    reset: () => { search.clear(); song = null; renderEmpty(); },
    focus: () => (song ? null : search.focus()),
    setDisabled(disabled) {
      el.classList.toggle('is-disabled', disabled);
      search.input.disabled = disabled;
    },
  };
}
