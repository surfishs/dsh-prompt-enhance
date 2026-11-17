/**
 * Host-primitives compatibility check.
 *
 * The settings pages are built from the DSH shell's UI primitives
 * (`SettingsFormModel`, `settingsTextField`, …). Those are compiled into the
 * shell frontend inside `app.asar` and never published as a package, so the unit
 * tests exercise a hand-written double. A shell upgrade that renames or drops one
 * of them would leave every test green and break the real pages — this check
 * reads the SHIPPED shell bundle and asserts the export names are still there.
 *
 * Scope, deliberately: presence of the module specifier and of every value import
 * this plugin makes. It cannot see a behaviour change behind an unchanged name,
 * and it cannot see per-export shapes; those need a real browser run.
 *
 * Usage:
 *   npm run check:host-primitives                 # auto-locate the installed shell
 *   DSH_ASAR=<path to app.asar> npm run check:host-primitives
 *
 * Exit codes: 0 = all present, or skipped because this machine has no shell;
 * 1 = drift (a symbol the plugin imports is gone).
 */

import { readFile, readdir, open } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Checkout root (this script lives in `<root>/scripts`). */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Module specifier the shell has to keep registering. */
const SPECIFIER = '@deepseek-ai/dsh-client-ui-primitives'

/** Source files whose value imports define WHAT this check looks for. */
const CLIENT_DIR = join(ROOT, 'src', 'client')

/** The compiled shell frontend, wherever the packager put it. */
const FRONTEND_BUNDLE = /dsh-web-frontend\/dist\/assets\/index-[^/]+\.js$/

/**
 * One file entry inside the asar archive.
 * @typedef {{ path: string, offset: number, size: number }} AsarFile
 */

/**
 * Flatten one asar header node tree into file entries.
 * @param {unknown} node - header node (directory or file).
 * @param {string[]} trail - path segments accumulated so far.
 * @param {AsarFile[]} out - accumulator.
 * @returns {AsarFile[]} the accumulator.
 */
function collectFiles(node, trail, out) {
  if (node === null || typeof node !== 'object') return out
  const record = /** @type {{ files?: Record<string, unknown>, offset?: unknown, size?: unknown }} */ (node)
  if (record.files !== undefined) {
    for (const [name, child] of Object.entries(record.files)) collectFiles(child, [...trail, name], out)
    return out
  }
  if (typeof record.offset !== 'string' && typeof record.offset !== 'number') return out
  if (typeof record.size !== 'number') return out
  out.push({ path: trail.join('/'), offset: Number(record.offset), size: record.size })
  return out
}

/**
 * Read one asar archive's directory tree.
 * @param {string} asarPath - path of the `.asar` file.
 * @returns {Promise<{ files: AsarFile[], baseOffset: number } | undefined>} the tree, or undefined when unreadable.
 */
async function readAsarDirectory(asarPath) {
  const handle = await open(asarPath, 'r')
  try {
    const head = Buffer.alloc(8)
    await handle.read(head, 0, 8, 0)
    const headerSize = head.readUInt32LE(4)
    // The header is a small JSON blob; anything huge means this is not an asar.
    if (!Number.isFinite(headerSize) || headerSize <= 0 || headerSize > 64 * 1024 * 1024) return undefined
    const header = Buffer.alloc(headerSize)
    await handle.read(header, 0, headerSize, 8)
    const jsonLength = header.readUInt32LE(4)
    const parsed = JSON.parse(header.subarray(8, 8 + jsonLength).toString('utf8'))
    return { files: collectFiles(parsed, [], []), baseOffset: 8 + headerSize }
  } catch {
    return undefined
  } finally {
    await handle.close()
  }
}

/**
 * Read one file out of an asar archive.
 * @param {string} asarPath - path of the `.asar` file.
 * @param {number} baseOffset - offset of the first file blob.
 * @param {AsarFile} entry - the entry to read.
 * @returns {Promise<string>} the file content as UTF-8.
 */
async function readAsarFile(asarPath, baseOffset, entry) {
  const handle = await open(asarPath, 'r')
  try {
    const buffer = Buffer.alloc(entry.size)
    await handle.read(buffer, 0, entry.size, baseOffset + entry.offset)
    return buffer.toString('utf8')
  } finally {
    await handle.close()
  }
}

/**
 * First existing file among the given names on PATH.
 * @param {string[]} names - file names to look for.
 * @returns {string | undefined} the first hit, or undefined.
 */
function findOnPath(names) {
  const directories = (process.env.PATH ?? '').split(delimiter).filter((entry) => entry !== '')
  for (const directory of directories) {
    for (const name of names) {
      const candidate = join(directory, name)
      if (existsSync(candidate)) return candidate
    }
  }
  return undefined
}

/**
 * Locate the installed shell's `app.asar`, most explicit source first.
 * @returns {string | undefined} the path, or undefined when this machine has no shell.
 */
function locateAsar() {
  /** @type {string[]} */
  const candidates = []
  const explicit = (process.env.DSH_ASAR ?? '').trim()
  if (explicit !== '') candidates.push(resolve(explicit))
  // Electron packaging puts it beside the binary.
  candidates.push(join(dirname(process.execPath), 'resources', 'app.asar'))
  // A `dsh` CLI on PATH lives at <install>/resources/runtime/cli/bin; walk up.
  const cli = findOnPath(['dsh.cmd', 'dsh.exe', 'dsh'])
  if (cli !== undefined) {
    let directory = dirname(cli)
    for (let depth = 0; depth < 6; depth += 1) {
      candidates.push(join(directory, 'resources', 'app.asar'), join(directory, 'app.asar'))
      const parent = dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  }
  return candidates.find((candidate) => existsSync(candidate))
}

/**
 * Every VALUE import of the primitives module across the client half. `import
 * type` is skipped on purpose: type names are erased at runtime, so they cannot
 * appear in the shipped bundle.
 * @returns {Promise<string[]>} sorted symbol names.
 */
async function primitiveSymbols() {
  const names = new Set()
  for (const file of await readdir(CLIENT_DIR)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
    const text = await readFile(join(CLIENT_DIR, file), 'utf8')
    const pattern = /^import\s+(?!type\b)\{([^}]*)\}\s+from\s+'@deepseek-ai\/dsh-client-ui-primitives'/gm
    for (const match of text.matchAll(pattern)) {
      for (const raw of (match[1] ?? '').split(',')) {
        const name = raw.trim().replace(/^type\s+/, '')
        if (name !== '') names.add(name)
      }
    }
  }
  return [...names].sort()
}

const symbols = await primitiveSymbols()
if (symbols.length === 0) {
  console.log('SKIP: the client half no longer imports host primitives')
  process.exit(0)
}

const asarPath = locateAsar()
if (asarPath === undefined) {
  console.log('SKIP: no DSH app.asar found on this machine (set DSH_ASAR to point at one)')
  process.exit(0)
}

const archive = await readAsarDirectory(asarPath)
const bundleEntry = archive?.files.find((entry) => FRONTEND_BUNDLE.test(entry.path))
if (archive === undefined || bundleEntry === undefined) {
  console.log(`SKIP: ${asarPath} carries no shell frontend bundle (unknown packaging, or an older layout)`)
  process.exit(0)
}

const bundle = await readAsarFile(asarPath, archive.baseOffset, bundleEntry)
console.log(`shell : ${asarPath}`)
console.log(`bundle: ${bundleEntry.path} (${bundleEntry.size} B)`)
console.log(`wanted: ${SPECIFIER}, ${symbols.join(', ')}`)

const missing = [SPECIFIER, ...symbols].filter((needle) => !bundle.includes(needle))
if (missing.length > 0) {
  console.error(`\nFAIL: the installed shell no longer exposes: ${missing.join(', ')}`)
  console.error('The unit-test double still passes, so this is exactly the drift this check exists for.')
  console.error('Fix the import (or the double) before shipping against this shell version.')
  process.exit(1)
}

console.log(`\nPASS: all ${symbols.length} imported primitives are still exported by the installed shell`)
process.exit(0)
