import type { LinkValue } from './types'

interface CalloutButton {
	label?: string
	url?: string | LinkValue
	target?: '_self' | '_blank'
}

interface HeroWithCalloutProps {
	title: string
	subtitle?: string | null
	callouts?: CalloutButton[] | null
	backgroundColor?: string
}

function getHrefFromUrl(url: string | LinkValue | undefined): string | undefined {
	if (!url) return undefined
	
	if (typeof url === 'string') {
		return url
	}
	
	if (url.kind === 'url') {
		return url.url
	}
	
	if (url.slug) {
		return url.locale
			? `/${encodeURIComponent(url.locale)}/${encodeURIComponent(url.slug)}`
			: `/${encodeURIComponent(url.slug)}`
	}
	
	return undefined
}

function getLinkTarget(url: string | LinkValue | undefined, fallbackTarget?: '_self' | '_blank'): '_self' | '_blank' {
	if (url && typeof url === 'object' && url.kind) {
		return url.target === '_blank' ? '_blank' : '_self'
	}
	return fallbackTarget || '_self'
}

export default function HeroWithCallout({
	title,
	subtitle,
	callouts,
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

				{callouts && callouts.length > 0 && (
					<div className="flex flex-col mb-8 lg:mb-12 space-y-4 sm:flex-row sm:justify-center sm:space-y-0 sm:space-x-4">
						{callouts.map((callout, index) => {
							const href = getHrefFromUrl(callout.url)
							const linkTarget = getLinkTarget(callout.url, callout.target)
							
							if (!callout.label || !href) return null
							
							return (
								<a
									key={index}
									href={href}
									target={linkTarget}
									rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
									className="inline-flex justify-center items-center py-3 px-5 text-sm sm:text-base font-medium text-center text-on-standout rounded-lg bg-standout hover:bg-standout/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-standout transition-colors"
								>
									{callout.label}
								</a>
							)
						})}
					</div>
				)}
			</div>
		</section>
	)
}


