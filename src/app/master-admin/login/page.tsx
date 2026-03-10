'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function MasterAdminLoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()

      /* 1) 로그인 */
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr || !data.session) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        setLoading(false)
        return
      }

      /* 2) 마스터 어드민 권한 확인 */
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })

      if (!res.ok) {
        await supabase.auth.signOut()
        setError('마스터 어드민 권한이 없는 계정입니다.')
        setLoading(false)
        return
      }

      /* 3) 통과 → 백오피스로 이동 */
      router.push('/master-admin')
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
          }}>
            <ShieldCheck size={28} color="#fff" />
          </div>
          <h1 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>
            noado 백오피스
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>
            마스터 어드민 전용 로그인
          </p>
        </div>

        {/* 카드 */}
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* 이메일 */}
            <div>
              <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.3px' }}>
                이메일
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#475569" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={e  => e.currentTarget.style.borderColor = '#334155'}
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.3px' }}>
                비밀번호
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#475569" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 40px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={e  => e.currentTarget.style.borderColor = '#334155'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {showPw
                    ? <EyeOff size={15} color="#475569" />
                    : <Eye    size={15} color="#475569" />}
                </button>
              </div>
            </div>

            {/* 에러 */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#450a0a', border: '1px solid #991b1b',
                borderRadius: '10px', padding: '12px 14px',
              }}>
                <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0 }} />
                <span style={{ color: '#fca5a5', fontSize: '13px' }}>{error}</span>
              </div>
            )}

            {/* 버튼 */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                marginTop: '4px',
                padding: '14px',
                background: loading ? '#1d4ed8' : 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: (!email || !password) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'opacity 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> 인증 중...</>
                : <><ShieldCheck size={16} /> 백오피스 로그인</>}
            </button>
          </form>

          {/* 경고 문구 */}
          <p style={{ color: '#475569', fontSize: '11px', textAlign: 'center', marginTop: '20px', lineHeight: 1.6 }}>
            이 페이지는 시스템 관리자 전용입니다.<br />
            허가되지 않은 접근은 보안 로그에 기록됩니다.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
