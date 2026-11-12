import { h, icon } from '../ui/dom.js';
import { wordmark } from './shared.js';
import { createRevealBand } from '../components/revealBand.js';
import { createCassette } from '../components/cassette.js';
import { note, tape } from '../components/doodles.js';
import { createAnswerSlot } from '../components/slot.js';
import { STRAND_COLORS } from '../components/waveform.js';
import { formatSeconds, formatTime, roundIsComplete, timeTierBonus, lockSlot, ROUND_RULES } from '../game/round.js';
import { createRevealController } from '../game/reveal.js';
import { dataSource, isRemote, pickReplacements, rememberPlayed } from '../data/index.js';
import { getScores } from '../game/scores.js';
import { createWormHead } from '../components/worms.js';
import { createBoombox } from '../components/boombox.js';

/**
 * Gameplay screen. Owns the slots, the round timer and the transport for one round.
 * The whole clip is playable from the start; the score rewards finishing fast.
 * @returns {{ el: HTMLElement, destroy(): void }}
 */
export function renderPlay({ engine, round, songs, session, autoplay, onSubmit, onQuit }) {
  const slots = [];
  const isTaken = (id) => slots.some((s) => s.song && s.song.id === id);
  // The whole clip is unlocked from the start; the reveal controller just keeps
  // the waveform band and engine limit in step with the clip length.
  round.reveal = { unlocked: round.duration, maxUnlocked: round.duration, maxSeconds: round.duration };
  const reveal = createRevealController(round);
  const scores = getScores(round.category.id);


  // --- Top bar
  const topbar = h('header', { class: 'topbar' },
    h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': 'Back to home', onClick: onQuit }, icon('back')),
    wordmark('sm'),
    h('div', { class: 'topbar-meta' },
      h('span', { class: 'chip' }, round.category.short),
      scores.last != null ? h('span', { class: 'meta' }, 'Last ', h('b', {}, String(scores.last))) : null,
      h('span', { class: 'meta meta-best' }, 'Best ', h('b', {}, scores.best != null ? String(scores.best) : '–')),
    ),
  );

  // --- Mix + timer (centrepiece)
  const band = createRevealBand({ engine, reveal, curve: 1 });
  band.el.classList.add('is-full');
  const cassette = createBoombox({ palette: round.category.id === 'kpop' ? 'kpop' : 'pop', className: 'play-boombox' });

  // Round timer: starts with the music, keeps running while you think.
  const timerNum = h('span', { class: 'timer-num' }, '0:00');
  const timerLabel = h('span', { class: 'timer-label' }, 'starts with the music');
  // Time bonus: a draining meter with a worm whose mood drops with the bonus.
  const tiers = ROUND_RULES.timeTiers;
  const bonusWorm = h('span', { class: 'bonus-worm' });
  const bonusPts = h('b', { class: 'bonus-pts' }, '');
  const bonusSub = h('span', { class: 'bonus-sub' }, '');
  const bonusPips = h('span', { class: 'bonus-pips', 'aria-hidden': 'true' }, tiers.map(() => h('i')));
  const bonusNow = h('div', { class: 'bonus' },
    bonusWorm,
    h('div', { class: 'bonus-text' },
      h('span', { class: 'bonus-line' }, bonusPts, h('span', { class: 'bonus-label' }, ' bonus if you finish now')),
      bonusPips,
      bonusSub,
    ),
  );
  let lastTier = null, lastMood = null;

  const revealHead = h('div', { class: 'reveal-head' },
    h('div', { class: 'reveal-readout' },
      h('div', { class: 'timer-line' }, timerNum, timerLabel),
      bonusNow,
    ),
    h('div', { class: 'reveal-actions' },
      h('div', { class: 'mixer-cassette' }, cassette.el),
    ),
  );

  const loading = h('div', { class: 'wave-loading' },
    h('span', { class: 'spinner', 'aria-hidden': 'true' }),
    h('span', {}, 'Mixing four tracks'),
  );
  const legend = h('div', { class: 'mix-legend' },
    h('span', { class: 'mix-dots' }, STRAND_COLORS.slice(0, round.songs.length).map((c) => h('i', { style: `--dot:${c}` }))),
    h('span', { class: 'mix-legend-text' }, '4 tracks, one mix'),
  );
  const axis = h('div', { class: 'mix-axis', 'aria-hidden': 'true' }, [0, 10, 20, 30].map((t) => h('span', {}, `${t}s`)));
  const mixer = h('section', { class: 'mixer mixer-reveal mixer-full', 'aria-label': 'The mix' }, revealHead, band.el, axis, legend, loading);

  // --- Transport
  const playBtn = h('button', { class: 'btn btn-primary btn-icon btn-round', type: 'button', 'aria-label': 'Play the mix', disabled: true }, icon('play'));
  const replayBtn = h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': 'Play from the start', disabled: true }, icon('replay'));
  const progressFill = h('div', { class: 'progress-fill' });
  const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuenow': '0' }, progressFill);
  const timeEl = h('span', { class: 'time' }, '');
  const transportHint = h('span', { class: 'transport-hint' }, 'Drag the white line to jump around');
  const controls = h('div', { class: 'controls' }, playBtn, replayBtn, progress, timeEl);

  const cfg = dataSource().config;
  const notice = h('p', { class: 'notice' + (isRemote() ? ' notice-provider' : '') },
    cfg.attribution,
    cfg.attributionUrl ? [' ', h('a', { href: cfg.attributionUrl, target: '_blank', rel: 'noopener' }, cfg.providerName)] : null,
  );

  // --- Slots
  const slotList = h('div', { class: 'slots' });
  for (let i = 0; i < round.songs.length; i++) {
    const slot = createAnswerSlot({ index: i, songs, isTaken, onChange: handleSlotChange, onLock: handleLock });
    slots.push(slot);
    slotList.append(slot.el);
  }

  const submitBtn = h('button', { class: 'btn btn-ghost btn-submit', type: 'button' }, 'Finish round early');
  const submitHint = h('span', { class: 'submit-hint' }, '');
  const submitRow = h('div', { class: 'submit-row' }, submitBtn, submitHint);

  // --- Testing aid (useful while audio is placeholder). Remove once real audio is wired in.
  const revealList = h('ul', { class: 'reveal-list', hidden: true });
  const peekBtn = h('button', { class: 'link link-dim', type: 'button' }, 'Testing: reveal this round');
  const peek = h('div', { class: 'reveal' }, peekBtn, revealList);
  peekBtn.addEventListener('click', () => {
    const show = revealList.hidden;
    revealList.hidden = !show;
    peekBtn.textContent = show ? 'Testing: hide answers' : 'Testing: reveal this round';
    if (show && !revealList.children.length) {
      round.songs.forEach((s) => revealList.append(h('li', {}, `${s.title} · ${s.artist}`)));
    }
  });

  const el = h('main', { class: 'screen screen-play' },
    topbar, mixer, controls, transportHint, notice,
    h('section', { class: 'answers' },
      h('div', { class: 'section-head' },
        h('h2', {}, 'Name the four songs'),
        note('can you name them all?', 'note-aside', -3),
      ),
      slotList,
      submitRow,
    ),
    h('footer', { class: 'foot' }, isRemote() ? h('span', {}, 'Previews are streamed, never stored. For private, non-commercial play.') : peek),
  );

  // --- Behaviour
  function handleSlotChange(index, song) {
    if (round.locked[index]) return;
    round.picks[index] = song;
    updateSubmit();
  }

  // One answer at a time: each lock-in is checked immediately.
  function handleLock(index) {
    if (round.submittedAt || round.locked[index]) return;
    if (!round.firstPlayAt) round.firstPlayAt = Date.now();
    const verdict = lockSlot(round, index);
    if (verdict === 'correct') {
      slots[index].markCorrect();
      updateSubmit();
      if (roundIsComplete(round)) setTimeout(finish, 700);
    } else if (verdict === 'wrong') {
      slots[index].markWrong();
      updateSubmit();
      if (round.wrongPicks.length >= ROUND_RULES.maxWrongGuesses) {
        submitHint.textContent = `${ROUND_RULES.maxWrongGuesses} wrong guesses. Revealing the mix…`;
        slots.forEach((s) => s.setDisabled(true));
        setTimeout(finish, 1300);
      }
    }
  }

  function updateSubmit() {
    const lockedCount = round.locked.filter(Boolean).length;
    const total = round.songs.length;
    const wrong = round.wrongPicks.length;
    submitBtn.disabled = !!round.submittedAt;
    submitBtn.hidden = roundIsComplete(round);
    const left = ROUND_RULES.maxWrongGuesses - wrong;
    submitHint.textContent =
      `${lockedCount} of ${total} locked in` +
      (wrong ? ` · ${wrong} wrong (−${wrong * ROUND_RULES.wrongGuessPenalty})` : '') +
      (left > 0 && left < ROUND_RULES.maxWrongGuesses ? ` · ${left} ${left === 1 ? 'guess' : 'guesses'} left` : '');
  }
  updateSubmit();

  const elapsed = () => (round.firstPlayAt ? Math.max(0, (Date.now() - round.firstPlayAt) / 1000) : 0);

  function updateTimer() {
    const t = elapsed();
    timerNum.textContent = formatTime(t);
    if (round.firstPlayAt) timerLabel.textContent = 'on the clock';
    const tier = timeTierBonus(t);
    const ti = Math.max(0, tiers.findIndex(([, b]) => b === tier));
    bonusPts.textContent = `+${tier}`;
    [...bonusPips.children].forEach((pip, i) => pip.classList.toggle('is-on', i >= ti));
    const next = tiers[ti + 1];
    bonusSub.textContent = next
      ? `Drops to +${next[1]} in ${formatTime(Math.max(0, Math.ceil(tiers[ti][0] - t)))}`
      : 'Last bonus tier';
    const mood = tier >= 300 ? 'excited' : tier >= 150 ? 'happy' : tier >= 100 ? 'chill' : 'dizzy';
    if (mood !== lastMood) {
      bonusWorm.replaceChildren(createWormHead({ color: '#FFC857', mood }));
      lastMood = mood;
    }
    if (lastTier != null && tier < lastTier) {
      const ghost = h('span', { class: 'bonus-ghost' }, `−${lastTier - tier}`);
      bonusNow.append(ghost);
      setTimeout(() => ghost.remove(), 900);
      bonusNow.classList.remove('is-drop'); void bonusNow.offsetWidth; bonusNow.classList.add('is-drop');
      timerNum.classList.remove('is-tick'); void timerNum.offsetWidth; timerNum.classList.add('is-tick');
    }
    bonusNow.classList.toggle('is-low', tier <= 100);
    lastTier = tier;
  }
  const timerId = setInterval(() => { if (!round.submittedAt) updateTimer(); }, 250);

  function updateTime(t) {
    const lim = reveal.unlocked;
    const pct = Math.min(100, (t / lim) * 100);
    progressFill.style.width = pct + '%';
    progress.setAttribute('aria-valuemax', String(lim));
    progress.setAttribute('aria-valuenow', String(Math.round(t * 10) / 10));
    timeEl.textContent = `${formatSeconds(t)} / ${formatSeconds(lim)}`;
  }

  function setPlayIcon() {
    const playing = engine.isPlaying;
    playBtn.innerHTML = '';
    playBtn.append(icon(playing ? 'pause' : 'play'));
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play the mix');
  }

  const markPlayed = () => { if (!round.firstPlayAt) { round.firstPlayAt = Date.now(); updateTimer(); } };

  playBtn.addEventListener('click', () => {
    if (engine.state === 'loading' || engine.state === 'idle') return;
    markPlayed();
    engine.toggle();
  });
  replayBtn.addEventListener('click', () => { markPlayed(); engine.replay(); });

  function finish() {
    if (round.submittedAt) return;
    round.submittedAt = Date.now();
    submitBtn.disabled = true;
    engine.stop();
    onSubmit(round);
  }
  submitBtn.addEventListener('click', finish);

  // Reveal -> engine boundary. The engine never touches reveal state.
  const offReveal = reveal.on((v) => { engine.setLimit(v); });

  const offTime = engine.on('timeupdate', updateTime);
  const offState = engine.on('statechange', (s) => {
    const ready = s !== 'loading' && s !== 'idle';
    playBtn.disabled = !ready;
    replayBtn.disabled = !ready;
    loading.hidden = s !== 'loading';
    mixer.classList.toggle('is-playing', s === 'playing');
    cassette.setPlaying(s === 'playing');
    legend.classList.toggle('is-live', s === 'playing');
    setPlayIcon();
  });

  // Keyboard: space toggles playback (outside text fields).
  function onKey(e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
  }
  document.addEventListener('keydown', onKey);

  // Load the mix. In remote mode every preview must decode in this browser; any
  // that fail are swapped for replacements (up to 3 rounds of swaps) before play.
  loading.hidden = false;
  updateTimer();

  async function loadWithReplacement(attempt = 0) {
    try {
      await engine.load(round.songs, {
        duration: round.duration,
        seed: round.seed,
        fallback: isRemote() ? 'none' : 'synth',
      });
    } catch (err) {
      if (err.name !== 'MixLoadError' || !isRemote() || attempt >= 3) throw err;
      const failedIds = new Set(err.failed.map((f) => f.song.id));
      loading.lastChild.textContent = `Replacing ${failedIds.size} unavailable ${failedIds.size === 1 ? 'preview' : 'previews'}`;
      round.excluded = [...(round.excluded || []), ...failedIds];
      const currentIds = round.songs.filter((s) => !failedIds.has(s.id)).map((s) => s.id);
      const replacements = await pickReplacements(round.category.id, currentIds, round.excluded, failedIds.size);
      if (replacements.length < failedIds.size) throw new Error('Not enough playable previews in this category right now.');
      let k = 0;
      round.songs = round.songs.map((s) => (failedIds.has(s.id) ? replacements[k++] : s));
      return loadWithReplacement(attempt + 1);
    }
  }

  loadWithReplacement()
    .then(() => {
      // Shorter previews narrow the round to the shortest clip.
      if (engine.duration < round.duration) {
        round.duration = engine.duration;
        reveal.setMax(engine.duration);
        reveal.set(engine.duration);
      }
      engine.setLimit(engine.duration);
      band.redraw();
      updateTime(0);
      rememberPlayed(round.category.id, round.songs);
      if (engine.warnings.length) {
        const warn = h('p', { class: 'notice notice-warn' }, engine.warnings.join(' '));
        notice.after(warn);
      }
      // Straight in: the whole mix plays as soon as it's ready.
      markPlayed(); engine.ensureContext(); engine.play();
      slots[0].focus();
    })
    .catch((err) => {
      loading.hidden = true;
      const fail = h('div', { class: 'wave-error' },
        h('p', {}, isRemote() ? `Couldn't load four playable previews: ${err.message}` : 'The mix could not be built in this browser.'),
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => location.reload() }, 'Try again'),
      );
      mixer.append(fail);
      console.error(err);
    });

  return {
    el,
    destroy() {
      document.removeEventListener('keydown', onKey);
      offReveal(); offTime(); offState(); clearInterval(timerId);
      band.destroy();
    },
  };
}
