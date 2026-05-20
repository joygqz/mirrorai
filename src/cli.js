#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const pc = require('picocolors')
const { execSync } = require('child_process')

const MIRROR_INIT = path.join(__dirname, '../.claude/commands/mirror-init.md')
const PKG = require('../package.json')

const args = process.argv.slice(2)
const command = args[0]

function printHelp() {
  console.log(pc.bold(`mirrorai v${PKG.version}`))
  console.log()
  console.log('Commands:')
  console.log('  install                   Install mirror-init.md into the current project')
  console.log('  new <pattern> <name>      Generate a skeleton locally with plop (zero tokens)')
  console.log('  -v, --version             Print version')
  console.log('  -h, --help                Print this help')
  console.log()
  console.log('After installing, run /mirror-init in your AI tool to generate the rest.')
  console.log(pc.dim('Patterns are created by /mirror-init. Run `npx plop --help` to list them.'))
}

function install() {
  const target = path.join(process.cwd(), '.claude/commands')
  fs.mkdirSync(target, { recursive: true })
  fs.cpSync(MIRROR_INIT, path.join(target, 'mirror-init.md'))

  console.log(pc.green('✓ mirrorai installed'))
  console.log()
  console.log('Next: run this in your AI tool:')
  console.log(pc.cyan('  /mirror-init'))
}

function newScaffold() {
  const type = args[1]
  const name = args[2]

  if (!type || !name) {
    console.log(pc.red('Usage: mirrorai new <pattern> <name>'))
    console.log(pc.dim('Patterns are created by /mirror-init. Run `npx plop --help` to list them.'))
    process.exit(1)
  }

  try {
    execSync(`npx plop ${type} ${name}`, { stdio: 'inherit', cwd: process.cwd() })
  } catch {
    process.exit(1)
  }
}

switch (command) {
  case 'install':
    install()
    break
  case 'new':
    newScaffold()
    break
  case '-v':
  case '--version':
    console.log(PKG.version)
    break
  case undefined:
  case '-h':
  case '--help':
    printHelp()
    break
  default:
    console.log(pc.red(`Unknown command: ${command}`))
    console.log()
    printHelp()
    process.exit(1)
}
