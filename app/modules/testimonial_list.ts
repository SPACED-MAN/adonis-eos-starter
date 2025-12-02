import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class TestimonialListModule extends BaseModule {
  getConfig(): ModuleConfig {
    return {
      type: 'testimonial-list',
      name: 'Testimonial List',
      description:
        'Grid of featured testimonials with quote, author, and role. Defaults to all testimonials if none are selected.',
      icon: 'quote',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        title: {
          type: 'string',
          required: true,
          description: 'Section heading shown above the testimonials grid',
          translatable: true,
        },
        subtitle: {
          type: 'textarea',
          required: false,
          description: 'Short paragraph describing the testimonials section',
          translatable: true,
        },
        testimonials: {
          type: 'post-reference',
          required: false,
          description:
            'Optional list of specific Testimonials to feature. If empty, all available Testimonials will be shown.',
          postTypes: ['testimonial'],
          allowMultiple: true,
        },
      },
      defaultProps: {
        title: 'Testimonials',
        subtitle:
          'Hear from customers and partners. Testimonials are pulled from the Testimonial post type so they stay in sync.',
        testimonials: [],
      },
      // Typically used on pages and blogs
      allowedPostTypes: ['page', 'blog'],
    }
  }
}


