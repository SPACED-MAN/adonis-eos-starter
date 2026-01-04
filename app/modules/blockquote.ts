import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, LIPSUM_PARAGRAPH, LIPSUM_TITLE } from './shared_fields.js'

export default class BlockquoteModule extends BaseModule {
  /**
   * Blockquote supports hybrid rendering for entrance animations.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'blockquote',
      name: 'Blockquote',
      description:
        'A single, centered testimonial-style blockquote with quote text, author name, and author title.',
      icon: 'quote-left',
      allowedScopes: ['local', 'global'],
      lockable: true,
      fieldSchema: [
        {
          slug: 'content_tab',
          type: 'tab',
          label: 'Content',
        },
        {
          slug: 'quote',
          type: 'textarea',
          required: true,
          description: 'Quoted testimonial text shown in the blockquote',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'authorName',
          type: 'text',
          required: true,
          description: 'Name of the person quoted',
          translatable: true,
        },
        {
          slug: 'authorTitle',
          type: 'text',
          required: false,
          description: 'Role or organization for the person quoted',
          translatable: true,
        },
        {
          slug: 'avatar',
          type: 'media',
          label: 'Avatar',
          accept: 'image/*',
          config: { storeAs: 'id' },
          required: false,
          description: 'Optional avatar image for the quoted person (stored as media ID)',
        },
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        themeField,
        ...mediaBackgroundFields,
      ],
      defaultValues: {
        quote: LIPSUM_PARAGRAPH,
        authorName: LIPSUM_TITLE,
        authorTitle: 'CEO at Lorem Ipsum',
        avatar: null,
        theme: 'low',
      },
      // Available for all post types by default
      allowedPostTypes: [],
    }
  }
}
