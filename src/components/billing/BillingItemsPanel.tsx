'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Trash2, Loader2, X, Car, Wifi, Zap, Settings2,
  ToggleLeft, ToggleRight,
} from 'lucide-react'
import type { BillingItem, BillingItemType, BillingCycleType } from '@/types'

/* ── 타입 라벨 ── */
const TYPE_CONFIG: Record<BillingItemType, { label: string; icon: typeof Car }> = {
  PARKING:     { label: '주차비',   icon: Car },
  INTERNET:    { label: '인터넷',   icon: Wifi },
  ELECTRICITY: { label: '전기 실비', icon: Zap },
  CUSTOM:      { label: '기타',     icon: Settings2 },
}
const CYCLE_LABELS: Record<BillingCycleType, string> = {
  MONTHLY: '월정액',
  ACTUAL:  '실비',
}

interface Props {
  leaseId: string
  ownerId: string
  /** 변경 시 콜백 (합계 갱신 등) */
  onChange?: () => void
}

export default function BillingItemsPanel({ leaseId, ownerId, onChange }: Props) {
  const [items, setItems]     = useState<BillingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const supabase = createClient()

  /* ── 로드 ── */
  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('billing_items')
      .select('*')
      .eq('lease_id', leaseId)
      .order('created_at')
    setItems((data ?? []) as BillingItem[])
    setLoading(false)
  }, [leaseId, supabase])

  useEffect(() => { load() }, [load])

  /* ── 삭제 ── */
  async function handleDelete(id: string) {
    if (!confirm('이 실비 항목을 삭제하시겠습니까?')) return
    await supabase.from('billing_items').delete().eq('id', id)
    await load()
    onChange?.()
  }

  /* ── 활성/비활성 토글 ── */
  async function handleToggle(item: BillingItem) {
    await supabase
      .from('billing_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
    await load()
    onChange?.()
  }

  /* ── 합계 ── */
  const activeTotal = items
    .filter(i => i.is_active)
    .reduce((s, i) => s + (i.amount ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
          <Settings2 size={14} className="text-neutral-400" />
          추가 실비 항목
          {activeTotal > 0 && (
            <span className="text-xs font-normal text-blue-600 ml-1">
              월 +₩{activeTotal.toLocaleString()}
            </span>
          )}
        </h4>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
        >
          <Plus size={12} /> 추가
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-neutral-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-400 py-3 text-center">등록된 실비 항목이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const cfg = TYPE_CONFIG[item.item_type]
            const Icon = cfg.icon
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
                  item.is_active
                    ? 'bg-white border-neutral-200'
                    : 'bg-neutral-50 border-neutral-100 opacity-60'
                }`}
              >
                <Icon size={14} className="text-neutral-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">
                    {item.name}
                    <span className="text-xs text-neutral-400 ml-1.5">
                      {CYCLE_LABELS[item.billing_cycle]}
                    </span>
                  </p>
                  {item.memo && <p className="text-xs text-neutral-400 truncate">{item.memo}</p>}
                </div>
                <span className="text-sm font-semibold text-neutral-700 tabular-nums shrink-0">
                  ₩{(item.amount ?? 0).toLocaleString()}
                </span>
                <button
                  onClick={() => handleToggle(item)}
                  className="shrink-0 p-0.5 rounded hover:bg-neutral-100 transition-colors"
                  title={item.is_active ? '비활성화' : '활성화'}
                >
                  {item.is_active
                    ? <ToggleRight size={18} className="text-blue-500" />
                    : <ToggleLeft size={18} className="text-neutral-300" />
                  }
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="shrink-0 p-0.5 rounded hover:bg-rose-50 transition-colors"
                  title="삭제"
                >
                  <Trash2 size={13} className="text-neutral-300 hover:text-rose-500" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 추가 모달 ── */}
      {showAdd && (
        <AddBillingItemModal
          leaseId={leaseId}
          ownerId={ownerId}
          onClose={() => { setShowAdd(false); setError(null) }}
          onSaved={() => { setShowAdd(false); load(); onChange?.() }}
          saving={saving}
          setSaving={setSaving}
          error={error}
          setError={setError}
        />
      )}
    </div>
  )
}

/* ── 추가 모달 ── */
function AddBillingItemModal({
  leaseId,
  ownerId,
  onClose,
  onSaved,
  saving,
  setSaving,
  error,
  setError,
}: {
  leaseId: string
  ownerId: string
  onClose: () => void
  onSaved: () => void
  saving: boolean
  setSaving: (v: boolean) => void
  error: string | null
  setError: (v: string | null) => void
}) {
  const [form, setForm] = useState({
    item_type: 'CUSTOM' as BillingItemType,
    name: '',
    billing_cycle: 'MONTHLY' as BillingCycleType,
    amount: '',
    memo: '',
  })

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  // 타입 선택 시 이름 자동 설정
  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const type = e.target.value as BillingItemType
    const autoName = type !== 'CUSTOM' ? TYPE_CONFIG[type].label : ''
    setForm(prev => ({
      ...prev,
      item_type: type,
      name: prev.name || autoName,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('항목명을 입력해주세요.'); return }
    const amt = Number(form.amount.replace(/,/g, ''))
    if (isNaN(amt) || amt < 0) { setError('올바른 금액을 입력해주세요.'); return }

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase.from('billing_items').insert({
      owner_id: ownerId,
      lease_id: leaseId,
      item_type: form.item_type,
      name: form.name.trim(),
      billing_cycle: form.billing_cycle,
      amount: amt,
      unit_price: form.billing_cycle === 'ACTUAL' ? amt : null,
      is_active: true,
      memo: form.memo.trim() || null,
    })

    setSaving(false)

    if (err) {
      setError(err.message)
    } else {
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-neutral-900">실비 항목 추가</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 타입 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">항목 유형</label>
              <select
                value={form.item_type}
                onChange={handleTypeChange}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">청구 방식</label>
              <select
                value={form.billing_cycle}
                onChange={set('billing_cycle')}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="MONTHLY">월정액 (매월 고정)</option>
                <option value="ACTUAL">실비 (매월 변동)</option>
              </select>
            </div>
          </div>

          {/* 항목명 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">
              항목명 <span className="text-rose-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={set('name')}
              placeholder="예: 주차비, 인터넷, 전기 실비"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* 금액 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">
              {form.billing_cycle === 'MONTHLY' ? '월 고정 금액' : '기본 단가'} (원)
            </label>
            <input
              value={form.amount}
              onChange={set('amount')}
              placeholder="0"
              type="text"
              inputMode="numeric"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">메모 (선택)</label>
            <input
              value={form.memo}
              onChange={set('memo')}
              placeholder="관리 메모"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? '저장 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
