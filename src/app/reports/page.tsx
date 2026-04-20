'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, BarChart3, PieChart, Home, FileSpreadsheet, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import * as XLSX from 'xlsx'
import type { Room } from '@/types'

interface Invoice {
  id: string
  room_id: string
  year: number
  month: number
  paid_amount: number
  amount: number
  status: string
  due_date?: string | null
}

interface UnpaidInvoice {
  id: string
  room_id: string
  year: number
  month: number
  amount: number
  status: string
  due_date?: string | null
  rooms: {
    name: string
  } | null
  // leases 경유 보강 데이터
  tenant_name?: string | null
  tenant_phone?: string | null
}

const COLORS = ['#1d3557', '#a8dadc', '#e63946']

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [rooms, setRooms] = useState<Room[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [unpaidDetail, setUnpaidDetail] = useState<UnpaidInvoice[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: roomList }, { data: invoiceList }, { data: unpaidList }] = await Promise.all([
      supabase.from('rooms').select('*').eq('owner_id', user.id),
      supabase.from('invoices').select('*').eq('owner_id', user.id)
        .order('year').order('month'),
      supabase
        .from('invoices')
        .select('*, rooms(name)')
        .eq('owner_id', user.id)
        .in('status', ['ready', 'overdue'])
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    // 미납 청구서에 leases→tenants 경유로 입주사 정보 보강
    const unpaidRows = (unpaidList ?? []) as UnpaidInvoice[]
    if (unpaidRows.length > 0) {
      const roomIds = [...new Set(unpaidRows.map(i => i.room_id))]
      const { data: leaseData } = await supabase
        .from('leases')
        .select('room_id, monthly_rent, tenant:tenants(name, phone)')
        .eq('status', 'ACTIVE')
        .in('room_id', roomIds)

      type LeaseJoin = { room_id: string; monthly_rent: number | null; tenant: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null }
      const leaseByRoom: Record<string, { tenant_name: string | null; tenant_phone: string | null; monthly_rent: number }> = {}
      for (const l of (leaseData ?? []) as unknown as LeaseJoin[]) {
        const t = Array.isArray(l.tenant) ? l.tenant[0] : l.tenant
        leaseByRoom[l.room_id] = {
          tenant_name: t?.name ?? null,
          tenant_phone: t?.phone ?? null,
          monthly_rent: l.monthly_rent ?? 0,
        }
      }
      for (const inv of unpaidRows) {
        const lease = leaseByRoom[inv.room_id]
        if (lease) {
          inv.tenant_name = lease.tenant_name
          inv.tenant_phone = lease.tenant_phone
        }
      }
    }

    setRooms(roomList ?? [])
    setInvoices(invoiceList ?? [])
    setUnpaidDetail(unpaidRows)
    setLoading(false)
  }, [supabase])

  useEffect(() => { setTimeout(() => fetchData(), 0) }, [fetchData])

  // ── 통계 계산 ──
  const totalRooms   = rooms.length
  const vacantRooms  = rooms.filter(r => r.status === 'VACANT').length
  // 수납 상태는 이번 달 invoices 기준 (rooms.status 아님)
  const currentInvs = invoices.filter(i => i.year === currentYear && i.month === currentMonth)
  const paidRoomIdSet   = new Set(currentInvs.filter(i => i.status === 'paid').map(i => i.room_id))
  const unpaidRoomIdSet = new Set(currentInvs.filter(i => i.status !== 'paid').map(i => i.room_id))
  const unpaidRooms = rooms.filter(r => unpaidRoomIdSet.has(r.id))
  const paidRooms   = rooms.filter(r => paidRoomIdSet.has(r.id))
  const occupancyRate = totalRooms > 0
    ? Math.round(((totalRooms - vacantRooms) / totalRooms) * 100) : 0

  // 이번달 수납률
  const currentMonthInvoices = invoices.filter(i => i.year === currentYear && i.month === currentMonth)

  // monthly_rent는 rooms에서 제거됨 → invoices 기준으로 계산
  const currentMonthUnpaidInvoices = currentMonthInvoices.filter(i => i.status !== 'paid')
  const totalUnpaid = currentMonthUnpaidInvoices.reduce((s, i) => s + (i.amount - i.paid_amount), 0)
  const monthlyExpected = currentMonthInvoices.reduce((s, i) => s + i.amount, 0)
  const currentMonthPaid = currentMonthInvoices.filter(i => i.status === 'paid').length
  const currentMonthTotal = currentMonthInvoices.length
  const collectionRate = currentMonthTotal > 0
    ? Math.round((currentMonthPaid / currentMonthTotal) * 100) : 0
  const collectionRateColor = collectionRate >= 80
    ? 'var(--color-success)'
    : collectionRate >= 50
      ? '#d97706'
      : 'var(--color-danger)'
  const collectionRateBg = collectionRate >= 80
    ? 'var(--color-success-bg)'
    : collectionRate >= 50
      ? '#fef3c7'
      : 'var(--color-danger-bg)'

  // 월별 수납 차트 (최근 12개월) — 목표 대비 실적 포함
  const monthlyChartData = useMemo(() => {
    const grouped: Record<string, { paid: number; expected: number }> = {}
    invoices.forEach(i => {
      const key = `${i.year}-${String(i.month).padStart(2, '0')}`
      if (!grouped[key]) grouped[key] = { paid: 0, expected: 0 }
      grouped[key].expected += i.amount
      if (i.status === 'paid') grouped[key].paid += (i.paid_amount || 0)
    })
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, v]) => ({
        name: `${key.slice(2, 4)}.${key.slice(5)}`,
        paid: v.paid,
        expected: v.expected,
      }))
  }, [invoices])

  // 파이 차트 데이터
  const pieData = [
    { name: '납부완료', value: paidRooms.length },
    { name: '공실', value: vacantRooms },
    { name: '미납', value: unpaidRooms.length },
  ].filter(d => d.value > 0)

  // 엑셀 내보내기
  const handleExportExcel = () => {
    const summaryData = [
      { 항목: '총 관리 호실', 값: `${totalRooms}세대` },
      { 항목: '입주율', 값: `${occupancyRate}%` },
      { 항목: '납부완료', 값: `${paidRooms.length}세대` },
      { 항목: '미납', 값: `${unpaidRooms.length}세대 (${formatKRW(totalUnpaid)})` },
      { 항목: '공실', 값: `${vacantRooms}세대` },
      { 항목: '월 예상 수납액', 값: formatKRW(monthlyExpected) },
      { 항목: '이번달 수납률', 값: `${collectionRate}%` },
    ]
    const roomData = rooms.map(r => ({
      호실: r.name,
      상태: r.status,
    }))
    const monthlyData = monthlyChartData.map(row => ({
      월: row.name,
      청구액: row.expected,
      수납액: row.paid,
      수납률: row.expected > 0 ? `${Math.round((row.paid / row.expected) * 100)}%` : '-',
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), '요약')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roomData), '호실현황')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyData), '월별수납현황')
    XLSX.writeFile(wb, `noado_보고서_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

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

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            보고서
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>매출 및 임대 현황 통계</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--color-muted)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <RefreshCw size={14} /> 새로고침
          </button>
          <button onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--color-primary)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <FileSpreadsheet size={14} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* KPI 카드 5개 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { icon: <Home size={18} style={{ color: 'var(--color-info)' }} />, label: '총 관리 호실', value: `${totalRooms}세대`, accent: 'var(--color-info-bg)' },
          { icon: <TrendingUp size={18} style={{ color: 'var(--color-success)' }} />, label: '입주율', value: `${occupancyRate}%`, sub: `${totalRooms - vacantRooms}/${totalRooms} 세대`, accent: 'var(--color-success-bg)' },
          { icon: <BarChart3 size={18} style={{ color: 'var(--color-danger)' }} />, label: '미납 총액', value: formatKRW(totalUnpaid), sub: `${unpaidRooms.length}세대`, accent: 'var(--color-danger-bg)' },
          { icon: <PieChart size={18} style={{ color: 'var(--color-accent-dark, #1d3557)' }} />, label: '월 예상 수납', value: formatKRW(monthlyExpected), accent: 'var(--color-muted-bg)' },
          {
            icon: <TrendingUp size={18} style={{ color: collectionRateColor }} />,
            label: '이번달 수납률',
            value: currentMonthTotal > 0 ? `${collectionRate}%` : '-',
            sub: currentMonthTotal > 0 ? `${currentMonthPaid}/${currentMonthTotal}건` : '청구 없음',
            accent: currentMonthTotal > 0 ? collectionRateBg : 'var(--color-muted-bg)',
            valueColor: currentMonthTotal > 0 ? collectionRateColor : undefined,
          },
        ].map(card => (
          <div key={card.label} className="card p-5 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: card.accent }}>
              {card.icon}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>{card.label}</p>
              <p className="text-2xl font-bold tabular"
                 style={{ fontFamily: 'var(--font-display)', color: (card as { valueColor?: string }).valueColor ?? 'var(--color-primary)' }}>
                {card.value}
              </p>
              {card.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{card.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* 월별 수납 막대 차트 (60%) — 목표 대비 실적 */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              월별 수납 현황
            </h3>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#e2e8f0' }} /> 청구액
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#a8dadc' }} /> 수납액
              </span>
            </div>
          </div>
          {monthlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6d7d8b' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <RechartsTooltip
                  formatter={(v: unknown, name: unknown) => [
                    formatKRW(Number(v)),
                    name === 'paid' ? '수납액' : '청구액',
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="expected" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
                <Bar dataKey="paid" fill="#a8dadc" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm"
                 style={{ color: 'var(--color-muted)' }}>
              수납 데이터가 없습니다.
            </div>
          )}
        </div>

        {/* 호실 상태 파이 차트 (40%) */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            호실 상태 분포
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <RechartsPieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={60} outerRadius={90}
                     paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(v: unknown, name: unknown) => [`${v}세대`, String(name)]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle"
                        wrapperStyle={{ fontSize: 12 }} />
              </RechartsPieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm"
                 style={{ color: 'var(--color-muted)' }}>
              호실 데이터가 없습니다.
            </div>
          )}
        </div>

      </div>

      {/* 미납/연체 호실 목록 */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
          미납 · 연체 현황
        </h3>
        {unpaidDetail.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm"
               style={{ color: 'var(--color-success)' }}>
            <CheckCircle size={16} />
            <span>모든 호실 납부 완료</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['호실', '입주사', '월 이용료', '납기일', '상태'].map(h => (
                    <th key={h} className="text-left pb-2 pr-4 font-medium text-xs uppercase tracking-wide"
                        style={{ color: 'var(--color-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unpaidDetail.map(inv => {
                  const isOverdue = inv.status === 'overdue'
                  const dueDateStr = inv.due_date
                    ? new Date(inv.due_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
                    : `${inv.year}년 ${inv.month}월`
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="py-3 pr-4 font-medium" style={{ color: 'var(--color-primary)' }}>
                        {inv.rooms?.name ?? '-'}호
                      </td>
                      <td className="py-3 pr-4" style={{ color: 'var(--color-primary)' }}>
                        {inv.tenant_name ?? '-'}
                      </td>
                      <td className="py-3 pr-4 tabular-nums" style={{ color: 'var(--color-muted)' }}>
                        {formatKRW(inv.amount)}
                      </td>
                      <td className="py-3 pr-4" style={{ color: 'var(--color-muted)' }}>
                        {dueDateStr}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                background: isOverdue ? 'var(--color-danger-bg)' : '#fef3c7',
                                color: isOverdue ? 'var(--color-danger)' : '#d97706',
                              }}>
                          <AlertCircle size={11} />
                          {isOverdue ? '연체' : '미납'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
