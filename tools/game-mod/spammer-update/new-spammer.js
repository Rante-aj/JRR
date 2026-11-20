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
