'use strict'

/**
 * Shop Explorer's saved dens, shared by its window in JRR and its window in
 * the game (src/game/surfaces/shop.js). One store per profile, kept on the
 * application object so both windows see the same dens, and saved in
 * <profile>/plugin-data/shop-explorer/dens.json.
 *
 *   { dens: { <owner, lowercase>: { name, shops: { <stand id>: { number, checkedAt, items: [...] } } } },
 *     prefs: { ... the in-game window's choices } }
 */

const fs = require('fs')
const path = require('path')

const MAX_DENS = 250
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function createDens (dir) {
  const file = path.join(dir, 'dens.json')
  let data = { dens: {}, prefs: {} }
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (d && typeof d === 'object') data = { dens: d.dens && typeof d.dens === 'object' ? d.dens : {}, prefs: d.prefs && typeof d.prefs === 'object' ? d.prefs : {} }
  } catch (_) {}
  let timer = null
  let version = 0
  const denTime = (d) => Math.max(0, ...Object.values(d.shops || {}).map(s => Date.parse(s.checkedAt) || 0))

  function save () {
    version++
    clearTimeout(timer)
    timer = setTimeout(() => {
      const keys = Object.keys(data.dens)
      if (keys.length > MAX_DENS) {
        keys.sort((a, b) => denTime(data.dens[b]) - denTime(data.dens[a]))
        for (const k of keys.slice(MAX_DENS)) delete data.dens[k]
      }
      try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(data)) } catch (_) {}
    }, 500)
  }

  /** Keeps what the den you're in has shown (My Shop Restocker's explorer() snapshot). */
  function record (snap) {
    if (!snap || !snap.owner) return
    const key = String(snap.owner).toLowerCase()
    const read = (snap.stands || []).filter(s => s.items && s.checkedAt)
    const known = data.dens[key]
    let changed = false
    const den = known || { name: snap.owner, shops: {} }
    if (read.length) {
      if (!known || den.name !== snap.owner) changed = true
      den.name = snap.owner
      for (const st of read) {
        const old = den.shops[st.id]
        if (old && old.checkedAt === st.checkedAt && old.number === st.number) continue
        den.shops[st.id] = {
          number: st.number,
          checkedAt: st.checkedAt,
          items: st.items.map(it => ({ kind: it.kind, defId: it.defId, color: it.color, cost: it.cost, currency: it.currency, name: it.name }))
        }
        changed = true
      }
    }
    // Stands that aren't in the den any more were picked up or moved away.
    if (known && snap.here && snap.stands && snap.stands.length) {
      for (const id of Object.keys(den.shops)) if (!snap.stands.some(s => String(s.id) === id)) { delete den.shops[id]; changed = true }
    }
    if (changed) { data.dens[key] = den; save() }
  }

  /**
   * Every saved item, filtered by den and age:
   * { here: owner key or null, hereOnly, maxAgeHours (0 = any age), onlyStand }
   */
  function items ({ here = null, hereOnly = false, maxAgeHours = 0, onlyStand = null } = {}) {
    const out = []
    const now = Date.now()
    for (const [key, den] of Object.entries(data.dens)) {
      if (hereOnly && key !== here) continue
      for (const [id, st] of Object.entries(den.shops || {})) {
        const standId = Number(id)
        if (onlyStand && (key !== here || onlyStand !== standId)) continue
        const at = Date.parse(st.checkedAt) || 0
        if (maxAgeHours && now - at > maxAgeHours * 3600 * 1000) continue
        ;(st.items || []).forEach((it, i) => {
          out.push({ ...it, den: key, owner: den.name || key, shop: st.number, standId, at, here: key === here, order: st.number * 1000 + i })
        })
      }
    }
    return out
  }

  return {
    record,
    items,
    has: (key) => !!data.dens[String(key || '').toLowerCase()],
    name: (key) => { const d = data.dens[String(key || '').toLowerCase()]; return d ? d.name : key },
    count: () => Object.keys(data.dens).length,
    forget (key) { delete data.dens[String(key || '').toLowerCase()]; save() },
    clear () { const n = Object.keys(data.dens).length; data.dens = {}; save(); return n },
    pref: (k, fallback) => Object.prototype.hasOwnProperty.call(data.prefs, k) ? data.prefs[k] : fallback,
    setPref (k, v) { data.prefs[k] = v; save() },
    get version () { return version },
    /** Brings in dens an earlier Shop Explorer kept in its plugin storage. */
    adopt (old) {
      if (!old || typeof old !== 'object' || Object.keys(data.dens).length) return
      for (const [k, d] of Object.entries(old)) if (d && d.shops) data.dens[k] = d
      save()
    }
  }
}

/** The store for this profile, made once and shared through the application object. */
function shared (application, dir) {
  if (application && application.shopExplorerDens) return application.shopExplorerDens
  const d = createDens(dir)
  if (application) application.shopExplorerDens = d
  return d
}

/** How the game is told to open a shop: JR's link to its in-game build. */
function gameLink (application) {
  return application && application.denPreviews && application.denPreviews.game
}

/** Opens a stand in the den you're in (JRR's in-game build, "os"). */
function openShop (application, standId) {
  const g = gameLink(application)
  if (!g || !g.ready()) throw new Error('JRR’s in-game features aren’t running, so it can’t open shops.')
  g.send('os', { id: Number(standId) })
}

/**
 * Goes to a den (the same packet as Recent Rooms), waits for it to load, then
 * opens the shop. Returns the den owner's name.
 */
async function goAndOpen ({ application, dispatch, api, joinPacket, name }, denKey, standId) {
  if (!joinPacket) throw new Error('Recent Rooms is missing, so JRR can’t go to dens.')
  const room = dispatch.getState('room')
  if (!room) throw new Error('Log in to Animal Jam first.')
  name = name || denKey
  await dispatch.sendRemoteMessage(joinPacket(room, 'den' + denKey))
  const until = Date.now() + 20000
  for (;;) {
    await sleep(400)
    const a = api()
    const s = a && a.explorer ? a.explorer() : null
    if (s && s.here && String(s.owner).toLowerCase() === denKey) {
      if (!s.stands.some(x => x.id === Number(standId))) throw new Error(`That shop isn’t in ${name}’s den any more.`)
      break
    }
    if (Date.now() > until) throw new Error(`Couldn’t get into ${name}’s den. It may be locked, or ${name} may be offline.`)
  }
  await sleep(2000) // let the den finish loading before the shop opens
  openShop(application, standId)
  return name
}

function ago (t) {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

module.exports = { createDens, shared, openShop, goAndOpen, ago }
