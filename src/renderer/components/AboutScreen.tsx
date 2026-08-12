import { APP_NAME, APP_VERSION, REPO_URL } from '@core/config'

interface AboutScreenProps {
  onBack: () => void
}

/** Las fuentes de las que salen los datos de cada disco. */
const FUENTES = [
  {
    nombre: 'MusicBrainz',
    url: 'https://musicbrainz.org/',
    aporte: 'Los datos de cada álbum, el tracklist y los créditos de cada canción.'
  },
  {
    nombre: 'Cover Art Archive',
    url: 'https://coverartarchive.org/',
    aporte: 'Las portadas oficiales del catálogo.'
  },
  {
    nombre: 'Wikipedia y Wikidata',
    url: 'https://www.wikidata.org/',
    aporte: 'La reseña que acompaña a cada disco.'
  },
  {
    nombre: 'Deezer',
    url: 'https://developers.deezer.com/api',
    aporte: 'Los adelantos de 30 segundos de cada canción.'
  }
]

/**
 * Pantalla "Acerca de".
 *
 * Además del crédito de autoría, agradece a las fuentes de datos abiertas.
 * Varias de ellas —MusicBrainz sobre todo— piden que se las mencione cuando se
 * usan sus datos, y en todo caso son proyectos comunitarios que sostienen buena
 * parte de lo que hace Waxbox.
 */
function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <div className="about">
      <div className="about-marca">
        {/* Disco de vinilo dibujado, para no depender de ninguna imagen */}
        <svg className="about-disco" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="47" fill="#1a1920" stroke="#2f2d3a" strokeWidth="2" />
          <circle cx="50" cy="50" r="36" fill="none" stroke="#2f2d3a" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="#2f2d3a" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="18" fill="#6366f1" />
          <circle cx="50" cy="50" r="4" fill="#0f0f0f" />
        </svg>

        <h2>{APP_NAME}</h2>
        <p className="about-slogan">Tu música, tu historia.</p>
        <span className="about-version">Versión {APP_VERSION}</span>
      </div>

      <section className="about-bloque about-autoria">
        <p>
          Waxbox es un proyecto de <strong>Proyecto La Lancha</strong>, creado por{' '}
          <strong>Fabian Cardenas Perez</strong> e <strong>Ivy Bonilla Guerrero</strong>.
        </p>
      </section>

      <section className="about-bloque">
        <h3 className="section-title">Hecho posible por</h3>
        <p className="about-intro">
          Waxbox no tendría nada que contar sin estos proyectos de datos abiertos, mantenidos
          por sus comunidades. Gracias a quienes los sostienen.
        </p>

        <ul className="about-fuentes">
          {FUENTES.map((fuente) => (
            <li key={fuente.nombre}>
              <a href={fuente.url} target="_blank" rel="noreferrer">
                {fuente.nombre}
              </a>
              <span>{fuente.aporte}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-bloque">
        <h3 className="section-title">Código</h3>
        <p className="about-intro">
          Waxbox es open source, con licencia MIT. Puedes ver el código, clonarlo y proponer
          cambios.
        </p>
        <a className="btn btn-ghost" href={REPO_URL} target="_blank" rel="noreferrer">
          Ver el repositorio en GitHub
        </a>
      </section>

      <footer className="about-footer">
        <button className="btn btn-ghost" onClick={onBack}>
          Volver
        </button>
      </footer>
    </div>
  )
}

export default AboutScreen
