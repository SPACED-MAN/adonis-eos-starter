/**
 * SEO-related type definitions for posts
 */

/**
 * Robots meta configuration
 */
export interface RobotsConfig {
	index?: boolean
	follow?: boolean
	archive?: boolean
	snippet?: boolean
	maxSnippet?: number
	maxImagePreview?: 'none' | 'standard' | 'large'
	maxVideoPreview?: number
	noTranslate?: boolean
	noSitelinksSearchBox?: boolean
}

/**
 * JSON-LD structured data overrides
 * Based on schema.org vocabulary
 */
export interface JsonLdOverrides {
	'@type'?: string
	'@id'?: string
	name?: string
	headline?: string
	description?: string
	image?: string | { '@type': 'ImageObject'; url: string; width?: number; height?: number }
	author?: {
		'@type': 'Person' | 'Organization'
		name: string
		url?: string
	}
	publisher?: {
		'@type': 'Organization'
		name: string
		logo?: { '@type': 'ImageObject'; url: string }
	}
	datePublished?: string
	dateModified?: string
	mainEntityOfPage?: string | { '@type': 'WebPage'; '@id': string }
	articleBody?: string
	wordCount?: number
	keywords?: string[]
	inLanguage?: string
	isAccessibleForFree?: boolean
	// Allow additional schema.org properties
	[key: string]: unknown
}

/**
 * Complete SEO data for a post
 */
export interface PostSeoData {
	canonical: string
	alternates: Array<{ locale: string; href: string }>
	robots: string
	jsonLd: Record<string, unknown>
	og: {
		title: string
		description?: string
		url: string
		type: string
		image?: string
	}
	twitter: {
		card: 'summary' | 'summary_large_image' | 'app' | 'player'
		title: string
		description?: string
		image?: string
	}
}

/**
 * Default robots configuration for different statuses
 */
export const DEFAULT_ROBOTS: Record<string, RobotsConfig> = {
	published: { index: true, follow: true },
	draft: { index: false, follow: false },
	review: { index: false, follow: false },
	scheduled: { index: false, follow: false },
	archived: { index: false, follow: false },
	private: { index: false, follow: false },
	protected: { index: false, follow: false },
}

/**
 * Convert RobotsConfig to meta content string
 */
export function robotsConfigToString(config: RobotsConfig): string {
	const directives: string[] = []

	if (config.index === false) {
		directives.push('noindex')
	} else if (config.index === true) {
		directives.push('index')
	}

	if (config.follow === false) {
		directives.push('nofollow')
	} else if (config.follow === true) {
		directives.push('follow')
	}

	if (config.archive === false) {
		directives.push('noarchive')
	}

	if (config.snippet === false) {
		directives.push('nosnippet')
	} else if (config.maxSnippet !== undefined) {
		directives.push(`max-snippet:${config.maxSnippet}`)
	}

	if (config.maxImagePreview) {
		directives.push(`max-image-preview:${config.maxImagePreview}`)
	}

	if (config.maxVideoPreview !== undefined) {
		directives.push(`max-video-preview:${config.maxVideoPreview}`)
	}

	if (config.noTranslate) {
		directives.push('notranslate')
	}

	if (config.noSitelinksSearchBox) {
		directives.push('nositelinkssearchbox')
	}

	return directives.length > 0 ? directives.join(',') : 'index,follow'
}

