'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Invoice, InvoiceStatus } from '@/types/index'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Send,
  Bell,
  X,
  Download,
  AlertCircle,
} from 'lucide-react'
import * as XLSX from 'xlsx'

// ── Types ──────────────────────────────────────────────────────────────────

interface InvoiceWithRoom extends Invoice {
  rooms: {
    name: string
    tenant_name: string | null
    tenant_phone: string | null
    monthly_rent: number
  } | null
}

type FilterTab = 'all' | 'ready' | 'paid' | 'overdue'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function formatDate(s: string | null): string {
  if (!s) return '-'
  return s.slice(0, 10)
}

function statusLabel(s: InvoiceStatus): string {
  if (s === 'paid') return '완납'
  if (s === 'overdue') return '연체'
  return '미납'
}

function statusBadgeClass(s: InvoiceStatus): string {
  if (s === 'paid') return 'bg-emerald-100 text-emerald-700'
  if (s === 'overdue') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

// ── Detail Modal ───────────────────────────────────────────────────────────

function DetailModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceWithRoom
  onClose: () => void
}) {
  const roomName = invoice.rooms?.name ?? '-'
  const tenantName = invoice.rooms?.tenant_name ?? '-'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">청구서 상세</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <Row label="호실" value={roomName} />
          <Row label="입주사" value={tenantName} />
          <Row
            label="청구년월"
            value={`${invoice.year}년 ${invoice.month}월`}
          />
          <Row label="청구금액" value={formatCurrency(invoice.amount)} />
          <Row
            label="납부금액"
            value={formatCurrency(invoice.paid_amount)}
          />
          <Row
            label="상태"
            value={
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(invoice.status)}`}
              >
                {statusLabel(invoice.status)}
              </span>
            }
          />
          <Row label="납기일" value={formatDate(invoice.due_date)} />
          <Row label="납부일" value={formatDate(invoice.paid_at)} />
          {invoice.virtual_account_number && (
            <>
              <Row
                label="가상계좌"
                value={`${invoice.virtual_account_bank ?? ''} ${invoice.virtual_account_number}`}
              />
              <Row
                label="계좌 만료"
                value={formatDate(invoice.virtual_account_due)}
              />
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-2 py-2.5 rounded-xl bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex justify-between items-center border-b border-neutral-100 pb-2">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900 font-medium">{value}</span>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const supabase = useMemo(() => createClient(), [])

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [invoices, setInvoices] = useState<InvoiceWithRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithRoom | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // ── Data fetching ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setSelectedIds(new Set())

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('invoices')
      .select('*, rooms(name, tenant_name, tenant_phone, monthly_rent)')
      .eq('owner_id', user.id)
      .eq('year', year)
      .eq('month', month)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[invoices] fetch error:', error)
    }

    setInvoices((data as InvoiceWithRoom[]) ?? [])
    setLoading(false)
  }, [supabase, year, month])

  useEffect(() => {
    load()
  }, [load])

  // ── Month navigation ─────────────────────────────────────────────────────

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  // ── Filtered list ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (filter === 'all') return invoices
    if (filter === 'ready') return invoices.filter((i) => i.status === 'ready')
    if (filter === 'paid') return invoices.filter((i) => i.status === 'paid')
    if (filter === 'overdue') return invoices.filter((i) => i.status === 'overdue')
    return invoices
  }, [invoices, filter])

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalCount = invoices.length
    const totalAmount = invoices.reduce((s, i) => s + i.amount, 0)
    const paidList = invoices.filter((i) => i.status === 'paid')
    const readyList = invoices.filter((i) => i.status === 'ready')
    const overdueList = invoices.filter((i) => i.status === 'overdue')
    return {
      totalCount,
      totalAmount,
      paidCount: paidList.length,
      paidAmount: paidList.reduce((s, i) => s + i.paid_amount, 0),
      readyCount: readyList.length,
      readyAmount: readyList.reduce((s, i) => s + i.amount, 0),
      overdueCount: overdueList.length,
      overdueAmount: overdueList.reduce((s, i) => s + i.amount, 0),
    }
  }, [invoices])

  // ── Selection ────────────────────────────────────────────────────────────

  function toggleAll() {
    const paidIds = filtered
      .filter((i) => i.status === 'paid')
      .map((i) => i.id)
    if (paidIds.every((id) => selectedIds.has(id)) && paidIds.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paidIds))
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  // ── Alimtalk resend ──────────────────────────────────────────────────────

  async function resendAlimtalk(inv: InvoiceWithRoom) {
    const phone = inv.rooms?.tenant_phone
    if (!phone) {
      showToast('연락처가 없어 알림톡을 발송할 수 없습니다.', false)
      return
    }

    setSendingId(inv.id)
    try {
      const res = await fetch('/api/alimtalk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: 'INVOICE_ISSUED',
          phone,
          roomName: inv.rooms?.name ?? '',
          tenantName: inv.rooms?.tenant_name ?? '',
          amount: inv.amount.toLocaleString('ko-KR'),
          dueDate: inv.due_date ? formatDate(inv.due_date) : '납기일 미정',
          paymentLink: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/pay/${inv.id}`,
          roomId: inv.room_id,
        }),
      })
      const json = await res.json()
      showToast(
        json.ok ? '알림톡을 발송했습니다.' : '알림톡 발송에 실패했습니다.',
        !!json.ok
      )
    } catch {
      showToast('알림톡 발송 중 오류가 발생했습니다.', false)
    } finally {
      setSendingId(null)
    }
  }

  // ── Hometax Excel export ─────────────────────────────────────────────────

  function exportHometax() {
    const rows = invoices
      .filter((i) => selectedIds.has(i.id) && i.status === 'paid')
      .map((i) => {
        const rent = i.amount
        const supplyValue = Math.floor(rent / 1.1)
        const vat = rent - supplyValue
        const writeDate = `${i.year}${String(i.month).padStart(2, '0')}15`
        return {
          전자세금계산서_종류: '01',
          작성일자: writeDate,
          공급가액: supplyValue,
          세액: vat,
          비고: `${i.rooms?.name ?? ''} 임대료`,
          공급받는자_상호: i.rooms?.tenant_name ?? '',
        }
      })

    if (rows.length === 0) {
      showToast('완납 청구서를 먼저 선택해주세요.', false)
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '일괄발행내역')
    XLSX.writeFile(
      workbook,
      `홈택스_${year}년${String(month).padStart(2, '0')}월_${new Date().toISOString().slice(0, 10)}.xlsx`
    )
    showToast(`${rows.length}건 엑셀 다운로드 완료`, true)
  }

  // ── Toast ────────────────────────────────────────────────────────────────

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const paidFilteredIds = filtered
    .filter((i) => i.status === 'paid')
    .map((i) => i.id)
  const allPaidSelected =
    paidFilteredIds.length > 0 &&
    paidFilteredIds.every((id) => selectedIds.has(id))

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            청구서 관리
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            월별 청구서 현황 및 알림톡 발송, 홈택스 엑셀 다운로드
          </p>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-4 py-2 shadow-sm self-start">
          <button
            onClick={prevMonth}
            className="text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold text-neutral-900 min-w-[88px] text-center">
            {year}년 {month}월
          </span>
          <button
            onClick={nextMonth}
            className="text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="총 청구"
          count={stats.totalCount}
          amount={stats.totalAmount}
          colorClass="text-neutral-700"
          bgClass="bg-white"
        />
        <StatCard
          label="완납"
          count={stats.paidCount}
          amount={stats.paidAmount}
          colorClass="text-emerald-700"
          bgClass="bg-emerald-50"
        />
        <StatCard
          label="미납"
          count={stats.readyCount}
          amount={stats.readyAmount}
          colorClass="text-amber-700"
          bgClass="bg-amber-50"
        />
        <StatCard
          label="연체"
          count={stats.overdueCount}
          amount={stats.overdueAmount}
          colorClass="text-red-700"
          bgClass="bg-red-50"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
        {(
          [
            { key: 'all', label: '전체' },
            { key: 'ready', label: '미납' },
            { key: 'paid', label: '완납' },
            { key: 'overdue', label: '연체' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === key
                ? 'bg-white shadow-sm text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-medium">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-neutral-300"
                    checked={allPaidSelected}
                    onChange={toggleAll}
                    title="완납 항목 전체 선택"
                  />
                </th>
                <th className="p-3">호실</th>
                <th className="p-3">입주사</th>
                <th className="p-3 text-right">청구금액</th>
                <th className="p-3">납기일</th>
                <th className="p-3">상태</th>
                <th className="p-3">납부일</th>
                <th className="p-3 text-center">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="p-3">
                        <div className="h-4 bg-neutral-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-neutral-400">
                      <FileText size={36} strokeWidth={1.5} />
                      <p className="font-medium">
                        {year}년 {month}월 청구서가 없습니다.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-neutral-50 transition-colors cursor-pointer"
                    onClick={() => setDetailInvoice(inv)}
                  >
                    <td
                      className="p-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {inv.status === 'paid' ? (
                        <input
                          type="checkbox"
                          className="rounded border-neutral-300"
                          checked={selectedIds.has(inv.id)}
                          onChange={() => toggleOne(inv.id)}
                        />
                      ) : (
                        <span className="block w-4 h-4 mx-auto" />
                      )}
                    </td>
                    <td className="p-3 font-medium text-neutral-900">
                      {inv.rooms?.name ?? '-'}
                    </td>
                    <td className="p-3 text-neutral-700">
                      {inv.rooms?.tenant_name ?? '-'}
                    </td>
                    <td className="p-3 text-right text-neutral-900 font-medium tabular-nums">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td className="p-3 text-neutral-500 tabular-nums">
                      {formatDate(inv.due_date)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(inv.status)}`}
                      >
                        {statusLabel(inv.status)}
                      </span>
                    </td>
                    <td className="p-3 text-neutral-500 tabular-nums">
                      {formatDate(inv.paid_at)}
                    </td>
                    <td
                      className="p-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {(inv.status === 'ready' || inv.status === 'overdue') && (
                          <button
                            onClick={() => resendAlimtalk(inv)}
                            disabled={sendingId === inv.id}
                            title="알림톡 재발송"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            {sendingId === inv.id ? (
                              <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Bell size={12} />
                            )}
                            알림톡
                          </button>
                        )}
                        {inv.status === 'paid' && (
                          <button
                            onClick={() => {
                              setSelectedIds(new Set([inv.id]))
                              setTimeout(() => exportHometax(), 0)
                            }}
                            title="홈택스 다운로드"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <Download size={12} />
                            홈택스
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-neutral-900 text-white rounded-2xl shadow-2xl px-5 py-3">
          <span className="text-sm font-medium text-neutral-300">
            {selectedIds.size}건 선택됨
          </span>
          <div className="w-px h-4 bg-neutral-600" />
          <button
            onClick={exportHometax}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white text-neutral-900 font-semibold text-sm hover:bg-neutral-100 transition-colors"
          >
            <Send size={15} />
            홈택스 엑셀 다운로드
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-neutral-400 hover:text-white transition-colors ml-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Detail modal */}
      {detailInvoice && (
        <DetailModal
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all animate-in slide-in-from-bottom-4 duration-300 ${
            toast.ok
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          <AlertCircle size={16} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── StatCard ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  count,
  amount,
  colorClass,
  bgClass,
}: {
  label: string
  count: number
  amount: number
  colorClass: string
  bgClass: string
}) {
  return (
    <div className={`${bgClass} rounded-xl border border-neutral-200 p-4 space-y-1`}>
      <p className="text-xs text-neutral-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${colorClass}`}>
        {count}건
      </p>
      <p className={`text-sm tabular-nums ${colorClass} opacity-80`}>
        {formatCurrency(amount)}
      </p>
    </div>
  )
}
