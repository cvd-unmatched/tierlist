/** Token: `$` + base-36 index + `$`. Literal `$` is `$$`. */

const COMMON_SUFFIXES = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']

function tokenFor(index: number): string {
  return `$${index.toString(36)}$`
}

function dictEntryOverhead(fragment: string): number {
  // Rough JSON cost of one more `"fragment",` in the `d` array.
  return JSON.stringify(fragment).length + 1
}

/** Escape literal `$` for storage. */
export function escapeDollars(value: string): string {
  return value.replace(/\$/g, '$$')
}

/** Expand `$$` and `$n$` dict references. */
export function decodeWithDict(stored: string, dict: string[]): string {
  if (!dict.length) return stored.replace(/\$\$/g, '$')

  let out = ''
  let i = 0
  while (i < stored.length) {
    if (stored[i] !== '$') {
      out += stored[i]
      i++
      continue
    }
    if (stored[i + 1] === '$') {
      out += '$'
      i += 2
      continue
    }
    const close = stored.indexOf('$', i + 1)
    if (close === -1) {
      out += stored[i]
      i++
      continue
    }
    const idx = parseInt(stored.slice(i + 1, close), 36)
    if (!Number.isNaN(idx) && idx >= 0 && idx < dict.length) {
      out += dict[idx]
      i = close + 1
      continue
    }
    out += stored[i]
    i++
  }
  return out
}

/** Replace dict fragments with `$n$` tokens (longest match first). */
export function encodeWithDict(value: string, dict: string[]): string {
  if (!dict.length) return escapeDollars(value)

  const order = dict
    .map((fragment, index) => ({ fragment, index }))
    .sort((a, b) => b.fragment.length - a.fragment.length)

  let out = ''
  let i = 0
  while (i < value.length) {
    if (value[i] === '$') {
      out += '$$'
      i++
      continue
    }
    let matched = false
    for (const { fragment, index } of order) {
      if (fragment && value.startsWith(fragment, i)) {
        out += tokenFor(index)
        i += fragment.length
        matched = true
        break
      }
    }
    if (!matched) {
      out += value[i]
      i++
    }
  }
  return out
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let pos = 0
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++
    pos += needle.length
  }
  return count
}

function netSavings(urls: string[], fragment: string, dict: string[]): number {
  const token = tokenFor(dict.length)
  let saved = 0
  for (const url of urls) {
    const encoded = encodeWithDict(url, dict)
    const hits = countOccurrences(encoded, fragment)
    saved += hits * (fragment.length - token.length)
  }
  return saved - dictEntryOverhead(fragment)
}

function isRedundantCandidate(fragment: string, dict: string[]): boolean {
  return dict.some((entry) => entry === fragment || entry.includes(fragment) || fragment.includes(entry))
}

/** Path prefixes ending at `/`, counted per URL once. */
function pathPrefixCounts(urls: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const url of urls) {
    const seen = new Set<string>()
    for (let slash = url.indexOf('/'); slash !== -1; slash = url.indexOf('/', slash + 1)) {
      const prefix = url.slice(0, slash + 1)
      if (prefix.length < 8 || seen.has(prefix)) continue
      seen.add(prefix)
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1)
    }
  }
  return counts
}

function suffixCounts(urls: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const suffix of COMMON_SUFFIXES) {
    const n = urls.filter((u) => u.endsWith(suffix)).length
    if (n >= 2) counts.set(suffix, n)
  }
  return counts
}

function gatherCandidates(urls: string[]): Map<string, number> {
  const merged = new Map<string, number>()
  const add = (source: Map<string, number>) => {
    for (const [frag, count] of source) {
      if (count < 2 || frag.length < 3) continue
      const prev = merged.get(frag) ?? 0
      if (count > prev) merged.set(frag, count)
    }
  }
  add(pathPrefixCounts(urls))
  add(suffixCounts(urls))
  return merged
}

/**
 * Build a dictionary of repeated URL fragments. Each entry is stored once and
 * referenced in item strings as `$0$`, `$1$`, etc. Works when only *some*
 * URLs share a prefix/suffix, unlike a single global `pre` field.
 */
export function buildDict(urls: string[]): string[] {
  if (urls.length < 2) return []

  const dict: string[] = []
  const originals = [...urls]

  while (true) {
    const candidates = gatherCandidates(originals)
    const ranked = [...candidates.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] * b[0].length - a[1] * a[0].length)
      .slice(0, 32)

    let best: { fragment: string; savings: number } | null = null

    for (const [fragment] of ranked) {
      if (isRedundantCandidate(fragment, dict)) continue
      const savings = netSavings(originals, fragment, dict)
      if (savings > 0 && (!best || savings > best.savings)) {
        best = { fragment, savings }
      }
    }

    if (!best) break
    dict.push(best.fragment)
  }

  return dict
}

/** Encode every URL with a shared dictionary. */
export function encodeAllWithDict(urls: string[], dict: string[]): string[] {
  return urls.map((url) => encodeWithDict(url, dict))
}
