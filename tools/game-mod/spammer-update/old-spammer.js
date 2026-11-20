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
    rows.push({ t: 'in', id: 'packet', label: 'Packet ({room} = your room)', v: state.packet || '', max: 2000 })
    rows.push({ t: 'row', items: [{ id: 'send', label: 'Send to server', style: 'primary', v: 'server' }, { id: 'send', label: 'Send to my game', v: 'game' }, { id: 'add', label: 'Add to list' }] })
    rows.push({ t: 'sep' })
    rows.push({ t: 'h', text: `List (${steps.length})` })
    steps.forEach((s, i) => rows.push({ t: 'li', text: s.text.length > 70 ? s.text.slice(0, 70) + '…' : s.text, sub: `${s.to === 'game' ? 'to my game' : 'to server'} · then wait ${s.delay}s`, sel: this.job && this.step === i, btns: [{ id: 'remove', label: 'X', style: 'danger', v: String(i) }] }))
    if (steps.length) {
      rows.push({ t: 'tog', id: 'loop', label: 'Repeat the list', v: !!state.loop })
      rows.push(this.job ? { t: 'btn', id: 'stop', label: 'Stop', style: 'danger' } : { t: 'btn', id: 'run', label: 'Run the list', style: 'primary' })
    }
    return { title: 'Packet Spammer', rows, h: 330 }
  },
  async act (state, c, v, inputs, ctx) {
    const store = ctx.surfaces.store('packet-spammer')
    const steps = store.get('steps', []) || []
    if (inputs.packet != null) state.packet = String(inputs.packet)
    if (c === 'packet' || c === 'send') {
      const text = String(state.packet || '').trim()
      if (!text) throw new Error('Type a packet first.')
      await this.R.sendOne(ctx.dispatch, c === 'send' ? v : 'server', text)
      ctx.surfaces.toast('Sent.', 'ok')
      return
    }
    if (c === 'add') {
      const text = String(state.packet || '').trim()
      if (!text) throw new Error('Type a packet first.')
      steps.push({ to: 'server', text, delay: 1 })
      store.set('steps', steps)
      return
    }
    if (c === 'remove') { steps.splice(Number(v), 1); store.set('steps', steps); return }
    if (c === 'loop') { state.loop = v === '1'; return }
    if (c === 'stop') { if (this.job) this.job.stop(); return }
    if (c === 'run') {
      this.job = this.R.run(ctx.dispatch, steps, {
        loop: !!state.loop,
        onStep: (i) => { this.step = i; ctx.surfaces.refresh('spammer') },
        onError: (e) => ctx.surfaces.toast(e.message, 'bad'),
        onDone: () => { this.job = null; this.step = -1; ctx.surfaces.refresh('spammer') }
      })
    }
  }
}
