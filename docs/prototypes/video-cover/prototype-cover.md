# video-tutorial cover

## Question

Which parts of a video-tutorial cover does the template fix, and which does each video draw itself?

The template fixes the canvas for each platform, the title and subtitle, the area each video draws in, and the blocks it draws with: number tiles, cards (coloured dot, small label, bold heading), before/after blocks, and tables read down their columns. The title shrinks on each cover only as far as it must to stay on one line between the 48 px margins. Each video draws its own main visual inside the area, from those blocks.

Two example videos show the same frame with main visuals of different shapes: compact-timing (headline figures, a comparison table, a tool's before and after) and super-agent (an architecture video with no tool and no headline figures). Text widths on this page come from system fonts; the template's fonts are wider, so titles on the real covers come out smaller.

## Structure basis

- Direction confirmed by the owner: the template supplies the frame and the blocks; each video draws its own main visual.
- The compact-timing example and the look of every block: the compact-timing cover the owner confirmed.
- Platforms and sizes: WeChat Channels 3:4 (1080×1440) and 4:3 (1440×1080); YouTube 16:9, drawn at 1920×1080 and saved at 3840×2160; Douyin 9:16 (1080×1920), with nothing in the top 220 or bottom 380 pixels that the app covers; Xiaohongshu 3:4, laid out as WeChat Channels 3:4.
- The super-agent example is not a design to implement: it shows the frame holding a main visual of another shape. Its colours follow the skill's colour table by responsibility (程序层 teal, Router amber, Worker green, Watchdog violet); its facts come from that video's script and diagram.

## Demo scaffolding

Not part of the design; do not implement:

- The demo bar's "Example video" group (compact-timing, super-agent, Template parts only). In the product each video's covers show that video's own content.
- In "Template parts only", the dashed area with its label and Douyin's hatched bars: they mark what the template fixes and what the app covers.
- The size labels above the covers.
