import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields } from './shared_fields.js'

export default class HeroWithCalloutModule extends BaseModule {
  /**
   * Hero with callout supports hybrid rendering for entrance animations.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'hero-with-callout',
      name: 'Hero with Callouts',
      description: 'Centered hero with headline, body copy, and call-to-action buttons.',
      icon: 'megaphone',
      allowedScopes: ['local', 'global'],
      lockable: true,
      fieldSchema: [
        {
          slug: 'content_tab',
          type: 'tab',
          label: 'Content',
        },
        {
          slug: 'title',
          type: 'text',
          required: true,
          description: 'Main heading text',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          required: false,
          description: 'Supporting text below the title',
          translatable: true,
        },
        {
          slug: 'callouts',
          type: 'repeater',
          required: false,
          description: 'Call-to-action buttons',
          item: {
            slug: 'item',
            type: 'object',
            label: 'Button',
            fields: [
              {
                slug: 'label',
                type: 'text',
                required: true,
                translatable: true,
                description: 'Button text',
                isLabel: true,
              },
              {
                slug: 'url',
                type: 'link',
                required: true,
                description: 'Button destination',
              },
            ],
          },
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
        title: "We invest in the world's potential",
        subtitle:
          'We focus on markets where technology, innovation, and capital can unlock long-term value and drive durable growth.',
        callouts: [
          {
            label: 'Learn more',
            url: '#',
          },
        ],
        theme: 'low',
      },
      allowedPostTypes: [],
    }
  }
}
