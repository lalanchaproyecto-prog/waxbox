declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database
  }

  interface QueryExecResult {
    columns: string[]
    values: SqlValue[][]
  }

  type SqlValue = string | number | Uint8Array | null

  interface Statement {
    bind(params?: SqlValue[]): boolean
    step(): boolean
    getAsObject(): Record<string, SqlValue>
    free(): void
  }

  interface Database {
    run(sql: string, params?: SqlValue[]): Database
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }

  interface SqlJsConfig {
    locateFile?: (filename: string) => string
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
  export type { Database, SqlValue, QueryExecResult, Statement, SqlJsStatic }
}
