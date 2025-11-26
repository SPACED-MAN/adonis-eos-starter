type PostTypeField = {
	slug: string
	label: string
	type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'media' | 'date' | 'url'
	translatable?: boolean
	config?: Record<string, any>
}

type PostTypeUiConfig = {
	hideCoreFields?: Array<'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'>
	hierarchyEnabled?: boolean
	fields?: PostTypeField[]
	template?: { name: string; description?: string }
	urlPatterns?: Array<{ locale: string; pattern: string; isDefault?: boolean }>
}

import postTypeRegistry from '#services/post_type_registry'

const registry: Record<string, PostTypeUiConfig> = {}
const cache = new Map<string, Required<PostTypeUiConfig>>()

class PostTypeConfigService {
	getUiConfig(postType: string): Required<PostTypeUiConfig> {
		const base: Required<PostTypeUiConfig> = {
			hideCoreFields: [],
			hierarchyEnabled: true,
			fields: [],
			template: { name: `${postType}-default` },
			urlPatterns: [],
		}
		if (cache.has(postType)) return cache.get(postType)!
		// Prefer registry (explicit registration in start/post_types.ts)
		let cfg: PostTypeUiConfig = (postTypeRegistry.get(postType) as any) || registry[postType] || {}
		// Built-in demo: profile defaults
		if (postType === 'profile') {
			cfg = {
				hideCoreFields: ['title'],
				hierarchyEnabled: false,
				fields: [
					{ slug: 'first_name', label: 'First name', type: 'text' },
					{ slug: 'last_name', label: 'Last name', type: 'text' },
					{ slug: 'profile_image', label: 'Profile image', type: 'media', config: { category: 'Profile image', preferredVariant: 'thumb' } },
					{ slug: 'bio', label: 'Bio', type: 'textarea' },
				],
				template: { name: 'profile-default', description: 'Default Profile Template' },
				urlPatterns: [],
				...(cfg || {}),
			}
		}
		// Try to load from app/post_types/<postType>.(ts|js)
		try {
			const path = require('node:path')
			const { pathToFileURL } = require('node:url')
			const fs = require('node:fs')
			const appRoot = process.cwd()
			const candidates = [
				path.join(appRoot, 'app', 'post_types', `${postType}.ts`),
				path.join(appRoot, 'app', 'post_types', `${postType}.js`),
			]
			for (const p of candidates) {
				if (fs.existsSync(p)) {
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const mod = require(pathToFileURL(p).href)
					const loaded = (mod?.default || mod) as PostTypeUiConfig
					if (loaded && typeof loaded === 'object') {
						cfg = { ...cfg, ...loaded }
						break
					}
				}
			}
		} catch { /* ignore dynamic import errors */ }
		const full: Required<PostTypeUiConfig> = {
			hideCoreFields: Array.isArray(cfg.hideCoreFields) ? cfg.hideCoreFields as any : [],
			hierarchyEnabled: cfg.hierarchyEnabled !== undefined ? !!cfg.hierarchyEnabled : base.hierarchyEnabled,
			fields: Array.isArray(cfg.fields) ? cfg.fields : [],
			template: cfg.template && cfg.template.name ? cfg.template : base.template,
			urlPatterns: Array.isArray(cfg.urlPatterns) ? cfg.urlPatterns : [],
		}
		cache.set(postType, full)
		return full
	}
}

const postTypeConfigService = new PostTypeConfigService()
export default postTypeConfigService


