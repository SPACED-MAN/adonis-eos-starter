import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields } from './shared_fields.js'

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
        title: 'Lorem ipsum dolor sit amet',
        subtitle:
          'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        features: [
          {
            icon: 'bullhorn',
            title: 'Consectetur',
            body: 'Plan it, create it, launch it. Collaborate seamlessly across the organization.',
          },
          {
            icon: 'scale-balanced',
            title: 'Adipiscing',
            body: 'Protect your organization and stay compliant with structured workflows.',
          },
          {
            icon: 'gear',
            title: 'Elit sed',
            body: 'Automate handoffs, notifications, and approvals so your team can focus.',
          },
          {
            icon: 'coins',
            title: 'Tempor',
            body: 'Audit‑ready workflows for close, forecasting, and quarterly budgeting.',
          },
          {
            icon: 'pen-ruler',
            title: 'Incididunt',
            body: 'Craft consistent experiences for both marketing and product with shared systems.',
          },
          {
            icon: 'diagram-project',
            title: 'Labore',
            body: 'Keep the business running smoothly with repeatable, measurable processes.',
          },
        ],
        theme: 'low',
      },
      allowedPostTypes: [],
    }
  }
}
