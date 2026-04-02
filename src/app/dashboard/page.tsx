'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  TrendingUp, TrendingDown, AlertCircle, Home,
  CheckCircle2, Clock, Sparkles, RefreshCw, ArrowRight,
  FileText, Upload, Users, Building2, Zap
} from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import Link from 'next/link'
// Room은 이름+상태만 사용 (leases 기준 KPI로 전환)
interface RoomBasic { id: string; name: string; status: string }
interface LeaseBasic {
  id: string; room_id: string; monthly_rent: number
  lease_end: string | null; status: string
  tenants: { name: string } | null
}

// ── KPI 카드 ───────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  trend?: { value: string; up: boolean }
  accent?: string
  onClick?: () => void
  progress?: number   // 0~100, progress bar 표시용
}

function KpiCard({ icon, label, value, sub, trend, accent, onClick, progress }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={`card p-3 sm:p-5 flex flex-col gap-2 sm:gap-3 transition-all duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-soft)')}
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
             style={{ background: accent || 'var(--color-muted-bg)' }}>
          {icon}
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: trend.up ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  color:      trend.up ? 'var(--color-success)'    : 'var(--color-danger)',
                }}>
            {trend.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend.value}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>
          {label}
        </p>
        <p className="text-lg sm:text-2xl font-bold tabular break-all" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
          {value}
        </p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{sub}</p>}
      </div>
      {progress !== undefined && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-muted-bg)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: progress >= 80 ? 'var(--color-success)' : progress >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── 호실 상태 행 (leases 기반) ────────────────────────────
function RoomRow({ room, lease }: { room: RoomBasic; lease?: LeaseBasic }) {
  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    PAID:   { label: '납부완료', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    UNPAID: { label: '미납',    color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)'  },
    VACANT: { label: '공실',    color: 'var(--color-muted)',   bg: 'var(--color-muted-bg)'   },
  }
  const displayStatus = lease ? room.status : 'VACANT'
  const s = statusMap[displayStatus] ?? statusMap['VACANT']

  return (
    <tr className="border-b transition-colors hover:bg-slate-50"
        style={{ borderColor: 'var(--color-border)' }}>
      <td className="py-2.5 px-3 font-medium text-sm" style={{ color: 'var(--color-primary)' }}>{room.name}</td>
      <td className="py-2.5 px-3 text-sm truncate max-w-[80px]" style={{ color: 'var(--color-foreground)' }}>
        {lease?.tenants?.name || '—'}
      </td>
      <td className="py-2.5 px-3 tabular text-right text-sm font-medium hidden sm:table-cell" style={{ color: 'var(--color-foreground)' }}>
        {lease ? formatKRW(lease.monthly_rent) : '—'}
      </td>
      <td className="py-2.5 px-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: s.bg, color: s.color }}>
          {displayStatus === 'PAID'   && <CheckCircle2 size={10} />}
          {displayStatus === 'UNPAID' && <AlertCircle  size={10} />}
          {displayStatus === 'VACANT' && <Home         size={10} />}
          {s.label}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right hidden sm:table-cell">
        <Link href="/units"
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--color-primary-light)' }}>
          상세 →
        </Link>
      </td>
    </tr>
  )
}

// ── 최근 수납 피드 아이템 ────────────────────────────────
interface RecentPayment {
  id: string
  amount: number
  paid_at: string | null
  memo: string | null
  room_name?: string
  tenant_name?: string
}

function PaymentFeedItem({ p }: { p: RecentPayment }) {
  const d = p.paid_at ? new Date(p.paid_at) : null
  const label = d
    ? d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    : '—'
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0"
         style={{ borderColor: 'var(--color-border)' }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
           style={{ background: 'var(--color-success-bg)' }}>
        <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-primary)' }}>
          {p.room_name || '—'} {p.tenant_name ? `· ${p.tenant_name}` : ''}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
          {p.memo || '수납 완료'}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold tabular" style={{ color: 'var(--color-success)' }}>
          +{formatKRW(p.amount)}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{label}</p>
      </div>
    </div>
  )
}

// ── 메인 대시보드 ─────────────────────────────────────────
export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), [])

  const [rooms,          setRooms]          = useState<RoomBasic[]>([])
  const [leases,         setLeases]         = useState<LeaseBasic[]>([])
  const [loading,        setLoading]        = useState(true)
  const [briefing,       setBriefing]       = useState<string | null>(null)
  const [chartData,      setChartData]      = useState<{ month: string; expected: number; paid: number }[]>([])
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([])

  const today     = useMemo(() => new Date(), [])
  const thisYear  = today.getFullYear()
  const thisMonth = today.getMonth() + 1

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // 호실 (이름·상태만)
    const { data: roomList } = await supabase
      .from('rooms').select('id, name, status')
      .eq('owner_id', user.id)
      .order('name')
    setRooms(roomList ?? [])

    // 활성 계약 (leases 기준 KPI)
    const { data: leaseList } = await supabase
      .from('leases')
      .select('id, room_id, monthly_rent, lease_end, status, tenants(name)')
      .eq('owner_id', user.id)
      .eq('status', 'ACTIVE')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLeases((leaseList ?? []) as any as LeaseBasic[])

    // 최근 6개월 수납 차트 (expected + paid)
    const sixMonthsAgo = new Date(thisYear, thisMonth - 7, 1)
    const [{ data: invList }, { data: payList }] = await Promise.all([
      supabase.from('invoices').select('year, month, amount')
        .eq('owner_id', user.id)
        .gte('year', sixMonthsAgo.getFullYear())
        .order('year').order('month'),
      supabase.from('invoices').select('year, month, paid_amount')
        .eq('owner_id', user.id)
        .eq('status', 'paid')
        .gte('year', sixMonthsAgo.getFullYear())
        .order('year').order('month'),
    ])

    // 최근 6개월 슬롯 생성
    const slots: { year: number; month: number; key: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - 1 - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      slots.push({ year: y, month: m, key: `${String(y).slice(2)}-${String(m).padStart(2, '0')}` })
    }

    const expectedByKey: Record<string, number> = {}
    const paidByKey:     Record<string, number> = {}
    ;(invList ?? []).forEach(p => {
      const key = `${String(p.year).slice(2)}-${String(p.month).padStart(2, '0')}`
      expectedByKey[key] = (expectedByKey[key] ?? 0) + (p.amount || 0)
    })
    ;(payList ?? []).forEach(p => {
      const key = `${String(p.year).slice(2)}-${String(p.month).padStart(2, '0')}`
      paidByKey[key] = (paidByKey[key] ?? 0) + (p.paid_amount || 0)
    })
    setChartData(slots.map(s => ({
      month:    s.key,
      expected: expectedByKey[s.key] ?? 0,
      paid:     paidByKey[s.key]     ?? 0,
    })))

    // 최근 수납 5건 — rooms(name)만 join, tenant는 note에서 파싱
    const { data: pmts } = await supabase
      .from('payments')
      .select('id, amount, paid_at, note, invoices(rooms(name))')
      .eq('owner_id', user.id)
      .order('paid_at', { ascending: false })
      .limit(5)

    if (pmts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRecentPayments((pmts as any[]).map((p) => {
        const inv  = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices
        const room = Array.isArray(inv?.rooms)  ? inv.rooms[0]  : inv?.rooms
        // note 형식: "입주사명 YYYY년 M월 월세"
        const tenantName = (p.note as string | null)?.split(' ')[0] ?? undefined
        return {
          id:          p.id      as string,
          amount:      p.amount  as number,
          paid_at:     p.paid_at as string | null,
          memo:        p.note    as string | null,
          room_name:   room?.name as string | undefined,
          tenant_name: tenantName,
        }
      }))
    }

    // 오늘 브리핑 로드
    const storedDate    = localStorage.getItem('briefing_date')
    const storedContent = localStorage.getItem('briefing_content')
    if (storedDate === today.toDateString() && storedContent) {
      setBriefing(storedContent)
    }

    setLoading(false)
  }, [supabase, thisYear, thisMonth, today])

  useEffect(() => { setTimeout(() => fetchData(), 0) }, [fetchData])

  // ── KPI 계산 (leases 기준) ──
  // leases에 연결된 room_id Set
  const occupiedRoomIds = new Set(leases.map(l => l.room_id))

  const paidRooms   = rooms.filter(r => occupiedRoomIds.has(r.id) && r.status === 'PAID')
  const unpaidRooms = rooms.filter(r => occupiedRoomIds.has(r.id) && r.status === 'UNPAID')
  const vacantRooms = rooms.filter(r => !occupiedRoomIds.has(r.id))
  const occupiedRooms = rooms.filter(r => occupiedRoomIds.has(r.id))

  // 월세 합계는 leases.monthly_rent 기준
  const totalBilled    = leases.reduce((s, l) => s + (l.monthly_rent ?? 0), 0)
  const totalCollected = leases
    .filter(l => paidRooms.some(r => r.id === l.room_id))
    .reduce((s, l) => s + (l.monthly_rent ?? 0), 0)
  const totalUnpaid = leases
    .filter(l => unpaidRooms.some(r => r.id === l.room_id))
    .reduce((s, l) => s + (l.monthly_rent ?? 0), 0)

  const collectionRate = occupiedRooms.length > 0
    ? Math.round((paidRooms.length / occupiedRooms.length) * 100) : 0
  const occupancyRate  = rooms.length > 0
    ? Math.round((occupiedRooms.length / rooms.length) * 100) : 0

  // 30일 내 계약 만료 (leases 기준)
  const leaseExpiringSoon = leases.filter(l => {
    if (!l.lease_end) return false
    const days = Math.ceil((new Date(l.lease_end).getTime() - today.getTime()) / 86400000)
    return days >= 0 && days <= 30
  })

  // ── 퀵 액션 ──
  const quickActions = [
    { icon: <FileText size={16} />,  label: '청구서',   sub: '이번달 청구서',  href: '/invoices',  accent: '#a8dadc22', border: '#a8dadc' },
    { icon: <Upload   size={16} />,  label: '수납처리', sub: '엑셀 업로드',    href: '/payments',  accent: '#c8b6ff22', border: '#c8b6ff' },
    { icon: <Users    size={16} />,  label: '입주사',   sub: '납부 현황',      href: '/tenants',   accent: '#ffd18c22', border: '#ffd18c' },
    { icon: <Building2 size={16} />, label: '호실관리', sub: '호실 현황',      href: '/units',     accent: '#b8e8b022', border: '#b8e8b0' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin"
               style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>데이터 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-3 sm:p-6">

      {/* ── 페이지 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            대시보드
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            {today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ color: 'var(--color-muted)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      {/* ── AI 브리핑 카드 ── */}
      <div className="rounded-xl p-3 sm:p-5 flex flex-col sm:flex-row items-start gap-3 sm:gap-4"
           style={{ background: 'linear-gradient(135deg, #a8dadc22 0%, #1d355710 100%)', border: '1px solid var(--color-accent)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
             style={{ background: 'var(--color-primary)' }}>
          <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1"
             style={{ color: 'var(--color-primary-light)' }}>AI 일일 브리핑</p>
          {briefing ? (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-foreground)' }}>{briefing}</p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              매일 오전 8시에 카카오톡 알림톡으로 브리핑이 발송됩니다.
              {unpaidRooms.length > 0 && (
                <span style={{ color: 'var(--color-danger)' }}>
                  {' '}현재 미납 {unpaidRooms.length}세대 ({formatKRW(totalUnpaid)}) 주의가 필요합니다.
                </span>
              )}
            </p>
          )}
        </div>
        {unpaidRooms.length > 0 && (
          <Link href="/units?filter=UNPAID"
            className="shrink-0 flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            미납 확인 <ArrowRight size={12} />
          </Link>
        )}
      </div>

      {/* ── 퀵 액션 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map(a => (
          <Link key={a.href} href={a.href}
            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: a.accent,
              border: `1px solid ${a.border}40`,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                 style={{ background: a.border + '30', color: 'var(--color-primary)' }}>
              {a.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-primary)' }}>{a.label}</p>
              <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{a.sub}</p>
            </div>
            <Zap size={13} className="ml-auto shrink-0" style={{ color: a.border }} />
          </Link>
        ))}
      </div>

      {/* ── KPI 6개 (3×2 그리드) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          icon={<TrendingUp size={18} style={{ color: 'var(--color-success)' }} />}
          label="이번 달 수납"
          value={formatKRW(totalCollected)}
          sub={`청구 ${formatKRW(totalBilled)}`}
          accent="var(--color-success-bg)"
          trend={{ value: `${collectionRate}%`, up: collectionRate >= 80 }}
          progress={collectionRate}
        />
        <KpiCard
          icon={<AlertCircle size={18} style={{ color: 'var(--color-danger)' }} />}
          label="미납 총액"
          value={formatKRW(totalUnpaid)}
          sub={`${unpaidRooms.length}세대 미납`}
          accent="var(--color-danger-bg)"
          onClick={unpaidRooms.length > 0 ? () => window.location.href = '/units?filter=UNPAID' : undefined}
        />
        <KpiCard
          icon={<Home size={18} style={{ color: 'var(--color-info)' }} />}
          label="입주율"
          value={`${occupancyRate}%`}
          sub={`활성계약 ${leases.length}건 / 전체 ${rooms.length}호`}
          accent="var(--color-info-bg)"
          progress={occupancyRate}
        />
        <KpiCard
          icon={<CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />}
          label="수납 완료"
          value={`${paidRooms.length}세대`}
          sub={`입주 ${occupiedRooms.length}세대 중`}
          accent="var(--color-success-bg)"
        />
        <KpiCard
          icon={<Home size={18} style={{ color: 'var(--color-muted)' }} />}
          label="공실"
          value={`${vacantRooms.length}세대`}
          accent="var(--color-muted-bg)"
        />
        <KpiCard
          icon={<Clock size={18} style={{ color: 'var(--color-warning)' }} />}
          label="계약 만료 임박"
          value={`${leaseExpiringSoon.length}건`}
          sub="30일 이내"
          accent="var(--color-warning-bg)"
          onClick={leaseExpiringSoon.length > 0 ? () => window.location.href = '/tenants' : undefined}
        />
      </div>

      {/* ── 하단 3열 레이아웃 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* 월별 수납 차트 (40%) */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              월별 수납 현황
            </h3>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#e2e8f0' }} />
                청구
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#a8dadc' }} />
                수납
              </span>
            </div>
          </div>
          {chartData.some(d => d.expected > 0 || d.paid > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6d7d8b' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: unknown, name?: string) => [formatKRW(Number(v)), name === 'expected' ? '청구액' : '수납액']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="expected" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid"     fill="#a8dadc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm"
                 style={{ color: 'var(--color-muted)' }}>
              수납 데이터가 없습니다.
            </div>
          )}
        </div>

        {/* 호실 현황 테이블 (35%) */}
        <div className="card lg:col-span-2" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b"
               style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              호실 현황
            </h3>
            <Link href="/units"
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: 'var(--color-primary-light)' }}>
              전체보기 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--color-muted-bg)' }}>
                  {[
                    { label: '호실',  cls: '' },
                    { label: '입주사', cls: '' },
                    { label: '월세',  cls: 'hidden sm:table-cell' },
                    { label: '상태',  cls: '' },
                    { label: '',      cls: 'hidden sm:table-cell' },
                  ].map(h => (
                    <th key={h.label} className={`py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wide ${h.cls}`}
                        style={{ color: 'var(--color-muted)' }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.slice(0, 6).map(room => (
                  <RoomRow
                    key={room.id}
                    room={room}
                    lease={leases.find(l => l.room_id === room.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {rooms.length > 6 && (
            <div className="px-5 py-3 border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
              <Link href="/units" className="text-xs font-medium hover:underline"
                    style={{ color: 'var(--color-primary-light)' }}>
                {rooms.length - 6}개 호실 더 보기
              </Link>
            </div>
          )}
          {rooms.length === 0 && (
            <div className="py-16 text-center">
              <Home size={36} className="mx-auto mb-3" style={{ color: 'var(--color-border)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>등록된 호실이 없습니다.</p>
              <Link href="/units" className="text-xs mt-1 hover:underline block"
                    style={{ color: 'var(--color-primary-light)' }}>호실 추가하기</Link>
            </div>
          )}
        </div>

        {/* 최근 수납 피드 (25%) */}
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              최근 수납
            </h3>
            <Link href="/payments"
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: 'var(--color-primary-light)' }}>
              전체 <ArrowRight size={12} />
            </Link>
          </div>
          {recentPayments.length > 0 ? (
            <div>
              {recentPayments.map(p => <PaymentFeedItem key={p.id} p={p} />)}
            </div>
          ) : (
            <div className="py-10 text-center">
              <CheckCircle2 size={28} className="mx-auto mb-2" style={{ color: 'var(--color-border)' }} />
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>최근 수납 내역이 없습니다.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
