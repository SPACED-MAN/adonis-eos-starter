import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import mediaService from '#services/media_service'
import sharp from 'sharp'
import activityLogService from '#services/activity_log_service'
import storageService from '#services/storage_service'
import roleRegistry from '#services/role_registry'
import createDarkBaseAction from '#actions/create_dark_base_action'
import generateMediaVariantsAction from '#actions/generate_media_variants_action'

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
  const cleaned = base
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\s{2,}/g, ' ')
  return cleaned || null
}

export default class MediaController {
  /**
   * GET /api/media
   * Query: limit?, page?
   */
  async index({ request, response }: HttpContext) {
    const limit = Math.min(100, Math.max(1, Number(request.input('limit', 20)) || 20))
    const page = Math.max(1, Number(request.input('page', 1)) || 1)
    const sortByRaw = String(request.input('sortBy', 'created_at')).trim().toLowerCase()
    const sortOrderRaw = String(request.input('sortOrder', 'desc')).trim().toLowerCase()
    const categoryFilter = String(request.input('category', '') || '').trim()
    const allowed = new Set(['created_at', 'original_filename', 'size'])
    const sortBy = (allowed as Set<string>).has(sortByRaw) ? sortByRaw : 'created_at'
    const sortOrder = sortOrderRaw === 'asc' ? 'asc' : 'desc'
    let query = db.from('media_assets') as any
    if (categoryFilter) {
      // Postgres text[] membership check
      query = query.whereRaw('? = ANY(categories)', [categoryFilter])
    }
    const rows = await query.orderBy(sortBy, sortOrder).forPage(page, limit)
    const [{ total }] = await db.from('media_assets').count('* as total')
    return response.ok({
      data: rows.map((r: any) => ({
        id: r.id,
        url: r.url,
        originalFilename: r.original_filename,
        mimeType: r.mime_type,
        size: Number(r.size),
        optimizedUrl: r.optimized_url || null,
        optimizedSize: r.optimized_size ? Number(r.optimized_size) : null,
        altText: r.alt_text,
        // Expose DB `caption` as `title` in the API
        title: r.caption,
        description: r.description,
        categories: Array.isArray(r.categories) ? r.categories : [],
        metadata: r.metadata || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      meta: { page, limit, total: Number(total || 0) },
    })
  }

  /**
   * POST /api/media
   * multipart/form-data: file, altText?, title?, description?
   */
  async upload({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.upload')) {
      return response.forbidden({ error: 'Not allowed to upload media' })
    }
    const uploadFile = (request as any).file?.('file') || (request as any).files?.file || null
    if (!uploadFile) return response.badRequest({ error: 'Missing file' })

    const clientName = (uploadFile as any).clientName as string | undefined
    const size = (uploadFile as any).size
    const type = (uploadFile as any).type as string | undefined
    if (!clientName || !size || !type) {
      return response.badRequest({ error: 'Invalid file' })
    }

    const naming = String(request.input('naming', 'uuid')) === 'original' ? 'original' : 'uuid'
    const appendIdIfExists =
      String(request.input('appendIdIfExists', 'false')).toLowerCase() === 'true'

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.promises.mkdir(uploadsDir, { recursive: true })
    const ext = (path.extname(clientName) || '').toLowerCase()

    let filename: string
    if (naming === 'original') {
      const base = sanitizeBaseName(path.parse(clientName).name || 'file')
      let candidate = `${base}${ext}`
      if (appendIdIfExists) {
        // If file exists, append short id
        try {
          await fs.promises.access(path.join(uploadsDir, candidate))
          const shortId = crypto.randomUUID().slice(0, 8)
          candidate = `${base}-${shortId}${ext}`
        } catch {
          /* ok */
        }
      } else {
        // Always ensure uniqueness by incrementing counter if needed
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
    if ((uploadFile as any).tmpPath) {
      data = await fs.promises.readFile((uploadFile as any).tmpPath)
    } else if (typeof (uploadFile as any).toBuffer === 'function') {
      data = await (uploadFile as any).toBuffer()
    } else if (typeof (uploadFile as any).arrayBuffer === 'function') {
      const ab = (await (uploadFile as any).arrayBuffer()) as ArrayBuffer
      data = Buffer.from(ab)
    } else {
      return response.badRequest({ error: 'Unsupported upload source' })
    }

    await fs.promises.writeFile(destPath, data)

    const now = new Date()
    const id = crypto.randomUUID()
    const url = `/uploads/${filename}`

    // Normalize mime type
    let mime = typeof type === 'string' ? type : ''

    // Publish to storage (local no-op, R2 uploads)
    try {
      await storageService.publishFile(destPath, url, mime)
    } catch {
      /* ignore publish errors; local file remains */
    }

    const isSvg =
      mime.toLowerCase() === 'image/svg+xml' ||
      (ext && ext.toLowerCase() === '.svg') ||
      url.toLowerCase().endsWith('.svg')

    let metadata: any = null
    // For raster images only, generate size variants. SVGs keep a single original.
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
        // ignore variant generation errors; keep original
      }
    }

    const altFromRequest = String(request.input('altText', '')).trim()
    const altText = altFromRequest || computeDefaultAlt(clientName)
    // We continue to store this in the `caption` column but expose it as `title` in the API.
    const caption = String(request.input('title', '')).trim() || null
    const description = String(request.input('description', '')).trim() || null

    await db.table('media_assets').insert({
      id,
      url,
      original_filename: clientName,
      mime_type: mime,
      size: Number(size),
      alt_text: altText,
      caption,
      description,
      categories: db.raw('ARRAY[]::text[]') as any,
      metadata: metadata as any,
      created_at: now,
      updated_at: now,
    })

    try {
      await activityLogService.log({
        action: 'media.upload',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: id,
        metadata: { filename: clientName, mime, size: Number(size) },
      })
    } catch {}
    return response.created({ data: { id, url } })
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
    const altText = request.input('altText')
    const title = request.input('title')
    const description = request.input('description')
    let categoriesInput = request.input('categories')
    let categories: string[] | undefined
    if (categoriesInput !== undefined) {
      if (Array.isArray(categoriesInput)) {
        categories = (categoriesInput as any[])
          .map((t) => String(t))
          .filter((t) => t.trim().length > 0)
      } else if (typeof categoriesInput === 'string') {
        categories = categoriesInput
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      }
    }
    const now = new Date()
    const update: any = { updated_at: now }
    if (altText !== undefined) update.alt_text = altText
    if (title !== undefined) update.caption = title
    if (description !== undefined) update.description = description
    if (categories !== undefined) update.categories = categories
    const count = await db.from('media_assets').where('id', id).update(update)
    if (!count) return response.notFound({ error: 'Media not found' })
    try {
      await activityLogService.log({
        action: 'media.update',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: id,
        metadata: { fields: Object.keys(update) },
      })
    } catch {}
    return response.ok({ message: 'Updated' })
  }

  /**
   * DELETE /api/media/:id
   */
  async destroy({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.delete')) {
      return response.forbidden({ error: 'Admin only' })
    }
    const { id } = params
    const row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })

    const publicRoot = path.join(process.cwd(), 'public')
    const originalUrl = String(row.url || '')

    // Delete original file
    try {
      const originalPath = path.join(publicRoot, originalUrl.replace(/^\//, ''))
      await fs.promises.unlink(originalPath)
    } catch {}
    // Also remove from storage driver
    try {
      await storageService.deleteByUrl(originalUrl)
    } catch {}

    // Delete known variants from metadata (light + dark)
    try {
      const meta = (row as any).metadata as any
      const variants = meta && Array.isArray(meta.variants) ? meta.variants : []
      for (const v of variants) {
        if (!v?.url || typeof v.url !== 'string') continue
        const vUrl = String(v.url)
        const p = path.join(publicRoot, vUrl.replace(/^\//, ''))
        try {
          await fs.promises.unlink(p)
        } catch {}
        try {
          await storageService.deleteByUrl(vUrl)
        } catch {}
      }

      // Delete dedicated dark base if present
      const darkSourceUrl =
        meta && typeof meta.darkSourceUrl === 'string' ? meta.darkSourceUrl : null
      if (darkSourceUrl) {
        const darkPath = path.join(publicRoot, darkSourceUrl.replace(/^\//, ''))
        try {
          await fs.promises.unlink(darkPath)
        } catch {}
        try {
          await storageService.deleteByUrl(String(darkSourceUrl))
        } catch {}
      }
    } catch {}

    // Fallback: pattern-based deletion (basename.VARIANT+ext)
    try {
      const originalPath = path.join(publicRoot, String(row.url || '').replace(/^\//, ''))
      const parsed = path.parse(originalPath)
      const dir = parsed.dir
      const base = parsed.name
      const ext = parsed.ext
      const files = await fs.promises.readdir(dir)
      await Promise.all(
        files.map(async (f) => {
          const isVariantPattern = f.startsWith(base + '.') && f.endsWith(ext)
          const isDarkBase = f === `${base}-dark${ext}`
          if (isVariantPattern || isDarkBase) {
            try {
              await fs.promises.unlink(path.join(dir, f))
            } catch {}
            try {
              await storageService.deleteByUrl(
                path.posix.join(String(path.posix.dirname(String(row.url || ''))), f)
              )
            } catch {}
          }
        })
      )
    } catch {}

    await db.from('media_assets').where('id', id).delete()
    try {
      await activityLogService.log({
        action: 'media.delete',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: id,
      })
    } catch {}
    return response.noContent()
  }

  /**
   * GET /api/media/:id/where-used
   * Returns a list of post/module references containing this media URL
   */
  async whereUsed({ params, response }: HttpContext) {
    const { id } = params
    const row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })
    const url = String(row.url || '')
    if (!url) return response.ok({ data: [] })
    const like = `%${url}%`
    const inModules = await db
      .from('module_instances')
      .whereRaw(`props::text ILIKE ?`, [like])
      .select('id', 'type', 'scope')
    const inOverrides = await db
      .from('post_modules')
      .whereRaw(`overrides::text ILIKE ?`, [like])
      .select('id', 'post_id as postId')
    return response.ok({
      data: {
        inModules: inModules.map((m: any) => ({ id: m.id, type: m.type, scope: m.scope })),
        inOverrides: inOverrides.map((o: any) => ({ id: o.id, postId: o.postid || o.postId })),
      },
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
    const isSvg =
      mime.toLowerCase() === 'image/svg+xml' ||
      url.toLowerCase().endsWith('.svg')

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
      } catch {}
      return response.ok({ data: { variants: result.variants } })
    }

    // Original cropped variant (does not overwrite original) + rebuild all configured variants from this crop
    if (target === 'original-cropped' && cropArgs) {
      const publicRoot = path.join(process.cwd(), 'public')
      const publicUrl = String(row.url)
      const absPath = path.join(publicRoot, publicUrl.replace(/^\//, ''))
      const parsed = path.parse(absPath)
      const outName = `${parsed.name}.cropped${parsed.ext}`
      const outPath = path.join(parsed.dir, outName)
      const outUrl = path.posix.join(path.posix.dirname(publicUrl), outName)
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
      } catch {}
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
    } catch {}
    // Return the merged list and updated metadata so the client has all variants (light + dark)
    return response.ok({ data: { variants: metadata.variants, metadata } })
  }

  /**
   * PATCH /api/media/:id/rename
   * Body: { filename: string }
   */
  async rename({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.replace')) {
      return response.forbidden({ error: 'Admin only' })
    }
    const { id } = params
    let { filename } = request.only(['filename']) as { filename?: string }
    if (!filename || typeof filename !== 'string') {
      return response.badRequest({ error: 'filename is required' })
    }
    filename = filename.trim()
    if (!filename) return response.badRequest({ error: 'filename is empty' })

    const row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })

    const oldUrl: string = String(row.url)
    const oldPath = path.join(process.cwd(), 'public', oldUrl.replace(/^\//, ''))
    const parsed = path.parse(oldPath)
    let base = filename
    let ext = parsed.ext
    const provided = path.parse(filename)
    if (provided.ext) {
      base = provided.name
      ext = provided.ext.startsWith('.') ? provided.ext : `.${provided.ext}`
    }
    base = base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (!base) base = 'file'

    const dir = parsed.dir
    let candidate = `${base}${ext}`
    let counter = 1
    while (true) {
      try {
        await fs.promises.access(path.join(dir, candidate))
        const nameOnly = `${base}-${counter++}`
        candidate = `${nameOnly}${ext}`
      } catch {
        break
      }
    }
    const newBase = path.parse(candidate).name
    const { newPath, newUrl, renamedVariants } = await mediaService.renameWithVariants(
      oldPath,
      oldUrl,
      newBase
    )

    let metadata = row.metadata || {}
    if (metadata && (metadata as any).variants && Array.isArray((metadata as any).variants)) {
      ;(metadata as any).variants = (metadata as any).variants.map((v: any) => {
        const found = renamedVariants.find((rv) => rv.oldUrl === v.url)
        if (found) {
          return { ...v, url: found.newUrl }
        }
        if (typeof v.url === 'string' && v.url.startsWith(path.posix.dirname(oldUrl))) {
          const trailing = v.url.substring(path.posix.dirname(oldUrl).length + 1)
          if (trailing.startsWith(`${parsed.name}.`)) {
            const variantName = trailing.slice(parsed.name.length + 1)
            return {
              ...v,
              url: path.posix.join(path.posix.dirname(oldUrl), `${newBase}.${variantName}`),
            }
          }
        }
        return v
      })
    }
    await db
      .from('media_assets')
      .where('id', id)
      .update({
        url: newUrl,
        original_filename: path.parse(newPath).base,
        metadata: metadata as any,
        updated_at: new Date(),
      } as any)

    const oldUrlEsc = oldUrl.replace(/'/g, "''")
    const newUrlEsc = newUrl.replace(/'/g, "''")
    await db.raw(
      `UPDATE module_instances SET props = REPLACE(props::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE props::text LIKE '%${oldUrlEsc}%'`
    )
    await db.raw(
      `UPDATE module_instances SET review_props = REPLACE(review_props::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE review_props::text LIKE '%${oldUrlEsc}%'`
    )
    await db.raw(
      `UPDATE post_modules SET overrides = REPLACE(overrides::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE overrides::text LIKE '%${oldUrlEsc}%'`
    )
    await db.raw(
      `UPDATE post_modules SET review_overrides = REPLACE(review_overrides::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE review_overrides::text LIKE '%${oldUrlEsc}%'`
    )

    try {
      await activityLogService.log({
        action: 'media.rename',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: id,
        metadata: { oldUrl, newUrl },
      })
    } catch {}
    return response.ok({ data: { url: newUrl } })
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
    const type = (uploadFile as any).type as string | undefined
    if (!clientName || !size || !type) {
      return response.badRequest({ error: 'Invalid file' })
    }

    const publicRoot = path.join(process.cwd(), 'public')
    const existingPublicUrl: string = String(row.url)
    const existingAbsPath = path.join(publicRoot, existingPublicUrl.replace(/^\//, ''))

    // Normalize new extension from uploaded file
    const clientExt = (path.extname(clientName) || '').toLowerCase()

    // Base directory for this media item
    const parsedExisting = path.parse(existingAbsPath)
    const dir = parsedExisting.dir

    // For light theme overrides we treat this as a full replace:
    // - Remove old original + all its variants (and dark base, if any)
    // - Write new original with the new extension
    // For dark theme overrides we keep a dedicated dark base alongside the light original.
    let targetAbsPath: string
    let targetPublicUrl: string

    if (theme === 'light') {
      const baseName = sanitizeBaseName(
        path.parse(clientName).name || parsedExisting.name || 'file'
      )
      const newFilename = `${baseName}${clientExt || parsedExisting.ext}`

      // Clean up old files (original + variants) before writing new one
      try {
        const files = await fs.promises.readdir(dir)
        const oldBase = parsedExisting.name
        for (const f of files) {
          if (
            f === parsedExisting.base ||
            (f.startsWith(`${oldBase}.`) && f.endsWith(parsedExisting.ext))
          ) {
            try {
              await fs.promises.unlink(path.join(dir, f))
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* ignore */
      }

      targetAbsPath = path.join(dir, newFilename)
      targetPublicUrl = path.posix.join(path.posix.dirname(existingPublicUrl), newFilename)
    } else {
      // Dark theme gets its own base file, using the "-dark" suffix so it is easy to discover
      // alongside the light original (e.g. demo-placeholder.jpg -> demo-placeholder-dark.jpg).
      const baseName = parsedExisting.name
      const darkBaseName = `${baseName}-dark${clientExt || parsedExisting.ext}`
      targetAbsPath = path.join(dir, darkBaseName)
      targetPublicUrl = path.posix.join(path.posix.dirname(existingPublicUrl), darkBaseName)
    }

    // Write file to the chosen target path
    let data: Buffer
    if ((uploadFile as any).tmpPath) {
      data = await fs.promises.readFile((uploadFile as any).tmpPath)
    } else if (typeof (uploadFile as any).toBuffer === 'function') {
      data = await (uploadFile as any).toBuffer()
    } else if (typeof (uploadFile as any).arrayBuffer === 'function') {
      const ab = (await (uploadFile as any).arrayBuffer()) as ArrayBuffer
      data = Buffer.from(ab)
    } else {
      return response.badRequest({ error: 'Unsupported upload source' })
    }
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
        case '.avif':
          mime = 'image/avif'
          break
        default:
          mime = type || 'application/octet-stream'
      }
    }

    let metadata = (row.metadata || {}) as any
    const isSvg =
      mime.toLowerCase() === 'image/svg+xml' ||
      targetPublicUrl.toLowerCase().endsWith('.svg')

    if (mime.startsWith('image/')) {
      if (isSvg) {
        // SVGs do not get generated size variants. For dark theme overrides, just
        // track a dedicated dark-source SVG and always serve originals.
        if (theme === 'dark') {
          metadata = {
            ...metadata,
            darkSourceUrl: targetPublicUrl,
          }
        }
      } else {
        if (theme === 'dark') {
          // Update darkSourceUrl to point to the newly uploaded dark base
          metadata = {
            ...metadata,
            darkSourceUrl: targetPublicUrl,
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
              url: targetPublicUrl,
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
      updatePayload.url = targetPublicUrl
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
    } catch {}
    return response.ok({ message: 'Overridden' })
  }

  async show({ params, response }: HttpContext) {
    const { id } = params
    const row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })
    return response.ok({
      data: {
        id: row.id,
        url: row.url,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        size: Number(row.size || 0),
        optimizedUrl: (row as any).optimized_url || null,
        optimizedSize: (row as any).optimized_size ? Number((row as any).optimized_size) : null,
        altText: row.alt_text,
        caption: row.caption,
        description: row.description,
        categories: Array.isArray(row.categories) ? row.categories : [],
        metadata: row.metadata || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    })
  }

  async showPublic({ params, response }: HttpContext) {
    const { id } = params
    const row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })
    return response.ok({
      data: {
        id: row.id,
        url: row.url,
        metadata: row.metadata || null,
        altText: row.alt_text,
        categories: Array.isArray(row.categories) ? row.categories : [],
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
      ? rows.rows.map((r: any) => String(r.category)).filter((x) => x.length > 0)
      : []
    return response.ok({ data: list.sort((a, b) => a.localeCompare(b)) })
  }

  /**
   * POST /api/media/:id/optimize
   * Optimizes an image to WebP and stores optimized size and URL.
   */
  async optimize({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.optimize')) {
      return response.forbidden({ error: 'Not allowed to optimize media' })
    }
    const { id } = params
    const row = await db.from('media_assets').where('id', id).first()
    if (!row) return response.notFound({ error: 'Media not found' })
    const mime = String(row.mime_type || '')
    if (!mime.startsWith('image/')) {
      return response.badRequest({ error: 'Only images can be optimized' })
    }
    const publicUrl: string = String(row.url)
    const absPath = path.join(process.cwd(), 'public', publicUrl.replace(/^\//, ''))
    try {
      const result = await mediaService.optimizeToWebp(absPath, publicUrl)
      if (!result) return response.badRequest({ error: 'Unsupported image type for optimization' })
      const now = new Date()
      await db
        .from('media_assets')
        .where('id', id)
        .update({
          optimized_url: result.optimizedUrl,
          optimized_size: Number(result.size || 0),
          optimized_at: now,
          updated_at: now,
        } as any)
      try {
        await activityLogService.log({
          action: 'media.optimize',
          userId: (auth.use('web').user as any)?.id ?? null,
          entityType: 'media',
          entityId: id,
          metadata: { optimizedUrl: result.optimizedUrl, optimizedSize: Number(result.size || 0) },
        })
      } catch {}
      return response.ok({
        data: { optimizedUrl: result.optimizedUrl, optimizedSize: Number(result.size || 0) },
      })
    } catch (e: any) {
      return response.badRequest({ error: e?.message || 'Optimization failed' })
    }
  }

  /**
   * POST /api/media/optimize-bulk
   * Body: { ids: string[] }
   */
  async optimizeBulk({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.optimize')) {
      return response.forbidden({ error: 'Not allowed to optimize media' })
    }
    const ids: string[] = Array.isArray(request.input('ids'))
      ? request.input('ids').map((x: any) => String(x))
      : []
    if (!ids.length) return response.badRequest({ error: 'ids must be a non-empty array' })
    const rows = await db.from('media_assets').whereIn('id', ids)
    let success = 0
    for (const row of rows) {
      try {
        const mime = String((row as any).mime_type || '')
        if (!mime.startsWith('image/')) continue
        const publicUrl: string = String((row as any).url)
        const absPath = path.join(process.cwd(), 'public', publicUrl.replace(/^\//, ''))
        const result = await mediaService.optimizeToWebp(absPath, publicUrl)
        if (!result) continue
        await db
          .from('media_assets')
          .where('id', (row as any).id)
          .update({
            optimized_url: result.optimizedUrl,
            optimized_size: Number(result.size || 0),
            optimized_at: new Date(),
            updated_at: new Date(),
          } as any)
        success++
      } catch {
        /* continue */
      }
    }
    try {
      await activityLogService.log({
        action: 'media.optimize.bulk',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: 'bulk',
        metadata: { count: success },
      })
    } catch {}
    return response.ok({ data: { optimized: success } })
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
    const rows = await db.from('media_assets').whereIn('id', ids)
    let success = 0
    for (const row of rows) {
      try {
        const mime = String((row as any).mime_type || '')
        const publicUrl: string = String((row as any).url)
        const isSvg =
          mime.toLowerCase() === 'image/svg+xml' ||
          publicUrl.toLowerCase().endsWith('.svg')
        if (!mime.startsWith('image/') || isSvg) continue

        const absPath = path.join(process.cwd(), 'public', publicUrl.replace(/^\//, ''))
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
    } catch {}
    return response.ok({ data: { regenerated: success } })
  }

  /**
   * POST /api/media/delete-bulk
   * Body: { ids: string[] }
   * Admin-only permanent delete of media records (and files).
   */
  async deleteBulk({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'media.delete')) {
      return response.forbidden({ error: 'Admin only' })
    }
    const ids: string[] = Array.isArray(request.input('ids'))
      ? request.input('ids').map((x: any) => String(x))
      : []
    if (!ids.length) return response.badRequest({ error: 'ids must be a non-empty array' })
    const rows = await db.from('media_assets').whereIn('id', ids)
    const publicRoot = path.join(process.cwd(), 'public')
    let deleted = 0
    for (const row of rows) {
      try {
        const originalUrl: string = String((row as any).url || '')
        const originalPath = path.join(publicRoot, originalUrl.replace(/^\//, ''))

        // Delete original
        try {
          await fs.promises.unlink(originalPath)
        } catch {}
        try {
          await storageService.deleteByUrl(originalUrl)
        } catch {}

        // Delete variants from metadata
        try {
          const meta = (row as any).metadata as any
          const variants = meta && Array.isArray(meta.variants) ? meta.variants : []
          for (const v of variants) {
            if (!v?.url || typeof v.url !== 'string') continue
            const vUrl = String(v.url)
            const p = path.join(publicRoot, vUrl.replace(/^\//, ''))
            try {
              await fs.promises.unlink(p)
            } catch {}
            try {
              await storageService.deleteByUrl(vUrl)
            } catch {}
          }

          // Delete dedicated dark base if present
          const darkSourceUrl =
            meta && typeof meta.darkSourceUrl === 'string' ? meta.darkSourceUrl : null
          if (darkSourceUrl) {
            const darkPath = path.join(publicRoot, darkSourceUrl.replace(/^\//, ''))
            try {
              await fs.promises.unlink(darkPath)
            } catch {}
            try {
              await storageService.deleteByUrl(String(darkSourceUrl))
            } catch {}
          }
        } catch {}

        // Fallback pattern-based (variants and -dark base on disk + storage)
        try {
          const parsed = path.parse(originalPath)
          const dir = parsed.dir
          const base = parsed.name
          const ext = parsed.ext
          const files = await fs.promises.readdir(dir)
          for (const f of files) {
            const isVariantPattern = f.startsWith(base + '.') && f.endsWith(ext)
            const isDarkBase = f === `${base}-dark${ext}`
            if (isVariantPattern || isDarkBase) {
              const diskPath = path.join(dir, f)
              try {
                await fs.promises.unlink(diskPath)
              } catch {}
              try {
                await storageService.deleteByUrl(
                  path.posix.join(path.posix.dirname(originalUrl), f)
                )
              } catch {}
            }
          }
        } catch {}

        await db
          .from('media_assets')
          .where('id', (row as any).id)
          .delete()
        deleted++
      } catch {
        /* continue */
      }
    }
    try {
      await activityLogService.log({
        action: 'media.delete.bulk',
        userId: (auth.use('web').user as any)?.id ?? null,
        entityType: 'media',
        entityId: 'bulk',
        metadata: { count: deleted },
      })
    } catch {}
    return response.ok({ data: { deleted } })
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
    } catch {}
    return response.ok({ data: { updated } })
  }
}
