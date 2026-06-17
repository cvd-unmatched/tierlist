import { useState } from 'react'

interface Props {
  onAdd: (img: string, name?: string) => void
}

export function AddItem({ onAdd }: Props) {
  const [img, setImg] = useState('')
  const [name, setName] = useState('')

  const submit = () => {
    const trimmed = img.trim()
    if (!trimmed) return
    onAdd(trimmed, name.trim() || undefined)
    setImg('')
    setName('')
  }

  return (
    <div className="add-item">
      <input
        className="add-item__url"
        type="url"
        placeholder="Image URL (https://...)"
        value={img}
        onChange={(e) => setImg(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
      />
      <input
        className="add-item__name"
        type="text"
        placeholder="Label (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
      />
      <button className="btn btn--primary" onClick={submit}>
        Add item
      </button>
    </div>
  )
}
