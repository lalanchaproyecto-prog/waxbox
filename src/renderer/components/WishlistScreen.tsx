import { useEffect, useState } from 'react'
import type { WishlistItem, WishlistDraft } from '@core/database/db'
import { PHYSICAL_FORMATS, getFormat } from '@core/models/formats'
import type { PhysicalFormatId } from '@core/models/formats'
import PageHeader from './PageHeader'

interface WishlistScreenProps {
  collectionId: number
  /** Para que el contador del menú siga siendo cierto al agregar o quitar. */
  onChanged: () => void
}

const PRIORITIES = [
  { value: 1, label: 'Alta' },
  { value: 2, label: 'Media' },
  { value: 3, label: 'Baja' }
] as const

function emptyDraft(): WishlistDraft {
  return {
    artists: '',
    title: '',
    year: null,
    format: null,
    notes: null,
    priority: 2,
    seenAt: null,
    price: null
  }
}

function WishlistScreen({ collectionId, onChanged }: WishlistScreenProps) {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<WishlistDraft>(emptyDraft())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    load()
  }, [collectionId])

  async function load() {
    const result = await window.api.listWishlist(collectionId)
    if (result.ok) setItems(result.data)
    onChanged()
  }

  function startAdd() {
    setDraft(emptyDraft())
    setEditingId(null)
    setShowForm(true)
  }

  function startEdit(item: WishlistItem) {
    setDraft({
      artists: item.artists,
      title: item.title,
      year: item.year,
      format: item.format,
      notes: item.notes,
      priority: item.priority,
      seenAt: item.seenAt,
      price: item.price
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function save() {
    if (!draft.artists.trim() || !draft.title.trim()) return
    setBusy(true)

    if (editingId !== null) {
      await window.api.updateWishlistItem(editingId, draft)
    } else {
      await window.api.addWishlistItem(collectionId, draft)
    }

    setShowForm(false)
    setEditingId(null)
    await load()
    setBusy(false)
  }

  async function remove(itemId: number) {
    setBusy(true)
    await window.api.removeWishlistItem(itemId)
    await load()
    setBusy(false)
  }

  return (
    <div className="screen wishlist-screen">
      <PageHeader
        title="Lista de deseos"
        subtitle={
          items.length === 0
            ? 'Nada anotado todavía'
            : items.length === 1
              ? '1 disco que buscas'
              : `${items.length} discos que buscas`
        }
        actions={
          <button className="btn btn-primary" onClick={startAdd}>
            Agregar deseo
          </button>
        }
      />

      {showForm && (
        <section className="review-block wishlist-form">
          <h3 className="section-title">
            {editingId !== null ? 'Editar deseo' : 'Nuevo deseo'}
          </h3>
          <div className="edit-grid">
            <label className="field">
              <span className="field-label">Artista</span>
              <input
                value={draft.artists}
                spellCheck={false}
                onChange={(e) => setDraft({ ...draft, artists: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Título</span>
              <input
                value={draft.title}
                spellCheck={false}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Año</span>
              <input
                value={draft.year ?? ''}
                placeholder="1990"
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10)
                  setDraft({ ...draft, year: Number.isFinite(parsed) ? parsed : null })
                }}
              />
            </label>
            <label className="field">
              <span className="field-label">Formato</span>
              <select
                value={draft.format ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    format: (e.target.value || null) as PhysicalFormatId | null
                  })
                }
              >
                <option value="">Cualquiera</option>
                {PHYSICAL_FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.icon} {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Prioridad</span>
              <select
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: Number(e.target.value) })
                }
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Visto en</span>
              <input
                value={draft.seenAt ?? ''}
                placeholder="Ej: Discogs, tienda del barrio"
                spellCheck={false}
                onChange={(e) => setDraft({ ...draft, seenAt: e.target.value || null })}
              />
            </label>
            <label className="field">
              <span className="field-label">Precio visto</span>
              <input
                value={draft.price ?? ''}
                placeholder="Ej: $15.000"
                spellCheck={false}
                onChange={(e) => setDraft({ ...draft, price: e.target.value || null })}
              />
            </label>
            <label className="field field-wide">
              <span className="field-label">Notas</span>
              <input
                value={draft.notes ?? ''}
                placeholder="Opcional"
                spellCheck
                onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
              />
            </label>
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={cancelForm}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={busy || !draft.artists.trim() || !draft.title.trim()}
            >
              {editingId !== null ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        </section>
      )}

      {items.length === 0 && !showForm && (
        <p className="empty-state">
          Tu lista de deseos está vacía. Agrega los discos que quieres conseguir.
        </p>
      )}

      {items.length > 0 && (
        <ul className="wishlist-items">
          {items.map((item) => {
            const format = item.format ? getFormat(item.format) : null
            return (
              <li key={item.id} className="wishlist-item">
                <div className="wishlist-item-main">
                  <span className="wishlist-priority" data-priority={item.priority}>
                    {item.priority === 1 ? '!!!' : item.priority === 2 ? '!!' : '!'}
                  </span>
                  <div className="wishlist-item-info">
                    <span className="wishlist-item-title">
                      {item.artists} — {item.title}
                    </span>
                    <span className="wishlist-item-meta">
                      {[
                        format ? `${format.icon} ${format.label}` : null,
                        item.year ? String(item.year) : null,
                        item.seenAt ? `Visto en ${item.seenAt}` : null,
                        item.price
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {item.notes && (
                      <span className="wishlist-item-notes">{item.notes}</span>
                    )}
                  </div>
                </div>
                <div className="wishlist-item-actions">
                  <button
                    className="btn-link"
                    onClick={() => startEdit(item)}
                  >
                    ✎
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() => remove(item.id)}
                    disabled={busy}
                    title="Quitar de la lista"
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default WishlistScreen
