// Progressive reveal state. Pure data + events, no audio and no DOM.
//
// Lives on the round (round.reveal) so it is per player, serialisable, and can be
// synchronised by a multiplayer server later. The audio engine only ever receives
// the resulting `unlocked` number via engine.setLimit().

export const REVEAL_MIN = 0.1;
export const REVEAL_MILESTONES = [0.1, 1, 2, 3, 5, 8, 12, 18, 24, 30];

export function initialRevealState(maxSeconds = 30) {
  return { unlocked: REVEAL_MIN, maxUnlocked: REVEAL_MIN, maxSeconds };
}

export function createRevealController(round) {
  if (!round.reveal) round.reveal = initialRevealState(round.duration);
  const state = round.reveal;
  const listeners = new Set();

  function emit() {
    for (const fn of listeners) fn(state.unlocked, state);
  }

  function clamp(v) {
    return Math.round(Math.max(REVEAL_MIN, Math.min(state.maxSeconds, v)) * 10) / 10;
  }

  return {
    get unlocked() { return state.unlocked; },
    get maxUnlocked() { return state.maxUnlocked; },
    get maxSeconds() { return state.maxSeconds; },
    get milestones() {
      const list = REVEAL_MILESTONES.filter((m) => m <= state.maxSeconds + 1e-9);
      if (list[list.length - 1] !== state.maxSeconds) list.push(state.maxSeconds);
      return list;
    },

    /** Shorter previews (e.g. 15 s) narrow the range; call after the audio is loaded. */
    setMax(seconds) {
      const v = Math.round(Math.max(REVEAL_MIN, seconds) * 10) / 10;
      if (v === state.maxSeconds) return;
      state.maxSeconds = v;
      if (state.unlocked > v) state.unlocked = v;
      if (state.maxUnlocked > v) state.maxUnlocked = v;
      emit();
    },

    set(seconds) {
      const v = clamp(seconds);
      if (v === state.unlocked) return;
      state.unlocked = v;
      if (v > state.maxUnlocked) state.maxUnlocked = v;
      emit();
    },

    nextMilestone() {
      return this.milestones.find((m) => m > state.unlocked + 1e-9) ?? null;
    },

    revealNext() {
      const next = this.nextMilestone();
      if (next != null) this.set(next);
      return next;
    },

    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
