# media-studio

Agent skills for making app demos and explainer videos. The skill instructions are written in Chinese.

| Skill | What it does |
|---|---|
| [`app-demo-video`](skills/app-demo-video/SKILL.md) | Makes app introduction videos with scenario animation, real interactions, narration and subtitles. English by default, with a Chinese narration option. |
| [`video-tutorial`](skills/video-tutorial/SKILL.md) | Makes a video from an article or diagram, with Chinese narration, burned-in subtitles and two covers (3:4 and 4:3). |
| [`diagram-design`](skills/diagram-design/SKILL.md) | Rules for box-and-line diagrams: colours, step markers, lines and arrows. `video-tutorial` follows them. |

## Before you start

`app-demo-video` starts with a script for your review, designs the animation from that approved script, then generates narration. It uses Remotion for a 16:9 video with restrained motion, small subtitles and quiet background music. It includes production instructions and presets, not an executable project generator. Output locations and the project file layout are defined in the skill’s [storage section](skills/app-demo-video/SKILL.md#项目存放与文件结构).

English narration defaults to local Kokoro `am_puck` at speed 0.98. Chinese narration uses Qwen3-TTS with the previously selected local `tanya` reference in `~/.video-tutorial/voices/`. That alias is not a built-in voice and its recording and transcript are not included. On a machine without it, the skill asks for an approved reference or an explicit replacement instead of choosing another voice. Model identifiers, mix levels and timing defaults are in the [audio reference](skills/app-demo-video/references/audio.md).

This audio setup needs an Apple Silicon Mac, a compatible MLX Audio environment and local models. Video production also needs Node.js, pnpm, Remotion, ffmpeg and ffprobe. The skill checks the available environment before production; it does not install or alter the existing `video-tutorial` environment. Supply product access or recordings and a music track you can use. Publishing is a separate, explicitly requested action.

`video-tutorial` narrates in a voice you provide, so have a recording ready:

- One person speaking in a quiet room, with no music, between 3 and 30 seconds long, in any format `ffmpeg` can read.
- Your own voice, or one you have permission to use.

The skill asks where the recording is and what it says, then keeps a converted copy in `~/.video-tutorial/voices/`. The copy stays on your machine, updating the skills leaves it in place, and your original file is not changed. If you do not know what the recording says, Whisper writes it down and you check the result.

`video-tutorial` also needs:

- An Apple Silicon Mac. `install.sh` stops on anything else.
- `node`, `pnpm`, `ffmpeg` and `ffprobe`.
- `python3.12`, unless `~/.venv/mlx-tts` already exists.
- About 5.5 GB of disk space, plus roughly 1 GB for each video project.

`diagram-design` is only text and has no requirements.

## Install

This needs Node.js 22.20 or later. Run one of these commands. Each installs all three skills for every project and asks no questions. Keep `diagram-design` with `video-tutorial`, which calls it. `app-demo-video` is independent of those two skills.

For Claude Code only, with the files in `~/.claude/skills/`:

```sh
npx skills add aloong-planet/media-studio -g -a claude-code -y
```

For other agents that read `~/.agents/skills/`, with the files there. Claude Code does not read that folder. The original `video-tutorial` installation was tested with Claude Code:

```sh
npx skills add aloong-planet/media-studio -g -a universal -y
```

For both, with the files in `~/.agents/skills/` and links to them in `~/.claude/skills/`:

```sh
npx skills add aloong-planet/media-studio -g -a claude-code -a universal -y
```

Then ask Claude Code for an explainer video, or run `/video-tutorial`. It confirms the requirements with you before it starts, including which voice to use, and renders the mp4 only after you approve the preview.

For an app introduction, invoke `$app-demo-video` in Codex or `/app-demo-video` in Claude Code. The first deliverable is the script for review; narration and animation production follow approval. Ask for Chinese explicitly to change the default language. For an existing video, adaptation translates its final approved script with natural phrasing; changes to content or story order require separate approval and a source/translation comparison. Language versions use separate project directories. Chinese adaptation includes a shot-by-shot [localization checklist and verification](skills/app-demo-video/references/visuals.md#素材本地化清单), covering visible text, real app recordings, subtitles and covers as well as narration. Existing source-language projects remain unchanged.

To update or remove the skills:

```sh
npx skills update app-demo-video video-tutorial diagram-design -g
npx skills remove app-demo-video video-tutorial diagram-design -g -y
```

Removing the skills does not delete your voices, the Python environment or the models. To delete your voices, remove `~/.video-tutorial`.

## What `install.sh` adds

`video-tutorial` runs its `install.sh` for you. When everything is already in place, it finishes in seconds and changes nothing.

- **Python environment:** `~/.venv/mlx-tts`, about 0.6 GB, with the versions in `requirements.txt`. An environment that already exists is checked and never changed.
- **Models:** about 4.7 GB at fixed versions, in the Hugging Face cache and `~/.cache/mlx-tts`. Each downloaded file is checked against its SHA-256.

Downloads try `huggingface.co` first, then `hf-mirror.com` if that fails or writes no new data for 10 minutes. Set `HF_ENDPOINT` to use only that address. Running `install.sh` again keeps finished files, and an unfinished file starts over.

## What leaves your machine

Narration and transcription run locally, so the script is not sent to an online service. `pnpm fonts` sends Google Fonts only the set of characters used. `npx skills` sends anonymous usage data, including the repository and skill names; set `DISABLE_TELEMETRY=1` to turn that off.

## License

[MIT](LICENSE) covers this repository. The models and dependencies have their own licenses. Remotion, which renders the video, requires a company license for organizations that do not qualify for its free license.
