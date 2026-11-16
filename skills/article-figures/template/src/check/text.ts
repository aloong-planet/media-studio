// The characters English text in a figure uses: printable ASCII, Latin-1 signs such as · ° ×, typographic punctuation
// (dashes, curly quotes, ellipsis), arrows and mathematical operators. Of these, only the ones that IBM Plex Sans and
// IBM Plex Mono both have in each of their 400, 500 and 600 weights, as Google Fonts served them on 2026-11-17: each
// other one is missing from at least one of those fonts, where a fallback font would draw it.
const ENGLISH: Array<[number, number]> = [
  [0x20, 0x7e],
  [0xa0, 0xbf],
  [0xd7, 0xd7],
  [0xf7, 0xf7],
  [0x2013, 0x2014],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2020, 0x2022],
  [0x2026, 0x2026],
  [0x2030, 0x2030],
  [0x2032, 0x2033],
  [0x2039, 0x203a],
  [0x2044, 0x2044],
  [0x2190, 0x2199],
  [0x21a9, 0x21aa],
  [0x21b0, 0x21b3],
  [0x21b6, 0x21b7],
  [0x21ba, 0x21bb],
  [0x21c4, 0x21c4],
  [0x21c6, 0x21c6],
  [0x2202, 0x2202],
  [0x2206, 0x2206],
  [0x220f, 0x220f],
  [0x2211, 0x2212],
  [0x2215, 0x2215],
  [0x221a, 0x221a],
  [0x221e, 0x221e],
  [0x222b, 0x222b],
  [0x2248, 0x2248],
  [0x2260, 0x2260],
  [0x2264, 0x2265],
];

// Tabs and line breaks are left out of the check; every other character, spaces included, is checked.
export const nonEnglish = (text: string): boolean =>
  [...text.replace(/[\t\n\r]/g, '')].some((c) => {
    const code = c.codePointAt(0)!;
    return !ENGLISH.some(([lo, hi]) => code >= lo && code <= hi);
  });
