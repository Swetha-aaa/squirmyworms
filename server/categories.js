// Category discovery seeds. The provider turns these into a track pool.
//
// Each category lists artist names (looked up on the provider, then their top
// tracks are pulled) and optional provider playlist/chart ids. Adding a genre is
// adding an entry here; the game, the search and the mixer do not change.

export const CATEGORY_SEEDS = {
  pop: {
    artists: [
      'Taylor Swift', 'Ed Sheeran', 'Bruno Mars', 'Ariana Grande', 'The Weeknd',
      'Dua Lipa', 'Billie Eilish', 'Olivia Rodrigo', 'Sabrina Carpenter', 'Harry Styles',
      'Justin Bieber', 'Adele', 'Katy Perry', 'Lady Gaga', 'Rihanna', 'Beyoncé',
      'Miley Cyrus', 'Shawn Mendes', 'Camila Cabello', 'Selena Gomez', 'Halsey',
      'Lorde', 'Sia', 'Doja Cat', 'Charli XCX', 'Tate McRae', 'Chappell Roan',
      'Post Malone', 'Khalid', 'Charlie Puth', 'Sam Smith', 'One Direction',
      'Maroon 5', 'Coldplay', 'Imagine Dragons', 'OneRepublic', 'The Chainsmokers',
      'Calvin Harris', 'Britney Spears', 'Christina Aguilera', 'Backstreet Boys',
      'Justin Timberlake', 'Kelly Clarkson', 'Avril Lavigne', 'P!nk', 'Kesha',
      'Lana Del Rey', 'Lewis Capaldi', 'Benson Boone', 'Teddy Swims',
    ],
    topTracksPerArtist: 25,
  },
  kpop: { artists: ['BTS', 'BLACKPINK', 'NewJeans', 'TWICE', 'Stray Kids', 'SEVENTEEN', 'aespa', 'IVE', 'LE SSERAFIM', 'EXO', 'Red Velvet', 'ITZY', 'TXT', 'ENHYPEN', '(G)I-DLE'], topTracksPerArtist: 20 },
  cpop: { artists: ['Jay Chou', 'JJ Lin', 'Jolin Tsai', 'Eason Chan', 'G.E.M.', 'Mayday', 'Teresa Teng', 'Hebe Tien', 'A-Mei', 'Leehom Wang', 'Jacky Cheung', 'Stefanie Sun', 'Eric Chou', 'Joker Xue'], topTracksPerArtist: 20 },
  jpop: { artists: ['YOASOBI', 'Official HIGE DANdism', 'Kenshi Yonezu', 'Ado', 'LiSA', 'Aimer', 'King Gnu', 'Vaundy', 'Mrs. GREEN APPLE', 'Fujii Kaze', 'RADWIMPS', 'Yoasobi', 'Eve', 'Perfume', 'Utada Hikaru'], topTracksPerArtist: 20 },
};

export function getSeeds(categoryId) {
  return CATEGORY_SEEDS[categoryId] || null;
}
