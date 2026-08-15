/*
  CHEQUEO DE SALUD DE LAS APIS EXTERNAS.

  Melôfyle no tiene servidor propio: todo lo que sabe de un disco lo sacan
  cinco servicios ajenos. Si alguno cambia la forma de sus respuestas, la app
  deja de completar datos —o revienta— y nosotros no nos enteramos hasta que
  alguien se molesta en reportarlo.

  Este script hace las consultas DE VERDAD y comprueba que siga estando cada
  campo que el código lee. No basta con un 200: una API puede responder
  perfectamente y haber renombrado `artist-credit` a `artistCredit`, y eso
  rompe la app igual que si estuviera caída, pero sin dar la cara.

  CADA COMPROBACIÓN APUNTA A UN ARCHIVO CONCRETO. Si algo falla aquí, el
  mensaje dice qué campo desapareció y qué archivo lo lee, para no tener que
  ir a buscarlo.

  Se ejecuta solo, una vez al día, desde .github/workflows/salud-apis.yml.
  También a mano:  node scripts/chequeo-apis.mjs
*/

const USER_AGENT = 'Melofyle-HealthCheck/1.0 ( https://github.com/lalanchaproyecto-prog/melofyle )'

/*
  Datos de prueba: cosas que llevan décadas existiendo.

  El disco es «Kind of Blue» de Miles Davis y el identificador es el de su
  grupo de edición en MusicBrainz. Se eligen a propósito obras muy
  establecidas: si un día no aparecen, el problema es del servicio, no de que
  hayan borrado un disco oscuro.
*/
const PRUEBA = {
  artista: 'Miles Davis',
  album: 'Kind of Blue',
  /* Grupo de edición de Kind of Blue. */
  releaseGroupId: '0c9e8bbe-4d1a-3b1a-8d0f-6a0a0a86fd4e',
  /* Edición concreta con portada en Cover Art Archive: The Dark Side of the Moon. */
  releaseConPortada: 'b84ee12a-09ef-421b-82de-0441a926375b',
  cancion: { artista: 'Miles Davis', titulo: 'So What' },
  /* Miles Davis en Wikidata. Tiene artículo en español y en inglés, que son
     los dos idiomas que mira la app. */
  wikidataId: 'Q93341',
  terminoCommons: 'vinyl record'
}

/** Pide JSON y explica el fallo en vez de dejar escapar un error crudo. */
async function pedirJson(url, cabeceras = {}) {
  const respuesta = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...cabeceras }
  })

  if (!respuesta.ok) {
    throw new Error(`respondió HTTP ${respuesta.status} ${respuesta.statusText}`)
  }

  const texto = await respuesta.text()
  try {
    return JSON.parse(texto)
  } catch {
    throw new Error(
      `respondió algo que no es JSON (empieza por: ${texto.slice(0, 80).replace(/\s+/g, ' ')}…)`
    )
  }
}

/**
 * Comprueba que un campo exista, y si no, dice exactamente cuál falta.
 *
 * El mensaje incluye las claves que SÍ llegaron: cuando una API renombra un
 * campo, verlas al lado suele bastar para saber cómo se llama ahora.
 */
function exigir(valor, ruta, dondeSeUsa) {
  if (valor === undefined || valor === null || valor === '') {
    throw new Error(`falta el campo \`${ruta}\` que lee ${dondeSeUsa}`)
  }
  return valor
}

function exigirLista(valor, ruta, dondeSeUsa) {
  if (!Array.isArray(valor) || valor.length === 0) {
    throw new Error(`\`${ruta}\` no es una lista con elementos (lo lee ${dondeSeUsa})`)
  }
  return valor
}

// --------------------------------------------------------------------------
// Una comprobación por servicio
// --------------------------------------------------------------------------

/*
  MusicBrainz es la única fuente imprescindible: sin ella no hay ficha. Se
  comprueban los dos caminos que usa la app —buscar y traer el detalle— porque
  son endpoints distintos y pueden romperse por separado.
*/
async function chequearMusicBrainz() {
  const base = 'https://musicbrainz.org/ws/2'
  const consulta = `artist:"${PRUEBA.artista}" AND release:"${PRUEBA.album}"`
  const busqueda = await pedirJson(
    `${base}/release?query=${encodeURIComponent(consulta)}&fmt=json&limit=5`
  )

  const ediciones = exigirLista(busqueda.releases, 'releases', 'searchReleases() en musicbrainz.ts')
  const primera = ediciones[0]

  exigir(primera.id, 'releases[0].id', 'searchReleases() en musicbrainz.ts')
  exigir(primera.title, 'releases[0].title', 'searchReleases() en musicbrainz.ts')
  exigirLista(
    primera['artist-credit'],
    "releases[0]['artist-credit']",
    'creditToString() en musicbrainz.ts'
  )

  // El detalle: aquí viven el tracklist y los créditos, que es el grueso de la ficha.
  const detalle = await pedirJson(
    `${base}/release/${primera.id}?fmt=json&inc=artist-credits+labels+recordings+release-groups+genres`
  )

  exigir(detalle.title, 'title', 'getReleaseDetails() en musicbrainz.ts')
  const medios = exigirLista(detalle.media, 'media', 'getReleaseDetails() en musicbrainz.ts')
  const canciones = exigirLista(
    medios[0].tracks,
    'media[0].tracks',
    'getReleaseDetails() en musicbrainz.ts'
  )
  exigir(canciones[0].title, 'media[0].tracks[0].title', 'getReleaseDetails() en musicbrainz.ts')
  exigir(
    canciones[0].position ?? canciones[0].number,
    'media[0].tracks[0].position o .number',
    'parseTrackNumber() en musicbrainz.ts'
  )

  return `${ediciones.length} ediciones de «${PRUEBA.album}»; el detalle trae ${canciones.length} canciones`
}

/*
  Cover Art Archive responde 404 cuando un álbum no tiene portada, y eso es
  normal. Por eso se pregunta por una edición que SÍ tiene: un 404 aquí sí es
  señal de que algo cambió.
*/
async function chequearCoverArtArchive() {
  const datos = await pedirJson(
    `https://coverartarchive.org/release/${PRUEBA.releaseConPortada}`
  )

  const imagenes = exigirLista(datos.images, 'images', 'fetchImages() en coverart.ts')
  exigir(imagenes[0].image, 'images[0].image', 'fetchCoverArt() en coverart.ts')

  const portada =
    imagenes.find((i) => i.front === true) ??
    imagenes.find((i) => Array.isArray(i.types) && i.types.includes('Front'))

  if (!portada) {
    throw new Error(
      'ninguna imagen viene marcada como portada (ni `front: true` ni `types` con "Front"), ' +
        'que es como las distingue pickFrontCover() en coverart.ts'
    )
  }

  exigir(portada.thumbnails, 'images[].thumbnails', 'pickThumbnail() en coverart.ts')
  return `${imagenes.length} imágenes, con portada identificada`
}

/*
  Wikipedia se alcanza en dos saltos: Wikidata dice en qué idiomas existe el
  artículo, y Wikipedia entrega el resumen. Se comprueban los dos, porque son
  servicios distintos aunque la app los use como si fueran uno.
*/
async function chequearWikipedia() {
  const wikidata = await pedirJson(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${PRUEBA.wikidataId}&props=sitelinks&format=json&origin=*`
  )

  const entidad = exigir(
    wikidata.entities?.[PRUEBA.wikidataId],
    `entities.${PRUEBA.wikidataId}`,
    'getArticleTitles() en wikipedia.ts'
  )
  const sitelinks = exigir(entidad.sitelinks, 'sitelinks', 'getArticleTitles() en wikipedia.ts')

  const titulo = sitelinks.eswiki?.title ?? sitelinks.enwiki?.title
  if (!titulo) {
    throw new Error(
      'no hay artículo ni en `sitelinks.eswiki` ni en `sitelinks.enwiki`, que son los ' +
        'dos que mira PREFERRED_WIKIS en wikipedia.ts'
    )
  }

  const idioma = sitelinks.eswiki?.title ? 'es' : 'en'
  const resumen = await pedirJson(
    `https://${idioma}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo)}`
  )

  exigir(resumen.extract, 'extract', 'getSummary() en wikipedia.ts')
  exigir(resumen.type, 'type', 'getSummary() en wikipedia.ts — filtra las desambiguaciones')

  return `artículo «${titulo}» (${idioma}) con resumen de ${resumen.extract.length} caracteres`
}

/*
  Deezer es lo que permite escuchar sin configurar nada. Se comprueban los dos
  endpoints: buscar (que da el id estable) y el detalle (que da la dirección
  del adelanto, la que caduca).
*/
async function chequearDeezer() {
  const consulta = `artist:"${PRUEBA.cancion.artista}" track:"${PRUEBA.cancion.titulo}"`
  const busqueda = await pedirJson(
    `https://api.deezer.com/search?q=${encodeURIComponent(consulta)}&limit=1`
  )

  const resultados = exigirLista(busqueda.data, 'data', 'findTrack() en deezer.ts')
  const cancion = resultados[0]

  exigir(cancion.id, 'data[0].id', 'findTrack() en deezer.ts — es lo que se guarda en la base')
  exigir(cancion.title, 'data[0].title', 'findTrack() en deezer.ts')
  exigir(cancion.artist?.name, 'data[0].artist.name', 'findTrack() en deezer.ts')

  // El adelanto se pide aparte, que es justo lo que hace la app al reproducir.
  const detalle = await pedirJson(`https://api.deezer.com/track/${cancion.id}`)
  exigir(detalle.preview, 'preview', 'getPreviewUrl() en deezer.ts — sin esto no suena nada')

  if (!String(detalle.preview).startsWith('http')) {
    throw new Error(`\`preview\` ya no es una URL: llegó "${detalle.preview}"`)
  }

  return `«${cancion.title}» encontrada, con adelanto disponible`
}

/*
  Wikimedia Commons alimenta el buscador de imágenes de portada. Es la única
  cuya respuesta viene indexada por id de página en vez de en una lista, así
  que se comprueba esa forma en concreto.
*/
async function chequearWikimediaCommons() {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${PRUEBA.terminoCommons}`,
    gsrnamespace: '6',
    gsrlimit: '5',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '320'
  })

  const datos = await pedirJson(`https://commons.wikimedia.org/w/api.php?${params}`)

  const paginas = exigir(datos.query?.pages, 'query.pages', 'searchImages() en wikimediaCommons.ts')
  const lista = Object.values(paginas)

  if (lista.length === 0) {
    throw new Error('`query.pages` llegó vacío para un término que siempre da resultados')
  }

  const conImagen = lista.find((p) => p.imageinfo?.[0]?.url && p.imageinfo?.[0]?.thumburl)
  if (!conImagen) {
    throw new Error(
      'ninguna página trae `imageinfo[0].url` y `imageinfo[0].thumburl`, que es lo que ' +
        'searchImages() en wikimediaCommons.ts exige para mostrar una imagen'
    )
  }

  return `${lista.length} resultados para «${PRUEBA.terminoCommons}»`
}

// --------------------------------------------------------------------------

const SERVICIOS = [
  { nombre: 'MusicBrainz', comprobar: chequearMusicBrainz, imprescindible: true },
  { nombre: 'Cover Art Archive', comprobar: chequearCoverArtArchive, imprescindible: false },
  { nombre: 'Wikipedia y Wikidata', comprobar: chequearWikipedia, imprescindible: false },
  { nombre: 'Deezer', comprobar: chequearDeezer, imprescindible: false },
  { nombre: 'Wikimedia Commons', comprobar: chequearWikimediaCommons, imprescindible: false }
]

/*
  Se comprueban de una en una, no en paralelo.

  MusicBrainz pide como máximo una consulta por segundo y bloquea a quien se
  pasa. Lanzar las cinco a la vez sería justo el tipo de fallo que este script
  existe para detectar, provocado por el propio script.
*/
async function main() {
  const resultados = []

  for (const servicio of SERVICIOS) {
    const desde = Date.now()
    try {
      const detalle = await servicio.comprobar()
      const ms = Date.now() - desde
      resultados.push({ ...servicio, ok: true, detalle, ms })
      console.log(`✅ ${servicio.nombre} — ${detalle} (${ms} ms)`)
    } catch (error) {
      const ms = Date.now() - desde
      const motivo = error instanceof Error ? error.message : String(error)
      resultados.push({ ...servicio, ok: false, detalle: motivo, ms })
      console.error(`❌ ${servicio.nombre} — ${motivo} (${ms} ms)`)
    }

    // Un respiro entre servicios, por el límite de MusicBrainz.
    await new Promise((listo) => setTimeout(listo, 1200))
  }

  const fallidos = resultados.filter((r) => !r.ok)

  /*
    El informe se deja en un archivo para que el workflow lo lea y lo pegue en
    el Issue. Pasarlo por la salida estándar obligaría a parsear el log, que
    es frágil y se rompe en cuanto alguien añade un `console.log`.
  */
  const informe = {
    fecha: new Date().toISOString(),
    total: resultados.length,
    fallidos: fallidos.length,
    servicios: resultados.map(({ nombre, ok, detalle, ms, imprescindible }) => ({
      nombre,
      ok,
      detalle,
      ms,
      imprescindible
    }))
  }

  const { writeFileSync } = await import('node:fs')
  writeFileSync('informe-salud.json', JSON.stringify(informe, null, 2))

  console.log('')
  if (fallidos.length === 0) {
    console.log(`Las ${resultados.length} APIs responden como espera el código.`)
    process.exit(0)
  }

  console.error(
    `${fallidos.length} de ${resultados.length} fallaron: ${fallidos.map((f) => f.nombre).join(', ')}`
  )
  process.exit(1)
}

main().catch((error) => {
  console.error('El chequeo se cayó por un error inesperado:', error)
  process.exit(1)
})
