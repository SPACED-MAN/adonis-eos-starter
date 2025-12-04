/**
 * Core types for the module system
 */

/**
 * Module scope defines where a module can be used
 */
export type ModuleScope = 'local' | 'global'

/**
 * Module configuration metadata
 */
export interface ModuleConfig {
  /**
   * Unique identifier for the module type (e.g., 'hero', 'prose', 'callout')
   */
  type: string

  /**
   * Human-readable name for the module
   */
  name: string

  /**
   * Description of the module's purpose
   */
  description: string

  /**
   * Icon identifier (for admin UI)
   */
  icon?: string

  /**
   * Which scopes this module supports
   */
  allowedScopes: ModuleScope[]

  /**
   * Whether this module can be locked in templates
   */
  lockable: boolean

  /**
   * JSON schema for module props validation
   */
  propsSchema: Record<string, any>

  /**
   * Default props for new instances
   */
  defaultProps: Record<string, any>

  /**
   * Which post types can use this module (empty = all)
   */
  allowedPostTypes?: string[]
}

/**
 * Rendering context passed to modules
 */
export interface ModuleRenderContext {
  /**
   * Current locale for i18n
   */
  locale: string

  /**
   * Post type this module is rendering within
   */
  postType: string

  /**
   * Whether we're in preview mode
   */
  isPreview: boolean

  /**
   * Cache key for this render
   */
  cacheKey?: string

  /**
   * Additional context data
   */
  meta?: Record<string, any>
}

/**
 * Result of rendering a module
 */
export interface ModuleRenderResult {
  /**
   * Rendered HTML
   */
  html: string

  /**
   * JSON-LD structured data (optional)
   */
  jsonLd?: Record<string, any>

  /**
   * Cache TTL in seconds (optional)
   */
  cacheTtl?: number

  /**
   * Cache tags for invalidation (optional)
   */
  cacheTags?: string[]
}

/**
 * Module instance data from database
 */
export interface ModuleInstanceData {
  id: string
  scope: ModuleScope
  type: string
  globalSlug?: string | null
  props: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

/**
 * Post-module join data with overrides
 */
export interface PostModuleData {
  id: string
  postId: string
  moduleId: string
  orderIndex: number
  overrides: Record<string, any> | null
  locked: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Merged module data ready for rendering
 */
export interface MergedModuleData {
  type: string
  scope: ModuleScope
  props: Record<string, any> // Base props + overrides merged
  locked: boolean
  orderIndex: number
}
