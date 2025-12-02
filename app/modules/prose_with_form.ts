import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class ProseWithFormModule extends BaseModule {
  getRenderingMode() {
    return 'react' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'prose-with-form',
      name: 'Prose with Form',
      description:
        'Two-column layout pairing prose-style content with an embedded frontend form for lead capture or contact.',
      icon: 'layout-text-sidebar',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        title: {
          type: 'text',
          label: 'Title',
          required: true,
          description: 'Main heading text',
          translatable: true,
        },
        body: {
          type: 'textarea',
          label: 'Body',
          required: false,
          description: 'Supporting prose-style paragraph below the title',
          translatable: true,
        },
        formSlug: {
          type: 'form-reference',
          label: 'Form',
          required: true,
          description: 'Form to embed (e.g., contact). Choose from Forms defined in the admin.',
        },
        successMessage: {
          type: 'string',
          label: 'Success Message (deprecated)',
          required: false,
          description: 'Legacy override (forms now manage success messages themselves).',
          translatable: true,
        },
        layout: {
          type: 'select',
          label: 'Form Position',
          description: 'Which side the form appears on for larger screens',
          options: [
            { label: 'Form on right', value: 'form-right' },
            { label: 'Form on left', value: 'form-left' },
          ],
          default: 'form-right',
        },
        backgroundColor: {
          type: 'string',
          label: 'Background CSS class',
          required: false,
          description: 'Tailwind utility for background (e.g., bg-backdrop-low)',
        },
      },
      defaultProps: {
        title: "Let's talk about your next project.",
        body: 'Use this section to tell a short story about how your team partners with customers, and include a simple form for follow-up.',
        formSlug: 'contact',
        layout: 'form-right',
        backgroundColor: 'bg-backdrop-low',
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}



