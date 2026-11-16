// The characters English text in a figure uses: printable ASCII, Latin-1 signs such as · ° ×,
// typographic punctuation (dashes, curly quotes, ellipsis), arrows and mathematical operators.
const ENGLISH: Array<[number, number]> = [
  [0x20, 0x7e],
  [0xa0, 0xbf],
  [0xd7, 0xd7],
  [0xf7, 0xf7],
  [0x2010, 0x205e],
  [0x2190, 0x21ff],
  [0x2200, 0x22ff],
];

export const nonEnglish = (text: string): boolean =>
  [...text.replace(/\s/g, '')].some((c) => {
    const code = c.codePointAt(0)!;
    return !ENGLISH.some(([lo, hi]) => code >= lo && code <= hi);
  });
