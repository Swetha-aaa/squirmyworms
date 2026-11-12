import { h, icon } from '../ui/dom.js';
import { wordmark } from './shared.js';
import { STRAND_COLORS } from '../components/waveform.js';
import { createStandingWorm, createWormHead } from '../components/worms.js';
import { createRevealBand } from '../components/revealBand.js';
import { createRevealController } from '../game/reveal.js';
import { artworkEl } from '../components/artwork.js';
import { doodleStar, note, tape } from '../components/doodles.js';
import { formatSeconds } from '../game/round.js';
import { onDuel, duelState, askRematch, declineRematch, leave } from '../duel/net.js';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The three endings: glow colour, words and worms. The loser gets roasted (gently).
function outcome(s) {
  const r = s.result || {};
  const opp = s.players[1 - s.you]?.name || 'them';
  if (r.draw) return { kind: 'draw', glow: '#6BE38A', kicker: 'dead even', title: 'Draw!', line: 'Same ears, same score. Rematch to settle it.', verdict: 'two worms, one brain' };
  const won = r.winner === s.you;
  if (r.reason === 'left') {
    return won
      ? { kind: 'win', glow: '#FFC857', kicker: `${opp} ran off`, title: 'You win!', line: `${opp} left the duel.`, verdict: 'win by walkover' }
      : { kind: 'lose', glow: '#45D9FF', kicker: 'you left', title: 'Duel over', line: 'You left the duel.', verdict: 'come back soon' };
  }
  const agreed = r.reason === 'agreed';
  return won
    ? { kind: 'win', glow: '#FFC857', kicker: `you beat ${opp}`, title: 'You win!', line: agreed ? 'You both called it early. You were ahead.' : 'Fastest ears in the room.', verdict: 'certified human Shazam' }
    : { kind: 'lose', glow: '#45D9FF', kicker: `${opp} wins`, title: 'Time to clean your ears!', line: `${opp} heard it first. Grab a cotton bud and ask for a rematch.`, verdict: 'wax on, wax off' };
}

function showDuelReveal(s, o, onDone) {
  const me = s.players[s.you], them = s.players[1 - s.you];
  const worms = o.kind === 'draw'
    ? [createStandingWorm({ color: me.color, mood: 'excited', acc: ['arms', 'sparkles'], className: 'dr-worm' }),
       createStandingWorm({ color: them.color, mood: 'excited', acc: ['arms', 'sparkles'], className: 'dr-worm dr-worm-r' })]
    : o.kind === 'win'
      ? [createStandingWorm({ color: me.color, mood: 'shades', acc: ['crown', 'sparkles'], className: 'dr-worm dr-worm-solo' })]
      : [createStandingWorm({ color: me.color, mood: 'dizzy', acc: [], className: 'dr-worm dr-worm-solo' })];
  const el = h('div', { class: `duel-reveal is-${o.kind}`, role: 'dialog', 'aria-label': o.title, style: `--dg:${o.glow}` },
    h('div', { class: 'dr-inner' },
      doodleStar('rr-star rr-star-a', 0), doodleStar('rr-star rr-star-b', 1), doodleStar('rr-star rr-star-c', 2),
      h('div', { class: 'dr-worms' }, worms),
      h('span', { class: 'dr-kicker' }, o.kicker),
      h('h1', { class: 'dr-title' + (o.title.length > 12 ? ' is-long' : '') }, o.title),
      h('p', { class: 'dr-score' }, h('b', { style: `color:${me.color}` }, String(me.score)), h('span', {}, '–'), h('b', { style: `color:${them.color}` }, String(them.score))),
      h('span', { class: 'dr-sub' }, 'songs'),
      h('span', { class: 'rr-skip' }, 'tap to continue'),
    ),
  );
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.classList.add('is-leaving');
    setTimeout(() => { el.remove(); onDone(); }, reduceMotion() ? 0 : 600);
    document.removeEventListener('keydown', finish);
  };
  el.addEventListener('click', finish);
  document.addEventListener('keydown', finish);
  document.body.append(el);
  setTimeout(finish, reduceMotion() ? 1500 : 3600);
}

/** Duel results, laid out like the solo results page. */
export function renderDuelResults({ engine, onNewOpponent, onHome }) {
  const s0 = duelState();
  const o = outcome(s0);
  const you = s0.you, them = 1 - you;
  const me = s0.players[you], opp = s0.players[them];
  const slots = s0.round?.slots || [];

  // ---- Listen back: same band and layering as solo
  const canReplay = !!(engine && engine.tracks && engine.tracks.length);
  const lbPlay = h('button', { class: 'btn btn-primary btn-icon btn-round lb-play', type: 'button', 'aria-label': 'Play the full mix' }, icon('play'));
  const lbFill = h('div', { class: 'progress-fill' });
  const lbTime = h('span', { class: 'time' }, '');
  let lbBand = null;
  if (canReplay) {
    const d = engine.duration;
    lbBand = createRevealBand({ engine, reveal: createRevealController({ duration: d, reveal: { unlocked: d, maxUnlocked: d, maxSeconds: d } }), curve: 1 });
    lbBand.el.classList.add('is-static');
  }
  const lbHint = h('span', { class: 'lb-hint' }, 'Tap songs to hear them alone or layered.');
  const listenBack = canReplay
    ? h('div', { class: 'listen-back' },
        h('div', { class: 'lb-head' }, h('span', { class: 'lb-title' }, 'Listen back')),
        lbBand.el,
        h('div', { class: 'lb-row' }, lbPlay, h('div', { class: 'progress lb-progress' }, lbFill), lbTime),
        lbHint)
    : null;
  const offs = [];
  if (canReplay) {
    engine.setSolo(null);
    engine.setLimit(engine.duration);
    engine.stop();
    const setIcon = () => {
      lbPlay.replaceChildren(icon(engine.isPlaying ? 'pause' : 'play'));
      el.querySelector('.listen-back')?.classList.toggle('is-playing', engine.isPlaying);
    };
    const setTime = (t) => {
      lbFill.style.width = `${Math.min(100, (t / engine.duration) * 100)}%`;
      lbTime.textContent = `${formatSeconds(t)} / ${formatSeconds(engine.duration)}`;
    };
    setTime(0);
    lbPlay.addEventListener('click', () => { engine.ensureContext(); engine.toggle(); });
    offs.push(engine.on('statechange', setIcon), engine.on('timeupdate', setTime));
  }
  // engine tracks are slot-0..3 in order, so a row's index is its track
  const layered = new Set();
  function toggleSolo(index) {
    if (!canReplay) return;
    if (layered.has(index)) layered.delete(index); else layered.add(index);
    engine.setSolo(layered.size ? layered : null);
    el.querySelectorAll('.track').forEach((n, i) => {
      n.classList.toggle('is-solo', layered.has(i));
      n.classList.toggle('is-muted', layered.size > 0 && !layered.has(i));
    });
    lbHint.textContent = layered.size === 0
      ? 'Tap songs to hear them alone or layered.'
      : layered.size === engine.tracks.length ? `All ${layered.size} layered. Tap one to drop it.` : `Playing ${layered.size} of ${engine.tracks.length}. Tap more to layer, or tap one again to drop it.`;
    if (!engine.isPlaying) { engine.ensureContext(); engine.play(); }
  }

  // ---- Tracklist: who got each song, and when
  const tracklist = h('ol', { class: 'tracklist' },
    slots.map((sl, i) => {
      const who = sl.claimedBy;
      const p = who == null ? null : s0.players[who];
      const mine = who === you;
      const row = h('li', { class: 'track ' + (mine ? 'is-hit' : who == null ? 'is-miss' : 'is-theirs'), style: `--c:${STRAND_COLORS[i % 5]}; --i:${i}; --pc:${p?.color || '#5A4A6A'}`,
          role: 'button', tabindex: '0', title: 'Tap to layer this song in the replay' },
        h('span', { class: 'track-n' }, createWormHead({ color: p?.color || STRAND_COLORS[i % 5], mood: who == null ? 'dizzy' : 'happy' })),
        artworkEl(sl.song, 52),
        h('div', { class: 'track-text' },
          h('span', { class: 'track-title' }, sl.song.title),
          h('span', { class: 'track-artist' }, sl.song.artist + (sl.song.year ? ` · ${sl.song.year}` : '')),
        ),
        h('span', { class: 'track-time' }, who == null ? '' : `${Math.round(sl.at)}s`),
        h('span', { class: 'track-who' + (who == null ? ' is-nobody' : '') }, who == null ? 'Nobody' : mine ? 'You' : p.name),
      );
      row.addEventListener('click', () => toggleSolo(i));
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSolo(i); } });
      return row;
    }));

  // ---- Score: a tug-of-war bar, pink vs cyan
  const unclaimed = 4 - me.score - opp.score;
  const bar = h('div', { class: 'duel-tug', 'aria-hidden': 'true' },
    h('span', { style: `--w:${me.score * 25}%; --c:${me.color}` }),
    h('span', { class: 'is-empty', style: `--w:${unclaimed * 25}%` }),
    h('span', { style: `--w:${opp.score * 25}%; --c:${opp.color}` }));
  const chips = h('ul', { class: 'score-chips' },
    h('li', { class: 'score-chip', style: `--c:${me.color}` }, h('i', {}), h('span', { class: 'sc-label' }, 'You'), h('b', {}, String(me.score))),
    h('li', { class: 'score-chip', style: `--c:${opp.color}` }, h('i', {}), h('span', { class: 'sc-label' }, opp.name), h('b', {}, String(opp.score))),
    h('li', { class: 'score-chip is-penalty' + (me.wrong ? '' : ' is-zero') }, h('i', {}), h('span', { class: 'sc-label' }, 'Your wrong guesses'), h('b', {}, String(me.wrong || 0))),
  );

  const shareText = `SquirmyWorms duel · ${o.kind === 'win' ? 'I won' : o.kind === 'lose' ? 'I lost' : 'Draw'}\nMe ${me.score} – ${opp.score} ${opp.name}\n` +
    slots.map((sl) => (sl.claimedBy === you ? '■' : sl.claimedBy == null ? '□' : '▣')).join('');
  const copyBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, icon('copy'), 'Copy result');
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareText); copyBtn.lastChild.textContent = 'Copied'; }
    catch { copyBtn.lastChild.textContent = 'Copy blocked here'; }
    setTimeout(() => (copyBtn.lastChild.textContent = 'Copy result'), 1600);
  });

  const rematchBtn = h('button', { class: 'rm-btn', type: 'button', onClick: () => askRematch().catch(() => {}) },
    icon('replay'), h('span', { class: 'rm-label' }, 'Rematch'));
  // red neon: "Leave room" normally, "No thanks" when they've asked for a rematch
  const goHome = () => { engine.stop(); leave(); onHome(); };
  const noBtn = h('button', { class: 'rm-btn rm-no', type: 'button' }, h('span', { class: 'rm-label' }, 'Leave room'));
  noBtn.addEventListener('click', async () => {
    const s = duelState();
    const asked = s?.players?.[1 - s.you]?.rematch && !s.players[s.you].rematch;
    if (asked) { await declineRematch().catch(() => {}); }
    else goHome();
  });
  const rematchHead = h('span', { class: 'rm-head' }, createWormHead({ color: opp.color, mood: 'happy' }));
  const rematchNote = h('span', { class: 'rm-note' }, `Up for another? Tap Rematch.`);
  const rematchBar = h('div', { class: 'rematch-bar', role: 'region', 'aria-label': 'Rematch', 'aria-live': 'polite' },
    h('div', { class: 'rm-inner' },
      rematchHead,
      rematchNote,
      h('div', { class: 'rm-actions' },
        noBtn,
        rematchBtn,
      ),
    ));
  const series = h('p', { class: 'best-line' }, '');

  const heroWorm = o.kind === 'win'
    ? createStandingWorm({ color: me.color, mood: 'shades', acc: ['crown', 'sparkles'], className: 'rb-worm-svg' })
    : o.kind === 'lose'
      ? createStandingWorm({ color: me.color, mood: 'dizzy', acc: [], className: 'rb-worm-svg' })
      : createStandingWorm({ color: '#6BE38A', mood: 'excited', acc: ['arms'], className: 'rb-worm-svg' });

  const el = h('main', { class: 'screen screen-results screen-duel-results' },
    h('header', { class: 'topbar' },
      h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': 'Back to home', onClick: () => { engine.stop(); leave(); onHome(); } }, icon('back')),
      wordmark('sm'),
      h('div', { class: 'topbar-meta' }, h('span', { class: 'chip' }, 'DUEL')),
    ),
    h('section', { class: 'rs' },
      tape('tape-card', -5),
      h('div', { class: `rs-hero dres-hero is-${o.kind}`, style: `--rk:${o.glow}` },
        h('div', { class: 'rs-hero-left' },
          h('span', { class: 'rs-title' }, o.kind === 'win' ? 'Duel won' : o.kind === 'lose' ? 'Duel lost' : 'Duel drawn'),
          h('div', { class: 'result-count' }, h('span', { class: 'result-big' }, String(me.score)), h('span', { class: 'result-of' }, `–${opp.score}`)),
          h('p', { class: 'rs-headline' }, o.line),
          series,
        ),
        h('div', { class: 'rs-hero-right' },
          h('div', { class: 'rank-badge' },
            h('div', { class: 'rb-worm' }, heroWorm),
            h('span', { class: 'rb-label' }, `vs ${opp.name}`),
            h('span', { class: 'rb-title' }, o.title),
            h('span', { class: 'rb-next' }, `${me.score} of 4 songs were yours`),
          ),
        ),
      ),
      listenBack,
      tracklist,
      h('div', { class: 'sb', style: `--rk:${o.glow}` },
        h('div', { class: 'sb-head' },
          h('span', { class: 'sb-label' }, 'Duel score'),
          h('span', { class: 'sb-total' }, h('span', { class: 'sb-total-num' }, `${me.score}–${opp.score}`)),
        ),
        bar,
        chips,
      ),
      h('div', { class: 'result-actions' }, copyBtn),
    ),
    // Always on screen: rematch status and buttons, no scrolling needed.
    rematchBar,
  );

  function apply(s) {
    if (!s.players) return;
    const meNow = s.players[s.you], themNow = s.players[1 - s.you];
    const games = meNow.wins + (themNow?.wins || 0);
    series.textContent = games > 1 ? `Duels won: You ${meNow.wins} – ${themNow?.wins || 0} ${themNow?.name || ''}` : '';
    const left = !themNow || !themNow.connected || themNow.left;
    const declinedByThem = !!themNow?.declined;
    const declinedByMe = !!meNow.declined;
    const asked = !left && !declinedByMe && themNow.rematch && !meNow.rematch;
    noBtn.querySelector('.rm-label').textContent = asked ? 'No thanks' : 'Leave room';
    if (declinedByMe) {
      // I said no: offer the way out
      rematchBtn.hidden = true;
      noBtn.querySelector('.rm-label').textContent = 'Leave room';
    }
    if ((declinedByThem || left) && !declinedByMe && !popShown) showRejected(themNow, declinedByThem);
    rematchBtn.disabled = left || meNow.rematch;
    rematchBtn.querySelector('.rm-label').textContent = meNow.rematch ? 'Waiting…' : asked ? 'Accept rematch' : 'Rematch';
    rematchBar.classList.toggle('is-asked', asked);
    rematchBar.classList.toggle('is-waiting', !left && meNow.rematch);
    rematchBar.classList.toggle('is-left', left);
    rematchHead.replaceChildren(createWormHead({ color: themNow?.color || opp.color, mood: left ? 'dizzy' : asked ? 'excited' : 'happy' }));
    rematchNote.textContent = declinedByMe ? 'You turned down the rematch.'
      : declinedByThem ? `${themNow.name} turned down the rematch.`
      : left ? `${themNow?.name || 'Your opponent'} has left the room.`
      : asked ? `${themNow.name} wants a rematch!`
      : meNow.rematch ? `Waiting for ${themNow.name} to say yes…`
      : 'Up for another? Tap Rematch.';
  }
  // red neon pop when the other player says no (or walks off)
  let popShown = false;
  function showRejected(p, declined) {
    popShown = true;
    const pop = h('div', { class: 'reject-pop', role: 'dialog', 'aria-label': declined ? 'Rematch rejected' : 'Opponent left' },
      h('div', { class: 'rp-card' },
        h('span', { class: 'rp-head' }, createWormHead({ color: p?.color || '#45D9FF', mood: 'dizzy' })),
        h('h2', { class: 'rp-title' }, declined ? 'Rematch rejected' : `${p?.name || 'They'} left`),
        h('p', { class: 'rp-line' }, declined ? `${p.name} doesn't want a rematch. Their loss.` : `${p?.name || 'Your opponent'} left the duel.`),
        h('div', { class: 'rp-actions' },
          h('button', { class: 'rm-btn rp-new', type: 'button', onClick: () => { pop.remove(); engine.stop(); leave(); onNewOpponent(); } }, 'Find a new opponent'),
          h('button', { class: 'rm-btn rm-no', type: 'button', onClick: () => { pop.remove(); goHome(); } }, 'Leave'),
        ),
        h('button', { class: 'rp-close', type: 'button', 'aria-label': 'Close', onClick: () => pop.remove() }, icon('cross')),
      ));
    document.body.append(pop);
    cleanup.push(() => pop.remove());
  }
  const cleanup = [];
  const off = onDuel(apply);

  showDuelReveal(s0, o, () => {});

  return { el, destroy() { cleanup.forEach((f) => f()); rematchBar.remove(); off(); offs.forEach((f) => f()); lbBand?.destroy?.(); engine.setSolo(null); } };
}
