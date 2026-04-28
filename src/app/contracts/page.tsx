'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, FileText, Send, CheckCircle2, AlertCircle,
  Loader2, X, Clock, RefreshCw, Download, Eye,
  Pencil, Trash2, Upload, LayoutTemplate, Link2,
  MessageSquare, PenTool, RotateCcw, ScanLine, Printer,
  Camera, ArrowRight, ArrowLeft, ImageIcon,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { BUILT_IN_TEMPLATES, generateTemplateImagePages } from '@/lib/contract-templates'
import { compressImageFile } from '@/lib/compress-image'
import type { TemplateData } from '@/lib/contract-templates'
import type { Contract, Room } from '@/types'

/* ─── 마스터 계정 (양식 관리 권한) ─── */

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

/** 서면계약 여부 판별 — template_name에 "서면"이 포함되어 있으면 전자서명 프로세스 생략 */
function isPaperContract(c: { template_name?: string | null }): boolean {
  return !!c.template_name && c.template_name.includes('서면')
}

const STATUS_META: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  draft:        { label: '초안',        bg: 'rgba(29,53,87,0.06)',     color: 'var(--color-muted)',        icon: <Pencil size={11} /> },
  owner_signed: { label: '운영사서명', bg: 'rgba(59,130,246,0.1)',    color: '#3b82f6',                   icon: <PenTool size={11} /> },
  sent:         { label: '발송됨',     bg: 'rgba(168,218,220,0.2)',   color: 'var(--color-accent-dark)',   icon: <Send size={11} /> },
  signed:       { label: '서명완료',   bg: 'var(--color-success-bg)', color: 'var(--color-success)',       icon: <CheckCircle2 size={11} /> },
  expired:      { label: '만료됨',     bg: 'var(--color-danger-bg)',  color: 'var(--color-danger)',        icon: <Clock size={11} /> },
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
  const [filter, setFilter] = useState<'all' | 'draft' | 'owner_signed' | 'sent' | 'signed' | 'expired'>('all')
  const [ownerSignContract, setOwnerSignContract] = useState<ContractWithRoom | null>(null)
  const [builtinUploads, setBuiltinUploads] = useState<BuiltinUploadInfo[]>([])
  const [showBuiltinUploadManager, setShowBuiltinUploadManager] = useState(false)
  const [showScanUpload, setShowScanUpload] = useState(false)
  const [quickUploadContract, setQuickUploadContract] = useState<ContractWithRoom | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 양식 커스텀 업로드 로드
    const { data: builtinData } = await supabase
      .from('contract_builtin_uploads')
      .select('*')
    setBuiltinUploads((builtinData ?? []) as BuiltinUploadInfo[])

    const [{ data: ctData }, { data: rmData }, { data: leaseData }] = await Promise.all([
      supabase
        .from('contracts')
        .select('*, rooms(name)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('rooms').select('id, name, status, owner_id, building, area').eq('owner_id', user.id),
      supabase
        .from('leases')
        .select('room_id, tenant_id, monthly_rent, pledge_amount, lease_start, lease_end, vat_type, status, tenants(name, phone, email, birth_date)')
        .eq('owner_id', user.id)
        .eq('status', 'ACTIVE'),
    ])

    // leases → room별 입주사 정보 매핑
    const leaseByRoom: Record<string, { tenant_name: string; tenant_phone: string; tenant_email: string; tenant_birth: string; monthly_rent: number; deposit: number; lease_start: string; lease_end: string; vat_type: string }> = {}
    for (const l of (leaseData || []) as Array<Record<string, unknown>>) {
      const t = l.tenants as Record<string, string> | null
      leaseByRoom[l.room_id as string] = {
        tenant_name: t?.name || '',
        tenant_phone: t?.phone || '',
        tenant_email: t?.email || '',
        tenant_birth: t?.birth_date || '',
        monthly_rent: (l.monthly_rent as number) || 0,
        deposit: (l.pledge_amount as number) || 0,
        lease_start: (l.lease_start as string) || '',
        lease_end: (l.lease_end as string) || '',
        vat_type: (l.vat_type as string) || 'NONE',
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
    all:          contracts.length,
    draft:        contracts.filter(c => c.status === 'draft').length,
    owner_signed: contracts.filter(c => c.status === 'owner_signed').length,
    sent:         contracts.filter(c => c.status === 'sent').length,
    signed:       contracts.filter(c => c.status === 'signed').length,
    expired:      contracts.filter(c => c.status === 'expired').length,
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

  /* ─── 계약 발송 + 알림톡/SMS ─── */
  const sendContract = async (id: string, sendMethod: 'kakao' | 'sms' = 'kakao') => {
    const c = contracts.find(c => c.id === id)
    const hasPhone = !!(c?.tenant_phone)
    const methodLabel = sendMethod === 'sms' ? '문자(SMS)' : '카카오톡'
    const msg = hasPhone
      ? `계약서를 발송하고 ${c?.tenant_name ?? '세입자'}에게 ${methodLabel}로 서명 링크를 전송하시겠습니까?`
      : `계약서를 발송하시겠습니까? (연락처 없음 — ${methodLabel} 미발송)`
    if (!confirm(msg)) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return showToast('error', '로그인이 필요합니다.')

    const res  = await fetch('/api/contracts/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify({ contractId: id, sendMethod }),
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
            공간 이용 계약서 작성 및 전자서명 관리
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBuiltinUploadManager(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            <LayoutTemplate size={15} /> 내 양식 관리
          </button>
          <button onClick={() => setShowScanUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--color-accent-dark)', color: 'var(--color-accent-dark)', background: 'rgba(168,218,220,0.1)' }}>
            <ScanLine size={15} /> 스캔 업로드
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--color-primary)' }}>
            <Plus size={16} /> 계약서 작성
          </button>
        </div>
      </div>

      {/* 상태 통계 */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { key: 'draft',        label: '초안',        val: stats.draft        },
          { key: 'owner_signed', label: '운영사서명',  val: stats.owner_signed },
          { key: 'sent',         label: '발송됨',      val: stats.sent         },
          { key: 'signed',       label: '서명완료',    val: stats.signed       },
          { key: 'expired',      label: '만료됨',      val: stats.expired      },
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
                        {c.status === 'draft' && !isPaperContract(c) && (
                          <button onClick={() => setOwnerSignContract(c)}
                            className="p-1.5 rounded-lg text-xs"
                            style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}
                            title="운영사 서명">
                            <PenTool size={13} />
                          </button>
                        )}
                        {(c.status === 'draft' || c.status === 'owner_signed') && !isPaperContract(c) && (
                          <div className="relative group/send">
                            <button
                              className="p-1.5 rounded-lg text-xs"
                              style={{ color: 'var(--color-accent-dark)', background: 'rgba(168,218,220,0.15)' }}
                              title="발송">
                              <Send size={13} />
                            </button>
                            <div className="absolute left-0 bottom-full w-28 pb-1 z-50 hidden group-hover/send:block">
                              <div className="rounded-lg shadow-xl border py-1"
                                   style={{ background: '#ffffff', borderColor: 'var(--color-border)' }}>
                                <button onClick={() => sendContract(c.id, 'kakao')}
                                  className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 font-medium hover:bg-black/5"
                                  style={{ color: 'var(--color-text)' }}>
                                  <MessageSquare size={12} className="text-yellow-500" />
                                  카카오톡
                                </button>
                                <button onClick={() => sendContract(c.id, 'sms')}
                                  className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 font-medium hover:bg-black/5"
                                  style={{ color: 'var(--color-text)' }}>
                                  <Send size={12} className="text-green-500" />
                                  문자(SMS)
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {c.sign_token && !isPaperContract(c) && (
                          <button onClick={() => copySignLink(c)}
                            className="p-1.5 rounded-lg text-xs"
                            style={{ color: 'var(--color-primary)', background: 'rgba(29,53,87,0.08)' }}
                            title="서명 링크 복사">
                            <Link2 size={13} />
                          </button>
                        )}
                        {c.status !== 'signed' && (
                          <button onClick={() => setQuickUploadContract(c)}
                            className="p-1.5 rounded-lg text-xs"
                            style={{ color: 'var(--color-accent-dark)', background: 'rgba(168,218,220,0.2)' }}
                            title="서면 서명본 바로 업로드 (인쇄 생략)">
                            <Upload size={13} />
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
          builtinUploads={builtinUploads}
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

      {/* 운영사 서명 모달 */}
      {ownerSignContract && (
        <OwnerSignModal
          contract={ownerSignContract}
          onClose={() => setOwnerSignContract(null)}
          onSigned={() => { setOwnerSignContract(null); load(); showToast('success', '운영사 서명이 완료되었습니다.') }}
          onError={msg => showToast('error', msg)}
        />
      )}

      {/* 내 양식 관리 모달 */}
      {showBuiltinUploadManager && (
        <BuiltinUploadManagerModal
          onClose={() => { setShowBuiltinUploadManager(false); load() }}
          onToast={showToast}
        />
      )}

      {/* 스캔 업로드 모달 */}
      {showScanUpload && (
        <ScanUploadModal
          rooms={rooms}
          builtinUploads={builtinUploads}
          onClose={() => setShowScanUpload(false)}
          onCreated={() => { setShowScanUpload(false); load(); showToast('success', '수기 계약서가 등록되었습니다.') }}
          onError={msg => showToast('error', msg)}
        />
      )}

      {/* 간편 업로드 모달 (인쇄 단계 생략) */}
      {quickUploadContract && (
        <QuickScanUploadModal
          rooms={rooms}
          existingContract={quickUploadContract}
          onClose={() => setQuickUploadContract(null)}
          onCreated={() => { setQuickUploadContract(null); load(); showToast('success', '서명된 계약서가 등록되었습니다.') }}
          onError={msg => showToast('error', msg)}
        />
      )}
    </div>
  )
}

/* ─── 자동생성 양식 업로드 타입 ─── */
interface BuiltinUploadInfo {
  id: string
  template_key: string
  template_url: string
  template_name: string
  template_mime: string
  created_at: string
}

/* ─── 계약서 작성 모달 ─── */
function CreateContractModal({
  rooms, builtinUploads, onClose, onCreated, onError,
}: {
  rooms: Room[]
  builtinUploads: BuiltinUploadInfo[]
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
    tenant_birth: '',
    address:      '경기도 고양시 일산동구 중앙로 1129 제서관동 2017, 2018호 대우오피스',
    monthly_rent: '',
    deposit:      '',
    lease_start:  '',
    lease_end:    '',
    special_terms:'',
    vat_type:     'NONE' as 'VAT_INVOICE' | 'CASH_RECEIPT' | 'NONE',
  })
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [convertingPdf, setConvertingPdf] = useState(false)
  const [originalPdfName, setOriginalPdfName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [templateTab, setTemplateTab] = useState<'builtin' | 'upload'>('builtin')
  const [selectedBuiltIn, setSelectedBuiltIn] = useState<string | null>('basic-lease')
  const [generatingTemplate, setGeneratingTemplate] = useState(false)

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
      tenant_birth: (r.tenant_birth as string) ?? '',
      monthly_rent: String(r.monthly_rent ?? ''),
      deposit:      String(r.deposit ?? ''),
      lease_start:  (r.lease_start as string) ?? '',
      lease_end:    (r.lease_end as string)   ?? '',
      vat_type:     ((r.vat_type as 'VAT_INVOICE' | 'CASH_RECEIPT' | 'NONE') ?? 'NONE'),
    }))
  }

  const handleCreate = async () => {
    if (!form.room_id)     return onError('호실을 선택해주세요.')
    if (!form.tenant_name) return onError('입주사 이름을 입력해주세요.')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return onError('로그인이 필요합니다.') }

    // 기본 양식 선택 시 — 커스텀 업로드가 있으면 그 URL 사용, 없으면 Canvas 이미지 생성
    let sampleTemplateUrl:  string | null = null
    let sampleTemplateName: string | null = null
    let sampleTemplateMime: string | null = null
    let finalTemplateFile = templateFile
    let finalOriginalName = originalPdfName
    if (templateTab === 'builtin' && selectedBuiltIn && !templateFile) {
      // 커스텀 업로드 확인
      const customUpload = builtinUploads.find(u => u.template_key === selectedBuiltIn)
      if (customUpload) {
        // 커스텀 업로드된 파일 URL 직접 사용
        sampleTemplateUrl  = customUpload.template_url
        sampleTemplateName = customUpload.template_name
        sampleTemplateMime = customUpload.template_mime
      } else if (BUILTIN_TEMPLATE_DEFS.find(d => d.key === selectedBuiltIn)?.uploadOnly) {
        // uploadOnly 슬롯은 커스텀 업로드 필수
        onError('이 양식은 "내 양식 관리"에서 파일을 업로드해야 사용할 수 있습니다.')
        setSaving(false)
        return
      } else {
        // Canvas 자동생성 (다중 페이지)
        setGeneratingTemplate(true)
        try {
          const selectedRoom = rooms.find(r => r.id === form.room_id)
          const tplData: TemplateData = {
            tenant_name:   form.tenant_name,
            tenant_phone:  form.tenant_phone,
            tenant_birth:  form.tenant_birth,
            address:       form.address,
            monthly_rent:  form.monthly_rent,
            deposit:       form.deposit,
            lease_start:   form.lease_start,
            lease_end:     form.lease_end,
            special_terms: form.special_terms,
            room_name:     selectedRoom?.name ?? '',
            vat_type:      form.vat_type,
          }
          const pageBlobs = await generateTemplateImagePages(selectedBuiltIn, tplData)
          const tplInfo = BUILT_IN_TEMPLATES.find(t => t.id === selectedBuiltIn)
          finalTemplateFile = new File([pageBlobs[0]], `${tplInfo?.name ?? '계약서'}.png`, { type: 'image/png' })
          finalOriginalName = null
          /* 추가 페이지를 모두 업로드 후 scan_urls 에 저장 */
          ;(window as unknown as { __extraPages?: Blob[] }).__extraPages = pageBlobs.slice(1)
        } catch (err) {
          const msg = err instanceof Error ? err.message : '양식 생성 실패'
          onError(`양식 생성 실패: ${msg}`)
          setSaving(false)
          setGeneratingTemplate(false)
          return
        }
        setGeneratingTemplate(false)
      }
    }

    // 양식 파일 업로드 (다중 페이지 지원)
    let template_url: string | null = sampleTemplateUrl
    let template_name: string | null = sampleTemplateName
    let template_mime: string | null = sampleTemplateMime
    const scan_urls: string[] = []
    if (!template_url && finalTemplateFile) {
      const ext  = finalTemplateFile.name.split('.').pop() || 'bin'
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('contract-templates')
        .upload(path, finalTemplateFile, {
          contentType: finalTemplateFile.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (upErr) { setSaving(false); return onError(`양식 업로드 실패: ${upErr.message}`) }
      const { data: pub } = supabase.storage.from('contract-templates').getPublicUrl(path)
      template_url  = pub.publicUrl
      template_name = finalOriginalName ?? finalTemplateFile.name
      template_mime = finalTemplateFile.type
      scan_urls.push(template_url)

      /* 2페이지 이상이면 추가 페이지도 업로드 */
      const extraPages = (window as unknown as { __extraPages?: Blob[] }).__extraPages || []
      for (let i = 0; i < extraPages.length; i++) {
        const pg = extraPages[i]
        const pPath = `${user.id}/${Date.now()}-${crypto.randomUUID()}-p${i + 2}.png`
        const { error: pErr } = await supabase.storage
          .from('contract-templates')
          .upload(pPath, pg, { contentType: 'image/png', cacheControl: '3600', upsert: false })
        if (!pErr) {
          const { data: pPub } = supabase.storage.from('contract-templates').getPublicUrl(pPath)
          scan_urls.push(pPub.publicUrl)
        }
      }
      ;(window as unknown as { __extraPages?: Blob[] }).__extraPages = []
    }

    // 계약 스냅샷 + 해시
    const snapshot = {
      ...form,
      template_url:  template_url  ?? '',
      template_name: template_name ?? '',
      scan_urls,
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
              {[...rooms].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })).map(r => (
                <option key={r.id} value={r.id}>{r.name} {(r as Room & Record<string, unknown>).tenant_name ? `(${(r as Room & Record<string, unknown>).tenant_name})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CField label="입주사 이름 *" value={form.tenant_name} onChange={set('tenant_name')} />
            <CField label="연락처" value={form.tenant_phone} onChange={set('tenant_phone')} type="tel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="생년월일" value={form.tenant_birth} onChange={set('tenant_birth')} type="date" />
            <CField label="이메일" value={form.tenant_email} onChange={set('tenant_email')} type="email" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <CField label="소재지/호실주소" value={form.address} onChange={set('address')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="월 이용료 (원)" value={form.monthly_rent} onChange={set('monthly_rent')} type="number" />
            <CField label="보증금 (원)" value={form.deposit} onChange={set('deposit')} type="number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="계약 시작일" value={form.lease_start} onChange={set('lease_start')} type="date" />
            <CField label="계약 만료일" value={form.lease_end} onChange={set('lease_end')} type="date" />
          </div>
          {/* 부가세 여부 */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              부가세 처리 (입주사 세금계산서 발행여부)
            </label>
            <select value={form.vat_type} onChange={set('vat_type')}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}>
              <option value="NONE">미발행 (부가세 해당없음)</option>
              <option value="VAT_INVOICE">세금계산서 발행 (이용료의 10% 별도 표기)</option>
              <option value="CASH_RECEIPT">현금영수증 발행</option>
            </select>
          </div>
          {/* 계약 방식 선택 */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-muted)' }}>
              계약 방식
            </label>

            {/* 탭 */}
            <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'var(--color-background)' }}>
              <button type="button"
                onClick={() => { setTemplateTab('builtin'); setTemplateFile(null); setOriginalPdfName(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: templateTab === 'builtin' ? 'var(--color-surface)' : 'transparent',
                  color: templateTab === 'builtin' ? 'var(--color-primary)' : 'var(--color-muted)',
                  boxShadow: templateTab === 'builtin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                <LayoutTemplate size={13} />
                계약 방식
              </button>
              <button type="button"
                onClick={() => { setTemplateTab('upload'); setSelectedBuiltIn(null) }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: templateTab === 'upload' ? 'var(--color-surface)' : 'transparent',
                  color: templateTab === 'upload' ? 'var(--color-primary)' : 'var(--color-muted)',
                  boxShadow: templateTab === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                <Upload size={13} />
                직접 업로드
              </button>
            </div>

            {/* 계약서 양식 탭 */}
            {templateTab === 'builtin' && (
              <div className="space-y-2">
                {BUILTIN_TEMPLATE_DEFS.map(def => {
                  const hasCustom = builtinUploads.some(u => u.template_key === def.key)
                  const isUploadOnly = def.uploadOnly && !hasCustom
                  const selectable = !isUploadOnly
                  return (
                    <button key={def.key} type="button"
                      onClick={() => {
                        if (isUploadOnly) return
                        setSelectedBuiltIn(def.key === selectedBuiltIn ? null : def.key)
                      }}
                      className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all"
                      style={{
                        borderColor: selectedBuiltIn === def.key ? def.color : 'var(--color-border)',
                        background: selectedBuiltIn === def.key ? `${def.color}08` : 'var(--color-background)',
                        opacity: isUploadOnly ? 0.6 : 1,
                        cursor: selectable ? 'pointer' : 'default',
                      }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                             style={{ background: `${def.color}18`, color: def.color }}>
                          {isUploadOnly ? <Upload size={16} /> : <FileText size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: selectedBuiltIn === def.key ? def.color : 'var(--color-text)' }}>
                              {def.name}
                            </span>
                            {hasCustom && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: `${def.color}20`, color: def.color }}>
                                커스텀
                              </span>
                            )}
                            {isUploadOnly && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                                    style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
                                미등록
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
                            {hasCustom ? '업로드된 양식이 사용됩니다.' : def.desc}
                          </div>
                        </div>
                        {selectedBuiltIn === def.key && (
                          <CheckCircle2 size={18} style={{ color: def.color }} className="shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
                <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                  미등록 양식은 &quot;내 양식 관리&quot;에서 파일을 업로드한 뒤 사용할 수 있습니다.
                </p>
              </div>
            )}

            {/* 직접 업로드 탭 */}
            {templateTab === 'upload' && (
              <>
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
                    양식 파일 선택 (PDF / 이미지, 최대 50MB)
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
                  업로드한 양식이 입주사 서명 페이지에 그대로 노출됩니다.
                </p>
              </>
            )}
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
          <button onClick={handleCreate} disabled={saving || generatingTemplate}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}>
            {(saving || generatingTemplate) && <Loader2 size={14} className="animate-spin" />}
            {generatingTemplate ? '양식 생성 중...' : '계약서 생성'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── 계약서 미리보기 모달 ─── */
function ContractPreviewModal({ contract, onClose }: { contract: ContractWithRoom; onClose: () => void }) {
  const snap = contract.contract_snapshot as Record<string, unknown> | null
  const r    = contract.room

  /* 다중 페이지 지원: snapshot.scan_urls 가 있으면 그걸 쓰고, 없으면 template_url 단일 사용 */
  const scanUrls: string[] = Array.isArray(snap?.scan_urls)
    ? (snap!.scan_urls as string[])
    : (contract.template_url ? [contract.template_url] : [])

  /* 미리보기용: 기존 단일 긴 이미지를 슬라이스해 표시 */
  const [previewSlices, setPreviewSlices] = useState<string[]>(scanUrls)
  useEffect(() => {
    /* 새 계약서(이미 페이지별)거나 1장이면 슬라이스 시도 */
    let cancelled = false
    ;(async () => {
      const out: string[] = []
      for (const u of scanUrls) {
        const parts = await sliceTallImage(u)
        out.push(...parts)
      }
      if (!cancelled) setPreviewSlices(out.length > 0 ? out : scanUrls)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.id])

  /* 긴 이미지를 A4 비율(W:H = 1:√2 ≈ 0.707)로 슬라이스하여 data URL 배열 반환 */
  const sliceTallImage = async (url: string): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const aspect = img.naturalHeight / img.naturalWidth
        // A4 portrait 비율 (1.414) 기준: 1.6 이상이면 2페이지 이상으로 간주
        if (aspect <= 1.6) { resolve([url]); return }
        const pageH = Math.round(img.naturalWidth * 1.414) // A4 비율 한 페이지 높이
        const pages = Math.ceil(img.naturalHeight / pageH)
        const out: string[] = []
        for (let i = 0; i < pages; i++) {
          const sliceY = i * pageH
          const sliceH = Math.min(pageH, img.naturalHeight - sliceY)
          if (sliceH <= 0) break
          const c = document.createElement('canvas')
          c.width = img.naturalWidth
          c.height = sliceH
          const cx = c.getContext('2d')!
          cx.fillStyle = '#fff'
          cx.fillRect(0, 0, c.width, c.height)
          cx.drawImage(img, 0, sliceY, img.naturalWidth, sliceH, 0, 0, img.naturalWidth, sliceH)
          out.push(c.toDataURL('image/png'))
        }
        resolve(out.length > 0 ? out : [url])
      }
      img.onerror = () => resolve([url])  // 로딩 실패 시 원본 사용
      img.src = url
    })
  }

  /* 계약서 양식 인쇄 (전체 페이지 + 서명 페이지) */
  const handlePrint = async () => {
    if (scanUrls.length === 0 && !contract.signature_data_url && !contract.owner_signature_url) return

    /* 기존 계약서(긴 단일 PNG) 자동 슬라이스 — 새로 만든 계약서는 이미 페이지별이라 그대로 통과 */
    const slicedPages: string[] = []
    for (const u of scanUrls) {
      const parts = await sliceTallImage(u)
      slicedPages.push(...parts)
    }

    const w = window.open('', '_blank')
    if (!w) return

    /* 모든 이미지 (계약서 페이지 + 서명들) — 전부 로딩 후 인쇄 */
    const allImgs: string[] = [...slicedPages]
    if (contract.owner_signature_url) allImgs.push(contract.owner_signature_url)
    if (contract.signature_data_url) allImgs.push(contract.signature_data_url)
    const total = allImgs.length

    const onloadAttr = `onload="window.__loaded=(window.__loaded||0)+1; if(window.__loaded===${total}) setTimeout(()=>window.print(),400);" onerror="window.__loaded=(window.__loaded||0)+1; if(window.__loaded===${total}) setTimeout(()=>window.print(),400);"`

    const pages = slicedPages.map(u => `<div class="page"><img class="doc-img" src="${u}" ${onloadAttr} /></div>`).join('')

    /* 서명 페이지 — 운영사 + 입주사 서명을 한 페이지에 */
    const sigPage = (contract.owner_signature_url || contract.signature_data_url) ? `
      <div class="page sig-page">
        <h2>전자서명</h2>
        <table>
          <tr><th>호실</th><td>${r?.name ?? '—'}</td>
              <th>입주사</th><td>${String(snap?.tenant_name ?? contract.tenant_name ?? '—')}</td></tr>
          <tr><th>계약기간</th><td colspan="3">${contract.lease_start && contract.lease_end ? contract.lease_start + ' ~ ' + contract.lease_end : '—'}</td></tr>
        </table>

        <div class="sig-grid">
          <div class="sig-cell">
            <div class="sig-label">운영사 (갑)</div>
            ${contract.owner_signature_url ? `<img class="sig-img" src="${contract.owner_signature_url}" ${onloadAttr} />` : '<div class="sig-empty">미서명</div>'}
            <div class="sig-meta">
              ${contract.owner_signed_at ? '서명일: ' + new Date(contract.owner_signed_at).toLocaleString('ko-KR') : ''}
              ${contract.owner_signer_ip ? '<br/>IP: ' + contract.owner_signer_ip : ''}
            </div>
          </div>
          <div class="sig-cell">
            <div class="sig-label">입주사 (을)</div>
            ${contract.signature_data_url ? `<img class="sig-img" src="${contract.signature_data_url}" ${onloadAttr} />` : '<div class="sig-empty">미서명</div>'}
            <div class="sig-meta">
              ${contract.signed_at ? '서명일: ' + new Date(contract.signed_at).toLocaleString('ko-KR') : ''}
              ${contract.signer_ip ? '<br/>IP: ' + contract.signer_ip : ''}
            </div>
          </div>
        </div>

        <div class="hash-box">
          <div class="hash-label">콘텐츠 무결성 해시 (SHA-256)</div>
          <div class="hash-val">${contract.content_hash ?? '(없음)'}</div>
        </div>
      </div>
    ` : ''

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>계약서 인쇄</title><style>
      @page { size: A4; margin: 10mm; }
      @media print {
        html, body { margin: 0; padding: 0; }
        .page { page-break-after: always; page-break-inside: avoid; break-after: page; break-inside: avoid; }
        .page:last-child { page-break-after: auto; break-after: auto; }
        .doc-img { max-width: 100%; max-height: 270mm; width: auto; height: auto; display: block; margin: 0 auto; object-fit: contain; }
      }
      body { margin: 0; font-family: 'Pretendard', sans-serif; color: #1d3557; }
      .page { padding: 0; margin: 0; box-sizing: border-box; }
      .doc-img { display: block; max-width: 100%; height: auto; margin: 0 auto; }
      .sig-page { padding: 20mm; box-sizing: border-box; }
      .sig-page h2 { font-size: 20px; border-bottom: 2px solid #1d3557; padding-bottom: 8px; margin: 0 0 20px 0; }
      .sig-page table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 13px; }
      .sig-page th, .sig-page td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
      .sig-page th { background: #f0f4f8; width: 100px; }
      .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
      .sig-cell { border: 1px solid #ccc; padding: 16px; min-height: 200px; display: flex; flex-direction: column; }
      .sig-label { font-weight: bold; font-size: 14px; margin-bottom: 12px; }
      .sig-img { max-height: 100px; max-width: 100%; align-self: center; margin: 8px 0; }
      .sig-empty { color: #999; padding: 30px; text-align: center; }
      .sig-meta { font-size: 11px; color: #666; margin-top: auto; padding-top: 12px; border-top: 1px dashed #ddd; }
      .hash-box { width: 100%; background: #f5f5f5; padding: 12px; border-radius: 4px; }
      .hash-label { font-size: 11px; color: #666; margin-bottom: 4px; }
      .hash-val { font-family: monospace; font-size: 10px; word-break: break-all; }
    </style></head><body>${pages}${sigPage}</body></html>`)
    w.document.close()
  }

  /* 법적 증거 패키지 다운로드 (HTML → 인쇄/PDF) */
  const handleEvidenceDownload = async () => {
    const c = contract
    const s = snap
    const now = new Date().toLocaleString('ko-KR')

    /* 기존 계약서(긴 단일 PNG) 자동 슬라이스 — 새로 만든 계약서는 이미 페이지별 */
    const slicedScans: string[] = []
    for (const u of scanUrls) {
      const parts = await sliceTallImage(u)
      slicedScans.push(...parts)
    }

    /* 전자계약의 마지막 스캔 페이지는 빈 서명란(증거패키지의 실제 전자서명과 중복) → 제거 */
    const hasESign = !!(c.signature_data_url || c.owner_signature_url)
    if (hasESign && slicedScans.length > 1) slicedScans.pop()

    // 해시 검증: snapshot을 다시 해싱하여 저장된 해시와 비교
    const snapshotStr = s ? JSON.stringify(s) : '(스냅샷 없음)'

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>전자서명 증거 패키지</title>
<style>
  @page { size: A4; margin: 5mm; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Pretendard', sans-serif; color: #333; font-size: 12px; line-height: 1.45; background: #eee; }
  /* 화면 보기: A4 비율 고정 (210mm 너비). 인쇄 시에는 풀페이지 */
  .sheet { width: 210mm; min-height: 297mm; margin: 8mm auto; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  @media print {
    body { background: #fff; }
    .sheet { width: auto; min-height: 0; margin: 0; box-shadow: none; }
  }

  /* ── 계약서 스캔 페이지: 헤더 없이 이미지만 풀페이지 ── */
  .scan-page { page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; text-align: center; }
  .scan-page img { width: 100%; max-width: 100%; max-height: 280mm; height: auto; display: block; margin: 0 auto; }
  .scan-page .label { font-size: 9px; color: #aaa; margin: 0; padding: 0; text-align: right; line-height: 1; }

  /* ── 마지막 메타데이터 페이지 ── */
  .meta { padding: 4mm 6mm; }
  .meta h1 { font-size: 16px; color: #1d3557; border-bottom: 2px solid #1d3557; padding-bottom: 4px; margin: 0 0 4px 0; }
  .meta h2 { font-size: 12px; color: #4a4e69; margin: 8px 0 3px 0; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
  .meta .sub { font-size: 10px; color: #666; margin: 0 0 4px 0; }
  .meta table { width: 100%; border-collapse: collapse; margin: 2px 0 4px 0; }
  .meta th, .meta td { border: 1px solid #ccc; padding: 2px 6px; text-align: left; font-size: 10px; line-height: 1.3; }
  .meta th { background: #f0f4f8; font-weight: bold; width: 90px; }
  .sig-box { display: inline-block; border: 1px solid #ccc; padding: 2px; background: #fff; margin: 2px 4px 2px 0; vertical-align: top; }
  .sig-box img { max-height: 40px; display: block; }
  .sig-row { display: flex; gap: 6px; }
  .sig-row > div { flex: 1; }
  .hash { font-family: monospace; font-size: 9px; word-break: break-all; background: #f5f5f5; padding: 4px; border-radius: 2px; }
  .snapshot { font-family: monospace; font-size: 8px; word-break: break-all; background: #f9f9f9; padding: 4px; border-radius: 2px; white-space: pre-wrap; max-height: 90mm; overflow: hidden; }
  .badge { display: inline-block; padding: 1px 5px; border-radius: 2px; font-size: 9px; font-weight: bold; }
  .badge-ok { background: #d4edda; color: #155724; }
  .badge-no { background: #f8d7da; color: #721c24; }
  .footer { margin-top: 6px; padding-top: 4px; border-top: 1px solid #1d3557; font-size: 9px; color: #888; }
</style></head><body>

${slicedScans.map((u, i) => `<div class="sheet scan-page"><img src="${u}" alt="계약서 ${i + 1}쪽" /><div class="label">계약서 ${i + 1} / ${slicedScans.length}쪽 · ID ${c.id.slice(0, 8)}</div></div>`).join('')}

<div class="sheet meta">
  <h1>전자서명 증거 패키지</h1>
  <p class="sub">출력일시: ${now} · 계약 ID: <span style="font-family:monospace">${c.id}</span></p>

  <h2>1. 계약 정보</h2>
  <table>
    <tr><th>호실</th><td>${r?.name ?? '—'}</td>
        <th>입주사</th><td>${String(s?.tenant_name ?? c.tenant_name ?? '—')}</td></tr>
    <tr><th>연락처</th><td>${String(s?.tenant_phone ?? c.tenant_phone ?? '—')}</td>
        <th>계약 상태</th><td><span class="badge ${c.status === 'signed' ? 'badge-ok' : 'badge-no'}">${c.status}</span></td></tr>
    <tr><th>소재지</th><td colspan="3">${String(s?.address ?? '—')}</td></tr>
    <tr><th>보증금</th><td>${s?.deposit ? Number(s.deposit).toLocaleString() + '원' : '—'}</td>
        <th>월 이용료</th><td>${s?.monthly_rent ? Number(s.monthly_rent).toLocaleString() + '원' : '—'}</td></tr>
    <tr><th>계약기간</th><td colspan="3">${c.lease_start && c.lease_end ? c.lease_start + ' ~ ' + c.lease_end : '—'}</td></tr>
    <tr><th>특약사항</th><td colspan="3">${String(s?.special_terms ?? '없음')}</td></tr>
  </table>

  <h2>2. 전자서명</h2>
  <div class="sig-row">
    <div>
      <table>
        <tr><th colspan="2" style="background:#1d3557;color:#fff;text-align:center;width:auto">운영사 (갑)</th></tr>
        <tr><th>서명</th><td>${c.owner_signature_url ? '<span class="badge badge-ok">완료</span>' : '<span class="badge badge-no">미서명</span>'}</td></tr>
        <tr><th>일시</th><td>${c.owner_signed_at ?? '—'}</td></tr>
        <tr><th>IP</th><td>${c.owner_signer_ip ?? '—'}</td></tr>
      </table>
      ${c.owner_signature_url ? `<div class="sig-box"><img src="${c.owner_signature_url}" alt="운영사 서명" /></div>` : ''}
    </div>
    <div>
      <table>
        <tr><th colspan="2" style="background:#1d3557;color:#fff;text-align:center;width:auto">입주사 (을)</th></tr>
        <tr><th>서명</th><td>${c.signature_data_url ? '<span class="badge badge-ok">완료</span>' : '<span class="badge badge-no">미서명</span>'}</td></tr>
        <tr><th>일시</th><td>${c.signed_at ?? '—'}</td></tr>
        <tr><th>IP</th><td>${c.signer_ip ?? '—'}</td></tr>
      </table>
      ${c.signature_data_url ? `<div class="sig-box"><img src="${c.signature_data_url}" alt="입주사 서명" /></div>` : ''}
    </div>
  </div>

  <h2>3. 콘텐츠 무결성 (SHA-256)</h2>
  <div class="hash">${c.content_hash ?? '(없음)'}</div>

  <h2>4. 계약 원문 스냅샷 (JSON · 요약)</h2>
  <div class="snapshot">${snapshotStr.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 1200)}${snapshotStr.length > 1200 ? '\n... (이후 생략, 전문은 DB에 저장됨)' : ''}</div>

  <div class="footer">
    본 문서는 노아도(noado.kr)에서 자동 생성된 전자서명 증거 패키지입니다. 전자서명법 제3조에 따라 서면 서명과 동일한 법적 효력을 가집니다.
  </div>
</div>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()

    /* 모든 이미지 로딩 완료 후 단 1회만 인쇄 (취소 후 재호출 방지) */
    let printed = false
    const doPrint = () => {
      if (printed) return
      printed = true
      w.print()
    }
    const imgs = w.document.images
    const total = imgs.length
    if (total === 0) {
      setTimeout(doPrint, 300)
    } else {
      let loaded = 0
      const tryPrint = () => {
        loaded += 1
        if (loaded >= total && !printed) setTimeout(doPrint, 400)
      }
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i]
        if (img.complete) tryPrint()
        else { img.addEventListener('load', tryPrint); img.addEventListener('error', tryPrint) }
      }
      // 안전망: 6초 후 무조건 인쇄
      setTimeout(doPrint, 6000)
    }
  }

  const sv = (k: string): string => {
    const v = snap?.[k]
    return v == null || v === '' ? '' : String(v)
  }
  const rows = [
    { label: '입주사',      value: sv('tenant_name') || contract.tenant_name || '—' },
    { label: '연락처',      value: sv('tenant_phone') || contract.tenant_phone || '—' },
    { label: '주소',        value: sv('tenant_address') || sv('address') || '—' },
    { label: '사업자번호',  value: sv('tenant_business_no') || '—' },
    { label: '업종',        value: sv('tenant_biz_type') || '—' },
    { label: '보증금',      value: sv('deposit') ? `${Number(sv('deposit')).toLocaleString()}원` : '—' },
    { label: '월 이용료',   value: sv('monthly_rent') ? `${Number(sv('monthly_rent')).toLocaleString()}원` : '—' },
    { label: '계약기간',    value: contract.lease_start && contract.lease_end ? `${formatDate(contract.lease_start)} ~ ${formatDate(contract.lease_end)}` : '—' },
    { label: '특약사항',    value: sv('special_terms') || '없음' },
    { label: '콘텐츠 해시', value: contract.content_hash ? contract.content_hash.slice(0, 16) + '...' : '—' },
    { label: '서명일',      value: contract.signed_at ? formatDate(contract.signed_at) : '미서명' },
    { label: '서명 IP',     value: contract.signer_ip ?? '—' },
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

          {/* 업로드된 계약서 양식 (다중 페이지 지원) */}
          {scanUrls.length > 0 && (
            <div className="mb-5 pb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
                  업로드된 계약서 양식 {previewSlices.length > 1 ? `(${previewSlices.length}장)` : ''}
                </p>
                {contract.template_url && (
                  <a href={contract.template_url} target="_blank" rel="noreferrer"
                     className="text-xs flex items-center gap-1" style={{ color: 'var(--color-accent-dark)' }}>
                    <Download size={11} /> {contract.template_name || '다운로드'}
                  </a>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {previewSlices.map((url, i) => (
                  <div key={i}>
                    {previewSlices.length > 1 && (
                      <p className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>{i + 1}쪽</p>
                    )}
                    {contract.template_mime === 'application/pdf' && i === 0 && previewSlices.length === 1 ? (
                      <iframe src={url} className="w-full rounded-lg border"
                              style={{ borderColor: 'var(--color-border)', height: 360 }} title={`계약서 양식 ${i + 1}`} />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={url} alt={`계약서 양식 ${i + 1}`}
                           className="w-full rounded-lg border" style={{ borderColor: 'var(--color-border)' }} />
                    )}
                  </div>
                ))}
              </div>
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

          {/* ── 전자서명 증거 ── */}
          <div className="mt-5 pt-4 border-t space-y-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>전자서명 증거</p>

            {/* 운영사 서명 */}
            <div className="rounded-lg p-3" style={{ background: 'var(--color-background)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                     style={{ background: contract.owner_signature_url ? 'var(--color-success-bg)' : 'var(--color-muted-bg)',
                              color: contract.owner_signature_url ? 'var(--color-success)' : 'var(--color-muted)' }}>
                  {contract.owner_signature_url ? '✓' : '—'}
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>운영사 (갑)</span>
                {!contract.owner_signature_url && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>미서명</span>}
              </div>
              {contract.owner_signature_url && (
                <div className="flex items-center gap-3">
                  <div className="rounded border p-1.5 shrink-0" style={{ borderColor: 'var(--color-border)', background: 'white' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={contract.owner_signature_url} alt="운영사 서명" className="max-h-16" />
                  </div>
                  <div className="text-[11px] space-y-0.5" style={{ color: 'var(--color-muted)' }}>
                    <div>서명일: {contract.owner_signed_at ? formatDate(contract.owner_signed_at) : '—'}</div>
                    {contract.owner_signer_ip && <div>IP: {contract.owner_signer_ip}</div>}
                  </div>
                </div>
              )}
            </div>

            {/* 입주사 서명 */}
            <div className="rounded-lg p-3" style={{ background: 'var(--color-background)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                     style={{ background: contract.signature_data_url ? 'var(--color-success-bg)' : 'var(--color-muted-bg)',
                              color: contract.signature_data_url ? 'var(--color-success)' : 'var(--color-muted)' }}>
                  {contract.signature_data_url ? '✓' : '—'}
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>입주사 (을)</span>
                {!contract.signature_data_url && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>미서명</span>}
              </div>
              {contract.signature_data_url && (
                <div className="flex items-center gap-3">
                  <div className="rounded border p-1.5 shrink-0" style={{ borderColor: 'var(--color-border)', background: 'white' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={contract.signature_data_url} alt="입주사 서명" className="max-h-16" />
                  </div>
                  <div className="text-[11px] space-y-0.5" style={{ color: 'var(--color-muted)' }}>
                    <div>서명일: {contract.signed_at ? formatDate(contract.signed_at) : '—'}</div>
                    {contract.signer_ip && <div>IP: {contract.signer_ip}</div>}
                    {contract.content_hash && <div className="break-all">해시: {contract.content_hash.slice(0, 20)}...</div>}
                  </div>
                </div>
              )}
            </div>

            {/* 콘텐츠 해시 전체 */}
            {contract.content_hash && (
              <div className="text-[10px] p-2 rounded font-mono break-all" style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
                SHA-256: {contract.content_hash}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-2" style={{ borderColor: 'var(--color-border)' }}>
          {contract.template_url && (
            <button onClick={handlePrint}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
              style={{ background: 'var(--color-primary)', color: '#fff' }}>
              <Printer size={14} /> 인쇄
            </button>
          )}
          {(contract.status === 'signed' || contract.status === 'owner_signed') && (
            <button onClick={handleEvidenceDownload}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
              style={{ background: 'var(--color-accent-dark, #2a9d8f)', color: '#fff' }}>
              <Download size={14} /> 증거 패키지
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── 운영사 서명 모달 ─── */
function OwnerSignModal({ contract, onClose, onSigned, onError }: {
  contract: ContractWithRoom
  onClose: () => void
  onSigned: () => void
  onError: (msg: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasSig, setHasSig] = useState(false)
  const [saving, setSaving] = useState(false)

  // Canvas 초기화
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, rect.width, rect.height)
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    setDrawing(true); setHasSig(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!drawing) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1d3557'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
    ctx.stroke()
  }

  const endDraw = () => setDrawing(false)

  const clearSig = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setHasSig(false)
  }

  const handleSign = async () => {
    if (!hasSig) return
    setSaving(true)
    try {
      const canvas = canvasRef.current!
      const dataUrl = canvas.toDataURL('image/png')

      const res = await fetch('/api/contracts/owner-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id, signature: dataUrl }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '서명 저장 실패')
      onSigned()
    } catch (err) {
      onError(err instanceof Error ? err.message : '서명 저장 실패')
    } finally {
      setSaving(false)
    }
  }

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
              운영사 전자서명
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {contract.room?.name} · {contract.tenant_name}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        {/* 계약 요약 */}
        <div className="px-6 py-4 space-y-2" style={{ background: 'var(--color-background)' }}>
          <div className="flex gap-3 text-sm">
            <span className="font-medium w-20 shrink-0" style={{ color: 'var(--color-muted)' }}>입주사</span>
            <span style={{ color: 'var(--color-text)' }}>{contract.tenant_name || '—'}</span>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="font-medium w-20 shrink-0" style={{ color: 'var(--color-muted)' }}>계약기간</span>
            <span style={{ color: 'var(--color-text)' }}>
              {contract.lease_start && contract.lease_end
                ? `${formatDate(contract.lease_start)} ~ ${formatDate(contract.lease_end)}`
                : '—'}
            </span>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="font-medium w-20 shrink-0" style={{ color: 'var(--color-muted)' }}>월 이용료</span>
            <span style={{ color: 'var(--color-text)' }}>
              {contract.monthly_rent ? `${contract.monthly_rent.toLocaleString()}원` : '—'}
            </span>
          </div>
        </div>

        {/* 서명 패드 */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
              아래에 서명해주세요
            </span>
            <button onClick={clearSig} className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--color-muted)' }}>
              <RotateCcw size={12} /> 초기화
            </button>
          </div>
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
            <canvas
              ref={canvasRef}
              className="w-full touch-none"
              style={{ cursor: 'crosshair', display: 'block', background: 'white', height: 160 }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
            />
          </div>
          <p className="text-[11px] mt-2" style={{ color: 'var(--color-muted)' }}>
            서명 시 위 계약 내용에 운영사으로서 동의하는 것으로 간주됩니다.
          </p>
        </div>

        {/* 버튼 */}
        <div className="px-6 py-4 border-t flex gap-2" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            취소
          </button>
          <button onClick={handleSign} disabled={!hasSig || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            <PenTool size={14} /> 서명 완료
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

/* ─── 내 양식 관리 모달 (자동생성 3개 양식에 커스텀 파일 업로드) ─── */
const BUILTIN_TEMPLATE_DEFS: { key: string; name: string; desc: string; color: string; uploadOnly?: boolean }[] = [
  { key: 'basic-lease',  name: '전자계약', desc: '카톡/문자 링크로 전자서명 — 2페이지 계약서', color: '#1d3557' },
  { key: 'paper-lease',  name: '서면계약', desc: '프린트 후 대면 서명 — 전자서명 불필요', color: '#4a4e69' },
  { key: 'slot-3',       name: '직접 업로드 양식', desc: '파일을 업로드하여 양식을 등록하세요', color: '#888', uploadOnly: true },
]

function BuiltinUploadManagerModal({
  onClose, onToast,
}: {
  onClose: () => void
  onToast: (type: 'success' | 'error', msg: string) => void
}) {
  const supabase = createClient()
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [uploads, setUploads] = useState<BuiltinUploadInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [convertingPdf, setConvertingPdf] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('contract_builtin_uploads')
      .select('*')
      .order('created_at', { ascending: true })
    setUploads((data ?? []) as BuiltinUploadInfo[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const getUpload = (key: string) => uploads.find(u => u.template_key === key)

  const handleFileSelect = async (templateKey: string, file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      onToast('error', 'PDF 또는 이미지(JPG/PNG/WEBP) 파일만 업로드 가능합니다.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      onToast('error', '파일 크기는 50MB 이하여야 합니다.')
      return
    }

    let finalFile = file
    let origName: string | null = null

    if (file.type === 'application/pdf') {
      setConvertingPdf(templateKey)
      try {
        const { convertPdfToPngBlob } = await import('@/lib/pdf-to-image')
        const { blob } = await convertPdfToPngBlob(file)
        const baseName = file.name.replace(/\.pdf$/i, '')
        finalFile = new File([blob], `${baseName}.png`, { type: 'image/png' })
        origName = file.name
      } catch {
        onToast('error', 'PDF → 이미지 변환 실패')
        setConvertingPdf(null)
        return
      }
      setConvertingPdf(null)
    }

    setUploading(templateKey)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(null); onToast('error', '로그인이 필요합니다.'); return }

    const ext = finalFile.name.split('.').pop() || 'bin'
    const path = `builtin-uploads/${user.id}/${templateKey}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('contract-templates')
      .upload(path, finalFile, { contentType: finalFile.type, cacheControl: '3600', upsert: false })
    if (upErr) { setUploading(null); onToast('error', `업로드 실패: ${upErr.message}`); return }

    const { data: pub } = supabase.storage.from('contract-templates').getPublicUrl(path)

    const existing = getUpload(templateKey)
    if (existing) {
      const urlParts = existing.template_url.split('/contract-templates/')
      if (urlParts.length > 1) {
        await supabase.storage.from('contract-templates').remove([urlParts[1]])
      }
      const { error: dbErr } = await supabase
        .from('contract_builtin_uploads')
        .update({
          template_url:  pub.publicUrl,
          template_name: origName ?? finalFile.name,
          template_mime: finalFile.type,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (dbErr) { setUploading(null); onToast('error', dbErr.message); return }
    } else {
      const { error: dbErr } = await supabase.from('contract_builtin_uploads').insert({
        owner_id:      user.id,
        template_key:  templateKey,
        template_url:  pub.publicUrl,
        template_name: origName ?? finalFile.name,
        template_mime: finalFile.type,
      })
      if (dbErr) { setUploading(null); onToast('error', dbErr.message); return }
    }

    setUploading(null)
    onToast('success', '양식이 업로드되었습니다.')
    const ref = fileInputRefs.current[templateKey]
    if (ref) ref.value = ''
    load()
  }

  const handleDelete = async (templateKey: string) => {
    const existing = getUpload(templateKey)
    if (!existing) return
    if (!confirm('이 양식 파일을 삭제하시겠습니까? 삭제 후 자동생성 방식으로 복원됩니다.')) return

    const urlParts = existing.template_url.split('/contract-templates/')
    if (urlParts.length > 1) {
      await supabase.storage.from('contract-templates').remove([urlParts[1]])
    }
    await supabase.from('contract_builtin_uploads').delete().eq('id', existing.id)
    onToast('success', '삭제되었습니다.')
    load()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.4)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              내 계약서 양식 관리
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              각 양식에 파일을 업로드하면 자동생성 대신 업로드한 파일이 사용됩니다.
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        {/* 양식 목록 */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          ) : (
            BUILTIN_TEMPLATE_DEFS.map(def => {
              const upload = getUpload(def.key)
              const isUploading = uploading === def.key
              const isConverting = convertingPdf === def.key

              return (
                <div key={def.key}
                  className="rounded-xl border-2 overflow-hidden transition-all"
                  style={{ borderColor: upload ? def.color : 'var(--color-border)' }}>

                  {/* 양식 헤더 */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                         style={{ background: `${def.color}18`, color: def.color }}>
                      <FileText size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{def.name}</span>
                        {upload ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: `${def.color}20`, color: def.color }}>
                            커스텀 양식
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                                style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
                            자동생성
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
                        {def.desc}
                      </div>
                    </div>
                  </div>

                  {/* 업로드된 파일 미리보기 */}
                  {upload && (
                    <div className="px-4 pb-3">
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm"
                           style={{ borderColor: `${def.color}40`, background: `${def.color}06` }}>
                        {upload.template_mime?.startsWith('image/') ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={upload.template_url} alt={upload.template_name}
                            className="w-10 h-14 rounded border object-cover shrink-0"
                            style={{ borderColor: 'var(--color-border)' }} />
                        ) : (
                          <div className="w-10 h-14 rounded border flex items-center justify-center shrink-0"
                               style={{ borderColor: 'var(--color-border)', background: 'var(--color-muted-bg)' }}>
                            <FileText size={16} style={{ color: 'var(--color-muted)' }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                            {upload.template_name}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
                            {formatDate(upload.created_at)}
                          </div>
                        </div>
                        <a href={upload.template_url} target="_blank" rel="noreferrer"
                           className="text-[11px] font-semibold px-2 py-1 rounded shrink-0"
                           style={{ color: 'var(--color-accent-dark)', background: 'rgba(168,218,220,0.15)', textDecoration: 'none' }}>
                          보기
                        </a>
                        <button onClick={() => handleDelete(def.key)}
                          className="p-1.5 rounded-lg shrink-0"
                          style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}
                          title="삭제">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 업로드 영역 */}
                  <div className="px-4 pb-4">
                    <input
                      ref={el => { fileInputRefs.current[def.key] = el }}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleFileSelect(def.key, f)
                      }}
                      className="hidden"
                    />
                    {isConverting ? (
                      <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed text-sm"
                           style={{ borderColor: 'var(--color-accent-dark)', background: 'rgba(168,218,220,0.12)', color: 'var(--color-accent-dark)' }}>
                        <Loader2 size={14} className="animate-spin" />
                        PDF 변환 중...
                      </div>
                    ) : isUploading ? (
                      <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed text-sm"
                           style={{ borderColor: def.color, background: `${def.color}08`, color: def.color }}>
                        <Loader2 size={14} className="animate-spin" />
                        업로드 중...
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[def.key]?.click()}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed text-sm transition-all"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'var(--color-background)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = def.color; e.currentTarget.style.color = def.color }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-muted)' }}>
                        <Upload size={14} />
                        {upload ? '다른 파일로 교체' : '양식 파일 업로드'} (PDF / 이미지)
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}

          <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            업로드한 양식은 계약서 작성 시 &quot;계약서 양식&quot; 탭에서 자동으로 적용됩니다.
          </p>
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

/* ─── 스캔 업로드 모달 (수기 계약서 → 스캔 → 업로드) ─── */
function ScanUploadModal({
  rooms, builtinUploads, onClose, onCreated, onError,
}: {
  rooms: Room[]
  builtinUploads: BuiltinUploadInfo[]
  onClose: () => void
  onCreated: () => void
  onError: (msg: string) => void
}) {
  const supabase = createClient()
  const scanInputRef = useRef<HTMLInputElement>(null)

  /* 스텝: 1=계약정보+양식프린트, 2=스캔업로드 */
  const [step, setStep] = useState<1 | 2>(1)

  const [form, setForm] = useState({
    room_id: '', tenant_name: '', tenant_phone: '', tenant_email: '', tenant_birth: '',
    address: '경기도 고양시 일산동구 중앙로 1129 제서관동 2017, 2018호 대우오피스', monthly_rent: '', deposit: '',
    lease_start: '', lease_end: '', special_terms: '',
    vat_type: 'NONE' as 'VAT_INVOICE' | 'CASH_RECEIPT' | 'NONE',
  })
  const [selectedBuiltIn, setSelectedBuiltIn] = useState<string | null>('paper-lease')
  const [generatingTemplate, setGeneratingTemplate] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  /* 스캔 파일 */
  const [scanFiles, setScanFiles] = useState<File[]>([])
  const [scanPreviews, setScanPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [convertingPdf, setConvertingPdf] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleRoomSelect = (roomId: string) => {
    const r = rooms.find(r => r.id === roomId) as Room & Record<string, unknown> | undefined
    if (!r) return
    setForm(prev => ({
      ...prev,
      room_id: roomId,
      tenant_name:  (r.tenant_name as string)  ?? '',
      tenant_phone: (r.tenant_phone as string) ?? '',
      tenant_email: (r.tenant_email as string) ?? '',
      tenant_birth: (r.tenant_birth as string) ?? '',
      monthly_rent: String(r.monthly_rent ?? ''),
      deposit:      String(r.deposit ?? ''),
      lease_start:  (r.lease_start as string) ?? '',
      lease_end:    (r.lease_end as string)   ?? '',
      vat_type:     ((r.vat_type as 'VAT_INVOICE' | 'CASH_RECEIPT' | 'NONE') ?? 'NONE'),
    }))
  }

  /* 양식 생성 + 프린트 */
  const handleGenerateAndPrint = async () => {
    if (!form.room_id) return onError('호실을 선택해주세요.')
    if (!form.tenant_name) return onError('입주사 이름을 입력해주세요.')

    // 커스텀 업로드가 있으면 그 URL 사용
    const customUpload = selectedBuiltIn ? builtinUploads.find(u => u.template_key === selectedBuiltIn) : null
    if (customUpload) {
      setPreviewUrl(customUpload.template_url)
      printImages([customUpload.template_url])
      return
    }

    if (!selectedBuiltIn) return onError('양식을 선택해주세요.')
    const def = BUILTIN_TEMPLATE_DEFS.find(d => d.key === selectedBuiltIn)
    if (def?.uploadOnly) return onError('이 양식은 "내 양식 관리"에서 파일을 업로드해야 사용할 수 있습니다.')

    setGeneratingTemplate(true)
    try {
      const selectedRoom = rooms.find(r => r.id === form.room_id)
      const tplData: TemplateData = {
        tenant_name: form.tenant_name, tenant_phone: form.tenant_phone,
        tenant_birth: form.tenant_birth,
        address: form.address, monthly_rent: form.monthly_rent,
        deposit: form.deposit, lease_start: form.lease_start,
        lease_end: form.lease_end, special_terms: form.special_terms,
        room_name: selectedRoom?.name ?? '',
        vat_type: form.vat_type,
      }
      const pageBlobs = await generateTemplateImagePages(selectedBuiltIn, tplData)
      const urls = pageBlobs.map(b => URL.createObjectURL(b))
      setPreviewUrl(urls[0])
      printImages(urls)
    } catch (err) {
      onError(err instanceof Error ? err.message : '양식 생성 실패')
    } finally {
      setGeneratingTemplate(false)
    }
  }

  const printImages = (urls: string[]) => {
    const w = window.open('', '_blank')
    if (!w) return onError('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.')
    const total = urls.length
    const imgs = urls.map(u =>
      `<img src="${u}" onload="window.__loaded=(window.__loaded||0)+1; if(window.__loaded===${total}) setTimeout(()=>window.print(),300);" />`
    ).join('')
    w.document.write(`<!DOCTYPE html><html><head><title>계약서 인쇄</title><style>
      @page { size: A4; margin: 10mm; }
      @media print { html, body { margin: 0; } img { max-width: 100%; max-height: 270mm; height: auto; display: block; margin: 0 auto; page-break-after: always; } img:last-child { page-break-after: auto; } }
      body { margin: 0; }
      img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    </style></head><body>${imgs}</body></html>`)
    w.document.close()
  }

  /* 스캔 파일 선택 */
  const onPickScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

    for (const f of Array.from(files)) {
      if (!allowed.includes(f.type)) {
        onError('PDF 또는 이미지(JPG/PNG/WEBP) 파일만 업로드 가능합니다.')
        continue
      }
      if (f.size > 50 * 1024 * 1024) {
        onError('파일 크기는 50MB 이하여야 합니다.')
        continue
      }

      if (f.type === 'application/pdf') {
        setConvertingPdf(true)
        try {
          const { convertPdfToPngBlob } = await import('@/lib/pdf-to-image')
          const { blob } = await convertPdfToPngBlob(f)
          const pngFile = new File([blob], f.name.replace(/\.pdf$/i, '.png'), { type: 'image/png' })
          setScanFiles(prev => [...prev, pngFile])
          setScanPreviews(prev => [...prev, URL.createObjectURL(pngFile)])
        } catch {
          onError('PDF → 이미지 변환 실패')
        } finally {
          setConvertingPdf(false)
        }
      } else {
        const compressed = await compressImageFile(f)
        if (compressed.size < f.size) {
          const origMb = (f.size / 1024 / 1024).toFixed(1)
          const newMb  = (compressed.size / 1024 / 1024).toFixed(2)
          console.log(`📦 ${f.name} 압축: ${origMb}MB → ${newMb}MB`)
        }
        setScanFiles(prev => [...prev, compressed])
        setScanPreviews(prev => [...prev, URL.createObjectURL(compressed)])
      }
    }
    if (scanInputRef.current) scanInputRef.current.value = ''
  }

  const removeScan = (idx: number) => {
    URL.revokeObjectURL(scanPreviews[idx])
    setScanFiles(prev => prev.filter((_, i) => i !== idx))
    setScanPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  /* 저장 */
  const handleSave = async () => {
    if (!form.room_id) return onError('호실을 선택해주세요.')
    if (!form.tenant_name) return onError('입주사 이름을 입력해주세요.')
    if (scanFiles.length === 0) return onError('스캔한 계약서 이미지를 업로드해주세요.')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return onError('로그인이 필요합니다.') }

    try {
      // 스캔 파일들을 하나로 합치거나 첫 번째만 사용 (메인 template_url)
      // 여러 장이면 첫 번째를 template_url로, 나머지는 snapshot에 기록
      const uploadedUrls: string[] = []
      for (const f of scanFiles) {
        const ext = f.name.split('.').pop() || 'png'
        const path = `${user.id}/scan-${Date.now()}-${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('contract-templates')
          .upload(path, f, { contentType: f.type, cacheControl: '3600', upsert: false })
        if (upErr) throw new Error(`업로드 실패: ${upErr.message}`)
        const { data: pub } = supabase.storage.from('contract-templates').getPublicUrl(path)
        uploadedUrls.push(pub.publicUrl)
      }

      // 스냅샷 + 해시
      const snapshot = {
        ...form,
        scan_type: 'manual_scan',
        scan_urls: uploadedUrls,
        template_url: uploadedUrls[0],
        created_at: new Date().toISOString(),
        owner_id: user.id,
      }
      const hashStr = JSON.stringify(snapshot)
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashStr))
      const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

      const { error } = await supabase.from('contracts').insert({
        owner_id: user.id,
        room_id: form.room_id,
        tenant_name: form.tenant_name,
        tenant_phone: form.tenant_phone || null,
        tenant_email: form.tenant_email || null,
        address: form.address || null,
        monthly_rent: Number(form.monthly_rent) || 0,
        deposit: Number(form.deposit) || 0,
        lease_start: form.lease_start || null,
        lease_end: form.lease_end || null,
        special_terms: form.special_terms || null,
        status: 'signed',
        signed_at: new Date().toISOString(),
        content_hash: hashHex,
        contract_snapshot: snapshot,
        template_url: uploadedUrls[0],
        template_name: `수기계약서_${form.tenant_name}_스캔`,
        template_mime: 'image/png',
      })
      if (error) throw new Error(error.message)

      onCreated()
    } catch (err) {
      onError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  // cleanup
  useEffect(() => {
    return () => {
      scanPreviews.forEach(u => URL.revokeObjectURL(u))
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.4)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              <ScanLine size={18} /> 수기 계약서 스캔 업로드
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              계약서를 인쇄하고, 대면 서명 후 스캔하여 등록합니다.
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center gap-3 px-6 py-3" style={{ background: 'var(--color-background)' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                 style={{ background: step >= 1 ? 'var(--color-primary)' : 'var(--color-muted-bg)', color: step >= 1 ? 'white' : 'var(--color-muted)' }}>1</div>
            <span className="text-xs font-medium" style={{ color: step === 1 ? 'var(--color-primary)' : 'var(--color-muted)' }}>계약 정보 · 인쇄</span>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--color-muted)' }} />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                 style={{ background: step >= 2 ? 'var(--color-primary)' : 'var(--color-muted-bg)', color: step >= 2 ? 'white' : 'var(--color-muted)' }}>2</div>
            <span className="text-xs font-medium" style={{ color: step === 2 ? 'var(--color-primary)' : 'var(--color-muted)' }}>스캔 업로드 · 저장</span>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">

          {/* ─── STEP 1: 계약 정보 + 양식 선택 + 인쇄 ─── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* 호실 선택 */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>호실 선택 *</label>
                <select value={form.room_id} onChange={e => handleRoomSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}>
                  <option value="">호실을 선택하세요</option>
                  {[...rooms].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })).map(r => (
                    <option key={r.id} value={r.id}>{r.name} {(r as Room & Record<string, unknown>).tenant_name ? `(${(r as Room & Record<string, unknown>).tenant_name})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CField label="입주사 이름 *" value={form.tenant_name} onChange={set('tenant_name')} />
                <CField label="연락처" value={form.tenant_phone} onChange={set('tenant_phone')} type="tel" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CField label="생년월일" value={form.tenant_birth} onChange={set('tenant_birth')} type="date" />
                <CField label="이메일" value={form.tenant_email} onChange={set('tenant_email')} type="email" />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <CField label="소재지/호실주소" value={form.address} onChange={set('address')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CField label="월 이용료 (원)" value={form.monthly_rent} onChange={set('monthly_rent')} type="number" />
                <CField label="보증금 (원)" value={form.deposit} onChange={set('deposit')} type="number" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CField label="계약 시작일" value={form.lease_start} onChange={set('lease_start')} type="date" />
                <CField label="계약 만료일" value={form.lease_end} onChange={set('lease_end')} type="date" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>특약사항</label>
                <textarea value={form.special_terms} onChange={set('special_terms')} rows={3}
                  placeholder="계약 특약사항을 입력하세요..."
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }} />
              </div>

              {/* 양식 선택 */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-muted)' }}>인쇄할 계약서 양식</label>
                <div className="space-y-2">
                  {BUILTIN_TEMPLATE_DEFS.map(def => {
                    const hasCustom = builtinUploads.some(u => u.template_key === def.key)
                    const isUploadOnly = def.uploadOnly && !hasCustom
                    return (
                      <button key={def.key} type="button"
                        onClick={() => { if (!isUploadOnly) setSelectedBuiltIn(def.key === selectedBuiltIn ? null : def.key) }}
                        className="w-full text-left px-3 py-2.5 rounded-lg border transition-all"
                        style={{
                          borderColor: selectedBuiltIn === def.key ? def.color : 'var(--color-border)',
                          background: selectedBuiltIn === def.key ? `${def.color}08` : 'var(--color-background)',
                          opacity: isUploadOnly ? 0.5 : 1,
                        }}>
                        <div className="flex items-center gap-2">
                          <FileText size={14} style={{ color: selectedBuiltIn === def.key ? def.color : 'var(--color-muted)' }} />
                          <span className="text-xs font-semibold" style={{ color: selectedBuiltIn === def.key ? def.color : 'var(--color-text)' }}>{def.name}</span>
                          {hasCustom && <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: `${def.color}20`, color: def.color }}>커스텀</span>}
                          {isUploadOnly && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>미등록</span>}
                          {selectedBuiltIn === def.key && <CheckCircle2 size={14} style={{ color: def.color }} className="ml-auto" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 미리보기 (생성된 경우) */}
              {previewUrl && (
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--color-muted-bg)' }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>양식 미리보기</span>
                    <button onClick={() => printImages([previewUrl])} className="text-xs flex items-center gap-1" style={{ color: 'var(--color-accent-dark)' }}>
                      <Printer size={12} /> 다시 인쇄
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="계약서 미리보기" className="w-full" />
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 2: 스캔 업로드 ─── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* 안내 */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(168,218,220,0.12)', border: '1px solid rgba(168,218,220,0.3)' }}>
                <div className="flex items-start gap-3">
                  <Camera size={20} style={{ color: 'var(--color-accent-dark)' }} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>서명이 완료된 계약서를 업로드하세요</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                      인쇄한 계약서에 대면 서명을 받은 후, 스캔하거나 사진을 촬영하여 업로드합니다.<br />
                      여러 페이지인 경우 여러 장을 업로드할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 계약 요약 */}
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: 'var(--color-background)' }}>
                <div className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary)' }}>계약 정보 요약</div>
                {[
                  { l: '호실', v: rooms.find(r => r.id === form.room_id)?.name },
                  { l: '입주사', v: form.tenant_name },
                  { l: '월 이용료', v: form.monthly_rent ? `${Number(form.monthly_rent).toLocaleString()}원` : '' },
                  { l: '계약기간', v: form.lease_start && form.lease_end ? `${form.lease_start} ~ ${form.lease_end}` : '' },
                ].filter(r => r.v).map(r => (
                  <div key={r.l} className="flex gap-2 text-xs">
                    <span className="w-16 shrink-0 font-medium" style={{ color: 'var(--color-muted)' }}>{r.l}</span>
                    <span style={{ color: 'var(--color-text)' }}>{r.v}</span>
                  </div>
                ))}
              </div>

              {/* 파일 업로드 영역 */}
              <div>
                <input ref={scanInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                  multiple onChange={onPickScan} className="hidden" />

                {convertingPdf && (
                  <div className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed text-sm mb-3"
                       style={{ borderColor: 'var(--color-accent-dark)', background: 'rgba(168,218,220,0.12)', color: 'var(--color-accent-dark)' }}>
                    <Loader2 size={14} className="animate-spin" /> PDF 변환 중...
                  </div>
                )}

                {/* 업로드된 이미지 미리보기 */}
                {scanPreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {scanPreviews.map((url, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`스캔 ${idx + 1}`} className="w-full h-40 object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <button onClick={() => removeScan(idx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full bg-white/90 shadow-lg"
                            style={{ color: 'var(--color-danger)' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="absolute bottom-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white">
                          {idx + 1}p
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button type="button" onClick={() => scanInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed text-sm font-medium transition-all"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'var(--color-background)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent-dark)'; e.currentTarget.style.color = 'var(--color-accent-dark)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-muted)' }}>
                  <ImageIcon size={18} />
                  {scanFiles.length === 0 ? '스캔 이미지 선택 (클릭 또는 드래그)' : '이미지 추가'}
                </button>
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-muted)' }}>
                  JPG, PNG, WEBP, PDF 지원 · 최대 50MB · 여러 장 선택 가능
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {step === 1 ? (
            <>
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>취소</button>
              <button onClick={handleGenerateAndPrint} disabled={generatingTemplate}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'var(--color-accent-dark)' }}>
                {generatingTemplate ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                {generatingTemplate ? '양식 생성 중...' : '양식 생성 · 인쇄'}
              </button>
              <button onClick={() => { if (!form.room_id || !form.tenant_name) return onError('호실과 입주사를 입력해주세요.'); setStep(2) }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ background: 'var(--color-primary)' }}>
                다음 <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)}
                className="py-2.5 px-4 rounded-lg text-sm font-medium border flex items-center gap-1"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                <ArrowLeft size={14} /> 이전
              </button>
              <div className="flex-1" />
              <button onClick={handleSave} disabled={saving || scanFiles.length === 0}
                className="py-2.5 px-6 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {saving ? '저장 중...' : `계약서 등록 (${scanFiles.length}장)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── 간편 업로드 모달 (이미 서명된 종이 계약서 → 스캔만 업로드) ─── */
function QuickScanUploadModal({
  rooms, existingContract, onClose, onCreated, onError,
}: {
  rooms: Room[]
  existingContract?: ContractWithRoom | null
  onClose: () => void
  onCreated: () => void
  onError: (msg: string) => void
}) {
  const supabase = createClient()
  const scanInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    room_id:      existingContract?.room_id ?? '',
    tenant_name:  existingContract?.tenant_name ?? existingContract?.room?.tenant_name ?? '',
    tenant_phone: existingContract?.tenant_phone ?? existingContract?.room?.tenant_phone ?? '',
    tenant_email: existingContract?.tenant_email ?? existingContract?.room?.tenant_email ?? '',
    tenant_birth: '',
    monthly_rent: existingContract?.monthly_rent ? String(existingContract.monthly_rent) : '',
    deposit:      existingContract?.deposit      ? String(existingContract.deposit)      : '',
    lease_start:  existingContract?.lease_start ?? '',
    lease_end:    existingContract?.lease_end ?? '',
  })
  const [scanFiles, setScanFiles] = useState<File[]>([])
  const [scanPreviews, setScanPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [convertingPdf, setConvertingPdf] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleRoomSelect = (roomId: string) => {
    const r = rooms.find(r => r.id === roomId) as Room & Record<string, unknown> | undefined
    if (!r) return
    setForm(prev => ({
      ...prev,
      room_id: roomId,
      tenant_name:  (r.tenant_name as string)  ?? prev.tenant_name,
      tenant_phone: (r.tenant_phone as string) ?? prev.tenant_phone,
      tenant_email: (r.tenant_email as string) ?? prev.tenant_email,
      tenant_birth: (r.tenant_birth as string) ?? prev.tenant_birth,
      monthly_rent: r.monthly_rent ? String(r.monthly_rent) : prev.monthly_rent,
      deposit:      r.deposit      ? String(r.deposit)      : prev.deposit,
      lease_start:  (r.lease_start as string) ?? prev.lease_start,
      lease_end:    (r.lease_end as string)   ?? prev.lease_end,
    }))
  }

  const onPickScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

    for (const f of Array.from(files)) {
      if (!allowed.includes(f.type)) { onError('PDF 또는 이미지(JPG/PNG/WEBP) 파일만 업로드 가능합니다.'); continue }
      if (f.size > 50 * 1024 * 1024) { onError('파일 크기는 50MB 이하여야 합니다.'); continue }

      if (f.type === 'application/pdf') {
        setConvertingPdf(true)
        try {
          const { convertPdfToPngBlob } = await import('@/lib/pdf-to-image')
          const { blob } = await convertPdfToPngBlob(f)
          const pngFile = new File([blob], f.name.replace(/\.pdf$/i, '.png'), { type: 'image/png' })
          setScanFiles(prev => [...prev, pngFile])
          setScanPreviews(prev => [...prev, URL.createObjectURL(pngFile)])
        } catch {
          onError('PDF → 이미지 변환 실패')
        } finally {
          setConvertingPdf(false)
        }
      } else {
        const compressed = await compressImageFile(f)
        if (compressed.size < f.size) {
          const origMb = (f.size / 1024 / 1024).toFixed(1)
          const newMb  = (compressed.size / 1024 / 1024).toFixed(2)
          console.log(`📦 ${f.name} 압축: ${origMb}MB → ${newMb}MB`)
        }
        setScanFiles(prev => [...prev, compressed])
        setScanPreviews(prev => [...prev, URL.createObjectURL(compressed)])
      }
    }
    if (scanInputRef.current) scanInputRef.current.value = ''
  }

  const removeScan = (idx: number) => {
    URL.revokeObjectURL(scanPreviews[idx])
    setScanFiles(prev => prev.filter((_, i) => i !== idx))
    setScanPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!form.room_id) return onError('호실을 선택해주세요.')
    if (!form.tenant_name) return onError('입주사 이름을 입력해주세요.')
    if (scanFiles.length === 0) return onError('스캔 이미지를 업로드해주세요.')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return onError('로그인이 필요합니다.') }

    try {
      const uploadedUrls: string[] = []
      for (const f of scanFiles) {
        const ext = f.name.split('.').pop() || 'png'
        const path = `${user.id}/quick-scan-${Date.now()}-${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('contract-templates')
          .upload(path, f, { contentType: f.type, cacheControl: '3600', upsert: false })
        if (upErr) throw new Error(`업로드 실패: ${upErr.message}`)
        const { data: pub } = supabase.storage.from('contract-templates').getPublicUrl(path)
        uploadedUrls.push(pub.publicUrl)
      }

      const snapshot = {
        ...form,
        scan_type: 'quick_upload',
        scan_urls: uploadedUrls,
        template_url: uploadedUrls[0],
        created_at: new Date().toISOString(),
        owner_id: user.id,
      }
      const hashStr = JSON.stringify(snapshot)
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashStr))
      const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

      if (existingContract) {
        // 기존 계약 업데이트
        const { error } = await supabase.from('contracts').update({
          tenant_name: form.tenant_name,
          tenant_phone: form.tenant_phone || null,
          tenant_email: form.tenant_email || null,
          monthly_rent: Number(form.monthly_rent) || 0,
          deposit: Number(form.deposit) || 0,
          lease_start: form.lease_start || null,
          lease_end: form.lease_end || null,
          status: 'signed',
          signed_at: new Date().toISOString(),
          content_hash: hashHex,
          contract_snapshot: snapshot,
          template_url: uploadedUrls[0],
          template_name: `서면계약_${form.tenant_name}_바로업로드`,
          template_mime: 'image/png',
        }).eq('id', existingContract.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('contracts').insert({
          owner_id: user.id,
          room_id: form.room_id,
          tenant_name: form.tenant_name,
          tenant_phone: form.tenant_phone || null,
          tenant_email: form.tenant_email || null,
          monthly_rent: Number(form.monthly_rent) || 0,
          deposit: Number(form.deposit) || 0,
          lease_start: form.lease_start || null,
          lease_end: form.lease_end || null,
          status: 'signed',
          signed_at: new Date().toISOString(),
          content_hash: hashHex,
          contract_snapshot: snapshot,
          template_url: uploadedUrls[0],
          template_name: `서면계약_${form.tenant_name}_바로업로드`,
          template_mime: 'image/png',
        })
        if (error) throw new Error(error.message)
      }

      onCreated()
    } catch (err) {
      onError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    return () => { scanPreviews.forEach(u => URL.revokeObjectURL(u)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.4)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden"
           style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
              <Upload size={18} /> {existingContract
                ? `${existingContract.room?.name ?? ''} ${form.tenant_name || ''} — 서면 서명본 업로드`.trim()
                : '서명된 계약서 바로 업로드'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {existingContract
                ? '이미 인쇄·서명된 종이 계약서를 스캔하여 이 계약 건에 첨부합니다. 상태가 "서명완료"로 자동 변경됩니다.'
                : '이미 인쇄·서명된 종이 계약서를 스캔 또는 촬영해 등록합니다. (인쇄 단계 생략)'}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4">
          {/* 호실 선택 */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>호실 선택 *</label>
            <select value={form.room_id} onChange={e => handleRoomSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}>
              <option value="">호실을 선택하세요</option>
              {[...rooms].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })).map(r => (
                <option key={r.id} value={r.id}>{r.name} {(r as Room & Record<string, unknown>).tenant_name ? `(${(r as Room & Record<string, unknown>).tenant_name})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CField label="입주사 이름 *" value={form.tenant_name} onChange={set('tenant_name')} />
            <CField label="연락처" value={form.tenant_phone} onChange={set('tenant_phone')} type="tel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="생년월일" value={form.tenant_birth} onChange={set('tenant_birth')} type="date" />
            <CField label="이메일" value={form.tenant_email} onChange={set('tenant_email')} type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="월 이용료 (원)" value={form.monthly_rent} onChange={set('monthly_rent')} type="number" />
            <CField label="보증금/예치금 (원)" value={form.deposit} onChange={set('deposit')} type="number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CField label="계약 시작일" value={form.lease_start} onChange={set('lease_start')} type="date" />
            <CField label="계약 만료일" value={form.lease_end} onChange={set('lease_end')} type="date" />
          </div>

          {/* 스캔 이미지 */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-muted)' }}>
              서명된 계약서 스캔 / 사진 *
            </label>

            {scanPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {scanPreviews.map((url, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`스캔 ${idx + 1}`} className="w-full h-32 object-cover" />
                    <button onClick={() => removeScan(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-white"
                      style={{ background: 'rgba(0,0,0,0.6)' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input ref={scanInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
              multiple onChange={onPickScan} className="hidden" />
            <button onClick={() => scanInputRef.current?.click()} disabled={convertingPdf}
              className="w-full py-3 rounded-lg border-2 border-dashed text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ borderColor: 'var(--color-accent-dark)', color: 'var(--color-accent-dark)', background: 'rgba(168,218,220,0.06)' }}>
              {convertingPdf ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              {convertingPdf ? 'PDF 변환 중...' :
                scanFiles.length === 0 ? '이미지 / PDF 선택 (여러 장 가능)' : '이미지 추가'}
            </button>
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-muted)' }}>
              PDF는 자동으로 PNG로 변환됩니다. JPG · PNG · WEBP 지원, 50MB 이하.
            </p>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>취소</button>
          <button onClick={handleSave} disabled={saving || scanFiles.length === 0 || !form.room_id || !form.tenant_name}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {saving ? '저장 중...' : `계약서 등록${scanFiles.length > 0 ? ` (${scanFiles.length}장)` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
