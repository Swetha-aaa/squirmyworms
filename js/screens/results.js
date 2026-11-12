import { h, icon } from '../ui/dom.js';
import { wordmark } from './shared.js';
import { artworkEl } from '../components/artwork.js';
import { STRAND_COLORS } from '../components/waveform.js';
import { formatTime, formatSeconds, rankFor, RANKS } from '../game/round.js';
import { dataSource, isRemote } from '../data/index.js';
import { tape, note, doodleStar } from '../components/doodles.js';
import { createRevealBand } from '../components/revealBand.js';
import { createRevealController } from '../game/reveal.js';
import { createRankWorm, createWormHead, RANK_LOOKS } from '../components/worms.js';

const rankColor = (level) => RANK_LOOKS[Math.max(0, Math.min(RANK_LOOKS.length - 1, level - 1))].color;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(el, to, ms) {
  if (reduceMotion()) { el.textContent = String(to); return; }
  const start = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - start) / ms);
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Full-screen rank reveal: glows in, holds, fades out. Tap or any key skips. */
function showRankReveal(rank, points, onDone, isRecord = false) {
  const meter = h('div', { class: 'rr-meter', 'aria-hidden': 'true' },
    RANKS.map((_, i) => h('i', { class: i < rank.level ? 'is-on' : '', style: `--d:${i * 90}ms` })));
  const pts = h('span', { class: 'rr-points-num' }, '0');
  const el = h('div', { class: `rank-reveal rk-${rank.level}`, role: 'dialog', 'aria-label': `Listener rank: ${rank.title}`, style: `--rk:${rankColor(rank.level)}` },
    h('div', { class: 'rr-inner' },
      doodleStar('rr-star rr-star-a', 0), doodleStar('rr-star rr-star-b', 1), doodleStar('rr-star rr-star-c', 2),
      h('div', { class: 'rr-worm' }, createRankWorm(rank.level)),
      h('span', { class: 'rr-kicker' }, 'you are a…'),
      h('h1', { class: 'rr-title' }, rank.title),
      h('p', { class: 'rr-blurb' }, rank.blurb),
      meter,
      h('p', { class: 'rr-points' }, pts, h('small', {}, ' pts')),
      isRecord ? h('span', { class: 'rr-record' }, 'new high score!') : null,
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
  setTimeout(() => countUp(pts, points, 900), 350);
  setTimeout(finish, reduceMotion() ? 1500 : 3200);
}

export function renderResults({ engine, round, result, session, onPlayAgain, onChangeMix }) {
  const rank = rankFor(result.points);
  const blocks = result.identified.map((x) => (x.correct ? '■' : '□')).join('');
  const fast = result.seconds <= 30;
  const headline = result.correctCount === result.total
    ? `All ${result.total} in ${fast ? 'just ' : ''}${formatTime(result.seconds)}`
    : result.correctCount > 0
      ? `${result.correctCount} of ${result.total} in ${formatTime(result.seconds)}`
      : 'None named this time';
  const shareText =
    `SquirmyWorms · ${round.category.name}${result.isNewBest && !result.firstGame ? ' · new high score' : ''}\n` +
    `${result.correctCount}/${result.total} songs ${blocks} in ${formatTime(result.seconds)}\n` +
    `${result.points} pts${result.perfect ? ' · perfect round' : ''}\n` +
    `Rank: ${rank.title}`;

  const copyBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, icon('copy'), 'Copy result');
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareText); copyBtn.lastChild.textContent = 'Copied'; }
    catch { copyBtn.lastChild.textContent = 'Copy blocked here'; }
    setTimeout(() => (copyBtn.lastChild.textContent = 'Copy result'), 1600);
  });

  const title = result.perfect ? 'Perfect round' : result.wrongCount >= 3 ? 'Out of guesses' : result.correctCount === 0 ? 'Tough mix' : 'Round complete';
  const verdict = result.perfect
    ? (fast ? 'clean sweep. show-off.' : 'clean sweep!!')
    : result.wrongCount >= 3 ? 'ouch. next one.'
    : result.correctCount >= 3 ? 'so close!'
    : result.correctCount >= 1 ? 'not bad, not bad'
    : 'the mix won this time';

  // When each song was locked (seconds after first play), by song id.
  const lockedAt = new Map();
  (round.locked || []).forEach((s, i) => { if (s) lockedAt.set(s.id, round.lockTimes?.[i]); });

  // Score parts for the stacked bar.
  const parts = [
    { key: 'songs', label: 'Songs', value: result.base, color: 'var(--gold)' },
    { key: 'perfect', label: 'Perfect', value: result.perfectBonus, color: 'var(--pink)' },
    { key: 'time', label: 'Speed', value: result.timeBonus, color: 'var(--cyan)' },
  ];
  const gross = parts.reduce((a, p) => a + p.value, 0) || 1;
  const bar = h('div', { class: 'score-worm', 'aria-hidden': 'true' },
    h('div', { class: 'score-bar' },
      parts.filter((p) => p.value > 0).map((p, i) =>
        h('span', { class: 'score-seg', style: `--w:${(p.value / gross) * 100}%; --c:${p.color}; --i:${i}` }))),
    h('span', { class: 'score-worm-head' }, createWormHead({ color: rankColor(rank.level), mood: result.points > 0 ? 'happy' : 'dizzy' })));
  const chips = h('ul', { class: 'score-chips' },
    parts.map((p) => h('li', { class: 'score-chip' + (p.value ? '' : ' is-zero'), style: `--c:${p.color}` },
      h('i', {}), h('span', { class: 'sc-label' }, p.label), h('b', {}, `+${p.value}`))),
    h('li', { class: 'score-chip is-penalty' + (result.penalty ? '' : ' is-zero') },
      h('i', {}), h('span', { class: 'sc-label' }, `Wrong ×${result.wrongCount}`), h('b', {}, `−${result.penalty}`)),
  );

  // ---- Listen back: replay the whole mix with the answers on screen.
  const canReplay = !!(engine && engine.tracks && engine.tracks.length);
  const lbPlay = h('button', { class: 'btn btn-primary btn-icon btn-round lb-play', type: 'button', 'aria-label': 'Play the full mix' }, icon('play'));
  const lbFill = h('div', { class: 'progress-fill' });
  const lbTime = h('span', { class: 'time' }, '');
  // Same waveform band as the play screen, fully unlocked and read-only.
  let lbBand = null;
  if (engine && engine.tracks && engine.tracks.length) {
    const d = engine.duration;
    const fullReveal = createRevealController({ duration: d, reveal: { unlocked: d, maxUnlocked: d, maxSeconds: d } });
    lbBand = createRevealBand({ engine, reveal: fullReveal, curve: 1 });
    lbBand.el.classList.add('is-static');
  }
  const lbHint = h('span', { class: 'lb-hint' }, 'Tap songs to hear them alone or layered.');
  const listenBack = canReplay
    ? h('div', { class: 'listen-back' },
        h('div', { class: 'lb-head' },
          h('span', { class: 'lb-title' }, 'Listen back'),
          note('now you know what to listen for', 'lb-note', -2),
        ),
        lbBand ? lbBand.el : null,
        h('div', { class: 'lb-row' }, lbPlay, h('div', { class: 'progress lb-progress' }, lbFill), lbTime),
        lbHint,
      )
    : null;
  const offs = [];
  if (canReplay) {
    engine.setSolo(null);
    engine.setLimit(engine.duration);
    engine.stop();
    const setIcon = () => {
      lbPlay.innerHTML = '';
      lbPlay.append(icon(engine.isPlaying ? 'pause' : 'play'));
      lbPlay.setAttribute('aria-label', engine.isPlaying ? 'Pause' : 'Play the full mix');
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
  // Tap songs to layer them: one plays alone, two play together, and so on.
  // Tap a song again to drop it; with none picked you hear the full mix.
  const layered = new Set();
  function toggleSolo(index) {
    if (!canReplay) return;
    if (layered.has(index)) layered.delete(index); else layered.add(index);
    engine.setSolo(layered.size ? layered : null);
    el.querySelectorAll('.track').forEach((n) => {
      const i = engine.tracks.findIndex((t) => t.song.id === n.dataset.song);
      n.classList.toggle('is-solo', layered.has(i));
      n.classList.toggle('is-muted', layered.size > 0 && !layered.has(i));
    });
    lbHint.textContent = layered.size === 0
      ? 'Tap songs to hear them alone or layered.'
      : layered.size === engine.tracks.length ? `All ${layered.size} layered. Tap one to drop it.` : `Playing ${layered.size} of ${engine.tracks.length}. Tap more to layer, or tap one again to drop it.`;
    if (!engine.isPlaying) { engine.ensureContext(); engine.play(); }
  }


  const isRecord = result.isNewBest && !result.firstGame;
  const bestLine = isRecord
    ? h('p', { class: 'best-line is-record' }, h('span', { class: 'best-badge' }, 'New high score!'), ` beat your best of ${result.prevBest}`)
    : result.firstGame
      ? h('p', { class: 'best-line' }, 'First score on the board. Now beat it.')
      : h('p', { class: 'best-line' }, `Your best is ${result.prevBest}. `, h('b', {}, `${result.prevBest - result.points + 1} more`), ' to beat it.');

  const bigNum = h('span', { class: 'result-big' }, '0');
  const totalEl = h('span', { class: 'sb-total-num' }, '0');

  const el = h('main', { class: 'screen screen-results' },
    h('header', { class: 'topbar' },
      h('span', {}),
      wordmark('sm'),
      h('div', { class: 'topbar-meta' },
        h('span', { class: 'chip' }, round.category.short),
        h('span', { class: 'meta meta-best' }, 'Best ', h('b', {}, String(Math.max(result.points, result.prevBest ?? 0)))),
      ),
    ),

    h('section', { class: 'rs' },
      tape('tape-card', -5),

      // Hero band: count, headline, verdict, rank badge
      h('div', { class: 'rs-hero' + (result.perfect ? ' is-perfect' : ''), style: `--rk:${rankColor(rank.level)}` },
        h('div', { class: 'rs-hero-left' },
          h('span', { class: 'rs-title' }, title),
          h('div', { class: 'result-count' }, bigNum, h('span', { class: 'result-of' }, `/${result.total}`)),
          h('p', { class: 'rs-headline' }, headline),
          bestLine,
        ),
        h('div', { class: 'rs-hero-right' },
          h('div', { class: 'rank-badge' },
            h('div', { class: 'rb-worm' }, createRankWorm(rank.level)),
            h('span', { class: 'rb-label' }, `Rank ${rank.level} of ${rank.of}`),
            h('span', { class: 'rb-title' }, rank.title),
            rank.next ? h('span', { class: 'rb-next' }, `${rank.next.at - result.points} to ${rank.next.title}`) : h('span', { class: 'rb-next' }, 'top of the charts'),
          ),
          note(verdict, 'rs-verdict', -4),
        ),
        result.perfect ? h('span', { class: 'stamp', 'aria-hidden': 'true' }, 'perfect') : null,
      ),

      listenBack,

      // Tracklist
      h('ol', { class: 'tracklist' },
        result.identified.map(({ song, correct }, i) => {
          const t = lockedAt.get(song.id);
          return h('li', { class: 'track ' + (correct ? 'is-hit' : 'is-miss'), style: `--c:${STRAND_COLORS[i % 5]}; --i:${i}`,
              dataset: { song: song.id }, role: 'button', tabindex: '0', title: 'Tap to layer this song in the replay' },
            h('span', { class: 'track-n' }, createWormHead({ color: STRAND_COLORS[i % 5], mood: correct ? 'happy' : 'dizzy' })),
            artworkEl(song, 52),
            h('div', { class: 'track-text' },
              h('span', { class: 'track-title' }, song.title),
              h('span', { class: 'track-artist' }, song.artist + (song.year ? ` · ${song.year}` : '')),
            ),
            h('span', { class: 'track-time' }, correct && t != null ? `${Math.round(t)}s` : correct ? '' : 'missed'),
            h('span', { class: 'result-mark', 'aria-label': correct ? 'Identified' : 'Missed' }, icon(correct ? 'check' : 'cross')),
          );
        }),
      ),

      // Score
      h('div', { class: 'sb', style: `--rk:${rankColor(rank.level)}` },
        h('div', { class: 'sb-head' },
          h('span', { class: 'sb-label' }, 'Round total'),
          h('span', { class: 'sb-total' }, totalEl, h('small', {}, ' pts')),
        ),
        bar,
        chips,
        h('p', { class: 'sb-meta' },
          `Finished in ${formatTime(result.seconds)}` +
          (result.prevLast != null ? ` · last game ${result.prevLast} pts` : '')),
      ),

      isRemote() ? h('p', { class: 'muted small' }, dataSource().config.attribution) : null,

      h('div', { class: 'result-actions' },
        h('button', { class: 'btn btn-primary btn-lg btn-skew', type: 'button', onClick: onPlayAgain },
          h('span', { class: 'btn-inner' }, icon('replay'), 'Play again')),
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: onChangeMix }, 'Change mix'),
        copyBtn,
      ),
    ),
  );

  // Map tracklist rows to engine tracks by song id (round order == engine order).
  if (canReplay) {
    el.querySelectorAll('.track').forEach((li) => {
      const idx = engine.tracks.findIndex((t) => t.song.id === li.dataset.song);
      if (idx < 0) return;
      li.addEventListener('click', () => toggleSolo(idx));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSolo(idx); } });
    });
  }

  // Rank reveal first, then the sheet animates in.
  el.classList.add('is-waiting');
  setTimeout(() => showRankReveal(rank, result.points, () => {
    el.classList.remove('is-waiting');
    el.classList.add('is-in');
    setTimeout(() => { countUp(bigNum, result.correctCount, 600); countUp(totalEl, result.points, 900); }, 150);
    // Start the listen-back automatically once the rank has faded.
    if (canReplay && !engine.isPlaying && el.isConnected) { engine.ensureContext(); engine.play(); }
  }, isRecord), 60);

  return {
    el,
    destroy() {
      offs.forEach((off) => off());
      lbBand?.destroy();
      if (canReplay) { engine.setSolo(null); engine.stop(); }
    },
  };
}
