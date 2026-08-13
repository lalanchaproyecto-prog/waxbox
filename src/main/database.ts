import { join, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
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

export function persist(): void {
  if (!db) return
  const path = dbPath()
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, db.export())
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
