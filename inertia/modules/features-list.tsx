interface FeatureItem {
	icon?: string | null
	title: string
	body: string
}

interface FeaturesListProps {
	title: string
	subtitle?: string | null
	features: FeatureItem[]
	backgroundColor?: string
}

export default function FeaturesList({ title, subtitle, features, backgroundColor = 'bg-backdrop-low' }: FeaturesListProps) {
	const safeFeatures = Array.isArray(features) ? features.slice(0, 24) : []

	return (
		<section className={`${backgroundColor} py-12 sm:py-16`} data-module="features-list">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="max-w-2xl lg:max-w-3xl mb-8 lg:mb-12">
					<h2 className="mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-high">
						{title}
					</h2>
					{subtitle && (
						<p className="text-neutral-medium text-base sm:text-lg">
							{subtitle}
						</p>
					)}
				</div>

				{safeFeatures.length > 0 && (
					<div className="space-y-8 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8 md:space-y-0">
						{safeFeatures.map((feature, idx) => (
							<div key={idx} className="flex flex-col">
								{feature.icon && (
									<div className="flex justify-center items-center mb-4 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-standout/10 text-standout">
										<i className={`${feature.icon} text-base lg:text-lg`} aria-hidden="true" />
									</div>
								)}
								<h3 className="mb-2 text-lg sm:text-xl font-semibold text-neutral-high">
									{feature.title}
								</h3>
								<p className="text-sm sm:text-base text-neutral-medium">
									{feature.body}
								</p>
							</div>
						))}
					</div>
				)}
			</div>
		</section>
	)
}


