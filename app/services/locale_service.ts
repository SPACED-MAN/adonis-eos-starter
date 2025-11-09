import i18nConfig, { type SupportedLocale } from '#config/i18n'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * LocaleService handles locale detection and management
 */
export class LocaleService {
	/**
	 * Get list of supported locales
	 */
	getSupportedLocales(): string[] {
		return i18nConfig.supportedLocales
	}

	/**
	 * Get default locale
	 */
	getDefaultLocale(): string {
		return i18nConfig.defaultLocale
	}

	/**
	 * Check if a locale is supported
	 */
	isLocaleSupported(locale: string): boolean {
		return i18nConfig.supportedLocales.includes(locale)
	}

	/**
	 * Detect locale from HTTP context
	 * Priority: URL prefix > Domain > Accept-Language header > Session > Default
	 */
	detectLocale(ctx: HttpContext): string {
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
					locale = this.detectFromHeaders(ctx)
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
	private detectFromHeaders(ctx: HttpContext): string | null {
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
	storeLocaleInSession(ctx: HttpContext, locale: string): void {
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
			isDefault: locale === this.getDefaultLocale(),
			isSupported: this.isLocaleSupported(locale),
		}
	}

	/**
	 * Generate locale-specific URL
	 */
	generateLocalizedUrl(path: string, locale: string): string {
		// If using URL prefix and locale is not default
		if (i18nConfig.useUrlPrefix && locale !== this.getDefaultLocale()) {
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
		if (match && this.isLocaleSupported(match[1])) {
			return path.slice(3) || '/'
		}

		return path
	}
}

// Export singleton instance
export default new LocaleService()

