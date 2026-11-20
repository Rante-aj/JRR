'use strict'
/*
 * Makes Rante's masterpiece plugins official:
 *   - Masterpiece Studio (reworked, layered format) replaces JR's built-in Masterpiece Studio
 *   - Masterpiece User Transfer becomes a built-in plugin
 *   - the in-game Studio window and the JR menu get a Masterpiece Transfer button
 *   - her own copies in %APPDATA%\JR\plugins move to %APPDATA%\JR\plugins-backup (so they don't show twice)
 *   node "<JR folder>\tools\game-mod\masterpiece-update\install.js"   (from any folder)
 * Undo: undo.js next to this file. No game rebuild needed.
 */
const fs = require('fs')
const path = require('path')
const here = __dirname
const root = path.join(here, '..', '..', '..')
const plugins = path.join(root, 'plugins')
const studio = path.join(plugins, 'masterpiece')
const transfer = path.join(plugins, 'masterpiece-user-transfer')
const original = path.join(here, 'original-studio')
const toolsFile = path.join(root, 'src', 'game', 'surfaces', 'tools.js')
const appdata = process.env.APPDATA ? path.join(process.env.APPDATA, 'JR') : null
const EDITS = require('./edits.js')

const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true })
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f); const b = path.join(to, f)
    if (fs.statSync(a).isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b)
  }
}
const emptyDir = (d) => { if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) fs.rmSync(path.join(d, f), { recursive: true, force: true }) }

console.log('JR folder: ' + root)
if (!fs.existsSync(path.join(studio, 'plugin.json'))) throw new Error('plugins\\masterpiece is missing - is this the JR folder? Nothing was changed.')

// 1. the studio: keep JR's original once, then put the reworked one in its place
const mine = (() => { try { return JSON.parse(fs.readFileSync(path.join(studio, 'plugin.json'), 'utf8')).author === 'Rante' } catch (_) { return false } })()
if (!mine && !fs.existsSync(original)) { copyDir(studio, original); console.log('  Saved JR\'s original Masterpiece Studio (for undo)') }
emptyDir(studio)
copyDir(path.join(here, 'studio'), studio)
console.log('  Masterpiece Studio: replaced with the reworked one')

// 2. the transfer plugin
emptyDir(transfer)
copyDir(path.join(here, 'transfer'), transfer)
console.log('  Masterpiece User Transfer: added as a built-in plugin')

// 3. buttons (each is skipped if this JR's tools.js looks different)
if (fs.existsSync(toolsFile)) {
  let js = fs.readFileSync(toolsFile, 'utf8')
  const nl = js.includes('\r\n') ? '\r\n' : '\n'
  for (const e of EDITS) {
    const from = e.from.replace(/\n/g, nl); const to = e.to.replace(/\n/g, nl)
    if (js.includes(to)) console.log(`  ${e.what}: already there`)
    else if (js.split(from).length === 2) { js = js.replace(from, to); console.log(`  ${e.what}: added`) } else console.log(`  ${e.what}: skipped (tools.js looks different here)`)
  }
  fs.writeFileSync(toolsFile, js)
}

// 4. her own copies, out of the plugins folder
if (appdata) {
  for (const name of ['masterpiece-studio-reworked', 'masterpiece-user-transfer']) {
    const from = path.join(appdata, 'plugins', name)
    if (!fs.existsSync(from)) continue
    const to = path.join(appdata, 'plugins-backup', name)
    fs.rmSync(to, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.renameSync(from, to)
    console.log(`  Moved your own copy of ${name} to ${to}`)
  }
}
console.log('Done. Close JR completely and start it again (npm start).')
