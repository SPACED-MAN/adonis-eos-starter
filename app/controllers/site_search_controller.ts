import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import urlPatternService from '#services/url_pattern_service'
import postTypeRegistry from '#services/post_type_registry'
import { siteSearchQueryValidator } from '#validators/query'

export default class SiteSearchController {
	/**
	 * GET /search
	 *
	 * Public site search page rendered via Inertia (override page).
	 * Query params:
	 * - q: string
	 * - type: post type slug (optional)
	 * - locale: locale (optional; default "en")
	 */
	async index({ request, inertia }: HttpContext) {
		const { q: qRaw, type: typeRaw, locale: localeRaw } = await request.validateUsing(
			siteSearchQueryValidator
		)
		const locale = localeRaw || 'en'
		const qTrimmed = (qRaw || '').trim()

		const allowedTypes = postTypeRegistry.list()
		const type = typeRaw && allowedTypes.includes(typeRaw) ? typeRaw : ''

		const limit = 30
		const results: Array<{
			id: string
			type: string
			title: string
			excerpt: string | null
			slug: string
			locale: string
			url: string
			updatedAt: string
		}> = []

		if (qTrimmed.length > 0) {
			const query = Post.query()
				.apply((scopes) => {
					scopes.published()
					scopes.byLocale(locale)
					if (type) scopes.ofType(type)
				})
				.where((sub) => {
					// Basic, fast fields only (no module content scanning).
					sub
						.whereILike('title', `%${qTrimmed}%`)
						.orWhereILike('excerpt', `%${qTrimmed}%`)
						.orWhereILike('slug', `%${qTrimmed}%`)
				})
				.orderBy('updatedAt', 'desc')
				.limit(limit)

			const rows = await query

			for (const p of rows) {
				let url = `/${encodeURIComponent(p.slug)}`
				try {
					const maybe = await urlPatternService.buildPostPathForPost(p.id)
					if (typeof maybe === 'string' && maybe) url = maybe
				} catch {
					// fallback is fine
				}
				results.push({
					id: p.id,
					type: p.type,
					title: p.title,
					excerpt: p.excerpt,
					slug: p.slug,
					locale: p.locale,
					url,
					updatedAt: p.updatedAt.toISO() || p.updatedAt.toString(),
				})
			}
		}

		return inertia.render('site/overrides/search', {
			q: qTrimmed,
			type,
			locale,
			postTypes: allowedTypes,
			results,
			limit,
		})
	}
}


