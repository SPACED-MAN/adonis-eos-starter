import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class BlockquoteModule extends BaseModule {
  getConfig(): ModuleConfig {
    return {
      type: 'blockquote',
      name: 'Blockquote',
      description:
        'A single, centered testimonial-style blockquote with quote text, author name, and author title.',
      icon: 'quote-left',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        quote: {
          type: 'textarea',
          required: true,
          description: 'Quoted testimonial text shown in the blockquote',
          translatable: true,
        },
        authorName: {
          type: 'string',
          required: true,
          description: 'Name of the person quoted',
          translatable: true,
        },
        authorTitle: {
          type: 'string',
          required: false,
          description: 'Role or organization for the person quoted',
          translatable: true,
        },
        avatar: {
          type: 'media',
          label: 'Avatar',
          accept: 'image/*',
          storeAs: 'id',
          required: false,
          description: 'Optional avatar image for the quoted person (stored as media ID)',
        },
        backgroundColor: {
          type: 'string',
          required: false,
          description: 'Optional background utility class for the section',
        },
      },
      defaultProps: {
        quote:
          'Flowbite is just awesome. It contains tons of predesigned components and pages starting from login screen to complex dashboard. Perfect choice for your next SaaS application.',
        authorName: 'Michael Gough',
        authorTitle: 'CEO at Google',
        avatar: null,
        backgroundColor: 'bg-backdrop-low',
      },
      // Available for all post types by default
      allowedPostTypes: [],
    }
  }
}
