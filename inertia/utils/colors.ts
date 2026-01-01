import { getThemeMetadata } from '#modules/shared_fields'

/**
 * Resolves comprehensive styles for a section based on its theme variant.
 * Provides CSS classes, theme flags, and derived colors to avoid repetitive logic.
 */
export function getSectionStyles(variant?: string) {
	const meta = getThemeMetadata(variant)

	return {
		/** Root container classes (background + default text color) */
		containerClasses: meta.classes,
		/** Theme flags */
		inverted: meta.inverted,
		/** Optional special background component name */
		backgroundComponent: meta.component,

		/** Derived semantic text colors */
		textColor: meta.inverted ? 'text-on-high' : 'text-neutral-high',
		subtextColor: meta.inverted ? 'text-on-high/80' : 'text-neutral-medium',
		quoteIconColor: meta.inverted ? 'text-on-high/40' : 'text-neutral-low',

		/** Typography helper */
		proseInvert: meta.inverted ? 'prose-invert' : '',

		/** Button style variants */
		buttonStyles: {
			primary: meta.inverted,
			secondary: meta.inverted,
			outline: meta.inverted,
		},
	}
}

/**
 * Type guard/helper for background components
 */
export type BackgroundVariantKey = string
