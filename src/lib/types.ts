export interface Item {
  id: string
  img: string
  name?: string
}

export interface Tier {
  id: string
  label: string
  items: string[] // item ids
}

export interface TierListState {
  title: string
  tiers: Tier[]
  items: Record<string, Item>
  pool: string[] // item ids
}

export const TIER_CONTAINER = 'pool'
