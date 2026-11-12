// App bootstrap and screen router.
//
// Screens are plain functions that return an element (and optionally a destroy()).
// Navigation is hash based: #home, #mixes, #play, #results.

import { MixEngine } from './audio/engine.js';
import { getCategory } from './data/categories.js';
import { initDataSource, loadCatalogue, pickRoundSongs, getSongsForCategory, dataSource } from './data/index.js';
import { createRound, scoreRound } from './game/round.js';
import { recordScore } from './game/scores.js';
import { renderHome } from './screens/home.js';
import { renderCategories } from './screens/categories.js';
import { renderPlay } from './screens/play.js';
import { renderResults } from './screens/results.js';
import { renderDuelLobby } from './screens/duelLobby.js';
import { renderDuelPlay } from './screens/duelPlay.js';
import { renderDuelResults } from './screens/duelResults.js';
import { onDuel, resume as resumeDuel, duelConn } from './duel/net.js';
import { h } from './ui/dom.js';

const root = document.getElementById('app');
const engine = new MixEngine();

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
};

const session = {
  category: getCategory(store.get('mixtape.category', 'pop')),
  roundNumber: 0,
  totalScore: 0,
  round: null,
  result: null,
  autoplayNext: false,
  starting: false,
};

let current = null; // { el, destroy? }

function mount(view) {
  if (current?.destroy) current.destroy();
  root.innerHTML = '';
  current = view.el ? view : { el: view };
  root.append(current.el);
  window.scrollTo({ top: 0 });
}

function go(name) {
  if (location.hash !== '#' + name) location.hash = name;
  else route();
}

function showStarting(message) {
  mount(h('main', { class: 'screen screen-starting' },
    h('div', { class: 'starting' },
      h('span', { class: 'spinner', 'aria-hidden': 'true' }),
      h('p', { class: 'starting-text' }, message),
    ),
  ));
}

function showStartError(err) {
  mount(h('main', { class: 'screen screen-starting' },
    h('div', { class: 'starting' },
      h('p', { class: 'starting-text' }, `Couldn't start a round: ${err.message}`),
      h('div', { class: 'result-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => startRound() }, 'Try again'),
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => go('home') }, 'Back'),
      ),
    ),
  ));
}

/**
 * Start a round: load the category catalogue (for autocomplete), ask the data
 * source for four verified songs, then open the play screen.
 */
async function startRound() {
  if (session.starting) return;
  session.starting = true;
  engine.unload();
  const cat = session.category;
  const remote = dataSource().mode === 'remote';
  showStarting(remote ? `Finding four ${cat.name} songs` : 'Shuffling four songs');
  try {
    await loadCatalogue(cat.id);
    const { songs, previewSeconds } = await pickRoundSongs(cat.id, 4);
    session.roundNumber += 1;
    session.round = createRound({ category: cat, songs, number: session.roundNumber, picked: true, duration: previewSeconds });
    session.result = null;
    session.autoplayNext = false; // the player chooses when to hear the unlocked audio
    session.starting = false;
    go('play');
  } catch (err) {
    session.starting = false;
    console.error(err);
    showStartError(err);
  }
}

function setCategory(cat) {
  session.category = cat;
  store.set('mixtape.category', cat.id);
}

function routeName() { return (location.hash || '#home').slice(1).split('/')[0]; }

// The duel server drives navigation once you're in a room.
// Each round of a duel gets a fresh play screen.
let duelRoundOnScreen = 0;
onDuel((s) => {
  if (!s.players) return;
  const at = routeName();
  const live = ['loading', 'countdown', 'playing'].includes(s.phase);
  if (live && (at !== 'duel-play' || s.match.round !== duelRoundOnScreen)) { duelRoundOnScreen = s.match.round; go('duel-play'); }
  else if (s.phase === 'done' && at === 'duel-play') { duelRoundOnScreen = 0; go('duel-results'); }
});

function route() {
  const [name, arg] = (location.hash || '#home').slice(1).split('/');

  switch (name) {
    case 'duel': {
      if (dataSource().mode !== 'remote') {
        mount(h('main', { class: 'screen screen-starting' },
          h('div', { class: 'starting' },
            h('p', { class: 'starting-text' }, 'Duels need the game server running, so they work when you play from your own computer (npm run start:files).'),
            h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => go('home') }, 'Back'))));
        return;
      }
      engine.unload();
      loadCatalogue(session.category.id).catch(() => {});
      mount(renderDuelLobby({ category: session.category, joinCode: (arg || '').toUpperCase(), onBack: () => go('home') }));
      return;
    }
    case 'duel-play': {
      if (!duelConn() && !resumeDuel()) { go('duel'); return; }
      showStarting('Joining the duel');
      loadCatalogue(session.category.id).then(() => {
        if (routeName() !== 'duel-play') return;
        mount(renderDuelPlay({
          engine,
          songs: getSongsForCategory(session.category.id),
          category: session.category,
          onQuit: () => { engine.unload(); go('home'); },
        }));
      });
      return;
    }
    case 'duel-results': {
      if (!duelConn()) { go('duel'); return; }
      mount(renderDuelResults({
        engine,
        onNewOpponent: () => go('duel'),
        onHome: () => go('home'),
      }));
      return;
    }
    case 'play': {
      if (!session.round || session.round.submittedAt) { startRound(); return; }
      const autoplay = session.autoplayNext;
      session.autoplayNext = false;
      mount(renderPlay({
        engine,
        round: session.round,
        songs: getSongsForCategory(session.category.id),
        session,
        autoplay,
        onSubmit: (round) => {
          session.result = scoreRound(round);
          session.totalScore += session.result.points;
          Object.assign(session.result, recordScore(round.category.id, session.result.points));
          go('results');
        },
        onQuit: () => { engine.unload(); session.round = null; go('home'); },
      }));
      return;
    }
    case 'results': {
      if (!session.result) { go('home'); return; }
      mount(renderResults({
        engine,
        round: session.round,
        result: session.result,
        session,
        onPlayAgain: () => { engine.ensureContext(); startRound(); },
        onChangeMix: () => go('mixes'),
      }));
      return;
    }
    case 'mixes': {
      mount(renderCategories({
        category: session.category,
        onPick: (cat) => { setCategory(cat); go('home'); },
        onBack: () => go('home'),
      }));
      return;
    }
    default: {
      if (session.round && !session.round.submittedAt) engine.unload();
      mount(renderHome({
        engine,
        category: session.category,
        onPlay: () => { engine.ensureContext(); startRound(); },
        onPickCategory: (cat) => { setCategory(cat); route(); },
        onAllMixes: () => go('mixes'),
        onDuel: () => { engine.ensureContext(); go('duel'); },
      }));
    }
  }
}

window.addEventListener('hashchange', route);

// Detect the backend (if any) before the first screen, so attribution and mode are right.
initDataSource().finally(() => {
  resumeDuel();
  route();
  // Warm the catalogue for the selected category so Play now is quick.
  loadCatalogue(session.category.id).catch(() => {});
});

// Expose for debugging / tests. Not used by the UI.
window.__mixtape = { engine, session, dataSource };
