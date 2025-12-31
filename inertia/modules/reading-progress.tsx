import { useEffect, useState } from 'react'

interface ReadingProgressProps {
  height?: number
  zIndex?: number
}

export default function ReadingProgress({ height = 4, zIndex = 50 }: ReadingProgressProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight > 0) {
        const currentProgress = (window.scrollY / scrollHeight) * 100
        setProgress(currentProgress)
      }
    }

    window.addEventListener('scroll', handleScroll)
    // Initial check
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div
      className="fixed top-0 left-0 right-0 bg-backdrop-medium"
      style={{
        height: `${height}px`,
        zIndex,
      }}
      aria-hidden="true"
      data-module="reading-progress"
    >
      <div
        className="h-full bg-standout-high transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
