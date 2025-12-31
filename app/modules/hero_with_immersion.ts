import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'
import { backgroundColorField } from './shared_fields.js'

export default class HeroWithImmersionModule extends BaseModule {
  /**
   * Immersive modules rely heavily on Framer Motion for scroll-driven animations.
   * We use 'hybrid' mode to ensure SSR for content while enabling React hydration
   * for the interactive bits.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'hero-with-immersion',
      name: 'Hero with Immersion',
      description: 'A cinematic two-column hero section with scroll-driven parallax effects and layered depth.',
      icon: 'wand-magic-sparkles',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['hero', 'intro'],
        useWhen: [
          'You want a high-impact, visual-heavy opening section.',
          'The brand positioning requires a modern, interactive feel.',
          'You have high-quality transparent images to layer for parallax.',
          'You want a balanced two-column layout with text and a foreground element on opposite sides.',
        ],
        avoidWhen: [
          'The page needs to be extremely lightweight (though this is optimized).',
          'Content is strictly informational without a need for visual flair.',
        ],
        compositionNotes:
          'Works best with a high-contrast background and a transparent foreground element (e.g., a product cutout). Content and foreground are arranged in two columns on large screens; position can be swapped.',
      },
      fieldSchema: [
        {
          slug: 'content_tab',
          type: 'tab',
          label: 'Content',
        },
        {
          slug: 'title',
          type: 'text',
          label: 'Title',
          required: true,
          translatable: true,
          description: 'The main headline that will float in the middle layer.',
          isLabel: true,
        },
        {
          slug: 'subtitle',
          type: 'textarea',
          label: 'Subtitle',
          translatable: true,
          description: 'Supporting text that moves slightly slower than the title.',
        },
        {
          slug: 'backgroundImage',
          type: 'media',
          label: 'Background Layer',
          description: 'The furthest layer. Works best with landscapes or textures.',
          accept: 'image/*',
          config: { storeAs: 'id' },
        },
        {
          slug: 'foregroundImage',
          type: 'media',
          label: 'Foreground Layer',
          description:
            'The closest layer. Use a transparent PNG for the best parallax effect (e.g., a person or product).',
          accept: 'image/*',
          config: { storeAs: 'id' },
        },
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        {
          slug: 'imagePosition',
          type: 'select',
          label: 'Image Position',
          description: 'Which side the foreground image appears on for large screens',
          options: [
            { label: 'Right', value: 'right' },
            { label: 'Left', value: 'left' },
          ],
        },
        {
          slug: 'height',
          type: 'select',
          label: 'Section Height',
          description: 'How much vertical space the section occupies.',
          options: [
            { label: 'Full Screen', value: 'h-screen' },
            { label: 'Tall (75vh)', value: 'h-[75vh]' },
            { label: 'Medium (50vh)', value: 'h-[50vh]' },
          ],
        },
        {
          slug: 'parallaxIntensity',
          type: 'select',
          label: 'Parallax Intensity',
          description: 'How strong the depth effect is when scrolling.',
          options: [
            { label: 'Subtle', value: 'subtle' },
            { label: 'Moderate', value: 'moderate' },
            { label: 'Dramatic', value: 'dramatic' },
          ],
        },
        backgroundColorField,
      ],
      defaultValues: {
        title: 'Experience the Depth',
        subtitle: 'A beautiful demonstration of immersive storytelling through scroll-driven interactivity.',
        imagePosition: 'right',
        height: 'h-screen',
        parallaxIntensity: 'moderate',
        backgroundColor: 'bg-black',
      },
      allowedPostTypes: [],
    }
  }
}

