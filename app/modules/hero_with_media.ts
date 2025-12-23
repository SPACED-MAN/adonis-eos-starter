import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

/**
 * Hero with Media Module
 *
 * Two-column hero with text content and a media block (image) on the side.
 * Inspired by marketing hero layouts with primary and secondary CTAs.
 */
export default class HeroWithMediaModule extends BaseModule {
  /**
   * Hero with media supports animations. We use 'hybrid' mode
   * to allow optional interactivity.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  /**
   * Module configuration
   */
  getConfig(): ModuleConfig {
    return {
      type: 'hero-with-media',
      name: 'Hero with Media',
      description: 'Two-column hero with headline, body text, CTAs, and a media block',
      icon: 'layout-hero-media',
      allowedScopes: ['local', 'global'],
      lockable: true,
      fieldSchema: [
        {
          slug: 'title',
          type: 'text',
          label: 'Title',
          required: true,
          description: 'Main heading text',
          translatable: true,
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
          slug: 'image',
          type: 'media',
          label: 'Hero Media',
          accept: 'image/*,video/*',
          config: { storeAs: 'id' },
          description: 'Hero image or video (stored as media ID, resolved via the media API). Alt text is pulled from the media library.',
        },
        {
          slug: 'imagePosition',
          type: 'select',
          label: 'Image Position',
          description: 'Which side the media appears on for large screens',
          options: [
            { label: 'Right', value: 'right' },
            { label: 'Left', value: 'left' },
          ],
        },
        {
          slug: 'primaryCta',
          type: 'object',
          label: 'Primary CTA',
          description: 'Main call-to-action button',
          fields: [
            {
              slug: 'label',
              type: 'text',
              label: 'Label',
              translatable: true,
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
          slug: 'secondaryCta',
          type: 'object',
          label: 'Secondary CTA',
          description: 'Secondary call-to-action button',
          fields: [
            {
              slug: 'label',
              type: 'text',
              label: 'Label',
              translatable: true,
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
        // Note: Background classes are fixed in code to avoid exposing Tailwind to editors
      ],
      defaultValues: {
        title: 'Payments tool for software companies',
        subtitle:
          'From checkout to global sales tax compliance, companies around the world use this platform to simplify their payment stack.',
        image: null,
        imagePosition: 'right',
        primaryCta: {
          label: 'Get started',
          url: '#',
          style: 'primary',
        },
        secondaryCta: {
          label: 'Speak to Sales',
          url: '#',
          style: 'outline',
        },
      },
      allowedPostTypes: [], // Available for all post types
    }
  }
}
