'use strict'
/* Undoes masterpiece-update: JR's original Masterpiece Studio back, the transfer plugin and its
   buttons removed, Rante's own copies moved back into %APPDATA%\JR\plugins. */
const fs = require('fs')
const path = require('path')
const here = __dirname
const root = path.join(here, '..', '..', '..')
const plugins = path.join(root, 'plugins')
const studio = path.join(plugins, 'masterpiece')
const original = path.join(here, 'original-studio')
const toolsFile = path.join(root, 'src', 'game', 'surfaces', 'tools.js')
const appdata = process.env.APPDATA ? path.join(process.env.APPDATA, 'JR') : null
const EDITS = require('./edits.js')
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(from)) { const a = path.join(from, f); const b = path.join(to, f); if (fs.statSync(a).isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b) } }

console.log('JR folder: ' + root)
if (fs.existsSync(original)) {
  for (const f of fs.readdirSync(studio)) fs.rmSync(path.join(studio, f), { recursive: true, force: true })
  copyDir(original, studio)
  console.log('  Masterpiece Studio: JR\'s original is back')
} else console.log('  (no saved original studio - left as it is)')
fs.rmSync(path.join(plugins, 'masterpiece-user-transfer'), { recursive: true, force: true })
console.log('  Masterpiece User Transfer: removed from JR\'s plugins')
if (fs.existsSync(toolsFile)) {
  let js = fs.readFileSync(toolsFile, 'utf8')
  const nl = js.includes('\r\n') ? '\r\n' : '\n'
  for (const e of EDITS.slice().reverse()) { const to = e.to.replace(/\n/g, nl); if (js.includes(to)) js = js.replace(to, e.from.replace(/\n/g, nl)) }
  fs.writeFileSync(toolsFile, js)
  console.log('  Transfer buttons removed')
}
if (appdata) {
  for (const name of ['masterpiece-studio-reworked', 'masterpiece-user-transfer']) {
    const from = path.join(appdata, 'plugins-backup', name)
    const to = path.join(appdata, 'plugins', name)
    if (fs.existsSync(from) && !fs.existsSync(to)) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(from, to); console.log(`  Your own copy of ${name} is back in your plugins folder`) }
  }
}
console.log('Done. Close JR completely and start it again (npm start).')
