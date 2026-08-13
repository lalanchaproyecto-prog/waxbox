/**
 * La barra del reproductor: la píldora de vidrio que flota abajo.
 *
 * Se queda visible en toda la app mientras haya algo cargado, y desaparece
 * cuando no hay nada — una barra vacía permanente solo robaría espacio.
 */

import { useEffect, useRef, useState } from 'react'
import { formatClock } from '@core/player/queue'
import { usePlayer } from './PlayerProvider'

/**
 * Lee el tiempo del elemento de audio sin pasar por el estado global.
 *
 * Esta es la pieza que evita que la app entera se redibuje cuatro veces por
 * segundo: el contador vive AQUÍ, en el componente más chico que lo necesita, y
 * se actualiza mirando el elemento de audio en cada cuadro de animación. Nadie
 * más se entera de que el tiempo corre.
 */
function useProgress(audio: HTMLAudioElement | null, active: boolean) {
  const [time, setTime] = useState({ current: 0, duration: 0 })
  const frame = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!audio || !active) return

    const tick = (): void => {
      setTime((prev) => {
        const current = audio.currentTime
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0
        // Solo se avisa del cambio si el segundo entero cambió: mover la barra
        // no necesita más resolución que esa.
        if (Math.floor(prev.current) === Math.floor(current) && prev.duration === duration) {
          return prev
        }
        return { current, duration }
      })
      frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    }
  }, [audio, active])

  return time
}

function PlayerBar() {
  const player = usePlayer()
  const {
    current,
    playing,
    loading,
    source,
    problem,
    hasNext,
    hasPrevious,
    youtubeVideoId,
    videoOpen
  } = player

  // El tiempo solo se sigue cuando suena un archivo o Deezer: el video de
  // YouTube corre dentro de su propio marco y no lo controlamos.
  const seguible = source === 'archivo' || source === 'deezer'
  const { current: elapsed, duration } = useProgress(player.audioRef.current, seguible)

  if (!current) return null

  const progreso = duration > 0 ? (elapsed / duration) * 100 : 0

  function saltarA(event: React.MouseEvent<HTMLDivElement>) {
    const audio = player.audioRef.current
    if (!audio || !seguible || duration <= 0) return

    const caja = event.currentTarget.getBoundingClientRect()
    const proporcion = (event.clientX - caja.left) / caja.width
    audio.currentTime = Math.max(0, Math.min(duration, proporcion * duration))
  }

  const etiquetaFuente =
    source === 'archivo'
      ? 'Tu archivo'
      : source === 'deezer'
        ? 'Deezer · adelanto de 30 s'
        : source === 'youtube'
          ? 'YouTube'
          : null

  return (
    <div className="player-wrap">
      {/*
        Panel del video de YouTube.

        El video va VISIBLE, con sus propios controles. Es la opción legítima:
        separar el audio del video, o taparlo con la portada, va contra los
        términos de YouTube y puede costarle la clave a la persona.
      */}
      {videoOpen && youtubeVideoId && (
        <div className="player-video glass">
          <div className="player-video-head">
            <span className="overline">Reproduciendo en YouTube</span>
            <button
              className="icon-btn"
              onClick={() => player.setVideoOpen(false)}
              title="Ocultar el video"
            >
              ▾
            </button>
          </div>
          <iframe
            className="player-video-frame"
            src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`}
            title={`${current.title} en YouTube`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
          <p className="player-video-note">
            YouTube se reproduce con sus propios controles. El botón de play de la barra
            maneja tus archivos y los adelantos de Deezer.
          </p>
        </div>
      )}

      <div className="player-bar glass">
        <div className="player-cover">
          {current.cover ? (
            <img src={current.cover} alt="" />
          ) : (
            <span className="player-cover-empty">♪</span>
          )}
        </div>

        <div className="player-info">
          <span className="player-title" title={current.title}>
            {current.title}
          </span>
          <span className="player-meta" title={`${current.artist} — ${current.albumTitle}`}>
            {current.artist}
            {etiquetaFuente && <span className="player-source"> · {etiquetaFuente}</span>}
          </span>
        </div>

        <div className="player-controls">
          <button
            className="player-btn"
            onClick={player.previous}
            disabled={!hasPrevious && elapsed <= 3}
            title="Anterior"
            aria-label="Canción anterior"
          >
            ⏮
          </button>

          <button
            className="player-btn player-btn-main"
            onClick={player.toggle}
            disabled={loading}
            title={playing ? 'Pausar' : 'Reproducir'}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
          >
            {loading ? '···' : playing ? '❚❚' : '▶'}
          </button>

          <button
            className="player-btn"
            onClick={player.next}
            disabled={!hasNext}
            title="Siguiente"
            aria-label="Canción siguiente"
          >
            ⏭
          </button>
        </div>

        <div className="player-progress-wrap">
          {seguible ? (
            <>
              <span className="player-time numeric">{formatClock(elapsed)}</span>
              <div
                className="player-progress"
                onClick={saltarA}
                role="slider"
                aria-label="Avance de la canción"
                aria-valuemin={0}
                aria-valuemax={Math.floor(duration)}
                aria-valuenow={Math.floor(elapsed)}
                tabIndex={0}
              >
                <div className="player-progress-fill" style={{ width: `${progreso}%` }} />
              </div>
              <span className="player-time numeric">{formatClock(duration)}</span>
            </>
          ) : (
            <span className="player-time-note">
              {source === 'youtube' ? 'Controles dentro del video' : ''}
            </span>
          )}
        </div>

        <div className="player-extra">
          {youtubeVideoId && !videoOpen && (
            <button
              className="icon-btn"
              onClick={() => player.setVideoOpen(true)}
              title="Mostrar el video"
            >
              ▴
            </button>
          )}
          <button className="icon-btn" onClick={player.stop} title="Cerrar el reproductor">
            ✕
          </button>
        </div>
      </div>

      {problem && <p className="player-problem">{problem}</p>}
    </div>
  )
}

export default PlayerBar
