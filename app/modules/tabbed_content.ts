import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

export default class TabbedContentModule extends BaseModule {
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'tabbed-content',
      name: 'Tabbed Content',
      description: 'Switch between content sections using tabs.',
      icon: 'table-columns',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['body', 'content', 'features'],
        useWhen: [
          'You have multiple related categories of information to present.',
          'You want to save vertical space by grouping content into tabs.',
          'You want to show feature comparisons or different aspects of a product.',
        ],
      },
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
          slug: 'tabs',
          type: 'repeater',
          label: 'Tabs',
          required: true,
          item: {
            slug: 'tab',
            type: 'object',
            label: 'Tab',
            fields: [
              {
                slug: 'label',
                type: 'text',
                label: 'Tab Label',
                required: true,
                translatable: true,
              },
              {
                slug: 'prose',
                type: 'richtext',
                label: 'Content',
                translatable: true,
              },
              {
                slug: 'image',
                type: 'media',
                label: 'Supporting Media',
                config: { storeAs: 'id' },
              },
            ],
          },
        },
        {
          slug: 'layout',
          type: 'select',
          label: 'Tabs Position',
          options: [
            { label: 'Top', value: 'top' },
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ],
        },
        backgroundColorField,
      ],
      defaultValues: {
        tabs: [
          {
            label: 'Feature One',
            prose: '<p>Content for the first tab goes here.</p>',
          },
          {
            label: 'Feature Two',
            prose: '<p>Content for the second tab goes here.</p>',
          },
        ],
        layout: 'top',
        backgroundColor: 'bg-transparent',
      },
      allowedPostTypes: [],
    }
  }
}

