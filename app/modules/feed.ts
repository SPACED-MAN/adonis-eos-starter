import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

/**
 * Feed Module
 *
 * Renders a feed of posts (published) for one or more post types.
 * Intended to be an interactive React component that fetches via /api/posts.
 */
export default class FeedModule extends BaseModule {
  getConfig(): ModuleConfig {
    return {
      type: 'feed',
      name: 'Post Feed',
      description: 'Displays a feed of published posts for selected post type(s)',
      icon: 'list',
      allowedScopes: ['local', 'static'],
      lockable: true,
      propsSchema: {
        title: {
          type: 'string',
          required: false,
          description: 'Optional heading above the feed',
          translatable: true,
        },
        postTypes: {
          type: 'multiselect',
          required: true,
          description: 'Post types to include in the feed',
          // Admin editor can fetch options dynamically
          options: [],
          optionsSource: 'post-types',
        },
        locale: {
          type: 'string',
          required: false,
          description: 'Force a locale (defaults to current)',
        },
        limit: {
          type: 'number',
          required: false,
          description: 'Maximum number of items to show',
          default: 10,
        },
        parentId: {
          type: 'string',
          required: false,
          description: 'If set, limit to children of this parent post',
        },
        rootsOnly: {
          type: 'boolean',
          required: false,
          description: 'If true, only root posts (no parent)',
          default: false,
        },
        sortBy: {
          type: 'select',
          required: false,
          options: [
            { label: 'Published At', value: 'published_at' },
            { label: 'Created At', value: 'created_at' },
            { label: 'Updated At', value: 'updated_at' },
          ],
          default: 'published_at',
        },
        sortOrder: {
          type: 'select',
          required: false,
          options: [
            { label: 'Descending', value: 'desc' },
            { label: 'Ascending', value: 'asc' },
          ],
          default: 'desc',
        },
        showExcerpt: {
          type: 'boolean',
          required: false,
          default: true,
        },
      },
      defaultProps: {
        title: null,
        postTypes: [],
        locale: null,
        limit: 10,
        parentId: null,
        rootsOnly: false,
        sortBy: 'published_at',
        sortOrder: 'desc',
        showExcerpt: true,
      },
      allowedPostTypes: [], // usable everywhere
    }
  }
}



