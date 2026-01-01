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
  'svg-mesh': { classes: 'bg-backdrop-low text-neutral-high', inverted: false, component: 'SvgMesh' },
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
