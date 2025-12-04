import type { Response } from '@adonisjs/core/http'

/**
 * Centralized HTTP response service
 *
 * Provides consistent response formatting across all controllers.
 */
class ResponseService {
  /**
   * Success response with data
   */
  ok<T>(response: Response, data: T, meta?: Record<string, unknown>) {
    return response.ok(meta ? { data, ...meta } : data)
  }

  /**
   * Created response (201)
   */
  created<T>(response: Response, data: T, message?: string) {
    return response.created({
      data,
      message: message || 'Created successfully',
    })
  }

  /**
   * No content response (204)
   */
  noContent(response: Response) {
    return response.noContent()
  }

  /**
   * Bad request error (400)
   */
  badRequest(response: Response, error: string, meta?: Record<string, unknown>) {
    return response.status(400).json({
      error,
      ...meta,
    })
  }

  /**
   * Unauthorized error (401)
   */
  unauthorized(response: Response, error: string = 'Authentication required') {
    return response.status(401).json({ error })
  }

  /**
   * Forbidden error (403)
   */
  forbidden(response: Response, error: string = 'Not allowed') {
    return response.status(403).json({ error })
  }

  /**
   * Not found error (404)
   */
  notFound(response: Response, error: string = 'Not found', meta?: Record<string, unknown>) {
    return response.status(404).json({
      error,
      ...meta,
    })
  }

  /**
   * Conflict error (409)
   */
  conflict(response: Response, error: string, meta?: Record<string, unknown>) {
    return response.status(409).json({
      error,
      ...meta,
    })
  }

  /**
   * Unprocessable entity (422)
   */
  unprocessable(response: Response, error: string, errors?: Record<string, string[]>) {
    return response.status(422).json({
      error,
      errors,
    })
  }

  /**
   * Too many requests (429)
   */
  tooManyRequests(response: Response, retryAfter?: number) {
    const res = response.status(429).json({
      error: 'Too many requests. Please try again later.',
    })
    if (retryAfter) {
      response.header('Retry-After', String(retryAfter))
    }
    return res
  }

  /**
   * Internal server error (500)
   */
  serverError(response: Response, error: string = 'Internal server error', details?: unknown) {
    const payload: Record<string, unknown> = { error }
    if (process.env.NODE_ENV === 'development' && details) {
      payload.details = details
    }
    return response.status(500).json(payload)
  }

  /**
   * Paginated list response
   */
  paginated<T>(
    response: Response,
    data: T[],
    meta: {
      total: number
      page: number
      limit: number
      sortBy?: string
      sortOrder?: string
    }
  ) {
    return response.ok({
      data,
      meta: {
        total: meta.total,
        page: meta.page,
        limit: meta.limit,
        totalPages: Math.ceil(meta.total / meta.limit),
        hasMore: meta.page * meta.limit < meta.total,
        ...(meta.sortBy && { sortBy: meta.sortBy }),
        ...(meta.sortOrder && { sortOrder: meta.sortOrder }),
      },
    })
  }

  /**
   * Handle action exception with proper status code
   */
  fromException(
    response: Response,
    error: { message: string; statusCode?: number; meta?: Record<string, unknown> }
  ) {
    const status = error.statusCode || 400
    return response.status(status).json({
      error: error.message,
      ...error.meta,
    })
  }
}

const responseService = new ResponseService()
export default responseService
