import type { HttpContext } from '@adonisjs/core/http'
import databaseExportService, { type ContentType } from '#services/database_export_service'
import databaseImportService, { type ImportStrategy } from '#services/database_import_service'
import findReplaceService from '#services/find_replace_service'
import roleRegistry from '#services/role_registry'
import { readFile } from 'node:fs/promises'
import db from '@adonisjs/lucid/services/db'

export default class DatabaseAdminController {
  /**
   * GET /admin/database
   * Show database export/import page
   */
  async index({ inertia, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!roleRegistry.hasPermission(role, 'admin.database.export')) {
      return inertia.render('admin/forbidden')
    }

    return inertia.render('admin/database/index')
  }

  /**
   * GET /api/database/export/stats
   * Get export statistics and content type info
   */
  async getExportStats({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!roleRegistry.hasPermission(role, 'admin.database.export')) {
      return response.forbidden({ error: 'Not allowed to export database' })
    }

    try {
      const contentTypesParam = request.input('contentTypes')
      const contentTypes: ContentType[] | undefined = contentTypesParam
        ? Array.isArray(contentTypesParam)
          ? contentTypesParam
          : contentTypesParam.split(',')
        : undefined

      const stats = await databaseExportService.getExportStats(contentTypes)
      const contentTypeStats = await databaseExportService.getContentTypeStats()

      return response.ok({
        ...stats,
        contentTypes: contentTypeStats,
      })
    } catch (error) {
      return response.badRequest({ error: (error as Error).message })
    }
  }

  /**
   * GET /api/database/export
   * Export database and download as JSON file
   * Query params: contentTypes (comma-separated), preserveIds (boolean)
   */
  async export({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!roleRegistry.hasPermission(role, 'admin.database.export')) {
      return response.forbidden({ error: 'Not allowed to export database' })
    }

    try {
      const contentTypesParam = request.input('contentTypes')
      const preserveIds = request.input('preserveIds', 'true') === 'true'

      const contentTypes: ContentType[] | undefined = contentTypesParam
        ? Array.isArray(contentTypesParam)
          ? contentTypesParam
          : contentTypesParam.split(',')
        : undefined

      const buffer = await databaseExportService.exportToBuffer({
        contentTypes,
        preserveIds,
      })
      const filename = databaseExportService.getExportFilename({ contentTypes, preserveIds })

      response.header('Content-Type', 'application/json')
      response.header('Content-Disposition', `attachment; filename="${filename}"`)
      response.header('Content-Length', buffer.length.toString())

      return response.send(buffer)
    } catch (error) {
      // Export failed
      return response.badRequest({ error: (error as Error).message })
    }
  }

  /**
   * POST /api/database/import
   * Import database from uploaded JSON file
   * Body: { file: MultipartFile, strategy?: 'replace' | 'merge' | 'skip' | 'overwrite', preserveIds?: boolean }
   */
  async import({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!roleRegistry.hasPermission(role, 'admin.database.import')) {
      return response.forbidden({ error: 'Not allowed to import database' })
    }

    try {
      const file = request.file('file', {
        size: '100mb',
        extnames: ['json'],
      })

      if (!file) {
        return response.badRequest({ error: 'No file uploaded' })
      }

      if (!file.isValid) {
        return response.badRequest({ error: file.errors[0]?.message || 'Invalid file' })
      }

      // Get import strategy from request
      const strategy = (request.input('strategy') as ImportStrategy) || 'merge'
      const preserveIds = request.input('preserveIds', 'true') === 'true'

      // Validate strategy
      if (!['replace', 'merge', 'skip', 'overwrite'].includes(strategy)) {
        return response.badRequest({
          error: 'Invalid strategy. Must be: replace, merge, skip, or overwrite',
        })
      }

      // Read file content from temporary path
      if (!file.tmpPath) {
        return response.badRequest({ error: 'File upload failed' })
      }
      const content = await readFile(file.tmpPath)

      // Perform import
      const result = await databaseImportService.importFromBuffer(content, {
        strategy,
        preserveIds,
        disableForeignKeyChecks: true,
      })

      if (result.success) {
        return response.ok({
          message: 'Database imported successfully',
          result: {
            tablesImported: result.tablesImported,
            rowsImported: result.rowsImported,
            skippedTables: result.skippedTables,
            errors: result.errors,
          },
        })
      } else {
        return response.badRequest({
          error: 'Import failed',
          result: {
            tablesImported: result.tablesImported,
            rowsImported: result.rowsImported,
            errors: result.errors,
          },
        })
      }
    } catch (error) {
      // Import failed
      return response.badRequest({ error: (error as Error).message })
    }
  }

  /**
   * POST /api/database/validate
   * Validate uploaded export file without importing
   */
  async validate({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!roleRegistry.hasPermission(role, 'admin.database.import')) {
      return response.forbidden({ error: 'Not allowed to validate import files' })
    }

    try {
      const file = request.file('file', {
        size: '100mb',
        extnames: ['json'],
      })

      if (!file) {
        return response.badRequest({ error: 'No file uploaded' })
      }

      if (!file.isValid) {
        return response.badRequest({ error: file.errors[0]?.message || 'Invalid file' })
      }

      // Read and parse file from temporary path
      if (!file.tmpPath) {
        return response.badRequest({ error: 'File upload failed' })
      }
      const content = await readFile(file.tmpPath)
      const data = JSON.parse(content.toString('utf-8'))

      // Validate structure
      const validation = databaseImportService.validateExportData(data)

      if (!validation.valid) {
        return response.ok({
          valid: false,
          error: validation.error,
        })
      }

      // Count tables and rows
      const tables = Object.keys(data.tables)
      let totalRows = 0
      const tableStats = tables.map((tableName) => {
        const rowCount = data.tables[tableName].length
        totalRows += rowCount
        return { table: tableName, rows: rowCount }
      })

      return response.ok({
        valid: true,
        metadata: data.metadata,
        stats: {
          tables: tableStats.length,
          totalRows,
          tableDetails: tableStats,
        },
      })
    } catch (error) {
      return response.badRequest({
        valid: false,
        error: `Failed to parse file: ${(error as Error).message}`,
      })
    }
  }

  /**
   * GET /api/database/optimize/stats
   * Get statistics about orphaned data that can be cleaned
   */
  async getOptimizeStats({ response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!roleRegistry.hasPermission(role, 'admin.database.export')) {
      return response.forbidden({ error: 'Admin role required' })
    }

    try {
      // Find orphaned module_instances with scope='post' that are not referenced by post_modules
      const orphanedResult = await db
        .from('module_instances')
        .leftJoin('post_modules', 'module_instances.id', 'post_modules.module_id')
        .where('module_instances.scope', 'post')
        .whereNull('post_modules.id')
        .count('* as count')
        .first()

      const orphanedCount = Number(orphanedResult?.count || 0)

      // Find module_instances with invalid post_id references (posts that don't exist)
      const invalidPostRefs = await db
        .from('module_instances')
        .leftJoin('posts', 'module_instances.post_id', 'posts.id')
        .whereNotNull('module_instances.post_id')
        .whereNull('posts.id')
        .count('* as count')
        .first()

      const invalidPostRefCount = Number(invalidPostRefs?.count || 0)

      // Find post_modules that reference non-existent module_instances
      const invalidModuleRefs = await db
        .from('post_modules')
        .leftJoin('module_instances', 'post_modules.module_id', 'module_instances.id')
        .whereNull('module_instances.id')
        .count('* as count')
        .first()

      const invalidModuleRefCount = Number(invalidModuleRefs?.count || 0)

      // Find stale render cache entries (optional - could be large)
      const staleCacheEntries = await db
        .from('module_instances')
        .whereNotNull('render_cache_html')
        .count('* as count')
        .first()

      const staleCacheCount = Number(staleCacheEntries?.count || 0)

      // 4. Feedback
      const feedbackResult = await db.from('feedbacks').count('* as count').first()
      const feedbackCount = Number(feedbackResult?.count || 0)

      // 5. Audit logs
      const auditResult = await db.from('activity_logs').count('* as count').first()
      const auditCount = Number(auditResult?.count || 0)

      // 6. Agent transcripts
      const agentResult = await db.from('agent_executions').count('* as count').first()
      const agentCount = Number(agentResult?.count || 0)

      return response.ok({
        orphanedModuleInstances: orphanedCount,
        invalidPostReferences: invalidPostRefCount,
        invalidModuleReferences: invalidModuleRefCount,
        staleRenderCache: staleCacheCount,
        feedbackCount,
        auditCount,
        agentCount,
        totalIssues: orphanedCount + invalidPostRefCount + invalidModuleRefCount,
      })
    } catch (error) {
      return response.badRequest({ error: (error as Error).message })
    }
  }

  /**
   * POST /api/database/optimize
   * Clean orphaned data from the database
   * Body: { cleanOrphanedModules?: boolean, cleanInvalidRefs?: boolean, clearRenderCache?: boolean }
   */
  async optimize({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!roleRegistry.hasPermission(role, 'admin.database.export')) {
      return response.forbidden({ error: 'Admin role required' })
    }

    try {
      const cleanOrphanedModules = request.input('cleanOrphanedModules', true) !== false
      const cleanInvalidRefs = request.input('cleanInvalidRefs', true) !== false
      const clearRenderCache = request.input('clearRenderCache', false) === true
      const cleanFeedback = request.input('cleanFeedback', false) === true
      const cleanAuditLogs = request.input('cleanAuditLogs', false) === true
      const cleanAgentTranscripts = request.input('cleanAgentTranscripts', false) === true

      const results: {
        orphanedModulesDeleted: number
        invalidPostRefsDeleted: number
        invalidModuleRefsDeleted: number
        renderCacheCleared: number
        feedbackDeleted: number
        auditLogsDeleted: number
        agentTranscriptsDeleted: number
      } = {
        orphanedModulesDeleted: 0,
        invalidPostRefsDeleted: 0,
        invalidModuleRefsDeleted: 0,
        renderCacheCleared: 0,
        feedbackDeleted: 0,
        auditLogsDeleted: 0,
        agentTranscriptsDeleted: 0,
      }

      await db.transaction(async (trx) => {
        // 1. Delete orphaned module_instances (scope='post' not referenced by post_modules)
        if (cleanOrphanedModules) {
          const orphanedRows = await trx
            .from('module_instances')
            .leftJoin('post_modules', 'module_instances.id', 'post_modules.module_id')
            .where('module_instances.scope', 'post')
            .whereNull('post_modules.id')
            .select('module_instances.id')

          const orphanedIds = orphanedRows.map((row: any) => row.id)

          if (orphanedIds.length > 0) {
            await trx.from('module_instances').whereIn('id', orphanedIds).delete()
            results.orphanedModulesDeleted = orphanedIds.length
          }
        }

        // 2. Delete module_instances with invalid post_id references
        if (cleanInvalidRefs) {
          const invalidPostRefRows = await trx
            .from('module_instances')
            .leftJoin('posts', 'module_instances.post_id', 'posts.id')
            .whereNotNull('module_instances.post_id')
            .whereNull('posts.id')
            .select('module_instances.id')

          const invalidPostRefIds = invalidPostRefRows.map((row: any) => row.id)

          if (invalidPostRefIds.length > 0) {
            await trx.from('module_instances').whereIn('id', invalidPostRefIds).delete()
            results.invalidPostRefsDeleted = invalidPostRefIds.length
          }

          // Delete post_modules that reference non-existent module_instances
          const invalidModuleRefRows = await trx
            .from('post_modules')
            .leftJoin('module_instances', 'post_modules.module_id', 'module_instances.id')
            .whereNull('module_instances.id')
            .select('post_modules.id')

          const invalidModuleRefIds = invalidModuleRefRows.map((row: any) => row.id)

          if (invalidModuleRefIds.length > 0) {
            await trx.from('post_modules').whereIn('id', invalidModuleRefIds).delete()
            results.invalidModuleRefsDeleted = invalidModuleRefIds.length
          }
        }

        // 3. Clear render cache (optional, can be regenerated)
        if (clearRenderCache) {
          const cleared = await trx
            .from('module_instances')
            .whereNotNull('render_cache_html')
            .update({
              render_cache_html: null,
              render_etag: null,
            })
          results.renderCacheCleared = Number(Array.isArray(cleared) ? cleared[0] : cleared) || 0
        }

        // 4. Clean Feedback
        if (cleanFeedback) {
          const deleted = await trx.from('feedbacks').delete()
          results.feedbackDeleted = Number(deleted) || 0
        }

        // 5. Clean Audit Logs
        if (cleanAuditLogs) {
          const deleted = await trx.from('activity_logs').delete()
          results.auditLogsDeleted = Number(deleted) || 0
        }

        // 6. Clean Agent Transcripts
        if (cleanAgentTranscripts) {
          const deleted = await trx.from('agent_executions').delete()
          results.agentTranscriptsDeleted = Number(deleted) || 0
        }
      })

      return response.ok({
        message: 'Database optimization completed',
        results,
      })
    } catch (error) {
      return response.badRequest({ error: (error as Error).message })
    }
  }

  /**
   * GET /api/database/find-replace/tables
   * Get list of searchable tables and their columns
   */
  async getFindReplaceTables({ response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!roleRegistry.hasPermission(role, 'admin.database.export')) {
      return response.forbidden({ error: 'Admin role required' })
    }

    try {
      const tables = await findReplaceService.getSearchableTables()
      return response.ok({ data: tables })
    } catch (error) {
      return response.badRequest({ error: (error as Error).message })
    }
  }

  /**
   * POST /api/database/find-replace
   * Perform find and replace
   */
  async findReplace({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!roleRegistry.hasPermission(role, 'admin.database.export')) {
      return response.forbidden({ error: 'Admin role required' })
    }

    try {
      const search = request.input('search')
      const replace = request.input('replace')
      const tables = request.input('tables')
      const dryRun = request.input('dryRun', true) !== false
      const caseSensitive = request.input('caseSensitive', true) === true

      if (!search) {
        return response.badRequest({ error: 'Search string is required' })
      }

      if (!tables || !Array.isArray(tables) || tables.length === 0) {
        return response.badRequest({ error: 'At least one table must be selected' })
      }

      const result = await findReplaceService.performReplace({
        search,
        replace,
        tables,
        dryRun,
        caseSensitive,
      })

      return response.ok({
        message: dryRun ? 'Dry run completed' : 'Find and replace completed',
        result,
      })
    } catch (error) {
      return response.badRequest({ error: (error as Error).message })
    }
  }
}
