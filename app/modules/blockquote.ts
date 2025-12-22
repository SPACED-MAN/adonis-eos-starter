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
      fieldSchema: [
        {
          slug: 'quote',
          type: 'textarea',
          required: true,
          description: 'Quoted testimonial text shown in the blockquote',
          translatable: true,
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
          slug: 'backgroundColor',
          type: 'text',
          required: false,
          description: 'Optional background utility class for the section',
        },
      ],
      defaultValues: {
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
