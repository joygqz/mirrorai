# mirrorai

[![npm version](https://img.shields.io/npm/v/mirrorai.svg)](https://www.npmjs.com/package/mirrorai)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/mirrorai.svg)](https://nodejs.org)

Codebase-aware AI rules generator. Analyzes your repository and produces `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, GitHub Copilot instructions, and Cline rules grounded in the patterns that already exist — so AI assistants follow your conventions instead of inventing their own, and so high-frequency scaffolds can be generated locally with zero tokens.

Language- and stack-agnostic: applies equally to Vue / React frontends, Go or Node backends, Python pipelines, Rust CLIs, Flutter apps, or any codebase with discoverable patterns.

## Install

```bash
npx mirrorai install
```

Copies `mirror-init.md` into `.claude/commands/` as a Claude Code slash command. The rule files, slash commands, plopfile, and templates are produced by the AI on first run.

If you don't use Claude Code, paste the contents of `.claude/commands/mirror-init.md` as a prompt into Cursor, Windsurf, Copilot Chat, Cline, or any other AI tool — the workflow is identical.

## Usage

### Initialize

Run `/mirror-init` in your AI tool. You'll be asked:

- Which AI tools to target (Claude Code, Cursor, Windsurf, Copilot, Cline — multi-select)
- Whether to also emit a `plopfile` and Handlebars templates for local scaffolding

The AI analyzes the project, writes the selected rule files, generates one slash command per high-value pattern (Claude Code), and validates every plop generator (syntax check, load check, trial-run, semantic comparison against the seed file). Broken generators are auto-repaired or removed and reported.

### Daily development

The generated `CLAUDE.md` (and equivalent files for other tools) contains an *Auto-Execute Rules* section. The AI matches your request to a pattern and applies it without an explicit command.

### Local scaffolding (zero tokens)

```bash
npx plop --help                       # list available generators
npx mirrorai new <pattern> <name>     # scaffold the skeleton; the AI fills in business logic
```

## How It Works

```
Detect language and framework from manifest files (package.json, go.mod, pyproject.toml, ...)
   ↓
Scan business code; cluster files by unit type
   ↓
Score each cluster: ≥ 3 instances, ≥ 50 lines, ≥ 80% structural similarity
   ↓
Emit up to four artifact types based on your selections:
   ├─ Rule files       — CLAUDE.md / .cursorrules / .windsurfrules / ...   (per tool selection)
   ├─ Slash commands   — .claude/commands/<pattern>.md, one per pattern    (Claude Code)
   ├─ plopfile         — one generator per pattern                         (opt-in)
   └─ Templates        — .hbs files extracted from the canonical seed      (opt-in, any output language)
```

Analysis runs inside your AI tool on your existing subscription. No API key is required.

## Supported AI Tools

| Tool           | Generated file(s)                          |
|----------------|--------------------------------------------|
| Claude Code    | `CLAUDE.md` + `.claude/commands/*.md`      |
| Cursor         | `.cursorrules`                             |
| Windsurf       | `.windsurfrules`                           |
| GitHub Copilot | `.github/copilot-instructions.md`          |
| Cline          | `.clinerules`                              |

## Re-Running

`/mirror-init` is idempotent. On re-run it detects existing files, marks each as `[mirrorai]` or `[user-authored ⚠️]` by checking for the marker comment on the first line, lists the previously matched patterns, and offers three actions:

- **a. Regenerate everything** — re-asks tool selection; deselected tools have their mirrorai-generated files removed.
- **b. Refresh existing files** — regenerates every detected file in place; tool selection unchanged.
- **c. Regenerate specific patterns** — enter pattern names (e.g. `new-resource,new-job`). Only the listed patterns' slash commands and plop generators (plus their `.mirrorai/templates/<pattern>/`) are rewritten. Rule files are not touched — use option b for that.

Any user-authored file in the write set gets an individual merge / overwrite / skip prompt before it is modified.

## Requirements

- Node.js 18+ (for the CLI and plop)
- A subscription to at least one of: Claude Code, Cursor, Windsurf, Copilot, Cline
- No language or framework requirements for the analyzed project

## Releasing

```bash
npm run release
```

`bumpp` prompts for the next version, then commits, tags, pushes, and publishes to npm.

## License

[MIT](./LICENSE)
