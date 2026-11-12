// Local provider: the bundled metadata catalogue with synthesized placeholder
// audio. This is the development/fallback mode and the only mode that works on
// static hosting with no backend.

import { POP_SONGS } from '../../js/data/songs.pop.js';

export const localProvider = {
  id: 'synth',
  name: 'Placeholder audio',
  attribution: 'Placeholder audio in this build, not the original recordings.',
  attributionUrl: null,
  previewSeconds: 30,

  async buildPool(categoryId) {
    if (categoryId !== 'pop') return [];
    return POP_SONGS.map((s) => ({ ...s, provider: 'synth', providerId: s.id, availability: 'ok' }));
  },
  async probe() { return { ok: true }; },
  async openPreviewStream() { return null; },
};
