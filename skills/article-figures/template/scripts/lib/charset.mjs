// The characters the fonts are cut for, which is all that pnpm fonts sends to Google Fonts.
import {nonEnglish} from '../../src/check/text.ts';

// From the text of the sources: printable ASCII and every other character English uses that appears, each once and
// in code order. A character English does not use is never drawn, since pnpm render refuses it, so it is left out;
// the order hides the order the characters had in the text.
export function fontCharacters(text) {
  const chars = new Set([...text].filter((c) => c.codePointAt(0) >= 0x20 && !nonEnglish(c)));
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}
