import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

/**
 * Breadcrumb Module
 *
 * Displays hierarchical navigation path showing the current page's position
 * in the site structure. Automatically builds breadcrumb trail from post hierarchy.
 *
 * Best used with hierarchical post types (e.g., documentation, pages).
 */
export default class BreadcrumbModule extends BaseModule {
  /**
   * Rendering mode: React (SSR + hydration)
   */
  getRenderingMode() {
    return 'react' as const
  }

  /**
   * Get module configuration
   */
  getConfig(): ModuleConfig {
    return {
      type: 'breadcrumb',
      name: 'Breadcrumb',
      description: 'Hierarchical navigation trail showing the current page position',
      icon: 'arrow-right',
      allowedScopes: ['local', 'global'],
      lockable: true,
      fieldSchema: [],
      defaultValues: {},
      allowedPostTypes: [], // Available for all post types
    }
  }
}
