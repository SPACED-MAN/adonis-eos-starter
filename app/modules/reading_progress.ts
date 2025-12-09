import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class ReadingProgressModule extends BaseModule {
  /**
   * Reading progress is an interactive, client-side module that hooks into
   * scroll/resize events, so it must be rendered as a React module.
   */
  getRenderingMode() {
    return 'react' as const
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
