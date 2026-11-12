import { deezerProvider } from './deezer.js';
import { localProvider } from './local.js';
import { filesProvider } from './files.js';

const PROVIDERS = { deezer: deezerProvider, files: filesProvider, synth: localProvider };

export function getProvider() {
  const id = (process.env.MIXTAPE_PROVIDER || 'synth').toLowerCase();
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown MIXTAPE_PROVIDER "${id}". Known: ${Object.keys(PROVIDERS).join(', ')}`);
  return p;
}
