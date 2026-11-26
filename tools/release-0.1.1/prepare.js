'use strict'
/*
 * Gets JRR ready for 0.1.1:
 *   1. takes the temporary window-redraw logging out of src/game/surfaces/play.js
 *   2. sets the version to 0.1.1 (package.json, and package-lock.json if it's there)
 *   3. adds the 0.1.1 entry to What's new (src/ui/whats-new.json)
 *   node "<JR folder>\tools\release-0.1.1\prepare.js"        (add --undo to put it all back)
 * Running it again changes nothing.
 */
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..', '..')
const undo = process.argv.includes('--undo')
const file = (...p) => path.join(root, ...p)
const say = (s) => console.log('  ' + s)
console.log('JR folder: ' + root)

// 1. play.js: the diagnostic block (and a copy kept here so --undo can put it back)
const DIAG = `// Diagnostic (temporary): note each window redraw in JRR's log.
for (const surf of [adventures, automation]) {
  const view = surf.view
  surf.view = function (state, ctx) {
    const out = view.call(this, state, ctx)
    try { ctx.log({ type: 'debug', message: \`Adventures trace: view \${surf.id} \${JSON.stringify(out).length} bytes\` }) } catch (_) {}
    return out
  }
}

`
const END = 'module.exports = [adventures, automation'
{
  const f = file('src', 'game', 'surfaces', 'play.js')
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  if (!undo) {
    if (s.includes(DIAG)) { s = s.replace(DIAG, ''); fs.writeFileSync(f, s); say('play.js: diagnostic logging removed') } else say('play.js: no diagnostic logging (already removed)')
  } else if (!s.includes(DIAG) && s.includes(END)) { s = s.replace(END, DIAG + END); fs.writeFileSync(f, s); say('play.js: diagnostic logging put back') }
}

// 2. version
const FROM = '0.1.0'
const TO = '0.1.1'
for (const name of ['package.json', 'package-lock.json']) {
  const f = file(name)
  if (!fs.existsSync(f)) continue
  const d = JSON.parse(fs.readFileSync(f, 'utf8'))
  const [a, b] = undo ? [TO, FROM] : [FROM, TO]
  let changed = false
  if (d.version === a) { d.version = b; changed = true }
  if (d.packages && d.packages[''] && d.packages[''].version === a) { d.packages[''].version = b; changed = true }
  if (changed) { fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); say(`${name}: version ${a} -> ${b}`) } else say(`${name}: version is ${d.version} (nothing changed)`)
}

// 3. What's new
const ENTRY = {
  fork: true,
  date: '2026-11',
  items: [
    { title: 'Adventure automations', text: 'The gear button in adventures runs Bitter Sweets, Phantoms (easy and hard), Twists and Turns, Jamaaliday Rescue, Special Delivery, New Year’s Fortune, Spring Festival, Battle for the Beacon, Graham’s Workshop, Tiki Trouble and The Forgotten Desert, with loops and Join again if kicked.' },
    { title: 'Prize screens', text: 'Automations open prize chests on the real prize screen, tick what they took and press OK / Take for you.' },
    { title: 'Jammer Wall', text: 'Jammer Wall popups no longer appear.' },
    { title: 'Shop Explorer', text: 'Shops in every den you visit (never your own) are read on their own, even with Shop Explorer closed. Open a shop from the list in one click.' },
    { title: 'Favorite items', text: 'Point at any item and click its star. The ★ tab next to Clothes and Trade shows your favorites (any color, or exact color only), and a popup tells you when a shop you’re in has one.' },
    { title: 'Favorites in trade lists', text: 'A green square marks your favorites in other players’ trade lists. The trade button under the Jam-A-Gram button lists the favorites in this room’s trade lists; click one to open that player’s trade list. Turn on Check trades automatically in the ★ tab’s Settings.' },
    { title: 'Buy More', text: 'Type how many to buy (up to 999), and bought copies no longer get stuck as worn.' },
    { title: 'Daily item worth', text: 'Item worth values update every day.' },
    { title: 'Edit Animal', text: 'Save Outfit and Try On sit next to Glow, so they no longer cover the search bar.' }
  ]
}
{
  const f = file('src', 'ui', 'whats-new.json')
  const d = JSON.parse(fs.readFileSync(f, 'utf8'))
  if (!undo) {
    if (d[TO]) say(`whats-new.json: ${TO} entry already there`)
    else { fs.writeFileSync(f, JSON.stringify({ [TO]: ENTRY, ...d }, null, 2) + '\n'); say(`whats-new.json: ${TO} entry added`) }
  } else if (d[TO]) { delete d[TO]; fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); say(`whats-new.json: ${TO} entry removed`) }
}
console.log('Done.')
