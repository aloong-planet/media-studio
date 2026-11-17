// pnpm fonts must send Google Fonts nothing but what fontCharacters returns.

// Return printable ASCII and every other character from U+0020 up that appears in the text of the sources, each once
// and in code order, so what is sent does not keep the order the characters had in the text.
export function fontCharacters(text) {
  const chars = new Set([...text].filter((c) => c.codePointAt(0) >= 0x20));
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}
