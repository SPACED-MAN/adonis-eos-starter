import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, mediaFitField } from './shared_fields.js'

export default class ProseWithMediaModule extends BaseModule {
  /**
   * Prose with media supports hybrid rendering for entrance animations.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'prose-with-media',
      name: 'Prose with Media',
      description:
        'A layout pairing narrative content with a supporting visual block. Use this for feature explainers or editorial sections. EXPECTATION: Provide a substantial amount of body copy (multiple paragraphs) to properly support the visual element.',
      icon: 'layout-text-media',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['body', 'content', 'feature-explainer'],
        keywords: ['prose', 'text', 'content', 'media', 'image', 'video'],
        useWhen: [
          'You want to pair editorial content with a supporting image or video.',
          'You are explaining a specific feature or concept in detail.',
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
          label: 'Title',
          required: true,
          description: 'Main heading text',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'body',
          type: 'richtext',
          label: 'Body',
          required: false,
          description: 'Supporting rich text content below the title (Lexical JSON)',
          translatable: true,
        },
        {
          slug: 'image',
          type: 'media',
          label: 'Media',
          accept: 'image/*,video/*',
          config: { storeAs: 'id' },
          description: 'Image or video shown beside the prose (stored as media ID).',
        },
        {
          slug: 'primaryCta',
          type: 'object',
          label: 'Primary CTA',
          description: 'Main call-to-action button beneath the prose',
          fields: [
            {
              slug: 'label',
              type: 'text',
              label: 'Label',
              translatable: true,
              isLabel: true,
            },
            {
              slug: 'url',
              type: 'link',
              label: 'Destination',
            },
          ],
        },
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        {
          slug: 'imagePosition',
          type: 'select',
          label: 'Image Position',
          description: 'Which side the media appears on for larger screens',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ],
        },
        mediaFitField,
        themeField,
        ...mediaBackgroundFields,
      ],
      defaultValues: {
        title: "Let's create more tools and ideas that bring us together.",
        body: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'This layout pairs narrative content with a focused visual, ideal for feature callouts, product explainers, and lightweight storytelling.',
                  },
                ],
              },
            ],
          },
        },
        image: null,
        imagePosition: 'left',
        objectFit: 'contain',
        primaryCta: {
          label: 'Get started',
          url: '#',
        },
        theme: 'low',
      },
      allowedPostTypes: [],
    }
  }
}
