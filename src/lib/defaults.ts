import type { TierListState } from './types'
import { makeId } from './id'

export const DEFAULT_LABELS = ['S', 'A', 'B', 'C', 'D']

/**
 * Derive a row's color from its position so colors never need to be stored
 * in the URL. Spreads hue across the classic tier-list range (red at the top
 * down through orange/yellow/green to blue at the bottom).
 */
export function tierColor(index: number, total: number): string {
  if (total <= 1) return 'hsl(0, 75%, 72%)'
  const hue = Math.round((index / (total - 1)) * 220)
  return `hsl(${hue}, 75%, 72%)`
}

export function createDefaultState(): TierListState {
  return {
    title: 'My Tier List',
    tiers: DEFAULT_LABELS.map((label) => ({
      id: makeId('t'),
      label,
      items: [],
    })),
    items: {},
    pool: [],
  }
}

export function createTier() {
  return {
    id: makeId('t'),
    label: 'New',
    items: [] as string[],
  }
}
