import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { Item } from '../lib/types'
import { TIER_CONTAINER } from '../lib/types'
import { SortableItem } from './SortableItem'

interface Props {
  items: Item[]
  onDeleteItem: (itemId: string) => void
  onEditItem: (itemId: string) => void
}

export function Pool({ items, onDeleteItem, onEditItem }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: TIER_CONTAINER })

  return (
    <div className="pool">
      <div className="pool__title">
        <span>Unranked</span>
        <span className="pool__count">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`pool__drop${isOver ? ' tier__drop--over' : ''}`}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          {items.length === 0 ? (
            <div className="pool__empty">Add items above, then drag them into the tiers.</div>
          ) : (
            items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                onDelete={onDeleteItem}
                onEdit={onEditItem}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}
