'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Building2, Users, Home, TrendingUp, ShieldCheck, Loader2,
  ArrowRight, Search, ChevronRight, AlertCircle, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

interface LandlordRow {
  id: string; email: string; name: string; phone: string; bizName: string
  createdAt: string; lastSignIn: string | null
  rooms: { total: number; vacant: number; unpaid: number }
  invoices: { total: number; unpaid: number }
}

export default function MasterAdminPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [stats, setStats]       = useState<Record<string, number>>({})
  const [users, setUsers]       = useState<LandlordRow[]>([])
  const [filtered, setFiltered] = useState<LandlordRow[]>([])
  const [q, setQ]               = useState('')
  const [token, setToken]       = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setToken(session.access_token)

    try {
      const headers = { Authorization: `Bearer ${session.access_token}` }

      /* SaaS 통계 */
      const sRes  = await fetch('/api/admin/stats', { headers })
      const sData = await sRes.json()
      if (!sRes.ok) throw new Error(sData.error ?? '권한 없음')
      setStats(sData.stats)

      /* 임대인 목록 */
      const uRes  = await fetch('/api/admin/users', { headers })
      const uData = await uRes.json()
      if (!uRes.ok) throw new Error(uData.error ?? '목록 조회 실패')
      setUsers(uData.users ?? [])
      setFiltered(uData.users ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  /* 검색 필터 */
  useEffect(() => {
    const lq = q.toLowerCase()
    setFiltered(!lq ? users : users.filter(u =>
      u.email.toLowerCase().includes(lq) ||
      u.name.toLowerCase().includes(lq) ||
      u.bizName.toLowerCase().includes(lq) ||
      u.phone.includes(lq),
    ))
  }, [q, users])

  /* ── 로딩 / 에러 ── */
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <Loader2 size={36} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>마스터 권한 확인 중…</p>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#1e293b', borderRadius: '20px', padding: '48px 40px', textAlign: 'center', maxWidth: '420px', width: '100%', border: '1px solid #334155' }}>
        <div style={{ width: '56px', height: '56px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <ShieldCheck size={28} color="#dc2626" />
        </div>
        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>접근 권한 없음</h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '28px' }}>{error}</p>
        <Link href="/dashboard" style={{ display: 'block', padding: '12px', background: '#3b82f6', color: '#fff', borderRadius: '12px', fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>
          대시보드로 이동
        </Link>
      </div>
    </div>
  )

  const fmt = (n: number) => n.toLocaleString('ko-KR')
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'Inter', sans-serif" }}>

      {/* 헤더 */}
      <header style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldCheck size={20} color="#60a5fa" />
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>noado 백오피스</span>
          <span style={{ background: '#1d4ed8', color: '#bfdbfe', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', letterSpacing: '1px' }}>ADMIN</span>
        </div>
        <Link href="/dashboard" style={{ color: '#94a3b8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
          일반 대시보드 <ArrowRight size={14} />
        </Link>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: '총 임대인 수',    value: `${users.length}명`,          icon: <Users size={18} />,    color: '#3b82f6', bg: '#1e3a5f' },
            { label: '전체 관리 호실',   value: `${stats.totalRooms ?? 0}개`, icon: <Home size={18} />,     color: '#8b5cf6', bg: '#2d1b69' },
            { label: '전체 입주사',      value: `${stats.totalTenants ?? 0}명`, icon: <Building2 size={18} />, color: '#10b981', bg: '#064e3b' },
            { label: '예상 MRR',        value: `₩${fmt(stats.monthlyRecurringRevenue ?? 0)}`, icon: <TrendingUp size={18} />, color: '#f59e0b', bg: '#451a03' },
          ].map((c, i) => (
            <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>{c.label}</span>
                <div style={{ background: c.bg, color: c.color, borderRadius: '8px', padding: '6px' }}>{c.icon}</div>
              </div>
              <div style={{ color: '#f1f5f9', fontSize: '26px', fontWeight: 800, letterSpacing: '-1px' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* 임대인 목록 */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', overflow: 'hidden' }}>
          {/* 헤더 + 검색 */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700, marginBottom: '2px' }}>임대인 목록</h2>
              <p style={{ color: '#64748b', fontSize: '13px' }}>이름 클릭 시 상세 현황 조회</p>
            </div>
            <div style={{ position: 'relative', minWidth: '260px' }}>
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="이름 / 이메일 / 사업장명 검색"
                style={{
                  width: '100%', padding: '9px 12px 9px 34px',
                  background: '#0f172a', border: '1px solid #334155', borderRadius: '10px',
                  color: '#f1f5f9', fontSize: '13px', outline: 'none',
                }}
              />
            </div>
          </div>

          {/* 테이블 */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  {['임대인', '사업장', '호실 현황', '이번달 청구', '가입일', '최근 로그인', ''].map(h => (
                    <th key={h} style={{ padding: '12px 20px', color: '#64748b', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #334155' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>조회된 임대인이 없습니다.</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id}
                    onClick={() => router.push(`/master-admin/users/${u.id}`)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0f172a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: '2px' }}>{u.name || '—'}</div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#cbd5e1' }}>{u.bizName || '—'}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <Badge label={`전체 ${u.rooms.total}`} color="#60a5fa" bg="#1e3a5f" />
                        {u.rooms.unpaid > 0 && <Badge label={`미납 ${u.rooms.unpaid}`} color="#f87171" bg="#450a0a" />}
                        {u.rooms.vacant > 0 && <Badge label={`공실 ${u.rooms.vacant}`} color="#94a3b8" bg="#1e293b" />}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {u.invoices.total > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {u.invoices.unpaid > 0
                            ? <AlertCircle size={13} color="#f87171" />
                            : <CheckCircle2 size={13} color="#34d399" />}
                          <span style={{ color: u.invoices.unpaid > 0 ? '#f87171' : '#34d399', fontSize: '12px', fontWeight: 600 }}>
                            {u.invoices.unpaid > 0 ? `미납 ${u.invoices.unpaid}건` : '전체 완납'}
                          </span>
                        </div>
                      ) : <span style={{ color: '#475569', fontSize: '12px' }}>청구 없음</span>}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDate(u.createdAt)}</td>
                    <td style={{ padding: '14px 20px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {u.lastSignIn ? fmtDate(u.lastSignIn) : '—'}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <ChevronRight size={16} color="#475569" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ background: bg, color, fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}
