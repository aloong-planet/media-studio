# Issue tracker: GitHub

This repository's tickets are GitHub Issues.

**Every `gh` operation follows issues.md of `/github-ops` (「Issue 操作」)**: the command forms, when to use `-R`, the heredoc form for multi-line bodies and the recipes for fetching data are all there, **and are not repeated here**, so that the two cannot drift apart.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

`gh issue view <n> --comments` (with `-R` when not inside a clone of this repository).

## The label for tickets an agent may take

`ready-for-agent`.

Tickets cut by `/to-tickets` get this label by default: by construction, an unattended agent can pick them up. If this repository's tracker already uses another string (such as `agent-ready`), change this line to the one in use; skills follow it and do not create a duplicate label.
