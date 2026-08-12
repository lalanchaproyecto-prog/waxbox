import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import { initSchema } from '../core/database/db'

const DB_FILENAME = 'waxbox.db'

let db: Database | null = null

function dbPath(): string {
  return join(app.getPath('userData'), DB_FILENAME)
}

function wasmPath(): string {
  const sqlJsMain = dirname(require.resolve('sql.js'))
  const normal = join(sqlJsMain, 'sql-wasm.wasm')
  const unpacked = normal.replace('app.asar', 'app.asar.unpacked')
  if (existsSync(unpacked)) return unpacked
  return normal
}

export async function openDatabase(): Promise<Database> {
  const wasm = wasmPath()
  const SQL = await initSqlJs({ locateFile: () => wasm })

  const path = dbPath()

  if (existsSync(path)) {
    const buffer = readFileSync(path)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  initSchema(db)
  persist()

  return db
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
  }
}
