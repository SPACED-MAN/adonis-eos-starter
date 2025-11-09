import env from '#start/env'

/**
 * Configuration for internationalization (i18n)
 */
export const i18nConfig = {
	/**
	 * Default locale used as fallback when translation is not available
	 */
	defaultLocale: env.get('DEFAULT_LOCALE', 'en'),

	/**
	 * List of supported locales
	 * Comma-separated in env: SUPPORTED_LOCALES=en,es,fr,de
	 */
	supportedLocales: (env.get('SUPPORTED_LOCALES', 'en') as string)
		.split(',')
		.map((locale) => locale.trim())
		.filter(Boolean),

	/**
	 * Locale detection strategy priority
	 * 1. URL prefix (/es/blog/post)
	 * 2. Domain (es.example.com)
	 * 3. Accept-Language header
	 * 4. Session
	 * 5. Default locale
	 */
	detectionStrategy: ['url', 'domain', 'header', 'session'] as const,

	/**
	 * URL prefix pattern
	 * If true, uses /{locale}/path format
	 * If false, uses domain-based locale detection
	 */
	useUrlPrefix: true,

	/**
	 * Store detected locale in session
	 */
	persistInSession: true,

	/**
	 * Session key for storing locale
	 */
	sessionKey: 'locale',

	/**
	 * Cookie key for storing locale (if using cookie storage)
	 */
	cookieKey: 'locale',

	/**
	 * Domain mapping for locale detection
	 * Example: { 'es.example.com': 'es', 'fr.example.com': 'fr' }
	 */
	domainLocaleMap: {} as Record<string, string>,
}

export default i18nConfig

// Type definitions for runtime
export type LocaleConfig = typeof i18nConfig
export type SupportedLocale = (typeof i18nConfig.supportedLocales)[number]
export type DetectionStrategy = (typeof i18nConfig.detectionStrategy)[number]

