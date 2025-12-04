import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class HeroModule extends BaseModule {
  getConfig(): ModuleConfig {
    return {
      type: 'hero',
      name: 'Hero',
      description: 'Centered hero with headline, body copy, and primary call-to-action button.',
      icon: 'star',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        title: {
          type: 'string',
          required: true,
          description: 'Main heading text',
          translatable: true,
        },
        subtitle: {
          type: 'textarea',
          required: false,
          description: 'Supporting text below the title',
          translatable: true,
        },
      },
      defaultProps: {
        title: "We invest in the world's potential",
        subtitle:
          'We focus on markets where technology, innovation, and capital can unlock long-term value and drive durable growth.',
        backgroundColor: 'bg-backdrop-low',
      },
      allowedPostTypes: [],
    }
  }
}

