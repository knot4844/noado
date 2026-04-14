'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Loader2, X, FileText, CheckCircle2, XCircle, Edit3,
} from 'lucide-react'
import type { TaxInvoice, TaxInvoiceStatus } from '@/types'

const STATUS_CONFIG: Record<TaxInvoiceStatus, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: '작성',   color: '#6b7280', bg: '#f3f4f6' },
  ISSUED:    { label: '발행',   color: '#10b981', bg: '#ecfdf5' },
  CANCELLED: { label: '취소',   color: '#ef4444', bg: '#fef2f2' },
}

interface Props {
  leaseId: string
  ownerId: string
  /** 해당 계약의 vat_type이 VAT_INVOICE인 경우에만 표시 */
  vatType: string
}

export default function TaxInvoicesPanel({ leaseId, ownerId, vatType }: Props) {
  const [items, setItems]     = useState<TaxInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<TaxInvoice | null>(null)

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tax_invoices')
      .select('*')
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false })
    setItems((data ?? []) as TaxInvoice[])
    setLoading(false)
  }, [leaseId, supabase])

  useEffect(() => { load() }, [load])

  // VAT_INVOICE가 아니면 표시하지 않음
  if (vatType !== 'VAT_INVOICE') return null

  async function handleStatusChange(id: string, status: TaxInvoiceStatus) {
    await supabase
      .from('tax_invoices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    await load()
  }

  const issuedCount = items.filter(i => i.status === 'ISSUED').length
  const draftCount  = items.filter(i => i.status === 'DRAFT').length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
          <FileText size={14} className="text-neutral-400" />
          세금계산서
          {(issuedCount > 0 || draftCount > 0) && (
            <span className="text-xs font-normal ml-1 text-neutral-400">
              발행 {issuedCount}건{draftCount > 0 && ` · 작성 ${draftCount}건`}
            </span>
          )}
        </h4>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
        >
          <Plus size={12} /> 생성
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-neutral-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-neutral-400 py-3 text-center">세금계산서가 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const s = STATUS_CONFIG[item.status]
            return (
              <div key={item.id}
                   className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-white border-neutral-200">
                <FileText size={14} className="text-neutral-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">
                    {item.issue_date
                      ? new Date(item.issue_date).toLocaleDateString('ko-KR')
                      : '미발행'}
                    <span className="text-xs ml-1.5 px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    공급가 ₩{item.supply_amount.toLocaleString()} + 세액 ₩{item.vat_amount.toLocaleString()}
                    {item.ntax_id && <span className="ml-1">· 승인 {item.ntax_id}</span>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-neutral-700 tabular-nums shrink-0">
                  ₩{item.total_amount.toLocaleString()}
                </span>
                <div className="flex gap-0.5 shrink-0">
                  {item.status === 'DRAFT' && (
                    <button
                      onClick={() => handleStatusChange(item.id, 'ISSUED')}
                      className="p-0.5 rounded hover:bg-emerald-50 transition-colors"
                      title="발행 확인"
                    >
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    </button>
                  )}
                  {item.status === 'ISSUED' && (
                    <button
                      onClick={() => handleStatusChange(item.id, 'CANCELLED')}
                      className="p-0.5 rounded hover:bg-rose-50 transition-colors"
                      title="취소"
                    >
                      <XCircle size={14} className="text-neutral-300 hover:text-rose-500" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditItem(item)}
                    className="p-0.5 rounded hover:bg-neutral-100 transition-colors"
                    title="승인번호 편집"
                  >
                    <Edit3 size={13} className="text-neutral-300 hover:text-neutral-600" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <AddTaxInvoiceModal
          leaseId={leaseId}
          ownerId={ownerId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}

      {editItem && (
        <EditNtaxModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); load() }}
        />
      )}
    </div>
  )
}

/* ── 생성 모달 ── */
function AddTaxInvoiceModal({
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
    total_amount: '',
    issue_date: new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const total = Number(form.total_amount.replace(/,/g, ''))
    if (!total || total <= 0) { setError('금액을 입력해주세요.'); return }

    const supply = Math.round(total / 1.1)
    const vat    = total - supply

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase.from('tax_invoices').insert({
      owner_id: ownerId,
      lease_id: leaseId,
      issue_date: form.issue_date || null,
      supply_amount: supply,
      vat_amount: vat,
      total_amount: total,
      status: 'DRAFT',
    })

    setSaving(false)
    if (err) { setError(err.message) } else { onSaved() }
  }

  const total = Number((form.total_amount || '0').replace(/,/g, ''))
  const supply = total > 0 ? Math.round(total / 1.1) : 0
  const vat = total > 0 ? total - supply : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-neutral-900">세금계산서 생성</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">발행일</label>
              <input type="date" value={form.issue_date}
                     onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))}
                     className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">합계금액 (원) <span className="text-rose-500">*</span></label>
              <input value={form.total_amount}
                     onChange={e => setForm(p => ({ ...p, total_amount: e.target.value }))}
                     placeholder="0" type="text" inputMode="numeric"
                     className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>
          {total > 0 && (
            <div className="flex gap-4 px-3 py-2 bg-neutral-50 rounded-lg text-xs text-neutral-500">
              <span>공급가: ₩{supply.toLocaleString()}</span>
              <span>세액: ₩{vat.toLocaleString()}</span>
            </div>
          )}
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50">취소</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? '생성 중...' : '생성 (DRAFT)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── 승인번호 편집 모달 ── */
function EditNtaxModal({
  item,
  onClose,
  onSaved,
}: {
  item: TaxInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const [ntaxId, setNtaxId] = useState(item.ntax_id ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('tax_invoices')
      .update({ ntax_id: ntaxId.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-neutral-900 text-sm">국세청 승인번호</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <input value={ntaxId} onChange={e => setNtaxId(e.target.value)}
                 placeholder="승인번호 입력"
                 className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50">취소</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
