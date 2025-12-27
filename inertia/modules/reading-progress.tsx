interface ReadingProgressProps {
  height?: number
  zIndex?: number
}

export default function ReadingProgress({ height = 4, zIndex = 50 }: ReadingProgressProps) {
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
      <div className="h-full bg-standout-medium w-0" />
    </div>
  )
}
