export function getXsrf(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}
