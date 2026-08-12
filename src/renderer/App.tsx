import { useState } from 'react'
import type { ReleaseCandidate, ReleaseDetails } from '@core/services/musicbrainz'
import AddAlbumForm, { type AlbumDraft } from './components/AddAlbumForm'
import ReleasePicker from './components/ReleasePicker'
import AlbumPreview from './components/AlbumPreview'

type View = 'home' | 'add' | 'results' | 'details'

function App() {
  const [view, setView] = useState<View>('home')
  const [draft, setDraft] = useState<AlbumDraft | null>(null)
  const [candidates, setCandidates] = useState<ReleaseCandidate[]>([])
  const [details, setDetails] = useState<ReleaseDetails | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  /** Paso 2: con la edición elegida, traer el tracklist y el resto de los datos. */
  async function handlePick(candidate: ReleaseCandidate) {
    if (!draft) return
    setError(null)
    setLoading('Trayendo el tracklist...')

    const result = await window.api.getReleaseDetails(candidate.musicbrainzId, draft.format)
    setLoading(null)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setDetails(result.data)
    setView('details')
  }

  function startOver() {
    setDraft(null)
    setCandidates([])
    setDetails(null)
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
          </div>
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

        {!loading && !error && view === 'details' && details && draft && (
          <AlbumPreview
            details={details}
            physicalFormatId={draft.format}
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
