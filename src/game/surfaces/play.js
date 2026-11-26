'use strict'

/**
 * Playing: Adventures and Gem Farm (in the adventure screen), Achievements
 * (in the achievements book) and Pairs (in the Pairs game).
 */

const fs = require('fs')
const path = require('path')
const { every } = require('./timers')
const vm = require('vm')
const zlib = require('zlib')
const Module = require('module')
const { createFakePage, fakeLocalStorage } = require('./fakedom')

/* ------------------------------------------------------------ adventures */

// The Adventures plugin's own runner, loaded without its window. The extra
// line at the end gives JR the controls its buttons would have.
const CONTROLS = `
;globalThis.__jr = {
  list: ADVENTURES,
  select (i) { if (running) return; selected = ADVENTURES[i] || selected; mode = selected ? selected.modes[0] : null; renderAll() },
  setMode (m) { if (!running && selected && selected.modes.includes(m)) { mode = m; renderAll() } },
  start (here) { return startRun(!!here) },
  join () { return joinNow() },
  joined () { return lastJoined },
  stop () { stopRun() },
  state () { return { running, id: selected && selected.id, mode } },
  choices (a) { return choicesFor(a) },
  setChoices (a, list) { setChoices(a, list) }
};`

const adventures = {
  id: 'adventures',
  plugin: 'adventure-runner',
  // Also a tab on the World Map (VolumeSelector in tools/game-mod).
  buttons: [{ at: 'adventure', label: 'Auto Run' }],
  _load (ctx) {
    if (this.jr) return this.jr
    const file = path.join(ctx.root, 'plugins', 'adventure-runner', 'index.js')
    const page = this.page = createFakePage()
    const store = ctx.surfaces.store('adventure-runner')
    const sandbox = {
      jam: { dispatch: ctx.dispatch, application: ctx.application, storage: null },
      document: page.document,
      localStorage: fakeLocalStorage(store),
      console: { log () {}, warn () {}, error: (...a) => ctx.log({ type: 'warn', message: `Adventures: ${a.join(' ')}` }) },
      setTimeout, clearTimeout, setInterval, clearInterval,
      require: Module.createRequire(file),
      __dirname: path.dirname(file)
    }
    sandbox.window = sandbox
    page.element('loopToggle').checked = false
    page.element('loopRuns').value = '0'
    page.element('loopDelay').value = '5'
    page.element('prizeChoice').value = String(store.get('prize', 'manual'))
    vm.runInNewContext(fs.readFileSync(file, 'utf8') + CONTROLS, sandbox, { filename: file })
    this.jr = sandbox.__jr
    phHook(ctx)
    every(() => { if (this.jr.state().running) { ctx.surfaces.refresh('adventures'); ctx.surfaces.refresh('automation') } }, 1500)
    return this.jr
  },
  view (state, ctx) {
    const jr = this._load(ctx)
    const page = this.page
    const s = jr.state()
    const adv = jr.list.find(a => a.id === s.id) || jr.list[0]
    const how = page.element('joinMode').value || 'public'
    const auto = !!ctx.surfaces.store('adventure-runner').get('automate', false)
    const rows = []
    rows.push({ t: 'chips', id: 'pick', label: 'Adventure', v: String(jr.list.indexOf(adv)), opts: jr.list.map((a, i) => ({ v: String(i), l: a.warning ? `⚠ ${a.name}` : a.name })) })
    if (adv.warning) rows.push({ t: 'p', c: 'bad', text: `⚠ ${adv.warning}` })
    rows.push({ t: 'chips', id: 'how', label: 'Join by', v: how, opts: [{ v: 'public', l: 'Join game' }, { v: 'own', l: 'Host my own' }, { v: 'player', l: 'Join player' }] })
    if (how === 'player') rows.push({ t: 'in', id: 'host', label: 'Player’s username', v: page.element('hostName').value, max: 23 })
    rows.push({ t: 'tog', id: 'automate', label: 'Automate', sub: 'JRR plays it for you after you join', v: auto })
    if (auto && adv.joinOnly && !['twists-and-turns', 'jamaaliday-rescue', 'special-delivery', 'new-years-fortune', 'spring-festival', 'battle-for-the-beacon', 'grahams-workshop'].includes(adv.id)) rows.push({ t: 'p', c: 'warn', text: `JRR can’t play ${adv.name} for you yet. You can still join it and play it yourself.` })
    if (adv.modes.length > 1) rows.push({ t: 'chips', id: 'mode', v: s.mode, opts: adv.modes.map(m => ({ v: m, l: m[0].toUpperCase() + m.slice(1) })) })
    rows.push({ t: 'btn', id: 'join', label: adv.warning ? '⚠ Join (risky)' : 'Join', style: adv.warning ? 'danger' : 'primary' })
    if (page.element('status').textContent) rows.push({ t: 'p', c: 'dim', text: page.element('status').textContent })
    if (s.running) rows.push({ t: 'row', items: [{ id: 'gear', label: 'Automation is running · open it' }] })
    return { title: 'Adventures', rows, foot: 'Inside an adventure, the gear at the top right opens the automation settings.', h: 330 }
  },
  act (state, c, v, inputs, ctx) {
    const jr = this._load(ctx)
    const page = this.page
    const store = ctx.surfaces.store('adventure-runner')
    if (inputs.host != null) page.element('hostName').value = String(inputs.host)
    if (c === 'pick') { jr.select(Number(v)); return }
    if (c === 'mode') { jr.setMode(v); return }
    if (c === 'how') { page.element('joinMode').value = v; try { fakeLocalStorage(store).setItem('adventures.joinMode', v) } catch (_) {} return }
    if (c === 'automate') { store.set('automate', v === '1'); return }
    if (c === 'gear') { ctx.surfaces.open('automation'); return }
    if (c === 'join' || c === 'host') {
      const auto = !!store.get('automate', false)
      const before = ctx.dispatch.getState('room')
      const beforeName = String(ctx.dispatch.getState('roomName') || '')
      const sleep = (ms) => new Promise(r => setTimeout(r, ms))
      return Promise.resolve(jr.join()).then(async () => {
        if (!auto || !jr.joined()) return
        // Automate on: also press Play on the game's waiting screen, the way the
        // game does (%xt%o%qs%<room>%<the room you joined from>%), unless the
        // adventure already took you in (seasonal lobbies).
        await sleep(1500)
        // Joining someone else's game: they press Play, not you.
        const how = page.element('joinMode').value || 'public'
        const me = String((ctx.dispatch.getState('player') || {}).userName || '').toLowerCase()
        const host = String(page.element('hostName').value || '').trim().toLowerCase()
        const othersGame = how === 'player' && host && host !== me
        if (ctx.dispatch.getState('room') === before && !othersGame) {
          await ctx.dispatch.sendRemoteMessage(`%xt%o%qs%${before}%${beforeName}%`)
          for (let t = 0; t < 40 && ctx.dispatch.getState('room') === before; t++) await sleep(250)
        }
        // The automation window opens once you're in.
        setTimeout(() => ctx.surfaces.open('automation'), 2000)
      }).catch(e => ctx.surfaces.toast(e.message, 'bad'))
    }
  }
}

// Bitter Sweets, played as plain packets with pauses (like the Packet Spammer),
// outside the adventure engine: claim a goal, wait for the rewards, take both
// chests (or wait for you to pick), then the next goal.
const BS_GOALS = ['goal1', 'goal2', 'goal3', 'goal4', 'goal5']
const seq = { running: false, stop: false, status: '', seen: {}, hooked: false }
function seqHook (ctx) {
  if (seq.hooked) return
  seq.hooked = true
  const note = (k) => () => { seq.seen[k] = Date.now() }
  try { ctx.dispatch.onMessage({ type: 'aj', message: 'qpgiftplr', callback: note('rewards') }) } catch (_) {}
  try { ctx.dispatch.onMessage({ type: 'connection', message: 'qpgiftdone', callback: note('done') }) } catch (_) {}
  try { ctx.dispatch.onMessage({ type: 'connection', message: 'qpgiftplr', callback: note('picked') }) } catch (_) {}
}
// Taken out of the adventure (Rante: the game kicks you for being away, even while
// collecting): not in a quest_... room or seasonal sin<number> lobby any more.
function wasKicked (ctx) { const n = String(ctx.dispatch.getState('roomName') || ''); return !!n && !/^quest_|^sin\d/i.test(n) }
// Joins the adventure again (as JR's Join button does) and waits for it to load.
async function joinAgain (ctx, jr, advId, where, isStopped) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const room = () => ctx.dispatch.getState('room')
  const i = jr.list.findIndex(a => a.id === advId)
  if (i >= 0 && jr.state().id !== advId) jr.select(i)
  await wait(2000)
  const before = room()
  const beforeName = String(ctx.dispatch.getState('roomName') || '')
  await jr.join()
  let end = Date.now() + 2500
  while (room() === before && Date.now() < end) await wait(250)
  if (room() === before && room()) await ctx.dispatch.sendRemoteMessage(`%xt%o%qs%${room()}%${beforeName}%`)
  end = Date.now() + 15000
  while (room() === before) { if (isStopped()) throw new Error('Stopped.'); if (Date.now() > end) throw new Error(`Couldn’t get back into ${where}.`); await wait(250) }
  await wait(5000)
}
// Solo adventures you host (Tiki Trouble, the Forgotten Desert): two steps, like Rante's
// runs: host it (%xt%o%qjc%<room>%den<you>%<quest>%0%), then start it
// (%xt%o%qs%<room>%den<you>%). Falls back to JR's Join button if that doesn't work.
async function hostAgain (ctx, jr, advId, questId, where, isStopped) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const room = () => ctx.dispatch.getState('room')
  const inQuest = () => /^quest_/i.test(String(ctx.dispatch.getState('roomName') || ''))
  const name = String((ctx.dispatch.getState('player') || {}).userName || '').toLowerCase()
  await wait(2000)
  if (name && room()) {
    const before = room()
    await ctx.dispatch.sendRemoteMessage(`%xt%o%qjc%${room()}%den${name}%${questId}%0%`)
    await wait(3000)
    if (isStopped()) throw new Error('Stopped.')
    if (!inQuest() && room()) await ctx.dispatch.sendRemoteMessage(`%xt%o%qs%${room()}%den${name}%`)
    const end = Date.now() + 15000
    while (!(inQuest() && room() !== before) && Date.now() < end) { if (isStopped()) throw new Error('Stopped.'); await wait(250) }
    if (inQuest() && room() !== before) { await wait(5000); return }
  }
  await joinAgain(ctx, jr, advId, where, isStopped) // fallback: JR's Join button
}
const kickRow = (ctx) => ({ t: 'tog', id: 'kickrejoin', label: 'Join again if kicked', sub: 'When the game takes you out for being away', v: !!ctx.surfaces.store('adventure-runner').get('kickRejoin', true) })

async function seqRun (ctx, goals, takeBoth, rounds = 1, jr = null, autoRejoin = false) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const send = async (text) => {
    if (seq.stop) throw new Error('Stopped.')
    const room = ctx.dispatch.getState('room')
    if (!room) throw new Error('Go into Bitter Sweets first.')
    await ctx.dispatch.sendRemoteMessage(text.split('{room}').join(room))
  }
  const until = async (key, since, ms) => {
    const end = Date.now() + ms
    while (Date.now() < end) { if (seq.stop) throw new Error('Stopped.'); if ((seq.seen[key] || 0) > since) return true; await wait(200) }
    return false
  }
  seqHook(ctx)
  seq.running = true; seq.stop = false
  try {
    // Bitter Sweets' rewards can be claimed again in the same game, so a
    // round is every ticked goal once; Keep going repeats the rounds.
    for (let round = 1; rounds === 0 || round <= rounds; round++) {
    const tag = rounds === 1 ? '' : `Round ${round}${rounds ? ` of ${rounds}` : ''} · `
    let n = 0
    for (const g of goals) {
      n++
      if (wasKicked(ctx)) {
        if (!autoRejoin || !jr) throw new Error('The game took you out of the adventure (away too long).')
        seq.status = 'The game took you out for being away. Joining again...'; ctx.surfaces.refresh('automation')
        await joinAgain(ctx, jr, 'bittersweets', 'Bitter Sweets', () => seq.stop)
      }
      seq.status = `${tag}Goal ${g.slice(4)}: claiming (${n} of ${goals.length})...`
      ctx.surfaces.refresh('automation')
      const t = Date.now()
      await send(`%xt%o%qat%{room}%gui_${g}%0%`)
      const opened = await until('rewards', t, 6000)
      if (opened) {
        // Show the rewards screen again if JR hid it after the last reward (needs rewards-update v3).
        await wait(300)
        try { const g = ctx.application.denPreviews && ctx.application.denPreviews.game; if (g && g.ready()) g.send('rs', {}) } catch (_) {}
      }
      if (!opened) { seq.status = `${tag}Goal ${g.slice(4)}: no rewards screen (already claimed?). Next...`; ctx.surfaces.refresh('automation'); await wait(2000); continue }
      if (takeBoth) {
        // Open each chest the way a click does, then the present and Keep on the
        // game's own gift screen, so it looks just like doing it by hand. The game
        // sends the pick and "done" packets itself; JR only sends them if it didn't.
        const game = () => { const g = ctx.application.denPreviews && ctx.application.denPreviews.game; return g && g.ready() ? g : null }
        await wait(1200)
        for (const chest of [1, 2]) {
          seq.status = `${tag}Goal ${g.slice(4)}: opening chest ${chest}...`
          ctx.surfaces.refresh('automation')
          const since = Date.now()
          if (game()) game().send('rp', { i: chest })
          let picked = false
          for (let step = 0; step < 8 && !picked; step++) {
            await wait(1000)
            if ((seq.seen.picked || 0) > since) { picked = true; break }
            if (game()) game().send('rg', {})
          }
          if (!picked) picked = (seq.seen.picked || 0) > since
          if (!picked) await send(`%xt%o%qpgiftplr%{room}%${chest - 1}%0%0%`)
          await wait(1000)
        }
        // The game closes the rewards screen itself after the last chest.
        const closed = await until('done', t, 4000)
        if (!closed) {
          await send('%xt%o%qpgiftdone%{room}%1%')
          await wait(1000)
          try { if (game()) game().send('rc', {}) } catch (_) {}
        }
        await wait(1500)
      } else {
        seq.status = `${tag}Goal ${g.slice(4)}: pick your chests in the game...`
        ctx.surfaces.refresh('automation')
        await until('done', t, 90000)
        await wait(2500)
      }
    }
    if (rounds === 0 || round < rounds) { seq.status = `${tag}round done. Next round in 3 s...`; ctx.surfaces.refresh('automation'); await wait(3000) }
    }
    seq.status = 'Done! Open your chests in the adventure.'
  } catch (e) {
    seq.status = e.message === 'Stopped.' ? 'Stopped.' : `Error: ${e.message}`
  } finally {
    seq.running = false
    ctx.surfaces.refresh('automation')
  }
}

// Phantoms (Rante's run, easy): plain packets with pauses, never moving from the spawn
// point. Bunny key names change every run; the server announces them when the adventure
// starts (%xt%qcmd%-1%1%bunny_key_1c%...), so JR listens from the moment it loads.
const ph = { running: false, stop: false, status: '', keys: new Set(), prize: 0, picked: 0, done: 0, hooked: false }
function phHook (ctx) {
  if (ph.hooked) return
  ph.hooked = true
  const text = (payload) => { const m = payload && payload.message; if (!m) return String(payload || ''); if (typeof m === 'string') return m; if (typeof m.raw === 'string') return m.raw; try { return String(m.toMessage()) } catch (_) { return '' } }
  try {
    ctx.dispatch.onMessage({ type: 'aj', message: 'qcmd', callback: (pl) => { const k = /bunny_key_\d+[a-z]+/i.exec(text(pl)); if (k) ph.keys.add(k[0]) } })
    // A new adventure: forget the last run's keys.
    ctx.dispatch.onMessage({ type: 'aj', message: 'qs', callback: () => { ph.keys.clear() } })
    ctx.dispatch.onMessage({ type: 'aj', message: 'qpgift', callback: () => { ph.prize = Date.now() } })
    // The game's own pick and "done" (when JR clicks a prize for you).
    ctx.dispatch.onMessage({ type: 'connection', message: 'qpgift', callback: () => { ph.picked = Date.now() } })
    ctx.dispatch.onMessage({ type: 'connection', message: 'qpgiftdone', callback: () => { ph.done = Date.now() } })
  } catch (_) {}
}
async function phRun (ctx, prizes, rounds = 1, jr = null) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const room = () => ctx.dispatch.getState('room')
  const me = () => { const p = ctx.dispatch.getState('player') || {}; for (const k of ['sfsUserId', 'userId', 'userid']) if (/^\d+$/.test(String(p[k]))) return String(p[k]); return null }
  const send = async (text, pause = 1200) => {
    if (ph.stop) throw new Error('Stopped.')
    if (!room()) throw new Error('Go into the Phantoms adventure first.')
    await ctx.dispatch.sendRemoteMessage(text.split('{room}').join(room()).split('{player}').join(me()))
    await wait(pause)
  }
  const say = (t) => { ph.status = t; ctx.surfaces.refresh('automation') }
  const trig = (n) => send(`%xt%o%qat%{room}%${n}%0%`)
  const pick = (n) => send(`%xt%o%qpup%{room}%${n}%{player}%`, 800)
  const talk = async (n) => { await trig(n); await send(`%xt%o%qaskr%{room}%${n}%1%1%`) }
  const nextRoom = async (n) => {
    const from = room()
    await send(`%xt%o%qat%{room}%${n}%0%`, 300)
    const end = Date.now() + 15000
    while (room() === from) { if (ph.stop) throw new Error('Stopped.'); if (Date.now() > end) throw new Error(`The room didn't change after ${n}.`); await wait(250) }
    await wait(3500) // let the new room load
  }
  // Leaves like the game's own Leave button (the game cleans up and tells the
  // server); only if the game doesn't leave, JR sends the packets it would.
  const leave = async () => {
    const from = room()
    try { await ctx.dispatch.sendConnectionMessage('%xt%qcmd%-1%19%') } catch (_) {}
    let end = Date.now() + 12000
    while (room() === from && Date.now() < end) { if (ph.stop) throw new Error('Stopped.'); await wait(250) }
    if (room() === from) {
      await send('%xt%o%qat%{room}%exit_vol%0%', 300)
      await send('%xt%o%qx%{room}%%', 300)
      end = Date.now() + 12000
      while (room() === from && Date.now() < end) { if (ph.stop) throw new Error('Stopped.'); await wait(250) }
      if (room() === from) throw new Error('Couldn’t leave the adventure.')
    }
    await wait(3000)
  }
  // Joins again the way you first joined, presses Play, waits for the room and this run's keys.
  const rejoin = async () => {
    const before = room()
    const beforeName = String(ctx.dispatch.getState('roomName') || '')
    ph.keys.clear()
    await jr.join()
    let end = Date.now() + 2500
    while (room() === before && Date.now() < end) await wait(250)
    if (room() === before) await send(`%xt%o%qs%{room}%${beforeName}%`, 300)
    end = Date.now() + 15000
    while (room() === before) { if (ph.stop) throw new Error('Stopped.'); if (Date.now() > end) throw new Error('Couldn’t get back into Phantoms.'); await wait(250) }
    end = Date.now() + 8000
    while (ph.keys.size < 4 && Date.now() < end) await wait(250)
    await wait(4000) // let the adventure finish loading
  }
  ph.running = true; ph.stop = false
  let done = 0
  try {
    for (let round = 1; rounds === 0 || round <= rounds; round++) {
    const tag = rounds === 1 ? '' : `Run ${round}${rounds ? ` of ${rounds}` : ''} · `
    const say0 = say
    const say2 = (t) => say0(tag + t)
    if (round > 1) { say2('Leaving the adventure...'); await leave(); say2('Joining again...'); await rejoin() }
    await phOnce(say2)
    done++
    }
    if (rounds !== 1) say(`Done! ${done} run${done === 1 ? '' : 's'}.`)
  } catch (e) {
    say(e.message === 'Stopped.' ? `Stopped${done ? ` after ${done} run${done === 1 ? '' : 's'}` : ''}.` : `Error: ${e.message}`)
  } finally {
    ph.running = false
    ctx.surfaces.refresh('automation')
  }

  async function phOnce (say) {
    if (!me()) throw new Error('JRR doesn’t know your player number yet. Walk a step in the game and try again.')
    say('Talking to Liza...'); await talk('liza_2'); await talk('liza_1')
    say('Getting the first cork...'); await trig('bunny_2')
    say('Plugging the pipes...')
    await pick('cork_1'); await trig('pipetrig_1')
    // Hard mode has two more pipes (pipetrig_5, _6) and four more flowers (_5 to _8), and the door back in the first room is phan_trig_h. All confirmed by Rante's hard run.
    const hard = jr && jr.state().mode === 'hard'
    for (const n of hard ? [2, 3, 4, 5, 6] : [2, 3, 4]) { await pick('cork_2a'); await trig(`pipetrig_${n}`) }
    say('Watering the flowers...')
    const flowers = ['flowertrig11', 'flowertrig12', 'flowertrig_1', 'flowertrig_3', 'flowertrig_2', 'flowertrig_4', 'flowertrig_9', 'flowertrig10']
    if (hard) flowers.push('flowertrig_5', 'flowertrig_6', 'flowertrig_7', 'flowertrig_8')
    for (const f of flowers) { await pick('pail_2'); await trig(f) }
    say('Going to the next room...'); await trig('phan_trig_e'); await nextRoom('trig_1a')
    say('Getting the phantom key...'); await trig('bunny_6'); await pick('phan_key_1')
    say('Going back...'); await nextRoom('trig_1_a')
    say('Freeing the bunnies...'); await trig(hard ? 'phan_trig_h' : 'phan_trig_e'); await trig('bunnytrig_3')
    // Any key opens any cage, but each is used up: a new key for each cage.
    let keys = [...ph.keys].sort()
    if (keys.length < 4) keys = [1, 2, 3, 4].map(n => keys.find(k => k.startsWith(`bunny_key_${n}`)) || `bunny_key_${n}c`)
    const cages = ['bunny_7', 'bunny_8', 'bunny_9', 'bunny_10']
    for (let i = 0; i < 4; i++) { await pick(keys[i]); await trig(cages[i]) }
    say('Talking to Liza for the prizes...')
    const asked = Date.now()
    await talk('liza_2')
    const end = Date.now() + 10000
    while (ph.prize < asked && Date.now() < end) { if (ph.stop) throw new Error('Stopped.'); await wait(250) }
    if (ph.prize < asked) throw new Error('The prize screen didn’t open. Check the adventure in the game.')
    // Each ticked prize by packet, one at a time; a green check goes over each on
    // the prize screen once it's taken, then JR closes the screen.
    const game = () => { const g = ctx.application.denPreviews && ctx.application.denPreviews.game; return g && g.ready() ? g : null }
    await wait(1200)
    try { if (game()) game().send('rs', {}) } catch (_) {} // show it again if JR hid it last run
    await wait(800)
    if (!prizes.length) throw new Error('No prizes ticked: tick at least one, or pick yourself in the game.')
    let n = 0
    for (const i of prizes) {
      n++
      say(`Taking prize ${i + 1} (${n} of ${prizes.length})...`)
      await send(`%xt%o%qpgift%{room}%${i}%0%0%`, 500)
      try { if (game()) game().send('rm', { i: i + 1 }) } catch (_) {}
      await wait(700)
    }
    await send('%xt%o%qpgiftdone%{room}%1%', 1200)
    try { if (game()) game().send('rc', {}) } catch (_) {}
    say(`Done! ${prizes.length} prize${prizes.length === 1 ? '' : 's'} taken.`)
  }
}

// %xt%qqm%-1%<base64>% is a bundle of the game's adventure messages, zlib-packed:
// a 2-byte count, then per message a 2-byte field count and length-prefixed fields
// (e.g. qcmd 1 reward16 1 1 1). Returns [[field, ...], ...] or null.
function qqmDecode (text) {
  try {
    const m = /%qqm%-?\d+%([A-Za-z0-9+/=]+)%?/.exec(String(text || ''))
    if (!m) return null
    const b = zlib.inflateSync(Buffer.from(m[1], 'base64'))
    let o = 0
    const u16 = () => { const v = b.readUInt16BE(o); o += 2; return v }
    const out = []
    for (let n = u16(); n > 0 && o < b.length; n--) {
      const f = []
      for (let k = u16(); k > 0; k--) { const len = u16(); f.push(b.toString('utf8', o, o + len)); o += len }
      out.push(f)
    }
    return out
  } catch (_) { return null }
}

// Twists and Turns (Rante): three treasure chests, each claimed with one packet
// (%xt%o%qat%<room>%<n>treasure_g%0%). Each opens the game's rewards screen;
// JR opens the chests on it the way Bitter Sweets does. A chest can't be
// claimed again until you leave and come back in, so Keep going leaves, joins
// again and claims them again.
const TT_CHESTS = ['2treasure_g', '1treasure_g', '3treasure_g'] // Rante's order
// Jamaaliday Rescue (Rante): goals 1-4 (gui_goal1..4) can be claimed again in the same
// game; the chest on the ground (endprize, opens with qqm) only once per game.
// Special Delivery (Rante): goals 1-3, again and again in the same game.
// Before the goals give their real prizes, the mailboxes have to be done: Rante found
// that mailbox1..60, 0.1 s apart, once per game, makes them work from then on.
const SD_MAILBOXES = async (send, say) => {
  for (let n = 1; n <= 60; n++) {
    if (n % 10 === 1) say(`Mailboxes ${n}-${n + 9} of 60...`)
    await send(`%xt%o%qat%{room}%mailbox${n}%0%`, 100)
  }
  await new Promise(r => setTimeout(r, 1500))
}
const SD_ITEMS = [{ name: 'gui_goal1', label: 'Goal 1' }, { name: 'gui_goal2', label: 'Goal 2' }, { name: 'gui_goal3', label: 'Goal 3' }]
const JRES_ITEMS = [
  { name: 'gui_goal1', label: 'Goal 1' }, { name: 'gui_goal2', label: 'Goal 2' },
  { name: 'gui_goal3', label: 'Goal 3' }, { name: 'gui_goal4', label: 'Goal 4' },
  { name: 'endprize', label: 'Chest on the ground' }
]
const tt = { strict: false, running: false, stop: false, status: '', rewards: 0, list: 0, listCount: 0, picked: 0, done: 0, hooked: false }
function ttHook (ctx) {
  if (tt.hooked) return
  tt.hooked = true
  const text = (payload) => { const m = payload && payload.message; if (!m) return String(payload || ''); if (typeof m === 'string') return m; if (typeof m.raw === 'string') return m.raw; try { return String(m.toMessage()) } catch (_) { return '' } }
  try {
    // A chest screen to pick from (like Bitter Sweets)...
    ctx.dispatch.onMessage({ type: 'aj', message: 'qpgiftplr', callback: () => { tt.rewards = Date.now() } })
    // Twists and Turns opens it with the prize list packet (%xt%qqm%-1%...).
    // New Year's Fortune also sends these bundles every few seconds for its chests, so
    // there (strict) only a bundle with a prize message inside counts.
    ctx.dispatch.onMessage({ type: 'aj', message: 'qqm', callback: (pl) => {
      if (!tt.strict) { tt.rewards = Date.now(); return }
      const msgs = qqmDecode(text(pl)) || []
      if (msgs.some(f => f[0] === 'qpgiftplr')) tt.rewards = Date.now()
      if (msgs.some(f => f[0] === 'qpgift')) { tt.listCount = Number((msgs.find(f => f[0] === 'qpgift') || [])[1]) || 0; tt.list = Date.now() }
    } })
    // ...or a list of prizes (like Phantoms): %xt%qpgift%-1%<count>%...
    ctx.dispatch.onMessage({ type: 'aj', message: 'qpgift', callback: (pl) => { const m = /%qpgift%-?\d+%(\d+)%/.exec(text(pl)); tt.listCount = m ? Number(m[1]) : 0; tt.list = Date.now() } })
    // The game's own pick and "done" after JR clicks a chest.
    ctx.dispatch.onMessage({ type: 'connection', message: 'qpgiftplr', callback: () => { tt.picked = Date.now() } })
    ctx.dispatch.onMessage({ type: 'connection', message: 'qpgift', callback: () => { tt.picked = Date.now() } })
    ctx.dispatch.onMessage({ type: 'connection', message: 'qpgiftdone', callback: () => { tt.done = Date.now() } })
  } catch (_) {}
}
async function ttRun (ctx, chests, rounds = 1, jr = null, opts = {}) {
  const where = opts.where || 'Twists and Turns'
  const rejoinEachRun = opts.rejoin !== false
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const room = () => ctx.dispatch.getState('room')
  const stopped = () => { if (tt.stop) throw new Error('Stopped.') }
  const send = async (text, pause = 0) => {
    stopped()
    if (!room()) throw new Error(`Go into ${where} first.`)
    await ctx.dispatch.sendRemoteMessage(text.split('{room}').join(room()))
    if (pause) await wait(pause)
  }
  const say = (t) => { tt.status = t; ctx.surfaces.refresh('automation') }
  const game = () => { const g = ctx.application.denPreviews && ctx.application.denPreviews.game; return g && g.ready() ? g : null }
  const tell = (kind, obj = {}) => { try { if (game()) game().send(kind, obj) } catch (_) {} }
  const after = async (key, since, ms) => {
    const end = Date.now() + ms
    while (Date.now() < end) { stopped(); if (tt[key] > since) return true; await wait(200) }
    return false
  }
  const leave = async () => {
    const from = room()
    try { await ctx.dispatch.sendConnectionMessage('%xt%qcmd%-1%19%') } catch (_) {}
    let end = Date.now() + 12000
    while (room() === from && Date.now() < end) { stopped(); await wait(250) }
    if (room() === from) {
      await send('%xt%o%qat%{room}%exit_vol%0%', 300)
      await send('%xt%o%qx%{room}%%', 300)
      end = Date.now() + 12000
      while (room() === from && Date.now() < end) { stopped(); await wait(250) }
      if (room() === from) throw new Error('Couldn’t leave the adventure.')
    }
    await wait(3000)
  }
  const rejoin = async () => {
    const before = room()
    const beforeName = String(ctx.dispatch.getState('roomName') || '')
    await jr.join()
    let end = Date.now() + 2500
    while (room() === before && Date.now() < end) await wait(250)
    if (room() === before) await send(`%xt%o%qs%{room}%${beforeName}%`, 300)
    end = Date.now() + 15000
    while (room() === before) { stopped(); if (Date.now() > end) throw new Error(`Couldn’t get back into ${where}.`); await wait(250) }
    await wait(5000) // let the adventure finish loading
  }
  // One chest: claim it, then open what the rewards screen offers.
  const claim = async (name, label, waitMs = 6000, poke = false) => {
    const t = Date.now()
    say(`${label}: claiming...`)
    // A list of names: send them all quickly (only the real one answers).
    if (Array.isArray(name)) for (const x of name) await send(`%xt%o%qat%{room}%${x}%0%`, 100)
    else await send(`%xt%o%qat%{room}%${name}%0%`)
    // A gift popup with OK (the Beacon's gem chests): press it, a few tries.
    if (poke) { for (let k = 0; k < 3; k++) { await wait(900); tell('rg') } }
    const end = Date.now() + waitMs
    while (Date.now() < end && tt.rewards <= t && tt.list <= t) { stopped(); await wait(200) }
    if (tt.rewards <= t && tt.list <= t) { say(`${label}: ${waitMs < 6000 ? 'done' : 'no rewards screen (already claimed in this game?)'}. Next...`); await wait(waitMs < 6000 ? 300 : 2000); return false }
    await wait(300)
    tell('rs') // show the rewards screen again if JR hid it last time
    await wait(1200)
    if (tt.list > t) {
      // A list of prizes: take each one, a green check over each, then close.
      const n = Math.max(1, Math.min(5, tt.listCount || 1))
      for (let i = 0; i < n; i++) {
        say(`${label}: taking prize ${i + 1} of ${n}...`)
        await send(`%xt%o%qpgift%{room}%${i}%0%0%`, 500)
        tell('rm', { i: i + 1 })
        await wait(700)
      }
      await send('%xt%o%qpgiftdone%{room}%1%', 1200)
      tell('rc')
      return true
    }
    // Chests to pick: open each one the way a click does, then the present and
    // Keep, until the game says it's done (it closes the screen itself).
    // Two picks per chest screen (Rante's manual run: qpgiftplr 1, then 0, then done).
    for (let chest = 1; chest <= 2 && tt.done <= t; chest++) {
      say(`${label}: opening chest ${chest}...`)
      const since = Date.now()
      tell('rp', { i: chest })
      let picked = false
      for (let step = 0; step < 8 && !picked; step++) {
        await wait(1000)
        if (tt.picked > since || tt.done > t) { picked = true; break }
        tell('rg')
      }
      if (!picked) await send(`%xt%o%qpgiftplr%{room}%${chest - 1}%0%0%`)
      await wait(1000)
    }
    if (!(await after('done', t, 4000))) {
      await send('%xt%o%qpgiftdone%{room}%1%', 1000)
      tell('rc')
    }
    await wait(1500)
    return true
  }
  ttHook(ctx)
  tt.strict = !!opts.next
  const me = () => { const p = ctx.dispatch.getState('player') || {}; for (const k of ['sfsUserId', 'userId', 'userid']) if (/^\d+$/.test(String(p[k]))) return String(p[k]); return null }
  const fill = (p) => { if (!p.includes('{me}')) return p; const id = me(); if (!id) throw new Error('Couldn’t find your player number.'); return p.split('{me}').join(id) }
  let fresh = true
  // Out of the adventure: not in a quest_... room or seasonal sin<number> lobby any more.
  const kicked = () => { const n = String(ctx.dispatch.getState('roomName') || ''); return !!n && !/^quest_|^sin\d/i.test(n) }
  tt.running = true; tt.stop = false
  let done = 0
  try {
    for (let round = 1; rounds === 0 || round <= rounds; round++) {
      const tag = rounds === 1 || opts.next ? '' : `Run ${round}${rounds ? ` of ${rounds}` : ''} · `
      if (opts.next) {
        // Chests that turn up on their own (New Year's Fortune): wait for the next one.
        // Rejoining: after each chest, leave and come back in for the chest that's out there.
        if (opts.rejoinNext && done > 0) { say(`Run ${done + 1} · Leaving the adventure...`); await leave(); say(`Run ${done + 1} · Joining again...`); await rejoin() }
        const items = await opts.next(say, stopped, wait, fresh || !!opts.rejoinNext, room(), kicked, { send })
        fresh = false
        if (items === 'kicked') {
          // The game took you out (away too long): join again and carry on.
          if (!opts.autoRejoin) throw new Error('The game took you out of the adventure (away too long).')
          say('The game took you out for being away. Joining again...')
          await wait(2000)
          await rejoin()
          fresh = true
          continue
        }
        for (const c of items) await claim(c.name, c.plain ? c.label : `${c.label} (${done + 1} so far)`, c.waitMs, c.poke)
        done++
        continue
      }
      if (round > 1 && rejoinEachRun) { say(`${tag}Leaving the adventure...`); await leave(); say(`${tag}Joining again...`); await rejoin(); if (opts.before) await opts.before(send, (t) => say(tag + t)) } else if (round > 1) { say(`${tag}Next run in 3 s...`); await wait(3000) }
      if (round === 1 && opts.before) await opts.before(send, (t) => say(tag + t))
      let n = 0
      for (const c of chests) {
        n++
        if (kicked()) {
          // The game took you out (away too long): join again and carry on.
          if (!opts.autoRejoin) throw new Error('The game took you out of the adventure (away too long).')
          say('The game took you out for being away. Joining again...')
          await wait(2000)
          await rejoin()
          if (opts.before) await opts.before(send, (t) => say(tag + t))
        }
        const label = `${tag}${c.label} (${n} of ${chests.length})`
        // A name can depend on the game you're in (Spring Festival's versions); none = not in this game.
        const nm = typeof c.name === 'function' ? c.name(room()) : c.name
        if (!nm) { say(`${label}: not in this game. Next...`); await wait(800); continue }
        const t0 = Date.now()
        for (const p of c.pre || []) {
          if (p.startsWith('wait:')) { await wait(Number(p.slice(5))); continue }
          if (p.startsWith('door:')) {
            // Wait for the game to open that door (Spring Festival's stand-on spots).
            say(`${label}: waiting for the door to open...`)
            const end = Date.now() + 10000
            while (Date.now() < end && !((sf.door[p.slice(5)] || 0) > t0)) { stopped(); await wait(200) }
            await wait(1000)
            continue
          }
          await send(fill(p), 600)
        }
        await claim(nm, label)
        for (const p of c.post || []) await send(fill(p), 400)
      }
      done++
    }
    say(rounds === 1 ? 'Done! Everything ticked is claimed.' : `Done! ${done} run${done === 1 ? '' : 's'}.`)
  } catch (e) {
    say(e.message === 'Stopped.' ? `Stopped${done ? ` after ${done} run${done === 1 ? '' : 's'}` : ''}.` : `Error: ${e.message}`)
  } finally {
    tt.running = false
    ctx.surfaces.refresh('automation')
  }
}

// New Year's Fortune (Rante): a chest drops on the ground about every minute,
// after a countdown (%xt%qcmd%-1%38%<n>%, ten of them). It's one of reward1..14
// (%xt%o%qat%<room>%rewardN%0%; up to 16 or more). JR claims the one the game shows when it sees
// its name (%xt%qcmd%-1%1%rewardN%1%...); if it can't tell which, it tries all 14.
const NY_ALL = Array.from({ length: 20 }, (_, i) => `reward${i + 1}`) // reward16 seen too
const ny = { hooked: false, name: null, at: 0, used: 0, tick: 0, ticks: 0, room: null, gone: false }
function nyHook (ctx) {
  if (ny.hooked) return
  ny.hooked = true
  const text = (payload) => { const m = payload && payload.message; if (!m) return String(payload || ''); if (typeof m === 'string') return m; if (typeof m.raw === 'string') return m.raw; try { return String(m.toMessage()) } catch (_) { return '' } }
  try {
    const seen = (t) => {
      if (/%qcmd%-?\d+%38%/.test(t)) { ny.tick = Date.now(); ny.ticks++; return }
      if (/reward\d+/.test(t)) {
        try { ctx.log({ type: 'info', message: `New Year's Fortune: ${t}` }) } catch (_) {}
        // Shown: qcmd 1 rewardN 1 1 ... (hidden ones have other numbers, like 998 0 0).
        const m = /%qcmd%-?\d+%1%(reward\d+)%1%1%/.exec(t)
        if (m) { ny.name = m[1]; ny.at = Date.now(); ny.gone = false; try { ny.room = ctx.dispatch.getState('room') } catch (_) {} }
        // Taken or removed: qcmd 1 rewardN 998 0 0.
        const g = /%qcmd%-?\d+%1%(reward\d+)%998%/.exec(t)
        if (g && g[1] === ny.name) ny.gone = true
      }
    }
    ctx.dispatch.onMessage({ type: 'aj', message: 'qcmd', callback: (pl) => seen(text(pl)) })
    // Most of them come packed in qqm bundles.
    ctx.dispatch.onMessage({ type: 'aj', message: 'qqm', callback: (pl) => { for (const f of qqmDecode(text(pl)) || []) seen(`%xt%${f[0]}%-1%${f.slice(1).join('%')}%`) } })
  } catch (_) {}
}
async function nyNext (say, stopped, wait, first, room, kicked) {
  // A chest may already be on the ground when you start: the game names it when
  // you come in (in a qqm bundle: qcmd 1 rewardN 1 1 1). Only if JR missed that
  // (it wasn't listening yet), it tries them all once.
  if (first) {
    ny.used = Date.now(); ny.ticks = 0
    if (ny.name && ny.room === room) return ny.gone ? [] : [{ name: ny.name, label: `Chest already here: ${ny.name}` }]
    return [{ name: NY_ALL, label: 'Chest already here? (trying reward1-20)' }]
  }
  say('Waiting for the next chest...')
  while (true) {
    stopped()
    if (kicked && kicked()) return 'kicked'
    const now = Date.now()
    if (ny.at > ny.used) { ny.used = now; ny.ticks = 0; return [{ name: ny.name, label: `New chest: ${ny.name}` }] }
    // Countdown over and no name seen within 3 s: try them all.
    if (ny.ticks >= 3 && now - ny.tick > 3000) { ny.used = now; ny.ticks = 0; return [{ name: NY_ALL, label: 'New chest (trying reward1-20)' }] }
    if (ny.ticks && now - ny.tick < 1500) say(`New chest coming (${Math.max(0, 10 - ny.ticks + 1)})...`)
    await wait(250)
  }
}

// Rejoining Loop: in each game, the chest that's out when you come in; if there
// isn't one (or it's taken), the next one that drops (up to 90 s), then leave.
async function nyNextRejoin (say, stopped, wait, first, room) {
  const since = Date.now()
  ny.used = since; ny.ticks = 0
  // The game names the chest just after you come in.
  while (Date.now() - since < 3000 && !(ny.room === room && ny.name)) { stopped(); await wait(250) }
  if (ny.name && ny.room === room && !ny.gone) return [{ name: ny.name, label: `Chest here: ${ny.name}` }]
  say('No chest here yet. Waiting for the next one...')
  while (Date.now() - since < 90000) {
    stopped()
    const now = Date.now()
    if (ny.at > ny.used && ny.room === room) { ny.used = now; ny.ticks = 0; return [{ name: ny.name, label: `New chest: ${ny.name}` }] }
    if (ny.ticks >= 3 && now - ny.tick > 3000) { ny.used = now; ny.ticks = 0; return [{ name: NY_ALL, label: 'New chest (trying reward1-20)' }] }
    if (ny.ticks && now - ny.tick < 1500) say(`New chest coming (${Math.max(0, 10 - ny.ticks + 1)})...`)
    await wait(250)
  }
  say('No chest came. Joining again...')
  return []
}

// Spring Festival (Rante): goals 1-4 (gui_goal1..4, again and again in the same game),
// and once per game: up to 5 Watered Flowers (pick up pail9, then goldegg<n><version>),
// the lily chest (Lilypad Hop) (stand-on spots
// areatrig01a+b, then s_goldegg1, then off again) and the second golden egg
// (areatrig02a+b, s_goldegg2). Each game uses one version letter a-e for the eggs
// and one for the chests; the game names them when you come in, in a qqm bundle
// (qcmdVT 1 rndplant 4 = d; qcmd 1 goldegg1d 1 1 1 = shown).
const SF_LETTERS = ['a', 'b', 'c', 'd', 'e']
const sf = { hooked: false, room: null, plant: null, chest: null, eggs: {}, treasures: {}, door: {} }
function sfHook (ctx) {
  if (sf.hooked) return
  sf.hooked = true
  const text = (payload) => { const m = payload && payload.message; if (!m) return String(payload || ''); if (typeof m === 'string') return m; if (typeof m.raw === 'string') return m.raw; try { return String(m.toMessage()) } catch (_) { return '' } }
  const here = () => { let r = null; try { r = ctx.dispatch.getState('room') } catch (_) {} if (r !== sf.room) { sf.room = r; sf.plant = null; sf.chest = null; sf.eggs = {}; sf.treasures = {} } }
  const seen = (f) => {
    if (f[0] === 'qcmdVT' && f[2] === 'rndplant') { here(); sf.plant = SF_LETTERS[Number(f[3]) - 1] || null }
    if (f[0] === 'qcmdVT' && f[2] === 'rndchest') { here(); sf.chest = SF_LETTERS[Number(f[3]) - 1] || null }
    // The stand-on spots open a door after a short delay: qcmd 1 areadoor0N 5 1 0.
    const d = f[0] === 'qcmd' && f[1] === '1' && /^areadoor0(\d)$/.exec(f[2] || '')
    if (d && f[3] === '5') sf.door[d[1]] = Date.now()
    if (f[0] === 'qcmd' && f[1] === '1' && f[3] === '1' && f[4] === '1') {
      let m = /^goldegg(\d)([a-e])$/.exec(f[2] || ''); if (m) { here(); sf.eggs[m[1]] = f[2] }
      m = /^treasure(\d)([a-e])$/.exec(f[2] || ''); if (m) { here(); sf.treasures[m[1]] = f[2] }
    }
  }
  try {
    ctx.dispatch.onMessage({ type: 'aj', message: 'qqm', callback: (pl) => { for (const f of qqmDecode(text(pl)) || []) seen(f) } })
    ctx.dispatch.onMessage({ type: 'aj', message: 'qcmd', callback: (pl) => { const t = text(pl); const m = /%qcmd%-?\d+%(.*)$/.exec(t); if (m) seen(['qcmd', ...m[1].split('%')]) } })
  } catch (_) {}
}
// The name to claim in this game: the one the game showed; if JR didn't hear which
// were shown, the version letter; if not even that, all five versions.
function sfName (kind, n, room) {
  const known = sf.room === room
  const shown = kind === 'egg' ? sf.eggs : sf.treasures
  const base = kind === 'egg' ? 'goldegg' : 'treasure'
  if (known && Object.keys(shown).length) return shown[n] || null // not shown = not in this game
  const letter = known ? (kind === 'egg' ? sf.plant : sf.chest) : null
  return letter ? `${base}${n}${letter}` : SF_LETTERS.map(l => `${base}${n}${l}`)
}
const SF_ITEMS = [
  ...[1, 2, 3, 4].map(n => ({ key: `g${n}`, label: `Goal ${n}`, name: `gui_goal${n}` })),
  ...[1, 2, 3, 4, 5].map(n => ({ key: `w${n}`, label: `Watered Flower ${n}`, once: true, name: (room) => sfName('egg', String(n), room), pre: ['%xt%o%qpup%{room}%pail9%{me}%'] })),
  { key: 'lily', label: 'Lilypad Hop', once: true, name: 's_goldegg1', pre: ['%xt%o%qat%{room}%areatrig01a%0%', '%xt%o%qat%{room}%areatrig01b%0%', 'door:1'], post: ['%xt%o%qaut%{room}%areatrig01a%', '%xt%o%qaut%{room}%areatrig01b%'] },
  { key: 'egg2', label: 'Flower Dance', once: true, name: 's_goldegg2', pre: ['%xt%o%qat%{room}%areatrig02a%0%', '%xt%o%qat%{room}%areatrig02b%0%', 'door:2'], post: ['%xt%o%qaut%{room}%areatrig02a%', '%xt%o%qaut%{room}%areatrig02b%'] }
]
const SF_OFF_DEFAULT = []

// Jammer Wall requests (Rante): the game sends %xt%o%wt%<room>%<name>% when you
// come into a room, and the server answers %xt%wt%<room>%0%%1%1%<name>%. The Jammer
// Wall is down on the server, so these only bother other players and pop things up.
// JR drops both, in and out.
let wtHooked = false
function wtHook (ctx) {
  if (wtHooked) return
  wtHooked = true
  let told = false
  const drop = ({ message }) => {
    message.send = false
    if (!told) { told = true; try { ctx.log({ type: 'info', message: 'JR is blocking Jammer Wall (wt) packets.' }) } catch (_) {} }
  }
  try {
    ctx.dispatch.onMessage({ type: 'connection', message: 'wt', callback: drop })
    ctx.dispatch.onMessage({ type: 'aj', message: 'wt', callback: drop })
  } catch (_) {}
}

// Battle for the Beacon (Rante): Earth Crystals ("orbs" in the game) come from the
// Phantom Tubes. A hit is %xt%o%qaa%<room>%<tube>%0%64%3963%439% from anywhere (the
// numbers don't matter); the server answers %xt%qahs%-1%<tube>%<health %>%25%0%. About
// 16 hits break a tube (qad <tube>); it drops <tube>__give_orb (qspn), picked up with
// %xt%o%qat%<room>%<tube>__give_orb%1% for 1 crystal (%xt%cu%..%2%<total>%12%). Tubes
// come back later (pipereset, then qcmd 1 <tube> 1 1 1). Gem chests: treasure1-6 and
// 2treasure1-6, claimed like Twists and Turns' chests, once each until they come back.
const BC_TUBES = []
for (const side of ['', '2']) for (let n = 1; n <= 9; n++) for (const v of ['', 'a']) BC_TUBES.push(`_r_${side}pipe${n}${v}`)
const BC_CHESTS = []
for (const side of ['', '2']) for (let n = 1; n <= 6; n++) BC_CHESTS.push(`${side}treasure${n}`)
const bc = { hooked: false, room: null, tubes: {}, hit: {}, orbs: [], total: null, broken: 0, chestsBack: [] }
function bcHook (ctx) {
  if (bc.hooked) return
  bc.hooked = true
  const text = (payload) => { const m = payload && payload.message; if (!m) return String(payload || ''); if (typeof m === 'string') return m; if (typeof m.raw === 'string') return m.raw; try { return String(m.toMessage()) } catch (_) { return '' } }
  const here = () => { let r = null; try { r = ctx.dispatch.getState('room') } catch (_) {} if (r !== bc.room) { bc.room = r; bc.tubes = {}; bc.hit = {}; bc.orbs = []; bc.chestsBack = [] } }
  const isTube = (n) => /^_r_2?pipe\d+a?$/.test(n || '')
  const seen = (f) => {
    if (f[0] === 'qahs' && isTube(f[1])) { here(); const hp = Number(f[2]); bc.hit[f[1]] = Date.now(); bc.tubes[f[1]] = hp > 0 ? { s: 'alive', hp, at: Date.now() } : { s: 'dead', at: Date.now() } }
    if (f[0] === 'qad' && isTube(f[1])) { here(); bc.tubes[f[1]] = { s: 'dead', at: Date.now() } }
    // Crystals on the ground: from broken tubes (<tube>__give_orb) or ones that turn up on their own.
    if (f[0] === 'qspn' && /orb/i.test(f[2] || '')) { here(); if (!bc.orbs.includes(f[2])) bc.orbs.push(f[2]) }
    if (f[0] === 'qad' && /orb/i.test(f[1] || '')) { bc.orbs = bc.orbs.filter(o => o !== f[1]) }
    if (f[0] === 'qcmd' && f[1] === '1' && isTube(f[2])) { here(); bc.tubes[f[2]] = (f[3] === '1' && f[4] === '1') ? { s: 'alive', hp: 100, at: Date.now() } : { s: 'dead', at: Date.now() } }
    if (f[0] === 'qcmd' && f[1] === '1' && /^2?treasure\d$/.test(f[2] || '') && f[3] === '1' && f[4] === '1') { here(); if (!bc.chestsBack.includes(f[2])) bc.chestsBack.push(f[2]) }
  }
  const raw = (t) => { const m = /^%xt%(\w+)%-?\d+%(.*)$/.exec(t); if (m) seen([m[1], ...m[2].split('%')]) }
  try {
    ctx.dispatch.onMessage({ type: 'aj', message: 'qqm', callback: (pl) => { for (const f of qqmDecode(text(pl)) || []) seen(f) } })
    for (const k of ['qahs', 'qad', 'qspn', 'qcmd']) ctx.dispatch.onMessage({ type: 'aj', message: k, callback: (pl) => raw(text(pl)) })
    // Earth Crystals total: %xt%cu%<room>%2%<total>%12%
    ctx.dispatch.onMessage({ type: 'aj', message: 'cu', callback: (pl) => { const m = /%cu%-?\d+%2%(\d+)%12%/.exec(text(pl)); if (m) bc.total = Number(m[1]) } })
  } catch (_) {}
}
// One step of the Beacon loop: on coming in, the gem chests (if on); after that, break
// one tube and pick up its crystal. Returns chests to claim (the runner opens them).
function bcNextFor (gems) {
  return async (say, stopped, wait, first, room, kicked, api) => {
    const send = api.send
    const crystals = () => bc.total == null ? '' : ` · Earth Crystals: ${bc.total}`
    if (first && gems) return BC_CHESTS.map(n => ({ name: n, label: `Gem chest ${n}`, waitMs: 1000, plain: true, poke: true }))
    if (gems && bc.room === room && bc.chestsBack.length) return bc.chestsBack.splice(0).map(n => ({ name: n, label: `Gem chest ${n} (back)`, waitMs: 1000, plain: true, poke: true }))
    if (bc.room !== room) { bc.room = room; bc.tubes = {}; bc.hit = {}; bc.orbs = [] }
    // Which tube: one the game says is up (lowest health first), else try the others in turn.
    const pick = () => {
      const now = Date.now()
      const alive = BC_TUBES.filter(n => bc.tubes[n] && bc.tubes[n].s === 'alive').sort((a, b) => bc.tubes[a].hp - bc.tubes[b].hp)
      if (alive.length) return alive[0]
      // Not heard from (or broken over a minute ago): try it with one hit.
      return BC_TUBES.find(n => !bc.tubes[n] || (bc.tubes[n].s !== 'alive' && now - bc.tubes[n].at > 60000 && now - (bc.tubes[n].tried || 0) > 60000)) || null
    }
    let misses = 0
    const pickUp = async () => {
      while (bc.orbs.length) {
        stopped()
        const orb = bc.orbs.shift()
        say(`Picking up a crystal (${orb})...${crystals()}`)
        await send(`%xt%o%qat%{room}%${orb}%1%`, 1000)
      }
    }
    while (true) {
      stopped()
      if (kicked && kicked()) return 'kicked'
      await pickUp() // any crystals lying around first
      const tube = pick()
      if (!tube) { say(`No tubes up right now. Waiting for one to come back (picking up any crystals)...${crystals()}`); await wait(1500); continue }
      const t = Date.now()
      if (bc.tubes[tube]) bc.tubes[tube].tried = t; else bc.tubes[tube] = { s: 'unknown', at: t, tried: t }
      const hp = bc.tubes[tube].hp
      say(`Hitting ${tube}${hp != null && bc.tubes[tube].s === 'alive' ? ` (${hp}% left)` : ''}...${crystals()}`)
      const orbsBefore = bc.orbs.length
      await send(`%xt%o%qaa%{room}%${tube}%0%64%3963%439%`)
      await wait(1100) // about the speed of hitting by hand
      if (!((bc.hit[tube] || 0) > t) && bc.tubes[tube].s !== 'dead') {
        // No answer: not up. Remember for a minute.
        bc.tubes[tube] = { s: 'dead', at: Date.now(), tried: t }
        if (++misses % 12 === 0) say(`Looking for a tube that's up...${crystals()}`)
        continue
      }
      misses = 0
      if (bc.tubes[tube].s === 'dead') {
        // Broken: pick up its crystal.
        await wait(600)
        if (bc.orbs.length === orbsBefore && !bc.orbs.includes(`${tube}__give_orb`)) bc.orbs.push(`${tube}__give_orb`) // didn't hear it drop: try the usual name
        say(`${tube} broken!${crystals()}`)
        await pickUp()
        bc.broken++
        say(`Tubes broken: ${bc.broken}${crystals()}`)
        return []
      }
    }
  }
}

// Graham's Workshop (Rante): each resource spot ends with a minigame whose result is
// %xt%o%qmgc%<room>%<spot>_%0%<score>% (the "_" twin of the spot; any letter works).
// It can be repeated as much as you like. The server answers %xt%qpcraft%-1%<material>%<total>%<gained>%.
// These are the spots and the best scores Rante found (for gemstones and gold, 5 gives the
// same amount as 4 plus the stone or silver too).
const GW_ITEMS = [
  { key: 'straw', label: 'Straw', spot: 'gamestraw1d_', score: 7 },
  { key: 'wood', label: 'Wood', spot: 'gamewood2d_', score: 7 },
  { key: 'stone', label: 'Stone', spot: 'gamestone1d_', score: 3 },
  { key: 'gem', label: 'Gemstones', spot: 'gamestone4a_', score: 5 }, // 5 also gives the stone
  { key: 'bamb', label: 'Bamboo', spot: 'gamebamb1d_', score: 5 },
  { key: 'gold', label: 'Silver + gold', spot: 'gamegold4c_', score: 5 } // gold spots at 5 give both
]
const gw = { running: false, stop: false, status: '', hooked: false, totals: {}, names: {}, last: null, gained: 0 }
function gwHook (ctx) {
  if (gw.hooked) return
  gw.hooked = true
  const text = (payload) => { const m = payload && payload.message; if (!m) return String(payload || ''); if (typeof m === 'string') return m; if (typeof m.raw === 'string') return m.raw; try { return String(m.toMessage()) } catch (_) { return '' } }
  try {
    ctx.dispatch.onMessage({ type: 'aj', message: 'qpcraft', callback: (pl) => {
      const m = /%qpcraft%-?\d+%(\d+)%(\d+)%(\d+)%/.exec(text(pl))
      if (!m) return
      gw.totals[m[1]] = Number(m[2]); gw.gained += Number(m[3])
      // Name each material after what JR asked for just before (first time only).
      if (!gw.names[m[1]] && gw.last && Date.now() - gw.last.at < 1500) gw.names[m[1]] = gw.last.label
    } })
  } catch (_) {}
}
async function gwRun (ctx, items, jr = null, autoRejoin = false) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const say = (t) => { gw.status = t; ctx.surfaces.refresh('automation') }
  const totals = () => Object.keys(gw.totals).map(id => `${gw.names[id] || 'material ' + id}: ${gw.totals[id]}`).join(' · ')
  gwHook(ctx)
  gw.running = true; gw.stop = false
  let rounds = 0
  try {
    while (!gw.stop) {
      for (const it of items) {
        if (gw.stop) break
        if (wasKicked(ctx)) {
          if (!autoRejoin || !jr) throw new Error('The game took you out of the adventure (away too long).')
          say('The game took you out for being away. Joining again...')
          await joinAgain(ctx, jr, 'grahams-workshop', 'Graham’s Workshop', () => gw.stop)
        }
        const room = ctx.dispatch.getState('room')
        if (!room) throw new Error('Go into Graham’s Workshop first.')
        gw.last = { label: it.label, at: Date.now() }
        await ctx.dispatch.sendRemoteMessage(`%xt%o%qmgc%${room}%${it.spot}%0%${it.score}%`)
        say(`Round ${rounds + 1} · ${it.label}${totals() ? ' · ' + totals() : ''}`)
        await wait(500)
      }
      rounds++
    }
    say(`Stopped after ${rounds} round${rounds === 1 ? '' : 's'}.${totals() ? ' ' + totals() : ''}`)
  } catch (e) {
    say(e.message === 'Stopped.' ? `Stopped after ${rounds} round${rounds === 1 ? '' : 's'}.` : `Error: ${e.message}`)
  } finally {
    gw.running = false
    ctx.surfaces.refresh('automation')
  }
}

// Tiki Trouble (quest 40, solo): the same steps as the old adventure runner (which
// crashes the game), sent as plain packets like the others:
//   talk to the guide; touch + open each treasure chest; then pick up a pearl and
//   hand it in, three times, about 2.5 minutes apart (the game won't take it sooner).
// treasure1-5 give gems; av_treasure (behind the Arctic Wolf gate) is the special one,
// probably the tree chest (Rante: one chest gives trees).
const TK_GEM_CHESTS = ['treasure1', 'treasure2', 'treasure3', 'treasure4', 'treasure5']
const TK_TREE_CHEST = 'av_treasure'
const TK_PEARLS = 3
// Rante: the timer starts when you finish talking to the guide; each pearl a minute apart.
const TK_PEARL_EVERY = 60 * 1000
const tk = { running: false, stop: false, status: '' }
async function tkRun (ctx, jr, o) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const room = () => ctx.dispatch.getState('room')
  const stopped = () => { if (tk.stop) throw new Error('Stopped.') }
  const say = (t) => { tk.status = t; ctx.surfaces.refresh('automation') }
  const me = () => { const p = ctx.dispatch.getState('player') || {}; for (const k of ['sfsUserId', 'userId', 'userid']) if (/^\d+$/.test(String(p[k]))) return String(p[k]); return null }
  const game = () => { const g = ctx.application.denPreviews && ctx.application.denPreviews.game; return g && g.ready() ? g : null }
  const send = async (text, pause = 0) => {
    stopped()
    if (!room()) throw new Error('Go into Tiki Trouble first.')
    await ctx.dispatch.sendRemoteMessage(text.split('{room}').join(room()))
    if (pause) await wait(pause)
  }
  // Wait in small steps so Stop works and a kick is noticed.
  const nap = async (ms, label) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      stopped(); await kicked()
      if (label) say(`${label} (${Math.ceil((end - Date.now()) / 1000)} s)`)
      await wait(1000)
    }
  }
  let rejoined = false
  const kicked = async () => {
    if (!wasKicked(ctx)) return
    if (!o.autoRejoin) throw new Error('The game took you out of the adventure (away too long).')
    say('The game took you out for being away. Joining again...')
    await hostAgain(ctx, jr, 'tiki-trouble', 40, 'Tiki Trouble', () => tk.stop)
    rejoined = true
  }
  const leave = async () => {
    const from = room()
    try { await ctx.dispatch.sendConnectionMessage('%xt%qcmd%-1%19%') } catch (_) {}
    let end = Date.now() + 12000
    while (room() === from && Date.now() < end) { stopped(); await wait(250) }
    if (room() === from) {
      await send('%xt%o%qat%{room}%exit_vol%0%', 300)
      await send('%xt%o%qx%{room}%%', 300)
      end = Date.now() + 12000
      while (room() === from && Date.now() < end) { stopped(); await wait(250) }
      if (room() === from) throw new Error('Couldn’t leave the adventure.')
    }
    await wait(3000)
  }
  let runStart = 0
  const once = async (tag) => {
    rejoined = false
    runStart = Date.now()
    say(`${tag}Talking to the guide...`)
    await send('%xt%o%qaskr%{room}%alpha0%0%1%')
    const timer = Date.now() // the pearl timer starts now
    await wait(1500)
    const chests = [...(o.tree ? [TK_TREE_CHEST] : []), ...(o.chests ? TK_GEM_CHESTS : [])]
    let n = 0
    for (const chest of chests) {
      n++; await kicked()
      say(`${tag}${chest === TK_TREE_CHEST ? 'Tree chest' : 'Gem chest'} (${n} of ${chests.length})...`)
      await send(`%xt%o%qat%{room}%${chest}%0%`, 500)
      await send(`%xt%o%qatt%{room}%${chest}%1%`, 500)
      for (let k = 0; k < 2; k++) { await wait(600); try { if (game()) game().send('rg', {}) } catch (_) {} } // gift popup: Keep / OK
    }
    if (o.pearls) {
      for (let p = 1; p <= TK_PEARLS; p++) {
        // Pearl p at 1, 2 and 3 minutes after the talk.
        const due = timer + p * TK_PEARL_EVERY
        if (Date.now() < due) await nap(due - Date.now(), `${tag}Pearl ${p} of ${TK_PEARLS} in`)
        if (rejoined) { say(`${tag}Back in after a kick: starting this run again...`); return once(tag) }
        await kicked()
        const id = me()
        if (!id) throw new Error('Couldn’t find your player number.')
        say(`${tag}Pearl ${p} of ${TK_PEARLS}: picking it up and handing it in...`)
        await send(`%xt%o%qpup%{room}%tikipearl3%${id}%`, 1000)
        const handed = Date.now()
        await send('%xt%o%qat%{room}%alpha1%0%')
        // Handing it in opens a conversation; the prizes only come once it's finished:
        // answer with the number the server gave that conversation.
        const end = Date.now() + 3000
        while (Date.now() < end && !((talks.last.alpha1 || {}).at > handed)) await wait(200)
        const t = talks.last.alpha1
        if (t && t.at > handed) await send(`%xt%o%qaskr%{room}%alpha1%${t.n}%1%`, 1500)
        else { await send('%xt%o%qaskr%{room}%alpha1%44%1%', 800); await send('%xt%o%qaskr%{room}%alpha1%0%1%', 1500) } // didn't hear it: the one Rante saw, then 0
        say(`${tag}Pearl ${p} of ${TK_PEARLS} handed in. Looking for the prize chests...`)
        const got = await openPrizeChests(ctx, send, (x) => say(`${tag}Pearl ${p}: ${x}`), handed, p === TK_PEARLS ? 12000 : 8000)
        if (!got) say(`${tag}Pearl ${p}: no prize chests came.`)
      }
    }
  }
  pzHook(ctx); talkHook(ctx)
  tk.running = true; tk.stop = false
  let done = 0
  try {
    for (let run = 1; o.rounds === 0 || run <= o.rounds; run++) {
      const tag = o.rounds === 1 ? '' : `Run ${run}${o.rounds ? ` of ${o.rounds}` : ''} · `
      if (run > 1) { say(`${tag}Leaving the adventure...`); await leave(); say(`${tag}Joining again...`); await hostAgain(ctx, jr, 'tiki-trouble', 40, 'Tiki Trouble', () => tk.stop) }
      await once(tag)
      done++
    }
    say(done === 1 ? 'Done! Check your inventory for the treasure.' : `Done! ${done} runs.`)
  } catch (e) {
    say(e.message === 'Stopped.' ? `Stopped${done ? ` after ${done} run${done === 1 ? '' : 's'}` : ''}.` : `Error: ${e.message}`)
  } finally {
    tk.running = false
    ctx.surfaces.refresh('automation')
  }
}

// Conversations: when you talk to someone the server sends %xt%qcmd%-1%3%0%<who>%<n>%..%
// (sometimes inside a qqm bundle), and finishing it is %xt%o%qaskr%<room>%<who>%<n>%1%
// with that same <n> (Rante: Tiki's guide after the second pearl was 44).
const talks = { hooked: false, last: {} }
function talkHook (ctx) {
  if (talks.hooked) return
  talks.hooked = true
  const text = (payload) => { const m = payload && payload.message; if (!m) return String(payload || ''); if (typeof m === 'string') return m; if (typeof m.raw === 'string') return m.raw; try { return String(m.toMessage()) } catch (_) { return '' } }
  const seen = (f) => { if (f[0] === 'qcmd' && f[1] === '3' && f[3] && /^\d+$/.test(String(f[4]))) talks.last[f[3]] = { n: f[4], at: Date.now() } }
  try {
    ctx.dispatch.onMessage({ type: 'aj', message: 'qcmd', callback: (pl) => { const m = /%qcmd%-?\d+%(.*)$/.exec(text(pl)); if (m) seen(['qcmd', ...m[1].split('%')]) } })
    ctx.dispatch.onMessage({ type: 'aj', message: 'qqm', callback: (pl) => { for (const f of qqmDecode(text(pl)) || []) seen(f) } })
  } catch (_) {}
}

// A prize list (%xt%qpgift%-1%<count>%... , sometimes packed in a qqm bundle), as at the
// end of Phantoms, Tiki Trouble and the Forgotten Desert: take every prize, a green
// check over each, then close the screen.
const pz = { hooked: false, at: 0, count: 0 }
function pzHook (ctx) {
  if (pz.hooked) return
  pz.hooked = true
  const text = (payload) => { const m = payload && payload.message; if (!m) return String(payload || ''); if (typeof m === 'string') return m; if (typeof m.raw === 'string') return m.raw; try { return String(m.toMessage()) } catch (_) { return '' } }
  try {
    ctx.dispatch.onMessage({ type: 'aj', message: 'qpgift', callback: (pl) => { const m = /%qpgift%-?\d+%(\d+)%/.exec(text(pl)); pz.count = m ? Number(m[1]) : 0; pz.at = Date.now() } })
    ctx.dispatch.onMessage({ type: 'aj', message: 'qqm', callback: (pl) => { const f = (qqmDecode(text(pl)) || []).find(x => x[0] === 'qpgift'); if (f) { pz.count = Number(f[1]) || 0; pz.at = Date.now() } } })
  } catch (_) {}
}
// The prize chests after a pearl (a non-member and a member chest: you get both): open each
// one on the screen the way a click does, then the present and Keep, like Bitter Sweets.
async function openPrizeChests (ctx, send, say, since, waitMs) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const tell = (kind, obj = {}) => { try { const g = ctx.application.denPreviews && ctx.application.denPreviews.game; if (g && g.ready()) g.send(kind, obj) } catch (_) {} }
  ttHook(ctx)
  const end = Date.now() + waitMs
  while (Date.now() < end && pz.at <= since && tt.rewards <= since) await wait(250)
  if (pz.at <= since && tt.rewards <= since) return false
  const n = Math.max(1, Math.min(5, pz.at > since && pz.count ? pz.count : 2))
  await wait(300); tell('rs'); await wait(1200)
  for (let chest = 1; chest <= n && tt.done <= since; chest++) {
    say(`Opening chest ${chest} of ${n}...`)
    const t = Date.now()
    tell('rp', { i: chest })
    let picked = false
    for (let step = 0; step < 8 && !picked; step++) {
      await wait(1000)
      if (tt.picked > t || tt.done > since) { picked = true; break }
      tell('rg')
    }
    if (!picked) await send(`%xt%o%qpgift%{room}%${chest - 1}%0%0%`, 500) // clicking didn't work: take it by packet
    await wait(800)
  }
  const doneBy = Date.now() + 3000
  while (Date.now() < doneBy && tt.done <= since) await wait(250)
  if (tt.done <= since) { await send('%xt%o%qpgiftdone%{room}%1%', 1000); tell('rc') }
  return true
}
async function claimPrizeList (ctx, send, say, since, waitMs, fallbackCount) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const tell = (kind, obj = {}) => { try { const g = ctx.application.denPreviews && ctx.application.denPreviews.game; if (g && g.ready()) g.send(kind, obj) } catch (_) {} }
  const end = Date.now() + waitMs
  while (Date.now() < end && pz.at <= since) await wait(250)
  if (pz.at <= since && !fallbackCount) return false // no prize list came: nothing to take
  const n = Math.max(1, Math.min(8, pz.at > since && pz.count ? pz.count : fallbackCount))
  tell('rs'); await wait(1200)
  for (let i = 0; i < n; i++) {
    say(`Taking prize ${i + 1} of ${n}...`)
    await send(`%xt%o%qpgift%{room}%${i}%0%0%`, 500)
    tell('rm', { i: i + 1 })
    await wait(700)
  }
  await send('%xt%o%qpgiftdone%{room}%1%', 1200)
  tell('rc')
  return true
}

// The Forgotten Desert (Rante's run, quest 23): talk to Liza; open the treasure chests
// (treasure01-40, touch + open; only a few spawn); collect the crystals: green
// 1crystal_NNa/b, yellow 2crystal_NNa/b, blue 3crystal_NNa/b (pick up the pail
// 3pail_00g, water 3water_NNx, then collect), white 4crystal_NNa/b (sit on 4socvolNNx,
// collect, stand up); then take the prizes. Each spot spawns as a or b; the game names
// the ones that spawned when you come in (qcmd 1 <name> 1 1 1), so JR only sends those.
const td = { running: false, stop: false, status: '', hooked: false, room: null, roomAt: 0, shown: new Set(), letter: {}, giftWait: 0, lit: new Set(), goal5: 0, change: 0 }
function tdHook (ctx) {
  if (td.hooked) return
  td.hooked = true
  const text = (payload) => { const m = payload && payload.message; if (!m) return String(payload || ''); if (typeof m === 'string') return m; if (typeof m.raw === 'string') return m.raw; try { return String(m.toMessage()) } catch (_) { return '' } }
  const here = () => { let r = null; try { r = ctx.dispatch.getState('room') } catch (_) {} if (r !== td.room) { td.room = r; td.roomAt = Date.now(); td.shown = new Set(); td.letter = {}; td.giftWait = 0; td.lit = new Set(); td.goal5 = 0 } }
  const seen = (f) => {
    // The join bundle: qcmdVT 1 option_<colour> <1 = a, 2 = b> (which version of every
    // spot of that colour this game uses), and qcmdVT 1 guipckgft1_w 180 (the colour
    // rewards' timer, in seconds).
    if (f[0] === 'qcmdVT' && /^option_[1-5]$/.test(f[2] || '')) { here(); td.letter[f[2].slice(7)] = ({ 1: 'a', 2: 'b' })[f[3]] || null; return }
    if (f[0] === 'qcmdVT' && /^guipckgft\d_w$/.test(f[2] || '') && /^\d+$/.test(f[3])) { here(); td.giftWait = Math.max(td.giftWait, Number(f[3])); return }
    // The fifth colour: one pedestal is lit at a time (qcmd 1 5socvolNNa-d 1 1 1); filling
    // its four seats lights the next (the finished one goes to 99); after about 7 a fifth
    // crystal appears, and picking it up starts a new chain. gui_goal5 counts them.
    if (f[0] === 'qcmdVT' && f[2] === 'gui_goal5' && /^\d+$/.test(f[3])) { here(); td.goal5 = Number(f[3]); td.change = Date.now(); return }
    const ped = f[0] === 'qcmd' && f[1] === '1' && /^5socvol(\d+)a$/.exec(f[2] || '')
    if (ped) { here(); if (f[3] === '1' && f[4] === '1') td.lit.add(ped[1]); else td.lit.delete(ped[1]); td.change = Date.now(); return }
    if (f[0] !== 'qcmd' || f[1] !== '1' || !/^(treasure\d+|[1-5]crystal_\d+[ab])$/.test(f[2] || '')) return
    if (/^5crystal/.test(f[2])) td.change = Date.now()
    here()
    if (f[3] === '1' && f[4] === '1') td.shown.add(f[2]); else td.shown.delete(f[2])
  }
  try {
    ctx.dispatch.onMessage({ type: 'aj', message: 'qqm', callback: (pl) => { for (const f of qqmDecode(text(pl)) || []) seen(f) } })
    ctx.dispatch.onMessage({ type: 'aj', message: 'qcmd', callback: (pl) => { const m = /%qcmd%-?\d+%(.*)$/.exec(text(pl)); if (m) seen(['qcmd', ...m[1].split('%')]) } })
  } catch (_) {}
}
const pad2 = (n) => String(n).padStart(2, '0')
async function tdRun (ctx, jr, o) {
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const room = () => ctx.dispatch.getState('room')
  const stopped = () => { if (td.stop) throw new Error('Stopped.') }
  const say = (t) => { td.status = t; ctx.surfaces.refresh('automation') }
  const me = () => { const p = ctx.dispatch.getState('player') || {}; for (const k of ['sfsUserId', 'userId', 'userid']) if (/^\d+$/.test(String(p[k]))) return String(p[k]); return null }
  const tell = (kind) => { try { const g = ctx.application.denPreviews && ctx.application.denPreviews.game; if (g && g.ready()) g.send(kind, {}) } catch (_) {} }
  const send = async (text, pause = 0) => {
    stopped()
    if (!room()) throw new Error('Go into the Forgotten Desert first.')
    await ctx.dispatch.sendRemoteMessage(text.split('{room}').join(room()))
    if (pause) await wait(pause)
  }
  const kicked = async () => {
    if (!wasKicked(ctx)) return false
    if (!o.autoRejoin) throw new Error('The game took you out of the adventure (away too long).')
    say('The game took you out for being away. Joining again...')
    await hostAgain(ctx, jr, 'tfd', 23, 'the Forgotten Desert', () => td.stop)
    return true
  }
  const leave = async () => {
    const from = room()
    try { await ctx.dispatch.sendConnectionMessage('%xt%qcmd%-1%19%') } catch (_) {}
    let end = Date.now() + 12000
    while (room() === from && Date.now() < end) { stopped(); await wait(250) }
    if (room() === from) {
      await send('%xt%o%qx%{room}%%', 300)
      end = Date.now() + 12000
      while (room() === from && Date.now() < end) { stopped(); await wait(250) }
      if (room() === from) throw new Error('Couldn’t leave the adventure.')
    }
    await wait(3000)
  }
  // The spots of one kind in this game: the ones the game showed, else every a and b.
  const spots = (re, max) => {
    const known = td.room === room() ? [...td.shown].filter(n => re.test(n)).sort() : []
    if (known.length) return known
    const all = []
    for (let n = 1; n <= max; n++) for (const v of ['a', 'b']) all.push(re.source.replace(/^\^|\\d\+\[ab\]\$$/g, '') + pad2(n) + v)
    return all
  }
  const once = async (tag) => {
    const t0 = Date.now()
    say(`${tag}Talking to Liza...`)
    await send('%xt%o%qaskr%{room}%liza01_%0%1%', 3000)
    if (o.chests) {
      const known = td.room === room() ? [...td.shown].filter(n => /^treasure\d+$/.test(n)).sort() : []
      const list = known.length ? known : Array.from({ length: 40 }, (_, i) => `treasure${pad2(i + 1)}`)
      let n = 0
      for (const c of list) {
        n++; if (await kicked()) return once(tag)
        say(`${tag}Treasure chests: ${c} (${n} of ${list.length})...`)
        await send(`%xt%o%qat%{room}%${c}%0%`, 300)
        await send(`%xt%o%qatt%{room}%${c}%1%`, 300)
        if (known.length) { for (let k = 0; k < 2; k++) { await wait(700); tell('rg') } } // gems or item popup: Keep / OK
      }
    }
    const each = async (label, list, fn) => {
      let n = 0
      for (const c of list) { n++; if (await kicked()) return true; say(`${tag}${label}: ${c} (${n} of ${list.length})...`); await fn(c) }
      return false
    }
    // Rante: each colour needs a set number (the highest number in her run); more spawn,
    // but only spots up to that number count. The chest for a colour comes when enough are
    // collected, and it only gives anything if that last crystal is collected at least
    // 3 minutes into the game (the game says 180 s). So: all but one of each colour now, the last one of each
    // after the 4 minutes, then the prizes.
    const NEED = { 1: 25, 2: 25, 3: 20, 4: 15 }
    const pick = (type) => {
      const max = NEED[type]
      const re = new RegExp(`^${type}crystal_(\\d+)[ab]$`)
      const known = td.room === room() ? [...td.shown].filter(n => re.test(n) && Number(re.exec(n)[1]) <= max).sort() : []
      if (known.length >= max) return { early: known.slice(0, max - 1), late: [known[max - 1]] }
      if (known.length) {
        // Not all heard: the ones heard, plus a and b for the rest (only one of each spawned).
        const have = new Set(known.map(n => Number(re.exec(n)[1])))
        const rest = []
        for (let n = 1; n <= max; n++) if (!have.has(n)) rest.push(`${type}crystal_${pad2(n)}a`, `${type}crystal_${pad2(n)}b`)
        const all = [...known, ...rest]
        const last = known.includes(`${type}crystal_${pad2(max)}a`) || known.includes(`${type}crystal_${pad2(max)}b`)
          ? known.filter(n => Number(re.exec(n)[1]) === max) : [`${type}crystal_${pad2(max)}a`, `${type}crystal_${pad2(max)}b`]
        return { early: all.filter(n => !last.includes(n)), late: last }
      }
      const L = td.room === room() ? td.letter[type] : null // this game's version of that colour
      const vs = L ? [L] : ['a', 'b']
      const early = []
      for (let n = 1; n < max; n++) for (const v of vs) early.push(`${type}crystal_${pad2(n)}${v}`)
      return { early, late: vs.map(v => `${type}crystal_${pad2(max)}${v}`) }
    }
    const grab = {
      1: (c) => send(`%xt%o%qat%{room}%${c}%0%`, 400),
      2: (c) => send(`%xt%o%qat%{room}%${c}%0%`, 400),
      3: async (c) => {
        const id = me(); if (!id) throw new Error('Couldn’t find your player number.')
        const k = c.slice('3crystal_'.length)
        await send(`%xt%o%qpup%{room}%3pail_00g%${id}%`, 600)
        await send(`%xt%o%qat%{room}%3water_${k}%0%`, 600)
        await send(`%xt%o%qat%{room}%${c}%0%`, 600)
      },
      4: async (c) => {
        const k = c.slice('4crystal_'.length)
        await send(`%xt%o%qat%{room}%4socvol${k}%0%`, 600)
        await send(`%xt%o%qat%{room}%${c}%0%`, 600)
        await send(`%xt%o%qaut%{room}%4socvol${k}%`, 400)
      }
    }
    const NAMES = { 1: 'Green', 2: 'Yellow', 3: 'Blue', 4: 'White' }
    const types = [1, 2, 3, 4].filter(k => o[NAMES[k].toLowerCase()])
    const plan = {}
    for (const k of types) plan[k] = pick(k)
    for (const k of types) if (await each(`${NAMES[k]} crystals`, plan[k].early, grab[k])) return once(tag)
    // Fifth colour: follow the pedestals and pick up 4 crystals now; the 5th is held until after the timer.
    let held5 = null
    if (o.fifth) {
      const NEED5 = 5
      let got = td.room === room() ? td.goal5 : 0
      let idle = Date.now()
      while (true) {
        stopped(); if (await kicked()) return once(tag)
        const crystal = td.room === room() ? [...td.shown].find(n => /^5crystal_/.test(n)) : null
        if (crystal) {
          if (got >= NEED5 - 1) { held5 = crystal; break } // the last one: after the timer
          say(`${tag}Purple crystals: picking up ${crystal} (${got + 1} of ${NEED5})...`)
          td.shown.delete(crystal)
          await send(`%xt%o%qat%{room}%${crystal}%0%`, 1500)
          got = Math.max(got + 1, td.goal5); idle = Date.now()
          continue
        }
        const lit = td.room === room() ? [...td.lit][0] : null
        if (lit) {
          say(`${tag}Purple crystals (${got} of ${NEED5}): pedestal ${lit}...`)
          const before = td.change
          for (const seat of ['a', 'b', 'c', 'd']) await send(`%xt%o%qat%{room}%5socvol${lit}${seat}%0%`, 500)
          const end = Date.now() + 5000
          while (Date.now() < end && td.change === before) await wait(200)
          await wait(500)
          td.lit.delete(lit) // the next one (or the crystal) comes in its own message
          idle = Date.now()
          continue
        }
        if (Date.now() - idle > 20000) { say(`${tag}Purple crystals: no pedestal lit (got ${got} of ${NEED5}). Going on.`); await wait(1500); break }
        say(`${tag}Purple crystals (${got} of ${NEED5}): waiting for a pedestal to light up...`)
        await wait(500)
      }
    }
    if (types.length || held5) {
      // The wait, counted from when you came into this game: the game's own timer for the
      // colour rewards (180 s in Rante's join bundle), plus 10 s to be safe.
      const start = td.room === room() && td.roomAt ? td.roomAt : t0
      const secs = td.room === room() && td.giftWait ? td.giftWait : 180
      const ready = start + secs * 1000 + 10000
      while (Date.now() < ready) {
        stopped(); if (await kicked()) return once(tag)
        const left = Math.ceil((ready - Date.now()) / 1000)
        say(`${tag}All but the last crystal of each colour collected. The last ones count after ${Math.round(secs / 60)} minutes: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`)
        await wait(1000)
      }
      for (const k of types) {
        if (await each(`${NAMES[k]} crystals (last)`, plan[k].late, grab[k])) return once(tag)
        for (let n = 0; n < 2; n++) { await wait(600); tell('rg') } // the colour's reward popup
      }
      if (held5) {
        say(`${tag}Purple crystals: the last one (${held5})...`)
        await send(`%xt%o%qat%{room}%${held5}%0%`, 1500)
        for (let n = 0; n < 2; n++) { await wait(600); tell('rg') }
      }
    }
    // Each colour's reward (Rante: the prizes down the side of the screen, in colour order:
    // 0 green, 1 yellow, 2 blue, 3 white, 4 purple), for the colours done this run.
    const prizes = [...types.map(k => k - 1), ...(o.fifth ? [4] : [])]
    if (prizes.length) {
      const tellG = (kind, obj = {}) => { try { const g = ctx.application.denPreviews && ctx.application.denPreviews.game; if (g && g.ready()) g.send(kind, obj) } catch (_) {} }
      await wait(1500)
      tellG('rs'); await wait(1200)
      for (const i of prizes) {
        say(`${tag}Taking the ${['green', 'yellow', 'blue', 'white', 'purple'][i]} reward...`)
        await send(`%xt%o%qpgift%{room}%${i}%0%0%`, 500)
        tellG('rm', { i: i + 1 })
        await wait(700)
      }
      await send('%xt%o%qpgiftdone%{room}%1%', 1200)
      tellG('rc')
    }
  }
  tdHook(ctx); pzHook(ctx)
  td.running = true; td.stop = false
  let done = 0
  try {
    for (let run = 1; o.rounds === 0 || run <= o.rounds; run++) {
      const tag = o.rounds === 1 ? '' : `Run ${run}${o.rounds ? ` of ${o.rounds}` : ''} · `
      if (run > 1) { say(`${tag}Leaving the adventure...`); await leave(); say(`${tag}Joining again...`); await hostAgain(ctx, jr, 'tfd', 23, 'the Forgotten Desert', () => td.stop) }
      await once(tag)
      done++
    }
    say(done === 1 ? 'Done!' : `Done! ${done} runs.`)
  } catch (e) {
    say(e.message === 'Stopped.' ? `Stopped${done ? ` after ${done} run${done === 1 ? '' : 's'}` : ''}.` : `Error: ${e.message}`)
  } finally {
    td.running = false
    ctx.surfaces.refresh('automation')
  }
}

// The automation window: opened after joining with Automate on, or from JR's
// gear at the top right while in an adventure (anchor "questgear").
const automation = {
  id: 'automation',
  // Listen from the start, so JR hears which New Year's Fortune chest is out when you come in.
  init (ctx) { try { nyHook(ctx) } catch (_) {} try { sfHook(ctx) } catch (_) {} try { wtHook(ctx) } catch (_) {} try { bcHook(ctx) } catch (_) {} try { gwHook(ctx) } catch (_) {} try { pzHook(ctx) } catch (_) {} try { tdHook(ctx) } catch (_) {} try { talkHook(ctx) } catch (_) {} },
  plugin: 'adventure-runner',
  buttons: [{ at: 'questgear', label: 'Adventure automation', icon: 'gear' }],
  view (state, ctx) {
    const jr = adventures._load(ctx)
    const page = adventures.page
    // Opening the window: pick the adventure you're in from the room's name
    // (quest_<number>... or sin<number>_...), or the one JRR joined last.
    if (!jr.state().running && !state.picked) {
      state.picked = true
      let room = ''
      try { room = String(ctx.dispatch.getState('roomName') || '') } catch (_) {}
      // quest_<n>_<adventure>_... (e.g. quest_1_46_506_...) or sin<adventure>_...
      const m = /^quest_\d+_(\d+)/i.exec(room) || /^sin(\d+)/i.exec(room)
      const byRoom = m ? jr.list.findIndex(a => Number(a.questId) === Number(m[1])) : -1
      const byJoin = jr.list.findIndex(a => a.id === jr.joined())
      const pick = byRoom >= 0 ? byRoom : byJoin
      if (pick >= 0 && jr.list[pick].id !== jr.state().id) jr.select(pick)
    }
    const s = jr.state()
    const adv = jr.list.find(a => a.id === s.id) || jr.list[0]
    const prize = page.element('prizeChoice').value || 'manual'
    const rows = []
    rows.push({ t: 'chips', id: 'pick', label: 'Adventure you’re in', v: String(jr.list.indexOf(adv)), opts: jr.list.map((a, i) => ({ v: String(i), l: a.name })) })
    if (adv.id === 'tfd') {
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('tdOff', [])
      if (td.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: td.status })
        rows.push({ t: 'btn', id: 'tdstop', label: 'Stop', style: 'danger' })
      } else {
        const btn = (key, label) => { const on = !off.includes(key); return { id: `td:${key}`, label, style: on ? 'on' : 'normal', v: on ? '0' : '1' } }
        if (td.room === ctx.dispatch.getState('room') && td.shown.size) rows.push({ t: 'p', c: 'dim', text: `This game: ${[...td.shown].filter(n => /^treasure/.test(n)).length} chests, ${[...td.shown].filter(n => /crystal/.test(n)).length} crystals spawned` })
        rows.push({ t: 'p', c: 'dim', text: 'Do (green = on):' })
        rows.push({ t: 'row', items: [btn('chests', 'Treasure chests')] })
        rows.push({ t: 'row', items: [btn('green', 'Green'), btn('yellow', 'Yellow'), btn('blue', 'Blue'), btn('white', 'White')] })
        rows.push({ t: 'row', items: [btn('fifth', 'Purple')] })
        const loop = !!st.get('tdLoop', false)
        rows.push({ t: 'tog', id: 'tdloop', label: 'Keep going', sub: 'Leave, join again and do it all again', v: loop })
        if (loop) rows.push({ t: 'num', id: 'tdrounds', label: 'Runs (0 = until you stop)', v: Number(st.get('tdRounds', 0)), step: 1 })
        rows.push(kickRow(ctx))
        rows.push({ t: 'btn', id: 'tdgo', label: 'Start automation', style: 'primary' })
        if (td.status) rows.push({ t: 'p', c: 'dim', text: td.status })
      }
      return { title: 'Automation', rows, foot: 'Liza, the chests that spawned, the crystals, then each colour’s reward. You stay where you start.', h: 420 }
    }
    if (adv.id === 'tiki-trouble') {
      const st = ctx.surfaces.store('adventure-runner')
      if (tk.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: tk.status })
        rows.push({ t: 'btn', id: 'tkstop', label: 'Stop', style: 'danger' })
      } else {
        rows.push({ t: 'tog', id: 'tkchests', label: 'Gem chests', sub: 'treasure1-5', v: !!st.get('tkChests', true) })
        rows.push({ t: 'tog', id: 'tktree', label: 'Tree chest', sub: 'The special one behind the Arctic Wolf gate (av_treasure)', v: !!st.get('tkTree', true) })
        rows.push({ t: 'tog', id: 'tkpearls', label: 'Pearls (3)', sub: 'One a minute after talking to the guide, each with its prize chests', v: !!st.get('tkPearls', true) })
        const loop = !!st.get('tkLoop', false)
        rows.push({ t: 'tog', id: 'tkloop', label: 'Keep going', sub: 'Leave, join again and do it all again', v: loop })
        if (loop) rows.push({ t: 'num', id: 'tkrounds', label: 'Runs (0 = until you stop)', v: Number(st.get('tkRounds', 0)), step: 1 })
        rows.push(kickRow(ctx))
        rows.push({ t: 'btn', id: 'tkgo', label: 'Start automation', style: 'primary' })
        if (tk.status) rows.push({ t: 'p', c: 'dim', text: tk.status })
      }
      return { title: 'Automation', rows, foot: 'Guide, chests, then a pearl each minute. You stay where you start.', h: 420 }
    }
    if (adv.id === 'grahams-workshop') {
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('gwOff', [])
      if (gw.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: gw.status })
        rows.push({ t: 'btn', id: 'gwstop', label: 'Stop', style: 'danger' })
      } else {
        const btn = (it) => { const on = !off.includes(it.key); return { id: `gw:${it.key}`, label: it.label, style: on ? 'on' : 'normal', v: on ? '0' : '1' } }
        rows.push({ t: 'p', c: 'dim', text: 'Collect (green = on):' })
        const by = (keys) => keys.map(k => GW_ITEMS.find(it => it.key === k)).filter(Boolean).map(btn)
        rows.push({ t: 'row', items: by(['straw', 'wood', 'bamb']) })
        rows.push({ t: 'row', items: by(['stone', 'gem']) })
        rows.push({ t: 'row', items: by(['gold']) })
        rows.push(kickRow(ctx))
        rows.push({ t: 'btn', id: 'gwgo', label: 'Start automation', style: 'primary' })
        if (gw.status) rows.push({ t: 'p', c: 'dim', text: gw.status })
      }
      return { title: 'Automation', rows, foot: 'Collects the ticked materials over and over, one every half second, until you stop. You stay where you are.', h: 340 }
    }
    if (adv.id === 'battle-for-the-beacon') {
      const st = ctx.surfaces.store('adventure-runner')
      if (tt.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: tt.status })
        rows.push({ t: 'btn', id: 'ttstop', label: 'Stop', style: 'danger' })
      } else {
        rows.push({ t: 'p', c: 'dim', text: 'Breaks the Phantom Tubes and picks up their Earth Crystals, until you stop. You stay where you start.' })
        rows.push({ t: 'tog', id: 'bcgems', label: 'Gem chests', sub: 'Claim the hidden chests whenever they’re there', v: !!st.get('bcGems', true) })
        rows.push({ t: 'tog', id: 'bcauto', label: 'Join again if kicked', sub: 'When the game takes you out for being away', v: !!st.get('bcAuto', true) })
        rows.push({ t: 'btn', id: 'bcgo', label: 'Start automation', style: 'primary' })
        if (bc.total != null) rows.push({ t: 'p', c: 'dim', text: `Earth Crystals: ${bc.total}` })
        if (tt.status) rows.push({ t: 'p', c: 'dim', text: tt.status })
      }
      return { title: 'Automation', rows, foot: 'About one hit a second, like hitting by hand.', h: 330 }
    }
    if (adv.id === 'spring-festival') {
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('sfOff', SF_OFF_DEFAULT)
      if (tt.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: tt.status })
        rows.push({ t: 'btn', id: 'ttstop', label: 'Stop', style: 'danger' })
      } else {
        const r = ctx.dispatch.getState('room')
        if (sf.room === r && (sf.plant || sf.chest)) rows.push({ t: 'p', c: 'dim', text: `This game: eggs version ${(sf.plant || '?').toUpperCase()}, chests version ${(sf.chest || '?').toUpperCase()}${Object.keys(sf.eggs).length ? ` · eggs here: ${Object.keys(sf.eggs).sort().join(', ')}` : ''}` })
        // Compact: one row of on/off buttons per group (green = on). Click to switch.
        const btn = (key, label) => { const on = !off.includes(key); return { id: `sf:${key}`, label, style: on ? 'on' : 'normal', v: on ? '0' : '1' } }
        rows.push({ t: 'p', c: 'dim', text: 'Goals (again and again):' })
        rows.push({ t: 'row', items: [1, 2, 3, 4].map(n => btn(`g${n}`, String(n))) })
        rows.push({ t: 'p', c: 'dim', text: 'Watered Flowers (once per game):' })
        rows.push({ t: 'row', items: [1, 2, 3, 4, 5].map(n => btn(`w${n}`, String(n))) })
        rows.push({ t: 'p', c: 'dim', text: 'Once per game:' })
        rows.push({ t: 'row', items: [btn('lily', 'Lilypad Hop'), btn('egg2', 'Flower Dance')] })
        const loop = !!st.get('sfLoop', false)
        const once = SF_ITEMS.some(it => it.once && !off.includes(it.key))
        rows.push({ t: 'tog', id: 'sfloop', label: 'Keep going', sub: once ? 'Leave, join again and claim everything again' : 'Claim the goals again and again in this game', v: loop })
        if (loop) rows.push({ t: 'num', id: 'sfrounds', label: 'Runs (0 = until you stop)', v: Number(st.get('sfRounds', 0)), step: 1 })
        rows.push(kickRow(ctx))
        rows.push({ t: 'btn', id: 'sfgo', label: 'Start automation', style: 'primary' })
        if (tt.status) rows.push({ t: 'p', c: 'dim', text: tt.status })
      }
      return { title: 'Automation', rows, foot: 'Green = on. Claims those and opens the chests on the rewards screen.', h: 430 }
    }
    if (adv.id === 'new-years-fortune') {
      if (tt.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: tt.status })
        rows.push({ t: 'btn', id: 'ttstop', label: 'Stop', style: 'danger' })
      } else {
        const st = ctx.surfaces.store('adventure-runner')
        const mode = st.get('nyMode', 'here')
        rows.push({ t: 'chips', id: 'nymode', label: 'Automation', v: mode, opts: [{ v: 'here', l: 'Loop Here' }, { v: 'rejoin', l: 'Rejoining Loop' }] })
        if (mode === 'rejoin') {
          rows.push({ t: 'p', c: 'dim', text: 'Takes the chest that’s out, leaves, joins again and takes the next game’s chest, over and over.' })
          rows.push({ t: 'num', id: 'nyrounds', label: 'Runs (0 = until you stop)', v: Number(st.get('nyRounds', 0)), step: 1 })
        } else {
          rows.push({ t: 'p', c: 'dim', text: 'Claims every chest that drops on the ground, until you stop. You stay where you start.' })
          rows.push({ t: 'tog', id: 'nyauto', label: 'Join again if kicked', sub: 'When the game takes you out for being away, join again and carry on', v: !!st.get('nyAuto', true) })
        }
        rows.push({ t: 'btn', id: 'nygo', label: 'Start automation', style: 'primary' })
        if (tt.status) rows.push({ t: 'p', c: 'dim', text: tt.status })
      }
      return { title: 'Automation', rows, foot: 'A new chest drops about every minute, after a countdown.', h: 320 }
    }
    if (adv.id === 'special-delivery') {
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('sdOff', [])
      if (tt.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: tt.status })
        rows.push({ t: 'btn', id: 'ttstop', label: 'Stop', style: 'danger' })
      } else {
        rows.push({ t: 'tog', id: 'sdmail', label: 'Mailboxes first', sub: 'Needed once per game for the real prizes (off if you already did them here)', v: !!st.get('sdMail', true) })
        for (const it of SD_ITEMS) rows.push({ t: 'tog', id: `sd:${it.name}`, label: it.label, v: !off.includes(it.name) })
        const loop = !!st.get('sdLoop', false)
        rows.push({ t: 'tog', id: 'sdloop', label: 'Keep going', sub: 'Claim the goals again and again in this game', v: loop })
        if (loop) rows.push({ t: 'num', id: 'sdrounds', label: 'Rounds (0 = until you stop)', v: Number(st.get('sdRounds', 0)), step: 1 })
        rows.push(kickRow(ctx))
        rows.push({ t: 'btn', id: 'sdgo', label: 'Start automation', style: 'primary' })
        if (tt.status) rows.push({ t: 'p', c: 'dim', text: tt.status })
      }
      return { title: 'Automation', rows, foot: 'Does the mailboxes, then claims the ticked goals and opens the chests on the rewards screen. You stay where you start.', h: 350 }
    }
    if (adv.id === 'jamaaliday-rescue') {
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('jresOff', [])
      if (tt.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: tt.status })
        rows.push({ t: 'btn', id: 'ttstop', label: 'Stop', style: 'danger' })
      } else {
        for (const it of JRES_ITEMS) rows.push({ t: 'tog', id: `jres:${it.name}`, label: it.label, sub: it.name === 'endprize' ? 'Once per game: Keep going leaves and joins again for it' : null, v: !off.includes(it.name) })
        const loop = !!st.get('jresLoop', false)
        rows.push({ t: 'tog', id: 'jresloop', label: 'Keep going', sub: off.includes('endprize') ? 'Claim the goals again and again in this game' : 'Leave, join again and claim everything again', v: loop })
        if (loop) rows.push({ t: 'num', id: 'jresrounds', label: 'Runs (0 = until you stop)', v: Number(st.get('jresRounds', 0)), step: 1 })
        rows.push(kickRow(ctx))
        rows.push({ t: 'btn', id: 'jresgo', label: 'Start automation', style: 'primary' })
        if (tt.status) rows.push({ t: 'p', c: 'dim', text: tt.status })
      }
      return { title: 'Automation', rows, foot: 'Claims the ticked goals and the chest, and opens them on the rewards screen. You stay where you start.', h: 340 }
    }
    if (adv.id === 'twists-and-turns') {
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('ttChestsOff', [])
      if (tt.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: tt.status })
        rows.push({ t: 'btn', id: 'ttstop', label: 'Stop', style: 'danger' })
      } else {
        for (const n of [1, 2, 3]) rows.push({ t: 'tog', id: `ttchest:${n}`, label: `Chest ${n}`, v: !off.includes(n) })
        const loop = !!st.get('ttLoop', false)
        rows.push({ t: 'tog', id: 'ttloop', label: 'Keep going', sub: 'Leave, join again and claim the chests again', v: loop })
        if (loop) rows.push({ t: 'num', id: 'ttrounds', label: 'Runs (0 = until you stop)', v: Number(st.get('ttRounds', 0)), step: 1 })
        rows.push(kickRow(ctx))
        rows.push({ t: 'btn', id: 'ttgo', label: 'Start automation', style: 'primary' })
        if (tt.status) rows.push({ t: 'p', c: 'dim', text: tt.status })
      }
      return { title: 'Automation', rows, foot: 'Claims the ticked treasure chests and opens them on the rewards screen. You stay where you start.', h: 320 }
    }
    if (adv.joinOnly || !adv.steps || !adv.steps.length) {
      rows.push({ t: 'p', c: 'warn', text: `There’s no automation for ${adv.name} yet, so JRR can’t play it for you. You can keep playing it yourself.` })
      return { title: 'Automation', rows, h: 260 }
    }
    if (adv.id === 'phantoms-bunnies') {
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('phPrizesOff', [])
      if (ph.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: ph.status })
        rows.push({ t: 'btn', id: 'phstop', label: 'Stop', style: 'danger' })
      } else {
        rows.push({ t: 'p', c: 'dim', text: `Bunny keys this run: ${ph.keys.size ? [...ph.keys].sort().join(', ') : 'not seen yet (join the adventure with JRR open)'}` })
        for (let i = 1; i <= 5; i++) rows.push({ t: 'tog', id: `phprize:${i - 1}`, label: `Prize ${i}`, v: !off.includes(i - 1) })
        const loop = !!st.get('phLoop', false)
        if (loop) rows.push({ t: 'chips', id: 'mode', label: 'Rejoin as', v: jr.state().mode, opts: adv.modes.map(m => ({ v: m, l: m[0].toUpperCase() + m.slice(1) })) })
        rows.push({ t: 'tog', id: 'phloop', label: 'Keep going', sub: 'Leave, join again and play again after each run', v: loop })
        if (loop) rows.push({ t: 'num', id: 'phrounds', label: 'Runs (0 = until you stop)', v: Number(st.get('phRounds', 0)), step: 1 })
        rows.push({ t: 'btn', id: 'phgo', label: 'Start automation', style: 'primary' })
        if (ph.status) rows.push({ t: 'p', c: 'dim', text: ph.status })
      }
      return { title: 'Automation', rows, foot: 'Liza, pipes, flowers, both rooms, the four bunnies, then the prizes. You stay where you start.', h: 330 }
    }
    if (adv.id === 'bittersweets') {
      const on = jr.choices(adv)
      if (!seq.running) for (const o of adv.choices.options) rows.push({ t: 'tog', id: `choice:${o.id}`, label: `${adv.choices.label}: ${o.label}`, v: on.includes(o.id) })
      const both = !!ctx.surfaces.store('adventure-runner').get('bsTakeBoth', true)
      if (!seq.running) rows.push({ t: 'tog', id: 'bsboth', label: 'Take both chests for me', sub: 'Off: you pick them in the game', v: both })
      const bsStore = ctx.surfaces.store('adventure-runner')
      const loop = !!bsStore.get('bsLoop', false)
      if (!seq.running) rows.push({ t: 'tog', id: 'bsloop', label: 'Keep going', sub: 'Claim the goals again and again in this game', v: loop })
      if (!seq.running) rows.push(kickRow(ctx))
      if (!seq.running && loop) rows.push({ t: 'num', id: 'bsrounds', label: 'Rounds (0 = until you stop)', v: Number(bsStore.get('bsRounds', 0)), step: 1 })
      if (seq.running) {
        rows.push({ t: 'p', c: 'ok', b: true, text: seq.status })
        rows.push({ t: 'btn', id: 'bsstop', label: 'Stop', style: 'danger' })
      } else {
        rows.push({ t: 'btn', id: 'bsgo', label: 'Start automation', style: 'primary' })
        if (seq.status) rows.push({ t: 'p', c: 'dim', text: seq.status })
      }
      return { title: 'Automation', rows, foot: 'Claims the ticked goals one at a time, with pauses.', h: 320 }
    }
    if (adv.modes.length > 1) rows.push({ t: 'chips', id: 'mode', label: 'Mode', v: s.mode, opts: adv.modes.map(m => ({ v: m, l: m[0].toUpperCase() + m.slice(1) })) })
    if (adv.choices) {
      const on = jr.choices(adv)
      for (const o of adv.choices.options) rows.push({ t: 'tog', id: `choice:${o.id}`, label: `${adv.choices.label}: ${o.label}`, v: on.includes(o.id) })
    }
    const loop = !!page.element('loopToggle').checked
    rows.push({ t: 'row', items: [
      { id: 'loop', label: `Keep going: ${loop ? 'On' : 'Off'}`, style: loop ? 'on' : 'normal' },
      { id: 'prize', label: `Prize: ${prize === 'manual' ? 'I’ll pick' : `Slot ${prize}`}` }
    ] })
    if (s.running) {
      // Same layout as JR's original window while running: no big change in size.
      const steps = page.element('stepList').children
      const at = steps.findIndex(r => /\bactive\b/.test(String(r.className || '')))
      const done = steps.filter(r => /\bdone\b/.test(String(r.className || ''))).length
      rows.push({ t: 'p', c: 'ok', b: true, text: page.element('status').textContent || 'Running...' })
      rows.push({ t: 'p', c: 'dim', text: `Step ${at >= 0 ? at + 1 : Math.min(done + 1, steps.length)} of ${steps.length}${page.element('runCounter').textContent ? ' - ' + page.element('runCounter').textContent : ''}` })
      rows.push({ t: 'btn', id: 'stop', label: 'Stop', style: 'danger' })
    } else {
      rows.push({ t: 'btn', id: 'go', label: 'Start automation', style: 'primary' })
      if (page.element('status').textContent) rows.push({ t: 'p', c: 'dim', text: page.element('status').textContent })
    }
    return { title: 'Automation', rows, foot: 'Start automation once you’re inside the adventure. Keep going rejoins and plays it again after each run.', h: 320 }
  },
  act (state, c, v, inputs, ctx) {
    const jr = adventures._load(ctx)
    const page = adventures.page
    if (c === 'pick') { jr.select(Number(v)); return }
    if (c === 'mode') { jr.setMode(v); return }
    if (c === 'loop') { page.element('loopToggle').checked = !page.element('loopToggle').checked; return }
    if (c === 'prize') {
      const order = ['manual', '1', '2', '3', '4', '5']
      const next = order[(order.indexOf(page.element('prizeChoice').value || 'manual') + 1) % order.length]
      page.element('prizeChoice').value = next
      try { ctx.surfaces.store('adventure-runner').set('prize', next) } catch (_) {}
      return
    }
    if (c.startsWith('choice:')) {
      const adv = jr.list.find(a => a.id === jr.state().id)
      const id = c.slice(7)
      const now = jr.choices(adv).filter(x => x !== id)
      if (v === '1') now.push(id)
      jr.setChoices(adv, adv.choices.options.map(o => o.id).filter(x => now.includes(x)))
      return
    }
    if (c.startsWith('phprize:')) {
      const st = ctx.surfaces.store('adventure-runner'); const i = Number(c.slice(8))
      const off = st.get('phPrizesOff', []).filter(x => x !== i); if (v !== '1') off.push(i)
      st.set('phPrizesOff', off); return
    }
    if (c === 'phstop') { ph.stop = true; return }
    if (c === 'phloop') { ctx.surfaces.store('adventure-runner').set('phLoop', v === '1'); return }
    if (c === 'phrounds') { ctx.surfaces.store('adventure-runner').set('phRounds', Math.max(0, Math.min(999, parseInt(v, 10) || 0))); return }
    if (c === 'phgo') {
      if (ph.running) return
      const off = ctx.surfaces.store('adventure-runner').get('phPrizesOff', [])
      const st = ctx.surfaces.store('adventure-runner')
      const ph0 = jr.list.findIndex(a => a.id === 'phantoms-bunnies')
      if (ph0 >= 0 && jr.state().id !== 'phantoms-bunnies') jr.select(ph0)
      phRun(ctx, [0, 1, 2, 3, 4].filter(i => !off.includes(i)), st.get('phLoop', false) ? Math.max(0, Number(st.get('phRounds', 0)) || 0) : 1, jr)
      return
    }
    if (c.startsWith('td:')) {
      const st = ctx.surfaces.store('adventure-runner'); const k = c.slice(3)
      const off = st.get('tdOff', []).filter(x => x !== k); if (v !== '1') off.push(k)
      st.set('tdOff', off); return
    }
    if (c === 'tdloop') { ctx.surfaces.store('adventure-runner').set('tdLoop', v === '1'); return }
    if (c === 'tdrounds') { ctx.surfaces.store('adventure-runner').set('tdRounds', Math.max(0, Math.min(999, parseInt(v, 10) || 0))); return }
    if (c === 'tdstop') { td.stop = true; return }
    if (c === 'tdgo') {
      if (td.running) return
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('tdOff', [])
      const on = (k) => !off.includes(k)
      const i = jr.list.findIndex(a => a.id === 'tfd')
      if (i >= 0 && jr.state().id !== 'tfd') jr.select(i)
      tdRun(ctx, jr, { chests: on('chests'), green: on('green'), yellow: on('yellow'), blue: on('blue'), white: on('white'), fifth: on('fifth'), rounds: st.get('tdLoop', false) ? Math.max(0, Number(st.get('tdRounds', 0)) || 0) : 1, autoRejoin: !!st.get('kickRejoin', true) })
      return
    }
    if (c === 'tkchests') { ctx.surfaces.store('adventure-runner').set('tkChests', v === '1'); return }
    if (c === 'tktree') { ctx.surfaces.store('adventure-runner').set('tkTree', v === '1'); return }
    if (c === 'tkpearls') { ctx.surfaces.store('adventure-runner').set('tkPearls', v === '1'); return }
    if (c === 'tkloop') { ctx.surfaces.store('adventure-runner').set('tkLoop', v === '1'); return }
    if (c === 'tkrounds') { ctx.surfaces.store('adventure-runner').set('tkRounds', Math.max(0, Math.min(999, parseInt(v, 10) || 0))); return }
    if (c === 'tkstop') { tk.stop = true; return }
    if (c === 'tkgo') {
      if (tk.running) return
      const st = ctx.surfaces.store('adventure-runner')
      if (!st.get('tkChests', true) && !st.get('tkTree', true) && !st.get('tkPearls', true)) { tk.status = 'Turn on the chests or the pearls.'; return }
      const i = jr.list.findIndex(a => a.id === 'tiki-trouble')
      if (i >= 0 && jr.state().id !== 'tiki-trouble') jr.select(i)
      tkRun(ctx, jr, { chests: !!st.get('tkChests', true), tree: !!st.get('tkTree', true), pearls: !!st.get('tkPearls', true), rounds: st.get('tkLoop', false) ? Math.max(0, Number(st.get('tkRounds', 0)) || 0) : 1, autoRejoin: !!st.get('kickRejoin', true) })
      return
    }
    if (c === 'kickrejoin') { ctx.surfaces.store('adventure-runner').set('kickRejoin', v === '1'); return }
    if (c.startsWith('gw:')) {
      const st = ctx.surfaces.store('adventure-runner'); const k = c.slice(3)
      const off = st.get('gwOff', []).filter(x => x !== k); if (v !== '1') off.push(k)
      st.set('gwOff', off); return
    }
    if (c === 'gwstop') { gw.stop = true; return }
    if (c === 'gwgo') {
      if (gw.running || tt.running) return
      const off = ctx.surfaces.store('adventure-runner').get('gwOff', [])
      const items = GW_ITEMS.filter(x => !off.includes(x.key))
      if (!items.length) { gw.status = 'Turn on at least one material.'; return }
      gwRun(ctx, items, jr, !!ctx.surfaces.store('adventure-runner').get('kickRejoin', true))
      return
    }
    if (c === 'bcgems') { ctx.surfaces.store('adventure-runner').set('bcGems', v === '1'); return }
    if (c === 'bcauto') { ctx.surfaces.store('adventure-runner').set('bcAuto', v === '1'); return }
    if (c === 'bcgo') {
      if (tt.running) return
      bcHook(ctx)
      const st = ctx.surfaces.store('adventure-runner')
      const i = jr.list.findIndex(a => a.id === 'battle-for-the-beacon')
      if (i >= 0 && jr.state().id !== 'battle-for-the-beacon') jr.select(i)
      bc.broken = 0
      ttRun(ctx, [], 0, jr, { where: 'Battle for the Beacon', rejoin: false, next: bcNextFor(!!st.get('bcGems', true)), autoRejoin: !!st.get('bcAuto', true) })
      return
    }
    if (c.startsWith('sf:')) {
      const st = ctx.surfaces.store('adventure-runner'); const k = c.slice(3)
      const off = st.get('sfOff', SF_OFF_DEFAULT).filter(x => x !== k); if (v !== '1') off.push(k)
      st.set('sfOff', off); return
    }
    if (c === 'sfloop') { ctx.surfaces.store('adventure-runner').set('sfLoop', v === '1'); return }
    if (c === 'sfrounds') { ctx.surfaces.store('adventure-runner').set('sfRounds', Math.max(0, Math.min(999, parseInt(v, 10) || 0))); return }
    if (c === 'sfgo') {
      if (tt.running) return
      sfHook(ctx)
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('sfOff', SF_OFF_DEFAULT)
      const items = SF_ITEMS.filter(x => !off.includes(x.key))
      if (!items.length) { tt.status = 'Tick at least one thing to claim.'; return }
      const i = jr.list.findIndex(a => a.id === 'spring-festival')
      if (i >= 0 && jr.state().id !== 'spring-festival') jr.select(i)
      ttRun(ctx, items, st.get('sfLoop', false) ? Math.max(0, Number(st.get('sfRounds', 0)) || 0) : 1, jr, { where: 'Spring Festival', rejoin: items.some(x => x.once), autoRejoin: !!st.get('kickRejoin', true) })
      return
    }
    if (c === 'nygo') {
      if (tt.running) return
      nyHook(ctx)
      const i = jr.list.findIndex(a => a.id === 'new-years-fortune')
      if (i >= 0 && jr.state().id !== 'new-years-fortune') jr.select(i)
      const st = ctx.surfaces.store('adventure-runner')
      if (st.get('nyMode', 'here') === 'rejoin') ttRun(ctx, [], Math.max(0, Number(st.get('nyRounds', 0)) || 0), jr, { where: 'New Year’s Fortune', rejoin: false, next: nyNextRejoin, rejoinNext: true })
      else ttRun(ctx, [], 0, jr, { where: 'New Year’s Fortune', rejoin: false, next: nyNext, autoRejoin: !!st.get('nyAuto', true) })
      return
    }
    if (c === 'nyauto') { ctx.surfaces.store('adventure-runner').set('nyAuto', v === '1'); return }
    if (c === 'nymode') { ctx.surfaces.store('adventure-runner').set('nyMode', v === 'rejoin' ? 'rejoin' : 'here'); return }
    if (c === 'nyrounds') { ctx.surfaces.store('adventure-runner').set('nyRounds', Math.max(0, Math.min(999, parseInt(v, 10) || 0))); return }
    if (c.startsWith('sd:')) {
      const st = ctx.surfaces.store('adventure-runner'); const n = c.slice(3)
      const off = st.get('sdOff', []).filter(x => x !== n); if (v !== '1') off.push(n)
      st.set('sdOff', off); return
    }
    if (c === 'sdmail') { ctx.surfaces.store('adventure-runner').set('sdMail', v === '1'); return }
    if (c === 'sdloop') { ctx.surfaces.store('adventure-runner').set('sdLoop', v === '1'); return }
    if (c === 'sdrounds') { ctx.surfaces.store('adventure-runner').set('sdRounds', Math.max(0, Math.min(999, parseInt(v, 10) || 0))); return }
    if (c === 'sdgo') {
      if (tt.running) return
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('sdOff', [])
      const items = SD_ITEMS.filter(x => !off.includes(x.name))
      if (!items.length) { tt.status = 'Tick at least one goal.'; return }
      const i = jr.list.findIndex(a => a.id === 'special-delivery')
      if (i >= 0 && jr.state().id !== 'special-delivery') jr.select(i)
      ttRun(ctx, items, st.get('sdLoop', false) ? Math.max(0, Number(st.get('sdRounds', 0)) || 0) : 1, jr, { where: 'Special Delivery', rejoin: false, before: st.get('sdMail', true) ? SD_MAILBOXES : null, autoRejoin: !!st.get('kickRejoin', true) })
      return
    }
    if (c.startsWith('jres:')) {
      const st = ctx.surfaces.store('adventure-runner'); const n = c.slice(5)
      const off = st.get('jresOff', []).filter(x => x !== n); if (v !== '1') off.push(n)
      st.set('jresOff', off); return
    }
    if (c === 'jresloop') { ctx.surfaces.store('adventure-runner').set('jresLoop', v === '1'); return }
    if (c === 'jresrounds') { ctx.surfaces.store('adventure-runner').set('jresRounds', Math.max(0, Math.min(999, parseInt(v, 10) || 0))); return }
    if (c === 'jresgo') {
      if (tt.running) return
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('jresOff', [])
      const items = JRES_ITEMS.filter(x => !off.includes(x.name))
      if (!items.length) { tt.status = 'Tick at least one goal or the chest.'; return }
      const i = jr.list.findIndex(a => a.id === 'jamaaliday-rescue')
      if (i >= 0 && jr.state().id !== 'jamaaliday-rescue') jr.select(i)
      ttRun(ctx, items, st.get('jresLoop', false) ? Math.max(0, Number(st.get('jresRounds', 0)) || 0) : 1, jr, { where: 'Jamaaliday Rescue', rejoin: items.some(x => x.name === 'endprize'), autoRejoin: !!st.get('kickRejoin', true) })
      return
    }
    if (c.startsWith('ttchest:')) {
      const st = ctx.surfaces.store('adventure-runner'); const n = Number(c.slice(8))
      const off = st.get('ttChestsOff', []).filter(x => x !== n); if (v !== '1') off.push(n)
      st.set('ttChestsOff', off); return
    }
    if (c === 'ttstop') { tt.stop = true; return }
    if (c === 'ttloop') { ctx.surfaces.store('adventure-runner').set('ttLoop', v === '1'); return }
    if (c === 'ttrounds') { ctx.surfaces.store('adventure-runner').set('ttRounds', Math.max(0, Math.min(999, parseInt(v, 10) || 0))); return }
    if (c === 'ttgo') {
      if (tt.running) return
      const st = ctx.surfaces.store('adventure-runner')
      const off = st.get('ttChestsOff', [])
      const chests = TT_CHESTS.filter(x => !off.includes(Number(x[0]))).map(x => ({ name: x, label: `Chest ${x[0]}` }))
      if (!chests.length) { tt.status = 'Tick at least one chest.'; return }
      const i = jr.list.findIndex(a => a.id === 'twists-and-turns')
      if (i >= 0 && jr.state().id !== 'twists-and-turns') jr.select(i)
      ttRun(ctx, chests, st.get('ttLoop', false) ? Math.max(0, Number(st.get('ttRounds', 0)) || 0) : 1, jr, { autoRejoin: !!st.get('kickRejoin', true) })
      return
    }
    if (c === 'bsboth') { ctx.surfaces.store('adventure-runner').set('bsTakeBoth', v === '1'); return }
    if (c === 'bsstop') { seq.stop = true; return }
    if (c === 'bsloop') { ctx.surfaces.store('adventure-runner').set('bsLoop', v === '1'); return }
    if (c === 'bsrounds') { ctx.surfaces.store('adventure-runner').set('bsRounds', Math.max(0, Math.min(999, parseInt(v, 10) || 0))); return }
    if (c === 'bsgo') {
      if (seq.running) return
      const adv = jr.list.find(a => a.id === 'bittersweets')
      const goals = BS_GOALS.filter(g => jr.choices(adv).includes(g))
      if (!goals.length) { seq.status = 'Tick at least one goal.'; return }
      const st = ctx.surfaces.store('adventure-runner')
      seqRun(ctx, goals, !!st.get('bsTakeBoth', true), st.get('bsLoop', false) ? Math.max(0, Number(st.get('bsRounds', 0)) || 0) : 1, jr, !!st.get('kickRejoin', true))
      return
    }
    if (c === 'stop') { jr.stop(); return }
    if (c === 'go') {
      // Close JR's windows first: the game's own reward and prize screens
      // open while it plays, and a JR window left open on top of them can
      // crash the game. The gear opens this window again any time.
      try { ctx.surfaces.close('automation') } catch (_) {}
      try { ctx.surfaces.close('adventures') } catch (_) {}
      setTimeout(() => {
        Promise.resolve(jr.start(true)).catch(e => ctx.surfaces.toast(e.message, 'bad'))
      }, 400)
    }
  }
}

/* ------------------------------------------------------------- gem farm */

const gemFarm = {
  id: 'gemfarm',
  plugin: 'gem-farm',
  buttons: [{ at: 'adventure', label: 'Gem Farm' }],
  init (ctx) {
    const { GemFarm, MIN_DELAY } = require(path.join(ctx.root, 'plugins', 'gem-farm', 'farm.js'))
    this.MIN = MIN_DELAY
    this.farm = new GemFarm({ dispatch: ctx.dispatch, onChange: () => ctx.surfaces.refresh('gemfarm') })
  },
  view (state, ctx) {
    const f = this.farm
    const rows = []
    rows.push({ t: 'p', c: 'dim', text: 'Collects the gem prize from adventure #49 over and over.' })
    rows.push({ t: 'num', id: 'delay', label: 'Milliseconds between steps', v: f.delay, step: 50 })
    rows.push({ t: 'tog', id: 'recycle', label: 'Recycle the prize items for more gems', v: f.recycle })
    if (f.running) {
      rows.push({ t: 'kv', k: 'Rounds', v: String(f.stats.cycles), c: 'ok' })
      rows.push({ t: 'kv', k: 'Items recycled', v: String(f.stats.recycled) })
      rows.push({ t: 'btn', id: 'stop', label: 'Stop', style: 'danger' })
    } else {
      rows.push({ t: 'btn', id: 'start', label: 'Start farming', style: 'primary' })
      if (f.lastError) rows.push({ t: 'p', c: 'bad', text: f.lastError })
    }
    return { title: 'Gem Farm', rows }
  },
  act (state, c, v, inputs, ctx) {
    const f = this.farm
    if (c === 'delay') { f.delay = Math.max(this.MIN, Math.min(5000, Number(v) || 500)); return }
    if (c === 'recycle') { f.recycle = v === '1'; return }
    if (c === 'stop') { f.stop(); return }
    if (c === 'start') f.start().catch(e => ctx.surfaces.toast(e.message, 'bad'))
  }
}

/* ---------------------------------------------------------- achievements */

const achievements = {
  id: 'achievements',
  plugin: 'achievements',
  buttons: [{ at: 'achievements', label: 'Send' }],
  init (ctx) {
    const html = fs.readFileSync(path.join(ctx.root, 'plugins', 'achievements', 'index.html'), 'utf8')
    const m = /const achievements = \[([\d,\s]+)\]/.exec(html)
    this.ids = m ? m[1].split(',').map(x => Number(x.trim())).filter(Number.isFinite) : []
    this.info = new Map()
    this.batch = null
  },
  async opened (state, ctx) {
    if (this.info.size) return
    const items = ctx.items
    if (!items.deployVersion) await items.load()
    const [pack, strings] = await Promise.all([items.fetchPack(items.deployVersion, '1042'), items.fetchPack(items.deployVersion, '10230')])
    const str = (k) => (strings && typeof strings[k] === 'string' && strings[k].trim()) || null
    const pick = (e, re) => { for (const [f, val] of Object.entries(e)) if (re.test(f) && /str(id|ref)?$/i.test(f)) { const t = str(val); if (t) return t } return null }
    for (const [key, e] of Object.entries(pack || {})) {
      if (!e || typeof e !== 'object') continue
      const id = Number(e.id !== undefined ? e.id : key)
      const extra = e.extraText ? String(e.extraText) : ''
      const fill = (t) => (t && extra ? t.replace(/\{0\}|%s/g, extra) : t)
      this.info.set(id, { name: fill(pick(e, /title/i)) || String(e.name || '').replace(/^\d+_/, '').replace(/_/g, ' '), desc: fill(pick(e, /desc/i)) })
    }
  },
  _send (ctx, id) {
    const room = ctx.dispatch.getState('room')
    if (!room) throw new Error('Join a room first.')
    return ctx.dispatch.sendRemoteMessage(`%xt%o%zs%${room}%${id}%9999999%1%`)
  },
  view (state, ctx) {
    const rows = []
    if (this.batch) {
      rows.push({ t: 'p', c: 'warn', text: `Sending ${this.batch.done} of ${this.ids.length}…` })
      rows.push({ t: 'btn', id: 'stopall', label: 'Stop', style: 'danger' })
    } else {
      rows.push({ t: 'btn', id: 'all', label: state.confirm ? `Press again to send all ${this.ids.length}` : `Send all ${this.ids.length}`, style: state.confirm ? 'danger' : 'primary' })
    }
    rows.push({ t: 'in', id: 'q', label: 'Search', v: state.q || '', go: 'Find' })
    const q = String(state.q || '').toLowerCase()
    for (const id of this.ids) {
      const i = this.info.get(id) || {}
      const name = i.name || `Achievement #${id}`
      if (q && !`${name} ${i.desc || ''}`.toLowerCase().includes(q)) continue
      rows.push({ t: 'li', text: name, sub: i.desc || null, btns: [{ id: 'one', label: 'Send', v: String(id) }] })
    }
    return { title: 'Achievements', rows, h: 330 }
  },
  async act (state, c, v, inputs, ctx) {
    if (c !== 'all') state.confirm = false
    if (c === 'q') { state.q = v.trim(); return }
    if (c === 'one') { await this._send(ctx, Number(v)); ctx.surfaces.toast(`Sent ${(this.info.get(Number(v)) || {}).name || `#${v}`}.`, 'ok'); return }
    if (c === 'stopall') { if (this.batch) this.batch.stopped = true; return }
    if (c === 'all') {
      if (!state.confirm) { state.confirm = true; return }
      state.confirm = false
      const batch = this.batch = { done: 0, stopped: false }
      ;(async () => {
        for (const id of this.ids) {
          if (batch.stopped) break
          await this._send(ctx, id)
          batch.done++
          if (batch.done % 5 === 0) ctx.surfaces.refresh('achievements')
          await new Promise(resolve => setTimeout(resolve, 110))
        }
      })().catch(e => ctx.surfaces.toast(e.message, 'bad')).then(() => {
        this.batch = null
        ctx.surfaces.toast(`Sent ${batch.done} achievements.`, 'ok')
        ctx.surfaces.refresh('achievements')
      })
    }
  }
}

/* ------------------------------------------------------------------ pairs */

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function parseCards (parts) {
  const r = parts.indexOf('round')
  if (r !== -1 && Number(parts[r + 3]) === 16) {
    const ids = parts.slice(r + 4, r + 20)
    if (ids.length === 16 && ids.every(x => /^\d+$/.test(x))) return ids.map(Number)
  }
  for (let i = 0; i + 16 < parts.length; i++) {
    if (parts[i] !== '16') continue
    const ids = parts.slice(i + 1, i + 17)
    if (ids.every(x => /^\d+$/.test(x) && +x >= 1 && +x <= 16) && new Set(ids).size === 16) return ids.map(Number)
  }
  return null
}

const pairs = {
  id: 'pairs',
  plugin: 'pairs',
  buttons: [{ at: 'pairs', label: 'Show Pairs' }],
  init (ctx) {
    this.cards = null
    ctx.dispatch.onMessage({
      type: 'aj',
      message: 'mm',
      callback: ({ message }) => {
        const parts = (Array.isArray(message.value) ? message.value : String(message.raw || '').split('%')).map(String).filter(Boolean)
        const ids = parseCards(parts)
        if (ids) { this.cards = ids; ctx.surfaces.refresh('pairs') }
      }
    })
    ctx.dispatch.onMessage({ type: 'aj', message: 'rl', callback: () => { this.cards = null; ctx.surfaces.refresh('pairs') } })
  },
  view () {
    const rows = []
    if (!this.cards) {
      rows.push({ t: 'p', c: 'dim', text: 'Waiting for a round to start…' })
    } else {
      rows.push({ t: 'p', c: 'dim', text: 'Same letter = a pair. Laid out like the cards on the table.' })
      for (let r = 0; r < 4; r++) {
        rows.push({ t: 'row', items: this.cards.slice(r * 4, r * 4 + 4).map(cid => ({ id: 'card', label: LETTERS[(((cid - 1) % 8) + 8) % 8], style: 'normal' })) })
      }
    }
    return { title: 'Pairs', rows, w: 240 }
  }
}

module.exports = [adventures, automation, gemFarm, achievements, pairs]
