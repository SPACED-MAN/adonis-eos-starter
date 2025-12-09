import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

/**
 * Prose Module
 *
 * Rich text content module using Lexical editor.
 * Content is stored as Lexical JSON and rendered to HTML server-side.
 */
export default class ProseModule extends BaseModule {
  /**
   * Rendering mode: Static (pure SSR for max performance)
   * Prose is read-only content - no interactivity needed
   */
  getRenderingMode() {
    return 'static' as const
  }

  /**
   * Get module configuration
   */
  getConfig(): ModuleConfig {
    return {
      type: 'prose',
      name: 'Prose',
      description: 'Rich text content with formatting, links, lists, and more',
      icon: 'text-paragraph',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        content: {
          type: 'richtext', // Lexical JSON rich text editor
          required: true,
          description: 'Rich text content (Lexical JSON)',
          translatable: true,
        },
        // Note: Visual classes (max width, font size, colors, padding) are fixed in code;
        // editors do not control Tailwind utilities for this module.
      },
      defaultProps: {
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'Add your content here...',
                  },
                ],
              },
            ],
          },
        },
      },
      allowedPostTypes: [], // Available for all post types
    }
  }

  /**
   * Validate that content is valid Lexical JSON
   */
  validate(props: Record<string, any>): boolean {
    // Call parent validation
    super.validate(props)

    // Check that content has the root structure
    if (!props.content || typeof props.content !== 'object') {
      throw new Error('Content must be a valid Lexical JSON object')
    }

    if (!props.content.root || typeof props.content.root !== 'object') {
      throw new Error('Content must have a root node')
    }

    return true
  }
}
