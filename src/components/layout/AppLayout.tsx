'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

// 사이드바 없이 렌더링할 경로 prefix
const PUBLIC_PATHS  = ['/', '/login', '/auth', '/signup', '/pricing', '/terms', '/privacy']
const PORTAL_PATHS  = ['/portal', '/invite']

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname?.startsWith(p + '/'))
  const isPortal = PORTAL_PATHS.some(p => pathname?.startsWith(p))

  if (isPublic || isPortal) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-background)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen overflow-x-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
