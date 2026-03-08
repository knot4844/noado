'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  TrendingUp, TrendingDown, AlertCircle, Home,
  CheckCircle2, Clock, Sparkles, RefreshCw, ArrowRight
} from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import Link from 'next/link'
import type { Room } from '@/types'

// ── KPI 카드 ───────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  trend?: { value: string; up: boolean }
  accent?: string
  onClick?: () => void
}

function KpiCard({ icon, label, value, sub, trend, accent, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={`card p-5 flex flex-col gap-3 transition-all duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
      style={{ '--hover-shadow': 'var(--shadow-md)' } as React.CSSProperties}
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
        <p className="text-2xl font-bold tabular" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
          {value}
        </p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── 호실 상태 행 ──────────────────────────────────────────
function RoomRow({ room }: { room: Room }) {
  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    PAID:   { label: '납부완료', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    UNPAID: { label: '미납',    color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)'  },
    VACANT: { label: '공실',    color: 'var(--color-muted)',   bg: 'var(--color-muted-bg)'   },
  }
  const s = statusMap[room.status] ?? statusMap['VACANT']

  return (
    <tr className="border-b transition-colors hover:bg-slate-50"
        style={{ borderColor: 'var(--color-border)' }}>
      <td className="py-3 px-4 font-medium" style={{ color: 'var(--color-primary)' }}>{room.name}</td>
      <td className="py-3 px-4" style={{ color: 'var(--color-foreground)' }}>{room.tenant_name || '—'}</td>
      <td className="py-3 px-4 tabular text-right font-medium" style={{ color: 'var(--color-foreground)' }}>
        {room.monthly_rent > 0 ? formatKRW(room.monthly_rent) : '—'}
      </td>
      <td className="py-3 px-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: s.bg, color: s.color }}>
          {room.status === 'PAID'   && <CheckCircle2 size={11} />}
          {room.status === 'UNPAID' && <AlertCircle  size={11} />}
          {room.status === 'VACANT' && <Home         size={11} />}
          {s.label}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <Link href={`/units`}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--color-primary-light)' }}>
          상세 →
        </Link>
      </td>
    </tr>
  )
}

// ── 메인 대시보드 ─────────────────────────────────────────
export default function DashboardPage() {
  // supabase 클라이언트는 useMemo로 한 번만 생성 (매 렌더 재생성 방지)
  const supabase = useMemo(() => createClient(), [])

  const [rooms,    setRooms]    = useState<Room[]>([])
  const [loading,  setLoading]  = useState(true)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [chartData, setChartData] = useState<{ month: string; amount: number }[]>([])

  // today는 렌더와 무관하게 고정 (무한루프 방지)
  const today = useMemo(() => new Date(), [])
  const thisYear  = today.getFullYear()
  const thisMonth = today.getMonth() + 1

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // 호실 전체
    const { data: roomList } = await supabase
      .from('rooms').select('*')
      .eq('owner_id', user.id)
      .order('name')
    setRooms(roomList ?? [])

    // 최근 6개월 수납 차트 데이터 (invoices 기준)
    const sixMonthsAgo = new Date(thisYear, thisMonth - 7, 1)
    const { data: payList } = await supabase
      .from('invoices')
      .select('year, month, paid_amount')
      .eq('owner_id', user.id)
      .eq('status', 'paid')
      .gte('year', sixMonthsAgo.getFullYear())
      .order('year').order('month')
    if (payList) {
      const grouped: Record<string, number> = {}
      payList.forEach(p => {
        const key = `${String(p.year).slice(2)}-${String(p.month).padStart(2,'0')}`
        grouped[key] = (grouped[key] ?? 0) + (p.paid_amount || 0)
      })
      setChartData(Object.entries(grouped).map(([month, amount]) => ({ month, amount })))
    }

    // 저장된 브리핑 확인 (오늘 날짜 기준)
    const storedDate    = localStorage.getItem('briefing_date')
    const storedContent = localStorage.getItem('briefing_content')
    if (storedDate === today.toDateString() && storedContent) {
      setBriefing(storedContent)
    }

    setLoading(false)
  }, [supabase, thisYear, thisMonth, today])

  useEffect(() => { fetchData() }, [fetchData])

  // ── KPI 계산 ──
  const paid   = rooms.filter(r => r.status === 'PAID')
  const unpaid = rooms.filter(r => r.status === 'UNPAID')
  const vacant = rooms.filter(r => r.status === 'VACANT')
  const occupied = rooms.filter(r => r.status !== 'VACANT')

  const totalBilled    = occupied.reduce((s, r) => s + r.monthly_rent, 0)
  const totalCollected = paid.reduce((s, r) => s + r.monthly_rent, 0)
  const totalUnpaid    = unpaid.reduce((s, r) => s + r.monthly_rent, 0)
  const collectionRate = occupied.length > 0
    ? Math.round((paid.length / occupied.length) * 100) : 0
  const occupancyRate  = rooms.length > 0
    ? Math.round((occupied.length / rooms.length) * 100) : 0

  const leaseExpiringSoon = rooms.filter(r => {
    if (!r.lease_end) return false
    const days = Math.ceil((new Date(r.lease_end).getTime() - today.getTime()) / 86400000)
    return days >= 0 && days <= 30
  })

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
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── 페이지 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            대시보드
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            {today.toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' })}
            {''}
          </p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ color: 'var(--color-muted)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      {/* ── AI 브리핑 카드 ── */}
      <div className="rounded-xl p-5 flex items-start gap-4"
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
              {unpaid.length > 0 && (
                <span style={{ color: 'var(--color-danger)' }}>
                  {' '}현재 미납 {unpaid.length}세대 ({formatKRW(totalUnpaid)}) 주의가 필요합니다.
                </span>
              )}
            </p>
          )}
        </div>
        {unpaid.length > 0 && (
          <Link href="/units?filter=UNPAID"
            className="shrink-0 flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            미납 확인 <ArrowRight size={12} />
          </Link>
        )}
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
        />
        <KpiCard
          icon={<AlertCircle size={18} style={{ color: 'var(--color-danger)' }} />}
          label="미납 총액"
          value={formatKRW(totalUnpaid)}
          sub={`${unpaid.length}세대 미납`}
          accent="var(--color-danger-bg)"
          onClick={unpaid.length > 0 ? () => window.location.href = '/units?filter=UNPAID' : undefined}
        />
        <KpiCard
          icon={<Home size={18} style={{ color: 'var(--color-info)' }} />}
          label="입주율"
          value={`${occupancyRate}%`}
          sub={`${occupied.length}/${rooms.length} 세대`}
          accent="var(--color-info-bg)"
        />
        <KpiCard
          icon={<CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />}
          label="수납 완료"
          value={`${paid.length}세대`}
          sub={`전체 ${rooms.filter(r=>r.status!=='VACANT').length}세대 중`}
          accent="var(--color-success-bg)"
        />
        <KpiCard
          icon={<Home size={18} style={{ color: 'var(--color-muted)' }} />}
          label="공실"
          value={`${vacant.length}세대`}
          accent="var(--color-muted-bg)"
        />
        <KpiCard
          icon={<Clock size={18} style={{ color: 'var(--color-warning)' }} />}
          label="계약 만료 임박"
          value={`${leaseExpiringSoon.length}건`}
          sub="30일 이내"
          accent="var(--color-warning-bg)"
        />
      </div>

      {/* ── 하단: 수납 차트 + 호실 현황 테이블 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* 월별 수납 차트 (40%) */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            월별 수납 현황
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6d7d8b' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: unknown) => [formatKRW(Number(v)), '수납액']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="amount" fill="#a8dadc" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm"
                 style={{ color: 'var(--color-muted)' }}>
              수납 데이터가 없습니다.
            </div>
          )}
        </div>

        {/* 호실 현황 테이블 (60%) */}
        <div className="card lg:col-span-3" style={{ padding: 0, overflow: 'hidden' }}>
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
                  {['호실', '입주사', '월세', '상태', ''].map(h => (
                    <th key={h} className="py-2.5 px-4 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--color-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.slice(0, 8).map(room => <RoomRow key={room.id} room={room} />)}
              </tbody>
            </table>
          </div>
          {rooms.length > 8 && (
            <div className="px-5 py-3 border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
              <Link href="/units" className="text-xs font-medium hover:underline"
                    style={{ color: 'var(--color-primary-light)' }}>
                {rooms.length - 8}개 호실 더 보기
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

      </div>
    </div>
  )
}
