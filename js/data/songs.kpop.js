// K-pop song database (metadata only, no recordings bundled).
// Same record shape as songs.pop.js. Used for autocomplete; playable clips come
// from audio/kpop/ when running with the files provider.

const AUDIO_PLACEHOLDER = { type: 'synth' };

// [title, artist, album, year]
const raw = [
  // BTS
  ['DNA', 'BTS', 'Love Yourself: Her', 2017],
  ['FAKE LOVE', 'BTS', 'Love Yourself: Tear', 2018],
  ['IDOL', 'BTS', 'Love Yourself: Answer', 2018],
  ['Boy With Luv', 'BTS ft. Halsey', 'Map of the Soul: Persona', 2019],
  ['Dynamite', 'BTS', 'BE', 2020],
  ['Butter', 'BTS', 'Butter', 2021],
  ['Permission to Dance', 'BTS', 'Butter', 2021],
  ['Spring Day', 'BTS', 'You Never Walk Alone', 2017],
  ['Blood Sweat & Tears', 'BTS', 'Wings', 2016],
  ['FIRE', 'BTS', 'The Most Beautiful Moment in Life: Young Forever', 2016],
  ['Run BTS', 'BTS', 'Proof', 2022],
  ['Mic Drop', 'BTS', 'Love Yourself: Her', 2017],
  ['Not Today', 'BTS', 'You Never Walk Alone', 2017],
  ['Save Me', 'BTS', 'The Most Beautiful Moment in Life: Young Forever', 2016],
  ['I Need U', 'BTS', 'The Most Beautiful Moment in Life, Part 1', 2015],
  ['Dope', 'BTS', 'The Most Beautiful Moment in Life, Part 1', 2015],
  ['Run', 'BTS', 'The Most Beautiful Moment in Life, Part 2', 2015],
  ['Life Goes On', 'BTS', 'BE', 2020],
  ['ON', 'BTS', 'Map of the Soul: 7', 2020],
  ['Black Swan', 'BTS', 'Map of the Soul: 7', 2020],
  ['Yet to Come', 'BTS', 'Proof', 2022],
  ['Euphoria', 'BTS', 'Love Yourself: Answer', 2018],
  ['Make It Right', 'BTS', 'Map of the Soul: Persona', 2019],
  ['Anpanman', 'BTS', 'Love Yourself: Tear', 2018],
  ['Boy in Luv', 'BTS', 'Skool Luv Affair', 2014],
  ['No More Dream', 'BTS', '2 Cool 4 Skool', 2013],
  ['My Universe', 'Coldplay & BTS', 'Music of the Spheres', 2021],
  // BTS solo
  ['Seven', 'Jungkook ft. Latto', 'Golden', 2023],
  ['Standing Next to You', 'Jungkook', 'Golden', 2023],
  ['3D', 'Jungkook ft. Jack Harlow', 'Golden', 2023],
  ['Like Crazy', 'Jimin', 'Face', 2023],
  ['Who', 'Jimin', 'Muse', 2024],
  ['Set Me Free Pt.2', 'Jimin', 'Face', 2023],
  ['Love Me Again', 'V', 'Layover', 2023],
  ['Slow Dancing', 'V', 'Layover', 2023],
  ['The Astronaut', 'Jin', 'The Astronaut', 2022],
  ['Running Wild', 'Jin', 'Happy', 2024],
  ['Wild Flower', 'RM', 'Indigo', 2022],
  ['Haegeum', 'Agust D', 'D-Day', 2023],
  ['Daechwita', 'Agust D', 'D-2', 2020],
  ['More', 'j-hope', 'Jack in the Box', 2022],
  // BLACKPINK
  ['BOOMBAYAH', 'BLACKPINK', 'Square One', 2016],
  ['Whistle', 'BLACKPINK', 'Square One', 2016],
  ['Playing with Fire', 'BLACKPINK', 'Square Two', 2016],
  ['Stay', 'BLACKPINK', 'Square Two', 2016],
  ["As If It's Your Last", 'BLACKPINK', "As If It's Your Last", 2017],
  ['DDU-DU DDU-DU', 'BLACKPINK', 'Square Up', 2018],
  ['Forever Young', 'BLACKPINK', 'Square Up', 2018],
  ['Kill This Love', 'BLACKPINK', 'Kill This Love', 2019],
  ['How You Like That', 'BLACKPINK', 'The Album', 2020],
  ['Lovesick Girls', 'BLACKPINK', 'The Album', 2020],
  ['Pretty Savage', 'BLACKPINK', 'The Album', 2020],
  ['Ice Cream', 'BLACKPINK & Selena Gomez', 'The Album', 2020],
  ['Kiss and Make Up', 'Dua Lipa & BLACKPINK', 'Dua Lipa: Complete Edition', 2018],
  ['Pink Venom', 'BLACKPINK', 'Born Pink', 2022],
  ['Shut Down', 'BLACKPINK', 'Born Pink', 2022],
  ['Typa Girl', 'BLACKPINK', 'Born Pink', 2022],
  ['The Girls', 'BLACKPINK', 'The Game: The Girls', 2023],
  ['Jump', 'BLACKPINK', 'Jump', 2025],
  ['SOLO', 'JENNIE', 'Solo', 2018],
  ['like JENNIE', 'JENNIE', 'Ruby', 2025],
  ['Mantra', 'JENNIE', 'Ruby', 2025],
  ['You & Me', 'JENNIE', 'You & Me', 2023],
  ['On the Ground', 'ROSÉ', 'R', 2021],
  ['Gone', 'ROSÉ', 'R', 2021],
  ['Toxic Till the End', 'ROSÉ', 'Rosie', 2024],
  ['Lalisa', 'LISA', 'Lalisa', 2021],
  ['Money', 'LISA', 'Lalisa', 2021],
  ['Rockstar', 'LISA', 'Alter Ego', 2024],
  ['New Woman', 'LISA ft. ROSALÍA', 'Alter Ego', 2024],
  ['Flower', 'JISOO', 'Me', 2023],
  // TWICE
  ['Like Ooh-Ahh', 'TWICE', 'The Story Begins', 2015],
  ['CHEER UP', 'TWICE', 'Page Two', 2016],
  ['TT', 'TWICE', 'Twicecoaster: Lane 1', 2016],
  ['KNOCK KNOCK', 'TWICE', 'Twicecoaster: Lane 2', 2017],
  ['SIGNAL', 'TWICE', 'Signal', 2017],
  ['LIKEY', 'TWICE', 'Twicetagram', 2017],
  ['Heart Shaker', 'TWICE', 'Merry & Happy', 2017],
  ['What is Love?', 'TWICE', 'What Is Love?', 2018],
  ['Dance The Night Away', 'TWICE', 'Summer Nights', 2018],
  ['YES or YES', 'TWICE', 'Yes or Yes', 2018],
  ['FANCY', 'TWICE', 'Fancy You', 2019],
  ['Feel Special', 'TWICE', 'Feel Special', 2019],
  ['MORE & MORE', 'TWICE', 'More & More', 2020],
  ["I Can't Stop Me", 'TWICE', 'Eyes Wide Open', 2020],
  ['Alcohol-Free', 'TWICE', 'Taste of Love', 2021],
  ['The Feels', 'TWICE', 'Formula of Love: O+T=<3', 2021],
  ['Scientist', 'TWICE', 'Formula of Love: O+T=<3', 2021],
  ['Talk that Talk', 'TWICE', 'Between 1&2', 2022],
  ['SET ME FREE', 'TWICE', 'Ready to Be', 2023],
  ['Strategy', 'TWICE', 'Strategy', 2024],
  ['POP!', 'NAYEON', 'Im Nayeon', 2022],
  ['ABCD', 'NAYEON', 'NA', 2024],
  // KPop Demon Hunters
  ['Golden', 'HUNTR/X', 'KPop Demon Hunters (Soundtrack)', 2025],
  ['How It\'s Done', 'HUNTR/X', 'KPop Demon Hunters (Soundtrack)', 2025],
  ['What It Sounds Like', 'HUNTR/X', 'KPop Demon Hunters (Soundtrack)', 2025],
  ['Takedown', 'Jeongyeon, Jihyo & Chaeyoung (TWICE)', 'KPop Demon Hunters (Soundtrack)', 2025],
  ['Soda Pop', 'Saja Boys', 'KPop Demon Hunters (Soundtrack)', 2025],
  ['Your Idol', 'Saja Boys', 'KPop Demon Hunters (Soundtrack)', 2025],
  ['Free', 'Rumi & Jinu', 'KPop Demon Hunters (Soundtrack)', 2025],
  // NewJeans
  ['Attention', 'NewJeans', 'New Jeans', 2022],
  ['Hype Boy', 'NewJeans', 'New Jeans', 2022],
  ['Cookie', 'NewJeans', 'New Jeans', 2022],
  ['Hurt', 'NewJeans', 'New Jeans', 2022],
  ['Ditto', 'NewJeans', 'OMG', 2022],
  ['OMG', 'NewJeans', 'OMG', 2023],
  ['Super Shy', 'NewJeans', 'Get Up', 2023],
  ['ETA', 'NewJeans', 'Get Up', 2023],
  ['Cool With You', 'NewJeans', 'Get Up', 2023],
  ['New Jeans', 'NewJeans', 'Get Up', 2023],
  ['How Sweet', 'NewJeans', 'How Sweet', 2024],
  ['Bubble Gum', 'NewJeans', 'How Sweet', 2024],
  ['Supernatural', 'NewJeans', 'Supernatural', 2024],
  // aespa
  ['Black Mamba', 'aespa', 'Black Mamba', 2020],
  ['Next Level', 'aespa', 'Next Level', 2021],
  ['Savage', 'aespa', 'Savage', 2021],
  ['Spicy', 'aespa', 'My World', 2023],
  ['Drama', 'aespa', 'Drama', 2023],
  ['Supernova', 'aespa', 'Armageddon', 2024],
  ['Armageddon', 'aespa', 'Armageddon', 2024],
  ['Whiplash', 'aespa', 'Whiplash', 2024],
  // IVE
  ['ELEVEN', 'IVE', 'Eleven', 2021],
  ['LOVE DIVE', 'IVE', 'Love Dive', 2022],
  ['After LIKE', 'IVE', 'After Like', 2022],
  ['Kitsch', 'IVE', "I've IVE", 2023],
  ['I AM', 'IVE', "I've IVE", 2023],
  ['Baddie', 'IVE', 'I\'ve Mine', 2023],
  // LE SSERAFIM
  ['FEARLESS', 'LE SSERAFIM', 'Fearless', 2022],
  ['ANTIFRAGILE', 'LE SSERAFIM', 'Antifragile', 2022],
  ['UNFORGIVEN', 'LE SSERAFIM ft. Nile Rodgers', 'Unforgiven', 2023],
  ['Perfect Night', 'LE SSERAFIM', 'Perfect Night', 2023],
  ['EASY', 'LE SSERAFIM', 'Easy', 2024],
  ['CRAZY', 'LE SSERAFIM', 'Crazy', 2024],
  // Stray Kids
  ["God's Menu", 'Stray Kids', 'Go Live', 2020],
  ['Back Door', 'Stray Kids', 'In Life', 2020],
  ['Thunderous', 'Stray Kids', 'Noeasy', 2021],
  ['MANIAC', 'Stray Kids', 'Oddinary', 2022],
  ['S-Class', 'Stray Kids', '5-Star', 2023],
  ['LALALALA', 'Stray Kids', 'Rock-Star', 2023],
  ['Chk Chk Boom', 'Stray Kids', 'ATE', 2024],
  ['Hellevator', 'Stray Kids', 'Mixtape', 2017],
  ['MIROH', 'Stray Kids', 'Clé 1: Miroh', 2019],
  ['CHEESE', 'Stray Kids', 'Noeasy', 2021],
  ['Red Lights', 'Bang Chan & Hyunjin (Stray Kids)', 'Noeasy', 2021],
  ['VENOM', 'Stray Kids', 'Oddinary', 2022],
  ['CASE 143', 'Stray Kids', 'Maxident', 2022],
  ["Surfin'", 'Lee Know, Changbin & Felix (Stray Kids)', 'Hop', 2024],
  ['Youth', 'Lee Know (Stray Kids)', 'SKZ-Player', null],
  // SEVENTEEN
  ['Very Nice', 'SEVENTEEN', 'Love & Letter Repackage', 2016],
  ["Don't Wanna Cry", 'SEVENTEEN', 'Al1', 2017],
  ['Hot', 'SEVENTEEN', 'Face the Sun', 2022],
  ['Super', 'SEVENTEEN', 'FML', 2023],
  ['God of Music', 'SEVENTEEN', 'Seventeenth Heaven', 2023],
  // ITZY
  ['Dalla Dalla', 'ITZY', 'It\'z Different', 2019],
  ['Icy', 'ITZY', "It'z Icy", 2019],
  ['Wannabe', 'ITZY', "It'z Me", 2020],
  ['Not Shy', 'ITZY', 'Not Shy', 2020],
  // (G)I-DLE
  ['Tomboy', '(G)I-DLE', 'I Never Die', 2022],
  ['Nxde', '(G)I-DLE', 'I Love', 2022],
  ['Queencard', '(G)I-DLE', 'I Feel', 2023],
  // Red Velvet
  ['Russian Roulette', 'Red Velvet', 'Russian Roulette', 2016],
  ['Red Flavor', 'Red Velvet', 'The Red Summer', 2017],
  ['Bad Boy', 'Red Velvet', 'The Perfect Red Velvet', 2018],
  ['Psycho', 'Red Velvet', "The ReVe Festival: Finale", 2019],
  // EXO
  ['Growl', 'EXO', 'XOXO', 2013],
  ['Call Me Baby', 'EXO', 'Exodus', 2015],
  ['Love Shot', 'EXO', 'Love Shot', 2018],
  // TXT & ENHYPEN
  ['0X1=LOVESONG', 'TOMORROW X TOGETHER', 'The Chaos Chapter: Freeze', 2021],
  ['Sugar Rush Ride', 'TOMORROW X TOGETHER', 'The Name Chapter: Temptation', 2023],
  ['Bite Me', 'ENHYPEN', 'Dark Blood', 2023],
  ['Drunk-Dazed', 'ENHYPEN', 'Border: Carnival', 2021],
  // NCT
  ['Cherry Bomb', 'NCT 127', 'Cherry Bomb', 2017],
  ['Kick It', 'NCT 127', 'Neo Zone', 2020],
  ['Candy', 'NCT DREAM', 'Candy', 2022],
  // Newer girl groups
  ['Magnetic', 'ILLIT', 'Super Real Me', 2024],
  ['Sheesh', 'BABYMONSTER', 'Babymons7er', 2024],
  ['Drip', 'BABYMONSTER', 'Drip', 2024],
  ['Cupid', 'FIFTY FIFTY', 'The Beginning: Cupid', 2023],
  // Classics
  ['Gangnam Style', 'PSY', 'Psy 6 (Six Rules), Part 1', 2012],
  ['Gee', "Girls' Generation", 'Gee', 2009],
  ['Fantastic Baby', 'BIGBANG', 'Alive', 2012],
  ['Bang Bang Bang', 'BIGBANG', 'Made', 2015],
  ['I Am the Best', '2NE1', '2NE1 2nd Mini Album', 2011],
  ['Any Song', 'ZICO', 'Random Box', 2020],
];

function slug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const seen = new Set();
export const KPOP_SONGS = [];
for (const [title, artist, album, year] of raw) {
  if (!title) continue;
  const id = `kpop:${slug(title)}--${slug(artist.split(/ ft\.| & |, /)[0])}`;
  if (seen.has(id)) continue;
  seen.add(id);
  KPOP_SONGS.push({ id, title, artist, album, year, category: 'kpop', artwork: null, audio: AUDIO_PLACEHOLDER });
}
