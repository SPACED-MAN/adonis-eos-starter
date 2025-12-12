import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

/**
 * Blog Note Module
 *
 * A simple, blog-specific module that renders a single text field.
 */
export default class BlogNoteModule extends BaseModule {
  getRenderingMode() {
    return 'static' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'blog-note',
      name: 'Blog Note',
      description: 'A simple text note, only available for blog posts',
      icon: 'note',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        note: {
          type: 'text',
          required: true,
          description: 'Short note text to display',
          translatable: false,
        },
      },
      defaultProps: {
        note: 'This is a blog-specific note.',
      },
      // Restrict to only blog post types
      allowedPostTypes: ['blog'],
    }
  }
}
