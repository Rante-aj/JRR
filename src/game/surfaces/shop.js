'use strict'

/**
 * Shops: My Shop Templates and Restocker (in your own My Shop), Shop Explorer
 * (in other players' shops), Recycle Tool (in the recycle screen) and Bulk
 * Buy (in the game's stores).
 */

const path = require('path')
const { every } = require('./timers')

const num = (n) => Number(n || 0).toLocaleString('en-US')
const money = (cost, currency) => `${num(cost)} ${Number(currency) === 3 ? 'Diamonds' : 'Gems'}`
const NEED_RESTOCKER = 'Turn on My Shop Restocker in JR’s Plugins. It keeps track of your shops.'

/* ------------------------------------------------------------- my shop */

const myShop = {
  id: 'myshop',
  plugin: 'shop-templates',
  buttons: [{ at: 'myshop', label: 'Shop Tools' }],
  init (ctx) {
    // Keep the window current while it's open (refills, sales).
    every(() => ctx.surfaces.refresh('myshop'), 3000)
  },
  view (state, ctx) {
    const api = ctx.shopApi()
    if (!api) return { title: 'My Shop Tools', rows: [{ t: 'p', c: 'warn', text: NEED_RESTOCKER }] }
    const snap = api.snapshot()
    const tab = state.tab || 'templates'
    const shopId = Number(state.ctx && state.ctx.shopId)
    const stand = snap.stands.find(s => s.id === shopId) || snap.stands[0]
    const rows = []
    if (tab === 'templates') {
      if (!stand) {
        rows.push({ t: 'p', c: 'dim', text: 'Go to your den once so JR can see your shops.' })
      } else {
        rows.push({ t: 'kv', k: 'Shop', v: stand.name })
        if (stand.count != null) rows.push({ t: 'kv', k: 'Items in it', v: num(stand.count) })
        rows.push({ t: 'in', id: 'rename', label: 'Rename this shop (only you see the name)', v: stand.named ? stand.name : '', go: 'Rename', max: 30 })
        rows.push({ t: 'in', id: 'save', label: 'Save what’s in this shop as a template', v: '', go: 'Save', max: 40 })
      }
      rows.push({ t: 'sep' })
      rows.push({ t: 'h', text: 'Templates' })
      if (!snap.templates.length) rows.push({ t: 'p', c: 'dim', text: 'No templates yet. Fill your shop, then save it above.' })
      for (const tpl of snap.templates) {
        const auto = stand && stand.auto && stand.auto.templateId === tpl.id
        rows.push({
          t: 'li',
          text: tpl.name,
          sub: `${tpl.items.length} item${tpl.items.length === 1 ? '' : 's'}${auto ? ' · refills when empty' : ''}`,
          sel: auto,
          btns: [
            { id: 'refill', label: 'Refill', style: 'primary', v: tpl.id },
            { id: 'auto', label: auto ? 'Auto: on' : 'Auto: off', style: auto ? 'on' : 'normal', v: tpl.id },
            { id: 'del', label: state.confirm === tpl.id ? 'Sure?' : 'Delete', style: 'danger', v: tpl.id }
          ]
        })
      }
      if (snap.busy) rows.push({ t: 'p', c: 'warn', text: 'Working…' })
      const recent = snap.activity.slice(0, 4)
      if (recent.length) {
        rows.push({ t: 'sep' })
        for (const a of recent) rows.push({ t: 'p', c: a.kind === 'bad' ? 'bad' : a.kind === 'good' ? 'ok' : 'dim', text: a.text })
      }
    } else {
      const t = snap.salesTotals
      const both = (b) => [b[0] ? `${num(b[0])} Gems` : null, b[3] ? `${num(b[3])} Diamonds` : null].filter(Boolean).join(' · ') || '—'
      rows.push({ t: 'kv', k: `Today (${t.today.count})`, v: both(t.today), c: 'ok' })
      rows.push({ t: 'kv', k: `This week (${t.week.count})`, v: both(t.week) })
      rows.push({ t: 'kv', k: `All (${t.all.count})`, v: both(t.all) })
      rows.push({ t: 'sep' })
      if (!snap.sales.length) rows.push({ t: 'p', c: 'dim', text: 'No sales yet. They show here while JR is running.' })
      for (const s of snap.sales.slice(0, 40)) {
        rows.push({ t: 'li', text: s.name || 'An item', sub: `${new Date(s.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${s.shop ? ` · ${s.shop}` : ''}`, right: money(s.cost, s.currency) })
      }
      if (snap.sales.length) rows.push({ t: 'btn', id: 'clearsales', label: state.confirmClear ? 'Press again to clear the list' : 'Clear sales list', style: 'danger' })
    }
    return { title: 'My Shop Tools', tabs: [{ id: 'templates', l: 'Templates' }, { id: 'sales', l: 'Sales' }], tab, rows, h: 330 }
  },
  async act (state, c, v, inputs, ctx) {
    const api = ctx.shopApi()
    if (!api) throw new Error(NEED_RESTOCKER)
    const snap = api.snapshot()
    const shopId = Number(state.ctx && state.ctx.shopId)
    const stand = snap.stands.find(s => s.id === shopId) || snap.stands[0]
    if (c !== 'del') state.confirm = null
    if (c !== 'clearsales') state.confirmClear = false
    if (c === 'clearsales') {
      if (!state.confirmClear) { state.confirmClear = true; return }
      state.confirmClear = false
      api.clearSales()
      return
    }
    if (!stand) throw new Error('Go to your den once so JR can see your shops.')
    if (c === 'rename') { api.renameShop(stand.id, v.trim()); return }
    if (c === 'save') {
      ctx.surfaces.toast('Reading your shop…')
      const tpl = await api.saveTemplate(stand.id, v.trim())
      ctx.surfaces.toast(`Saved “${tpl.name}”.`, 'ok')
      return
    }
    if (c === 'del') {
      if (state.confirm !== v) { state.confirm = v; return }
      state.confirm = null
      api.deleteTemplate(v)
      return
    }
    if (c === 'auto') {
      const on = stand.auto && stand.auto.templateId === v
      api.setAuto(stand.id, on ? '' : v, 'empty')
      ctx.surfaces.toast(on ? 'Automatic refills are off.' : 'Your shop will refill when it’s empty.', 'ok')
      return
    }
    if (c === 'refill') {
      ctx.surfaces.toast('Refilling your shop…')
      const r = await api.restock(stand.id, v)
      ctx.surfaces.toast(r.added ? `Added ${r.added} item${r.added === 1 ? '' : 's'}. Close and reopen your shop to see them.${r.missing && r.missing.length ? ` Missing: ${r.missing.length}.` : ''}`
        : r.full ? 'Your shop already matches that template.' : 'JR couldn’t refill the shop. Check JR’s Logs.', r.added ? 'ok' : 'warn')
    }
  }
}

/* --------------------------------------------------------- shop explorer */

const AGES = [{ v: '0', l: 'Any age' }, { v: '1', l: '1 hour' }, { v: '6', l: '6 hours' }, { v: '24', l: '1 day' }, { v: '72', l: '3 days' }, { v: '168', l: '1 week' }]
const explorerDens = (ctx) => {
  const D = require(path.join(ctx.root, 'plugins', 'shop-explorer', 'dens.js'))
  return { D, dens: D.shared(ctx.application, path.join(ctx.profileDir, 'plugin-data', 'shop-explorer')) }
}
const favStore = (ctx) => require(path.join(ctx.root, 'plugins', 'shop-explorer', 'favorites.js')).shared(ctx.application, ctx.profileDir)
const myName = (ctx) => String((ctx.dispatch.getState('player') || {}).userName || '').toLowerCase()

/*
 * Background scanning: every den you go into that isn't yours gets its shops
 * read quietly, whether or not Shop Explorer is open. What's been read is
 * kept even if the scan is cut short (you leave, or it's stopped). A
 * favorite found in this den's shops brings up the "favorite found" window
 * once per item per visit.
 */
const auto = { visitAt: null, seenAt: 0, running: false, alerted: new Set(), alertVisit: null }
const AUTO_SETTLE = 2500 // let the den finish loading before the first shop request

function autoTick (ctx) {
  const api = ctx.shopApi()
  if (!api || !api.explorer) return
  if (ctx.surfaceEnabled && !ctx.surfaceEnabled('explorer')) return
  const { dens } = explorerDens(ctx)
  const ex = api.explorer()
  try { dens.record(ex) } catch (_) {}
  if (!ex.owner || !ex.here) { auto.seenAt = 0; return }
  const owner = String(ex.owner).toLowerCase()
  const me = myName(ctx)
  if (!me || owner === me) return // never your own den
  checkFavorites(ctx, ex, owner)
  if (auto.running || ex.scan || !ex.stands.length) return
  if (auto.visitAt === ex.at) return // this visit is done (or was stopped)
  if (!dens.pref('game.autoScan', true)) return
  if (!auto.seenAt) { auto.seenAt = Date.now(); return }
  if (Date.now() - auto.seenAt < AUTO_SETTLE) return
  auto.visitAt = ex.at
  auto.running = true
  ctx.log({ type: 'notify', message: `Shop Explorer: reading ${ex.stands.length} shop${ex.stands.length === 1 ? '' : 's'} in ${ctx.mask(ex.owner)}’s den.` })
  Promise.resolve().then(() => api.scanDen()).catch(() => {}).then(() => {
    auto.running = false
    try { dens.record(api.explorer()) } catch (_) {}
    try { checkFavorites(ctx, api.explorer(), owner) } catch (_) {}
    ctx.surfaces.refresh('explorer')
  })
}

function checkFavorites (ctx, ex, owner) {
  if (auto.alertVisit !== ex.at) { auto.alertVisit = ex.at; auto.alerted = new Set() }
  let favs
  try { favs = favStore(ctx) } catch (_) { return }
  if (!favs.pref('shopPopups', true)) return // hidden in the inventory's Favorites tab
  const me = myName(ctx)
  const found = []
  for (const st of ex.stands) {
    for (const it of st.items || []) {
      if (it.kind === 'pet') continue
      if (!favs.match(it.kind, it.defId, it.color, me)) continue
      const key = `${st.id}|${it.kind}|${it.defId}|${it.color}`
      if (auto.alerted.has(key)) continue
      auto.alerted.add(key)
      found.push({ standId: st.id, shop: st.number, kind: it.kind, defId: it.defId, color: it.color, cost: it.cost, currency: it.currency, name: it.name })
    }
  }
  if (!found.length) return
  const s = ctx.surfaces.state('favfound')
  const same = s.ctx && s.ctx.visit === ex.at && ctx.surfaces.isOpen('favfound')
  const list = (same ? s.ctx.found : []).concat(found)
  ctx.surfaces.open('favfound', { visit: ex.at, owner: ex.owner, found: list })
}

const explorer = {
  id: 'explorer',
  plugin: 'shop-explorer',
  buttons: [{ at: 'shopview', label: 'All Shops Here' }],
  init (ctx) {
    // Keep every den's scans (shared with the Shop Explorer window in JRR).
    // Also reads other players' dens on its own (autoTick above).
    every(() => {
      try { autoTick(ctx) } catch (_) {}
      ctx.surfaces.refresh('explorer')
    }, 2000)
  },
  view (state, ctx) {
    const api = ctx.shopApi()
    if (!api) return { title: 'Shop Explorer', rows: [{ t: 'p', c: 'warn', text: NEED_RESTOCKER }] }
    const { D, dens } = explorerDens(ctx)
    const ex = api.explorer()
    dens.record(ex)
    const pricer = ctx.pricer()
    const here = ex.owner && ex.here ? String(ex.owner).toLowerCase() : null
    const pref = (k, d) => state[k] != null ? state[k] : dens.pref('game.' + k, d)
    const hereOnly = !!pref('hereOnly', false)
    const age = String(pref('age', '24'))
    const sort = pref('sort', 'deal')
    const favOnly = !!pref('favOnly', false)
    const autoScan = !!pref('autoScan', true)
    let favs = null
    try { favs = favStore(ctx) } catch (_) {}
    const me = myName(ctx)
    const rows = []
    if (here) {
      rows.push({ t: 'kv', k: 'Den', v: `${ctx.mask(ex.owner)} · ${ex.stands.length} shop${ex.stands.length === 1 ? '' : 's'}` })
      if (ex.scan) {
        rows.push({ t: 'p', c: 'warn', text: `Checking shop ${Math.min(ex.scan.done + 1, ex.scan.total)} of ${ex.scan.total}…` })
        rows.push({ t: 'btn', id: 'stop', label: 'Stop', style: 'danger' })
      } else if (ex.stands.length) {
        rows.push({ t: 'btn', id: 'scan', label: ex.stands.some(s => s.items) ? 'Scan again' : 'Scan every shop here', style: 'primary' })
      }
    } else {
      rows.push({ t: 'p', c: 'dim', text: dens.count() ? 'Go into a den with My Shops to scan it. Your saved dens are below.' : 'Go into a den that has My Shops, then press Scan.' })
    }
    rows.push({ t: 'in', id: 'q', label: 'Search every saved den', v: state.q || '', go: 'Find' })
    rows.push({ t: 'chips', id: 'sort', v: sort, opts: [{ v: 'deal', l: 'Best deals' }, { v: 'recent', l: 'Recent' }, { v: 'cheap', l: 'Cheapest' }, { v: 'shop', l: 'By shop' }] })
    rows.push({ t: 'tog', id: 'hereOnly', label: 'This den only', v: hereOnly })
    if (favs) rows.push({ t: 'tog', id: 'favOnly', label: 'Favorites only', sub: `${favs.list(me).length} favorite${favs.list(me).length === 1 ? '' : 's'}`, v: favOnly })
    rows.push({ t: 'tog', id: 'autoScan', label: 'Scan other dens automatically', sub: 'Reads the shops in every den you visit (never your own)', v: autoScan })
    rows.push({ t: 'chips', id: 'age', label: 'Hide shops older than', v: age, opts: AGES })
    let match = null
    if (state.q) { try { match = require(path.join(ctx.root, 'src', 'game', 'search.js')).itemMatcher(state.q) } catch (_) {} }
    const all = []
    for (const it of dens.items({ here, hereOnly, maxAgeHours: Number(age) || 0 })) {
      if (it.kind === 'pet') continue
      const v = pricer.value({ kind: it.kind, id: it.defId, color: it.color == null ? null : Number(it.color) >>> 0 })
      const name = v.name || it.name || `Item #${it.defId}`
      if (match && !match(name, it.defId)) continue
      const fav = favs ? !!favs.match(it.kind, it.defId, it.color, me) : false
      if (favOnly && !fav) continue
      const worth = v.diamonds ? (v.diamonds.min + v.diamonds.max) / 2 : null
      const deal = worth && Number(it.currency) === 3 && it.cost ? worth / it.cost : null
      all.push({ ...it, name, colorName: v.color, worth: v.diamonds, deal, fav })
    }
    const denOrder = (a, b) => (a.here === b.here ? 0 : a.here ? -1 : 1) || a.owner.localeCompare(b.owner) || a.order - b.order
    all.sort(sort === 'shop' ? denOrder : sort === 'cheap' ? (a, b) => a.cost - b.cost || denOrder(a, b) : sort === 'recent' ? (a, b) => b.at - a.at || denOrder(a, b) : (a, b) => (b.deal || 0) - (a.deal || 0) || a.cost - b.cost)
    const busy = !!ex.scan || !!state.going
    if (!all.length) {
      rows.push({ t: 'p', c: 'dim', text: !dens.count() && !(ex.stands || []).some(s => s.items) ? 'Press Scan to see what’s for sale.' : favOnly ? 'None of your favorites are in the saved shops (with these filters).' : hereOnly && !here ? 'You’re not in a den. Turn off “This den only” to search your saved dens.' : 'Nothing matches. Try “Any age” or another search.' })
    }
    for (const it of all.slice(0, 80)) {
      rows.push({
        t: 'li',
        text: it.name,
        sel: it.fav,
        sub: [it.fav ? 'Favorite' : null, it.colorName, `${it.here ? 'here' : ctx.mask(it.owner)} · shop ${it.shop}`, it.worth ? `worth ${pricer.format(it.worth, { bl: false }).replace('≈ ', '')}` : null, D.ago(it.at)].filter(Boolean).join(' · '),
        right: money(it.cost, it.currency),
        rc: it.deal == null ? 'dim' : it.deal >= 1.2 ? 'ok' : it.deal < 0.8 ? 'bad' : 'warn',
        btns: [
          ...(favs ? [{ id: 'fav', label: it.fav ? 'Unfav' : 'Fav', style: it.fav ? 'on' : 'normal', v: `${it.kind}|${it.defId}|${it.color == null ? '' : it.color}` }] : []),
          ...(busy ? [] : [{ id: it.here ? 'open' : 'go', label: it.here ? 'Open' : 'Go', v: `${it.den}|${it.standId}` }])
        ]
      })
    }
    const total = all.length
    return { title: 'Shop Explorer', rows, foot: `${total > 80 ? `First 80 of ${total}. ` : ''}Open shows the shop; Go takes you to that den first. Green prices are below the wiki value.`, h: 360 }
  },
  async act (state, c, v, inputs, ctx) {
    const api = ctx.shopApi()
    if (!api) throw new Error(NEED_RESTOCKER)
    const { D, dens } = explorerDens(ctx)
    if (c === 'q') { state.q = String(v || '').trim(); return }
    if (c === 'sort' || c === 'age') { state[c] = v; dens.setPref('game.' + c, v); return }
    if (c === 'hereOnly') { state.hereOnly = v === '1'; dens.setPref('game.hereOnly', state.hereOnly); return }
    if (c === 'favOnly' || c === 'autoScan') { state[c] = v === '1'; dens.setPref('game.' + c, state[c]); return }
    if (c === 'fav') {
      const [kind, defId, color] = String(v).split('|')
      let name = null
      try { name = ctx.pricer().value({ kind, id: Number(defId), color: color === '' ? null : Number(color) >>> 0 }).name } catch (_) {}
      const on = favStore(ctx).toggle({ kind, defId, color: color === '' ? null : color, name }, myName(ctx))
      syncFavs(ctx, true)
      ctx.surfaces.refresh('favorites')
      ctx.surfaces.toast(on ? `${name || 'Item'} is now a favorite (any color).` : `${name || 'Item'} isn’t a favorite any more.`, 'ok')
      return
    }
    if (c === 'stop') { api.stopScan(); return }
    if (c === 'scan') {
      api.scanDen().then(r => {
        ctx.surfaces.toast(`Scanned ${r.shops} shop${r.shops === 1 ? '' : 's'}: ${r.items} item${r.items === 1 ? '' : 's'} for sale.`, 'ok')
        ctx.surfaces.refresh('explorer')
      }).catch(e => ctx.surfaces.toast(e.message, 'bad'))
      return
    }
    if (c === 'open' || c === 'go') {
      const [den, id] = String(v).split('|')
      if (c === 'open') { D.openShop(ctx.application, Number(id)); return }
      let joinPacket = null
      try { joinPacket = require(path.join(ctx.root, 'plugins', 'recent-rooms', 'rooms.js')).joinPacket } catch (_) {}
      const name = dens.name(den)
      state.going = true
      ctx.surfaces.toast(`Going to ${ctx.mask(name)}’s den…`)
      D.goAndOpen({ application: ctx.application, dispatch: ctx.dispatch, api: ctx.shopApi, joinPacket, name }, den, Number(id))
        .catch(e => ctx.surfaces.toast(e.message, 'bad'))
        .then(() => { state.going = false; ctx.surfaces.refresh('explorer') })
    }
  }
}

/* ---------------------------------------------------------- recycle tool */

const recycleTool = {
  id: 'recycle',
  plugin: 'recycle-tool',
  buttons: [{ at: 'recycle', label: 'Presets' }],
  _presets (ctx) {
    const store = ctx.surfaces.store('recycle-tool')
    let presets = store.get('presets', [])
    if (!Array.isArray(presets)) presets = []
    let current = store.get('current', null)
    if (!presets.length) { presets = [{ id: 'p1', name: 'My preset', items: [] }]; current = 'p1' }
    const preset = presets.find(p => p.id === current) || presets[0]
    return { store, presets, preset, save: () => { store.set('presets', presets); store.set('current', preset.id) } }
  },
  view (state, ctx) {
    const api = ctx.shopApi()
    if (!api) return { title: 'Recycle Presets', rows: [{ t: 'p', c: 'warn', text: NEED_RESTOCKER }] }
    const { presets, preset } = this._presets(ctx)
    const plan = api.planRecycle(preset.items)
    const rs = api.recycleSnapshot()
    const rows = []
    rows.push({ t: 'chips', id: 'preset', label: 'Preset', v: preset.id, opts: presets.map(p => ({ v: p.id, l: `${p.name} (${p.items.length})` })) })
    rows.push({ t: 'in', id: 'newpreset', label: 'New preset', v: '', go: 'Add', max: 40 })
    rows.push({ t: 'sep' })
    if (!preset.items.length) rows.push({ t: 'p', c: 'dim', text: 'This preset is empty. Add items you own below.' })
    const by = new Map(plan.byEntry.map(e => [`${e.kind}:${e.defId}`, e]))
    preset.items.forEach((it, i) => {
      const e = by.get(`${it.kind}:${it.defId}`) || { owned: 0, safe: 0, recycle: 0 }
      const name = (e.name && !/#\d+$/.test(e.name)) ? e.name : (ctx.items.name(it.defId, it.kind) || `Item #${it.defId}`)
      rows.push({
        t: 'li',
        text: name,
        sub: `have ${e.owned}${e.owned - e.safe ? ` (${e.owned - e.safe} worn/in shop, never recycled)` : ''} · keep ${it.keep || 0} · recycles ${e.recycle}`,
        btns: [{ id: 'keepless', label: '-', v: String(i) }, { id: 'keepmore', label: '+', v: String(i) }, { id: 'remove', label: 'X', style: 'danger', v: String(i) }]
      })
    })
    rows.push({ t: 'sep' })
    if (rs.running) {
      rows.push({ t: 'p', c: 'warn', text: `Recycling ${rs.running.done} of ${rs.running.total}…` })
      rows.push({ t: 'btn', id: 'stop', label: 'Stop', style: 'danger' })
    } else {
      rows.push({ t: 'btn', id: 'run', label: state.confirm ? `Press again to recycle ${plan.recycle.length} item${plan.recycle.length === 1 ? '' : 's'}` : `Recycle ${plan.recycle.length} item${plan.recycle.length === 1 ? '' : 's'} now`, style: state.confirm ? 'danger' : 'primary' })
    }
    rows.push({ t: 'tog', id: 'auto', label: 'Recycle these as they arrive', sub: rs.auto ? `On for “${rs.auto.name}”` : 'For farming: matching items are recycled as soon as you get them.', v: !!rs.auto })
    rows.push({ t: 'sep' })
    rows.push({ t: 'in', id: 'q', label: 'Add something you own', v: state.q || '', go: 'Find' })
    const q = String(state.q || '').toLowerCase().trim()
    if (q) {
      const inPreset = new Set(preset.items.map(it => `${it.kind}:${it.defId}`))
      const inv = api.inventory()
      const hits = inv.items.filter(x => !inPreset.has(`${x.kind}:${x.defId}`) && String(x.name).toLowerCase().includes(q)).slice(0, 20)
      if (!hits.length) rows.push({ t: 'p', c: 'dim', text: 'Nothing you own matches.' })
      for (const x of hits) rows.push({ t: 'li', text: x.name, sub: `${x.kind === 'den' ? 'den item' : 'clothing'} · ${x.owned} owned`, btns: [{ id: 'add', label: 'Add', style: 'primary', v: `${x.kind}:${x.defId}` }] })
    }
    if (rs.log.length) {
      rows.push({ t: 'sep' })
      for (const l of rs.log.slice(0, 3)) rows.push({ t: 'p', c: 'dim', text: `${l.label || 'Recycled'}: ${l.count} item${l.count === 1 ? '' : 's'}${l.what ? ` (${l.what})` : ''}` })
    }
    return { title: 'Recycle Presets', rows, h: 330 }
  },
  async act (state, c, v, inputs, ctx) {
    const api = ctx.shopApi()
    if (!api) throw new Error(NEED_RESTOCKER)
    const p = this._presets(ctx)
    if (c !== 'run') state.confirm = false
    if (c === 'preset') { p.store.set('current', v); return }
    if (c === 'newpreset') {
      const id = `p${Date.now().toString(36)}`
      p.presets.push({ id, name: (v.trim() || `Preset ${p.presets.length + 1}`).slice(0, 40), items: [] })
      p.store.set('presets', p.presets); p.store.set('current', id)
      return
    }
    if (c === 'q') { state.q = v; return }
    if (c === 'add') {
      const [kind, defId] = v.split(':')
      p.preset.items.push({ kind, defId: Number(defId), keep: 0 })
      p.save()
      return
    }
    if (c === 'keepless' || c === 'keepmore' || c === 'remove') {
      const it = p.preset.items[Number(v)]
      if (!it) return
      if (c === 'remove') p.preset.items.splice(Number(v), 1)
      else it.keep = Math.max(0, (Number(it.keep) || 0) + (c === 'keepmore' ? 1 : -1))
      p.save()
      return
    }
    if (c === 'stop') { api.stopRecycle(); return }
    if (c === 'auto') {
      const on = !!api.recycleSnapshot().auto
      if (!on && !p.preset.items.length) throw new Error('Add items to the preset first.')
      api.setAutoRecycle(on ? null : { name: p.preset.name, entries: p.preset.items })
      return
    }
    if (c === 'run') {
      const plan = api.planRecycle(p.preset.items)
      if (!plan.recycle.length) throw new Error('Nothing in this preset can be recycled right now.')
      if (!state.confirm) { state.confirm = true; return }
      state.confirm = false
      api.recycleNow(p.preset.items, p.preset.name)
        .then(r => ctx.surfaces.toast(r.recycled ? `Recycled ${r.recycled} item${r.recycled === 1 ? '' : 's'}.` : 'Nothing to recycle.', 'ok'))
        .catch(e => ctx.surfaces.toast(e.message, 'bad'))
        .then(() => ctx.surfaces.refresh('recycle'))
    }
  }
}

/* -------------------------------------------------------------- bulk buy */

const bulkBuy = {
  id: 'bulkbuy',
  plugin: 'bulk-buy',
  buttons: [{ at: 'shop', label: 'Buy More' }],
  init (ctx) {
    const { BulkBuyer } = require(path.join(ctx.root, 'plugins', 'bulk-buy', 'bulk.js'))
    this.buyer = new BulkBuyer({ dispatch: ctx.dispatch, onChange: () => ctx.surfaces.refresh('bulkbuy') })
  },
  view (state, ctx) {
    const b = this.buyer
    const rows = []
    const p = b.last
    if (!p) {
      rows.push({ t: 'p', c: 'dim', text: 'Buy one of something in this store first. Then JR can buy more of exactly that item and color.' })
    } else {
      rows.push({ t: 'kv', k: 'Last bought', v: ctx.items.name(p.defId, p.kind) || `Item #${p.defId}` })
      if (b.run) {
        rows.push({ t: 'p', c: 'warn', text: `Bought ${b.run.done} of ${b.run.total}…` })
        rows.push({ t: 'btn', id: 'stop', label: 'Stop', style: 'danger' })
      } else {
        // JRR: type any number (up to 999), or pick one.
        rows.push({ t: 'in', id: 'count', label: 'How many more (type a number, up to 999)', v: String(state.count || 5), go: 'Set', max: 3 })
        rows.push({ t: 'row', items: [5, 10, 25, 50, 100].map(n => ({ id: 'count', label: String(n), v: String(n) })) })
        rows.push({ t: 'btn', id: 'buy', label: `Buy ${state.count || 5} more`, style: 'primary' })
      }
    }
    if (state.result) rows.push({ t: 'p', c: state.result.c, text: state.result.text })
    return { title: 'Buy More', rows }
  },
  async act (state, c, v, inputs, ctx) {
    const howMany = (x) => Math.max(1, Math.min(999, Math.floor(Number(String(x).replace(/[^0-9]/g, '')) || 1))) // JRR
    if (c === 'count') { state.count = howMany(v); return }
    if (c === 'stop') { this.buyer.stop(); return }
    if (c === 'buy') {
      if (inputs && inputs.count != null && String(inputs.count).trim()) state.count = howMany(inputs.count) // JRR: the typed number, even without Set
      state.result = null
      this.buyer.buy(state.count || 5)
        .then(r => {
          state.result = r.refused
            ? { c: 'warn', text: `Bought ${r.done}. Then the store said no (usually not enough Gems or Diamonds).` }
            : { c: 'ok', text: `Bought ${r.done}.${r.balance != null ? ` Balance: ${num(r.balance)}.` : ''} Reopen your inventory to see them.` }
        })
        .catch(e => { state.result = { c: 'bad', text: e.message } })
        .then(() => ctx.surfaces.refresh('bulkbuy'))
    }
  }
}

/* ------------------------------------------------- favorite found popup */

const favFound = {
  id: 'favfound',
  plugin: 'shop-explorer',
  buttons: [],
  view (state, ctx) {
    const c = state.ctx || {}
    const found = c.found || []
    const pricer = ctx.pricer()
    const nameOf = (f) => {
      try { return pricer.value({ kind: f.kind, id: f.defId, color: f.color == null ? null : Number(f.color) >>> 0 }).name || f.name } catch (_) { return f.name }
    }
    const rows = []
    if (found.length === 1) {
      const f = found[0]
      rows.push({ t: 'p', text: `Your favorite ${nameOf(f) || 'item'} is for sale in shop ${f.shop} for ${money(f.cost, f.currency)}.` })
      rows.push({ t: 'p', text: 'Do you want to open it?' })
      rows.push({ t: 'row', items: [{ id: 'open', label: 'Open', style: 'primary', v: String(f.standId) }, { id: 'close', label: 'Close', style: 'danger' }] })
    } else {
      rows.push({ t: 'p', text: `${found.length} of your favorites are for sale here. Open one?` })
      for (const f of found.slice(0, 12)) {
        rows.push({ t: 'li', text: nameOf(f) || `Item #${f.defId}`, sub: `shop ${f.shop}`, right: money(f.cost, f.currency), btns: [{ id: 'open', label: 'Open', style: 'primary', v: String(f.standId) }] })
      }
      rows.push({ t: 'btn', id: 'close', label: 'Close', style: 'danger' })
    }
    return { title: 'Favorite found', sub: c.owner ? `${ctx.mask(c.owner)}’s den` : '', rows, h: found.length === 1 ? 150 : 300 }
  },
  act (state, c, v, inputs, ctx) {
    if (c === 'close') { ctx.surfaces.close('favfound'); return }
    if (c === 'open') {
      const { D } = explorerDens(ctx)
      const api = ctx.shopApi()
      const ex = api && api.explorer()
      if (!ex || !ex.here || ex.at !== (state.ctx || {}).visit) throw new Error('You left that den.')
      D.openShop(ctx.application, Number(v))
      ctx.surfaces.close('favfound')
    }
  }
}

/* ------------------------------------------------- favorites (inventory tab) */

// The game marks favorites with its hover star: it gets the keys ("c1234")
// when you join a room and whenever they change.
let lastFavKeys = null
// Trade lists seen this session (opened by hand or checked automatically): user → items.
const tradeSeen = new Map()

/** A trade list reply (%xt%tl%-1%<user>%<n>%<id>%<slot>%<color>…%<n>%<id>%<slot>%<version>%…%): another player's clothing and den items. */
function parseTradeList (raw) {
  const p = String(raw || '').split('%')
  if (p[2] !== 'tl' || !p[4]) return null
  const items = []
  let i = 5
  const nc = parseInt(p[i++], 10) || 0
  for (let k = 0; k < nc && i + 2 < p.length; k++, i += 3) items.push({ kind: 'clothing', defId: Number(p[i]), color: Number(p[i + 2]) >>> 0 })
  const nd = parseInt(p[i++], 10) || 0
  for (let k = 0; k < nd && i + 2 < p.length; k++, i += 7) items.push({ kind: 'den', defId: Number(p[i]), color: Number(p[i + 2]) >>> 0 })
  return { user: p[4], items }
}

/** Every favorite in a seen trade list, one entry per copy: {u, k, id, c, n} (n counts copies). */
function favMatches (ctx) {
  let favs
  try { favs = favStore(ctx) } catch (_) { return [] }
  const me = myName(ctx)
  const out = []
  for (const [user, seen] of tradeSeen) {
    if (user === me) continue
    const count = {}
    for (const it of seen.items) {
      if (!favs.match(it.kind, it.defId, it.color, me)) continue
      const k = it.kind === 'den' ? 'd' : 'c'
      const key = `${k}${it.defId}_${it.color}`
      count[key] = (count[key] || 0) + 1
      out.push({ u: seen.name || user, k, id: it.defId, c: it.color, n: count[key] })
    }
  }
  return out
}

/** Players (seen trade lists) with at least one favorite, lowercased. */
function favPlayers (ctx) {
  let favs
  try { favs = favStore(ctx) } catch (_) { return [] }
  const me = myName(ctx)
  const out = []
  for (const [user, seen] of tradeSeen) {
    if (user === me) continue
    if (seen.items.some(it => favs.match(it.kind, it.defId, it.color, me))) out.push(user)
  }
  return out
}

function syncFavs (ctx, force) {
  let favs, list
  try { favs = favStore(ctx); list = favs.list(myName(ctx)) } catch (_) { return }
  const glow = favPlayers(ctx)
  const matches = favMatches(ctx)
  const auto = favs.pref('autoTrades', false) ? 1 : 0
  const text = list.map(f => `${f.key}_${f.color}_${f.exact ? 1 : 0}`).join(',') + '|' + matches.map(m => `${m.u}:${m.k}${m.id}_${m.c}_${m.n}`).join(',') + '|' + auto
  if (!force && text === lastFavKeys) return
  lastFavKeys = text
  // k: what the hover star marks; l: what the Favorites tab shows (newest first, in the starred
  // color; e = exact color only); g: players whose trade list has a favorite; m: each favorite
  // in a seen trade list (the trade button's list shows the ones whose player is in the room);
  // a: check trades automatically.
  ctx.surfaces.game('f', {
    k: list.map(f => f.key),
    l: list.map(f => ({ key: f.key, k: f.kind === 'den' ? 'd' : 'c', id: f.defId, c: f.color == null ? 0 : Number(f.color) >>> 0, e: f.exact ? 1 : 0 })),
    g: glow,
    m: matches,
    a: auto
  })
}

const favPic = (f) => f.kind === 'den' ? { k: 'd', id: f.defId, v: f.color == null ? 0 : f.color } : { k: 'c', id: f.defId, c: f.color == null ? 0 : f.color }

const favorites = {
  id: 'favorites',
  buttons: [],
  init (ctx) {
    try { ctx.dispatch.onMessage({ type: 'aj', message: 'rj', callback: () => { setTimeout(() => syncFavs(ctx, true), 500) } }) } catch (_) {}
    // Every trade list that arrives (a player card opened by hand, or JR's automatic checks).
    const raw = (pl) => { const m = pl && pl.message; if (!m) return ''; if (typeof m === 'string') return m; if (typeof m.raw === 'string') return m.raw; try { return String(m.toMessage()) } catch (_) { return '' } }
    try {
      ctx.dispatch.onMessage({ type: 'aj', message: 'tl', callback: (pl) => {
        const t = parseTradeList(raw(pl))
        if (!t || t.user.toLowerCase() === myName(ctx)) return
        tradeSeen.set(t.user.toLowerCase(), { at: Date.now(), name: t.user, items: t.items })
        syncFavs(ctx, false)
        ctx.surfaces.refresh('favorites')
      } })
    } catch (_) {}
    every(() => syncFavs(ctx, false), 3000)
  },
  view (state, ctx) {
    const favs = favStore(ctx)
    const n = favs.list(myName(ctx)).length
    return {
      title: 'Favorites settings',
      w: 300,
      rows: [
        { t: 'kv', k: 'Favorites shown', v: String(n) },
        { t: 'tog', id: 'mine', label: 'This account only', sub: 'Off: favorites from every account', v: !!favs.pref('thisAccountOnly', false) },
        { t: 'tog', id: 'nopopups', label: 'Hide “found in a shop” popups', v: !favs.pref('shopPopups', true) },
        { t: 'tog', id: 'auto', label: 'Check trades automatically', sub: 'Looks at one more player’s trade list every 2–3 seconds', v: !!favs.pref('autoTrades', false) },
        { t: 'kv', k: 'Trade lists seen', v: String(tradeSeen.size) },
        { t: 'kv', k: 'Players with your favorites', v: favPlayers(ctx).map(u => ctx.mask(u)).join(', ') || 'none yet' }
      ],
      foot: 'Click a favorite in the tab for its options.'
    }
  },
  act (state, c, v, inputs, ctx) {
    const favs = favStore(ctx)
    const me = myName(ctx)
    if (c === 'mine') { favs.setPref('thisAccountOnly', v === '1'); syncFavs(ctx, true); return }
    if (c === 'nopopups') { favs.setPref('shopPopups', v !== '1'); return }
    if (c === 'auto') { favs.setPref('autoTrades', v === '1'); syncFavs(ctx, true); return }
    if (c === 'star') {
      // The star on a hovered item (any game screen): i = {k, id, c, n, on}.
      const kind = inputs.k === 'd' ? 'den' : 'clothing'
      const defId = Number(inputs.id)
      if (!defId) return
      favs.set({ kind, defId, color: inputs.c, name: inputs.n || null }, String(inputs.on) === '1', me)
      syncFavs(ctx, true)
      ctx.surfaces.refresh('favorites')
      ctx.surfaces.refresh('explorer')
      return
    }
    if (c.startsWith('it:')) { ctx.surfaces.open('favitem', { key: c.slice(3) }); return }
  }
}

// The small window for one favorite: exact color, or remove it.
const favItem = {
  id: 'favitem',
  buttons: [],
  view (state, ctx) {
    const f = favStore(ctx).get((state.ctx || {}).key)
    if (!f) return { title: 'Favorite', rows: [{ t: 'p', c: 'dim', text: 'That isn’t a favorite any more.' }], w: 260, h: 120 }
    let name = f.name
    try { name = ctx.pricer().value({ kind: f.kind, id: f.defId, color: f.color == null ? null : Number(f.color) >>> 0 }).name || name } catch (_) {}
    return {
      title: 'Favorite',
      w: 270,
      h: 190,
      rows: [
        { t: 'li', ic: favPic(f), text: name || `Item #${f.defId}`, sub: 'Shown in the color you starred' },
        { t: 'tog', id: 'exact', label: 'Exact color only', sub: 'Off: this item in any color counts', v: !!f.exact },
        { t: 'row', items: [{ id: 'remove', label: 'Remove', style: 'danger' }, { id: 'close', label: 'Close', style: 'normal' }] }
      ]
    }
  },
  act (state, c, v, inputs, ctx) {
    const favs = favStore(ctx)
    const f = favs.get((state.ctx || {}).key)
    if (c === 'close') { ctx.surfaces.close('favitem'); return }
    if (!f) return
    if (c === 'exact') { favs.setExact(f.kind, f.defId, v === '1'); syncFavs(ctx, true) }
    if (c === 'remove') { favs.remove(f.key); syncFavs(ctx, true); ctx.surfaces.close('favitem') }
    ctx.surfaces.refresh('favorites')
    ctx.surfaces.refresh('explorer')
  }
}

module.exports = [myShop, explorer, favFound, favorites, favItem, recycleTool, bulkBuy]
