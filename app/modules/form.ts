import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields } from './shared_fields.js'

export default class FormModule extends BaseModule {
  /**
   * Frontend forms are interactive (client-side validation, submission,
   * conditional error states). We use hybrid mode to allow optional
   * entrance animations.
   */
  getRenderingMode() {
    return 'hybrid' as const
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
      aiGuidance: {
        layoutRoles: ['form', 'callout', 'cta', 'lead-capture'],
        useWhen: [
          'You need lead capture or contact submission on a page.',
          'You already have a form definition in Forms admin (referenced by formSlug).',
        ],
        avoidWhen: [
          'You only need a simple CTA link/button; use a hero/callout module instead.',
          'You need a custom form behavior not supported by existing form definitions; extend forms first.',
        ],
        compositionNotes:
          'Commonly placed near the bottom of a landing page or after a persuasive content section. Keep surrounding copy short and specific.',
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
          required: false,
          description: 'Optional heading shown above the form',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          required: false,
          description: 'Optional supporting copy shown below the heading',
          translatable: true,
        },
        {
          slug: 'formSlug',
          type: 'form-reference',
          required: true,
          description: 'Form to render (e.g., contact). Choose from Forms defined in the admin.',
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
        title: 'Lorem ipsum',
        subtitle: 'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        formSlug: 'contact',
        theme: 'low',
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
