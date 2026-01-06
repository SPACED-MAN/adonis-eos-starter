import { useState, useEffect } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { MediaRenderer } from '../components/MediaRenderer'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS, MEDIA_FIT_OPTIONS } from '#modules/shared_fields'
import { FontAwesomeIcon } from '../site/lib/icons'

interface CollageImage {
	image: {
		id: string
		url: string
		mimeType?: string
		altText?: string
		metadata?: any
	} | null
	size?: 'small' | 'medium' | 'large'
	label?: string
}

interface GalleryCollageProps {
	title?: string
	subtitle?: string
	images?: CollageImage[]
	scatter?: 'none' | 'low' | 'high'
	objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
	theme?: string
	backgroundImage?: any
	backgroundTint?: boolean
	__moduleId?: string
	_useReact?: boolean
}

export default function GalleryCollage({
	title: initialTitle,
	subtitle: initialSubtitle,
	images: initialImages = [],
	scatter: initialScatter = 'low',
	objectFit: initialObjectFit = 'contain',
	theme: initialTheme = 'transparent',
	backgroundImage: initialBackgroundImage,
	backgroundTint: initialBackgroundTint,
	__moduleId,
	_useReact,
}: GalleryCollageProps) {
	const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
	const { value: subtitle, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', initialSubtitle, { label: 'Subtitle' })
	const images = useInlineValue(__moduleId, 'images', initialImages) || []
	const scatter = useInlineValue(__moduleId, 'scatter', initialScatter) || 'low'
	const objectFit = useInlineValue(__moduleId, 'objectFit', initialObjectFit) || 'contain'
	const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
	const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
	const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

	const [selectedImageIdx, setSelectedImageIdx] = useState<number | null>(null)

	const styles = getSectionStyles(theme)
	const textColor = styles.textColor
	const subtextColor = styles.subtextColor

	const containerVariants: Variants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: { staggerChildren: 0.1 },
		},
	}

	const itemVariants: Variants = {
		hidden: { opacity: 0, scale: 0.9, y: 20 },
		visible: {
			opacity: 1,
			scale: 1,
			y: 0,
			transition: { duration: 0.5, ease: 'easeOut' }
		},
	}

	// Handle ESC key for lightbox
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setSelectedImageIdx(null)
		}
		window.addEventListener('keydown', handleEsc)
		return () => window.removeEventListener('keydown', handleEsc)
	}, [])

	const getSizeClasses = (size: string = 'medium') => {
		switch (size) {
			case 'small': return 'col-span-2 md:col-span-3 lg:col-span-2 aspect-square'
			case 'large': return 'col-span-4 md:col-span-6 lg:col-span-6 aspect-video'
			case 'medium':
			default: return 'col-span-4 md:col-span-6 lg:col-span-4 aspect-4/3'
		}
	}

	const getScatterStyles = (idx: number) => {
		if (scatter === 'none') return {}

		const intensity = scatter === 'high' ? 40 : 15
		// Deterministic "random" offsets based on index
		const x = (idx % 3 === 0 ? -1 : idx % 3 === 1 ? 0 : 1) * intensity
		const y = (idx % 2 === 0 ? -1 : 1) * (intensity / 2)

		return {
			transform: `translate(${x}px, ${y}px)`,
		}
	}

	return (
		<section
			className={`${styles.containerClasses} py-20 lg:py-32 relative overflow-hidden`}
			data-module="gallery-collage"
			data-inline-type="background"
			data-inline-path="theme"
			data-inline-label="Background & Theme"
			data-inline-options={JSON.stringify(THEME_OPTIONS)}
		>
			<SectionBackground
				backgroundImage={backgroundImage}
				backgroundTint={backgroundTint}
				isInteractive={_useReact}
			/>

			<div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
				{(showTitle || showSubtitle) && (
					<div className="mb-16 text-center max-w-3xl mx-auto">
						{showTitle && (
							<h2 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-4 ${textColor}`} {...titleProps}>
								{title}
							</h2>
						)}
						{showSubtitle && (
							<p className={`text-xl font-light ${subtextColor}`} {...subtitleProps}>
								{subtitle}
							</p>
						)}
					</div>
				)}

				<motion.div
					className="grid grid-cols-4 md:grid-cols-12 gap-4 md:gap-8 items-center"
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, margin: '-50px' }}
					variants={containerVariants}
				>
					{images.map((item: CollageImage, idx: number) => (
						<motion.div
							key={idx}
							variants={itemVariants}
							className={`relative group cursor-zoom-in transition-all duration-500 hover:scale-110 hover:z-30 flex items-center justify-center ${getSizeClasses(item.size)}`}
							style={getScatterStyles(idx)}
							onClick={() => setSelectedImageIdx(idx)}
							data-inline-type="select"
							data-inline-path="objectFit"
							data-inline-label="Media Fit"
							data-inline-options={JSON.stringify(MEDIA_FIT_OPTIONS)}
						>
							<div className="relative flex items-center justify-center w-full h-full overflow-visible">
								<div className="relative inline-block overflow-hidden rounded-lg shadow-2xl transition-shadow duration-500 group-hover:shadow-3xl">
									{item.image && (
										<MediaRenderer
											image={item.image}
											alt={item.image.altText || item.label || 'Collage Image'}
											objectFit={objectFit}
											className={`transition-all duration-700 ${objectFit === 'contain'
												? 'max-w-full max-h-full w-auto h-auto block'
												: 'w-full h-full object-cover block'
												}`}
										/>
									)}
									{item.label && (
										<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6 pointer-events-none">
											<p className="text-white font-medium text-sm md:text-base translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
												{item.label}
											</p>
										</div>
									)}
								</div>
							</div>
						</motion.div>
					))}
				</motion.div>
			</div>

			{/* Lightbox */}
			<AnimatePresence>
				{selectedImageIdx !== null && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 md:p-12 cursor-zoom-out"
						onClick={() => setSelectedImageIdx(null)}
					>
						<motion.div
							className="absolute top-8 right-8 text-white/60 hover:text-white transition-colors cursor-pointer p-2"
							whileHover={{ scale: 1.1 }}
							whileTap={{ scale: 0.9 }}
							onClick={() => setSelectedImageIdx(null)}
						>
							<FontAwesomeIcon icon="xmark" className="w-8 h-8" />
						</motion.div>

						{selectedImageIdx > 0 && (
							<div
								className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer p-4 z-10"
								onClick={(e) => { e.stopPropagation(); setSelectedImageIdx(selectedImageIdx - 1) }}
							>
								<FontAwesomeIcon icon="chevron-left" className="w-8 h-8 md:w-12 md:h-12" />
							</div>
						)}

						{selectedImageIdx < images.length - 1 && (
							<div
								className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer p-4 z-10"
								onClick={(e) => { e.stopPropagation(); setSelectedImageIdx(selectedImageIdx + 1) }}
							>
								<FontAwesomeIcon icon="chevron-right" className="w-8 h-8 md:w-12 md:h-12" />
							</div>
						)}

						<motion.div
							key={selectedImageIdx}
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.9, opacity: 0 }}
							transition={{ type: 'spring', damping: 25, stiffness: 200 }}
							className="relative max-w-full max-h-full flex flex-col items-center"
							onClick={(e) => e.stopPropagation()}
						>
							{images[selectedImageIdx].image && (
								<MediaRenderer
									image={images[selectedImageIdx].image}
									alt={images[selectedImageIdx].image?.altText || 'Enlarged view'}
									className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
								/>
							)}
							{images[selectedImageIdx].label && (
								<p className="mt-6 text-white text-lg font-light tracking-wide text-center">
									{images[selectedImageIdx].label}
								</p>
							)}
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</section>
	)
}

