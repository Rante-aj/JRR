'use strict'

/**
 * JR's own button on the game's toolbar: a menu of everything, plus the
 * tools that have no better home in the game (Packet Spammer, Membership)
 * and links to the ones that need JR's full window.
 */

const path = require('path')

// Open-anywhere shortcuts: the surfaces that also live on a game screen.
const SHORTCUTS = [
  ['worth', 'Inventory Worth'], ['outfits', 'Outfits'], ['tryon', 'Try On'], ['glow', 'Glow'],
  ['advertise', 'Auto Advertise'], ['rooms', 'Rooms'], ['myshop', 'My Shop Tools'], ['explorer', 'Shop Explorer'],
  ['recycle', 'Recycle Presets'], ['denshop', 'Den Shop'], ['animals', 'Animal Buyer'], ['pets', 'Pet Catalog'],
  ['adventures', 'Adventures'], ['gemfarm', 'Gem Farm'], ['achievements', 'Achievements']
]

// Tools that work best in a JR window (big tables, files from your computer).
const WINDOWS = [
  ['packet-inspector', 'Packet Inspector'],
  ['asset-browser', 'Asset Browser'],
  ['name-checker', 'Name Checker'],
  ['masterpiece', 'Masterpiece Studio'],
  ['masterpiece-user-transfer', 'Masterpiece Transfer']
]

const menu = {
  id: 'menu',
  // Its button is the round JR button on the chat bar (jrChatBar).
  buttons: [],
  view (state, ctx) {
    const rows = []
    const s = ctx.settings()
    rows.push({ t: 'kv', k: 'JRR', v: `${ctx.version}${ctx.dispatch.connected ? ' · connected' : ''}`, c: 'ok' })
    rows.push({ t: 'tog', id: 'membership', label: 'Membership', sub: 'Member features on your game only. Next login.', v: ctx.membership() })
    rows.push({ t: 'tog', id: 'antiKick', label: 'Anti-kick', sub: 'Don’t get logged out for being idle.', v: !!s.antiKick })
    rows.push({ t: 'sep' })
    rows.push({ t: 'h', text: 'Open' })
    const shown = SHORTCUTS.filter(([id]) => ctx.surfaceEnabled(id))
    for (let i = 0; i < shown.length; i += 3) rows.push({ t: 'row', items: shown.slice(i, i + 3).map(([id, l]) => ({ id: 'open', label: l, v: id })) })
    rows.push({ t: 'row', items: [{ id: 'open', label: 'Packet Spammer', v: 'spammer' }, { id: 'focus', label: 'JR Window', v: '' }] })
    rows.push({ t: 'sep' })
    rows.push({ t: 'h', text: 'In JR’s window' })
    for (let i = 0; i < WINDOWS.length; i += 2) rows.push({ t: 'row', items: WINDOWS.slice(i, i + 2).map(([id, l]) => ({ id: 'window', label: l, v: id })) })
    return { title: 'JRR', rows, foot: 'Most of these also have a button on the game screen they belong to.', w: 360, h: 360 }
  },
  act (state, c, v, inputs, ctx) {
    if (c === 'membership') { ctx.setMembership(v === '1'); ctx.surfaces.toast('Membership changes at your next login.', 'ok'); return }
    if (c === 'antiKick') { ctx.updateSettings({ antiKick: v === '1' }); return }
    if (c === 'open') { ctx.surfaces.open(v); return }
    if (c === 'window') { ctx.openPlugin(v); ctx.surfaces.toast('Opened in JR’s window.', 'ok'); return }
    if (c === 'focus') ctx.focusJR()
  }
}

/* ------------------------------------------------------- packet spammer */

const spammer = {
  id: 'spammer',
  plugin: 'packet-spammer',
  buttons: [],
  init (ctx) {
    this.R = require(path.join(ctx.root, 'plugins', 'packet-spammer', 'runner.js'))
    this.job = null
    this.step = -1
  },
  view (state, ctx) {
    const store = ctx.surfaces.store('packet-spammer')
    const steps = store.get('steps', []) || []
    const rows = []
    const editing = state.edit != null && steps[state.edit] ? state.edit : null
    rows.push({ t: 'in', id: 'packet', label: editing != null ? `Editing line ${editing + 1}` : 'Packets, one per line ({room} = your room)', v: state.packet || '', max: 4000, lines: 3 })
    rows.push({ t: 'chips', id: 'to', v: state.to || 'server', opts: [{ v: 'server', l: 'To server' }, { v: 'game', l: 'To my game' }] })
    rows.push({ t: 'in', id: 'delay', label: 'Wait after each (seconds)', v: state.delay != null ? state.delay : '1', max: 8 })
    if (editing != null) rows.push({ t: 'row', items: [{ id: 'save', label: 'Save line', style: 'primary' }, { id: 'cancel', label: 'Cancel' }] })
    else rows.push({ t: 'row', items: [{ id: 'send', label: 'Send now', style: 'primary' }, { id: 'add', label: 'Add to list' }] })
    rows.push({ t: 'sep' })
    rows.push({ t: 'h', text: `List (${steps.length})` })
    steps.forEach((s, i) => {
      const btns = []
      if (i > 0) btns.push({ id: 'up', label: '^', v: String(i) })
      if (i < steps.length - 1) btns.push({ id: 'down', label: 'v', v: String(i) })
      btns.push({ id: 'edit', label: 'Edit', v: String(i) })
      btns.push({ id: 'remove', label: 'X', style: 'danger', v: String(i) })
      rows.push({ t: 'li', text: s.text.length > 60 ? s.text.slice(0, 60) + '…' : s.text, sub: `${i + 1}. ${s.to === 'game' ? 'to my game' : 'to server'} · then wait ${s.delay}s`, sel: (this.job && this.step === i) || editing === i, btns })
    })
    if (steps.length) {
      rows.push({ t: 'tog', id: 'loop', label: 'Repeat the list', v: !!state.loop })
      rows.push(this.job ? { t: 'btn', id: 'stop', label: 'Stop', style: 'danger' } : { t: 'btn', id: 'run', label: 'Run the list', style: 'primary' })
    }
    rows.push({ t: 'sep' })
    rows.push({ t: 'h', text: 'Import / export' })
    rows.push({ t: 'row', items: [{ id: 'export', label: 'Copy list' }, { id: 'importAdd', label: 'Paste: add' }, { id: 'importReplace', label: 'Paste: replace' }] })
    rows.push({ t: 'p', c: 'dim', text: 'Copy puts the list on your clipboard as text (one line each: "server 1 %xt%...%"). Paste reads your clipboard: that format, or plain packets. Same list as JR’s Packet Spammer window.' })
    return { title: 'Packet Spammer', rows, h: 380 }
  },
  async act (state, c, v, inputs, ctx) {
    const store = ctx.surfaces.store('packet-spammer')
    const steps = store.get('steps', []) || []
    const R = this.R
    if (inputs.packet != null) state.packet = String(inputs.packet)
    if (inputs.delay != null) state.delay = String(inputs.delay)
    const delay = () => Math.max(R.MIN_DELAY, Number(state.delay) || 1)
    const lines = () => R.splitPackets(state.packet)
    const idle = () => { if (this.job) throw new Error('Stop the list first.') }
    const clipboard = () => { try { return require('electron').clipboard } catch (_) { throw new Error('The clipboard isn’t available here.') } }
    if (c === 'to') { state.to = v === 'game' ? 'game' : 'server'; return }
    if (c === 'packet' || c === 'send') {
      const list = lines()
      if (!list.length) throw new Error('Type a packet first.')
      for (const text of list) await R.sendOne(ctx.dispatch, state.to || 'server', text)
      ctx.surfaces.toast(list.length === 1 ? 'Sent.' : `Sent ${list.length}.`, 'ok')
      return
    }
    if (c === 'add') {
      const list = lines()
      if (!list.length) throw new Error('Type a packet first.')
      for (const text of list) steps.push({ to: state.to || 'server', text, delay: delay() })
      store.set('steps', steps)
      state.packet = ''
      return
    }
    if (c === 'up' || c === 'down') {
      idle()
      const i = Number(v)
      const j = c === 'up' ? i - 1 : i + 1
      if (steps[i] && steps[j]) {
        [steps[i], steps[j]] = [steps[j], steps[i]]
        if (state.edit === i) state.edit = j
        else if (state.edit === j) state.edit = i
        store.set('steps', steps)
      }
      return
    }
    if (c === 'edit') {
      idle()
      const s = steps[Number(v)]
      if (!s) return
      state.edit = Number(v)
      state.packet = s.text
      state.to = s.to === 'game' ? 'game' : 'server'
      state.delay = String(s.delay)
      return
    }
    if (c === 'save') {
      idle()
      const i = state.edit
      const list = lines()
      if (i == null || !steps[i]) { state.edit = null; return }
      if (!list.length) throw new Error('A line needs a packet. Use X to remove it.')
      // more than one line typed: the first replaces this line, the rest go right after it
      steps.splice(i, 1, ...list.map(text => ({ to: state.to || 'server', text, delay: delay() })))
      store.set('steps', steps)
      state.edit = null
      state.packet = ''
      ctx.surfaces.toast(`Line ${i + 1} saved.`, 'ok')
      return
    }
    if (c === 'cancel') { state.edit = null; state.packet = ''; return }
    if (c === 'remove') {
      idle()
      const i = Number(v)
      steps.splice(i, 1)
      store.set('steps', steps)
      if (state.edit === i) { state.edit = null; state.packet = '' } else if (state.edit > i) state.edit--
      return
    }
    if (c === 'export') {
      if (!steps.length) throw new Error('The list is empty.')
      clipboard().writeText(R.toText(steps))
      ctx.surfaces.toast(`Copied ${steps.length} line${steps.length === 1 ? '' : 's'}.`, 'ok')
      return
    }
    if (c === 'importAdd' || c === 'importReplace') {
      idle()
      const got = R.fromText(clipboard().readText())
      if (!got.length) throw new Error('Nothing to import: copy a list first.')
      store.set('steps', c === 'importReplace' ? got : steps.concat(got))
      state.edit = null
      ctx.surfaces.toast(`${c === 'importReplace' ? 'Replaced the list with' : 'Added'} ${got.length} line${got.length === 1 ? '' : 's'}.`, 'ok')
      return
    }
    if (c === 'loop') { state.loop = v === '1'; return }
    if (c === 'stop') { if (this.job) this.job.stop(); return }
    if (c === 'run') {
      if (this.job) return
      state.edit = null
      this.job = R.run(ctx.dispatch, steps, {
        loop: !!state.loop,
        onStep: (i) => { this.step = i; ctx.surfaces.refresh('spammer') },
        onError: (e) => ctx.surfaces.toast(e.message, 'bad'),
        onDone: () => { this.job = null; this.step = -1; ctx.surfaces.refresh('spammer') }
      })
    }
  }
}

/* ------------------------------------------------------------ masterpiece */

const masterpiece = {
  id: 'masterpiece',
  plugin: 'masterpiece',
  buttons: [{ at: 'masterpiece', label: 'Studio' }],
  view () {
    return {
      title: 'Masterpiece Studio',
      rows: [
        { t: 'p', text: 'Turn a picture from your computer into a masterpiece, or see the picture inside one.' },
        { t: 'p', c: 'dim', text: 'Picking files from your computer happens in JR’s window.' },
        { t: 'btn', id: 'open', label: 'Open Masterpiece Studio', style: 'primary' },
        { t: 'btn', id: 'transfer', label: 'Open Masterpiece User Transfer' }
      ]
    }
  },
  act (state, c, v, inputs, ctx) {
    if (c === 'open') { ctx.openPlugin('masterpiece'); ctx.surfaces.close('masterpiece') }
    if (c === 'transfer') { ctx.openPlugin('masterpiece-user-transfer'); ctx.surfaces.close('masterpiece') }
  }
}

// Art Studio's Picture button: the game itself turns the picture into the
// painting (JRPicturePopup), which it can then save as an .ajart file.
const picture = {
  id: 'picture',
  plugin: 'masterpiece',
  buttons: [{ at: 'artstudio', label: 'Picture', icon: 'picture', local: 'picture' }],
  view () { return { title: 'Picture to Masterpiece', rows: [{ t: 'p', text: 'Use the Picture button in the Art Studio.' }] } }
}

// More Sorts: the game sorts the items itself (JRSortMenu and jrSortItems in
// tools/game-mod); Most valuable asks JR for worth ("k").
const sorting = {
  id: 'sorting',
  buttons: [
    { at: 'densort', label: 'More Sorts', icon: 'sort', local: 'densort' }
  ],
  view () { return { title: 'More Sorts', rows: [{ t: 'p', text: 'Use the Sort button in your inventory or den.' }] } }
}

module.exports = [menu, spammer, masterpiece, picture, sorting]
