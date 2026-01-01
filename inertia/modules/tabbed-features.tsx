import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { MediaRenderer } from '../components/MediaRenderer'
import { renderLexicalToHtml } from '../utils/lexical'
import { FontAwesomeIcon } from '../site/lib/icons'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS, MEDIA_FIT_OPTIONS } from '#modules/shared_fields'

interface TabItem {
	label: string
	prose?: any // Lexical JSON
	image?: {
		id: string
		url: string
		mimeType?: string
		altText?: string
		metadata?: any
	} | null
}

interface TabbedFeaturesProps {
  title?: string
  subtitle?: string
  tabs: TabItem[]
  layout?: 'top' | 'left' | 'right'
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
  __moduleId?: string
  _useReact?: boolean
}

export default function TabbedFeatures({
  title: initialTitle,
  subtitle: initialSubtitle,
  tabs: initialTabs = [],
  layout: initialLayout = 'top',
  objectFit: initialObjectFit = 'contain',
  theme: initialTheme = 'transparent',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: TabbedFeaturesProps) {
  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
  const { value: subtitle, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', initialSubtitle, { label: 'Subtitle' })
  const tabs = useInlineValue(__moduleId, 'tabs', initialTabs) || []
  const layout = useInlineValue(__moduleId, 'layout', initialLayout) || 'top'
  const objectFit = useInlineValue(__moduleId, 'objectFit', initialObjectFit)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
	const textColor = styles.textColor
	const subtextColor = styles.subtextColor

	const [activeTab, setActiveTab] = useState(0)
	const currentTab = tabs[activeTab] || tabs[0] || null
	const isVertical = layout === 'left' || layout === 'right'

	const header = (showTitle || showSubtitle) && (
		<div className={`mb-12 ${layout === 'top' ? 'text-center max-w-3xl mx-auto' : 'text-left'}`}>
			{showTitle && (
				<h2 className={`text-3xl md:text-4xl font-extrabold tracking-tight mb-4 ${textColor}`} {...titleProps}>
					{title}
				</h2>
			)}
			{showSubtitle && (
				<p className={`text-lg ${subtextColor}`} {...subtitleProps}>
					{subtitle}
				</p>
			)}
		</div>
	)

	const tabList = (
		<div
			className={`flex ${isVertical ? 'flex-col space-y-4' : 'flex-row space-x-2 border-b border-line-low mb-12 overflow-hidden no-scrollbar'
				}`}
		>
			{tabs.map((tab: TabItem, idx: number) => {
				const isActive = activeTab === idx
				return (
					<button
						key={idx}
						onClick={() => setActiveTab(idx)}
						className={`group relative px-6 py-4 text-left transition-all duration-300 ${isActive
							? `bg-backdrop-medium border-line-medium ${textColor}`
							: `border-transparent opacity-60 hover:opacity-100 ${subtextColor} hover:bg-backdrop-medium/30`
							} ${!isVertical ? 'min-w-[160px]' : 'w-full'}`}
					>
						<div className="flex items-center justify-between">
							<span className={`font-bold ${isVertical ? 'text-lg' : 'text-sm'}`}>
								{tab.label || `Tab ${idx + 1}`}
							</span>
							{isVertical && (
								<FontAwesomeIcon
									icon="chevron-right"
									className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'translate-x-1' : 'opacity-0'}`}
								/>
							)}
						</div>
						{!isVertical && isActive && (
							<motion.div
								layoutId="activeTabUnderline"
								className="absolute -bottom-px left-0 right-0 h-1 bg-standout-high z-10"
							/>
						)}
						{isVertical && isActive && (
							<motion.div
								layoutId="activeTabIndicator"
								className="absolute left-0 top-0 bottom-0 w-1 bg-standout-high rounded-full"
							/>
						)}
					</button>
				)
			})}
		</div>
	)

	const contentSection = (
		<div className="relative">
			<AnimatePresence mode="wait">
				<motion.div
					key={activeTab}
					initial={{ opacity: 0, y: 20, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -20, scale: 0.98 }}
					transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
					className="flex flex-col space-y-12"
				>
					{currentTab?.image && (
						<div className="w-full">
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.1, duration: 0.6 }}
								className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border border-line-low bg-backdrop-high group"
								data-inline-type="select"
								data-inline-path="objectFit"
								data-inline-label="Media Fit"
								data-inline-options={JSON.stringify(MEDIA_FIT_OPTIONS)}
							>
								<div
									className="w-full h-full"
									data-inline-type="media"
									data-inline-path={`tabs[${activeTab}].image`}
								>
									<MediaRenderer
										image={currentTab.image}
										alt={currentTab.image.altText || currentTab.label}
										objectFit={objectFit}
										className="w-full h-full transition-transform duration-700 group-hover:scale-105"
									/>
								</div>
								<div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />
							</motion.div>
						</div>
					)}

					<div className="space-y-8">
						{currentTab && (
							<div className="space-y-6">
								{currentTab.prose && (
									<div
										className={`prose prose-lg max-w-none ${styles.proseInvert} ${subtextColor}`}
										dangerouslySetInnerHTML={{
											__html: renderLexicalToHtml(currentTab.prose),
										}}
										data-inline-type="richtext"
										data-inline-path={`tabs[${activeTab}].prose`}
									/>
								)}
							</div>
						)}
					</div>
				</motion.div>
			</AnimatePresence>
		</div>
	)

	return (
		<section
			className={`${styles.containerClasses} py-20 lg:py-32 overflow-hidden relative`}
			data-module="tabbed-features"
			data-inline-type="background"
			data-inline-path="theme"
			data-inline-label="Background & Theme"
			data-inline-options={JSON.stringify(THEME_OPTIONS)}
		>
			<SectionBackground
        component={styles.backgroundComponent}
        backgroundImage={backgroundImage}
        backgroundTint={backgroundTint}
        isInteractive={_useReact}
      />
			<div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
				{layout === 'top' && (
					<>
						{header}
						{tabList}
						{contentSection}
					</>
				)}

				{layout === 'left' && (
					<div className="grid gap-16 lg:grid-cols-[320px_1fr]">
						<div className="space-y-8">
							{header}
							{tabList}
						</div>
						<div className="min-h-[400px]">
							{contentSection}
						</div>
					</div>
				)}

				{layout === 'right' && (
					<div className="grid gap-16 lg:grid-cols-[1fr_320px]">
						<div className="min-h-[400px]">
							{contentSection}
						</div>
						<div className="space-y-8">
							{header}
							{tabList}
						</div>
					</div>
				)}
			</div>
		</section>
	)
}
