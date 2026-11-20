// Masterpiece Re-tie core. Uses Node crypto/zlib when the plugin has them (same path as the original tool), else browser APIs.
const NODE = typeof require === 'function' ? (() => { try { return { crypto: require('crypto'), zlib: require('zlib') } } catch (_) { return null } })() : null
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const td = new TextDecoder(), te = new TextEncoder()
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length } return o }
function keysFor (u) { const key = new Uint8Array(16), iv = new Uint8Array(16); for (let i = 0, c = 0; i < 16; i++) { key[i] = u.charCodeAt(c++); iv[i] = u.charCodeAt(c++) } return { key, iv } }
const wkey = (uuid, usage) => crypto.subtle.importKey('raw', keysFor(uuid).key, 'AES-CBC', false, usage)
async function decryptRaw (file, uuid) {
  const { key, iv } = keysFor(uuid)
  if (NODE) { const d = NODE.crypto.createDecipheriv('aes-128-cbc', key, iv).setAutoPadding(false); return new Uint8Array(Buffer.concat([d.update(file), d.final()])) }
  // Game files use zero padding, which WebCrypto rejects: append one block that decrypts to valid padding so only that block is stripped.
  const k = await wkey(uuid, ['encrypt', 'decrypt'])
  const extra = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: file.slice(file.length - 16) }, k, new Uint8Array(0)))
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, k, cat(file, extra.slice(0, 16))))
}
async function encryptRaw (plain, uuid) {
  const { key, iv } = keysFor(uuid)
  if (NODE) { const c = NODE.crypto.createCipheriv('aes-128-cbc', key, iv); return new Uint8Array(Buffer.concat([c.update(plain), c.final()])) }
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, await wkey(uuid, ['encrypt']), plain))
}
const stream = async (data, S) => new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new S('deflate'))).arrayBuffer())
const inflate = async d => NODE ? new Uint8Array(NODE.zlib.inflateSync(d)) : stream(d, DecompressionStream)
const deflate = async d => NODE ? new Uint8Array(NODE.zlib.deflateSync(d, { level: 9 })) : stream(d, CompressionStream)
const u29 = n => n < 0x80 ? [n] : n < 0x4000 ? [(n >> 7) | 0x80, n & 0x7f] : n < 0x200000 ? [(n >> 14) | 0x80, ((n >> 7) & 0x7f) | 0x80, n & 0x7f] : [(n >> 22) | 0x80, ((n >> 15) & 0x7f) | 0x80, ((n >> 8) & 0x7f) | 0x80, n & 0xff]
const amfStr = s => { const b = te.encode(s); return cat(Uint8Array.from(u29((b.length << 1) | 1)), b) }
function encodeAmf ({ b, h, p }) {
  return cat(Uint8Array.from([9, 1]), amfStr('b'), Uint8Array.from([0x0C]), Uint8Array.from(u29((b.length << 1) | 1)), b,
    amfStr('h'), Uint8Array.from([6]), amfStr(h), amfStr('p'), Uint8Array.from([6]), amfStr(p), amfStr(''))
}
function decodeAmf (buf) {
  let o = 0; const strings = [], traits = []
  const byte = () => { if (o >= buf.length) throw new Error('File is damaged.'); return buf[o++] }
  const u = () => { let r = 0; for (let i = 0; i < 4; i++) { const b = byte(); if (i < 3) { r = (r << 7) | (b & 0x7f); if (!(b & 0x80)) return r } else r = (r << 8) | b } return r >>> 0 }
  const str = () => { const ref = u(); if (!(ref & 1)) return strings[ref >> 1]; const n = ref >> 1; if (!n) return ''; const s = td.decode(buf.subarray(o, o + n)); o += n; strings.push(s); return s }
  const val = () => {
    const m = byte()
    if (m <= 1) return null
    if (m === 2) return false
    if (m === 3) return true
    if (m === 4) return u()
    if (m === 5) { const d = new DataView(buf.buffer, buf.byteOffset).getFloat64(o); o += 8; return d }
    if (m === 6) return str()
    if (m === 0x0C) { const n = u() >> 1; const b = buf.slice(o, o + n); o += n; return b }
    if (m === 9) { const n = u() >> 1; const out = {}; for (let k = str(); k !== ''; k = str()) out[k] = val(); for (let i = 0; i < n; i++) out[i] = val(); return out }
    if (m === 0x0A) { const ref = u(); let t; if (!(ref & 2)) t = traits[ref >> 2]; else { t = { dyn: !!(ref & 8), sealed: [] }; str(); for (let i = 0; i < ref >> 4; i++) t.sealed.push(str()); traits.push(t) } const out = {}; for (const k of t.sealed) out[k] = val(); if (t.dyn) for (let k = str(); k !== ''; k = str()) out[k] = val(); return out }
    throw new Error('Unknown file format.')
  }
  return val()
}
async function unlock (file, uuid) {
  if (!UUID_RE.test(uuid)) throw new Error('That is not a valid uuid.')
  if (file.length < 32 || file.length % 16) throw new Error('This does not look like a masterpiece file.')
  const raw = await decryptRaw(file, uuid)
  let data
  for (let cut = 0; cut <= 16 && !data; cut++) { try { data = decodeAmf(await inflate(raw.subarray(0, raw.length - cut))) } catch (e) {} }
  if (!data) throw new Error('Could not unlock this file. It was made with a different uuid.')
  if (!data.b) throw new Error('No artwork found inside this file.')
  return data
}
async function retie (file, oldU, newU) {
  if (!UUID_RE.test(newU)) throw new Error('The NEW uuid is not valid.')
  const d = await unlock(file, oldU)
  const out = await encryptRaw(await deflate(encodeAmf({ b: d.b, h: d.h || 'aja2id', p: newU })), newU)
  const back = await unlock(out, newU)
  if (back.b.length !== d.b.length || back.b.some((v, i) => v !== d.b[i]) || back.p !== newU) throw new Error('Self-check failed.')
  return { out, type: d.h, bytes: d.b.length }
}
if (typeof module !== 'undefined') module.exports = { retie, unlock, UUID_RE }
