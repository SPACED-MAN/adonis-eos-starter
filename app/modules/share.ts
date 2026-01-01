import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { themeField } from './shared_fields.js'

export default class ShareModule extends BaseModule {
  /**
   * Share module is hybrid to allow optional entrance animations.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'share',
      name: 'Share',
      description: 'Social sharing icons for the current page',
      icon: 'share-nodes',
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
          required: false,
          label: 'Label',
          description: 'Optional label beside or above the icons (e.g. "Share:")',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        {
          slug: 'alignment',
          type: 'select',
          required: false,
          label: 'Alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ],
          default: 'left',
        },
        themeField,
      ],
      defaultValues: {
        title: 'Share:',
        alignment: 'center',
        theme: 'transparent',
      },
      allowedPostTypes: [],
    }
  }
}
