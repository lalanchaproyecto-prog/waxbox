import { useEffect, useState } from 'react'
import type { ReleaseCandidate } from '@core/services/musicbrainz'
import type { AlbumSheet } from '@core/services/albumSheet'
import type { SettingsStatus } from '@core/models/settings'
import type { AlbumSummary, SavedAlbum } from '@core/database/db'
import { APP_VERSION } from '@core/config'
import type { EditableAlbum } from '@core/albumDraft'
import { draftFromSheet } from '@core/albumDraft'
import AddAlbumForm, { type AlbumDraft } from './components/AddAlbumForm'
import ReleasePicker from './components/ReleasePicker'
import AlbumReview from './components/AlbumReview'
import CollectionScreen from './components/CollectionScreen'
import SettingsScreen from './components/SettingsScreen'
import AboutScreen from './components/AboutScreen'

type View = 'home' | 'add' | 'results' | 'details' | 'settings' | 'about' | 'saved'

function App() {
  const [view, setView] = useState<View>('home')
  const [settings, setSettings] = useState<SettingsStatus>({
    youtubeConfigured: false,
    youtubeKeyEncrypted: true
  })
  const [draft, setDraft] = useState<AlbumDraft | null>(null)
  const [candidates, setCandidates] = useState<ReleaseCandidate[]>([])
  const [album, setAlbum] = useState<EditableAlbum | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [collection, setCollection] = useState<AlbumSummary[]>([])
  const [savedAlbum, setSavedAlbum] = useState<SavedAlbum | null>(null)

  useEffect(() => {
    window.api.getSettingsStatus().then(setSettings)
    refreshCollection()
  }, [])

  async function refreshCollection(): Promise<void> {
    const result = await window.api.listAlbums()
    if (result.ok) setCollection(result.data)
  }

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

    setAlbum(draftFromSheet(result.data, draft.format))
    setView('details')
  }

  async function handleSave() {
    if (!album) return
    setError(null)
    setLoading('Guardando en tu colección...')

    const photoPaths = {
      front: draft?.coverFront ? (draft.coverFront as unknown as { path: string }).path : null,
      back: draft?.coverBack ? (draft.coverBack as unknown as { path: string }).path : null
    }

    const result = await window.api.saveAlbum(album, photoPaths)
    setLoading(null)

    if (!result.ok) {
      setError(result.error)
      return
    }

    await refreshCollection()
    startOver()
  }

  async function handleOpenSaved(albumId: number) {
    setError(null)
    setLoading('Cargando disco...')

    const result = await window.api.getAlbum(albumId)
    setLoading(null)

    if (!result.ok) {
      setError(result.error)
      return
    }
    if (!result.data) {
      setError('No se encontró el disco.')
      return
    }

    setSavedAlbum(result.data)
    setView('saved')
  }

  async function handleDeleteSaved() {
    if (!savedAlbum) return
    setLoading('Borrando...')

    const result = await window.api.deleteAlbum(savedAlbum.id)
    setLoading(null)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setSavedAlbum(null)
    await refreshCollection()
    setView('home')
  }

  function startOver() {
    setDraft(null)
    setCandidates([])
    setAlbum(null)
    setError(null)
    setView('home')
  }

  const hasAlbums = collection.length > 0

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

        {!loading && !error && view === 'home' && !hasAlbums && (
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

        {!loading && !error && view === 'home' && hasAlbums && (
          <CollectionScreen
            albums={collection}
            onOpen={handleOpenSaved}
            onAdd={() => setView('add')}
          />
        )}

        {!loading && !error && view === 'saved' && savedAlbum && (
          <AlbumReview
            album={{
              ...savedAlbum,
              musicbrainzId: savedAlbum.musicbrainzId ?? '',
              userCoverFront: savedAlbum.userCoverFront
                ? `waxbox-photo://${savedAlbum.userCoverFront}`
                : null,
              userCoverBack: savedAlbum.userCoverBack
                ? `waxbox-photo://${savedAlbum.userCoverBack}`
                : null,
              tracks: savedAlbum.tracks.map((t) => ({
                ...t,
                userEditedFields: t.userEditedFields
              }))
            }}
            onChange={() => {}}
            youtubeConfigured={settings.youtubeConfigured}
            onOpenSettings={() => setView('settings')}
            onBack={() => setView('home')}
            onStartOver={startOver}
            savedMode
            onDelete={handleDeleteSaved}
          />
        )}

        {!loading && !error && view === 'settings' && (
          <SettingsScreen
            status={settings}
            onStatusChange={setSettings}
            onOpenAbout={() => setView('about')}
            onBack={() => setView('home')}
          />
        )}

        {!loading && !error && view === 'about' && (
          <AboutScreen onBack={() => setView('settings')} />
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
            onSave={handleSave}
          />
        )}
      </main>

      <footer className="app-footer">
        <button className="footer-link" onClick={() => setView('about')}>
          Waxbox v{APP_VERSION} — un proyecto de Proyecto La Lancha
        </button>
      </footer>
    </div>
  )
}

export default App
