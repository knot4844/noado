'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, Home, AlertCircle, CheckCircle2,
  Phone, MessageSquare, FileText, X, Loader2, Upload, FileSpreadsheet,
  Send, ChevronRight, Users, Pencil,
} from 'lucide-react'
import { formatKRW, formatPhone, formatDate } from '@/lib/utils'
import type { Room, RoomStatus, Lease, Tenant, ContractType, VatType } from '@/types'
import * as XLSX from 'xlsx'

type FilterStatus = 'ALL' | RoomStatus

type LeaseWithTenant = Lease & { tenant?: Tenant }

/* ─── 계약 유형 레이블 ─── */
const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  OCCUPANCY: '전용좌석',
  BIZ_ONLY:  '공용좌석',
  STORAGE:   '보관',
}

/* ─── 상태 배지 ─── */
function StatusBadge({ status }: { status: RoomStatus }) {
  const map: Record<RoomStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    OCCUPIED: { label: '입주중', color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: <CheckCircle2 size={11} /> },
    VACATED:  { label: '퇴실',   color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)',  icon: <AlertCircle  size={11} /> },
    VACANT:   { label: '공실',   color: 'var(--color-muted)',   bg: 'var(--color-muted-bg)',   icon: <Home         size={11} /> },
  }
  const s = map[status]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
          style={{ background: s.bg, color: s.color }}>
      {s.icon}{s.label}
    </span>
  )
}

/* ─── 엑셀 컬럼 → 필드 매핑 ─── */
const COL_MAP: Record<string, string> = {
  '호실명': 'name', '호실': 'name',
  '상태': 'status',
  '메모': 'memo', '비고': 'memo',
  '건물': 'building', '구역': 'building',
}

type ImportRow = {
  name: string
  status: string
  memo: string
  building: string
  _error?: string
}

function parseStatus(val: string): RoomStatus {
  const v = String(val ?? '').trim()
  if (/입주중|납부완료|paid|occupied/i.test(v))  return 'OCCUPIED'
  if (/퇴실|미납|unpaid|vacated/i.test(v))       return 'VACATED'
  return 'VACANT'
}

/* ─── 엑셀 가져오기 모달 ─── */
function ExcelImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const supabase   = useMemo(() => createClient(), [])
  const fileRef    = useRef<HTMLInputElement>(null)

  const [rows,      setRows]      = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result,    setResult]    = useState<string | null>(null)
  const [dragging,  setDragging]  = useState(false)

  function parseFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const wb  = XLSX.read(e.target?.result, { type: 'binary', cellDates: false })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      if (!raw.length) return

      const parsed: ImportRow[] = raw.map((row, idx) => {
        const r: Record<string, string> = {}
        for (const [col, val] of Object.entries(row)) {
          const key = COL_MAP[col.trim().replace(/\s/g, '')]
          if (key) r[key] = String(val ?? '').trim()
        }
        const name = r['name'] ?? ''
        return {
          name,
          status:   r['status']   ?? '',
          memo:     r['memo']     ?? '',
          building: r['building'] ?? '',
          _error: !name ? `${idx + 2}행: 호실명 없음` : undefined,
        }
      })
      setRows(parsed)
      setResult(null)
    }
    reader.readAsBinaryString(file)
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) parseFile(f)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]; if (f) parseFile(f)
  }

  async function handleImport() {
    const valid = rows.filter(r => !r._error && r.name)
    if (!valid.length) return
    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }

    const payload = valid.map(r => ({
      owner_id: user.id,
      name:     r.name,
      status:   parseStatus(r.status),
      building: r.building || null,
      memo:     r.memo     || null,
    }))

    const { error } = await supabase.from('rooms').insert(payload)
    setImporting(false)
    if (error) { setResult(`오류: ${error.message}`); return }
    setResult(`${payload.length}개 호실이 등록되었습니다.`)
    setTimeout(() => { onImported(); onClose() }, 1500)
  }

  const validCount = rows.filter(r => !r._error && r.name).length
  const errorCount = rows.filter(r => !!r._error).length
  const hasRows    = rows.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)', maxHeight: '90vh' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              엑셀로 호실 일괄 등록
            </h2>
            {hasRows && (
              <span className="text-xs px-2 py-0.5 rounded-full ml-1"
                    style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
                {rows.length}행 파싱됨
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* 양식 안내 */}
          {!hasRows && (
            <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>엑셀 컬럼 형식 (첫 행이 헤더)</p>
              <p>필수: <strong>호실명</strong></p>
              <p>선택: 건물/구역, 상태(납부완료/미납/공실), 메모</p>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>입주사 정보는 호실 등록 후 입주사 이력에서 별도 등록하세요.</p>
            </div>
          )}

          {/* 드롭존 */}
          {!hasRows && (
            <div
              className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-12 cursor-pointer transition-colors"
              style={{
                borderColor: dragging ? 'var(--color-primary)' : 'var(--color-border)',
                background:  dragging ? 'rgba(29,53,87,0.04)' : 'transparent',
              }}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}>
              <Upload size={28} className="mb-2" style={{ color: 'var(--color-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                엑셀 파일을 드래그하거나 클릭해서 선택
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>.xlsx, .xls 지원</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFilePick} />
            </div>
          )}

          {/* 미리보기 테이블 */}
          {hasRows && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>미리보기</span>
                  {validCount > 0 && <span style={{ color: 'var(--color-success)' }}>✓ {validCount}개 등록 가능</span>}
                  {errorCount > 0 && <span style={{ color: 'var(--color-danger)' }}>✗ {errorCount}개 오류</span>}
                </div>
                <button onClick={() => { setRows([]); setResult(null) }}
                  className="text-xs px-2.5 py-1 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  다시 선택
                </button>
              </div>

              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--color-muted-bg)' }}>
                        {['호실명', '건물/구역', '상태', '메모'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--color-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} style={{
                          borderTop: '1px solid var(--color-border)',
                          background: row._error ? 'var(--color-danger-bg)' : 'transparent',
                        }}>
                          <td className="px-3 py-2 font-medium" style={{ color: row._error ? 'var(--color-danger)' : 'var(--color-text)' }}>
                            {row.name || <span style={{ color: 'var(--color-danger)' }}>—</span>}
                          </td>
                          <td className="px-3 py-2" style={{ color: 'var(--color-muted)' }}>{row.building || '—'}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--color-muted)' }}>{parseStatus(row.status)}</td>
                          <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: 'var(--color-muted)' }}>{row.memo || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {result && (
            <div className="px-3 py-2 rounded-lg text-sm font-medium"
                 style={{ background: result.startsWith('오류') ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                          color:      result.startsWith('오류') ? 'var(--color-danger)'  : 'var(--color-success)' }}>
              {result}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex gap-2 px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>취소</button>
          <button onClick={handleImport} disabled={validCount === 0 || importing}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}>
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {validCount}개 호실 등록
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── 입주사 이력 모달 ─── */
function TenantHistoryModal({ room, onClose }: { room: Room; onClose: () => void }) {
  const supabase  = useMemo(() => createClient(), [])
  const [leases,   setLeases]   = useState<LeaseWithTenant[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    name:          '',
    phone:         '',
    email:         '',
    monthly_rent:  '',
    pledge_amount: '',
    lease_start:   today,
    lease_end:     '',
    contract_type: 'OCCUPANCY' as ContractType,
    vat_type:      'NONE' as VatType,
    payment_day:   '10',
  })

  const loadLeases = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('leases')
      .select('*, tenant:tenants(*)')
      .eq('room_id', room.id)
      .order('lease_start', { ascending: false })
    setLeases((data as LeaseWithTenant[]) || [])
    setLoading(false)
  }, [supabase, room.id])

  useEffect(() => { setTimeout(() => loadLeases(), 0) }, [loadLeases])

  const activeLease   = leases.find(l => l.status === 'ACTIVE')
  const reservedLease = leases.find(l => l.status === 'RESERVED')
  const pastLeases    = leases.filter(l => l.status === 'TERMINATED')

  async function handleEvict(lease: LeaseWithTenant) {
    if (!confirm(`${lease.tenant?.name ?? '입주사'}님을 오늘 날짜로 퇴실 처리하시겠습니까?`)) return
    await supabase.from('leases').update({ status: 'TERMINATED', lease_end: today }).eq('id', lease.id)
    await supabase.from('rooms').update({ status: 'VACATED' }).eq('id', room.id)
    loadLeases()
  }

  async function handleSaveNew() {
    if (!form.name) { setError('입주사명을 입력해주세요.'); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // 같은 이름의 입주사가 이미 존재하는지 확인
    const { data: existingTenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('owner_id', user.id)
      .ilike('name', form.name)

    let tenantId: string
    if (existingTenants && existingTenants.length > 0) {
      tenantId = existingTenants[0].id
    } else {
      const { data: newTenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({ owner_id: user.id, name: form.name, phone: form.phone || null, email: form.email || null })
        .select('id')
        .single()
      if (tenantErr || !newTenant) { setError(tenantErr?.message ?? '입주사 등록 실패'); setSaving(false); return }
      tenantId = newTenant.id
    }

    // 기존 활성 계약을 종료 처리
    if (activeLease) {
      await supabase.from('leases').update({
        status:    'TERMINATED',
        lease_end: form.lease_start || today,
      }).eq('id', activeLease.id)
    }

    // 신규 계약 INSERT
    const { error: leaseErr } = await supabase.from('leases').insert({
      owner_id:      user.id,
      room_id:       room.id,
      tenant_id:     tenantId,
      contract_type: form.contract_type,
      rate_type:     'MONTHLY',
      monthly_rent:  Number(form.monthly_rent)  || 0,
      daily_rate:    null,
      pledge_amount: Number(form.pledge_amount) || 0,
      lease_start:   form.lease_start || today,
      lease_end:     form.lease_end   || null,
      payment_day:   Number(form.payment_day) || 10,
      vat_type:      form.vat_type,
      status:        'ACTIVE',
      memo:          null,
    })
    if (leaseErr) { setError(leaseErr.message); setSaving(false); return }

    // 호실 상태 업데이트 (입주중)
    await supabase.from('rooms').update({ status: 'OCCUPIED' }).eq('id', room.id)

    setSaving(false)
    setShowForm(false)
    setForm({
      name: '', phone: '', email: '',
      monthly_rent: '', pledge_amount: '',
      lease_start: today, lease_end: '',
      contract_type: 'OCCUPANCY', vat_type: 'NONE', payment_day: '10',
    })
    loadLeases()
  }

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const inputSty = { borderColor: 'var(--color-border)', background: 'var(--color-surface)' }

  function LeaseCard({ lease, isActive }: { lease: LeaseWithTenant; isActive?: boolean }) {
    const t = lease.tenant
    return (
      <div className="rounded-xl p-4 border"
           style={{
             borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
             background:  isActive ? 'rgba(29,53,87,0.04)' : 'var(--color-muted-bg)',
           }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                {t?.name ?? '(알 수 없음)'}
              </p>
              <span className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(29,53,87,0.1)', color: 'var(--color-primary)' }}>
                {CONTRACT_TYPE_LABEL[lease.contract_type]}
              </span>
            </div>
            {t?.phone && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{formatPhone(t.phone)}</p>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: 'var(--color-muted)' }}>
              <span>
                {formatDate(lease.lease_start)}
                {lease.lease_end ? ` ~ ${formatDate(lease.lease_end)}` : ' ~ 현재'}
              </span>
              <span>{formatKRW(lease.monthly_rent)}/월</span>
              {lease.pledge_amount > 0 && <span>예치금 {formatKRW(lease.pledge_amount)}</span>}
            </div>
          </div>
          {isActive && (
            <button onClick={() => handleEvict(lease)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border shrink-0"
              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
              퇴실 처리
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)', maxHeight: '90vh' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              입주사 이력 — {room.name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              전체 {leases.length}건
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          ) : (
            <>
              {/* 현재 입주사 */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>현재 입주사</p>
                {activeLease ? (
                  <LeaseCard lease={activeLease} isActive />
                ) : (
                  <div className="rounded-xl p-4 text-center text-sm" style={{ color: 'var(--color-muted)', background: 'var(--color-muted-bg)' }}>
                    현재 입주사가 없습니다
                  </div>
                )}
              </div>

              {/* 예약중 */}
              {reservedLease && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>예약중</p>
                  <LeaseCard lease={reservedLease} />
                </div>
              )}

              {/* 신규 입주 등록 폼 또는 버튼 */}
              {showForm ? (
                <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>새 입주사 등록</p>
                  {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>입주사명 *</label>
                      <input value={form.name} onChange={setF('name')}
                        placeholder="홍길동 또는 (주)회사명" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>연락처</label>
                      <input value={form.phone} onChange={setF('phone')}
                        placeholder="01012345678" type="tel" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>이메일</label>
                    <input value={form.email} onChange={setF('email')}
                      placeholder="email@example.com" type="email" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>월 이용료 (원)</label>
                      <input value={form.monthly_rent} onChange={setF('monthly_rent')}
                        type="number" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>예치금 (원)</label>
                      <input value={form.pledge_amount} onChange={setF('pledge_amount')}
                        type="number" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>계약 시작일</label>
                      <input value={form.lease_start} onChange={setF('lease_start')}
                        type="date" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>계약 종료일</label>
                      <input value={form.lease_end} onChange={setF('lease_end')}
                        type="date" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>계약 유형</label>
                      <select value={form.contract_type} onChange={setF('contract_type')}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty}>
                        <option value="OCCUPANCY">전용좌석</option>
                        <option value="BIZ_ONLY">공용좌석</option>
                        <option value="STORAGE">보관</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>세금 유형</label>
                      <select value={form.vat_type} onChange={setF('vat_type')}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty}>
                        <option value="NONE">없음</option>
                        <option value="VAT_INVOICE">세금계산서</option>
                        <option value="CASH_RECEIPT">현금영수증</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>납부일</label>
                      <input value={form.payment_day} onChange={setF('payment_day')}
                        type="number" min="1" max="31" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => { setShowForm(false); setError('') }}
                      className="flex-1 py-2 rounded-lg text-sm border"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>취소</button>
                    <button onClick={handleSaveNew} disabled={saving}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ background: 'var(--color-primary)' }}>
                      {saving && <Loader2 size={14} className="animate-spin" />}
                      등록
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowForm(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-medium flex items-center justify-center gap-2"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'rgba(29,53,87,0.04)' }}>
                  <Plus size={15} /> 새 입주사 등록
                </button>
              )}

              {/* 이전 입주사 이력 */}
              {pastLeases.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>이전 입주사 ({pastLeases.length}건)</p>
                  <div className="space-y-2">
                    {pastLeases.map(l => (
                      <LeaseCard key={l.id} lease={l} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>닫기</button>
        </div>
      </div>
    </div>
  )
}

/* ─── 호실 추가/수정 모달 ─── */
function RoomModal({
  room, onClose, onSaved,
}: {
  room?: Room | null; onClose: () => void; onSaved: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [form, setForm] = useState({
    name:     room?.name     ?? '',
    building: room?.building ?? '',
    status:   (room?.status  ?? 'VACANT') as RoomStatus,
    memo:     room?.memo     ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  async function handleSave() {
    if (!form.name) { setError('호실명을 입력해주세요.'); return }
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인이 필요합니다.'); setLoading(false); return }

    const payload = {
      name:     form.name,
      building: form.building || null,
      status:   form.status,
      memo:     form.memo || null,
    }

    if (room) {
      const { error: err } = await supabase.from('rooms').update(payload).eq('id', room.id)
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { error: err } = await supabase.from('rooms').insert({ ...payload, owner_id: user.id })
      if (err) { setError(err.message); setLoading(false); return }
    }
    onSaved()
    setLoading(false)
  }

  const inputSty = { borderColor: 'var(--color-border)', background: 'var(--color-surface)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)', maxHeight: '90vh' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            {room ? '호실 수정' : '호실 추가'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
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

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>건물/구역</label>
            <input value={form.building} onChange={set('building')} placeholder="예: A동, 2층"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>메모</label>
            <textarea value={form.memo} onChange={set('memo')} rows={2} placeholder="특이사항 메모..."
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={inputSty} />
          </div>

          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            입주사 정보(월 이용료, 예치금, 계약 기간 등)는 호실 저장 후
            <strong style={{ color: 'var(--color-primary)' }}> 입주사 이력</strong> 버튼에서 등록하세요.
          </p>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>취소</button>
          <button type="button" onClick={handleSave} disabled={loading}
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
const _NOW_MS = Date.now()

function UnitsContent() {
  const supabase = useMemo(() => createClient(), [])
  const [rooms,    setRooms]    = useState<Room[]>([])
  const [leaseMap, setLeaseMap] = useState<Record<string, LeaseWithTenant>>({})
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterStatus>('ALL')
  const [search,   setSearch]   = useState('')
  const [modal,    setModal]    = useState<{ open: boolean; room?: Room | null }>({ open: false })
  const [importOpen,      setImportOpen]      = useState(false)
  const [toast,           setToast]           = useState<string | null>(null)
  const [tenantHistRoom,  setTenantHistRoom]  = useState<Room | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: roomsData }, { data: leasesData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('owner_id', user.id).order('name'),
      supabase.from('leases').select('*, tenant:tenants(*)').eq('owner_id', user.id).eq('status', 'ACTIVE'),
    ])

    setRooms(roomsData || [])

    const lMap: Record<string, LeaseWithTenant> = {}
    for (const l of (leasesData as LeaseWithTenant[] | null) || []) {
      lMap[l.room_id] = l
    }
    setLeaseMap(lMap)
    setLoading(false)
  }, [supabase])

  useEffect(() => { setTimeout(() => load(), 0) }, [load])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const counts = {
    ALL:      rooms.length,
    OCCUPIED: rooms.filter(r => r.status === 'OCCUPIED').length,
    VACATED:  rooms.filter(r => r.status === 'VACATED').length,
    VACANT:   rooms.filter(r => r.status === 'VACANT').length,
  }

  const filtered = rooms.filter(r => {
    const matchFilter = filter === 'ALL' || r.status === filter
    const q = search.toLowerCase()
    const tenantName = leaseMap[r.id]?.tenant?.name ?? ''
    const matchSearch = !q || r.name.toLowerCase().includes(q) || tenantName.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const dday = (dateStr: string | null | undefined) => {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr).getTime() - _NOW_MS) / 86400000)
  }

  const handleReminder = async (room: Room) => {
    const lease = leaseMap[room.id]
    const phone = lease?.tenant?.phone ?? null
    const amount = lease?.monthly_rent ?? 0
    if (!phone) return showToast('연락처가 없어 알림톡을 발송할 수 없습니다.')
    const res = await fetch('/api/alimtalk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateKey: 'UNPAID_REMINDER',
        phone,
        roomName: room.name,
        amount:   String(amount),
      }),
    })
    showToast(res.ok ? `${room.name} 독촉 알림톡을 발송했습니다.` : '발송 중 오류가 발생했습니다.')
  }

  return (
    <div className="p-3 sm:p-6 max-w-[1400px]">
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
            공간 현황
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            전체 {rooms.length}개 공간 · 입주중 {counts.OCCUPIED}개 · 공실 {counts.VACANT}개
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
            <FileSpreadsheet size={16} /> 엑셀 가져오기
          </button>
          <button onClick={() => setModal({ open: true, room: null })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--color-primary)' }}>
            <Plus size={16} /> 호실 추가
          </button>
        </div>
      </div>

      {/* 필터 + 검색 */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-muted-bg)' }}>
          {(['ALL', 'OCCUPIED', 'VACATED', 'VACANT'] as FilterStatus[]).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filter === s ? 'var(--color-surface)' : 'transparent',
                color:      filter === s ? 'var(--color-primary)' : 'var(--color-muted)',
                boxShadow:  filter === s ? 'var(--shadow-soft)' : 'none',
              }}>
              {s === 'ALL' ? '전체' : s === 'OCCUPIED' ? '입주중' : s === 'VACATED' ? '퇴실' : '공실'}{' '}
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
                {[
                  { label: '호실',   cls: '' },
                  { label: '입주사', cls: '' },
                  { label: '연락처', cls: 'hidden md:table-cell' },
                  { label: '월 이용료',   cls: 'hidden sm:table-cell' },
                  { label: '예치금', cls: 'hidden lg:table-cell' },
                  { label: '계약만료', cls: 'hidden lg:table-cell' },
                  { label: '상태',   cls: '' },
                  { label: '작업',   cls: '' },
                ].map(h => (
                  <th key={h.label} className={`px-3 py-3 text-left text-xs font-semibold ${h.cls}`}
                      style={{ color: 'var(--color-muted)', background: 'var(--color-muted-bg)' }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((room, i) => {
                const lease  = leaseMap[room.id]
                const tenant = lease?.tenant
                const dd     = dday(lease?.lease_end)
                return (
                  <tr key={room.id}
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td className="px-3 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--color-text)' }}>
                      {room.name}
                    </td>
                    <td className="px-3 py-3 max-w-[100px] truncate" style={{ color: 'var(--color-text)' }}>
                      {tenant?.name ?? <span style={{ color: 'var(--color-muted)' }}>—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs hidden md:table-cell" style={{ color: 'var(--color-muted)' }}>
                      {tenant?.phone
                        ? <a href={`tel:${tenant.phone}`} className="flex items-center gap-1 hover:underline">
                            <Phone size={11} />{formatPhone(tenant.phone)}
                          </a>
                        : '—'}
                    </td>
                    <td className="px-3 py-3 tabular hidden sm:table-cell" style={{ color: 'var(--color-text)' }}>
                      {lease ? formatKRW(lease.monthly_rent) : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                    </td>
                    <td className="px-3 py-3 tabular hidden lg:table-cell" style={{ color: 'var(--color-muted)' }}>
                      {lease ? formatKRW(lease.pledge_amount) : '—'}
                    </td>
                    <td className="px-3 py-3 text-xs hidden lg:table-cell">
                      {dd !== null ? (
                        <span style={{ color: dd <= 30 ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                          {dd <= 0 ? '만료됨' : dd <= 30 ? `D-${dd}` : formatDate(lease?.lease_end ?? null)}
                        </span>
                      ) : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={room.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setModal({ open: true, room })}
                          className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-medium border flex items-center gap-1 whitespace-nowrap"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'var(--color-muted-bg)' }}
                          title="수정">
                          <Pencil size={12} />
                          <span className="hidden sm:inline">수정</span>
                        </button>
                        {/* 독촉 알림톡은 /payments 페이지에서 미납 청구서 기준으로 발송 */}
                        <button onClick={() => setTenantHistRoom(room)}
                          className="p-1.5 rounded-lg"
                          style={{ background: 'rgba(29,53,87,0.08)', color: 'var(--color-primary)' }}
                          title="입주사 이력">
                          <Users size={12} />
                        </button>
                        <a href={`/contracts?room=${room.id}`}
                          className="p-1.5 rounded-lg hidden sm:flex"
                          style={{ background: 'rgba(168,218,220,0.15)', color: 'var(--color-accent-dark)' }}
                          title="계약서">
                          <FileText size={12} />
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

      {importOpen && (
        <ExcelImportModal
          onClose={() => setImportOpen(false)}
          onImported={() => { load(); showToast('호실이 일괄 등록되었습니다.') }}
        />
      )}
      {modal.open && (
        <RoomModal
          room={modal.room}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); showToast('저장되었습니다.') }}
        />
      )}
      {tenantHistRoom && (
        <TenantHistoryModal
          room={tenantHistRoom}
          onClose={() => { setTenantHistRoom(null); load() }}
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
