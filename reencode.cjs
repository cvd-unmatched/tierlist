const LZ = require('lz-string')
const fs = require('fs')

const FULL_IMG_MARKER = '!'

function compactImg(img) {
  return img.startsWith('https://') ? img.slice(8) : img
}

function expandImg(value) {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) return value
  if (value.startsWith('//')) return 'https:' + value
  if (/^data:/i.test(value)) return value
  return 'https://' + value
}

function longestCommonPrefix(strings) {
  if (strings.length === 0) return ''
  let prefix = strings[0]
  for (let i = 1; i < strings.length; i++) {
    while (prefix && !strings[i].startsWith(prefix)) prefix = prefix.slice(0, -1)
    if (!prefix) return ''
  }
  return prefix
}

function trimPrefixToBoundary(prefix) {
  if (!prefix) return prefix
  const lastSlash = prefix.lastIndexOf('/')
  if (lastSlash > 8) return prefix.slice(0, lastSlash + 1)
  return prefix
}

function pickSharedPrefix(compactedUrls) {
  if (compactedUrls.length < 2) return null
  const trimmed = trimPrefixToBoundary(longestCommonPrefix(compactedUrls))
  if (trimmed.length < 12) return null
  const matching = compactedUrls.filter((u) => u.startsWith(trimmed))
  if (matching.length < 2) return null
  const saved = trimmed.length * matching.length
  const overhead = JSON.stringify({ pre: trimmed }).length - 2
  if (saved <= overhead) return null
  return trimmed
}

function stripWithPrefix(compacted, prefix) {
  if (prefix && compacted.startsWith(prefix)) return compacted.slice(prefix.length)
  return FULL_IMG_MARKER + compacted
}

function applyPrefix(stored, prefix) {
  if (!stored) return ''
  if (stored.startsWith(FULL_IMG_MARKER)) return stored.slice(1)
  if (prefix) return prefix + stored
  return stored
}

function isDefaultPool(pool, itemCount) {
  if (pool.length !== itemCount) return false
  return pool.every((idx, i) => idx === i)
}

function fromCompact(c) {
  const items = c.i.map((entry, idx) => {
    const raw = entry[0] ?? ''
    return {
      id: 'i' + idx,
      img: raw ? expandImg(applyPrefix(raw, c.pre)) : '',
      ...(entry[1] ? { name: entry[1] } : {}),
    }
  })
  const idAt = (idx) => items[idx]
  const tiers = (c.r ?? []).map((row) => {
    const label = row[0] ?? ''
    const refs = (Array.isArray(row[1]) ? row[1] : row[2]) ?? []
    return { id: 't' + label, label, items: refs.map(idAt).filter(Boolean).map((x) => x.id) }
  })
  const poolIndices = c.p ?? c.i.map((_, idx) => idx)
  const pool = poolIndices.map(idAt).filter(Boolean).map((x) => x.id)
  const itemsMap = Object.fromEntries(items.map((it) => [it.id, it]))
  return { title: c.t ?? '', tiers, items: itemsMap, pool }
}

function toCompact(state) {
  const order = []
  const indexOf = new Map()
  const register = (id) => {
    if (indexOf.has(id)) return indexOf.get(id)
    const idx = order.length
    order.push(id)
    indexOf.set(id, idx)
    return idx
  }

  const rows = state.tiers.map((tier) => [
    tier.label,
    tier.items.filter((id) => state.items[id]).map(register),
  ])
  const pool = state.pool.filter((id) => state.items[id]).map(register)

  const compacted = order.map((id) => compactImg(state.items[id].img))
  const pre = pickSharedPrefix(compacted) ?? undefined

  const i = order.map((id, idx) => {
    const item = state.items[id]
    const stored = pre ? stripWithPrefix(compacted[idx], pre) : compacted[idx]
    return item.name ? [stored, item.name] : [stored]
  })

  const compact = { v: 1, t: state.title, ...(pre ? { pre } : {}), r: rows, i }
  if (!isDefaultPool(pool, i.length)) compact.p = pool
  return compact
}

function encodeState(state) {
  return LZ.compressToEncodedURIComponent(JSON.stringify(toCompact(state)))
}

const hash = process.argv[2]
const oldLen = hash.length
const raw = JSON.parse(LZ.decompressFromEncodedURIComponent(hash))
const state = fromCompact(raw)
const newHash = encodeState(state)
const newLen = newHash.length

const url = 'http://localhost:5173/#d=' + newHash
fs.writeFileSync('new-url.txt', url)

console.log('Title:', state.title)
console.log('Items:', Object.keys(state.items).length)
console.log('In pool:', state.pool.length)
console.log('Old hash:', oldLen, 'chars')
console.log('New hash:', newLen, 'chars')
console.log('Saved:', oldLen - newLen, 'chars')
console.log('')
console.log(url)
