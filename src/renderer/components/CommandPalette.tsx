import { useEffect, useMemo, useRef, useState } from 'react'
import type { AlbumSummary } from '@core/database/db'
import { getFormat } from '@core/models/formats'

/** Una entrada de la lista: o es un disco, o es un sitio al que ir. */
interface Command {
  id: string
  label: string
  /** Texto chico a la derecha: el artista, o qué tipo de cosa es. */
  hint: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  albums: AlbumSummary[]
  onOpenAlbum: (albumId: number) => void
  /** Los sitios y acciones a los que se puede saltar. */
  actions: Array<{ label: string; hint: string; run: () => void }>
}

/**
 * Buscar en toda la app con Ctrl+K.
 *
 * Existe porque el diagnóstico encontró funciones que no se descubren: la
 * exportación vivía escondida dentro de la pantalla de colección, y los
 * préstamos solo aparecían si había alguno. Un menú lateral resuelve las
 * cinco secciones principales; esto resuelve todo lo demás, y de paso deja
 * llegar a cualquier disco sin pasar por la colección.
 *
 * Busca discos Y sitios en la misma lista a propósito: quien escribe "expo"
 * no sabe ni tiene por qué saber si eso es una pantalla, un botón o un disco.
 */
function CommandPalette({ open, onClose, albums, onOpenAlbum, actions }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Cada vez que se abre se empieza de cero: la búsqueda anterior ya no
  // corresponde a lo que la persona está haciendo ahora.
  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlighted(0)
      inputRef.current?.focus()
    }
  }, [open])

  const results = useMemo<Command[]>(() => {
    const q = query.trim().toLowerCase()

    const sitios: Command[] = actions
      .filter((a) => !q || a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q))
      .map((a, i) => ({ id: `action-${i}`, label: a.label, hint: a.hint, run: a.run }))

    // Sin nada escrito se ofrecen los sitios, que es el menú completo de la
    // app. Listar 250 discos sin criterio no ayudaría a nadie.
    if (!q) return sitios

    const discos: Command[] = albums
      .filter(
        (album) =>
          album.title.toLowerCase().includes(q) ||
          album.artists.toLowerCase().includes(q) ||
          (album.label ?? '').toLowerCase().includes(q) ||
          String(album.year ?? '').includes(q)
      )
      .slice(0, 8)
      .map((album) => ({
        id: `album-${album.id}`,
        label: album.title,
        hint: `${album.artists}${album.year ? ` · ${album.year}` : ''} · ${
          getFormat(album.format)?.label ?? album.format
        }`,
        run: () => onOpenAlbum(album.id)
      }))

    return [...sitios, ...discos]
  }, [query, albums, actions, onOpenAlbum])

  // Si la lista se acorta al escribir, la selección no puede quedar fuera.
  useEffect(() => {
    setHighlighted((current) => (current >= results.length ? 0 : current))
  }, [results.length])

  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector('[data-highlighted="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, open])

  if (!open) return null

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((current) => (current + 1) % Math.max(results.length, 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((current) => (current - 1 + results.length) % Math.max(results.length, 1))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const pick = results[highlighted]
      if (pick) {
        pick.run()
        onClose()
      }
    }
  }

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div
        className="palette"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Buscar en Melôfyle"
      >
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Busca un disco, un artista o una sección…"
          spellCheck={false}
          aria-controls="palette-results"
        />

        {results.length === 0 ? (
          <p className="palette-empty">
            Nada coincide con «{query.trim()}». Prueba con el artista o el año.
          </p>
        ) : (
          <ul className="palette-results" id="palette-results" ref={listRef} role="listbox">
            {results.map((item, index) => (
              <li key={item.id}>
                <button
                  className={`palette-item${index === highlighted ? ' highlighted' : ''}`}
                  data-highlighted={index === highlighted}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => {
                    item.run()
                    onClose()
                  }}
                >
                  <span className="palette-label">{item.label}</span>
                  <span className="palette-hint">{item.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="palette-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> moverse
          </span>
          <span>
            <kbd>Enter</kbd> abrir
          </span>
          <span>
            <kbd>Esc</kbd> cerrar
          </span>
        </footer>
      </div>
    </div>
  )
}

export default CommandPalette
