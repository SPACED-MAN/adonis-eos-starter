import { lazy, Suspense, useState, useEffect } from 'react'

const SiteAdminBar = lazy(() => import('./SiteAdminBar'))

export function AdminBarWrapper({
  isAuthenticated,
  initialPageProps,
}: {
  isAuthenticated: boolean
  initialPageProps: any
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || !isAuthenticated) return null

  return (
    <Suspense fallback={null}>
      <SiteAdminBar initialProps={initialPageProps} />
    </Suspense>
  )
}

