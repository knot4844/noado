'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Loader2, Home, CreditCard, FileText, Bell,
  BarChart2, CheckCircle2, AlertCircle, Clock, XCircle,
  User, Building2, Phone, Mail, Calendar,
} from 'lucide-react'

/* ─── 탭 정의 ─── */
const TABS = [
  { key: 'overview',      label: '개요',     icon: <BarChart2 size={14} /> },
  { key: 'rooms',         label: '호실 현황', icon: <Home size={14} /> },
  { key: 'invoices',      label: '수납 내역', icon: <CreditCard size={14} /> },
  { key: 'contracts',     label: '전자계약',  icon: <FileText size={14} /> },
  { key: 'notifications', label: '알림톡',    icon: <Bell size={14} /> },
] as const
type TabKey = typeof TABS[number]['key']

/* ─── 색상 유틸 ─── */
const roomColor  = (s: string) => s === 'PAID' ? { c: '#34d399', bg: '#064e3b' } : s === 'VACANT' ? { c: '#94a3b8', bg: '#1e293b' } : { c: '#f87171', bg: '#450a0a' }
const roomLabel  = (s: string) => s === 'PAID' ? '완납' : s === 'VACANT' ? '공실' : '미납'
const invColor   = (s: string) => s === 'paid' ? { c: '#34d399', bg: '#064e3b' } : s === 'overdue' ? { c: '#f87171', bg: '#450a0a' } : { c: '#94a3b8', bg: '#1e293b' }
const invLabel   = (s: string) => s === 'paid' ? '완납' : s === 'overdue' ? '연체' : '미납'
const ctColor    = (s: string) => s === 'signed' ? { c: '#34d399', bg: '#064e3b' } : s === 'sent' ? { c: '#60a5fa', bg: '#1e3a5f' } : s === 'expired' ? { c: '#f87171', bg: '#450a0a' } : { c: '#94a3b8', bg: '#1e293b' }
const ctLabel    = (s: string) => s === 'signed' ? '서명완료' : s === 'sent' ? '발송됨' : s === 'expired' ? '만료' : '초안'
const fmt        = (n: number) => `₩${n.toLocaleString('ko-KR')}`
const fmtDate    = (s: string | null) => s ? new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'
const fmtDT      = (s: string | null) => s ? new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export default function UserDetailPage() {
  const router   = useRouter()
  const params   = useParams<{ userId: string }>()
  const userId   = params.userId

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [data, setData]       = useState<Record<string, unknown> | null>(null)
  const [tab, setTab]         = useState<TabKey>('overview')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/master-admin/login'); return }

    const res  = await fetch(`/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? '오류'); setLoading(false); return }
    setData(json)
    setLoading(false)
  }, [userId, router])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px' }}>
      <Loader2 size={34} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#94a3b8', fontSize: '13px' }}>임대인 데이터 로딩 중…</p>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (error || !data) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#f87171' }}>{error || '데이터 없음'}</p>
    </div>
  )

  const user          = data.user          as Record<string, string>
  const kpi           = data.kpi           as Record<string, number>
  const rooms         = data.rooms         as Record<string, unknown>[]
  const invoices      = data.invoices      as Record<string, unknown>[]
  const contracts     = data.contracts     as Record<string, unknown>[]
  const notifications = data.notifications as Record<string, unknown>[]
  const businesses    = data.businesses    as Record<string, unknown>[]

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'Inter', sans-serif" }}>

      {/* 헤더 */}
      <header style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/master-admin')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 0' }}>
          <ArrowLeft size={16} /> 목록으로
        </button>
        <span style={{ color: '#334155' }}>|</span>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px' }}>
          {user.name || user.email}
        </span>
        <span style={{ color: '#64748b', fontSize: '12px' }}>{user.email}</span>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 24px' }}>

        {/* 유저 기본 정보 카드 */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '24px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={24} color="#60a5fa" />
            </div>
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '16px' }}>{user.name || '이름 미등록'}</div>
              <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>ID: {user.id?.substring(0, 16)}…</div>
            </div>
          </div>
          <InfoChip icon={<Mail size={13} />} label={user.email} />
          {user.phone && <InfoChip icon={<Phone size={13} />} label={user.phone} />}
          {businesses[0] && <InfoChip icon={<Building2 size={13} />} label={(businesses[0] as Record<string, string>).name} />}
          <InfoChip icon={<Calendar size={13} />} label={`가입: ${fmtDate(user.createdAt)}`} />
          {user.lastSignIn && <InfoChip icon={<Clock size={13} />} label={`최근: ${fmtDT(user.lastSignIn)}`} />}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#1e293b', borderRadius: '12px', padding: '5px', width: 'fit-content', border: '1px solid #334155' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
                background: tab === t.key ? '#3b82f6' : 'transparent',
                color:      tab === t.key ? '#fff' : '#94a3b8',
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── 개요 탭 ── */}
        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: '전체 호실',      value: kpi.totalRooms,       unit: '개', color: '#60a5fa' },
                { label: '입주율',         value: kpi.occupancyRate,    unit: '%',  color: '#8b5cf6' },
                { label: '이달 총 청구',   value: fmt(kpi.thisMonthTotal), unit: '', color: '#f59e0b' },
                { label: '이달 수납 완료', value: fmt(kpi.thisMonthPaid),  unit: '', color: '#10b981' },
                { label: '이달 미납',      value: fmt(kpi.thisMonthUnpaid),unit:'', color: '#f87171' },
                { label: '전자계약 (활성)', value: `${kpi.activeContracts}/${kpi.totalContracts}`, unit: '', color: '#34d399' },
              ].map((c, i) => (
                <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</div>
                  <div style={{ color: c.color, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px' }}>{c.value}{c.unit}</div>
                </div>
              ))}
            </div>

            {/* 최근 알림톡 실패 */}
            {kpi.failedNotifications > 0 && (
              <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={16} color="#f87171" />
                <span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: 600 }}>알림톡 발송 실패 {kpi.failedNotifications}건이 있습니다.</span>
              </div>
            )}
          </div>
        )}

        {/* ── 호실 현황 탭 ── */}
        {tab === 'rooms' && (
          <Card title="호실 현황" count={rooms.length}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  {['호실명', '상태', '입주사', '연락처', '월세', '보증금', '계약 시작', '계약 종료'].map(h => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((r, i) => {
                  const rc = roomColor(r.status as string)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <Td bold>{r.name as string}</Td>
                      <Td><StatusBadge label={roomLabel(r.status as string)} color={rc.c} bg={rc.bg} /></Td>
                      <Td>{(r.tenant_name as string) || '—'}</Td>
                      <Td muted>{(r.tenant_phone as string) || '—'}</Td>
                      <Td>{fmt(r.monthly_rent as number)}</Td>
                      <Td>{fmt(r.deposit as number)}</Td>
                      <Td muted>{fmtDate(r.lease_start as string)}</Td>
                      <Td muted>{fmtDate(r.lease_end as string)}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}

        {/* ── 수납 내역 탭 ── */}
        {tab === 'invoices' && (
          <Card title="수납 내역 (최근 6개월)" count={invoices.length}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  {['기간', '호실', '입주사', '청구금액', '수납금액', '상태', '납부기한', '납부일'].map(h => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => {
                  const ic   = invColor(inv.status as string)
                  const room = inv.rooms as Record<string, string> | null
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <Td bold>{inv.year as number}.{String(inv.month as number).padStart(2, '0')}</Td>
                      <Td>{room?.name ?? '—'}</Td>
                      <Td>{room?.tenant_name ?? '—'}</Td>
                      <Td>{fmt(inv.amount as number)}</Td>
                      <Td>{fmt(inv.paid_amount as number)}</Td>
                      <Td><StatusBadge label={invLabel(inv.status as string)} color={ic.c} bg={ic.bg} /></Td>
                      <Td muted>{fmtDate(inv.due_date as string)}</Td>
                      <Td muted>{fmtDate(inv.paid_at as string)}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}

        {/* ── 전자계약 탭 ── */}
        {tab === 'contracts' && (
          <Card title="전자계약" count={contracts.length}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  {['호실', '입주사', '월세', '보증금', '계약기간', '상태', '서명일', '생성일'].map(h => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, i) => {
                  const cc   = ctColor(c.status as string)
                  const room = c.rooms as Record<string, string> | null
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <Td bold>{room?.name ?? '—'}</Td>
                      <Td>{(c.tenant_name as string) || '—'}</Td>
                      <Td>{fmt(c.monthly_rent as number)}</Td>
                      <Td>{fmt(c.deposit as number)}</Td>
                      <Td muted>
                        {fmtDate(c.lease_start as string)} ~<br />{fmtDate(c.lease_end as string)}
                      </Td>
                      <Td><StatusBadge label={ctLabel(c.status as string)} color={cc.c} bg={cc.bg} /></Td>
                      <Td muted>{fmtDate(c.signed_at as string)}</Td>
                      <Td muted>{fmtDate(c.created_at as string)}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}

        {/* ── 알림톡 탭 ── */}
        {tab === 'notifications' && (
          <Card title="알림톡 발송 내역" count={notifications.length}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  {['발송일시', '호실', '수신자', '연락처', '템플릿', '결과'].map(h => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notifications.map((n, i) => {
                  const room = n.rooms as Record<string, string> | null
                  const ok   = n.status === 'success'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <Td muted>{fmtDT(n.created_at as string)}</Td>
                      <Td>{room?.name ?? '—'}</Td>
                      <Td>{(n.recipient_name as string) || '—'}</Td>
                      <Td muted>{(n.recipient_phone as string) || '—'}</Td>
                      <Td><code style={{ background: '#0f172a', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{n.template_key as string}</code></Td>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {ok
                            ? <><CheckCircle2 size={13} color="#34d399" /><span style={{ color: '#34d399', fontSize: '12px' }}>성공</span></>
                            : <><XCircle size={13} color="#f87171" /><span style={{ color: '#f87171', fontSize: '12px' }}>실패</span></>}
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </div>
  )
}

/* ─── 서브 컴포넌트 ─── */
function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '13px' }}>
      <span style={{ color: '#60a5fa' }}>{icon}</span>{label}
    </div>
  )
}
function Card({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '14px' }}>{title}</span>
        <span style={{ background: '#334155', color: '#94a3b8', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px' }}>{count}건</span>
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  )
}
function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 20px', color: '#64748b', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap', fontSize: '12px' }}>{children}</th>
}
function Td({ children, bold, muted }: { children: React.ReactNode; bold?: boolean; muted?: boolean }) {
  return <td style={{ padding: '12px 20px', color: muted ? '#64748b' : bold ? '#f1f5f9' : '#cbd5e1', whiteSpace: 'nowrap', fontWeight: bold ? 600 : 400 }}>{children}</td>
}
function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ background: bg, color, fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '6px' }}>{label}</span>
}
