import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class FormModule extends BaseModule {
  /**
   * Frontend forms are interactive (client-side validation, submission,
   * conditional error states), so they must be rendered as React modules.
   */
  getRenderingMode() {
    return 'react' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'form',
      name: 'Form',
      description:
        'Frontend form for lead capture or contact. Uses a form definition managed in the Forms admin and triggers webhooks on submission.',
      icon: 'envelope',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        title: {
          type: 'string',
          required: false,
          description: 'Optional heading shown above the form',
          translatable: true,
        },
        subtitle: {
          type: 'textarea',
          required: false,
          description: 'Optional supporting copy shown below the heading',
          translatable: true,
        },
        formSlug: {
          type: 'form-reference',
          required: true,
          description: 'Form to render (e.g., contact). Choose from Forms defined in the admin.',
        },
      },
      defaultProps: {
        title: 'Contact us',
        subtitle: 'Fill out the form and our team will get back to you shortly.',
        formSlug: 'contact',
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
