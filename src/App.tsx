import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Item, TierListState } from './lib/types'
import { TIER_CONTAINER } from './lib/types'
import { createDefaultState, createTier, tierColor } from './lib/defaults'
import { buildShareUrl, HASH_KEY, readHash } from './lib/encode'
import { makeId } from './lib/id'
import { TierRow } from './components/TierRow'
import { Pool } from './components/Pool'
import { AddItem } from './components/AddItem'
import { SortableItem } from './components/SortableItem'
import { EditItemModal } from './components/EditItemModal'
import { ImportModal } from './components/ImportModal'

function initialState(): TierListState {
  return readHash() ?? createDefaultState()
}

/** Returns the container id ('pool' or a tier id) that holds the given item. */
function findContainer(state: TierListState, id: string): string | null {
  if (id === TIER_CONTAINER) return TIER_CONTAINER
  if (state.tiers.some((t) => t.id === id)) return id
  if (state.pool.includes(id)) return TIER_CONTAINER
  const tier = state.tiers.find((t) => t.items.includes(id))
  return tier ? tier.id : null
}

function getItems(state: TierListState, container: string): string[] {
  if (container === TIER_CONTAINER) return state.pool
  return state.tiers.find((t) => t.id === container)?.items ?? []
}

function setItems(
  state: TierListState,
  container: string,
  items: string[],
): TierListState {
  if (container === TIER_CONTAINER) return { ...state, pool: items }
  return {
    ...state,
    tiers: state.tiers.map((t) => (t.id === container ? { ...t, items } : t)),
  }
}

/** Resolve a drag `over` id to its list container (tier id or pool). */
function resolveContainer(state: TierListState, id: string): string | null {
  if (id === TIER_CONTAINER) return TIER_CONTAINER
  if (state.tiers.some((t) => t.id === id)) return id
  return findContainer(state, id)
}

/** Move an item between containers, or reorder within one. */
function moveItem(
  state: TierListState,
  activeId: string,
  overId: string,
): TierListState {
  const from = findContainer(state, activeId)
  const to = resolveContainer(state, overId)
  if (!from || !to) return state

  if (from !== to) {
    const fromItems = getItems(state, from).filter((i) => i !== activeId)
    const toItems = [...getItems(state, to)]
    const overIndex = toItems.indexOf(overId)
    const insertAt = overIndex >= 0 ? overIndex : toItems.length
    toItems.splice(insertAt, 0, activeId)
    let next = setItems(state, from, fromItems)
    next = setItems(next, to, toItems)
    return next
  }

  const items = getItems(state, from)
  const oldIndex = items.indexOf(activeId)
  const newIndex = items.indexOf(overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return state
  return setItems(state, from, arrayMove(items, oldIndex, newIndex))
}

// closestCorners misses empty tier rows; pointer position is more reliable.
const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pointerHits

  const rectHits = rectIntersection(args)
  if (rectHits.length > 0) return rectHits

  return closestCorners(args)
}

export default function App() {
  const [state, setState] = useState<TierListState>(initialState)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  // Always-current snapshot of state for handlers that must read it synchronously.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Keep the URL in sync with state (debounced, without adding history entries).
  const skipNextHash = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => {
      const url = buildShareUrl(state)
      skipNextHash.current = true
      window.history.replaceState(null, '', url)
    }, 250)
    return () => clearTimeout(t)
  }, [state])

  // Respond to manual hash changes (back/forward, pasted link in same tab).
  useEffect(() => {
    const onHashChange = () => {
      if (skipNextHash.current) {
        skipNextHash.current = false
        return
      }
      const loaded = readHash()
      if (loaded) setState(loaded)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const activeItem: Item | null = activeId ? state.items[activeId] ?? null : null

  // ---- Item / tier mutations ----------------------------------------------

  const addItem = useCallback((img: string, name?: string) => {
    setState((s) => {
      const id = makeId('i')
      const item: Item = { id, img, ...(name ? { name } : {}) }
      return { ...s, items: { ...s.items, [id]: item }, pool: [...s.pool, id] }
    })
  }, [])

  // Bulk add (used by import). Skips images already present so re-importing the
  // same list does not create duplicates. Returns how many were actually added.
  const addItems = useCallback(
    (incoming: { img: string; name?: string }[]): number => {
      const s = stateRef.current
      const existingImgs = new Set(Object.values(s.items).map((it) => it.img))
      const items = { ...s.items }
      const newIds: string[] = []
      for (const { img, name } of incoming) {
        const trimmed = img.trim()
        if (!trimmed || existingImgs.has(trimmed)) continue
        existingImgs.add(trimmed)
        const id = makeId('i')
        items[id] = { id, img: trimmed, ...(name ? { name } : {}) }
        newIds.push(id)
      }
      if (newIds.length === 0) return 0
      const next = { ...s, items, pool: [...s.pool, ...newIds] }
      stateRef.current = next
      setState(next)
      return newIds.length
    },
    [],
  )

  const updateItem = useCallback((id: string, img: string, name?: string) => {
    setState((s) => {
      const current = s.items[id]
      if (!current) return s
      const next: Item = { id, img, ...(name ? { name } : {}) }
      return { ...s, items: { ...s.items, [id]: next } }
    })
  }, [])

  const deleteItem = useCallback((itemId: string) => {
    setState((s) => {
      const items = { ...s.items }
      delete items[itemId]
      return {
        ...s,
        items,
        pool: s.pool.filter((i) => i !== itemId),
        tiers: s.tiers.map((t) => ({ ...t, items: t.items.filter((i) => i !== itemId) })),
      }
    })
  }, [])

  const addTier = useCallback(() => {
    setState((s) => ({ ...s, tiers: [...s.tiers, createTier()] }))
  }, [])

  const deleteTier = useCallback((id: string) => {
    setState((s) => {
      const tier = s.tiers.find((t) => t.id === id)
      if (!tier) return s
      return {
        ...s,
        tiers: s.tiers.filter((t) => t.id !== id),
        pool: [...s.pool, ...tier.items], // keep its items, move them to unranked
      }
    })
  }, [])

  const renameTier = useCallback((id: string, label: string) => {
    setState((s) => ({
      ...s,
      tiers: s.tiers.map((t) => (t.id === id ? { ...t, label } : t)),
    }))
  }, [])

  const moveTier = useCallback((id: string, dir: -1 | 1) => {
    setState((s) => {
      const idx = s.tiers.findIndex((t) => t.id === id)
      const next = idx + dir
      if (idx < 0 || next < 0 || next >= s.tiers.length) return s
      return { ...s, tiers: arrayMove(s.tiers, idx, next) }
    })
  }, [])

  const reset = useCallback(() => {
    if (confirm('Start a new, empty tier list? This clears the current one.')) {
      setState(createDefaultState())
    }
  }, [])

  const resetRankings = useCallback(() => {
    const s = stateRef.current
    const ranked = s.tiers.some((t) => t.items.length > 0)
    if (!ranked) return
    if (
      !confirm(
        'Move every item back to Unranked and clear all tiers? Items, title, and row labels are kept.',
      )
    ) {
      return
    }
    setState((prev) => {
      const seen = new Set<string>()
      const pool: string[] = []
      const add = (id: string) => {
        if (!prev.items[id] || seen.has(id)) return
        seen.add(id)
        pool.push(id)
      }
      prev.pool.forEach(add)
      prev.tiers.forEach((t) => t.items.forEach(add))
      Object.keys(prev.items).forEach(add)
      return {
        ...prev,
        pool,
        tiers: prev.tiers.map((t) => ({ ...t, items: [] })),
      }
    })
  }, [])

  const copyLink = useCallback(async () => {
    const url = buildShareUrl(state)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copy this link:', url)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [state])

  // ---- Drag and drop -------------------------------------------------------

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return

    setState((s) => {
      const from = findContainer(s, String(active.id))
      const to = resolveContainer(s, String(over.id))
      if (!from || !to || from === to) return s
      return moveItem(s, String(active.id), String(over.id))
    })
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveId(null)
    if (!over) return

    setState((s) => moveItem(s, String(active.id), String(over.id)))
  }

  const itemsFor = (ids: string[]): Item[] =>
    ids.map((id) => state.items[id]).filter((v): v is Item => Boolean(v))

  const shareUrlLength = buildShareUrl(state).length
  const linkRisk = shareUrlLength >= 4000 ? 'danger' : shareUrlLength >= 2000 ? 'warning' : 'ok'
  const hasRankedItems = state.tiers.some((t) => t.items.length > 0)

  return (
    <div className="app">
      <header className="header">
        <input
          className="header__title"
          value={state.title}
          placeholder="Untitled tier list"
          onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
        />
        <div className="header__actions">
          <button className="btn btn--primary" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy share link'}
          </button>
          <button className="btn" onClick={() => setImporting(true)}>
            Import
          </button>
          <button className="btn" onClick={addTier}>
            + Row
          </button>
          <button
            className="btn"
            onClick={resetRankings}
            disabled={!hasRankedItems}
            title="Move all items back to Unranked"
          >
            Reset
          </button>
          <button className="btn" onClick={reset} title="Clear everything and start over">
            New
          </button>
        </div>
      </header>

      <AddItem onAdd={addItem} />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="tiers">
          {state.tiers.map((tier, i) => (
            <TierRow
              key={tier.id}
              tier={tier}
              items={itemsFor(tier.items)}
              color={tierColor(i, state.tiers.length)}
              isFirst={i === 0}
              isLast={i === state.tiers.length - 1}
              onLabelChange={renameTier}
              onMove={moveTier}
              onDelete={deleteTier}
              onDeleteItem={deleteItem}
              onEditItem={setEditingId}
            />
          ))}
        </div>

        <Pool
          items={itemsFor(state.pool)}
          onDeleteItem={deleteItem}
          onEditItem={setEditingId}
        />

        <DragOverlay>
          {activeItem ? (
            <SortableItem item={activeItem} onDelete={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {editingId && state.items[editingId] ? (
        <EditItemModal
          item={state.items[editingId]}
          onSave={updateItem}
          onClose={() => setEditingId(null)}
        />
      ) : null}

      {importing ? (
        <ImportModal
          existingItems={Object.values(state.items).map((it) =>
            it.name ? { img: it.img, name: it.name } : { img: it.img },
          )}
          onImport={addItems}
          onClose={() => setImporting(false)}
        />
      ) : null}

      <footer className="footer">
        <div className={`url-meter url-meter--${linkRisk}`}>
          <span>Share link: {shareUrlLength.toLocaleString()} chars</span>
          {linkRisk === 'warning' ? (
            <span>Some chat apps may truncate this link.</span>
          ) : null}
          {linkRisk === 'danger' ? (
            <span>Use direct copy/paste into a browser or document, not SMS/social posts.</span>
          ) : null}
        </div>
        <span>
          Everything is stored in the URL ({HASH_KEY}=…). No account, no server. Share the
          link to share the list.
        </span>
      </footer>
    </div>
  )
}
