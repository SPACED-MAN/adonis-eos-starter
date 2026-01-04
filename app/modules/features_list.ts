import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, LIPSUM_TITLE, LIPSUM_SUBTITLE, LIPSUM_PARAGRAPH } from './shared_fields.js'

export default class FeaturesListModule extends BaseModule {
  /**
   * Features list can be hybrid to support staggered item animations
   * when interactivity is enabled.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'features-list',
      name: 'Features List',
      description:
        'Grid of up to 24 features with an icon, short title, and supporting body copy, using neutral project tokens.',
      icon: 'list-ul',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['features', 'body', 'content'],
        keywords: ['features', 'list', 'grid', 'capabilities'],
        useWhen: [
          'You have a large number of short features to list (up to 24).',
          'You want a compact grid representation of product capabilities.',
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
          required: true,
          description: 'Section heading shown above the features grid',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          required: false,
          description: 'Short paragraph explaining the section',
          translatable: true,
        },
        {
          slug: 'features',
          type: 'repeater',
          required: true,
          description: 'List of feature items (up to 24)',
          item: {
            slug: 'item',
            type: 'object',
            fields: [
              {
                slug: 'icon',
                type: 'icon',
                required: false,
                description: 'Fort Awesome icon from the registered icon library',
              },
              {
                slug: 'title',
                type: 'text',
                required: true,
                description: 'Short feature title',
                translatable: true,
                isLabel: true,
              },
              {
                slug: 'body',
                type: 'textarea',
                required: true,
                description: 'Short feature description',
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
        themeField,
        ...mediaBackgroundFields,
      ],
      defaultValues: {
        title: LIPSUM_TITLE,
        subtitle: LIPSUM_SUBTITLE,
        features: [
          {
            icon: 'bullhorn',
            title: 'LIPSUM 1',
            body: LIPSUM_PARAGRAPH.substring(0, 100),
          },
          {
            icon: 'scale-balanced',
            title: 'LIPSUM 2',
            body: LIPSUM_PARAGRAPH.substring(0, 100),
          },
          {
            icon: 'gear',
            title: 'LIPSUM 3',
            body: LIPSUM_PARAGRAPH.substring(0, 100),
          },
        ],
        theme: 'low',
      },
      allowedPostTypes: [],
    }
  }
}
