import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, LIPSUM_TITLE, LIPSUM_PARAGRAPH } from './shared_fields.js'

export default class ProseWithFormModule extends BaseModule {
  /**
   * Prose with form supports hybrid rendering for entrance animations.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'prose-with-form',
      name: 'Prose with Form',
      description:
        'A two-column layout pairing prose-style content with an embedded lead capture or contact form. EXPECTATION: Provide a detailed and persuasive content description (multiple paragraphs) to encourage form submission.',
      icon: 'layout-text-sidebar',
      allowedScopes: ['local', 'global'],
      lockable: true,
      fieldSchema: [
        {
          slug: 'content_tab',
          type: 'tab',
          label: 'Content',
        },
        {
          slug: 'heading',
          type: 'text',
          label: 'Heading',
          required: true,
          description: 'Main heading text',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'content',
          type: 'richtext',
          label: 'Content',
          required: false,
          description: 'Supporting prose-style content below the heading',
          translatable: true,
        },
        {
          slug: 'formSlug',
          type: 'form-reference',
          label: 'Form',
          required: true,
          description: 'Form to embed (e.g., contact). Choose from Forms defined in the admin.',
        },
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        {
          slug: 'layout',
          type: 'select',
          label: 'Form Position',
          description: 'Which side the form appears on for larger screens',
          options: [
            { label: 'Form on right', value: 'form-right' },
            { label: 'Form on left', value: 'form-left' },
          ],
        },
        themeField,
        ...mediaBackgroundFields,
      ],
      defaultValues: {
        heading: LIPSUM_TITLE,
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: LIPSUM_PARAGRAPH,
                  },
                ],
              },
            ],
          },
        },
        formSlug: 'contact',
        layout: 'form-right',
        theme: 'low',
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
