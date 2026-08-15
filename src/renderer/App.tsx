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
import type { SmartList } from '@core/models/smartList'
import ExploreScreen from './components/ExploreScreen'
import WishlistScreen from './components/WishlistScreen'
import HomeScreen from './components/HomeScreen'
import LoansScreen from './components/LoansScreen'
import Sidebar, { type Section } from './components/Sidebar'
import CommandPalette from './components/CommandPalette'
import { LogoCompleto } from './components/Logo'
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
  | 'loans'

/**
 * Las cinco secciones del menú.
 *
 * Se separan del resto de las vistas porque se navegan distinto: entrar a una
 * sección REEMPLAZA dónde estás, mientras que abrir la ficha de un disco se
 * APILA encima para poder volver. Antes todo era la misma cosa y por eso no
 * había manera de volver a ningún sitio.
 */
const SECTIONS: readonly View[] = ['home', 'collection', 'setlists', 'wishlist', 'loans']

function isSection(view: View): view is Section {
  return (SECTIONS as readonly string[]).includes(view)
}

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

  /**
   * De dónde se vino, para poder volver.
   *
   * Solo se apila al entrar a una sub-página o a una tarea; cambiar de
   * sección la vacía. Así "volver" desde la ficha de un disco lleva a la
   * pantalla real de la que se salió —la colección, el inicio o la búsqueda—
   * en vez de a un sitio fijo.
   */
  const [backStack, setBackStack] = useState<View[]>([])

  /** Contadores de los badges del menú. */
  const [counts, setCounts] = useState({ wishlist: 0, loans: 0 })

  const [paletteOpen, setPaletteOpen] = useState(false)

  /**
   * La lista inteligente que se está viendo, entera y no solo sus condiciones.
   *
   * Hace falta el objeto completo —con su id y su nombre— para poder
   * renombrarla, cambiar qué incluye o borrarla desde la propia colección.
   * Con solo los criterios no habría forma de saber a cuál se le aplican los
   * cambios.
   *
   * Se limpia al entrar a Colección por el menú: quien pulsa «Colección»
   * espera verla entera, no la última lista que abrió hace media hora.
   */
  const [listaAbierta, setListaAbierta] = useState<SmartList | null>(null)


  useEffect(() => {
    startUp()
  }, [])

  /**
   * Ir a una sección del menú: reemplaza, no apila.
   *
   * Vaciar la pila es deliberado — desde una sección no se "vuelve" a la
   * anterior, se cambia de sitio, igual que en el menú de cualquier app.
   */
  function goToSection(next: Section): void {
    setError(null)
    setBackStack([])
    setView(next)
  }

  /*
    Entrar a Colección desde el MENÚ limpia la lista abierta. Quien pulsa
    "Colección" espera verla entera; si conservara los filtros de la última
    lista que abrió, parecería que le faltan discos.

    No se limpia al entrar desde una lista porque ahí el filtro es justamente
    lo que se pidió: por eso la limpieza va aquí y no dentro de goToSection.
  */
  function irAColeccionCompleta(): void {
    setListaAbierta(null)
    goToSection('collection')
  }

  /** Abrir algo encima de lo que hay: la ficha de un disco, una tarea, ajustes. */
  function pushView(next: View): void {
    setError(null)
    setBackStack((stack) => [...stack, view])
    setView(next)
  }

  /** Volver a lo anterior. Sin nada apilado, al inicio. */
  function goBack(): void {
    setError(null)
    setBackStack((stack) => {
      const previous = stack[stack.length - 1]
      setView(previous ?? 'home')
      return stack.slice(0, -1)
    })
  }

  /* Ctrl+K abre la búsqueda desde cualquier pantalla. Antes solo funcionaba
     dentro de la colección, que es justo donde menos falta hacía. */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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

  useEffect(() => {
    if (!features.setlists && (view === 'setlists' || view === 'explore')) {
      setView('home')
    }
    if (!features.wishlist && view === 'wishlist') {
      setView('home')
    }
    if (!features.loans && view === 'loans') {
      setView('home')
    }
  }, [features.setlists, features.wishlist, features.loans, view])

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
    await refreshCounts(collectionId)
  }

  /**
   * Los números de los badges del menú.
   *
   * Viven en App y no en cada pantalla porque el menú está siempre visible:
   * si los cargara la pantalla de deseos, el contador solo sería correcto
   * mientras estuvieras justo ahí.
   */
  async function refreshCounts(
    collectionId: number | null = activeCollectionId
  ): Promise<void> {
    if (collectionId === null) return
    const [wishlist, loans] = await Promise.all([
      window.api.wishlistCount(collectionId),
      window.api.activeLoans(collectionId)
    ])
    setCounts({
      wishlist: wishlist.ok ? wishlist.data : 0,
      loans: loans.ok ? loans.data.length : 0
    })
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

  /** Carga manual directa desde el primer paso, sin pasar por la búsqueda. */
  function handleDirectManual(newDraft: AlbumDraft) {
    setDraft(newDraft)
    setAlbum(emptyManualDraft(newDraft.format, newDraft.artist, newDraft.title))
    setView('manual')
  }

  /**
   * Conseguiste un disco que estaba en la lista de deseos.
   *
   * Arranca la tarea de agregar con lo que ya habías anotado, así que el paso 1
   * llega escrito. El deseo NO se borra solo: todavía no hay ningún disco
   * guardado —la búsqueda puede no dar nada, o puedes arrepentirte a mitad— y
   * borrar por adelantado sería perder lo anotado a cambio de nada.
   */
  function startFromWish(item: { artists: string; title: string; format: string | null }) {
    setDraft({
      artist: item.artists,
      title: item.title,
      /* El deseo puede no tener formato ("cualquiera"): ahí se cae al mismo
         formato con el que arranca el buscador cuando no se dice nada. */
      format: (item.format ?? 'vinilo') as AlbumDraft['format'],
      coverFront: null,
      coverBack: null
    })
    pushView('add')
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
    pushView('saved')
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
    /* El disco que se estaba viendo ya no existe, así que volver a la ficha
       no es una opción: se sale a la colección, que es de donde se llega. */
    goToSection('collection')
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
    goToSection('home')
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
    goToSection('home')
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
    {/*
      Tres estados de la app, y solo uno se dibuja a la vez.

      El arranque y el selector de perfil van a pantalla completa SIN el menú
      lateral: todavía no hay ninguna base de datos abierta, así que un menú
      ahí no llevaría a ningún sitio.
    */}
    {starting ? (
      <div className="app app-bare">
        <div className="splash">
          <LogoCompleto />
          <span className="spinner" />
        </div>
      </div>
    ) : !activeProfile ? (
      <div className="app app-bare">
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
      </div>
    ) : (
    <div className="app">
      {activeCollectionId !== null && collections.length > 0 && (
        <Sidebar
          profile={activeProfile}
          onSignOut={handleSignOut}
          collections={collections}
          activeCollectionId={activeCollectionId}
          onSwitchCollection={handleSwitchCollection}
          onCollectionsChanged={handleCollectionsChanged}
          section={isSection(view) ? view : null}
          onNavigate={(seccion) => (seccion === 'collection' ? irAColeccionCompleta() : goToSection(seccion))}
          counts={{
            albums: collection.length,
            setlists:
              collections.find((item) => item.id === activeCollectionId)?.setlistCount ?? 0,
            wishlist: counts.wishlist,
            loans: counts.loans
          }}
          features={features}
          onAdd={() => pushView('add')}
          onOpenSettings={() => pushView('settings')}
          onOpenSearch={() => setPaletteOpen(true)}
          settingsActive={view === 'settings' || view === 'about'}
        />
      )}

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
          <div className="screen empty-first-run">
            <h2 className="page-title">Tu colección está vacía</h2>
            <p className="empty-state-help">
              Agrega tu primer disco, casete o CD para empezar. Waxbox completa el año, el
              sello y el tracklist por ti.
            </p>
            <button className="btn btn-primary" onClick={() => pushView('add')}>
              Agregar disco
            </button>

            {!settings.youtubeConfigured && (
              <p className="optional-note">
                Opcional: si quieres además ver el video de las canciones, puedes configurar
                una clave gratuita de YouTube cuando quieras desde{' '}
                <button className="btn-link" onClick={() => pushView('settings')}>
                  Configuración
                </button>
                . No hace falta para empezar.
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
            onOpenLoans={() => goToSection('loans')}
            onOpenLista={(lista) => {
              setListaAbierta(lista)
              goToSection('collection')
            }}
            onAdd={() => pushView('add')}
          />
        )}

        {!loading && !error && view === 'collection' && activeCollectionId !== null && (
          <CollectionScreen
            albums={collection}
            collectionId={activeCollectionId}
            onOpen={handleOpenSaved}
            onAdd={() => pushView('add')}
            openList={listaAbierta}
            onListClosed={() => setListaAbierta(null)}
            features={features}
          />
        )}

        {!loading && !error && view === 'loans' && features.loans && activeCollectionId !== null && (
          <LoansScreen
            collectionId={activeCollectionId}
            onOpenAlbum={handleOpenSaved}
            onChanged={() => refreshCounts()}
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
            onOpenSettings={() => pushView('settings')}
            onBack={goBack}
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
            onExplore={(setlist) => {
              setExploreTarget(setlist)
              pushView('explore')
            }}
            initialSetlistId={exploreTarget?.id ?? null}
            playbackEnabled={features.playback}
          />
        )}

        {!loading && !error && view === 'explore' && features.setlists && activeCollectionId !== null && (
          <ExploreScreen
            albums={collection}
            collectionId={activeCollectionId}
            target={exploreTarget}
            onBack={goBack}
          />
        )}

        {!loading && !error && view === 'wishlist' && features.wishlist && activeCollectionId !== null && (
          <WishlistScreen
            collectionId={activeCollectionId}
            onChanged={() => refreshCounts()}
            onGotIt={startFromWish}
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
            onOpenAbout={() => pushView('about')}
            onBack={goBack}
          />
        )}

        {!loading && !error && view === 'about' && <AboutScreen onBack={goBack} />}

        {!loading && !error && view === 'add' && (
          <AddAlbumForm
            initial={draft}
            onSubmit={handleSearch}
            onBrowseArtist={handleBrowseArtist}
            onManual={handleDirectManual}
            onCancel={goBack}
          />
        )}

        {!loading && !error && view === 'artist-albums' && artistBrowse && (
          <ArtistAlbumPicker
            artistName={artistBrowse.artistName}
            albums={artistBrowse.albums}
            onPick={handlePickArtistAlbum}
            onBack={() => setView('add')}
            onCancel={startOver}
          />
        )}

        {!loading && !error && view === 'results' && (
          <ReleasePicker
            candidates={candidates}
            onPick={handlePick}
            onBack={() => setView(artistBrowse ? 'artist-albums' : 'add')}
            onCancel={startOver}
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
            onOpenSettings={() => pushView('settings')}
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
      </main>

      {/* Solo aparece cuando hay algo cargado; si no, se esconde sola. */}
      {features.playback && <PlayerBar />}

      {/*
        Ctrl+K. Busca discos Y secciones en la misma lista: quien escribe
        "exportar" no tiene por qué saber si eso es una pantalla o un botón.
      */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        albums={collection}
        onOpenAlbum={handleOpenSaved}
        actions={[
          { label: 'Inicio', hint: 'Sección', run: () => goToSection('home') },
          { label: 'Colección', hint: 'Sección', run: irAColeccionCompleta },
          ...(features.setlists
            ? [{ label: 'Setlists', hint: 'Sección', run: () => goToSection('setlists') }]
            : []),
          { label: 'Lista de deseos', hint: 'Sección', run: () => goToSection('wishlist') },
          { label: 'Préstamos', hint: 'Sección', run: () => goToSection('loans') },
          { label: 'Agregar disco', hint: 'Acción', run: () => pushView('add') },
          { label: 'Exportar la colección', hint: 'Acción', run: irAColeccionCompleta },
          { label: 'Configuración', hint: 'Ajustes', run: () => pushView('settings') },
          {
            label: `Acerca de Waxbox v${APP_VERSION}`,
            hint: 'Ajustes',
            run: () => pushView('about')
          }
        ]}
      />
    </div>
    )}
    </PlayerProvider>
  )
}

export default App
