import type { ModuleConfig, ModuleRenderContext, MergedModuleData } from '#types/module_types'

export type RenderingMode = 'static' | 'react'

/**
 * Base class for all modules
 *
 * All concrete modules (Hero, Prose, etc.) must extend this class
 * and implement the required methods.
 */
export default abstract class BaseModule {
  /**
   * Get the module configuration
   * Must be implemented by each concrete module
   */
  abstract getConfig(): ModuleConfig

  /**
   * Rendering mode: 'static' for pure SSR, 'react' for interactive components
   *
   * - 'static': Server-only rendering in inertia/modules/*-static.tsx (max performance)
   * - 'react': React component in inertia/modules/*.tsx (SSR + hydration, interactive)
   *
   * Default: 'react' (override to use 'static' for simple modules)
   */
  getRenderingMode(): RenderingMode {
    return 'react'
  }

  /**
   * Component file name in inertia/modules/
   *
   * Convention:
   * - Static modules: 'hero-static' (renders from hero-static.tsx)
   * - React modules: 'hero' (renders from hero.tsx)
   */
  getComponentName(): string {
    const config = this.getConfig()
    const type = config.type
    return this.getRenderingMode() === 'static' ? `${type}-static` : type
  }

  /**
   * Validate module props against schema
   *
   * Default implementation uses the propsSchema from config.
   * Can be overridden for custom validation logic.
   *
   * @param props - Props to validate
   * @returns True if valid, throws error otherwise
   */
  validate(props: Record<string, any>): boolean {
    const config = this.getConfig()

    // Basic validation: check required fields exist
    const schema = config.propsSchema

    for (const [key, fieldSchema] of Object.entries(schema)) {
      if (fieldSchema.required && !(key in props)) {
        throw new Error(`Missing required field: ${key}`)
      }
    }

    return true
  }

  /**
   * Merge base props with overrides
   *
   * Default implementation performs a shallow merge.
   * Can be overridden for deep merge or custom logic.
   *
   * @param baseProps - Base props from module instance
   * @param overrides - Overrides from post_modules
   * @returns Merged props
   */
  mergeProps(
    baseProps: Record<string, any>,
    overrides: Record<string, any> | null
  ): Record<string, any> {
    if (!overrides) {
      return { ...baseProps }
    }

    // Shallow merge by default
    return {
      ...baseProps,
      ...overrides,
    }
  }

  /**
   * Extract localized content from props
   *
   * If a prop value is an object with locale keys, extract the value for the current locale.
   * Otherwise, return the value as-is. Recursively handles nested objects.
   *
   * @param props - Props to localize
   * @param locale - Current locale
   * @param fallbackLocale - Fallback locale if current not found
   * @returns Localized props
   */
  localizeProps(
    props: Record<string, any>,
    locale: string,
    fallbackLocale: string = 'en'
  ): Record<string, any> {
    const localized: Record<string, any> = {}

    for (const [key, value] of Object.entries(props)) {
      if (this.isLocalizedValue(value)) {
        // Extract locale-specific value
        localized[key] = value[locale] || value[fallbackLocale] || null
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively localize nested objects
        localized[key] = this.localizeProps(value, locale, fallbackLocale)
      } else {
        localized[key] = value
      }
    }

    return localized
  }

  /**
   * Check if a value is a localized object (has locale keys)
   *
   * A localized object has keys that look like locale codes (e.g., 'en', 'es', 'fr', 'en-US')
   * and values that are strings.
   *
   * @param value - Value to check
   * @returns True if value is a localized object
   */
  protected isLocalizedValue(value: any): value is Record<string, string> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false
    }

    const keys = Object.keys(value)
    if (keys.length === 0) {
      return false
    }

    // Check if keys look like locale codes:
    // - 2-5 characters long
    // - Lowercase letters only (with optional hyphen for regional codes like 'en-US')
    // - Values are strings
    const localePattern = /^[a-z]{2}(-[a-z]{2})?$/i

    return keys.every((key) => {
      if (typeof key !== 'string' || key.length < 2 || key.length > 5) {
        return false
      }
      // Must match locale pattern and have a string value
      return localePattern.test(key) && typeof value[key] === 'string'
    })
  }

  /**
   * Generate cache key for this module render
   *
   * @param data - Module data
   * @param context - Render context
   * @returns Cache key string
   */
  generateCacheKey(data: MergedModuleData, context: ModuleRenderContext): string {
    const config = this.getConfig()
    return `module:${config.type}:${context.locale}:${JSON.stringify(data.props)}`
  }

  /**
   * Get cache tags for this module
   *
   * Used for cache invalidation strategies.
   *
   * @param data - Module data
   * @returns Array of cache tags
   */
  getCacheTags(data: MergedModuleData): string[] {
    const config = this.getConfig()
    return [`module:${config.type}`, `module:${data.scope}`]
  }
}
