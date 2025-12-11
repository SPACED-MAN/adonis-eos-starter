import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import type { Button, LinkValue } from './types'

interface ExpandedFeatureItem {
	icon?: string | null
	title: string
	body: string
}

interface FeaturesListExpandedProps {
	title: string
	subtitle?: string | null
	features: ExpandedFeatureItem[]
	cta?: Button | null
	backgroundColor?: string
	__moduleId?: string
}

function resolveHrefAndTarget(
	url: string | LinkValue,
	explicitTarget?: '_self' | '_blank'
): { href?: string; target: '_self' | '_blank' } {
	let href: string | undefined
	let target: '_self' | '_blank' = '_self'

	if (!url) {
		return { href: undefined, target }
	}

	if (typeof url === 'string') {
		href = url
		target = explicitTarget || '_self'
		return { href, target }
	}

	if (url.kind === 'url') {
		href = url.url
	} else if (url.slug && url.locale) {
		href = `/${encodeURIComponent(url.locale)}/${encodeURIComponent(url.slug)}`
	} else if (url.slug) {
		href = `/${encodeURIComponent(url.slug)}`
	}

	const linkTarget = url.target === '_blank' ? '_blank' : '_self'
	target = explicitTarget || linkTarget

	return { href, target }
}

export default function FeaturesListExpanded({
	title: initialTitle,
	subtitle: initialSubtitle,
	features: initialFeatures,
	cta: initialCta,
	backgroundColor = 'bg-backdrop-low',
	__moduleId,
}: FeaturesListExpandedProps) {
	const title = useInlineValue(__moduleId, 'title', initialTitle)
	const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
	const features = useInlineValue(__moduleId, 'features', initialFeatures)
	const cta = useInlineValue(__moduleId, 'cta', initialCta)

	const safeFeatures = Array.isArray(features) ? features.slice(0, 12) : []

	const hasCta = Boolean(cta && cta.label && cta.url)

	return (
		<section
			className={`${backgroundColor} py-12 sm:py-16`}
			data-module="features-list-expanded"
		>
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="max-w-3xl mx-auto mb-10 text-center">
					<h2
						className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-high mb-4"
						data-inline-path="title"
					>
						{title}
					</h2>
					{subtitle && (
						<p className="text-neutral-medium text-base sm:text-lg" data-inline-path="subtitle">
							{subtitle}
						</p>
					)}
				</div>

				{safeFeatures.map((feature, idx) => {
					const isEven = idx % 2 === 0

					return (
						<div
							key={idx}
							className={`flex items-center lg:w-3/5 mx-auto border-b border-line-low pb-10 mb-10 sm:flex-row flex-col ${!isEven ? 'sm:flex-row-reverse' : ''
								}`}
							data-inline-type="object"
							data-inline-path={`features.${idx}`}
							data-inline-label={`Feature ${idx + 1}`}
							data-inline-fields={JSON.stringify([
								{
									name: 'icon', type: 'select', label: 'Icon', options: [
										{ label: 'check', value: 'check' },
										{ label: 'bolt', value: 'bolt' },
										{ label: 'gear', value: 'gear' },
										{ label: 'circle-question', value: 'circle-question' },
										{ label: 'rocket', value: 'rocket' },
										{ label: 'palette', value: 'palette' },
									]
								},
								{ name: 'title', type: 'text', label: 'Title' },
								{ name: 'body', type: 'textarea', label: 'Body' },
							])}
						>
							{feature.icon && (
								<div
									className={`sm:w-32 sm:h-32 h-16 w-16 ${isEven ? 'sm:mr-10' : 'sm:ml-10'
										} inline-flex items-center justify-center rounded-full bg-standout/10 text-standout shrink-0`}
								>
									<FontAwesomeIcon
										icon={feature.icon as any}
										size="2x"
									/>
								</div>
							)}

							<div className="grow sm:text-left text-center mt-6 sm:mt-0">
								<h3 className="text-neutral-high text-lg sm:text-xl font-semibold mb-2" data-inline-path={`features.${idx}.title`}>
									{feature.title}
								</h3>
								<p className="leading-relaxed text-sm sm:text-base text-neutral-medium" data-inline-path={`features.${idx}.body`}>
									{feature.body}
								</p>
							</div>
						</div>
					)
				})}

				{hasCta && cta && (
					<SectionButton
						label={cta?.label}
						url={cta?.url}
						style={cta?.style || 'primary'}
						target={cta?.target}
						rel={cta?.rel}
						inlinePath="cta"
					/>
				)}
			</div>
		</section>
	)
}

function SectionButton({ label, url, style = 'primary', target, rel, inlinePath }: Button & { inlinePath?: string }) {
	const styleClasses =
		{
			primary: 'bg-standout text-on-standout',
			secondary: 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
			outline: 'border border-line-low hover:bg-backdrop-medium text-neutral-high',
		}[style] || 'bg-standout text-on-standout'

	const { href, target: finalTarget } = resolveHrefAndTarget(url, target)
	if (!href) return null

	return (
		<div className="flex justify-center mt-12">
			<a
				href={href}
				target={finalTarget}
				rel={finalTarget === '_blank' ? 'noopener noreferrer' : rel}
				className={`inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg transition-colors duration-200 ${styleClasses}`}
				data-inline-type="link"
				data-inline-path={inlinePath ? `${inlinePath}.url` : undefined}
			>
				<span data-inline-path={inlinePath ? `${inlinePath}.label` : undefined}>{label}</span>
			</a>
		</div>
	)
}


