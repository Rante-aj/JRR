const $ = id => document.getElementById(id)
const KEY = 'masterpieceRetie'
let file = null
const store = {
  get () { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch (_) { return {} } },
  set (p) { try { localStorage.setItem(KEY, JSON.stringify({ ...store.get(), ...p })) } catch (_) {} }
}
function findUuid (v, depth = 0) {
  if (!v || depth > 5) return null
  if (typeof v === 'string') return UUID_RE.test(v) ? v : null
  if (typeof v !== 'object') return null
  for (const x of Object.values(v)) { const f = findUuid(x, depth + 1); if (f) return f }
  return null
}
async function detect () {
  try { return findUuid(window.jam && window.jam.dispatch && await window.jam.dispatch.getState('player')) } catch (_) { return null }
}
function say (text, kind = '') { $('msg').className = kind; $('msg').textContent = text }
function check () {
  for (const id of ['o', 'n']) { const v = $(id).value.trim(); $(id).classList.toggle('bad', !!v && !UUID_RE.test(v)) }
  $('go').disabled = !(file && UUID_RE.test($('o').value.trim()) && UUID_RE.test($('n').value.trim()))
}
function setFile (f) { if (!f) return; file = f; $('dt').textContent = f.name; $('drop').classList.add('has'); check() }
async function fill (id, label) {
  const found = await detect()
  if (!found) return say('Could not read the logged-in account. Log in first, or paste the uuid.', 'bad')
  $(id).value = found; store.set({ [id]: found }); check(); say(label + ' uuid filled in from the logged-in account.', 'ok')
}
document.addEventListener('DOMContentLoaded', () => {
  const s = store.get(); if (s.o) $('o').value = s.o; if (s.n) $('n').value = s.n
  $('drop').onclick = () => $('f').click()
  $('f').onchange = e => { setFile(e.target.files[0]); e.target.value = '' }
  $('drop').ondragover = e => { e.preventDefault(); $('drop').classList.add('over') }
  $('drop').ondragleave = () => $('drop').classList.remove('over')
  $('drop').ondrop = e => { e.preventDefault(); $('drop').classList.remove('over'); setFile(e.dataTransfer.files[0]) }
  $('o').oninput = $('n').oninput = () => { store.set({ o: $('o').value.trim(), n: $('n').value.trim() }); check() }
  $('od').onclick = () => fill('o', 'OLD')
  $('nd').onclick = () => fill('n', 'NEW')
  $('swap').onclick = () => { const t = $('o').value; $('o').value = $('n').value; $('n').value = t; store.set({ o: $('o').value, n: $('n').value }); check() }
  $('go').onclick = async () => {
    say('Working…')
    try {
      const r = await retie(new Uint8Array(await file.arrayBuffer()), $('o').value.trim(), $('n').value.trim())
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([r.out], { type: 'application/octet-stream' }))
      a.download = file.name.replace(/(\.[^.]+)$/, '_transferred$1')
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
      say(`Done. Saved ${a.download} (type ${r.type || '?'}, artwork ${r.bytes} bytes, verified).`, 'ok')
    } catch (e) { say(e.message, 'bad') }
  }
  check()
})
