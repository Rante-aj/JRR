'use strict'

/**
 * Special animals in the Animal Buyer (special-animals update).
 *
 * Special animals (Rainbow Raccoon, Jamaaliday Deer, ...) are a base animal plus a
 * special id. The game knows them all (defpack 1057); JR's in-game build sends the
 * list here ("sa") whenever the animal switcher opens, and it is kept for next time.
 *
 * Buying: the same copied "aa" request the Animal Buyer already uses:
 *   %xt%o%aa%room%name1%name2%name3%baseAnimal%specialId%diamondItem%shop%
 * p[8] base animal, p[9] special id, p[10] its diamond item (the game's own re-buy of a
 * Rainbow Raccoon sent 12 / 1192), p[11] -1. Normal animals: -1 / -1 / -1.
 * The server takes gems for a special animal this account owned before, diamonds otherwise.
 */

const num = (n) => Number(n || 0).toLocaleString('en-US')
const HELP = 'Buy any animal the normal way once, so JR can copy how the game asks.'

module.exports = function addSpecialAnimals (animals) {
  if (!animals || animals.jrSpecials) return animals
  animals.jrSpecials = true
  const init = animals.init

  animals.init = function (ctx) {
    init.call(this, ctx)
    let store = null
    try { store = ctx.surfaces.store('animals') } catch (_) {}
    this.specials = []
    try { const saved = store && store.get('specials', []); if (Array.isArray(saved)) this.specials = saved } catch (_) {}
    ctx.dispatch.onMessage({
      type: 'connection',
      message: 'jr',
      callback: ({ message }) => {
        const parts = Array.isArray(message.value) ? message.value : []
        const args = parts.slice(5, parts[parts.length - 1] === '' ? -1 : undefined)
        if (args[0] !== 'sa') return
        message.send = false
        try {
          const list = JSON.parse(String(args[1] || '[]'))
          if (!Array.isArray(list) || !list.length) return
          const clean = list
            .map(a => ({ id: Number(a.id), base: Number(a.base), name: String(a.name || ''), baseName: String(a.baseName || ''), members: !!a.mem, diamond: Number.isSafeInteger(Number(a.diamond)) ? Number(a.diamond) : -1, dcost: Number(a.dcost) || 0, owned: !!a.owned, alts: (Array.isArray(a.alts) ? a.alts : []).map(x => ({ d: Number(x.d), c: Number(x.c) || 0, s: Number(x.s) || 0 })).filter(x => Number.isSafeInteger(x.d) && x.d > 0) }))
            .filter(a => Number.isSafeInteger(a.id) && a.id > 0 && Number.isSafeInteger(a.base) && a.base > 0)
            .sort((a, b) => (b.owned - a.owned) || a.name.localeCompare(b.name))
          const changed = JSON.stringify(clean) !== JSON.stringify(this.specials)
          this.specials = clean
          if (changed) {
            try { if (store) store.set('specials', clean) } catch (_) {}
            ctx.log({ type: 'debug', message: `Animal Buyer: the game listed ${clean.length} special animals.` })
          }
          ctx.surfaces.refresh('animals')
        } catch (error) {
          ctx.log({ type: 'warn', message: `Animal Buyer special animals: ${error.message}` })
        }
      }
    })
  }

  animals.view = function (state, ctx) {
    const rows = []
    rows.push(this.template
      ? { t: 'p', c: 'ok', text: 'Ready: JR saw the game buy an animal, so it can buy any animal the same way.' }
      : { t: 'p', c: 'warn', text: HELP })
    rows.push({ t: 'in', id: 'q', label: 'Search', v: state.q || '', go: 'Find' })
    const q = String(state.q || '').toLowerCase()
    const match = (...names) => !q || names.some(n => String(n || '').toLowerCase().includes(q))
    const btn = (key, label = 'Buy') => this.template
      ? [{ id: 'buy', label: state.confirm === key ? 'Sure?' : label, style: state.confirm === key ? 'danger' : 'primary', v: key }]
      : []
    // A special animal's buttons: Buy (the diamond item the game picks), then one per other
    // diamond item that also sells it, or one with no diamond item when it has none.
    const specialBtns = (a) => {
      if (!this.template) return []
      const out = a.diamond === -1 ? [] : btn(`s${a.id}:${a.diamond}`)
      for (const x of (a.alts || []).filter(x => x.d !== a.diamond)) out.push(...btn(`s${a.id}:${x.d}`, `Try ${x.c ? num(x.c) : x.d}`))
      if (!out.length) out.push(...btn(`s${a.id}:-1`, 'Try'))
      return out
    }
    let left = 120
    for (const a of (this.list || []).filter(a => match(a.name, `#${a.id}`))) {
      if (left-- <= 0) break
      rows.push({ t: 'li', text: a.name, sub: [`#${a.id}`, a.members ? 'members' : null].filter(Boolean).join(' · '), right: a.cost ? `${num(a.cost)}` : null, rc: 'dim', btns: btn(String(a.id)) })
    }
    const specials = (this.specials || []).filter(a => match(a.name, a.baseName, `#${a.id}`, 'special', a.owned ? 'owned' : ''))
    rows.push({ t: 'h', text: `Special animals (${(this.specials || []).length})` })
    if (!(this.specials || []).length) {
      rows.push({ t: 'p', c: 'dim', text: 'Open the animal switcher in the game once and JR gets the list of special animals.' })
    } else {
      rows.push({ t: 'p', c: 'dim', text: 'The first purchase costs diamonds; ones this account owned before (listed first) cost gems after that. "Try" buttons use another diamond item that sells the same animal.' })
    }
    for (const a of specials) {
      if (left-- <= 0) break
      rows.push({ t: 'li', text: a.name || `Special #${a.id}`, sub: [`special #${a.id}`, `base ${a.baseName || `#${a.base}`}`, a.members ? 'members' : null, a.owned ? 'owned before' : null, a.diamond === -1 ? 'no diamond item' : `diamond item ${a.diamond}`, (a.alts || []).length > 1 ? `also ${(a.alts || []).filter(x => x.d !== a.diamond).map(x => `${x.d} (${num(x.c)})`).join(', ')}` : null].filter(Boolean).join(' · '), right: a.owned ? 'gems' : (a.dcost ? `${num(a.dcost)} diamonds` : null), rc: a.owned ? 'ok' : 'dim', btns: specialBtns(a) })
    }
    return { title: 'Animal Buyer', rows, h: 320 }
  }

  animals.act = async function (state, c, v, inputs, ctx) {
    if (c !== 'buy') state.confirm = null
    if (c === 'q') { state.q = String(v || '').trim(); return }
    if (c !== 'buy') return
    const key = String(v)
    if (!this.template) throw new Error(HELP)
    if (state.confirm !== key) { state.confirm = key; return }
    state.confirm = null
    const parts = this.template.slice()
    let name
    if (key[0] === 's') {
      const [sid, dia] = key.slice(1).split(':')
      const a = (this.specials || []).find(x => String(x.id) === sid)
      if (!a) throw new Error('That special animal is not in the list any more.')
      parts[8] = String(a.base)
      parts[9] = String(a.id)
      parts[10] = String(dia === undefined ? a.diamond : Number(dia))
      parts[11] = '-1'
      name = `${a.name || `special #${a.id}`}${parts[10] !== String(a.diamond) ? ` (diamond item ${parts[10]})` : ''}`
    } else {
      const n = Number(key)
      parts[8] = String(n)
      parts[9] = '-1'
      parts[10] = '-1'
      parts[11] = '-1'
      const a = (this.list || []).find(x => x.id === n)
      name = a ? a.name : `#${n}`
    }
    const room = ctx.dispatch.getState('room')
    if (/^\d+$/.test(String(room || ''))) parts[4] = String(room)
    await ctx.dispatch.sendRemoteMessage(parts.join('%'))
    ctx.surfaces.toast(`Asked to buy ${name}. Check the game for the result.`)
  }

  return animals
}
