/**
 * Admin Panel - 404 Not Found
 */

import { useAdminPath } from '~/utils/adminPath'

export default function NotFound() {
  const adminPath = useAdminPath()

  return (
    <div className="min-h-screen bg-backdrop flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-neutral-high mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-neutral-high mb-4">Page Not Found</h2>
          <p className="text-neutral-medium">
            The admin page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="space-y-3">
          <a
            href={adminPath()}
            className="block w-full px-6 py-3 bg-standout-high hover:bg-standout-high/90 text-on-high font-semibold rounded-lg transition-colors"
          >
            Go to Dashboard
          </a>
          <a
            href="/"
            className="block w-full px-6 py-3 border-2 border-line-low hover:bg-backdrop-medium text-neutral-high font-semibold rounded-lg transition-colors"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    </div>
  )
}
