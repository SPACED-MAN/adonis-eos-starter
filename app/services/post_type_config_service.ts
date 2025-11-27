import type { PostTypeField } from '../types/custom_field.ts'

type PostTypeUiConfig = {
	hideCoreFields?: Array<'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'>
	hierarchyEnabled?: boolean
	fields?: PostTypeField[]
	template?: { name: string; description?: string }
	urlPatterns?: Array<{ locale: string; pattern: string; isDefault?: boolean }>
	permalinksEnabled?: boolean
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
			permalinksEnabled: true,
		}
		const isDev = process.env.NODE_ENV === 'development'
		if (!isDev && cache.has(postType)) return cache.get(postType)!
		// Prefer registry (explicit registration in start/post_types.ts)
		let cfg: PostTypeUiConfig = (postTypeRegistry.get(postType) as any) || registry[postType] || {}
		// Source of truth is registry or app/post_types files
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
			permalinksEnabled: cfg.permalinksEnabled !== undefined ? !!cfg.permalinksEnabled : true,
		}
		if (!isDev) cache.set(postType, full)
		return full
	}
}

const postTypeConfigService = new PostTypeConfigService()
export default postTypeConfigService


