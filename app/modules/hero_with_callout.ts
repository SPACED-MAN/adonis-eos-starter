import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

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
          slug: 'title',
          type: 'text',
          required: true,
          description: 'Main heading text',
          translatable: true,
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
            fields: [
              {
                slug: 'label',
                type: 'text',
                required: true,
                translatable: true,
                description: 'Button text',
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
        backgroundColorField,
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
        backgroundColor: 'bg-backdrop-low',
      },
      allowedPostTypes: [],
    }
  }
}
