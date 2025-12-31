import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

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
          slug: 'cta',
          type: 'object',
          label: 'Section CTA',
          description: 'Optional call-to-action button rendered below the feature list',
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
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        backgroundColorField,
      ],
      defaultValues: {
        title: 'Built for growing teams and ambitious roadmaps',
        subtitle:
          'Use this section to highlight major phases, advantages, or pillars of your product or service with more detailed copy.',
        features: [
          {
            icon: 'rocket',
            title: 'Launch faster',
            body: 'Streamline launch checklists, approvals, and handoffs so cross-functional teams can ship campaigns in days, not weeks.',
          },
          {
            icon: 'layer-group',
            title: 'Standardize playbooks',
            body: 'Codify your best practices into repeatable workflows so every team can follow the same proven path to results.',
          },
          {
            icon: 'users',
            title: 'Align stakeholders',
            body: 'Give marketing, sales, and operations a shared source of truth so everyone stays aligned on what ships next.',
          },
        ],
        cta: {
          label: 'Explore all features',
          url: { kind: 'url', url: '#', target: '_self' },
          style: 'primary',
        },
        backgroundColor: 'bg-backdrop-low',
      },
      allowedPostTypes: [],
    }
  }
}
