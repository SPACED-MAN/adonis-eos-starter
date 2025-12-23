import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

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
          slug: 'title',
          type: 'text',
          required: false,
          label: 'Label',
          description: 'Optional label beside or above the icons (e.g. "Share:")',
          translatable: true,
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
        {
          slug: 'padding',
          type: 'select',
          label: 'Vertical Padding',
          options: [
            { label: 'None', value: 'py-0' },
            { label: 'Small', value: 'py-4' },
            { label: 'Medium', value: 'py-8' },
            { label: 'Large', value: 'py-16' },
          ],
          default: 'py-8',
        },
        {
          slug: 'backgroundColor',
          type: 'select',
          label: 'Background Color',
          options: [
            { label: 'Transparent', value: 'bg-transparent' },
            { label: 'Low', value: 'bg-backdrop-low' },
            { label: 'Medium', value: 'bg-backdrop-medium' },
          ],
          default: 'bg-transparent',
        },
      ],
      defaultValues: {
        title: 'Share:',
        alignment: 'left',
        padding: 'py-8',
        backgroundColor: 'bg-transparent',
      },
      allowedPostTypes: [],
    }
  }
}

