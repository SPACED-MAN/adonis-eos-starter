import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields } from './shared_fields.js'

export default class FeaturesListExpandedModule extends BaseModule {
  /**
   * Features list expanded supports hybrid rendering for entrance animations.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'features-list-expanded',
      name: 'Features List (Expanded)',
      description:
        'Expanded, timeline-style feature list with alternating layout and an optional call-to-action button.',
      icon: 'list-check',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['features', 'body', 'content', 'timeline'],
        keywords: ['features', 'list', 'expanded', 'timeline', 'alternating'],
        useWhen: [
          'You want to explain a smaller number of features in more detail.',
          'The content benefits from an alternating or timeline-like layout.',
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
          description: 'Section heading shown above the expanded feature list',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          required: false,
          description: 'Short paragraph explaining the section',
          translatable: true,
        },
        {
          slug: 'features',
          type: 'repeater',
          required: true,
          description: 'List of feature items (up to 12)',
          item: {
            slug: 'item',
            type: 'object',
            fields: [
              {
                slug: 'icon',
                type: 'icon',
                required: false,
                description: 'Fort Awesome icon from the registered icon library',
              },
              {
                slug: 'title',
                type: 'text',
                required: true,
                description: 'Short feature title',
                translatable: true,
                isLabel: true,
              },
              {
                slug: 'body',
                type: 'textarea',
                required: true,
                description: 'Longer description for this feature item',
                translatable: true,
              },
            ],
          },
        },
        {
          slug: 'ctas',
          type: 'repeater',
          label: 'Buttons',
          description: 'Optional call-to-action buttons rendered below the feature list',
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
        themeField,
        ...mediaBackgroundFields,
      ],
      defaultValues: {
        title: 'Lorem ipsum dolor sit amet',
        subtitle:
          'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.',
        features: [
          {
            icon: 'rocket',
            title: 'Consectetur adipiscing',
            body: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.',
          },
          {
            icon: 'layer-group',
            title: 'Labore et dolore',
            body: 'Ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit.',
          },
          {
            icon: 'users',
            title: 'Veniam quis nostrud',
            body: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
          },
        ],
        ctas: [
          {
            label: 'Lorem Ipsum',
            url: { kind: 'url', url: '#', target: '_self' },
            style: 'primary',
          },
        ],
        theme: 'low',
      },
      allowedPostTypes: [],
    }
  }
}
