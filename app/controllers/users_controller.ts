import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import LocaleService from '#services/locale_service'
import CreatePost from '#actions/posts/create_post'
import siteSettingsService from '#services/site_settings_service'

export default class UsersController {
	/**
	 * GET /api/users (admin)
	 */
	async index({ response }: HttpContext) {
		const rows = await db.from('users').orderBy('created_at', 'desc').select('id', 'email', 'full_name', 'role', 'created_at', 'updated_at')
		return response.ok({
			data: rows.map((r: any) => ({
				id: r.id,
				email: r.email,
				fullName: r.full_name ?? null,
				role: r.role,
				createdAt: r.created_at,
				updatedAt: r.updated_at,
			})),
		})
	}

	/**
	 * PATCH /api/users/:id (admin) - update name/email/role
	 */
	async update({ params, request, response }: HttpContext) {
		const { id } = params
		const { fullName, email, role } = request.only(['fullName', 'email', 'role'])
		if (role && !['admin', 'editor', 'translator'].includes(String(role))) {
			return response.badRequest({ error: 'Invalid role' })
		}
		// Unique email check when changing
		if (email) {
			const existing = await db.from('users').where('email', String(email)).andWhereNot('id', id).first()
			if (existing) {
				return response.status(409).json({ error: 'Email already in use' })
			}
		}
		const now = new Date()
		const update: any = { updated_at: now }
		if (typeof fullName === 'string') update.full_name = fullName
		if (typeof email === 'string') update.email = email
		if (typeof role === 'string') update.role = role
		const count = await db.from('users').where('id', id).update(update)
		if (!count) return response.notFound({ error: 'User not found' })
		const user = await db.from('users').where('id', id).first()
		return response.ok({
			data: {
				id: user.id,
				email: user.email,
				fullName: user.full_name ?? null,
				role: user.role,
				updatedAt: user.updated_at,
			},
		})
	}

	/**
	 * PATCH /api/users/:id/password (admin)
	 */
	async resetPassword({ params, request, response }: HttpContext) {
		const { id } = params
		const { password } = request.only(['password'])
		const pwd = String(password || '')
		if (!pwd || pwd.length < 8) {
			return response.badRequest({ error: 'Password must be at least 8 characters' })
		}
		const hashed = await hash.make(pwd)
		const now = new Date()
		const count = await db.from('users').where('id', id).update({ password: hashed, updated_at: now })
		if (!count) return response.notFound({ error: 'User not found' })
		return response.ok({ message: 'Password updated' })
	}

	/**
	 * GET /api/profile/status - current user profile status and role enablement
	 */
	async profileStatus({ auth, response }: HttpContext) {
		if (!auth.use('web').isAuthenticated) return response.unauthorized({ error: 'Auth required' })
		const me: any = auth.use('web').user
		const site = await siteSettingsService.get()
		const enabledRoles: string[] = Array.isArray((site as any).profileRolesEnabled) ? (site as any).profileRolesEnabled : []
		const enabledForRole = enabledRoles.length === 0 || enabledRoles.includes(me?.role)
		let hasProfile = false
		let profilePostId: string | undefined
		let profileThumbUrl: string | undefined
		if (enabledForRole) {
			const row = await db.from('posts').where({ type: 'profile', author_id: me.id }).first()
			if (row) {
				hasProfile = true
				profilePostId = (row as any).id
				try {
					// Resolve profile_image custom field value by slug (assumes value stores media id string)
					const val = await db.from('post_custom_field_values').where({ post_id: (row as any).id, field_slug: 'profile_image' }).first()
					const mediaId = val && (val as any).value ? (typeof (val as any).value === 'string' ? (val as any).value : String((val as any).value?.id || (val as any).value)) : null
					if (mediaId) {
						const m = await db.from('media_assets').where('id', mediaId).first()
						if (m) {
							const meta = (m as any).metadata || {}
							const adminThumb = process.env.MEDIA_ADMIN_THUMBNAIL_VARIANT || 'thumb'
							const variants = Array.isArray((meta as any).variants) ? (meta as any).variants : []
							const found = variants.find((v: any) => v?.name === adminThumb)
							profileThumbUrl = (found && found.url) ? found.url : (m as any).url
						}
					}
				} catch { /* ignore */ }
			}
		}
		return response.ok({ data: { enabledForRole, hasProfile, profilePostId, profileThumbUrl } })
	}

	/**
	 * POST /api/users/me/profile - create profile post for current user
	 */
	async createMyProfile({ auth, response }: HttpContext) {
		if (!auth.use('web').isAuthenticated) return response.unauthorized({ error: 'Auth required' })
		const me: any = auth.use('web').user
		// Enforce one per user (db unique also protects)
		const existing = await db.from('posts').where({ type: 'profile', author_id: me.id }).first()
		if (existing) {
			return response.status(409).json({ error: 'Profile already exists', id: (existing as any).id })
		}
		const locale = await LocaleService.getDefaultLocale()
		const slugBase = (me.fullName || me.email || `user-${me.id}`).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
		const slug = `${slugBase || 'user'}-${me.id}`
		const title = (me.fullName && me.fullName.trim()) ? `${me.fullName}'s Profile` : `User ${me.id} Profile`
		try {
			const post = await CreatePost.handle({
				type: 'profile',
				locale,
				slug,
				title,
				status: 'draft',
				userId: me.id,
			})
			return response.created({ id: post.id })
		} catch (e: any) {
			const status = e?.statusCode || 400
			return response.status(status).json({ error: e?.message || 'Failed to create profile' })
		}
	}
}


