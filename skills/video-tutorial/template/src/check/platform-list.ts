// video-tutorial::CON-001, held by the tsc of pnpm check: each list below must stay a type error. Were the Platforms
// type to let one through, its @ts-expect-error would go unused, and tsc fails on that.
import type {Platforms} from '../ui/platforms';

// @ts-expect-error no platform
export const none: Platforms = [];
// @ts-expect-error a platform the table does not give
export const unknown: Platforms = ['bilibili'];
