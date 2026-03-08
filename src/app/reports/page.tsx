'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, BarChart3, PieChart, Home, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import * as XLSX from 'xlsx'
import type { Room } from '@/types'

interface Invoice {
  id: string
  year: number
  month: number
  paid_amount: number
  amount: number
  status: string
}

const COLORS = ['#1d3557', '#a8dadc', '#e63946']

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [rooms, setRooms] = useState<Room[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: roomList }, { data: invoiceList }] = await Promise.all([
      supabase.from('rooms').select('*').eq('owner_id', user.id),
      supabase.from('invoices').select('*').eq('owner_id', user.id)
        .order('year').order('month'),
    ])

    setRooms(roomList ?? [])
    setInvoices(invoiceList ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // ── 통계 계산 ──
  const totalRooms   = rooms.length
  const vacantRooms  = rooms.filter(r => r.status === 'VACANT').length
  const unpaidRooms  = rooms.filter(r => r.status === 'UNPAID')
  const paidRooms    = rooms.filter(r => r.status === 'PAID')
  const occupancyRate = totalRooms > 0
    ? Math.round(((totalRooms - vacantRooms) / totalRooms) * 100) : 0

  const totalUnpaid = unpaidRooms.reduce((s, r) => s + r.monthly_rent, 0)
  const monthlyExpected = rooms
    .filter(r => r.status !== 'VACANT')
    .reduce((s, r) => s + r.monthly_rent, 0)

  // 월별 수납 차트 (최근 12개월)
  const monthlyChartData = useMemo(() => {
    const grouped: Record<string, number> = {}
    invoices.filter(i => i.status === 'paid').forEach(i => {
      const key = `${i.year}-${String(i.month).padStart(2, '0')}`
      grouped[key] = (grouped[key] ?? 0) + (i.paid_amount || 0)
    })
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, amount]) => ({
        name: `${key.slice(2, 4)}-${key.slice(5)}`,
        amount,
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
    ]
    const roomData = rooms.map(r => ({
      호실: r.name,
      임차인: r.tenant_name || '',
      월세: r.monthly_rent,
      보증금: r.deposit || 0,
      상태: r.status,
      계약시작: r.lease_start || '',
      계약만료: r.lease_end || '',
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), '요약')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roomData), '호실현황')
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
    <div className="max-w-7xl mx-auto space-y-6">

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

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <Home size={18} style={{ color: 'var(--color-info)' }} />, label: '총 관리 호실', value: `${totalRooms}세대`, accent: 'var(--color-info-bg)' },
          { icon: <TrendingUp size={18} style={{ color: 'var(--color-success)' }} />, label: '입주율', value: `${occupancyRate}%`, sub: `${totalRooms - vacantRooms}/${totalRooms} 세대`, accent: 'var(--color-success-bg)' },
          { icon: <BarChart3 size={18} style={{ color: 'var(--color-danger)' }} />, label: '미납 총액', value: formatKRW(totalUnpaid), sub: `${unpaidRooms.length}세대`, accent: 'var(--color-danger-bg)' },
          { icon: <PieChart size={18} style={{ color: 'var(--color-accent-dark, #1d3557)' }} />, label: '월 예상 수납', value: formatKRW(monthlyExpected), accent: 'var(--color-muted-bg)' },
        ].map(card => (
          <div key={card.label} className="card p-5 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: card.accent }}>
              {card.icon}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted)' }}>{card.label}</p>
              <p className="text-2xl font-bold tabular" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>{card.value}</p>
              {card.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{card.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* 월별 수납 막대 차트 (60%) */}
        <div className="card p-5 lg:col-span-3">
          <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            월별 수납 현황
          </h3>
          {monthlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6d7d8b' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <RechartsTooltip
                  formatter={(v: unknown) => [formatKRW(Number(v)), '수납액']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="amount" fill="#a8dadc" radius={[6, 6, 0, 0]} />
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
    </div>
  )
}
