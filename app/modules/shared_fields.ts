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
  { label: 'SVG Mesh', value: 'svg-mesh' },
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
    component?: string
  }
> = {
  'transparent': { classes: 'bg-transparent text-neutral-high', inverted: false },
  'low': { classes: 'bg-backdrop-low text-neutral-high', inverted: false },
  'medium': { classes: 'bg-backdrop-medium text-neutral-high', inverted: false },
  'high': { classes: 'bg-backdrop-high text-neutral-high', inverted: false },
  'standout-low': { classes: 'bg-standout-low text-neutral-high', inverted: false },
  'svg-mesh': {
    classes: 'bg-backdrop-low text-neutral-high',
    inverted: false,
    component: 'SvgMesh',
  },
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
 * Standard media mask options
 */
export const mediaMaskField: CustomFieldDefinition = {
  slug: 'maskShape',
  type: 'select',
  label: 'Media Mask',
  options: [
    { label: 'None', value: 'none' },
    { label: 'Checkmark', value: 'checkmark' },
  ],
  required: false,
  description: 'Apply a custom shape to the media block',
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
