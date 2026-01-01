import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields } from './shared_fields.js'

export default class HeroModule extends BaseModule {
  /**
   * Hero modules support Framer Motion animations.
   * We use 'hybrid' mode so users can choose between pure static SSR
   * or React hydration for animations on a per-instance basis.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'hero',
      name: 'Hero',
      description: 'Centered hero with headline, body copy, and primary call-to-action button.',
      icon: 'star',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['hero', 'intro', 'callout', 'cta'],
        keywords: ['hero', 'intro', 'banner'],
        useWhen: [
          'You need a strong opening section for a page (headline + supporting copy).',
          'You want a simple, centered hero without complex media layout.',
          'The page needs a clear primary CTA near the top.',
        ],
        avoidWhen: [
          'You need a hero with an image/video; prefer hero-with-media or a dedicated media hero.',
          'The page already has a hero; use a smaller callout/CTA instead.',
        ],
        compositionNotes:
          'Typically first module on a page. Pair with Prose or Features List as the next section; keep copy concise.',
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
          label: 'Heading',
          required: true,
          description: 'Main heading text',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          label: 'Subtitle',
          required: false,
          description: 'Supporting text below the title',
          translatable: true,
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
        title: "We invest in the world's potential",
        subtitle:
          'We focus on markets where technology, innovation, and capital can unlock long-term value and drive durable growth.',
        theme: 'low',
      },
      allowedPostTypes: [],
    }
  }
}
