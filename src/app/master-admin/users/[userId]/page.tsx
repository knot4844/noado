'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Loader2, Home, CreditCard, FileText, Bell,
  BarChart2, CheckCircle2, AlertCircle, Clock, XCircle,
  User, Building2, Phone, Mail, Calendar, Send, X,
  ShieldOff, ShieldCheck, Trash2, LogOut,
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
const fmt        = (n: number | null | undefined) => `₩${(n ?? 0).toLocaleString('ko-KR')}`
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

  /* ─── 계정 관리 상태 ─── */
  const [manageAction, setManageAction]   = useState<'suspend' | 'activate' | 'delete' | null>(null)
  const [manageLoading, setManageLoading] = useState(false)
  const [manageResult, setManageResult]   = useState('')

  /* ─── 알림톡 발송 모달 상태 ─── */
  const [modal, setModal]           = useState(false)
  const [modalType, setModalType]   = useState<'UNPAID_REMINDER' | 'PAYMENT_CONFIRM'>('UNPAID_REMINDER')
  const [selectedRooms, setSelectedRooms] = useState<string[]>([])
  const [sending, setSending]       = useState(false)
  const [sendResult, setSendResult] = useState<{ message: string; results: { roomId: string; room: string; sent: boolean; reason?: string }[] } | null>(null)

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

  useEffect(() => { setTimeout(() => load(), 0) }, [load])

  const handleManage = useCallback(async (action: 'suspend' | 'activate' | 'delete') => {
    setManageLoading(true)
    setManageResult('')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setManageLoading(false); return }

    const res  = await fetch(`/api/admin/users/${userId}/manage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ action }),
    })
    const json = await res.json()
    setManageResult(json.message ?? json.error ?? '처리 완료')
    setManageLoading(false)
    setManageAction(null)
    if (res.ok) {
      if (action === 'delete') {
        router.push('/master-admin')
      } else {
        load() // 데이터 새로고침
      }
    }
  }, [userId, router, load])

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

  const user          = data.user          as Record<string, string & { isBanned?: boolean }>
  const isBanned      = !!(data.user as Record<string, unknown>)?.isBanned
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
        <div style={{ flex: 1 }} />
        <button
          onClick={async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            router.push('/master-admin/login')
          }}
          title="로그아웃"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', color: '#94a3b8', fontSize: '13px', padding: '6px 12px', fontFamily: 'inherit' }}>
          <LogOut size={14} /> 로그아웃
        </button>
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

        {/* 계정 관리 */}
        <div style={{ background: '#1e293b', border: `1px solid ${isBanned ? '#991b1b' : '#334155'}`, borderRadius: '16px', padding: '16px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isBanned
              ? <><ShieldOff size={16} color="#f87171" /><span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: 700 }}>이 계정은 현재 정지 상태입니다.</span></>
              : <><ShieldCheck size={16} color="#34d399" /><span style={{ color: '#94a3b8', fontSize: '13px' }}>계정 상태: <span style={{ color: '#34d399', fontWeight: 600 }}>정상</span></span></>}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isBanned ? (
              <button onClick={() => setManageAction('activate')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit' }}>
                <ShieldCheck size={14} /> 계정 활성화
              </button>
            ) : (
              <button onClick={() => setManageAction('suspend')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', cursor: 'pointer', background: 'transparent', color: '#f87171', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit' }}>
                <ShieldOff size={14} /> 계정 정지
              </button>
            )}
            <button onClick={() => setManageAction('delete')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #450a0a', cursor: 'pointer', background: '#450a0a', color: '#f87171', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit' }}>
              <Trash2 size={14} /> 계정 삭제
            </button>
          </div>
          {manageResult && (
            <div style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#94a3b8', fontSize: '12px' }}>
              {manageResult}
            </div>
          )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* 발송 버튼 영역 */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setModalType('UNPAID_REMINDER'); setSelectedRooms([]); setSendResult(null); setModal(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#fff', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                  boxShadow: '0 4px 12px rgba(220,38,38,0.35)',
                }}>
                <Send size={14} /> 미납 독촉 알림톡
              </button>
              <button
                onClick={() => { setModalType('PAYMENT_CONFIRM'); setSelectedRooms([]); setSendResult(null); setModal(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  color: '#fff', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                  boxShadow: '0 4px 12px rgba(5,150,105,0.35)',
                }}>
                <Send size={14} /> 수납 완료 알림톡
              </button>
            </div>

            {/* 발송 내역 테이블 */}
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
          </div>
        )}
      </main>

      {/* ── 계정 관리 확인 모달 ── */}
      {manageAction && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', width: '100%', maxWidth: '420px', padding: '28px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {manageAction === 'delete'
                ? <Trash2 size={20} color="#f87171" />
                : manageAction === 'suspend'
                ? <ShieldOff size={20} color="#f59e0b" />
                : <ShieldCheck size={20} color="#34d399" />}
              <h3 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 800, margin: 0 }}>
                {manageAction === 'delete' ? '계정 삭제 확인' : manageAction === 'suspend' ? '계정 정지 확인' : '계정 활성화 확인'}
              </h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.7, marginBottom: '8px' }}>
              <strong style={{ color: '#f1f5f9' }}>{user.name || user.email}</strong> 계정을
              {manageAction === 'delete'
                ? ' 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.'
                : manageAction === 'suspend'
                ? ' 정지합니다. 해당 임대인은 로그인할 수 없게 됩니다.'
                : ' 다시 활성화합니다.'}
            </p>
            {manageAction === 'delete' && (
              <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                <p style={{ color: '#fca5a5', fontSize: '12px', margin: 0 }}>⚠️ 삭제된 계정과 데이터는 복구할 수 없습니다.</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setManageAction(null)} disabled={manageLoading} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #334155', cursor: 'pointer', background: 'transparent', color: '#94a3b8', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit' }}>
                취소
              </button>
              <button
                onClick={() => handleManage(manageAction)}
                disabled={manageLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: manageLoading ? 'not-allowed' : 'pointer',
                  background: manageAction === 'activate'
                    ? 'linear-gradient(135deg, #059669, #047857)'
                    : manageAction === 'suspend'
                    ? 'linear-gradient(135deg, #d97706, #b45309)'
                    : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#fff', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                  opacity: manageLoading ? 0.6 : 1,
                }}>
                {manageLoading
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 처리 중…</>
                  : manageAction === 'delete' ? <><Trash2 size={14} /> 삭제 확인</>
                  : manageAction === 'suspend' ? <><ShieldOff size={14} /> 정지 확인</>
                  : <><ShieldCheck size={14} /> 활성화</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 알림톡 발송 모달 ── */}
      {modal && (
        <AlimtalkModal
          type={modalType}
          rooms={rooms}
          selectedRooms={selectedRooms}
          setSelectedRooms={setSelectedRooms}
          sending={sending}
          sendResult={sendResult}
          onClose={() => { setModal(false); setSendResult(null) }}
          onSend={async () => {
            if (selectedRooms.length === 0) return
            setSending(true)
            setSendResult(null)
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { setSending(false); return }
            const res = await fetch(`/api/admin/users/${userId}/send-alimtalk`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ roomIds: selectedRooms, type: modalType }),
            })
            const json = await res.json()
            setSendResult(json)
            setSending(false)
          }}
        />
      )}
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

/* ─── 알림톡 발송 모달 ─── */
type SendResult = { message: string; results: { roomId: string; room: string; sent: boolean; reason?: string }[] }
function AlimtalkModal({
  type, rooms, selectedRooms, setSelectedRooms,
  sending, sendResult, onClose, onSend,
}: {
  type: 'UNPAID_REMINDER' | 'PAYMENT_CONFIRM'
  rooms: Record<string, unknown>[]
  selectedRooms: string[]
  setSelectedRooms: (ids: string[]) => void
  sending: boolean
  sendResult: SendResult | null
  onClose: () => void
  onSend: () => void
}) {
  const isUnpaid    = type === 'UNPAID_REMINDER'
  const accentColor = isUnpaid ? '#ef4444' : '#10b981'
  const title       = isUnpaid ? '미납 독촉 알림톡 발송' : '수납 완료 알림톡 발송'

  // 미납 독촉은 UNPAID 호실만, 수납 완료는 모든 입주 호실
  const targetRooms = isUnpaid
    ? rooms.filter(r => r.status === 'UNPAID')
    : rooms.filter(r => r.status !== 'VACANT')

  const allChecked  = targetRooms.length > 0 && targetRooms.every(r => selectedRooms.includes(r.id as string))

  const toggle = (id: string) =>
    setSelectedRooms(selectedRooms.includes(id) ? selectedRooms.filter(x => x !== id) : [...selectedRooms, id])

  const toggleAll = () =>
    setSelectedRooms(allChecked ? [] : targetRooms.map(r => r.id as string))

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: '20px',
        width: '100%', maxWidth: '520px', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>

        {/* 헤더 */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 800, margin: 0 }}>{title}</h2>
            <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', margin: '4px 0 0' }}>
              발송할 호실을 선택하세요
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* 호실 목록 (결과 없을 때만 표시) */}
        {!sendResult && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {targetRooms.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
                {isUnpaid ? '미납 호실이 없습니다.' : '입주 호실이 없습니다.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* 전체 선택 */}
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                  background: '#0f172a', border: '1px solid #334155',
                }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll}
                    style={{ width: '16px', height: '16px', accentColor, cursor: 'pointer' }} />
                  <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>전체 선택 ({targetRooms.length}건)</span>
                </label>

                {targetRooms.map(r => {
                  const id      = r.id as string
                  const checked = selectedRooms.includes(id)
                  return (
                    <label key={id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                      background: checked ? '#0f172a' : 'transparent',
                      border: `1px solid ${checked ? accentColor : '#334155'}`,
                      transition: 'border-color 0.15s',
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(id)}
                        style={{ width: '16px', height: '16px', accentColor, cursor: 'pointer' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>{r.name as string}</div>
                        <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                          {(r.tenant_name as string) || '—'}
                          {(r.tenant_contact as string | undefined) && <span style={{ marginLeft: '8px' }}>{r.tenant_contact as string}</span>}
                          {isUnpaid && (r.unpaid_amount as number | undefined) && (
                            <span style={{ marginLeft: '8px', color: '#f87171' }}>
                              미납 ₩{(r.unpaid_amount as number).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {!(r.tenant_contact) && (
                        <span style={{ color: '#f87171', fontSize: '10px', background: '#450a0a', padding: '2px 6px', borderRadius: '4px' }}>연락처 없음</span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 발송 결과 */}
        {sendResult && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{
              background: '#0f172a', border: '1px solid #334155', borderRadius: '12px',
              padding: '16px 20px', marginBottom: '16px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <CheckCircle2 size={18} color="#34d399" />
              <span style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700 }}>{sendResult.message}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {sendResult.results.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '8px', background: '#0f172a',
                }}>
                  {r.sent
                    ? <CheckCircle2 size={14} color="#34d399" />
                    : <XCircle size={14} color="#f87171" />}
                  <span style={{ color: r.sent ? '#cbd5e1' : '#94a3b8', fontSize: '13px', flex: 1 }}>{r.room}</span>
                  {r.reason && <span style={{ color: '#64748b', fontSize: '11px' }}>{r.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 하단 버튼 */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #334155', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: '10px', border: '1px solid #334155', cursor: 'pointer',
            background: 'transparent', color: '#94a3b8', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
          }}>
            {sendResult ? '닫기' : '취소'}
          </button>
          {!sendResult && (
            <button
              onClick={onSend}
              disabled={sending || selectedRooms.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: sending || selectedRooms.length === 0 ? 'not-allowed' : 'pointer',
                background: sending || selectedRooms.length === 0 ? '#334155' : `linear-gradient(135deg, ${accentColor}, ${isUnpaid ? '#b91c1c' : '#047857'})`,
                color: sending || selectedRooms.length === 0 ? '#64748b' : '#fff',
                fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}>
              {sending
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 발송 중…</>
                : <><Send size={14} /> {selectedRooms.length}건 발송</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
