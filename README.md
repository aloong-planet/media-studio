# media-studio

Claude Code skills for making explainer videos. The skill instructions are written in Chinese.

| Skill | What it does |
|---|---|
| [`video-tutorial`](skills/video-tutorial/SKILL.md) | Makes a video from an article or diagram, with Chinese narration, burned-in subtitles and two covers (3:4 and 4:3). |
| [`diagram-design`](skills/diagram-design/SKILL.md) | Rules for box-and-line diagrams: colours, step markers, lines and arrows. `video-tutorial` follows them. |

## Before you start

`video-tutorial` narrates in a voice you provide, so have a recording ready:

- One person speaking in a quiet room, with no music, between 3 and 30 seconds long, in any format `ffmpeg` can read.
- Your own voice, or one you have permission to use.

The skill asks where the recording is and what it says, then keeps a converted copy in `skills/video-tutorial/voices/`. Git ignores that folder, so the copy stays on your machine, and your original file is not changed. If you do not know what the recording says, Whisper writes it down and you check the result.

`video-tutorial` also needs:

- An Apple Silicon Mac. `install.sh` stops on anything else.
- `node`, `pnpm`, `ffmpeg` and `ffprobe`.
- `python3.12`, unless `~/.venv/mlx-tts` already exists.
- About 5.5 GB of disk space, plus roughly 1 GB for each video project.

`diagram-design` is only text and has no requirements.

## Install

```sh
git clone https://github.com/aloong-planet/media-studio.git ~/media-studio
mkdir -p ~/.claude/skills
ln -s ~/media-studio/skills/video-tutorial ~/.claude/skills/video-tutorial
ln -s ~/media-studio/skills/diagram-design ~/.claude/skills/diagram-design
```

Then ask Claude Code for an explainer video, or run `/video-tutorial`. It confirms the requirements with you before it starts, including which voice to use, and renders the mp4 only after you approve the preview.

## What `install.sh` adds

The skill runs `install.sh` for you. When everything is already in place, it finishes in seconds and changes nothing.

- **Python environment:** `~/.venv/mlx-tts`, about 0.6 GB, with the versions in `requirements.txt`. An environment that already exists is checked and never changed.
- **Models:** about 4.7 GB at fixed versions, in the Hugging Face cache and `~/.cache/mlx-tts`. Each downloaded file is checked against its SHA-256.

Downloads try `huggingface.co` first, then `hf-mirror.com` if that fails or writes no new data for 10 minutes. Set `HF_ENDPOINT` to use only that address. Running `install.sh` again keeps finished files, and an unfinished file starts over.

## What leaves your machine

Narration and transcription run locally, so the script is not sent to an online service. `pnpm fonts` sends Google Fonts only the set of characters used.

## License

[MIT](LICENSE) covers this repository. The models and dependencies have their own licenses. Remotion, which renders the video, requires a company license for organizations that do not qualify for its free license.
