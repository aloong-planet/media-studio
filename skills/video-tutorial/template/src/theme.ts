// Daytime only: there is deliberately no dark set. Every colour in the video and on the covers comes from here.
export const C = {
  bg: '#EFF2F5',
  panel: '#FBFCFD',
  band: '#E3E8EE',
  ink: '#131B24',
  muted: '#535F6C',
  line: '#C3CCD5',
  edge: '#6E7A87',
  onHue: '#FFFFFF',
} as const;

// One family per responsibility in the diagram. inner fills a box nested inside another of the same hue.
export const HUES = {
  blue: {fill: '#EDF4FE', line: '#7FA8E6', ink: '#174A97', lit: '#CFE1FB', inner: '#FFFFFF'},
  teal: {fill: '#E6F6F6', line: '#57B5BD', ink: '#005F6B', lit: '#BFE8EA', inner: '#FFFFFF'},
  amber: {fill: '#FEF3E2', line: '#DFA355', ink: '#8A4500', lit: '#FADFB4', inner: '#FFFDF9'},
  green: {fill: '#EAF7EE', line: '#74BE8F', ink: '#17653A', lit: '#C6EBD2', inner: '#FFFFFF'},
  violet: {fill: '#F3EEFD', line: '#A78FE3', ink: '#5330A8', lit: '#E2D7FA', inner: '#FFFFFF'},
  pink: {fill: '#FDEEF4', line: '#E08FB0', ink: '#9C1F54', lit: '#F8D0E0', inner: '#FFFFFF'},
  gray: {fill: '#F1F3F5', line: '#C3CCD5', ink: '#535F6C', lit: '#D9E4EC', inner: '#F1F3F5'},
} as const;
export type Hue = keyof typeof HUES;

// Named paths through the diagram. Lines without a tone are drawn in C.edge, then C.ink once lit.
export const TONES = {ink: C.ink, teal: '#007A87', orange: '#B35900', violet: '#6A3FC9'} as const;
export type Tone = keyof typeof TONES;

// One thing that recurs across boxes, such as a topic in a table and on the cards that handle it.
export const ACCENTS = {blue: '#1857C2', magenta: '#B81E72', olive: '#5C5F00'} as const;

export const SANS = '"IBM Plex Sans","Noto Sans SC","PingFang SC",sans-serif';
export const MONO = '"IBM Plex Mono","Noto Sans SC","PingFang SC",monospace';
export const DISPLAY = '"Noto Serif SC","Songti SC",serif';
