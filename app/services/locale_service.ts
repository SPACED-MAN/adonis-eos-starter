import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import i18nConfig from '#config/i18n'

/**
 * LocaleService handles locale detection and management
 */
export class LocaleService {
	private async hasLocalesTable(): Promise<boolean> {
		try {
			await db.from('locales').count('* as c').first()
			return true
		} catch (e: any) {
			// 42P01: relation does not exist (Postgres)
			if (e && (e.code === '42P01' || String(e.message || '').includes('relation "locales" does not exist'))) {
				return false
			}
			// Other DB errors should bubble up
			throw e
		}
	}
	/**
	 * Bootstrap locales from environment variables into the DB (idempotent).
	 * DEFAULT_LOCALE and SUPPORTED_LOCALES (comma-separated) are used.
	 */
	async ensureFromEnv(): Promise<void> {
		// If table not created yet (migrations not run), skip
		if (!(await this.hasLocalesTable())) return
		const defaultLocale = (process.env.DEFAULT_LOCALE || 'en').toLowerCase()
		const supported = (process.env.SUPPORTED_LOCALES || defaultLocale)
			.split(',')
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean)
		const uniq = Array.from(new Set([defaultLocale, ...supported]))
		const existingRows = await db.from('locales').select('code')
		const existing = new Set(existingRows.map((r) => r.code))
		const now = new Date()
		const toInsert = uniq.filter((c) => !existing.has(c)).map((code) => ({
			code,
			is_enabled: true,
			is_default: code === defaultLocale,
			created_at: now,
			updated_at: now,
		}))
		if (toInsert.length) {
			await db.table('locales').insert(toInsert)
		}
		// Ensure only one default
		await db.from('locales').update({ is_default: false })
		await db.from('locales').where('code', defaultLocale).update({ is_default: true })
	}
	/**
	 * Get list of supported locales (sync, env-based)
	 */
	getSupportedLocales(): string[] {
		return (process.env.SUPPORTED_LOCALES || process.env.DEFAULT_LOCALE || 'en')
			.split(',')
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean)
	}

	/**
	 * Get default locale
	 */
	getDefaultLocale(): string {
		return (process.env.DEFAULT_LOCALE || 'en').toLowerCase()
	}

	/**
	 * Check if a locale is supported
	 */
	isLocaleSupported(locale: string): boolean {
		const supported = this.getSupportedLocales()
		return supported.includes(locale.toLowerCase())
	}

	/**
	 * Detect locale from HTTP context
	 * Priority: URL prefix > Domain > Accept-Language header > Session > Default
	 */
	async detectLocale(ctx: HttpContext): Promise<string> {
		for (const strategy of i18nConfig.detectionStrategy) {
			let locale: string | null = null

			switch (strategy) {
				case 'url':
					locale = this.detectFromUrl(ctx)
					break
				case 'domain':
					locale = this.detectFromDomain(ctx)
					break
				case 'header':
					locale = await this.detectFromHeaders(ctx)
					break
				case 'session':
					locale = this.detectFromSession(ctx)
					break
			}

			if (locale && this.isLocaleSupported(locale)) {
				return locale
			}
		}

		return this.getDefaultLocale()
	}

	/**
	 * Detect locale from URL prefix
	 * Example: /es/blog/post -> 'es'
	 */
	private detectFromUrl(ctx: HttpContext): string | null {
		if (!i18nConfig.useUrlPrefix) {
			return null
		}

		const path = ctx.request.url()
		const match = path.match(/^\/([a-z]{2})(\/|$)/)

		return match ? match[1] : null
	}

	/**
	 * Detect locale from domain
	 * Example: es.example.com -> 'es'
	 */
	private detectFromDomain(ctx: HttpContext): string | null {
		const hostname = ctx.request.hostname()

		// Check domain mapping
		if (i18nConfig.domainLocaleMap[hostname]) {
			return i18nConfig.domainLocaleMap[hostname]
		}

		// Check for subdomain pattern (es.example.com)
		const match = hostname.match(/^([a-z]{2})\./)
		return match ? match[1] : null
	}

	/**
	 * Detect locale from Accept-Language header
	 */
	private async detectFromHeaders(ctx: HttpContext): Promise<string | null> {
		const acceptLanguage = ctx.request.header('accept-language')
		if (!acceptLanguage) {
			return null
		}

		// Parse Accept-Language header and find best match
		const languages = acceptLanguage
			.split(',')
			.map((lang) => {
				const [locale, qRaw] = lang.trim().split(';q=')
				const q = qRaw ? parseFloat(qRaw) : 1.0
				// Extract just the language code (en-US -> en)
				const code = locale.split('-')[0]
				return { locale: code, q }
			})
			.sort((a, b) => b.q - a.q)

		// Find first supported locale
		for (const { locale } of languages) {
			if (this.isLocaleSupported(locale)) {
				return locale
			}
		}

		return null
	}

	/**
	 * Detect locale from session
	 */
	private detectFromSession(ctx: HttpContext): string | null {
		if (!i18nConfig.persistInSession) {
			return null
		}

		return ctx.session.get(i18nConfig.sessionKey, null)
	}

	/**
	 * Store locale in session
	 */
	async storeLocaleInSession(ctx: HttpContext, locale: string): Promise<void> {
		if (i18nConfig.persistInSession && this.isLocaleSupported(locale)) {
			ctx.session.put(i18nConfig.sessionKey, locale)
		}
	}

	/**
	 * Get locale info for a specific locale
	 */
	getLocaleInfo(locale: string): {
		code: string
		isDefault: boolean
		isSupported: boolean
	} {
		return {
			code: locale,
			isDefault: false,
			isSupported: false,
		}
	}

	/**
	 * Generate locale-specific URL
	 */
	generateLocalizedUrl(path: string, locale: string): string {
		// If using URL prefix and locale is not default
		const defaultLocale = this.getDefaultLocale()
		if (i18nConfig.useUrlPrefix && locale !== defaultLocale) {
			// Remove leading slash if present
			const cleanPath = path.startsWith('/') ? path.slice(1) : path
			return `/${locale}/${cleanPath}`
		}

		return path
	}

	/**
	 * Strip locale from URL path
	 */
	stripLocaleFromUrl(path: string): string {
		if (!i18nConfig.useUrlPrefix) {
			return path
		}

		const match = path.match(/^\/([a-z]{2})(\/|$)/)
		// Best-effort strip; DB check not needed
		if (match) {
			return path.slice(3) || '/'
		}

		return path
	}
}

export default new LocaleService()

