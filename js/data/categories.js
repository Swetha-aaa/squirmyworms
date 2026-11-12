// Category registry. Adding a genre = add an entry here and a song file in data/,
// then register it in data/index.js. Nothing in the UI or game logic needs to change.

export const CATEGORIES = [
  {
    id: 'pop',
    icon: 'vinyl',
    name: 'Pop',
    short: 'POP',
    blurb: 'Chart hits you know by heart.',
    available: true,
    accent: '#FF4FA3',
  },
  {
    id: 'kpop',
    icon: 'lightstick',
    name: 'K-pop',
    short: 'K-POP',
    blurb: 'Idols, comebacks and hooks you can\'t shake.',
    available: false,
    accent: '#8A5CFF',
  },
];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
}
