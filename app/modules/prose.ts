import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields } from './shared_fields.js'

/**
 * Prose Module
 *
 * Rich text content module using Lexical editor.
 * Content is stored as Lexical JSON and rendered to HTML server-side.
 */
export default class ProseModule extends BaseModule {
  /**
   * Prose modules can be hybrid to support optional animations
   * (e.g. fade-in on scroll) via Framer Motion.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  /**
   * Get module configuration
   */
  getConfig(): ModuleConfig {
    return {
      type: 'prose',
      name: 'Prose',
      description:
        'Primary rich text content module. Use this for the main body copy of a page. EXPECTATION: Provide a substantial amount of content (multiple paragraphs, headings, and lists) to ensure a high-quality user experience.',
      icon: 'text-paragraph',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['body', 'content', 'text'],
        keywords: ['content', 'prose', 'body', 'text', 'article'],
        useWhen: [
          'You need primary page content (headings, paragraphs, lists, links).',
          'You need a flexible section for editorial writing or documentation-style content.',
        ],
        avoidWhen: [
          'You need a structured layout (columns/cards/pricing); use a dedicated module instead.',
          'You need interactive behavior; prefer a React module designed for interaction.',
        ],
        compositionNotes:
          'Commonly used after a hero. Pair with media modules (prose-with-media, gallery) or CTA modules to break up long text.',
      },
      fieldSchema: [
        {
          slug: 'content_tab',
          type: 'tab',
          label: 'Content',
        },
        {
          slug: 'title',
          type: 'text',
          label: 'Title',
          required: false,
          description: 'Optional section heading',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'content',
          type: 'richtext', // Lexical JSON rich text editor
          required: true,
          description: 'Rich text content (Lexical JSON)',
          translatable: true,
        },
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        {
          slug: 'textAlign',
          type: 'select',
          label: 'Text Alignment',
          required: false,
          description: 'Align text within the prose content',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
            { label: 'Justify', value: 'justify' },
          ],
        },
        themeField,
        ...mediaBackgroundFields,
        // Note: Other visual classes (font size, colors, padding) remain fixed in code for consistency.
      ],
      defaultValues: {
        title: '',
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
        textAlign: 'left',
        theme: 'transparent',
      },
      allowedPostTypes: [], // Available for all post types
    }
  }

  /**
   * Validate that content is valid Lexical JSON
   */
  validate(fields: Record<string, any>): boolean {
    // Call parent validation
    super.validate(fields)

    // Check that content has the root structure
    if (!fields.content || typeof fields.content !== 'object') {
      throw new Error('Content must be a valid Lexical JSON object')
    }

    if (!fields.content.root || typeof fields.content.root !== 'object') {
      throw new Error('Content must have a root node')
    }

    return true
  }
}
