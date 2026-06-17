import { useEffect, useRef, useState } from 'react'
import type { Item } from '../lib/types'

interface Props {
  item: Item
  onSave: (id: string, img: string, name?: string) => void
  onClose: () => void
}

export function EditItemModal({ item, onSave, onClose }: Props) {
  const [img, setImg] = useState(item.img)
  const [name, setName] = useState(item.name ?? '')
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    urlRef.current?.focus()
    urlRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    const trimmed = img.trim()
    if (!trimmed) return
    onSave(item.id, trimmed, name.trim() || undefined)
    onClose()
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit item"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <span>Edit item</span>
          <button className="modal__close" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        <div className="modal__body">
          <div className="modal__preview">
            {img.trim() ? (
              <img
                className="modal__preview-img"
                src={img}
                alt={name}
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).classList.add(
                    'item__img--broken',
                  )
                }}
              />
            ) : (
              <div className="modal__preview-img item__img--broken" />
            )}
          </div>

          <label className="modal__field">
            <span className="modal__label">Image URL</span>
            <input
              ref={urlRef}
              type="url"
              placeholder="https://..."
              value={img}
              onChange={(e) => setImg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
            />
          </label>

          <label className="modal__field">
            <span className="modal__label">Label (optional)</span>
            <input
              type="text"
              placeholder="Label"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
            />
          </label>
        </div>

        <div className="modal__footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={save} disabled={!img.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
