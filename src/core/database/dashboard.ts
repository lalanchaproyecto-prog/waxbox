/**
 * Los paneles del inicio.
 *
 * Vive aparte de `db.ts` porque son consultas de lectura que solo alimentan
 * una pantalla: mezclarlas con el CRUD de la colección haría más difícil
 * distinguir lo que guarda datos de lo que solo los mira.
 *
 * QUÉ NO ESTÁ AQUÍ, Y POR QUÉ:
 *
 * - **Efemérides del día exacto.** De la fecha de publicación solo se guarda
 *   el año (`albums.year`), no el mes ni el día, así que "hoy hace 40 años"
 *   es imposible de calcular: no hay con qué saber si hoy es el aniversario.
 *   Lo que sí se puede es por año cumplido, y es lo que hace `efemerides()`.
 * - **País.** No existe la columna. MusicBrainz lo devuelve, pero la app
 *   nunca lo pidió ni lo guardó, así que no hay dato ni para los discos que
 *   ya están cargados.
 * - **Clima.** Requeriría red y ubicación en una app que funciona sin
 *   conexión y no pide permisos. La sugerencia por hora del día sí se puede
 *   y no necesita nada de eso.
 */

import type { Database, SqlValue } from 'sql.js'
import type { PhysicalFormatId } from '../models/formats'
import type { ConditionId } from '../models/condition'
import {
  matches,
  type FiltrableAlbum,
  type SmartCriteria,
  type SmartList
} from '../models/smartList'

/** Un disco al que le falta algo, tal como lo muestra el panel de salud. */
export interface AlbumConHueco {
  id: number
  title: string
  artists: string
}

/** Cuántos discos tienen cada carencia, y ejemplos para empezar a arreglarla. */
export interface SaludItem {
  /** Identificador estable del hueco: 'portada', 'ano', 'genero'... */
  id: string
  label: string
  /** Cuántos discos lo tienen. */
  count: number
  /** Unos pocos, para poder entrar a arreglarlos desde el panel. */
  ejemplos: AlbumConHueco[]
}

export interface Hito {
  id: string
  /** Lo conseguido: "50 discos". */
  titulo: string
  /** Por qué importa o qué falta para el siguiente. */
  detalle: string
  /** Ya alcanzado, o todavía en camino. */
  logrado: boolean
}

export interface Efemeride {
  albumId: number
  title: string
  artists: string
  year: number
  /** Cuántos años cumple este año. */
  aniversario: number
}

export interface DecadaBucket {
  /** 1970, 1980... */
  decada: number
  count: number
}

export interface CompraPorLugar {
  lugar: string
  count: number
}

export interface CompraPorAno {
  ano: number
  count: number
}

export interface ResumenCompras {
  /** Cuántos discos tienen algún dato de compra. */
  conRegistro: number
  porLugar: CompraPorLugar[]
  porAno: CompraPorAno[]
}

export interface Racha {
  /** Días seguidos catalogando que llevas ahora mismo. */
  actual: number
  /** La mejor racha que has tenido. */
  mejor: number
  /** Si hoy ya agregaste algo. */
  hoyCuenta: boolean
}

export interface Olvidado {
  id: number
  title: string
  artists: string
  format: PhysicalFormatId
  userCoverFront: string | null
  canonicalCover: string | null
  /** Cuándo sonó por última vez, o null si nunca. */
  ultimaEscucha: string | null
}

export interface GeneroShare {
  genre: string
  count: number
  /** Qué proporción de la colección tiene este género, de 0 a 100. */
  pct: number
}

export interface DashboardData {
  salud: SaludItem[]
  hitos: Hito[]
  efemerides: Efemeride[]
  decadas: DecadaBucket[]
  compras: ResumenCompras
  racha: Racha
  olvidados: Olvidado[]
  generos: GeneroShare[]
  listas: SmartList[]
  /** Cuántos discos tiene la colección, para calcular proporciones. */
  totalAlbums: number
}

/** Ejecuta una consulta y devuelve las filas como objetos. */
function rows(db: Database, sql: string, params: SqlValue[] = []): Record<string, SqlValue>[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const out: Record<string, SqlValue>[] = []
  while (stmt.step()) out.push(stmt.getAsObject())
  stmt.free()
  return out
}

function count(db: Database, sql: string, params: SqlValue[] = []): number {
  const r = rows(db, sql, params)
  return (r[0]?.['n'] as number) ?? 0
}

/**
 * Panel de salud: qué le falta a la colección.
 *
 * No es una lista de errores — no tener el año de un disco no es un fallo de
 * nadie. Es una lista de huecos que se pueden ir tapando, con el disco a
 * mano para entrar a completarlo.
 */
export function salud(db: Database, collectionId: number): SaludItem[] {
  const huecos: Array<{ id: string; label: string; where: string }> = [
    {
      id: 'portada',
      label: 'Sin portada',
      where: `(a.canonical_cover IS NULL OR a.canonical_cover = '')
              AND (a.user_cover_front IS NULL OR a.user_cover_front = '')`
    },
    { id: 'ano', label: 'Sin año', where: 'a.year IS NULL' },
    {
      id: 'genero',
      label: 'Sin género',
      where: `a.genres IS NULL OR a.genres = '' OR a.genres = '[]'`
    },
    {
      id: 'sello',
      label: 'Sin sello',
      where: `a.label IS NULL OR a.label = ''`
    },
    {
      id: 'estado',
      label: 'Sin estado de conservación',
      where: `a.condition IS NULL OR a.condition = ''`
    },
    {
      id: 'tracklist',
      label: 'Sin canciones',
      where: '(SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id) = 0'
    }
  ]

  return huecos
    .map((hueco) => {
      const n = count(
        db,
        `SELECT COUNT(*) AS n FROM albums a WHERE a.collection_id = ? AND (${hueco.where})`,
        [collectionId]
      )
      const ejemplos = rows(
        db,
        `SELECT a.id, a.title, a.artists FROM albums a
         WHERE a.collection_id = ? AND (${hueco.where})
         ORDER BY a.title LIMIT 3`,
        [collectionId]
      ).map((r) => ({
        id: r['id'] as number,
        title: r['title'] as string,
        artists: r['artists'] as string
      }))
      return { id: hueco.id, label: hueco.label, count: n, ejemplos }
    })
    .filter((item) => item.count > 0)
}

/**
 * Hitos.
 *
 * Se muestran los dos últimos alcanzados y el próximo por alcanzar. Una
 * lista con todos los logros de la historia sería un muro de medallas que
 * nadie vuelve a mirar; lo que importa es lo último que pasó y lo que está
 * a la vuelta.
 */
export function hitos(db: Database, collectionId: number): Hito[] {
  const total = count(db, 'SELECT COUNT(*) AS n FROM albums WHERE collection_id = ?', [
    collectionId
  ])

  const decadasDistintas = count(
    db,
    `SELECT COUNT(DISTINCT (year / 10) * 10) AS n FROM albums
     WHERE collection_id = ? AND year IS NOT NULL`,
    [collectionId]
  )

  const artistasDistintos = count(
    db,
    'SELECT COUNT(DISTINCT artists) AS n FROM albums WHERE collection_id = ?',
    [collectionId]
  )

  const formatosDistintos = count(
    db,
    'SELECT COUNT(DISTINCT format) AS n FROM albums WHERE collection_id = ?',
    [collectionId]
  )

  const out: Hito[] = []

  /** El próximo número redondo por encima del actual. */
  function siguienteMeta(valor: number, escalones: number[]): number | null {
    return escalones.find((e) => e > valor) ?? null
  }

  const metasDiscos = [10, 25, 50, 100, 250, 500, 1000, 2500]
  const alcanzados = metasDiscos.filter((m) => total >= m)
  const ultimo = alcanzados[alcanzados.length - 1]
  if (ultimo !== undefined) {
    out.push({
      id: 'discos-' + ultimo,
      titulo: `${ultimo} discos`,
      detalle: `Tu colección pasó los ${ultimo}.`,
      logrado: true
    })
  }

  if (decadasDistintas >= 3) {
    out.push({
      id: 'decadas-' + decadasDistintas,
      titulo: `${decadasDistintas} décadas distintas`,
      detalle: 'Tu colección cruza varias épocas.',
      logrado: true
    })
  }

  if (artistasDistintos >= 25) {
    out.push({
      id: 'artistas-' + artistasDistintos,
      titulo: `${artistasDistintos} artistas`,
      detalle: 'Sin contar dos veces al mismo.',
      logrado: true
    })
  }

  if (formatosDistintos >= 3) {
    out.push({
      id: 'formatos',
      titulo: 'Los tres formatos',
      detalle: 'Tienes vinilo, CD y casete.',
      logrado: true
    })
  }

  // El próximo, para que el panel diga a qué distancia está algo.
  const proxima = siguienteMeta(total, metasDiscos)
  if (proxima !== null) {
    const faltan = proxima - total
    out.push({
      id: 'proximo-' + proxima,
      titulo: `${proxima} discos`,
      detalle: faltan === 1 ? 'Te falta 1 disco.' : `Te faltan ${faltan} discos.`,
      logrado: false
    })
  }

  // Los dos últimos logrados y el próximo.
  const logrados = out.filter((h) => h.logrado).slice(-2)
  const pendiente = out.filter((h) => !h.logrado)
  return [...logrados, ...pendiente]
}

/**
 * Aniversarios redondos que caen este año.
 *
 * OJO: NO es "hoy hace 40 años". De la publicación solo se guarda el año, no
 * el día, así que no hay manera de saber si hoy es la fecha. Esto es "este
 * año cumple 40", que es lo que el dato permite decir con verdad.
 */
export function efemerides(db: Database, collectionId: number, anoActual: number): Efemeride[] {
  const redondos = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 100]

  return rows(
    db,
    `SELECT id, title, artists, year FROM albums
     WHERE collection_id = ? AND year IS NOT NULL
     ORDER BY year`,
    [collectionId]
  )
    .map((r) => {
      const year = r['year'] as number
      return {
        albumId: r['id'] as number,
        title: r['title'] as string,
        artists: r['artists'] as string,
        year,
        aniversario: anoActual - year
      }
    })
    .filter((e) => redondos.includes(e.aniversario))
    .sort((a, b) => b.aniversario - a.aniversario)
    .slice(0, 4)
}

/** Cuántos discos por década. La década sale del año, que sí se guarda. */
export function porDecada(db: Database, collectionId: number): DecadaBucket[] {
  return rows(
    db,
    `SELECT (year / 10) * 10 AS decada, COUNT(*) AS n FROM albums
     WHERE collection_id = ? AND year IS NOT NULL
     GROUP BY decada ORDER BY decada`,
    [collectionId]
  ).map((r) => ({ decada: r['decada'] as number, count: r['n'] as number }))
}

/** Dónde y cuándo compras más. Sale de lo que hayas anotado en cada ficha. */
export function compras(db: Database, collectionId: number): ResumenCompras {
  const conRegistro = count(
    db,
    `SELECT COUNT(*) AS n FROM albums
     WHERE collection_id = ?
       AND ((purchase_place IS NOT NULL AND purchase_place != '')
         OR (purchase_date IS NOT NULL AND purchase_date != '')
         OR (purchase_price IS NOT NULL AND purchase_price != ''))`,
    [collectionId]
  )

  const porLugar = rows(
    db,
    `SELECT purchase_place AS lugar, COUNT(*) AS n FROM albums
     WHERE collection_id = ? AND purchase_place IS NOT NULL AND purchase_place != ''
     GROUP BY purchase_place ORDER BY n DESC LIMIT 5`,
    [collectionId]
  ).map((r) => ({ lugar: r['lugar'] as string, count: r['n'] as number }))

  const porAno = rows(
    db,
    `SELECT CAST(substr(purchase_date, 1, 4) AS INTEGER) AS ano, COUNT(*) AS n FROM albums
     WHERE collection_id = ? AND purchase_date IS NOT NULL AND length(purchase_date) >= 4
     GROUP BY ano ORDER BY ano`,
    [collectionId]
  ).map((r) => ({ ano: r['ano'] as number, count: r['n'] as number }))

  return { conRegistro, porLugar, porAno }
}

/**
 * Días seguidos catalogando.
 *
 * Se mide sobre `albums.created_at`, que es cuándo entró el disco a la app —
 * no cuándo se compró. La racha sigue viva si agregaste algo hoy o ayer:
 * cortarla a medianoche castigaría a quien cataloga de noche.
 */
export function racha(db: Database, collectionId: number, hoy: string): Racha {
  const dias = rows(
    db,
    `SELECT DISTINCT date(created_at) AS dia FROM albums
     WHERE collection_id = ? AND created_at IS NOT NULL
     ORDER BY dia DESC`,
    [collectionId]
  ).map((r) => r['dia'] as string)

  if (dias.length === 0) return { actual: 0, mejor: 0, hoyCuenta: false }

  const unDia = 86400000
  const aFecha = (d: string) => Date.parse(`${d}T00:00:00`)
  const hoyMs = aFecha(hoy)

  // Racha actual: desde hoy o ayer hacia atrás, día por día.
  let actual = 0
  const masReciente = aFecha(dias[0])
  const distanciaHoy = Math.round((hoyMs - masReciente) / unDia)
  if (distanciaHoy <= 1) {
    actual = 1
    for (let i = 1; i < dias.length; i++) {
      const salto = Math.round((aFecha(dias[i - 1]) - aFecha(dias[i])) / unDia)
      if (salto === 1) actual++
      else break
    }
  }

  // La mejor de todas.
  let mejor = 1
  let corriendo = 1
  for (let i = 1; i < dias.length; i++) {
    const salto = Math.round((aFecha(dias[i - 1]) - aFecha(dias[i])) / unDia)
    if (salto === 1) {
      corriendo++
      if (corriendo > mejor) mejor = corriendo
    } else {
      corriendo = 1
    }
  }

  return { actual, mejor, hoyCuenta: distanciaHoy === 0 }
}

/**
 * Discos que no suenan hace tiempo.
 *
 * Los que nunca sonaron van primero: no es lo mismo "hace un año que no lo
 * pongo" que "nunca lo he puesto desde que lo tengo". Solo mira discos con
 * canciones, porque uno sin tracklist no puede haber sonado nunca y
 * aparecería siempre arriba sin que eso signifique nada.
 */
export function olvidados(db: Database, collectionId: number, limite = 4): Olvidado[] {
  return rows(
    db,
    `SELECT a.id, a.title, a.artists, a.format, a.user_cover_front, a.canonical_cover,
            MAX(p.played_at) AS ultima
     FROM albums a
     JOIN tracks t ON t.album_id = a.id
     LEFT JOIN plays p ON p.track_id = t.id
     WHERE a.collection_id = ?
     GROUP BY a.id
     ORDER BY (ultima IS NOT NULL), ultima ASC
     LIMIT ?`,
    [collectionId, limite]
  ).map((r) => ({
    id: r['id'] as number,
    title: r['title'] as string,
    artists: r['artists'] as string,
    format: r['format'] as PhysicalFormatId,
    userCoverFront: (r['user_cover_front'] as string) ?? null,
    canonicalCover: (r['canonical_cover'] as string) ?? null,
    ultimaEscucha: (r['ultima'] as string) ?? null
  }))
}

/**
 * Qué proporción de la colección tiene cada género.
 *
 * El porcentaje es "de cada 100 discos, cuántos son de este género", NO una
 * porción de una torta: un disco puede tener varios géneros, así que la suma
 * pasa de 100 y eso está bien. Presentarlo como partes de un total sería
 * inventarse una división que no existe.
 */
export function generos(db: Database, collectionId: number, limite = 8): GeneroShare[] {
  const filas = rows(
    db,
    `SELECT genres FROM albums WHERE collection_id = ? AND genres IS NOT NULL AND genres != ''`,
    [collectionId]
  )

  const total = count(db, 'SELECT COUNT(*) AS n FROM albums WHERE collection_id = ?', [
    collectionId
  ])
  if (total === 0) return []

  const cuenta = new Map<string, number>()
  for (const fila of filas) {
    let lista: string[] = []
    try {
      const parsed = JSON.parse((fila['genres'] as string) || '[]')
      if (Array.isArray(parsed)) lista = parsed.filter((g) => typeof g === 'string')
    } catch {
      lista = []
    }
    for (const genero of new Set(lista)) {
      cuenta.set(genero, (cuenta.get(genero) ?? 0) + 1)
    }
  }

  return [...cuenta.entries()]
    .map(([genre, n]) => ({ genre, count: n, pct: (n / total) * 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limite)
}

/* ==========================================================================
   Listas inteligentes
   ========================================================================== */

/**
 * Las listas de una colección, cada una con su conteo al día.
 *
 * El conteo se calcula AHORA, aplicando los criterios sobre los discos
 * actuales. Guardarlo en la tabla lo dejaría desactualizado al primer disco
 * que entre, y una lista que dice 12 cuando hay 14 es peor que no decir nada.
 */
export function listSmartLists(db: Database, collectionId: number): SmartList[] {
  const albums = albumsParaFiltrar(db, collectionId)

  return rows(
    db,
    `SELECT id, name, criteria FROM smart_lists WHERE collection_id = ? ORDER BY name`,
    [collectionId]
  ).map((r) => {
    let criteria: SmartCriteria = {}
    try {
      criteria = JSON.parse((r['criteria'] as string) || '{}') as SmartCriteria
    } catch {
      criteria = {}
    }
    return {
      id: r['id'] as number,
      name: r['name'] as string,
      criteria,
      count: albums.filter((album) => matches(album, criteria)).length
    }
  })
}

/** Los campos de cada disco que necesitan los criterios, y nada más. */
function albumsParaFiltrar(db: Database, collectionId: number): FiltrableAlbum[] {
  return rows(
    db,
    `SELECT title, artists, label, year, format, condition, genres, tags
     FROM albums WHERE collection_id = ?`,
    [collectionId]
  ).map((r) => ({
    title: (r['title'] as string) ?? '',
    artists: (r['artists'] as string) ?? '',
    label: (r['label'] as string) ?? null,
    year: (r['year'] as number) ?? null,
    format: r['format'] as PhysicalFormatId,
    condition: (r['condition'] as ConditionId) ?? null,
    genres: parseLista(r['genres']),
    tags: parseLista(r['tags'])
  }))
}

/** Géneros y etiquetas se guardan como lista JSON en una sola columna. */
function parseLista(valor: SqlValue): string[] {
  if (typeof valor !== 'string' || valor === '') return []
  try {
    const parsed = JSON.parse(valor)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function createSmartList(
  db: Database,
  collectionId: number,
  name: string,
  criteria: SmartCriteria
): { id: number } {
  db.run('INSERT INTO smart_lists (collection_id, name, criteria) VALUES (?, ?, ?)', [
    collectionId,
    name,
    JSON.stringify(criteria)
  ])
  const r = rows(db, 'SELECT last_insert_rowid() AS id')
  return { id: r[0]['id'] as number }
}

export function renameSmartList(db: Database, listId: number, name: string): void {
  db.run('UPDATE smart_lists SET name = ? WHERE id = ?', [name, listId])
}

/**
 * Cambia QUÉ incluye la lista.
 *
 * Es la operación equivalente a "editar los discos" de una lista normal,
 * pero aquí no se tocan discos: se cambia la pregunta. Si dejas de querer
 * "vinilos de los 70" y pasas a querer "vinilos de los 70 en buen estado",
 * los discos que entran y salen se recalculan solos.
 */
export function updateSmartListCriteria(
  db: Database,
  listId: number,
  criteria: SmartCriteria
): void {
  db.run('UPDATE smart_lists SET criteria = ? WHERE id = ?', [
    JSON.stringify(criteria),
    listId
  ])
}

export function deleteSmartList(db: Database, listId: number): void {
  db.run('DELETE FROM smart_lists WHERE id = ?', [listId])
}

/** Todo lo del inicio de una sola vez, para no ir y volver ocho veces. */
export function dashboardData(
  db: Database,
  collectionId: number,
  hoy: string,
  anoActual: number
): DashboardData {
  return {
    salud: salud(db, collectionId),
    hitos: hitos(db, collectionId),
    efemerides: efemerides(db, collectionId, anoActual),
    decadas: porDecada(db, collectionId),
    compras: compras(db, collectionId),
    racha: racha(db, collectionId, hoy),
    olvidados: olvidados(db, collectionId),
    generos: generos(db, collectionId),
    listas: listSmartLists(db, collectionId),
    totalAlbums: count(db, 'SELECT COUNT(*) AS n FROM albums WHERE collection_id = ?', [
      collectionId
    ])
  }
}
