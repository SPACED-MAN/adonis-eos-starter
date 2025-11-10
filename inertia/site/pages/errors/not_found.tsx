/**
 * Public Site - 404 Not Found
 */

export default function NotFound() {
  return (
    <div className="min-h-screen bg-sand-50 dark:bg-sand-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-sand-900 dark:text-sand-50 mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-sand-700 dark:text-sand-300 mb-4">
            Page Not Found
          </h2>
          <p className="text-sand-600 dark:text-sand-400">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="space-y-3">
          <a
            href="/"
            className="block w-full px-6 py-3 bg-sand-900 hover:bg-sand-800 dark:bg-sand-50 dark:hover:bg-sand-100 text-sand-50 dark:text-sand-900 font-semibold rounded-lg transition-colors"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    </div>
  )
}

