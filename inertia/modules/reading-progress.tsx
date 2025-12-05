import { useEffect, useState } from 'react'

interface ReadingProgressProps {
	position?: 'top' | 'bottom'
	height?: number
	zIndex?: number
}

export default function ReadingProgress({
	position = 'top',
	height = 4,
	zIndex = 50,
}: ReadingProgressProps) {
	const [progress, setProgress] = useState(0)

	useEffect(() => {
		const updateProgress = () => {
			// Get the document height minus the viewport height
			const windowHeight = window.innerHeight
			const documentHeight = document.documentElement.scrollHeight
			const scrollableHeight = documentHeight - windowHeight

			// If there's nothing to scroll, show 100%
			if (scrollableHeight <= 0) {
				setProgress(100)
				return
			}

			// Calculate current scroll position as a percentage
			const scrolled = window.scrollY
			const progressPercentage = (scrolled / scrollableHeight) * 100

			// Clamp between 0 and 100
			setProgress(Math.min(100, Math.max(0, progressPercentage)))
		}

		// Update on mount
		updateProgress()

		// Update on scroll
		window.addEventListener('scroll', updateProgress, { passive: true })
		// Update on resize (in case content changes)
		window.addEventListener('resize', updateProgress, { passive: true })

		return () => {
			window.removeEventListener('scroll', updateProgress)
			window.removeEventListener('resize', updateProgress)
		}
	}, [])

	const positionStyles =
		position === 'top'
			? { top: 0 }
			: { bottom: 0 }

	return (
		<div
			className="fixed left-0 right-0 bg-backdrop-medium"
			style={{
				...positionStyles,
				height: `${height}px`,
				zIndex,
			}}
			aria-hidden="true"
			data-module="reading-progress"
		>
			<div
				className="h-full bg-standout transition-all duration-150 ease-out"
				style={{
					width: `${progress}%`,
				}}
			/>
		</div>
	)
}



