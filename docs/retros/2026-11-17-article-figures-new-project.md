# article-figures' new-project.sh failed on its first real article

On 2026-11-17 the `article-figures` skill made its first figures project for a real article. That article sits inside a repository that is a pnpm workspace. `new-project.sh` failed there in two ways.

## What happened

1. **The script could not run.** It was committed with mode 100644. `SKILL.md` runs it by its path, which failed with `permission denied` (exit 126).
2. **The install went to the wrong place.** Once the script ran, its `pnpm install` installed the enclosing workspace: pnpm 9.12.3 printed `Scope: all 4 workspace projects`. The figures project got no packages, only the browser copy, and no `node_modules/.modules.yaml`. Yet the script printed `Ready` and exited 0. The repository's tracked files were left unchanged.

## Root causes

1. Nothing checked the file mode. Git records the mode the file has in the working tree when it is added, and the script was written as a plain file.
2. pnpm 9 installs the workspace it finds above the current folder, unless it is told `--ignore-workspace`. The script assumed that `pnpm install` acts on the folder it runs in, and checked nothing after the install.

## Why the checks did not catch it

- The process tests ran the script through `/bin/sh`, which runs a file whatever its mode.
- The stub `pnpm` in the tests created `node_modules` in the current folder whatever lay above it. It modelled the script's assumption, not pnpm.
- The tests and the evidence runs made their projects in temporary folders, none of them inside a pnpm workspace.

## Defences now in place

- The process tests run `new-project.sh` by its path, as `SKILL.md` does, so a script that is not executable fails every one of them.
- The stub `pnpm` installs an enclosing workspace unless told `--ignore-workspace`, as pnpm 9.12.3 did. A test puts the article inside such a workspace and checks that the project gets its packages and that nothing outside the article's `assets/` changes.
- `new-project.sh` installs with `pnpm install --ignore-workspace`, from the project's own lockfile. It stops with an error naming the project when the install leaves no `node_modules/.modules.yaml`, so it never reports a project without packages as ready.
