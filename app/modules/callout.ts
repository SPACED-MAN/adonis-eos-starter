import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

import { themeField, mediaBackgroundFields, mediaFitField } from './shared_fields.js'

/**
 * Callout Module
 *
 * A high-impact section designed to drive conversions.
 * Features a heading, rich text description, supporting media,
 * and a list of action buttons.
 */
export default class CalloutModule extends BaseModule {
  /**
   * Callout supports hybrid rendering for animations.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  /**
   * Module configuration
   */
  getConfig(): ModuleConfig {
    return {
      type: 'callout',
      name: 'Callout',
      description: 'Engaging call-to-action block with heading, text, media, and multiple buttons',
      icon: 'megaphone',
      allowedScopes: ['local', 'global'],
      lockable: true,
      aiGuidance: {
        layoutRoles: ['callout', 'cta', 'bottom-bar', 'signup'],
        keywords: ['cta', 'call to action', 'callout', 'signup', 'conversion'],
        useWhen: [
          'You want to prompt the user to take a specific action (sign up, buy, contact).',
          'You need a high-visibility block to highlight a single offer or message.',
        ],
        avoidWhen: [
          'You need to present a long list of options; use a features or list module instead.',
          'You are at the very top of a page; prefer a Hero module for the primary fold.',
        ],
        compositionNotes:
          'Typically placed near the bottom of a page or after a persuasive prose section.',
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
          label: 'Heading',
          required: true,
          description: 'The main attention-grabbing headline',
          translatable: true,
          isLabel: true,
        },
        {
          slug: 'prose',
          type: 'richtext',
          label: 'Prose',
          required: false,
          description: 'Supporting description text (Lexical JSON)',
          translatable: true,
        },
        {
          slug: 'image',
          type: 'media',
          label: 'Supporting Media',
          accept: 'image/*,video/*',
          config: { storeAs: 'id' },
          description: 'Optional image or video to accompany the message',
        },
        {
          slug: 'ctas',
          type: 'repeater',
          label: 'Buttons',
          description: 'One or more call-to-action buttons',
          item: {
            slug: 'cta',
            type: 'object',
            label: 'Button',
            fields: [
              {
                slug: 'label',
                type: 'text',
                label: 'Label',
                required: true,
                translatable: true,
                isLabel: true,
              },
              {
                slug: 'url',
                type: 'link',
                label: 'Destination',
                required: true,
              },
              {
                slug: 'style',
                type: 'select',
                label: 'Style',
                options: [
                  { label: 'Primary', value: 'primary' },
                  { label: 'Secondary', value: 'secondary' },
                  { label: 'Outline', value: 'outline' },
                ],
              },
            ],
          },
        },
        {
          slug: 'design_tab',
          type: 'tab',
          label: 'Design',
        },
        {
          slug: 'variant',
          type: 'select',
          label: 'Layout Variant',
          options: [
            { label: 'Centered', value: 'centered' },
            { label: 'Split (Image Left)', value: 'split-left' },
            { label: 'Split (Image Right)', value: 'split-right' },
          ],
        },
        mediaFitField,
        themeField,
        ...mediaBackgroundFields,
      ],
      defaultValues: {
        title: 'Lorem ipsum dolor sit amet',
        prose: null,
        ctas: [
          { label: 'Lorem Ipsum', url: '#', style: 'primary' },
          { label: 'Dolor Sit', url: '#', style: 'outline' },
        ],
        variant: 'centered',
        objectFit: 'cover',
        theme: 'low',
      },
      allowedPostTypes: [],
    }
  }
}
