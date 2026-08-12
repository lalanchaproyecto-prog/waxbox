import { useEffect, useState } from 'react'
import type { ReleaseCandidate } from '@core/services/musicbrainz'
import type { AlbumSheet } from '@core/services/albumSheet'
import type { SettingsStatus } from '@core/models/settings'
import type { EditableAlbum } from '@core/albumDraft'
import { draftFromSheet } from '@core/albumDraft'
import AddAlbumForm, { type AlbumDraft } from './components/AddAlbumForm'
import ReleasePicker from './components/ReleasePicker'
import AlbumReview from './components/AlbumReview'
import SettingsScreen from './components/SettingsScreen'

type View = 'home' | 'add' | 'results' | 'details' | 'settings'

function App() {
  const [view, setView] = useState<View>('home')
  const [settings, setSettings] = useState<SettingsStatus>({
    youtubeConfigured: false,
    youtubeKeyEncrypted: true
  })
  const [draft, setDraft] = useState<AlbumDraft | null>(null)
  const [candidates, setCandidates] = useState<ReleaseCandidate[]>([])
  // La ficha editable: lo que trajeron las fuentes, más lo que la persona corrija.
  const [album, setAlbum] = useState<EditableAlbum | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Al abrir la app se consulta si ya hay clave de YouTube configurada.
  // Nunca se pide la clave en sí, solo si existe.
  useEffect(() => {
    window.api.getSettingsStatus().then(setSettings)
  }, [])

  /** Paso 1: con lo que escribió la persona, buscar ediciones en MusicBrainz. */
  async function handleSearch(newDraft: AlbumDraft) {
    setDraft(newDraft)
    setError(null)
    setLoading('Buscando en MusicBrainz...')

    const result = await window.api.searchReleases(newDraft.artist, newDraft.title)
    setLoading(null)

    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.data.length === 0) {
      setError(
        `No se encontró "${newDraft.title}" de ${newDraft.artist}. Revisa la escritura o prueba con el título original del álbum.`
      )
      return
    }

    setCandidates(result.data)
    setView('results')
  }

  /** Paso 2: con la edición elegida, armar la ficha completa del álbum. */
  async function handlePick(candidate: ReleaseCandidate) {
    if (!draft) return
    setError(null)
    setLoading('Trayendo el tracklist y la portada...')

    const result = await window.api.getAlbumSheet(candidate.musicbrainzId, draft.format)
    setLoading(null)

    if (!result.ok) {
      setError(result.error)
      return
    }

    // Lo que dijeron las fuentes se convierte en una ficha editable, para que
    // la persona pueda corregir cualquier dato antes de guardar.
    setAlbum(draftFromSheet(result.data, draft.format))
    setView('details')
  }

  function startOver() {
    setDraft(null)
    setCandidates([])
    setAlbum(null)
    setError(null)
    setView('home')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">&#127911;</span>
          <h1>Waxbox</h1>
        </div>
        <p className="slogan">Tu música, tu historia.</p>
        {view !== 'settings' && (
          <button className="settings-link" onClick={() => setView('settings')}>
            Configuración
          </button>
        )}
      </header>

      <main className="app-main">
        {loading && (
          <div className="loading">
            <span className="spinner" />
            <p>{loading}</p>
          </div>
        )}

        {!loading && error && (
          <div className="error-box">
            <p className="error-message">{error}</p>
            <button className="btn btn-ghost" onClick={() => setError(null)}>
              Entendido
            </button>
          </div>
        )}

        {!loading && !error && view === 'home' && (
          <div className="home">
            <div className="stats-card">
              <span className="stat-number">0</span>
              <span className="stat-label">discos en tu colección</span>
            </div>
            <p className="empty-note">
              Tu colección está vacía. Agrega tu primer disco, casete o CD para empezar.
            </p>
            <button className="btn btn-primary" onClick={() => setView('add')}>
              + Agregar disco
            </button>

            {!settings.youtubeConfigured && (
              <p className="optional-note">
                Opcional: si quieres además escuchar las canciones de tus discos, puedes
                configurar una clave gratuita de YouTube cuando quieras desde{' '}
                <button className="btn-link" onClick={() => setView('settings')}>
                  Configuración
                </button>
                . No hace falta para empezar a usar Waxbox.
              </p>
            )}
          </div>
        )}

        {!loading && !error && view === 'settings' && (
          <SettingsScreen
            status={settings}
            onStatusChange={setSettings}
            onBack={() => setView('home')}
          />
        )}

        {!loading && !error && view === 'add' && (
          <AddAlbumForm
            initial={draft}
            onSubmit={handleSearch}
            onCancel={() => setView('home')}
          />
        )}

        {!loading && !error && view === 'results' && (
          <ReleasePicker
            candidates={candidates}
            onPick={handlePick}
            onBack={() => setView('add')}
          />
        )}

        {!loading && !error && view === 'details' && album && (
          <AlbumReview
            album={album}
            onChange={setAlbum}
            youtubeConfigured={settings.youtubeConfigured}
            onOpenSettings={() => setView('settings')}
            onBack={() => setView('results')}
            onStartOver={startOver}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Waxbox v1.0.0 — Open Source</p>
      </footer>
    </div>
  )
}

export default App
