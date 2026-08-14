import { APP_NAME, APP_VERSION, REPO_URL } from '@core/config'
import PageHeader from './PageHeader'
import { Isotipo } from './Logo'

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
    <div className="screen about">
      <PageHeader title="Acerca de Waxbox" subtitle={`Versión ${APP_VERSION}`} onBack={onBack} />

      {/*
        La marca la dibuja el isotipo, no un SVG propio de esta pantalla.

        Antes había aquí un tercer disco dibujado a mano, distinto del isotipo y
        distinto del primitivo `.disc`: tres versiones del mismo objeto que
        había que mantener por separado. Cuando llegue el logo definitivo, esta
        pantalla se actualiza sola.
      */}
      <div className="about-marca">
        <Isotipo size={72} className="about-isotipo" />
        <h2 className="about-nombre">{APP_NAME}</h2>
        <p className="about-slogan">Tu música, tu historia.</p>
        <span className="about-version numeric">Versión {APP_VERSION}</span>
      </div>

      <section className="about-bloque about-autoria">
        <p>
          Waxbox es una iniciativa de <strong>Proyecto La Lancha</strong>, creada por{' '}
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
    </div>
  )
}

export default AboutScreen
