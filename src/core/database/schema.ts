import type { Database } from 'sql.js'

export const SCHEMA = `
PRAGMA foreign_keys = ON;

/*
  Una colección es un conjunto de discos separado del resto: "Mi colección",
  "Colección de mi papá". Los álbumes y los setlists pertenecen a una.
*/
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER,
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
  /*
    'musicbrainz' o 'manual'. Ver src/core/models/albumSource.ts: distingue el
    disco que se cargó entero a mano del que vino de un catálogo, para no
    reclamarle datos que nunca iba a tener.
  */
  source TEXT DEFAULT 'musicbrainz',
  artist_links TEXT,
  user_edited_fields TEXT,
  condition TEXT,
  notes TEXT,
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

CREATE TABLE IF NOT EXISTS setlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

/*
  Tabla intermedia: una canción puede estar en varios setlists y un setlist
  tiene varias canciones.

  Se apunta a tracks(id), que es un número interno que nunca cambia, y no al
  título: así renombrar una canción no rompe los setlists donde está.

  UNIQUE evita que la misma canción entre dos veces al mismo setlist.
*/
CREATE TABLE IF NOT EXISTS setlist_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setlist_id INTEGER NOT NULL,
  track_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  UNIQUE (setlist_id, track_id)
);

`

/**
 * Índices que dependen de columnas agregadas por migración.
 *
 * Van aparte de SCHEMA a propósito: en una base que ya existía, el
 * `CREATE TABLE IF NOT EXISTS` no agrega columnas nuevas, así que
 * `collection_id` recién aparece cuando corren las migraciones. Si estos
 * índices vivieran dentro de SCHEMA se ejecutarían antes de eso y la app
 * reventaría al abrir con "no such column: collection_id".
 */
export const INDEXES = `
CREATE INDEX IF NOT EXISTS idx_albums_collection ON albums(collection_id);
CREATE INDEX IF NOT EXISTS idx_setlists_collection ON setlists(collection_id);
`

/** Nombre de la colección que se crea sola para quien nunca eligió una. */
export const DEFAULT_COLLECTION_NAME = 'Mi colección'

interface ColumnAddition {
  table: string
  column: string
  /** Tipo y valor por omisión, tal cual van después de ADD COLUMN. */
  type: string
}

export interface Migration {
  version: number
  /** Para poder decir en el log qué se está aplicando. */
  description: string
  addColumns: ColumnAddition[]
}

/**
 * Cambios de esquema sobre bases que ya existen.
 *
 * Las columnas nuevas se agregan comprobando antes si ya están, con
 * PRAGMA table_info. Antes esto se resolvía con un try/catch que se tragaba
 * CUALQUIER error y subía igual el número de versión: para un ADD COLUMN pasaba
 * inadvertido, pero en una migración que mueve datos habría marcado el trabajo
 * como hecho dejando la base a medias. Ahora los errores de verdad se propagan
 * y la app falla de forma ruidosa en vez de corromper en silencio.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Estado de conservación y notas personales del álbum',
    addColumns: [
      { table: 'albums', column: 'condition', type: 'TEXT' },
      { table: 'albums', column: 'notes', type: 'TEXT' }
    ]
  },
  {
    version: 2,
    description: 'Colecciones múltiples dentro de un mismo perfil',
    addColumns: [
      { table: 'albums', column: 'collection_id', type: 'INTEGER' },
      { table: 'setlists', column: 'collection_id', type: 'INTEGER' }
    ]
  },
  {
    version: 3,
    description: 'Marca de origen del álbum: catálogo automático o carga manual',
    /*
      El valor por omisión no es decorativo: SQLite rellena con él las filas que
      ya existían, así que toda la colección anterior queda marcada como
      'musicbrainz', que es exactamente lo que era.
    */
    addColumns: [
      { table: 'albums', column: 'source', type: "TEXT DEFAULT 'musicbrainz'" }
    ]
  }
]

/** La versión a la que debe llegar cualquier base después de migrar. */
export const LATEST_SCHEMA_VERSION = MIGRATIONS.reduce(
  (max, migration) => Math.max(max, migration.version),
  0
)

/** Comprueba si una columna existe, para no depender de que el ALTER falle. */
export function columnExists(db: Database, table: string, column: string): boolean {
  const rows = db.exec(`PRAGMA table_info(${table})`)
  if (rows.length === 0) return false
  // PRAGMA table_info devuelve (cid, name, type, notnull, dflt_value, pk).
  return rows[0].values.some((row) => row[1] === column)
}
