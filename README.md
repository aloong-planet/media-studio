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

The skill asks where the recording is and what it says, then keeps a converted copy in `~/.video-tutorial/voices/`. The copy stays on your machine, updating the skills leaves it in place, and your original file is not changed. If you do not know what the recording says, Whisper writes it down and you check the result.

`video-tutorial` also needs:

- An Apple Silicon Mac. `install.sh` stops on anything else.
- `node`, `pnpm`, `ffmpeg` and `ffprobe`.
- `python3.12`, unless `~/.venv/mlx-tts` already exists.
- About 5.5 GB of disk space, plus roughly 1 GB for each video project.

`diagram-design` is only text and has no requirements.

## Install

This needs Node.js 22.20 or later. It installs both skills for Claude Code in every project. Keep both, because `video-tutorial` calls `diagram-design`.

```sh
npx skills add aloong-planet/media-studio -g -a claude-code --skill '*' -y
```

Then ask Claude Code for an explainer video, or run `/video-tutorial`. It confirms the requirements with you before it starts, including which voice to use, and renders the mp4 only after you approve the preview.

To update or remove the skills:

```sh
npx skills update video-tutorial diagram-design -g
npx skills remove video-tutorial diagram-design -g -y
```

Removing the skills does not delete your voices, the Python environment or the models. To delete your voices, remove `~/.video-tutorial`.

## What `install.sh` adds

The skill runs `install.sh` for you. When everything is already in place, it finishes in seconds and changes nothing.

- **Python environment:** `~/.venv/mlx-tts`, about 0.6 GB, with the versions in `requirements.txt`. An environment that already exists is checked and never changed.
- **Models:** about 4.7 GB at fixed versions, in the Hugging Face cache and `~/.cache/mlx-tts`. Each downloaded file is checked against its SHA-256.

Downloads try `huggingface.co` first, then `hf-mirror.com` if that fails or writes no new data for 10 minutes. Set `HF_ENDPOINT` to use only that address. Running `install.sh` again keeps finished files, and an unfinished file starts over.

## What leaves your machine

Narration and transcription run locally, so the script is not sent to an online service. `pnpm fonts` sends Google Fonts only the set of characters used. `npx skills` sends anonymous usage data, including the repository and skill names; set `DISABLE_TELEMETRY=1` to turn that off.

## License

[MIT](LICENSE) covers this repository. The models and dependencies have their own licenses. Remotion, which renders the video, requires a company license for organizations that do not qualify for its free license.
