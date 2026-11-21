// Colour arithmetic for the checks. No imports, so scripts/*.test.mjs can load it as it is.
export type Rgb = [number, number, number];

// A computed colour, as the browser writes it: rgb or rgba with numbers.
export const parse = (c: string): {rgb: Rgb; a: number} => {
  const m = (c.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number);
  return {rgb: [m[0], m[1], m[2]], a: m.length > 3 ? m[3] : 1};
};

export const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (p: Rgb, q: Rgb) => {
  const [hi, lo] = [luminance(p), luminance(q)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

// What the eye gets: text drawn at some opacity over its background.
export const blend = (fg: Rgb, bg: Rgb, a: number): Rgb => [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];

// Every colour of a computed background-image, in order: for a gradient, its stops from the first to the last.
export const gradientStops = (image: string): Rgb[] => [...image.matchAll(/rgba?\([^)]*\)/g)].map((m) => parse(m[0]).rgb);
