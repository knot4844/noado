'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, Eye, EyeOff, User, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [message, setMessage]   = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      setMessage('가입 확인 메일이 발송됐습니다. 메일함을 확인해주세요!')
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || '회원가입 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-background)' }}>
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
               style={{ background: 'var(--color-primary)' }}>
            N
          </div>
          <span className="text-xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
            noado
          </span>
        </div>

        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-foreground)' }}>회원가입</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>무료로 시작하세요.</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>이름</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm outline-none transition"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-foreground)' }}
              />
            </div>
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>이메일</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="이메일 주소"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm outline-none transition"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-foreground)' }}
              />
            </div>
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>비밀번호</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="6자 이상"
                required
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm outline-none transition"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-foreground)' }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>비밀번호 확인</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="비밀번호 재입력"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm outline-none transition"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-foreground)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            style={{ background: 'var(--color-primary)' }}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> 가입 중...</> : '회원가입'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--color-muted)' }}>
          이미 계정이 있으신가요?{' '}
          <a href="/login" className="font-medium underline hover:opacity-80" style={{ color: 'var(--color-primary)' }}>로그인</a>
        </p>
      </div>
    </div>
  )
}
