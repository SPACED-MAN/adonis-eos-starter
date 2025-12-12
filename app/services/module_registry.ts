import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

/**
 * Module Registry Service
 *
 * Central registry for all available modules in the system.
 * Provides methods to register, retrieve, and list modules.
 */
class ModuleRegistry {
  private modules: Map<string, BaseModule> = new Map()

  /**
   * Register a module with the registry
   *
   * @param module - Module instance to register
   * @throws Error if module type is already registered
   */
  register(module: BaseModule): void {
    const config = module.getConfig()

    if (this.modules.has(config.type)) {
      throw new Error(`Module type '${config.type}' is already registered`)
    }

    this.modules.set(config.type, module)
  }

  /**
   * Get a module by its type
   *
   * @param type - Module type (e.g., 'hero', 'prose')
   * @returns Module instance
   * @throws Error if module type is not found
   */
  get(type: string): BaseModule {
    const module = this.modules.get(type)

    if (!module) {
      throw new Error(`Module type '${type}' is not registered`)
    }

    return module
  }

  /**
   * Check if a module type is registered
   *
   * @param type - Module type to check
   * @returns True if registered
   */
  has(type: string): boolean {
    return this.modules.has(type)
  }

  /**
   * Get all registered module types
   *
   * @returns Array of module type strings
   */
  getTypes(): string[] {
    return Array.from(this.modules.keys())
  }

  /**
   * Get all module configurations
   *
   * Useful for generating API responses and admin UI.
   *
   * Note: We enrich the raw ModuleConfig with the module's renderingMode so
   * frontends can distinguish static vs React modules without additional
   * requests.
   *
   * @returns Array of module configurations
   */
  getAllConfigs(): Array<ModuleConfig & { renderingMode: 'static' | 'react' }> {
    return Array.from(this.modules.values()).map((module) => {
      const config = module.getConfig()
      const renderingMode =
        // Older modules may not implement getRenderingMode; default to 'static'
        (module as any).getRenderingMode?.() ?? 'static'

      return {
        ...config,
        renderingMode,
      }
    })
  }

  /**
   * Get modules allowed for a specific post type
   *
   * @param postType - Post type to filter by
   * @returns Array of module configurations
   */
  getModulesForPostType(postType: string): ModuleConfig[] {
    return this.getAllConfigs().filter((config) => {
      // If allowedPostTypes is empty or undefined, module is available for all
      if (!config.allowedPostTypes || config.allowedPostTypes.length === 0) {
        return true
      }

      return config.allowedPostTypes.includes(postType)
    })
  }

  /**
   * Get module schema for API/validation
   *
   * Returns a simplified schema suitable for API responses.
   *
   * @param type - Module type
   * @returns Module schema object
   */
  getSchema(type: string): {
    type: string
    name: string
    description: string
    icon?: string
    allowedScopes: string[]
    lockable: boolean
    propsSchema: Record<string, any>
    defaultProps: Record<string, any>
    allowedPostTypes?: string[]
    aiGuidance?: {
      useWhen: string[]
      avoidWhen?: string[]
      layoutRoles?: string[]
      compositionNotes?: string
    }
  } {
    const module = this.get(type)
    const config = module.getConfig()

    return {
      type: config.type,
      name: config.name,
      description: config.description,
      icon: config.icon,
      allowedScopes: config.allowedScopes,
      lockable: config.lockable,
      propsSchema: config.propsSchema || {},
      defaultProps: config.defaultProps || {},
      allowedPostTypes: config.allowedPostTypes,
      aiGuidance: (config as any).aiGuidance,
    }
  }

  /**
   * Get all module schemas
   *
   * @returns Array of module schema objects
   */
  getAllSchemas(): Array<ReturnType<typeof this.getSchema>> {
    return this.getTypes().map((type) => this.getSchema(type))
  }

  /**
   * Clear all registered modules (mainly for testing)
   */
  clear(): void {
    this.modules.clear()
  }

  /**
   * Get count of registered modules
   */
  count(): number {
    return this.modules.size
  }
}

// Export singleton instance
const moduleRegistry = new ModuleRegistry()
export default moduleRegistry
