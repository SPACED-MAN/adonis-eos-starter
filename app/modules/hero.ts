import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

/**
 * Hero Module
 *
 * Large header section with title, subtitle, optional image, and CTA buttons.
 * Perfect for landing pages and feature sections.
 */
export default class HeroModule extends BaseModule {
  /**
   * Rendering mode: Static (pure SSR for max performance)
   * Hero is simple content - no interactivity needed
   */
  getRenderingMode() {
    return 'static' as const
  }

  /**
   * Get module configuration
   */
  getConfig(): ModuleConfig {
    return {
      type: 'hero',
      name: 'Hero Section',
      description: 'Large header with title, subtitle, image, and call-to-action buttons',
      icon: 'layout-hero',
      allowedScopes: ['local', 'global', 'static'],
      lockable: true,
      propsSchema: {
        title: {
          type: 'string',
          required: true,
          description: 'Main heading text',
          translatable: true,
        },
        subtitle: {
          type: 'string',
          required: false,
          description: 'Supporting text below the title',
          translatable: true,
        },
        alignment: {
          type: 'string',
          enum: ['left', 'center', 'right'],
          default: 'center',
          description: 'Text alignment',
        },
        image: {
          type: 'object',
          required: false,
          description: 'Background or featured image',
          properties: {
            url: { type: 'string' },
            alt: { type: 'string', translatable: true },
            position: { type: 'string', default: 'center' },
          },
        },
        primaryCta: {
          type: 'object',
          required: false,
          description: 'Primary call-to-action button',
          properties: {
            label: { type: 'string', translatable: true },
            url: { type: 'string' },
            style: {
              type: 'string',
              enum: ['primary', 'secondary', 'outline'],
              default: 'primary',
            },
          },
        },
        secondaryCta: {
          type: 'object',
          required: false,
          description: 'Secondary call-to-action button',
          properties: {
            label: { type: 'string', translatable: true },
            url: { type: 'string' },
            style: {
              type: 'string',
              enum: ['primary', 'secondary', 'outline'],
              default: 'outline',
            },
          },
        },
        backgroundColor: {
          type: 'string',
          default: 'bg-sand-50 dark:bg-sand-900',
          description: 'Tailwind background color classes',
        },
        minHeight: {
          type: 'string',
          default: 'min-h-[70vh]',
          description: 'Tailwind min-height class',
        },
      },
      defaultProps: {
        title: 'Welcome',
        subtitle: null,
        alignment: 'center',
        image: null,
        primaryCta: null,
        secondaryCta: null,
        backgroundColor: 'bg-sand-50 dark:bg-sand-900',
        minHeight: 'min-h-[70vh]',
      },
      allowedPostTypes: [], // Available for all post types
    }
  }
}
