'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, Phone, Calendar, ChevronRight, ChevronLeft,
  User, Home, Loader2, X, AlertCircle, CheckCircle2,
  History, Pencil, LogOut, TrendingUp, LayoutList, GanttChartSquare,
  Send, Wallet,
} from 'lucide-react'
import { formatKRW, formatDate, formatPhone } from '@/lib/utils'
import type { Room, Invoice, Payment, Tenant, Lease, ContractType, VatType } from '@/types'

/* ─── 내부 통합 타입 ─────────────────────────────────────── */
interface LeaseItem {
  lease:         Lease
  tenant:        Tenant
  room:          Room
  invoices:      Invoice[]
  latestInvoice: Invoice | null
  /** 미수납 합계 (잔여 청구액 — Stage 4) */
  unpaidTotal:   number
  /** PREPAY 잔액 (선납금 — Stage 4) */
  prepayBalance: number
}

interface InvoiceWithPayments extends Invoice {
  payments?: Payment[]
}

type FilterKey = 'all' | 'paid' | 'unpaid'

/* ─── 계약 유형 라벨 ─────────────────────────────────────── */
const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  OCCUPANCY: '전용좌석',
  BIZ_ONLY:  '공용좌석',
  STORAGE:   '보관',
}

/* ─── 메인 컴포넌트 ──────────────────────────────────────── */
export default function TenantsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems]               = useState<LeaseItem[]>([])
  const [allRooms, setAllRooms]         = useState<Room[]>([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState<FilterKey>('all')
  const [search, setSearch]             = useState('')
  const [historyItem, setHistoryItem]   = useState<LeaseItem | null>(null)
  const [editItem, setEditItem]         = useState<LeaseItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [viewMode, setViewMode]         = useState<'list' | 'timeline'>('list')
  const [requestingId, setRequestingId] = useState<string | null>(null)

  /* ─── 데이터 로드 ──────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const year  = new Date().getFullYear()
    const month = new Date().getMonth() + 1

    // 1. 모든 호실 (신규 등록 시 사용)
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('*')
      .eq('owner_id', user.id)
      .order('name')
    setAllRooms((roomsData ?? []) as Room[])

    // 2. 활성 리스 (room, tenant 조인)
    const { data: leasesData, error: leaseErr } = await supabase
      .from('leases')
      .select('*, room:rooms(*), tenant:tenants(*)')
      .eq('owner_id', user.id)
      .eq('status', 'ACTIVE')
      .order('created_at')

    if (leaseErr) console.error('[tenants] leases error:', leaseErr)

    const roomIds = (leasesData ?? []).map((l: Lease) => l.room_id)

    // 3. 해당 호실 인보이스
    const { data: invData, error: invErr } = await supabase
      .from('invoices')
      .select('id, room_id, lease_id, tenant_id, status, amount, base_amount, extra_amount, paid_amount, year, month, due_date')
      .in('room_id', roomIds.length > 0 ? roomIds : ['00000000-0000-0000-0000-000000000000'])
      .order('year',  { ascending: false })
      .order('month', { ascending: false })

    if (invErr) console.error('[tenants] invoices error:', invErr)

    // 4. 각 lease의 PREPAY 잔액 (deposits)
    const leaseIds = (leasesData ?? []).map((l: Lease) => l.id)
    const { data: depData } = await supabase
      .from('deposits')
      .select('lease_id, amount, type, refunded_at')
      .in('lease_id', leaseIds.length > 0 ? leaseIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('type', 'PREPAY')
      .is('refunded_at', null)

    const prepayByLease: Record<string, number> = {}
    for (const d of (depData ?? []) as { lease_id: string; amount: number }[]) {
      prepayByLease[d.lease_id] = (prepayByLease[d.lease_id] || 0) + (d.amount || 0)
    }

    // 5. 조인
    const invoicesByRoom: Record<string, Invoice[]> = {}
    for (const inv of (invData ?? [])) {
      if (!invoicesByRoom[inv.room_id]) invoicesByRoom[inv.room_id] = []
      invoicesByRoom[inv.room_id].push(inv as Invoice)
    }

    const result: LeaseItem[] = (leasesData ?? [])
      .filter((l: Lease & { room?: Room; tenant?: Tenant }) => l.room && l.tenant)
      .map((l: Lease & { room?: Room; tenant?: Tenant }) => {
        const invs    = invoicesByRoom[l.room_id] ?? []
        const current = invs.find(i => i.year === year && i.month === month) ?? null
        // 미수납 합계: 미납 청구서의 (amount - paid_amount) 합
        const unpaidTotal = invs
          .filter(i => i.status !== 'paid')
          .reduce((s, i) => s + Math.max(0, (i.amount || 0) - (i.paid_amount || 0)), 0)
        return {
          lease:         l,
          tenant:        l.tenant as Tenant,
          room:          l.room as Room,
          invoices:      invs,
          latestInvoice: current,
          unpaidTotal,
          prepayBalance: prepayByLease[l.id] || 0,
        }
      })
      .sort((a: LeaseItem, b: LeaseItem) => a.room.name.localeCompare(b.room.name, 'ko'))

    setItems(result)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  /* ─── 납부 요청 핸들러 ──────────────────────────────────── */
  const handlePaymentRequest = async (item: LeaseItem) => {
    if (requestingId) return
    setRequestingId(item.lease.id)
    try {
      const res = await fetch('/api/contracts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: item.tenant.id }),
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
    paid:   items.filter(i => i.room.status === 'PAID').length,
    unpaid: items.filter(i => i.room.status === 'UNPAID').length,
  }

  const filtered = items.filter(item => {
    const matchFilter =
      filter === 'all'    ? true :
      filter === 'paid'   ? item.room.status === 'PAID' :
                            item.room.status === 'UNPAID'
    const q = search.toLowerCase()
    const matchSearch = !q ||
      item.tenant.name.toLowerCase().includes(q) ||
      item.room.name.toLowerCase().includes(q) ||
      (item.tenant.phone?.includes(q) ?? false)
    return matchFilter && matchSearch
  })

  // 신규 리스 추가 시 활성 리스가 없는 호실
  const occupiedRoomIds = new Set(items.map(i => i.room.id))
  const availableRooms  = allRooms.filter(r => !occupiedRoomIds.has(r.id))

  return (
    <div className="p-3 sm:p-6 max-w-[1200px]">
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
            onClick={() => setShowAddModal(true)}
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
              ? '등록된 입주사가 없습니다. 입주사를 추가해주세요.'
              : '검색 결과가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <LeaseCard
              key={item.lease.id}
              item={item}
              onHistory={() => setHistoryItem(item)}
              onEdit={() => setEditItem(item)}
              onRequestPayment={() => handlePaymentRequest(item)}
              isRequesting={requestingId === item.lease.id}
            />
          ))}
        </div>
      )}

      {/* 납부 이력 모달 */}
      {historyItem && (
        <PaymentHistoryModal
          item={historyItem}
          onClose={() => setHistoryItem(null)}
          onEdit={() => { setEditItem(historyItem); setHistoryItem(null) }}
        />
      )}

      {/* 수정 모달 */}
      {editItem && (
        <EditLeaseModal
          item={editItem}
          availableRooms={availableRooms}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); load(); showToast('success', '저장되었습니다.') }}
          onEvicted={() => { setEditItem(null); load(); showToast('success', '퇴실 처리되었습니다.') }}
          onTransferred={() => { setEditItem(null); load(); showToast('success', '호실 이동이 완료되었습니다.') }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* 추가 모달 */}
      {showAddModal && (
        <AddLeaseModal
          availableRooms={availableRooms}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); load(); showToast('success', '입주사가 등록되었습니다.') }}
          onError={(msg) => showToast('error', msg)}
        />
      )}
    </div>
  )
}

/* ─── 리스 카드 ──────────────────────────────────────────── */
const _NOW_MS = Date.now()
function LeaseCard({ item, onHistory, onEdit, onRequestPayment, isRequesting }: {
  item:             LeaseItem
  onHistory:        () => void
  onEdit:           () => void
  onRequestPayment: () => void
  isRequesting:     boolean
}) {
  const { lease, tenant, room, invoices, unpaidTotal, prepayBalance } = item
  const isPaid      = room.status === 'PAID'
  const statusColor = isPaid ? 'var(--color-success)' : 'var(--color-danger)'
  const statusBg    = isPaid ? 'var(--color-success-bg)' : 'var(--color-danger-bg)'
  const statusLabel = isPaid ? '완납' : '미납'

  const daysLeft = lease.lease_end
    ? Math.ceil((new Date(lease.lease_end).getTime() - _NOW_MS) / 86400000)
    : null

  // 최근 12개월 납부 현황
  const recentMonths = (() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const inv = invoices.find(v => v.year === d.getFullYear() && v.month === d.getMonth() + 1)
      // 계약기간 외 확인
      const inContract = isInContractPeriod(d.getFullYear(), d.getMonth() + 1, lease.lease_start, lease.lease_end)
      return { label: `${d.getMonth() + 1}월`, status: inv?.status ?? null, inContract }
    })
  })()

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
         style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)', border: '1px solid var(--color-border)' }}>

      <button onClick={onHistory} className="text-left w-full p-5"
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,53,87,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

        {/* 호실 + 계약유형 + 상태 배지 */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ color: 'var(--color-primary)' }}>
              <Home size={12} /> {room.name}
            </div>
            <p className="font-bold text-base" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
              {tenant.name}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2 flex-wrap justify-end">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(29,53,87,0.08)', color: 'var(--color-muted)' }}>
              {CONTRACT_TYPE_LABELS[lease.contract_type]}
            </span>
            {daysLeft !== null && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      background: daysLeft <= 0  ? 'var(--color-danger-bg)'  :
                                  daysLeft <= 30 ? 'var(--color-danger-bg)'  :
                                                   'rgba(245,158,11,0.12)',
                      color:      daysLeft <= 30 ? 'var(--color-danger)'     :
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

        {/* 월세 / 예치금 */}
        <div className="flex gap-4 mb-3">
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>월세</p>
            <p className="text-sm font-semibold tabular" style={{ color: 'var(--color-text)' }}>
              {formatKRW(lease.monthly_rent)}
            </p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>예치금</p>
            <p className="text-sm font-semibold tabular" style={{ color: 'var(--color-text)' }}>
              {formatKRW(lease.pledge_amount)}
            </p>
          </div>
        </div>

        {/* 잔액: 미수납 / 선납금 (Stage 4) */}
        {(unpaidTotal > 0 || prepayBalance > 0) && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg"
               style={{
                 background: unpaidTotal > 0 ? 'var(--color-danger-bg)' : 'rgba(16,185,129,0.08)',
                 border:     `1px solid ${unpaidTotal > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.18)'}`,
               }}>
            <Wallet size={12} style={{ color: unpaidTotal > 0 ? 'var(--color-danger)' : 'var(--color-success)' }} />
            {unpaidTotal > 0 && (
              <span className="text-xs font-semibold tabular" style={{ color: 'var(--color-danger)' }}>
                미수납 {formatKRW(unpaidTotal)}
              </span>
            )}
            {prepayBalance > 0 && (
              <span className="text-xs font-semibold tabular ml-auto" style={{ color: 'var(--color-success)' }}>
                선납 +{formatKRW(prepayBalance)}
              </span>
            )}
          </div>
        )}

        {/* 연락처 */}
        <div className="flex items-center gap-1 text-xs mb-2" style={{ color: 'var(--color-muted)' }}>
          <Phone size={11} />
          {tenant.phone ? formatPhone(tenant.phone) : '연락처 없음'}
        </div>

        {/* 계약기간 */}
        <div className="flex items-center justify-between text-xs mb-3" style={{ color: 'var(--color-muted)' }}>
          <div className="flex items-center gap-1">
            <Calendar size={11} />
            {formatDate(lease.lease_start)}
          </div>
          <div className="flex items-center gap-1">
            ~ {lease.lease_end ? formatDate(lease.lease_end) : '진행 중'}
          </div>
        </div>

        {/* 최근 12개월 납부 도트 */}
        <div className="flex items-center gap-0.5 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <span className="text-xs shrink-0 mr-1" style={{ color: 'var(--color-muted)' }}>12개월</span>
          <div className="flex items-center gap-0.5 flex-1 min-w-0">
            {recentMonths.map((m, i) => (
              <div key={i}
                   title={`${m.label} · ${
                     !m.inContract        ? '계약기간 외' :
                     m.status === 'paid'  ? '완납' :
                     m.status === 'ready' || m.status === 'overdue' ? '미납' : '청구없음'
                   }`}
                   className="w-3.5 h-3.5 rounded-full shrink-0"
                   style={{
                     background: !m.inContract        ? 'transparent'            :
                                 m.status === 'paid'  ? 'var(--color-success)'   :
                                 m.status === 'overdue' ? 'var(--color-danger)'  :
                                 m.status === 'ready' ? 'rgba(245,158,11,0.7)'  :
                                 'var(--color-muted-bg)',
                     border: !m.inContract ? '1px dashed var(--color-border)' : 'none',
                     opacity: !m.inContract ? 0.4 : 1,
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
          disabled={isRequesting || room.status === 'PAID'}
          title={room.status === 'PAID' ? '이미 완납 상태입니다' : '납부 요청 알림톡 발송'}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors disabled:opacity-40"
          style={{
            color: room.status === 'PAID' ? 'var(--color-muted)' : 'var(--color-success)',
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

/* ─── 계약기간 내 월인지 확인 ────────────────────────────── */
function isInContractPeriod(year: number, month: number, leaseStart: string | null, leaseEnd: string | null): boolean {
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

/* ─── 납부 이력 모달 ─────────────────────────────────────── */
function PaymentHistoryModal({ item, onClose, onEdit }: {
  item:    LeaseItem
  onClose: () => void
  onEdit:  () => void
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
        .eq('room_id', item.room.id)
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

      const years = [...new Set(merged.map((i: Invoice) => i.year))].sort((a: number, b: number) => b - a)
      if (years.length > 0) setSelectedYear(years[0] as number)

      setLoading(false)
    })()
  }, [item.room.id, supabase])

  const byYear = invoices.reduce<Record<number, InvoiceWithPayments[]>>((acc, inv) => {
    if (!acc[inv.year]) acc[inv.year] = []
    acc[inv.year].push(inv)
    return acc
  }, {})

  const yearInvoices  = byYear[selectedYear] ?? []
  const totalInvoiced = yearInvoices.reduce((s, i) => s + (i.amount ?? 0), 0)
  const totalPaid     = yearInvoices.reduce((s, i) => s + (i.paid_amount ?? 0), 0)
  const totalUnpaid   = totalInvoiced - totalPaid
  const paidCount     = yearInvoices.filter(i => i.status === 'paid').length
  const unpaidCount   = yearInvoices.filter(i => i.status !== 'paid' && i.amount > 0).length

  const allYears = useMemo(() => {
    const ys = new Set(invoices.map(i => i.year))
    ys.add(new Date().getFullYear())
    return [...ys].sort((a, b) => b - a)
  }, [invoices])

  const { lease, tenant, room } = item

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
              {room.name} · {tenant.name} · {formatKRW(lease.monthly_rent)}/월
              <span> · 입주 {formatDate(lease.lease_start)}</span>
              {lease.lease_end && <span> ~ {formatDate(lease.lease_end)}</span>}
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
                    const mon = mIdx + 1
                    const inv = yearInvoices.find(i => i.month === mon)
                    const inContract = isInContractPeriod(selectedYear, mon, lease.lease_start, lease.lease_end)
                    const bg = !inContract           ? 'transparent'
                             : !inv                  ? 'var(--color-muted-bg)'
                             : inv.status === 'paid'    ? 'var(--color-success)'
                             : inv.status === 'overdue' ? 'var(--color-danger)'
                             :                           'rgba(245,158,11,0.7)'
                    const textColor = !inContract  ? 'var(--color-border)'
                                    : !inv         ? 'var(--color-muted)'
                                    :                '#fff'
                    const title = !inContract ? `${mon}월 — 계약기간 외`
                                : !inv        ? `${mon}월 — 청구 없음`
                                : `${mon}월 — ${inv.status === 'paid' ? '완납' : inv.status === 'overdue' ? '연체' : '미납'} ${formatKRW(inv.amount)}`
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
                        {mon}
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

/* ─── 입주사 추가 모달 ────────────────────────────────────── */
function AddLeaseModal({
  availableRooms, onClose, onSaved, onError,
}: {
  availableRooms: Room[]
  onClose:        () => void
  onSaved:        () => void
  onError:        (msg: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])

  const [form, setForm] = useState({
    room_id:       '',
    name:          '',
    phone:         '',
    email:         '',
    monthly_rent:  '',
    pledge_amount: '',
    lease_start:   '',
    lease_end:     '',
    contract_type: 'OCCUPANCY' as ContractType,
    vat_type:      'NONE' as VatType,
    payment_day:   '25',
    memo:          '',
  })
  const [saving, setSaving] = useState(false)

  const setField = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.name.trim())    return onError('입주사 이름을 입력해주세요.')
    if (!form.room_id)        return onError('호실을 선택해주세요.')
    if (!form.lease_start)    return onError('계약 시작일을 입력해주세요.')
    if (!form.monthly_rent)   return onError('월세를 입력해주세요.')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return onError('로그인이 필요합니다.') }

    // 1. 기존 입주사 검색 또는 신규 생성
    let tenantId: string | null = null
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('owner_id', user.id)
      .ilike('name', form.name.trim())
      .maybeSingle()

    if (existingTenant) {
      tenantId = existingTenant.id
      // 연락처/이메일 업데이트
      await supabase.from('tenants').update({
        phone: form.phone || null,
        email: form.email || null,
      }).eq('id', tenantId)
    } else {
      const { data: newTenant, error: tenErr } = await supabase
        .from('tenants')
        .insert({
          owner_id: user.id,
          name:     form.name.trim(),
          phone:    form.phone  || null,
          email:    form.email  || null,
        })
        .select('id')
        .single()
      if (tenErr || !newTenant) {
        setSaving(false)
        return onError(tenErr?.message ?? '입주사 생성 실패')
      }
      tenantId = newTenant.id
    }

    // 2. 리스 생성
    const { error: leaseErr } = await supabase.from('leases').insert({
      owner_id:      user.id,
      room_id:       form.room_id,
      tenant_id:     tenantId,
      contract_type: form.contract_type,
      rate_type:     'MONTHLY',
      monthly_rent:  Number(form.monthly_rent)  || 0,
      pledge_amount: Number(form.pledge_amount) || 0,
      lease_start:   form.lease_start,
      lease_end:     form.lease_end || null,
      payment_day:   Number(form.payment_day) || 25,
      vat_type:      form.vat_type,
      status:        'ACTIVE',
      memo:          form.memo || null,
    })
    if (leaseErr) { setSaving(false); return onError(leaseErr.message) }

    // 3. 호실 상태 UNPAID
    await supabase.from('rooms').update({ status: 'UNPAID' }).eq('id', form.room_id)

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.4)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            신규 입주사 등록
          </h2>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 호실 */}
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
                모든 호실에 활성 계약이 있습니다. 기존 입주사를 퇴실 처리해주세요.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="입주사 이름 *" value={form.name}  onChange={setField('name')}  placeholder="홍길동" />
            <Field label="연락처"        value={form.phone} onChange={setField('phone')} placeholder="01012345678" type="tel" />
          </div>
          <Field label="이메일" value={form.email} onChange={setField('email')} placeholder="email@example.com" type="email" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="월세 (원) *"  value={form.monthly_rent}  onChange={setField('monthly_rent')}  type="number" placeholder="330000" />
            <Field label="예치금 (원)"  value={form.pledge_amount} onChange={setField('pledge_amount')} type="number" placeholder="1000000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="계약 시작일 *" value={form.lease_start} onChange={setField('lease_start')} type="date" />
            <Field label="계약 종료일"   value={form.lease_end}   onChange={setField('lease_end')}   type="date" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* 계약 유형 */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>계약 유형</label>
              <select value={form.contract_type} onChange={setField('contract_type')}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}>
                <option value="OCCUPANCY">전용좌석</option>
                <option value="BIZ_ONLY">공용좌석</option>
                <option value="STORAGE">보관</option>
              </select>
            </div>
            {/* 세금 유형 */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>세금 유형</label>
              <select value={form.vat_type} onChange={setField('vat_type')}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}>
                <option value="NONE">없음</option>
                <option value="VAT_INVOICE">세금계산서</option>
                <option value="CASH_RECEIPT">현금영수증</option>
              </select>
            </div>
            {/* 납부일 */}
            <Field label="납부일" value={form.payment_day} onChange={setField('payment_day')} type="number" placeholder="25" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>메모</label>
            <textarea value={form.memo} onChange={setField('memo')} rows={2} placeholder="특이사항 메모..."
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }} />
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            취소
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            등록
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── 리스 수정 모달 ─────────────────────────────────────── */
function EditLeaseModal({
  item, availableRooms, onClose, onSaved, onEvicted, onTransferred, onError,
}: {
  item:           LeaseItem
  availableRooms: Room[]
  onClose:        () => void
  onSaved:        () => void
  onEvicted:      () => void
  onTransferred:  () => void
  onError:        (msg: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const { lease, tenant, room } = item

  const [form, setForm] = useState({
    tenant_name:   tenant.name ?? '',
    tenant_phone:  tenant.phone ?? '',
    tenant_email:  tenant.email ?? '',
    monthly_rent:  String(lease.monthly_rent),
    pledge_amount: String(lease.pledge_amount),
    lease_start:   lease.lease_start,
    lease_end:     lease.lease_end ?? '',
    contract_type: lease.contract_type,
    vat_type:      lease.vat_type,
    payment_day:   String(lease.payment_day),
    memo:          lease.memo ?? '',
  })
  const [saving,       setSaving]       = useState(false)
  const [confirmEvict, setConfirmEvict] = useState(false)
  const [evicting,     setEvicting]     = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [transferRoomId, setTransferRoomId] = useState('')
  const [transferDate,   setTransferDate]   = useState(new Date().toISOString().split('T')[0])

  const setField = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    // 입주사 정보 업데이트
    const { error: tenantErr } = await supabase.from('tenants').update({
      name:  form.tenant_name || null,
      phone: form.tenant_phone || null,
      email: form.tenant_email || null,
    }).eq('id', tenant.id)
    if (tenantErr) { setSaving(false); return onError(tenantErr.message) }

    // 계약 정보 업데이트
    const { error } = await supabase.from('leases').update({
      monthly_rent:  Number(form.monthly_rent)  || 0,
      pledge_amount: Number(form.pledge_amount) || 0,
      lease_start:   form.lease_start || null,
      lease_end:     form.lease_end   || null,
      contract_type: form.contract_type,
      vat_type:      form.vat_type,
      payment_day:   Number(form.payment_day) || 25,
      memo:          form.memo || null,
    }).eq('id', lease.id)
    setSaving(false)
    if (error) return onError(error.message)
    onSaved()
  }

  const handleEvict = async () => {
    setEvicting(true)
    const today = new Date().toISOString().split('T')[0]
    const { error: leaseErr } = await supabase.from('leases').update({
      status:    'TERMINATED',
      lease_end: today,
    }).eq('id', lease.id)
    if (leaseErr) { setEvicting(false); return onError(leaseErr.message) }
    await supabase.from('rooms').update({ status: 'VACANT' }).eq('id', room.id)
    setEvicting(false)
    onEvicted()
  }

  const handleTransfer = async () => {
    if (!transferRoomId) return onError('이동할 호실을 선택해주세요.')
    if (!transferDate)   return onError('이동일을 선택해주세요.')
    setTransferring(true)

    // 1. 기존 lease 종료
    const { error: termErr } = await supabase.from('leases').update({
      status:    'TERMINATED',
      lease_end: transferDate,
    }).eq('id', lease.id)
    if (termErr) { setTransferring(false); return onError(termErr.message) }

    // 2. 기존 호실 공실 처리
    await supabase.from('rooms').update({ status: 'VACANT' }).eq('id', room.id)

    // 3. 새 lease 생성 (같은 tenant, 새 room)
    const { error: insErr } = await supabase.from('leases').insert({
      owner_id:      lease.owner_id,
      tenant_id:     tenant.id,
      room_id:       transferRoomId,
      monthly_rent:  Number(form.monthly_rent)  || 0,
      pledge_amount: Number(form.pledge_amount) || 0,
      lease_start:   transferDate,
      lease_end:     form.lease_end || null,
      contract_type: form.contract_type,
      vat_type:      form.vat_type,
      payment_day:   Number(form.payment_day) || 25,
      rate_type:     lease.rate_type ?? 'MONTHLY',
      status:        'ACTIVE',
      memo:          form.memo || null,
    })
    if (insErr) { setTransferring(false); return onError(insErr.message) }

    // 4. 새 호실 상태 UNPAID로 전환
    await supabase.from('rooms').update({ status: 'UNPAID' }).eq('id', transferRoomId)

    setTransferring(false)
    onTransferred()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.4)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              계약 정보 수정
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {room.name} · {tenant.name}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        {/* 호실 표시 + 호실 이동 */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
               style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
            <Home size={14} />
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{room.name}</span>
            <button
              onClick={() => setShowTransfer(v => !v)}
              className="ml-auto text-xs font-semibold px-2 py-1 rounded-md border"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
              {showTransfer ? '취소' : '호실 이동'}
            </button>
          </div>

          {showTransfer && (
            <div className="mt-2 px-4 py-3 rounded-xl space-y-3"
                 style={{ background: 'var(--color-surface)', border: '1px solid var(--color-primary)' }}>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                기존 계약을 이동일로 종료하고, 새 호실에 동일 조건으로 신규 계약을 생성합니다. 납부 이력은 보존됩니다.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>이동할 호실</label>
                  <select value={transferRoomId} onChange={e => setTransferRoomId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}>
                    <option value="">선택</option>
                    {availableRooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <Field label="이동일" value={transferDate}
                  onChange={e => setTransferDate(e.target.value)} type="date" />
              </div>
              <button onClick={handleTransfer} disabled={transferring || !transferRoomId}
                className="w-full py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-60"
                style={{ background: 'var(--color-primary)' }}>
                {transferring ? <Loader2 size={12} className="animate-spin" /> : <Home size={12} />}
                호실 이동 확정
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[52vh] overflow-y-auto">
          {/* 입주사 정보 */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="입주사명" value={form.tenant_name} onChange={setField('tenant_name')} placeholder="입주사 이름" />
            <Field label="전화번호" value={form.tenant_phone} onChange={setField('tenant_phone')} type="tel" placeholder="01012345678" />
            <Field label="이메일" value={form.tenant_email} onChange={setField('tenant_email')} type="email" placeholder="email@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="월세 (원)"  value={form.monthly_rent}  onChange={setField('monthly_rent')}  type="number" placeholder="330000" />
            <Field label="예치금 (원)" value={form.pledge_amount} onChange={setField('pledge_amount')} type="number" placeholder="1000000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="계약 시작일" value={form.lease_start} onChange={setField('lease_start')} type="date" />
            <Field label="계약 종료일" value={form.lease_end}   onChange={setField('lease_end')}   type="date" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>계약 유형</label>
              <select value={form.contract_type} onChange={setField('contract_type')}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}>
                <option value="OCCUPANCY">전용좌석</option>
                <option value="BIZ_ONLY">공용좌석</option>
                <option value="STORAGE">보관</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>세금 유형</label>
              <select value={form.vat_type} onChange={setField('vat_type')}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}>
                <option value="NONE">없음</option>
                <option value="VAT_INVOICE">세금계산서</option>
                <option value="CASH_RECEIPT">현금영수증</option>
              </select>
            </div>
            <Field label="납부일" value={form.payment_day} onChange={setField('payment_day')} type="number" placeholder="25" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>메모</label>
            <textarea value={form.memo} onChange={setField('memo')} rows={2} placeholder="특이사항 메모..."
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }} />
          </div>
        </div>

        {/* 퇴실 확인 영역 */}
        {confirmEvict && (
          <div className="px-6 pb-2">
            <div className="px-4 py-3 rounded-xl"
                 style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)' }}>
              <p className="font-semibold text-sm mb-1" style={{ color: 'var(--color-danger)' }}>퇴실 처리하시겠습니까?</p>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
                오늘을 퇴실일로 기록하고 계약을 종료합니다. 호실이 공실로 전환됩니다. 납부 이력은 보존됩니다.
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

        <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={() => setConfirmEvict(true)} disabled={confirmEvict}
            className="p-2.5 rounded-lg border flex items-center justify-center disabled:opacity-40"
            style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
            title="퇴실 처리">
            <LogOut size={16} />
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            취소
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── 계약 타임라인 ──────────────────────────────────────── */
function ContractTimeline({ items }: { items: LeaseItem[] }) {
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

  const sorted = [...items].sort((a, b) => a.room.name.localeCompare(b.room.name, 'ko'))

  const fmt = (d: Date) =>
    `${d.getFullYear().toString().slice(2)}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`

  return (
    <div>
      {/* 컨트롤 바 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
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
              const leaseStart = item.lease.lease_start ? new Date(item.lease.lease_start) : null
              const leaseEnd   = item.lease.lease_end   ? new Date(item.lease.lease_end)   : null

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
                <div key={item.lease.id} className="flex border-b"
                     style={{
                       borderColor: 'var(--color-border)',
                       minHeight: 50,
                       background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(29,53,87,0.018)',
                     }}>
                  {/* 라벨 */}
                  <div className="shrink-0 border-r px-4 py-2 flex flex-col justify-center"
                       style={{ width: LABEL_W, borderColor: 'var(--color-border)' }}>
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                      {item.room.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                      {item.tenant.name}
                    </p>
                  </div>

                  {/* 바 영역 */}
                  <div className="relative" style={{ width: totalW, height: 50 }}>
                    {columns.map(col => (
                      <div key={col.key} className="absolute top-0 bottom-0"
                           style={{
                             left: col.idx * colW, width: colW,
                             borderLeft: '1px solid var(--color-border)',
                             background: isCurrentCol(col.idx) ? 'rgba(168,218,220,0.07)' : 'transparent',
                           }} />
                    ))}

                    {todayPct >= 0 && todayPct <= 100 && (
                      <div className="absolute top-0 bottom-0 z-10 pointer-events-none"
                           style={{ left: `${todayPct}%`, width: 2, background: 'rgba(239,68,68,0.45)' }} />
                    )}

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
  label:        string
  value:        string
  onChange:     (e: React.ChangeEvent<HTMLInputElement>) => void
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
