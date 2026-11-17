# Specs

Each file here describes one feature of this repository as it works now: what it does and does not do, the facts about outside systems it relies on, and the formats it writes. A spec is rewritten in place whenever the feature changes; its history is in git. When a feature is removed, its spec and its row below are deleted.

A requirement is identified as `<spec-slug>::<local id>`, for example `article-figures::US-001/AC-01`, where the slug is the spec's file name without `.md`. A spec does not refer to tickets, branches or working records, which are cleared away; it gives dates where a time matters, and refers to other specs and decisions by their identifiers.

| Spec | In one line |
|---|---|
| [Article figures](article-figures.md) | Draws an article's diagrams, animated diagrams and cover in English, shows a preview, and copies the approved files into the article. |
