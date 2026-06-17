import { decodeState } from './encode'
import { buildDict, decodeWithDict, encodeWithDict } from './dict'
import { FULL_IMG_MARKER } from './prefix'

export interface ParsedItem {
  img: string
  name?: string
}

export interface ImportJson {
  prefix?: string
  pre?: string
  dict?: string[]
  d?: string[]
  items: unknown[]
}

// Matches a full URL (http/https/protocol-relative/data) or a bare
// "domain/path" token. Used to find the image link within a line.
const URL_RE =
  /((?:https?:\/\/|\/\/|data:)\S+|(?:[\w-]+\.)+[\w-]+\/\S+)/i

/**
 * Parse pasted text into items. Auto-detects, in order:
 * 1. Share link / encoded payload
 * 2. JSON (array or { prefix, items })
 * 3. Line-based bulk paste
 */
export function parseImport(text: string): ParsedItem[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const fromLink = tryParseShareLink(trimmed)
  if (fromLink) return fromLink

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const fromJson = tryParseJson(trimmed)
    if (fromJson) return fromJson
  }

  return parseLines(trimmed)
}

/** Export items as compact JSON with auto-detected repeated URL fragments. */
export function exportItemsJson(items: ParsedItem[]): string {
  const normalized = items
    .map((it) => ({ img: it.img.trim(), ...(it.name ? { name: it.name } : {}) }))
    .filter((it) => it.img)

  const compacted = normalized.map((it) =>
    it.img.startsWith('https://') ? it.img.slice(8) : it.img,
  )
  const dict = buildDict(compacted)

  const payload: ImportJson = dict.length
    ? {
        dict,
        items: normalized.map((it, i) => {
          const stored = encodeWithDict(compacted[i], dict)
          return it.name ? { img: stored, name: it.name } : { img: stored }
        }),
      }
    : { items: normalized }

  return JSON.stringify(payload, null, 2)
}

function parseLines(text: string): ParsedItem[] {
  const items: ParsedItem[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const m = line.match(URL_RE)
    if (!m || m.index === undefined) continue
    const img = m[0].replace(/[,;|]+$/, '')
    const label = (line.slice(0, m.index) + line.slice(m.index + m[0].length))
      .replace(/[,;|\t]+/g, ' ')
      .trim()
    items.push(label ? { img, name: label } : { img })
  }
  return items
}

function tryParseJson(text: string): ParsedItem[] | null {
  try {
    const parsed = JSON.parse(text) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => parseJsonEntry(entry))
        .filter((v): v is ParsedItem => v !== null)
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as ImportJson
      if (!Array.isArray(obj.items)) return null
      const dict = normalizeDict(obj.dict ?? obj.d)
      const prefix = dict.length ? '' : normalizePrefix(obj.prefix ?? obj.pre)
      return obj.items
        .map((entry) => parseJsonEntry(entry, prefix, dict))
        .filter((v): v is ParsedItem => v !== null)
    }
    return null
  } catch {
    return null
  }
}

function normalizePrefix(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  const p = value.trim()
  if (/^https?:\/\//i.test(p)) return p
  return 'https://' + p
}

function normalizeDict(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (typeof entry !== 'string') return ''
      let s = entry.trim()
      if (s.startsWith('https://')) s = s.slice(8)
      return s
    })
    .filter(Boolean)
}

function parseJsonEntry(entry: unknown, prefix = '', dict: string[] = []): ParsedItem | null {
  if (typeof entry === 'string') {
    const img = entry.trim()
    if (!img) return null
    return { img: resolveImg(img, prefix, dict) }
  }
  if (Array.isArray(entry)) {
    const img = String(entry[0] ?? '').trim()
    if (!img) return null
    const name = entry[1] != null ? String(entry[1]).trim() : ''
    return name
      ? { img: resolveImg(img, prefix, dict), name }
      : { img: resolveImg(img, prefix, dict) }
  }
  if (entry && typeof entry === 'object') {
    const o = entry as Record<string, unknown>
    const img = String(o.img ?? o.url ?? o.image ?? '').trim()
    if (!img) return null
    const name = String(o.name ?? o.label ?? o.title ?? '').trim()
    return name
      ? { img: resolveImg(img, prefix, dict), name }
      : { img: resolveImg(img, prefix, dict) }
  }
  return null
}

function resolveImg(img: string, prefix: string, dict: string[]): string {
  let body = img
  if (body.startsWith(FULL_IMG_MARKER)) body = body.slice(1)
  if (dict.length) body = decodeWithDict(body, dict)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(body)) return body
  if (body.startsWith('//')) return 'https:' + body
  if (/^data:/i.test(body)) return body
  if (prefix) {
    const base = prefix.endsWith('/') || body.startsWith('/') ? prefix : prefix + '/'
    return base + body.replace(/^\//, '')
  }
  return body.startsWith('http') ? body : 'https://' + body
}

function tryParseShareLink(text: string): ParsedItem[] | null {
  if (/\s/.test(text)) return null

  let hash = text
  const marker = text.indexOf('#d=')
  if (marker >= 0) {
    hash = text.slice(marker + 3)
  } else if (/^https?:\/\//i.test(text) && !text.includes('#d=')) {
    return null
  }

  const state = decodeState(hash)
  if (!state) return null
  const values = Object.values(state.items)
  if (values.length === 0) return null
  return values.map((it) => (it.name ? { img: it.img, name: it.name } : { img: it.img }))
}
