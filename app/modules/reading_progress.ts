import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class ReadingProgressModule extends BaseModule {
  /**
   * Reading progress is now a static module.
   */
  getRenderingMode() {
    return 'static' as const
  }

  public getConfig(): ModuleConfig {
    return {
      type: 'reading-progress',
      name: 'Reading Progress',
      description: 'A progress bar that tracks reading progress as the user scrolls',
      category: 'interactive',
      allowedScopes: ['local', 'global'],
      allowedPostTypes: ['page', 'blog', 'documentation'],
      lockable: false,
    }
  }
}
