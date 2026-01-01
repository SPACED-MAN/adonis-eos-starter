import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField } from './shared_fields.js'

export default class TestimonialListModule extends BaseModule {
  /**
   * Testimonial list can be hybrid to support staggered entry animations
   * when interactivity is enabled.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'testimonial-list',
      name: 'Testimonial List',
      description:
        'Grid of featured testimonials with quote, author, and role. Defaults to all testimonials if none are selected.',
      icon: 'quote',
      allowedScopes: ['local', 'global'],
      lockable: true,
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
          description: 'Section heading shown above the testimonials grid',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          required: false,
          description: 'Short paragraph describing the testimonials section',
          translatable: true,
        },
        {
          slug: 'testimonials',
          type: 'post-reference',
          required: false,
          description:
            'Optional list of specific Testimonials to feature. If empty, all available Testimonials will be shown.',
          config: {
            postTypes: ['testimonial'],
            allowMultiple: true,
          },
        },
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        themeField,
      ],
      defaultValues: {
        title: 'Testimonials',
        subtitle:
          'Hear from customers and partners. Testimonials are pulled from the Testimonial post type so they stay in sync.',
        testimonials: [],
        theme: 'low',
      },
      // Typically used on pages and blogs
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
