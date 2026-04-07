'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, FileText, Send, CheckCircle2, AlertCircle,
  Loader2, X, Clock, RefreshCw, Download, Eye,
  Pencil, Trash2, Upload,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Contract, Room } from '@/types'

/* ─── 타입 ─── */
interface ContractRoom {
  name: string
  tenant_name?: string
  tenant_phone?: string
  tenant_email?: string
  monthly_rent?: number
  deposit?: number
  lease_start?: string
  lease_end?: string
}
interface ContractWithRoom extends Contract {
  room?: ContractRoom
}

const STATUS_META: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  draft:  { label: '초안',    bg: 'rgba(29,53,87,0.06)',     color: 'var(--color-muted)',    icon: <Pencil size={11} /> },
  sent:   { label: '발송됨', bg: 'rgba(168,218,220,0.2)',   color: 'var(--color-accent-dark)', icon: <Send size={11} /> },
  signed: { label: '서명완료',bg: 'var(--color-success-bg)', color: 'var(--color-success)',   icon: <CheckCircle2 size={11} /> },
  expired:{ label: '만료됨', bg: 'var(--color-danger-bg)',  color: 'var(--color-danger)',    icon: <Clock size={11} /> },
}

/* ─── 메인 ─── */
export default function ContractsPage() {
  const supabase = createClient()

  const [contracts, setContracts] = useState<ContractWithRoom[]>([])
  const [rooms, setRooms]         = useState<Room[]>([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [viewContract, setViewContract] = useState<ContractWithRoom | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'signed' | 'expired'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: ctData }, { data: rmData }, { data: leaseData }] = await Promise.all([
      supabase
        .from('contracts')
        .select('*, rooms(name)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('rooms').select('id, name, status, owner_id, building, area').eq('owner_id', user.id),
      supabase
        .from('leases')
        .select('room_id, tenant_id, monthly_rent, pledge_amount, lease_start, lease_end, status, tenants(name, phone, email)')
        .eq('owner_id', user.id)
        .eq('status', 'ACTIVE'),
    ])

    // leases → room별 입주사 정보 매핑
    const leaseByRoom: Record<string, { tenant_name: string; tenant_phone: string; tenant_email: string; monthly_rent: number; deposit: number; lease_start: string; lease_end: string }> = {}
    for (const l of (leaseData || []) as Array<Record<string, unknown>>) {
      const t = l.tenants as Record<string, string> | null
      leaseByRoom[l.room_id as string] = {
        tenant_name: t?.name || '',
        tenant_phone: t?.phone || '',
        tenant_email: t?.email || '',
        monthly_rent: (l.monthly_rent as number) || 0,
        deposit: (l.pledge_amount as number) || 0,
        lease_start: (l.lease_start as string) || '',
        lease_end: (l.lease_end as string) || '',
      }
    }

    // contracts에 room + lease 정보 병합
    setContracts((ctData || []).map((c: ContractWithRoom & { rooms?: { name: string } }) => {
      const roomName = c.rooms?.name || ''
      const leaseInfo = c.room_id ? leaseByRoom[c.room_id] : undefined
      return {
        ...c,
        room: {
          name: roomName,
          ...(leaseInfo || {}),
        },
      }
    }))

    // rooms에 lease 정보 병합 (호실 선택 드롭다운용)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRooms((rmData || []).map((r: any) => ({
      ...r,
      ...(leaseByRoom[r.id] || {}),
    })))
    setLoading(false)
  }, [supabase])

  useEffect(() => { setTimeout(() => load(), 0) }, [load])

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3500)
  }

  const filtered = filter === 'all' ? contracts : contracts.filter(c => c.status === filter)

  const stats = {
    all:    contracts.length,
    draft:  contracts.filter(c => c.status === 'draft').length,
    sent:   contracts.filter(c => c.status === 'sent').length,
    signed: contracts.filter(c => c.status === 'signed').length,
    expired:contracts.filter(c => c.status === 'expired').length,
  }

  /* ─── 발송 링크 복사 ─── */
  const copySignLink = (c: ContractWithRoom) => {
    if (!c.sign_token) return
    const url = `${window.location.origin}/invite/${c.sign_token}`
    navigator.clipboard.writeText(url)
    showToast('success', '서명 링크가 복사되었습니다.')
  }

  /* ─── 계약 삭제 ─── */
  const deleteContract = async (id: string) => {
    if (!confirm('계약서를 삭제하시겠습니까?')) return
    const { error, data } = await supabase.from('contracts').delete().eq('id', id).select()
    if (error) return showToast('error', error.message)
    if (!data || data.length === 0) return showToast('error', '삭제 권한이 없거나 이미 삭제된 계약서입니다.')
    showToast('success', '삭제되었습니다.')
    load()
  }

  /* ─── 계약 발송 + 알림톡 ─── */
  const sendContract = async (id: string) => {
    const c = contracts.find(c => c.id === id)
    const hasPhone = !!(c?.tenant_phone)
    const msg = hasPhone
      ? `계약서를 발송하고 ${c?.tenant_name ?? '세입자'}에게 서명 링크 알림톡을 전송하시겠습니까?`
      : '계약서를 발송하시겠습니까? (연락처 없음 — 알림톡 미발송)'
    if (!confirm(msg)) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return showToast('error', '로그인이 필요합니다.')

    const res  = await fetch('/api/contracts/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ contractId: id }),
    })
    const data = await res.json()
    if (!res.ok) return showToast('error', data.error ?? '발송 실패')

    showToast('success', data.message)
    load()
  }

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
            전자계약
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            임대차 계약서 작성 및 전자서명 관리
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--color-primary)' }}>
          <Plus size={16} /> 계약서 작성
        </button>
      </div>

      {/* 상태 통계 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { key: 'draft',  label: '초안',    val: stats.draft   },
          { key: 'sent',   label: '발송됨',  val: stats.sent    },
          { key: 'signed', label: '서명완료',val: stats.signed  },
          { key: 'expired',label: '만료됨',  val: stats.expired },
        ].map(s => {
          const meta = STATUS_META[s.key]
          return (
            <button key={s.key} onClick={() => setFilter(s.key as typeof filter)}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                background: filter === s.key ? meta.bg : 'var(--color-surface)',
                boxShadow: 'var(--shadow-soft)',
                border: `1px solid ${filter === s.key ? meta.color : 'var(--color-border)'}`,
              }}>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: meta.color }}>
                {meta.icon}
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: meta.color, fontFamily: 'var(--font-display)' }}>
                {s.val}
              </p>
            </button>
          )
        })}
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 p-1 rounded-xl mb-4 w-fit" style={{ background: 'var(--color-muted-bg)' }}>
        {(['all', 'draft', 'sent', 'signed', 'expired'] as const).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: filter === k ? 'var(--color-surface)' : 'transparent',
              color:      filter === k ? 'var(--color-primary)' : 'var(--color-muted)',
              boxShadow:  filter === k ? 'var(--shadow-soft)' : 'none',
            }}>
            {k === 'all' ? `전체 ${stats.all}` : `${STATUS_META[k].label} ${stats[k]}`}
          </button>
        ))}
      </div>

      {/* 계약서 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 rounded-2xl border border-dashed"
             style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
          <FileText size={28} className="mb-2 opacity-30" />
          <p className="text-sm">계약서가 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['호실', '입주사', '계약기간', '상태', '생성일', '서명일', '작업'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                      style={{ color: 'var(--color-muted)', background: 'var(--color-muted-bg)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const meta = STATUS_META[c.status] ?? STATUS_META.draft
                return (
                  <tr key={c.id} style={{ borderBottom: i < filtered.length-1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                      {c.room?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>
                      {c.room?.tenant_name ?? c.tenant_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                      {c.lease_start && c.lease_end
                        ? `${formatDate(c.lease_start)} ~ ${formatDate(c.lease_end)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit"
                            style={{ background: meta.bg, color: meta.color }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                      {c.signed_at ? formatDate(c.signed_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setViewContract(c)}
                          className="p-1.5 rounded-lg text-xs"
                          style={{ color: 'var(--color-muted)', background: 'var(--color-muted-bg)' }}
                          title="미리보기">
                          <Eye size={13} />
                        </button>
                        {c.status === 'draft' && (
                          <button onClick={() => sendContract(c.id)}
                            className="p-1.5 rounded-lg text-xs"
                            style={{ color: 'var(--color-accent-dark)', background: 'rgba(168,218,220,0.15)' }}
                            title="발송">
                            <Send size={13} />
                          </button>
                        )}
                        {c.sign_token && c.status === 'sent' && (
                          <button onClick={() => copySignLink(c)}
                            className="p-1.5 rounded-lg text-xs"
                            style={{ color: 'var(--color-primary)', background: 'rgba(29,53,87,0.08)' }}
                            title="링크 복사">
                            <RefreshCw size={13} />
                          </button>
                        )}
                        <button onClick={() => deleteContract(c.id)}
                          className="p-1.5 rounded-lg text-xs"
                          style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}
                          title="삭제">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 계약서 작성 모달 */}
      {showCreate && (
        <CreateContractModal
          rooms={rooms}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); showToast('success', '계약서가 작성되었습니다.') }}
          onError={msg => showToast('error', msg)}
        />
      )}

      {/* 계약서 미리보기 */}
      {viewContract && (
        <ContractPreviewModal
          contract={viewContract}
          onClose={() => setViewContract(null)}
        />
      )}
    </div>
  )
}

/* ─── 계약서 작성 모달 ─── */
function CreateContractModal({
  rooms, onClose, onCreated, onError,
}: {
  rooms: Room[]
  onClose: () => void
  onCreated: () => void
  onError: (msg: string) => void
}) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    room_id:      '',
    tenant_name:  '',
    tenant_phone: '',
    tenant_email: '',
    address:      '',
    monthly_rent: '',
    deposit:      '',
    lease_start:  '',
    lease_end:    '',
    special_terms:'',
  })
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [convertingPdf, setConvertingPdf] = useState(false)
  const [originalPdfName, setOriginalPdfName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(f.type)) {
      onError('PDF 또는 이미지(JPG/PNG/WEBP) 파일만 업로드 가능합니다.')
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      onError('파일 크기는 50MB 이하여야 합니다.')
      return
    }

    // PDF인 경우 자동으로 PNG 이미지로 변환 (인쇄/미리보기 모두 가능하게)
    if (f.type === 'application/pdf') {
      setConvertingPdf(true)
      setOriginalPdfName(f.name)
      try {
        const { convertPdfToPngBlob } = await import('@/lib/pdf-to-image')
        const { blob } = await convertPdfToPngBlob(f)
        const baseName = f.name.replace(/\.pdf$/i, '')
        const pngFile  = new File([blob], `${baseName}.png`, { type: 'image/png' })
        setTemplateFile(pngFile)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'PDF 변환 실패'
        onError(`PDF → 이미지 변환 실패: ${msg}`)
        setOriginalPdfName(null)
      } finally {
        setConvertingPdf(false)
      }
      return
    }

    setOriginalPdfName(null)
    setTemplateFile(f)
  }

  // 호실 선택시 자동 채우기 (leases → tenants 경유)
  const handleRoomSelect = (roomId: string) => {
    const r = rooms.find(r => r.id === roomId) as Room & Record<string, unknown> | undefined
    if (!r) return
    setForm(prev => ({
      ...prev,
      room_id:      roomId,
      tenant_name:  (r.tenant_name as string)  ?? '',
      tenant_phone: (r.tenant_phone as string) ?? '',
      tenant_email: (r.tenant_email as string) ?? '',
      monthly_rent: String(r.monthly_rent ?? ''),
      deposit:      String(r.deposit ?? ''),
      lease_start:  (r.lease_start as string) ?? '',
      lease_end:    (r.lease_end as string)   ?? '',
    }))
  }

  const handleCreate = async () => {
    if (!form.room_id)     return onError('호실을 선택해주세요.')
    if (!form.tenant_name) return onError('입주사 이름을 입력해주세요.')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return onError('로그인이 필요합니다.') }

    // 양식 파일 업로드
    let template_url: string | null = null
    let template_name: string | null = null
    let template_mime: string | null = null
    if (templateFile) {
      const ext  = templateFile.name.split('.').pop() || 'bin'
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('contract-templates')
        .upload(path, templateFile, {
          contentType: templateFile.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (upErr) { setSaving(false); return onError(`양식 업로드 실패: ${upErr.message}`) }
      const { data: pub } = supabase.storage.from('contract-templates').getPublicUrl(path)
      template_url  = pub.publicUrl
      template_name = templateFile.name
      template_mime = templateFile.type
    }

    // 계약 스냅샷 + 해시
    const snapshot = {
      ...form,
      template_url:  template_url  ?? '',
      template_name: template_name ?? '',
      created_at: new Date().toISOString(),
      owner_id:   user.id,
    }
    const hashStr  = JSON.stringify(snapshot)
    const hashBuf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashStr))
    const hashHex  = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('')

    // sign_token (UUID-like)
    const sign_token = crypto.randomUUID()
    const expires_at = new Date(Date.now() + 7 * 86400_000).toISOString()

    const { error } = await supabase.from('contracts').insert({
      owner_id:              user.id,
      room_id:               form.room_id,
      tenant_name:           form.tenant_name,
      tenant_phone:          form.tenant_phone  || null,
      tenant_email:          form.tenant_email  || null,
      address:               form.address       || null,
      monthly_rent:          Number(form.monthly_rent) || 0,
      deposit:               Number(form.deposit)      || 0,
      lease_start:           form.lease_start   || null,
      lease_end:             form.lease_end     || null,
      special_terms:         form.special_terms || null,
      status:                'draft',
      sign_token,
      sign_token_expires_at: expires_at,
      content_hash:          hashHex,
      contract_snapshot:     snapshot,
      template_url,
      template_name,
      template_mime,
    })
    if (error) { onError(error.message); setSaving(false); return }
    setSaving(false)
    onCreated()
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.4)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            계약서 작성
          </h2>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 호실 선택 */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>호실 선택 *</label>
            <select value={form.room_id} onChange={e => handleRoomSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}>
              <option value="">호실을 선택하세요</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name} {(r as Room & Record<string, unknown>).tenant_name ? `(${(r as Room & Record<string, unknown>).tenant_name})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CField label="입주사 이름 *" value={form.tenant_name} onChange={set('tenant_name')} />
            <CField label="연락처" value={form.tenant_phone} onChange={set('tenant_phone')} type="tel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="이메일" value={form.tenant_email} onChange={set('tenant_email')} type="email" />
            <CField label="소재지/호실주소" value={form.address} onChange={set('address')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="월세 (원)" value={form.monthly_rent} onChange={set('monthly_rent')} type="number" />
            <CField label="보증금 (원)" value={form.deposit} onChange={set('deposit')} type="number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="계약 시작일" value={form.lease_start} onChange={set('lease_start')} type="date" />
            <CField label="계약 만료일" value={form.lease_end} onChange={set('lease_end')} type="date" />
          </div>
          {/* 계약서 양식 업로드 */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              계약서 양식 업로드 (PDF / 이미지, 최대 50MB)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={onPickFile}
              className="hidden"
            />
            {convertingPdf ? (
              <div className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed text-sm"
                   style={{ borderColor: 'var(--color-accent-dark)', background: 'rgba(168,218,220,0.12)', color: 'var(--color-accent-dark)' }}>
                <Loader2 size={14} className="animate-spin" />
                PDF를 이미지로 변환 중...
              </div>
            ) : !templateFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'var(--color-background)' }}>
                <Upload size={14} />
                양식 파일 선택
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm"
                   style={{ borderColor: 'var(--color-accent-dark)', background: 'rgba(168,218,220,0.12)' }}>
                <FileText size={14} style={{ color: 'var(--color-accent-dark)' }} />
                <span className="flex-1 truncate" style={{ color: 'var(--color-text)' }}>
                  {originalPdfName ?? templateFile.name}
                  {originalPdfName && (
                    <span className="ml-1 text-[10px]" style={{ color: 'var(--color-muted)' }}>
                      (PDF → 이미지 변환 완료)
                    </span>
                  )}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  {(templateFile.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTemplateFile(null)
                    setOriginalPdfName(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  style={{ color: 'var(--color-muted)' }}>
                  <X size={14} />
                </button>
              </div>
            )}
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>
              업로드한 양식이 임차인 서명 페이지에 그대로 노출됩니다. PDF는 자동으로 이미지로 변환되어 인쇄까지 지원됩니다.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>특약사항</label>
            <textarea value={form.special_terms} onChange={set('special_terms')} rows={4}
              placeholder="계약 특약사항을 입력하세요..."
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }} />
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>취소</button>
          <button onClick={handleCreate} disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            계약서 생성
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── 계약서 미리보기 모달 ─── */
function ContractPreviewModal({ contract, onClose }: { contract: ContractWithRoom; onClose: () => void }) {
  const snap = contract.contract_snapshot as Record<string, string> | null
  const r    = contract.room

  const rows = [
    { label: '입주사',    value: contract.tenant_name ?? '—' },
    { label: '소재지',    value: snap?.address ?? '—' },
    { label: '보증금',    value: snap?.deposit ? `${Number(snap.deposit).toLocaleString()}원` : '—' },
    { label: '월세',      value: snap?.monthly_rent ? `${Number(snap.monthly_rent).toLocaleString()}원` : '—' },
    { label: '계약기간',  value: contract.lease_start && contract.lease_end ? `${formatDate(contract.lease_start)} ~ ${formatDate(contract.lease_end)}` : '—' },
    { label: '특약사항',  value: snap?.special_terms ?? '없음' },
    { label: '콘텐츠 해시', value: contract.content_hash ? contract.content_hash.slice(0, 16) + '...' : '—' },
    { label: '서명일',    value: contract.signed_at ? formatDate(contract.signed_at) : '미서명' },
    { label: '서명 IP',   value: contract.signer_ip ?? '—' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.25)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              계약서 미리보기
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{r?.name ?? ''}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        {/* 내용 */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {/* 도장/인감 영역 */}
          <div className="text-center mb-5 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="inline-block px-6 py-2 rounded-lg font-bold text-lg"
                 style={{ border: '2px solid var(--color-primary)', color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
              임 대 차 계 약 서
            </div>
          </div>

          {/* 업로드된 계약서 양식 */}
          {contract.template_url && (
            <div className="mb-5 pb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>업로드된 계약서 양식</p>
                <a href={contract.template_url} target="_blank" rel="noreferrer"
                   className="text-xs flex items-center gap-1" style={{ color: 'var(--color-accent-dark)' }}>
                  <Download size={11} /> {contract.template_name || '다운로드'}
                </a>
              </div>
              {contract.template_mime?.startsWith('image/') ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={contract.template_url} alt={contract.template_name || '계약서 양식'}
                     className="w-full rounded-lg border" style={{ borderColor: 'var(--color-border)' }} />
              ) : contract.template_mime === 'application/pdf' ? (
                <iframe src={contract.template_url} className="w-full rounded-lg border"
                        style={{ borderColor: 'var(--color-border)', height: 360 }} title="계약서 양식" />
              ) : (
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>미리보기를 지원하지 않는 형식입니다. 다운로드 후 확인해주세요.</p>
              )}
            </div>
          )}

          <dl className="space-y-3">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex gap-3">
                <dt className="text-xs font-medium shrink-0 w-24 pt-0.5" style={{ color: 'var(--color-muted)' }}>{label}</dt>
                <dd className="text-sm flex-1" style={{ color: 'var(--color-text)', wordBreak: 'break-all' }}>{value}</dd>
              </div>
            ))}
          </dl>

          {/* 서명 이미지 */}
          {contract.signature_data_url && (
            <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-muted)' }}>전자서명</p>
              <div className="rounded-lg overflow-hidden border p-2" style={{ borderColor: 'var(--color-border)', background: 'white' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={contract.signature_data_url} alt="서명" className="max-h-24 mx-auto" />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

function CField({ label, value, onChange, type = 'text' }: {
  label: string; value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={onChange}
        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
        onFocus={e => e.target.style.borderColor = 'var(--color-accent-dark)'}
        onBlur={e => e.target.style.borderColor = 'var(--color-border)'} />
    </div>
  )
}
