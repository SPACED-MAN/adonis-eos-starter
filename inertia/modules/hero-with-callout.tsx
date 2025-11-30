interface HeroWithCalloutProps {
	title: string
	subtitle?: string | null
	primaryCta?: { label?: string; url?: string; target?: '_self' | '_blank' } | null
	backgroundColor?: string
}

export default function HeroWithCallout({
	title,
	subtitle,
	primaryCta,
	backgroundColor = 'bg-backdrop-low',
}: HeroWithCalloutProps) {
	return (
		<section className={`${backgroundColor} py-12 lg:py-16`} data-module="hero-with-callout">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 text-center">
				<h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-tight text-neutral-high md:text-5xl lg:text-6xl">
					{title}
				</h1>
				{subtitle && (
					<p className="mb-8 text-lg font-normal text-neutral-medium lg:text-xl sm:px-4">
						{subtitle}
					</p>
				)}

				{primaryCta && primaryCta.label && primaryCta.url && (
					<div className="flex flex-col mb-8 lg:mb-12 space-y-4 sm:flex-row sm:justify-center sm:space-y-0 sm:space-x-4">
						<a
							href={primaryCta.url}
							target={primaryCta.target || '_self'}
							rel={primaryCta.target === '_blank' ? 'noopener noreferrer' : undefined}
							className="inline-flex justify-center items-center py-3 px-5 text-sm sm:text-base font-medium text-center text-on-standout rounded-lg bg-standout hover:bg-standout/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-standout transition-colors"
						>
							{primaryCta.label}
						</a>
					</div>
				)}
			</div>
		</section>
	)
}


