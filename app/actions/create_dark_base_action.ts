import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import mediaService from '#services/media_service'

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
    const publicRoot = path.join(process.cwd(), 'public')
    const originalPublicUrl: string = String(row.url)
    const originalAbsPath = path.join(publicRoot, originalPublicUrl.replace(/^\//, ''))

    const parsed = path.parse(originalAbsPath)
    const darkName = `${parsed.name}-dark${parsed.ext}`
    const darkAbsPath = path.join(parsed.dir, darkName)
    const darkPublicUrl = path.posix.join(path.posix.dirname(originalPublicUrl), darkName)

    // Generate the dark base using a "base" variant (full size with tint applied)
    const darkVariants = await mediaService.generateVariants(
      originalAbsPath,
      darkPublicUrl,
      [
        {
          name: 'base',
          width: undefined,
          height: undefined,
          fit: 'inside' as const,
        },
      ],
      null,
      null,
      'dark' // Apply dark tint
    )

    const baseVariant = darkVariants[0]
    if (!baseVariant?.url) {
      throw new Error('Failed to generate dark base file')
    }

    const darkSourceUrl = baseVariant.url

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

