import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, LIPSUM_TITLE, LIPSUM_SUBTITLE } from './shared_fields.js'

export default class CompanyListModule extends BaseModule {
  /**
   * Company list can be hybrid to support staggered entry animations
   * when interactivity is enabled.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'company-list',
      name: 'Company List',
      description:
        'Logo-style grid of featured companies. If no companies are selected, shows all company posts.',
      icon: 'building',
      allowedScopes: ['local', 'global'],
      lockable: true,
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
          description: 'Section heading shown above the company grid',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          required: false,
          description: 'Optional short paragraph describing the customers or partners displayed.',
          translatable: true,
        },
        {
          slug: 'companies',
          type: 'post-reference',
          required: false,
          description:
            'Optional list of specific Companies to feature. If empty, all company posts will be shown.',
          config: {
            postTypes: ['company'],
            allowMultiple: true,
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
        companies: [],
        theme: 'low',
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
