import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

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
          slug: 'title',
          type: 'text',
          required: true,
          description: 'Section heading shown above the pricing grid',
          translatable: true,
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
                },
              },
              {
                slug: 'primary',
                type: 'boolean',
                required: false,
                description: 'Highlights this plan as primary (slightly stronger visual emphasis)',
              },
              {
                slug: 'ctaLabel',
                type: 'text',
                required: false,
                description: 'Label for the call-to-action button',
                translatable: true,
              },
              {
                slug: 'ctaUrl',
                type: 'link',
                required: false,
                description: 'Destination for the call-to-action button',
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
        plans: [
          {
            name: 'Starter',
            description: 'Best option for personal use & for your next project.',
            price: '29',
            period: '/month',
            features: [
              'Individual configuration',
              'No setup, or hidden fees',
              'Team size: 1 developer',
              'Premium support: 6 months',
              'Free updates: 6 months',
            ],
            primary: false,
            ctaLabel: 'Get started',
          },
          {
            name: 'Company',
            description: 'Relevant for multiple users, extended & premium support.',
            price: '99',
            period: '/month',
            features: [
              'Individual configuration',
              'No setup, or hidden fees',
              'Team size: 10 developers',
              'Premium support: 24 months',
              'Free updates: 24 months',
            ],
            primary: true,
            ctaLabel: 'Get started',
          },
          {
            name: 'Enterprise',
            description: 'Best for large scale uses and extended redistribution rights.',
            price: '499',
            period: '/month',
            features: [
              'Individual configuration',
              'No setup, or hidden fees',
              'Team size: 100+ developers',
              'Premium support: 36 months',
              'Free updates: 36 months',
            ],
            primary: false,
            ctaLabel: 'Get started',
          },
        ],
        backgroundColor: 'bg-backdrop-low',
      },
      allowedPostTypes: [],
    }
  }
}
