// Cross-platform launcher: `node server/run.js files` sets MIXTAPE_PROVIDER
// without relying on shell syntax (Windows cmd/PowerShell don't accept VAR=x cmd).
//
//   node server/run.js            placeholder audio
//   node server/run.js files      your own clips in audio/<category>/
//   node server/run.js deezer     Deezer previews (non-commercial use only)

const provider = (process.argv[2] || 'synth').toLowerCase();
process.env.MIXTAPE_PROVIDER = provider;
await import('./index.js');
