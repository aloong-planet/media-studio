import type {Box} from '../map/geometry';

// Every figure is drawn 720 wide and rendered larger: a PNG at 3 times (2160 pixels), a GIF at 1.5 times (1080 pixels).
// The diagram is drawn at its own units, never scaled, so its text is the same size in every figure.
export const DESIGN_WIDTH = 720;
export const MARGIN = 24;
export const TITLE = {size: 20, line: 26};
export const SUBTITLE = {size: 13, line: 18, gap: 4};
const BELOW_HEADING = 20;

export function figureLayout(id: string, view: Box, subtitle?: string) {
  const [, , w, h] = view;
  const room = DESIGN_WIDTH - 2 * MARGIN;
  if (w > room) throw new Error(`${id}: the diagram's view is ${w} wide; a figure has room for ${room}`);
  const subtitleTop = MARGIN + TITLE.line + SUBTITLE.gap;
  const top = (subtitle ? subtitleTop + SUBTITLE.line : MARGIN + TITLE.line) + BELOW_HEADING;
  // Even, so that the GIF's 1.5 times is a whole number of pixels.
  const height = Math.ceil((top + h + MARGIN) / 2) * 2;
  return {width: DESIGN_WIDTH, height, subtitleTop, diagram: {left: (DESIGN_WIDTH - w) / 2, top, width: w, height: h}};
}

export const COVER = {width: 1920, height: 820};
