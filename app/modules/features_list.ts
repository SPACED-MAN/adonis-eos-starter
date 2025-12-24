import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

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
      fieldSchema: [
        {
          slug: 'title',
          type: 'text',
          required: true,
          description: 'Section heading shown above the features grid',
          translatable: true,
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
        backgroundColorField,
      ],
      defaultValues: {
        title: 'Designed for business teams like yours',
        subtitle:
          'We focus on markets where technology, innovation, and capital can unlock long-term value and drive economic growth.',
        features: [
          {
            icon: 'bullhorn',
            title: 'Marketing',
            body: 'Plan it, create it, launch it. Collaborate seamlessly across the organization and hit your marketing goals every month.',
          },
          {
            icon: 'scale-balanced',
            title: 'Legal',
            body: 'Protect your organization and stay compliant with structured workflows and granular permissions.',
          },
          {
            icon: 'gear',
            title: 'Business Automation',
            body: 'Automate handoffs, notifications, and approvals so your team can focus on high‑value work.',
          },
          {
            icon: 'coins',
            title: 'Finance',
            body: 'Audit‑ready workflows for close, forecasting, and quarterly budgeting.',
          },
          {
            icon: 'pen-ruler',
            title: 'Enterprise Design',
            body: 'Craft consistent experiences for both marketing and product with shared systems.',
          },
          {
            icon: 'diagram-project',
            title: 'Operations',
            body: 'Keep the business running smoothly with repeatable, measurable processes.',
          },
        ],
        backgroundColor: 'bg-backdrop-low',
      },
      allowedPostTypes: [],
    }
  }
}
