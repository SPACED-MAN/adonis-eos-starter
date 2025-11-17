import { useEffect, useState } from 'react'

export function ThemeToggle() {
	const [mode, setMode] = useState<'light' | 'dark'>('light')

	function getCurrentMode(): 'light' | 'dark' {
		if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
			return 'dark'
		}
		const stored = (typeof window !== 'undefined' ? localStorage.getItem('theme-mode') : null) as 'light' | 'dark' | null
		if (stored) return stored
		if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
			return 'dark'
		}
		return 'light'
	}

	useEffect(() => {
		setMode(getCurrentMode())
		// Sync across tabs
		function onStorage(e: StorageEvent) {
			if (e.key === 'theme-mode') {
				setMode(getCurrentMode())
			}
		}
		window.addEventListener('storage', onStorage)
		// Observe class changes on <html>
		const observer = new MutationObserver(() => {
			setMode(getCurrentMode())
		})
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
		return () => {
			window.removeEventListener('storage', onStorage)
			observer.disconnect()
		}
	}, [])

	function toggle() {
		const root = document.documentElement
		const next = getCurrentMode() === 'dark' ? 'light' : 'dark'
		if (next === 'dark') {
			root.classList.add('dark')
		} else {
			root.classList.remove('dark')
		}
		localStorage.setItem('theme-mode', next)
		setMode(next)
	}

	return (
		<button
			type="button"
			onClick={toggle}
			className="inline-flex items-center rounded border border-border bg-backdrop-low px-3 py-1.5 text-sm text-neutral-high hover:bg-backdrop-medium"
			aria-label="Toggle dark mode"
		>
			{mode === 'dark' ? 'Light mode' : 'Dark mode'}
		</button>
	)
}


