'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, Eye, EyeOff, User, Phone, Loader2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Step = 'form' | 'otp' | 'done'
type Method = 'sms' | 'kakao'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [method, setMethod]       = useState<Method>('sms')
  const [step, setStep]           = useState<Step>('form')
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [otp, setOtp]             = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [message, setMessage]     = useState('')

  /* ── 카카오 간편가입 ── */
  const handleKakaoSignup = async () => {
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  /* ── SMS: 1단계 — 인증번호 발송 ── */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setMessage('')

    if (!name.trim()) { setError('이름을 입력해주세요.'); return }
    if (!phone.match(/^010\d{8}$/)) { setError('010으로 시작하는 11자리 번호를 입력해주세요.'); return }
    if (!email) { setError('이메일을 입력해주세요.'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return }

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

  /* ── SMS: 2단계 — OTP 검증 → 계정 생성 ── */
  const handleVerifyAndSignup = async () => {
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

      // 서버 API로 실제 계정 생성 (이메일 인증 스킵)
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '가입에 실패했습니다.'); setLoading(false); return }

      // 바로 로그인
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
      if (loginErr) {
        setStep('done')
        setLoading(false)
        return
      }
      router.push('/dashboard')
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || '가입 중 오류가 발생했습니다.')
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

  const inputCls = "w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm outline-none transition"
  const inputStyle = { borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-foreground)' } as React.CSSProperties

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-background)' }}>
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-3 mb-8 w-fit group transition-opacity hover:opacity-75">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg transition-transform group-hover:scale-95"
               style={{ background: 'var(--color-primary)' }}>N</div>
          <span className="text-xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>noado</span>
        </Link>

        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-foreground)' }}>회원가입</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
          {step === 'form' && '무료로 시작하세요.'}
          {step === 'otp'  && `${phone}으로 발송된 인증번호를 입력해주세요.`}
          {step === 'done' && '가입이 완료되었습니다!'}
        </p>

        {/* 에러 / 메시지 */}
        {error   && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>{error}</div>}
        {message && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>{message}</div>}

        {/* ── 1단계: 가입 방식 선택 + 폼 ── */}
        {step === 'form' && (
          <>
            {/* 가입 방식 탭 */}
            <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'var(--color-muted-bg)' }}>
              {([
                { key: 'sms' as const,   label: 'SMS 인증' },
                { key: 'kakao' as const, label: '카카오톡' },
              ]).map(m => (
                <button key={m.key} onClick={() => { setMethod(m.key); setError(''); setMessage('') }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: method === m.key ? 'var(--color-surface)' : 'transparent',
                    color:      method === m.key ? 'var(--color-primary)' : 'var(--color-muted)',
                    boxShadow:  method === m.key ? 'var(--shadow-soft)' : 'none',
                  }}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* SMS 가입 폼 */}
            {method === 'sms' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>이름</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="홍길동" required className={inputCls} style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>휴대폰 번호</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="01012345678" required maxLength={11} className={inputCls} style={inputStyle} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>본인 확인 및 카카오톡 알림에 사용됩니다.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>이메일</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="이메일 주소" required className={inputCls} style={inputStyle} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>세금계산서 등 세무 관련 용도로만 사용됩니다.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>비밀번호</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="6자 이상" required
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm outline-none transition" style={inputStyle} />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-foreground)' }}>비밀번호 확인</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                    <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="비밀번호 재입력" required className={inputCls} style={inputStyle} />
                  </div>
                </div>

                <button type="submit" disabled={loading || !email || !password || !phone}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  style={{ background: 'var(--color-primary)' }}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> 발송 중...</> : '인증번호 받기'}
                </button>
              </form>
            )}

            {/* 카카오 간편가입 */}
            {method === 'kakao' && (
              <div className="space-y-4">
                <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--color-muted-bg)', color: 'var(--color-foreground)' }}>
                  카카오 계정으로 간편하게 가입합니다.<br />
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>추가 정보(휴대폰, 이메일)는 가입 후 설정에서 입력할 수 있습니다.</span>
                </div>
                <button onClick={handleKakaoSignup} disabled={loading}
                  className="w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                  style={{ background: '#FEE500', color: '#191919' }}>
                  {loading
                    ? <Loader2 size={16} className="animate-spin" />
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="#3A1D1D"><path d="M12 3C6.477 3 2 6.477 2 11c0 2.897 1.58 5.438 4 6.965V21l3.5-2.08A11.29 11.29 0 0 0 12 19c5.523 0 10-3.477 10-8S17.523 3 12 3Z"/></svg>
                  }
                  카카오로 시작하기
                </button>
              </div>
            )}
          </>
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

            <button onClick={handleVerifyAndSignup} disabled={loading || otp.length < 6}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)' }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> 확인 중...</> : '인증 확인 및 가입'}
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
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto" style={{ color: 'var(--color-success)' }} />
            <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
              가입이 완료되었습니다. 로그인해주세요.
            </p>
            <button onClick={() => router.push('/login')}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--color-primary)' }}>
              로그인하기
            </button>
          </div>
        )}

        {step !== 'done' && (
          <p className="text-center text-sm mt-6" style={{ color: 'var(--color-muted)' }}>
            이미 계정이 있으신가요?{' '}
            <a href="/login" className="font-medium underline hover:opacity-80" style={{ color: 'var(--color-primary)' }}>로그인</a>
          </p>
        )}
      </div>
    </div>
  )
}
