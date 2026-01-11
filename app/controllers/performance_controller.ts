import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import redis from '@adonisjs/redis/services/main'
import storageService from '#services/storage_service'
import cmsConfig from '#config/cms'
import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'

import env from '#start/env'

/**
 * Performance Controller
 *
 * Provides endpoints for performance monitoring and management:
 * - Performance posture checks
 * - Cache management (Redis, etc.)
 * - System resources monitoring
 */
export default class PerformanceController {
  /**
   * GET /admin/performance
   * Performance dashboard page
   */
  async index({ inertia }: HttpContext) {
    return inertia.render('admin/performance/index')
  }

  /**
   * GET /api/performance/posture
   * Get performance posture checklist and system stats
   */
  async posture({ response }: HttpContext) {
    const redisStatus = await this.checkRedis()
    const dbStatus = await this.checkDb()
    const r2Status = await this.checkR2()

    const checks = {
      redisOperational: {
        label: 'Redis Status',
        status: redisStatus.operational ? 'pass' : 'fail',
        message: redisStatus.message,
        recommendation: !redisStatus.operational ? 'Check Redis connection settings and server status' : null,
      },
      r2Storage: {
        label: 'Cloud Storage (R2)',
        status: r2Status.operational ? 'pass' : (storageService.isR2() ? 'fail' : 'info'),
        message: r2Status.message,
        recommendation: !r2Status.operational && storageService.isR2() ? 'Check R2 credentials and bucket settings' : null,
      },
      dbLatency: {
        label: 'Database Latency',
        status: dbStatus.latency < 100 ? 'pass' : (dbStatus.latency < 500 ? 'warn' : 'fail'),
        message: `Current latency: ${dbStatus.latency}ms`,
        recommendation: dbStatus.latency >= 100 ? 'Consider database optimization or scaling' : null,
      },
      productionMode: {
        label: 'Production Mode',
        status: app.inProduction ? 'pass' : 'warn',
        message: app.inProduction ? 'Running in production mode' : 'Running in development mode',
        recommendation: !app.inProduction ? 'Ensure production mode is used for live sites' : null,
      },
      cachingEnabled: {
        label: 'Redis Cache Plugin',
        status: cmsConfig.cache.enabled ? 'pass' : 'warn',
        message: cmsConfig.cache.enabled ? 'Enabled' : 'Disabled (REDIS_CACHE_ENABLED=false)',
        recommendation: !cmsConfig.cache.enabled ? 'Enable for significant performance gains on live sites' : null,
      },
      assetMinification: {
        label: 'Asset Minification',
        status: app.inProduction ? 'pass' : 'info',
        message: app.inProduction ? 'Assets are served minified' : 'Assets are served unminified (dev mode)',
        recommendation: null,
      }
    }

    const containerMemory = await this.getContainerMemory()
    const systemStats = {
      memory: {
        free: os.freemem(),
        total: os.totalmem(),
        usagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
      },
      containerMemory,
      cpuLoad: os.loadavg(),
      uptime: os.uptime(),
      nodeMemory: process.memoryUsage(),
      storage: {
        isR2: storageService.isR2(),
        tempSize: await this.getDirSize(path.join(process.cwd(), 'tmp')),
      },
    }

    const passed = Object.values(checks).filter((c) => c.status === 'pass').length
    const total = Object.keys(checks).length

    return response.ok({
      checks,
      systemStats,
      summary: {
        passed,
        total,
        overallStatus: passed === total ? 'pass' : (passed > total / 2 ? 'warn' : 'fail'),
      },
    })
  }

  /**
   * POST /api/performance/cache/clear
   * Clear Redis cache
   */
  async clearCache({ response }: HttpContext) {
    try {
      await redis.flushdb()
      return response.ok({ message: 'Redis cache cleared successfully' })
    } catch (error) {
      return response.badRequest({ message: 'Failed to clear Redis cache', error: error.message })
    }
  }

  /**
   * POST /api/performance/temp/purge
   * Purge the tmp directory (only if R2 is enabled)
   */
  async purgeTemp({ response }: HttpContext) {
    if (!storageService.isR2()) {
      return response.badRequest({ message: 'Cannot purge local storage when R2 is not enabled' })
    }

    try {
      const tempDir = path.join(process.cwd(), 'tmp')
      // Ensure we don't delete the .gitkeep if we want to keep the folder
      await this.clearDir(tempDir, ['.gitkeep'])
      return response.ok({ message: 'Local temp cache purged successfully' })
    } catch (error) {
      return response.badRequest({ message: 'Failed to purge temp cache', error: error.message })
    }
  }

  /**
   * Internal helper to calculate directory size
   */
  private async getDirSize(dirPath: string): Promise<number> {
    let size = 0
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true })
      for (const file of files) {
        const filePath = path.join(dirPath, file.name)
        if (file.isDirectory()) {
          size += await this.getDirSize(filePath)
        } else {
          if (file.name === '.gitkeep') continue
          const stats = await fs.stat(filePath)
          size += stats.size
        }
      }
    } catch {
      // If directory doesn't exist, return 0
    }
    return size
  }

  /**
   * Internal helper to get container memory stats if available
   */
  private async getContainerMemory() {
    try {
      let limit: number | null = null
      let usage: number | null = null

      // Check CGroup v2
      try {
        const limitStr = await fs.readFile('/sys/fs/cgroup/memory.max', 'utf8')
        const usageStr = await fs.readFile('/sys/fs/cgroup/memory.current', 'utf8')
        if (limitStr.trim() !== 'max') {
          limit = parseInt(limitStr.trim())
        }
        usage = parseInt(usageStr.trim())
      } catch {
        // Fallback to CGroup v1
        try {
          const limitStr = await fs.readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8')
          const usageStr = await fs.readFile('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8')
          limit = parseInt(limitStr.trim())
          usage = parseInt(usageStr.trim())

          // In some environments, v1 limit is set to a very large number if not restricted
          if (limit > 1024 * 1024 * 1024 * 1024) { // > 1TB
            limit = null
          }
        } catch {
          // No cgroup stats available
        }
      }

      if (usage === null) return null

      return {
        usage,
        limit,
        usagePercent: limit ? Math.round((usage / limit) * 100) : null,
      }
    } catch {
      return null
    }
  }

  /**
   * Internal helper to clear a directory's contents
   */
  private async clearDir(dirPath: string, skip: string[] = []) {
    try {
      const files = await fs.readdir(dirPath)
      for (const file of files) {
        if (skip.includes(file)) continue
        const filePath = path.join(dirPath, file)
        const stats = await fs.stat(filePath)
        if (stats.isDirectory()) {
          await fs.rm(filePath, { recursive: true, force: true })
        } else {
          await fs.unlink(filePath)
        }
      }
    } catch {
      // If directory doesn't exist, nothing to clear
    }
  }

  /**
   * Internal helper to check R2 status
   */
  private async checkR2() {
    if (!storageService.isR2()) {
      return { operational: false, message: 'Local driver in use' }
    }

    try {
      const start = Date.now()
      // Verify storage settings
      const endpoint = env.get('R2_ENDPOINT') || process.env.R2_ENDPOINT
      const keyId = env.get('R2_ACCESS_KEY_ID') || process.env.R2_ACCESS_KEY_ID
      const secret = env.get('R2_SECRET_ACCESS_KEY') || process.env.R2_SECRET_ACCESS_KEY
      const bucket = env.get('R2_BUCKET') || process.env.R2_BUCKET

      const missing = []
      if (!endpoint) missing.push('R2_ENDPOINT')
      if (!keyId) missing.push('R2_ACCESS_KEY_ID')
      if (!secret) missing.push('R2_SECRET_ACCESS_KEY')
      if (!bucket) missing.push('R2_BUCKET')

      if (missing.length > 0) {
        return { operational: false, message: `Missing: ${missing.join(', ')}` }
      }

      const latency = Date.now() - start
      return { operational: true, message: `Connected (Latency: ${latency}ms)`, latency }
    } catch (error) {
      return { operational: false, message: 'Connection failed', error: error.message }
    }
  }

  /**
   * Internal helper to check Redis status
   */
  private async checkRedis() {
    try {
      const start = Date.now()
      await redis.ping()
      const latency = Date.now() - start
      return { operational: true, message: `Connected (Latency: ${latency}ms)`, latency }
    } catch (error) {
      return { operational: false, message: 'Disconnected', error: error.message }
    }
  }

  /**
   * Internal helper to check Database status
   */
  private async checkDb() {
    try {
      const start = Date.now()
      await db.rawQuery('SELECT 1')
      const latency = Date.now() - start
      return { operational: true, latency }
    } catch (error) {
      return { operational: false, latency: -1, error: error.message }
    }
  }
}

