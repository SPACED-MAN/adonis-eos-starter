interface HeroProps {
	title: string
	subtitle?: string | null
	backgroundColor?: string
}

export default function Hero({
	title,
	subtitle,
	backgroundColor = 'bg-backdrop-low',
}: HeroProps) {
	return (
		<section className={`${backgroundColor} py-12 lg:py-16`} data-module="hero">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 text-center">
				<h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-tight text-neutral-high md:text-5xl lg:text-6xl">
					{title}
				</h1>
				{subtitle && (
					<p className="mb-8 text-lg font-normal text-neutral-medium lg:text-xl sm:px-4">
						{subtitle}
					</p>
				)}
			</div>
		</section>
	)
}

