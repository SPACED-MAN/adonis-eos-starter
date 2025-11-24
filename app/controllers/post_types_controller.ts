import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import authorizationService from '#services/authorization_service'
import postTypeSettingsService from '#services/post_type_settings_service'

export default class PostTypesController {
	/**
	 * GET /api/post-types/settings
	 * List post types with settings
	 */
	async listSettings({ response }: HttpContext) {
		const fromPosts = await db.from('posts').distinct('type')
		const fromTemplates = await db.from('templates').distinct('post_type')
		const set = new Set<string>()
		fromPosts.forEach((r) => r.type && set.add(String(r.type)))
		fromTemplates.forEach((r) => (r as any).post_type && set.add(String((r as any).post_type)))
		const types = Array.from(set).sort()
		// Load settings for each type
		const settings = await db.from('post_type_settings').whereIn('post_type', types)
		const typeToSettings = new Map<string, any>()
		settings.forEach((s: any) => typeToSettings.set(String(s.post_type), s))
		return response.ok({
			data: types.map((t) => ({
				postType: t,
				autoRedirectOnSlugChange: Boolean(typeToSettings.get(t)?.auto_redirect_on_slug_change ?? true),
				hierarchyEnabled: Boolean(typeToSettings.get(t)?.hierarchy_enabled ?? false),
			})),
		})
	}

	/**
	 * PATCH /api/post-types/:type/settings
	 * Update settings for a post type (admin only)
	 */
	async updateSettings({ params, request, response, auth }: HttpContext) {
		const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
		if (!authorizationService.isAdmin(role)) {
			return response.forbidden({ error: 'Admin only' })
		}
		const postType = String(params.type || '').trim()
		if (!postType) return response.badRequest({ error: 'Missing post type' })
		const { autoRedirectOnSlugChange, hierarchyEnabled } = request.only([
			'autoRedirectOnSlugChange',
			'hierarchyEnabled',
		])
		if (typeof autoRedirectOnSlugChange === 'boolean') {
			await postTypeSettingsService.setAutoRedirect(postType, autoRedirectOnSlugChange)
		}
		if (typeof hierarchyEnabled === 'boolean') {
			await postTypeSettingsService.setHierarchy(postType, hierarchyEnabled)
		}
		return response.ok({ message: 'Settings updated' })
	}
}


