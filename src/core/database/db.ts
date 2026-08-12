import type { Database, SqlValue } from 'sql.js'
import type { EditableAlbum, EditableTrack } from '../albumDraft'
import type { PhysicalFormatId } from '../models/formats'
import type { Credit } from '../models/credits'
import type { ArtistLink } from '../services/musicbrainz'
import type { DeezerTrackRef } from '../services/deezer'
import { SCHEMA } from './schema'

export interface AlbumSummary {
  id: number
  format: PhysicalFormatId
  artists: string
  title: string
  year: number | null
  genres: string[]
  label: string | null
  userCoverFront: string | null
  canonicalCover: string | null
  trackCount: number
  createdAt: string
}

export interface SavedTrack {
  artist: string
  side: string
  number: number
  title: string
  duration: string | null
  deezer: DeezerTrackRef | null
  credits: Credit[]
  userEditedFields: string[]
}

export interface SavedAlbum {
  id: number
  format: PhysicalFormatId
  artists: string
  title: string
  year: number | null
  genres: string[]
  label: string | null
  userCoverFront: string | null
  userCoverBack: string | null
  canonicalCover: string | null
  description: string | null
  descriptionSource: string | null
  descriptionUrl: string | null
  musicbrainzId: string | null
  artistLinks: ArtistLink[]
  userEditedFields: string[]
  tracks: SavedTrack[]
  createdAt: string
  updatedAt: string
}

export function initSchema(db: Database): void {
  db.exec(SCHEMA)
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

export function saveAlbum(
  db: Database,
  album: EditableAlbum,
  photos: { front: string | null; back: string | null }
): number {
  db.run('BEGIN TRANSACTION')

  try {
    db.run(
      `INSERT INTO albums
        (format, artists, title, year, genres, label,
         user_cover_front, user_cover_back, canonical_cover,
         description, description_source, description_url,
         musicbrainz_id, artist_links, user_edited_fields)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
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
        jsonOrEmpty(album.artistLinks),
        jsonOrEmpty(album.userEditedFields)
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

export function listAlbums(db: Database): AlbumSummary[] {
  const rows = db.exec(
    `SELECT a.id, a.format, a.artists, a.title, a.year, a.genres, a.label,
            a.user_cover_front, a.canonical_cover, a.created_at,
            (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id) AS track_count
     FROM albums a
     ORDER BY a.created_at DESC`
  )

  if (rows.length === 0) return []

  return rows[0].values.map((row) => ({
    id: row[0] as number,
    format: row[1] as PhysicalFormatId,
    artists: row[2] as string,
    title: row[3] as string,
    year: row[4] as number | null,
    genres: parseJson<string[]>(row[5], []),
    label: row[6] as string | null,
    userCoverFront: row[7] as string | null,
    canonicalCover: row[8] as string | null,
    createdAt: row[9] as string,
    trackCount: row[10] as number
  }))
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
    userCoverFront: row['user_cover_front'] as string | null,
    userCoverBack: row['user_cover_back'] as string | null,
    canonicalCover: row['canonical_cover'] as string | null,
    description: row['description'] as string | null,
    descriptionSource: row['description_source'] as string | null,
    descriptionUrl: row['description_url'] as string | null,
    musicbrainzId: row['musicbrainz_id'] as string | null,
    artistLinks: parseJson<ArtistLink[]>(row['artist_links'], []),
    userEditedFields: parseJson<string[]>(row['user_edited_fields'], []),
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
      artist: row['artist'] as string,
      side: (row['side'] as string) ?? 'N/A',
      number: row['number'] as number,
      title: row['title'] as string,
      duration: row['duration'] as string | null,
      deezer,
      credits: loadCredits(db, trackId),
      userEditedFields: parseJson<string[]>(row['user_edited_fields'], [])
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

export function deleteAlbum(db: Database, albumId: number): void {
  db.run('DELETE FROM albums WHERE id = ?', [albumId])
}

export function albumCount(db: Database): number {
  const rows = db.exec('SELECT COUNT(*) FROM albums')
  if (rows.length === 0) return 0
  return rows[0].values[0][0] as number
}
