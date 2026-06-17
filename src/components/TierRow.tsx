import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { Item, Tier } from '../lib/types'
import { SortableItem } from './SortableItem'

interface Props {
  tier: Tier
  items: Item[]
  color: string
  isFirst: boolean
  isLast: boolean
  onLabelChange: (id: string, label: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onDelete: (id: string) => void
  onDeleteItem: (itemId: string) => void
  onEditItem: (itemId: string) => void
}

export function TierRow({
  tier,
  items,
  color,
  isFirst,
  isLast,
  onLabelChange,
  onMove,
  onDelete,
  onDeleteItem,
  onEditItem,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.id })

  return (
    <div className="tier">
      <div className="tier__label" style={{ background: color }}>
        <textarea
          className="tier__label-input"
          value={tier.label}
          rows={1}
          spellCheck={false}
          onChange={(e) => onLabelChange(tier.id, e.target.value)}
        />
      </div>

      <div
        ref={setNodeRef}
        className={`tier__drop${isOver ? ' tier__drop--over' : ''}`}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              onDelete={onDeleteItem}
              onEdit={onEditItem}
            />
          ))}
        </SortableContext>
      </div>

      <div className="tier__controls">
        <div className="tier__buttons">
          <button disabled={isFirst} onClick={() => onMove(tier.id, -1)} title="Move up">
            ↑
          </button>
          <button disabled={isLast} onClick={() => onMove(tier.id, 1)} title="Move down">
            ↓
          </button>
          <button onClick={() => onDelete(tier.id)} title="Delete row">
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}
