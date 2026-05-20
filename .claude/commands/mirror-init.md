# mirror-init

You are a project conventions analyst. Analyze the current project (**any language, any stack**) and generate AI coding rules and scaffolding configuration tailored to it, so future AI development strictly follows the project's real style and consumes far fewer tokens.

**Execution order**: Step 0 (intent) → Step 1 (analyze + score patterns) → Step 2 (rule files) → Step 3 (slash commands, Claude Code only) → Step 4 (plopfile + validation, opt-in) → Step 5 (report). Each step's output feeds the next — do not skip ahead.

---

## Step 0 — Detect Existing Files and Confirm User Intent

**Before any analysis**, do two things:

### 0.1 Detect whether the following files already exist
- `CLAUDE.md`
- `.cursorrules`
- `.windsurfrules`
- `.github/copilot-instructions.md`
- `.clinerules`
- `.claude/commands/*.md` — scan the directory and list every `.md` file present (these may be mirrorai-generated slash commands or user-authored commands)
- `plopfile.js` / `plopfile.mjs` / `plopfile.cjs`
- `.mirrorai/templates/`

### 0.2 Branch on detection result

**First run (none of the above exist):**

Ask the user which AI tools to target:

```
Which AI coding tools do you use? (multi-select, comma-separated)

1. Claude Code    → CLAUDE.md + .claude/commands/
2. Cursor         → .cursorrules
3. Windsurf       → .windsurfrules
4. GitHub Copilot → .github/copilot-instructions.md
5. Cline          → .clinerules

Also generate a plopfile and skeleton templates for zero-token local scaffolding? (y/n)
```

**Re-run (some or all of the above exist):**

**Marker check** — Before showing any options, check every detected file for the mirrorai marker and annotate the list accordingly:

- `CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/commands/*.md` → marker is `<!-- mirrorai:generated -->` on the first line
- `.cursorrules`, `.windsurfrules`, `.clinerules` → marker is `# mirrorai:generated` on the first line

Any file missing its marker is user-authored — annotate it `[user-authored ⚠️]` so the user sees which files mirrorai has never touched before choosing an action.

**Pattern enumeration** — Before showing options, derive the list of previously matched patterns from the detected artifacts. The union of these sources is the canonical pattern list:

- Every `.claude/commands/*.md` file with the mirrorai marker, excluding `mirror-init.md` — the filename stem is the pattern name (e.g. `new-resource.md` → `new-resource`)
- Every `plop.setGenerator('<pattern>', …)` call inside `plopfile.*` — the first argument is the pattern name

If neither source exists or both are empty, the pattern list is empty and option c is unavailable.

List the detected files and ask:

```
The following files already exist:
- [list what was actually detected, e.g.:]
  1. CLAUDE.md                              [mirrorai]
  2. .cursorrules                           [user-authored ⚠️]
  3. .claude/commands/new-resource.md       [mirrorai]
  4. .claude/commands/new-job.md            [mirrorai]
  5. plopfile.js                            [mirrorai]

Previously matched patterns:
  - new-resource
  - new-job

Choose an action (default: a):
a. Regenerate everything — re-run tool selection (same prompt as first run, allows adding new tools)
b. Refresh existing files only — regenerate all detected files, no new tools added
c. Select specific pattern(s) to regenerate  → enter pattern names, e.g. "new-resource" or "new-resource,new-job"
```

If the pattern list is empty, do not display option c; only offer a and b.

**For option a**: Ask the same tool-selection and plopfile opt-in questions as a first run (Step 0 "First run" branch). This allows adding new tools or removing ones no longer needed. After the user confirms their new selection, compare it against the previously detected files:
- For any tool that was deselected: delete its mirrorai-generated rule file and its mirrorai-generated slash command files (identified by the marker). Do not delete user-authored files; prompt m/o/s for those instead.
- If the user answered "n" to the plopfile opt-in but a `plopfile.*` was previously detected: delete `plopfile.*` and the `.mirrorai/templates/` directory. Prompt before deleting if either is user-authored (no marker).

**For option b**: Regenerate all currently detected files. Plopfile and templates are included if `plopfile.*` was detected. No new tools are added.

**For option c**: After the user enters their selection, confirm back:

```
You selected patterns:
  - new-resource
  - new-job

For each selected pattern, the following artifacts will be regenerated:
  - .claude/commands/<pattern>.md  (if Claude Code rule files exist)
  - plopfile generator + .mirrorai/templates/<pattern>/  (if plopfile exists)

Proceed? (y/n)
```

When specific patterns are selected:
- Re-analyze the project (Step 1) in full — the analysis is always needed to produce accurate output
- In Step 1.6, restrict the high-value patterns to **only the selected pattern names**; do not introduce new patterns and do not regenerate patterns the user did not select
- In Step 2, **skip rule file generation entirely** — general rule files (`CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`, `.clinerules`) are not touched by option c. If the user wants to refresh rule files too, direct them to option b
- In Step 3, write only the slash command files for the selected patterns; leave all other `.claude/commands/*.md` files untouched
- In Step 4, regenerate the plopfile and templates **only if `plopfile.*` was detected**. When regenerating: preserve all existing generator entries for patterns that were not selected, and rewrite only the selected patterns' generator entries plus their `.mirrorai/templates/<pattern>/` directories. Run the full validation suite (4.4.1 through 4.4.6) against the selected patterns' generators only

**User-authored file handling** — applies only to files that *will be written* (determined by the action chosen above). For each such file that is user-authored (no mirrorai marker), prompt individually:

```
<filename> exists but wasn't generated by mirrorai.
- m. Merge: keep your content and append mirrorai's sections
- o. Overwrite: replace with newly generated content
- s. Skip this file
```

Record each per-file decision and honor them strictly throughout the run.

---

## Step 1 — Analyze the Project (Language-Agnostic)

### 1.1 Identify project type and stack

**First identify the primary language and ecosystem** from the manifest files in the project root:

| Manifest file | Language / ecosystem |
|---------------|----------------------|
| `package.json` | JavaScript / TypeScript / Node.js |
| `pyproject.toml` / `requirements.txt` / `setup.py` / `Pipfile` | Python |
| `go.mod` | Go |
| `Cargo.toml` | Rust |
| `pom.xml` / `build.gradle` / `build.gradle.kts` | Java / Kotlin / JVM |
| `composer.json` | PHP |
| `Gemfile` | Ruby |
| `*.csproj` / `*.sln` | C# / .NET |
| `Package.swift` / `Podfile` / `*.xcodeproj` | Swift / iOS |
| `pubspec.yaml` | Dart / Flutter |
| `mix.exs` | Elixir |
| `deno.json` / `deno.jsonc` | Deno |
| `bun.lockb` | Bun |

**Monorepo / polyglot projects**: if multiple manifests are detected (e.g. `package.json` + `pyproject.toml`), ask the user which subproject to analyze, or generate independently for each (the former is preferred).

**Identify framework and core libraries** by parsing the manifest's dependency list. Examples (not exhaustive):
- Backend web: Express, NestJS, Fastify, Koa, Hono, Django, FastAPI, Flask, Gin, Echo, Fiber, Spring Boot, Quarkus, Laravel, Rails, ASP.NET, Phoenix, Actix, Rocket
- Frontend: Vue 2/3, React, Svelte, Solid, Angular, Astro, Qwik, Next.js, Nuxt, SvelteKit
- Mobile: React Native, Flutter, SwiftUI, Jetpack Compose
- Desktop: Electron, Tauri
- CLI / library: clap, cobra, commander, click, typer
- Testing, ORM, state management, logging, build tooling, etc.

### 1.2 Analyze directory layout

**Don't assume any fixed directory names**. Scan from the project root and record the real structure:

- Main source directory (could be `src/`, `app/`, `lib/`, `internal/`, `cmd/`, `pkg/`, a project-named directory, or none)
- How business modules are organized (feature-based / layered / flat)
- Test directory (`test/`, `tests/`, `__tests__/`, `spec/`, colocated `*_test.go`, etc.)
- Config, docs, scripts directories
- Entry point location(s)

### 1.3 Identify core abstractions

Different project types have different "core abstractions". Find the ones this project uses:

| Project type | Typical core abstractions |
|--------------|---------------------------|
| Frontend SPA | Pages, routes, state, components, API layer |
| Backend web | Routes/controllers, services, data access, models, middleware |
| GraphQL service | Resolvers, schema, DataLoader, directives |
| CLI tool | Commands, subcommands, arg parsing, config loading |
| Library / SDK | Public API, internal modules, type definitions |
| Data processing | Pipelines, tasks, jobs, workers |
| Mobile app | Screens, view models, repositories, services |

Read the wrapping code for these abstractions and record:
- Name, file location, purpose
- Input/output conventions
- Error-handling style
- Usage frequency (how many business files reference it)

### 1.4 Identify shared infrastructure

Scan for reusable infrastructure that appears across the project:
- Request/response utilities (HTTP client, route helpers)
- Database access (ORM setup, migration rules)
- Auth / permissions
- Logging / monitoring
- Error handling
- Configuration management
- Internationalization
- Caching
- Queues / event bus

Record for each: implementation location, how it's called, extension conventions.

### 1.5 Scan business code and cluster (core)

Scan **every business file** in the source tree (no fixed count, no fixed type) and process as follows:

1. **Identify each file's business-unit type** based on content (imports, definitions, decorators/annotations, naming, directory). Possible types include but are not limited to:
   - Frontend: list page, form page, detail page, chart page, settings page, login page, wizard, dashboard, left-tree-right-table layout
   - Backend: CRUD resource endpoint, auth flow, webhook, scheduled job, message consumer, report export, file upload
   - GraphQL: list query, mutation, subscription, complex resolver
   - CLI: interactive command, batch command, subcommand group
   - Mobile: list screen, detail screen, form screen, wizard flow

2. **Cluster files by business-unit type**: group the files, recording count and paths per group.

3. **Sample 1–3 representative files per group**: read them in full to extract the common structure (imports, decorators/annotations, lifecycle/flow, error handling).

4. **Measure each group's code volume**: average line count and similarity (the fraction of code identical across instances).

### 1.6 Score patterns and select top 3–6

Score each cluster from 1.5 on the following dimensions:

| Dimension | Scoring rule |
|-----------|--------------|
| Frequency (instances of this type in the project) | More is better; < 3 disqualifies |
| Average single-file line count | More is better; < 50 disqualifies |
| Similarity across instances | Higher is better; < 80% disqualifies |
| Requires coordinated changes across multiple files (routes, tests, docs, migrations) | More coordination scores higher |

Rank surviving clusters by total score and take **the top 3–6** as the project's "high-value patterns". These drive everything downstream — the *Auto-Execute Rules* section of rule files (Step 2), the slash commands (Step 3), and the plop generators (Step 4).

Name each selected pattern using `new-<semantic>` (kebab-case), with the semantic part reflecting the project's business meaning. Examples:

- Frontend: `new-list`, `new-form`, `new-detail`, `new-chart`, `new-approval`
- Backend: `new-resource`, `new-endpoint`, `new-job`, `new-consumer`, `new-webhook`, `new-migration`
- GraphQL: `new-query`, `new-mutation`, `new-resolver`
- CLI: `new-command`, `new-subcommand`
- Mobile: `new-screen`, `new-viewmodel`

**These are examples only — actual names must fit the project's business**. An OA system might generate `new-approval`; an ETL tool might generate `new-pipeline`, `new-task`. Do not reuse generic names.

### 1.7 Edge cases

| Situation | Handling |
|-----------|----------|
| Project has < 3 business files | Skip 1.5 and 1.6; rule files contain only general constraints, no slash commands or plopfile |
| Every cluster has < 3 instances | No patterns qualify; rule files include analysis but no auto-execute rules, slash commands, or plopfile |
| Instances of one cluster vary widely with no shared pattern | State explicitly in the rules that the project lacks consistent patterns, recommend establishing them; the cluster is excluded from scoring |
| Unknown / niche stack | Continue with the generic directory-scan + clustering flow; do not rely on framework-specific knowledge |

---

## Step 2 — Generate Rule Files

### 2.1 Generate `CLAUDE.md` (only if the user selected Claude Code)

Use the structure below. **Every `[ ]` placeholder must be filled in from the project's actual code — no assumptions, no generic templates.**

The very first line of `CLAUDE.md` must be the marker `<!-- mirrorai:generated -->` so that re-runs can reliably detect mirrorai-managed files.

```markdown
<!-- mirrorai:generated -->
# Project Conventions

## Stack
[actual languages, frameworks, core libraries, versions]

## Directory Layout
[each top-level directory and its purpose]

## Core Abstractions
[each core abstraction (per 1.3) with location and usage]
[encapsulation layers that must not be bypassed, with the correct replacement]

## Infrastructure
[each piece of shared infrastructure (per 1.4) with a usage example]

## Module Development Guidelines
[per business-unit type discovered, the standard structure]
[for each type, the reference file path]

## Code Style
[naming conventions: files, variables, functions, types]
[import order]
[comment, typing, documentation requirements]
[formatter / linter config location]

## Testing
[test framework, file organization, naming convention]

## Prohibited
[every prohibition discovered from actual code, with the specific reason]
[no vague "be careful with X" — only concrete rules]

## Reference Files
[per business-unit type, the best file to read before writing new code]
[example: CRUD endpoint reference → internal/handler/user.go]

## Auto-Execute Rules

**These rules are active in every conversation. The AI must not wait for the user to issue a command.**

When the current task matches any of the patterns below, immediately apply the corresponding rule without asking for confirmation.

[Filled in dynamically by mirror-init based on patterns actually discovered.]
[Each pattern includes:]
[### Pattern name (e.g. "CRUD resource endpoint")]
[- Trigger: keywords or descriptions that indicate this pattern]
[- Rule: which file to reference, which wrappers to use, which constraints apply]
[- Side effects: whether to also create tests, register routes, update docs]
[- Recommended flow: whether to suggest `npx mirrorai new <pattern> <name>` first]

### General rules for any new feature
1. Read this file first, then start writing code
2. Read the relevant reference file, align with its style, then create the new file
3. Use only existing abstractions and infrastructure; do not introduce new dependencies
4. Match the file structure and naming conventions of existing code
5. For high-frequency patterns, suggest the user run plop first (zero tokens), then have the AI fill in the business logic
```

### 2.2 Generate the other tools' rule files (per user selection)

Generated from the Step 1 analysis — use the same core content that went into `CLAUDE.md`, not the content of the existing `CLAUDE.md` file on disk. Always derive from the fresh analysis, never from a previously generated file. Skip files the user did not select (first run) or that are not in the set of files to be written (re-run).

- `.cursorrules` — plain-text rules; drop Claude Code-specific sections (slash commands / auto-execute rules become prose)
- `.windsurfrules` — same format as `.cursorrules`
- `.github/copilot-instructions.md` — Markdown format
- `.clinerules` — same format as `.cursorrules`

Each of these files must also begin with the mirrorai marker as a comment in the appropriate syntax:

- `.cursorrules` / `.windsurfrules` / `.clinerules` → `# mirrorai:generated`
- `.github/copilot-instructions.md` → `<!-- mirrorai:generated -->`

All files must share the same core constraints; only formatting adapts.

---

## Step 3 — Generate Slash Commands (Claude Code only)

**Skip this step entirely if no `.claude/commands/` files are in the set of files to be written for this run.** Slash commands rely on Claude Code's `.claude/commands/` mechanism. For other tools, the pattern guidance already lives in their rule file's *Auto-Execute Rules* section produced by Step 2.

For each pattern selected in Step 1.6, write `.claude/commands/<pattern-name>.md` with the following structure:

- `<!-- mirrorai:generated -->` as the very first line (enables marker detection on re-run)
- `# <pattern-name>` heading
- Short description: when to use it, what it produces
- **Trigger criteria**: keywords or descriptions in the user's message that should auto-apply this command
- **Full code example extracted from the project** (no pseudocode)
- **Variable list**: which fields are plop variables, which require the AI to derive from the requirements
- **Side effects**: other files to create or modify (APIs, tests, docs, configs)
- **Recommended flow**: run `npx mirrorai new <pattern> <name>` first to scaffold, then fill in the business logic

On a full run (first run or re-run option a/b), the number of slash command files must match the patterns from Step 1.6 **exactly one-to-one**. On a selective re-run (option c), generate only the slash command files that were explicitly selected — the one-to-one constraint does not apply.

---

## Step 4 — Generate `plopfile` and Templates

> **When to run this step**: (a) first run and the user opted in at Step 0; (b) re-run option a and the user opts in again at Step 0; (c) re-run option b and `plopfile.*` was detected; (d) re-run option c and `plopfile.*` was detected (only the selected patterns' generators are rewritten; other generators are preserved). Skip entirely otherwise.

> Note: the plopfile itself is JavaScript, but plop templates can be any language (Python, Go, Java, PHP, Ruby, etc.) — they're just text generators.

### 4.1 Choose the plopfile module format

Decide before writing the plopfile:

- Project root `package.json` has `"type": "module"` → generate `plopfile.js` using ESM
- Project root `package.json` has `"type": "commonjs"` or no `type` field → generate `plopfile.js` using CJS
- No `package.json` at the project root (Python / Go / Rust / etc.) → generate `plopfile.mjs` (forces ESM regardless of `type`)

### 4.2 Generate the plopfile

One generator per discovered pattern. Each generator must have **exactly one prompt** — the name prompt — so that the trial-run in 4.4.3 (`npx plop <pattern> __mirrorai_test__`) works non-interactively by passing a single positional argument. If the pattern requires additional parameters, derive them from the name (e.g. via case transforms) rather than adding more prompts.

**ESM example:**

```js
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES = path.join(__dirname, '.mirrorai/templates')

export default function (plop) {
  plop.setGenerator('<pattern>', {
    description: '<project-specific description>',
    prompts: [{ type: 'input', name: 'name', message: 'Module name (English):' }],
    actions: [
      {
        type: 'add',
        path: '<actual-business-dir>/{{camelCase name}}/<actual-filename>.<actual-ext>',
        templateFile: `${TEMPLATES}/<pattern>/main.hbs`
      }
      // Add more actions if the pattern requires generating tests, APIs, configs, etc.
    ]
  })
}
```

**CJS example:**

```js
const path = require('path')
const TEMPLATES = path.join(__dirname, '.mirrorai/templates')

module.exports = function (plop) {
  // same generator configuration
}
```

The number of generators must match the patterns selected in Step 1.6 **exactly one-to-one** (regardless of whether Step 3 produced slash commands).

### 4.3 Generate template files at `.mirrorai/templates/<pattern>/*.hbs`

Each template's content **must be extracted from real project code**:

1. Pick the most canonical instance of the pattern in the project as the seed (any language)
2. Replace business-specific identifiers with plop variables:
   - Name identifiers → `{{camelCase name}}`, `{{pascalCase name}}`, `{{kebabCase name}}`, `{{snakeCase name}}`, `{{constantCase name}}`
   - URLs, table names, etc. → the appropriate case variant
   - Business fields and parameter lists → leave as `TODO` markers for the AI to fill later
3. Keep all structural code (imports, decorators/annotations, lifecycle, error handling)
4. Do not copy pattern-unrelated special-case logic into the template

Template files always end in `.hbs`; the rendered output can be any language (`.py`, `.go`, `.java`, `.ts`, etc.).

### 4.4 Validate the generated artifacts (mandatory)

After producing the plopfile and templates, **immediately run the validation flow below**. Auto-fix and retry on failure; if still failing, apply the tiered handling in 4.4.7.

#### 4.4.1 Syntax check

```bash
node --check plopfile.js   # or plopfile.mjs / plopfile.cjs
```

If it fails, read the error and fix. Common cause: ESM/CJS doesn't match the project's `type` field.

#### 4.4.2 Load check

Run the plopfile through Node without the interactive prompt to confirm it loads without runtime errors:

```bash
# CJS plopfile
node -e "require('./plopfile.js')"

# ESM plopfile
node --input-type=module --eval "await import('./plopfile.mjs')"
```

A clean exit (no output, exit code 0) confirms the plopfile loads correctly. This catches runtime errors that `node --check` (syntax only) misses, such as missing `require`d modules or a malformed export.

#### 4.4.3 Trial-run each generator

For every generator from Step 4.2:

```bash
npx plop <pattern> __mirrorai_test__
```

> plop has no dry-run flag — it always writes the files defined by the `path` field. To validate without leaving artifacts:
> 1. Before running, capture the resolved `path` for every action (with plop variables substituted)
> 2. After validation, delete those files one by one

#### 4.4.4 Syntax-check the output

For each generated file, run a basic syntax check **only when the language is interpreted/scripted and the toolchain is locally available**:

| Language | Command | Reliable for isolated files? |
|----------|---------|------------------------------|
| JavaScript | `node --check <file>` | ✓ |
| Python | `python -m py_compile <file>` | ✓ |
| Ruby | `ruby -c <file>` | ✓ |
| PHP | `php -l <file>` | ✓ |
| Go | `gofmt -e <file>` (syntax only, not compile) | ✓ |

For compiled languages with strong cross-file dependencies (TypeScript, Rust, Java, C#, Swift, Kotlin), skip the per-file compile — single-file compilation typically fails due to missing context. Rely on the path check and residual-variable check below instead.

Always run these two checks **regardless of language**:

- **Path check**: the file was created at the expected location
- **Residual-variable check**: the file contains no leftover `{{xxx}}` placeholders

#### 4.4.5 Semantic content check

A passing syntax check doesn't mean the template is right — verify the output **actually looks like an instance of this pattern**. Read the **seed file** chosen in 4.3 and compare its structure to the trial-run output:

**Must-have checks:**

| Item | Fix when failing |
|------|------------------|
| Every `import` / `use` / `require` / `include` in the seed is present in the output | Restore the missing imports in the template |
| The core abstractions identified in 1.3 are referenced in the output | Switch to the project's wrapped version |
| Major structural sections (route declarations, lifecycle, error handlers, decorators/annotations) are intact | Restore the missing sections |
| Case variants are semantically correct (camelCase for variables, kebab-case for URLs, snake_case for Python/SQL, PascalCase for types) | Swap in the right variant |
| Output line count differs from the seed by ≤ 30% | Out of range means missing or extra content — re-check |
| Business-field positions are marked with TODO | Add TODO comments |

**Must-not-have checks:**

| Item | Fix |
|-----|-----|
| Concrete business field names from the seed (e.g. `orderNo`, `customerName`) | Replace with plop variables or TODO |
| Concrete API paths from the seed (e.g. `/api/v1/orders`) | Replace with `{{kebabCase name}}` |
| Pattern-unrelated special-case logic (e.g. hard-coded business rules, ad-hoc coupon math) | Remove — these are one-offs, not common structure |
| Imports pointing to deleted or non-existent paths | Fix the import path |

#### 4.4.6 Clean up temporary output

Delete the `__mirrorai_test__` files using the paths captured in 4.4.3. Then check each parent directory of those files: if the directory did not exist before the trial-run (i.e., plop created it), remove it too. Work upward until you reach a directory that pre-existed. Leave nothing behind.

#### 4.4.7 Failure handling

Tier by failure type:

| Failure type | Handling |
|--------------|----------|
| The plopfile itself has a syntax error | **Must fix** — cannot skip the whole flow |
| One generator has a fixable syntax or content issue | Repair the template, re-run trial-run; up to 2 retries |
| One generator's template diverges too much from the seed | Re-extract the template from the seed; up to 1 retry |
| Still failing after retries | Remove the generator from the plopfile, and if a matching slash command was created in Step 3, remove it from `.claude/commands/` too; record "skipped X: reason Y" in the final report |

Record each generator's outcome so the final report (Step 5) can show:

```
Validation:
  ✓ plopfile.<ext> syntax OK
  ✓ generator <pattern1> passed all checks
  ⚠️ generator <pattern2> repaired and passed (restored missing import)
  ✗ generator <pattern3> removed (template diverged > 50% from seed)
```

---

## Step 5 — Final Report

Print a concise summary:

```
✓ Analysis complete

Stack: [detected languages / frameworks / core libraries]
Business units (X files total):
  - <type1>: N
  - <type2>: N
  ...

Core abstractions and infrastructure: [list the main ones]
[include the following section only if qualifying patterns were found:]
High-value patterns (with generated commands):
  - <pattern1> (X instances) → /<command>
  - <pattern2> (X instances) → /<command>
  ...
[if no patterns qualified, instead print:]
No high-value patterns found — rule files contain general constraints only.

Generated files:
  - [list everything actually created based on user selection]

Validation (if a plopfile was generated):
  - [per-generator status: passed / repaired / removed]

Next steps:
  - For everyday work, just describe the requirement — the AI will follow the rules automatically
  [include the following line only if a plopfile was generated:]
  - For quick skeleton generation: npx mirrorai new <pattern> <name>
```

If the project has consistency issues (instances of one type written very differently, abstractions used inconsistently, etc.), append a `⚠️ Issues found` section listing the specifics and suggested next steps.
