'use strict'

/**
 * Favorite items (JRR): items a player stars, shared by every JRR profile and
 * account on this computer (%APPDATA%\JRR\favorites.json). Each favorite
 * remembers the exact colour it was starred in (for its picture) and matches
 * that item in any colour unless "exact colour only" is ticked.
 *
 *   { items: [{ key, kind, defId, color, exact, account, name, at }],
 *     prefs: { thisAccountOnly, autoTrades } }
 *
 * kind is 'clothing' or 'den' (the game's 'c' / 'd' are accepted too).
 */

const fs = require('fs')
const path = require('path')

// 'c' clothing, 'd' den item; the key is the letter and the item number ("c1234"),
// the same key the game uses for its hover star.
const letter = (kind) => kind === 'd' || kind === 'den' ? 'd' : kind === 'c' || kind === 'clothing' ? 'c' : String(kind)
const kindName = (kind) => { const l = letter(kind); return l === 'd' ? 'den' : l === 'c' ? 'clothing' : String(kind) }
const keyOf = (kind, defId) => `${letter(kind)}${Number(defId)}`

function createFavorites (file) {
  let data = { items: [], prefs: {} }
  let mtime = 0
  const load = () => {
    try {
      const st = fs.statSync(file)
      if (st.mtimeMs === mtime) return
      mtime = st.mtimeMs
      const d = JSON.parse(fs.readFileSync(file, 'utf8'))
      data = { items: Array.isArray(d.items) ? d.items : [], prefs: d.prefs && typeof d.prefs === 'object' ? d.prefs : {} }
      for (const f of data.items) { f.kind = kindName(f.kind); f.key = keyOf(f.kind, f.defId) }
    } catch (_) {}
  }
  const save = () => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 1))
      fs.renameSync(file + '.tmp', file)
      mtime = fs.statSync(file).mtimeMs
    } catch (_) {}
  }
  const acct = (a) => String(a || '').toLowerCase()

  return {
    /** All favorites (or only the ones this account starred, when that's on). */
    list (account) {
      load()
      const only = !!data.prefs.thisAccountOnly && account
      return data.items.filter(f => !only || acct(f.account) === acct(account))
    },
    /** The favorite an item counts as, if any (any colour, unless exact colour is ticked). */
    match (kind, defId, color, account) {
      const k = keyOf(kind, defId)
      return this.list(account).find(f => f.key === k && (!f.exact || Number(f.color) >>> 0 === Number(color) >>> 0)) || null
    },
    has (kind, defId) { load(); return data.items.some(f => f.key === keyOf(kind, defId)) },
    /** Makes an item a favorite (on) or not. Returns whether anything changed. */
    set (item, on, account) {
      const now = this.has(item.kind, item.defId)
      if (now === !!on) return false
      this.toggle(item, account)
      return true
    },
    /** The keys the game marks ("c1234"), honoring "this account only". */
    keys (account) { return this.list(account).map(f => f.key) },
    remove (key) { load(); const i = data.items.findIndex(f => f.key === key); if (i >= 0) { data.items.splice(i, 1); save() } },
    get (key) { load(); return data.items.find(f => f.key === key) || null },
    /** Stars or unstars an item. Returns true when it's now a favorite. */
    toggle ({ kind, defId, color, name }, account) {
      load()
      const k = keyOf(kind, defId)
      const i = data.items.findIndex(f => f.key === k)
      if (i >= 0) { data.items.splice(i, 1); save(); return false }
      data.items.unshift({ key: k, kind: kindName(kind), defId: Number(defId), color: color == null ? null : Number(color) >>> 0, exact: false, account: acct(account), name: name || null, at: new Date().toISOString() })
      save()
      return true
    },
    setExact (kind, defId, exact) {
      load()
      const f = data.items.find(x => x.key === keyOf(kind, defId))
      if (f) { f.exact = !!exact; save() }
    },
    pref (k, d) { load(); return data.prefs[k] != null ? data.prefs[k] : d },
    setPref (k, v) { load(); data.prefs[k] = v; save() }
  }
}

/** One store for the whole app, kept on the application object. */
function shared (application, profileDir) {
  const holder = application || {}
  if (!holder.__jrrFavorites) {
    // profileDir is %APPDATA%\JRR\profiles\<name>; favorites live in %APPDATA%\JRR.
    const top = profileDir ? path.dirname(path.dirname(profileDir)) : '.'
    holder.__jrrFavorites = createFavorites(path.join(top, 'favorites.json'))
  }
  return holder.__jrrFavorites
}

module.exports = { createFavorites, shared, keyOf, letter, kindName }
