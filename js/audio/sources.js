// Audio source adapters.
//
// The engine only ever sees AudioBuffers. This module turns a song's `audio`
// descriptor into a buffer of the requested length. Add a new adapter (e.g. a
// licensed preview API) by adding a case below; nothing else in the game changes.

import { renderPlaceholderClip } from './synth.js';

export class AudioSourceError extends Error {
  constructor(message, song) {
    super(message);
    this.song = song;
  }
}

async function loadUrlClip(song, ctx, duration) {
  const { src, start = 0 } = song.audio;
  const res = await fetch(src, { cache: 'no-store' });
  if (!res.ok) throw new AudioSourceError(`HTTP ${res.status} loading preview`, song);
  const type = res.headers.get('content-type') || '';
  if (/json|html/i.test(type)) throw new AudioSourceError(`Preview unavailable (${type.split(';')[0]})`, song);
  const bytes = await res.arrayBuffer();
  let full;
  try {
    full = await ctx.decodeAudioData(bytes);
  } catch (err) {
    throw new AudioSourceError(`Could not decode preview (${err?.message || 'decode error'})`, song);
  }

  // Trim to [start, start + duration]
  const sr = full.sampleRate;
  const from = Math.min(Math.floor(start * sr), full.length);
  const len = Math.min(Math.floor(duration * sr), full.length - from);
  if (len <= sr) throw new AudioSourceError(`Clip too short: ${src}`, song);

  const out = ctx.createBuffer(full.numberOfChannels, len, sr);
  for (let ch = 0; ch < full.numberOfChannels; ch++) {
    out.copyToChannel(full.getChannelData(ch).subarray(from, from + len), ch);
  }
  return out;
}

/**
 * Load a song's clip as an AudioBuffer.
 * @returns {{ buffer: AudioBuffer, placeholder: boolean }}
 */
export async function loadSongClip(song, ctx, duration) {
  const type = song.audio?.type || 'synth';
  switch (type) {
    case 'url':
      return { buffer: await loadUrlClip(song, ctx, duration), placeholder: false };
    case 'synth':
      return { buffer: await renderPlaceholderClip(song, duration, ctx.sampleRate), placeholder: true };
    default:
      throw new AudioSourceError(`Unknown audio source type "${type}"`, song);
  }
}
