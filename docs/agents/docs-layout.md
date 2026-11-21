# Documentation layout

Where this repository's documents live, which ones may be relied on, and which may not.

## Conclusions and process are two different things

**Conclusions** answer "what is true now" and may be relied on by any skill:

| Location | Question it answers | Maintained by |
|---|---|---|
| `docs/CONTEXT.md` | The exact meaning of each term, and which synonyms to avoid | `/domain-modeling` |
| `docs/adr/` | Why a decision was made and what was rejected | `/domain-modeling` |
| `docs/specs/<slug>.md` | The current behaviour of a feature, its settled boundaries, and what it explicitly does not do | `/to-spec` |
| `docs/prototypes/` | Design references for interfaces and state models | `/prototype` |
| `docs/retros/` | The causal chain of an incident | `/implement` |
| `docs/ops/` | This project's operations manuals (the actual values for signing, release and so on) | Defined per project |

**Process** answers "how it was done at the time":

| Location | Contents |
|---|---|
| `docs/.workings/<slug>/` | Local tickets, the Requirements alignment record, the feature checklist, and the delivery note of each delivery |

**`docs/.workings/` stays out of the repository (the repository's `.gitignore` ignores the whole directory). Its contents are kept, not deleted, but no skill may treat them as a reliable basis.** Which checkout to write them in when working in a worktree is covered by the global instruction section 「施工记录存储」. Read them only to answer "why was this done that way at the time"; never infer the current state from them. Where they conflict with a conclusion document, the conclusion document wins, **and the working record need not be corrected afterwards**: it should stay as it was. It is a hidden directory, so it takes no part in documentation publishing and is not matched by globs such as `docs/**/*.md`.

## Read these first when exploring

Before changing code or proposing a plan, read:

- The table of contents of `docs/CONTEXT.md`, then single entries for the terms you use (how to read it is in the global instruction section 「读项目词汇表 `CONTEXT.md`」). If `docs/CONTEXT-MAP.md` exists, use it to find the `CONTEXT.md` of the context relevant to the topic (format and inference rules are in `CONTEXT-FORMAT.md` of `/domain-modeling`)
- The ADRs in `docs/adr/` that relate to the area being changed; in a multi-context repository, also the `docs/adr/` under that context's directory

**When these files do not exist, continue silently.** Do not report them as missing and do not suggest creating them in advance: `/domain-modeling` creates them lazily when a term or decision is actually settled.

## Use the glossary's words

Wherever output mentions a domain concept (issue titles, proposals, assumptions, test names), **use the word defined in `CONTEXT.md`** and do not drift to a synonym its `_Avoid_` line lists.

A needed concept that is missing from the glossary is a signal: either the wording is being invented and the project does not use it (reconsider it), or an entry is really missing (note it for `/domain-modeling`).

## A conflict with an existing ADR must be stated

If output contradicts an ADR, **name it; do not override it silently**:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
