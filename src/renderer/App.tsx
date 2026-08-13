import { useEffect, useState } from 'react'
import type { ReleaseCandidate, ArtistAlbum, ArtistBrowseResult } from '@core/services/musicbrainz'
import type { AlbumSheet } from '@core/services/albumSheet'
import type { SettingsStatus } from '@core/models/settings'
import type { AlbumSummary, SavedAlbum, CollectionSummary } from '@core/database/db'
import { APP_VERSION } from '@core/config'
import { normalizeFeatures, type FeatureFlags } from '@core/models/features'
import type { EditableAlbum } from '@core/albumDraft'
import { draftFromSheet, emptyManualDraft } from '@core/albumDraft'
import AddAlbumForm, { type AlbumDraft } from './components/AddAlbumForm'
import ReleasePicker from './components/ReleasePicker'
import NoResultsScreen from './components/NoResultsScreen'
import ManualAlbumForm from './components/ManualAlbumForm'
import ArtistAlbumPicker from './components/ArtistAlbumPicker'
import AlbumReview from './components/AlbumReview'
import CollectionScreen from './components/CollectionScreen'
import SettingsScreen from './components/SettingsScreen'
import AboutScreen from './components/AboutScreen'
import SetlistsScreen from './components/SetlistsScreen'
import CollectionBar from './components/CollectionBar'
import ProfilePicker from './components/ProfilePicker'
import type { Profile } from '@core/models/profile'
import ExploreScreen from './components/ExploreScreen'
import WishlistScreen from './components/WishlistScreen'
import HomeScreen from './components/HomeScreen'
import { Isotipo, LogoCompleto } from './components/Logo'
import { PlayerProvider } from './player/PlayerProvider'
import PlayerBar from './player/PlayerBar'

type View =
  | 'home'
  | 'add'
  | 'artist-albums'
  | 'results'
  /** MusicBrainz no encontró nada: se ofrece reintentar o cargar a mano. */
  | 'no-results'
  /** Formulario de carga manual, sin ninguna fuente automática. */
  | 'manual'
  | 'details'
  | 'settings'
  | 'about'
  | 'saved'
  | 'collection'
  | 'setlists'
  | 'explore'
  | 'wishlist'

export type ThemePreference = 'auto' | 'dark' | 'light'

/*
  Las preferencias se guardan por perfil: las funciones encendidas y la última
  colección usada llevan el id del perfil en la clave.

  El tema es la excepción a propósito y sigue siendo de la instalación: el
  script de index.html lo aplica antes de que arranque React, cuando todavía no
  se sabe qué perfil se va a elegir. Hacerlo por perfil provocaría un parpadeo
  de claro a oscuro en cada cambio.
*/
function featuresKey(profileId: string): string {
  return `waxbox-features-${profileId}`
}

function activeCollectionKey(profileId: string): string {
  return `waxbox-active-collection-${profileId}`
}

/** Lee las funciones encendidas. Ante cualquier problema, todo queda encendido. */
function loadFeatures(profileId: string): FeatureFlags {
  try {
    const raw = localStorage.getItem(featuresKey(profileId))
    return normalizeFeatures(raw ? JSON.parse(raw) : null)
  } catch {
    return normalizeFeatures(null)
  }
}

/**
 * Cuánto se sostiene como mínimo la pantalla de carga, en milisegundos.
 *
 * Suficiente para que el disco alcance a dar algo de vuelta y se lea el nombre,
 * y lo bastante corto como para que nadie sienta que la app tarda en abrir.
 */
const SPLASH_MINIMO_MS = 1600

/** Espera lo que falte para completar el mínimo. Si ya pasó, no espera nada. */
function holdSplash(startedAt: number): Promise<void> {
  const restante = SPLASH_MINIMO_MS - (Date.now() - startedAt)
  if (restante <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, restante))
}

function applyTheme(pref: ThemePreference): void {
  if (pref === 'auto') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  } else {
    document.documentElement.dataset.theme = pref
  }
}

function App() {
  const [view, setView] = useState<View>('home')
  const [settings, setSettings] = useState<SettingsStatus>({
    youtubeConfigured: false,
    youtubeKeyEncrypted: true
  })
  const [theme, setTheme] = useState<ThemePreference>(
    () => (localStorage.getItem('waxbox-theme') as ThemePreference) || 'auto'
  )
  const [features, setFeatures] = useState<FeatureFlags>(() => normalizeFeatures(null))
  const [draft, setDraft] = useState<AlbumDraft | null>(null)
  const [candidates, setCandidates] = useState<ReleaseCandidate[]>([])
  const [artistBrowse, setArtistBrowse] = useState<ArtistBrowseResult | null>(null)
  const [album, setAlbum] = useState<EditableAlbum | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Explicación de qué fue lo que MusicBrainz no encontró. */
  const [noResultsMessage, setNoResultsMessage] = useState('')

  const [collection, setCollection] = useState<AlbumSummary[]>([])
  const [savedAlbum, setSavedAlbum] = useState<SavedAlbum | null>(null)

  /**
   * Colecciones del perfil y cuál está activa.
   *
   * `activeCollectionId` es null solo durante el arranque, antes de saber qué
   * colecciones hay. Todo lo que consulta la base espera a tenerlo.
   */
  const [collections, setCollections] = useState<CollectionSummary[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null)

  /**
   * Perfiles. Mientras `activeProfile` sea null se muestra el selector y no se
   * consulta nada de la base: en el proceso principal todavía no hay ninguna
   * abierta.
   */
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [starting, setStarting] = useState(true)

  /** Setlist al que se le están sumando canciones desde el modo explorar. */
  const [exploreTarget, setExploreTarget] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    startUp()
  }, [])

  /**
   * Arranque: se busca qué perfiles hay.
   *
   * Con uno solo se entra directo, para no molestar con un selector a quien usa
   * la app en solitario. Con varios, se muestra el selector.
   *
   * La pantalla de carga se sostiene un mínimo de tiempo aunque todo esté listo
   * antes. Abrir una base local es tan rápido que el logo alcanzaba a
   * parpadear: en vez de sentirse veloz, se veía como un defecto. El tiempo
   * mínimo NO retrasa nada — el trabajo real ocurre mientras tanto, y solo se
   * espera lo que falte para completarlo.
   */
  async function startUp(): Promise<void> {
    const startedAt = Date.now()

    const result = await window.api.listProfiles()

    if (!result.ok) {
      setError(result.error)
      await holdSplash(startedAt)
      setStarting(false)
      return
    }

    setProfiles(result.data.profiles)

    if (result.data.profiles.length === 1) {
      await activateProfile(result.data.profiles[0])
    }

    await holdSplash(startedAt)
    setStarting(false)
  }

  async function activateProfile(profile: Profile): Promise<void> {
    setError(null)
    const result = await window.api.activateProfile(profile.id)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setActiveProfile(profile)
    // Los ajustes y las preferencias son de cada perfil.
    window.api.getSettingsStatus().then(setSettings)
    setFeatures(loadFeatures(profile.id))
    await loadCollections(profile.id)
  }

  /** Volver al selector guardando lo del perfil abierto. */
  async function handleSignOut(): Promise<void> {
    await window.api.signOutProfile()

    setActiveProfile(null)
    setCollections([])
    setActiveCollectionId(null)
    setCollection([])
    setSavedAlbum(null)
    setDraft(null)
    setCandidates([])
    setArtistBrowse(null)
    setAlbum(null)
    setExploreTarget(null)
    setError(null)
    setView('home')

    const result = await window.api.listProfiles()
    if (result.ok) setProfiles(result.data.profiles)
  }

  // Al cambiar de colección se recarga lo que se muestra y se recuerda la elección.
  useEffect(() => {
    if (activeCollectionId === null || !activeProfile) return
    localStorage.setItem(activeCollectionKey(activeProfile.id), String(activeCollectionId))
    refreshCollection(activeCollectionId)
  }, [activeCollectionId, activeProfile])

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('waxbox-theme', theme)

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (): void => applyTheme('auto')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  useEffect(() => {
    if (!activeProfile) return
    localStorage.setItem(featuresKey(activeProfile.id), JSON.stringify(features))
  }, [features, activeProfile])

  // Si se apagan los setlists estando en una de sus pantallas, no dejarla en blanco.
  useEffect(() => {
    if (!features.setlists && (view === 'setlists' || view === 'explore')) {
      setView('home')
    }
  }, [features.setlists, view])

  /**
   * Trae las colecciones y decide cuál queda activa.
   *
   * Recibe el id del perfil porque al recién activarlo el estado de React
   * todavía no se actualizó y `activeProfile` seguiría siendo el anterior.
   */
  async function loadCollections(profileId?: string): Promise<void> {
    const result = await window.api.listCollections()
    if (!result.ok) {
      setError(result.error)
      return
    }

    setCollections(result.data)
    if (result.data.length === 0) return

    // Se recuerda la última usada; si ya no existe, se cae a la primera.
    const key = profileId ?? activeProfile?.id
    const stored = key ? localStorage.getItem(activeCollectionKey(key)) : null
    const remembered = Number.parseInt(stored ?? '', 10)
    const stillExists = result.data.some((item) => item.id === remembered)
    setActiveCollectionId(stillExists ? remembered : result.data[0].id)
  }

  async function refreshCollection(
    collectionId: number | null = activeCollectionId
  ): Promise<void> {
    if (collectionId === null) return
    const result = await window.api.listAlbums(collectionId)
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
      showNoResults(
        `MusicBrainz no tiene "${newDraft.title}" de ${newDraft.artist}.`
      )
      return
    }

    setCandidates(result.data)
    setView('results')
  }

  /**
   * Lleva a la bifurcación de "no lo encontramos".
   *
   * Antes esto era un mensaje de error con un botón "Entendido" y ahí terminaba
   * todo: quien tuviera un disco que no está en el catálogo no podía agregarlo.
   * Ahora es una pantalla con salida, incluida la de cargarlo a mano.
   */
  function showNoResults(message: string) {
    setNoResultsMessage(message)
    setView('no-results')
  }

  /** Empieza la carga manual con lo poco que ya se escribió en el buscador. */
  function startManualAlbum() {
    if (!draft) return
    setAlbum(emptyManualDraft(draft.format, draft.artist, draft.title))
    setView('manual')
  }

  async function handleBrowseArtist(partialDraft: AlbumDraft) {
    setDraft(partialDraft)
    setError(null)
    setLoading(`Buscando la discografía de ${partialDraft.artist}...`)

    const result = await window.api.browseArtistAlbums(partialDraft.artist)
    setLoading(null)

    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.data.albums.length === 0) {
      showNoResults(`MusicBrainz no tiene ningún título de ${partialDraft.artist}.`)
      return
    }

    setArtistBrowse(result.data)
    setView('artist-albums')
  }

  async function handlePickArtistAlbum(album: ArtistAlbum) {
    if (!draft) return
    const updatedDraft = { ...draft, title: album.title }
    setDraft(updatedDraft)
    setError(null)
    setLoading(`Buscando ediciones de ${album.title}...`)

    const result = await window.api.searchReleases(draft.artist, album.title)
    setLoading(null)

    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.data.length === 0) {
      showNoResults(`MusicBrainz no tiene ninguna edición de "${album.title}".`)
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
    if (!album || activeCollectionId === null) return
    setError(null)
    setLoading('Guardando en tu colección...')

    const photoPaths = {
      front: draft?.coverFront ? (draft.coverFront as unknown as { path: string }).path : null,
      back: draft?.coverBack ? (draft.coverBack as unknown as { path: string }).path : null
    }

    const result = await window.api.saveAlbum(album, photoPaths, activeCollectionId)
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

  async function handleUpdateSaved(updatedAlbum: EditableAlbum) {
    if (!savedAlbum) return
    setError(null)
    setLoading('Guardando cambios...')

    const result = await window.api.updateAlbum(savedAlbum.id, updatedAlbum)
    setLoading(null)

    if (!result.ok) {
      setError(result.error)
      return
    }

    const reloaded = await window.api.getAlbum(savedAlbum.id)
    if (reloaded.ok && reloaded.data) setSavedAlbum(reloaded.data)
    await refreshCollection()
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

  /** Cambiar de colección vuelve al inicio: lo que se estaba viendo era de otra. */
  function handleSwitchCollection(collectionId: number) {
    setActiveCollectionId(collectionId)
    setSavedAlbum(null)
    setDraft(null)
    setCandidates([])
    setArtistBrowse(null)
    setAlbum(null)
    setExploreTarget(null)
    setError(null)
    setView('home')
  }

  /** Recarga la lista tras crear, renombrar o borrar una colección. */
  async function handleCollectionsChanged(activeIdHint?: number): Promise<void> {
    const result = await window.api.listCollections()
    if (!result.ok) {
      setError(result.error)
      return
    }

    setCollections(result.data)

    if (activeIdHint !== undefined) {
      handleSwitchCollection(activeIdHint)
      return
    }

    // Si borraron la que estaba activa, hay que caer a otra.
    const stillExists = result.data.some((item) => item.id === activeCollectionId)
    if (!stillExists && result.data.length > 0) {
      handleSwitchCollection(result.data[0].id)
    } else {
      refreshCollection()
    }
  }

  function startOver() {
    setDraft(null)
    setCandidates([])
    setArtistBrowse(null)
    setAlbum(null)
    setError(null)
    setNoResultsMessage('')
    setView('home')
  }

  const hasAlbums = collection.length > 0

  /**
   * Géneros que ya existen en la colección.
   *
   * Se le ofrecen a la carga manual para que se reusen tal cual: escritos igual,
   * el disco nuevo cae en el mismo filtro de género y en el mismo setlist
   * automático que los que ya estaban.
   */
  const knownGenres = [...new Set(collection.flatMap((item) => item.genres))].sort((a, b) =>
    a.localeCompare(b)
  )

  /** Etiquetas que ya existen, para reusarlas escritas exactamente igual. */
  const knownTags = [...new Set(collection.flatMap((item) => item.tags))].sort((a, b) =>
    a.localeCompare(b)
  )

  return (
    /*
      El reproductor envuelve la app entera y nunca se desmonta: por eso la
      música sigue sonando al cambiar de pantalla. Va aquí y no dentro de una
      vista concreta justamente para eso.
    */
    <PlayerProvider youtubeConfigured={settings.youtubeConfigured}>
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">
            <Isotipo size={30} />
          </span>
          <h1>Waxbox</h1>
        </div>
        <p className="slogan">Tu música, tu historia.</p>
        <nav className="header-nav">
          {activeProfile && (
            <button
              className="settings-link profile-chip"
              onClick={handleSignOut}
              title="Cambiar de perfil"
            >
              <span aria-hidden="true">{activeProfile.emoji}</span> {activeProfile.name}
            </button>
          )}
          {activeProfile && view !== 'settings' && (
            <button className="settings-link" onClick={() => setView('settings')}>
              Configuración
            </button>
          )}
        </nav>

        {activeProfile && activeCollectionId !== null && collections.length > 0 && (
          <CollectionBar
            collections={collections}
            activeId={activeCollectionId}
            onSwitch={handleSwitchCollection}
            onChanged={handleCollectionsChanged}
          />
        )}
      </header>

      <main className="app-main">
        {/*
          Pantalla de carga del arranque. Es el único lugar donde aparece el
          logo completo: en el resto de la app va solo el isotipo, para no
          repetir la marca en cada pantalla.
        */}
        {starting && (
          <div className="splash">
            <LogoCompleto />
            <span className="spinner" />
          </div>
        )}

        {/* Sin perfil abierto no se consulta nada: en el proceso principal
            todavía no hay ninguna base de datos abierta. */}
        {!starting && !activeProfile && (
          <ProfilePicker
            profiles={profiles}
            onPick={(profileId) => {
              const profile = profiles.find((item) => item.id === profileId)
              if (profile) activateProfile(profile)
            }}
            onChanged={async () => {
              const result = await window.api.listProfiles()
              if (result.ok) setProfiles(result.data.profiles)
            }}
          />
        )}

        {!starting && activeProfile && (
          <>
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

        {!loading && !error && view === 'home' && hasAlbums && activeCollectionId !== null && (
          <HomeScreen
            collectionId={activeCollectionId}
            collectionName={
              collections.find((c) => c.id === activeCollectionId)?.name ?? 'Mi colección'
            }
            onOpenAlbum={handleOpenSaved}
            onOpenCollection={() => setView('collection')}
            onOpenSetlists={
              features.setlists
                ? () => {
                    setExploreTarget(null)
                    setView('setlists')
                  }
                : undefined
            }
            onOpenWishlist={() => setView('wishlist')}
            onAdd={() => setView('add')}
          />
        )}

        {!loading && !error && view === 'collection' && activeCollectionId !== null && (
          <CollectionScreen
            albums={collection}
            collectionId={activeCollectionId}
            onOpen={handleOpenSaved}
            onAdd={() => setView('add')}
            onBack={() => setView('home')}
            onOpenSetlists={
              features.setlists
                ? () => {
                    setExploreTarget(null)
                    setView('setlists')
                  }
                : undefined
            }
            onOpenWishlist={() => setView('wishlist')}
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
            features={features}
            albumId={savedAlbum.id}
            collectionId={activeCollectionId ?? 0}
            onDelete={handleDeleteSaved}
            onUpdate={handleUpdateSaved}
            onReload={() => handleOpenSaved(savedAlbum.id)}
            knownTags={knownTags}
            onOpenAlbum={handleOpenSaved}
          />
        )}

        {!loading && !error && view === 'setlists' && features.setlists && activeCollectionId !== null && (
          <SetlistsScreen
            albums={collection}
            collectionId={activeCollectionId}
            onBack={() => setView('home')}
            onExplore={(setlist) => {
              setExploreTarget(setlist)
              setView('explore')
            }}
            initialSetlistId={exploreTarget?.id ?? null}
          />
        )}

        {!loading && !error && view === 'explore' && features.setlists && activeCollectionId !== null && (
          <ExploreScreen
            albums={collection}
            collectionId={activeCollectionId}
            target={exploreTarget}
            onBack={() => setView('setlists')}
          />
        )}

        {!loading && !error && view === 'wishlist' && activeCollectionId !== null && (
          <WishlistScreen
            collectionId={activeCollectionId}
            onBack={() => setView('home')}
          />
        )}

        {!loading && !error && view === 'settings' && (
          <SettingsScreen
            status={settings}
            onStatusChange={setSettings}
            theme={theme}
            onThemeChange={setTheme}
            features={features}
            onFeaturesChange={setFeatures}
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
            onBrowseArtist={handleBrowseArtist}
            onCancel={() => setView('home')}
          />
        )}

        {!loading && !error && view === 'artist-albums' && artistBrowse && (
          <ArtistAlbumPicker
            artistName={artistBrowse.artistName}
            albums={artistBrowse.albums}
            onPick={handlePickArtistAlbum}
            onBack={() => setView('add')}
          />
        )}

        {!loading && !error && view === 'results' && (
          <ReleasePicker
            candidates={candidates}
            onPick={handlePick}
            onBack={() => setView(artistBrowse ? 'artist-albums' : 'add')}
          />
        )}

        {!loading && !error && view === 'no-results' && draft && (
          <NoResultsScreen
            artist={draft.artist}
            title={draft.title}
            message={noResultsMessage}
            onRetry={() => setView('add')}
            onManual={startManualAlbum}
            onCancel={startOver}
          />
        )}

        {!loading && !error && view === 'manual' && album && draft && activeCollectionId !== null && (
          <ManualAlbumForm
            initial={album}
            knownGenres={knownGenres}
            collectionId={activeCollectionId}
            features={features}
            coverFront={draft.coverFront}
            coverBack={draft.coverBack}
            onPhotosChange={(front, back) =>
              setDraft({ ...draft, coverFront: front, coverBack: back })
            }
            onContinue={(manualAlbum) => {
              setAlbum(manualAlbum)
              setView('details')
            }}
            onCancel={startOver}
          />
        )}

        {!loading && !error && view === 'details' && album && (
          <AlbumReview
            album={album}
            onChange={setAlbum}
            youtubeConfigured={settings.youtubeConfigured}
            onOpenSettings={() => setView('settings')}
            onBack={() => setView(album.source === 'manual' ? 'manual' : 'results')}
            backLabel={
              album.source === 'manual' ? 'Volver a los datos' : 'Elegir otra edición'
            }
            onStartOver={startOver}
            features={features}
            knownTags={knownTags}
            onSave={handleSave}
          />
        )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <button className="footer-link" onClick={() => setView('about')}>
          Waxbox v{APP_VERSION} — una iniciativa de Proyecto La Lancha
        </button>
      </footer>

      {/* Solo aparece cuando hay algo cargado; si no, se esconde sola. */}
      {features.playback && <PlayerBar />}
    </div>
    </PlayerProvider>
  )
}

export default App
