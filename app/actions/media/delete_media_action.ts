import fs from 'node:fs'
import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import storageService from '#services/storage_service'
import mediaUsageService from '#services/media_usage_service'
import logActivityAction from '#actions/log_activity_action'
import dispatchWebhookAction from '#actions/dispatch_webhook_action'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'

const execAsync = promisify(exec)

export interface DeleteMediaOptions {
  id: string
  userId: number | null
  force?: boolean
}

export class DeleteMediaAction {
  async handle(options: DeleteMediaOptions) {
    const { id, userId, force = false } = options
    const row = await db.from('media_assets').where('id', id).first()
    if (!row) throw new Error('Media not found')

    const url = String(row.url || '')

    // Safety check: Don't delete if in use (unless force=true)
    const usage = await mediaUsageService.getUsage(id, url)
    const inUse =
      usage.inModules.length > 0 ||
      usage.inOverrides.length > 0 ||
      usage.inPosts.length > 0 ||
      usage.inSettings ||
      usage.inCodebase.length > 0

    if (inUse && !force) {
      let message = 'This media is currently in use and cannot be deleted.'
      if (usage.inSettings) {
        message = 'This media is used in Site Settings (Logo/Favicon) and cannot be deleted.'
      } else if (usage.inCodebase.length > 0) {
        message = `This media is referenced in source code (${usage.inCodebase[0]}${usage.inCodebase.length > 1 ? ', etc.' : ''}) and cannot be deleted.`
      }

      throw {
        status: 409,
        message,
        usage,
      }
    }

    const publicRoot = path.join(process.cwd(), 'public')
    const originalUrl = String(row.url || '')
    const optimizedUrl = String((row as any).optimized_url || '')

    // Helper to delete a file from disk and storage
    const deleteFile = async (fUrl: string) => {
      if (!fUrl) return
      try {
        const p = path.join(publicRoot, fUrl.replace(/^\//, ''))
        await fs.promises.unlink(p)
      } catch { }
      try {
        await storageService.deleteByUrl(fUrl)
      } catch { }
    }

    // Delete original and main optimized files
    await deleteFile(originalUrl)
    await deleteFile(optimizedUrl)

    // Delete known variants from metadata
    try {
      const meta = (row as any).metadata as any
      const variants = meta && Array.isArray(meta.variants) ? meta.variants : []
      for (const v of variants) {
        await deleteFile(v?.url)
        await deleteFile(v?.optimizedUrl)
      }

      await deleteFile(meta?.darkSourceUrl)
      await deleteFile(meta?.darkOptimizedUrl)
    } catch { }

    // Fallback: pattern-based deletion
    try {
      const originalPath = path.join(publicRoot, originalUrl.replace(/^\//, ''))
      const parsed = path.parse(originalPath)
      const dir = parsed.dir
      const base = parsed.name
      const files = await fs.promises.readdir(dir)
      await Promise.all(
        files.map(async (f) => {
          const isRelated = f.startsWith(base + '.') || f.startsWith(base + '-dark')
          if (isRelated && f !== parsed.base) {
            await deleteFile(path.posix.join(path.posix.dirname(originalUrl), f))
          }
        })
      )
    } catch { }

    await db.from('media_assets').where('id', id).delete()
    
    await logActivityAction.handle({
      action: 'media.delete',
      userId,
      entityType: 'media',
      entityId: id,
    })

    await dispatchWebhookAction.handle({
      event: 'media.deleted',
      data: { id, url },
    })

    return true
  }
}

export default new DeleteMediaAction()

