import { useState } from 'react'
import type { SettingsStatus } from '@core/models/settings'
import { FEATURES, type FeatureFlags } from '@core/models/features'
import type { ThemePreference } from '../App'

interface SettingsScreenProps {
  status: SettingsStatus
  onStatusChange: (status: SettingsStatus) => void
  theme: ThemePreference
  onThemeChange: (theme: ThemePreference) => void
  features: FeatureFlags
  onFeaturesChange: (features: FeatureFlags) => void
  onOpenAbout: () => void
  onBack: () => void
}

const THEME_OPTIONS: Array<{ id: ThemePreference; label: string }> = [
  { id: 'auto', label: 'Automático' },
  { id: 'dark', label: 'Oscuro' },
  { id: 'light', label: 'Claro' }
]

type Feedback = { kind: 'ok' | 'error'; message: string } | null

/**
 * Pantalla de Configuración.
 *
 * Aquí la persona pega su propia clave de YouTube. Antes de guardarla, la app
 * la prueba contra YouTube, para no dejar guardada una clave que no sirve.
 * La clave se guarda cifrada en este computador y nunca se envía a ningún lado.
 */
function SettingsScreen({
  status,
  onStatusChange,
  theme,
  onThemeChange,
  features,
  onFeaturesChange,
  onOpenAbout,
  onBack
}: SettingsScreenProps) {
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [guideOpen, setGuideOpen] = useState(!status.youtubeConfigured)

  async function handleSave() {
    setBusy(true)
    setFeedback(null)

    const result = await window.api.saveYoutubeKey(apiKey)
    setBusy(false)

    if (!result.ok) {
      setFeedback({ kind: 'error', message: result.error })
      return
    }

    // Se limpia el campo: la clave ya quedó guardada y no hace falta tenerla
    // a la vista.
    setApiKey('')
    setGuideOpen(false)
    onStatusChange(result.data)
    setFeedback({ kind: 'ok', message: 'Listo. Tu clave funciona y quedó guardada.' })
  }

  async function handleClear() {
    setBusy(true)
    setFeedback(null)

    const result = await window.api.clearYoutubeKey()
    setBusy(false)

    if (!result.ok) {
      setFeedback({ kind: 'error', message: result.error })
      return
    }

    onStatusChange(result.data)
    setFeedback({ kind: 'ok', message: 'Se borró tu clave de este computador.' })
  }

  return (
    <div className="settings">
      <header className="settings-header">
        <h2>Configuración</h2>
        <p>Ajustes que se guardan solo en este computador.</p>
      </header>

      <section className="setting-block">
        <div className="setting-title-row">
          <h3>Apariencia</h3>
        </div>
        <p className="setting-description">
          Elige cómo se ve Waxbox. En automático, sigue la configuración de tu sistema operativo.
        </p>
        <div className="theme-options" role="radiogroup" aria-label="Tema de la aplicación">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={theme === opt.id}
              className={`theme-chip${theme === opt.id ? ' selected' : ''}`}
              onClick={() => onThemeChange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-block">
        <div className="setting-title-row">
          <h3>Funciones de la app</h3>
        </div>
        <p className="setting-description">
          Enciende solo lo que uses. Apagar una función la esconde de la interfaz,{' '}
          <strong>no borra nada</strong>: si la vuelves a encender, todo lo que habías
          guardado sigue ahí.
        </p>

        <ul className="feature-list">
          {FEATURES.map((feature) => {
            const enabled = features[feature.id]
            return (
              <li className="feature-row" key={feature.id}>
                <div className="feature-text">
                  <span className="feature-label">{feature.label}</span>
                  <span className="feature-description">{feature.description}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${feature.label}: ${enabled ? 'encendido' : 'apagado'}`}
                  className={`feature-switch${enabled ? ' on' : ''}`}
                  onClick={() =>
                    onFeaturesChange({ ...features, [feature.id]: !enabled })
                  }
                >
                  <span className="feature-switch-knob" />
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="setting-block">
        <div className="setting-title-row">
          <h3>Escuchar canciones (opcional)</h3>
          <span className={`badge${status.youtubeConfigured ? ' badge-on' : ''}`}>
            {status.youtubeConfigured ? 'Configurado' : 'Sin configurar'}
          </span>
        </div>

        <p className="setting-description">
          Waxbox puede buscar en YouTube el video de cada canción de tus discos. Para eso
          necesita una clave gratuita de Google, tuya. <strong>Es completamente opcional</strong>:
          sin ella, todo lo demás — tus fotos, el tracklist, el año, el género, el sello y la
          reseña — funciona igual.
        </p>

        <p className="setting-note">
          Es gratis y no pide tarjeta de crédito. La clave es tuya y solo tuya: se guarda cifrada
          en este computador, no se sube al repositorio ni se comparte con nadie, ni siquiera
          conmigo.
        </p>

        {!status.youtubeKeyEncrypted && (
          <p className="setting-warning">
            Aviso: este sistema no ofrece cifrado, así que la clave se guardaría en texto plano en
            tu carpeta de usuario.
          </p>
        )}

        {status.youtubeConfigured ? (
          <div className="setting-actions">
            <button className="btn btn-ghost" onClick={handleClear} disabled={busy}>
              Borrar mi clave
            </button>
          </div>
        ) : (
          <div className="key-form">
            <label className="field">
              <span className="field-label">Pega aquí tu clave de YouTube</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="AIza..."
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={busy || apiKey.trim().length === 0}
            >
              {busy ? 'Comprobando...' : 'Comprobar y guardar'}
            </button>
          </div>
        )}

        {feedback && (
          <p className={feedback.kind === 'ok' ? 'feedback-ok' : 'feedback-error'}>
            {feedback.message}
          </p>
        )}

        <button className="btn-link guide-toggle" onClick={() => setGuideOpen(!guideOpen)}>
          {guideOpen ? 'Ocultar la guía' : '¿Cómo consigo esa clave? Ver guía'}
        </button>

        {guideOpen && (
          <div className="guide">
            <p className="guide-intro">
              Vas a crear un &quot;proyecto&quot; en Google Cloud. Suena técnico, pero es
              simplemente una carpeta donde Google agrupa los permisos que pides. Crearla es
              gratis y no implica ningún cobro.
            </p>

            <ol className="guide-steps">
              <li>
                Entra a <strong>console.cloud.google.com</strong> e inicia sesión con tu cuenta de
                Google, la misma de Gmail si quieres.
              </li>
              <li>
                Arriba, al lado del logo de Google Cloud, hay un selector de proyectos. Haz clic y
                elige <strong>&quot;Proyecto nuevo&quot;</strong>. Ponle de nombre{' '}
                <strong>Waxbox</strong> y confirma. Espera unos segundos a que se cree.
              </li>
              <li>
                Comprueba que arriba quede seleccionado el proyecto <strong>Waxbox</strong> y no
                otro.
              </li>
              <li>
                En el buscador de la parte superior escribe{' '}
                <strong>YouTube Data API v3</strong>, entra al resultado y haz clic en{' '}
                <strong>&quot;Habilitar&quot;</strong>. Este paso es el que le da permiso a tu
                proyecto de consultar YouTube.
              </li>
              <li>
                En el menú lateral ve a <strong>&quot;API y servicios&quot;</strong> →{' '}
                <strong>&quot;Credenciales&quot;</strong>.
              </li>
              <li>
                Arriba haz clic en <strong>&quot;Crear credenciales&quot;</strong> →{' '}
                <strong>&quot;Clave de API&quot;</strong>. Google genera una clave larga que
                empieza por <code>AIza</code>.
              </li>
              <li>Cópiala y pégala en el campo de arriba.</li>
              <li>
                Recomendado: en Google Cloud, haz clic en{' '}
                <strong>&quot;Restringir clave&quot;</strong> y, en restricciones de API, marca
                solo <strong>YouTube Data API v3</strong>. Deja la restricción de aplicación en{' '}
                <strong>&quot;Ninguna&quot;</strong>, porque Waxbox es un programa de escritorio.
              </li>
            </ol>

            <p className="guide-note">
              Google da 10.000 unidades diarias gratis y cada búsqueda de una canción cuesta 100,
              o sea unas 100 canciones por día. Por eso Waxbox busca el video solo cuando le das
              al botón de escuchar, y lo guarda para no volver a gastarlo.
            </p>
          </div>
        )}
      </section>

      <section className="setting-block">
        <div className="setting-title-row">
          <h3>Acerca de Waxbox</h3>
        </div>
        <p className="setting-description">
          Quién hizo Waxbox, qué versión tienes instalada y de dónde salen los datos de tus
          discos.
        </p>
        <div className="setting-actions">
          <button className="btn btn-ghost" onClick={onOpenAbout}>
            Ver información del proyecto
          </button>
        </div>
      </section>

      <footer className="settings-footer">
        <button className="btn btn-ghost" onClick={onBack}>
          Volver
        </button>
      </footer>
    </div>
  )
}

export default SettingsScreen
