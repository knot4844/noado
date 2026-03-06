'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, Phone, Calendar, ChevronRight,
  User, Home, Loader2, X, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { formatKRW, formatDate, formatPhone } from '@/lib/utils'
import type { Room, Invoice } from '@/types'

/* ─── 타입 ─── */
interface TenantRoom extends Room {
  invoices?: Invoice[]
  latestInvoice?: Invoice | null
}

type FilterKey = 'all' | 'paid' | 'unpaid'

/* ─── 메인 컴포넌트 ─── */
export default function TenantsPage() {
  const supabase = createClient()

  const [rooms, setRooms]         = useState<TenantRoom[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<FilterKey>('all')
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<TenantRoom | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  /* ─── 데이터 로드 ─── */
  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const year  = new Date().getFullYear()
    const month = new Date().getMonth() + 1

    const { data: roomData } = await supabase
      .from('rooms')
      .select('*, invoices(id, status, amount, paid_amount, year, month, due_date)')
      .eq('owner_id', user.id)
      .neq('status', 'VACANT')
      .order('name')

    const enriched: TenantRoom[] = (roomData || []).map((r: TenantRoom & { invoices?: Invoice[] }) => {
      const invs: Invoice[] = r.invoices || []
      const current = invs.find((i: Invoice) => i.year === year && i.month === month)
      return { ...r, invoices: invs, latestInvoice: current ?? null }
    })
    setRooms(enriched)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  /* ─── 필터 ─── */
  const counts = {
    all:    rooms.length,
    paid:   rooms.filter(r => r.status === 'PAID').length,
    unpaid: rooms.filter(r => r.status === 'UNPAID').length,
  }

  const filtered = rooms.filter(r => {
    const matchFilter =
      filter === 'all'    ? true :
      filter === 'paid'   ? r.status === 'PAID' :
                            r.status === 'UNPAID'
    const q = search.toLowerCase()
    const matchSearch = !q ||
      r.name.toLowerCase().includes(q) ||
      r.tenant_name?.toLowerCase().includes(q) ||
      r.tenant_phone?.includes(q)
    return matchFilter && matchSearch
  })

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
            현재 입주 중인 세입자 정보 및 수납 현황
          </p>
        </div>
        <button
          onClick={() => { setSelected(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--color-primary)' }}>
          <Plus size={16} /> 입주사 추가
        </button>
      </div>

      {/* 필터 + 검색 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* 필터 탭 */}
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
                        ? t.key === 'paid' ? 'var(--color-success-bg)' : t.key === 'unpaid' ? 'var(--color-danger-bg)' : 'rgba(29,53,87,0.1)'
                        : 'transparent',
                      color: filter === t.key ? t.color : 'var(--color-muted)',
                    }}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름, 호실, 연락처 검색..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} />
        </div>
      </div>

      {/* 카드 그리드 */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed"
             style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
          <User size={32} className="mb-2 opacity-30" />
          <p className="text-sm">입주사가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <TenantCard key={r.id} room={r} onClick={() => { setSelected(r); setShowModal(true) }} />
          ))}
        </div>
      )}

      {/* 상세/편집 모달 */}
      {showModal && (
        <TenantModal
          room={selected}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); showToast('success', '저장되었습니다.') }}
          onError={(msg) => showToast('error', msg)}
        />
      )}
    </div>
  )
}

/* ─── 입주사 카드 ─── */
function TenantCard({ room, onClick }: { room: TenantRoom; onClick: () => void }) {
  const inv     = room.latestInvoice
  const isPaid  = room.status === 'PAID'
  const statusColor = isPaid ? 'var(--color-success)' : 'var(--color-danger)'
  const statusBg    = isPaid ? 'var(--color-success-bg)' : 'var(--color-danger-bg)'
  const statusLabel = isPaid ? '완납' : '미납'

  const daysLeft = room.lease_end
    ? Math.ceil((new Date(room.lease_end).getTime() - Date.now()) / 86400000)
    : null

  return (
    <button onClick={onClick}
      className="text-left rounded-2xl p-5 transition-all w-full"
      style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)', border: '1px solid var(--color-border)' }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>

      {/* 상단: 호실 + 상태 배지 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
            <Home size={12} /> {room.name}
          </div>
          <p className="font-bold text-base" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
            {room.tenant_name || '—'}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
              style={{ background: statusBg, color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      {/* 월세 / 보증금 */}
      <div className="flex gap-4 mb-3">
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>월세</p>
          <p className="text-sm font-semibold tabular" style={{ color: 'var(--color-text)' }}>
            {formatKRW(room.monthly_rent)}
          </p>
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>보증금</p>
          <p className="text-sm font-semibold tabular" style={{ color: 'var(--color-text)' }}>
            {formatKRW(room.deposit)}
          </p>
        </div>
      </div>

      {/* 구분선 */}
      <div className="mb-3" style={{ height: 1, background: 'var(--color-border)' }} />

      {/* 연락처 + 계약 만료 */}
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-muted)' }}>
        <div className="flex items-center gap-1">
          <Phone size={11} />
          {room.tenant_phone ? formatPhone(room.tenant_phone) : '연락처 없음'}
        </div>
        {daysLeft !== null && (
          <div className="flex items-center gap-1"
               style={{ color: daysLeft <= 30 ? 'var(--color-danger)' : 'var(--color-muted)' }}>
            <Calendar size={11} />
            {daysLeft <= 0 ? '만료됨' : daysLeft <= 30 ? `D-${daysLeft}` : formatDate(room.lease_end!)}
          </div>
        )}
      </div>

      {/* 이번 달 수납액 */}
      {inv && (
        <div className="mt-3 pt-3 flex items-center justify-between"
             style={{ borderTop: '1px solid var(--color-border)' }}>
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>이번달 수납</span>
          <span className="text-xs font-semibold tabular"
                style={{ color: inv.paid_amount >= inv.amount ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatKRW(inv.paid_amount)} / {formatKRW(inv.amount)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-end mt-2">
        <ChevronRight size={14} style={{ color: 'var(--color-muted)' }} />
      </div>
    </button>
  )
}

/* ─── 입주사 모달 (추가/편집) ─── */
function TenantModal({
  room, onClose, onSaved, onError,
}: {
  room: TenantRoom | null
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const supabase = createClient()
  const isEdit   = !!room

  const [form, setForm] = useState({
    name:          room?.name          ?? '',
    tenant_name:   room?.tenant_name   ?? '',
    tenant_phone:  room?.tenant_phone  ?? '',
    tenant_email:  room?.tenant_email  ?? '',
    monthly_rent:  String(room?.monthly_rent  ?? ''),
    deposit:       String(room?.deposit       ?? ''),
    lease_start:   room?.lease_start   ?? '',
    lease_end:     room?.lease_end     ?? '',
    memo:          room?.memo          ?? '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.name) return onError('호실명을 입력해주세요.')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return onError('로그인이 필요합니다.') }

    const payload = {
      name:         form.name,
      tenant_name:  form.tenant_name  || null,
      tenant_phone: form.tenant_phone || null,
      tenant_email: form.tenant_email || null,
      monthly_rent: Number(form.monthly_rent) || 0,
      deposit:      Number(form.deposit)      || 0,
      lease_start:  form.lease_start  || null,
      lease_end:    form.lease_end    || null,
      memo:         form.memo         || null,
    }

    if (isEdit) {
      const { error } = await supabase.from('rooms').update(payload).eq('id', room!.id)
      if (error) { onError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('rooms').insert({
        ...payload,
        owner_id: user.id,
        status:   form.tenant_name ? 'UNPAID' : 'VACANT',
      })
      if (error) { onError(error.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
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
            {isEdit ? '입주사 정보 수정' : '입주사 추가'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--color-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* 폼 */}
        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="호실명 *" value={form.name} onChange={set('name')} placeholder="예: 101호" />
            <Field label="세입자 이름" value={form.tenant_name} onChange={set('tenant_name')} placeholder="홍길동" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="연락처" value={form.tenant_phone} onChange={set('tenant_phone')} placeholder="01012345678" type="tel" />
            <Field label="이메일" value={form.tenant_email} onChange={set('tenant_email')} placeholder="email@example.com" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="월세 (원)" value={form.monthly_rent} onChange={set('monthly_rent')} type="number" placeholder="500000" />
            <Field label="보증금 (원)" value={form.deposit} onChange={set('deposit')} type="number" placeholder="5000000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="계약 시작일" value={form.lease_start} onChange={set('lease_start')} type="date" />
            <Field label="계약 만료일" value={form.lease_end} onChange={set('lease_end')} type="date" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>메모</label>
            <textarea value={form.memo} onChange={set('memo')} rows={3} placeholder="특이사항 메모..."
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }} />
          </div>
        </div>

        {/* 푸터 */}
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
            {isEdit ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── 공통 폼 필드 ─── */
function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
        onFocus={e => e.target.style.borderColor = 'var(--color-accent-dark)'}
        onBlur={e => e.target.style.borderColor = 'var(--color-border)'} />
    </div>
  )
}
