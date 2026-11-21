# Video tutorial

## Problem Statement

A tutorial video goes out on several platforms, and each platform shows a cover before anyone plays the video. Each platform asks for its own size, and Douyin's app draws its own bars over the top and the bottom of the cover. A cover that repeats the video's diagram or lists its chapters does not tell a viewer what the video found or why it is worth watching. The creator wants every cover to introduce the video's main point in a look shared by all their videos, and to see every cover before anything is published.

## Solution

For each platform the creator names, the `video-tutorial` skill renders that platform's covers from the video project. Every cover has the same frame: the canvas, a one-line title, the subtitle, and an area in which the video draws its own main visual from a small set of blocks the template offers. `pnpm stills` renders every cover and measures it, and the creator reviews the covers together with the video's other stills before the final confirmation.

## Functional Requirements

### video-tutorial::REQ-001 One cover per platform and ratio

The requirement list's row for the audience and the platforms names the platforms the video is published to.

- video-tutorial::REQ-001/AC-01: For each named platform, `pnpm stills` renders every cover the table gives that platform, saved as `out/<file>.png`. A platform that is not named gets no cover.

  | Platform | Ratio | Drawn at | Saved at | File |
  |---|---|---|---|---|
  | WeChat Channels (视频号) | 3:4 | 1080×1440 | 1080×1440 | `wechat-channels-3x4` |
  | WeChat Channels (视频号) | 4:3 | 1440×1080 | 1440×1080 | `wechat-channels-4x3` |
  | YouTube | 16:9 | 1920×1080 | 3840×2160 | `youtube-16x9` |
  | Douyin (抖音) | 9:16 | 1080×1920 | 1080×1920 | `douyin-9x16` |
  | Xiaohongshu (小红书) | 3:4 | 1080×1440 | 1080×1440 | `xiaohongshu-3x4` |

- video-tutorial::REQ-001/AC-02: The preview sent for the final confirmation and the files handed over at the end give the path of every cover from video-tutorial::REQ-001/AC-01.

### video-tutorial::REQ-002 The frame of every cover

The positions and sizes below are in pixels of the drawing size.

| Ratio | Title: top, largest size | Subtitle: top, size | Area: top to bottom |
|---|---|---|---|
| 3:4 | 56, 56 | 124, 36 | 214 to 1392 |
| 4:3 | 44, 50 | 104, 36 | 176 to 1032 |
| 16:9 | 44, 66 | 124, 40 | 206 to 1032 |
| 9:16 | 236, 56 | 304, 36 | 392 to 1540 |

- video-tutorial::REQ-002/AC-01: The title is the video's title on one line, 48 px from the left edge. It is drawn at the ratio's largest size when that line fits between the 48 px margins; otherwise at the largest size, in steps of 0.5 px, at which it fits. It never wraps and is never larger than the largest size. Each cover sizes its own title.
- video-tutorial::REQ-002/AC-02: The subtitle is the video's subtitle on one line, at the ratio's position and size.
- video-tutorial::REQ-002/AC-03: The area runs from 48 px on the left to 48 px from the right edge, between the ratio's top and bottom. The cover shows nothing else: no full diagram, no list of chapters and no banner.

### video-tutorial::REQ-003 Each video draws its own main visual

- video-tutorial::REQ-003/AC-01: A video's main visual is drawn inside the area, for each ratio its covers use, from the blocks of video-tutorial::REQ-005 only. Drawing it changes no file that `pnpm check` compares with the template.
- video-tutorial::REQ-003/AC-02: When those blocks cannot carry a video's main point, the skill stops and asks the creator. A new block or a new layout of the frame is a change of the default requirements and is shown as a prototype before it is made.
- video-tutorial::REQ-003/AC-03: A video's main visual gets no prototype of its own: the skill and the creator look at it in the covers `pnpm stills` renders, together with the other stills, before the final confirmation.
- video-tutorial::REQ-003/AC-04: The requirement list the creator agrees to before any work gives the covers' content: the title, the subtitle, and what the main visual shows, with its key figures and its before/after if it has one.

### video-tutorial::REQ-004 What a cover says

These are judged by looking at the rendered covers, by the skill before it sends the preview and by the creator before the final confirmation.

- video-tutorial::REQ-004/AC-01: The cover introduces the video's main point. Every statement on it is also made in the video, and every fact on it has a source, as the facts of the diagram and the script do.
- video-tutorial::REQ-004/AC-02: A block's main finding is written as that block's heading.
- video-tutorial::REQ-004/AC-03: No block says what another block on the same cover already says.
- video-tutorial::REQ-004/AC-04: When the video introduces a tool or a change in how people work, the cover shows what it replaces as a before/after with a headline result, and what belongs to one tool or plugin is grouped in one card named after it. A video that introduces neither has no before/after.
- video-tutorial::REQ-004/AC-05: When the video has figures to compare, they are laid out in a table read down its columns: each row named in plain words, with the original wording in small text under the name. Figures the video does not compare are not put in such a table. Every unit written on the cover is the unit of the figure it labels.
- video-tutorial::REQ-004/AC-06: A block that stands for something in the video (a tool, a plugin, a part of the system, a path) has that thing's colour in the video: the colour of its box, or of its path. Number tiles use colour only to tell one tile from another.

### video-tutorial::REQ-005 The blocks

- video-tutorial::REQ-005/AC-01: Card: rounded corners and a soft shadow, with no border and no strip or line along its top. Its header is a coloured dot, a small grey label and a bold heading under them. A card holds other blocks.
- video-tutorial::REQ-005/AC-02: Number tile: one figure per tile, on the light fill of the tile's hue. The figure is large and drawn in a two-colour gradient of its hue; its unit (亿, 次, 万, %) is at 58 % of the figure's size; an approximate figure is written with ≈ before it, at 70 % of the figure's size, and never with 约. A grey label under the figure says what it counts.
- video-tutorial::REQ-005/AC-03: Before/after: the name of what changed in its colour, then a 以前 row and a 现在 row. The 以前 tag has a grey fill and grey text, and its text is struck through. The 现在 tag has the block's colour. Under them, a headline result at 36 px, smaller than a number tile's 52 px figure, and the line explaining it in the ink colour, not in grey.
- video-tutorial::REQ-005/AC-04: Table read down its columns: one row per case, named in the first column; one column per part, headed by the part's coloured dot and name. A cell the case reaches has the light fill of its column's hue, or of the hue the cell is given, and its text in that hue's ink; a cell the case does not reach is grey and empty. A cell may have the deeper fill of its hue, to show a bigger value. All cells of a table are the same height.

## Quality Requirements

### video-tutorial::QR-001 Measured on every cover

Applies to: every cover `pnpm stills` renders. A failed measurement makes `pnpm stills` exit with a non-zero code and names the text or the block.

- video-tutorial::QR-001/AC-01: Text drawn in a gradient has a contrast of at least 4.5 at both ends of the gradient, each end against the opaque colour behind the text.
- video-tutorial::QR-001/AC-02: Every text and every block of the main visual lies inside the area of video-tutorial::REQ-002.
- video-tutorial::QR-001/AC-03: On the Douyin cover, no text and no block lies in the top 220 px or the bottom 380 px, which the Douyin app covers.

## Constraints

### video-tutorial::CON-001 Only the platforms of the table (direct acceptance)

Applies to: the list of platforms in a video project. `pnpm check` fails when the list is empty or names a platform that video-tutorial::REQ-001/AC-01 does not give.

## Failure modes and boundaries

- A platform the table does not give, or a platform whose upload page asks for another ratio or size than the table: its cover is a change of the default requirements, as in video-tutorial::REQ-003/AC-02.
- A title too long for its line at the ratio's largest size is drawn smaller, however small that makes it (video-tutorial::REQ-002/AC-01).
- A main visual taller or wider than the area fails video-tutorial::QR-001/AC-02.

## Implementation Decisions

A video project gives its covers in `src/data/cover.tsx`, beside the diagram and the script:

| Export | Type | Meaning |
|---|---|---|
| `PLATFORMS` | a list of `wechat-channels`, `youtube`, `douyin`, `xiaohongshu` | the platforms of video-tutorial::REQ-001/AC-01 |
| `CoverBody` | a component given the ratio (`3x4`, `4x3`, `16x9`, `9x16`) and the area's width and height | the main visual drawn inside the area |

A project made from an earlier template keeps the template files it was made from, and `pnpm check` compares it with those; its covers stay as they were.

## Out of Scope

- A diagram on the cover, even a simplified one: a cover introduces the main point, and a video whose point the blocks cannot carry is asked about (video-tutorial::REQ-003/AC-02).
- Moving existing video projects to these covers: each project keeps the template it was made from.

## Further Notes

- Only the covers of the `video-tutorial` skill are described in this spec.
- Platform sizes: YouTube from the YouTube Help Center; Douyin, its bars included, and Xiaohongshu from third-party guides, as neither platform has an official page that was found (2026-11-18); WeChat Channels not checked against an official page.
