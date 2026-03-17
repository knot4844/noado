'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, Phone, Calendar, ChevronRight, ChevronLeft,
  User, Home, Loader2, X, AlertCircle, CheckCircle2,
  History, Pencil, LogOut, TrendingUp, LayoutList, GanttChartSquare,
  Send,
} from 'lucide-react'
import { formatKRW, formatDate, formatPhone } from '@/lib/utils'
import type { Room, Invoice, Payment, Tenant } from '@/types'

/* ─── 내부 통합 타입 ─────────────────────────────────────── */
interface TenantItem extends Tenant {
  room_name:     string
  room_status:   'PAID' | 'UNPAID' | 'VACANT'
  invoices:      Invoice[]
  latestInvoice: Invoice | null
}

interface InvoiceWithPayments extends Invoice {
  payments?: Payment[]
}

type FilterKey = 'all' | 'paid' | 'unpaid'

/* ─── 메인 컴포넌트 ──────────────────────────────────────── */
export default function TenantsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems]         = useState<TenantItem[]>([])
  const [allRooms, setAllRooms]   = useState<Room[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<FilterKey>('all')
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<TenantItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [historyItem, setHistoryItem] = useState<TenantItem | null>(null)
  const [toast, setToast]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [viewMode, setViewMode]       = useState<'list' | 'timeline'>('list')
  const [requestingId, setRequestingId] = useState<string | null>(null)

  /* ─── 데이터 로드 ──────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const year  = new Date().getFullYear()
    const month = new Date().getMonth() + 1
    const today = new Date().toISOString().split('T')[0]

    // 1. 모든 호실 (status·name 참조용)
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('*')
      .eq('owner_id', user.id)
      .order('name')

    if (!roomsData) { setLoading(false); return }
    setAllRooms(roomsData as Room[])

    const roomIds = roomsData.map((r: Room) => r.id)

    // 2. 현재 활성 입주사 (lease_end IS NULL 또는 아직 유효)
    const { data: tenantsData, error: tenErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('owner_id', user.id)
      .or(`lease_end.is.null,lease_end.gte.${today}`)
      .order('created_at')

    if (tenErr) console.error('[tenants] load error:', tenErr)

    // 3. 최근 인보이스
    const { data: invData, error: invErr } = await supabase
      .from('invoices')
      .select('id, room_id, status, amount, paid_amount, year, month, due_date')
      .in('room_id', roomIds)
      .order('year',  { ascending: false })
      .order('month', { ascending: false })

    if (invErr) console.error('[tenants] invoices error:', invErr)
    console.log('[tenants] invData:', invData?.length ?? 0, 'records, roomIds:', roomIds.length)

    // 4. 조인
    const roomMap: Record<string, Room> = {}
    for (const r of roomsData) roomMap[r.id] = r as Room

    const invoicesByRoom: Record<string, Invoice[]> = {}
    for (const inv of (invData || [])) {
      if (!invoicesByRoom[inv.room_id]) invoicesByRoom[inv.room_id] = []
      invoicesByRoom[inv.room_id].push(inv as Invoice)
    }

    // 방 1개당 가장 최근 활성 입주사 1명만 (중복 방어)
    const latestByRoom: Record<string, Tenant> = {}
    for (const t of (tenantsData || []) as Tenant[]) {
      const prev = latestByRoom[t.room_id]
      if (!prev || new Date(t.created_at) > new Date(prev.created_at)) {
        latestByRoom[t.room_id] = t
      }
    }

    const result: TenantItem[] = Object.values(latestByRoom)
      .filter(t => roomMap[t.room_id])
      .map(t => {
        const room    = roomMap[t.room_id]
        const invs    = invoicesByRoom[t.room_id] || []
        const current = invs.find(i => i.year === year && i.month === month)
        return {
          ...t,
          room_name:     room.name,
          room_status:   room.status,
          invoices:      invs,
          latestInvoice: current ?? null,
        }
      })
      .sort((a, b) => a.room_name.localeCompare(b.room_name, 'ko'))

    setItems(result)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  /* ─── 납부 요청 핸들러 ──────────────────────────────────── */
  const handlePaymentRequest = async (item: TenantItem) => {
    if (requestingId) return
    setRequestingId(item.id)
    try {
      const res = await fetch('/api/contracts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '납부 요청 실패')
      showToast('success', data.message || '납부 요청이 발송되었습니다.')
      load()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '납부 요청 중 오류가 발생했습니다.')
    } finally {
      setRequestingId(null)
    }
  }

  /* ─── 필터 ─────────────────────────────────────────────── */
  const counts = {
    all:    items.length,
    paid:   items.filter(i => i.room_status === 'PAID').length,
    unpaid: items.filter(i => i.room_status === 'UNPAID').length,
  }

  const filtered = items.filter(item => {
    const matchFilter =
      filter === 'all'    ? true :
      filter === 'paid'   ? item.room_status === 'PAID' :
                            item.room_status === 'UNPAID'
    const q = search.toLowerCase()
    const matchSearch = !q ||
      item.name.toLowerCase().includes(q) ||
      item.room_name.toLowerCase().includes(q) ||
      (item.phone?.includes(q) ?? false)
    return matchFilter && matchSearch
  })

  // 새 입주사 추가 시 선택 가능한 호실 (활성 입주사 없는 호실)
  const occupiedRoomIds = new Set(items.map(i => i.room_id))
  const availableRooms  = allRooms.filter(r => !occupiedRoomIds.has(r.id))

  return (
    <div className="p-6 max-w-[1200px]">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
             style={{ background: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            입주사 관리
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            현재 입주 중인 입주사 정보 및 수납 현황
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 뷰 토글 */}
          <div className="flex gap-0.5 p-1 rounded-lg" style={{ background: 'var(--color-muted-bg)' }}>
            <button
              onClick={() => setViewMode('list')}
              title="목록 보기"
              className="w-8 h-8 flex items-center justify-center rounded-md transition-all"
              style={{
                background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-muted)',
                boxShadow: viewMode === 'list' ? 'var(--shadow-soft)' : 'none',
              }}>
              <LayoutList size={15} />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              title="타임라인 보기"
              className="w-8 h-8 flex items-center justify-center rounded-md transition-all"
              style={{
                background: viewMode === 'timeline' ? 'var(--color-surface)' : 'transparent',
                color: viewMode === 'timeline' ? 'var(--color-primary)' : 'var(--color-muted)',
                boxShadow: viewMode === 'timeline' ? 'var(--shadow-soft)' : 'none',
              }}>
              <GanttChartSquare size={15} />
            </button>
          </div>
          <button
            onClick={() => { setSelected(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--color-primary)' }}>
            <Plus size={16} /> 입주사 추가
          </button>
        </div>
      </div>

      {/* 필터 + 검색 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-muted-bg)' }}>
          {([
            { key: 'all',    label: '전체',  color: 'var(--color-primary)' },
            { key: 'paid',   label: '완납',  color: 'var(--color-success)' },
            { key: 'unpaid', label: '미납',  color: 'var(--color-danger)'  },
          ] as { key: FilterKey; label: string; color: string }[]).map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
              style={{
                background: filter === t.key ? 'var(--color-surface)' : 'transparent',
                color:      filter === t.key ? t.color : 'var(--color-muted)',
                boxShadow:  filter === t.key ? 'var(--shadow-soft)' : 'none',
              }}>
              {t.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: filter === t.key
                        ? t.key === 'paid'   ? 'var(--color-success-bg)'
                        : t.key === 'unpaid' ? 'var(--color-danger-bg)'
                        : 'rgba(29,53,87,0.1)'
                        : 'transparent',
                      color: filter === t.key ? t.color : 'var(--color-muted)',
                    }}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름, 호실, 연락처 검색..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} />
        </div>
      </div>

      {/* 콘텐츠 */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : viewMode === 'timeline' ? (
        <ContractTimeline items={filtered} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed"
             style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
          <User size={32} className="mb-2 opacity-30" />
          <p className="text-sm">
            {items.length === 0
              ? '등록된 입주사가 없습니다. 먼저 마이그레이션 SQL을 실행하거나 입주사를 추가해주세요.'
              : '검색 결과가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <TenantCard
              key={item.id}
              item={item}
              onHistory={() => setHistoryItem(item)}
              onEdit={() => { setSelected(item); setShowModal(true) }}
              onRequestPayment={() => handlePaymentRequest(item)}
              isRequesting={requestingId === item.id}
            />
          ))}
        </div>
      )}

      {/* 납부 이력 모달 */}
      {historyItem && (
        <PaymentHistoryModal
          item={historyItem}
          onClose={() => setHistoryItem(null)}
          onEdit={() => { setSelected(historyItem); setHistoryItem(null); setShowModal(true) }}
        />
      )}

      {/* 추가/편집 모달 */}
      {showModal && (
        <TenantModal
          item={selected}
          availableRooms={selected ? [] : availableRooms}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); showToast('success', '저장되었습니다.') }}
          onEvicted={() => { setShowModal(false); load(); showToast('success', '퇴실 처리되었습니다.') }}
          onError={(msg) => showToast('error', msg)}
        />
      )}
    </div>
  )
}

/* ─── 입주사 카드 ────────────────────────────────────────── */
const _NOW_MS = Date.now()
function TenantCard({ item, onHistory, onEdit, onRequestPayment, isRequesting }: {
  item: TenantItem
  onHistory: () => void
  onEdit: () => void
  onRequestPayment: () => void
  isRequesting: boolean
}) {
  const isPaid      = item.room_status === 'PAID'
  const statusColor = isPaid ? 'var(--color-success)' : 'var(--color-danger)'
  const statusBg    = isPaid ? 'var(--color-success-bg)' : 'var(--color-danger-bg)'
  const statusLabel = isPaid ? '완납' : '미납'

  const daysLeft = item.lease_end
    ? Math.ceil((new Date(item.lease_end).getTime() - _NOW_MS) / 86400000)
    : null

  // 최근 12개월 납부 현황
  const recentMonths = (() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const inv = item.invoices.find(v => v.year === d.getFullYear() && v.month === d.getMonth() + 1)
      return { label: `${d.getMonth() + 1}월`, status: inv?.status ?? null }
    })
  })()

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
         style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)', border: '1px solid var(--color-border)' }}>

      <button onClick={onHistory} className="text-left w-full p-5"
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,53,87,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

        {/* 호실 + D-Day + 상태 배지 */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              <Home size={12} /> {item.room_name}
            </div>
            <p className="font-bold text-base" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
              {item.name}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {daysLeft !== null && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      background: daysLeft <= 0  ? 'var(--color-danger-bg)'    :
                                  daysLeft <= 30 ? 'var(--color-danger-bg)'    :
                                                   'rgba(245,158,11,0.12)',
                      color:      daysLeft <= 30 ? 'var(--color-danger)'       :
                                                   'rgb(180,120,0)',
                    }}>
                {daysLeft <= 0 ? '만료됨' : `D-${daysLeft}`}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: statusBg, color: statusColor }}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* 월세 / 보증금 */}
        <div className="flex gap-4 mb-3">
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>월세</p>
            <p className="text-sm font-semibold tabular" style={{ color: 'var(--color-text)' }}>
              {formatKRW(item.monthly_rent)}
            </p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>보증금</p>
            <p className="text-sm font-semibold tabular" style={{ color: 'var(--color-text)' }}>
              {formatKRW(item.deposit)}
            </p>
          </div>
        </div>

        {/* 연락처 */}
        <div className="flex items-center gap-1 text-xs mb-2" style={{ color: 'var(--color-muted)' }}>
          <Phone size={11} />
          {item.phone ? formatPhone(item.phone) : '연락처 없음'}
        </div>

        {/* 계약일 */}
        <div className="flex items-center justify-between text-xs mb-3" style={{ color: 'var(--color-muted)' }}>
          <div className="flex items-center gap-1">
            <Calendar size={11} />
            {item.lease_start ? formatDate(item.lease_start) : '계약일 없음'}
          </div>
          {item.lease_end && (
            <div className="flex items-center gap-1" style={{ color: 'var(--color-muted)' }}>
              ~{formatDate(item.lease_end)}
            </div>
          )}
        </div>

        {/* 최근 12개월 납부 도트 */}
        <div className="flex items-center gap-0.5 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <span className="text-xs shrink-0 mr-1" style={{ color: 'var(--color-muted)' }}>12개월</span>
          <div className="flex items-center gap-0.5 flex-1 min-w-0">
            {recentMonths.map((m, i) => (
              <div key={i}
                   title={`${m.label} · ${m.status === 'paid' ? '완납' : m.status === 'ready' || m.status === 'overdue' ? '미납' : '청구없음'}`}
                   className="w-3.5 h-3.5 rounded-full shrink-0"
                   style={{
                     background: m.status === 'paid'    ? 'var(--color-success)' :
                                 m.status === 'overdue'  ? 'var(--color-danger)'  :
                                 m.status === 'ready'    ? 'rgba(245,158,11,0.7)' :
                                 'var(--color-muted-bg)',
                   }} />
            ))}
          </div>
          <ChevronRight size={13} className="shrink-0 ml-1" style={{ color: 'var(--color-muted)' }} />
        </div>
      </button>

      {/* 하단 액션 */}
      <div className="flex border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button onClick={onHistory}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium"
          style={{ color: 'var(--color-primary)', borderRight: '1px solid var(--color-border)' }}>
          <History size={13} /> 납부 이력
        </button>
        <button
          onClick={e => { e.stopPropagation(); onRequestPayment() }}
          disabled={isRequesting || item.room_status === 'PAID'}
          title={item.room_status === 'PAID' ? '이미 완납 상태입니다' : '납부 요청 알림톡 발송'}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors disabled:opacity-40"
          style={{
            color: item.room_status === 'PAID' ? 'var(--color-muted)' : 'var(--color-success)',
            borderRight: '1px solid var(--color-border)',
          }}>
          {isRequesting
            ? <><Loader2 size={12} className="animate-spin" /> 발송 중...</>
            : <><Send size={12} /> 납부 요청</>}
        </button>
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium"
          style={{ color: 'var(--color-muted)' }}>
          <Pencil size={13} /> 수정
        </button>
      </div>
    </div>
  )
}

/* ─── 납부 이력 모달 ─────────────────────────────────────── */
/* 계약기간 내 월인지 확인 */
function isInContractPeriod(year: number, month: number, leaseStart: string | null, leaseEnd: string | null): boolean {
  // 해당 월의 첫날 / 마지막날
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd   = new Date(year, month, 0)
  if (leaseStart) {
    const start = new Date(leaseStart)
    if (monthEnd < start) return false
  }
  if (leaseEnd) {
    const end = new Date(leaseEnd)
    if (monthStart > end) return false
  }
  return true
}

function PaymentHistoryModal({ item, onClose, onEdit }: {
  item: TenantItem
  onClose: () => void
  onEdit: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [invoices,     setInvoices]     = useState<InvoiceWithPayments[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data: invData } = await supabase
        .from('invoices')
        .select('*')
        .eq('room_id', item.room_id)
        .order('year',  { ascending: false })
        .order('month', { ascending: false })

      if (!invData?.length) { setInvoices([]); setLoading(false); return }

      const invIds = invData.map((i: Invoice) => i.id)
      const { data: payData } = await supabase
        .from('payments')
        .select('*')
        .in('invoice_id', invIds)
        .order('paid_at', { ascending: false })

      const merged = invData.map((inv: Invoice) => ({
        ...inv,
        payments: (payData || []).filter((p: Payment) => p.invoice_id === inv.id),
      }))
      setInvoices(merged)

      // 가장 최근 데이터가 있는 연도로 초기화
      const years = [...new Set(merged.map((i: Invoice) => i.year))].sort((a: number, b: number) => b - a)
      if (years.length > 0) setSelectedYear(years[0] as number)

      setLoading(false)
    })()
  }, [item.room_id, supabase])

  const byYear = invoices.reduce<Record<number, InvoiceWithPayments[]>>((acc, inv) => {
    if (!acc[inv.year]) acc[inv.year] = []
    acc[inv.year].push(inv)
    return acc
  }, {})

  // 선택 연도 전체 통계
  const yearInvoices  = byYear[selectedYear] ?? []
  const totalInvoiced = yearInvoices.reduce((s, i) => s + (i.amount ?? 0), 0)
  const totalPaid     = yearInvoices.reduce((s, i) => s + (i.paid_amount ?? 0), 0)
  const totalUnpaid   = totalInvoiced - totalPaid
  const paidCount     = yearInvoices.filter(i => i.status === 'paid').length
  const unpaidCount   = yearInvoices.filter(i => i.status !== 'paid' && i.amount > 0).length

  // 연도 목록 (청구 있는 연도 + 현재연도 포함)
  const allYears = useMemo(() => {
    const ys = new Set(invoices.map(i => i.year))
    ys.add(new Date().getFullYear())
    return [...ys].sort((a, b) => b - a)
  }, [invoices])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)', maxHeight: '88vh' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
             style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <div className="flex items-center gap-2">
              <History size={16} style={{ color: 'var(--color-primary)' }} />
              <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
                납부 이력
              </h2>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {item.room_name} · {item.name} · {formatKRW(item.monthly_rent)}/월
              {item.lease_start && <span> · 입주 {formatDate(item.lease_start)}</span>}
              {item.lease_end   && <span> ~ {formatDate(item.lease_end)}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
              <Pencil size={12} /> 수정
            </button>
            <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          ) : (
            <>
              {/* 연도 선택 네비게이션 */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    const idx = allYears.indexOf(selectedYear)
                    if (idx < allYears.length - 1) setSelectedYear(allYears[idx + 1])
                  }}
                  disabled={allYears.indexOf(selectedYear) >= allYears.length - 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border transition-opacity disabled:opacity-30"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg border text-sm font-bold outline-none"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-primary)' }}>
                    {allYears.map(y => (
                      <option key={y} value={y}>{y}년</option>
                    ))}
                  </select>
                  {yearInvoices.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
                      {yearInvoices.length}건
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    const idx = allYears.indexOf(selectedYear)
                    if (idx > 0) setSelectedYear(allYears[idx - 1])
                  }}
                  disabled={allYears.indexOf(selectedYear) <= 0}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border transition-opacity disabled:opacity-30"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* 12개월 도트 */}
              <div>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {Array.from({ length: 12 }, (_, mIdx) => {
                    const month = mIdx + 1
                    const inv   = yearInvoices.find(i => i.month === month)
                    const inContract = isInContractPeriod(selectedYear, month, item.lease_start, item.lease_end)
                    const bg = !inContract        ? 'transparent'
                             : !inv               ? 'var(--color-muted-bg)'
                             : inv.status === 'paid'    ? 'var(--color-success)'
                             : inv.status === 'overdue' ? 'var(--color-danger)'
                             :                           'rgba(245,158,11,0.7)'
                    const textColor = !inContract  ? 'var(--color-border)'
                                    : !inv         ? 'var(--color-muted)'
                                    :                '#fff'
                    const title = !inContract ? `${month}월 — 계약기간 외`
                                : !inv        ? `${month}월 — 청구 없음`
                                : `${month}월 — ${inv.status === 'paid' ? '완납' : inv.status === 'overdue' ? '연체' : '미납'} ${formatKRW(inv.amount)}`
                    return (
                      <div key={mIdx}
                           title={title}
                           className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold"
                           style={{
                             background: bg,
                             color: textColor,
                             border: !inContract ? '1px dashed var(--color-border)' : 'none',
                             opacity: !inContract ? 0.5 : 1,
                           }}>
                        {month}
                      </div>
                    )
                  })}
                </div>

                {/* 범례 */}
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-muted)' }}>
                  {[
                    { color: 'var(--color-success)',      label: '완납' },
                    { color: 'rgba(245,158,11,0.7)',      label: '미납' },
                    { color: 'var(--color-danger)',       label: '연체' },
                    { color: 'var(--color-muted-bg)',     label: '청구없음' },
                    { color: 'transparent', border: true, label: '계약기간 외' },
                  ].map(({ color, border, label }) => (
                    <div key={label} className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded"
                           style={{ background: color, border: border ? '1px dashed var(--color-border)' : 'none' }} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* 연도 통계 */}
              {yearInvoices.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: '총 청구',   value: formatKRW(totalInvoiced), icon: <TrendingUp size={14} />,   color: 'var(--color-primary)' },
                    { label: '수납 완료', value: formatKRW(totalPaid),     icon: <CheckCircle2 size={14} />, color: 'var(--color-success)' },
                    { label: '미수납',    value: formatKRW(totalUnpaid),   icon: <AlertCircle size={14} />,  color: totalUnpaid > 0 ? 'var(--color-danger)' : 'var(--color-muted)' },
                    { label: `완납 ${paidCount}회 / 미납 ${unpaidCount}회`, value: `${yearInvoices.length}개월`, icon: <Calendar size={14} />, color: 'var(--color-muted)' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: 'var(--color-muted-bg)' }}>
                      <div className="flex items-center gap-1 mb-1" style={{ color: s.color }}>
                        {s.icon}
                        <span className="text-xs font-medium">{s.label}</span>
                      </div>
                      <p className="text-sm font-bold tabular" style={{ color: 'var(--color-text)' }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 월별 청구 테이블 */}
              {yearInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-sm"
                     style={{ color: 'var(--color-muted)' }}>
                  <Calendar size={28} className="mb-2 opacity-30" />
                  {selectedYear}년 청구 이력이 없습니다.
                </div>
              ) : (
                <div>
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: 'var(--color-muted-bg)' }}>
                          {['월','청구액','수납액','미납액','납부일','상태'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--color-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {yearInvoices.sort((a, b) => b.month - a.month).map(inv => {
                          const unpaid = (inv.amount ?? 0) - (inv.paid_amount ?? 0)
                          const paidAt = inv.payments?.[0]?.paid_at ?? inv.paid_at
                          return (
                            <tr key={inv.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                              <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--color-text)' }}>{inv.month}월</td>
                              <td className="px-3 py-2.5 tabular" style={{ color: 'var(--color-text)' }}>{formatKRW(inv.amount)}</td>
                              <td className="px-3 py-2.5 tabular" style={{ color: inv.paid_amount > 0 ? 'var(--color-success)' : 'var(--color-muted)' }}>{formatKRW(inv.paid_amount)}</td>
                              <td className="px-3 py-2.5 tabular" style={{ color: unpaid > 0 ? 'var(--color-danger)' : 'var(--color-muted)' }}>{unpaid > 0 ? formatKRW(unpaid) : '—'}</td>
                              <td className="px-3 py-2.5" style={{ color: 'var(--color-muted)' }}>{paidAt ? formatDate(paidAt) : '—'}</td>
                              <td className="px-3 py-2.5">
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                      style={{
                                        background: inv.status === 'paid' ? 'var(--color-success-bg)' : inv.status === 'overdue' ? 'var(--color-danger-bg)' : 'var(--color-muted-bg)',
                                        color:      inv.status === 'paid' ? 'var(--color-success)'    : inv.status === 'overdue' ? 'var(--color-danger)'    : 'var(--color-muted)',
                                      }}>
                                  {inv.status === 'paid' ? '완납' : inv.status === 'overdue' ? '연체' : '미납'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── 입주사 추가 / 수정 모달 ─────────────────────────────── */
function TenantModal({
  item, availableRooms, onClose, onSaved, onEvicted, onError,
}: {
  item:           TenantItem | null
  availableRooms: Room[]
  onClose:        () => void
  onSaved:        () => void
  onEvicted:      () => void
  onError:        (msg: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const isEdit   = !!item

  const [form, setForm] = useState({
    room_id:      item?.room_id      ?? '',
    name:         item?.name         ?? '',
    phone:        item?.phone        ?? '',
    email:        item?.email        ?? '',
    monthly_rent: String(item?.monthly_rent ?? ''),
    deposit:      String(item?.deposit      ?? ''),
    lease_start:  item?.lease_start  ?? '',
    lease_end:    item?.lease_end    ?? '',
    memo:         item?.memo         ?? '',
  })
  const [saving,        setSaving]        = useState(false)
  const [confirmEvict,  setConfirmEvict]  = useState(false)
  const [evicting,      setEvicting]      = useState(false)

  const setField = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  /* ─ 저장 ─ */
  const handleSave = async () => {
    if (!form.name.trim()) return onError('입주사 이름을 입력해주세요.')
    if (!isEdit && !form.room_id) return onError('호실을 선택해주세요.')
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return onError('로그인이 필요합니다.') }

    const tenantPayload = {
      name:         form.name.trim(),
      phone:        form.phone        || null,
      email:        form.email        || null,
      monthly_rent: Number(form.monthly_rent) || 0,
      deposit:      Number(form.deposit)      || 0,
      lease_start:  form.lease_start  || null,
      lease_end:    form.lease_end    || null,
      memo:         form.memo         || null,
    }

    // rooms 동기화용 페이로드
    const roomSync = {
      tenant_name:  tenantPayload.name,
      tenant_phone: tenantPayload.phone,
      tenant_email: tenantPayload.email,
      monthly_rent: tenantPayload.monthly_rent,
      deposit:      tenantPayload.deposit,
      lease_start:  tenantPayload.lease_start,
      lease_end:    tenantPayload.lease_end,
    }

    if (isEdit) {
      const { error } = await supabase.from('tenants').update(tenantPayload).eq('id', item!.id)
      if (error) { onError(error.message); setSaving(false); return }
      // 현재 활성 입주사인 경우 rooms도 동기화
      await supabase.from('rooms').update(roomSync).eq('id', item!.room_id)
    } else {
      const { error } = await supabase.from('tenants').insert({
        ...tenantPayload,
        owner_id: user.id,
        room_id:  form.room_id,
      })
      if (error) { onError(error.message); setSaving(false); return }
      // 호실 입주사 정보 + 상태 UNPAID 반영
      await supabase.from('rooms').update({ ...roomSync, status: 'UNPAID' }).eq('id', form.room_id)
    }

    setSaving(false)
    onSaved()
  }

  /* ─ 퇴실 처리 ─ */
  const handleEvict = async () => {
    if (!item) return
    setEvicting(true)
    const today = new Date().toISOString().split('T')[0]

    await supabase.from('tenants').update({ lease_end: today }).eq('id', item.id)

    const { error } = await supabase.from('rooms').update({
      tenant_name:  null,
      tenant_phone: null,
      tenant_email: null,
      lease_start:  null,
      lease_end:    null,
      status:       'VACANT',
    }).eq('id', item.room_id)

    setEvicting(false)
    if (error) return onError(error.message)
    onEvicted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.4)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            {isEdit ? '입주사 정보 수정' : '신규 입주사 등록'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        {/* 폼 */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* 호실 */}
          {isEdit ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                 style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
              <Home size={14} />
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{item!.room_name}</span>
              <span className="text-xs ml-1">(호실 변경 불가)</span>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>호실 선택 *</label>
              <select value={form.room_id} onChange={setField('room_id')}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}>
                <option value="">호실을 선택하세요</option>
                {availableRooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {availableRooms.length === 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  모든 호실에 입주사가 있습니다. 호실 관리에서 공실을 추가하거나 기존 입주사를 퇴실 처리해주세요.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="입주사 이름 *" value={form.name}  onChange={setField('name')}  placeholder="홍길동" />
            <Field label="연락처"        value={form.phone} onChange={setField('phone')} placeholder="01012345678" type="tel" />
          </div>
          <Field label="이메일" value={form.email} onChange={setField('email')} placeholder="email@example.com" type="email" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="월세 (원)"   value={form.monthly_rent} onChange={setField('monthly_rent')} type="number" placeholder="330000" />
            <Field label="보증금 (원)" value={form.deposit}      onChange={setField('deposit')}      type="number" placeholder="1000000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="입주일"      value={form.lease_start} onChange={setField('lease_start')} type="date" />
            <Field label="퇴실 예정일" value={form.lease_end}   onChange={setField('lease_end')}   type="date" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>메모</label>
            <textarea value={form.memo} onChange={setField('memo')} rows={2} placeholder="특이사항 메모..."
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }} />
          </div>
        </div>

        {/* 퇴실 확인 영역 */}
        {confirmEvict && isEdit && (
          <div className="px-6 pb-2">
            <div className="px-4 py-3 rounded-xl"
                 style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)' }}>
              <p className="font-semibold text-sm mb-1" style={{ color: 'var(--color-danger)' }}>퇴실 처리하시겠습니까?</p>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
                오늘을 퇴실일로 기록하고 호실을 공실로 전환합니다. 납부 이력은 보존됩니다.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmEvict(false)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'var(--color-surface)' }}>
                  취소
                </button>
                <button onClick={handleEvict} disabled={evicting}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-60"
                  style={{ background: 'var(--color-danger)' }}>
                  {evicting ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                  퇴실 확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 푸터 */}
        <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {isEdit && (
            <button onClick={() => setConfirmEvict(true)} disabled={confirmEvict}
              className="p-2.5 rounded-lg border flex items-center justify-center disabled:opacity-40"
              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
              title="퇴실 처리">
              <LogOut size={16} />
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            취소
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? '저장' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── 계약 타임라인 ──────────────────────────────────────── */
function ContractTimeline({ items }: { items: TenantItem[] }) {
  type Unit = 'day' | 'month' | 'year'
  const [unit, setUnit]     = useState<Unit>('month')
  const [anchor, setAnchor] = useState(() => new Date())

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])

  const { viewStart, viewEnd, columns, colW } = useMemo(() => {
    const y = anchor.getFullYear()
    const m = anchor.getMonth()
    if (unit === 'year') {
      const base = y - 2
      const vs   = new Date(base, 0, 1)
      const ve   = new Date(base + 5, 0, 1)
      const cols = Array.from({ length: 5 }, (_, i) => ({ label: `${base + i}년`, key: `y${i}`, idx: i }))
      return { viewStart: vs, viewEnd: ve, columns: cols, colW: 150 }
    }
    if (unit === 'month') {
      const vs   = new Date(y, 0, 1)
      const ve   = new Date(y + 1, 0, 1)
      const cols = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
        .map((label, i) => ({ label, key: `m${i}`, idx: i }))
      return { viewStart: vs, viewEnd: ve, columns: cols, colW: 76 }
    }
    // day
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const vs   = new Date(y, m, 1)
    const ve   = new Date(y, m + 1, 1)
    const cols = Array.from({ length: daysInMonth }, (_, i) => ({ label: `${i + 1}`, key: `d${i}`, idx: i }))
    return { viewStart: vs, viewEnd: ve, columns: cols, colW: 38 }
  }, [unit, anchor])

  const totalMs = viewEnd.getTime() - viewStart.getTime()
  const totalW  = columns.length * colW
  const LABEL_W = 172

  const navigate = (dir: 1 | -1) => {
    setAnchor(prev => {
      const d = new Date(prev)
      if (unit === 'year')  d.setFullYear(d.getFullYear() + dir * 5)
      if (unit === 'month') d.setFullYear(d.getFullYear() + dir)
      if (unit === 'day')   d.setMonth(d.getMonth() + dir)
      return d
    })
  }

  const anchorLabel =
    unit === 'year'  ? `${anchor.getFullYear() - 2} ~ ${anchor.getFullYear() + 2}년` :
    unit === 'month' ? `${anchor.getFullYear()}년` :
                       `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`

  const todayMs  = today.getTime()
  const todayPct = (todayMs - viewStart.getTime()) / totalMs * 100

  const isCurrentCol = (idx: number) => {
    if (unit === 'year')  return anchor.getFullYear() - 2 + idx === today.getFullYear()
    if (unit === 'month') return idx === today.getMonth() && anchor.getFullYear() === today.getFullYear()
    return idx + 1 === today.getDate() && anchor.getMonth() === today.getMonth() && anchor.getFullYear() === today.getFullYear()
  }

  const sorted = [...items].sort((a, b) => a.room_name.localeCompare(b.room_name, 'ko'))

  const fmt = (d: Date) =>
    `${d.getFullYear().toString().slice(2)}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`

  return (
    <div>
      {/* 컨트롤 바 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* 단위 토글 */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-muted-bg)' }}>
          {(['year','month','day'] as Unit[]).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: unit === u ? 'var(--color-surface)' : 'transparent',
                color:      unit === u ? 'var(--color-primary)' : 'var(--color-muted)',
                boxShadow:  unit === u ? 'var(--shadow-soft)' : 'none',
              }}>
              {u === 'year' ? '연' : u === 'month' ? '월' : '일'}
            </button>
          ))}
        </div>

        {/* 네비게이션 */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold min-w-[168px] text-center" style={{ color: 'var(--color-text)' }}>
            {anchorLabel}
          </span>
          <button onClick={() => navigate(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <button onClick={() => setAnchor(new Date())}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'var(--color-surface)' }}>
          오늘
        </button>

        {/* 범례 */}
        <div className="flex items-center gap-3 ml-auto text-xs" style={{ color: 'var(--color-muted)' }}>
          {[
            { color: 'var(--color-success)', label: '계약 중' },
            { color: 'rgb(245,158,11)',       label: '60일 이내' },
            { color: 'var(--color-danger)',   label: '30일 이내' },
            { color: '#9ca3af',               label: '만료됨' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* 타임라인 그리드 */}
      <div className="rounded-2xl border overflow-hidden"
           style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${LABEL_W + totalW}px` }}>

            {/* 헤더 행 */}
            <div className="flex border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-muted-bg)' }}>
              <div className="shrink-0 border-r px-4 py-2.5 text-xs font-semibold"
                   style={{ width: LABEL_W, borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                호실 / 입주사
              </div>
              <div className="flex" style={{ width: totalW }}>
                {columns.map(col => (
                  <div key={col.key}
                       className="border-l text-xs py-2.5 text-center font-medium shrink-0"
                       style={{
                         width: colW,
                         borderColor: 'var(--color-border)',
                         color:      isCurrentCol(col.idx) ? 'var(--color-accent-dark)' : 'var(--color-muted)',
                         fontWeight: isCurrentCol(col.idx) ? '700' : '500',
                         background: isCurrentCol(col.idx) ? 'rgba(168,218,220,0.18)' : 'transparent',
                       }}>
                    {col.label}
                  </div>
                ))}
              </div>
            </div>

            {/* 데이터 행 */}
            {sorted.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm" style={{ color: 'var(--color-muted)' }}>
                표시할 계약 정보가 없습니다.
              </div>
            ) : sorted.map((item, rowIdx) => {
              const leaseStart = item.lease_start ? new Date(item.lease_start) : null
              const leaseEnd   = item.lease_end   ? new Date(item.lease_end)   : null

              const startMs  = leaseStart ? leaseStart.getTime() : viewStart.getTime()
              const endMs    = leaseEnd   ? leaseEnd.getTime()   : viewEnd.getTime()
              const leftPct  = Math.max(0,   (startMs - viewStart.getTime()) / totalMs * 100)
              const rightPct = Math.min(100, (endMs   - viewStart.getTime()) / totalMs * 100)
              const widthPct = Math.max(0, rightPct - leftPct)

              const daysLeft = leaseEnd
                ? Math.ceil((leaseEnd.getTime() - todayMs) / 86400000)
                : null

              const barColor =
                daysLeft === null  ? 'var(--color-primary)' :
                daysLeft < 0       ? '#9ca3af'              :
                daysLeft <= 30     ? 'var(--color-danger)'  :
                daysLeft <= 60     ? 'rgb(245,158,11)'      :
                                     'var(--color-success)'

              const barVisible = widthPct > 0 && rightPct > 0 && leftPct < 100

              return (
                <div key={item.id} className="flex border-b"
                     style={{
                       borderColor: 'var(--color-border)',
                       minHeight: 50,
                       background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(29,53,87,0.018)',
                     }}>
                  {/* 라벨 */}
                  <div className="shrink-0 border-r px-4 py-2 flex flex-col justify-center"
                       style={{ width: LABEL_W, borderColor: 'var(--color-border)' }}>
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                      {item.room_name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                      {item.name}
                    </p>
                  </div>

                  {/* 바 영역 */}
                  <div className="relative" style={{ width: totalW, height: 50 }}>
                    {/* 컬럼 배경 / 구분선 */}
                    {columns.map(col => (
                      <div key={col.key} className="absolute top-0 bottom-0"
                           style={{
                             left: col.idx * colW, width: colW,
                             borderLeft: '1px solid var(--color-border)',
                             background: isCurrentCol(col.idx) ? 'rgba(168,218,220,0.07)' : 'transparent',
                           }} />
                    ))}

                    {/* 오늘 선 */}
                    {todayPct >= 0 && todayPct <= 100 && (
                      <div className="absolute top-0 bottom-0 z-10 pointer-events-none"
                           style={{ left: `${todayPct}%`, width: 2, background: 'rgba(239,68,68,0.45)' }} />
                    )}

                    {/* 계약 바 */}
                    {barVisible && (
                      <div className="absolute rounded-md flex items-center px-2 overflow-hidden z-[5]"
                           style={{
                             left:       `${leftPct}%`,
                             width:      `${widthPct}%`,
                             top:        11,
                             height:     28,
                             background: barColor,
                             opacity:    daysLeft !== null && daysLeft < 0 ? 0.38 : 0.84,
                             minWidth:   6,
                           }}>
                        {widthPct > 5 && (
                          <span className="text-white font-medium truncate leading-none select-none"
                                style={{ fontSize: 11 }}>
                            {leaseStart ? fmt(leaseStart) : ''}
                            {leaseEnd && widthPct > 12 ? ` ~ ${fmt(leaseEnd)}` : ''}
                            {!leaseEnd && widthPct > 12 ? ' ~' : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {/* D-day 배지 */}
                    {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && rightPct >= 0 && rightPct <= 102 && (
                      <div className="absolute z-20 pointer-events-none"
                           style={{ left: `${Math.min(rightPct, 97)}%`, top: 5, transform: 'translateX(-50%)' }}>
                        <span className="text-white font-bold rounded-full px-1.5 py-0.5 whitespace-nowrap"
                              style={{ background: 'var(--color-danger)', fontSize: 10 }}>
                          D-{daysLeft}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 공통 폼 필드 ──────────────────────────────────────── */
function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label:       string
  value:       string
  onChange:    (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?:        string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
        onFocus={e => e.target.style.borderColor = 'var(--color-accent-dark)'}
        onBlur={e  => e.target.style.borderColor = 'var(--color-border)'} />
    </div>
  )
}
