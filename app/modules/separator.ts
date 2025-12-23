import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

/**
 * Separator Module
 *
 * Simple horizontal rule divider with no custom fields.
 * Pure SSR for maximum performance.
 */
export default class SeparatorModule extends BaseModule {
  /**
   * Rendering mode: Static
   */
  getRenderingMode() {
    return 'static' as const
  }

  /**
   * Get module configuration
   */
  getConfig(): ModuleConfig {
    return {
      type: 'separator',
      name: 'Separator',
      description: 'Horizontal rule divider',
      icon: 'minus',
      allowedScopes: ['local'],
      lockable: false,
      fieldSchema: [],
      defaultValues: {},
      allowedPostTypes: [], // Available for all post types
    }
  }
}
