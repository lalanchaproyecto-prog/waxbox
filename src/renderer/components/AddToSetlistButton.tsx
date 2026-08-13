import { useEffect, useRef, useState } from 'react'
import type { SetlistSummary } from '@core/database/db'

interface AddToSetlistButtonProps {
  /** Id de la canción en la base de datos. */
  trackId: number
  /** Colección activa: los setlists que se ofrecen son solo los suyos. */
  collectionId: number
  /**
   * Si viene, el botón agrega directo a ese setlist sin abrir el menú.
   * Se usa en el modo explorar, cuando ya sabemos a qué lista se está armando.
   */
  directSetlistId?: number
  /** Nombre del setlist destino, para el mensaje de confirmación. */
  directSetlistName?: string
}

type Flash = { kind: 'ok' | 'dup' | 'error'; message: string } | null

/**
 * Botón "+" que agrega una canción a un setlist.
 *
 * Abre un menú con los setlists que ya existen y, dentro del mismo menú, la
 * opción de crear uno nuevo: la idea es no interrumpir a quien está recorriendo
 * su colección eligiendo canciones.
 */
function AddToSetlistButton({
  trackId,
  collectionId,
  directSetlistId,
  directSetlistName
}: AddToSetlistButtonProps) {
  const [open, setOpen] = useState(false)
  const [setlists, setSetlists] = useState<SetlistSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [flash, setFlash] = useState<Flash>(null)

  const wrapRef = useRef<HTMLDivElement>(null)

  // Cierra el menú al hacer clic fuera o al presionar Escape.
  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  // El mensaje de confirmación se borra solo.
  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), 2600)
    return () => clearTimeout(timer)
  }, [flash])

  async function loadSetlists() {
    setLoading(true)
    const result = await window.api.listSetlists(collectionId)
    setLoading(false)
    if (result.ok) setSetlists(result.data)
  }

  async function addTo(setlistId: number, setlistName: string) {
    const result = await window.api.addTrackToSetlist(setlistId, trackId)

    if (!result.ok) {
      setFlash({ kind: 'error', message: result.error })
      return
    }
    if (result.data === 'already-there') {
      setFlash({ kind: 'dup', message: `Ya estaba en ${setlistName}` })
      setOpen(false)
      return
    }

    setFlash({ kind: 'ok', message: `Agregada a ${setlistName}` })
    setOpen(false)
    setCreating(false)
    setNewName('')
  }

  async function createAndAdd() {
    const name = newName.trim()
    if (!name) return

    const created = await window.api.createSetlist(collectionId, name)
    if (!created.ok) {
      setFlash({ kind: 'error', message: created.error })
      return
    }

    await addTo(created.data.id, name)
  }

  async function handleMainClick() {
    if (directSetlistId !== undefined) {
      await addTo(directSetlistId, directSetlistName ?? 'el setlist')
      return
    }

    const next = !open
    setOpen(next)
    setCreating(false)
    setNewName('')
    if (next) await loadSetlists()
  }

  return (
    <div className="setlist-add" ref={wrapRef}>
      <button
        type="button"
        className="setlist-add-btn"
        onClick={handleMainClick}
        title={
          directSetlistId !== undefined
            ? `Agregar a ${directSetlistName ?? 'el setlist'}`
            : 'Agregar a un setlist'
        }
        aria-haspopup={directSetlistId === undefined}
        aria-expanded={open}
      >
        +
      </button>

      {flash && (
        <span
          className={`setlist-flash setlist-flash-${flash.kind}`}
          role="status"
        >
          {flash.message}
        </span>
      )}

      {open && (
        <div className="setlist-menu" role="dialog" aria-label="Agregar a setlist">
          <p className="setlist-menu-title">Agregar a setlist</p>

          {loading && <p className="setlist-menu-empty">Cargando...</p>}

          {!loading && setlists.length === 0 && !creating && (
            <p className="setlist-menu-empty">
              Todavía no tienes setlists. Crea el primero aquí abajo.
            </p>
          )}

          {!loading && setlists.length > 0 && (
            <ul className="setlist-menu-list">
              {setlists.map((setlist) => (
                <li key={setlist.id}>
                  <button
                    type="button"
                    className="setlist-menu-item"
                    onClick={() => addTo(setlist.id, setlist.name)}
                  >
                    <span className="setlist-menu-name">{setlist.name}</span>
                    <span className="setlist-menu-count">
                      {setlist.trackCount === 1
                        ? '1 canción'
                        : `${setlist.trackCount} canciones`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {creating ? (
            <div className="setlist-menu-create">
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    createAndAdd()
                  }
                }}
                placeholder="Nombre del setlist"
                autoFocus
              />
              <div className="setlist-menu-create-actions">
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setCreating(false)
                    setNewName('')
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary setlist-menu-create-btn"
                  onClick={createAndAdd}
                  disabled={newName.trim().length === 0}
                >
                  Crear y agregar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="setlist-menu-new"
              onClick={() => setCreating(true)}
            >
              + Crear nuevo setlist
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default AddToSetlistButton
