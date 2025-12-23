import db from '@adonisjs/lucid/services/db'
import dbConfig from '#config/database'

export interface FindReplaceOptions {
  search: string
  replace: string
  tables: string[]
  dryRun: boolean
}

export interface ReplaceResult {
  table: string
  column: string
  matches: number
  replacements: number
}

class FindReplaceService {
  /**
   * Get list of searchable tables and their text/json columns
   */
  async getSearchableTables(): Promise<Array<{ name: string; columns: string[] }>> {
    const connectionName = dbConfig.connection
    const dialectName = dbConfig.connections[connectionName].client

    let allTables: string[] = []

    if (dialectName === 'postgres' || dialectName === 'pg') {
      const result = await db.rawQuery(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      )
      allTables = result.rows.map((row: any) => row.tablename)
    } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
      const result = await db.rawQuery(`SHOW TABLES`)
      const key = Object.keys(result[0][0])[0]
      allTables = result[0].map((row: any) => row[key])
    } else if (dialectName === 'sqlite' || dialectName === 'better-sqlite3') {
      const result = await db.rawQuery(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      allTables = result.map((row: any) => row.name)
    }

    const searchableTables: Array<{ name: string; columns: string[] }> = []

    for (const table of allTables) {
      if (['adonis_schema', 'adonis_schema_versions'].includes(table)) continue

      const columns: string[] = []
      
      if (dialectName === 'postgres' || dialectName === 'pg') {
        const colResult = await db.rawQuery(
          `SELECT column_name, data_type 
           FROM information_schema.columns 
           WHERE table_name = ? AND table_schema = 'public'`,
          [table]
        )
        for (const row of colResult.rows) {
          const type = row.data_type.toLowerCase()
          if (
            type.includes('char') || 
            type.includes('text') || 
            type.includes('json') || 
            type.includes('uuid')
          ) {
            columns.push(row.column_name)
          }
        }
      } else if (dialectName === 'sqlite' || dialectName === 'better-sqlite3') {
        const colResult = await db.rawQuery(`PRAGMA table_info(${table})`)
        for (const row of colResult) {
          const type = row.type.toLowerCase()
          // SQLite types are loose, but usually contain these
          if (
            type === '' || // dynamic
            type.includes('char') || 
            type.includes('text') || 
            type.includes('clob')
          ) {
            columns.push(row.name)
          }
        }
      }

      if (columns.length > 0) {
        searchableTables.push({ name: table, columns })
      }
    }

    return searchableTables
  }

  /**
   * Perform the find and replace operation
   */
  async performReplace(options: FindReplaceOptions): Promise<{
    summary: ReplaceResult[]
    totalMatches: number
    totalReplacements: number
  }> {
    const { search, replace, tables, dryRun } = options
    const summary: ReplaceResult[] = []
    let totalMatches = 0
    let totalReplacements = 0

    if (!search) {
      throw new Error('Search string is required')
    }

    const searchableTables = await this.getSearchableTables()
    const targetTables = searchableTables.filter((t) => tables.includes(t.name))

    for (const table of targetTables) {
      for (const column of table.columns) {
        try {
          // Count matches first
          const countResult = await db
            .from(table.name)
            .whereRaw(`CAST(?? AS TEXT) LIKE ?`, [column, `%${search}%`])
            .count('* as count')
            .first()
          
          const matches = Number(countResult?.count || 0)
          
          if (matches > 0) {
            totalMatches += matches
            
            if (!dryRun) {
              const dialectName = dbConfig.connections[dbConfig.connection].client
              const isPostgres = dialectName === 'postgres' || dialectName === 'pg'
              const isSqlite = dialectName === 'sqlite' || dialectName === 'better-sqlite3'

              let affected = 0
              if (isPostgres) {
                const castType = this.getColumnTypeForCast(table.name, column)
                // Use rawQuery to avoid Lucid's serialization of Raw objects in .update()
                // We use manual quoting for identifiers to be safe across different Lucid/Knex versions
                const result = await db.rawQuery(
                  `UPDATE "${table.name}" 
                   SET "${column}" = REPLACE(CAST("${column}" AS TEXT), ?, ?)::${castType} 
                   WHERE CAST("${column}" AS TEXT) LIKE ?`,
                  [search, replace, `%${search}%`]
                )
                affected = result.rowCount || 0
              } else if (isSqlite) {
                const result = await db.rawQuery(
                  `UPDATE "${table.name}" 
                   SET "${column}" = REPLACE("${column}", ?, ?) 
                   WHERE "${column}" LIKE ?`,
                  [search, replace, `%${search}%`]
                )
                // for better-sqlite3 result is often an object with changes
                affected = typeof result.changes === 'number' ? result.changes : 0
              }

              totalReplacements += affected
              summary.push({ table: table.name, column, matches, replacements: affected })
            } else {
              summary.push({ table: table.name, column, matches, replacements: 0 })
            }
          }
        } catch (error) {
          console.error(`Error in find/replace for ${table.name}.${column}:`, error)
        }
      }
    }

    return {
      summary,
      totalMatches,
      totalReplacements: dryRun ? 0 : totalReplacements
    }
  }

  private getColumnTypeForCast(_table: string, column: string): string {
    const col = column.toLowerCase()
    // This is a bit simplified, but helps avoid casting issues in PG
    if (
      col.includes('json') ||
      col.includes('metadata') ||
      col.includes('draft') ||
      col.includes('props') ||
      col.includes('overrides') ||
      col === 'snapshot' ||
      col === 'settings' ||
      col === 'data' ||
      col === 'payload'
    ) {
      return 'JSONB'
    }
    if (col === 'id' || col.endsWith('_id')) {
      return 'UUID'
    }
    return 'TEXT'
  }
}

const findReplaceService = new FindReplaceService()
export default findReplaceService


