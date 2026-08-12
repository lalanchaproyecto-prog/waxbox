/**
 * Esquema de la base de datos local (SQLite).
 *
 * Nota sobre `format`: se guarda como texto libre y se valida en el código
 * (ver isValidFormatId en ../models/formats.ts) en vez de con un CHECK de SQL.
 * Así, agregar un formato físico nuevo no obliga a reconstruir la tabla.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  format TEXT NOT NULL,
  artists TEXT NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  genres TEXT,
  label TEXT,
  user_cover_front TEXT,
  user_cover_back TEXT,
  canonical_cover TEXT,
  description TEXT,
  description_source TEXT,
  musicbrainz_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id INTEGER NOT NULL,
  artist TEXT NOT NULL,
  side TEXT DEFAULT 'N/A',
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration TEXT,
  youtube_video_id TEXT,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);
`
