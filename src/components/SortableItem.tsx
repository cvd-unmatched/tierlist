import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Item } from '../lib/types'

interface Props {
  item: Item
  onDelete: (id: string) => void
  onEdit?: (id: string) => void
}

export function SortableItem({ item, onDelete, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="item">
      {onEdit ? (
        <button
          className="item__edit"
          title="Edit"
          onClick={() => onEdit(item.id)}
        >
          ✎
        </button>
      ) : null}
      <button
        className="item__delete"
        title="Remove"
        onClick={() => onDelete(item.id)}
      >
        ×
      </button>
      <div className="item__grab" {...attributes} {...listeners}>
        {item.img ? (
          <img
            className="item__img"
            src={item.img}
            alt={item.name ?? ''}
            draggable={false}
            loading="lazy"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).classList.add('item__img--broken')
            }}
          />
        ) : (
          <div className="item__img item__img--broken" />
        )}
        {item.name ? <span className="item__name">{item.name}</span> : null}
      </div>
    </div>
  )
}
