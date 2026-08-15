/**
 * El reproductor global.
 *
 * DÓNDE VIVE Y POR QUÉ:
 * Este proveedor envuelve la app entera y nunca se desmonta, así que el
 * elemento de audio que crea tampoco. Antes cada canción creaba su propio
 * `new Audio()` dentro de la ficha del disco: al navegar a otra pantalla ese
 * componente se destruía y la música se cortaba sola.
 *
 * POR QUÉ EL TIEMPO NO ESTÁ EN ESTE ESTADO:
 * Una canción avanza unas cuatro veces por segundo. Si el segundero viviera
 * aquí, cada latido redibujaría la app completa — la colección, el tracklist,
 * todo — solo para mover una barrita. Por eso este contexto guarda lo que
 * cambia poco (la cola, qué canción es, si está sonando) y la barra de progreso
 * lee el elemento de audio directamente. Ver `useProgress` en PlayerBar.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  resolveSource,
  nextIndex,
  previousIndex,
  firstPlayableFrom,
  type PlayableTrack,
  type PlaybackSource
} from '@core/player/queue'

interface PlayerState {
  queue: PlayableTrack[]
  /** Índice dentro de la cola. -1 cuando no hay nada cargado. */
  index: number
  playing: boolean
  /** De dónde está sonando lo actual. */
  source: PlaybackSource | null
  /** Video de YouTube en curso, cuando la fuente es YouTube. */
  youtubeVideoId: string | null
  /** Si el panel de video está desplegado. */
  videoOpen: boolean
  /** Mensaje para la persona cuando algo no se pudo reproducir. */
  problem: string | null
  loading: boolean
}

interface PlayerApi extends PlayerState {
  current: PlayableTrack | null
  hasNext: boolean
  hasPrevious: boolean
  play: (queue: PlayableTrack[], startAt?: number) => void
  /** Salta a una posición dentro de la cola actual. */
  jumpTo: (index: number) => void
  toggle: () => void
  next: () => void
  previous: () => void
  stop: () => void
  setVideoOpen: (open: boolean) => void
  audioRef: React.RefObject<HTMLAudioElement | null>
}

const PlayerContext = createContext<PlayerApi | null>(null)

export function usePlayer(): PlayerApi {
  const context = useContext(PlayerContext)
  if (!context) throw new Error('usePlayer se usó fuera de PlayerProvider')
  return context
}

interface PlayerProviderProps {
  /** Si hay clave de YouTube configurada. Sin ella, YouTube no es una fuente. */
  youtubeConfigured: boolean
  children: ReactNode
}

export function PlayerProvider({ youtubeConfigured, children }: PlayerProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [state, setState] = useState<PlayerState>({
    queue: [],
    index: -1,
    playing: false,
    source: null,
    youtubeVideoId: null,
    videoOpen: false,
    problem: null,
    loading: false
  })

  // El elemento de audio se crea una sola vez, en el primer dibujado.
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
  }

  /*
    `next` y el manejador de "se acabó la canción" se llaman entre sí, así que
    la cola actual se guarda también en un ref: los manejadores del elemento de
    audio se registran una sola vez y, sin esto, se quedarían mirando para
    siempre el estado del primer dibujado.
  */
  const stateRef = useRef(state)
  stateRef.current = state

  const recordPlay = useCallback((trackId: number, source: PlaybackSource) => {
    // Que el historial falle no puede frenar la música: se anota y se sigue.
    window.api.recordPlay(trackId, source).catch(() => {})
  }, [])

  /*
    QUÉ CARGA MANDA.

    `load` no termina de una vez: para Deezer pide una dirección nueva al
    servidor, y para YouTube hace una búsqueda. Los dos son viajes a internet
    que tardan.

    Si mientras tanto se pulsa «siguiente» —o se salta a otra canción de la
    cola, que es lo normal cuando algo no engancha— arranca una segunda carga
    sin que la primera haya vuelto. Y al volver, la primera seguía adelante
    como si nada: ponía SU dirección en el reproductor y le daba al play. El
    resultado era que saltabas a la canción 3 y un segundo después empezaba a
    sonar la 2, con la pantalla diciendo que sonaba la 3. El historial de
    escuchas también anotaba la equivocada.

    Cada carga se numera al empezar y comprueba tras cada espera que sigue
    siendo la última. Si no, se retira en silencio sin tocar nada.
  */
  const cargaVigente = useRef(0)

  /** Carga la canción de una posición y la hace sonar. */
  const load = useCallback(
    async (queue: PlayableTrack[], index: number) => {
      const track = queue[index]
      const audio = audioRef.current
      if (!track || !audio) return

      const miCarga = ++cargaVigente.current
      const sigueVigente = (): boolean => miCarga === cargaVigente.current

      audio.pause()

      const resolved = resolveSource(track, youtubeConfigured)
      if (!resolved) {
        setState((s) => ({
          ...s,
          queue,
          index,
          playing: false,
          source: null,
          youtubeVideoId: null,
          problem: `No hay de dónde escuchar "${track.title}".`,
          loading: false
        }))
        return
      }

      setState((s) => ({
        ...s,
        queue,
        index,
        source: resolved.source,
        problem: null,
        loading: true,
        youtubeVideoId: resolved.source === 'youtube' ? s.youtubeVideoId : null
      }))

      if (resolved.source === 'archivo') {
        audio.src = String(resolved.ref)
        try {
          await audio.play()
          if (!sigueVigente()) return
          setState((s) => ({ ...s, playing: true, loading: false }))
          recordPlay(track.trackId, 'archivo')
        } catch {
          if (!sigueVigente()) return
          setState((s) => ({
            ...s,
            playing: false,
            loading: false,
            problem: 'No se pudo reproducir ese archivo.'
          }))
        }
        return
      }

      if (resolved.source === 'deezer') {
        /*
          La dirección del adelanto de Deezer caduca a las pocas horas, así que
          se pide una nueva justo ahora en vez de guardarla.
        */
        const result = await window.api.getPreviewUrl(Number(resolved.ref))
        if (!sigueVigente()) return

        if (!result.ok || !result.data) {
          setState((s) => ({
            ...s,
            playing: false,
            loading: false,
            problem: result.ok
              ? 'Deezer ya no ofrece adelanto de esta canción.'
              : result.error
          }))
          return
        }

        audio.src = result.data
        try {
          await audio.play()
          if (!sigueVigente()) return
          setState((s) => ({ ...s, playing: true, loading: false }))
          recordPlay(track.trackId, 'deezer')
        } catch {
          /*
            `play()` rechaza con AbortError cuando otra carga cambia el `src` o
            llama a `pause()`. Sin esta comprobación, saltar de canción dejaba
            en pantalla el aviso de que no se pudo reproducir la canción que ya
            habías abandonado.
          */
          if (!sigueVigente()) return
          setState((s) => ({
            ...s,
            playing: false,
            loading: false,
            problem: 'No se pudo reproducir el adelanto.'
          }))
        }
        return
      }

      /*
        YouTube. El video se busca ahora y se muestra en el panel desplegable,
        VISIBLE. No se esconde detrás de la portada a propósito: separar el
        audio del video, o taparlo, va contra los términos de YouTube y puede
        costar la clave de la persona.
      */
      const found = await window.api.searchTrackVideo(track.artist, track.title)
      if (!sigueVigente()) return

      if (!found.ok || !found.data) {
        setState((s) => ({
          ...s,
          playing: false,
          loading: false,
          youtubeVideoId: null,
          problem: found.ok
            ? 'YouTube no encontró esta canción.'
            : found.error
        }))
        return
      }

      setState((s) => ({
        ...s,
        youtubeVideoId: found.data!.videoId,
        playing: true,
        loading: false,
        videoOpen: true
      }))
      recordPlay(track.trackId, 'youtube')
    },
    [youtubeConfigured, recordPlay]
  )

  const play = useCallback(
    (queue: PlayableTrack[], startAt = 0) => {
      const start = firstPlayableFrom(queue, startAt, youtubeConfigured)

      if (start === null) {
        setState((s) => ({
          ...s,
          queue,
          index: -1,
          playing: false,
          problem: 'Ninguna de estas canciones se puede escuchar todavía.'
        }))
        return
      }

      load(queue, start)
    },
    [load, youtubeConfigured]
  )

  const next = useCallback(() => {
    const { queue, index } = stateRef.current
    const target = nextIndex(queue, index, youtubeConfigured)
    if (target === null) {
      audioRef.current?.pause()
      setState((s) => ({ ...s, playing: false }))
      return
    }
    load(queue, target)
  }, [load, youtubeConfigured])

  const previous = useCallback(() => {
    const { queue, index } = stateRef.current
    const audio = audioRef.current

    /*
      Como en cualquier reproductor: si ya pasaron más de 3 segundos, "anterior"
      vuelve al principio de la canción actual en vez de saltar a la anterior.
    */
    if (audio && audio.currentTime > 3 && stateRef.current.source !== 'youtube') {
      audio.currentTime = 0
      return
    }

    const target = previousIndex(queue, index, youtubeConfigured)
    if (target === null) {
      if (audio) audio.currentTime = 0
      return
    }
    load(queue, target)
  }, [load, youtubeConfigured])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    const { playing, source } = stateRef.current

    // El video de YouTube se controla con sus propios botones dentro del panel:
    // aquí solo se refleja el estado, no se le da órdenes.
    if (source === 'youtube') {
      setState((s) => ({ ...s, videoOpen: true }))
      return
    }

    if (!audio) return

    if (playing) {
      audio.pause()
      setState((s) => ({ ...s, playing: false }))
    } else {
      audio.play().then(
        () => setState((s) => ({ ...s, playing: true })),
        () => setState((s) => ({ ...s, problem: 'No se pudo retomar la reproducción.' }))
      )
    }
  }, [])

  const stop = useCallback(() => {
    audioRef.current?.pause()
    setState({
      queue: [],
      index: -1,
      playing: false,
      source: null,
      youtubeVideoId: null,
      videoOpen: false,
      problem: null,
      loading: false
    })
  }, [])

  const jumpTo = useCallback(
    (index: number) => {
      const { queue } = stateRef.current
      if (index >= 0 && index < queue.length) {
        load(queue, index)
      }
    },
    [load]
  )

  const setVideoOpen = useCallback((open: boolean) => {
    setState((s) => ({ ...s, videoOpen: open }))
  }, [])

  // Al terminar una canción se pasa sola a la siguiente.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onEnded = (): void => next()
    const onError = (): void =>
      setState((s) => ({ ...s, playing: false, problem: 'Se cortó la reproducción.' }))

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [next])

  // Al cerrar la app, que no quede audio sonando.
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      audio?.pause()
    }
  }, [])

  const value = useMemo<PlayerApi>(() => {
    const current = state.index >= 0 ? (state.queue[state.index] ?? null) : null
    return {
      ...state,
      current,
      hasNext: nextIndex(state.queue, state.index, youtubeConfigured) !== null,
      hasPrevious: previousIndex(state.queue, state.index, youtubeConfigured) !== null,
      play,
      jumpTo,
      toggle,
      next,
      previous,
      stop,
      setVideoOpen,
      audioRef
    }
  }, [state, youtubeConfigured, play, jumpTo, toggle, next, previous, stop, setVideoOpen])

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}
