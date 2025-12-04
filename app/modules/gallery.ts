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
      version: '1.0.0',
      name: 'Image Gallery',
      description: 'Interactive image gallery with lightbox and navigation',
      icon: 'image-multiple',
      category: 'media',
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
