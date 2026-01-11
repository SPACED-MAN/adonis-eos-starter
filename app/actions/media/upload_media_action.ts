import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import mediaService from '#services/media_service'
import storageService from '#services/storage_service'
import logActivityAction from '#actions/log_activity_action'
import dispatchWebhookAction from '#actions/dispatch_webhook_action'

export interface UploadMediaOptions {
  file: {
    tmpPath?: string
    clientName?: string
    size: number
    contentType?: string
    toBuffer?: () => Promise<Buffer>
    arrayBuffer?: () => Promise<ArrayBuffer>
  }
  altText?: string | null
  title?: string | null
  description?: string | null
  naming?: 'original' | 'uuid'
  appendIdIfExists?: boolean
  categories?: string[]
  userId: number | null
}

function sanitizeBaseName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'file'
  )
}

function computeDefaultAlt(fromClientName: string): string | null {
  const dot = fromClientName.lastIndexOf('.')
  const base = dot >= 0 ? fromClientName.slice(0, dot) : fromClientName

  if (base.startsWith('Gemini_Generated_Image_')) {
    return 'AI Generated Image'
  }

  const cleaned = base
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\s{2,}/g, ' ')
  return cleaned || null
}

export class UploadMediaAction {
  async handle(options: UploadMediaOptions) {
    const {
      file,
      altText,
      title,
      description,
      naming = 'original',
      appendIdIfExists = false,
      categories,
      userId,
    } = options

    const clientName = file.clientName
    const size = file.size
    const type = file.contentType || ''

    if (!clientName || !size || !type) {
      throw new Error('Invalid file data')
    }

    const uploadsDir = storageService.getLocalPath('uploads')
    await fs.promises.mkdir(uploadsDir, { recursive: true })
    const ext = (path.extname(clientName) || '').toLowerCase()

    // Normalize mime type
    let mime = type
    if (!mime.includes('/')) {
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          mime = 'image/jpeg'
          break
        case '.png':
          mime = 'image/png'
          break
        case '.webp':
          mime = 'image/webp'
          break
        case '.gif':
          mime = 'image/gif'
          break
        case '.svg':
          mime = 'image/svg+xml'
          break
        case '.json':
          mime = 'application/json'
          break
        case '.lottie':
          mime = 'application/x-lottie'
          break
        case '.avif':
          mime = 'image/avif'
          break
        default:
          mime = type || 'application/octet-stream'
      }
    }

    let filename: string
    if (naming === 'original') {
      const base = sanitizeBaseName(path.parse(clientName).name || 'file')
      let candidate = `${base}${ext}`
      if (appendIdIfExists) {
        try {
          await fs.promises.access(path.join(uploadsDir, candidate))
          const shortId = crypto.randomUUID().slice(0, 8)
          candidate = `${base}-${shortId}${ext}`
        } catch {
          /* ok */
        }
      } else {
        let counter = 1
        while (true) {
          try {
            await fs.promises.access(path.join(uploadsDir, candidate))
            candidate = `${base}-${counter++}${ext}`
          } catch {
            break
          }
        }
      }
      filename = candidate
    } else {
      const base = crypto.randomUUID()
      filename = `${base}${ext}`
    }

    const destPath = path.join(uploadsDir, filename)

    let data: Buffer
    if (file.tmpPath) {
      data = await fs.promises.readFile(file.tmpPath)
    } else if (typeof file.toBuffer === 'function') {
      data = await file.toBuffer()
    } else if (typeof file.arrayBuffer === 'function') {
      const ab = await file.arrayBuffer()
      data = Buffer.from(ab)
    } else {
      throw new Error('Unsupported upload source')
    }

    await fs.promises.writeFile(destPath, data)

    const now = new Date()
    const id = crypto.randomUUID()
    let url = `/uploads/${filename}`

    // Publish to storage
    try {
      const storageUrl = await storageService.publishFile(destPath, url, mime)
      if (storageUrl) {
        url = storageUrl
      }
    } catch {
      /* ignore publish errors; local file remains */
    }

    const isSvg =
      mime.toLowerCase() === 'image/svg+xml' ||
      (ext && ext.toLowerCase() === '.svg') ||
      url.toLowerCase().endsWith('.svg')

    let metadata: any = null
    if (mime.startsWith('image/') && !isSvg) {
      try {
        const variants = await mediaService.generateVariants(
          destPath,
          url,
          null,
          null,
          null,
          'light'
        )
        metadata = { variants }
      } catch {
        /* ignore */
      }
    }

    const isVideo =
      mime.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v|avi)$/i.test(url.split('?')[0])

    const defaultLabel = computeDefaultAlt(clientName)
    const effectiveAltText = isVideo ? null : altText || defaultLabel
    const caption = title || (isVideo ? defaultLabel : null)
    const effectiveDescription = description || null

    await db.table('media_assets').insert({
      id,
      url,
      original_filename: naming === 'original' ? clientName : filename,
      mime_type: mime,
      size: Number(size),
      alt_text: effectiveAltText,
      caption,
      description: effectiveDescription,
      categories:
        categories && categories.length > 0 ? categories : (db.raw('ARRAY[]::text[]') as any),
      metadata: metadata as any,
      created_at: now,
      updated_at: now,
    })

    await logActivityAction.handle({
      action: 'media.upload',
      userId,
      entityType: 'media',
      entityId: id,
      metadata: { filename: clientName, mime, size: Number(size) },
    })

    await dispatchWebhookAction.handle({
      event: 'media.uploaded',
      data: {
        id,
        url,
        filename: clientName,
        mime,
        size: Number(size),
        altText: effectiveAltText,
      },
    })

    try {
      const workflowExecutionService = (await import('#services/workflow_execution_service'))
        .default
      await workflowExecutionService.executeWorkflows(
        'media.uploaded',
        {
          id,
          url,
          filename: clientName,
          mime,
          size: Number(size),
          altText: effectiveAltText,
        },
        { userId: userId ?? undefined }
      )
    } catch (e) {
      console.error('Failed to trigger media.uploaded workflows:', e)
    }

    return { id, url }
  }
}

export default new UploadMediaAction()
