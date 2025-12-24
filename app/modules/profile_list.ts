import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

export default class ProfileListModule extends BaseModule {
  /**
   * Profile list supports hybrid rendering for staggered entrance animations.
   */
  getRenderingMode() {
    return 'hybrid' as const
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
          slug: 'title',
          type: 'text',
          required: true,
          description: 'Section heading shown above the profiles grid',
          translatable: true,
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
				backgroundColorField,
			],
			defaultValues: {
				title: 'Our Team',
				subtitle:
					'Meet the people behind the work. Profiles are pulled from the Profile post type so they sync automatically.',
				profiles: [],
				backgroundColor: 'bg-backdrop-low',
			},
      allowedPostTypes: ['page', 'blog'],
    }
  }
}
