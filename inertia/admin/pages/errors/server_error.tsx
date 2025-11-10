/**
 * Admin Panel - 500 Server Error
 */

interface ServerErrorProps {
  error: {
    message: string
    stack?: string
  }
}

export default function ServerError({ error }: ServerErrorProps) {
  const isDevelopment = import.meta.env.DEV

  return (
    <div className="min-h-screen bg-sand-50 dark:bg-sand-900 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white dark:bg-sand-800 rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">
              Server Error
            </h1>
            <h2 className="text-xl text-sand-700 dark:text-sand-300 mb-4">
              Something went wrong on our end
            </h2>
            <p className="text-sand-600 dark:text-sand-400 mb-4">
              We're sorry, but the server encountered an error while processing your request.
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-sm font-mono text-red-800 dark:text-red-200 break-words">
              {error.message}
            </p>
          </div>

          {isDevelopment && error.stack && (
            <details className="mb-6">
              <summary className="cursor-pointer text-sm font-semibold text-sand-700 dark:text-sand-300 mb-2">
                Stack Trace (Development Only)
              </summary>
              <pre className="text-xs bg-sand-100 dark:bg-sand-900 p-4 rounded overflow-x-auto">
                <code className="text-sand-800 dark:text-sand-200">{error.stack}</code>
              </pre>
            </details>
          )}

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="block w-full px-6 py-3 bg-sand-900 hover:bg-sand-800 dark:bg-sand-50 dark:hover:bg-sand-100 text-sand-50 dark:text-sand-900 font-semibold rounded-lg transition-colors"
            >
              Retry
            </button>
            <a
              href="/admin"
              className="block w-full px-6 py-3 border-2 border-sand-300 dark:border-sand-700 hover:bg-sand-100 dark:hover:bg-sand-800 text-sand-700 dark:text-sand-300 font-semibold rounded-lg text-center transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

