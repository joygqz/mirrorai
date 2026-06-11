#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import pc from 'picocolors'

const MIRROR_INIT = new URL('../templates/mirror-init.md', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const [command, ...rest] = process.argv.slice(2)

function printHelp() {
  console.log(pc.bold(`mirrorai v${pkg.version}`))
  console.log()
  console.log('Commands:')
  console.log('  install                   Install or update mirror-init.md in the current project')
  console.log('  new <pattern> <name>      Generate a skeleton locally with plop (zero tokens)')
  console.log('  check                     Verify rules file path references still exist (CI-friendly)')
  console.log('  -v, --version             Print version')
  console.log('  -h, --help                Print this help')
  console.log()
  console.log('After installing, run /mirror-init in your AI tool to generate the rest.')
  console.log(pc.dim('Patterns are created by /mirror-init. Run `npx plop --help` to list them.'))
}

function install() {
  const dirs = ['.claude/commands']
  if (existsSync(path.join(process.cwd(), '.cursor'))) dirs.push('.cursor/commands')

  for (const dir of dirs) {
    const target = path.join(process.cwd(), dir)
    mkdirSync(target, { recursive: true })
    copyFileSync(MIRROR_INIT, path.join(target, 'mirror-init.md'))
    console.log(pc.green(`✓ ${dir}/mirror-init.md`))
  }

  console.log()
  console.log('Next: run this in your AI tool:')
  console.log(pc.cyan('  /mirror-init'))
}

function newScaffold(pattern, name) {
  const valid = /^[a-zA-Z0-9_][\w-]*$/
  if (!pattern || !name || !valid.test(pattern) || !valid.test(name)) {
    console.error(pc.red('Usage: mirrorai new <pattern> <name>'))
    console.error(pc.dim('Patterns are created by /mirror-init. Run `npx plop --help` to list them.'))
    process.exit(1)
  }

  const result = spawnSync('npx', ['plop', pattern, name], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  process.exit(result.status ?? 1)
}

function extractPathRefs(markdown) {
  const refs = new Set()
  for (const [, token] of markdown.matchAll(/`([^`\n]+)`/g)) {
    if (!token.includes('/')) continue
    if (token.startsWith('/') || token.includes('://')) continue
    if (/[\s*<>{}()|]/.test(token)) continue
    refs.add(token)
  }
  return [...refs]
}

function check() {
  const cwd = process.cwd()
  if (!existsSync(path.join(cwd, 'AGENTS.md'))) {
    console.error(pc.red('✗ AGENTS.md not found — run /mirror-init first'))
    process.exit(1)
  }

  const commandsDir = path.join(cwd, '.claude/commands')
  const commandFiles = existsSync(commandsDir)
    ? readdirSync(commandsDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'mirror-init.md')
        .map((e) => `.claude/commands/${e.name}`)
        .filter((f) => readFileSync(path.join(cwd, f), 'utf8').startsWith('<!-- mirrorai:generated -->'))
    : []

  let stale = 0
  for (const file of ['AGENTS.md', ...commandFiles]) {
    const refs = extractPathRefs(readFileSync(path.join(cwd, file), 'utf8'))
    const missing = refs.filter((ref) => !existsSync(path.join(cwd, ref)))

    if (file === 'AGENTS.md' && refs.length === 0) {
      console.log(pc.yellow(`⚠ ${file} — no path references found; expected backtick-wrapped paths like \`src/app.ts\``))
    } else if (missing.length === 0) {
      console.log(pc.green(`✓ ${file}`) + pc.dim(` — ${refs.length} path reference(s) OK`))
    } else {
      stale += missing.length
      console.error(pc.red(`✗ ${file}`))
      for (const ref of missing) console.error(pc.red(`    missing: ${ref}`))
    }
  }

  if (stale > 0) {
    console.error()
    console.error(pc.red(`${stale} stale reference(s) — re-run /mirror-init to refresh the rules`))
    process.exit(1)
  }
}

switch (command) {
  case 'install':
    install()
    break
  case 'new':
    newScaffold(rest[0], rest[1])
    break
  case 'check':
    check()
    break
  case '-v':
  case '--version':
    console.log(pkg.version)
    break
  case undefined:
  case '-h':
  case '--help':
    printHelp()
    break
  default:
    console.error(pc.red(`Unknown command: ${command}`))
    console.error()
    printHelp()
    process.exit(1)
}
