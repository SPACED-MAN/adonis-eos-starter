interface TestimonialTeaserProps {
	id: string
	quote?: string | null
	authorName: string
	authorTitle?: string | null
	imageUrl?: string | null
}

export default function TestimonialTeaser({ quote, authorName, authorTitle, imageUrl }: TestimonialTeaserProps) {
	return (
		<figure className="flex flex-col justify-center items-center p-8 text-center bg-backdrop-medium border border-line-low md:p-10 lg:border-r-0 last:lg:border-r dark:border-none">
			<blockquote className="mx-auto mb-6 max-w-2xl text-neutral-high">
				{quote && (
					<p className="my-4 text-sm md:text-base">
						"{quote}"
					</p>
				)}
			</blockquote>
			<figcaption className="flex justify-center items-center space-x-4">
				{imageUrl && (
					<img
						className="w-14 h-14 rounded-full object-cover"
						src={imageUrl}
						alt={authorName}
						loading="lazy"
						decoding="async"
					/>
				)}
				<div className="space-y-0.5 font-medium text-left">
					<div className="text-neutral-high">{authorName}</div>
					{authorTitle && (
						<div className="text-xs font-light text-neutral-medium">
							{authorTitle}
						</div>
					)}
				</div>
			</figcaption>
		</figure>
	)
}


