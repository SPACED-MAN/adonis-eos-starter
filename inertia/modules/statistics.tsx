import { useEffect, useRef, useState } from 'react'

interface StatItem {
	value: number
	suffix?: string | null
	label: string
}

interface StatisticsProps {
	stats: StatItem[]
	backgroundColor?: string
}

function useCountUp(target: number, shouldStart: boolean, durationMs = 1200) {
	const [value, setValue] = useState(0)
	const frameRef = useRef<number | null>(null)

	useEffect(() => {
		if (!shouldStart) return
		if (target <= 0) {
			setValue(target)
			return
		}

		const start = performance.now()

		const step = (timestamp: number) => {
			const progress = Math.min((timestamp - start) / durationMs, 1)
			const eased = 1 - Math.pow(1 - progress, 3) // ease-out
			const next = Math.round(target * eased)
			setValue(next)
			if (progress < 1) {
				frameRef.current = requestAnimationFrame(step)
			}
		}

		frameRef.current = requestAnimationFrame(step)
		return () => {
			if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
		}
	}, [target, shouldStart, durationMs])

	return value
}

export default function Statistics({ stats, backgroundColor = 'bg-backdrop-low' }: StatisticsProps) {
	const [hasEntered, setHasEntered] = useState(false)
	const sectionRef = useRef<HTMLElement | null>(null)

	useEffect(() => {
		const el = sectionRef.current
		if (!el) return

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setHasEntered(true)
						observer.disconnect()
						break
					}
				}
			},
			{
				threshold: 0.3,
			}
		)

		observer.observe(el)
		return () => observer.disconnect()
	}, [])

	const safeStats = Array.isArray(stats) ? stats.slice(0, 12) : []

	return (
		<section
			ref={sectionRef}
			className={`${backgroundColor} py-12 lg:py-16`}
			data-module="statistics"
		>
			<div className="max-w-screen-xl px-4 mx-auto text-center">
				<dl className="grid max-w-screen-md gap-8 mx-auto text-neutral-high sm:grid-cols-3">
					{safeStats.map((stat, idx) => {
						const animatedValue = useCountUp(stat.value || 0, hasEntered)
						const formatted =
							stat.value >= 1_000_000_000
								? `${Math.round(animatedValue / 1_000_000_000)}B`
								: stat.value >= 1_000_000
									? `${Math.round(animatedValue / 1_000_000)}M`
									: stat.value >= 1_000
										? `${Math.round(animatedValue / 1_000)}K`
										: animatedValue.toLocaleString()

						return (
							<div key={idx} className="flex flex-col items-center justify-center">
								<dt className="mb-2 text-3xl md:text-4xl font-extrabold">
									{formatted}
									{stat.suffix ? stat.suffix : ''}
								</dt>
								<dd className="font-light text-neutral-medium">
									{stat.label}
								</dd>
							</div>
						)
					})}
				</dl>
			</div>
		</section>
	)
}





