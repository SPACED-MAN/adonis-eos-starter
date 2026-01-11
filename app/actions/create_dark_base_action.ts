import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import sharp from 'sharp'
import storageService from '#services/storage_service'

export type CreateDarkBaseOptions = {
  mediaId?: string
  mediaRecord?: any
  /** If true, update the database with the new dark base. Default: true */
  updateDatabase?: boolean
}

export type CreateDarkBaseResult = {
  darkSourceUrl: string
  metadata: any
}

/**
 * Action: Create a dark base file from a light original
 *
 * When a media asset doesn't have a manually-uploaded dark version,
 * this creates one by applying dark tint to the original.
 *
 * Stores the result as darkSourceUrl in metadata.
 *
 * Usage:
 *   const result = await createDarkBaseAction.execute({ mediaId: '123' })
 */
class CreateDarkBaseAction {
  async execute(options: CreateDarkBaseOptions): Promise<CreateDarkBaseResult> {
    const { updateDatabase = true } = options

    // Get media record
    let row = options.mediaRecord
    if (!row && options.mediaId) {
      row = await db.from('media_assets').where('id', options.mediaId).first()
      if (!row) throw new Error('Media not found')
    }
    if (!row) throw new Error('Either mediaId or mediaRecord must be provided')

    const existingMeta = (row.metadata || {}) as any
    const existingDarkSourceUrl =
      typeof existingMeta.darkSourceUrl === 'string' ? existingMeta.darkSourceUrl : undefined

    // If dark base already exists, return it
    if (existingDarkSourceUrl) {
      return {
        darkSourceUrl: existingDarkSourceUrl,
        metadata: existingMeta,
      }
    }

    // Create dark base file
    const originalPublicUrl: string = String(row.url)
    const originalAbsPath = await storageService.ensureLocalFile(originalPublicUrl)

    const parsed = path.parse(originalAbsPath)
    const darkName = `${parsed.name}-dark${parsed.ext}`
    const darkAbsPath = path.join(parsed.dir, darkName)
    const darkPublicUrl = path.posix.join(storageService.getRelativeDir(originalPublicUrl), darkName)

    // Get env-controlled dark tint settings
    const darkBrightnessRaw = process.env.MEDIA_DARK_BRIGHTNESS
    const darkSaturationRaw = process.env.MEDIA_DARK_SATURATION
    const darkBrightness = (() => {
      const n = darkBrightnessRaw !== undefined ? Number(darkBrightnessRaw) : 0.55
      return Number.isFinite(n) ? Math.max(0.1, Math.min(2, n)) : 0.55
    })()
    const darkSaturation = (() => {
      const n = darkSaturationRaw !== undefined ? Number(darkSaturationRaw) : 0.75
      return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 0.75
    })()

    // Generate the dark base directly with sharp to get exact filename we want
    // (using generateVariants would add variant name suffix)
    await sharp(originalAbsPath)
      .modulate({
        brightness: darkBrightness,
        saturation: darkSaturation,
      })
      .toFile(darkAbsPath)

    // Publish to storage (local no-op, R2 uploads)
    const mimeType = (() => {
      const ext = parsed.ext.toLowerCase()
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          return 'image/jpeg'
        case '.png':
          return 'image/png'
        case '.webp':
          return 'image/webp'
        case '.gif':
          return 'image/gif'
        case '.avif':
          return 'image/avif'
        default:
          return 'image/jpeg'
      }
    })()

    let finalDarkUrl = darkPublicUrl
    try {
      const storageUrl = await storageService.publishFile(darkAbsPath, darkPublicUrl, mimeType)
      if (storageUrl) {
        finalDarkUrl = storageUrl
      }
    } catch {
      // Ignore publish errors
    }

    const darkSourceUrl = finalDarkUrl

    // Update metadata
    const metadata = {
      ...existingMeta,
      darkSourceUrl,
    }

    // Update database if requested
    if (updateDatabase) {
      await db
        .from('media_assets')
        .where('id', row.id)
        .update({
          metadata: metadata as any,
          updated_at: new Date(),
        } as any)
    }

    return {
      darkSourceUrl,
      metadata,
    }
  }
}

const createDarkBaseAction = new CreateDarkBaseAction()
export default createDarkBaseAction
