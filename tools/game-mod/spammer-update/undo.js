'use strict'
/* Undoes spammer-update: the original Packet Spammer files and game window come back. */
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
if (fs.existsSync(backup)) {
  for (const f of ['runner.js', 'index.html']) fs.copyFileSync(path.join(backup, f), path.join(plugin, f))
  console.log('  JR window: original back')
} else console.log('  (no saved original plugin files - left as they are)')
let js = fs.readFileSync(toolsFile, 'utf8')
const nl = js.includes('\r\n') ? '\r\n' : '\n'
const flat = js.replace(/\r\n/g, '\n')
if (flat.includes(NEW.trimEnd())) { fs.writeFileSync(toolsFile, flat.replace(NEW.trimEnd(), OLD.trimEnd()).replace(/\n/g, nl)); console.log('  Game window: original back') }
console.log('Done. Close JR completely and start it again (npm start).')
