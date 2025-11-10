/**
 * Public Site - 500 Server Error
 */

interface ServerErrorProps {
  error: {
    message: string
  }
}

export default function ServerError({ error }: ServerErrorProps) {
  return (
    <div className="min-h-screen bg-sand-50 dark:bg-sand-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-red-600 dark:text-red-400 mb-2">500</h1>
          <h2 className="text-2xl font-semibold text-sand-700 dark:text-sand-300 mb-4">
            Server Error
          </h2>
          <p className="text-sand-600 dark:text-sand-400 mb-6">
            We're sorry, but something went wrong on our end. Please try again later.
          </p>
          <p className="text-sm text-sand-500 dark:text-sand-500 font-mono bg-sand-100 dark:bg-sand-800 p-3 rounded">
            {error.message}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="block w-full px-6 py-3 bg-sand-900 hover:bg-sand-800 dark:bg-sand-50 dark:hover:bg-sand-100 text-sand-50 dark:text-sand-900 font-semibold rounded-lg transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="block w-full px-6 py-3 border-2 border-sand-300 dark:border-sand-700 hover:bg-sand-100 dark:hover:bg-sand-800 text-sand-700 dark:text-sand-300 font-semibold rounded-lg transition-colors"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    </div>
  )
}

