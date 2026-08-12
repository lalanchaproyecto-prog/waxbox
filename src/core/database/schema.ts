export const SCHEMA = `
PRAGMA foreign_keys = ON;

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
  description_url TEXT,
  musicbrainz_id TEXT,
  artist_links TEXT,
  user_edited_fields TEXT,
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
  deezer_track_id INTEGER,
  deezer_title TEXT,
  deezer_artist TEXT,
  deezer_url TEXT,
  user_edited_fields TEXT,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS track_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  artist TEXT NOT NULL,
  detail TEXT,
  source TEXT NOT NULL DEFAULT 'musicbrainz',
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
`
