'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, Home, AlertCircle, CheckCircle2,
  Phone, MessageSquare, FileText, X, Loader2, Upload, FileSpreadsheet,
  Sparkles, Send, ChevronRight, Users,
} from 'lucide-react'
import { formatKRW, formatPhone, formatDate } from '@/lib/utils'
import type { Room, RoomStatus, Tenant } from '@/types'
import * as XLSX from 'xlsx'

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

/* ─── 엑셀 컬럼 → 필드 매핑 ─── */
const COL_MAP: Record<string, string> = {
  '호실명': 'name', '호실': 'name',
  '세입자': 'tenant_name', '입주사': 'tenant_name', '세입자이름': 'tenant_name', '입주사명': 'tenant_name',
  '연락처': 'tenant_phone', '전화번호': 'tenant_phone', '핸드폰': 'tenant_phone',
  '이메일': 'tenant_email', 'email': 'tenant_email',
  '월세': 'monthly_rent', '임대료': 'monthly_rent', '월임대료': 'monthly_rent',
  '보증금': 'deposit',
  '납부일': 'payment_day', '정기납부일': 'payment_day', '납부기일': 'payment_day',
  '계약시작': 'lease_start', '계약시작일': 'lease_start', '입주일': 'lease_start',
  '계약만료': 'lease_end', '계약만료일': 'lease_end', '계약종료일': 'lease_end',
  '상태': 'status',
  '메모': 'memo', '비고': 'memo',
}

type ImportRow = {
  name: string; tenant_name: string; tenant_phone: string; tenant_email: string
  monthly_rent: string; deposit: string; payment_day: string
  lease_start: string; lease_end: string; status: string; memo: string
  _error?: string
}

type ReviewIssue = {
  rowIndex: number
  field: string
  level: 'warning' | 'info'
  message: string
  fixValue?: string
}

type ChatMessage = {
  role: 'user' | 'ai'
  text: string
}

function parseStatus(val: string): RoomStatus {
  const v = String(val ?? '').trim()
  if (/납부완료|paid/i.test(v))  return 'PAID'
  if (/미납|unpaid/i.test(v))    return 'UNPAID'
  return 'VACANT'
}

function parseDate(val: unknown): string {
  if (!val) return ''
  // Excel serial date number
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  const s = String(val).trim()
  // YYYY-MM-DD or YYYY/MM/DD or YYYYMMDD
  const m = s.match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return s
}

/* ─── 엑셀 가져오기 모달 (AI 검토 포함) ─── */
function ExcelImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const supabase    = createClient()
  const fileRef     = useRef<HTMLInputElement>(null)
  const chatEndRef  = useRef<HTMLDivElement>(null)

  const [rows,     setRows]     = useState<ImportRow[]>([])
  const [issues,   setIssues]   = useState<ReviewIssue[]>([])
  const [chat,     setChat]     = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result,   setResult]   = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  // AI 검토 호출
  async function runAiReview(currentRows: ImportRow[], message?: string) {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/review-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: currentRows, message }),
      })
      const data = await res.json()
      setIssues(data.issues ?? [])
      if (data.reply) {
        setChat(prev => [...prev, { role: 'ai', text: data.reply }])
      }
    } finally {
      setAiLoading(false)
    }
  }

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
          tenant_name:  r['tenant_name']  ?? '',
          tenant_phone: (r['tenant_phone'] ?? '').replace(/[-\s]/g, ''),
          tenant_email: r['tenant_email'] ?? '',
          monthly_rent: r['monthly_rent'] ?? '',
          deposit:      r['deposit']      ?? '',
          payment_day:  r['payment_day']  ?? '10',
          lease_start:  parseDate(r['lease_start']),
          lease_end:    parseDate(r['lease_end']),
          status:       r['status']  ?? '',
          memo:         r['memo']    ?? '',
          _error: !name ? `${idx + 2}행: 호실명 없음` : undefined,
        }
      })
      setRows(parsed)
      setIssues([])
      setChat([])
      runAiReview(parsed)
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

  // AI 제안값을 해당 행에 적용
  function applyFix(issue: ReviewIssue) {
    if (issue.fixValue === undefined) return
    setRows(prev => prev.map((r, i) =>
      i === issue.rowIndex ? { ...r, [issue.field]: issue.fixValue! } : r
    ))
    setIssues(prev => prev.filter(iss => iss !== issue))
  }

  // 채팅 메시지 전송
  async function sendChat() {
    const msg = chatInput.trim(); if (!msg) return
    setChatInput('')
    setChat(prev => [...prev, { role: 'user', text: msg }])
    await runAiReview(rows, msg)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function handleImport() {
    const valid = rows.filter(r => !r._error && r.name)
    if (!valid.length) return
    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }

    const payload = valid.map(r => ({
      owner_id:     user.id,
      name:         r.name,
      status:       parseStatus(r.status),
      tenant_name:  r.tenant_name  || null,
      tenant_phone: r.tenant_phone || null,
      tenant_email: r.tenant_email || null,
      monthly_rent: Number(r.monthly_rent.replace(/,/g, '')) || 0,
      deposit:      Number(r.deposit.replace(/,/g, ''))      || 0,
      payment_day:  Number(r.payment_day) || 10,
      lease_start:  r.lease_start || null,
      lease_end:    r.lease_end   || null,
      memo:         r.memo        || null,
    }))

    const { error } = await supabase.from('rooms').insert(payload)
    setImporting(false)
    if (error) { setResult(`오류: ${error.message}`); return }
    setResult(`${payload.length}개 호실이 등록되었습니다.`)
    setTimeout(() => { onImported(); onClose() }, 1500)
  }

  const validCount  = rows.filter(r => !r._error && r.name).length
  const errorCount  = rows.filter(r => !!r._error).length
  const warnCount   = issues.filter(i => i.level === 'warning').length
  const hasRows     = rows.length > 0

  const FIELD_LABEL: Record<string, string> = {
    name: '호실명', tenant_name: '세입자', tenant_phone: '연락처',
    tenant_email: '이메일', monthly_rent: '월세', deposit: '보증금',
    payment_day: '납부일', lease_start: '계약시작', lease_end: '계약만료',
    status: '상태', memo: '메모',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col"
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
          {/* 양식 안내 (파일 없을 때만) */}
          {!hasRows && (
            <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>엑셀 컬럼 형식 (첫 행이 헤더)</p>
              <p>필수: <strong>호실명</strong></p>
              <p>선택: 세입자, 연락처, 이메일, 월세, 보증금, 납부일(기본 10), 계약시작일, 계약만료일, 상태(납부완료/미납/공실), 메모</p>
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
                  {warnCount  > 0 && <span style={{ color: 'var(--color-warning, #f59e0b)' }}>⚠ {warnCount}개 확인 필요</span>}
                </div>
                <button onClick={() => { setRows([]); setIssues([]); setChat([]); setResult(null) }}
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
                        {['호실명','세입자','연락처','월세','납부일','상태','메모'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--color-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const rowIssues = issues.filter(iss => iss.rowIndex === i)
                        const hasWarn   = rowIssues.some(iss => iss.level === 'warning')
                        const hasInfo   = rowIssues.some(iss => iss.level === 'info')
                        const bg = row._error  ? 'var(--color-danger-bg)'
                                 : hasWarn     ? 'rgba(245,158,11,0.07)'
                                 : hasInfo     ? 'rgba(59,130,246,0.05)'
                                 : 'transparent'
                        return (
                          <tr key={i} style={{ borderTop: '1px solid var(--color-border)', background: bg }}>
                            <td className="px-3 py-2 font-medium" style={{ color: row._error ? 'var(--color-danger)' : 'var(--color-text)' }}>
                              {row.name || <span style={{ color: 'var(--color-danger)' }}>—</span>}
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--color-muted)' }}>{row.tenant_name || '—'}</td>
                            <td className="px-3 py-2" style={{ color: 'var(--color-muted)' }}>{row.tenant_phone || '—'}</td>
                            <td className="px-3 py-2 tabular" style={{ color: 'var(--color-muted)' }}>{row.monthly_rent || '—'}</td>
                            <td className="px-3 py-2" style={{ color: 'var(--color-muted)' }}>{row.payment_day || '10'}</td>
                            <td className="px-3 py-2" style={{ color: 'var(--color-muted)' }}>
                              {parseStatus(row.status)}
                            </td>
                            <td className="px-3 py-2 max-w-[120px] truncate" style={{ color: 'var(--color-muted)' }}>{row.memo || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI 검토 패널 */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                {/* AI 패널 헤더 */}
                <div className="flex items-center gap-2 px-4 py-3 border-b"
                     style={{ background: 'rgba(29,53,87,0.04)', borderColor: 'var(--color-border)' }}>
                  <Sparkles size={15} style={{ color: 'var(--color-primary)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>AI 검토</span>
                  {aiLoading && <Loader2 size={13} className="animate-spin ml-1" style={{ color: 'var(--color-muted)' }} />}
                  {!aiLoading && issues.length === 0 && chat.length === 0 && (
                    <span className="text-xs ml-1" style={{ color: 'var(--color-success)' }}>이상 없음</span>
                  )}
                  {!aiLoading && issues.length > 0 && (
                    <span className="text-xs ml-1" style={{ color: 'var(--color-muted)' }}>
                      {issues.length}개 항목 확인 필요
                    </span>
                  )}
                </div>

                {/* 이슈 목록 */}
                {issues.length > 0 && (
                  <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {issues.map((iss, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3">
                        <span className="mt-0.5 shrink-0 text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{
                                background: iss.level === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.1)',
                                color:      iss.level === 'warning' ? '#d97706' : '#3b82f6',
                              }}>
                          {rows[iss.rowIndex]?.name || `${iss.rowIndex+1}행`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs" style={{ color: 'var(--color-text)' }}>
                            <span className="font-medium" style={{ color: 'var(--color-muted)' }}>
                              {FIELD_LABEL[iss.field] ?? iss.field}
                            </span>
                            {' · '}
                            {iss.message}
                          </p>
                          {iss.fixValue !== undefined && (
                            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-muted)' }}>
                              <ChevronRight size={11} />
                              제안: <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                                {iss.fixValue || '(비우기)'}
                              </span>
                            </p>
                          )}
                        </div>
                        {iss.fixValue !== undefined && (
                          <button
                            onClick={() => applyFix(iss)}
                            className="shrink-0 text-xs px-2.5 py-1 rounded-lg font-medium"
                            style={{ background: 'var(--color-primary)', color: '#fff' }}>
                            적용
                          </button>
                        )}
                        <button
                          onClick={() => setIssues(prev => prev.filter((_, j) => j !== i))}
                          className="shrink-0 p-1 rounded" style={{ color: 'var(--color-muted)' }}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 채팅 메시지 */}
                {chat.length > 0 && (
                  <div className="px-4 py-3 space-y-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    {chat.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'ai' && (
                          <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                               style={{ background: 'rgba(29,53,87,0.1)' }}>
                            <Sparkles size={11} style={{ color: 'var(--color-primary)' }} />
                          </div>
                        )}
                        <div className="max-w-[80%] px-3 py-2 rounded-xl text-xs"
                             style={{
                               background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-muted-bg)',
                               color:      msg.role === 'user' ? '#fff' : 'var(--color-text)',
                             }}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}

                {/* 채팅 입력 */}
                <div className="flex gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                    placeholder="AI에게 질문하거나 수정 요청 (예: 235호 연락처는 010-1234-5678이야)"
                    className="flex-1 px-3 py-2 rounded-lg border text-xs outline-none"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                    disabled={aiLoading}
                  />
                  <button
                    onClick={sendChat}
                    disabled={aiLoading || !chatInput.trim()}
                    className="p-2 rounded-lg disabled:opacity-40"
                    style={{ background: 'var(--color-primary)', color: '#fff' }}>
                    {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
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

/* ─── 호실 추가/수정 모달 ─── */
/* ─── 입주사 이력 모달 ─── */
function TenantHistoryModal({ room, onClose }: { room: Room; onClose: () => void }) {
  const supabase = createClient()
  const [tenants, setTenants]   = useState<Tenant[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState({
    name:         '',
    phone:        '',
    email:        '',
    monthly_rent: String(room.monthly_rent || ''),
    deposit:      String(room.deposit || ''),
    lease_start:  new Date().toISOString().split('T')[0],
    lease_end:    '',
    memo:         '',
  })

  const loadTenants = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
    setTenants(data || [])
    setLoading(false)
  }, [supabase, room.id])

  useEffect(() => { setTimeout(() => loadTenants(), 0) }, [loadTenants])

  const activeTenant = tenants.find(t => !t.lease_end)
  const pastTenants  = tenants.filter(t => !!t.lease_end)

  async function handleEvict(tenant: Tenant) {
    if (!confirm(`${tenant.name}님을 오늘 날짜로 퇴실 처리하시겠습니까?`)) return
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('tenants').update({ lease_end: today }).eq('id', tenant.id)
    await supabase.from('rooms').update({ status: 'VACANT' }).eq('id', room.id)
    loadTenants()
  }

  async function handleSaveNew() {
    if (!form.name) { setError('이름을 입력해주세요.'); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const today = new Date().toISOString().split('T')[0]

    // 기존 활성 입주사 퇴실 처리
    if (activeTenant) {
      await supabase.from('tenants')
        .update({ lease_end: form.lease_start || today })
        .eq('id', activeTenant.id)
    }

    // 신규 입주사 INSERT
    await supabase.from('tenants').insert({
      owner_id:     user.id,
      room_id:      room.id,
      name:         form.name,
      phone:        form.phone        || null,
      email:        form.email        || null,
      monthly_rent: Number(form.monthly_rent) || 0,
      deposit:      Number(form.deposit)       || 0,
      lease_start:  form.lease_start  || null,
      lease_end:    form.lease_end    || null,
      memo:         form.memo         || null,
    })

    // rooms 캐시 업데이트
    await supabase.from('rooms').update({
      tenant_name:  form.name,
      tenant_phone: form.phone  || null,
      tenant_email: form.email  || null,
      monthly_rent: Number(form.monthly_rent) || 0,
      deposit:      Number(form.deposit)       || 0,
      lease_start:  form.lease_start || null,
      lease_end:    form.lease_end   || null,
      status:       'UNPAID',
    }).eq('id', room.id)

    setSaving(false)
    setShowForm(false)
    setForm({ name: '', phone: '', email: '', monthly_rent: String(room.monthly_rent || ''), deposit: String(room.deposit || ''), lease_start: today, lease_end: '', memo: '' })
    loadTenants()
  }

  const inputSty = { borderColor: 'var(--color-border)', background: 'var(--color-surface)' }

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
              전체 {tenants.length}명
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
                {activeTenant ? (
                  <div className="rounded-xl p-4 border" style={{ borderColor: 'var(--color-primary)', background: 'rgba(29,53,87,0.04)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{activeTenant.name}</p>
                        {activeTenant.phone && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{formatPhone(activeTenant.phone)}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                          {activeTenant.lease_start && <span>입주 {formatDate(activeTenant.lease_start)}</span>}
                          {activeTenant.lease_end   && <span>만료 {formatDate(activeTenant.lease_end)}</span>}
                          <span>{formatKRW(activeTenant.monthly_rent)}/월</span>
                          {activeTenant.deposit > 0 && <span>보증금 {formatKRW(activeTenant.deposit)}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleEvict(activeTenant)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border shrink-0"
                        style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                        퇴실 처리
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 text-center text-sm" style={{ color: 'var(--color-muted)', background: 'var(--color-muted-bg)' }}>
                    현재 입주사가 없습니다
                  </div>
                )}
              </div>

              {/* 신규 입주 폼 또는 버튼 */}
              {showForm ? (
                <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>신규 입주 등록</p>
                  {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>이름 *</label>
                      <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="홍길동" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>연락처</label>
                      <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="01012345678" type="tel" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>월세 (원)</label>
                      <input value={form.monthly_rent} onChange={e => setForm(p => ({ ...p, monthly_rent: e.target.value }))}
                        type="number" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>보증금 (원)</label>
                      <input value={form.deposit} onChange={e => setForm(p => ({ ...p, deposit: e.target.value }))}
                        type="number" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>입주일</label>
                      <input value={form.lease_start} onChange={e => setForm(p => ({ ...p, lease_start: e.target.value }))}
                        type="date" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>계약 만료일</label>
                      <input value={form.lease_end} onChange={e => setForm(p => ({ ...p, lease_end: e.target.value }))}
                        type="date" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>메모</label>
                    <input value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
                      placeholder="특이사항..." className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
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
                  <Plus size={15} /> 신규 입주 등록
                </button>
              )}

              {/* 과거 입주사 이력 */}
              {pastTenants.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>이전 입주사 ({pastTenants.length}명)</p>
                  <div className="space-y-2">
                    {pastTenants.map(t => (
                      <div key={t.id} className="rounded-xl p-3 border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-muted-bg)' }}>
                        <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{t.name}</p>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                          {t.lease_start && <span>{formatDate(t.lease_start)}</span>}
                          {t.lease_end   && <span>~ {formatDate(t.lease_end)}</span>}
                          <span>{formatKRW(t.monthly_rent)}/월</span>
                          {t.deposit > 0 && <span>보증금 {formatKRW(t.deposit)}</span>}
                        </div>
                      </div>
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
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [aiChecking, setAiChecking] = useState(false)
  const [aiIssues,   setAiIssues]   = useState<ReviewIssue[] | null>(null)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }))
    setAiIssues(null) // 수정 시 이슈 패널 닫기
  }

  async function doSave() {
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

    if (room) {
      // 기존 호실 수정: rooms만 업데이트 (입주사 이력은 입주사 이력 모달에서 관리)
      const { error: err } = await supabase.from('rooms').update(payload).eq('id', room.id)
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      // 신규 호실 추가
      const { data: newRoom, error: err } = await supabase
        .from('rooms')
        .insert({ ...payload, owner_id: user.id })
        .select('id')
        .single()
      if (err || !newRoom) { setError(err?.message ?? '추가 실패'); setLoading(false); return }

      // 입주사 정보가 있으면 tenants 테이블에도 추가
      if (form.tenant_name) {
        await supabase.from('tenants').insert({
          owner_id:     user.id,
          room_id:      newRoom.id,
          name:         form.tenant_name,
          phone:        form.tenant_phone || null,
          email:        form.tenant_email || null,
          monthly_rent: Number(form.monthly_rent) || 0,
          deposit:      Number(form.deposit)       || 0,
          lease_start:  form.lease_start  || null,
          lease_end:    form.lease_end    || null,
          memo:         form.memo         || null,
        })
      }
    }
    onSaved()
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name) return setError('호실명을 입력해주세요.')
    setError('')

    // AI 검토 (이미 경고 확인 후 강제 저장 상태면 바로 저장)
    setAiChecking(true)
    try {
      const res = await fetch('/api/ai/review-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ ...form, rowIndex: 0 }] }),
      })
      const data = await res.json()
      const issues: ReviewIssue[] = data.issues ?? []
      if (issues.length > 0) {
        setAiIssues(issues)
        setAiChecking(false)
        return // 이슈 있으면 저장 중단, 패널 표시
      }
    } catch {
      // AI 오류 시 그냥 저장 진행
    }
    setAiChecking(false)
    await doSave()
  }

  const FIELD_LABEL: Record<string, string> = {
    name: '호실명', tenant_name: '세입자', tenant_phone: '연락처',
    tenant_email: '이메일', monthly_rent: '월세', deposit: '보증금',
    payment_day: '납부일', lease_start: '계약시작', lease_end: '계약만료',
    status: '상태', memo: '메모',
  }

  const inputSty = { borderColor: 'var(--color-border)', background: 'var(--color-surface)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
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

          {/* AI 이슈 패널 */}
          {aiIssues && aiIssues.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.04)' }}>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
                <Sparkles size={13} style={{ color: '#d97706' }} />
                <span className="text-xs font-semibold" style={{ color: '#d97706' }}>AI 검토 결과 — 확인이 필요한 항목이 있습니다</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
                {aiIssues.map((iss, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="mt-0.5 shrink-0 text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background: iss.level === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.1)',
                            color:      iss.level === 'warning' ? '#d97706' : '#3b82f6',
                          }}>
                      {FIELD_LABEL[iss.field] ?? iss.field}
                    </span>
                    <p className="text-xs flex-1" style={{ color: 'var(--color-text)' }}>{iss.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>취소</button>

          {aiIssues && aiIssues.length > 0 ? (
            <>
              <button type="button" onClick={() => setAiIssues(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                수정하기
              </button>
              <button type="button" onClick={doSave} disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: '#d97706' }}>
                {loading && <Loader2 size={14} className="animate-spin" />}
                그래도 저장
              </button>
            </>
          ) : (
            <button type="button" onClick={handleSave} disabled={loading || aiChecking}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: 'var(--color-primary)' }}>
              {(loading || aiChecking) && <Loader2 size={14} className="animate-spin" />}
              {aiChecking ? 'AI 검토 중...' : room ? '저장' : '추가'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── 메인 페이지 ─── */
const _NOW_MS = Date.now()
function UnitsContent() {
  const supabase = useMemo(() => createClient(), [])
  const [rooms, setRooms]         = useState<Room[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<FilterStatus>('ALL')
  const [search, setSearch]       = useState('')
  const [modal, setModal]         = useState<{ open: boolean; room?: Room | null }>({ open: false })
  const [importOpen, setImportOpen] = useState(false)
  const [toast, setToast]         = useState<string | null>(null)
  const [tenantHistRoom, setTenantHistRoom] = useState<Room | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('rooms').select('*').eq('owner_id', user.id).order('name')
    setRooms(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { setTimeout(() => load(), 0) }, [load])

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
    const diff = Math.ceil((new Date(dateStr).getTime() - _NOW_MS) / 86400000)
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
                        <button onClick={() => setTenantHistRoom(room)}
                          className="p-1.5 rounded-lg"
                          style={{ background: 'rgba(29,53,87,0.08)', color: 'var(--color-primary)' }}
                          title="입주사 이력">
                          <Users size={13} />
                        </button>
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
