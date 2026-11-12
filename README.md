# SquirmyWorms

Four songs play at once. Hear through the chaos and name them all.

Plain HTML + CSS + ES modules, plus an optional dependency-free Node backend for
real song previews. No build step.

```
npm run start:files     # your own clips in audio/pop/  (http://localhost:8787)
npm start               # placeholder audio
npm run start:deezer    # Deezer previews (read "Audio providers" first)
```

These work on Windows, macOS and Linux (they go through `server/run.js`).
Equivalent without npm: `node server/run.js files`.

### Your own files (files mode)

Drop clips into `audio/<category>/` named `Artist - Title.mp3` and run
`npm run start:files`. Album and year are matched from the bundled catalogue;
`audio/<category>/manifest.json` can override any field, set a `start`
offset for full-length files, or add a `gainDb` trim for clips that still sound
soft in a mix (Fireflies has +4 dB). The autocomplete is padded with the bundled
catalogue so the dropdown doesn't give the five answers away. Rounds draw at
random, avoid the last 24 songs played in this browser, and push recently heard
artists to the back of the queue. Last and best score per mix are kept in the
browser (`js/game/scores.js`). Only use files you have the
rights to; this mode is for private play.

Without the backend (any static host, or the claude.ai artifact) the game runs in
local mode with placeholder audio.

## Audio providers: read before switching on real audio

Researched November 2026 for a browser music-guessing game:

- **Spotify**: `preview_url` is null for apps created after 27 Nov 2024, and the
  Developer Terms forbid offering preview clips as a standalone product or mixing
  Spotify content with other media. Not usable.
- **Apple iTunes Search API / Apple Music API**: previews are licensed "only to
  promote store content and not for entertainment purposes" (Search API terms),
  and App Review guideline 5.2.5 says previews "may not be used for their
  entertainment value". A guessing game is entertainment. Not usable; no adapter
  is included on purpose.
- **Deezer Simple API**: token-free read endpoints with 30 s MP3 previews. Developer
  terms: strictly non-commercial (no revenue, ads or data), content for strictly
  private use, for personal web pages/applications, users must be told of those
  conditions, trademark guidelines apply. Deezer issues no formal approvals and
  has suspended new app registration since mid-2025 (not needed for these
  endpoints). Preview URLs are signed and expire after ~15 minutes; some tracks
  have no preview. The API has no CORS, so calls go through `server/`.
- **TIDAL**: previews only through TIDAL's own SDK player, so no Web Audio mixing.
- **7digital**: licensed B2B catalogue with previews; the route for a public or
  commercial launch (negotiated pricing).

The Deezer adapter is therefore suitable for a private, non-commercial build
(no ads, no revenue). For anything public or commercial, obtain Deezer's written
permission or use a licensed provider. The server never writes audio to disk: each
`/api/preview` request mints a fresh signed URL and streams the bytes through
with `Cache-Control: no-store`.

### Provider architecture

```
server/index.js            static files + /api (config, catalog, round, replace, preview, health)
server/providers/index.js  MIXTAPE_PROVIDER -> adapter
server/providers/deezer.js Deezer adapter: artist lookup, top tracks, probe, preview stream
server/providers/files.js  your own audio files from audio/<category>/
server/providers/local.js  bundled catalogue + synthesized audio (default)
server/catalog.js          pool cache (metadata only, 6 h), duplicate-version removal,
                           round picking (one song per artist), playability probe + replacement
server/categories.js       seed artists per category (add a genre here)
```

Round flow in remote mode: `/api/round` builds or reuses the category pool, picks
five songs by popularity-weighted random draw, probes each preview (fresh URL,
ranged GET, content-type check) and replaces failures before responding. The
browser then decodes all five; any that fail to decode are swapped via
`/api/replace` (which honours the one-artist rule) up to three times. If a
provider only has 15 s previews, the round and the reveal range shrink to the
shortest clip. Nothing starts until five previews have decoded.

### Testing the pipeline offline

`tools/fake-deezer.js` mimics Deezer's API shape with generated tone "previews"
and deliberate faults (404s, HTML responses, undecodable bytes, 15 s clips,
duplicate versions, null previews):

```
node tools/fake-deezer.js &
MIXTAPE_PROVIDER=deezer DEEZER_API_BASE=http://127.0.0.1:8790 node server/index.js
```

## Layout

```
server/                 optional Node backend (see above)
tools/fake-deezer.js    offline stand-in for the Deezer API
index.html
styles.css
js/
  main.js                 bootstrap + hash router (#home, #mixes, #play, #results)
  data/
    categories.js         category registry (id, name, available, accent, icon)
    songs.pop.js          bundled Pop song records (metadata only, local mode)
    remote.js             /api client
    index.js              data source: remote (backend) or local; catalogue, round picks, replacements
  audio/
    engine.js             MixEngine: 5 buffers -> gain -> analyser -> master -> compressor
    sources.js            audio descriptor -> AudioBuffer (adapters: 'url', 'synth')
    synth.js              seeded placeholder clip renderer (OfflineAudioContext)
  game/round.js           round state + scoring (pure)
  game/reveal.js          progressive reveal state (per round, per player, serialisable)
  components/
    search.js             debounced autocomplete, keyboard nav, taken-state, empty state
    slot.js               numbered answer slot (empty = search, filled = pick + remove)
    waveform.js           five-strand canvas visualiser (home hero)
    revealBand.js         full 30 s timeline with draggable reveal boundary (play screen)
    cassette.js           drawn cassette with spinning reels
    artwork.js            song.artwork or a seeded procedural cover
  screens/                home, categories, play, results
  ui/dom.js               tiny element helper + inline SVG icons
  util/seed.js            hash + PRNG
```

## Progressive reveal

Each round starts with 0.1 s of the mix unlocked. The player drags the boundary
(or presses "Reveal to Ns" / the milestone ticks) to unlock more, up to 30 s.
Milestones: 0.1, 1, 2, 3, 5, 8, 12, 18, 24, 30 s; intermediate values are allowed.

Three things are kept separate on purpose:

- `round.reveal` (`{ unlocked, maxUnlocked }`) is plain data on the round. A
  multiplayer server can hand every player the same songs and starting state,
  and track each player's reveal and answers independently.
- `engine.limit` is the only thing the engine knows about reveal. The play screen
  subscribes to the reveal controller and calls `engine.setLimit(seconds)`.
  Sources are scheduled with `start(when, 0)` and `stop(when + limit)`, so all
  five stop on the same sample. Extending the limit mid-play re-schedules the
  sources from the current position without a gap.
- Playback position never changes when the reveal changes. Play always runs the
  unlocked section from the start (or resumes after a pause).

Answers are locked in one slot at a time and checked immediately: a correct
lock-in turns green and stays; a wrong one flashes, clears the slot and costs
25 points. The round ends when all four are locked, or with "Finish round early".

Scoring (game/round.js): 100 per song; a quick-lock bonus per correct song
(50 if locked within 10 s of the first play, tapering to 0 at 90 s); +250 for
all four; a reveal bonus by the maximum audio unlocked during the round (200 at
<=1 s down to 25 at <=30 s) scaled by the share of songs identified; minus 25
per wrong lock-in; floored at 0. Round points map to a listener rank
(`RANKS` in round.js): Shower singer, Casual radio listener, Playlist curator,
Front-row fan, Human Shazam, Secret pop star.

Loudness: every clip is rendered offline through the per-track compressor and
measured with a K-weighted, gated loudness estimate (`js/audio/loudness.js`),
then normalised to one target. On top of that, presence-band (1-4 kHz) energy
is compared across the round and sparse tracks are lifted (dense ones eased) by
half the difference, within +/-3 dB, so an acoustic ballad stays recognisable
under three full productions.

## Look

Palette: near-black purple, violet, pink, cyan. Type: Unbounded (wordmark),
DM Sans (UI), Caveat (marker-pen notes); fonts are bundled in `fonts.css` as
data URIs so the game works offline. The hand-made layer lives in
`js/components/doodles.js`, `js/components/cassette.js` (a detailed drawn
cassette) and the "Human touches" block of `styles.css`: masking-tape strips,
wobbly doodle stars, a scribbled arrow, handwritten asides and verdicts, J-card
tracklist labels (A1 to A4), slightly crooked sticker tiles. Gameplay controls
(reveal band, inputs, buttons) stay clean on purpose.

## Clip preparation

`audio/pop/` clips were normalised offline with ffmpeg (EBU R128, two-pass
`loudnorm`, −16 LUFS integrated, −1.5 dBTP ceiling, linear gain) so every file
starts at the same loudness and none clip. Originals are kept in
`audio/_originals/pop/`. To do the same for new files:

```
ffmpeg -i in.mp3 -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -   # read measured_* values
ffmpeg -i in.mp3 -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=..:measured_TP=..:measured_LRA=..:measured_thresh=..:offset=..:linear=true" -c:a libmp3lame -b:a 192k out.mp3
```

## Audio

All four tracks are started with the same `AudioContext` timestamp and share one
master bus. Pause stops every source and remembers the offset; resume recreates
the sources at that offset. There are no per-track controls on purpose.

**This build ships placeholder audio.** Every song's `audio` descriptor is
`{ type: 'synth' }`, which renders a short synthesized clip seeded from the song
id. It is clearly labelled in the UI and is not the real recording. The
"Testing: reveal this round" link on the play screen exists for this reason;
remove it from `screens/play.js` once real audio is in.

### Song record

```js
{ id, provider, providerId, title, artist, album, year, category, artwork,
  audio: { type: 'url', src: '/api/preview?id=...', start: 0, seconds: 30 },
  availability: 'ok' | 'unavailable' | 'unknown' }
```

`audio.type` is `'synth'` for placeholder clips. Add another source type in
`js/audio/sources.js`; the engine only ever sees AudioBuffers.

## Adding a category

1. Create `js/data/songs.<genre>.js` exporting an array of song records
   (`id`, `title`, `artist`, `album`, `year`, `category`, `artwork`, `audio`).
2. Register it in `js/data/index.js`.
3. Set `available: true` on the category in `js/data/categories.js`.

## Scoring

100 per correct song, +250 for all five, and a speed bonus of up to 100
(full if submitted within 30 s of first play, tapering to 0 at 150 s).
Rules live in `game/round.js` as `ROUND_RULES`.

## Duel mode (2 players)

Tap **Duel a friend** on the front page. Three ways in:

- **Invite a friend**: you get a 5-letter code and a link to send.
- **Join with a code**: type the code your friend sent.
- **Random opponent**: you're paired with the next person who taps it.

A duel is 3 rounds. Both players hear the same mix at the same moment. The first to name a song claims it. Each round plays until all 4 songs are claimed or 3 minutes run out. A wrong guess freezes you for 2 seconds. Win more rounds to win the duel; if rounds are level, total songs decide it, otherwise it's a draw.

**Who can join:** the server must be running (`npm run start:files`). When it starts it prints a Wi-Fi address like `http://192.168.1.23:8787`. Friends on the same Wi-Fi can open that, and invite links use it automatically. For friends on other networks, the game needs to be hosted online (for example on Render or Railway).
