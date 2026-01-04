import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import mediaService from '#services/media_service'
import logActivityAction from '#actions/log_activity_action'

export interface OptimizeMediaOptions {
  id: string
  userId: number | null
}

export class OptimizeMediaAction {
  async handle(options: OptimizeMediaOptions) {
    const { id, userId } = options
    const row = await db.from('media_assets').where('id', id).first()
    if (!row) throw new Error('Media not found')

    const mime = String(row.mime_type || '')
    const publicUrl: string = String(row.url)
    const isImage = mime.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif)$/i.test(publicUrl)
    
    if (!isImage) {
      throw new Error('Only images can be optimized')
    }

    const absPath = path.join(process.cwd(), 'public', publicUrl.replace(/^\//, ''))
    
    const result = await mediaService.optimizeToWebp(absPath, publicUrl)
    if (!result) throw new Error('Unsupported image type for optimization')

    const metadata = (row.metadata || {}) as any
    if (Array.isArray(metadata.variants)) {
      metadata.variants = await mediaService.optimizeVariantsToWebp(
        metadata.variants,
        path.join(process.cwd(), 'public')
      )
    }

    if (metadata.darkSourceUrl) {
      const darkAbsPath = path.join(
        process.cwd(),
        'public',
        metadata.darkSourceUrl.replace(/^\//, '')
      )
      try {
        const darkOptimized = await mediaService.optimizeToWebp(darkAbsPath, metadata.darkSourceUrl)
        if (darkOptimized) {
          metadata.darkOptimizedUrl = darkOptimized.optimizedUrl
          metadata.darkOptimizedSize = darkOptimized.size
        }
      } catch { /* ignore */ }
    }

    const now = new Date()
    await db
      .from('media_assets')
      .where('id', id)
      .update({
        optimized_url: result.optimizedUrl,
        optimized_size: Number(result.size || 0),
        optimized_at: now,
        updated_at: now,
        metadata: JSON.stringify(metadata),
      } as any)

    await logActivityAction.handle({
      action: 'media.optimize',
      userId,
      entityType: 'media',
      entityId: id,
      metadata: { optimizedUrl: result.optimizedUrl, optimizedSize: Number(result.size || 0) },
    })

    return { optimizedUrl: result.optimizedUrl, optimizedSize: Number(result.size || 0) }
  }

  async handleBulk(ids: string[], userId: number | null) {
    let success = 0
    for (const id of ids) {
      try {
        await this.handle({ id, userId })
        success++
      } catch { /* continue */ }
    }

    await logActivityAction.handle({
      action: 'media.optimize.bulk',
      userId,
      entityType: 'media',
      entityId: 'bulk',
      metadata: { count: success },
    })

    return { optimized: success }
  }
}

export default new OptimizeMediaAction()

