import React from 'react'
import SvgMesh from './SvgMesh'

/**
 * Map of specialized background components that can be triggered by variants.
 */
const BACKGROUND_COMPONENTS: Record<string, React.FC> = {
	SvgMesh: SvgMesh,
}

interface SectionBackgroundProps {
	/** The name of the specialized component to render (from metadata) */
	component?: string
}

/**
 * Renders specialized background animations/components for a section.
 * Used for DRY implementation of complex background styles.
 */
export const SectionBackground: React.FC<SectionBackgroundProps> = ({ component }) => {
	if (!component) return null

	const Component = BACKGROUND_COMPONENTS[component]
	if (!Component) return null

	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
			<Component />
		</div>
	)
}
