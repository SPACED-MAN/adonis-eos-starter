import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import mediaService from '#services/media_service'

type DerivSpec = { name: string; width?: number; height?: number; fit: 'inside' | 'cover' }
type CropRect = { left: number; top: number; width: number; height: number }
type FocalPoint = { x: number; y: number }
type Variant = { name: string; url: string; width?: number; height?: number; size: number }

export type GenerateMediaVariantsOptions = {
  mediaId?: string
  mediaRecord?: any
  theme: 'light' | 'dark'
  specs?: DerivSpec[] | null
  cropRect?: CropRect | null
  focalPoint?: FocalPoint | null
  /** If true, update the database with the new variants. Default: true */
  updateDatabase?: boolean
}

export type GenerateMediaVariantsResult = {
  variants: Variant[]
  metadata: any
  darkSourceUrl?: string
}

/**
 * Action: Generate media variants intelligently
 *
 * Handles all the complexity of:
 * - Detecting auto-generated vs manually-uploaded dark bases
 * - Determining when to apply tint vs not
 * - Proper filename conventions (avoiding double -dark suffix)
 * - Metadata name mapping for proper tracking
 *
 * Usage:
 *   const result = await generateMediaVariantsAction.execute({ mediaId: '123', theme: 'dark' })
 *   // or
 *   const result = await generateMediaVariantsAction.execute({ mediaRecord, theme: 'light' })
 */
class GenerateMediaVariantsAction {
  async execute(options: GenerateMediaVariantsOptions): Promise<GenerateMediaVariantsResult> {
    const { theme, specs, cropRect, focalPoint, updateDatabase = true } = options

    // Get media record
    let row = options.mediaRecord
    if (!row && options.mediaId) {
      row = await db.from('media_assets').where('id', options.mediaId).first()
      if (!row) throw new Error('Media not found')
    }
    if (!row) throw new Error('Either mediaId or mediaRecord must be provided')

    const existingMeta = (row.metadata || {}) as any
    const darkSourceUrl =
      typeof existingMeta.darkSourceUrl === 'string' ? existingMeta.darkSourceUrl : undefined

    // Determine source file for variant generation
    let baseUrl: string
    let absPath: string
    let isAlreadyDark = false
    let baseNameEndsWithDark = false

    if (theme === 'dark') {
      // For dark variants, check if we have an existing dark base
      if (darkSourceUrl) {
        // Use existing dark base (either auto-generated or manually uploaded)
        baseUrl = darkSourceUrl
        isAlreadyDark = true
      } else {
        // No dark base exists - need to create one from the light original
        // This is handled by the controller's variants endpoint (lines 369-411)
        // For this action, we'll work with what we're given
        baseUrl = String(row.url)
      }
    } else {
      // Light variants always use the original
      baseUrl = String(row.url)
    }

    absPath = path.join(process.cwd(), 'public', baseUrl.replace(/^\//, ''))
    baseNameEndsWithDark = path.parse(absPath).name.endsWith('-dark')

    // Determine variant generation options
    let variantOptions: { applyTint: boolean; nameSuffix: string } | undefined
    
    if (isAlreadyDark) {
      // Using an already-dark base (manually uploaded or previously generated)
      // Don't apply tint again. Only add -dark suffix if filename doesn't already have it.
      variantOptions = {
        applyTint: false,
        nameSuffix: baseNameEndsWithDark ? '' : '-dark',
      }
    } else if (theme === 'dark') {
      // Generating dark variants from light source - apply tint
      variantOptions = {
        applyTint: true,
        nameSuffix: '-dark',
      }
    }
    // For light variants, variantOptions stays undefined (defaults apply)


    // Generate variants
    const generatedVariants = await mediaService.generateVariants(
      absPath,
      baseUrl,
      specs || null,
      cropRect || null,
      focalPoint || null,
      theme,
      variantOptions
    )

    // Map variant names for metadata tracking
    // If base filename ends with -dark and we didn't add suffix to filenames,
    // add -dark to variant names in metadata for proper light/dark distinction
    const variantsWithProperNames =
      baseNameEndsWithDark && variantOptions?.nameSuffix === ''
        ? generatedVariants.map((v) => ({ ...v, name: `${v.name}-dark` }))
        : generatedVariants

    // Merge with existing variants
    const existingList: Variant[] = Array.isArray(existingMeta.variants)
      ? existingMeta.variants
      : []
    const newNames = new Set(variantsWithProperNames.map((v) => v.name))
    const mergedList = [
      ...existingList.filter((v) => !v || typeof v.name !== 'string' || !newNames.has(v.name)),
      ...variantsWithProperNames,
    ]

    // Build updated metadata
    const metadata = {
      ...existingMeta,
      ...(cropRect ? { cropRect } : {}),
      ...(focalPoint ? { focalPoint } : {}),
      variants: mergedList,
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
      variants: variantsWithProperNames,
      metadata,
      darkSourceUrl,
    }
  }
}

const generateMediaVariantsAction = new GenerateMediaVariantsAction()
export default generateMediaVariantsAction
