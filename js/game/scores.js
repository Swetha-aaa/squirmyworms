// Last and best score per category, kept in this browser (localStorage).
// Falls back to memory if storage is unavailable.

const mem = {};
const key = (cat) => `mixtape.scores.${cat}`;

export function getScores(categoryId) {
  try {
    const raw = localStorage.getItem(key(categoryId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return mem[categoryId] || { last: null, best: null };
}

/** Record a finished round. Returns { prevBest, prevLast, isNewBest }. */
export function recordScore(categoryId, points) {
  const prev = getScores(categoryId);
  const isNewBest = prev.best == null || points > prev.best;
  const next = { last: points, best: isNewBest ? points : prev.best };
  mem[categoryId] = next;
  try { localStorage.setItem(key(categoryId), JSON.stringify(next)); } catch { /* ignore */ }
  return { prevBest: prev.best, prevLast: prev.last, isNewBest, firstGame: prev.best == null };
}
