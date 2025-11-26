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
      name: 'Rich Text (Prose)',
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
        maxWidth: {
          type: 'string',
          default: 'max-w-4xl',
          description: 'Tailwind max-width class',
        },
        fontSize: {
          type: 'string',
          default: 'text-base',
          description: 'Tailwind text size class',
        },
        backgroundColor: {
          type: 'string',
          default: 'bg-transparent',
          description: 'Tailwind background color classes',
        },
        textColor: {
          type: 'string',
          default: 'text-neutral-high',
          description: 'Tailwind text color classes',
        },
        padding: {
          type: 'string',
          default: 'py-12',
          description: 'Tailwind padding classes',
        },
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
        maxWidth: 'max-w-4xl',
        fontSize: 'text-base',
        backgroundColor: 'bg-transparent',
        textColor: 'text-neutral-high',
        padding: 'py-12',
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
