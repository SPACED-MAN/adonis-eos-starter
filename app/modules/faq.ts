import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

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
      fieldSchema: [
        {
          slug: 'title',
          type: 'text',
          required: true,
          description: 'Section heading shown above the FAQ grid',
          translatable: true,
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
        backgroundColorField,
      ],
      defaultValues: {
        title: 'Frequently asked questions',
        subtitle:
          'Answers to common questions about how we work, what is included, and how we support your team.',
        items: [
          {
            question: 'What do you mean by “Figma assets”?',
            answer:
              'You will have access to download the full design source, including all of the pages, reusable components, responsive variants, and supporting illustrations.',
          },
          {
            question: 'What does “lifetime access” mean?',
            answer:
              'Once you purchase a license you can use the product for as long as you like and receive all future updates at no additional cost.',
          },
          {
            question: 'How does support work?',
            answer:
              'Our team provides support directly via email. You will always be talking to the people who build and maintain the product.',
            linkLabel: 'Contact support',
            linkUrl: { kind: 'url', url: '#' },
          },
          {
            question: 'Can I use this for multiple projects?',
            answer:
              'Yes. Your license covers an unlimited number of internal or client projects, as long as you are not reselling the kit itself as a competing product.',
          },
          {
            question: 'What do “free updates” include?',
            answer:
              'Free updates include new components, patterns, and improvements that we ship as part of the public roadmap for this product.',
            linkLabel: 'View roadmap',
            linkUrl: { kind: 'url', url: '#' },
          },
          {
            question: 'Can I use this in open-source projects?',
            answer:
              'In most cases you can use the kit in open-source projects, as long as the project is not a direct replacement for this product (for example, a competing UI kit or page-builder).',
          },
        ],
        backgroundColor: 'bg-backdrop-low',
      },
      allowedPostTypes: [],
    }
  }
}
