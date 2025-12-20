import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import dbConfig from '#config/database'

/**
 * Export format version for compatibility checking
 */
const EXPORT_FORMAT_VERSION = '2.0.0'

/**
 * Tables to exclude from export (session data, temporary data, etc.)
 */
const EXCLUDED_TABLES = [
  'adonis_schema',
  'adonis_schema_versions',
  // Add other temporary tables as needed
]

/**
 * Content types and their associated tables
 */
export type ContentType =
  | 'media'
  | 'posts'
  | 'modules'
  | 'forms'
  | 'menus'
  | 'categories'
  | 'module_groups'

const CONTENT_TYPE_TABLES: Record<ContentType, string[]> = {
  media: ['media_assets'],
  posts: [
    'posts',
    'post_revisions',
    'post_modules',
    // Custom field definitions + attachments
    'custom_fields',
    'post_type_custom_fields',
    'post_custom_field_values',
    // Preview system (token-based previews)
    'preview_tokens',
  ],
  modules: ['module_instances', 'module_scopes'],
  forms: ['forms', 'form_submissions'],
  menus: ['menus', 'menu_items'],
  categories: ['taxonomies', 'taxonomy_terms', 'post_taxonomy_terms'],
  module_groups: [
    'module_groups',
    'module_group_modules',
    'url_patterns',
    // Routing + per-post-type settings
    'url_redirects',
    'post_type_settings',
    // Webhooks (automation configuration + delivery history)
    'webhooks',
    'webhook_deliveries',
  ],
}

/**
 * Export options
 */
export interface ExportOptions {
  /**
   * Which content types to include (if undefined, exports all)
   */
  contentTypes?: ContentType[]

  /**
   * Whether to preserve original IDs
   * If false, IDs will be regenerated on import
   */
  preserveIds?: boolean

  /**
   * Whether to include media files (creates a zip archive)
   */
  includeMediaFiles?: boolean
}

/**
 * Database Export Service
 * Handles exporting the entire database to a portable JSON format
 */
class DatabaseExportService {
  /**
   * Export the database to a JSON structure with optional content filtering
   * @param options Export options
   * @returns Promise<object> Export data with metadata and table data
   */
  async exportDatabase(options: ExportOptions = {}): Promise<{
    metadata: {
      version: string
      exportedAt: string
      databaseType: string
      tableCount: number
      contentTypes?: ContentType[]
      preserveIds: boolean
    }
    tables: Record<string, any[]>
  }> {
    const { contentTypes, preserveIds = true } = options

    console.log('📤 Starting database export...')
    console.log(`   Content types: ${contentTypes ? contentTypes.join(', ') : 'ALL'}`)
    console.log(`   Preserve IDs: ${preserveIds}`)

    const tables = await this.getExportableTables(contentTypes)
    console.log(`📊 Exporting ${tables.length} tables:`, tables.join(', '))

    const tableData: Record<string, any[]> = {}
    let totalRows = 0

    // Export each table
    for (const tableName of tables) {
      try {
        let rows = await db.from(tableName).select('*')

        console.log(`   📦 ${tableName}: ${rows.length} rows`)
        totalRows += rows.length

        // Strip IDs if not preserving them
        if (!preserveIds) {
          rows = rows.map((row) => {
            const { id, ...rest } = row
            return rest
          })
        }

        tableData[tableName] = rows
      } catch (error) {
        console.error(`   ❌ Failed to export table ${tableName}:`, (error as Error).message)
        throw new Error(`Failed to export table ${tableName}: ${(error as Error).message}`)
      }
    }

    console.log(`✅ Export complete: ${tables.length} tables, ${totalRows} total rows`)

    return {
      metadata: {
        version: EXPORT_FORMAT_VERSION,
        exportedAt: DateTime.now().toISO(),
        databaseType: dbConfig.connections[dbConfig.connection].client,
        tableCount: tables.length,
        contentTypes,
        preserveIds,
      },
      tables: tableData,
    }
  }

  /**
   * Get list of tables to export (excluding system tables)
   * @param contentTypes Optional array of content types to filter by
   */
  private async getExportableTables(contentTypes?: ContentType[]): Promise<string[]> {
    // Get the database client type from the config
    const connectionName = dbConfig.connection
    const dialectName = dbConfig.connections[connectionName].client

    let allTables: string[] = []

    if (dialectName === 'postgres' || dialectName === 'pg') {
      // PostgreSQL
      const result = await db.rawQuery(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      )
      allTables = result.rows.map((row: any) => row.tablename)
    } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
      // MySQL
      const result = await db.rawQuery(`SHOW TABLES`)
      const key = Object.keys(result[0][0])[0]
      allTables = result[0].map((row: any) => row[key])
    } else if (dialectName === 'sqlite' || dialectName === 'better-sqlite3') {
      // SQLite
      const result = await db.rawQuery(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      allTables = result.map((row: any) => row.name)
    } else {
      throw new Error(`Unsupported database dialect: ${dialectName}`)
    }

    // Filter out excluded tables
    let tables = allTables.filter((table) => !EXCLUDED_TABLES.includes(table))

    // If contentTypes specified, filter to only include relevant tables
    if (contentTypes && contentTypes.length > 0) {
      const includedTables = new Set<string>()

      // Always include essential tables (users, settings, locales, etc.)
      includedTables.add('users')
      includedTables.add('user_profiles')
      includedTables.add('site_settings')
      includedTables.add('site_custom_field_values')
      includedTables.add('locales')
      // Per-post-type settings can affect rendering/routing; treat as essential configuration.
      includedTables.add('post_type_settings')

      // Add tables for selected content types
      for (const contentType of contentTypes) {
        const typeTables = CONTENT_TYPE_TABLES[contentType] || []
        typeTables.forEach((table) => includedTables.add(table))
      }

      tables = tables.filter((table) => includedTables.has(table))
    }

    return tables
  }

  /**
   * Export database and return as JSON string
   */
  async exportToJson(options: ExportOptions = {}): Promise<string> {
    const data = await this.exportDatabase(options)
    return JSON.stringify(data, null, 2)
  }

  /**
   * Export database and return as Buffer (for file downloads)
   */
  async exportToBuffer(options: ExportOptions = {}): Promise<Buffer> {
    const json = await this.exportToJson(options)
    return Buffer.from(json, 'utf-8')
  }

  /**
   * Get export filename with timestamp
   */
  getExportFilename(options: ExportOptions = {}): string {
    const timestamp = DateTime.now().toFormat('yyyy-MM-dd_HHmmss')
    const suffix = options.contentTypes ? `-${options.contentTypes.join('-')}` : ''
    return `adonis-eos-export${suffix}_${timestamp}.json`
  }

  /**
   * Get export statistics without performing full export
   */
  async getExportStats(contentTypes?: ContentType[]): Promise<{
    tables: Array<{ name: string; rowCount: number; contentType?: string }>
    totalRows: number
    estimatedSize: string
  }> {
    const tables = await this.getExportableTables(contentTypes)
    const stats: Array<{ name: string; rowCount: number; contentType?: string }> = []
    let totalRows = 0

    // Build reverse mapping of tables to content types
    const tableToContentType = new Map<string, string>()
    for (const [contentType, typeTables] of Object.entries(CONTENT_TYPE_TABLES)) {
      for (const table of typeTables) {
        tableToContentType.set(table, contentType)
      }
    }

    for (const tableName of tables) {
      try {
        const result = await db.from(tableName).count('* as count').first()
        const rowCount = Number(result?.count || 0)
        stats.push({
          name: tableName,
          rowCount,
          contentType: tableToContentType.get(tableName),
        })
        totalRows += rowCount
      } catch (error) {
        // Failed to count rows
        stats.push({
          name: tableName,
          rowCount: 0,
          contentType: tableToContentType.get(tableName),
        })
      }
    }

    // Rough estimate: ~500 bytes per row on average
    const estimatedBytes = totalRows * 500
    const estimatedSize =
      estimatedBytes < 1024 * 1024
        ? `${(estimatedBytes / 1024).toFixed(1)} KB`
        : `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`

    return {
      tables: stats,
      totalRows,
      estimatedSize,
    }
  }

  /**
   * Get available content types and their table counts
   */
  async getContentTypeStats(): Promise<
    Record<ContentType, { tables: string[]; rowCount: number }>
  > {
    const result: Record<ContentType, { tables: string[]; rowCount: number }> = {} as any

    for (const [contentType, tables] of Object.entries(CONTENT_TYPE_TABLES)) {
      let totalRows = 0
      for (const tableName of tables) {
        try {
          const count = await db.from(tableName).count('* as count').first()
          totalRows += Number(count?.count || 0)
        } catch {
          // Table doesn't exist, skip
        }
      }
      result[contentType as ContentType] = { tables, rowCount: totalRows }
    }

    return result
  }
}

const databaseExportService = new DatabaseExportService()
export default databaseExportService
