/**
 * Packet Spammer, by BradysLabs: the sending logic, separate from the page so
 * it can be tested.
 *
 * A step is { to: 'server' | 'game', text, delay } where delay is seconds to
 * wait after sending. {room} in a packet becomes your current room.
 * toText / fromText: the list as shareable text (import / export).
 */
(function (root, factory) {
  const api = factory()
  // JR's plugin windows have Node turned on, so `module` exists there too.
  // Always set the window global as well, or the page can't find it.
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.SpammerRunner = api
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  const MIN_DELAY = 0.05

  /** Splits a text box into packets: one per non-empty line. */
  function splitPackets (text) {
    return String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  }

  function fill (text, dispatch) {
    if (!text.includes('{room}')) return text
    const room = dispatch.getState('room')
    if (!room) throw new Error('Join a room first: this packet uses {room}.')
    return text.split('{room}').join(room)
  }

  async function sendOne (dispatch, to, text) {
    const packet = fill(text, dispatch)
    if (to === 'game') dispatch.sendConnectionMessage(packet)
    else await dispatch.sendRemoteMessage(packet)
    return packet
  }

  /**
   * Runs a list of steps once or on repeat.
   * @param {object} dispatch JR's dispatch
   * @param {{to: string, text: string, delay: number}[]} steps
   * @param {{loop?: boolean, onStep?: (index: number) => void, onError?: (e: Error) => void, onDone?: () => void, wait?: (ms: number) => Promise<void>}} [options]
   * @returns {{stop: () => void, done: Promise<void>}}
   */
  function run (dispatch, steps, options = {}) {
    const { loop = false, onStep = () => {}, onError = () => {}, onDone = () => {} } = options
    let stopped = false
    let wake = null
    const wait = options.wait || ((ms) => new Promise(resolve => {
      const t = setTimeout(resolve, ms)
      wake = () => { clearTimeout(t); resolve() }
    }))

    const done = (async () => {
      if (!steps.length) return
      do {
        for (let i = 0; i < steps.length && !stopped; i++) {
          const step = steps[i]
          onStep(i)
          try {
            await sendOne(dispatch, step.to, step.text)
          } catch (error) {
            onError(error)
            stopped = true
            break
          }
          if (stopped) break
          await wait(Math.max(MIN_DELAY, Number(step.delay) || 0) * 1000)
        }
      } while (loop && !stopped)
    })().finally(() => onDone())

    return {
      stop () {
        stopped = true
        if (wake) wake()
      },
      done
    }
  }

  /**
   * The list as text, one step per line: "<server|game> <seconds> <packet>".
   * Easy to read, share and edit by hand.
   */
  function toText (steps) {
    return (steps || []).map(s => `${s.to === 'game' ? 'game' : 'server'} ${Number(s.delay) || 0} ${s.text}`).join('\n')
  }

  /**
   * Reads a list back: that text format, a JSON list of steps, or plain packets
   * (one per line; those go to the server with a 1 second wait).
   * @returns {{to: string, text: string, delay: number}[]}
   */
  function fromText (text) {
    const raw = String(text || '').trim()
    if (!raw) return []
    if (raw[0] === '[' || raw[0] === '{') {
      try {
        const data = JSON.parse(raw)
        const list = Array.isArray(data) ? data : (Array.isArray(data.steps) ? data.steps : [])
        return list.filter(s => s && String(s.text || '').trim()).map(s => ({
          to: s.to === 'game' ? 'game' : 'server',
          text: String(s.text).trim(),
          delay: Math.max(MIN_DELAY, Number(s.delay) || 1)
        }))
      } catch (_) { /* not JSON: read it as lines */ }
    }
    return splitPackets(raw).map(line => {
      const m = /^(server|game|self|my\s+game|client)\s+(\d+(?:\.\d+)?)s?\s+(\S.*)$/i.exec(line)
      if (m) return { to: /^server$/i.test(m[1]) ? 'server' : 'game', text: m[3].trim(), delay: Math.max(MIN_DELAY, Number(m[2])) }
      return { to: 'server', text: line, delay: 1 }
    })
  }

  return { splitPackets, fill, sendOne, run, toText, fromText, MIN_DELAY }
})
