# mirrorai

[![npm version](https://img.shields.io/npm/v/mirrorai.svg)](https://www.npmjs.com/package/mirrorai)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/mirrorai.svg)](https://nodejs.org)

Codebase-aware AI rules generator for existing projects. Analyzes your repository and produces an `AGENTS.md` grounded in the patterns that already exist — so AI assistants follow your conventions instead of inventing their own — plus per-pattern slash commands and optional plop scaffolding so high-frequency skeletons cost zero tokens.

Built for mature codebases, where the conventions live in the code but nowhere else: large repositories are sampled rather than read file-by-file, and when generations of style coexist, git history decides which one is canonical — superseded styles are reported, not averaged in. Language- and stack-agnostic: Vue / React frontends, Go or Node backends, Python pipelines, Rust CLIs, Flutter apps, or any codebase with discoverable patterns.

## Install

```bash
npx mirrorai install
```

Copies `mirror-init.md` into `.claude/commands/` (and `.cursor/commands/` when a `.cursor/` directory exists) as a slash command. Re-run after upgrading mirrorai to update it. Everything else is produced by the AI on first run.

For other tools, paste the contents of `.claude/commands/mirror-init.md` as a prompt into Copilot Chat, Windsurf, Cline, or any AI tool — the workflow is identical.

## Usage

### Initialize

Run `/mirror-init` in your AI tool. One question — whether to also generate a plopfile for zero-token local scaffolding — then the AI analyzes the project and writes:

| Artifact | Purpose |
|----------|---------|
| `AGENTS.md` | Canonical rules file — the [open standard](https://agents.md) read natively by Cursor, GitHub Copilot, Codex, Zed, and most AI tools |
| `CLAUDE.md` | One line importing `AGENTS.md` for Claude Code |
| `.claude/commands/<pattern>.md` | One slash command per high-value pattern |
| `plopfile.js` + `.mirrorai/templates/` | Local scaffolding via plop (opt-in) |

Rules content lives only in `AGENTS.md` — a single source of truth. Tools that still want their own rule file get a thin stub pointing at it, never a duplicate.

Everything is validated before it ships: every file path cited in `AGENTS.md` is checked to exist, and every plop generator passes a load check, trial run, output syntax check, and structural comparison against its seed file — broken generators are repaired or removed and reported.

<details>
<summary>Example — abridged <code>AGENTS.md</code> for a typical Express + Prisma API</summary>

```markdown
<!-- mirrorai:generated -->
# Project Conventions

## Stack
Node.js 22, TypeScript 5 (strict), Express 5, Prisma 6 (PostgreSQL), Vitest, Zod.

## Layout
- `src/routes/` — one router per resource, registered in `src/app.ts`
- `src/services/` — business logic; the only layer that touches Prisma
- `src/middleware/` — auth, validation, error handler
- `tests/` — mirrors src/, *.test.ts

## Core Abstractions
- `src/lib/db.ts` exports the singleton PrismaClient — never instantiate another
- `src/lib/http.ts` exports ok()/fail() response envelopes — never res.json() directly
- `src/middleware/validate.ts` wraps Zod schemas — all input validation goes through it

## Prohibited
- No Prisma calls outside `src/services/` (route handlers stay thin — see `src/routes/users.ts`)
- No `any` — the repo compiles with strict: true and noImplicitAny

## Patterns

### new-resource (12 instances)
- Trigger: "add a <noun> endpoint / resource / CRUD"
- Reference: `src/routes/users.ts` + `src/services/user.service.ts` + `tests/users.test.ts`
- Side effects: register the router in `src/app.ts`; add a Zod schema in `src/schemas/`
- Scaffold first: npx mirrorai new new-resource <name>
```

</details>

### Daily development

`AGENTS.md` contains a *Patterns* section with auto-apply rules. The AI matches your request to a pattern and follows it — reference file, constraints, side effects — without an explicit command.

### Local scaffolding (zero tokens)

```bash
npx plop --help                       # list available generators
npx mirrorai new <pattern> <name>     # scaffold the skeleton; the AI fills in business logic
```

### Keeping rules honest

Rules go stale as code evolves. `check` verifies — locally, zero tokens — that every path referenced in `AGENTS.md` and the generated slash commands still exists, and exits non-zero otherwise:

```bash
npx mirrorai check
```

Wire it into CI so a refactor that breaks the rules fails the build:

```yaml
- run: npx mirrorai check
```

When it fails, re-run `/mirror-init` to refresh the rules.

## How It Works

```
Detect language and framework from manifest files (package.json, go.mod, pyproject.toml, …)
   ↓
Scan business code; cluster files by unit type (sampled on large repositories)
   ↓
Qualify each cluster: ≥ 3 instances, ≥ 50 lines, ≥ 80% structural similarity → top 3–6 patterns
   (when styles coexist, git history picks the actively-maintained one as canonical)
   ↓
Emit:
   ├─ AGENTS.md + CLAUDE.md          — rules grounded in real code
   ├─ .claude/commands/<pattern>.md  — one slash command per pattern
   └─ plopfile + .hbs templates      — extracted from the canonical seed file (opt-in)
```

Analysis runs inside your AI tool on your existing subscription. No API key required.

## Re-Running

`/mirror-init` is idempotent. Every file it writes carries a first-line marker (`<!-- mirrorai:generated -->`), so on re-run it can tell its own files from user-authored ones (`[user-authored ⚠️]`) and offers:

- **a. Refresh everything** — regenerate all mirrorai-owned artifacts from a fresh analysis
- **b. Refresh selected patterns** — regenerate only the named patterns' slash commands and generators; rules files untouched
- **c. Start over** — re-ask the scaffolding question; remove artifacts no longer selected

User-authored files are never modified without an individual merge / overwrite / skip prompt.

## Requirements

- Node.js 20+ (for the CLI and plop)
- Any AI coding tool subscription (Claude Code, Cursor, Copilot, …)
- No language or framework requirements for the analyzed project

## Releasing

```bash
npm run release
```

`bumpp` prompts for the next version, then commits, tags, pushes, and publishes to npm.

## License

[MIT](./LICENSE)
