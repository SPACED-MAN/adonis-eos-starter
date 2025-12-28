import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

export default class StatisticsModule extends BaseModule {
  /**
   * Statistics module can be hybrid to support animated counters
   * when interactivity is enabled.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'statistics',
      name: 'Statistics',
      description: 'Compact grid of key statistics with animated counters.',
      icon: 'chart-donut',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['stats', 'metrics', 'social-proof'],
        keywords: ['stats', 'statistics', 'metrics', 'numbers', 'data'],
        useWhen: [
          'You want to provide visual proof of scale, impact, or performance.',
          'You have impressive numbers that help build trust.',
        ],
      },
      fieldSchema: [
        {
          slug: 'stats',
          type: 'repeater',
          required: true,
          description: 'List of statistics to display (e.g., 73M+ developers).',
          item: {
            slug: 'item',
            type: 'object',
            fields: [
              {
                slug: 'value',
                type: 'number',
                required: true,
                description: 'Base numeric value used for the animated counter.',
              },
              {
                slug: 'suffix',
                type: 'text',
                required: false,
                description: 'Suffix or unit to display after the number (e.g., %, M+, B+).',
              },
              {
                slug: 'label',
                type: 'text',
                required: true,
                description: 'Short label describing the statistic.',
                translatable: true,
              },
            ],
          },
        },
        backgroundColorField,
      ],
      defaultValues: {
        stats: [
          { value: 73_000_000, suffix: 'M+', label: 'developers' },
          { value: 1_000_000_000, suffix: 'B+', label: 'contributors' },
          { value: 4_000_000, suffix: 'M+', label: 'organizations' },
        ],
        backgroundColor: 'bg-backdrop-low',
      },
      allowedPostTypes: [],
    }
  }
}
