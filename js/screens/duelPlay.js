import { h, icon } from '../ui/dom.js';
import { createRevealBand } from '../components/revealBand.js';
import { createAnswerSlot } from '../components/slot.js';
import { STRAND_COLORS } from '../components/waveform.js';
import { createBoombox } from '../components/boombox.js';
import { createWormHead } from '../components/worms.js';
import { formatSeconds, formatTime } from '../game/round.js';
import { createRevealController } from '../game/reveal.js';
import { onDuel, duelState, serverNow, clipMeta, reportLoaded, guess, leave, voteGiveUp } from '../duel/net.js';

/**
 * Duel round. Both players' engines start at the server's startAt, so they hear
 * the mix at the same moment. Picking a song from search is an instant guess;
 * the server says who got there first.
 */
export function renderDuelPlay({ engine, songs, category, onQuit }) {
  const first = duelState();
  const you = first.you;
  const them = 1 - you;

  // --- scoreboard
  const scoreNums = [h('b', { class: 'ds-num' }, '0'), h('b', { class: 'ds-num' }, '0')];
  const pipRows = [0, 1].map(() => h('span', { class: 'ds-pips', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(() => h('i'))));
  const roundStars = [0, 1].map(() => h('span', { class: 'ds-stars', 'aria-label': 'rounds won' }));
  const ROUND_WORDS = ['Wax your ears!', 'Ear we go again!', 'Unclog those ears!']; // used in order if a duel ever has more rounds
  const roundNo = first.match?.round || 1;
  const roundOf = first.match?.of || 3;
  const side = (i, mine) => h('div', { class: `ds-side ${mine ? 'is-me' : 'is-them'}`, style: `--pc:${first.players[i].color}` },
    h('span', { class: 'ds-head' }, createWormHead({ color: first.players[i].color, mood: 'happy' })),
    h('span', { class: 'ds-name' }, mine ? 'You' : first.players[i].name, roundStars[i]),
    scoreNums[i], pipRows[i],
  );
  const clock = h('span', { class: 'ds-clock' }, '0:00');
  const scoreboard = h('header', { class: 'duel-scoreboard' },
    h('button', { class: 'btn btn-ghost btn-icon ds-quit', type: 'button', 'aria-label': 'Leave the duel', onClick: () => { if (confirmLeave()) { leave(); onQuit(); } } }, icon('back')),
    side(you, true),
    h('div', { class: 'ds-mid' }, roundOf > 1 ? h('span', { class: 'ds-round' }, `Round ${roundNo} of ${roundOf}`) : h('span', { class: 'ds-round' }, 'most songs wins'), clock),
    side(them, false),
  );
  function confirmLeave() {
    const s = duelState();
    return !(s && (s.phase === 'playing' || s.phase === 'countdown')) || window.confirm('Leave now? Your opponent wins this one.');
  }

  // --- mix
  const reveal = createRevealController({ reveal: { unlocked: 30, maxUnlocked: 30, maxSeconds: 30 } });
  const band = createRevealBand({ engine, reveal, curve: 1 });
  band.el.classList.add('is-full');
  const box = createBoombox({ palette: category.id === 'kpop' ? 'kpop' : 'pop', className: 'play-boombox' });
  const loading = h('div', { class: 'wave-loading' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, 'Loading the mix'));
  const axis = h('div', { class: 'mix-axis', 'aria-hidden': 'true' }, [0, 10, 20, 30].map((t) => h('span', {}, `${t}s`)));
  const mixer = h('section', { class: 'mixer mixer-reveal mixer-full duel-mixer', 'aria-label': 'The mix' },
    h('div', { class: 'duel-mix-head' }, h('p', { class: 'duel-mix-label' }, 'Same mix, same moment'), h('div', { class: 'mixer-cassette' }, box.el)),
    band.el, axis, loading);

  const playBtn = h('button', { class: 'btn btn-primary btn-icon btn-round', type: 'button', 'aria-label': 'Pause', disabled: true }, icon('pause'));
  const replayBtn = h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': 'Play from the start', disabled: true }, icon('replay'));
  const progressFill = h('div', { class: 'progress-fill' });
  const progress = h('div', { class: 'progress' }, progressFill);
  const timeEl = h('span', { class: 'time' }, '');
  const controls = h('div', { class: 'controls' }, playBtn, replayBtn, progress, timeEl);
  // Nobody gets a head start: the controls stay locked until the countdown hits zero.
  let live = false;
  const isLive = () => live;
  playBtn.addEventListener('click', () => { if (isLive()) engine.toggle(); });
  replayBtn.addEventListener('click', () => { if (isLive()) engine.replay(); });

  // --- answers: the same four lock-in slots as solo. Songs the other player
  // claims drop into one of your slots with their name on it.
  const claimedIds = () => new Set((duelState()?.round?.slots || []).filter((sl) => sl.song).map((sl) => sl.song.id));
  const isTaken = (id) => claimedIds().has(id) || slots.some((sl) => sl.song && sl.song.id === id && sl.state !== 'wrong');
  const slots = [];
  const slotList = h('div', { class: 'slots' });
  for (let i = 0; i < 4; i++) {
    const slot = createAnswerSlot({ index: i, songs, isTaken, onChange: () => {}, onLock: handleLock });
    slots.push(slot);
    slotList.append(slot.el);
  }
  slots.forEach((sl) => sl.setDisabled(true));
  const hint = h('span', { class: 'submit-hint' }, '');
  // Stuck on the last one(s)? Both players have to agree to end the round.
  const endBtn = h('button', { class: 'btn btn-ghost btn-submit duel-end', type: 'button', onClick: () => voteGiveUp().catch(() => {}) }, 'End round');
  const endNote = h('span', { class: 'duel-end-note' }, '');
  const hintRow = h('div', { class: 'submit-row duel-hint-row' }, endBtn, hint, endNote);

  let frozenUntil = 0;
  async function handleLock(index, song) {
    const slot = slots[index];
    if (!song || slot.state !== 'picked') return;
    if (Date.now() < frozenUntil) return;
    let r;
    try { r = await guess(song.id); } catch { return; }
    if (r.result === 'correct') { if (slot.state !== 'correct') slot.markCorrect(); focusNext(); }
    else if (r.result === 'wrong') { slot.markWrong(); freeze(r.cooldown); }
    else if (r.result === 'taken' || r.result === 'mine') { slot.markWrong(); }
    else if (r.result === 'cooldown') freeze(r.until);
    updateHint();
  }
  function focusNext() { const next = slots.find((sl) => sl.state === 'empty'); if (next) next.focus(); }
  function freeze(ms) {
    frozenUntil = Date.now() + ms;
    slots.forEach((sl) => { if (sl.state === 'empty' || sl.state === 'picked') sl.setDisabled(true); });
    el.classList.add('is-frozen');
    updateHint();
    setTimeout(() => {
      if (Date.now() < frozenUntil) return;
      el.classList.remove('is-frozen');
      slots.forEach((sl) => sl.setDisabled(false));
      updateHint();
      focusNext();
    }, ms);
  }
  function updateHint() {
    const st = duelState();
    const mine = (st?.round?.slots || []).filter((sl) => sl.claimedBy === you).length;
    const theirs = (st?.round?.slots || []).filter((sl) => sl.claimedBy === them).length;
    const frozen = Date.now() < frozenUntil;
    hint.textContent = frozen ? 'Frozen for a moment after a wrong guess…'
      : `You ${mine} · ${st?.players?.[them]?.name || 'them'} ${theirs} · ${4 - mine - theirs} left`;
  }

  // --- countdown overlay
  const countNum = h('span', { class: 'dc-num' }, '');
  const countRound = h('span', { class: 'dc-round' }, roundOf === 1 ? 'get ready' : roundNo === roundOf ? 'Final round' : `Round ${roundNo}`);
  const countdown = h('div', { class: 'duel-countdown', hidden: true, 'aria-live': 'assertive' }, h('div', { class: 'dc-inner' }, countRound, countNum));

  // between rounds: who took it, then the next round loads by itself
  const between = h('div', { class: 'duel-between', hidden: true, 'aria-live': 'polite' });

  const opponentGone = h('p', { class: 'duel-banner', hidden: true }, '');

  const el = h('main', { class: 'screen screen-play screen-duel-play' },
    scoreboard, opponentGone, mixer, controls,
    h('section', { class: 'answers duel-answers' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Name the four songs')),
      slotList,
      hintRow,
    ),
    countdown, between,
  );

  // --- state -> UI
  const prevClaims = [null, null, null, null];
  let started = false, loaded = false, startTimer = null;

  function apply(s) {
    if (!s.players) return;
    s.players.forEach((p, i) => {
      roundStars[i].replaceChildren(...Array.from({ length: p.roundWins || 0 }, () => h('i', { 'aria-hidden': 'true' }, '★')));
      scoreNums[i].textContent = String(p.score);
      [...pipRows[i].children].forEach((pip, k) => pip.classList.toggle('is-on', k < p.score));
    });
    const opp = s.players[them];
    opponentGone.hidden = !opp || opp.connected;
    if (opp && !opp.connected) opponentGone.textContent = `${opp.name} disconnected. If they don't come back soon, you win.`;

    (s.round?.slots || []).forEach((sl, i) => {
      if (sl.claimedBy == null || prevClaims[i] != null) return;
      prevClaims[i] = sl.claimedBy;
      const shown = slots.find((x) => x.song?.id === sl.song.id && (x.state === 'correct' || x.state === 'taken'));
      if (shown) return;
      if (sl.claimedBy === you) {
        // usually the slot you just locked (the live update can beat the reply); else after a reconnect, an open slot
        const target = slots.find((x) => x.state === 'picked' && x.song?.id === sl.song.id) || slots.find((x) => x.state === 'empty');
        if (target) { if (target.state === 'empty') target.setSong(sl.song); target.markCorrect(); }
        return;
      }
      // theirs: take over a slot holding the same pick, else the first open one
      const target = slots.find((x) => x.state === 'picked' && x.song?.id === sl.song.id)
        || slots.find((x) => x.state === 'empty')
        || slots.find((x) => x.state === 'picked');
      if (target) target.markTakenBy(sl.song, s.players[sl.claimedBy].name, '#9E2A4B'); // maroon: they got there first
    });
    updateHint();
    const meP = s.players[you], oppP = s.players[them];
    endBtn.textContent = meP?.giveUp ? 'Keep playing' : oppP?.giveUp ? 'Agree to end' : 'End round';
    endBtn.classList.toggle('is-asked', !!oppP?.giveUp && !meP?.giveUp);
    endNote.textContent = meP?.giveUp ? `Waiting for ${oppP?.name || 'them'} to agree…`
      : oppP?.giveUp ? `${oppP.name} can't find the rest and wants to end the round.` : '';

    if (s.round?.startAt && !started) scheduleStart(s.round.startAt);
    if (s.phase === 'between' && between.hidden) showBetween(s);
  }

  function showBetween(s) {
    engine.stop();
    const r = s.result || {};
    const me = s.players[you], opp = s.players[them];
    const won = r.winner === you;
    const glow = r.draw ? '#6BE38A' : won ? '#FFC857' : '#45D9FF';
    between.style.setProperty('--dg', glow);
    between.className = `duel-between is-${r.draw ? 'draw' : won ? 'win' : 'lose'}`;
    between.replaceChildren(h('div', { class: 'db-inner' },
      h('span', { class: 'db-kicker' }, `Round ${r.round}`),
      h('h2', { class: 'db-title' }, r.draw ? 'Even!' : won ? 'Yours!' : `${opp.name}'s`),
      h('p', { class: 'db-score' }, h('b', { style: `color:${me.color}` }, String(me.score)), h('span', {}, '–'), h('b', { style: `color:${opp.color}` }, String(opp.score))),
      h('p', { class: 'db-tally' }, `Rounds: You ${me.roundWins} – ${opp.roundWins} ${opp.name}`),
      h('p', { class: 'db-next' }, r.round + 1 === roundOf ? 'Final round coming up…' : `Round ${r.round + 1} coming up…`),
    ));
    between.hidden = false;
  }

  function scheduleStart(startAt) {
    started = true;
    countdown.hidden = false;
    const tick = () => {
      const left = startAt - serverNow();
      if (left <= 0) {
        countNum.textContent = ROUND_WORDS[(roundNo - 1) % ROUND_WORDS.length];
        countdown.classList.add('is-go');
        countNum.classList.remove('is-pop'); void countNum.offsetWidth; countNum.classList.add('is-pop');
        setTimeout(() => { countdown.hidden = true; }, 900);
        live = true;
        const ready = engine.state !== 'loading' && engine.state !== 'idle';
        playBtn.disabled = !ready; replayBtn.disabled = !ready;
        slots.forEach((sl) => sl.setDisabled(false));
        engine.ensureContext();
        if (loaded) engine.replay();
        slots[0].focus();
        return;
      }
      const n = String(Math.min(3, Math.ceil(left / 800)));
      if (countNum.textContent !== n) { countNum.textContent = n; countNum.classList.remove('is-pop'); void countNum.offsetWidth; countNum.classList.add('is-pop'); }
      startTimer = setTimeout(tick, 80);
    };
    tick();
  }

  const clockTimer = setInterval(() => {
    const s = duelState();
    if (!s?.round?.startAt || s.phase === 'done') return;
    const t = Math.max(0, (serverNow() - s.round.startAt) / 1000);
    clock.textContent = formatTime(Math.floor(t));
  }, 250);

  const offState = engine.on('statechange', (st) => {
    const ready = st !== 'loading' && st !== 'idle';
    playBtn.disabled = !ready || !live; replayBtn.disabled = !ready || !live;
    loading.hidden = st !== 'loading';
    box.setPlaying(st === 'playing');
    playBtn.replaceChildren(icon(st === 'playing' ? 'pause' : 'play'));
  });
  const offTime = engine.on('timeupdate', (t) => {
    progressFill.style.width = Math.min(100, (t / engine.limit) * 100) + '%';
    timeEl.textContent = `${formatSeconds(t)} / ${formatSeconds(engine.limit)}`;
  });

  // load the clips (titles stay on the server), then tell it we're ready
  engine.unload();
  clipMeta()
    .then((meta) => engine.load(meta.clips, { duration: meta.duration, fallback: 'synth' }))
    .then(() => {
      engine.setLimit(engine.duration);
      reveal.setMax(engine.duration); reveal.set(engine.duration);
      band.redraw();
      loaded = true;
      reportLoaded().catch(() => {});
      // loaded after GO: join the mix where it is now, so both players stay in sync
      const startAt = duelState()?.round?.startAt;
      if (started && startAt && serverNow() >= startAt) {
        const into = (serverNow() - startAt) / 1000;
        if (into < engine.duration - 0.5) { engine.seek(into); engine.play(); } else engine.replay();
      }
    })
    .catch((err) => { loading.lastChild.textContent = `Couldn't load the mix: ${err.message}`; });

  const off = onDuel(apply);
  function onKey(e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    if (e.code === 'Space') { e.preventDefault(); if (isLive()) engine.toggle(); }
  }
  document.addEventListener('keydown', onKey);

  return {
    el,
    destroy() {
      off(); offState(); offTime(); clearInterval(clockTimer); clearTimeout(startTimer);
      document.removeEventListener('keydown', onKey);
      band.destroy();
    },
  };
}
