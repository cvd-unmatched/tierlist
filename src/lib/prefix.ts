/** Longest string that is a prefix of every input. */
export function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return ''
  let prefix = strings[0]
  for (let i = 1; i < strings.length; i++) {
    const s = strings[i]
    while (prefix && !s.startsWith(prefix)) {
      prefix = prefix.slice(0, -1)
    }
    if (!prefix) return ''
  }
  return prefix
}

/**
 * Pick a shared URL prefix worth storing once. Requires at least two matching
 * URLs and enough total savings to beat the JSON overhead of a `pre` field.
 */
export function pickSharedPrefix(compactedUrls: string[]): string | null {
  if (compactedUrls.length < 2) return null

  const lcp = longestCommonPrefix(compactedUrls)
  // Prefer ending on a path segment boundary when possible.
  const trimmed = trimPrefixToBoundary(lcp)
  if (trimmed.length < 12) return null

  const matching = compactedUrls.filter((u) => u.startsWith(trimmed))
  if (matching.length < 2) return null

  const saved = trimmed.length * matching.length
  const overhead = JSON.stringify({ pre: trimmed }).length - 2 // drop {}
  if (saved <= overhead) return null

  return trimmed
}

function trimPrefixToBoundary(prefix: string): string {
  if (!prefix) return prefix
  const lastSlash = prefix.lastIndexOf('/')
  if (lastSlash > 8) return prefix.slice(0, lastSlash + 1)
  return prefix
}

/** Stored in the URL when `pre` is set but this item does not use it. */
export const FULL_IMG_MARKER = '!'

export function stripWithPrefix(compacted: string, prefix: string): string {
  if (prefix && compacted.startsWith(prefix)) return compacted.slice(prefix.length)
  return FULL_IMG_MARKER + compacted
}

export function applyPrefix(stored: string, prefix: string | undefined): string {
  if (!stored) return ''
  if (stored.startsWith(FULL_IMG_MARKER)) return stored.slice(FULL_IMG_MARKER.length)
  if (prefix) return prefix + stored
  return stored
}
