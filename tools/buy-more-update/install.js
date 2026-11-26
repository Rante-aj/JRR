#!/usr/bin/env node
'use strict'
// Buy More: type how many to buy (JRR). The in-game Buy More window gets a box you
// can type a number into (up to 999) instead of the - / + arrows, and the limit
// goes from 100 to 999. Also fixes items bought with Buy More all showing as worn
// (you couldn't change clothes until you relogged). Buying still stops by itself when the store says no
// (not enough Gems/Diamonds, or a full inventory).
// Run:  node tools/buy-more-update/install.js      Undo: add --undo
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '..', '..')
const UNDO = process.argv.includes('--undo')

const EDITS = {
  'plugins/bulk-buy/bulk.js': [
    ['const MAX = 100\n', 'const MAX = 999 // JRR: was 100\n'],
    ["      { type: 'aj', message: 'db', callback: ({ message }) => this._answer('db', message) }\n    ]\n",
     "      { type: 'aj', message: 'db', callback: ({ message }) => this._answer('db', message) },\n      { type: 'aj', message: 'il', callback: ({ message }) => this._added(message) } // JRR\n    ]\n"],
    ["    const resolve = this.pending.resolve\n    this.pending = null\n    resolve(r)\n  }\n",
     "    const resolve = this.pending.resolve\n    this.pending = null\n    this.boughtAt = Date.now() // JRR\n    resolve(r)\n  }\n\n" +
     "  // JRR: after each clothing purchase the server sends the new item as worn\n" +
     "  // (%xt%il%-1%2%1%2%<name>%<color>%1%0%<slot>%<item>%). After a purchase of its own the\n" +
     "  // game then puts it on properly, but it never saw JR's purchases, so it ended up\n" +
     "  // thinking every copy was worn and you couldn't change clothes until you relogged.\n" +
     "  // JR marks the copies it bought as not worn.\n" +
     "  _added (message) {\n" +
     "    if (!this.boughtAt || Date.now() - this.boughtAt > 3000 || !this.last || this.last.cmd !== 'ib') return\n" +
     "    const v = message.value\n" +
     "    // v[4] 2 = items changed, v[5] = new items worn (1) or not (0), v[9] = how many, v[12] = the item\n" +
     "    if (!Array.isArray(v) || String(v[4]) !== '2' || String(v[5]) !== '1' || String(v[9]) !== '1' || String(v[12]) !== String(this.last.defId)) return\n" +
     "    v[5] = '0'\n" +
     "  }\n"]
  ],
  'plugins/bulk-buy/index.html': [
    ['<input id="count" type="number" min="1" max="100" value="5">', '<input id="count" type="number" min="1" max="999" value="5">']
  ],
  'src/game/surfaces/shop.js': [
    ["        rows.push({ t: 'num', id: 'count', label: 'How many more', v: state.count || 5, step: 1 })\n        rows.push({ t: 'row', items: [5, 10, 25, 50].map(n => ({ id: 'count', label: String(n), v: String(n) })) })\n",
     "        // JRR: type any number (up to 999), or pick one.\n        rows.push({ t: 'in', id: 'count', label: 'How many more (type a number, up to 999)', v: String(state.count || 5), go: 'Set', max: 3 })\n        rows.push({ t: 'row', items: [5, 10, 25, 50, 100].map(n => ({ id: 'count', label: String(n), v: String(n) })) })\n"],
    ["    if (c === 'count') { state.count = Math.max(1, Math.min(100, Number(v) || 1)); return }\n    if (c === 'stop') { this.buyer.stop(); return }\n    if (c === 'buy') {\n",
     "    const howMany = (x) => Math.max(1, Math.min(999, Math.floor(Number(String(x).replace(/[^0-9]/g, '')) || 1))) // JRR\n    if (c === 'count') { state.count = howMany(v); return }\n    if (c === 'stop') { this.buyer.stop(); return }\n    if (c === 'buy') {\n      if (inputs && inputs.count != null && String(inputs.count).trim()) state.count = howMany(inputs.count) // JRR: the typed number, even without Set\n"]
  ]
}

// Changes from older versions (v1 currency update, v3 worn fix), taken out if they're there.
const CLEANUP = {
  'plugins/bulk-buy/bulk.js': [
    // v3 (marked the wrong field, so the items didn't show until you relogged)
    ["    const resolve = this.pending.resolve\n    this.pending = null\n    resolve(r)\n  }\n",
     "    const resolve = this.pending.resolve\n    this.pending = null\n    this.boughtAt = Date.now() // JRR\n    resolve(r)\n  }\n\n" +
     "  // JRR: after each clothing purchase the server sends the new item as worn\n" +
     "  // (%xt%il%-1%2%1%2%<name>%<color>%1%0%<slot>%<item>%). After a purchase of its own the\n" +
     "  // game then puts it on properly, but it never saw JR's purchases, so it ended up\n" +
     "  // thinking every copy was worn and you couldn't change clothes until you relogged.\n" +
     "  // JR marks the copies it bought as not worn.\n" +
     "  _added (message) {\n" +
     "    if (!this.boughtAt || Date.now() - this.boughtAt > 3000 || !this.last || this.last.cmd !== 'ib') return\n" +
     "    const v = message.value\n" +
     "    if (!Array.isArray(v) || String(v[4]) !== '2' || String(v[12]) !== String(this.last.defId) || String(v[9]) !== '1') return\n" +
     "    v[9] = '0'\n" +
     "  }\n"],
    ["  return { ok: v[4] === '1', balance: cmd === 'ib' ? v[6] : v[5] }\n",
     "  return { ok: v[4] === '1', balance: cmd === 'ib' ? v[6] : v[5], currency: v[7] } // JRR: v[7] = currency type (0 Gems, 3 Diamonds...)\n"],
    ["    const resolve = this.pending.resolve\n    this.pending = null\n    resolve(r)\n",
     "    const resolve = this.pending.resolve\n    this.pending = null\n" +
     "    // JRR: the game didn't see the answer, so tell it the new balance (%xt%cu%-1%<type>%<amount>%0%):\n" +
     "    // its Gems/Diamonds count goes down with each purchase. Going down never shows a popup.\n" +
     "    if (r.ok && /^\\d+$/.test(String(r.balance)) && /^\\d+$/.test(String(r.currency))) {\n" +
     "      try { this.dispatch.sendConnectionMessage(`%xt%cu%-1%${r.currency}%${r.balance}%0%`) } catch (_) {}\n" +
     "    }\n    resolve(r)\n"]
  ]
}

let changed = 0
for (const [rel, edits] of Object.entries(CLEANUP)) {
  const file = path.join(root, rel)
  let s = fs.readFileSync(file, 'utf8')
  const crlf = s.includes('\r\n')
  if (crlf) s = s.replace(/\r\n/g, '\n')
  let n = 0
  for (const [before, after] of edits) if (s.includes(after)) { s = s.replace(after, before); n++ }
  if (n) { fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s); console.log(`  Took out an older version's change (${n} change${n === 1 ? '' : 's'}).`) }
}
for (const [rel, edits] of Object.entries(EDITS)) {
  const file = path.join(root, rel)
  let s = fs.readFileSync(file, 'utf8')
  const crlf = s.includes('\r\n')
  if (crlf) s = s.replace(/\r\n/g, '\n')
  let ok = true
  for (const [before, after] of edits) {
    const [from, to] = UNDO ? [after, before] : [before, after]
    if (UNDO ? !s.includes(from) && s.includes(to) : s.includes(to)) continue // already done
    if (!s.includes(from)) { console.error(`  ${rel}: couldn't find the spot to change. Nothing was changed in this file.`); process.exitCode = 1; ok = false; break }
    s = s.replace(from, to); changed++
  }
  if (ok) fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s)
}
console.log(process.exitCode ? '  Done with problems (see above).' : changed ? `  ${UNDO ? 'Undone' : 'Installed'} (${changed} change${changed === 1 ? '' : 's'}).` : `  Already ${UNDO ? 'undone' : 'installed'}.`)
