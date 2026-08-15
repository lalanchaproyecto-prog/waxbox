import { join, dirname } from 'path'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  renameSync,
  unlinkSync
} from 'fs'
import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import { initSchema } from '../core/database/db'
import { LATEST_SCHEMA_VERSION } from '../core/database/schema'

let db: Database | null = null

/**
 * Ruta del archivo abierto ahora mismo.
 *
 * Ya no es fija: cada perfil tiene su propia base, así que la ruta la decide
 * quien abre la base y se recuerda aquí para poder guardar los cambios.
 */
let currentPath: string | null = null

function dbPath(): string {
  if (!currentPath) throw new Error('La base de datos no está abierta.')
  return currentPath
}

function wasmPath(): string {
  const sqlJsMain = dirname(require.resolve('sql.js'))
  const normal = join(sqlJsMain, 'sql-wasm.wasm')
  const unpacked = normal.replace('app.asar', 'app.asar.unpacked')
  if (existsSync(unpacked)) return unpacked
  return normal
}

/**
 * Abre la base de un perfil. Si ya había otra abierta, la cierra guardando antes.
 */
export async function openDatabase(path: string): Promise<Database> {
  if (db) closeDatabase()

  const wasm = wasmPath()
  const SQL = await initSqlJs({ locateFile: () => wasm })

  currentPath = path

  if (existsSync(path)) {
    const buffer = readFileSync(path)
    db = new SQL.Database(buffer)
    backupBeforeMigrating(db, path)
  } else {
    db = new SQL.Database()
  }

  initSchema(db)
  persist()

  return db
}

function schemaVersionOf(database: Database): number {
  const rows = database.exec('PRAGMA user_version')
  return (rows[0]?.values[0]?.[0] as number) ?? 0
}

/**
 * Guarda una copia del archivo antes de cambiarle el esquema.
 *
 * Una migración toca la base entera y no se puede deshacer. La copia es barata
 * —un archivo de unos pocos megas— y es la diferencia entre un susto y perder
 * una colección cargada a mano durante meses.
 *
 * Solo se hace cuando hay algo que migrar, así no se llena la carpeta de copias
 * en cada arranque.
 */
function backupBeforeMigrating(database: Database, path: string): void {
  const current = schemaVersionOf(database)
  if (current >= LATEST_SCHEMA_VERSION) return

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${path}.v${current}-${stamp}.backup`

  try {
    copyFileSync(path, backupPath)
    console.log(`[waxbox] Respaldo antes de migrar: ${backupPath}`)
  } catch (error) {
    // Si no se pudo respaldar, es más seguro no migrar que arriesgar los datos.
    throw new Error(
      'No se pudo respaldar la base de datos antes de actualizarla, así que no se ' +
        'hicieron cambios. Revisa que haya espacio en disco y permisos de escritura. ' +
        `(${String(error)})`
    )
  }
}

export function getDatabase(): Database {
  if (!db) throw new Error('La base de datos no está abierta.')
  return db
}

/*
  GUARDAR SIN PODER DEJAR EL ARCHIVO A MEDIAS.

  sql.js tiene la base entera en memoria, así que «guardar» es reescribir el
  archivo completo. Y esto se llama MUCHO: hay 31 puntos que lo invocan —cada
  disco que se guarda, cada renombrado, cada canción que se escucha—, así que
  a lo largo de una tarde de catalogación el archivo se reescribe cientos de
  veces.

  Antes se escribía directamente encima con `writeFileSync`. Eso significa que
  el archivo real pasa por un estado truncado en cada una de esas veces: si en
  ese instante se va la luz, se cuelga el equipo o alguien mata el proceso, lo
  que queda en disco es medio archivo. Y medio archivo de SQLite no se abre:
  es la colección entera perdida, no el último cambio.

  Con la ventana de riesgo multiplicada por cientos de escrituras al día, era
  cuestión de tiempo. Ahora se escribe a un archivo temporal y se renombra
  encima: renombrar dentro del mismo disco es atómico, así que en cualquier
  instante lo que hay en la ruta buena es la versión vieja completa o la nueva
  completa, nunca una mitad.

  El respaldo de antes de migrar sigue siendo necesario y hace otra cosa:
  protege de una migración equivocada, no de un corte a mitad de escritura.
*/
export function persist(): void {
  if (!db) return
  const path = dbPath()
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const temporal = `${path}.tmp`
  try {
    writeFileSync(temporal, db.export())
    renameSync(temporal, path)
  } catch (error) {
    /*
      Si algo falla, se limpia el temporal para no ir dejando basura al lado de
      la base. El error se vuelve a lanzar: quien llamó tiene que enterarse de
      que su cambio no quedó guardado.
    */
    try {
      if (existsSync(temporal)) unlinkSync(temporal)
    } catch {
      // Si tampoco se puede borrar, no vale la pena tapar el error de verdad.
    }
    throw error
  }
}

export function closeDatabase(): void {
  if (db) {
    persist()
    db.close()
    db = null
    currentPath = null
  }
}

/** Si hay una base abierta. La usa la interfaz para saber si ya se eligió perfil. */
export function isDatabaseOpen(): boolean {
  return db !== null
}
