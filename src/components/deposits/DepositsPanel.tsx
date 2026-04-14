'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Undo2, Loader2, X, Shield, Wallet, Landmark,
} from 'lucide-react'
import type { Deposit, DepositType } from '@/types'

const TYPE_CONFIG: Record<DepositType, { label: string; icon: typeof Shield; color: string }> = {
  PLEDGE:  { label: '예치금', icon: Shield,   color: '#6366f1' },
  PREPAY:  { label: '선납금', icon: Wallet,   color: '#10b981' },
  RESERVE: { label: '예약금', icon: Landmark, color: '#f59e0b' },
}

interface Props {
  leaseId: string
  ownerId: string
  onChange?: () => void
}

export default function DepositsPanel({ leaseId, ownerId, onChange }: Props) {
  const [items, setItems]     = useState<Deposit[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('deposits')
      .select('*')
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false })
    setItems((data ?? []) as Deposit[])
    setLoading(false)
  }, [leaseId, supabase])

  useEffect(() => { load() }, [load])

  /* ── 환불 처리 ── */
  async function handleRefund(id: string) {
    if (!confirm('환불 처리하시겠습니까? (되돌릴 수 없습니다)')) return
    await supabase
      .from('deposits')
      .update({ refunded_at: new Date().toISOString() })
      .eq('id', id)
    await load()
    onChange?.()
  }

  /* ── 합계 ── */
  const pledgeTotal = items
    .filter(d => d.type === 'PLEDGE' && !d.refunded_at)
    .reduce((s, d) => s + d.amount, 0)
  const prepayTotal = items
    .filter(d => d.type === 'PREPAY' && !d.refunded_at)
    .reduce((s, d) => s + d.amount, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
          <Shield size={14} className="text-neutral-400" />
          예치금·선납금
          {(pledgeTotal > 0 || prepayTotal > 0) && (
            <span className="text-xs font-normal ml-1">
              {pledgeTotal > 0 && <span className="text-indigo-600">예치 ₩{pledgeTotal.toLocaleString()}</span>}
              {pledgeTotal > 0 && prepayTotal > 0 && ' · '}
              {prepayTotal > 0 && <span className="text-emerald-600">선납 ₩{prepayTotal.toLocaleString()}</span>}
            </span>
          )}
        </h4>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
        >
          <Plus size={12} /> 등록
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-neutral-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-400 py-3 text-center">등록된 예치금/선납금이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const cfg = TYPE_CONFIG[item.type]
            const Icon = cfg.icon
            const isRefunded = !!item.refunded_at
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
                  isRefunded
                    ? 'bg-neutral-50 border-neutral-100 opacity-50'
                    : 'bg-white border-neutral-200'
                }`}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                     style={{ background: cfg.color + '18' }}>
                  <Icon size={12} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">
                    {cfg.label}
                    {isRefunded && <span className="text-xs text-rose-500 ml-1.5">환불됨</span>}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {item.received_at
                      ? new Date(item.received_at).toLocaleDateString('ko-KR')
                      : new Date(item.created_at).toLocaleDateString('ko-KR')}
                    {item.note && ` · ${item.note}`}
                    {isRefunded && item.refunded_at && (
                      <span className="ml-1">→ {new Date(item.refunded_at).toLocaleDateString('ko-KR')} 환불</span>
                    )}
                  </p>
                </div>
                <span className={`text-sm font-semibold tabular-nums shrink-0 ${
                  item.amount >= 0 ? 'text-neutral-700' : 'text-rose-600'
                }`}>
                  {item.amount >= 0 ? '+' : ''}₩{Math.abs(item.amount).toLocaleString()}
                </span>
                {!isRefunded && item.type !== 'PREPAY' && (
                  <button
                    onClick={() => handleRefund(item.id)}
                    className="shrink-0 p-0.5 rounded hover:bg-rose-50 transition-colors"
                    title="환불 처리"
                  >
                    <Undo2 size={13} className="text-neutral-300 hover:text-rose-500" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <AddDepositModal
          leaseId={leaseId}
          ownerId={ownerId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); onChange?.() }}
        />
      )}
    </div>
  )
}

/* ── 추가 모달 ── */
function AddDepositModal({
  leaseId,
  ownerId,
  onClose,
  onSaved,
}: {
  leaseId: string
  ownerId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    type: 'PLEDGE' as DepositType,
    amount: '',
    received_at: new Date().toISOString().split('T')[0],
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = Number(form.amount.replace(/,/g, ''))
    if (!amt || amt <= 0) { setError('금액을 입력해주세요.'); return }

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase.from('deposits').insert({
      owner_id: ownerId,
      lease_id: leaseId,
      type: form.type,
      amount: amt,
      received_at: form.received_at || null,
      note: form.note.trim() || null,
    })

    setSaving(false)
    if (err) { setError(err.message) } else { onSaved() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-neutral-900">예치금/선납금 등록</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">유형</label>
              <select
                value={form.type}
                onChange={set('type')}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="PLEDGE">예치금 (보증금)</option>
                <option value="PREPAY">선납금</option>
                <option value="RESERVE">예약금</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">수령일</label>
              <input
                type="date"
                value={form.received_at}
                onChange={set('received_at')}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">
              금액 (원) <span className="text-rose-500">*</span>
            </label>
            <input
              value={form.amount}
              onChange={set('amount')}
              placeholder="0"
              type="text"
              inputMode="numeric"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">메모 (선택)</label>
            <input
              value={form.note}
              onChange={set('note')}
              placeholder="비고"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors">
              취소
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? '저장 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
