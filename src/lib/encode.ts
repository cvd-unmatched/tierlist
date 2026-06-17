import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string'
import type { Item, Tier, TierListState } from './types'
import { makeId } from './id'
import { applyPrefix } from './prefix'
import { buildDict, decodeWithDict, encodeWithDict } from './dict'

/**
 * Compact, index-based shape serialized into the URL.
 *
 *   { v, t, d?, r: [[label, [idx...]]...], i: [[img, name?]...], p?: [idx...] }
 *
 * `d` is a dictionary of repeated URL fragments. Item images reference entries
 * as `$0$`, `$1$`, … (literal `$` is `$$`). Legacy links may use `pre` instead.
 *
 * `p` is omitted when every item is unranked in default order ([0, 1, 2, ...]).
 * Row colors are derived from position, not stored.
 */
interface CompactState {
  v: 1 | 2
  t: string
  /** Legacy: single shared prefix. Prefer `d` on new links. */
  pre?: string
  /** Dictionary of repeated URL fragments. */
  d?: string[]
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
 * as-is; a bare value gets `https://` prepended.
 */
function expandImg(value: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) return value
  if (value.startsWith('//')) return 'https:' + value
  if (/^data:/i.test(value)) return value
  return 'https://' + value
}

function resolveStoredImg(raw: string, compact: CompactState): string {
  if (!raw) return ''
  let body = raw
  if (compact.d?.length) {
    body = decodeWithDict(raw, compact.d)
  } else if (compact.pre) {
    body = applyPrefix(raw, compact.pre)
  }
  return expandImg(body)
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

  const rows: CompactState['r'] = state.tiers.map((tier) => [
    tier.label,
    tier.items.filter((id) => state.items[id]).map(register),
  ])
  const pool = state.pool.filter((id) => state.items[id]).map(register)

  const compacted = order.map((id) => compactImg(state.items[id].img))
  const dict = buildDict(compacted)

  const items: CompactState['i'] = order.map((id, idx) => {
    const item = state.items[id]
    const stored = dict.length
      ? encodeWithDict(compacted[idx], dict)
      : compacted[idx]
    return item.name ? [stored, item.name] : [stored]
  })

  const compact: CompactState = {
    v: dict.length ? 2 : 1,
    t: state.title,
    ...(dict.length ? { d: dict } : {}),
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
    const resolved = resolveStoredImg(raw, c)
    items[ids[idx]] = {
      id: ids[idx],
      img: resolved,
      ...(entry[1] ? { name: entry[1] } : {}),
    }
  })

  const idAt = (idx: number): string | undefined => ids[idx]

  const tiers: Tier[] = (c.r ?? []).map((row) => {
    const label = (row[0] as string) ?? ''
    const refs = (Array.isArray(row[1]) ? row[1] : row[2]) as number[] | undefined
    return {
      id: makeId('t'),
      label,
      items: (refs ?? []).map(idAt).filter((v): v is string => Boolean(v)),
    }
  })

  const poolIndices = c.p ?? c.i.map((_, idx) => idx)
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
