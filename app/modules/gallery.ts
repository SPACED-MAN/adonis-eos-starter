import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

/**
 * Gallery Module
 *
 * Interactive image gallery with lightbox, navigation, and keyboard controls.
 * Uses React component for full interactivity.
 *
 * Rendering: React component (inertia/modules/gallery.tsx)
 * Performance: SSR + hydration for interactivity
 */
export default class GalleryModule extends BaseModule {
  /**
   * Rendering mode: React (needs client-side interactivity)
   * Gallery requires lightbox, navigation, keyboard events, etc.
   */
  getRenderingMode() {
    return 'react' as const
  }

  /**
   * Module configuration
   */
  getConfig(): ModuleConfig {
    return {
      type: 'gallery',
      name: 'Image Gallery',
      description: 'Interactive image gallery with lightbox and navigation',
      icon: 'image-multiple',
      category: 'media',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['media', 'gallery'],
        useWhen: [
          'You need to showcase multiple images with optional lightbox interaction.',
          'The content benefits from visual proof (portfolio, case studies, product photos).',
        ],
        avoidWhen: [
          'You only need a single supporting image; use hero-with-media or prose-with-media.',
          'You need complex, editorial image layouts (before/after, sliders); consider a dedicated module.',
        ],
        compositionNotes:
          'Works best after explanatory prose. Prefer 6–12 images; keep alt text meaningful and consistent.',
      },
      propsSchema: {
        images: {
          type: 'array',
          required: true,
          description: 'Array of images with url, alt, and optional caption',
        },
        layout: {
          type: 'string',
          default: 'grid',
          enum: ['grid', 'masonry'],
          description: 'Gallery layout style',
        },
        columns: {
          type: 'number',
          default: 3,
          min: 1,
          max: 6,
          description: 'Number of columns for grid layout',
        },
      },
      defaultProps: {
        images: [],
        layout: 'grid',
        columns: 3,
      },
      allowedPostTypes: [], // Available for all post types
    }
  }
}
