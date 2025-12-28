import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

export default class AccordionModule extends BaseModule {
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'accordions',
      name: 'Accordions',
      description: 'A list of collapsible content items.',
      icon: 'chevron-down',
      allowedScopes: ['local', 'global'],
      lockable: true,
      fieldSchema: [
        {
          slug: 'title',
          type: 'text',
          label: 'Heading',
          required: false,
          translatable: true,
        },
        {
          slug: 'subtitle',
          type: 'text',
          label: 'Subtitle',
          required: false,
          translatable: true,
        },
        {
          slug: 'items',
          type: 'repeater',
          required: true,
          description: 'Accordion items',
          item: {
            slug: 'item',
            type: 'object',
            fields: [
              {
                slug: 'title',
                type: 'text',
                required: true,
                description: 'Item title',
                translatable: true,
              },
              {
                slug: 'content',
                type: 'richtext',
                required: true,
                description: 'Item content',
                translatable: true,
              },
            ],
          },
        },
        {
          slug: 'allowMultiple',
          label: 'Allow Multiple Open',
          type: 'boolean',
          required: false,
          description: 'Whether multiple items can be open at the same time',
        },
        backgroundColorField,
      ],
      defaultValues: {
        title: '',
        subtitle: '',
        items: [
          {
            title: 'How do I use this?',
            content: '<p>Simply click the title to expand the content.</p>',
          },
        ],
        allowMultiple: false,
        backgroundColor: 'bg-transparent',
      },
      allowedPostTypes: [],
    }
  }
}
