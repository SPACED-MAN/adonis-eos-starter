import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

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
        backgroundColorField,
      ],
      defaultValues: {
        heading: "Let's talk about your next project.",
        content: {
          root: {
            type: 'root',
            format: '',
            indent: 0,
            version: 1,
            children: [
              {
                type: 'paragraph',
                format: '',
                indent: 0,
                version: 1,
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Use this section to tell a short story about how your team partners with customers, and include a simple form for follow-up.',
                    type: 'text',
                    version: 1,
                  },
                ],
              },
            ],
          },
        },
        formSlug: 'contact',
        layout: 'form-right',
        backgroundColor: 'bg-backdrop-low',
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
