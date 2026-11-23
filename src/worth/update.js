'use strict'

/**
 * Keeps JRR's worth values up to date (JRR).
 *
 * A daily GitHub job (.github/workflows/worth-daily.yml) reads the Animal Jam
 * Item Worth Wiki and publishes values.json on the repo's "worth-data" branch,
 * next to a tiny version.json (its date and item count). When JRR starts, it
 * checks version.json and downloads values.json only when it's newer than the
 * copy it has, and keeps it in the JRR folder for every profile.
 *
 * JRR always uses the newest copy it has: the downloaded one, or the one that
 * ships with JRR (data/worth/values.json). With no internet nothing changes.
 */

const fs = require('fs')
const path = require('path')

const BASE = 'https://raw.githubusercontent.com/Rante-aj/JRR/worth-data/'
const MIN_ITEMS = 10000 // a real copy has about 21,000; fewer means something broke

// %APPDATA%\JRR\worth\values.json (shared by all profiles).
function cacheFile (info) {
  const top = info && info.dataDir ? path.dirname(path.dirname(info.dataDir)) : null
  return path.join(top || '.', 'worth', 'values.json')
}
const bundledFile = (info) => path.join(info.root, 'data', 'worth', 'values.json')

function readJson (file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (_) { return null }
}
const stamp = (v) => { const t = Date.parse(v && v.generatedAt); return Number.isFinite(t) ? t : 0 }
const usable = (v) => !!(v && Array.isArray(v.items) && v.items.length >= MIN_ITEMS && stamp(v))

/** The newest worth values JRR has: { generatedAt, items, source: 'downloaded'|'bundled' }. */
function loadWorth (info) {
  const downloaded = readJson(cacheFile(info))
  const bundled = readJson(bundledFile(info))
  if (usable(downloaded) && stamp(downloaded) > stamp(bundled)) return { ...downloaded, source: 'downloaded' }
  return { ...(bundled || { items: [] }), source: 'bundled' }
}

async function getJson (url, ms) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return await res.json()
  } finally { clearTimeout(timer) }
}

/**
 * Downloads newer worth values if there are any.
 * @returns {Promise<{updated: boolean, generatedAt?: string, itemCount?: number, error?: string}>}
 */
async function refreshWorth (info) {
  try {
    const have = loadWorth(info)
    const ver = await getJson(BASE + 'version.json', 15000)
    if (!ver || !(Date.parse(ver.generatedAt) > stamp(have))) return { updated: false, generatedAt: have.generatedAt }
    const fresh = await getJson(BASE + 'values.json', 120000)
    if (!usable(fresh) || stamp(fresh) <= stamp(have)) return { updated: false, generatedAt: have.generatedAt }
    const file = cacheFile(info)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file + '.tmp', JSON.stringify(fresh))
    fs.renameSync(file + '.tmp', file) // never leaves a half-written file
    return { updated: true, generatedAt: fresh.generatedAt, itemCount: fresh.items.length }
  } catch (e) {
    return { updated: false, error: (e && e.message) || String(e) }
  }
}

module.exports = { loadWorth, refreshWorth, cacheFile }
