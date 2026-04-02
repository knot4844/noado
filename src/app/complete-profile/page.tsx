'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Phone, Mail, Loader2, CheckCircle2 } from 'lucide-react'

type Step = 'form' | 'otp' | 'done'

export default function CompleteProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep]       = useState<Step>('form')
  const [phone, setPhone]     = useState('')
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError]     = useState('')
  const [message, setMessage] = useState('')
  const [userName, setUserName] = useState('')
  const [hasPhone, setHasPhone] = useState(false)
  const [hasEmail, setHasEmail] = useState(false)

  // 로그인 상태 + 이미 정보가 있는지 확인
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const meta = user.user_metadata || {}
      setUserName(meta.full_name || meta.name || '')

      const phoneExists = !!meta.phone
      const emailExists = !!user.email && !user.email.endsWith('@kakao.com')

      setHasPhone(phoneExists)
      setHasEmail(emailExists)
      if (meta.phone) setPhone(meta.phone)
      if (user.email && !user.email.endsWith('@kakao.com')) setEmail(user.email)

      // 이미 둘 다 있으면 대시보드로
      if (phoneExists && emailExists) {
        router.push('/dashboard')
        return
      }

      setChecking(false)
    })()
  }, [supabase, router])

  /* ── SMS 인증번호 발송 ── */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setMessage('')

    if (!phone.match(/^010\d{8}$/)) {
      setError('010으로 시작하는 11자리 번호를 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage('인증번호를 발송했습니다.')
      setStep('otp')
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'SMS 발송에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  /* ── OTP 검증 + 프로필 저장 ── */
  const handleVerifyAndSave = async () => {
    setError(''); setMessage('')
    if (otp.length < 6) { setError('인증번호 6자리를 입력해주세요.'); return }

    setLoading(true)
    try {
      // OTP 검증
      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) { setError(verifyData.error); setLoading(false); return }

      // user_metadata에 phone 저장
      const updateData: Record<string, string> = { phone }

      const { error: updateErr } = await supabase.auth.updateUser({
        data: updateData,
      })
      if (updateErr) { setError(updateErr.message); setLoading(false); return }

      setStep('done')
      // 1.5초 후 대시보드로 이동
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  /* ── OTP 재발송 ── */
  const handleResendOtp = async () => {
    setError(''); setMessage(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage('인증번호를 다시 발송했습니다.')
      setOtp('')
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || '재발송에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-foreground)' } as React.CSSProperties

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-background)' }}>
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
               style={{ background: 'var(--color-primary)' }}>N</div>
          <span className="text-xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>noado</span>
        </div>

        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-foreground)' }}>
          {step === 'done' ? '설정 완료!' : '추가 정보 입력'}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
          {step === 'form' && `${userName ? userName + '님, ' : ''}서비스 이용에 필요한 정보를 입력해주세요.`}
          {step === 'otp'  && `${phone}으로 발송된 인증번호를 입력해주세요.`}
          {step === 'done' && '대시보드로 이동합니다...'}
        </p>

        {error   && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>{error}</div>}
        {message && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>{message}</div>}

        {/* ── 1단계: 정보 입력 ── */}
        {step === 'form' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            {/* 휴대폰 번호 */}
            {!hasPhone && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>
                  <Phone className="inline w-4 h-4 mr-1 -mt-0.5" />휴대폰 번호
                </label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="01012345678" required maxLength={11}
                  className="w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition"
                  style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  카카오톡 알림 발송 및 비밀번호 재설정에 사용됩니다.
                </p>
              </div>
            )}

            {/* 이메일 (카카오 가입자용) */}
            {!hasEmail && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>
                  <Mail className="inline w-4 h-4 mr-1 -mt-0.5" />이메일 (선택)
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  className="w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition"
                  style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  세금계산서 발행 시 필요합니다. 나중에 설정에서 입력할 수도 있습니다.
                </p>
              </div>
            )}

            <button type="submit" disabled={loading || (!hasPhone && !phone)}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              style={{ background: 'var(--color-primary)' }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> 발송 중...</> : '인증번호 받기'}
            </button>

            <button type="button" onClick={() => router.push('/dashboard')}
              className="w-full py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-muted)' }}>
              나중에 하기
            </button>
          </form>
        )}

        {/* ── 2단계: OTP 인증 ── */}
        {step === 'otp' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>인증번호 6자리</label>
              <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000" maxLength={6}
                className="w-full px-4 py-3 rounded-lg border text-lg outline-none tracking-[0.3em] text-center font-mono"
                style={inputStyle} />
            </div>

            <button onClick={handleVerifyAndSave} disabled={loading || otp.length < 6}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)' }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> 확인 중...</> : '인증 확인'}
            </button>

            <div className="flex items-center justify-between">
              <button onClick={() => { setStep('form'); setOtp(''); setError(''); setMessage('') }}
                className="text-sm font-medium hover:underline" style={{ color: 'var(--color-muted)' }}>
                이전으로
              </button>
              <button onClick={handleResendOtp} disabled={loading}
                className="text-sm font-medium hover:underline disabled:opacity-50" style={{ color: 'var(--color-accent-dark)' }}>
                인증번호 재발송
              </button>
            </div>
          </div>
        )}

        {/* ── 3단계: 완료 ── */}
        {step === 'done' && (
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-success)' }} />
          </div>
        )}
      </div>
    </div>
  )
}
