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
    <div className="min-h-screen bg-backdrop-low flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-error mb-2">500</h1>
          <h2 className="text-2xl font-semibold text-neutral-medium mb-4">Server Error</h2>
          <p className="text-neutral-low mb-6">
            We're sorry, but something went wrong on our end. Please try again later.
          </p>
          <p className="text-sm text-neutral-low font-mono bg-backdrop-medium p-3 rounded">
            {error.message}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="block w-full px-6 py-3 bg-standout-high text-on-high font-semibold rounded-lg transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="block w-full px-6 py-3 border-2 border-line-low hover:bg-backdrop-medium text-neutral-medium font-semibold rounded-lg transition-colors"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    </div>
  )
}
