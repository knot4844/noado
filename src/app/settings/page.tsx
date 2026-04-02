'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, CheckCircle2, AlertCircle, User, Phone, Lock, Loader2, ShieldAlert } from 'lucide-react'

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const isResetMode = searchParams.get('reset') === 'true'

  const [loading, setLoading]       = useState(true)
  const [saving,  setSaving]        = useState(false)
  const [notice, setNotice]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 프로필
  const [email, setEmail]           = useState('')
  const [name,  setName]            = useState('')
  const [phone, setPhone]           = useState('')

  // 비밀번호
  const [pwCurrent, setPwCurrent]   = useState('')
  const [pwNew,     setPwNew]       = useState('')
  const [pwConfirm, setPwConfirm]   = useState('')

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text })
    setTimeout(() => setNotice(null), 3500)
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email ?? '')
        setName(user.user_metadata?.name ?? '')
        setPhone(user.user_metadata?.phone ?? '')
      }
      setLoading(false)
    })()
  }, [supabase])

  // 프로필 저장
  const handleSaveProfile = async () => {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({
      data: { name, phone }
    })
    setSaving(false)
    if (error) showNotice('error', error.message)
    else showNotice('success', '프로필이 저장되었습니다.')
  }

  // 비밀번호 변경
  const handleChangePassword = async () => {
    if (!pwNew) return showNotice('error', '새 비밀번호를 입력해주세요.')
    if (pwNew.length < 6) return showNotice('error', '비밀번호는 6자 이상이어야 합니다.')
    if (pwNew !== pwConfirm) return showNotice('error', '새 비밀번호가 일치하지 않습니다.')
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setSaving(false)
    if (error) showNotice('error', error.message)
    else {
      showNotice('success', '비밀번호가 변경되었습니다.')
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
    }
  }

  const inputCls = "w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2"
  const inputStyle = {
    background: 'var(--color-muted-bg)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-foreground)',
  } as React.CSSProperties

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
             style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* 토스트 알림 */}
      {notice && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white
          ${notice.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {notice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {notice.text}
        </div>
      )}

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
          설정
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>계정 정보 및 보안 설정</p>
      </div>

      {/* 프로필 카드 */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <User size={16} style={{ color: 'var(--color-primary)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>프로필</h2>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>이메일</label>
          <input className={inputCls} style={{ ...inputStyle, opacity: 0.6 }}
            value={email} readOnly />
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>이메일은 변경할 수 없습니다.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>이름</label>
          <input className={inputCls} style={inputStyle}
            placeholder="홍길동" value={name}
            onChange={e => setName(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-muted)' }}>
            <Phone size={12} /> 카카오 알림톡 수신 번호
          </label>
          <input className={inputCls} style={inputStyle}
            placeholder="01012345678 (하이픈 없이)" value={phone}
            onChange={e => setPhone(e.target.value)} />
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>미납 알림 및 일일 브리핑을 받을 번호입니다.</p>
        </div>

        <button onClick={handleSaveProfile} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: 'var(--color-primary)' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          저장
        </button>
      </div>

      {/* 비밀번호 변경 카드 */}
      <div className="card p-6 space-y-5" id="password-section">
        {isResetMode && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg"
               style={{ background: 'var(--color-warning-bg, #FEF3C7)', border: '1px solid var(--color-warning, #F59E0B)' }}>
            <ShieldAlert size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--color-warning, #F59E0B)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>비밀번호 재설정</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                이메일 인증이 완료되었습니다. 아래에서 새 비밀번호를 설정해주세요.
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 mb-1">
          <Lock size={16} style={{ color: 'var(--color-primary)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>비밀번호 변경</h2>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>새 비밀번호</label>
          <input className={inputCls} style={inputStyle} type="password"
            placeholder="6자 이상" value={pwNew}
            onChange={e => setPwNew(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>새 비밀번호 확인</label>
          <input className={inputCls} style={inputStyle} type="password"
            placeholder="동일하게 입력" value={pwConfirm}
            onChange={e => setPwConfirm(e.target.value)} />
        </div>

        <button onClick={handleChangePassword} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: 'var(--color-primary)' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
          비밀번호 변경
        </button>
      </div>

    </div>
  )
}
