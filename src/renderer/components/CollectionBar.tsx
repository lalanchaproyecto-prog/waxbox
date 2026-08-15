import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CollectionSummary } from '@core/database/db'
import { imageIcon, type ImageRef } from '@core/models/imageRef'
import IconPicker from './IconPicker'

interface CollectionBarProps {
  collections: CollectionSummary[]
  activeId: number
  onSwitch: (collectionId: number) => void
  /** Se llama tras crear, renombrar o borrar, para que App recargue la lista. */
  onChanged: (activeIdHint?: number) => void
}

/**
 * Selector de la colección activa.
 *
 * Va en la cabecera y no dentro de la pantalla de la colección porque los
 * setlists también pertenecen a una colección: hace falta poder cambiar de una
 * a otra desde cualquier parte.
 */
function CollectionBar({ collections, activeId, onSwitch, onChanged }: CollectionBarProps) {
  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)

  /* Dónde dibujar el desplegable. Se mide del botón al abrirlo. */
  const [anclaje, setAnclaje] = useState<{ top: number; left: number } | null>(null)

  const active = collections.find((item) => item.id === activeId)

  /*
    EL DESPLEGABLE SE MIDE ANTES DE PINTARSE.

    `useLayoutEffect` y no `useEffect` porque esto corre entre el cálculo del
    diseño y el pintado: con `useEffect` el menú aparecería un cuadro en la
    esquina superior izquierda y saltaría a su sitio al siguiente, que se ve
    como un parpadeo.
  */
  useLayoutEffect(() => {
    if (!open || !botonRef.current) return
    const caja = botonRef.current.getBoundingClientRect()
    setAnclaje({ top: caja.bottom + 4, left: caja.left })
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      const destino = event.target as Node
      /*
        El menú ya NO está dentro de `wrapRef` —vive colgado de <body>— así que
        hay que preguntarle también a él. Sin esto, pulsar cualquier opción del
        propio menú contaría como "clic fuera" y lo cerraría antes de que el
        botón llegara a responder.
      */
      const dentroDelBoton = wrapRef.current?.contains(destino)
      const dentroDelMenu = document
        .querySelector('.collection-menu')
        ?.contains(destino)
      if (!dentroDelBoton && !dentroDelMenu) setOpen(false)
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    /* Si la ventana cambia de tamaño, el anclaje medido deja de valer. */
    function cerrarAlMover() {
      setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', cerrarAlMover)
    window.addEventListener('scroll', cerrarAlMover, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', cerrarAlMover)
      window.removeEventListener('scroll', cerrarAlMover, true)
    }
  }, [open])

  // Con una sola colección el selector sería ruido; solo se ofrece crear otra.
  const onlyOne = collections.length <= 1

  return (
    <div className="collection-bar" ref={wrapRef}>
      <button
        ref={botonRef}
        className="collection-switch"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Ver, cambiar o agregar colecciones"
      >
        <span className="collection-switch-icon" aria-hidden="true">
          {imageIcon(active?.image ?? null) ?? '💿'}
        </span>
        {/*
          «Mis colecciones», en plural.

          El botón no muestra en cuál estás —eso ya lo dice el título de la
          pantalla de inicio—: sirve para VER, CAMBIAR o AGREGAR colecciones,
          y en singular parecía una etiqueta de estado en vez de una puerta.
        */}
        <span className="collection-switch-name">Mis colecciones</span>
        <span className="collection-switch-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {/*
        EL DESPLEGABLE VA COLGADO DE <body>, NO DE AQUÍ.

        El menú lateral es `position: sticky` con `overflow-y: auto`, y eso le
        hace dos cosas a cualquier hijo posicionado:

        1. Lo RECORTA. El desplegable mide 272 px y el menú 232; los 40 que
           sobraban se cortaban y aparecía una barra de scroll horizontal
           dentro del menú lateral. Medido: scrollWidth 284 contra
           clientWidth 267.
        2. Lo ATRAPA. `sticky` crea un contexto de apilamiento propio, así que
           el z-index del desplegable solo compite con sus hermanos de dentro
           del menú y no puede ponerse por encima de nada de fuera.

        Sacándolo a <body> con posición fija medida del botón, las dos cosas
        dejan de aplicar: ni se recorta ni queda atrapado.
      */}
      {open &&
        anclaje &&
        createPortal(
          <div
            className="collection-menu"
            role="menu"
            style={{ top: anclaje.top, left: anclaje.left }}
          >
            {!onlyOne && (
              <>
                <p className="collection-menu-title">Cambiar a</p>
                <ul className="collection-menu-list">
                  {collections.map((item) => (
                    <li key={item.id}>
                      <button
                        className={`collection-menu-item${item.id === activeId ? ' active' : ''}`}
                        onClick={() => {
                          onSwitch(item.id)
                          setOpen(false)
                        }}
                      >
                        <span className="collection-menu-name">
                          <span className="collection-menu-icon" aria-hidden="true">
                            {imageIcon(item.image) ?? '💿'}
                          </span>
                          {item.name}
                        </span>
                        <span className="collection-menu-count">
                          {item.albumCount === 1 ? '1 disco' : `${item.albumCount} discos`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <button
              className="collection-menu-manage"
              onClick={() => {
                setManaging(true)
                setOpen(false)
              }}
            >
              Gestionar colecciones
            </button>
          </div>,
          document.body
        )}

      {managing && (
        <CollectionsManager
          collections={collections}
          activeId={activeId}
          onChanged={onChanged}
          onClose={() => setManaging(false)}
        />
      )}
    </div>
  )
}

// --------------------------------------------------------------------------

interface CollectionsManagerProps {
  collections: CollectionSummary[]
  activeId: number
  onChanged: (activeIdHint?: number) => void
  onClose: () => void
}

function CollectionsManager({
  collections,
  activeId,
  onChanged,
  onClose
}: CollectionsManagerProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  /** Colección a la que se le está eligiendo ícono. */
  const [imagenDe, setImagenDe] = useState<CollectionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return

    const result = await window.api.createCollection(name)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setNewName('')
    setCreating(false)
    onChanged(result.data.id)
  }

  async function handleRename(collectionId: number) {
    const name = renameValue.trim()
    if (!name) return

    const result = await window.api.renameCollection(collectionId, name)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setRenamingId(null)
    onChanged()
  }

  async function handleDelete(collectionId: number) {
    const result = await window.api.deleteCollection(collectionId)
    if (!result.ok) {
      setError(result.error)
      setConfirmDeleteId(null)
      return
    }

    setConfirmDeleteId(null)
    onChanged()
  }

  /*
    Este diálogo también sale por portal, por la misma razón que el
    desplegable: se renderiza desde dentro del menú lateral, que es `sticky` y
    por tanto un contexto de apilamiento propio. Un velo a pantalla completa
    atrapado ahí dentro no puede taparlo todo por mucho z-index que se le
    ponga, porque su número solo vale entre sus hermanos.
  */
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal collections-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Gestionar colecciones"
      >
        <header className="modal-header">
          <div>
            <h2>Mis colecciones</h2>
            <p className="modal-subtitle">
              Cada colección tiene sus propios discos y setlists, sin mezclarse.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} title="Cerrar">
            ✕
          </button>
        </header>

        {error && <p className="feedback-error">{error}</p>}

        <ul className="collection-rows">
          {collections.map((item) => (
            <li className="collection-row" key={item.id}>
              {renamingId === item.id ? (
                <div className="setlist-rename">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleRename(item.id)
                      if (event.key === 'Escape') setRenamingId(null)
                    }}
                    autoFocus
                  />
                  <button className="btn btn-ghost" onClick={() => setRenamingId(null)}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={() => handleRename(item.id)}>
                    Guardar
                  </button>
                </div>
              ) : (
                <>
                  <span className="collection-row-icon" aria-hidden="true">
                    {imageIcon(item.image) ?? '💿'}
                  </span>
                  <div className="collection-row-text">
                    <span className="collection-row-name">
                      {item.name}
                      {item.id === activeId && <span className="collection-row-tag">activa</span>}
                    </span>
                    <span className="collection-row-meta">
                      {item.albumCount === 1 ? '1 disco' : `${item.albumCount} discos`}
                      {' · '}
                      {item.setlistCount === 1 ? '1 setlist' : `${item.setlistCount} setlists`}
                    </span>
                  </div>

                  <div className="collection-row-actions">
                    <button
                      className="btn-link"
                      onClick={() => {
                        setRenamingId(item.id)
                        setRenameValue(item.name)
                      }}
                    >
                      ✎ Renombrar
                    </button>

                    <button className="btn-link" onClick={() => setImagenDe(item)}>
                      ◐ Ícono
                    </button>

                    {confirmDeleteId === item.id ? (
                      <span className="confirm-delete">
                        <span>
                          Se borran sus {item.albumCount} discos y {item.setlistCount} setlists.
                        </span>
                        <button
                          className="btn btn-ghost"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          No
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDelete(item.id)}>
                          Sí, borrar
                        </button>
                      </span>
                    ) : (
                      <button
                        className="btn-link btn-link-danger"
                        onClick={() => setConfirmDeleteId(item.id)}
                        disabled={collections.length <= 1}
                        title={
                          collections.length <= 1
                            ? 'No puedes borrar tu única colección'
                            : 'Borrar esta colección'
                        }
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {creating ? (
          <div className="setlist-create-row">
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate()
                if (event.key === 'Escape') setCreating(false)
              }}
              placeholder="Ej: Colección de mi papá"
              autoFocus
            />
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={newName.trim().length === 0}
            >
              Crear
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={() => setCreating(true)}>
            + Nueva colección
          </button>
        )}

        <footer className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>

      {imagenDe && (
        <IconPicker
          title={imagenDe.name}
          current={imagenDe.image}
          onChange={async (image: ImageRef | null) => {
            const result = await window.api.setCollectionImage(imagenDe.id, image)
            if (result.ok) onChanged()
            else setError(result.error)
          }}
          onClose={() => setImagenDe(null)}
        />
      )}
    </div>,
    document.body
  )
}

export default CollectionBar
