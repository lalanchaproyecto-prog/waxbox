import { APP_NAME, APP_SLOGAN, APP_VERSION, REPO_URL } from '@core/config'
import PageHeader from './PageHeader'
import { Logotipo } from './Logo'

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
 * parte de lo que hace Melôfyle.
 */
function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <div className="screen about">
      <PageHeader
        title={`Acerca de ${APP_NAME}`}
        subtitle={`Versión ${APP_VERSION}`}
        onBack={onBack}
      />

      {/*
        Aquí va el logotipo, no el nombre escrito con la tipografía de la app.

        Es la única pantalla donde la marca se presenta a sí misma, así que es
        el único sitio donde vale la pena dibujarla entera en vez de recortarla
        a la ô.
      */}
      <div className="about-marca">
        <Logotipo alto={54} className="about-logotipo" />
        <p className="about-slogan">{APP_SLOGAN}</p>
        <span className="about-version numeric">Versión {APP_VERSION}</span>
      </div>

      <section className="about-bloque about-autoria">
        <p>
          {APP_NAME} es una iniciativa de <strong>Proyecto La Lancha</strong>, creada por{' '}
          <strong>Fabian Cardenas Perez</strong> e <strong>Ivy Bonilla Guerrero</strong>.
        </p>
      </section>

      <section className="about-bloque">
        <h3 className="section-title">Hecho posible por</h3>
        <p className="about-intro">
          {APP_NAME} no tendría nada que contar sin estos proyectos de datos abiertos,
          mantenidos por sus comunidades. Gracias a quienes los sostienen.
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
          {APP_NAME} es open source, con licencia MIT. Puedes ver el código, clonarlo y
          proponer cambios.
        </p>
        <a className="btn btn-ghost" href={REPO_URL} target="_blank" rel="noreferrer">
          Ver el repositorio en GitHub
        </a>
      </section>
    </div>
  )
}

export default AboutScreen
