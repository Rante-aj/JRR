'use strict'
/*
 * Turns this JR folder into Rante's fork, ready to build an installer:
 *   node tools\fork-setup.js "<App name>" <GitHub user> <GitHub repo> [version]
 * e.g.
 *   node tools\fork-setup.js "JR Rante" ranteuser jr-rante 0.4.0
 *
 * What it changes (and nothing else):
 *  - package.json: app name / id / installer name, version, and where updates come from
 *    (that GitHub repo's Releases) - so it installs NEXT TO official JR and never takes its updates
 *  - src/main/index.js: app.setName(...) - its own settings folder (%APPDATA%\<App name>)
 *  - src/config.js: the GitHub repo (update checks / links). The Discord check stays the same:
 *    members still have to be in the JR Discord server.
 *  - src/ui/whats-new.json: a "What's new" entry for this version listing the fork's features
 *  - logos (assets: icon.png / icon.ico / discord-presence.png / tiktok-profile.png) from tools\fork-assets,
 *    the "JR" text logos and window titles in the app and game pages -> the app name, and (through
 *    tools\game-mod\brand-update) the game's round JR button and JR window titles
 * A copy of each original file is kept in tools\fork-backup the first time, and
 *   node tools\fork-setup.js --undo
 * puts them back.
 */
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')
const FILES = ['package.json', 'src/main/index.js', 'src/config.js', 'src/ui/whats-new.json']
const LOGOS = ['assets/icon.png', 'assets/icon.ico', 'assets/discord-presence.png', 'assets/tiktok-profile.png']
// The "JR" text logos (and window titles) -> the app name. [file, from, to]; {N} = the app name.
const TEXT = [
  ['src/ui/app.html', '<title>JR</title>', '<title>{N}</title>'],
  ['src/ui/app.html', 'title="Open another profile">JR</button>', 'title="Open another profile">{N}</button>'],
  ['src/ui/app.html', 'font-size:22px;border-radius:16px">JR</div>', 'font-size:20px;border-radius:16px">{N}</div>'],
  ['src/ui/picker.html', '<title>JR</title>', '<title>{N}</title>'],
  ['src/ui/picker.html', 'font-size:10px;border-radius:6px">JR</div>', 'font-size:8px;border-radius:6px">{N}</div>'],
  ['src/ui/picker.html', 'opacity:0">JR</div>', 'opacity:0">{N}</div>'],
  ['src/ui/app.css', '.rail-logo { position: absolute; left: 15px; top: 12px; width: 30px; height: 30px; border: 0; font-size: 11px;', '.rail-logo { position: absolute; left: 15px; top: 12px; width: 30px; height: 30px; border: 0; font-size: 9px;'],
  // the first-start warning names both apps and Rante
  ['src/ui/picker.html', '<div class="lead">JR is an unofficial tool and is not affiliated with or endorsed by WildWorks. Using third-party software with Animal Jam may go against its Terms of Service and can result in your account being suspended or banned. This is uncommon, but it does happen, and JR cannot reverse it.</div>', '<div class="lead">JR and {N} are unofficial tools and are not affiliated with or endorsed by WildWorks. Using third-party software with Animal Jam may go against its Terms of Service and can result in your account being suspended or banned. This is uncommon, but it does happen, and JR and {N} cannot reverse it.</div>'],
  ['src/ui/picker.html', '<div>Use JR at your own risk.</div>', '<div>Use JR and {N} at your own risk.</div>'],
  ['src/ui/picker.html', '<div>BradysLabs and the JR team are not responsible for account suspensions, bans or lost items that result from using JR.</div>', '<div>BradysLabs, Rante, and the JR team are not responsible for account suspensions, bans or lost items that result from using JR or {N}.</div>'],
  ['src/discord/oauth.js', '<title>JR</title>', '<title>{N}</title>'],
  ['src/game/install.js', '<title>JR</title>', '<title>{N}</title>'],
  ['src/game/skin/jr-skin.js', "const want = name ? `JR \u00b7 ${name}` : 'JR'", "const want = name ? `{N} \u00b7 ${name}` : '{N}'"],
  ['src/game/skin/jr-skin.js', "const want = name ? `JR · ${name}` : 'JR'", "const want = name ? `{N} · ${name}` : '{N}'"],
  ['src/game/skin/jr-skin.js', '<div class="jr-logo">JR</div>', '<div class="jr-logo">{N}</div>'],
  ['src/game/skin/jr-ingame.js', "btn.append(dot, el('span', null, 'JR'))", "btn.append(dot, el('span', null, '{N}'))"],
  ['src/game/skin/jr-ingame.js', "const whoName = el('b', null, 'JR')", "const whoName = el('b', null, '{N}')"],
  ['src/game/skin/jr-ingame.js', "whoName.textContent = 'JR'", "whoName.textContent = '{N}'"],
  ['src/game/skin/jr-ingame.js', "head.append(el('div', 'logo', 'JR'), who, showJR, close)", "head.append(el('div', 'logo', '{N}'), who, showJR, close)"],
  ['src/game/surfaces/tools.js', "rows.push({ t: 'kv', k: 'JR', v:", "rows.push({ t: 'kv', k: '{N}', v:"],
  ['src/game/surfaces/tools.js', "return { title: 'JR', rows, foot:", "return { title: '{N}', rows, foot:"],
  // Discord sign-in keeps the JR logo (the JR server's logo); its text names both apps
  ['src/ui/picker.js', "'JR is for members of the JR Discord server. Sign in with Discord once and you’re set.'", "'JR and {N} are for members of the JR Discord server. Sign in with Discord once and you’re set.'"],
  ['src/ui/app.js', "'JR is for members of the JR Discord server.'", "'JR and {N} are for members of the JR Discord server.'"],
  // "JR window" wording members see -> "JRR window"
  ['src/ui/picker.html', 'Each profile opens in its own JR window with its own plugins and settings.', 'Each profile opens in its own {N} window with its own plugins and settings.'],
  ['src/profiles/store.js', "Close that profile\\'s JR window first.", "Close that profile\\'s {N} window first."],
  ['src/profiles/store.js', 'is already open in another JR window.', 'is already open in another {N} window.'],
  ['src/game/mod/build.js', "'another JR window is still building'", "'another {N} window is still building'"],
  ['src/game/skin/jr-ingame.js', "showJR.title = 'Open the JR window'", "showJR.title = 'Open the {N} window'"],
  ['src/game/skin/jr-ingame.js', "'JR isn’t answering. Is the JR window open?'", "'{N} isn’t answering. Is the {N} window open?'"],
  ['src/game/skin/jr-ingame.js', "items.push({ kind: 'JR', what: 'Open the JR window',", "items.push({ kind: '{N}', what: 'Open the {N} window',"],
  ['src/game/skin/jr-ingame.js', "items.push({ kind: 'JR', what: `Show ${label}`,", "items.push({ kind: '{N}', what: `Show ${label}`,"],
  // the app's own name and version: "JRR 0.1.0 - Made by Rante, based on JR by BradysLabs"
  ['src/ui/app.js', "row(`JR ${info.version}`, 'Made by BradysLabs. Not affiliated with WildWorks.',", "row(`{N} ${info.version}`, 'Made by Rante, based on JR by BradysLabs. Not affiliated with WildWorks.',"],
  ['src/ui/app.js', "`Everything new in JR ${info.version}.`", "`Everything new in {N} ${info.version}.`"],
  ['src/ui/app.js', "`What\\u2019s new in JR ${news.version}`", "`What\\u2019s new in {N} ${news.version}`"],
  ['src/ui/engine.js', "message: `JR ${info.version} (test build) · profile", "message: `{N} ${info.version} (test build) · profile"],
  ['src/discord/presence.js', "large_text: 'JR by BradysLabs'", "large_text: '{N} by Rante, based on JR by BradysLabs'"],
  ['src/main/index.js', "title: `JR · ${profile.name}`", "title: `{N} · ${profile.name}`"],
  ['src/main/index.js', "title: `JR ${latest} is out`", "title: `{N} ${latest} is out`"],
  ['src/main/index.js', "String(name || 'JR-bug-report.txt')", "String(name || '{N}-bug-report.txt')"],
  // the JR server's new invite link (same server, the old link expired)
  ['src/config.js', "invite: 'https://discord.gg/ENu6SpVrwn'", "invite: 'https://discord.gg/cPEkEnBNVX'"],
  ['src/game/skin/jr-skin.js', 'JR never sees your password.', '{N} never sees your password.'],
  ['src/ui/picker.html', "JR only sees your Discord name and whether you're in the JR server.", "{N} only sees your Discord name and whether you're in the JR server."],
  ['src/ui/engine.js', "notify: ({ title = 'JR', body = '', force = false } = {}) => {", "notify: ({ title = '{N}', body = '', force = false } = {}) => {"]
]
const TEXT_FILES = [...new Set(TEXT.map(t => t[0]))]
const at = (f) => path.join(root, f)
const backup = (f) => path.join(root, 'tools', 'fork-backup', f)

if (process.argv[2] === '--undo') {
  for (const f of FILES.concat(LOGOS, TEXT_FILES)) {
    const b = backup(f)
    if (fs.existsSync(b)) { fs.copyFileSync(b, at(f)); fs.rmSync(b); console.log('  put back ' + f) }
  }
  try { require('child_process').execFileSync(process.execPath, [path.join(root, 'tools', 'game-mod', 'brand-update', 'undo.js')], { stdio: 'inherit' }) } catch (_) {}
  console.log('Done.')
  process.exit(0)
}

const [name, owner, repo, versionArg] = process.argv.slice(2)
if (!name || !owner || !repo) {
  console.log('Usage: node tools\\fork-setup.js "<App name>" <GitHub user> <GitHub repo> [version]')
  process.exit(1)
}
if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,40}$/.test(name)) throw new Error('App name: letters, numbers, spaces, . _ - only (2-40 characters).')
if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) throw new Error('GitHub user / repo name look wrong.')
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

for (const f of FILES) if (!fs.existsSync(at(f))) throw new Error(f + ' is missing - run this from the JR folder (JR-main). Nothing was changed.')
for (const f of FILES) if (!fs.existsSync(backup(f))) { fs.mkdirSync(path.dirname(backup(f)), { recursive: true }); fs.copyFileSync(at(f), backup(f)) }
const read = (f) => fs.readFileSync(backup(f), 'utf8')   // always from the original, so running it again is safe

// package.json
const pkg = JSON.parse(read('package.json'))
const version = versionArg || pkg.version
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Version must look like 0.4.0')
pkg.name = slug
pkg.productName = name
pkg.version = version
pkg.description = `${name}: a fork of JR (by BradysLabs) for Animal Jam Classic.`
pkg.repository = { type: 'git', url: `https://github.com/${owner}/${repo}.git` }
pkg.build.appId = `com.${owner.toLowerCase().replace(/[^a-z0-9]/g, '')}.${slug.replace(/-/g, '')}`
pkg.build.productName = name
pkg.build.artifactName = `${slug}-setup-\${version}.\${ext}`
if (pkg.build.nsis) pkg.build.nsis.shortcutName = name
if (pkg.build.mac) pkg.build.mac.artifactName = `${slug}-\${version}-mac-\${arch}.\${ext}`
if (pkg.build.dmg) pkg.build.dmg.title = `${name} \${version}`
pkg.build.publish = { provider: 'github', owner, repo }
fs.writeFileSync(at('package.json'), JSON.stringify(pkg, null, 2) + '\n')
console.log(`  package.json: "${name}" ${version}, app id ${pkg.build.appId}, updates from github.com/${owner}/${repo}`)

// src/main/index.js: own settings folder
let main = read('src/main/index.js')
if (!main.includes("app.setName('JR')")) throw new Error("src/main/index.js has no app.setName('JR') - tell Claude. (package.json was already changed; run with --undo to put it back.)")
main = main.replace("app.setName('JR')", `app.setName(${JSON.stringify(name)})`)
fs.writeFileSync(at('src/main/index.js'), main)
console.log(`  settings folder: %APPDATA%\\${name}`)

// src/config.js: GitHub repo (the Discord part is left exactly as it is)
let cfg = read('src/config.js')
const re = /github:\s*\{\s*owner:\s*'[^']*',\s*repo:\s*'[^']*'\s*\}/
if (!re.test(cfg)) throw new Error('src/config.js looks different - tell Claude. (Run with --undo to put the other files back.)')
cfg = cfg.replace(re, `github: { owner: '${owner}', repo: '${repo}' }`)
fs.writeFileSync(at('src/config.js'), cfg)
console.log(`  config: GitHub ${owner}/${repo}; Discord check unchanged (JR Discord server)`)

// What's new
const news = JSON.parse(read('src/ui/whats-new.json'))
const entry = {
  fork: true,
  date: new Date().toISOString().slice(0, 7),
  items: [
    { title: `${name}`, text: 'Made by Rante, based on JR by BradysLabs, with the extra features below. It installs next to JR and keeps its own settings.' },
    { title: 'Recycle screen', text: 'Search, more ways to sort, Shift-click to pick a range, and the Presets button in the title bar.' },
    { title: 'My Shop', text: 'Pick several items and price them one after another, price-match buttons, gem prices rounded with a confirm.' },
    { title: 'Starred players', text: 'Star players on their card, add notes, see them in a Starred tab of your buddy list and with a star on their name tag.' },
    { title: 'JR Buttons setting', text: 'One switch in Settings hides every JR button in the game.' },
    { title: 'Special-animal pattern colors', text: 'Color each part of a special animal’s pattern, plus a basic / all colors button next to Glow.' },
    { title: 'Special animals in the Animal Buyer', text: 'Buy special animals with their diamond item; ones you owned before cost gems.' },
    { title: 'Masterpieces', text: 'Rante’s reworked Masterpiece Studio (layered format), Masterpiece User Transfer, and the Art Studio Picture button with a Quality slider.' },
    { title: 'Clothing tab', text: 'A tab on the player card showing what their animal is wearing.' },
    { title: 'Packet Spammer', text: 'Import / export, drag or ^ v to reorder, and edit any line in place.' },
    { title: 'Jam-A-Gram favourites', text: 'Star a background and an icon; new Jam-A-Grams start on them.' }
  ]
}
const out = { [version]: entry }
for (const k of Object.keys(news)) if (k !== version && news[k].fork) out[k] = news[k]
fs.writeFileSync(at('src/ui/whats-new.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`  What's new: entry for ${version}`)
// Logos: the same light rounded square with the new name (tools\fork-assets)
for (const f of LOGOS) {
  const from = path.join(root, 'tools', 'fork-assets', path.basename(f))
  if (!fs.existsSync(from) || !fs.existsSync(at(f))) continue
  if (!fs.existsSync(backup(f))) { fs.mkdirSync(path.dirname(backup(f)), { recursive: true }); fs.copyFileSync(at(f), backup(f)) }
  fs.copyFileSync(from, at(f))
}
console.log('  logos: icon, installer icon, Discord / TikTok pictures -> ' + name)

// Text logos and window titles
const done = new Set()
for (const f of TEXT_FILES) {
  if (!fs.existsSync(at(f))) { console.log('  (skipped ' + f + ': not found)'); continue }
  if (!fs.existsSync(backup(f))) { fs.mkdirSync(path.dirname(backup(f)), { recursive: true }); fs.copyFileSync(at(f), backup(f)) }
  // files the steps above already changed (from the original) are read as they are now
  let text = fs.readFileSync(FILES.includes(f) ? at(f) : backup(f), 'utf8')
  for (const [file, from, to] of TEXT) {
    if (file !== f || !text.includes(from)) continue
    text = text.split(from).join(to.split('{N}').join(name))
    done.add(file + '|' + from)
  }
  fs.writeFileSync(at(f), text)
}
const missed = TEXT.filter(t => !done.has(t[0] + '|' + t[1]) && !/\\u00b7/.test(t[1]) && !/ · /.test(t[1]))
console.log(`  text logos / titles -> ${name}` + (missed.length ? ` (${missed.length} not found - tell Claude: ${missed.map(t => t[0]).join(', ')})` : ''))

// The game's JR button and window titles (a game edit, like the other updates)
const brand = path.join(root, 'tools', 'game-mod', 'brand-update', 'install.js')
if (fs.existsSync(brand)) {
  try { require('child_process').execFileSync(process.execPath, [brand], { stdio: 'inherit' }) } catch (e) { console.log('  (game button rename failed - the rest is done; tell Claude)') }
}
console.log('Done. Next: npm install, then npm run build (see FORK-GUIDE.txt).')
