/**
 * URL Patterns bootstrap
 *
 * Ensures default URL patterns exist for all known post types across supported locales
 * and prunes patterns for post types no longer recognized (derived from templates + posts).
 */
import urlPatternService from '#services/url_pattern_service'
import LocaleService from '#services/locale_service'

async function bootstrap() {
  try {
    const locales = await LocaleService.getSupportedLocales()
    // Ensure defaults for post types found in templates + posts
    const [fromTemplates, fromPosts] = await Promise.all([
      urlPatternService.getPostTypesFromTemplates(),
      urlPatternService.getPostTypesFromPosts(),
    ])
    const types = Array.from(new Set<string>([...fromTemplates, ...fromPosts]))
    for (const t of types) {
      await urlPatternService.ensureDefaultsForPostType(t, locales)
    }
    // Prune defaults for unknown post types
    await urlPatternService.pruneDefaultsForUnknownPostTypes()
  } catch {
    // Ignore during boot to avoid blocking server start
  }
}

await bootstrap()
