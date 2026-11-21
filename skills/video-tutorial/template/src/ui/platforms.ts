// The covers each platform gets, the frame of each ratio, and where a cover may draw. Sizes are the drawing's pixels.
// No imports, so scripts/stills.mjs and scripts/*.test.mjs can load it as it is.
export type Ratio = '3x4' | '4x3' | '16x9' | '9x16';
export type Cover = {file: string; ratio: Ratio; scale: number; bars?: readonly [number, number]};

// scale: how many times the drawing's size the saved file is. bars: how many pixels the platform's app covers at the top and the bottom.
export const PLATFORM_COVERS = {
  'wechat-channels': [
    {file: 'wechat-channels-3x4', ratio: '3x4', scale: 1},
    {file: 'wechat-channels-4x3', ratio: '4x3', scale: 1},
  ],
  youtube: [{file: 'youtube-16x9', ratio: '16x9', scale: 2}],
  douyin: [{file: 'douyin-9x16', ratio: '9x16', scale: 1, bars: [220, 380]}],
  xiaohongshu: [{file: 'xiaohongshu-3x4', ratio: '3x4', scale: 1}],
} as const satisfies Record<string, readonly Cover[]>;
export type Platform = keyof typeof PLATFORM_COVERS;
// At least one platform: an empty list fails tsc, and so does a platform the table does not give.
export type Platforms = readonly [Platform, ...Platform[]];

export type Frame = {
  width: number;
  height: number;
  title: {top: number; size: number}; // size is the largest; a long title is drawn smaller
  subtitle: {top: number; size: number};
  area: {top: number; bottom: number}; // the main visual's, MARGIN from the left and from the right edge
};
export const MARGIN = 48;
export const FRAMES: Record<Ratio, Frame> = {
  '3x4': {width: 1080, height: 1440, title: {top: 56, size: 56}, subtitle: {top: 124, size: 36}, area: {top: 214, bottom: 1392}},
  '4x3': {width: 1440, height: 1080, title: {top: 44, size: 50}, subtitle: {top: 104, size: 36}, area: {top: 176, bottom: 1032}},
  '16x9': {width: 1920, height: 1080, title: {top: 44, size: 66}, subtitle: {top: 124, size: 40}, area: {top: 206, bottom: 1032}},
  '9x16': {width: 1080, height: 1920, title: {top: 236, size: 56}, subtitle: {top: 304, size: 36}, area: {top: 392, bottom: 1540}},
};

// What src/data/cover.tsx's CoverBody is given: the cover's ratio and the size of the area it draws in.
export type CoverBodyProps = {ratio: Ratio; width: number; height: number};

export const coversFor = (platforms: Platforms): Cover[] => [...new Set(platforms)].flatMap<Cover>((p) => PLATFORM_COVERS[p]);

// The largest size, in steps of half a pixel and never above the largest, at which the title's width fits the room.
// The first guess scales the size by how far the line runs over; the steps after it measure again.
export const fitTitle = (largest: number, room: number, widthAt: (size: number) => number): number => {
  let size = Math.min(largest, Math.floor(((largest * room) / widthAt(largest)) * 2) / 2);
  while (size > 0.5 && widthAt(size) > room) size -= 0.5;
  while (size + 0.5 <= largest && widthAt(size + 0.5) <= room) size += 0.5;
  return size;
};

type Rect = {x: number; y: number; w: number; h: number};
// One text or block of a cover, named for the report; inArea is true for the main visual's.
export type Placed = {what: string; rect: Rect; inArea: boolean};

export const placementProblems = (cover: Cover, items: Placed[]): string[] => {
  const {width, height, area} = FRAMES[cover.ratio];
  const bars = cover.bars;
  return items.flatMap(({what, rect: r, inArea}) => [
    ...(inArea && (r.x < MARGIN || r.x + r.w > width - MARGIN || r.y < area.top || r.y + r.h > area.bottom) ? [`outside the main visual's area: ${what}`] : []),
    ...(bars && r.y < bars[0] ? [`under the app's top ${bars[0]} px: ${what}`] : []),
    ...(bars && r.y + r.h > height - bars[1] ? [`under the app's bottom ${bars[1]} px: ${what}`] : []),
  ]);
};
