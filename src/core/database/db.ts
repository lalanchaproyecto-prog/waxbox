import type { Database, SqlValue } from 'sql.js'
import type { EditableAlbum, EditableTrack } from '../albumDraft'
import type { PhysicalFormatId } from '../models/formats'
import type { ConditionId } from '../models/condition'
import type { Credit } from '../models/credits'
import type { ArtistLink } from '../services/musicbrainz'
import { durationToSeconds } from '../models/duration'
import { normalizeSource, type AlbumSource } from '../models/albumSource'
import { extensionOf, type TrackFile } from '../models/audioFile'
import {
  parseImageRef,
  serializeImageRef,
  type ImageRef
} from '../models/imageRef'
import type { PlaybackSource } from '../player/queue'
import type { DeezerTrackRef } from '../services/deezer'
import type { Loan } from '../models/loan'
import type { Purchase } from '../models/purchase'
import {
  SCHEMA,
  INDEXES,
  MIGRATIONS,
  DEFAULT_COLLECTION_NAME,
  columnExists
} from './schema'

export interface AlbumSummary {
  id: number
  format: PhysicalFormatId
  artists: string
  title: string
  year: number | null
  genres: string[]
  label: string | null
  condition: ConditionId | null
  /** Etiquetas libres que escribió la persona. */
  tags: string[]
  userCoverFront: string | null
  canonicalCover: string | null
  trackCount: number
  /** Si vino de un catálogo o se cargó a mano. Ver models/albumSource.ts. */
  source: AlbumSource
  createdAt: string
}

export interface SavedTrack {
  /** Identificador interno estable. Es a lo que apuntan los setlists. */
  id: number
  artist: string
  side: string
  number: number
  title: string
  duration: string | null
  deezer: DeezerTrackRef | null
  credits: Credit[]
  userEditedFields: string[]
  /**
   * Archivo de audio propio, si la persona asoció uno. Tiene prioridad sobre
   * Deezer y YouTube al reproducir.
   *
   * `missing` lo completa el proceso principal, que es el único que puede mirar
   * el disco duro; aquí siempre sale en false.
   */
  file: TrackFile | null
}

export interface SavedAlbum {
  id: number
  format: PhysicalFormatId
  artists: string
  title: string
  year: number | null
  genres: string[]
  label: string | null
  condition: ConditionId | null
  notes: string | null
  tags: string[]
  userCoverFront: string | null
  userCoverBack: string | null
  canonicalCover: string | null
  description: string | null
  descriptionSource: string | null
  descriptionUrl: string | null
  musicbrainzId: string | null
  source: AlbumSource
  artistLinks: ArtistLink[]
  userEditedFields: string[]
  purchase: Purchase
  /** Grupo de edición en MusicBrainz: lo comparten dos ediciones del mismo álbum. */
  releaseGroupId: string | null
  tracks: SavedTrack[]
  createdAt: string
  updatedAt: string
}

export function initSchema(db: Database): void {
  db.exec(SCHEMA)
  // El orden importa: las migraciones agregan las columnas de las que dependen
  // los índices, así que estos van después.
  runMigrations(db)
  db.exec(INDEXES)
  ensureDefaultCollection(db)
}

function getSchemaVersion(db: Database): number {
  const rows = db.exec('PRAGMA user_version')
  return (rows[0]?.values[0]?.[0] as number) ?? 0
}

function setSchemaVersion(db: Database, version: number): void {
  db.run(`PRAGMA user_version = ${version}`)
}

function runMigrations(db: Database): void {
  const current = getSchemaVersion(db)

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue

    for (const addition of migration.addColumns) {
      // Se pregunta si la columna ya está en vez de intentar y perdonar el
      // error: así cualquier fallo real se propaga en vez de pasar inadvertido.
      if (columnExists(db, addition.table, addition.column)) continue
      db.run(
        `ALTER TABLE ${addition.table} ADD COLUMN ${addition.column} ${addition.type}`
      )
    }

    setSchemaVersion(db, migration.version)
  }
}

/**
 * Deja siempre una colección disponible y ningún álbum ni setlist huérfano.
 *
 * Resuelve los dos casos con el mismo código: una base recién creada, donde no
 * hay ninguna colección todavía, y una base vieja que acaba de migrar, donde las
 * filas existentes quedaron con `collection_id` en NULL. Es idempotente:
 * volver a ejecutarlo no cambia nada.
 *
 * Esta es la pieza que garantiza que nadie pierda de vista su colección al
 * actualizar: todo lo que existía pasa a la colección por defecto.
 */
export function ensureDefaultCollection(db: Database): number {
  const existing = db.exec('SELECT id FROM collections ORDER BY id LIMIT 1')
  let collectionId = existing[0]?.values[0]?.[0] as number | undefined

  if (collectionId === undefined) {
    db.run('INSERT INTO collections (name) VALUES (?)', [DEFAULT_COLLECTION_NAME])
    collectionId = lastId(db)
  }

  db.run('UPDATE albums SET collection_id = ? WHERE collection_id IS NULL', [collectionId])
  db.run('UPDATE setlists SET collection_id = ? WHERE collection_id IS NULL', [collectionId])

  return collectionId
}

function lastId(db: Database): number {
  const rows = db.exec('SELECT last_insert_rowid() AS id')
  return rows[0].values[0][0] as number
}

function jsonOrEmpty(value: unknown): string {
  return JSON.stringify(value ?? [])
}

function parseJson<T>(value: SqlValue, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// --------------------------------------------------------------------------
// Colecciones
// --------------------------------------------------------------------------

export interface CollectionSummary {
  id: number
  name: string
  albumCount: number
  setlistCount: number
  /** Imagen elegida por la persona: archivo propio o de Wikimedia Commons. */
  image: ImageRef | null
  createdAt: string
}

export function listCollections(db: Database): CollectionSummary[] {
  const collections: CollectionSummary[] = []

  const stmt = db.prepare(
    `SELECT c.id, c.name, c.created_at, c.image,
            (SELECT COUNT(*) FROM albums a WHERE a.collection_id = c.id) AS album_count,
            (SELECT COUNT(*) FROM setlists s WHERE s.collection_id = c.id) AS setlist_count
     FROM collections c
     ORDER BY c.created_at`
  )

  while (stmt.step()) {
    const row = stmt.getAsObject()
    collections.push({
      id: row['id'] as number,
      name: row['name'] as string,
      createdAt: row['created_at'] as string,
      image: parseImageRef(row['image']),
      albumCount: row['album_count'] as number,
      setlistCount: row['setlist_count'] as number
    })
  }

  stmt.free()
  return collections
}

/**
 * Cambia la imagen de una colección. null la quita.
 *
 * Devuelve el nombre del archivo que dejó de usarse, si había uno propio, para
 * que quien llama lo borre del disco y no queden fotos huérfanas ocupando
 * espacio para siempre.
 */
export function setCollectionImage(
  db: Database,
  collectionId: number,
  image: ImageRef | null
): string | null {
  const anterior = imageOf(db, 'collections', collectionId)
  db.run('UPDATE collections SET image = ? WHERE id = ?', [
    serializeImageRef(image),
    collectionId
  ])
  return orphanedPhoto(anterior, image)
}

export function setSetlistImage(
  db: Database,
  setlistId: number,
  image: ImageRef | null
): string | null {
  const anterior = imageOf(db, 'setlists', setlistId)
  db.run("UPDATE setlists SET image = ?, updated_at = datetime('now') WHERE id = ?", [
    serializeImageRef(image),
    setlistId
  ])
  return orphanedPhoto(anterior, image)
}

/** La imagen guardada de una fila, sea de colecciones o de setlists. */
function imageOf(db: Database, table: 'collections' | 'setlists', id: number): ImageRef | null {
  const stmt = db.prepare(`SELECT image FROM ${table} WHERE id = ?`)
  stmt.bind([id])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const raw = stmt.getAsObject()['image']
  stmt.free()
  return parseImageRef(raw)
}

/**
 * Qué archivo de foto quedó sin dueño al reemplazar una imagen.
 *
 * Solo cuentan los archivos propios: una imagen de Commons vive en internet y
 * no ocupa nada aquí. Y si la imagen nueva es exactamente la misma, no hay nada
 * que borrar — borrarla dejaría la fila apuntando a un archivo inexistente.
 */
function orphanedPhoto(anterior: ImageRef | null, nueva: ImageRef | null): string | null {
  if (!anterior || anterior.kind !== 'archivo') return null
  if (nueva && nueva.kind === 'archivo' && nueva.value === anterior.value) return null
  return anterior.value
}

export function createCollection(db: Database, name: string): number {
  db.run('INSERT INTO collections (name) VALUES (?)', [name.trim()])
  return lastId(db)
}

export function renameCollection(db: Database, collectionId: number, name: string): void {
  db.run('UPDATE collections SET name = ? WHERE id = ?', [name.trim(), collectionId])
}

export function collectionExists(db: Database, collectionId: number): boolean {
  const stmt = db.prepare('SELECT 1 FROM collections WHERE id = ?')
  stmt.bind([collectionId])
  const found = stmt.step()
  stmt.free()
  return found
}

/**
 * Borra una colección con todo lo que contiene.
 *
 * El borrado en cascada se hace a mano porque `collection_id` se agregó con
 * ALTER TABLE y SQLite no permite añadir una clave foránea a una tabla que ya
 * existe. Los discos sí arrastran sus canciones y créditos por cascada real, y
 * los setlists sus canciones.
 *
 * Devuelve los nombres de archivo de las fotos que quedaron sin dueño, para que
 * quien llama las borre del disco.
 */
export function deleteCollection(db: Database, collectionId: number): string[] {
  const photos: string[] = []

  db.run('BEGIN TRANSACTION')

  try {
    const stmt = db.prepare(
      'SELECT id, user_cover_front, user_cover_back FROM albums WHERE collection_id = ?'
    )
    stmt.bind([collectionId])

    const albumIds: number[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      albumIds.push(row['id'] as number)
      const front = row['user_cover_front'] as string | null
      const back = row['user_cover_back'] as string | null
      if (front) photos.push(front)
      if (back) photos.push(back)
    }
    stmt.free()

    for (const albumId of albumIds) {
      db.run('DELETE FROM albums WHERE id = ?', [albumId])
    }

    db.run('DELETE FROM setlists WHERE collection_id = ?', [collectionId])
    db.run('DELETE FROM collections WHERE id = ?', [collectionId])

    db.run('COMMIT')
    return photos
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

export function countCollections(db: Database): number {
  const rows = db.exec('SELECT COUNT(*) FROM collections')
  return (rows[0]?.values[0]?.[0] as number) ?? 0
}

export function saveAlbum(
  db: Database,
  collectionId: number,
  album: EditableAlbum,
  photos: { front: string | null; back: string | null }
): number {
  db.run('BEGIN TRANSACTION')

  try {
    db.run(
      `INSERT INTO albums
        (collection_id, format, artists, title, year, genres, label,
         user_cover_front, user_cover_back, canonical_cover,
         description, description_source, description_url,
         musicbrainz_id, source, artist_links, user_edited_fields,
         condition, notes, tags,
         purchase_place, purchase_date, purchase_price, release_group_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        collectionId,
        album.format,
        album.artists,
        album.title,
        album.year,
        jsonOrEmpty(album.genres),
        album.label,
        photos.front,
        photos.back,
        album.canonicalCover,
        album.description,
        album.descriptionSource,
        album.descriptionUrl,
        album.musicbrainzId,
        album.source,
        jsonOrEmpty(album.artistLinks),
        jsonOrEmpty(album.userEditedFields),
        album.condition,
        album.notes,
        jsonOrEmpty(album.tags),
        album.purchase.place,
        album.purchase.date,
        album.purchase.price,
        album.releaseGroupId
      ]
    )

    const albumId = lastId(db)

    for (const track of album.tracks) {
      insertTrack(db, albumId, track)
    }

    db.run('COMMIT')
    return albumId
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

function insertTrack(db: Database, albumId: number, track: EditableTrack): void {
  db.run(
    `INSERT INTO tracks
      (album_id, artist, side, number, title, duration,
       deezer_track_id, deezer_title, deezer_artist, deezer_url,
       user_edited_fields)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      albumId,
      track.artist,
      track.side,
      track.number,
      track.title,
      track.duration,
      track.deezer?.trackId ?? null,
      track.deezer?.title ?? null,
      track.deezer?.artist ?? null,
      track.deezer?.deezerUrl ?? null,
      jsonOrEmpty(track.userEditedFields)
    ]
  )

  const trackId = lastId(db)

  for (const credit of track.credits) {
    db.run(
      `INSERT INTO track_credits (track_id, role, artist, detail, source)
       VALUES (?,?,?,?,?)`,
      [trackId, credit.role, credit.artist, credit.detail, credit.source]
    )
  }
}

export function listAlbums(db: Database, collectionId: number): AlbumSummary[] {
  const albums: AlbumSummary[] = []

  const stmt = db.prepare(
    `SELECT a.id, a.format, a.artists, a.title, a.year, a.genres, a.label,
            a.condition, a.tags, a.user_cover_front, a.canonical_cover, a.source,
            a.created_at,
            (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id) AS track_count
     FROM albums a
     WHERE a.collection_id = ?
     ORDER BY a.created_at DESC`
  )
  stmt.bind([collectionId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    albums.push({
      id: row['id'] as number,
      format: row['format'] as PhysicalFormatId,
      artists: row['artists'] as string,
      title: row['title'] as string,
      year: row['year'] as number | null,
      genres: parseJson<string[]>(row['genres'], []),
      label: row['label'] as string | null,
      condition: row['condition'] as ConditionId | null,
      tags: parseJson<string[]>(row['tags'], []),
      userCoverFront: row['user_cover_front'] as string | null,
      canonicalCover: row['canonical_cover'] as string | null,
      source: normalizeSource(row['source']),
      createdAt: row['created_at'] as string,
      trackCount: row['track_count'] as number
    })
  }

  stmt.free()
  return albums
}

export function getAlbum(db: Database, albumId: number): SavedAlbum | null {
  const stmt = db.prepare('SELECT * FROM albums WHERE id = ?')
  stmt.bind([albumId])

  if (!stmt.step()) {
    stmt.free()
    return null
  }

  const row = stmt.getAsObject()
  stmt.free()

  const tracks = loadTracks(db, albumId)

  return {
    id: row['id'] as number,
    format: row['format'] as PhysicalFormatId,
    artists: row['artists'] as string,
    title: row['title'] as string,
    year: row['year'] as number | null,
    genres: parseJson<string[]>(row['genres'], []),
    label: row['label'] as string | null,
    condition: (row['condition'] as ConditionId | null) ?? null,
    notes: (row['notes'] as string | null) ?? null,
    tags: parseJson<string[]>(row['tags'], []),
    userCoverFront: row['user_cover_front'] as string | null,
    userCoverBack: row['user_cover_back'] as string | null,
    canonicalCover: row['canonical_cover'] as string | null,
    description: row['description'] as string | null,
    descriptionSource: row['description_source'] as string | null,
    descriptionUrl: row['description_url'] as string | null,
    musicbrainzId: row['musicbrainz_id'] as string | null,
    source: normalizeSource(row['source']),
    artistLinks: parseJson<ArtistLink[]>(row['artist_links'], []),
    userEditedFields: parseJson<string[]>(row['user_edited_fields'], []),
    purchase: {
      place: (row['purchase_place'] as string | null) ?? null,
      date: (row['purchase_date'] as string | null) ?? null,
      price: (row['purchase_price'] as string | null) ?? null
    },
    releaseGroupId: (row['release_group_id'] as string | null) ?? null,
    tracks,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string
  }
}

function loadTracks(db: Database, albumId: number): SavedTrack[] {
  const tracks: SavedTrack[] = []

  const stmt = db.prepare(
    `SELECT * FROM tracks WHERE album_id = ? ORDER BY side, number`
  )
  stmt.bind([albumId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    const trackId = row['id'] as number

    const deezerTrackId = row['deezer_track_id'] as number | null
    const deezer: DeezerTrackRef | null = deezerTrackId
      ? {
          trackId: deezerTrackId,
          title: row['deezer_title'] as string,
          artist: row['deezer_artist'] as string,
          deezerUrl: row['deezer_url'] as string
        }
      : null

    tracks.push({
      id: trackId,
      artist: row['artist'] as string,
      side: (row['side'] as string) ?? 'N/A',
      number: row['number'] as number,
      title: row['title'] as string,
      duration: row['duration'] as string | null,
      deezer,
      credits: loadCredits(db, trackId),
      userEditedFields: parseJson<string[]>(row['user_edited_fields'], []),
      file: loadTrackFile(db, trackId)
    })
  }

  stmt.free()
  return tracks
}

function loadCredits(db: Database, trackId: number): Credit[] {
  const credits: Credit[] = []

  const stmt = db.prepare(
    `SELECT role, artist, detail, source FROM track_credits WHERE track_id = ?`
  )
  stmt.bind([trackId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    credits.push({
      role: row['role'] as string,
      artist: row['artist'] as string,
      detail: row['detail'] as string | null,
      source: row['source'] as Credit['source']
    })
  }

  stmt.free()
  return credits
}

// --------------------------------------------------------------------------
// Archivos de audio propios
// --------------------------------------------------------------------------

/**
 * El archivo propio de una canción, o null si no tiene.
 *
 * `missing` sale siempre en false: este módulo no toca el disco duro — corre
 * también en la ventana, donde no hay acceso a archivos. Quien sí puede
 * comprobar si el archivo sigue ahí es el proceso principal, y lo completa
 * antes de mandarlo a la ventana.
 */
function loadTrackFile(db: Database, trackId: number): TrackFile | null {
  const stmt = db.prepare('SELECT path, format FROM track_files WHERE track_id = ?')
  stmt.bind([trackId])

  if (!stmt.step()) {
    stmt.free()
    return null
  }

  const row = stmt.getAsObject()
  stmt.free()

  return {
    path: row['path'] as string,
    format: row['format'] as string,
    missing: false
  }
}

/** La ruta del archivo de una canción. La usa el protocolo waxbox-audio://. */
export function trackFilePath(db: Database, trackId: number): string | null {
  return loadTrackFile(db, trackId)?.path ?? null
}

/**
 * Asocia un archivo a una canción, reemplazando el anterior si lo había.
 *
 * El formato se deduce de la extensión y no se pregunta: es el mismo dato,
 * y preguntarlo abriría la puerta a que no coincidan.
 */
export function linkTrackFile(db: Database, trackId: number, path: string): void {
  db.run(
    `INSERT INTO track_files (track_id, path, format) VALUES (?,?,?)
     ON CONFLICT(track_id) DO UPDATE SET
       path = excluded.path,
       format = excluded.format,
       added_at = datetime('now')`,
    [trackId, path, extensionOf(path)]
  )
}

export function unlinkTrackFile(db: Database, trackId: number): void {
  db.run('DELETE FROM track_files WHERE track_id = ?', [trackId])
}

/** Cuántas canciones de un álbum tienen archivo propio. */
export function albumFileCount(db: Database, albumId: number): number {
  const stmt = db.prepare(
    `SELECT COUNT(*) AS n FROM track_files tf
     JOIN tracks t ON t.id = tf.track_id
     WHERE t.album_id = ?`
  )
  stmt.bind([albumId])
  stmt.step()
  const count = (stmt.getAsObject()['n'] as number) ?? 0
  stmt.free()
  return count
}

// --------------------------------------------------------------------------
// Historial de reproducciones
// --------------------------------------------------------------------------

/**
 * Anota que una canción sonó.
 *
 * Todavía nadie lee esta tabla: la van a usar el panel de inicio y las listas
 * inteligentes. Se guarda desde ahora porque un historial no se puede
 * reconstruir hacia atrás.
 */
export function recordPlay(db: Database, trackId: number, source: PlaybackSource): void {
  db.run('INSERT INTO plays (track_id, source) VALUES (?,?)', [trackId, source])
}

export function updateAlbum(
  db: Database,
  albumId: number,
  album: EditableAlbum
): void {
  db.run('BEGIN TRANSACTION')

  try {
    db.run(
      `UPDATE albums SET
        format = ?, artists = ?, title = ?, year = ?, genres = ?, label = ?,
        description = ?, description_source = ?, description_url = ?,
        canonical_cover = ?, musicbrainz_id = ?, source = ?, artist_links = ?,
        user_edited_fields = ?, condition = ?, notes = ?, tags = ?,
        purchase_place = ?, purchase_date = ?, purchase_price = ?,
        release_group_id = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      [
        album.format,
        album.artists,
        album.title,
        album.year,
        jsonOrEmpty(album.genres),
        album.label,
        album.description,
        album.descriptionSource,
        album.descriptionUrl,
        album.canonicalCover,
        album.musicbrainzId,
        album.source,
        jsonOrEmpty(album.artistLinks),
        jsonOrEmpty(album.userEditedFields),
        album.condition,
        album.notes,
        jsonOrEmpty(album.tags),
        album.purchase.place,
        album.purchase.date,
        album.purchase.price,
        album.releaseGroupId,
        albumId
      ]
    )

    syncTracks(db, albumId, album.tracks)

    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

/**
 * Deja la tabla de canciones igual al tracklist recibido, pero SIN borrar y
 * recrear las filas.
 *
 * Por qué importa: los setlists apuntan a `tracks.id`. Si al editar un álbum se
 * borraran sus canciones para insertarlas de nuevo, cada canción estrenaría un
 * id y desaparecería en silencio de todos los setlists donde estuviera. Por eso
 * aquí se actualizan las filas existentes en su lugar, y solo se insertan o se
 * borran las que sobran o faltan.
 *
 * EL EMPAREJAMIENTO ES POR ID, NO POR POSICIÓN.
 * Antes era por posición, lo cual alcanzaba mientras el tracklist de un álbum
 * guardado no se pudiera acortar. Desde que un álbum manual permite quitar una
 * canción del medio, esa cuenta se rompía: al borrar la tercera de diez, las
 * filas 4 a 10 recibían los datos de las de abajo y la última se eliminaba. El
 * disco terminaba correcto, pero cada setlist que apuntara a esas canciones
 * pasaba a mostrar el tema equivocado, sin ningún aviso.
 *
 * Ahora: la canción que llega con `id` actualiza esa fila, la que llega sin `id`
 * es nueva y se inserta, y la fila que ya no aparece en la lista se borra.
 */
function syncTracks(db: Database, albumId: number, tracks: EditableTrack[]): void {
  const existingIds = new Set<number>()
  const stmt = db.prepare('SELECT id FROM tracks WHERE album_id = ?')
  stmt.bind([albumId])
  while (stmt.step()) existingIds.add(stmt.getAsObject()['id'] as number)
  stmt.free()

  const kept = new Set<number>()

  for (const track of tracks) {
    // Se comprueba que el id sea de ESTE álbum: un id que no esté en la lista
    // no debe actualizar la canción de otro disco.
    if (track.id !== undefined && existingIds.has(track.id)) {
      updateTrackRow(db, track.id, track)
      kept.add(track.id)
    } else {
      insertTrack(db, albumId, track)
    }
  }

  for (const existingId of existingIds) {
    if (!kept.has(existingId)) {
      db.run('DELETE FROM tracks WHERE id = ?', [existingId])
    }
  }
}

function updateTrackRow(db: Database, trackId: number, track: EditableTrack): void {
  db.run(
    `UPDATE tracks SET
       artist = ?, side = ?, number = ?, title = ?, duration = ?,
       deezer_track_id = ?, deezer_title = ?, deezer_artist = ?, deezer_url = ?,
       user_edited_fields = ?
     WHERE id = ?`,
    [
      track.artist,
      track.side,
      track.number,
      track.title,
      track.duration,
      track.deezer?.trackId ?? null,
      track.deezer?.title ?? null,
      track.deezer?.artist ?? null,
      track.deezer?.deezerUrl ?? null,
      jsonOrEmpty(track.userEditedFields),
      trackId
    ]
  )

  // Los créditos sí se rehacen: nada apunta a ellos.
  db.run('DELETE FROM track_credits WHERE track_id = ?', [trackId])
  for (const credit of track.credits) {
    db.run(
      `INSERT INTO track_credits (track_id, role, artist, detail, source)
       VALUES (?,?,?,?,?)`,
      [trackId, credit.role, credit.artist, credit.detail, credit.source]
    )
  }
}

export function deleteAlbum(db: Database, albumId: number): void {
  db.run('DELETE FROM albums WHERE id = ?', [albumId])
}

// --------------------------------------------------------------------------
// Lista de deseos
// --------------------------------------------------------------------------

export interface WishlistItem {
  id: number
  artists: string
  title: string
  year: number | null
  format: PhysicalFormatId | null
  notes: string | null
  /** 1 alta, 2 media, 3 baja. */
  priority: number
  seenAt: string | null
  price: string | null
  createdAt: string
}

/** Lo que se puede escribir de un deseo. Sin id: sirve para crear y editar. */
export type WishlistDraft = Omit<WishlistItem, 'id' | 'createdAt'>

export function listWishlist(db: Database, collectionId: number): WishlistItem[] {
  const items: WishlistItem[] = []

  const stmt = db.prepare(
    `SELECT * FROM wishlist_items WHERE collection_id = ?
     ORDER BY priority, artists COLLATE NOCASE, title COLLATE NOCASE`
  )
  stmt.bind([collectionId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    items.push({
      id: row['id'] as number,
      artists: row['artists'] as string,
      title: row['title'] as string,
      year: row['year'] as number | null,
      format: (row['format'] as PhysicalFormatId | null) ?? null,
      notes: (row['notes'] as string | null) ?? null,
      priority: (row['priority'] as number | null) ?? 2,
      seenAt: (row['seen_at'] as string | null) ?? null,
      price: (row['price'] as string | null) ?? null,
      createdAt: row['created_at'] as string
    })
  }

  stmt.free()
  return items
}

export function addWishlistItem(
  db: Database,
  collectionId: number,
  draft: WishlistDraft
): number {
  db.run(
    `INSERT INTO wishlist_items
      (collection_id, artists, title, year, format, notes, priority, seen_at, price)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      collectionId,
      draft.artists.trim(),
      draft.title.trim(),
      draft.year,
      draft.format,
      draft.notes,
      draft.priority,
      draft.seenAt,
      draft.price
    ]
  )
  return lastId(db)
}

export function updateWishlistItem(
  db: Database,
  itemId: number,
  draft: WishlistDraft
): void {
  db.run(
    `UPDATE wishlist_items SET
       artists = ?, title = ?, year = ?, format = ?, notes = ?,
       priority = ?, seen_at = ?, price = ?
     WHERE id = ?`,
    [
      draft.artists.trim(),
      draft.title.trim(),
      draft.year,
      draft.format,
      draft.notes,
      draft.priority,
      draft.seenAt,
      draft.price,
      itemId
    ]
  )
}

export function removeWishlistItem(db: Database, itemId: number): void {
  db.run('DELETE FROM wishlist_items WHERE id = ?', [itemId])
}

export function wishlistCount(db: Database, collectionId: number): number {
  const stmt = db.prepare('SELECT COUNT(*) AS n FROM wishlist_items WHERE collection_id = ?')
  stmt.bind([collectionId])
  stmt.step()
  const count = (stmt.getAsObject()['n'] as number) ?? 0
  stmt.free()
  return count
}

// --------------------------------------------------------------------------
// Variantes: el mismo álbum, distinta copia
// --------------------------------------------------------------------------

/** Una copia hermana: mismo álbum, otro formato o edición. */
export interface VariantSibling {
  id: number
  artists: string
  title: string
  year: number | null
  format: PhysicalFormatId
  condition: ConditionId | null
  userCoverFront: string | null
  canonicalCover: string | null
}

/** Las OTRAS copias del mismo álbum. Nunca se incluye a sí mismo. */
export function variantsOf(db: Database, albumId: number): VariantSibling[] {
  const grupo = variantGroupOf(db, albumId)
  if (grupo === null) return []

  const siblings: VariantSibling[] = []
  const stmt = db.prepare(
    `SELECT id, artists, title, year, format, condition, user_cover_front, canonical_cover
     FROM albums WHERE variant_group_id = ? AND id != ?
     ORDER BY year, format`
  )
  stmt.bind([grupo, albumId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    siblings.push({
      id: row['id'] as number,
      artists: row['artists'] as string,
      title: row['title'] as string,
      year: row['year'] as number | null,
      format: row['format'] as PhysicalFormatId,
      condition: (row['condition'] as ConditionId | null) ?? null,
      userCoverFront: row['user_cover_front'] as string | null,
      canonicalCover: row['canonical_cover'] as string | null
    })
  }

  stmt.free()
  return siblings
}

function variantGroupOf(db: Database, albumId: number): number | null {
  const stmt = db.prepare('SELECT variant_group_id FROM albums WHERE id = ?')
  stmt.bind([albumId])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const value = stmt.getAsObject()['variant_group_id'] as number | null
  stmt.free()
  return value ?? null
}

function membersOfGroup(db: Database, groupId: number): number[] {
  const ids: number[] = []
  const stmt = db.prepare('SELECT id FROM albums WHERE variant_group_id = ?')
  stmt.bind([groupId])
  while (stmt.step()) ids.push(stmt.getAsObject()['id'] as number)
  stmt.free()
  return ids
}

/**
 * Declara que dos discos son el mismo álbum en copias distintas.
 *
 * Los casos posibles se resuelven todos igual: si ninguno tiene grupo se crea
 * uno; si uno lo tiene, el otro se suma; si los dos tienen grupos distintos, se
 * funden en uno solo. Es la operación que la gente espera de "vincular": no
 * importa en qué orden se vincularon las copias, terminan todas juntas.
 */
export function linkVariants(db: Database, albumId: number, otherAlbumId: number): void {
  if (albumId === otherAlbumId) return

  db.run('BEGIN TRANSACTION')

  try {
    const a = variantGroupOf(db, albumId)
    const b = variantGroupOf(db, otherAlbumId)

    if (a === null && b === null) {
      db.run('INSERT INTO variant_groups DEFAULT VALUES')
      const grupo = lastId(db)
      db.run('UPDATE albums SET variant_group_id = ? WHERE id IN (?, ?)', [
        grupo,
        albumId,
        otherAlbumId
      ])
    } else if (a !== null && b === null) {
      db.run('UPDATE albums SET variant_group_id = ? WHERE id = ?', [a, otherAlbumId])
    } else if (a === null && b !== null) {
      db.run('UPDATE albums SET variant_group_id = ? WHERE id = ?', [b, albumId])
    } else if (a !== b) {
      // Dos grupos que se funden: todo lo del segundo pasa al primero.
      db.run('UPDATE albums SET variant_group_id = ? WHERE variant_group_id = ?', [a, b])
      db.run('DELETE FROM variant_groups WHERE id = ?', [b])
    }

    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

/**
 * Saca un disco de su grupo de variantes.
 *
 * Si el grupo se queda con un solo disco, se disuelve: un grupo de uno no
 * significa nada y dejarlo haría que ese disco apareciera como "vinculado" sin
 * tener con qué.
 */
export function unlinkVariant(db: Database, albumId: number): void {
  const grupo = variantGroupOf(db, albumId)
  if (grupo === null) return

  db.run('BEGIN TRANSACTION')

  try {
    db.run('UPDATE albums SET variant_group_id = NULL WHERE id = ?', [albumId])

    const quedan = membersOfGroup(db, grupo)
    if (quedan.length <= 1) {
      db.run('UPDATE albums SET variant_group_id = NULL WHERE variant_group_id = ?', [grupo])
      db.run('DELETE FROM variant_groups WHERE id = ?', [grupo])
    }

    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

/**
 * Discos que probablemente sean el mismo álbum que este, sin vincular todavía.
 *
 * Se apoya en `release_group_id` de MusicBrainz, que dos ediciones del mismo
 * álbum comparten. Es una pista fiable y gratis: no hay que comparar títulos ni
 * adivinar nada. Los discos cargados a mano no lo tienen, así que no aparecen
 * aquí y se vinculan a mano.
 */
export function suggestedVariants(
  db: Database,
  collectionId: number,
  albumId: number
): VariantSibling[] {
  const stmt = db.prepare('SELECT release_group_id FROM albums WHERE id = ?')
  stmt.bind([albumId])
  const found = stmt.step()
  const releaseGroup = found
    ? (stmt.getAsObject()['release_group_id'] as string | null)
    : null
  stmt.free()

  if (!releaseGroup) return []

  const candidates: VariantSibling[] = []
  const query = db.prepare(
    `SELECT id, artists, title, year, format, condition, user_cover_front, canonical_cover
     FROM albums
     WHERE collection_id = ? AND release_group_id = ? AND id != ?
       AND variant_group_id IS NULL
     ORDER BY year, format`
  )
  query.bind([collectionId, releaseGroup, albumId])

  while (query.step()) {
    const row = query.getAsObject()
    candidates.push({
      id: row['id'] as number,
      artists: row['artists'] as string,
      title: row['title'] as string,
      year: row['year'] as number | null,
      format: row['format'] as PhysicalFormatId,
      condition: (row['condition'] as ConditionId | null) ?? null,
      userCoverFront: row['user_cover_front'] as string | null,
      canonicalCover: row['canonical_cover'] as string | null
    })
  }

  query.free()
  return candidates
}

// --------------------------------------------------------------------------
// Préstamos
// --------------------------------------------------------------------------

function rowToLoan(row: Record<string, SqlValue>): Loan {
  return {
    id: row['id'] as number,
    albumId: row['album_id'] as number,
    person: row['person'] as string,
    lentAt: row['lent_at'] as string,
    dueAt: (row['due_at'] as string | null) ?? null,
    returnedAt: (row['returned_at'] as string | null) ?? null,
    notes: (row['notes'] as string | null) ?? null
  }
}

/** Todos los préstamos de un disco, el más reciente primero. */
export function loansOf(db: Database, albumId: number): Loan[] {
  const loans: Loan[] = []
  const stmt = db.prepare('SELECT * FROM loans WHERE album_id = ? ORDER BY lent_at DESC, id DESC')
  stmt.bind([albumId])
  while (stmt.step()) loans.push(rowToLoan(stmt.getAsObject()))
  stmt.free()
  return loans
}

/** Un disco prestado ahora mismo, con el nombre del disco para poder listarlo. */
export interface ActiveLoan extends Loan {
  albumTitle: string
  albumArtists: string
  format: PhysicalFormatId
  userCoverFront: string | null
  canonicalCover: string | null
}

/** Lo que está fuera de casa en este momento, en toda la colección. */
export function activeLoans(db: Database, collectionId: number): ActiveLoan[] {
  const loans: ActiveLoan[] = []

  const stmt = db.prepare(
    `SELECT l.*, a.title AS album_title, a.artists AS album_artists, a.format,
            a.user_cover_front, a.canonical_cover
     FROM loans l
     JOIN albums a ON a.id = l.album_id
     WHERE l.returned_at IS NULL AND a.collection_id = ?
     ORDER BY l.due_at IS NULL, l.due_at, l.lent_at`
  )
  stmt.bind([collectionId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    loans.push({
      ...rowToLoan(row),
      albumTitle: row['album_title'] as string,
      albumArtists: row['album_artists'] as string,
      format: row['format'] as PhysicalFormatId,
      userCoverFront: row['user_cover_front'] as string | null,
      canonicalCover: row['canonical_cover'] as string | null
    })
  }

  stmt.free()
  return loans
}

/**
 * Anota que el disco salió prestado.
 *
 * Si ya estaba prestado y no había vuelto, ese préstamo se cierra con la fecha
 * de hoy antes de abrir el nuevo: un disco no puede estar en dos casas a la vez,
 * y dejar dos préstamos abiertos haría que la lista de "lo que está afuera"
 * mostrara el mismo disco dos veces.
 */
export function lendAlbum(
  db: Database,
  albumId: number,
  person: string,
  lentAt: string,
  dueAt: string | null,
  notes: string | null
): number {
  db.run('BEGIN TRANSACTION')

  try {
    db.run(
      'UPDATE loans SET returned_at = ? WHERE album_id = ? AND returned_at IS NULL',
      [lentAt, albumId]
    )
    db.run(
      'INSERT INTO loans (album_id, person, lent_at, due_at, notes) VALUES (?,?,?,?,?)',
      [albumId, person.trim(), lentAt, dueAt, notes]
    )
    const id = lastId(db)
    db.run('COMMIT')
    return id
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

export function returnLoan(db: Database, loanId: number, returnedAt: string): void {
  db.run('UPDATE loans SET returned_at = ? WHERE id = ?', [returnedAt, loanId])
}

export function deleteLoan(db: Database, loanId: number): void {
  db.run('DELETE FROM loans WHERE id = ?', [loanId])
}

// --------------------------------------------------------------------------
// Posibles duplicados
// --------------------------------------------------------------------------

/**
 * Normaliza un nombre para compararlo.
 *
 * Ignora mayúsculas, acentos, puntuación y espacios de más, para que
 * "Héroes del Silencio" y "heroes del silencio" cuenten como lo mismo. Es la
 * misma limpieza que usa `songKey` más abajo, extraída para que las dos
 * comparaciones se comporten igual.
 */
function comparableName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Un disco de la colección que se parece al que se está por agregar. */
export interface DuplicateCandidate {
  id: number
  artists: string
  title: string
  year: number | null
  format: PhysicalFormatId
  condition: ConditionId | null
  source: AlbumSource
}

/**
 * Busca discos que ya estén en la colección con el mismo artista y título.
 *
 * NO BLOQUEA NADA: tener dos copias del mismo disco es perfectamente normal en
 * una colección física — la edición original y la reedición, el vinilo y el CD.
 * Esto solo sirve para avisar antes de guardar, por si fue un descuido.
 *
 * La comparación es por artista + título normalizados, y no mira el formato ni
 * el año: justamente el caso interesante es "ya tienes este disco, en casete".
 *
 * @param excludeAlbumId Álbum a ignorar, para no avisar de que algo es duplicado
 *   de sí mismo al editarlo.
 */
export function findPossibleDuplicates(
  db: Database,
  collectionId: number,
  artists: string,
  title: string,
  excludeAlbumId?: number
): DuplicateCandidate[] {
  const wantedArtist = comparableName(artists)
  const wantedTitle = comparableName(title)
  if (wantedTitle.length === 0) return []

  const matches: DuplicateCandidate[] = []

  const stmt = db.prepare(
    `SELECT id, artists, title, year, format, condition, source
     FROM albums WHERE collection_id = ?`
  )
  stmt.bind([collectionId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    const id = row['id'] as number
    if (id === excludeAlbumId) continue

    if (comparableName(row['title'] as string) !== wantedTitle) continue
    if (comparableName(row['artists'] as string) !== wantedArtist) continue

    matches.push({
      id,
      artists: row['artists'] as string,
      title: row['title'] as string,
      year: row['year'] as number | null,
      format: row['format'] as PhysicalFormatId,
      condition: (row['condition'] as ConditionId | null) ?? null,
      source: normalizeSource(row['source'])
    })
  }

  stmt.free()
  return matches
}

// --------------------------------------------------------------------------
// Setlists
// --------------------------------------------------------------------------

export interface SetlistSummary {
  id: number
  name: string
  trackCount: number
  /** Suma de las duraciones conocidas, en segundos. */
  totalSeconds: number
  /** Canciones sin duración en el catálogo, para poder avisar que el total es parcial. */
  tracksWithoutDuration: number
  /** Imagen elegida por la persona: archivo propio o de Wikimedia Commons. */
  image: ImageRef | null
  createdAt: string
}

export interface SetlistEntry {
  trackId: number
  position: number
  title: string
  artist: string
  duration: string | null
  side: string
  number: number
  albumId: number
  albumTitle: string
  albumFormat: PhysicalFormatId
  userCoverFront: string | null
  canonicalCover: string | null
  deezerTrackId: number | null
  deezerTitle: string | null
  deezerArtist: string | null
  deezerUrl: string | null
  filePath: string | null
  fileFormat: string | null
}

export interface SetlistDetail {
  id: number
  name: string
  tracks: SetlistEntry[]
  image: ImageRef | null
  createdAt: string
}

export function createSetlist(db: Database, collectionId: number, name: string): number {
  db.run('INSERT INTO setlists (collection_id, name) VALUES (?,?)', [
    collectionId,
    name.trim()
  ])
  return lastId(db)
}

export function renameSetlist(db: Database, setlistId: number, name: string): void {
  db.run(
    "UPDATE setlists SET name = ?, updated_at = datetime('now') WHERE id = ?",
    [name.trim(), setlistId]
  )
}

export function deleteSetlist(db: Database, setlistId: number): void {
  db.run('DELETE FROM setlists WHERE id = ?', [setlistId])
}

export function listSetlists(db: Database, collectionId: number): SetlistSummary[] {
  const rows: Array<{
    id: number
    name: string
    createdAt: string
    trackCount: number
    image: ImageRef | null
  }> = []

  const stmt = db.prepare(
    `SELECT s.id, s.name, s.created_at, s.image,
            (SELECT COUNT(*) FROM setlist_tracks st WHERE st.setlist_id = s.id) AS track_count
     FROM setlists s
     WHERE s.collection_id = ?
     ORDER BY s.name COLLATE NOCASE`
  )
  stmt.bind([collectionId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    rows.push({
      id: row['id'] as number,
      name: row['name'] as string,
      createdAt: row['created_at'] as string,
      trackCount: row['track_count'] as number,
      image: parseImageRef(row['image'])
    })
  }
  stmt.free()

  return rows.map((row) => {
    const { totalSeconds, withoutDuration } = setlistDuration(db, row.id)
    return {
      ...row,
      totalSeconds,
      tracksWithoutDuration: withoutDuration
    }
  })
}

function setlistDuration(
  db: Database,
  setlistId: number
): { totalSeconds: number; withoutDuration: number } {
  let totalSeconds = 0
  let withoutDuration = 0

  const stmt = db.prepare(
    `SELECT t.duration FROM setlist_tracks st
     JOIN tracks t ON t.id = st.track_id
     WHERE st.setlist_id = ?`
  )
  stmt.bind([setlistId])

  while (stmt.step()) {
    const seconds = durationToSeconds(stmt.getAsObject()['duration'] as string | null)
    if (seconds === null) withoutDuration += 1
    else totalSeconds += seconds
  }

  stmt.free()
  return { totalSeconds, withoutDuration }
}

export function getSetlist(db: Database, setlistId: number): SetlistDetail | null {
  const head = db.prepare('SELECT id, name, created_at, image FROM setlists WHERE id = ?')
  head.bind([setlistId])

  if (!head.step()) {
    head.free()
    return null
  }

  const headRow = head.getAsObject()
  head.free()

  const tracks: SetlistEntry[] = []
  const stmt = db.prepare(
    `SELECT st.track_id, st.position,
            t.title, t.artist, t.duration, t.side, t.number,
            t.deezer_track_id, t.deezer_title, t.deezer_artist, t.deezer_url,
            a.id AS album_id, a.title AS album_title, a.format AS album_format,
            a.user_cover_front, a.canonical_cover,
            tf.path AS file_path, tf.format AS file_format
     FROM setlist_tracks st
     JOIN tracks t ON t.id = st.track_id
     JOIN albums a ON a.id = t.album_id
     LEFT JOIN track_files tf ON tf.track_id = t.id
     WHERE st.setlist_id = ?
     ORDER BY st.position`
  )
  stmt.bind([setlistId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    tracks.push({
      trackId: row['track_id'] as number,
      position: row['position'] as number,
      title: row['title'] as string,
      artist: row['artist'] as string,
      duration: row['duration'] as string | null,
      side: (row['side'] as string) ?? 'N/A',
      number: row['number'] as number,
      albumId: row['album_id'] as number,
      albumTitle: row['album_title'] as string,
      albumFormat: row['album_format'] as PhysicalFormatId,
      userCoverFront: row['user_cover_front'] as string | null,
      canonicalCover: row['canonical_cover'] as string | null,
      deezerTrackId: row['deezer_track_id'] as number | null,
      deezerTitle: row['deezer_title'] as string | null,
      deezerArtist: row['deezer_artist'] as string | null,
      deezerUrl: row['deezer_url'] as string | null,
      filePath: row['file_path'] as string | null,
      fileFormat: row['file_format'] as string | null
    })
  }

  stmt.free()

  return {
    id: headRow['id'] as number,
    name: headRow['name'] as string,
    createdAt: headRow['created_at'] as string,
    image: parseImageRef(headRow['image']),
    tracks
  }
}

/** Resultado de intentar agregar: si ya estaba, no se duplica y se avisa. */
export type AddToSetlistResult = 'added' | 'already-there'

export function addTrackToSetlist(
  db: Database,
  setlistId: number,
  trackId: number
): AddToSetlistResult {
  const check = db.prepare(
    'SELECT 1 FROM setlist_tracks WHERE setlist_id = ? AND track_id = ?'
  )
  check.bind([setlistId, trackId])
  const exists = check.step()
  check.free()

  if (exists) return 'already-there'

  const posStmt = db.prepare(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM setlist_tracks WHERE setlist_id = ?'
  )
  posStmt.bind([setlistId])
  posStmt.step()
  const nextPosition = (posStmt.getAsObject()['next'] as number) ?? 1
  posStmt.free()

  db.run(
    'INSERT INTO setlist_tracks (setlist_id, track_id, position) VALUES (?,?,?)',
    [setlistId, trackId, nextPosition]
  )
  db.run("UPDATE setlists SET updated_at = datetime('now') WHERE id = ?", [setlistId])

  return 'added'
}

export function removeTrackFromSetlist(
  db: Database,
  setlistId: number,
  trackId: number
): void {
  db.run('DELETE FROM setlist_tracks WHERE setlist_id = ? AND track_id = ?', [
    setlistId,
    trackId
  ])
  db.run("UPDATE setlists SET updated_at = datetime('now') WHERE id = ?", [setlistId])
}

/** Reescribe el orden completo. Recibe los ids de canción en el orden deseado. */
export function reorderSetlist(
  db: Database,
  setlistId: number,
  trackIdsInOrder: number[]
): void {
  db.run('BEGIN TRANSACTION')
  try {
    trackIdsInOrder.forEach((trackId, index) => {
      db.run(
        'UPDATE setlist_tracks SET position = ? WHERE setlist_id = ? AND track_id = ?',
        [index + 1, setlistId, trackId]
      )
    })
    db.run("UPDATE setlists SET updated_at = datetime('now') WHERE id = ?", [setlistId])
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

/** En qué setlists aparece cada canción de un álbum. Se usa para avisar antes de borrarlo. */
export interface SetlistUsage {
  trackCount: number
  setlistNames: string[]
}

export function setlistUsageForAlbum(db: Database, albumId: number): SetlistUsage {
  const countStmt = db.prepare(
    `SELECT COUNT(*) AS n FROM setlist_tracks st
     JOIN tracks t ON t.id = st.track_id
     WHERE t.album_id = ?`
  )
  countStmt.bind([albumId])
  countStmt.step()
  const trackCount = (countStmt.getAsObject()['n'] as number) ?? 0
  countStmt.free()

  const namesStmt = db.prepare(
    `SELECT DISTINCT s.name AS name FROM setlist_tracks st
     JOIN tracks t ON t.id = st.track_id
     JOIN setlists s ON s.id = st.setlist_id
     WHERE t.album_id = ?
     ORDER BY s.name COLLATE NOCASE`
  )
  namesStmt.bind([albumId])
  const setlistNames: string[] = []
  while (namesStmt.step()) setlistNames.push(namesStmt.getAsObject()['name'] as string)
  namesStmt.free()

  return { trackCount, setlistNames }
}

// --------------------------------------------------------------------------
// Setlist automático por género
// --------------------------------------------------------------------------

/*
  LIMITACIÓN QUE HAY QUE TENER PRESENTE:

  El género vive solo a nivel de álbum (columna `albums.genres`). La tabla
  `tracks` no tiene género y MusicBrainz tampoco lo entrega por canción de forma
  útil: existe a nivel de grabación pero casi nadie lo carga, y pedirlo costaría
  una consulta por canción con el límite de 1 por segundo.

  O sea: toda canción hereda el género de su disco. Un setlist de "Rock" sale de
  todas las canciones de todos los discos de rock, sin poder distinguir la balada
  del disco de rock. Es lo máximo que permiten los datos disponibles.
*/

export interface GenrePreview {
  /** Canciones distintas que coinciden, antes de aplicar el tope. */
  totalCandidates: number
  /** De cuántos discos salen. */
  albumCount: number
}

interface CandidateTrack {
  id: number
  title: string
  artist: string
}

/**
 * Clave para detectar la misma canción repetida.
 *
 * Hace falta porque `UNIQUE(setlist_id, track_id)` impide repetir la misma FILA,
 * pero no la misma CANCIÓN: si tienes el disco de estudio y además un grandes
 * éxitos, el mismo tema son dos filas distintas en `tracks`.
 */
function songKey(title: string, artist: string): string {
  // `comparableName` ignora mayúsculas, acentos y puntuación, así que "Corazon"
  // y "Corazón" cuentan como la misma canción.
  return `${comparableName(title)}::${comparableName(artist)}`
}

/** Agrupa las canciones candidatas por disco, ya sin repetidas. */
function candidatesByAlbum(
  db: Database,
  collectionId: number,
  genres: string[]
): CandidateTrack[][] {
  const wanted = new Set(genres.map((genre) => genre.toLowerCase()))
  if (wanted.size === 0) return []

  const matchingAlbumIds: number[] = []
  const albumStmt = db.prepare('SELECT id, genres FROM albums WHERE collection_id = ?')
  albumStmt.bind([collectionId])

  while (albumStmt.step()) {
    const row = albumStmt.getAsObject()
    const albumGenres = parseJson<string[]>(row['genres'], [])
    // Coincide con que tenga CUALQUIERA de los géneros elegidos.
    if (albumGenres.some((genre) => wanted.has(genre.toLowerCase()))) {
      matchingAlbumIds.push(row['id'] as number)
    }
  }
  albumStmt.free()

  const seen = new Set<string>()
  const buckets: CandidateTrack[][] = []

  const trackStmt = db.prepare(
    'SELECT id, title, artist FROM tracks WHERE album_id = ? ORDER BY side, number'
  )

  for (const albumId of matchingAlbumIds) {
    trackStmt.bind([albumId])
    const bucket: CandidateTrack[] = []

    while (trackStmt.step()) {
      const row = trackStmt.getAsObject()
      const title = row['title'] as string
      const artist = row['artist'] as string

      const key = songKey(title, artist)
      if (seen.has(key)) continue
      seen.add(key)

      bucket.push({ id: row['id'] as number, title, artist })
    }

    // No hace falta reiniciar a mano: el bind() de la vuelta siguiente lo hace.
    if (bucket.length > 0) buckets.push(bucket)
  }

  trackStmt.free()
  return buckets
}

/** Cuántas canciones daría esa combinación. Sirve para avisar antes de crear nada. */
export function previewGenreSelection(
  db: Database,
  collectionId: number,
  genres: string[]
): GenrePreview {
  const buckets = candidatesByAlbum(db, collectionId, genres)
  return {
    totalCandidates: buckets.reduce((sum, bucket) => sum + bucket.length, 0),
    albumCount: buckets.length
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Elige las canciones del setlist automático.
 *
 * Reparte por turnos entre los discos en vez de tomar las primeras N: si
 * alguien pide 20 canciones de rock teniendo 12 discos, tomar las primeras 20
 * le daría los dos primeros discos enteros. Repartiendo salen temas de muchos
 * discos, que es lo que sirve para un evento.
 *
 * @param limit Tope de canciones. null para todas las que coincidan.
 */
export function pickTracksByGenres(
  db: Database,
  collectionId: number,
  genres: string[],
  limit: number | null
): number[] {
  const buckets = shuffle(candidatesByAlbum(db, collectionId, genres))
  if (buckets.length === 0) return []

  const total = buckets.reduce((sum, bucket) => sum + bucket.length, 0)
  const target = limit === null ? total : Math.min(limit, total)

  const picked: number[] = []
  let round = 0

  while (picked.length < target) {
    let addedThisRound = false

    for (const bucket of buckets) {
      if (picked.length >= target) break
      const track = bucket[round]
      if (track) {
        picked.push(track.id)
        addedThisRound = true
      }
    }

    if (!addedThisRound) break // se agotaron todos los discos
    round += 1
  }

  return picked
}

/** Crea un setlist ya poblado, en una sola transacción. */
export function createSetlistWithTracks(
  db: Database,
  collectionId: number,
  name: string,
  trackIds: number[]
): number {
  db.run('BEGIN TRANSACTION')

  try {
    db.run('INSERT INTO setlists (collection_id, name) VALUES (?,?)', [
      collectionId,
      name.trim()
    ])
    const setlistId = lastId(db)

    trackIds.forEach((trackId, index) => {
      db.run(
        'INSERT INTO setlist_tracks (setlist_id, track_id, position) VALUES (?,?,?)',
        [setlistId, trackId, index + 1]
      )
    })

    db.run('COMMIT')
    return setlistId
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

/** Canciones de un álbum, con lo justo para el modo explorar. */
export interface BrowsableTrack {
  id: number
  title: string
  artist: string
  duration: string | null
  side: string
  number: number
}

export function listAlbumTracks(db: Database, albumId: number): BrowsableTrack[] {
  const tracks: BrowsableTrack[] = []

  const stmt = db.prepare(
    `SELECT id, title, artist, duration, side, number
     FROM tracks WHERE album_id = ? ORDER BY side, number`
  )
  stmt.bind([albumId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    tracks.push({
      id: row['id'] as number,
      title: row['title'] as string,
      artist: row['artist'] as string,
      duration: row['duration'] as string | null,
      side: (row['side'] as string) ?? 'N/A',
      number: row['number'] as number
    })
  }

  stmt.free()
  return tracks
}

export function albumCount(db: Database, collectionId: number): number {
  const stmt = db.prepare('SELECT COUNT(*) AS n FROM albums WHERE collection_id = ?')
  stmt.bind([collectionId])
  stmt.step()
  const count = (stmt.getAsObject()['n'] as number) ?? 0
  stmt.free()
  return count
}

// --------------------------------------------------------------------------
// Estadísticas del panel de inicio
// --------------------------------------------------------------------------

export interface CollectionStats {
  totalAlbums: number
  totalTracks: number
  totalPlays: number
  /** Álbumes por formato: [{ format, count }], del más frecuente al menos. */
  byFormat: Array<{ format: PhysicalFormatId; count: number }>
  /** Los 5 géneros más frecuentes. */
  topGenres: Array<{ genre: string; count: number }>
  /** Las 5 últimas incorporaciones. */
  recentAlbums: AlbumSummary[]
  /** Álbum al azar para la ruleta. Null si la colección está vacía. */
  randomAlbum: AlbumSummary | null
  /** Cuántos deseos pendientes. */
  wishlistCount: number
  /** Cuántos discos prestados ahora mismo. */
  activeLoansCount: number
}

export function collectionStats(db: Database, collectionId: number): CollectionStats {
  const albums = listAlbums(db, collectionId)
  const totalAlbums = albums.length

  // Total de canciones
  const trackStmt = db.prepare(
    `SELECT COUNT(*) AS n FROM tracks t
     JOIN albums a ON a.id = t.album_id
     WHERE a.collection_id = ?`
  )
  trackStmt.bind([collectionId])
  trackStmt.step()
  const totalTracks = (trackStmt.getAsObject()['n'] as number) ?? 0
  trackStmt.free()

  // Total de reproducciones
  const playStmt = db.prepare(
    `SELECT COUNT(*) AS n FROM plays p
     JOIN tracks t ON t.id = p.track_id
     JOIN albums a ON a.id = t.album_id
     WHERE a.collection_id = ?`
  )
  playStmt.bind([collectionId])
  playStmt.step()
  const totalPlays = (playStmt.getAsObject()['n'] as number) ?? 0
  playStmt.free()

  // Por formato
  const formatCounts = new Map<PhysicalFormatId, number>()
  for (const album of albums) {
    formatCounts.set(album.format, (formatCounts.get(album.format) ?? 0) + 1)
  }
  const byFormat = [...formatCounts.entries()]
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count)

  // Top géneros
  const genreCounts = new Map<string, number>()
  for (const album of albums) {
    for (const genre of album.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
    }
  }
  const topGenres = [...genreCounts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Recientes
  const recentAlbums = albums.slice(0, 5)

  // Ruleta
  const randomAlbum = totalAlbums > 0
    ? albums[Math.floor(Math.random() * totalAlbums)]
    : null

  // Deseos y préstamos
  const wCount = wishlistCount(db, collectionId)
  const loanStmt = db.prepare(
    `SELECT COUNT(*) AS n FROM loans l
     JOIN albums a ON a.id = l.album_id
     WHERE l.returned_at IS NULL AND a.collection_id = ?`
  )
  loanStmt.bind([collectionId])
  loanStmt.step()
  const activeLoansCount = (loanStmt.getAsObject()['n'] as number) ?? 0
  loanStmt.free()

  return {
    totalAlbums,
    totalTracks,
    totalPlays,
    byFormat,
    topGenres,
    recentAlbums,
    randomAlbum,
    wishlistCount: wCount,
    activeLoansCount
  }
}
