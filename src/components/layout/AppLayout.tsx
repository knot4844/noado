'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'

// 사이드바 없이 렌더링할 경로 prefix
const PUBLIC_PATHS  = ['/', '/login', '/auth']
const PORTAL_PATHS  = ['/portal', '/invite']

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname?.startsWith(p + '/'))
  const isPortal = PORTAL_PATHS.some(p => pathname?.startsWith(p))

  if (isPublic || isPortal) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-background)' }}>
      <Sidebar />
      <div className="flex-1 ml-60 flex flex-col min-h-screen overflow-x-hidden">
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
