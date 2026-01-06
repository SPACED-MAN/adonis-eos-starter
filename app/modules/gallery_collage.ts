import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, mediaFitField } from './shared_fields.js'

export default class GalleryCollageModule extends BaseModule {
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'gallery-collage',
      name: 'Gallery (Collage)',
      description: 'A scattered collage of images with varying sizes and an immersive lightbox.',
      icon: 'image-album',
      category: 'media',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['gallery', 'media', 'showcase'],
        keywords: ['collage', 'gallery', 'scattered', 'images', 'photos', 'portfolio'],
        useWhen: [
          'You want a more creative, less structured way to display multiple images.',
          'You want to show off screenshots, product photos, or a mood board.',
          'The layout should feel organic and immersive.',
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
          label: 'Title',
          required: false,
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          label: 'Subtitle',
          required: false,
          translatable: true,
        },
        {
          slug: 'images',
          type: 'repeater',
          label: 'Images',
          required: true,
          item: {
            slug: 'item',
            type: 'object',
            label: 'Image',
            fields: [
              {
                slug: 'image',
                type: 'media',
                label: 'Image',
                required: true,
                config: { storeAs: 'id' },
              },
              {
                slug: 'size',
                type: 'select',
                label: 'Size',
                options: [
                  { label: 'Small', value: 'small' },
                  { label: 'Medium', value: 'medium' },
                  { label: 'Large', value: 'large' },
                ],
                default: 'medium',
              },
              {
                slug: 'label',
                type: 'text',
                label: 'Caption',
                translatable: true,
                isLabel: true,
              },
            ],
          },
        },
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        {
          slug: 'scatter',
          type: 'select',
          label: 'Scatter Intensity',
          options: [
            { label: 'None (Clean)', value: 'none' },
            { label: 'Low', value: 'low' },
            { label: 'High', value: 'high' },
          ],
          default: 'low',
        },
        mediaFitField,
        themeField,
        ...mediaBackgroundFields,
      ],
      defaultValues: {
        title: 'Gallery Collage',
        subtitle: 'A beautiful, organic collection of visuals.',
        scatter: 'low',
        objectFit: 'contain',
        theme: 'transparent',
        images: [],
      },
      allowedPostTypes: [],
    }
  }
}

