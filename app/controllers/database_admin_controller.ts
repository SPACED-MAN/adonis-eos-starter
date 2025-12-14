import type { HttpContext } from '@adonisjs/core/http'
import databaseExportService, { type ContentType } from '#services/database_export_service'
import databaseImportService, { type ImportStrategy } from '#services/database_import_service'
import roleRegistry from '#services/role_registry'
import { readFile } from 'node:fs/promises'

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
        ? (Array.isArray(contentTypesParam) ? contentTypesParam : contentTypesParam.split(','))
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
        ? (Array.isArray(contentTypesParam) ? contentTypesParam : contentTypesParam.split(','))
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
        return response.badRequest({ error: 'Invalid strategy. Must be: replace, merge, skip, or overwrite' })
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
}
