import type { CustomFieldDefinition } from '#types/module_types'

/**
 * Standard theme options (semantic keys).
 */
export const THEME_OPTIONS = [
  { label: 'Transparent', value: 'transparent' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Standout', value: 'standout-low' },
  { label: 'Media', value: 'media' },
] as const

/**
 * Theme style metadata for both backend and frontend use.
 * Defines CSS classes, theme flags (inverted), and optional component rendering.
 */
export const THEME_STYLES: Record<
  string,
  {
    classes: string
    inverted: boolean
  }
> = {
  'transparent': { classes: 'bg-transparent text-neutral-high', inverted: false },
  'low': { classes: 'bg-backdrop-low text-neutral-high', inverted: false },
  'medium': { classes: 'bg-backdrop-medium text-neutral-high', inverted: false },
  'high': { classes: 'bg-backdrop-high text-neutral-high', inverted: false },
  'standout-low': { classes: 'bg-standout-low text-neutral-high', inverted: false },
  'media': { classes: 'bg-transparent text-neutral-high', inverted: false },
}

/**
 * Helper to get theme styles from a variant key
 */
export function getThemeMetadata(variant?: string) {
  if (!variant) return THEME_STYLES['transparent']
  return THEME_STYLES[variant] || THEME_STYLES['transparent']
}

/**
 * Standard theme field definition
 */
export const themeField: CustomFieldDefinition = {
  slug: 'theme',
  type: 'select',
  label: 'Theme',
  options: [...THEME_OPTIONS],
  required: false,
  description: 'Section visual theme',
}

/**
 * Standard media background group and fields
 */
export const mediaBackgroundFields: CustomFieldDefinition[] = [
  {
    slug: 'media_background_group',
    type: 'group',
    label: 'Media Background',
    description: 'Background image and tint settings for Media theme',
    showIf: {
      field: 'theme',
      equals: 'media',
    },
  },
  {
    slug: 'backgroundImage',
    type: 'media',
    label: 'Background Image',
    required: false,
    config: { storeAs: 'id' },
    description: 'Background image to display behind the content',
  },
  {
    slug: 'backgroundTint',
    type: 'boolean',
    label: 'Background Tint',
    required: false,
    description:
      'Apply a light tint in light mode and dark tint in dark mode to improve text visibility over the background image',
    default: false,
  },
]

/**
 * Standard media fit options
 */
export const MEDIA_FIT_OPTIONS = [
  { label: 'Cover', value: 'cover' },
  { label: 'Contain', value: 'contain' },
  { label: 'Fill', value: 'fill' },
  { label: 'Scale Down', value: 'scale-down' },
  { label: 'None', value: 'none' },
] as const

/**
 * Standard media fit options field
 */
export const mediaFitField: CustomFieldDefinition = {
  slug: 'objectFit',
  type: 'select',
  label: 'Media Fit',
  options: [...MEDIA_FIT_OPTIONS],
  required: false,
  description: 'How the media should fit within its container',
  default: 'cover',
}

/**
 * Standard Lipsum text for default module props
 */
export const LIPSUM_TITLE = 'Lorem Ipsum Dolor'
export const LIPSUM_SUBTITLE =
  'Consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore.'
export const LIPSUM_PARAGRAPH =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
export const LIPSUM_CTA = 'Lorem Ipsum'
