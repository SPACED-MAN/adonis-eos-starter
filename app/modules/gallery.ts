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
   * Gallery supports animations. We use 'hybrid' mode
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
      fieldSchema: [
        {
          slug: 'images',
          type: 'repeater',
          required: true,
          description: 'Array of images with url, alt, and optional caption',
          item: {
            type: 'object',
            fields: [
              {
                slug: 'url',
                type: 'media',
                required: true,
                label: 'Image',
                accept: 'image/*',
                config: { storeAs: 'id' },
                description: 'Select an image from the media library',
              },
              {
                slug: 'alt',
                type: 'text',
                required: true,
                label: 'Alt Text',
                description: 'Alternative text for accessibility',
              },
              {
                slug: 'caption',
                type: 'textarea',
                required: false,
                label: 'Caption',
                description: 'Optional caption for the image',
              },
            ],
          },
        },
        {
          slug: 'layout',
          type: 'select',
          description: 'Gallery layout style',
          options: [
            { label: 'Grid', value: 'grid' },
            { label: 'Masonry', value: 'masonry' },
          ],
        },
        {
          slug: 'columns',
          type: 'number',
          min: 1,
          max: 6,
          description: 'Number of columns for grid layout',
        },
      ],
      defaultValues: {
        images: [],
        layout: 'grid',
        columns: 3,
      },
      allowedPostTypes: [], // Available for all post types
    }
  }
}
