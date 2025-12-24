import React, { createContext, useContext, useEffect, useState } from 'react'

interface ThemeContextType {
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType>({ isDark: false })

export function ThemeProvider({ 
  children, 
  initialIsDark 
}: { 
  children: React.ReactNode,
  initialIsDark?: boolean 
}) {
  const [isDark, setIsDark] = useState<boolean>(initialIsDark ?? false)

  useEffect(() => {
    // Initial check (client-side only)
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const checkDark = () => {
      const dark = root.classList.contains('dark')
      setIsDark(dark)
    }
    
    // Always check the document on mount to ensure we are in sync with the DOM
    checkDark()

    // Observe changes to the 'class' attribute on <html>
    const observer = new MutationObserver(() => {
      checkDark()
    })

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [initialIsDark])

  return (
    <ThemeContext.Provider value={{ isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}


