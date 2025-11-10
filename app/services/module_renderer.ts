import type { ModuleRenderContext } from '#types/module_types'
import moduleRegistry from '#services/module_registry'
import db from '@adonisjs/lucid/services/db'

/**
 * Rendered page result
 */
export interface RenderedPage {
  /**
   * Combined HTML from all modules
   */
  html: string

  /**
   * Combined JSON-LD from all modules
   */
  jsonLd: Array<Record<string, any>>

  /**
   * List of cache tags for invalidation
   */
  cacheTags: string[]
}

/**
 * Module Renderer Service
 *
 * Orchestrates the rendering pipeline for posts with modules.
 * Handles props merging, locale context, and SSR for all modules.
 */
class ModuleRenderer {
  /**
   * Render all modules for a post
   *
   * @param postId - Post ID to render
   * @param locale - Current locale for i18n
   * @param options - Additional rendering options
   * @returns Rendered page with HTML and JSON-LD
   */
  async renderPost(
    postId: string,
    locale: string = 'en',
    options: {
      postType?: string
      isPreview?: boolean
    } = {}
  ): Promise<RenderedPage> {
    // Load post modules with their instances
    const postModules = await this.loadPostModules(postId)

    // If no modules, return empty
    if (postModules.length === 0) {
      return {
        html: '',
        jsonLd: [],
        cacheTags: [`post:${postId}`],
      }
    }

    // Prepare rendering context
    const context: ModuleRenderContext = {
      locale,
      postType: options.postType || 'default',
      isPreview: options.isPreview || false,
      meta: {
        postId,
      },
    }

    // Render each module
    const rendered = await Promise.all(
      postModules.map((pm) => this.renderModule(pm, context))
    )

    // Combine HTML
    const html = rendered.map((r) => r.html).join('\n')

    // Combine JSON-LD (filter out undefined)
    const jsonLd = rendered
      .map((r) => r.jsonLd)
      .filter((jld): jld is Record<string, any> => jld !== undefined)

    // Combine cache tags
    const cacheTags = [
      `post:${postId}`,
      ...rendered.flatMap((r) => r.cacheTags || []),
    ]

    return {
      html,
      jsonLd,
      cacheTags: [...new Set(cacheTags)], // Remove duplicates
    }
  }

  /**
   * Render a single module
   *
   * @param postModule - Post module data from database
   * @param context - Rendering context
   * @returns Rendered module result
   */
  private async renderModule(
    postModule: {
      moduleId: string
      type: string
      scope: 'local' | 'global' | 'static'
      props: Record<string, any>
      overrides: Record<string, any> | null
      locked: boolean
      orderIndex: number
    },
    context: ModuleRenderContext
  ) {
    // Get module from registry
    const module = moduleRegistry.get(postModule.type)

    // Merge base props with overrides
    const mergedProps = module.mergeProps(postModule.props, postModule.overrides)

    // Prepare merged data
    const mergedData = {
      type: postModule.type,
      scope: postModule.scope,
      props: mergedProps,
      locked: postModule.locked,
      orderIndex: postModule.orderIndex,
    }

    // Render the module
    return module.render(mergedData, context)
  }

  /**
   * Load post modules with their instances
   *
   * @param postId - Post ID
   * @returns Array of post modules with instance data
   */
  private async loadPostModules(postId: string) {
    const results = await db
      .from('post_modules')
      .join('module_instances', 'post_modules.module_id', 'module_instances.id')
      .where('post_modules.post_id', postId)
      .select(
        'post_modules.id as postModuleId',
        'post_modules.module_id as moduleId',
        'post_modules.order_index as orderIndex',
        'post_modules.overrides',
        'post_modules.locked',
        'module_instances.type',
        'module_instances.scope',
        'module_instances.props',
        'module_instances.global_slug as globalSlug'
      )
      .orderBy('post_modules.order_index', 'asc')

    return results.map((row) => ({
      postModuleId: row.postModuleId,
      moduleId: row.moduleId,
      type: row.type,
      scope: row.scope,
      props: row.props || {},
      overrides: row.overrides || null,
      locked: row.locked,
      orderIndex: row.orderIndex,
      globalSlug: row.globalSlug,
    }))
  }

  /**
   * Render a global module by slug
   *
   * Useful for rendering global modules independently (e.g., headers, footers).
   *
   * @param globalSlug - Global module slug
   * @param locale - Current locale
   * @param options - Additional options
   * @returns Rendered module HTML
   */
  async renderGlobalModule(
    globalSlug: string,
    locale: string = 'en',
    options: {
      postType?: string
      overrides?: Record<string, any>
    } = {}
  ): Promise<string> {
    // Load global module instance
    const instance = await db
      .from('module_instances')
      .where('scope', 'global')
      .where('global_slug', globalSlug)
      .first()

    if (!instance) {
      throw new Error(`Global module '${globalSlug}' not found`)
    }

    // Get module from registry
    const module = moduleRegistry.get(instance.type)

    // Merge props with overrides if provided
    const mergedProps = options.overrides
      ? module.mergeProps(instance.props || {}, options.overrides)
      : instance.props || {}

    // Prepare context
    const context: ModuleRenderContext = {
      locale,
      postType: options.postType || 'default',
      isPreview: false,
      meta: {
        globalSlug,
      },
    }

    // Prepare merged data
    const mergedData = {
      type: instance.type,
      scope: 'global' as const,
      props: mergedProps,
      locked: false,
      orderIndex: 0,
    }

    // Render and return HTML only
    const result = await module.render(mergedData, context)
    return result.html
  }
}

// Export singleton instance
const moduleRenderer = new ModuleRenderer()
export default moduleRenderer

