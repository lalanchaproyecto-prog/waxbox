import { useEffect, useState } from 'react'
import type { WishlistItem, WishlistDraft } from '@core/database/db'
import type { ReleaseCandidate } from '@core/services/musicbrainz'
import { PHYSICAL_FORMATS, getFormat } from '@core/models/formats'
import type { PhysicalFormatId } from '@core/models/formats'
import PageHeader from './PageHeader'
import { IconClose, IconEdit, IconSearch, IconTrash } from './Icons'

interface WishlistScreenProps {
  collectionId: number
  /** Para que el contador del menú siga siendo cierto al agregar o quitar. */
  onChanged: () => void
  /**
   * Lo conseguiste: abre el flujo de agregar disco con lo que ya habías
   * anotado. Sin esto la lista de deseos era un callejón sin salida — el día
   * que comprabas el disco había que volver a escribir artista y título.
   */
  onGotIt: (item: WishlistItem) => void
}

const PRIORITIES = [
  { value: 1, label: 'Alta' },
  { value: 2, label: 'Media' },
  { value: 3, label: 'Baja' }
] as const

/** El nombre de la prioridad. Escrito, no en símbolos. */
function priorityLabel(priority: number): string {
  return PRIORITIES.find((p) => p.value === priority)?.label ?? 'Media'
}

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

function WishlistScreen({ collectionId, onChanged, onGotIt }: WishlistScreenProps) {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<WishlistDraft>(emptyDraft())
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [showSearch, setShowSearch] = useState(false)

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

  function handleSearchPick(candidate: ReleaseCandidate) {
    const fmt = (candidate.mediaFormat ?? '').toLowerCase()
    let format: PhysicalFormatId | null = null
    if (fmt.includes('vinyl') || fmt.includes('12"') || fmt.includes('7"') || fmt.includes('10"')) format = 'vinilo'
    else if (fmt.includes('cd')) format = 'cd'
    else if (fmt.includes('cassette')) format = 'casete'

    setDraft({
      artists: candidate.artist,
      title: candidate.title,
      year: candidate.year ?? null,
      format,
      notes: null,
      priority: 2,
      seenAt: null,
      price: null
    })
    setShowSearch(false)
    setEditingId(null)
    setShowForm(true)
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
    setConfirmId(null)
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
          <>
            <button className="btn btn-ghost" onClick={() => setShowSearch(true)}>
              <IconSearch size={15} />
              Buscar en catálogo
            </button>
            <button className="btn btn-primary" onClick={startAdd}>
              Agregar a mano
            </button>
          </>
        }
      />

      {items.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-title">Tu lista de deseos está vacía</p>
          <p className="empty-state-help">
            Anota aquí los discos que quieres conseguir. Puedes buscarlos en el catálogo
            de MusicBrainz o escribir los datos a mano. Cuando compres uno, «Ya lo tengo»
            te lleva a agregarlo a tu colección.
          </p>
          <div className="empty-state-actions">
            <button className="btn btn-ghost" onClick={() => setShowSearch(true)}>
              Buscar en catálogo
            </button>
            <button className="btn btn-primary" onClick={startAdd}>
              Agregar a mano
            </button>
          </div>
        </div>
      )}

      {/*
        Vienen ordenados por prioridad desde la base, así que la lista ya se lee
        de arriba abajo como "qué buscar primero". La prioridad va escrita —
        ALTA, MEDIA, BAJA— y no como signos de admiración: "!!!" obligaba a
        adivinar, y el color solo no puede ser la única señal.
      */}
      {items.length > 0 && (
        <ul className="wishlist-items">
          {items.map((item) => {
            const format = item.format ? getFormat(item.format) : null
            const datos = [
              format ? `${format.icon} ${format.label}` : null,
              item.year ? String(item.year) : null,
              item.seenAt ? `Visto en ${item.seenAt}` : null,
              item.price
            ].filter(Boolean)

            return (
              <li key={item.id} className="wishlist-item" data-priority={item.priority}>
                <div className="wishlist-item-info">
                  <span className="wishlist-priority overline">
                    {priorityLabel(item.priority)}
                  </span>
                  <span className="wishlist-item-title">{item.title}</span>
                  <span className="wishlist-item-artist">{item.artists}</span>
                  {datos.length > 0 && (
                    <span className="wishlist-item-meta numeric">{datos.join(' · ')}</span>
                  )}
                  {item.notes && <span className="wishlist-item-notes">{item.notes}</span>}
                </div>

                <div className="wishlist-item-actions">
                  {confirmId === item.id ? (
                    <span className="confirm-delete">
                      <span>¿Quitar de la lista?</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmId(null)}
                      >
                        No
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => remove(item.id)}
                        disabled={busy}
                      >
                        Sí, quitar
                      </button>
                    </span>
                  ) : (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => onGotIt(item)}>
                        Ya lo tengo
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => startEdit(item)}
                        title="Editar este deseo"
                        aria-label={`Editar «${item.title}»`}
                      >
                        <IconEdit size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => setConfirmId(item.id)}
                        disabled={busy}
                        title="Quitar de la lista"
                        aria-label={`Quitar «${item.title}» de la lista`}
                      >
                        <IconTrash size={15} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showForm && (
        <WishlistDialog
          draft={draft}
          onDraftChange={setDraft}
          editing={editingId !== null}
          busy={busy}
          onCancel={cancelForm}
          onSave={save}
        />
      )}

      {showSearch && (
        <WishlistSearchDialog
          onPick={handleSearchPick}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  )
}

interface WishlistDialogProps {
  draft: WishlistDraft
  onDraftChange: (draft: WishlistDraft) => void
  editing: boolean
  busy: boolean
  onCancel: () => void
  onSave: () => void
}

/**
 * Anotar un deseo, en un diálogo.
 *
 * Antes el formulario se abría dentro de la pantalla y empujaba la lista hacia
 * abajo: al editar un disco que estaba de sexto había que desplazarse para
 * encontrar el formulario, y la lista quedaba a medio ver detrás. Un diálogo
 * dice "esto es una interrupción con principio y fin" y devuelve la lista
 * intacta al cerrarse.
 */
function WishlistDialog({
  draft,
  onDraftChange,
  editing,
  busy,
  onCancel,
  onSave
}: WishlistDialogProps) {
  const completo = draft.artists.trim().length > 0 && draft.title.trim().length > 0

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [busy, onCancel])

  return (
    <div className="modal-backdrop" onClick={() => !busy && onCancel()}>
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={editing ? 'Editar deseo' : 'Nuevo deseo'}
      >
        <header className="modal-header">
          <div>
            <h2>{editing ? 'Editar deseo' : 'Nuevo deseo'}</h2>
            <p className="modal-subtitle">
              Solo el artista y el título son obligatorios. Lo demás sirve para
              acordarte de dónde lo viste y por cuánto.
            </p>
          </div>
          <button className="modal-close" onClick={onCancel} disabled={busy} title="Cerrar">
            <IconClose size={18} />
          </button>
        </header>

        <div className="edit-grid">
          <label className="field">
            <span className="field-label">Artista</span>
            <input
              value={draft.artists}
              spellCheck={false}
              autoFocus
              onChange={(e) => onDraftChange({ ...draft, artists: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Título</span>
            <input
              value={draft.title}
              spellCheck={false}
              onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Año</span>
            <input
              value={draft.year ?? ''}
              placeholder="1990"
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10)
                onDraftChange({ ...draft, year: Number.isFinite(parsed) ? parsed : null })
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">Formato</span>
            <select
              value={draft.format ?? ''}
              onChange={(e) =>
                onDraftChange({
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
              onChange={(e) => onDraftChange({ ...draft, priority: Number(e.target.value) })}
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
              onChange={(e) => onDraftChange({ ...draft, seenAt: e.target.value || null })}
            />
          </label>
          <label className="field">
            <span className="field-label">Precio visto</span>
            <input
              value={draft.price ?? ''}
              placeholder="Ej: $15.000"
              spellCheck={false}
              onChange={(e) => onDraftChange({ ...draft, price: e.target.value || null })}
            />
          </label>
          <label className="field field-wide">
            <span className="field-label">Notas</span>
            <input
              value={draft.notes ?? ''}
              placeholder="Opcional"
              spellCheck
              onChange={(e) => onDraftChange({ ...draft, notes: e.target.value || null })}
            />
          </label>
        </div>

        <footer className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={busy || !completo}>
            {editing ? 'Guardar cambios' : 'Agregar'}
          </button>
        </footer>
      </div>
    </div>
  )
}

interface WishlistSearchDialogProps {
  onPick: (candidate: ReleaseCandidate) => void
  onClose: () => void
}

function WishlistSearchDialog({ onPick, onClose }: WishlistSearchDialogProps) {
  const [artist, setArtist] = useState('')
  const [title, setTitle] = useState('')
  const [results, setResults] = useState<ReleaseCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function handleSearch() {
    if (!artist.trim() && !title.trim()) return
    setSearching(true)
    setSearched(false)
    const result = await window.api.searchReleases(artist.trim(), title.trim())
    setSearching(false)
    setSearched(true)
    if (result.ok) setResults(result.data)
    else setResults([])
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-wide"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Buscar disco en el catálogo"
      >
        <header className="modal-header">
          <div>
            <h2>Buscar disco</h2>
            <p className="modal-subtitle">
              Busca en MusicBrainz y elige el disco que quieres anotar.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} title="Cerrar">
            <IconClose size={18} />
          </button>
        </header>

        <div className="wishlist-search-form">
          <label className="field">
            <span className="field-label">Artista</span>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Ej: Soda Stereo"
              spellCheck={false}
              autoFocus
            />
          </label>
          <label className="field">
            <span className="field-label">Álbum</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Ej: Canción Animal"
              spellCheck={false}
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={searching || (!artist.trim() && !title.trim())}
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {searched && results.length === 0 && (
          <p className="wishlist-search-empty">
            No se encontró nada. Prueba con otro nombre o agrégalo a mano.
          </p>
        )}

        {results.length > 0 && (
          <ul className="wishlist-search-results">
            {results.slice(0, 20).map((r, i) => (
              <li key={`${r.musicbrainzId}-${i}`}>
                <button className="wishlist-search-result" onClick={() => onPick(r)}>
                  <span className="wishlist-search-result-title">{r.title}</span>
                  <span className="wishlist-search-result-meta">
                    {r.artist}
                    {r.year ? ` · ${r.year}` : ''}
                    {r.mediaFormat ? ` · ${r.mediaFormat}` : ''}
                    {r.label ? ` · ${r.label}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default WishlistScreen
