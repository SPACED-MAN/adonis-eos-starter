import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '../site/lib/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { usePage } from '@inertiajs/react'
import { Switch } from './ui/switch'

export function ThemeToggle() {
  const { props } = usePage<any>()
  const defaultThemeMode = props.defaultThemeMode || 'light'
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

    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light'
      }
    }

    return defaultThemeMode
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
    <div className="flex items-center gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => mode === 'dark' && toggle()}
              className={`transition-colors ${mode === 'light' ? 'text-standout-high' : 'text-neutral-low'}`}
              aria-label="Light mode"
            >
              <FontAwesomeIcon icon={['fas', 'sun']} className="text-xs" />
            </button>

            <Switch
              checked={mode === 'dark'}
              onCheckedChange={toggle}
              className="mt-0.5 data-[state=checked]:bg-backdrop-high data-[state=unchecked]:bg-backdrop-high border-line-high"
            />

            <button
              type="button"
              onClick={() => mode === 'light' && toggle()}
              className={`transition-colors ${mode === 'dark' ? 'text-standout-high' : 'text-neutral-low'}`}
              aria-label="Dark mode"
            >
              <FontAwesomeIcon icon={['fas', 'moon']} className="text-xs" />
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Switch to {mode === 'dark' ? 'light' : 'dark'} mode</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
