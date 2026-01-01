import React from 'react'
import { motion } from 'framer-motion'

/**
 * A simple animated mesh background component.
 */
const SvgMesh: React.FC = () => (
	<div className="absolute inset-0 pointer-events-none opacity-[0.1] dark:opacity-[0.15] overflow-hidden">
		<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			<defs>
				<pattern id="mesh-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
					<path
						d="M 80 0 L 0 0 0 80"
						fill="none"
						stroke="currentColor"
						strokeWidth="0.5"
						opacity="0.3"
					/>
					<circle cx="0" cy="0" r="1" fill="currentColor" opacity="0.5" />
				</pattern>
			</defs>
			<motion.rect
				width="100%"
				height="100%"
				fill="url(#mesh-pattern)"
				animate={{
					x: [0, 20, 0],
					y: [0, 15, 0],
				}}
				transition={{
					duration: 20,
					repeat: Infinity,
					ease: 'linear',
				}}
			/>
		</svg>
		{/* Additional animated blobs for the mesh feel */}
		<motion.div
			animate={{
				scale: [1, 1.2, 1],
				opacity: [0.1, 0.2, 0.1],
			}}
			transition={{
				duration: 10,
				repeat: Infinity,
				ease: 'easeInOut',
			}}
			className="absolute top-0 left-0 w-full h-full bg-radial-gradient from-standout-low/20 to-transparent blur-3xl"
		/>
	</div>
)

export default SvgMesh

