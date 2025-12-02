import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class PricingModule extends BaseModule {
  getConfig(): ModuleConfig {
    return {
      type: 'pricing',
      name: 'Pricing',
      description:
        'Three-column pricing table with a section heading, supporting copy, and configurable plans.',
      icon: 'tags',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        title: {
          type: 'string',
          required: true,
          description: 'Section heading shown above the pricing grid',
          translatable: true,
        },
        subtitle: {
          type: 'textarea',
          required: false,
          description: 'Short paragraph explaining the pricing section',
          translatable: true,
        },
        plans: {
          type: 'array',
          required: true,
          description: 'List of pricing plans (up to 3)',
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                required: true,
                description: 'Plan name (e.g., Starter, Company, Enterprise)',
                translatable: true,
              },
              description: {
                type: 'textarea',
                required: false,
                description: 'Short description of who this plan is for',
                translatable: true,
              },
              price: {
                type: 'string',
                required: true,
                description: 'Price amount (e.g., 29, 99, 499)',
              },
              period: {
                type: 'string',
                required: false,
                description: 'Billing period label (e.g., /month)',
                default: '/month',
              },
              features: {
                type: 'array',
                required: false,
                description: 'List of feature bullets for this plan',
                maxItems: 12,
                items: {
                  type: 'string',
                  required: true,
                  translatable: true,
                },
              },
              primary: {
                type: 'boolean',
                required: false,
                description: 'Highlights this plan as primary (slightly stronger visual emphasis)',
              },
              ctaLabel: {
                type: 'string',
                required: false,
                description: 'Label for the call-to-action button',
                translatable: true,
                default: 'Get started',
              },
              ctaUrl: {
                type: 'link',
                required: false,
                description: 'Destination for the call-to-action button',
              },
            },
          },
        },
      },
      defaultProps: {
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
      },
      allowedPostTypes: [],
    }
  }
}


