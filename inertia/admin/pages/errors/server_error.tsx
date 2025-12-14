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
    <div className="min-h-screen bg-backdrop-medium flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-backdrop-low rounded-lg p-8 border border-line-low">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-error mb-2">
              Server Error
            </h1>
            <h2 className="text-xl text-neutral-medium mb-4">
              Something went wrong on our end
            </h2>
            <p className="text-neutral-low mb-4">
              We're sorry, but the server encountered an error while processing your request.
            </p>
          </div>

          <div className="bg-[color:#fef2f2] border border-error rounded-lg p-4 mb-6">
            <p className="text-sm font-mono text-error break-words">
              {error.message}
            </p>
          </div>

          {isDevelopment && error.stack && (
            <details className="mb-6">
              <summary className="cursor-pointer text-sm font-semibold text-neutral-medium mb-2">
                Stack Trace (Development Only)
              </summary>
              <pre className="text-xs bg-backdrop-medium p-4 rounded overflow-x-auto">
                <code className="text-neutral-high">{error.stack}</code>
              </pre>
            </details>
          )}

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="block w-full px-6 py-3 bg-standout-medium text-on-standout font-semibold rounded-lg transition-colors"
            >
              Retry
            </button>
            <a
              href="/admin"
              className="block w-full px-6 py-3 border-2 border-border hover:bg-backdrop-medium text-neutral-medium font-semibold rounded-lg text-center transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

