'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusiness } from '@/components/providers/BusinessProvider'
import {
  Calendar, CheckCircle2, AlertCircle, Play,
  X, Loader2, ChevronRight, Building2, Wrench,
  Send, Phone, AlertTriangle, MessageSquare,
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
    tenant_contact: string | null
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
    try { await onApply(n); onClose() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : '오류가 발생했습니다.') }
    finally { setLoading(false) }
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
              <p className="text-sm text-blue-700 font-medium">📋 {invoiceCount}개 청구서에 각각 ₩{amount} 추가</p>
              <p className="text-xs text-blue-500 mt-1">총 추가 금액: ₩{(Number(amount.replace(/,/g, '')) * invoiceCount).toLocaleString('ko-KR')}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors">
              취소
            </button>
            <button type="submit" disabled={loading || !amount}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
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
  onClose, onApply, rooms,
}: {
  onClose: () => void
  onApply: (entries: { roomId: string; amount: number }[]) => Promise<void>
  rooms: InvoiceRow[]
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

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
    try { await onApply(entries); onClose() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : '오류가 발생했습니다.') }
    finally { setLoading(false) }
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
                  <p className="text-sm font-semibold text-neutral-800 truncate">{inv.rooms?.name ?? inv.room_id}</p>
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
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors">
              취소
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? '적용 중...' : '실비 적용'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── 모달: 발송 스케줄러 ── */
type SendState = 'confirm' | 'sending' | 'result'
type SendMethod = 'kakao' | 'sms'
interface SendResult { roomName: string; tenantName: string; ok: boolean; reason?: string }

function SendModal({
  onClose,
  invoices,
  year,
  month,
}: {
  onClose: () => void
  invoices: InvoiceRow[]
  year: number
  month: number
}) {
  const sendable   = invoices.filter(i => i.status !== 'paid' && i.rooms?.tenant_contact)
  const noContact  = invoices.filter(i => i.status !== 'paid' && !i.rooms?.tenant_contact)

  const [stage, setStage]     = useState<SendState>('confirm')
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<SendResult[]>([])
  const [sendMethod, setSendMethod] = useState<SendMethod>('kakao')

  async function startSend() {
    setStage('sending')
    setProgress(0)
    const res: SendResult[] = []

    for (let i = 0; i < sendable.length; i++) {
      const inv    = sendable[i]
      const room   = inv.rooms!
      const phone  = room.tenant_contact!
      const amount = `₩${inv.amount.toLocaleString('ko-KR')}`
      const due    = inv.due_date
        ? new Date(inv.due_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
        : `${month}월 10일`
      const paymentLink = `${window.location.origin}/pay/${inv.id}`

      try {
        let r: Response

        if (sendMethod === 'kakao') {
          r = await fetch('/api/alimtalk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateKey: 'INVOICE_ISSUED',
              phone,
              roomName:    room.name,
              tenantName:  room.tenant_name ?? '',
              amount,
              dueDate:     due,
              paymentLink,
              roomId:      room.id,
            }),
          })
        } else {
          const text = `[대우오피스] ${year}년 ${month}월 이용료 안내\n\n${room.name}호 ${room.tenant_name ?? ''}님\n금액: ${amount}\n납부기한: ${due}\n\n결제하기: ${paymentLink}`
          r = await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, text, roomId: room.id, tenantName: room.tenant_name ?? '' }),
          })
        }

        const data = await r.json()
        res.push({
          roomName:   room.name,
          tenantName: room.tenant_name ?? '—',
          ok:     r.ok,
          reason: r.ok ? undefined : (data.error ?? '발송 실패'),
        })
      } catch {
        res.push({ roomName: room.name, tenantName: room.tenant_name ?? '—', ok: false, reason: '네트워크 오류' })
      }

      setProgress(Math.round(((i + 1) / sendable.length) * 100))
    }

    setResults(res)
    setStage('result')
  }

  const successCount = results.filter(r => r.ok).length
  const failCount    = results.filter(r => !r.ok).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Send size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">청구서 발송</h3>
              <p className="text-xs text-neutral-500 mt-0.5">{year}년 {month}월 청구서</p>
            </div>
          </div>
          {stage !== 'sending' && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
              <X size={18} className="text-neutral-400" />
            </button>
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">

          {/* ─── 확인 단계 ─── */}
          {stage === 'confirm' && (
            <div className="p-6 space-y-4">
              {/* 발송 방법 선택 */}
              <div className="flex gap-2 p-1 rounded-xl bg-neutral-100">
                <button
                  onClick={() => setSendMethod('kakao')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    sendMethod === 'kakao'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}>
                  <MessageSquare size={14} className="text-yellow-500" />
                  카카오톡
                </button>
                <button
                  onClick={() => setSendMethod('sms')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    sendMethod === 'sms'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}>
                  <Send size={14} className="text-green-500" />
                  문자(SMS)
                </button>
              </div>

              <div className="bg-emerald-50 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">발송 대상 {sendable.length}명</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {sendMethod === 'kakao'
                      ? '카카오톡 알림톡으로 이번 달 청구서를 안내합니다.'
                      : '문자(SMS)로 이번 달 청구서와 결제 링크를 안내합니다.'}
                  </p>
                </div>
              </div>

              {noContact.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">연락처 없음 {noContact.length}건 (발송 제외)</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {noContact.map(i => i.rooms?.name ?? '—').join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* 발송 목록 */}
              {sendable.length > 0 && (
                <div className="border border-neutral-100 rounded-xl overflow-hidden">
                  <div className="bg-neutral-50 px-4 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    발송 목록
                  </div>
                  <div className="divide-y divide-neutral-50">
                    {sendable.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-800 truncate">{inv.rooms?.name}</p>
                          <p className="text-xs text-neutral-400 truncate">{inv.rooms?.tenant_name ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-neutral-500 font-medium">₩{inv.amount.toLocaleString('ko-KR')}</span>
                          <div className="flex items-center gap-1 text-xs text-neutral-400">
                            <Phone size={11} />
                            {inv.rooms?.tenant_contact}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sendable.length === 0 && (
                <p className="text-center text-neutral-400 text-sm py-4">
                  연락처가 등록된 미납 입주사가 없습니다.
                </p>
              )}
            </div>
          )}

          {/* ─── 발송 중 ─── */}
          {stage === 'sending' && (
            <div className="p-8 flex flex-col items-center justify-center gap-6">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#10b981" strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                    className="transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-extrabold text-emerald-600">{progress}%</span>
                </div>
              </div>
              <div className="text-center">
                <p className="font-bold text-neutral-800">{sendMethod === 'kakao' ? '카카오톡' : '문자'} 발송 중...</p>
                <p className="text-sm text-neutral-500 mt-1">{sendable.length}명에게 순차 발송 중입니다.</p>
              </div>
            </div>
          )}

          {/* ─── 결과 ─── */}
          {stage === 'result' && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-extrabold text-emerald-600">{successCount}</div>
                  <div className="text-xs text-emerald-700 mt-1 font-medium">발송 성공</div>
                </div>
                <div className="bg-rose-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-extrabold text-rose-500">{failCount}</div>
                  <div className="text-xs text-rose-600 mt-1 font-medium">발송 실패</div>
                </div>
              </div>
              <div className="border border-neutral-100 rounded-xl overflow-hidden">
                <div className="divide-y divide-neutral-50">
                  {results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{r.roomName}</p>
                        <p className="text-xs text-neutral-400 truncate">{r.tenantName}</p>
                      </div>
                      {r.ok
                        ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-rose-500">{r.reason}</span>
                            <AlertCircle size={14} className="text-rose-400" />
                          </div>
                        )
                      }
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="p-6 border-t shrink-0">
          {stage === 'confirm' && (
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors">
                취소
              </button>
              <button onClick={startSend} disabled={sendable.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                <Send size={14} />
                {sendable.length}명에게 발송
              </button>
            </div>
          )}
          {stage === 'result' && (
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition-colors">
              완료
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── 메인 페이지 ── */
export default function BillingAutomationPage() {
  const { selectedBusinessId } = useBusiness()
  const [activeLeaseCount, setActiveLeaseCount] = useState(0)

  const [invoices, setInvoices]   = useState<InvoiceRow[]>([])
  const [invYear, setInvYear]     = useState(new Date().getFullYear())
  const [invMonth, setInvMonth]   = useState(new Date().getMonth() + 1)
  const [invLoading, setInvLoading] = useState(true)
  const [showCommonModal, setShowCommonModal] = useState(false)
  const [showUtilModal, setShowUtilModal]     = useState(false)
  const [showSendModal, setShowSendModal]     = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const loadInvoices = useCallback(async () => {
    setInvLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const qs = selectedBusinessId && selectedBusinessId !== 'ALL'
        ? `?businessId=${selectedBusinessId}` : ''
      const res  = await fetch(`/api/billing${qs}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setInvoices(data.invoices ?? [])
        setInvYear(data.year ?? new Date().getFullYear())
        setInvMonth(data.month ?? new Date().getMonth() + 1)
      }
    } catch { /* 조용히 */ }
    finally { setInvLoading(false) }
  }, [selectedBusinessId])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  // ── 활성 계약 수 (실제 데이터) ────────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setActiveLeaseCount(0); return }
      // 활성 계약(ACTIVE) 수 — leases는 business_id가 없어 rooms 경유 조회
      let roomQ = supabase
        .from('rooms')
        .select('id')
        .eq('owner_id', user.id)
      if (selectedBusinessId && selectedBusinessId !== 'ALL') {
        roomQ = roomQ.eq('business_id', selectedBusinessId)
      }
      const { data: roomRows } = await roomQ
      const roomIds = (roomRows ?? []).map(r => r.id)
      if (roomIds.length === 0) { setActiveLeaseCount(0); return }
      const { count } = await supabase
        .from('leases')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('status', 'ACTIVE')
        .in('room_id', roomIds)
      setActiveLeaseCount(count ?? 0)
    })()
  }, [selectedBusinessId])

  const unpaidInvoices  = invoices.filter(i => i.status !== 'paid')
  const sendableCount   = unpaidInvoices.filter(i => i.rooms?.tenant_contact).length

  async function applyCommonFee(amount: number) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('로그인이 필요합니다.')
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'common_fee', businessId: selectedBusinessId, amount }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '적용 실패')
    showToast('success', `${data.updated}건 청구서에 ₩${amount.toLocaleString('ko-KR')} 추가 완료`)
    await loadInvoices()
  }

  async function applyUtilities(entries: { roomId: string; amount: number }[]) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('로그인이 필요합니다.')
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'utilities', businessId: selectedBusinessId, entries }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '적용 실패')
    showToast('success', `${data.updated}개 호실 실비 적용 완료`)
    await loadInvoices()
  }

  const step3Enabled = !invLoading && unpaidInvoices.length > 0

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
          매월 정해진 일자에 이용료와 관리비 청구서를 자동으로 생성하고 <br /> 입주사에게 안내문을 발송합니다.
        </p>
      </header>

      {/* 이번 달 청구서 현황 */}
      {!invLoading && invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-2">
          {[
            { label: '이번 달 청구서', value: `${invoices.length}건`,                              color: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: '완납',          value: `${invoices.filter(i => i.status === 'paid').length}건`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '미납/대기',     value: `${unpaidInvoices.length}건`,                           color: 'text-rose-600',    bg: 'bg-rose-50' },
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
          <p className="text-sm text-neutral-500 mb-6">등록된 입주사의 계약정보(보증금, 월 이용료, 약정일)를 바탕으로 이번 달 청구 기준 데이터를 생성합니다.</p>
          <div className="bg-neutral-50 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" />
            <span className="text-sm font-bold">{activeLeaseCount}개 활성 계약 스캔 완료</span>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-500 ring-4 ring-blue-50 relative">
          <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold border-4 border-white shadow-sm">2</div>
          <h3 className="text-lg font-bold mb-2">추가 관리비 입력</h3>
          <p className="text-sm text-neutral-500 mb-6">수도세, 전기세 등 호실별로 변동되는 관리비가 있다면 이번 달 청구서에 추가 기입합니다.</p>
          <div className="space-y-2">
            <button onClick={() => setShowCommonModal(true)}
              className="w-full text-left bg-neutral-100 hover:bg-blue-50 hover:text-blue-700 transition-colors p-3 rounded-lg text-sm text-neutral-700 font-medium flex items-center justify-between group">
              <span>+ 공용 관리비 일괄 적용</span>
              <ChevronRight size={15} className="text-neutral-400 group-hover:text-blue-500 transition-colors" />
            </button>
            <button onClick={() => setShowUtilModal(true)}
              className="w-full text-left bg-neutral-100 hover:bg-amber-50 hover:text-amber-700 transition-colors p-3 rounded-lg text-sm text-neutral-700 font-medium flex justify-between items-center group">
              <span>호실별 실비 입력</span>
              <span className="bg-rose-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                {invLoading ? '…' : `${unpaidInvoices.length}건`}
              </span>
            </button>
          </div>
        </div>

        {/* Step 3 */}
        <div className={`bg-white p-6 rounded-2xl shadow-sm border relative transition-all ${
          step3Enabled ? 'border-emerald-400 ring-4 ring-emerald-50' : 'border-neutral-200'
        }`}>
          <div className={`absolute -top-3 -left-3 w-8 h-8 text-white rounded-full flex items-center justify-center font-bold border-4 border-white shadow-sm ${
            step3Enabled ? 'bg-emerald-500' : 'bg-neutral-300'
          }`}>3</div>
          <h3 className={`text-lg font-bold mb-2 ${step3Enabled ? 'text-neutral-900' : 'text-neutral-400'}`}>
            청구서 자동 발송
          </h3>
          <p className={`text-sm mb-6 ${step3Enabled ? 'text-neutral-500' : 'text-neutral-400'}`}>
            검토가 끝난 청구서를 카카오톡 또는 문자로 입주사들에게 일괄 전송합니다.
          </p>
          {step3Enabled ? (
            <button onClick={() => setShowSendModal(true)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
              <Play size={18} />
              발송 스케줄러 시작
              {sendableCount > 0 && (
                <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {sendableCount}명
                </span>
              )}
            </button>
          ) : (
            <button disabled
              className="w-full bg-neutral-100 text-neutral-400 py-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-not-allowed">
              <Play size={18} />
              {invLoading ? '청구서 로드 중...' : '미납 청구서 없음'}
            </button>
          )}
        </div>
      </div>

      {/* 이번 달 청구서 목록 */}
      {!invLoading && invoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-neutral-800">이번 달 청구서 목록</h3>
            <span className="text-xs text-neutral-400">{invYear}년 {invMonth}월</span>
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
                    inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {inv.status === 'paid' ? '완납' : '미납'}
                  </span>
                </div>
              </div>
            ))}
            {invoices.length > 8 && (
              <div className="px-6 py-3 text-center text-xs text-neutral-400">외 {invoices.length - 8}건 더 있습니다</div>
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
            혹시라도 수동으로 청구를 잊으시더라도, 납기일 기준 3일 전까지 청구서가 발행되지 않은 호실이 있다면 시스템이 대표님께 알림을 보냅니다.
          </p>
        </div>
      </div>

      {/* 모달 */}
      {showCommonModal && (
        <CommonFeeModal onClose={() => setShowCommonModal(false)} onApply={applyCommonFee} invoiceCount={unpaidInvoices.length} />
      )}
      {showUtilModal && (
        <UtilityModal onClose={() => setShowUtilModal(false)} onApply={applyUtilities} rooms={unpaidInvoices} />
      )}
      {showSendModal && (
        <SendModal onClose={() => { setShowSendModal(false); loadInvoices() }} invoices={invoices} year={invYear} month={invMonth} />
      )}
    </div>
  )
}
