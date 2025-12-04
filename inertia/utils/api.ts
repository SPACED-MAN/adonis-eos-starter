import { getXsrf } from './xsrf'

export async function fetchJson<T = any>(
  url: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; json: T | null; response: Response }> {
  const headers = new Headers(init.headers || {})
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const xsrf = getXsrf()
  if (xsrf && !headers.has('X-XSRF-TOKEN')) headers.set('X-XSRF-TOKEN', xsrf)
  const response = await fetch(url, { credentials: 'same-origin', ...init, headers })
  let json: any = null
  try {
    json = await response.json()
  } catch {
    /* ignore non-JSON */
  }
  return { ok: response.ok, status: response.status, json, response }
}
