import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField, mediaBackgroundFields, LIPSUM_TITLE, LIPSUM_SUBTITLE } from './shared_fields.js'

export default class ProfileListModule extends BaseModule {
  /**
   * Profile list must be 'react' (hydrated) because it fetches its own data
   * from /api/profiles in a useEffect hook.
   */
  getRenderingMode() {
    return 'react' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'profile-list',
      name: 'Profile List',
      description:
        'Grid of featured team profiles with image, role, and bio. Defaults to all profiles if none are selected.',
      icon: 'users',
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
          description: 'Section heading shown above the profiles grid',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          required: false,
          description: 'Short paragraph describing the team or group of profiles',
          translatable: true,
        },
        {
          slug: 'profiles',
          type: 'post-reference',
          required: false,
          description:
            'Optional list of specific Profiles to feature. If empty, all available Profiles will be shown.',
          config: {
            postTypes: ['profile'],
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
        profiles: [],
        theme: 'low',
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
