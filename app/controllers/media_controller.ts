import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import mediaService from '#services/media_service'
import sharp from 'sharp'

function sanitizeBaseName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '') || 'file'
}

function computeDefaultAlt(fromClientName: string): string | null {
	const dot = fromClientName.lastIndexOf('.')
	const base = dot >= 0 ? fromClientName.slice(0, dot) : fromClientName
	const cleaned = base.replace(/[-_]+/g, ' ').trim().replace(/\s{2,}/g, ' ')
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
				altText: r.alt_text,
				caption: r.caption,
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
	 * multipart/form-data: file, altText?, caption?, description?
	 */
	async upload({ request, response, auth }: HttpContext) {
		const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
		if (!(role === 'admin' || role === 'editor')) {
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
		const appendIdIfExists = String(request.input('appendIdIfExists', 'false')).toLowerCase() === 'true'

		const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
		await fs.promises.mkdir(uploadsDir, { recursive: true })
		const ext = (path.extname(clientName) || '').toLowerCase()

		let filename: string
		if (naming === 'original') {
			const base = sanitizeBaseName((path.parse(clientName).name || 'file'))
			let candidate = `${base}${ext}`
			if (appendIdIfExists) {
				// If file exists, append short id
				try {
					await fs.promises.access(path.join(uploadsDir, candidate))
					const shortId = crypto.randomUUID().slice(0, 8)
					candidate = `${base}-${shortId}${ext}`
				} catch { /* ok */ }
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

		let metadata: any = null
		if (mime.startsWith('image/')) {
			try {
				const variants = await mediaService.generateVariants(destPath, url, null)
				metadata = { variants }
			} catch {
				// ignore variant generation errors; keep original
			}
		}

		const altFromRequest = String(request.input('altText', '')).trim()
		const altText = altFromRequest || computeDefaultAlt(clientName)
		const caption = String(request.input('caption', '')).trim() || null
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

		return response.created({ data: { id, url } })
	}

	/**
	 * PATCH /api/media/:id
	 * Body: { altText?, caption? }
	 */
	async update({ params, request, response, auth }: HttpContext) {
		const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
		if (!(role === 'admin' || role === 'editor')) {
			return response.forbidden({ error: 'Not allowed to update media' })
		}
		const { id } = params
		const altText = request.input('altText')
		const caption = request.input('caption')
		const description = request.input('description')
		let categoriesInput = request.input('categories')
		let categories: string[] | undefined = undefined
		if (categoriesInput !== undefined) {
			if (Array.isArray(categoriesInput)) {
				categories = (categoriesInput as any[]).map((t) => String(t)).filter((t) => t.trim().length > 0)
			} else if (typeof categoriesInput === 'string') {
				categories = categoriesInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
			}
		}
		const now = new Date()
		const update: any = { updated_at: now }
		if (altText !== undefined) update.alt_text = altText
		if (caption !== undefined) update.caption = caption
		if (description !== undefined) update.description = description
		if (categories !== undefined) update.categories = categories
		const count = await db.from('media_assets').where('id', id).update(update)
		if (!count) return response.notFound({ error: 'Media not found' })
		return response.ok({ message: 'Updated' })
	}

	/**
	 * DELETE /api/media/:id
	 */
	async destroy({ params, response, auth }: HttpContext) {
		const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
		if (role !== 'admin') {
			return response.forbidden({ error: 'Admin only' })
		}
		const { id } = params
		const row = await db.from('media_assets').where('id', id).first()
		if (!row) return response.notFound({ error: 'Media not found' })

		const publicRoot = path.join(process.cwd(), 'public')
		// Delete original file
		try {
			const originalPath = path.join(publicRoot, String(row.url || '').replace(/^\//, ''))
			await fs.promises.unlink(originalPath)
		} catch { }

		// Delete known variants from metadata
		try {
			const meta = row.metadata as any
			const variants = meta && Array.isArray(meta.variants) ? meta.variants : []
			for (const v of variants) {
				if (!v?.url || typeof v.url !== 'string') continue
				const p = path.join(publicRoot, v.url.replace(/^\//, ''))
				try { await fs.promises.unlink(p) } catch { }
			}
		} catch { }

		// Fallback: pattern-based deletion (basename.VARIANT+ext)
		try {
			const originalPath = path.join(publicRoot, String(row.url || '').replace(/^\//, ''))
			const parsed = path.parse(originalPath)
			const dir = parsed.dir
			const base = parsed.name
			const ext = parsed.ext
			const files = await fs.promises.readdir(dir)
			await Promise.all(files.map(async (f) => {
				if (f.startsWith(base + '.') && f.endsWith(ext)) {
					try { await fs.promises.unlink(path.join(dir, f)) } catch { }
				}
			}))
		} catch { }

		await db.from('media_assets').where('id', id).delete()
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
		const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
		if (!(role === 'admin' || role === 'editor')) {
			return response.forbidden({ error: 'Not allowed to generate variants' })
		}
		const { id } = params
		const row = await db.from('media_assets').where('id', id).first()
		if (!row) return response.notFound({ error: 'Media not found' })
		const publicUrl: string = String(row.url)
		const absPath = path.join(process.cwd(), 'public', publicUrl.replace(/^\//, ''))

		const body = request.all()

		// cropRect mode
		const cropRectRaw = body?.cropRect
		let cropArgs: { left: number; top: number; width: number; height: number } | null = null
		if (cropRectRaw && typeof cropRectRaw === 'object') {
			const x = Number(cropRectRaw.x)
			const y = Number(cropRectRaw.y)
			const w = Number(cropRectRaw.width)
			const h = Number(cropRectRaw.height)
			if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
				cropArgs = { left: Math.max(0, Math.floor(x)), top: Math.max(0, Math.floor(y)), width: Math.floor(w), height: Math.floor(h) }
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

		const targetVariant: string | undefined = typeof body?.targetVariant === 'string' ? body.targetVariant : undefined
		const target: string | undefined = typeof body?.target === 'string' ? body.target : undefined

		// Single-variant rebuild
		if (targetVariant) {
			const specs = mediaService.parseDerivatives()
			const spec = specs.find((s) => s.name === targetVariant)
			if (!spec) {
				return response.badRequest({ error: `Unknown variant: ${targetVariant}` })
			}
			const variants = await mediaService.generateVariants(absPath, publicUrl, [spec], cropArgs, focalPoint)
			const meta = row.metadata || {}
			let list = Array.isArray((meta as any).variants) ? (meta as any).variants : []
			for (const v of variants) {
				const idx = list.findIndex((x: any) => x.name === v.name)
				if (idx >= 0) list[idx] = v
				else list.push(v)
			}
			await db.from('media_assets').where('id', id).update({ metadata: { ...(meta as any), variants: list } as any, updated_at: new Date() } as any)
			return response.ok({ data: { variants } })
		}

		// Original cropped variant (does not overwrite original) + rebuild all configured variants from this crop
		if (target === 'original-cropped' && cropArgs) {
			const parsed = path.parse(absPath)
			const outName = `${parsed.name}.cropped${parsed.ext}`
			const outPath = path.join(parsed.dir, outName)
			const outUrl = path.posix.join(path.posix.dirname(publicUrl), outName)
			const info = await sharp(absPath)
				.extract({ left: cropArgs.left, top: cropArgs.top, width: cropArgs.width, height: cropArgs.height })
				.toFile(outPath)
			const cropped = { name: 'cropped', url: outUrl, width: info.width, height: info.height, size: info.size || 0 }

			// Rebuild all configured variants using the same cropRect
			const rebuilt = await mediaService.generateVariants(absPath, publicUrl, null, cropArgs, null)

			const meta = row.metadata || {}
			let list = Array.isArray((meta as any).variants) ? (meta as any).variants : []
			// Merge rebuilt variants
			for (const v of rebuilt) {
				const idx = list.findIndex((x: any) => x.name === v.name)
				if (idx >= 0) list[idx] = v
				else list.push(v)
			}
			// Merge/add cropped special
			const croppedIdx = list.findIndex((x: any) => x.name === 'cropped')
			if (croppedIdx >= 0) list[croppedIdx] = cropped
			else list.push(cropped)

			await db.from('media_assets').where('id', id).update({ metadata: { ...(meta as any), variants: list, cropRect: cropArgs } as any, updated_at: new Date() } as any)
			return response.ok({ data: { variants: [...rebuilt, cropped] } })
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

		const variants = await mediaService.generateVariants(absPath, publicUrl, specs || null, cropArgs, focalPoint)

		const metadata = {
			...(row.metadata || {}),
			...(cropArgs ? { cropRect: cropArgs } : {}),
			...(focalPoint ? { focalPoint } : {}),
			variants,
		}
		await db.from('media_assets').where('id', id).update({ metadata: metadata as any, updated_at: new Date() } as any)
		return response.ok({ data: { variants } })
	}

	/**
	 * PATCH /api/media/:id/rename
	 * Body: { filename: string }
	 */
	async rename({ params, request, response, auth }: HttpContext) {
		const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
		if (role !== 'admin') {
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
		const { newPath, newUrl, renamedVariants } = await mediaService.renameWithVariants(oldPath, oldUrl, newBase)

		let metadata = row.metadata || {}
		if (metadata && (metadata as any).variants && Array.isArray((metadata as any).variants)) {
			(metadata as any).variants = (metadata as any).variants.map((v: any) => {
				const found = renamedVariants.find((rv) => rv.oldUrl === v.url)
				if (found) {
					return { ...v, url: found.newUrl }
				}
				if (typeof v.url === 'string' && v.url.startsWith(path.posix.dirname(oldUrl))) {
					const trailing = v.url.substring(path.posix.dirname(oldUrl).length + 1)
					if (trailing.startsWith(`${parsed.name}.`)) {
						const variantName = trailing.slice(parsed.name.length + 1)
						return { ...v, url: path.posix.join(path.posix.dirname(oldUrl), `${newBase}.${variantName}`) }
					}
				}
				return v
			})
		}
		await db.from('media_assets').where('id', id).update({ url: newUrl, original_filename: path.parse(newPath).base, metadata: metadata as any, updated_at: new Date() } as any)

		const oldUrlEsc = oldUrl.replace(/'/g, "''")
		const newUrlEsc = newUrl.replace(/'/g, "''")
		await db.raw(`UPDATE module_instances SET props = REPLACE(props::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE props::text LIKE '%${oldUrlEsc}%'`)
		await db.raw(`UPDATE module_instances SET review_props = REPLACE(review_props::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE review_props::text LIKE '%${oldUrlEsc}%'`)
		await db.raw(`UPDATE post_modules SET overrides = REPLACE(overrides::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE overrides::text LIKE '%${oldUrlEsc}%'`)
		await db.raw(`UPDATE post_modules SET review_overrides = REPLACE(review_overrides::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE review_overrides::text LIKE '%${oldUrlEsc}%'`)

		return response.ok({ data: { url: newUrl } })
	}

	async checkDuplicate({ request, response, auth }: HttpContext) {
		const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
		if (!(role === 'admin' || role === 'editor')) {
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
		const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
		if (role !== 'admin') {
			return response.forbidden({ error: 'Admin only' })
		}
		const { id } = params
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

		const absPath = path.join(process.cwd(), 'public', String(row.url).replace(/^\//, ''))
		// Write file
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
		await fs.promises.writeFile(absPath, data)

		// Derive mime and regenerate variants if image
		const ext = (path.extname(absPath) || '').toLowerCase()
		let mime = typeof type === 'string' ? type : ''
		if (!mime.includes('/')) {
			switch (ext) {
				case '.jpg':
				case '.jpeg':
					mime = 'image/jpeg'; break
				case '.png': mime = 'image/png'; break
				case '.webp': mime = 'image/webp'; break
				case '.gif': mime = 'image/gif'; break
				case '.svg': mime = 'image/svg+xml'; break
				case '.avif': mime = 'image/avif'; break
				default: mime = type || 'application/octet-stream'
			}
		}

		let metadata = row.metadata || null
		if (mime.startsWith('image/')) {
			const variants = await mediaService.generateVariants(absPath, row.url, null)
			metadata = { ...(metadata || {}), variants }
		}

		await db.from('media_assets').where('id', id).update({
			mime_type: mime,
			size: Number(size),
			metadata: metadata as any,
			updated_at: new Date(),
		} as any)

		return response.ok({ message: 'Overridden' })
	}

	async show({ params, response }: HttpContext) {
		const { id } = params
		const row = await db.from('media_assets').where('id', id).first()
		if (!row) return response.notFound({ error: 'Media not found' })
		return response.ok({ data: {
			id: row.id,
			url: row.url,
			originalFilename: row.original_filename,
			mimeType: row.mime_type,
			size: Number(row.size || 0),
			altText: row.alt_text,
			caption: row.caption,
			description: row.description,
			categories: Array.isArray(row.categories) ? row.categories : [],
			metadata: row.metadata || null,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		} })
	}

	async showPublic({ params, response }: HttpContext) {
		const { id } = params
		const row = await db.from('media_assets').where('id', id).first()
		if (!row) return response.notFound({ error: 'Media not found' })
		return response.ok({ data: {
			id: row.id,
			url: row.url,
			metadata: row.metadata || null,
			altText: row.alt_text,
			categories: Array.isArray(row.categories) ? row.categories : [],
		} })
	}

	/**
	 * GET /api/media/categories
	 * Returns distinct list of categories used across all media
	 */
	async categories({ response }: HttpContext) {
		const rows = await db.rawQuery("SELECT DISTINCT unnest(categories) AS category FROM media_assets WHERE array_length(categories,1) IS NOT NULL")
		const list: string[] = Array.isArray(rows?.rows)
			? rows.rows.map((r: any) => String(r.category)).filter((x) => x.length > 0)
			: []
		return response.ok({ data: list.sort((a, b) => a.localeCompare(b)) })
	}
}


