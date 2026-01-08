/**
 * Admin Panel - 429 Too Many Requests
 */

import { Head } from '@inertiajs/react'
import { useAdminPath } from '~/utils/adminPath'
import { useEffect, useState } from 'react'

interface TooManyRequestsProps {
  retryAfter: number
}

export default function TooManyRequests({ retryAfter = 60 }: TooManyRequestsProps) {
  const adminPath = useAdminPath()
  const [countdown, setCountdown] = useState(retryAfter)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  return (
    <div className="min-h-screen bg-backdrop-medium flex items-center justify-center px-4">
      <Head title="Too Many Requests" />
      <div className="max-w-md w-full">
        <div className="bg-backdrop-low rounded-lg p-8 border border-line-low shadow-sm">
          <div className="mb-6 text-center">
            <div className="w-16 h-16 bg-standout-low text-standout-high rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-neutral-high mb-2">Too Many Requests</h1>
            <p className="text-neutral-medium">
              We've received too many requests from your IP address.
            </p>
          </div>

          <div className="bg-backdrop-medium border border-line-low rounded-lg p-4 mb-6 text-center">
            <p className="text-sm text-neutral-medium mb-1">Please try again in</p>
            <p className="text-3xl font-bold text-standout-high">
              {countdown} <span className="text-sm font-normal">seconds</span>
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              disabled={countdown > 0}
              className={`block w-full px-6 py-3 font-semibold rounded-lg transition-colors ${countdown > 0
                  ? 'bg-neutral-low text-neutral-medium cursor-not-allowed'
                  : 'bg-standout-high text-on-high hover:bg-standout-high'
                }`}
            >
              Refresh Page
            </button>
            <a
              href={adminPath()}
              className="block w-full px-6 py-3 border border-line-medium hover:bg-backdrop-medium text-neutral-medium font-semibold rounded-lg text-center transition-colors"
            >
              Go to Login
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
