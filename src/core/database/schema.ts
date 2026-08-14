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

/*
  Archivo de audio propio de una canción.

  Guarda la RUTA al archivo donde ya está, sin copiarlo. Copiar un álbum en
  FLAC serían cientos de megas duplicados; las fotos sí se copian porque pesan
  kilobytes. El costo de esta decisión es que si la persona mueve la carpeta,
  la app tiene que avisar que el archivo no está en vez de fallar callada.

  UNIQUE en track_id: una canción tiene un archivo propio o ninguno.
*/
CREATE TABLE IF NOT EXISTS track_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  /* Extensión en minúsculas: mp3, flac, m4a, wav, ogg, opus. */
  format TEXT NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  UNIQUE (track_id)
);

/*
  Historial de reproducciones.

  Nada lo lee todavía: lo van a usar el panel de inicio y las listas
  inteligentes ("no lo escucho hace tiempo", racha de escucha). Se registra
  desde ahora porque el historial NO se puede reconstruir hacia atrás — si
  empezara a guardarse recién cuando exista quien lo lea, esas funciones
  nacerían sin ningún dato que mostrar.
*/
CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL,
  played_at TEXT DEFAULT (datetime('now')),
  /* De dónde sonó: 'archivo', 'deezer' o 'youtube'. */
  source TEXT NOT NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

/*
  Lista de deseos: discos que la persona QUIERE, no que tiene.

  Va en su propia tabla y no como una marca en 'albums' a propósito. Un deseo
  no tiene tracklist, ni estado de conservación, ni fotos, ni archivos de audio;
  meterlo en 'albums' obligaría a que cada consulta de la colección recordara
  excluirlo, y el día que una se olvidara aparecerían discos que nadie tiene
  mezclados con los de verdad.
*/
CREATE TABLE IF NOT EXISTS wishlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL,
  artists TEXT NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  /* Formato deseado. Puede ser null: a veces da igual en cuál venga. */
  format TEXT,
  notes TEXT,
  /* Cuánto se quiere: 1 alta, 2 media, 3 baja. */
  priority INTEGER DEFAULT 2,
  /* Dónde se vio y a qué precio, si se anotó. */
  seen_at TEXT,
  price TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

/*
  Grupos de variantes: el mismo álbum en distintas copias.

  El grupo es una fila vacía a propósito — solo un identificador. Lo que une a
  los discos es que comparten albums.variant_group_id. Modelarlo así permite
  vincular y desvincular sin tocar los discos entre sí, y que el grupo
  desaparezca solo cuando se queda con uno.
*/
CREATE TABLE IF NOT EXISTS variant_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now'))
);

/*
  Préstamos.

  Es una tabla con historial y no un par de columnas en 'albums' porque un disco
  se presta muchas veces a lo largo de los años. Con columnas, prestar de nuevo
  borraría el registro anterior; así queda "a quién se lo presté y cuándo
  volvió" para siempre.

  El préstamo en curso es el que tiene returned_at en NULL.
*/
CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id INTEGER NOT NULL,
  person TEXT NOT NULL,
  lent_at TEXT NOT NULL,
  /* Cuándo debería volver. Null si no se acordó fecha. */
  due_at TEXT,
  /* Null mientras siga prestado. */
  returned_at TEXT,
  notes TEXT,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS setlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

/*
  Listas inteligentes: un filtro guardado con nombre.

  Guarda CRITERIOS, no discos. "Vinilos de los 70 en muy buen estado" no es
  una lista congelada el día que se creó: es una pregunta que se vuelve a
  hacer cada vez que se mira, así que un disco que entre mañana y cumpla las
  condiciones aparece solo.

  Por eso NO hay tabla intermedia con los discos de cada lista, a diferencia
  de setlist_tracks: no hay nada que guardar salvo la pregunta.

  Los criterios van como JSON en una sola columna. Son un puñado de campos
  opcionales que siempre se leen juntos y nunca se consultan por separado —
  normalizarlos en columnas obligaría a migrar el esquema cada vez que se
  agregue un filtro nuevo a la pantalla de colección.
*/
CREATE TABLE IF NOT EXISTS smart_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  criteria TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_track_files_track ON track_files(track_id);
CREATE INDEX IF NOT EXISTS idx_plays_track ON plays(track_id);
CREATE INDEX IF NOT EXISTS idx_plays_when ON plays(played_at);
CREATE INDEX IF NOT EXISTS idx_wishlist_collection ON wishlist_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_loans_album ON loans(album_id);
CREATE INDEX IF NOT EXISTS idx_albums_variant ON albums(variant_group_id);
CREATE INDEX IF NOT EXISTS idx_albums_release_group ON albums(release_group_id);
CREATE INDEX IF NOT EXISTS idx_smart_lists_collection ON smart_lists(collection_id);
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
  },
  {
    version: 4,
    description: 'Imágenes de colección y setlist, y etiquetas propias del álbum',
    addColumns: [
      /*
        La imagen se guarda como JSON y no como una ruta suelta porque tiene que
        llevar pegada la atribución: las imágenes de Wikimedia Commons exigen
        crédito al autor y mención de la licencia. Ver models/imageRef.ts.
      */
      { table: 'collections', column: 'image', type: 'TEXT' },
      { table: 'setlists', column: 'image', type: 'TEXT' },
      /*
        Etiquetas libres que escribe la persona ("regalo", "firmado", "de mi
        papá"). Van como lista JSON en la misma columna, igual que los géneros:
        se filtran en memoria sobre una colección personal, así que una tabla
        aparte con sus uniones sería complejidad sin ninguna ganancia.
      */
      { table: 'albums', column: 'tags', type: 'TEXT' }
    ]
  },
  {
    version: 5,
    description: 'Registro de compra, variantes vinculadas y grupo de edición',
    addColumns: [
      /*
        El registro de compra va en columnas sueltas y no en un JSON: la línea
        de tiempo de gustos por año de compra que viene después necesita poder
        ordenar y agrupar por fecha, y eso dentro de un JSON no se puede.
      */
      { table: 'albums', column: 'purchase_place', type: 'TEXT' },
      { table: 'albums', column: 'purchase_date', type: 'TEXT' },
      { table: 'albums', column: 'purchase_price', type: 'TEXT' },
      /* Qué disco es "el mismo álbum, otra copia". Null si no está vinculado. */
      { table: 'albums', column: 'variant_group_id', type: 'INTEGER' },
      /*
        Identificador del grupo de edición en MusicBrainz.

        Dos ediciones del mismo álbum lo comparten, así que es lo que permite
        SUGERIR una vinculación sola: al agregar el CD de un disco que ya se
        tiene en vinilo, la app puede darse cuenta. Ya se traía en la ficha pero
        se descartaba sin guardarlo. Los discos manuales no lo tienen y solo se
        pueden vincular a mano.
      */
      { table: 'albums', column: 'release_group_id', type: 'TEXT' }
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
