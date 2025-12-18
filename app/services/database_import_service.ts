import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import dbConfig from '#config/database'

/**
 * Import strategy for handling existing data
 */
export type ImportStrategy = 'replace' | 'merge' | 'skip' | 'overwrite'

/**
 * Import options
 */
export interface ImportOptions {
  /**
   * How to handle existing data
   * - 'replace': Drop all tables and recreate (destructive)
   * - 'merge': Insert new records, skip conflicts
   * - 'skip': Only import if table is empty
   * - 'overwrite': Update existing records with matching IDs, insert new ones
   */
  strategy?: ImportStrategy

  /**
   * Specific tables to import (if undefined, imports all)
   */
  tables?: string[]

  /**
   * Whether to disable foreign key checks during import
   * (Required for proper import order)
   */
  disableForeignKeyChecks?: boolean

  /**
   * Whether to preserve original IDs from the export
   * If false, will generate new IDs
   */
  preserveIds?: boolean

  /**
   * Content types to import (if export contains contentTypes metadata)
   */
  contentTypes?: string[]
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean
  tablesImported: number
  rowsImported: number
  errors: Array<{ table: string; error: string }>
  skippedTables: string[]
}

/**
 * Database Import Service
 * Handles importing database from JSON export format
 */
class DatabaseImportService {
  /**
   * Normalize JSONB fields in a row for PostgreSQL
   * Knex should handle JSONB automatically, but we ensure objects/arrays are properly formatted
   * and strings are valid JSON
   */
  private normalizeJsonbFields(tableName: string, row: any): any {
    const normalized = { ...row }

    // Known JSONB columns by table
    const jsonbColumns: Record<string, string[]> = this.jsonbColumns

    const columns = jsonbColumns[tableName] || []
    for (const col of columns) {
      if (col in normalized && normalized[col] !== null && normalized[col] !== undefined) {
        // If it's a string, validate it's valid JSON
        if (typeof normalized[col] === 'string') {
          try {
            // Validate it's valid JSON, then parse and let Knex re-serialize
            normalized[col] = JSON.parse(normalized[col])
          } catch {
            // Treat raw string as JSON string value (to be serialized later)
            normalized[col] = normalized[col]
          }
        }
        // If it's already an object/array, leave it as-is - Knex will serialize it properly
        // But ensure it's a plain object/array (not a class instance)
        if (
          typeof normalized[col] === 'object' &&
          normalized[col] !== null &&
          normalized[col].constructor !== Object &&
          !Array.isArray(normalized[col])
        ) {
          normalized[col] = JSON.parse(JSON.stringify(normalized[col]))
        }
      }
    }

    return normalized
  }

  // Known JSONB columns by table
  private jsonbColumns: Record<string, string[]> = {
    posts: ['robots_json', 'jsonld_overrides', 'review_draft', 'ai_review_draft'],
    forms: ['fields_json', 'subscriptions_json'],
    menus: ['meta_json'],
    media_assets: ['metadata'],
    module_instances: ['props', 'review_props', 'ai_review_props'],
    post_modules: ['overrides', 'review_overrides', 'ai_review_overrides'],
    module_group_modules: ['default_props'],
    post_custom_field_values: ['value'],
    site_custom_field_values: ['value'],
    custom_fields: ['config'],
    post_revisions: ['snapshot'],
    form_submissions: ['payload'],
    activity_logs: ['metadata'],
    webhooks: ['headers', 'payload'],
    post_type_settings: ['settings'],
  }

  /**
   * Prepare row for PostgreSQL import by explicitly casting JSONB columns
   */
  private prepareRowForPostgres(trx: any, tableName: string, row: any): any {
    const processedRow = { ...row }
    const columns = this.jsonbColumns[tableName] || []

    for (const col of columns) {
      if (col in processedRow && processedRow[col] !== null && processedRow[col] !== undefined) {
        // Always stringify to ensure valid JSON input for ::jsonb cast
        // normalizeJsonbFields should have already parsed valid JSON strings into objects
        // so this safely re-serializes them, or treats unparsable strings as JSON string values
        const val = JSON.stringify(processedRow[col])

        // Use raw SQL with explicit JSONB casting to avoid "invalid input syntax" errors
        processedRow[col] = trx.raw('?::jsonb', [val])
      }
    }

    return processedRow
  }

  /**
   * Validate export data structure
   */
  validateExportData(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid export data: not an object' }
    }

    if (!data.metadata || !data.tables) {
      return { valid: false, error: 'Invalid export data: missing metadata or tables' }
    }

    if (!data.metadata.version) {
      return { valid: false, error: 'Invalid export data: missing version' }
    }

    // Check version compatibility (accepting 2.x.x)
    const version = data.metadata.version
    if (!version.startsWith('2.')) {
      return {
        valid: false,
        error: `Incompatible export version: ${version} (expected 2.x.x)`,
      }
    }

    return { valid: true }
  }

  /**
   * Import database from JSON export
   */
  async importDatabase(exportData: any, options: ImportOptions = {}): Promise<ImportResult> {
    const {
      strategy = 'merge',
      tables: tablesToImport,
      disableForeignKeyChecks = true,
      preserveIds = true,
    } = options
    // If we are NOT preserving IDs, "overwrite" doesn't make sense (we can't match by ID),
    // so downgrade overwrite → merge semantics.
    const effectiveStrategy: ImportStrategy =
      strategy === 'overwrite' && !preserveIds ? 'merge' : strategy

    console.log('🔄 Starting database import...')
    console.log(`   Strategy: ${strategy} (effective: ${effectiveStrategy})`)
    console.log(`   Preserve IDs: ${preserveIds}`)
    console.log(`   Disable FK checks: ${disableForeignKeyChecks}`)

    // Validate export data
    const validation = this.validateExportData(exportData)
    if (!validation.valid) {
      console.error('❌ Export data validation failed:', validation.error)
      throw new Error(validation.error)
    }

    console.log('✅ Export data validation passed')
    console.log(`   Export version: ${exportData.metadata?.version}`)
    console.log(`   Export date: ${exportData.metadata?.exportedAt}`)
    console.log(`   Export preserved IDs: ${exportData.metadata?.preserveIds !== false}`)

    // Check if export has preserved IDs
    const exportPreservedIds = exportData.metadata?.preserveIds !== false

    const result: ImportResult = {
      success: true,
      tablesImported: 0,
      rowsImported: 0,
      errors: [],
      skippedTables: [],
    }

    const tables = Object.keys(exportData.tables)

    // Cache module_instances rows from export for downstream table processing (post_modules dedupe)
    const moduleInstanceRows: Map<string, any> = new Map()
    const miTable = exportData.tables?.module_instances
    const miRows = Array.isArray(miTable?.rows)
      ? miTable.rows
      : Array.isArray(miTable)
        ? miTable
        : []
    for (const row of miRows) {
      if (row && row.id) moduleInstanceRows.set(String(row.id), row)
    }
    console.log(`📊 Export contains ${tables.length} tables:`, tables.join(', '))

    const tablesToProcess = tablesToImport
      ? tables.filter((t) => tablesToImport.includes(t))
      : tables

    console.log(`📋 Processing ${tablesToProcess.length} tables`)

    // Order tables by dependency (users first, then posts, etc.)
    const orderedTables = this.orderTablesByDependency(tablesToProcess)
    console.log('🔀 Import order:', orderedTables.join(' → '))

    // Use transaction for atomicity
    const trx = await db.transaction()

    try {
      // Disable foreign key checks if requested
      if (disableForeignKeyChecks) {
        console.log('🔓 Disabling foreign key checks...')
        await this.disableForeignKeyChecks(trx)
      }

      for (const tableName of orderedTables) {
        console.log(`\n📦 Processing table: ${tableName}`)

        try {
          const rows = exportData.tables[tableName]

          if (!rows || rows.length === 0) {
            console.log(`   ⏭️  Skipped (no data)`)
            result.skippedTables.push(tableName)
            continue
          }

          console.log(`   📊 ${rows.length} rows to import`)

          // Check if table exists
          const tableExists = await this.tableExists(trx, tableName)
          if (!tableExists) {
            console.log(`   ⚠️  Table does not exist in target database`)
            result.skippedTables.push(tableName)
            continue
          }

          // Handle based on strategy
          if (effectiveStrategy === 'replace') {
            const deletedCount = await trx.from(tableName).delete()
            console.log(`   🗑️  Cleared table (deleted ${deletedCount} rows)`)
          } else if (effectiveStrategy === 'skip') {
            const count = await trx.from(tableName).count('* as count').first()
            const existingRows = Number(count?.count || 0)
            if (existingRows > 0) {
              console.log(`   ⏭️  Skipped (table not empty: ${existingRows} existing rows)`)
              result.skippedTables.push(tableName)
              continue
            }
          }

          // Import rows
          let importedCount = 0
          let skippedCount = 0
          let errorCount = 0

          // For posts table, track detailed statistics
          const isPostsTable = tableName === 'posts'
          const postTypeStats: Record<
            string,
            { total: number; imported: number; skipped: number }
          > = {}

          // Analyze posts in export
          if (isPostsTable) {
            console.log('   📊 Analyzing posts in export...')
            const typeCount: Record<string, number> = {}
            for (const row of rows) {
              const type = row.type || 'unknown'
              typeCount[type] = (typeCount[type] || 0) + 1
              postTypeStats[type] = { total: typeCount[type], imported: 0, skipped: 0 }
            }
            console.log('   📋 Posts by type in export:', JSON.stringify(typeCount, null, 2))
          }

          // For posts table with overwrite/replace/merge strategy, sort by dependencies (parent + translation) first
          let sortedRows = rows
          if (
            isPostsTable &&
            (effectiveStrategy === 'overwrite' ||
              effectiveStrategy === 'replace' ||
              effectiveStrategy === 'merge')
          ) {
            console.log('   🔀 Sorting posts by dependencies (parent/translation first)...')
            sortedRows = this.sortPostsByDependencies(rows)
          }

          // For post_modules: ensure post-scoped module instances are not reused; clone when duplicated
          const postModuleUsedBy = new Map<string, string>() // module_id -> post_id

          for (const row of sortedRows) {
            try {
              // Handle ID preservation
              let processedRow = { ...row }
              if (!preserveIds && exportPreservedIds && 'id' in processedRow) {
                // Remove ID to let database generate new one
                const { id, ...rest } = processedRow
                processedRow = rest
              }

              // Special case: post_modules dedupe for post-scoped module instances
              if (tableName === 'post_modules') {
                const moduleId = (processedRow as any).module_id || (processedRow as any).moduleId
                const postId = (processedRow as any).post_id || (processedRow as any).postId
                const mi = moduleInstanceRows.get(String(moduleId))
                const scope = mi?.scope
                if (scope === 'post') {
                  const firstPost = postModuleUsedBy.get(String(moduleId))
                  if (firstPost && firstPost !== String(postId)) {
                    // Clone module_instance to avoid cross-post reuse
                    const newId = randomUUID()
                    const now = new Date()
                    const cloneRow = {
                      ...mi,
                      id: newId,
                      post_id: mi?.post_id ?? null,
                      global_slug: null,
                      global_label: mi?.global_label ?? null,
                      created_at: now,
                      updated_at: now,
                    }
                    await trx
                      .table('module_instances')
                      .insert(this.prepareRowForPostgres(trx, 'module_instances', cloneRow))
                    moduleInstanceRows.set(newId, cloneRow)
                    processedRow = { ...processedRow, module_id: newId }
                    postModuleUsedBy.set(String(newId), String(postId))
                  } else {
                    postModuleUsedBy.set(String(moduleId), String(postId))
                  }
                }
              }

              // Normalize JSONB fields for PostgreSQL - ensure they're proper JSON objects/arrays
              processedRow = this.normalizeJsonbFields(tableName, processedRow)

              // Track post types
              const postType = isPostsTable ? processedRow.type || 'unknown' : null

              if (effectiveStrategy === 'merge') {
                // Use insert ignore or on conflict do nothing
                const result = await this.insertOrIgnoreWithResult(trx, tableName, processedRow)
                if (result.inserted) {
                  importedCount++
                  if (postType && postTypeStats[postType]) {
                    postTypeStats[postType].imported++
                  }
                  // Log first few successful inserts for debugging
                  if (
                    tableName === 'posts' &&
                    importedCount <= 5 &&
                    postType &&
                    postType !== 'documentation'
                  ) {
                    console.log(`   ✅ Inserted ${postType} post ${processedRow.id}`)
                  }
                } else {
                  skippedCount++
                  if (postType && postTypeStats[postType]) {
                    postTypeStats[postType].skipped++
                  }
                  // Log first few skipped rows to understand why
                  if (
                    tableName === 'posts' &&
                    skippedCount <= 5 &&
                    postType &&
                    postType !== 'documentation'
                  ) {
                    // Check if it exists
                    const exists = await trx.from(tableName).where('id', processedRow.id).first()
                    console.log(
                      `   ⏭️  Skipped ${postType} post ${processedRow.id} - exists: ${exists ? 'yes' : 'no'}`
                    )
                  }
                }
              } else if (effectiveStrategy === 'overwrite') {
                // Upsert: update if exists, insert if not.
                // If the row has an ID, we can truly overwrite. Otherwise, fall back to merge semantics.
                const hasIdPk = Object.prototype.hasOwnProperty.call(processedRow, 'id')

                if (hasIdPk) {
                  try {
                    const affectedRows = await this.upsertRow(trx, tableName, processedRow)

                    if (affectedRows === 0) {
                      // Upsert reported no rows affected - this shouldn't happen but log it
                      console.log(
                        `   ⚠️  WARNING: Upsert returned 0 affected rows for ${tableName} (id: ${processedRow.id}, type: ${postType || 'N/A'})`
                      )
                      skippedCount++
                      if (postType && postTypeStats[postType]) {
                        postTypeStats[postType].skipped++
                      }
                      continue
                    }

                    // Verify the row was actually inserted/updated (for posts table only, to debug)
                    if (isPostsTable) {
                      const verifyRow = await trx
                        .from(tableName)
                        .where('id', processedRow.id)
                        .first()
                      if (!verifyRow) {
                        console.log(
                          `   ⚠️  WARNING: Row ${processedRow.id} (type: ${postType || 'N/A'}) was not found after upsert!`
                        )
                        skippedCount++
                        if (postType && postTypeStats[postType]) {
                          postTypeStats[postType].skipped++
                        }
                        continue
                      }
                      // Log first few successful inserts for debugging
                      if (importedCount < 5 && postType && postType !== 'documentation') {
                        console.log(
                          `   ✅ Verified insert: ${postType} post ${processedRow.id} (title: ${processedRow.title?.substring(0, 30) || 'N/A'})`
                        )
                      }
                    }

                    importedCount++
                    if (postType && postTypeStats[postType]) {
                      postTypeStats[postType].imported++
                    }
                  } catch (upsertError: any) {
                    // Log upsert errors for debugging
                    const errorMsg = upsertError?.message || String(upsertError)
                    if (errorCount <= 10) {
                      console.log(
                        `   ⚠️  Upsert error for ${tableName} (id: ${processedRow.id}, type: ${postType || 'N/A'}): ${errorMsg}`
                      )
                    }
                    errorCount++
                    skippedCount++
                    if (postType && postTypeStats[postType]) {
                      postTypeStats[postType].skipped++
                    }
                  }
                } else {
                  // No ID column in this row (e.g. locales) – behave like merge/insert-or-ignore
                  const result = await this.insertOrIgnoreWithResult(trx, tableName, processedRow)
                  if (result.inserted) {
                    importedCount++
                    if (postType && postTypeStats[postType]) {
                      postTypeStats[postType].imported++
                    }
                  } else {
                    skippedCount++
                    if (postType && postTypeStats[postType]) {
                      postTypeStats[postType].skipped++
                    }
                  }
                }
              } else {
                // For replace/skip strategies, use insert
                // Ensure JSONB fields are properly handled by Knex (pre-cast for Postgres)
                const rowForInsert =
                  dbConfig.connections[dbConfig.connection].client === 'pg' ||
                  dbConfig.connections[dbConfig.connection].client === 'postgres'
                    ? this.prepareRowForPostgres(trx, tableName, processedRow)
                    : processedRow
                try {
                  await trx.table(tableName).insert(rowForInsert)
                  importedCount++
                  if (postType && postTypeStats[postType]) {
                    postTypeStats[postType].imported++
                  }
                } catch (insertError: any) {
                  // If it's a JSONB error, try with explicit casting (fallback)
                  const errorMsg = insertError?.message || String(insertError)
                  if (
                    errorMsg.includes('invalid input syntax for type json') ||
                    errorMsg.includes('jsonb')
                  ) {
                    const fixedRow = this.prepareRowForPostgres(trx, tableName, processedRow)
                    await trx.table(tableName).insert(fixedRow)
                    importedCount++
                    if (postType && postTypeStats[postType]) {
                      postTypeStats[postType].imported++
                    }
                  } else {
                    throw insertError
                  }
                }
              }
            } catch (error) {
              errorCount++
              const errorMsg = (error as Error).message

              // Log first few errors for debugging
              if (errorCount <= 3) {
                console.log(`   ⚠️  Row error: ${errorMsg}`)
              }

              // Continue on individual row errors in merge/overwrite mode
              if (effectiveStrategy === 'merge' || effectiveStrategy === 'overwrite') {
                skippedCount++
                continue
              } else {
                throw error
              }
            }
          }

          result.tablesImported++
          result.rowsImported += importedCount

          // If we used "replace" or "overwrite" with preserved integer IDs on a serial table,
          // sync the sequence so subsequent inserts don't collide (e.g., users.id).
          if (
            (effectiveStrategy === 'replace' || effectiveStrategy === 'overwrite') &&
            importedCount > 0 &&
            this.isPostgres(trx) &&
            tableName === 'users'
          ) {
            await this.resetSerialSequence(trx, tableName, 'id')
          }

          console.log(`   ✅ Imported ${importedCount} rows`)
          if (skippedCount > 0) {
            console.log(`   ⚠️  Skipped ${skippedCount} rows (conflicts/errors)`)
          }

          // For posts table, show detailed breakdown by type
          if (isPostsTable && Object.keys(postTypeStats).length > 0) {
            console.log('   📊 Posts breakdown by type:')
            for (const [type, stats] of Object.entries(postTypeStats)) {
              console.log(
                `      ${type}: ${stats.imported} imported, ${stats.skipped} skipped (of ${stats.total} total)`
              )
            }
          }
        } catch (error) {
          const errorMsg = (error as Error).message
          console.error(`   ❌ Failed to import table: ${errorMsg}`)
          result.errors.push({ table: tableName, error: errorMsg })

          // Continue with other tables in merge/overwrite mode
          if (strategy === 'merge' || strategy === 'overwrite') {
            continue
          } else {
            throw error
          }
        }
      }

      // Re-enable foreign key checks
      if (disableForeignKeyChecks) {
        console.log('\n🔒 Re-enabling foreign key checks...')
        await this.enableForeignKeyChecks(trx)
      }

      await trx.commit()
      console.log('\n✅ Import transaction committed successfully')
      console.log(
        `📊 Final stats: ${result.tablesImported} tables, ${result.rowsImported} rows imported`
      )

      // DEBUG: Check what's actually in the database after import
      try {
        // Summaries for UI-friendly output
        const summaryCounts: Record<string, number> = {}
        const summarize = async (table: string, key: string) => {
          const r = await db.from(table).count('* as total')
          summaryCounts[key] = Number((r[0] as any)?.total || 0)
        }

        // Posts by type
        const allTypes = await db
          .from('posts')
          .select('type')
          .count('* as count')
          .groupBy('type')
          .orderBy('type')
        const postTypeCounts: Record<string, number> = {}
        allTypes.forEach((row: any) => {
          postTypeCounts[row.type] = Number(row.count || 0)
        })

        await summarize('posts', 'posts')
        await summarize('forms', 'forms')
        await summarize('media_assets', 'media')
        await summarize('menus', 'menus')
        await summarize('taxonomies', 'taxonomies')
        await summarize('module_groups', 'module_groups')

        console.log('════════ Import Summary ════════')
        console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`)
        console.log(
          `Tables imported: ${result.tablesImported}, Rows imported: ${result.rowsImported}`
        )
        console.log('Content counts:')
        console.log(`  Posts: ${summaryCounts.posts} (by type: ${JSON.stringify(postTypeCounts)})`)
        console.log(
          `  Media: ${summaryCounts.media}, Module Groups: ${summaryCounts.module_groups}, Menus: ${summaryCounts.menus}`
        )
        console.log(`  Forms: ${summaryCounts.forms}, Taxonomies: ${summaryCounts.taxonomies}`)
        if (result.errors.length > 0) {
          console.log('Errors:')
          result.errors.slice(0, 5).forEach((err) => console.log(`  - ${err.table}: ${err.error}`))
          if (result.errors.length > 5) console.log(`  ...and ${result.errors.length - 5} more`)
        }
        if (result.skippedTables.length > 0) {
          console.log(
            `Skipped tables (${result.skippedTables.length}): ${result.skippedTables.join(', ')}`
          )
        }
        console.log('════════ End Summary ═══════════')
      } catch (err) {
        console.error('📊 DEBUG error checking database after import:', err)
      }

      // Fallback: ensure documentation posts exist if they were present in the export
      try {
        const exportedPosts: any[] = Array.isArray(exportData?.tables?.posts)
          ? exportData.tables.posts
          : []
        const exportedDocs = exportedPosts.filter((p) => p && p.type === 'documentation')
        if (exportedDocs.length > 0) {
          const docsAll = await db.from('posts').where('type', 'documentation').count('* as total')
          const existingTotal = Number((docsAll[0] as any)?.total || 0)
          if (existingTotal === 0) {
            console.log(
              `📥 Fallback: inserting ${exportedDocs.length} documentation posts directly (no existing docs detected)`
            )
            await db.table('posts').insert(exportedDocs)
            const docsAfter = await db
              .from('posts')
              .where('type', 'documentation')
              .count('* as total')
            console.log(
              '📊 Fallback documentation posts in DB now:',
              Number((docsAfter[0] as any)?.total || 0)
            )
          }
        }
      } catch (fallbackError) {
        console.error('⚠️  Fallback documentation import failed:', (fallbackError as Error).message)
      }

      if (result.skippedTables.length > 0) {
        console.log(
          `⏭️  Skipped tables (${result.skippedTables.length}):`,
          result.skippedTables.join(', ')
        )
      }

      if (result.errors.length > 0) {
        console.log(`⚠️  Errors (${result.errors.length}):`)
        result.errors.forEach((err) => console.log(`   - ${err.table}: ${err.error}`))
      }
    } catch (error) {
      await trx.rollback()
      result.success = false
      console.error('❌ Import failed, transaction rolled back:', (error as Error).message)
      throw error
    }

    return result
  }

  private isPostgres(trx: any): boolean {
    const client =
      trx?.client?.config?.client || dbConfig.connections[dbConfig.connection].client || ''
    return client === 'pg' || client === 'postgres'
  }

  private async resetSerialSequence(trx: any, tableName: string, column: string) {
    // Set sequence to MAX(id); nextval will produce max+1
    const sql = `
      SELECT setval(
        pg_get_serial_sequence('${tableName}', '${column}'),
        COALESCE((SELECT MAX("${column}") FROM "${tableName}"), 0),
        true
      );
    `
    await trx.rawQuery(sql)
  }

  /**
   * Sort posts by dependency (parents before children AND originals before translations)
   */
  private sortPostsByDependencies(posts: any[]): any[] {
    const sorted: any[] = []
    const remaining = [...posts]
    const processedIds = new Set<string>()

    // Helper to decide if a post can be processed
    const canProcess = (post: any) => {
      const parentOk = !post.parent_id || processedIds.has(post.parent_id)
      const translationOk = !post.translation_of_id || processedIds.has(post.translation_of_id)
      return parentOk && translationOk
    }

    // First pass: add posts with no parent and no translation_of_id
    for (let i = remaining.length - 1; i >= 0; i--) {
      const post = remaining[i]
      if (
        (!post.parent_id || post.parent_id === null) &&
        (!post.translation_of_id || post.translation_of_id === null)
      ) {
        sorted.push(post)
        processedIds.add(post.id)
        remaining.splice(i, 1)
      }
    }

    let safety = remaining.length * 3 + 10
    while (remaining.length > 0 && safety > 0) {
      safety--
      let added = false

      for (let i = remaining.length - 1; i >= 0; i--) {
        const post = remaining[i]
        if (canProcess(post)) {
          sorted.push(post)
          processedIds.add(post.id)
          remaining.splice(i, 1)
          added = true
        }
      }

      if (!added) {
        // Break cycles: push the remaining as-is
        sorted.push(...remaining)
        break
      }
    }

    return sorted
  }

  /**
   * Order tables by dependency to avoid foreign key issues
   */
  private orderTablesByDependency(tables: string[]): string[] {
    // Define dependency order (tables with no dependencies first)
    const order = [
      'site_settings',
      'site_custom_field_values',
      'locales',
      'users',
      'user_profiles',
      'forms',
      'media_assets',
      'module_groups',
      'module_group_modules',
      'url_patterns',
      'module_scopes',
      'posts',
      'post_type_custom_fields',
      'post_custom_field_values',
      // Ensure module_instances (parent) comes before post_modules (child)
      'module_instances',
      'post_modules',
      'post_revisions',
      'taxonomies',
      'taxonomy_terms',
      'post_taxonomy_terms',
      'menus',
      'menu_items',
      'form_submissions',
      'webhooks',
      'activity_logs',
    ]

    const ordered: string[] = []
    const remaining = [...tables]

    // Add tables in defined order
    for (const table of order) {
      const index = remaining.indexOf(table)
      if (index !== -1) {
        ordered.push(table)
        remaining.splice(index, 1)
      }
    }

    // Add remaining tables at the end
    ordered.push(...remaining)

    return ordered
  }

  /**
   * Check if a table exists
   *
   * Note: table name comes from export file (trusted source), so direct interpolation is safe
   */
  private async tableExists(trx: any, tableName: string): Promise<boolean> {
    try {
      // Try to query the table directly - if it exists, query succeeds
      // Using identifier escaping for safety
      await trx.raw(`SELECT 1 FROM "${tableName}" LIMIT 0`)
      return true
    } catch (error: any) {
      // If table doesn't exist, we'll get an error
      const errorMsg = error.message || String(error)
      if (errorMsg.includes('does not exist') || errorMsg.includes('no such table')) {
        return false
      }
      // For other errors, log but assume table exists to avoid blocking import
      console.error(`   ⚠️  Error checking if table ${tableName} exists:`, errorMsg)
      return true // Assume it exists to proceed with import
    }
  }

  /**
   * Insert row or ignore conflicts, returning whether it was inserted
   */
  private async insertOrIgnoreWithResult(
    trx: any,
    tableName: string,
    row: any
  ): Promise<{ inserted: boolean }> {
    const dialectName = dbConfig.connections[dbConfig.connection].client

    // Create a savepoint for Postgres to prevent transaction abortion on failure
    const useSavepoint = dialectName === 'postgres' || dialectName === 'pg'
    // Generate safe savepoint name
    const rowId = row.id
      ? row.id.toString().replace(/-/g, '')
      : Math.random().toString(36).substring(2, 15)
    const savepointName = `sp_ins_${tableName.substring(0, 10)}_${rowId}`

    if (useSavepoint) {
      await trx.raw(`SAVEPOINT ${savepointName}`)
    }

    // Apply strict JSONB casting for Postgres to avoid "invalid input syntax" errors
    const rowToInsert = useSavepoint ? this.prepareRowForPostgres(trx, tableName, row) : row

    try {
      if (dialectName === 'postgres' || dialectName === 'pg') {
        // Proactive conflict resolution for known unique constraints (merge mode should be non-fatal)
        if (tableName === 'module_groups' && row.name) {
          const conflicting = await trx
            .from(tableName)
            .where('name', row.name)
            .where('id', '!=', row.id)
            .first()
          if (conflicting) {
            await trx.from(tableName).where('id', conflicting.id).delete()
          }
        } else if (tableName === 'forms' && row.slug) {
          const conflicting = await trx
            .from(tableName)
            .where('slug', row.slug)
            .where('id', '!=', row.id)
            .first()
          if (conflicting) {
            await trx.from(tableName).where('id', conflicting.id).delete()
          }
        } else if (
          tableName === 'url_patterns' &&
          row.post_type &&
          row.locale &&
          row.is_default !== undefined
        ) {
          const conflicting = await trx
            .from(tableName)
            .where('post_type', row.post_type)
            .where('locale', row.locale)
            .where('is_default', true)
            .where('id', '!=', row.id)
            .first()
          if (conflicting && row.is_default === true) {
            await trx.from(tableName).where('id', conflicting.id).delete()
          }
        } else if (tableName === 'custom_fields' && row.slug) {
          const conflicting = await trx
            .from(tableName)
            .where('slug', row.slug)
            .where('id', '!=', row.id)
            .first()
          if (conflicting) {
            await trx.from(tableName).where('id', conflicting.id).delete()
          }
        } else if (tableName === 'menus' && row.slug) {
          const conflicting = await trx
            .from(tableName)
            .where('slug', row.slug)
            .where('id', '!=', row.id)
            .first()
          if (conflicting) {
            await trx.from(tableName).where('id', conflicting.id).delete()
          }
        } else if (tableName === 'users' && row.email) {
          const conflicting = await trx
            .from(tableName)
            .where('email', row.email)
            .where('id', '!=', row.id)
            .first()
          if (conflicting) {
            await trx.from(tableName).where('id', conflicting.id).delete()
          }
        }

        // First check if row already exists by ID
        if ('id' in row) {
          const existing = await trx.from(tableName).where('id', row.id).first()
          if (existing) {
            if (useSavepoint) await trx.raw(`RELEASE SAVEPOINT ${savepointName}`)
            return { inserted: false }
          }
        }

        // Try to insert
        try {
          await trx.table(tableName).insert(rowToInsert)

          // Verify it was actually inserted
          if ('id' in row) {
            const verify = await trx.from(tableName).where('id', row.id).first()
            if (useSavepoint) await trx.raw(`RELEASE SAVEPOINT ${savepointName}`)
            return { inserted: verify ? true : false }
          }
          if (useSavepoint) await trx.raw(`RELEASE SAVEPOINT ${savepointName}`)
          return { inserted: true }
        } catch (insertError: any) {
          if (useSavepoint) await trx.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`)

          // Log constraint violations for debugging
          const errorCode = insertError?.code
          const errorMsg = insertError?.message || String(insertError)

          if (errorCode === '23505') {
            // Unique constraint violation - row already exists (by some unique constraint)
            // Log for debugging (log first few, then sample)
            const shouldLog = tableName === 'posts' || Math.random() < 0.05
            if (shouldLog) {
              console.log(
                `   🔍 DEBUG: Unique constraint violation for ${tableName} ${row.id}: ${errorMsg}`
              )
              console.log(`   🔍 Constraint: ${insertError?.constraint}`)
            }
            return { inserted: false }
          } else if (errorCode === '23503') {
            // Foreign key violation - ALWAYS log these as they indicate missing dependencies
            console.log(`   ❌ Foreign key violation for ${tableName} ${row.id}: ${errorMsg}`)
            console.log(`   🔍 Constraint: ${insertError?.constraint}`)
            return { inserted: false }
          } else if (errorCode === '23502') {
            // Not null violation - log it
            console.log(`   ❌ Not null violation for ${tableName} ${row.id}: ${errorMsg}`)
            return { inserted: false }
          } else {
            // Other error - log and rethrow (don't silently fail)
            console.log(`   ❌ Insert error for ${tableName} ${row.id}: ${errorMsg}`)
            console.log(`   🔍 Error code: ${errorCode}, constraint: ${insertError?.constraint}`)
            throw insertError
          }
        }
      } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
        const result = await trx.raw(
          `INSERT IGNORE INTO ?? (${Object.keys(row).join(',')}) VALUES (${Object.keys(row)
            .map(() => '?')
            .join(',')})`,
          [tableName, ...Object.values(row)]
        )
        // MySQL returns affectedRows
        return { inserted: result[0].affectedRows > 0 }
      } else {
        // SQLite - try insert, check for error
        try {
          await trx.table(tableName).insert(row)
          return { inserted: true }
        } catch {
          return { inserted: false }
        }
      }
    } catch (error) {
      if (useSavepoint && !(error as any).message?.includes('ROLLBACK TO SAVEPOINT')) {
        // Should have been handled above, but just in case
      }
      // Constraint violations mean row was not inserted
      if ((error as any).code === '23505' || (error as any).errno === 1062) {
        return { inserted: false }
      }
      throw error
    }
  }

  /**
   * Upsert row (update if exists with matching ID, insert if not)
   */
  private async upsertRow(trx: any, tableName: string, row: any): Promise<number> {
    const dialectName = dbConfig.connections[dbConfig.connection].client

    // If no ID, just insert
    if (!('id' in row)) {
      await trx.table(tableName).insert(row)
      return 1 // Assume inserted
    }

    // Use savepoints for Postgres to prevent transaction abortion on failure
    const useSavepoint = dialectName === 'postgres' || dialectName === 'pg'
    // Generate a safe savepoint name (remove hyphens from UUIDs)
    const savepointName = `sp_${tableName.substring(0, 10)}_${row.id.toString().replace(/-/g, '')}`

    if (useSavepoint) {
      await trx.raw(`SAVEPOINT ${savepointName}`)
    }

    // Apply strict JSONB casting for Postgres to avoid "invalid input syntax" errors
    const rowToUpsert = useSavepoint ? this.prepareRowForPostgres(trx, tableName, row) : row

    try {
      if (dialectName === 'postgres' || dialectName === 'pg') {
        // PostgreSQL: Check if row exists first, then INSERT or UPDATE separately
        const existing = await trx.from(tableName).where('id', row.id).first()

        if (existing) {
          // Row exists - update it
          const { id, ...updateData } = rowToUpsert

          await trx.from(tableName).where('id', id).update(updateData)

          // Verify update succeeded
          const verify = await trx.from(tableName).where('id', row.id).first()

          if (useSavepoint) {
            await trx.raw(`RELEASE SAVEPOINT ${savepointName}`)
          }
          return verify ? 1 : 0
        } else {
          // Row doesn't exist by ID. Check for unique constraint conflicts and resolve them proactively.
          // Overwrite strategy: the incoming row wins; delete conflicting rows with same unique keys.
          if (tableName === 'module_groups' && row.name) {
            const conflicting = await trx
              .from(tableName)
              .where('name', row.name)
              .where('id', '!=', row.id)
              .first()
            if (conflicting) {
              console.log(
                `   ⚠️  Resolving conflict for module_groups: deleting ${conflicting.id} (name: ${row.name})`
              )
              await trx.from(tableName).where('id', conflicting.id).delete()
            }
          } else if (tableName === 'forms' && row.slug) {
            const conflicting = await trx
              .from(tableName)
              .where('slug', row.slug)
              .where('id', '!=', row.id)
              .first()
            if (conflicting) {
              console.log(
                `   ⚠️  Resolving conflict for forms: deleting ${conflicting.id} (slug: ${row.slug})`
              )
              await trx.from(tableName).where('id', conflicting.id).delete()
            }
          } else if (
            tableName === 'url_patterns' &&
            row.post_type &&
            row.locale &&
            row.is_default !== undefined
          ) {
            // Only one default per post_type+locale
            const conflicting = await trx
              .from(tableName)
              .where('post_type', row.post_type)
              .where('locale', row.locale)
              .where('is_default', true)
              .where('id', '!=', row.id)
              .first()
            if (conflicting && row.is_default === true) {
              console.log(
                `   ⚠️  Resolving conflict for url_patterns: deleting ${conflicting.id} (default ${row.post_type}/${row.locale})`
              )
              await trx.from(tableName).where('id', conflicting.id).delete()
            }
          } else if (tableName === 'custom_fields' && row.slug) {
            const conflicting = await trx
              .from(tableName)
              .where('slug', row.slug)
              .where('id', '!=', row.id)
              .first()
            if (conflicting) {
              console.log(
                `   ⚠️  Resolving conflict for custom_fields: deleting ${conflicting.id} (slug: ${row.slug})`
              )
              await trx.from(tableName).where('id', conflicting.id).delete()
            }
          } else if (tableName === 'menus' && row.slug) {
            const conflicting = await trx
              .from(tableName)
              .where('slug', row.slug)
              .where('id', '!=', row.id)
              .first()
            if (conflicting) {
              console.log(
                `   ⚠️  Resolving conflict for menus: deleting ${conflicting.id} (slug: ${row.slug})`
              )
              await trx.from(tableName).where('id', conflicting.id).delete()
            }
          } else if (tableName === 'users' && row.email) {
            const conflicting = await trx
              .from(tableName)
              .where('email', row.email)
              .where('id', '!=', row.id)
              .first()
            if (conflicting) {
              console.log(
                `   ⚠️  Resolving conflict for users: deleting ${conflicting.id} (email: ${row.email})`
              )
              await trx.from(tableName).where('id', conflicting.id).delete()
            }
          }

          try {
            await trx.table(tableName).insert(rowToUpsert)
            if (useSavepoint) await trx.raw(`RELEASE SAVEPOINT ${savepointName}`)
            return 1
          } catch (insertError: any) {
            throw insertError
          }
        }
      } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
        // MySQL: Use Knex's onConflict().merge() (works as ON DUPLICATE KEY UPDATE)
        const { id, ...updateData } = row
        const result = await trx(tableName).insert(row).onConflict('id').merge(updateData)
        return result[0]?.affectedRows || 0
      } else {
        // SQLite: Use Knex's onConflict().merge()
        const { id, ...updateData } = row
        await trx(tableName).insert(row).onConflict('id').merge(updateData)
        return 1 // Assume success
      }
    } catch (error: any) {
      if (useSavepoint) {
        await trx.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`)
      }

      // Provide more context in error message
      const errorMsg = error?.message || String(error)
      throw new Error(`Failed to upsert row in ${tableName} (id: ${row.id}): ${errorMsg}`)
    }
  }

  /**
   * Disable foreign key checks (database-specific)
   */
  private async disableForeignKeyChecks(trx: any): Promise<void> {
    const dialectName = dbConfig.connections[dbConfig.connection].client

    try {
      if (dialectName === 'postgres' || dialectName === 'pg') {
        await trx.raw('SET session_replication_role = replica')
        console.log('   ✓ PostgreSQL: SET session_replication_role = replica')
        // Also set constraints to deferred for this transaction
        await trx.raw('SET CONSTRAINTS ALL DEFERRED')
        console.log('   ✓ PostgreSQL: SET CONSTRAINTS ALL DEFERRED')
      } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
        await trx.raw('SET FOREIGN_KEY_CHECKS=0')
        console.log('   ✓ MySQL: SET FOREIGN_KEY_CHECKS=0')
      } else if (dialectName === 'sqlite' || dialectName === 'better-sqlite3') {
        await trx.raw('PRAGMA foreign_keys = OFF')
        console.log('   ✓ SQLite: PRAGMA foreign_keys = OFF')
      }
    } catch (error) {
      console.error('   ⚠️  Failed to disable foreign key checks:', (error as Error).message)
    }
  }

  /**
   * Enable foreign key checks (database-specific)
   */
  private async enableForeignKeyChecks(trx: any): Promise<void> {
    const dialectName = dbConfig.connections[dbConfig.connection].client

    try {
      if (dialectName === 'postgres' || dialectName === 'pg') {
        await trx.raw('SET CONSTRAINTS ALL IMMEDIATE')
        console.log('   ✓ PostgreSQL: SET CONSTRAINTS ALL IMMEDIATE')
        await trx.raw('SET session_replication_role = DEFAULT')
        console.log('   ✓ PostgreSQL: SET session_replication_role = DEFAULT')
      } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
        await trx.raw('SET FOREIGN_KEY_CHECKS=1')
        console.log('   ✓ MySQL: SET FOREIGN_KEY_CHECKS=1')
      } else if (dialectName === 'sqlite' || dialectName === 'better-sqlite3') {
        await trx.raw('PRAGMA foreign_keys = ON')
        console.log('   ✓ SQLite: PRAGMA foreign_keys = ON')
      }
    } catch (error) {
      console.error('   ⚠️  Failed to enable foreign key checks:', (error as Error).message)
    }
  }

  /**
   * Import from JSON string
   */
  async importFromJson(jsonString: string, options: ImportOptions = {}): Promise<ImportResult> {
    const data = JSON.parse(jsonString)
    return this.importDatabase(data, options)
  }

  /**
   * Import from Buffer
   */
  async importFromBuffer(buffer: Buffer, options: ImportOptions = {}): Promise<ImportResult> {
    const jsonString = buffer.toString('utf-8')
    return this.importFromJson(jsonString, options)
  }
}

const databaseImportService = new DatabaseImportService()
export default databaseImportService
