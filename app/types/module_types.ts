/**
 * Core types for the module system
 */

/**
 * Module scope defines where a module can be used
 */
export type ModuleScope = 'local' | 'global'

import type { CustomFieldDefinition } from './custom_field.js'
export type { CustomFieldDefinition }

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
   * Optional category for grouping modules in the UI
   */
  category?: string

  /**
   * Icon identifier (for admin UI)
   */
  icon?: string

  /**
   * Which scopes this module supports
   */
  allowedScopes: ModuleScope[]

  /**
   * Whether this module can be locked in module groups
   */
  lockable: boolean

  /**
   * Definitions for module custom fields
   */
  fieldSchema?: CustomFieldDefinition[]

  /**
   * Default values for new instances
   */
  defaultValues?: Record<string, any>

  /**
   * Which post types can use this module (empty = all)
   */
  allowedPostTypes?: string[]

  /**
   * Optional, structured guidance for AI agents and humans.
   *
   * This is intended to answer:
   * - when is this module appropriate?
   * - when should it be avoided?
   * - what role does it play in a page layout?
   *
   * The MCP server will expose this as part of module schema/config responses.
   */
  aiGuidance?: {
    /**
     * Short bullets describing when to use this module.
     */
    useWhen: string[]
    /**
     * Short bullets describing when not to use this module.
     */
    avoidWhen?: string[]
    /**
     * High-level layout roles this module can fulfill (e.g. "hero", "body", "gallery", "cta").
     */
    layoutRoles?: string[]
    /**
     * Keywords that should trigger this module/role during role inference from a brief.
     */
    keywords?: string[]
    /**
     * Composition notes (how to pair with other modules, recommended ordering, etc.).
     */
    compositionNotes?: string
  }
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
  fields: Record<string, any>
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
  fields: Record<string, any> // Base fields + overrides merged
  locked: boolean
  orderIndex: number
}
