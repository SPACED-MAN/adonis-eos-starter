import db from '@adonisjs/lucid/services/db'
import moduleRegistry from '#services/module_registry'

/**
 * Module Scope Service
 *
 * Enforces module scoping rules - which modules can be used with which post types.
 * Uses both the module_scopes database table and module configuration.
 */
class ModuleScopeService {
  /**
   * Check if a module type is allowed for a post type
   *
   * A module is allowed if:
   * 1. No restriction exists in module_scopes table (default allow)
   * 2. A restriction exists AND module_type matches post_type
   * 3. Module's allowedPostTypes is empty (available for all) OR includes the post type
   *
   * @param moduleType - Module type (e.g., 'hero', 'prose')
   * @param postType - Post type (e.g., 'blog', 'page')
   * @returns True if allowed
   */
  async isModuleAllowedForPostType(moduleType: string, postType: string): Promise<boolean> {
    // Check module configuration first
    if (!moduleRegistry.has(moduleType)) {
      return false
    }

    const moduleConfig = moduleRegistry.get(moduleType).getConfig()

    // If module has allowedPostTypes defined and it's not empty
    if (moduleConfig.allowedPostTypes && moduleConfig.allowedPostTypes.length > 0) {
      if (!moduleConfig.allowedPostTypes.includes(postType)) {
        return false
      }
    }

    // If there are no scope restrictions for this post type, allow by default
    const [{ total }] = await db.from('module_scopes').where('post_type', postType).count('* as total')
    const restrictionsForPostType = Number(total) > 0
    if (!restrictionsForPostType) {
      return true
    }

    // When restrictions exist for this post type, allow only if an explicit allow record exists
    const restriction = await db
      .from('module_scopes')
      .where('module_type', moduleType)
      .where('post_type', postType)
      .first()

    return restriction !== null
  }

  /**
   * Get all allowed module types for a post type
   *
   * @param postType - Post type to check
   * @returns Array of allowed module type strings
   */
  async getAllowedModulesForPostType(postType: string): Promise<string[]> {
    // Get all registered module types
    const allModuleTypes = moduleRegistry.getTypes()

    // Filter by checking each one
    const allowed: string[] = []
    for (const moduleType of allModuleTypes) {
      const isAllowed = await this.isModuleAllowedForPostType(moduleType, postType)
      if (isAllowed) {
        allowed.push(moduleType)
      }
    }

    return allowed
  }

  /**
   * Get allowed modules with their full configurations for a post type
   *
   * @param postType - Post type to check
   * @returns Array of module configurations
   */
  async getAllowedModuleConfigsForPostType(postType: string) {
    const allowedTypes = await this.getAllowedModulesForPostType(postType)

    return allowedTypes.map((type) => {
      const module = moduleRegistry.get(type)
      return module.getConfig()
    })
  }

  /**
   * Validate module attachment to post
   *
   * Throws error if module cannot be attached to the post type.
   *
   * @param moduleType - Module type to attach
   * @param postType - Post type
   * @throws Error if not allowed
   */
  async validateModuleAttachment(moduleType: string, postType: string): Promise<void> {
    const isAllowed = await this.isModuleAllowedForPostType(moduleType, postType)

    if (!isAllowed) {
      throw new Error(
        `Module type '${moduleType}' is not allowed for post type '${postType}'. ` +
        `Check module configuration or module_scopes table.`
      )
    }
  }

  /**
   * Add a module scope restriction
   *
   * Restricts a module type to a specific post type.
   *
   * @param moduleType - Module type
   * @param postType - Post type
   * @returns Created scope record
   */
  async addModuleScope(moduleType: string, postType: string) {
    // Verify module exists
    if (!moduleRegistry.has(moduleType)) {
      throw new Error(`Module type '${moduleType}' is not registered`)
    }

    // Check if restriction already exists
    const existing = await db
      .from('module_scopes')
      .where('module_type', moduleType)
      .where('post_type', postType)
      .first()

    if (existing) {
      return existing
    }

    // Create restriction
    const [scope] = await db
      .table('module_scopes')
      .insert({
        module_type: moduleType,
        post_type: postType,
      })
      .returning('*')

    return scope
  }

  /**
   * Remove a module scope restriction
   *
   * @param moduleType - Module type
   * @param postType - Post type
   * @returns Number of deleted rows
   */
  async removeModuleScope(moduleType: string, postType: string): Promise<number> {
    return db
      .from('module_scopes')
      .where('module_type', moduleType)
      .where('post_type', postType)
      .delete()
  }

  /**
   * Get all scope restrictions for a module type
   *
   * @param moduleType - Module type
   * @returns Array of post types this module is restricted to
   */
  async getPostTypesForModule(moduleType: string): Promise<string[]> {
    const scopes = await db
      .from('module_scopes')
      .where('module_type', moduleType)
      .select('post_type')

    return scopes.map((s) => s.post_type)
  }

  /**
   * Get all scope restrictions for a post type
   *
   * @param postType - Post type
   * @returns Array of module types allowed for this post type
   */
  async getModuleTypesForPostType(postType: string): Promise<string[]> {
    const scopes = await db
      .from('module_scopes')
      .where('post_type', postType)
      .select('module_type')

    return scopes.map((s) => s.module_type)
  }

  /**
   * Check if any scope restrictions exist
   *
   * @returns True if module_scopes table has any rows
   */
  async hasScopeRestrictions(): Promise<boolean> {
    const count = await db.from('module_scopes').count('* as total')
    return (count[0]?.total || 0) > 0
  }
}

// Export singleton instance
const moduleScopeService = new ModuleScopeService()
export default moduleScopeService

