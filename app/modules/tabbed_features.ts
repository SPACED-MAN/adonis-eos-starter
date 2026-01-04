import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, mediaFitField, LIPSUM_CTA, LIPSUM_PARAGRAPH } from './shared_fields.js'

export default class TabbedFeaturesModule extends BaseModule {
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'tabbed-features',
      name: 'Tabbed Features',
      description: 'Switch between content sections using tabs.',
      icon: 'table-columns',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['body', 'content', 'features'],
        keywords: ['tabs', 'tabbed', 'features', 'comparison', 'tabbed features'],
        useWhen: [
          'You have multiple related categories of information to present.',
          'You want to save vertical space by grouping content into tabs.',
          'You want to show feature comparisons or different aspects of a product.',
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
                isLabel: true,
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
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
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
        mediaFitField,
        themeField,
        ...mediaBackgroundFields,
      ],
      defaultValues: {
        tabs: [
          {
            label: LIPSUM_CTA + ' 1',
            prose: {
              root: {
                type: 'root',
                children: [
                  {
                    type: 'paragraph',
                    children: [
                      {
                        type: 'text',
                        text: LIPSUM_PARAGRAPH,
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            label: LIPSUM_CTA + ' 2',
            prose: {
              root: {
                type: 'root',
                children: [
                  {
                    type: 'paragraph',
                    children: [
                      {
                        type: 'text',
                        text: LIPSUM_PARAGRAPH,
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
        layout: 'top',
        objectFit: 'contain',
        theme: 'transparent',
      },
      allowedPostTypes: [],
    }
  }
}

