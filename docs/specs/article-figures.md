# Article figures

## Problem Statement

An article needs figures that explain it: box-and-line diagrams for its structure, animated diagrams where the order of steps matters, and a cover. Drawn one by one, each article's figures get a different look, and the author has to remember the size each publishing platform wants. The author wants to agree on which figures to make before any drawing starts, and to see every figure before it goes into the article. The text inside the figures has to be English, even for a Chinese article.

## Solution

The `article-figures` skill reads an article and proposes a figure list. After the author agrees to it, the skill creates one figure project beside the article, from the skill's own Remotion template. It draws each figure as a diagram in `video-tutorial`'s look. It renders static figures as PNG files, animated figures as GIF files and the cover as a PNG file, and measures them against the `diagram-design` rules. It then shows the author a preview. Only after the author approves does it copy the files into the article's `assets/images/` directory, reporting for each figure the section it belongs to and a suggested alt text.

## User Stories

### article-figures::US-001 Agree on the figure list before drawing

As an author, I want the skill to read my article and propose which figures to make, so that I can change their number or content before the drawing work starts.

- article-figures::US-001/AC-01: Before it creates a project or draws anything, the skill sends a figure list. For each body figure, the list gives the article section it belongs to, whether it is static or animated, what it shows, its English title and its file name. For the cover, it gives the English title, the subtitle and the file name. The files are copied into the article under the names in the agreed list.
- article-figures::US-001/AC-02: The skill creates no project and draws nothing until the author agrees to the list.
- article-figures::US-001/AC-03: When the skill, rather than the author, wants to add a figure, remove one or change what one shows after the list was agreed, it sends the changed list and changes no drawing until the author agrees.

### article-figures::US-002 Approve a preview before the figures enter the article

As an author, I want to see every rendered figure before any of them is put into my article, so that changing a figure costs only a re-render and never a second round of the article's publishing.

- article-figures::US-002/AC-01: The preview gives the path of every rendered PNG and GIF file, the cover included, and the path of a still image of each measured GIF state. It gives each figure's `diagram-design` measurement results, and it names every rule that was not measured together with the reason.
- article-figures::US-002/AC-02: No file is copied into the article's `assets/images/` before the author approves the preview. A figure changed after the approval is shown in a new preview, and only that new preview's approval lets it be copied.
- article-figures::US-002/AC-03: After the approval, the skill copies the files into the article's `assets/images/` per article-figures::REQ-005. It then reports, for each figure, the file name, the section it belongs to, and a suggested alt text in the article's language: Chinese alt text for a Chinese article and English alt text for an English one.

### article-figures::US-003 Make a refused GIF smaller

As an author whose publishing platform refused a GIF, I want the skill to make that GIF smaller, so that it can be uploaded.

- article-figures::US-003/AC-01: When the author reports that a platform refused a GIF, the skill renders it again with a lower frame rate or a shorter pass. The width stays at 1080 px, and the new file goes through article-figures::US-002 before it is copied.

## Functional Requirements

### article-figures::REQ-001 One figure project per article, beside the article (direct acceptance)

An article's figure project is created in `<article directory>/assets/sources/figures/`, where the article directory is the directory holding the article's Markdown file. One project holds all of that article's figures and its cover. The project's installed packages, caches and rendered output are ignored by git inside that directory.

### article-figures::REQ-002 Static figures (direct acceptance)

A static figure is a PNG file 2160 px wide, whose height follows the proportions of its diagram.

### article-figures::REQ-003 Animated figures

- article-figures::REQ-003/AC-01: An animated figure is a GIF file 1080 px wide at 15 frames per second.
- article-figures::REQ-003/AC-02: The GIF loops forever, and one pass lasts at most 12 seconds.
- article-figures::REQ-003/AC-03: The diagram lights up step by step. Each step lights its own boxes and lines and dims the rest, and a dot travels along each line the step lights.
- article-figures::REQ-003/AC-04: Each step shows a step marker beside the line it lights. The markers of passed steps are hollow, and the current step's marker is solid.
- article-figures::REQ-003/AC-05: After the last step the whole diagram is lit and held for a moment before the next pass begins.
- article-figures::REQ-003/AC-06: Every frame shows the whole diagram; the view never zooms or pans.

### article-figures::REQ-004 Cover

- article-figures::REQ-004/AC-01: The cover is a PNG file, 1920 × 820 px.
- article-figures::REQ-004/AC-02: The cover holds the article's English title, a one-sentence English subtitle and a simple diagram of the article's subject, drawn as a design rather than an illustration.

### article-figures::REQ-005 Copying into the article keeps older files

- article-figures::REQ-005/AC-01: When `assets/images/` has no file with a figure's name, the figure is copied there under that name.
- article-figures::REQ-005/AC-02: When a file with that name exists and its content differs, the existing file is renamed to `<name>-v<n>.<extension>`, where `<n>` is the smallest positive whole number whose name is not taken. The new figure is then copied in under the original name, without asking the author. The report of article-figures::US-002/AC-03 lists every renamed file.
- article-figures::REQ-005/AC-03: When a file with that name exists and its content is identical, both the file and its name are left as they are.

## Quality Requirements

### article-figures::QR-001 Diagram rules on every rendered state

Applies to: every static figure, the cover, and every step state of every animated figure, including the fully lit hold.

- article-figures::QR-001/AC-01: Every rule of `diagram-design` ([skills/diagram-design/SKILL.md](../../skills/diagram-design/SKILL.md)) holds. Each number a rule's check needs is measured on the rendered output.
- article-figures::QR-001/AC-02: A figure that breaks a rule is fixed and rendered again before the preview. The preview is not sent while any measured check fails.

## Constraints

### article-figures::CON-001 English only (direct acceptance)

Applies to: all text inside the figures and the cover. Every piece of that text is English; no Chinese font is loaded.

### article-figures::CON-002 The look of video-tutorial (direct acceptance)

Applies to: every figure and the cover. They use `video-tutorial`'s daytime palette, its seven responsibility hues and three path tones, and the fonts IBM Plex Sans and IBM Plex Mono. Every figure but the cover carries `video-tutorial`'s legend of the hues and path tones it uses, `gray` excepted.

### article-figures::CON-003 Rendered with Remotion (direct acceptance)

Applies to: every figure and the cover. They are rendered with Remotion from the skill's own template.

### article-figures::CON-004 video-tutorial stays as it is (direct acceptance)

Applies to: the `video-tutorial` skill and its template. Adding `article-figures` changes neither; the two skills can be installed independently of each other.

### article-figures::CON-005 No knowledge of a publishing repository (direct acceptance)

Applies to: the skill's instructions and template. They name no particular manuscript repository or platform publisher. The article is known only by its Markdown file and directory.

## Failure modes and boundaries

- The `assets/sources/figures/` directory already holds a project made by this skill: the skill works in that project, so that a changed or smaller figure is rendered from the same sources.
- That project's packages did not finish installing, as when the network failed: making the project again installs them and changes none of its files.
- The `assets/sources/figures/` directory exists, is not empty and holds no project made by this skill: the skill writes nothing into it and asks the author what to do.
- A file with a figure's name already exists in `assets/images/`: article-figures::REQ-005 applies.
- Two names count as one when the folder takes them for one file. In a folder that ignores letter case, as macOS volumes do by default, `Cover.png` is an older file under the name `cover.png`, and `Cover-v1.png` takes the number 1 from `cover-v1.png`. In a case-sensitive folder they are different files.
- An entry under a figure's name that is not a plain file, such as a link or a folder, is kept like an older, different file under `<name>-v<n>.<extension>`.
- Copying a figure fails after the older file was renamed: the older file gets its name back, the figures copied before it stay, and nothing more is copied.
- The figure list changes after the last passed render, by a row added or removed or a kind or title changed: no file is copied until the figures are rendered again and a new preview approved.
- The figure list names a file twice: the figures are not rendered.
- A platform refuses a GIF: article-figures::US-003 applies.
- A shorter step makes the dot travel faster, so that it still reaches the end of its line within the step. A step or a hold too short for what it lights to come on fully, or for the dot to travel, is refused, and the GIF is not rendered.
- Text inside a figure is not English: the figure's check fails, and article-figures::QR-001/AC-02 applies to it as to a broken diagram rule.

## Implementation Decisions

- The figure list the author agreed to is kept as a Markdown file in the project directory. After a context compaction the skill works from that file, not from memory.
- The project's rendered output stays in an output directory inside the project until the preview is approved. Approval copies files out of it, and the project keeps its own copies.
- A render that passed every check leaves a record in the output directory: the content hash of each rendered file, and each figure's file name, kind and title. Copying reads only that record. It refuses when there is none, when a file no longer has its recorded hash, or when the figure list no longer matches the recorded figures.
- Every figure is drawn 720 design units wide, and a diagram is never scaled: a PNG is rendered at 3 times (2160 px) and a GIF at 1.5 times (1080 px), so text has the same size in every figure. A diagram's view is at most 672 units wide. The cover is the exception to all of this: it is 1920 × 820 px, rendered at 1 time, and its diagram is scaled to fit the panel on the right of the cover.
- The template's diagram code comes from `video-tutorial`'s template. It is adapted so that one project draws many diagrams and renders them to PNG and GIF.
- The fonts are subsets of IBM Plex Sans and IBM Plex Mono, fetched from Google Fonts for the characters the figures use. The request sends Google Fonts only the characters English uses, each once and in code order, and never the figures' text.

## Out of Scope

- Inserting the figures into the manuscript, and creating or updating a platform draft. These belong to the publishing workflow, so the skill does not depend on any manuscript repository's conventions.
- Narration, subtitles and video. `video-tutorial` makes videos.
- Text in any language other than English inside the figures.
- A night appearance. `diagram-design` requires the daytime one.

## Further Notes

- Remotion requires a company license for organizations that do not qualify for its free license.
