import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields } from './shared_fields.js'

export default class FaqModule extends BaseModule {
  /**
   * FAQ can be hybrid to support accordion animations
   * when interactivity is enabled.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'faq',
      name: 'FAQ',
      description:
        'Frequently asked questions section with a heading and a grid of question-and-answer pairs.',
      icon: 'question-circle',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['faq', 'body'],
        keywords: ['faq', 'questions', 'answers', 'help'],
        useWhen: [
          'You need to address common concerns or technical questions.',
          'The content follows a Q&A format.',
        ],
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
          required: true,
          description: 'Section heading shown above the FAQ grid',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          required: false,
          description: 'Optional short paragraph introducing the FAQ section',
          translatable: true,
        },
        {
          slug: 'items',
          type: 'repeater',
          required: true,
          description: 'List of frequently asked questions',
          item: {
            slug: 'item',
            type: 'object',
            fields: [
              {
                slug: 'question',
                type: 'text',
                required: true,
                description: 'Question text',
                translatable: true,
                isLabel: true,
              },
              {
                slug: 'answer',
                type: 'textarea',
                required: true,
                description: 'Answer body copy',
                translatable: true,
              },
              {
                slug: 'linkLabel',
                type: 'text',
                required: false,
                description: 'Optional call-to-action label appended to the answer',
                translatable: true,
              },
              {
                slug: 'linkUrl',
                type: 'link',
                required: false,
                description: 'Optional link destination for the call-to-action',
              },
            ],
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
        title: 'Lorem ipsum dolor sit amet',
        subtitle:
          'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        items: [
          {
            question: 'Lorem ipsum dolor sit amet?',
            answer:
              'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.',
          },
          {
            question: 'Consectetur adipiscing elit?',
            answer:
              'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
          },
          {
            question: 'Sed do eiusmod tempor incididunt?',
            answer:
              'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit.',
            linkLabel: 'Lorem Ipsum',
            linkUrl: { kind: 'url', url: '#' },
          },
        ],
        theme: 'low',
      },
      allowedPostTypes: [],
    }
  }
}
