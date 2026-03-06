'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, Phone, Loader2 } from 'lucide-react'

type Tab = 'email' | 'kakao' | 'phone'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [tab, setTab]           = useState<Tab>('email')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone]       = useState('')
  const [otp, setOtp]           = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [otpSent, setOtpSent]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [message, setMessage]   = useState('')

  const clearMessages = () => { setError(''); setMessage('') }

  /* ── 이메일 로그인 ── */
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : error.message)
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  /* ── 카카오 OAuth ── */
  async function handleKakaoLogin() {
    clearMessages()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  /* ── 휴대폰 OTP ── */
  async function handleSendOtp() {
    clearMessages()
    if (!phone.match(/^010\d{8}$/)) { setError('010으로 시작하는 11자리 번호를 입력해주세요.'); return }
    setLoading(true)
    const formatted = '+82' + phone.slice(1)
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    if (error) { setError(error.message) }
    else { setOtpSent(true); setMessage('인증번호를 발송했습니다.') }
    setLoading(false)
  }

  async function handleVerifyOtp() {
    clearMessages()
    setLoading(true)
    const formatted = '+82' + phone.slice(1)
    const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' })
    if (error) { setError('인증번호가 올바르지 않습니다.') }
    else { router.push('/dashboard') }
    setLoading(false)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'email',  label: '이메일' },
    { key: 'kakao',  label: '카카오' },
    { key: 'phone',  label: '휴대폰' },
  ]

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-background)' }}>

      {/* ── 왼쪽 브랜드 영역 ── */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 p-12"
           style={{ background: 'var(--color-primary)' }}>
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
                 style={{ background: 'var(--color-accent)', color: 'var(--color-primary)' }}>
              N
            </div>
            <span className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              noado
            </span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4"
              style={{ fontFamily: 'var(--font-display)' }}>
            복잡한 임대관리,<br />이제 자동으로
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            수납 확인, 알림톡 발송, 전자계약까지<br />
            소규모 임대인을 위한 올인원 솔루션
          </p>
        </div>

        {/* 기능 태그 */}
        <div className="flex flex-wrap gap-2">
          {['가상계좌 자동 매칭', 'AI 일일 브리핑', '미납 독촉 자동화', '전자계약·서명', '부가세 엑셀 다운로드'].map(f => (
            <span key={f} className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(168,218,220,0.15)', color: 'var(--color-accent)' }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* ── 오른쪽 로그인 폼 ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">

          {/* 모바일 로고 */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                 style={{ background: 'var(--color-primary)', color: 'var(--color-accent)' }}>N</div>
            <span className="text-lg font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>noado</span>
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            로그인
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
            서비스를 이용하려면 로그인해 주세요.
          </p>

          {/* 탭 */}
          <div className="flex gap-1 p-1 rounded-xl mb-6"
               style={{ background: 'var(--color-muted-bg)' }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); clearMessages() }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: tab === t.key ? 'var(--color-surface)' : 'transparent',
                  color:      tab === t.key ? 'var(--color-primary)' : 'var(--color-muted)',
                  boxShadow:  tab === t.key ? 'var(--shadow-soft)' : 'none',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* 에러 / 메시지 */}
          {error   && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>{error}</div>}
          {message && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>{message}</div>}

          {/* ── 이메일 탭 ── */}
          {tab === 'email' && (
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>이메일</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="이메일 주소" required autoComplete="email"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm outline-none transition-all"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--color-accent-dark)'}
                    onBlur={e  => e.target.style.borderColor = 'var(--color-border)'} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>비밀번호</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="비밀번호" required autoComplete="current-password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm outline-none transition-all"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--color-accent-dark)'}
                    onBlur={e  => e.target.style.borderColor = 'var(--color-border)'} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 mt-2"
                style={{ background: 'var(--color-primary)' }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                로그인
              </button>
            </form>
          )}

          {/* ── 카카오 탭 ── */}
          {tab === 'kakao' && (
            <div className="flex flex-col gap-4">
              <button onClick={handleKakaoLogin} disabled={loading}
                className="w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                style={{ background: '#FEE500', color: '#191919' }}>
                {loading
                  ? <Loader2 size={16} className="animate-spin" />
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="#3A1D1D"><path d="M12 3C6.477 3 2 6.477 2 11c0 2.897 1.58 5.438 4 6.965V21l3.5-2.08A11.29 11.29 0 0 0 12 19c5.523 0 10-3.477 10-8S17.523 3 12 3Z"/></svg>
                }
                카카오로 계속하기
              </button>
              <p className="text-center text-xs" style={{ color: 'var(--color-muted)' }}>
                카카오 계정으로 간편하게 로그인하세요.
              </p>
            </div>
          )}

          {/* ── 휴대폰 탭 ── */}
          {tab === 'phone' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>휴대폰 번호</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="01012345678" maxLength={11} disabled={otpSent}
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm outline-none"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} />
                  </div>
                  <button onClick={handleSendOtp} disabled={loading || otpSent}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium text-white shrink-0 disabled:opacity-60"
                    style={{ background: 'var(--color-primary)' }}>
                    {loading ? <Loader2 size={14} className="animate-spin" /> : '발송'}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>인증번호 6자리</label>
                  <div className="flex gap-2">
                    <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000" maxLength={6}
                      className="flex-1 px-4 py-2.5 rounded-lg border text-sm outline-none tracking-widest text-center"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} />
                    <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}
                      className="px-4 py-2.5 rounded-lg text-sm font-medium text-white shrink-0 disabled:opacity-60"
                      style={{ background: 'var(--color-primary)' }}>
                      {loading ? <Loader2 size={14} className="animate-spin" /> : '확인'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-xs mt-8" style={{ color: 'var(--color-muted)' }}>
            계속 진행하면{' '}
            <a href="/terms" className="underline hover:opacity-80">이용약관</a>
            {' '}및{' '}
            <a href="/privacy" className="underline hover:opacity-80">개인정보 처리방침</a>
            에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}
