import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, LIPSUM_TITLE, LIPSUM_SUBTITLE, LIPSUM_PARAGRAPH } from './shared_fields.js'

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
      aiGuidance: {
        layoutRoles: ['faq', 'accordions', 'body'],
        keywords: ['faq', 'questions', 'accordions', 'collapsible'],
        useWhen: [
          'You have a list of frequently asked questions.',
          'You want to present content in a collapsible format to save space.',
          'You have detailed information that only some users will need to see.',
        ],
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
          label: 'Heading',
          required: false,
          translatable: true,
          isLabel: true,
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
                isLabel: true,
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
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        {
          slug: 'allowMultiple',
          label: 'Allow Multiple Open',
          type: 'boolean',
          required: false,
          description: 'Whether multiple items can be open at the same time',
        },
        themeField,
        ...mediaBackgroundFields,
      ],
      defaultValues: {
        title: LIPSUM_TITLE,
        subtitle: LIPSUM_SUBTITLE,
        items: [
          {
            title: LIPSUM_TITLE + '?',
            content: `<p>${LIPSUM_PARAGRAPH}</p>`,
          },
        ],
        allowMultiple: false,
        theme: 'transparent',
      },
      allowedPostTypes: [],
    }
  }
}
