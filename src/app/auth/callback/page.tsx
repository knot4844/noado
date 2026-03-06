'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const handleAuth = async () => {
      const url  = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      }

      const { data: { session }, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        router.push('/login?error=' + encodeURIComponent(error.message))
        return
      }

      if (session) {
        const role = session.user?.user_metadata?.role
        router.push(role === 'TENANT' ? '/portal' : '/dashboard')
      } else {
        router.push('/login?error=' + encodeURIComponent('인증 처리 중 문제가 발생했습니다.'))
      }
    }

    handleAuth()
    return () => { mounted = false }
  }, [router])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center"
         style={{ background: 'var(--color-background)' }}>
      <Loader2 size={36} className="animate-spin mb-4"
               style={{ color: 'var(--color-primary)' }} />
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>로그인 처리 중...</p>
    </div>
  )
}
