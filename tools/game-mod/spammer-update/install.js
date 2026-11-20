'use strict'
/*
 * Packet Spammer update: import / export, drag to reorder (JR window) or ^ v (game window),
 * and change any line in place (where it goes, its wait, its packet).
 *   node "<JR folder>\tools\game-mod\spammer-update\install.js"   (from any folder)
 * Undo: undo.js next to this file. No game rebuild needed.
 */
const fs = require('fs')
const path = require('path')
const here = __dirname
const root = path.join(here, '..', '..', '..')
const plugin = path.join(root, 'plugins', 'packet-spammer')
const toolsFile = path.join(root, 'src', 'game', 'surfaces', 'tools.js')
const backup = path.join(here, 'original')
const OLD = fs.readFileSync(path.join(here, 'old-spammer.js'), 'utf8').replace(/\r\n/g, '\n')
const NEW = fs.readFileSync(path.join(here, 'new-spammer.js'), 'utf8').replace(/\r\n/g, '\n')

console.log('JR folder: ' + root)
if (!fs.existsSync(path.join(plugin, 'runner.js')) || !fs.existsSync(toolsFile)) throw new Error('plugins\\packet-spammer or src\\game\\surfaces\\tools.js is missing - is this the JR folder? Nothing was changed.')
let js = fs.readFileSync(toolsFile, 'utf8')
const nl = js.includes('\r\n') ? '\r\n' : '\n'
const flat = js.replace(/\r\n/g, '\n')
const has = (s) => flat.includes(s.trimEnd())
if (!has(NEW) && !has(OLD)) throw new Error('The Packet Spammer part of tools.js looks different from the one this update was made for. Nothing was changed.')

// keep the originals once, for undo
if (!fs.existsSync(backup)) {
  fs.mkdirSync(backup, { recursive: true })
  for (const f of ['runner.js', 'index.html']) fs.copyFileSync(path.join(plugin, f), path.join(backup, f))
  console.log('  Saved the original Packet Spammer files (for undo)')
}
for (const f of ['runner.js', 'index.html']) fs.copyFileSync(path.join(here, 'plugin', f), path.join(plugin, f))
console.log('  JR window: import / export, drag to reorder, edit lines in place')
if (has(NEW)) console.log('  Game window: already updated')
else {
  fs.writeFileSync(toolsFile, flat.replace(OLD.trimEnd(), NEW.trimEnd()).replace(/\n/g, nl))
  console.log('  Game window: import / export, ^ v to reorder, Edit lines')
}
console.log('Done. Close JR completely and start it again (npm start).')
