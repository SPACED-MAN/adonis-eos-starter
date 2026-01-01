import React, { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import SvgMesh from './SvgMesh'
import { MediaRenderer } from './MediaRenderer'

/**
 * Map of specialized background components that can be triggered by variants.
 */
const BACKGROUND_COMPONENTS: Record<string, React.FC> = {
	SvgMesh: SvgMesh,
}

interface SectionBackgroundProps {
	/** The name of the specialized component to render (from metadata) */
	component?: string
	/** Background image/video to display */
	backgroundImage?: any
	/** Whether to apply a tint overlay */
	backgroundTint?: boolean
	/** Whether to enable interactivity/animations */
	isInteractive?: boolean
}

/**
 * Renders specialized background animations/components for a section.
 * Used for DRY implementation of complex background styles.
 */
export const SectionBackground: React.FC<SectionBackgroundProps> = ({
	component,
	backgroundImage,
	backgroundTint,
	isInteractive,
}) => {
	const containerRef = useRef<HTMLDivElement>(null)

	// Scroll-linked parallax effect
	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ['start end', 'end start'],
	})

	// Transform scroll progress to a slight Y translation for parallax
	// We move the image slightly slower than the scroll speed
	const yParallax = useTransform(scrollYProgress, [0, 1], ['-8%', '8%'])

	// Smoothen the parallax effect
	const springY = useSpring(yParallax, {
		stiffness: 100,
		damping: 30,
		restDelta: 0.001,
	})

	const mediaBackground = backgroundImage && (
		<div className="absolute inset-0">
			{isInteractive ? (
				<motion.div
					style={{ y: springY, scale: 1.2 }}
					className="w-full h-full"
				>
					<MediaRenderer image={backgroundImage} className="w-full h-full object-cover" />
				</motion.div>
			) : (
				<MediaRenderer image={backgroundImage} className="w-full h-full object-cover" />
			)}
		</div>
	)

	return (
		<div
			ref={containerRef}
			className="absolute inset-0 pointer-events-none overflow-hidden z-0"
		>
			{/* 1. Specialized Background Component (e.g. SvgMesh) */}
			{component && BACKGROUND_COMPONENTS[component] && (
				<div className="absolute inset-0">
					{React.createElement(BACKGROUND_COMPONENTS[component])}
				</div>
			)}

			{/* 2. Media Background */}
			{mediaBackground}

			{/* 3. Tint Overlay */}
			{backgroundTint && (
				<div className="absolute inset-0 bg-backdrop-high/20 dark:bg-black/40 z-[1]" />
			)}
		</div>
	)
}
