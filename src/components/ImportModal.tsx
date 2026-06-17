import { useEffect, useMemo, useRef, useState } from 'react'
import { exportItemsJson, parseImport, type ParsedItem } from '../lib/importItems'

interface Props {
  existingItems: ParsedItem[]
  onImport: (items: ParsedItem[]) => number
  onClose: () => void
}

export function ImportModal({ existingItems, onImport, onClose }: Props) {
  const [text, setText] = useState('')
  const [added, setAdded] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    areaRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const parsed = useMemo(() => parseImport(text), [text])

  const doImport = () => {
    if (parsed.length === 0) return
    const n = onImport(parsed)
    setAdded(n)
    if (n > 0) setText('')
  }

  const copyExport = async () => {
    const json = exportItemsJson(existingItems)
    try {
      await navigator.clipboard.writeText(json)
    } catch {
      window.prompt('Copy this JSON:', json)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Import items"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <span>Import / export items</span>
          <button className="modal__close" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        <div className="modal__body">
          <p className="import__hint">
            Paste <strong>JSON</strong> (recommended), a share link, or one item per line.
            JSON can use a shared <code>prefix</code> so long image URLs are written once:
          </p>
          <pre className="import__example">{`{
  "prefix": "https://cdn.example.com/heroes/",
  "items": [
    { "img": "ana.png", "name": "Ana" },
    { "img": "ashe.png", "name": "Ashe" }
  ]
}`}</pre>

          <textarea
            ref={areaRef}
            className="import__area"
            spellCheck={false}
            placeholder={'Paste JSON, a share link, or lines like:\nAna, https://...'}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setAdded(null)
            }}
          />

          <div className="import__status">
            {parsed.length > 0 ? (
              <span>
                {parsed.length} item{parsed.length === 1 ? '' : 's'} detected
              </span>
            ) : text.trim() ? (
              <span className="import__status--warn">No items recognized yet</span>
            ) : (
              <span>&nbsp;</span>
            )}
            {added !== null ? (
              <span className="import__status--ok">
                {added > 0
                  ? `Added ${added} item${added === 1 ? '' : 's'} to Unranked`
                  : 'Nothing new added (all already present)'}
              </span>
            ) : null}
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <button
            className="btn"
            onClick={copyExport}
            disabled={existingItems.length === 0}
            title="Copy all current items as compact JSON"
          >
            {copied ? 'Copied!' : `Export JSON (${existingItems.length})`}
          </button>
          <button
            className="btn btn--primary"
            onClick={doImport}
            disabled={parsed.length === 0}
          >
            Add {parsed.length > 0 ? parsed.length : ''} item
            {parsed.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}
