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
   * Rendering mode: React (SSR + hydration)
   * Uses a dedicated React component in inertia/modules/hero-with-media.tsx
   */
  getRenderingMode() {
    return 'react' as const
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
      propsSchema: {
        title: {
          type: 'text',
          label: 'Title',
          required: true,
          description: 'Main heading text',
          translatable: true,
        },
        subtitle: {
          type: 'textarea',
          label: 'Subtitle',
          required: false,
          description: 'Supporting text below the title',
          translatable: true,
        },
        image: {
          type: 'media',
          label: 'Hero Image',
          accept: 'image/*',
          storeAs: 'id',
          description: 'Hero image (stored as media ID, resolved via the media API)',
        },
        imageAlt: {
          type: 'text',
          label: 'Image Alt Text',
          required: false,
          description: 'Accessible alt text for the hero image',
          translatable: true,
        },
        imagePosition: {
          type: 'select',
          label: 'Image Position',
          description: 'Which side the media appears on for large screens',
          options: [
            { label: 'Right', value: 'right' },
            { label: 'Left', value: 'left' },
          ],
          default: 'right',
        },
        primaryCta: {
          type: 'object',
          label: 'Primary CTA',
          description: 'Main call-to-action button',
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
            {
              name: 'style',
              type: 'select',
              label: 'Style',
              options: [
                { label: 'Primary', value: 'primary' },
                { label: 'Secondary', value: 'secondary' },
                { label: 'Outline', value: 'outline' },
              ],
              default: 'primary',
            },
          ],
        },
        secondaryCta: {
          type: 'object',
          label: 'Secondary CTA',
          description: 'Secondary call-to-action button',
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
            {
              name: 'style',
              type: 'select',
              label: 'Style',
              options: [
                { label: 'Primary', value: 'primary' },
                { label: 'Secondary', value: 'secondary' },
                { label: 'Outline', value: 'outline' },
              ],
              default: 'outline',
            },
          ],
        },
        // Note: Background classes are fixed in code to avoid exposing Tailwind to editors
      },
      defaultProps: {
        title: 'Payments tool for software companies',
        subtitle:
          'From checkout to global sales tax compliance, companies around the world use this platform to simplify their payment stack.',
        image: null,
        imageAlt: 'Product mockup',
        imagePosition: 'right',
        primaryCta: {
          label: 'Get started',
          url: '#',
          style: 'primary',
          target: '_self',
        },
        secondaryCta: {
          label: 'Speak to Sales',
          url: '#',
          style: 'outline',
          target: '_self',
        },
        backgroundColor: 'bg-backdrop-low',
      },
      allowedPostTypes: [], // Available for all post types
    }
  }
}
