import React from 'react'
import { motion } from 'framer-motion'

interface BackgroundDecorationsProps {
  variant?: 'geometric' | 'blobs' | 'patterns' | 'minimal'
  inverted?: boolean
}

export const BackgroundDecorations: React.FC<BackgroundDecorationsProps> = ({
  variant = 'geometric',
  inverted = false
}) => {
  const baseOpacity = inverted ? 'opacity-[0.08]' : 'opacity-[0.04]'
  const standoutOpacity = inverted ? 'opacity-[0.12]' : 'opacity-[0.06]'

  if (variant === 'blobs') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className={`absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-standout-medium blur-[120px] ${standoutOpacity}`}
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 100, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className={`absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-standout-high blur-[120px] ${standoutOpacity}`}
        />
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
          className={`absolute top-1/4 right-1/4 w-1/3 h-1/3 rounded-full bg-line-high blur-[100px] ${baseOpacity}`}
        />
      </div>
    )
  }

  if (variant === 'patterns') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03] dark:opacity-[0.07]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
            <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" className="text-line-high" />
          <rect width="100%" height="100%" fill="url(#dots)" className="text-standout-medium" />
        </svg>
      </div>
    )
  }

  if (variant === 'geometric') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Large stylized polygon */}
        <svg
          className={`absolute -top-[10%] -left-[5%] w-[40%] h-auto text-line-high ${baseOpacity}`}
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path fill="currentColor" d="M44.7,-76.4C58.2,-69.2,69.7,-57.4,77.3,-43.8C84.8,-30.2,88.4,-15.1,87.2,-0.7C86,13.7,79.9,27.3,71.7,39.8C63.5,52.3,53.2,63.6,40.4,71.4C27.6,79.2,13.8,83.4,-0.6,84.4C-15,85.5,-29.9,83.3,-43.2,75.9C-56.5,68.5,-68.2,55.8,-76.3,41.4C-84.4,27.1,-88.9,13.5,-88.1,0.5C-87.3,-12.6,-81.1,-25.2,-72.6,-36.1C-64.1,-47,-53.3,-56.3,-41.3,-64.5C-29.3,-72.7,-14.7,-79.8,0.7,-81C16,-82.2,31.2,-77.5,44.7,-76.4Z" transform="translate(100 100)" />
        </svg>

        {/* Floating Rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className={`absolute top-[20%] right-[10%] w-64 h-64 border-[20px] border-standout-medium rounded-full ${baseOpacity} blur-sm`}
        />

        {/* Accent Triangles */}
        <svg
          className={`absolute bottom-[10%] left-[10%] w-32 h-32 text-standout-high ${standoutOpacity}`}
          viewBox="0 0 100 100"
        >
          <polygon fill="currentColor" points="50,15 90,85 10,85" />
        </svg>

        {/* Large geometric line */}
        <div className={`absolute top-1/2 -right-20 w-[60%] h-1 bg-line-high rotate-[-45deg] ${baseOpacity}`} />
        <div className={`absolute top-1/2 -right-16 w-[60%] h-1 bg-standout-medium rotate-[-45deg] ${standoutOpacity}`} />
      </div>
    )
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className={`absolute -top-24 -left-24 w-96 h-96 bg-line-high ${baseOpacity} blur-3xl`} />
      <div className={`absolute -bottom-24 -right-24 w-96 h-96 bg-standout-medium ${standoutOpacity} blur-3xl`} />
    </div>
  )
}



