import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class CompanyListModule extends BaseModule {
  getConfig(): ModuleConfig {
    return {
      type: 'company-list',
      name: 'Company List',
      description:
        'Logo-style grid of featured companies. If no companies are selected, shows all company posts.',
      icon: 'building',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        title: {
          type: 'string',
          required: true,
          description: 'Section heading shown above the company grid',
          translatable: true,
        },
        subtitle: {
          type: 'textarea',
          required: false,
          description: 'Optional short paragraph describing the customers or partners displayed.',
          translatable: true,
        },
        companies: {
          type: 'post-reference',
          required: false,
          description:
            'Optional list of specific Companies to feature. If empty, all company posts will be shown.',
          postTypes: ['company'],
          allowMultiple: true,
        },
      },
      defaultProps: {
        title: 'You’ll be in good company',
        subtitle:
          'Logos and names of customers or partners, managed via the Company post type.',
        companies: [],
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}


