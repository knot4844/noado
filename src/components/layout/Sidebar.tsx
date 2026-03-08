'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, Users, CreditCard,
  FileText, Bell, Settings, LogOut, BarChart3, Receipt, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard',      label: '대시보드',    icon: LayoutDashboard },
  { href: '/units',          label: '호실 현황',   icon: Building2 },
  { href: '/tenants',        label: '입주사 관리', icon: Users },
  { href: '/payments',       label: '수납 매칭',   icon: CreditCard },
  { href: '/contracts',      label: '전자계약',    icon: FileText },
  { href: '/notifications',  label: '알림톡',      icon: Bell },
  { href: '/reports',        label: '보고서',      icon: BarChart3 },
  { href: '/export',         label: '세무 내보내기', icon: Receipt },
]

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  const isActive = (href: string) => pathname?.startsWith(href)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sidebarContent = (
    <aside className="w-60 h-full flex flex-col"
           style={{ background: 'var(--color-sidebar-bg)' }}>

      {/* 로고 */}
      <div className="px-5 py-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onClose}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
               style={{ background: 'var(--color-accent)' }}>
            N
          </div>
          <span className="text-xl font-bold tracking-tight"
                style={{ color: 'var(--color-sidebar-active)' }}>
            noado
          </span>
        </Link>
        {/* 모바일 닫기 버튼 */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{
                color:      active ? 'var(--color-sidebar-active)' : 'var(--color-sidebar-text)',
                background: active ? 'rgba(168,218,220,0.2)'       : 'transparent',
                fontWeight: active ? '600' : '400',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-sidebar-hover)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <item.icon
                size={18}
                style={{ color: active ? 'var(--color-accent)' : 'var(--color-sidebar-text)' }}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* 하단 */}
      <div className="px-3 py-4 border-t flex flex-col gap-0.5"
           style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <Link
          href="/settings"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
          style={{ color: 'var(--color-sidebar-text)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-sidebar-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <Settings size={18} style={{ color: 'var(--color-sidebar-text)' }} />
          설정
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all w-full text-left"
          style={{ color: 'var(--color-sidebar-text)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-sidebar-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* 데스크탑: 항상 표시 */}
      <div className="hidden md:block fixed left-0 top-0 h-screen w-60 z-50">
        {sidebarContent}
      </div>

      {/* 모바일: 오버레이 + 슬라이드 */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="relative w-60 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
