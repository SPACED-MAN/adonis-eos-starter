import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class BlogListModule extends BaseModule {
  getConfig(): ModuleConfig {
    return {
      type: 'blog-list',
      name: 'Blog List',
      description:
        'Two-column list of featured blog posts. If no posts are selected, shows all published blog posts.',
      icon: 'newspaper',
      allowedScopes: ['local', 'global'],
      lockable: true,
      fieldSchema: [
        {
          slug: 'title',
          type: 'text',
          required: true,
          description: 'Section heading shown above the blog list',
          translatable: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          required: false,
          description: 'Optional short paragraph describing the blog or content theme.',
          translatable: true,
        },
        {
          slug: 'posts',
          type: 'post-reference',
          required: false,
          description:
            'Optional list of specific blog posts to feature. If empty, all published blog posts will be shown.',
          config: {
            postTypes: ['blog'],
            allowMultiple: true,
          },
        },
      ],
      defaultValues: {
        title: 'Our Blog',
        subtitle:
          'Insights, stories, and updates from the team. Blog posts are pulled from the Blog post type so they stay in sync.',
        posts: [],
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
