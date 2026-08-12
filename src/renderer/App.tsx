import { useState } from 'react'
import { getFormat } from '@core/models/formats'
import AddAlbumForm, { type AlbumDraft } from './components/AddAlbumForm'

type View = 'home' | 'add' | 'captured'

function App() {
  const [view, setView] = useState<View>('home')
  const [draft, setDraft] = useState<AlbumDraft | null>(null)

  // Por ahora solo guardamos lo que la persona escribió y lo mostramos.
  // El siguiente paso será enviar estos datos a MusicBrainz.
  function handleSubmit(newDraft: AlbumDraft) {
    setDraft(newDraft)
    setView('captured')
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
        {view === 'home' && (
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

        {view === 'add' && (
          <AddAlbumForm
            initial={draft}
            onSubmit={handleSubmit}
            onCancel={() => setView('home')}
          />
        )}

        {view === 'captured' && draft && (
          <div className="captured">
            <h2>Datos capturados</h2>
            <dl className="captured-list">
              <dt>Artista</dt>
              <dd>{draft.artist}</dd>
              <dt>Álbum</dt>
              <dd>{draft.title}</dd>
              <dt>Formato</dt>
              <dd>{getFormat(draft.format)?.label ?? draft.format}</dd>
              <dt>Portada</dt>
              <dd>{draft.coverFront?.name ?? 'Sin foto'}</dd>
              <dt>Contraportada</dt>
              <dd>{draft.coverBack?.name ?? 'Sin foto'}</dd>
            </dl>
            <p className="hint">
              Siguiente paso: buscar automáticamente estos datos en MusicBrainz.
            </p>
            <div className="captured-actions">
              <button className="btn btn-ghost" onClick={() => setView('add')}>
                Volver a editar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setDraft(null)
                  setView('home')
                }}
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Waxbox v1.0.0 — Open Source</p>
      </footer>
    </div>
  )
}

export default App
