import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class ProfileListModule extends BaseModule {
  getConfig(): ModuleConfig {
    return {
      type: 'profile-list',
      name: 'Profile List',
      description:
        'Grid of featured team profiles with image, role, and bio. Defaults to all profiles if none are selected.',
      icon: 'users',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        title: {
          type: 'string',
          required: true,
          description: 'Section heading shown above the profiles grid',
          translatable: true,
        },
        subtitle: {
          type: 'textarea',
          required: false,
          description: 'Short paragraph describing the team or group of profiles',
          translatable: true,
        },
        profiles: {
          type: 'post-reference',
          required: false,
          description:
            'Optional list of specific Profiles to feature. If empty, all available Profiles will be shown.',
          postTypes: ['profile'],
          allowMultiple: true,
        },
      },
      defaultProps: {
        title: 'Our Team',
        subtitle:
          'Meet the people behind the work. Profiles are pulled from the Profile post type so they stay in sync.',
        profiles: [],
      },
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
