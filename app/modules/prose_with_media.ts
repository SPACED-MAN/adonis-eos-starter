import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, mediaFitField, LIPSUM_TITLE, LIPSUM_PARAGRAPH, LIPSUM_CTA } from './shared_fields.js'

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
        'A layout pairing narrative content with a supporting visual block. Use this for feature explainers or editorial sections. EXPECTATION: Provide a substantial amount of body copy (multiple paragraphs) to properly support the visual element. NOTE: Enabling Interactivity with long content will make the media sticky.',
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
          slug: 'ctas',
          type: 'repeater',
          label: 'Buttons',
          description: 'One or more call-to-action buttons beneath the prose',
          item: {
            slug: 'cta',
            type: 'object',
            label: 'Button',
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
              {
                slug: 'style',
                type: 'select',
                label: 'Style',
                options: [
                  { label: 'Primary', value: 'primary' },
                  { label: 'Secondary', value: 'secondary' },
                  { label: 'Outline', value: 'outline' },
                ],
              },
            ],
          },
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
        title: LIPSUM_TITLE,
        body: {
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
        image: null,
        imagePosition: 'left',
        objectFit: 'contain',
        ctas: [
          {
            label: LIPSUM_CTA,
            url: '#',
            style: 'primary',
          },
        ],
        theme: 'low',
      },
      allowedPostTypes: [],
    }
  }
}
