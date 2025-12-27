import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '../site/lib/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'

export function ThemeToggle() {
  const [mode, setMode] = useState<'light' | 'dark'>('light')

  function getCurrentMode(): 'light' | 'dark' {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'dark'
    }
    const stored = (typeof window !== 'undefined' ? localStorage.getItem('theme-mode') : null) as
      | 'light'
      | 'dark'
      | null
    if (stored) return stored
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
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
    // Set a plain cookie for the server to read (expires in 1 year)
    document.cookie = `theme-mode=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    setMode(next)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-full bg-backdrop-high dark:bg-neutral-low text-neutral-high dark:text-backdrop-low hover:bg-neutral-high hover:text-backdrop-low hover:dark:bg-neutral-high hover:dark:text-backdrop-low"
          aria-label="Toggle dark mode"
        >
          {mode === 'dark' ? (
            <FontAwesomeIcon icon={['fas', 'sun']} className="text-md" />
          ) : (
            <FontAwesomeIcon icon={['fas', 'moon']} className="text-md" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Switch to {mode === 'dark' ? 'light' : 'dark'} mode</p>
      </TooltipContent>
    </Tooltip>
  )
}
