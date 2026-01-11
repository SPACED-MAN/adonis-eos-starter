import React from 'react'
import { Head } from '@inertiajs/react'

export default function Maintenance({ siteTitle }: { siteTitle?: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <Head title={`Under Maintenance - ${siteTitle || 'Site'}`} />

      <div className="max-w-md w-full bg-card shadow-xl rounded-2xl p-8 md:p-12 border border-line-low">
        <div className="w-20 h-20 bg-standout-low text-standout-high rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-10 h-10"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.42 15.17L17.25 21A2.67 2.67 0 1113.5 17.25l-5.83-5.83m.92-2.11L3.08 4.67A2.67 2.67 0 116.83 8.42l5.83 5.83m-1.5-1.5a.75.75 0 011.06 0l1.5 1.5a.75.75 0 11-1.06 1.06l-1.5-1.5a.75.75 0 010-1.06z"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-neutral-high mb-4">Under Maintenance</h1>

        <p className="text-neutral-medium leading-relaxed">
          {siteTitle || 'Our site'} is currently undergoing scheduled maintenance to improve our
          services. We'll be back online shortly. Thank you for your patience!
        </p>

        <div className="pt-8 mt-8 border-t border-line-low text-neutral-low text-sm" suppressHydrationWarning>
          &copy; {new Date().getFullYear()} {siteTitle || 'Site'}
        </div>
      </div>
    </div>
  )
}
