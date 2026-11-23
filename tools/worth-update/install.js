#!/usr/bin/env node
'use strict'
// Daily worth update (JRR): makes JRR use the newest worth values from the daily
// GitHub job. Changes src/ui/engine.js, src/ui/app.js and the scraper's name it
// gives the wiki (tools/worth-scraper/scrape.js); needs src/worth/update.js.
// Run from anywhere:  node tools/worth-update/install.js     Undo: add --undo
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '..', '..')
const UNDO = process.argv.includes('--undo')

const EDITS = {
  'src/ui/engine.js': [
    ["  const worthLabels = req('worth/labels.js')\n",
     "  const worthLabels = req('worth/labels.js')\n  const worthUpdate = req('worth/update.js') // JRR: daily worth update\n"],
    ["    if (!worthItems) worthItems = JSON.parse(fs.readFileSync(path.join(info.root, 'data', 'worth', 'values.json'), 'utf8')).items || []\n    return worthItems\n  }\n",
     "    if (!worthItems) worthItems = worthUpdate.loadWorth(info).items || []\n    return worthItems\n  }\n" +
     "  // JRR: newer worth values from the daily update, checked a few seconds after start.\n" +
     "  setTimeout(async () => {\n" +
     "    const r = await worthUpdate.refreshWorth(info)\n" +
     "    if (r.updated) {\n" +
     "      worthItems = null; labeler = null; worthLookup = null\n" +
     "      log({ type: 'success', message: `Worth values updated: wiki as of ${String(r.generatedAt).slice(0, 10)} (${r.itemCount} items).` })\n" +
     "      events.emit('worth')\n" +
     "    } else if (r.error) log({ type: 'info', message: `Couldn\\u2019t check for newer worth values (${r.error}); using the ones JRR has.` })\n" +
     "    else log({ type: 'info', message: `Worth values are up to date (wiki as of ${String(r.generatedAt || '').slice(0, 10)}).` })\n" +
     "  }, 5000)\n"]
  ],
  'tools/worth-scraper/scrape.js': [
    ["const USER_AGENT = 'JRWorthCollector/1.0 (+https://github.com/BradysLabs/JR; weekly, rate-limited)'",
     "const USER_AGENT = 'JRRWorthCollector/1.0 (+https://github.com/Rante-aj/JRR; daily, rate-limited, only edited pages)'"]
  ],
  'src/ui/app.js': [
    ["try {\n  const worthItems = JSON.parse(require('fs').readFileSync(path.join(info.root, 'data', 'worth', 'values.json'), 'utf8')).items || []\n  worthByName = worthTools.indexWorth(worthItems)\n  worthRates = valueTools.buildRates(worthItems.map(it => ({ p: it.page, v: it.variant, g: it.grade, t: it.raw })))\n} catch (_) {}\n",
     "// JRR: the newest worth values (daily update or the copy that ships with JRR).\nconst loadWorthTables = () => {\n  try {\n    const worthItems = require(path.join(info.root, 'src', 'worth', 'update.js')).loadWorth(info).items || []\n    worthByName = worthTools.indexWorth(worthItems)\n    worthRates = valueTools.buildRates(worthItems.map(it => ({ p: it.page, v: it.variant, g: it.grade, t: it.raw })))\n  } catch (_) {}\n}\nloadWorthTables()\n"],
    ["engine.events.on('items', () => { if (trade.active) renderTrade() })\n",
     "engine.events.on('items', () => { if (trade.active) renderTrade() })\nengine.events.on('worth', () => { loadWorthTables(); if (trade.active) renderTrade() }) // JRR: daily worth update\n"]
  ]
}

let changed = 0
for (const [rel, edits] of Object.entries(EDITS)) {
  const file = path.join(root, rel)
  let s = fs.readFileSync(file, 'utf8')
  const crlf = s.includes('\r\n')
  if (crlf) s = s.replace(/\r\n/g, '\n')
  for (const [before, after] of edits) {
    const [from, to] = UNDO ? [after, before] : [before, after]
    if (UNDO ? !s.includes(from) && s.includes(to) : s.includes(to)) continue // already done
    if (!s.includes(from)) { console.error(`  ${rel}: couldn't find the spot to change. Nothing was changed in this file.`); process.exitCode = 1; s = null; break }
    s = s.replace(from, to); changed++
  }
  if (s != null) fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s)
}
if (!fs.existsSync(path.join(root, 'src', 'worth', 'update.js')) && !UNDO) { console.error('  src/worth/update.js is missing - copy it in too.'); process.exitCode = 1 }
console.log(process.exitCode ? '  Done with problems (see above).' : changed ? `  ${UNDO ? 'Undone' : 'Installed'} (${changed} change${changed === 1 ? '' : 's'}).` : `  Already ${UNDO ? 'undone' : 'installed'}.`)
