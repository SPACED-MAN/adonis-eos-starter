import type { HttpContext } from '@adonisjs/core/http'
import MediaAsset from '#models/media_asset'
import db from '@adonisjs/lucid/services/db'
import fs from 'node:fs'
import path from 'node:path'
import mediaService from '#services/media_service'
import sharp from 'sharp'
import activityLogService from '#services/activity_log_service'
import storageService from '#services/storage_service'
import roleRegistry from '#services/role_registry'
import createDarkBaseAction from '#actions/create_dark_base_action'
import generateMediaVariantsAction from '#actions/generate_media_variants_action'
import uploadMediaAction from '#actions/media/upload_media_action'
import renameMediaAction from '#actions/media/rename_media_action'
import deleteMediaAction from '#actions/media/delete_media_action'
import optimizeMediaAction from '#actions/media/optimize_media_action'
import { mediaQueryValidator, mediaUploadValidator, updateMediaValidator } from '#validators/media'
import mediaUsageService from '#services/media_usage_service'

export default class MediaController {
  /**
   * GET /api/media
   * Query: limit?, page?
   */
  async index({ request, response }: HttpContext) {
    const { limit, page, sortBy, sortOrder, category, q } =
      await request.validateUsing(mediaQueryValidator)

    const effectiveLimit = limit || 20
    const effectivePage = page || 1
    const effectiveSortBy = sortBy || 'created_at'
    const effectiveSortOrder = sortOrder || 'desc'
    const categoryFilter = category || ''

    const query = MediaAsset.query()

    if (categoryFilter) {
      query.whereRaw('? = ANY(categories)', [categoryFilter])
    }

    if (q) {
      query.where((sub) => {
        sub
          .whereILike('original_filename', `%${q}%`)
          .orWhereILike('alt_text', `%${q}%`)
          .orWhereILike('caption', `%${q}%`)
      })
    }

    const result = await query
      .orderBy(effectiveSortBy, effectiveSortOrder)
      .paginate(effectivePage, effectiveLimit)

    const rows = result.all()
    const total = result.getMeta().total

    return response.ok({
      data: rows.map((r) => ({
        id: r.id,
        url: storageService.resolvePublicUrl(r.url),
        originalFilename: r.originalFilename,
        mimeType: r.mimeType,
        size: Number(r.size),
        optimizedUrl: storageService.resolvePublicUrl(r.optimizedUrl),
        optimizedSize: r.optimizedSize ? Number(r.optimizedSize) : null,
        altText: r.altText,
        title: r.caption,
        caption: r.caption,
        description: r.description,
        categories: Array.isArray(r.categories) ? r.categories : [],
        metadata: mediaService.resolveMetadataUrls(r.metadata),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      meta: { page: effectivePage, limit: effectiveLimit, total: Number(total || 0) },
    })
  }

  async upload({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'media.upload')) {
      return response.forbidden({ error: 'Not allowed to upload media' })
    }

    const uploadFile = (request as any).file?.('file') || (request as any).files?.file || null
    if (!uploadFile) return response.badRequest({ error: 'Missing file' })

    const payload = await request.validateUsing(mediaUploadValidator)

    try {
      const result = await uploadMediaAction.handle({
        file: {
          tmpPath: uploadFile.tmpPath,
          clientName: uploadFile.clientName,
          size: uploadFile.size,
          contentType: uploadFile.contentType || uploadFile.type,
          toBuffer: uploadFile.toBuffer,
          arrayBuffer: uploadFile.arrayBuffer,
        },
        altText: payload.altText,
        title: payload.title,
        description: payload.description,
        naming: payload.naming,
        appendIdIfExists: payload.appendIdIfExists,
        categories: payload.categories,
        userId: auth.user?.id || null,
      })

      return response.created({ data: result })
    } catch (error: any) {
      return response.badRequest({ error: error.message || 'Upload failed' })
    }
  }

  /**
   * PATCH /api/media/:id
   * Body: { altText?, title?, description?, categories? }
   */
  async update({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (
      !roleRegistry.hasPermission(role, 'media.replace') &&
      !roleRegistry.hasPermission(role, 'media.upload')
    ) {
      return response.forbidden({ error: 'Not allowed to update media' })
    }
    const { id } = params
    const { altText, title, description, categories } =
      await request.validateUsing(updateMediaValidator)

    const row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })

    const mime = String(row.mime_type || '')
    const url = String(row.url || '')
    const isVideo =
      mime.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v|avi)$/i.test(url.split('?')[0])

    const playMode = request.input('playMode')
    const now = new Date()
    const update: any = { updated_at: now }

    // If it's a video, explicitly clear alt_text if it was provided as null or undefined from frontend
    if (altText !== undefined) {
      update.alt_text = isVideo ? null : altText
    }
    if (title !== undefined) update.caption = title
    if (description !== undefined) update.description = description
    if (categories !== undefined) update.categories = categories

    if (playMode !== undefined) {
      const meta = (row.metadata as any) || {}
      meta.playMode = playMode
      update.metadata = JSON.stringify(meta)
    }

    await db.from('media_assets').where('id', id).update(update)
    try {
      await activityLogService.log({
        action: 'media.update',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: id,
        metadata: { fields: Object.keys(update) },
      })
    } catch { }
    return response.ok({ message: 'Updated' })
  }

  /**
   * DELETE /api/media/:id
   */
  async destroy({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'media.delete')) {
      return response.forbidden({ error: 'Admin only' })
    }

    const force = request.input('force') === true

    try {
      await deleteMediaAction.handle({
        id: params.id,
        userId: auth.user?.id || null,
        force,
      })
      return response.noContent()
    } catch (error: any) {
      if (error.status === 409) {
        return response.conflict({ error: error.message, usage: error.usage })
      }
      return response.badRequest({ error: error.message || 'Delete failed' })
    }
  }

  /**
   * Internal helper to sanitize a filename base
   */
  private sanitizeBaseName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  /**
   * GET /api/media/:id/where-used
   * Returns a list of post/module references containing this media URL
   */
  async whereUsed({ params, response }: HttpContext) {
    const { id } = params
    const row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })

    const usage = await mediaUsageService.getUsage(id, row.url)

    return response.ok({
      data: usage,
    })
  }

  /**
   * POST /api/media/:id/variants
   * Body (optional): { crop?: { name?: string, width?: number, height?: number, fit?: 'cover'|'inside' } }
   * Generates derivative variants based on MEDIA_DERIVATIVES env (uses sharp) or a provided crop spec.
   */
  async variants({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.variants.generate')) {
      return response.forbidden({ error: 'Not allowed to generate variants' })
    }
    const { id } = params
    let row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })

    const mime = String((row as any).mime_type || '')
    const url: string = String((row as any).url || '')
    const isSvg = mime.toLowerCase() === 'image/svg+xml' || url.toLowerCase().endsWith('.svg')

    // SVGs do not support generated size variants or cropping/focal operations.
    // Editors should use the original SVG and, if needed, upload a separate dark-mode SVG.
    if (isSvg) {
      return response.badRequest({
        error:
          'SVG media does not support generated variants. Upload a separate dark-mode SVG instead.',
      })
    }

    const body = request.all()

    const theme: 'light' | 'dark' = body?.theme === 'dark' ? 'dark' : 'light'

    // Create dark base if needed
    if (theme === 'dark') {
      const meta = ((row as any).metadata || {}) as any
      const hasDarkBase = typeof meta.darkSourceUrl === 'string' && meta.darkSourceUrl

      if (!hasDarkBase) {
        try {
          await createDarkBaseAction.execute({ mediaRecord: row, updateDatabase: true })
          // Refresh row to get updated metadata
          row = await db.from('media_assets').where('id', id).first()
        } catch {
          // Continue anyway
        }
      }
    }

    // cropRect mode
    const cropRectRaw = body?.cropRect
    let cropArgs: { left: number; top: number; width: number; height: number } | null = null
    if (cropRectRaw && typeof cropRectRaw === 'object') {
      const x = Number(cropRectRaw.x)
      const y = Number(cropRectRaw.y)
      const w = Number(cropRectRaw.width)
      const h = Number(cropRectRaw.height)
      if (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(w) &&
        Number.isFinite(h) &&
        w > 0 &&
        h > 0
      ) {
        cropArgs = {
          left: Math.max(0, Math.floor(x)),
          top: Math.max(0, Math.floor(y)),
          width: Math.floor(w),
          height: Math.floor(h),
        }
      }
    }

    // focalPoint mode
    const focalRaw = body?.focalPoint
    let focalPoint: { x: number; y: number } | null = null
    if (!cropArgs && focalRaw && typeof focalRaw === 'object') {
      const fx = Number(focalRaw.x)
      const fy = Number(focalRaw.y)
      if (Number.isFinite(fx) && Number.isFinite(fy) && fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) {
        focalPoint = { x: fx, y: fy }
      }
    }

    const targetVariant: string | undefined =
      typeof body?.targetVariant === 'string' ? body.targetVariant : undefined
    const target: string | undefined = typeof body?.target === 'string' ? body.target : undefined

    // Single-variant rebuild
    if (targetVariant) {
      const specs = mediaService.parseDerivatives()
      const spec = specs.find((s) => s.name === targetVariant)
      if (!spec) {
        return response.badRequest({ error: `Unknown variant: ${targetVariant}` })
      }
      const result = await generateMediaVariantsAction.execute({
        mediaRecord: row,
        theme,
        specs: [spec],
        cropRect: cropArgs,
        focalPoint,
        updateDatabase: true,
      })
      try {
        await activityLogService.log({
          action: 'media.variants.rebuildOne',
          userId: (auth.use('web').user as any)?.id ?? null,
          entityType: 'media',
          entityId: id,
          metadata: { targetVariant },
        })
      } catch { }
      return response.ok({ data: { variants: result.variants } })
    }

    // Original cropped variant (does not overwrite original) + rebuild all configured variants from this crop
    if (target === 'original-cropped' && cropArgs) {
      const publicUrl = String(row.url)
      const absPath = await storageService.ensureLocalFile(publicUrl)
      const parsed = path.parse(absPath)
      const outName = `${parsed.name}.cropped${parsed.ext}`
      const outPath = path.join(parsed.dir, outName)
      const outUrl = path.posix.join(storageService.getRelativeDir(publicUrl), outName)
      const info = await sharp(absPath)
        .extract({
          left: cropArgs.left,
          top: cropArgs.top,
          width: cropArgs.width,
          height: cropArgs.height,
        })
        .toFile(outPath)
      const cropped = {
        name: 'cropped',
        url: outUrl,
        width: info.width,
        height: info.height,
        size: info.size || 0,
      }

      // Rebuild all configured variants using the same cropRect
      const result = await generateMediaVariantsAction.execute({
        mediaRecord: row,
        theme,
        cropRect: cropArgs,
        updateDatabase: true,
      })

      // Manually add the cropped variant to metadata
      const finalMetadata = {
        ...result.metadata,
        cropRect: cropArgs,
      }
      const variantsList = Array.isArray(finalMetadata.variants) ? finalMetadata.variants : []
      const croppedIdx = variantsList.findIndex((v: any) => v.name === 'cropped')
      if (croppedIdx >= 0) variantsList[croppedIdx] = cropped
      else variantsList.push(cropped)
      finalMetadata.variants = variantsList

      await db
        .from('media_assets')
        .where('id', row.id)
        .update({
          metadata: finalMetadata as any,
          updated_at: new Date(),
        } as any)

      try {
        await activityLogService.log({
          action: 'media.crop.original',
          userId: (auth.use('web').user as any)?.id ?? null,
          entityType: 'media',
          entityId: id,
          metadata: { cropRect: cropArgs },
        })
      } catch { }
      return response.ok({ data: { variants: [...result.variants, cropped] } })
    }

    let specs: any = null
    const crop = body?.crop
    if (!cropArgs && !focalPoint && crop && typeof crop === 'object') {
      const name = String(crop.name || 'crop')
      const width = typeof crop.width === 'number' ? crop.width : undefined
      const height = typeof crop.height === 'number' ? crop.height : undefined
      const fit = crop.fit === 'inside' ? 'inside' : 'cover'
      if (width || height) {
        specs = [{ name, width, height, fit }]
      }
    }

    // Use action for DRY variant generation
    const result = await generateMediaVariantsAction.execute({
      mediaRecord: row,
      theme,
      specs: specs || null,
      cropRect: cropArgs,
      focalPoint,
      updateDatabase: true,
    })

    const { metadata } = result
    try {
      await activityLogService.log({
        action: 'media.variants.rebuild',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: id,
        metadata: { specs: specs || null, cropRect: cropArgs, focalPoint },
      })
    } catch { }
    // Return the merged list and updated metadata so the client has all variants (light + dark)
    return response.ok({ data: { variants: metadata.variants, metadata } })
  }

  /**
   * POST /api/media/:id/content
   * Body: { content: string }
   */
  async updateContent({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.replace')) {
      return response.forbidden({ error: 'Not allowed to edit media content' })
    }
    const { id } = params
    const { content } = request.only(['content']) as { content?: string }
    if (content === undefined) {
      return response.badRequest({ error: 'content is required' })
    }

    const row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })

    const url = String(row.url)
    const mime = String(row.mime_type || '')
    const isSvg = mime.toLowerCase() === 'image/svg+xml' || url.toLowerCase().endsWith('.svg')
    const isLottie =
      mime.toLowerCase() === 'application/json' ||
      url.toLowerCase().endsWith('.json') ||
      url.toLowerCase().endsWith('.lottie')

    if (!isSvg && !isLottie) {
      return response.badRequest({
        error: 'Only SVG and Lottie files support direct content editing',
      })
    }

    const destPath = storageService.getLocalPath(url)

    // Safety check: ensure it's still within uploads directory
    if (!destPath.startsWith(storageService.getLocalPath('uploads'))) {
      return response.badRequest({ error: 'Invalid file path' })
    }

    await fs.promises.writeFile(destPath, content)

    // Update size in DB
    const stats = await fs.promises.stat(destPath)
    await db.from('media_assets').where('id', id).update({
      size: stats.size,
      updated_at: new Date(),
    })

    // Re-publish to storage if needed
    try {
      const storageUrl = await storageService.publishFile(destPath, url, mime)
      if (storageUrl && storageUrl !== url) {
        await db.from('media_assets').where('id', id).update({
          url: storageUrl,
          updated_at: new Date(),
        })
      }
    } catch { }

    return response.ok({ message: 'Content updated', size: stats.size })
  }

  /**
   * PATCH /api/media/:id/rename
   */
  async rename({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'media.replace')) {
      return response.forbidden({ error: 'Admin only' })
    }

    const { filename } = request.only(['filename'])
    try {
      const result = await renameMediaAction.handle({
        id: params.id,
        filename,
        userId: auth.user?.id || null,
      })
      return response.ok({ data: result })
    } catch (error: any) {
      return response.badRequest({ error: error.message || 'Rename failed' })
    }
  }

  async checkDuplicate({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.upload')) {
      return response.forbidden({ error: 'Not allowed' })
    }
    const originalFilename = String(request.input('originalFilename', '')).trim()
    if (!originalFilename) return response.badRequest({ error: 'originalFilename is required' })
    const matches = await db
      .from('media_assets')
      .whereRaw('LOWER(original_filename) = ?', [originalFilename.toLowerCase()])
      .orderBy('created_at', 'desc')
      .select('id', 'url', 'original_filename as originalFilename', 'created_at as createdAt')
    return response.ok({ data: matches })
  }

  async override({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.replace')) {
      return response.forbidden({ error: 'Not allowed to replace media' })
    }
    const { id } = params
    const themeParam = String(request.input('theme', '') || '').toLowerCase()
    const theme: 'light' | 'dark' = themeParam === 'dark' ? 'dark' : 'light'
    const row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })

    const uploadFile = (request as any).file?.('file') || (request as any).files?.file || null
    if (!uploadFile) return response.badRequest({ error: 'Missing file' })

    const clientName = (uploadFile as any).clientName as string | undefined
    const size = (uploadFile as any).size
    const type = ((uploadFile as any).contentType || (uploadFile as any).type || '') as string
    if (!clientName || !size || !type) {
      return response.badRequest({ error: 'Invalid file' })
    }

    const existingUrl = String(row.url)
    const existingAbsPath = storageService.getLocalPath(existingUrl)

    // Normalize new extension from uploaded file
    const clientExt = (path.extname(clientName) || '').toLowerCase()

    // Base directory for this media item
    const parsedExisting = path.parse(existingAbsPath)
    const dir = parsedExisting.dir

    // Get a relative path for existing directory to avoid full URL keys in storage
    let relDir = '/uploads'
    try {
      const relPath = existingUrl.startsWith('http') ? new URL(existingUrl).pathname : existingUrl
      relDir = path.posix.dirname(relPath)
    } catch {
      /* fallback to /uploads */
    }

    // For light theme overrides we treat this as a full replace:
    // - Remove old original + all its variants (and dark base, if any)
    // - Write new original with the new extension
    // For dark theme overrides we keep a dedicated dark base alongside the light original.
    let targetAbsPath: string
    let targetPublicUrl: string

    if (theme === 'light') {
      const baseName = this.sanitizeBaseName(
        path.parse(clientName).name || parsedExisting.name || 'file'
      )
      const newFilename = `${baseName}${clientExt || parsedExisting.ext}`

      // Clean up old files (original + variants + optimized) before writing new one
      try {
        const files = await fs.promises.readdir(dir)
        const oldBase = parsedExisting.name

        const deleteFile = async (f: string) => {
          try {
            await fs.promises.unlink(path.join(dir, f))
          } catch { }
          try {
            const fileUrl = path.posix.join(relDir, f)
            await storageService.deleteByUrl(fileUrl)
          } catch { }
        }

        for (const f of files) {
          // Match any file that starts with oldBase. (variants, optimized)
          // or oldBase-dark. (dark variants)
          const isRelated = f.startsWith(oldBase + '.') || f.startsWith(oldBase + '-dark')
          if (isRelated) {
            await deleteFile(f)
          }
        }
      } catch {
        /* ignore */
      }

      targetAbsPath = path.join(dir, newFilename)
      targetPublicUrl = path.posix.join(relDir, newFilename)
    } else {
      // Dark theme gets its own base file, using the "-dark" suffix so it is easy to discover
      // alongside the light original (e.g. demo-placeholder.jpg -> demo-placeholder-dark.jpg).
      const baseName = parsedExisting.name
      const darkBaseName = `${baseName}-dark${clientExt || parsedExisting.ext}`
      targetAbsPath = path.join(dir, darkBaseName)
      targetPublicUrl = path.posix.join(relDir, darkBaseName)
    }

    // Write file to the chosen target path
    let data: Buffer
    const uploadFileMetadata = uploadFile as any
    if (uploadFileMetadata.tmpPath) {
      data = await fs.promises.readFile(uploadFileMetadata.tmpPath)
    } else if (typeof uploadFileMetadata.toBuffer === 'function') {
      data = await uploadFileMetadata.toBuffer()
    } else if (typeof uploadFileMetadata.arrayBuffer === 'function') {
      const ab = (await uploadFileMetadata.arrayBuffer()) as ArrayBuffer
      data = Buffer.from(ab)
    } else {
      return response.badRequest({ error: 'Unsupported upload source' })
    }

    await fs.promises.mkdir(dir, { recursive: true })
    await fs.promises.writeFile(targetAbsPath, data)

    // Derive mime and regenerate variants if raster image
    const ext = (path.extname(targetAbsPath) || '').toLowerCase()
    let mime = typeof type === 'string' ? type : ''
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

    // Publish to storage if remote driver is active
    let storageUrl = targetPublicUrl
    try {
      const resultUrl = await storageService.publishFile(targetAbsPath, targetPublicUrl, mime)
      if (resultUrl) {
        storageUrl = resultUrl
      }
    } catch (err) {
      console.error(`[MediaController] Failed to publish file to storage: ${err.message}`, err)
      /* ignore publish errors; local file remains */
    }

    let metadata = (row.metadata || {}) as any
    const isSvg =
      mime.toLowerCase() === 'image/svg+xml' || targetPublicUrl.toLowerCase().endsWith('.svg')

    if (mime.startsWith('image/')) {
      if (isSvg) {
        // SVGs do not get generated size variants. For dark theme overrides, just
        // track a dedicated dark-source SVG and always serve originals.
        if (theme === 'dark') {
          metadata = {
            ...metadata,
            darkSourceUrl: storageUrl,
          }
        }
      } else {
        if (theme === 'dark') {
          // Update darkSourceUrl to point to the newly uploaded dark base
          metadata = {
            ...metadata,
            darkSourceUrl: storageUrl,
          }

          // Update the row temporarily so the action can use it
          const tempRow = { ...row, metadata, url: row.url }

          // Use action to generate dark variants (handles tint logic automatically)
          const result = await generateMediaVariantsAction.execute({
            mediaRecord: tempRow,
            theme: 'dark',
            updateDatabase: false, // We'll update manually after
          })

          metadata = result.metadata
        } else {
          // Light override: use action to regenerate light variants
          const result = await generateMediaVariantsAction.execute({
            mediaRecord: {
              ...row,
              url: storageUrl,
              metadata: { ...metadata, darkSourceUrl: metadata.darkSourceUrl },
            },
            theme: 'light',
            updateDatabase: false,
          })

          // When we fully replace the light image, keep dark variants but update light ones
          metadata = result.metadata
        }
      }
    }

    // For light overrides, also update the main URL and original_filename to match the new file
    const updatePayload: any = {
      mime_type: mime,
      size: Number(size),
      metadata: metadata as any,
      updated_at: new Date(),
    }
    if (theme === 'light') {
      updatePayload.url = storageUrl
      updatePayload.original_filename = clientName
    }

    await db
      .from('media_assets')
      .where('id', id)
      .update(updatePayload as any)

    try {
      await activityLogService.log({
        action: 'media.override',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: id,
      })
    } catch { }
    return response.ok({ message: 'Overridden' })
  }

  async show({ params, response }: HttpContext) {
    const { id } = params
    const asset = await MediaAsset.find(id)
    if (!asset) return response.notFound({ error: 'Media not found' })
    return response.ok({
      data: {
        id: asset.id,
        url: storageService.resolvePublicUrl(asset.url),
        originalFilename: asset.originalFilename,
        mimeType: asset.mimeType,
        size: Number(asset.size || 0),
        optimizedUrl: storageService.resolvePublicUrl(asset.optimizedUrl),
        optimizedSize: asset.optimizedSize ? Number(asset.optimizedSize) : null,
        altText: asset.altText,
        caption: asset.caption,
        description: asset.description,
        categories: Array.isArray(asset.categories) ? asset.categories : [],
        metadata: mediaService.resolveMetadataUrls(asset.metadata),
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      },
    })
  }

  async showPublic({ params, response }: HttpContext) {
    const { id } = params
    const asset = await MediaAsset.find(id)
    if (!asset) return response.notFound({ error: 'Media not found' })
    return response.ok({
      data: {
        id: asset.id,
        url: asset.url,
        mimeType: asset.mimeType,
        metadata: asset.metadata || null,
        altText: asset.altText,
        title: asset.caption,
        caption: asset.caption,
        categories: Array.isArray(asset.categories) ? asset.categories : [],
      },
    })
  }

  /**
   * GET /api/media/categories
   * Returns distinct list of categories used across all media
   */
  async categories({ response }: HttpContext) {
    const rows = await db.rawQuery(
      'SELECT DISTINCT unnest(categories) AS category FROM media_assets WHERE array_length(categories,1) IS NOT NULL'
    )
    const list: string[] = Array.isArray(rows?.rows)
      ? rows.rows.map((r: any) => String(r.category)).filter((x: string) => x.length > 0)
      : []
    return response.ok({ data: list.sort((a, b) => a.localeCompare(b)) })
  }

  /**
   * POST /api/media/:id/optimize
   */
  async optimize({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'media.optimize')) {
      return response.forbidden({ error: 'Not allowed to optimize media' })
    }

    try {
      const result = await optimizeMediaAction.handle({
        id: params.id,
        userId: auth.user?.id || null,
      })
      return response.ok({ data: result })
    } catch (error: any) {
      return response.badRequest({ error: error.message || 'Optimization failed' })
    }
  }

  /**
   * POST /api/media/optimize-bulk
   */
  async optimizeBulk({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'media.optimize')) {
      return response.forbidden({ error: 'Not allowed to optimize media' })
    }

    const { ids } = request.only(['ids'])
    if (!Array.isArray(ids)) return response.badRequest({ error: 'ids must be an array' })

    const result = await optimizeMediaAction.handleBulk(ids, auth.user?.id || null)
    return response.ok({ data: result })
  }

  /**
   * POST /api/media/variants-bulk
   * Body: { ids: string[] }
   * Regenerates all configured variants for each selected image.
   */
  async variantsBulk({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.variants.generate')) {
      return response.forbidden({ error: 'Not allowed to regenerate variants' })
    }
    const ids: string[] = Array.isArray(request.input('ids'))
      ? request.input('ids').map((x: any) => String(x))
      : []
    if (!ids.length) return response.badRequest({ error: 'ids must be a non-empty array' })

    // This could also be moved to an action, but keeping it here for now as it's a bulk operation
    // similar to optimizeBulk.
    const rows = await db.from('media_assets').whereIn('id', ids)
    let success = 0
    for (const row of rows) {
      try {
        const mime = String((row as any).mime_type || '')
        const publicUrl: string = String((row as any).url)
        const isSvg =
          mime.toLowerCase() === 'image/svg+xml' || publicUrl.toLowerCase().endsWith('.svg')
        const isImage = mime.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif)$/i.test(publicUrl)
        if (!isImage || isSvg) continue

        const absPath = await storageService.ensureLocalFile(publicUrl)
        const variants = await mediaService.generateVariants(
          absPath,
          publicUrl,
          null,
          null,
          null,
          'light'
        )
        const meta = (row as any).metadata || {}
        let list = Array.isArray((meta as any).variants) ? (meta as any).variants : []
        for (const v of variants) {
          const idx = list.findIndex((x: any) => x.name === v.name)
          if (idx >= 0) list[idx] = v
          else list.push(v)
        }
        await db
          .from('media_assets')
          .where('id', (row as any).id)
          .update({
            metadata: { ...(meta as any), variants: list } as any,
            updated_at: new Date(),
          } as any)
        success++
      } catch {
        /* continue */
      }
    }
    try {
      await activityLogService.log({
        action: 'media.variants.bulk',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: 'bulk',
        metadata: { count: success },
      })
    } catch { }
    return response.ok({ data: { regenerated: success } })
  }

  /**
   * POST /api/media/delete-bulk
   */
  async deleteBulk({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'media.delete')) {
      return response.forbidden({ error: 'Admin only' })
    }

    const { ids, force } = request.only(['ids', 'force'])
    if (!Array.isArray(ids)) return response.badRequest({ error: 'ids must be an array' })

    let deleted = 0
    let skipped = 0
    const errors: string[] = []

    for (const id of ids) {
      try {
        await deleteMediaAction.handle({
          id,
          userId: auth.user?.id || null,
          force: force === true,
        })
        deleted++
      } catch (error: any) {
        skipped++
        errors.push(`${id}: ${error.message}`)
      }
    }

    return response.ok({ data: { deleted, skipped, errors } })
  }

  /**
   * POST /api/media/categories-bulk
   * Body: { ids: string[]; add?: string[]; remove?: string[] }
   * Adds/removes categories across selected items.
   */
  async categoriesBulk({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.upload')) {
      return response.forbidden({ error: 'Not allowed to update categories' })
    }
    const ids: string[] = Array.isArray(request.input('ids'))
      ? request.input('ids').map((x: any) => String(x))
      : []
    const addArr: string[] = Array.isArray(request.input('add'))
      ? (request.input('add') as any[]).map((x) => String(x).trim()).filter(Boolean)
      : []
    const removeArr: string[] = Array.isArray(request.input('remove'))
      ? (request.input('remove') as any[]).map((x) => String(x).trim()).filter(Boolean)
      : []
    if (!ids.length) return response.badRequest({ error: 'ids must be a non-empty array' })
    const rows = await db.from('media_assets').whereIn('id', ids).select('id', 'categories')
    const now = new Date()
    let updated = 0
    for (const row of rows) {
      const current: string[] = Array.isArray((row as any).categories)
        ? (row as any).categories
        : []
      const nextSet = new Set(current)
      for (const r of removeArr) nextSet.delete(r)
      for (const a of addArr) nextSet.add(a)
      const next = Array.from(nextSet)
      const changed = JSON.stringify(current.slice().sort()) !== JSON.stringify(next.slice().sort())
      if (changed) {
        await db
          .from('media_assets')
          .where('id', (row as any).id)
          .update({ categories: next as any, updated_at: now } as any)
        updated++
      }
    }
    try {
      await activityLogService.log({
        action: 'media.categories.bulk',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: 'bulk',
        metadata: { count: updated, add: addArr, remove: removeArr },
      })
    } catch { }
    return response.ok({ data: { updated } })
  }
}
