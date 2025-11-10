/**
 * Shared types for module components
 * 
 * Common interfaces used across multiple content modules.
 */

export interface Button {
  label: string
  url: string
  style?: 'primary' | 'secondary' | 'outline'
  target?: '_self' | '_blank'
  rel?: string
}

export interface Image {
  url: string
  alt: string
  width?: number
  height?: number
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  caption?: string
}

export type TextAlignment = 'left' | 'center' | 'right'

export type Spacing = 
  | 'none' 
  | 'sm' 
  | 'md' 
  | 'lg' 
  | 'xl'
  | string // Allow custom Tailwind classes

export interface ColorTheme {
  background?: string
  text?: string
  accent?: string
}

