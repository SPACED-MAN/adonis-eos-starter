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
      propsSchema: {
        type: 'object',
        properties: {
          position: {
            type: 'string',
            enum: ['top', 'bottom'],
            label: 'Position',
            description: 'Where to display the progress bar',
            default: 'top',
          },
          height: {
            type: 'number',
            label: 'Height (px)',
            description: 'Height of the progress bar in pixels',
            default: 4,
            minimum: 1,
            maximum: 20,
          },
          zIndex: {
            type: 'number',
            label: 'Z-Index',
            description: 'Stacking order (higher values appear on top)',
            default: 50,
            minimum: 0,
            maximum: 100,
          },
        },
      },
      defaultProps: {
        position: 'top',
        height: 4,
        zIndex: 50,
      },
    }
  }
}


