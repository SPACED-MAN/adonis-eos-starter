import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, LIPSUM_TITLE, LIPSUM_SUBTITLE } from './shared_fields.js'

export default class BlogListModule extends BaseModule {
  /**
   * Blog list must be 'react' (hydrated) because it fetches its own data
   * from /api/blogs in a useEffect hook.
   */
  getRenderingMode() {
    return 'react' as const
  }

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
          slug: 'content_tab',
          type: 'tab',
          label: 'Content',
        },
        {
          slug: 'title',
          type: 'text',
          required: true,
          description: 'Section heading shown above the blog list',
          translatable: true,
          isLabel: true,
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
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        themeField,
        ...mediaBackgroundFields,
      ],
      defaultValues: {
        title: LIPSUM_TITLE,
        subtitle: LIPSUM_SUBTITLE,
        posts: [],
        theme: 'low',
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
