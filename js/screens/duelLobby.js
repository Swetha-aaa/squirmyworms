import { h, icon } from '../ui/dom.js';
import { wordmark } from './shared.js';
import { CATEGORIES, getCategory } from '../data/categories.js';
import { createStandingWorm } from '../components/worms.js';
import {
  getName, setName, createRoom, joinRoom, quickMatch, toggleReady, leave, onDuel, inviteLink, duelConn,
} from '../duel/net.js';

/**
 * Duel lobby. Before a room: name + three ways in (make a room, join with a
 * code, random opponent). In a room: the code, a link to copy, both players and
 * a ready button. The router moves to the play screen once the round loads.
 */
export function renderDuelLobby({ category, joinCode = '', onPickCategory = () => {}, onBack }) {
  let mix = category;
  const nameInput = h('input', { class: 'duel-name-input', type: 'text', maxlength: '16', value: getName(), 'aria-label': 'Your name', spellcheck: 'false', autocomplete: 'off' });
  nameInput.addEventListener('change', () => setName(nameInput.value.trim()));
  const name = () => { const n = nameInput.value.trim() || getName(); setName(n); return n; };

  const errorEl = h('p', { class: 'duel-error', role: 'alert', hidden: true });
  const showError = (msg) => { errorEl.textContent = msg; errorEl.hidden = !msg; };

  const codeInput = h('input', { class: 'duel-code-input', type: 'text', maxlength: '5', placeholder: 'CODE', value: joinCode, 'aria-label': 'Room code', autocomplete: 'off', spellcheck: 'false' });
  codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

  async function attempt(fn) {
    showError('');
    el.classList.add('is-busy');
    try { await fn(); } catch (err) { showError(err.message); } finally { el.classList.remove('is-busy'); }
  }

  const options = h('div', { class: 'duel-options' },
    h('button', { class: 'duel-opt duel-opt-create', type: 'button', onClick: () => attempt(() => createRoom(name(), mix.id)) },
      h('span', { class: 'duel-opt-dots', 'aria-hidden': 'true' }),
      createStandingWorm({ color: '#FF4FA3', mood: 'excited', acc: ['arms', 'sparkles'], className: 'duel-opt-worm' }),
      h('span', { class: 'duel-opt-icon' }, icon('share')),
      h('span', { class: 'duel-opt-title' }, 'Invite a friend'),
      h('span', { class: 'duel-opt-sub' }, 'Get a code and a link to send'),
    ),
    h('form', { class: 'duel-opt duel-opt-join', onSubmit: (e) => { e.preventDefault(); if (codeInput.value.length === 5) attempt(() => joinRoom(codeInput.value, name())); else showError('Room codes are 5 letters.'); } },
      h('span', { class: 'duel-opt-dots', 'aria-hidden': 'true' }),
      createStandingWorm({ color: '#6BE38A', mood: 'happy', acc: ['padlock'], className: 'duel-opt-worm' }),
      h('span', { class: 'duel-opt-icon' }, icon('send')),
      h('span', { class: 'duel-opt-title' }, 'Join with a code'),
      h('span', { class: 'duel-join-row' }, codeInput, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Join')),
    ),
    h('button', { class: 'duel-opt duel-opt-quick', type: 'button', onClick: () => attempt(() => quickMatch(name(), mix.id)) },
      h('span', { class: 'duel-opt-dots', 'aria-hidden': 'true' }),
      createStandingWorm({ color: '#45D9FF', mood: 'star', acc: ['headphones', 'sparkles'], className: 'duel-opt-worm' }),
      h('span', { class: 'duel-opt-icon' }, icon('shuffle')),
      h('span', { class: 'duel-opt-title' }, 'Random opponent'),
      h('span', { class: 'duel-opt-sub' }, 'Match with whoever is online'),
    ),
  );

  // Step one: which mix to duel on. Joining with a code uses the room's mix.
  const mixButtons = CATEGORIES.filter((c) => c.available).map((c) =>
    h('button', {
      class: `duel-mix duel-mix-${c.id}` + (c.id === mix.id ? ' is-on' : ''), type: 'button', 'aria-pressed': String(c.id === mix.id),
      onClick: () => {
        mix = c; onPickCategory(c); mixChip.textContent = c.short;
        for (const b of mixButtons) { const on = b.dataset.mix === c.id; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); }
      },
      'data-mix': c.id,
    }, h('span', { class: 'duel-mix-name' }, c.name)));
  const mixPicker = h('div', { class: 'duel-mixes', role: 'group', 'aria-label': 'Pick a mix' },
    h('span', { class: 'duel-mixes-label' }, 'Pick a mix'), ...mixButtons);
  const mixChip = h('span', { class: 'chip' }, mix.short);

  const intro = h('section', { class: 'duel-intro' },
    h('div', { class: 'duel-faceoff', 'aria-hidden': 'true' },
      createStandingWorm({ color: '#FF4FA3', mood: 'excited', acc: ['headphones'], className: 'duel-face-worm' }),
      h('span', { class: 'duel-vs' }, 'vs'),
      createStandingWorm({ color: '#45D9FF', mood: 'happy', acc: ['headphones'], className: 'duel-face-worm duel-face-worm-r' }),
    ),
    h('h1', { class: 'duel-title' }, 'Duel'),
    h('p', { class: 'duel-lede' }, 'One mix, same moment. First to name a song steals it. Most songs wins.'),
    h('label', { class: 'duel-name' }, h('span', {}, 'Your name'), nameInput),
    mixPicker,
    options,
    errorEl,
  );

  // ---- in a room ----
  const room = h('section', { class: 'duel-room', hidden: true });

  const el = h('main', { class: 'screen screen-duel' },
    h('header', { class: 'topbar' },
      h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': 'Back to home', onClick: async () => { await leave(); onBack(); } }, icon('back')),
      wordmark('sm'),
      h('div', { class: 'topbar-meta' }, mixChip),
    ),
    intro,
    room,
  );

  let linkInfo = null;
  async function renderRoom(s) {
    intro.hidden = true;
    room.hidden = false;
    if (s.category) mixChip.textContent = getCategory(s.category).short;
    const me = s.players[s.you];
    const them = s.players[1 - s.you];
    if (!linkInfo || linkInfo.code !== s.code) linkInfo = { code: s.code, ...(await inviteLink(s.code)) };

    const playerCard = (p, i) => h('div', { class: 'duel-player' + (p?.ready ? ' is-ready' : '') + (p ? '' : ' is-empty'), style: `--pc:${p?.color || '#5A4A6A'}` },
      p ? createStandingWorm({ color: p.color, mood: p.ready ? 'excited' : 'happy', acc: p.ready ? ['headphones', 'notes'] : ['headphones'], className: 'duel-player-worm' })
        : h('span', { class: 'duel-player-wait', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      h('span', { class: 'duel-player-name' }, p ? p.name + (i === s.you ? ' (you)' : '') : 'Waiting…'),
      h('span', { class: 'duel-player-status' }, !p ? (s.isPublic ? 'Finding someone' : 'Send them the code') : p.ready ? 'Ready!' : p.connected ? 'Not ready' : 'Reconnecting…'),
    );

    const copy = async (text, btn, label) => {
      try { await navigator.clipboard.writeText(text); } catch {
        const t = h('textarea', {}, text); document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
      }
      btn.querySelector('.btn-label').textContent = 'Copied!';
      setTimeout(() => { btn.querySelector('.btn-label').textContent = label; }, 1400);
    };
    const copyLink = h('button', { class: 'btn btn-ghost', type: 'button' }, icon('copy'), h('span', { class: 'btn-label' }, 'Copy link'));
    copyLink.addEventListener('click', () => copy(linkInfo.url, copyLink, 'Copy link'));
    const copyCode = h('button', { class: 'btn btn-ghost', type: 'button' }, icon('copy'), h('span', { class: 'btn-label' }, 'Copy code'));
    copyCode.addEventListener('click', () => copy(s.code, copyCode, 'Copy code'));
    const shareBtn = navigator.share
      ? h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => navigator.share({ title: 'SquirmyWorms duel', text: `Duel me on SquirmyWorms! Code ${s.code}`, url: linkInfo.url }).catch(() => {}) }, icon('share'), h('span', { class: 'btn-label' }, 'Share'))
      : null;

    const both = s.players.length === 2;
    const readyBtn = h('button', { class: 'btn btn-primary btn-lg duel-ready' + (me?.ready ? ' is-on' : ''), type: 'button', disabled: !both, onClick: () => toggleReady().catch((e) => showError(e.message)) },
      me?.ready ? 'Ready! (tap to undo)' : both ? "I'm ready" : 'Waiting for a player');

    room.replaceChildren(...[
      s.isPublic && !both
        ? h('div', { class: 'duel-searching' },
            h('h1', { class: 'duel-title' }, 'Finding an opponent'),
            h('p', { class: 'duel-lede' }, 'Hang tight. You\'ll be matched with the next person who taps Random opponent.'))
        : h('div', { class: 'duel-code-block' },
            h('span', { class: 'duel-code-label' }, s.isPublic ? 'Matched!' : 'Room code'),
            s.isPublic ? null : h('div', { class: 'duel-code', 'aria-label': `Room code ${s.code.split('').join(' ')}` }, s.code.split('').map((c) => h('span', {}, c))),
            s.isPublic ? null : h('div', { class: 'duel-share-row' }, copyLink, copyCode, shareBtn),
            !s.isPublic && linkInfo.lanOnly
              ? h('p', { class: 'duel-hint' }, 'This link works for friends on the same Wi-Fi as you. For friends anywhere, the game needs to be put online first.')
              : null),
      s.category ? h('p', { class: `duel-room-mix duel-room-mix-${s.category}` }, `${getCategory(s.category).name} mix`) : null,
      h('div', { class: 'duel-players' }, playerCard(me, s.you), h('span', { class: 'duel-vs duel-vs-sm' }, 'vs'), playerCard(them, 1 - s.you)),
      s.phase === 'waiting' ? readyBtn : h('p', { class: 'duel-loading' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Loading the mix…'),
      s.result?.error ? h('p', { class: 'duel-error' }, s.result.error) : null,
      errorEl,
    ].filter(Boolean));
  }

  const off = onDuel((s) => {
    if (s.gone) { showError('That room has closed.'); intro.hidden = false; room.hidden = true; return; }
    if (s.players) renderRoom(s);
  });

  // Arriving from a shared link: code is filled in, they just pick a name and join.
  if (joinCode && !duelConn()) {
    el.classList.add('is-invited');
    mixPicker.hidden = true;
    intro.insertBefore(h('p', { class: 'duel-invite' }, `You've been invited to room ${joinCode}. Pick a name and tap Join.`), intro.querySelector('.duel-name'));
    setTimeout(() => nameInput.select(), 50);
  }

  return { el, destroy() { off(); } };
}
