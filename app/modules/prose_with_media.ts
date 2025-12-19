import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class ProseWithMediaModule extends BaseModule {
  getRenderingMode() {
    return 'react' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'prose-with-media',
      name: 'Prose with Media Content',
      description: 'Two-column layout pairing prose-style content with a supporting media block.',
      icon: 'layout-text-media',
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
          type: 'richtext',
          label: 'Body',
          required: false,
          description: 'Supporting rich text content below the title (Lexical JSON)',
          translatable: true,
        },
        image: {
          type: 'media',
          label: 'Media',
          accept: 'image/*,video/*',
          storeAs: 'id',
          description: 'Image or video shown beside the prose (stored as media ID).',
        },
        imagePosition: {
          type: 'select',
          label: 'Image Position',
          description: 'Which side the media appears on for larger screens',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ],
          default: 'left',
        },
        primaryCta: {
          type: 'object',
          label: 'Primary CTA',
          description: 'Main call-to-action button beneath the prose',
          fields: [
            {
              name: 'label',
              type: 'text',
              label: 'Label',
              translatable: true,
            },
            {
              name: 'url',
              type: 'link',
              label: 'Destination',
            },
          ],
        },
      },
      defaultProps: {
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
        primaryCta: {
          label: 'Get started',
          url: '#',
        },
      },
      allowedPostTypes: [],
    }
  }
}
