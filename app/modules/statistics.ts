import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class StatisticsModule extends BaseModule {
  getRenderingMode() {
    return 'react' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'statistics',
      name: 'Statistics',
      description: 'Compact grid of key statistics with animated counters.',
      icon: 'chart-donut',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        stats: {
          type: 'array',
          required: true,
          description: 'List of statistics to display (e.g., 73M+ developers).',
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              value: {
                type: 'number',
                required: true,
                description: 'Base numeric value used for the animated counter.',
              },
              suffix: {
                type: 'string',
                required: false,
                description: 'Suffix or unit to display after the number (e.g., %, M+, B+).',
              },
              label: {
                type: 'string',
                required: true,
                description: 'Short label describing the statistic.',
                translatable: true,
              },
            },
          },
        },
      },
      defaultProps: {
        stats: [
          { value: 73_000_000, suffix: 'M+', label: 'developers' },
          { value: 1_000_000_000, suffix: 'B+', label: 'contributors' },
          { value: 4_000_000, suffix: 'M+', label: 'organizations' },
        ],
      },
      allowedPostTypes: [],
    }
  }
}
