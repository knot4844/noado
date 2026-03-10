'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusiness } from '@/components/providers/BusinessProvider'
import {
  Calendar, CheckCircle2, AlertCircle, Play,
  X, Loader2, ChevronRight, Building2, Wrench,
} from 'lucide-react'

/* ── 타입 ── */
interface InvoiceRow {
  id: string
  room_id: string
  year: number
  month: number
  amount: number
  paid_amount: number
  status: string
  due_date: string | null
  rooms: {
    id: string
    name: string
    status: string
    tenant_name: string | null
    monthly_rent: number | null
    business_id: string
  } | null
}

/* ── 모달: 공용 관리비 일괄 적용 ── */
function CommonFeeModal({
  onClose,
  onApply,
  invoiceCount,
}: {
  onClose: () => void
  onApply: (amount: number) => Promise<void>
  invoiceCount: number
}) {
  const [amount, setAmount]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(amount.replace(/,/g, ''))
    if (!n || n <= 0) { setError('올바른 금액을 입력하세요.'); return }
    setLoading(true)
    try {
      await onApply(n)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">공용 관리비 일괄 적용</h3>
              <p className="text-xs text-neutral-500 mt-0.5">전체 {invoiceCount}건 청구서에 동일 금액 추가</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              호실당 추가 관리비 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">₩</span>
              <input
                type="text"
                value={amount}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '')
                  setAmount(raw ? Number(raw).toLocaleString('ko-KR') : '')
                  setError('')
                }}
                placeholder="50,000"
                className="w-full pl-8 pr-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {error && <p className="text-rose-500 text-xs mt-1.5">{error}</p>}
          </div>

          {invoiceCount > 0 && amount && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm text-blue-700 font-medium">
                📋 {invoiceCount}개 청구서에 각각 ₩{amount} 추가
              </p>
              <p className="text-xs text-blue-500 mt-1">
                총 추가 금액: ₩{(Number(amount.replace(/,/g, '')) * invoiceCount).toLocaleString('ko-KR')}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !amount}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? '적용 중...' : '일괄 적용'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── 모달: 실비 입력 ── */
function UtilityModal({
  onClose,
  onApply,
  rooms,
}: {
  onClose: () => void
  onApply: (entries: { roomId: string; amount: number }[]) => Promise<void>
  rooms: InvoiceRow[]
}) {
  const [amounts, setAmounts]   = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  function setAmt(roomId: string, val: string) {
    const raw = val.replace(/[^0-9]/g, '')
    setAmounts(prev => ({ ...prev, [roomId]: raw ? Number(raw).toLocaleString('ko-KR') : '' }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const entries = rooms
      .map(inv => ({ roomId: inv.room_id, amount: Number((amounts[inv.room_id] ?? '').replace(/,/g, '')) }))
      .filter(e => e.amount > 0)
    if (entries.length === 0) { setError('최소 한 개 호실의 실비를 입력해주세요.'); return }
    setLoading(true)
    try {
      await onApply(entries)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
              <Wrench size={18} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">호실별 실비 입력</h3>
              <p className="text-xs text-neutral-500 mt-0.5">수도세, 전기세 등 변동비를 청구서에 추가합니다.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {rooms.length === 0 ? (
              <p className="text-center text-neutral-400 text-sm py-8">이번 달 청구서가 없습니다.</p>
            ) : rooms.map(inv => (
              <div key={inv.room_id} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-800 truncate">
                    {inv.rooms?.name ?? inv.room_id}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5 truncate">
                    {inv.rooms?.tenant_name ?? '입주사 없음'} · 기본 ₩{(inv.rooms?.monthly_rent ?? 0).toLocaleString('ko-KR')}
                  </p>
                </div>
                <div className="relative w-36 shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">₩</span>
                  <input
                    type="text"
                    value={amounts[inv.room_id] ?? ''}
                    onChange={e => setAmt(inv.room_id, e.target.value)}
                    placeholder="0"
                    className="w-full pl-6 pr-3 py-2 border border-neutral-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
              </div>
            ))}
            {error && <p className="text-rose-500 text-xs">{error}</p>}
          </div>

          <div className="p-6 border-t shrink-0 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? '적용 중...' : '실비 적용'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── 메인 페이지 ── */
export default function BillingAutomationPage() {
  const { getRoomsByBusiness, selectedBusinessId } = useBusiness()
  const rooms = getRoomsByBusiness(selectedBusinessId)

  const [invoices, setInvoices]         = useState<InvoiceRow[]>([])
  const [invLoading, setInvLoading]     = useState(true)
  const [showCommonModal, setShowCommonModal] = useState(false)
  const [showUtilModal, setShowUtilModal]     = useState(false)
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  /* ── 이번 달 청구서 로드 ── */
  const loadInvoices = useCallback(async () => {
    setInvLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const qs = selectedBusinessId && selectedBusinessId !== 'ALL'
        ? `?businessId=${selectedBusinessId}`
        : ''
      const res  = await fetch(`/api/billing${qs}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (res.ok) setInvoices(data.invoices ?? [])
    } catch {
      // 로드 실패 시 조용히 처리
    } finally {
      setInvLoading(false)
    }
  }, [selectedBusinessId])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  /* ── 청구서 통계 ── */
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid')
  const pendingCount   = rooms.filter(r => r.status !== 'VACANT').length

  /* ── 공용 관리비 적용 ── */
  async function applyCommonFee(amount: number) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('로그인이 필요합니다.')

    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'common_fee',
        businessId: selectedBusinessId,
        amount,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '적용 실패')
    showToast('success', `${data.updated}건 청구서에 ₩${amount.toLocaleString('ko-KR')} 추가 완료`)
    await loadInvoices()
  }

  /* ── 실비 적용 ── */
  async function applyUtilities(entries: { roomId: string; amount: number }[]) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('로그인이 필요합니다.')

    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'utilities',
        businessId: selectedBusinessId,
        entries,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '적용 실패')
    showToast('success', `${data.updated}개 호실 실비 적용 완료`)
    await loadInvoices()
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold animate-in slide-in-from-top duration-300 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <header className="mb-8 border-b border-neutral-200 pb-6 text-center max-w-2xl mx-auto mt-10">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 transform">
          <Calendar size={32} />
        </div>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight mb-3">정기 청구 스케줄링</h1>
        <p className="text-neutral-500 text-lg">
          매월 정해진 일자에 임대료와 관리비 청구서를 자동으로 생성하고 <br /> 입주사에게 안내문을 발송합니다.
        </p>
      </header>

      {/* 이번 달 청구서 현황 요약 */}
      {!invLoading && invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-2">
          {[
            { label: '이번 달 청구서', value: `${invoices.length}건`, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '완납', value: `${invoices.filter(i => i.status === 'paid').length}건`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '미납/대기', value: `${unpaidInvoices.length}건`, color: 'text-rose-600', bg: 'bg-rose-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-neutral-500 mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 3단계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Step 1 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 relative">
          <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold border-4 border-white shadow-sm">1</div>
          <h3 className="text-lg font-bold mb-2">계약 정보 연동</h3>
          <p className="text-sm text-neutral-500 mb-6">등록된 입주사의 계약정보(보증금, 월세, 약정일)를 바탕으로 이번 달 청구 기준 데이터를 생성합니다.</p>
          <div className="bg-neutral-50 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" />
            <span className="text-sm font-bold">{rooms.length}개 호실 데이터 스캔 완료</span>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-500 ring-4 ring-blue-50 relative">
          <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold border-4 border-white shadow-sm">2</div>
          <h3 className="text-lg font-bold mb-2">추가 관리비 입력</h3>
          <p className="text-sm text-neutral-500 mb-6">수도세, 전기세 등 호실별로 변동되는 관리비가 있다면 이번 달 청구서에 추가 기입합니다.</p>
          <div className="space-y-2">
            <button
              onClick={() => setShowCommonModal(true)}
              className="w-full text-left bg-neutral-100 hover:bg-blue-50 hover:text-blue-700 transition-colors p-3 rounded-lg text-sm text-neutral-700 font-medium flex items-center justify-between group"
            >
              <span>+ 공용 관리비 일괄 적용</span>
              <ChevronRight size={15} className="text-neutral-400 group-hover:text-blue-500 transition-colors" />
            </button>
            <button
              onClick={() => setShowUtilModal(true)}
              className="w-full text-left bg-neutral-100 hover:bg-amber-50 hover:text-amber-700 transition-colors p-3 rounded-lg text-sm text-neutral-700 font-medium flex justify-between items-center group"
            >
              <span>호실별 실비 입력</span>
              <span className="bg-rose-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                {invLoading ? '…' : `${unpaidInvoices.length}건`}
              </span>
            </button>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 relative">
          <div className="absolute -top-3 -left-3 w-8 h-8 bg-neutral-300 text-white rounded-full flex items-center justify-center font-bold border-4 border-white shadow-sm">3</div>
          <h3 className="text-lg font-bold mb-2 text-neutral-400">청구서 자동 발송</h3>
          <p className="text-sm text-neutral-400 mb-6">검토가 끝난 청구서를 카카오톡 알림톡이나 문자로 입주사들에게 일괄 전송합니다.</p>
          <button disabled className="w-full bg-neutral-100 text-neutral-400 py-4 rounded-xl font-bold flex items-center justify-center gap-2">
            <Play size={18} />
            발송 스케줄러 시작
          </button>
        </div>
      </div>

      {/* 이번 달 청구서 목록 (간략) */}
      {!invLoading && invoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-neutral-800">이번 달 청구서 목록</h3>
            <span className="text-xs text-neutral-400">{new Date().getFullYear()}년 {new Date().getMonth() + 1}월</span>
          </div>
          <div className="divide-y divide-neutral-50">
            {invoices.slice(0, 8).map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-sm font-semibold text-neutral-700 truncate">{inv.rooms?.name ?? '—'}</div>
                  <div className="text-xs text-neutral-400 truncate">{inv.rooms?.tenant_name ?? '—'}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-neutral-800">₩{inv.amount.toLocaleString('ko-KR')}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    inv.status === 'paid'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    {inv.status === 'paid' ? '완납' : '미납'}
                  </span>
                </div>
              </div>
            ))}
            {invoices.length > 8 && (
              <div className="px-6 py-3 text-center text-xs text-neutral-400">
                외 {invoices.length - 8}건 더 있습니다
              </div>
            )}
          </div>
        </div>
      )}

      {/* 안내 배너 */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex gap-4">
        <AlertCircle className="text-indigo-600 shrink-0" />
        <div>
          <h4 className="font-bold text-indigo-900 mb-1">스마트 미청구 관리 시스템이 활성화되었습니다.</h4>
          <p className="text-sm text-indigo-700 leading-relaxed">
            혹시라도 수동으로 청구를 잊으시더라도, 납기일 기준 3일 전까지 청구서가 발행되지 않은 호실이 있다면 시스템이 대표님께 알림을 보냅니다. 누락되는 임대료 없이 꼼꼼하게 관리하세요!
          </p>
        </div>
      </div>

      {/* 모달 */}
      {showCommonModal && (
        <CommonFeeModal
          onClose={() => setShowCommonModal(false)}
          onApply={applyCommonFee}
          invoiceCount={unpaidInvoices.length}
        />
      )}
      {showUtilModal && (
        <UtilityModal
          onClose={() => setShowUtilModal(false)}
          onApply={applyUtilities}
          rooms={unpaidInvoices}
        />
      )}
    </div>
  )
}
