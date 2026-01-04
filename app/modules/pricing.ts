import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, LIPSUM_TITLE, LIPSUM_SUBTITLE, LIPSUM_CTA } from './shared_fields.js'

export default class PricingModule extends BaseModule {
  /**
   * Pricing can be hybrid to support staggered plan animations
   * when interactivity is enabled.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'pricing',
      name: 'Pricing',
      description:
        'Three-column pricing table with a section heading, supporting copy, and configurable plans.',
      icon: 'tags',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['pricing', 'plans', 'conversion'],
        keywords: ['pricing', 'plans', 'cost', 'subscription', 'price'],
        useWhen: [
          'You need to present different service tiers or product options.',
          'The goal is to drive the user toward a specific subscription plan.',
        ],
        avoidWhen: [
          'You only have a single price point; use a callout or simple prose instead.',
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
          description: 'Section heading shown above the pricing grid',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          required: false,
          description: 'Short paragraph explaining the pricing section',
          translatable: true,
        },
        {
          slug: 'plans',
          type: 'repeater',
          required: true,
          description: 'List of pricing plans (up to 3)',
          item: {
            slug: 'item',
            type: 'object',
            fields: [
              {
                slug: 'name',
                type: 'text',
                required: true,
                description: 'Plan name (e.g., Starter, Company, Enterprise)',
                translatable: true,
                isLabel: true,
              },
              {
                slug: 'description',
                type: 'textarea',
                required: false,
                description: 'Short description of who this plan is for',
                translatable: true,
              },
              {
                slug: 'price',
                type: 'text',
                required: true,
                description: 'Price amount (e.g., 29, 99, 499)',
              },
              {
                slug: 'period',
                type: 'text',
                required: false,
                description: 'Billing period label (e.g., /month)',
              },
              {
                slug: 'features',
                type: 'repeater',
                required: false,
                description: 'List of feature bullets for this plan',
                item: {
                  slug: 'feature',
                  type: 'text',
                  required: true,
                  translatable: true,
                  isLabel: true,
                },
              },
              {
                slug: 'primary',
                type: 'boolean',
                required: false,
                description: 'Highlights this plan as primary (slightly stronger visual emphasis)',
              },
              {
                slug: 'ctas',
                type: 'repeater',
                label: 'Buttons',
                description: 'Call-to-action buttons for this plan',
                item: {
                  slug: 'cta',
                  type: 'object',
                  label: 'Button',
                  fields: [
                    {
                      slug: 'label',
                      type: 'text',
                      label: 'Label',
                      translatable: true,
                      isLabel: true,
                    },
                    {
                      slug: 'url',
                      type: 'link',
                      label: 'Destination',
                    },
                    {
                      slug: 'style',
                      type: 'select',
                      label: 'Style',
                      options: [
                        { label: 'Primary', value: 'primary' },
                        { label: 'Secondary', value: 'secondary' },
                        { label: 'Outline', value: 'outline' },
                      ],
                    },
                  ],
                },
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
        plans: [
          {
            name: 'Lorem',
            description: LIPSUM_SUBTITLE,
            price: '29',
            period: '/month',
            features: [
              'Feature 1',
              'Feature 2',
              'Feature 3',
            ],
            primary: false,
            ctas: [
              {
                label: LIPSUM_CTA,
                url: '#',
                style: 'primary',
              },
            ],
          },
          {
            name: 'Ipsum',
            description: LIPSUM_SUBTITLE,
            price: '99',
            period: '/month',
            features: [
              'Feature 1',
              'Feature 2',
              'Feature 3',
            ],
            primary: true,
            ctas: [
              {
                label: LIPSUM_CTA,
                url: '#',
                style: 'primary',
              },
            ],
          },
        ],
        theme: 'low',
      },
      allowedPostTypes: [],
    }
  }
}
