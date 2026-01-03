import type { CustomFieldDefinition } from './custom_field.js'
import type { RobotsConfig } from './seo.js'

export interface PostTypeConfig {
  /**
   * Post type slug (e.g. "blog", "page")
   */
  type?: string

  /**
   * Human readable labels for the UI
   */
  label?: string
  pluralLabel?: string
  description?: string
  icon?: string

  /**
   * UI behavior in the editor
   */
  hideCoreFields?: Array<'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'>
  hierarchyEnabled?: boolean

  /**
   * Custom fields attached to this post type
   */
  fields?: CustomFieldDefinition[]

  /**
   * Default module group metadata (synced on boot)
   */
  moduleGroup?: { name: string; description?: string } | null

  /**
   * URL patterns (synced on boot)
   * Tokens: {locale}, {slug}, {yyyy}, {mm}, {dd}
   */
  urlPatterns?: Array<{ locale: string; pattern: string; isDefault?: boolean }>

  /**
   * Permalinks enabled for this type (set to false to disable public pages)
   */
  permalinksEnabled?: boolean

  /**
   * Whether modules should be available for this post type.
   * Defaults to true when permalinks are enabled AND urlPatterns exist.
   */
  modulesEnabled?: boolean

  /**
   * Whether module groups should be available for this post type.
   * Defaults to true when permalinks are enabled AND urlPatterns exist.
   */
  moduleGroupsEnabled?: boolean

  /**
   * Taxonomies attached to this post type (shared by slug across post types)
   */
  taxonomies?: string[]

  /**
   * Featured image settings
   */
  featuredImage?: {
    enabled: boolean
    label?: string
  }

  /**
   * A/B testing configuration
   */
  abTesting?: {
    enabled: boolean
    strategy?: 'random' | 'cookie' | 'session'
    variations?: Array<{ label: string; value: string; weight?: number }>
  }

  /**
   * SEO default configurations when a post is created
   */
  seoDefaults?: {
    noindex?: boolean
    nofollow?: boolean
    robotsJson?: RobotsConfig
  }
}

