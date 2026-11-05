export type Point = [number, number];

// The straight pieces of a path made of M, L, H and V. An M starts a new piece: nothing is drawn across the jump.
// Anything else stops here: the camera and the layout checks only understand straight absolute lines.
export const pathSegments = (d: string): Array<[Point, Point]> => {
  if (/[^MLHV\d\s.,-]/.test(d)) throw new Error(`Path may use only M, L, H and V: ${d}`);
  const segments: Array<[Point, Point]> = [];
  let at: Point = [0, 0];
  for (const [, c, a, b] of d.matchAll(/([MLHV])\s*(-?[\d.]+)(?:[ ,]+(-?[\d.]+))?/g)) {
    const to: Point = c === 'H' ? [+a, at[1]] : c === 'V' ? [at[0], +a] : [+a, +b];
    if (c !== 'M') segments.push([at, to]);
    at = to;
  }
  return segments;
};
