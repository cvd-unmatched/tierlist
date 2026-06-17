import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string'
import type { Item, Tier, TierListState } from './types'
import { makeId } from './id'
import { applyPrefix, pickSharedPrefix, stripWithPrefix } from './prefix'

/**
 * Compact, index-based shape that actually gets serialized into the URL.
 *
 *   { v, t, pre?, r: [[label, [idx...]]...], i: [[img, name?]...], p?: [idx...] }
 *
 * `p` is omitted when every item is unranked in default order ([0, 1, 2, ...]).
 *
 * `pre` holds a shared URL prefix (after stripping `https://`). Item images
 * that share it are stored as suffixes only; outliers are prefixed with `!`.
 * Row colors are derived from position, not stored.
 */
interface CompactState {
  v: 1
  t: string
  pre?: string
  r: CompactRow[]
  i: Array<[string] | [string, string]>
  p?: number[]
}

// New rows: [label, refs]. Legacy rows: [label, color, refs].
type CompactRow = [string, number[]] | [string, string, number[]]

export const HASH_KEY = 'd'

/**
 * Drop the most common image scheme (`https://`) before storing, since it can
 * be assumed on decode. Other forms (`http://`, `data:`, protocol-relative
 * `//`) are left untouched so they round-trip correctly.
 */
function compactImg(img: string): string {
  return img.startsWith('https://') ? img.slice('https://'.length) : img
}

/**
 * Restore an image URL. Anything that already carries a scheme is returned
 * as-is (this also keeps legacy URLs that stored the full `https://...`
 * working); a bare value gets `https://` prepended.
 */
function expandImg(value: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) return value // scheme://...
  if (value.startsWith('//')) return 'https:' + value // protocol-relative
  if (/^data:/i.test(value)) return value // inline data URI
  return 'https://' + value
}

/** True when every item sits in the pool in default index order. */
function isDefaultPool(pool: number[], itemCount: number): boolean {
  if (pool.length !== itemCount) return false
  return pool.every((idx, i) => idx === i)
}

function toCompact(state: TierListState): CompactState {
  const order: string[] = []
  const indexOf = new Map<string, number>()

  const register = (id: string): number => {
    const existing = indexOf.get(id)
    if (existing !== undefined) return existing
    const idx = order.length
    order.push(id)
    indexOf.set(id, idx)
    return idx
  }

  // Register every referenced item so indices are stable and dense.
  const rows: CompactState['r'] = state.tiers.map((tier) => [
    tier.label,
    tier.items.filter((id) => state.items[id]).map(register),
  ])
  const pool = state.pool.filter((id) => state.items[id]).map(register)

  const compacted = order.map((id) => compactImg(state.items[id].img))
  const pre = pickSharedPrefix(compacted) ?? undefined

  const items: CompactState['i'] = order.map((id, idx) => {
    const item = state.items[id]
    const stored = pre ? stripWithPrefix(compacted[idx], pre) : compacted[idx]
    return item.name ? [stored, item.name] : [stored]
  })

  const compact: CompactState = {
    v: 1,
    t: state.title,
    ...(pre ? { pre } : {}),
    r: rows,
    i: items,
  }
  if (!isDefaultPool(pool, items.length)) compact.p = pool
  return compact
}

function fromCompact(c: CompactState): TierListState {
  const ids = c.i.map(() => makeId('i'))
  const items: Record<string, Item> = {}
  c.i.forEach((entry, idx) => {
    const raw = entry[0] ?? ''
    const resolved = raw ? expandImg(applyPrefix(raw, c.pre)) : ''
    items[ids[idx]] = {
      id: ids[idx],
      img: resolved,
      ...(entry[1] ? { name: entry[1] } : {}),
    }
  })

  const idAt = (idx: number): string | undefined => ids[idx]

  const tiers: Tier[] = (c.r ?? []).map((row) => {
    const label = (row[0] as string) ?? ''
    // New format: refs are at index 1. Legacy format: a color string sits at
    // index 1 and refs are at index 2.
    const refs = (Array.isArray(row[1]) ? row[1] : row[2]) as number[] | undefined
    return {
      id: makeId('t'),
      label,
      items: (refs ?? []).map(idAt).filter((v): v is string => Boolean(v)),
    }
  })

  const poolIndices =
    c.p ?? c.i.map((_, idx) => idx)
  const pool = poolIndices.map(idAt).filter((v): v is string => Boolean(v))

  return { title: c.t ?? '', tiers, items, pool }
}

export function encodeState(state: TierListState): string {
  const json = JSON.stringify(toCompact(state))
  return compressToEncodedURIComponent(json)
}

export function decodeState(encoded: string): TierListState | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const parsed = JSON.parse(json) as CompactState
    if (!parsed || typeof parsed !== 'object') return null
    return fromCompact(parsed)
  } catch {
    return null
  }
}

export function readHash(): TierListState | null {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const data = params.get(HASH_KEY)
  if (!data) return null
  return decodeState(data)
}

export function buildShareUrl(state: TierListState): string {
  const encoded = encodeState(state)
  const { origin, pathname } = window.location
  return `${origin}${pathname}#${HASH_KEY}=${encoded}`
}
