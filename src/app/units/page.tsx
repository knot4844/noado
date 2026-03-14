'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, Home, AlertCircle, CheckCircle2,
  Phone, MessageSquare, FileText, X, Loader2,
} from 'lucide-react'
import { formatKRW, formatPhone, formatDate } from '@/lib/utils'
import type { Room, RoomStatus } from '@/types'

type FilterStatus = 'ALL' | RoomStatus

/* ─── 상태 배지 ─── */
function StatusBadge({ status }: { status: RoomStatus }) {
  const map: Record<RoomStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    PAID:   { label: '납부완료', color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: <CheckCircle2 size={11} /> },
    UNPAID: { label: '미납',    color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)',  icon: <AlertCircle  size={11} /> },
    VACANT: { label: '공실',    color: 'var(--color-muted)',   bg: 'var(--color-muted-bg)',   icon: <Home         size={11} /> },
  }
  const s = map[status]
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: s.bg, color: s.color }}>
      {s.icon}{s.label}
    </span>
  )
}

/* ─── 호실 추가/수정 모달 ─── */
function RoomModal({
  room, onClose, onSaved,
}: {
  room?: Room | null; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    name:         room?.name         ?? '',
    status:       (room?.status      ?? 'VACANT') as RoomStatus,
    tenant_name:  room?.tenant_name  ?? '',
    tenant_phone: room?.tenant_phone ?? '',
    tenant_email: room?.tenant_email ?? '',
    monthly_rent: String(room?.monthly_rent ?? ''),
    payment_day:  String(room?.payment_day  ?? '10'),
    deposit:      String(room?.deposit      ?? ''),
    lease_start:  room?.lease_start  ?? '',
    lease_end:    room?.lease_end    ?? '',
    memo:         room?.memo         ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) return setError('호실명을 입력해주세요.')
    setLoading(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인이 필요합니다.'); setLoading(false); return }

    const payload = {
      name:         form.name,
      status:       form.status,
      tenant_name:  form.tenant_name  || null,
      tenant_phone: form.tenant_phone || null,
      tenant_email: form.tenant_email || null,
      monthly_rent: Number(form.monthly_rent) || 0,
      payment_day:  Number(form.payment_day)  || 10,
      deposit:      Number(form.deposit)      || 0,
      lease_start:  form.lease_start  || null,
      lease_end:    form.lease_end    || null,
      memo:         form.memo         || null,
    }

    const { error: err } = room
      ? await supabase.from('rooms').update(payload).eq('id', room.id)
      : await supabase.from('rooms').insert({ ...payload, owner_id: user.id })

    if (err) { setError(err.message) }
    else { onSaved() }
    setLoading(false)
  }

  const inputSty = { borderColor: 'var(--color-border)', background: 'var(--color-surface)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            {room ? '호실 수정' : '호실 추가'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>호실명 *</label>
              <input value={form.name} onChange={set('name')} placeholder="예: 101호" required
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>상태</label>
              <select value={form.status} onChange={set('status')}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty}>
                <option value="VACANT">공실</option>
                <option value="UNPAID">미납</option>
                <option value="PAID">납부완료</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>입주사 이름</label>
              <input value={form.tenant_name} onChange={set('tenant_name')} placeholder="홍길동"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>연락처</label>
              <input value={form.tenant_phone} onChange={set('tenant_phone')} placeholder="01012345678" type="tel"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>이메일</label>
            <input value={form.tenant_email} onChange={set('tenant_email')} placeholder="email@example.com" type="email"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>월세 (원)</label>
              <input value={form.monthly_rent} onChange={set('monthly_rent')} type="number" placeholder="500000"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>보증금 (원)</label>
              <input value={form.deposit} onChange={set('deposit')} type="number" placeholder="5000000"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>정기 납부일 (일)</label>
              <input value={form.payment_day} onChange={set('payment_day')} type="number" placeholder="10" min="1" max="31"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>계약 시작일</label>
              <input value={form.lease_start} onChange={set('lease_start')} type="date"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>계약 만료일</label>
              <input value={form.lease_end} onChange={set('lease_end')} type="date"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>메모</label>
            <textarea value={form.memo} onChange={set('memo')} rows={2} placeholder="특이사항 메모..."
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={inputSty} />
          </div>
        </form>

        <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>취소</button>
          <button onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)} disabled={loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {room ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── 메인 페이지 ─── */
function UnitsContent() {
  const supabase = createClient()
  const [rooms, setRooms]         = useState<Room[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<FilterStatus>('ALL')
  const [search, setSearch]       = useState('')
  const [modal, setModal]         = useState<{ open: boolean; room?: Room | null }>({ open: false })
  const [toast, setToast]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('rooms').select('*').eq('owner_id', user.id).order('name')
    setRooms(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const counts = {
    ALL:    rooms.length,
    PAID:   rooms.filter(r => r.status === 'PAID').length,
    UNPAID: rooms.filter(r => r.status === 'UNPAID').length,
    VACANT: rooms.filter(r => r.status === 'VACANT').length,
  }

  const filtered = rooms.filter(r => {
    const matchFilter = filter === 'ALL' || r.status === filter
    const q = search.toLowerCase()
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.tenant_name?.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  /* ─── D-day 계산 ─── */
  const dday = (dateStr: string | null) => {
    if (!dateStr) return null
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
    return diff
  }

  const handleReminder = async (room: Room) => {
    if (!room.tenant_phone) return showToast('연락처가 없어 알림톡을 발송할 수 없습니다.')
    const res = await fetch('/api/alimtalk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateKey: 'UNPAID_REMINDER',
        phone:       room.tenant_phone,
        roomName:    room.name,
        amount:      String(room.monthly_rent),
      }),
    })
    showToast(res.ok ? `${room.name} 독촉 알림톡을 발송했습니다.` : '발송 중 오류가 발생했습니다.')
  }

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
             style={{ background: 'var(--color-primary)' }}>
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            호실 현황
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            전체 {rooms.length}개 호실 · 공실 {counts.VACANT}개 · 미납 {counts.UNPAID}개
          </p>
        </div>
        <button onClick={() => setModal({ open: true, room: null })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--color-primary)' }}>
          <Plus size={16} /> 호실 추가
        </button>
      </div>

      {/* 필터 + 검색 */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-muted-bg)' }}>
          {(['ALL', 'PAID', 'UNPAID', 'VACANT'] as FilterStatus[]).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filter === s ? 'var(--color-surface)' : 'transparent',
                color:      filter === s ? 'var(--color-primary)' : 'var(--color-muted)',
                boxShadow:  filter === s ? 'var(--shadow-soft)' : 'none',
              }}>
              {s === 'ALL' ? '전체' : s === 'PAID' ? '납부완료' : s === 'UNPAID' ? '미납' : '공실'}{' '}
              {counts[s]}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="호실명, 입주사 검색..."
            className="pl-9 pr-3 py-1.5 rounded-lg border text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', minWidth: 200 }} />
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-sm" style={{ color: 'var(--color-muted)' }}>
            <Home size={28} className="mb-2 opacity-30" />
            {rooms.length === 0 ? '호실을 추가해주세요.' : '검색 결과가 없습니다.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['호실', '입주사', '연락처', '월세', '보증금', '계약만료', '상태', '작업'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                      style={{ color: 'var(--color-muted)', background: 'var(--color-muted-bg)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((room, i) => {
                const dd = dday(room.lease_end)
                return (
                  <tr key={room.id}
                      style={{ borderBottom: i < filtered.length-1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                      {room.name}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>
                      {room.tenant_name ?? <span style={{ color: 'var(--color-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                      {room.tenant_phone
                        ? <a href={`tel:${room.tenant_phone}`} className="flex items-center gap-1 hover:underline">
                            <Phone size={11} />{formatPhone(room.tenant_phone)}
                          </a>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 tabular" style={{ color: 'var(--color-text)' }}>
                      {formatKRW(room.monthly_rent)}
                    </td>
                    <td className="px-4 py-3 tabular" style={{ color: 'var(--color-muted)' }}>
                      {formatKRW(room.deposit)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {dd !== null ? (
                        <span style={{ color: dd <= 30 ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                          {dd <= 0 ? '만료됨' : dd <= 30 ? `D-${dd}` : formatDate(room.lease_end!)}
                        </span>
                      ) : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={room.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setModal({ open: true, room })}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'var(--color-muted-bg)' }}>
                          수정
                        </button>
                        {room.status === 'UNPAID' && (
                          <button onClick={() => handleReminder(room)}
                            className="p-1.5 rounded-lg"
                            style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
                            title="독촉 알림톡">
                            <MessageSquare size={13} />
                          </button>
                        )}
                        <a href={`/contracts?room=${room.id}`}
                          className="p-1.5 rounded-lg"
                          style={{ background: 'rgba(168,218,220,0.15)', color: 'var(--color-accent-dark)' }}
                          title="계약서">
                          <FileText size={13} />
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <RoomModal
          room={modal.room}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); showToast('저장되었습니다.') }}
        />
      )}
    </div>
  )
}

export default function UnitsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    }>
      <UnitsContent />
    </Suspense>
  )
}
