'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, Download, Search, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, FileSpreadsheet, X, CreditCard, Building2, Copy, Pencil, RotateCcw, Trash2,
  GitMerge, Eye, AlertTriangle, MessageSquare, Sparkles, Split, Calendar, Send, Link2, ChevronDown,
} from 'lucide-react'
import { formatKRW, formatDate } from '@/lib/utils'
import { deductPrepayForInvoice, addPrepayCredit, getPrepayBalance } from '@/lib/prepay'
import type { Invoice, Room } from '@/types'

/* ─── leases + tenants 조인 결과 타입 ─── */
interface ActiveLease {
  id:           string
  room_id:      string
  monthly_rent: number
  lease_start:  string
  lease_end:    string | null
  tenant: { id: string; name: string } | null
}

/* ─── 은행 목록 ─── */
const VA_BANKS: Record<string, string> = {
  SHINHAN: '신한은행',
  KOOKMIN: '국민은행',
  HANA:    '하나은행',
  WOORI:   '우리은행',
  NH:      '농협은행',
  IBK:     'IBK기업은행',
  BUSAN:   '부산은행',
}

/* ─── 타입 ─── */
interface InvoiceWithRoom extends Invoice {
  room?: Pick<Room, 'name'>
}

type FilterStatus = 'ALL' | 'paid' | 'upcoming' | 'ready' | 'overdue'

/* ─── 은행 입금일 문자열 → { year, month, isoDate } 파싱 ─── */
function parseBankDate(dateStr: string): { year: number; month: number; isoDate: string } {
  if (!dateStr) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1, isoDate: now.toISOString() }
  }

  // 1) Excel 시리얼 숫자 (SheetJS가 날짜를 숫자로 반환 시, e.g. 45373)
  const asNum = Number(String(dateStr).trim())
  if (!isNaN(asNum) && asNum > 40000 && asNum < 60000) {
    const d = new Date((asNum - 25569) * 86400000)
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, isoDate: d.toISOString() }
  }

  // 2) 구분자 제거 후 YYYYMMDD 파싱 (2025.01.15 / 2025-01-15 / 20250115 등)
  const clean = String(dateStr).replace(/[.\-\/\s]/g, '')
  if (clean.length >= 8) {
    const year  = parseInt(clean.slice(0, 4))
    const month = parseInt(clean.slice(4, 6))
    const day   = parseInt(clean.slice(6, 8))
    if (year > 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, isoDate: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00.000Z` }
    }
  }

  // 3) JS Date 문자열 파싱 (SheetJS Date 객체 → String 변환 결과 등)
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
    return { year: parsed.getFullYear(), month: parsed.getMonth() + 1, isoDate: parsed.toISOString() }
  }

  // 4) 폴백
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, isoDate: now.toISOString() }
}

/* ─── 납부 예정 여부: due_date가 오늘보다 미래이면 납부 예정 ─── */
function isUpcoming(inv: InvoiceWithRoom): boolean {
  if (inv.status !== 'ready') return false
  if (!inv.due_date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(inv.due_date)
  due.setHours(0, 0, 0, 0)
  return due > today
}

interface BankRow {
  date:   string
  amount: number
  note:   string
  raw:    Record<string, string>
}

/* ─── 입금내역 검토용 매칭 후보 ─── */
interface PendingMatch {
  rowIdx:             number
  bankRow:            BankRow
  suggestedInvoiceId: string | null  // 자동 제안
  selectedInvoiceId:  string | null  // 사용자 선택
  included:           boolean        // 체크박스 포함 여부
  isDuplicate:        boolean        // 이미 완납된 중복
  duplicateLabel:     string | null  // 완납 매칭 호실 표시용 (호실명 + 입주사명)
  aiSuggestedId:      string | null  // AI 제안
  aiReason:           string | null  // AI 추론 이유
  matchedTenantName:  string | null  // 매칭된 입주사명 (표시용)
  /** 분할 매칭: 한 입금을 여러 청구서에 나눠 충당 */
  splits:             { invoiceId: string; amount: number }[] | null
}

/* ─── 분할 매칭용 미납 청구서 (월별, 모든 연도) ─── */
interface UnpaidInvoiceForSplit {
  id:          string
  room_id:     string
  year:        number
  month:       number
  amount:      number
  paid_amount: number
  due_date:    string
  status:      string
}

/* ─── 가상계좌 모달 ─── */
interface VaModalState {
  invoiceId: string
  roomName:  string
  amount:    number
}

/* ══════════════════════════════════════════════
   메인 페이지
══════════════════════════════════════════════ */
export default function PaymentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const fileRef  = useRef<HTMLInputElement>(null)

  const [invoices, setInvoices] = useState<InvoiceWithRoom[]>([])
  const [allRooms,    setAllRooms]    = useState<{ id: string; name: string }[]>([])
  const [allLeases,   setAllLeases]   = useState<ActiveLease[]>([])
  /** 전 기간 미납 청구서 — FIFO 자동 충당용 */
  const [allUnpaidInvoices, setAllUnpaidInvoices] = useState<UnpaidInvoiceForSplit[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<FilterStatus>('ALL')
  const [search, setSearch]     = useState('')
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [importing, setImporting] = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [toast, setToast]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  /* ─── 검토 모달 상태 ─── */
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([])
  const [showReview, setShowReview]         = useState(false)
  const [executing, setExecuting]           = useState(false)
  const [aiMatching, setAiMatching]         = useState(false)
  const [sortCol, setSortCol]   = useState<'date' | 'amount' | 'note' | 'room' | 'status'>('date')
  const [sortAsc, setSortAsc]   = useState(true)

  /* ─── 분할 매칭 모달 상태 ─── */
  const [splitRowIdx,    setSplitRowIdx]    = useState<number | null>(null)
  const [splitInvoices,  setSplitInvoices]  = useState<UnpaidInvoiceForSplit[]>([])
  const [splitLoading,   setSplitLoading]   = useState(false)
  const [splitAllocs,    setSplitAllocs]    = useState<Record<string, string>>({})

  /* ─── 청구금액 인라인 수정 ─── */
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')

  /* ─── 가상계좌 모달 ─── */
  const [vaModal, setVaModal]   = useState<VaModalState | null>(null)
  const [vaBank, setVaBank]     = useState('SHINHAN')
  const [vaLoading, setVaLoading] = useState(false)
  const [vaResult, setVaResult] = useState<{
    accountNumber: string; bank: string; bankLabel: string; expiredAt: string; alreadyIssued?: boolean
  } | null>(null)

  /* ─── 데이터 로드 ─── */
  const load = useCallback(async () => {
    setLoading(true)
    const [year, month] = yearMonth.split('-').map(Number)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('invoices')
      .select('*, rooms(name)')
      .eq('owner_id', user.id)
      .eq('year', year)
      .eq('month', month)
      .order('created_at', { ascending: false })

    setInvoices((data || []).map((inv: InvoiceWithRoom & { rooms?: Pick<Room,'name'> }) => ({
      ...inv,
      room: inv.rooms as Pick<Room,'name'> | undefined,
    })))

    const { data: roomsData, error: roomsErr } = await supabase
      .from('rooms')
      .select('id, name')
      .eq('owner_id', user.id)
      .order('name')
    if (roomsErr) console.error('[load] allRooms 쿼리 에러:', JSON.stringify(roomsErr))
    setAllRooms(roomsData ?? [])

    // 활성 계약 로드 (leases + tenants 조인) — 자동 매칭에 사용
    const { data: leasesData } = await supabase
      .from('leases')
      .select('id, room_id, monthly_rent, lease_start, lease_end, tenant:tenants(id, name)')
      .eq('owner_id', user.id)
      .eq('status', 'ACTIVE')
    setAllLeases((leasesData ?? []).map((l: {id:string;room_id:string;monthly_rent:number;lease_start:string;lease_end:string|null;tenant:{id:string;name:string}[]|{id:string;name:string}|null}) => ({
      id:           l.id,
      room_id:      l.room_id,
      monthly_rent: l.monthly_rent,
      lease_start:  l.lease_start,
      lease_end:    l.lease_end,
      tenant:       Array.isArray(l.tenant) ? (l.tenant[0] ?? null) : l.tenant,
    })))

    // 전 기간 미납 청구서 — Stage 2: FIFO 자동 충당 + Stage 1 분할 매칭에 사용
    const { data: allUnpaid } = await supabase
      .from('invoices')
      .select('id, room_id, year, month, amount, paid_amount, due_date, status')
      .eq('owner_id', user.id)
      .neq('status', 'paid')
      .order('year',  { ascending: true })
      .order('month', { ascending: true })
    setAllUnpaidInvoices((allUnpaid ?? []) as UnpaidInvoiceForSplit[])

    setLoading(false)
  }, [supabase, yearMonth])

  useEffect(() => { load() }, [load])


  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  /* ─── leases에서 호실 입주사 정보 꺼내기 ─── */
  const getTenantByRoom = (roomId: string) =>
    allLeases.find(l => l.room_id === roomId)?.tenant ?? null

  /* ─── 필터 통계 ─── */
  const stats = {
    ALL:      invoices.length,
    paid:     invoices.filter(i => i.status === 'paid').length,
    upcoming: invoices.filter(i => isUpcoming(i)).length,
    ready:    invoices.filter(i => i.status === 'ready' && !isUpcoming(i)).length,
    overdue:  invoices.filter(i => i.status === 'overdue').length,
  }

  const totalAmount  = invoices.reduce((s, i) => s + (i.amount || 0), 0)
  const paidAmount   = invoices.reduce((s, i) => s + (i.paid_amount || 0), 0)
  const unpaidAmount = totalAmount - paidAmount

  const filtered = invoices.filter(inv => {
    let matchStatus = false
    if (filter === 'ALL')      matchStatus = true
    else if (filter === 'paid')     matchStatus = inv.status === 'paid'
    else if (filter === 'overdue')  matchStatus = inv.status === 'overdue'
    else if (filter === 'upcoming') matchStatus = isUpcoming(inv)
    else if (filter === 'ready')    matchStatus = inv.status === 'ready' && !isUpcoming(inv)
    const q = search.toLowerCase()
    const tenantName = allLeases.find(l => l.room_id === inv.room_id)?.tenant?.name ?? ''
    const matchSearch = !q ||
      inv.room?.name?.toLowerCase().includes(q) ||
      tenantName.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  /* ══════════════════════════════════
     엑셀 업로드 → 검토 화면 열기
  ══════════════════════════════════ */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''

    setImporting(true)
    try {
      const { read, utils } = await import('xlsx')
      const ab  = await file.arrayBuffer()
      const wb  = read(ab)
      const ws  = wb.Sheets[wb.SheetNames[0]]

      /* 신한은행 등 상단 메타데이터 행 스킵 */
      const rawAll: string[][] = utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
      const headerRowIdx = rawAll.findIndex(row =>
        row.some(cell => /내용|입금|거래일자|날짜|일자/i.test(String(cell)))
      )
      const parseRange = headerRowIdx >= 0 ? headerRowIdx : 0
      const rows: Record<string, string>[] = utils.sheet_to_json(ws, { range: parseRange, defval: '' })

      const firstRow = rows[0] || {}
      const colKeys  = Object.keys(firstRow)
      const dateKey  = colKeys.find(k => /날짜|일자|거래일자|date/i.test(k)) ?? colKeys[0]
      const amtKey   = colKeys.find(k => /^입금|입금\(|입금액|amount/i.test(k))
                    ?? colKeys.find(k => /금액|입금/i.test(k) && !/출금/i.test(k))
                    ?? colKeys[1]
      // "내용" 컬럼 우선 탐색 (입금자명 포함) → 없으면 "적요" (거래유형 코드) 순
      const noteKey  = colKeys.find(k => /^내용$|내용\(/i.test(k))
                    ?? colKeys.find(k => /적요|note|memo/i.test(k))
                    ?? colKeys[2]

      const bankRows: BankRow[] = rows
        .map(r => ({
          date:   String(r[dateKey] || ''),
          amount: Number(String(r[amtKey] || '').replace(/[^0-9]/g, '')) || 0,
          note:   String(r[noteKey] || ''),
          raw:    r,
        }))
        .filter(r => r.amount > 0)

      if (bankRows.length === 0) {
        showToast('error', '입금 내역을 찾을 수 없습니다. 파일을 확인해주세요.')
        setImporting(false)
        return
      }

      openReview(bankRows)
    } catch (err) {
      showToast('error', `파일 처리 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    }
    setImporting(false)
  }

  /* ══════════════════════════════════
     검토 화면 열기 (자동 매칭 + AI 제안)
  ══════════════════════════════════ */
  const openReview = async (bankRows: BankRow[]) => {
    /* ── 법인/개인 이름 정규화 ── */
    const normalize = (s: string) =>
      s.replace(/\s/g, '')
       .replace(/^\(주\)|\(유\)|\(사\)|\(재\)|주식회사|유한회사|사단법인/g, '')
       .toLowerCase()

    /* ── 이름 매칭 점수 (0=불일치, 1=부분일치, 2=완전일치) ── */
    const nameScore = (note: string, tenantName: string | null | undefined): number => {
      if (!tenantName) return 0
      const n = normalize(note)
      const t = normalize(tenantName)
      if (!t) return 0
      if (n.includes(t)) return 2
      // 앞 70% 글자 부분일치 (3자 이상일 때만)
      if (t.length >= 3 && n.includes(t.slice(0, Math.ceil(t.length * 0.7)))) return 1
      return 0
    }

    /* ── 입금일 기준 계약 중인 입주사인지 확인 ── */
    const isTenantActiveOn = (tenant: { lease_start?: string | null; lease_end?: string | null }, isoDate: string): boolean => {
      const d = new Date(isoDate)
      if (tenant.lease_start && d < new Date(tenant.lease_start)) return false
      if (tenant.lease_end   && d > new Date(tenant.lease_end))   return false
      return true
    }

    const matches: PendingMatch[] = bankRows.map((row, idx) => {
      const { isoDate } = parseBankDate(row.date)

      /* ── 입금일 기준 계약 중인 lease 목록 ── */
      const activeLeases = allLeases.filter(l => isTenantActiveOn(l, isoDate))

      /* ── 노트 → 최고 점수 lease 찾기 ── */
      const bestLeaseMatch = activeLeases
        .map(l => ({ lease: l, score: nameScore(row.note, l.tenant?.name ?? null) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)[0] ?? null

      const bestTenantName = bestLeaseMatch?.lease.tenant?.name ?? null

      /* 중복 감지: 이미 완납된 건 */
      const paidByNameAndAmount = invoices.find(inv => {
        if (inv.status !== 'paid' || inv.amount !== row.amount) return false
        if (bestLeaseMatch && inv.room_id === bestLeaseMatch.lease.room_id) return true
        return false
      })
      const paidByAmountOnly = !paidByNameAndAmount
        ? (() => {
            const ms = invoices.filter(inv => inv.status === 'paid' && inv.amount === row.amount)
            return ms.length === 1 ? ms[0] : undefined
          })()
        : undefined
      const alreadyPaid = paidByNameAndAmount ?? paidByAmountOnly
      if (alreadyPaid) {
        const dupRoom = allRooms.find(r => r.id === alreadyPaid.room_id)
        return {
          rowIdx:             idx,
          bankRow:            row,
          suggestedInvoiceId: alreadyPaid.id,
          selectedInvoiceId:  alreadyPaid.id,
          included:           false,
          isDuplicate:        true,
          duplicateLabel:     dupRoom?.name ?? alreadyPaid.room?.name ?? null,
          aiSuggestedId:      null,
          aiReason:           null,
          matchedTenantName:  bestTenantName,
          splits:             null,
        }
      }

      /* 자동 매칭 1순위: 미납 청구서 중 금액 + lease 이름 일치 */
      const suggested = invoices.find(inv => {
        if (inv.status === 'paid' || inv.amount !== row.amount) return false
        if (bestLeaseMatch && inv.room_id === bestLeaseMatch.lease.room_id) return true
        return false
      }) ?? null

      /* ─── Stage 2: FIFO 자동 충당 ───
         단일 청구서와 금액 일치하지 않지만 입주사가 식별된 경우,
         해당 호실의 전 기간 미납 청구서를 가장 오래된 것부터 채워본다. */
      let autoSplits: { invoiceId: string; amount: number }[] | null = null
      if (!suggested && bestLeaseMatch) {
        const roomUnpaid = allUnpaidInvoices
          .filter(u => u.room_id === bestLeaseMatch.lease.room_id)
          .sort((a, b) => a.year - b.year || a.month - b.month)
        if (roomUnpaid.length > 0) {
          let remaining = row.amount
          const splits: { invoiceId: string; amount: number }[] = []
          for (const u of roomUnpaid) {
            if (remaining <= 0) break
            const due = Math.max(0, (u.amount || 0) - (u.paid_amount || 0))
            if (due <= 0) continue
            const take = Math.min(due, remaining)
            splits.push({ invoiceId: u.id, amount: take })
            remaining -= take
          }
          // 분할이 의미 있는 경우만 채택: ① 두 건 이상이거나 ② 한 건이라도 잔여가 있어 부분 수납인 경우
          if (splits.length >= 2 || (splits.length === 1 && remaining > 0)) {
            autoSplits = splits
          }
        }
      }

      /* 자동 매칭 2순위: 청구서 없을 경우 — lease로 호실 찾아 신규 등록 */
      const suggestedNewRoom = !suggested && !autoSplits && bestLeaseMatch
        ? allRooms.find(r => r.id === bestLeaseMatch.lease.room_id) ?? null
        : null

      // FIFO 분할이 채택된 경우엔 가상의 selectedInvoiceId로 첫 번째 invoice를 가리키게 한다 (UI 일관성)
      const suggestedId = suggested?.id
        ?? (autoSplits ? autoSplits[0].invoiceId : null)
        ?? (suggestedNewRoom ? `new:${suggestedNewRoom.id}` : null)

      return {
        rowIdx:             idx,
        bankRow:            row,
        suggestedInvoiceId: suggestedId,
        selectedInvoiceId:  suggestedId,
        included:           !!suggestedId,
        isDuplicate:        false,
        duplicateLabel:     null,
        aiSuggestedId:      null,
        aiReason:           null,
        matchedTenantName:  bestTenantName,
        splits:             autoSplits,
      }
    })

    setPendingMatches(matches)
    setShowReview(true)

    /* ─── 미매칭 건에 대해 AI 추론 요청 ─── */
    const unmatched = matches.filter(m => !m.selectedInvoiceId && !m.isDuplicate)
    if (unmatched.length === 0) return

    setAiMatching(true)
    try {
      // 미납 청구서 + 해당 호실의 현재 입주사명 포함
      const leaseByRoom = Object.fromEntries(allLeases.map(l => [l.room_id, l]))
      const unpaidInvoices = invoices
        .filter(i => i.status !== 'paid')
        .map(i => ({
          id:         i.id,
          roomName:   i.room?.name ?? '',
          tenantName: leaseByRoom[i.room_id]?.tenant?.name ?? '',
          amount:     i.amount,
        }))

      const res = await fetch('/api/ai/match-payments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          bankRows:  unmatched.map(m => ({ rowIdx: m.rowIdx, date: m.bankRow.date, amount: m.bankRow.amount, note: m.bankRow.note })),
          invoices:  unpaidInvoices,
        }),
      })
      const data = await res.json()
      const results: { rowIdx: number; invoiceId: string | null; reason: string }[] = data.results ?? []

      if (results.length > 0) {
        setPendingMatches(prev => prev.map(pm => {
          const aiResult = results.find(r => r.rowIdx === pm.rowIdx)
          if (!aiResult || !aiResult.invoiceId) return pm
          return {
            ...pm,
            selectedInvoiceId: aiResult.invoiceId,
            included:          true,
            aiSuggestedId:     aiResult.invoiceId,
            aiReason:          aiResult.reason,
          }
        }))
      }
    } catch (e) {
      console.error('AI 매칭 오류:', e)
    }
    setAiMatching(false)
  }



  /* ══════════════════════════════════
     분할 매칭 모달
  ══════════════════════════════════ */
  /** PendingMatch에서 roomId 추출 (분할 매칭용) */
  const resolveRoomId = (pm: PendingMatch): string | null => {
    if (!pm.selectedInvoiceId) return null
    if (pm.selectedInvoiceId.startsWith('new:')) {
      return pm.selectedInvoiceId.replace('new:', '')
    }
    const inv = invoices.find(i => i.id === pm.selectedInvoiceId)
    return inv?.room_id ?? null
  }

  const openSplitModal = async (rowIdx: number) => {
    const pm = pendingMatches.find(m => m.rowIdx === rowIdx)
    if (!pm) return
    const roomId = resolveRoomId(pm)
    if (!roomId) {
      showToast('error', '매칭 호실을 먼저 선택해주세요.')
      return
    }

    setSplitRowIdx(rowIdx)
    setSplitLoading(true)
    setSplitInvoices([])

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSplitLoading(false); return }

    // 해당 호실의 모든 미납 청구서 (전 기간)
    const { data, error } = await supabase
      .from('invoices')
      .select('id, year, month, amount, paid_amount, due_date, status')
      .eq('owner_id', user.id)
      .eq('room_id', roomId)
      .neq('status', 'paid')
      .order('year',  { ascending: true })
      .order('month', { ascending: true })

    if (error) {
      console.error('[openSplitModal] 미납 청구서 조회 오류:', error.message)
      showToast('error', '미납 청구서 조회 실패')
      setSplitLoading(false)
      setSplitRowIdx(null)
      return
    }

    const list = (data ?? []) as UnpaidInvoiceForSplit[]
    setSplitInvoices(list)

    // 기존 splits가 있으면 prefill, 없으면 FIFO로 자동 배분 제안
    if (pm.splits && pm.splits.length > 0) {
      const prev: Record<string, string> = {}
      for (const s of pm.splits) prev[s.invoiceId] = String(s.amount)
      setSplitAllocs(prev)
    } else {
      // FIFO 자동 제안: 잔액이 가장 적게 남은 옛날 청구서부터 채움
      let remaining = pm.bankRow.amount
      const next: Record<string, string> = {}
      for (const inv of list) {
        if (remaining <= 0) break
        const due  = Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0))
        const take = Math.min(due, remaining)
        if (take > 0) {
          next[inv.id] = String(take)
          remaining -= take
        }
      }
      setSplitAllocs(next)
    }

    setSplitLoading(false)
  }

  const closeSplitModal = () => {
    setSplitRowIdx(null)
    setSplitInvoices([])
    setSplitAllocs({})
  }

  const confirmSplit = () => {
    if (splitRowIdx === null) return
    const splits: { invoiceId: string; amount: number }[] = []
    for (const [invoiceId, raw] of Object.entries(splitAllocs)) {
      const amt = Number(raw) || 0
      if (amt > 0) splits.push({ invoiceId, amount: amt })
    }

    setPendingMatches(prev =>
      prev.map(m => m.rowIdx === splitRowIdx
        ? {
            ...m,
            splits,
            // 분할이 한 건도 없으면 splits 해제
            ...(splits.length === 0 ? { splits: null } : {}),
            included: splits.length > 0 ? true : m.included,
          }
        : m
      )
    )
    closeSplitModal()
  }

  const clearSplit = () => {
    if (splitRowIdx === null) return
    setPendingMatches(prev =>
      prev.map(m => m.rowIdx === splitRowIdx ? { ...m, splits: null } : m)
    )
    closeSplitModal()
  }

  /* ══════════════════════════════════
     수납 확정 실행
  ══════════════════════════════════ */
  const executeMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setExecuting(true)
    let matched = 0
    let skipped = 0
    const createdMonths: string[] = []

    for (const pm of pendingMatches) {
      if (!pm.included || !pm.selectedInvoiceId) { skipped++; continue }

      /* ─── 분할 매칭: 한 입금을 여러 청구서에 나눠 충당 ─── */
      if (pm.splits && pm.splits.length > 0) {
        const { isoDate } = parseBankDate(pm.bankRow.date)
        let splitOk = true
        const splitTotal = pm.splits.reduce((s, x) => s + x.amount, 0)
        const leftover   = pm.bankRow.amount - splitTotal
        // 분할 대상 호실의 lease — leftover를 PREPAY로 적립할 때 사용
        const firstInv = invoices.find(i => i.id === pm.splits![0].invoiceId)
          ?? allUnpaidInvoices.find(u => u.id === pm.splits![0].invoiceId)
        const splitLease = firstInv ? allLeases.find(l => l.room_id === firstInv.room_id) : null

        for (const s of pm.splits) {
          // 1) 현재 청구서 상태 조회 (paid_amount 누적용)
          const { data: invRow, error: invErr } = await supabase
            .from('invoices')
            .select('id, room_id, amount, paid_amount')
            .eq('id', s.invoiceId)
            .single()
          if (invErr || !invRow) {
            console.error('[split] 청구서 조회 오류:', invErr?.message)
            splitOk = false
            break
          }

          const newPaid = (invRow.paid_amount || 0) + s.amount
          const fullyPaid = newPaid >= (invRow.amount || 0)

          const { error: updErr } = await supabase.from('invoices').update({
            paid_amount: newPaid,
            status:      fullyPaid ? 'paid' : invRow.amount > newPaid ? 'ready' : 'paid',
            paid_at:     fullyPaid ? isoDate : null,
          }).eq('id', s.invoiceId)
          if (updErr) {
            console.error('[split] 청구서 업데이트 오류:', updErr.message)
            splitOk = false
            break
          }

          const { error: payErr } = await supabase.from('payments').insert({
            owner_id:   user.id,
            invoice_id: s.invoiceId,
            room_id:    invRow.room_id,
            amount:     s.amount,
            paid_at:    isoDate,
            note:       pm.bankRow.note,
          })
          if (payErr) {
            console.error('[split] 입금 기록 오류:', payErr.message)
            splitOk = false
            break
          }
        }

        if (splitOk) {
          // ─── Stage 3: 잔여 → PREPAY 자동 적립 ───
          if (leftover > 0 && splitLease) {
            await addPrepayCredit(supabase, {
              ownerId: user.id,
              leaseId: splitLease.id,
              amount:  leftover,
              note:    `분할 매칭 잔여 (${pm.bankRow.date} ${formatKRW(pm.bankRow.amount)})`,
            })
          }
          matched++
        } else {
          skipped++
        }
        continue
      }

      /* ─── 새 청구서 생성 후 수납 (과거 수납 내역 등록) ─── */
      if (pm.selectedInvoiceId.startsWith('new:')) {
        const roomId = pm.selectedInvoiceId.replace('new:', '')
        const { year, month, isoDate } = parseBankDate(pm.bankRow.date)

        // 같은 호실+연월 청구서가 이미 있으면 재사용, 없으면 생성
        let invoiceId: string | null = null
        const { data: existing } = await supabase
          .from('invoices')
          .select('id')
          .eq('room_id', roomId)
          .eq('year', year)
          .eq('month', month)
          .maybeSingle()

        if (existing) {
          invoiceId = existing.id
          // 기존 청구서 금액/상태 업데이트
          await supabase.from('invoices').update({
            paid_amount: pm.bankRow.amount,
            status: 'paid',
            paid_at: isoDate,
          }).eq('id', invoiceId)
        } else {
          const { data: newInv, error: insertErr } = await supabase
            .from('invoices')
            .insert({
              owner_id:    user.id,
              room_id:     roomId,
              year,
              month,
              amount:      pm.bankRow.amount,
              paid_amount: pm.bankRow.amount,
              status:      'paid',
              paid_at:     isoDate,
              due_date:    new Date(year, month - 1, 10).toISOString().split('T')[0],
            })
            .select('id')
            .single()
          if (insertErr || !newInv) {
            console.error('신규 청구서 생성 오류:', insertErr?.message ?? JSON.stringify(insertErr))
            skipped++
            continue
          }
          invoiceId = newInv.id
          createdMonths.push(`${year}-${String(month).padStart(2,'0')}`)
        }

        await supabase.from('payments').insert({
          owner_id:   user.id,
          invoice_id: invoiceId,
          room_id:    roomId,
          amount:     pm.bankRow.amount,
          paid_at:    isoDate,
          note:       pm.bankRow.note,
        })
        matched++
        continue
      }

      /* ─── 기존 청구서 수납 처리 ─── */
      const inv = invoices.find(i => i.id === pm.selectedInvoiceId)
      if (!inv || inv.status === 'paid') { skipped++; continue }

      const { error } = await supabase.from('invoices').update({
        paid_amount: pm.bankRow.amount,
        status:      'paid',
        paid_at:     new Date().toISOString(),
      }).eq('id', pm.selectedInvoiceId)

      if (!error) {
        await supabase.from('payments').insert({
          owner_id:   user.id,
          invoice_id: pm.selectedInvoiceId,
          room_id:    inv.room_id,
          amount:     pm.bankRow.amount,
          paid_at:    new Date().toISOString(),
          note:       pm.bankRow.note,
        })
        matched++
      }
    }

    /* 수납 확정 후 자동으로 rooms.status 동기화 */
    await syncRoomsInternal(user.id)

    setExecuting(false)
    setShowReview(false)
    setPendingMatches([])
    const monthSummary = createdMonths.length > 0
      ? ` · 신규등록 ${[...new Set(createdMonths)].sort().join(', ')}`
      : ''
    showToast('success', `${matched}건 수납 확정 완료${skipped > 0 ? ` (제외 ${skipped}건)` : ''}${monthSummary}`)
    load()
  }

  /* ══════════════════════════════════
     호실 현황 동기화 — 더 이상 수납 상태를 rooms 에 반영하지 않음.
     rooms.status 는 입주/퇴실/공실(OCCUPIED/VACATED/VACANT) 만 표현하고,
     수납 상태는 invoices 에서 직접 집계한다.
  ══════════════════════════════════ */
  const syncRoomsInternal = async (_userId: string) => {
    // no-op (수납 상태는 invoices 가 진실원본)
  }

  const syncRooms = async () => {
    setSyncing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await syncRoomsInternal(user.id)
      showToast('success', '호실 현황이 수납 상태와 동기화되었습니다.')
      load()
    }
    setSyncing(false)
  }

  /* ─── 청구금액 수정 ─── */
  const saveAmount = async (inv: InvoiceWithRoom) => {
    const newAmount = Number(editAmount.replace(/[^0-9]/g, ''))
    if (!newAmount || newAmount === inv.amount) { setEditingId(null); return }
    const { error } = await supabase.from('invoices').update({ amount: newAmount }).eq('id', inv.id)
    if (error) return showToast('error', error.message)
    showToast('success', '청구금액이 수정되었습니다.')
    setEditingId(null)
    load()
  }

  /* ─── 완납 → 미납 반환 ─── */
  const revertToUnpaid = async (inv: InvoiceWithRoom) => {
    if (!confirm(`${inv.room?.name ?? ''} 수납을 취소하고 미납으로 되돌리겠습니까?`)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('invoices').update({
      paid_amount: 0,
      status:      'ready',
      paid_at:     null,
    }).eq('id', inv.id)
    if (error) return showToast('error', error.message)

    await supabase.from('payments').delete().eq('invoice_id', inv.id)

    const { data: otherPaid } = await supabase
      .from('invoices').select('id')
      .eq('room_id', inv.room_id).eq('status', 'paid').neq('id', inv.id)
    if (!otherPaid || otherPaid.length === 0) {
      await supabase.from('rooms').update({ status: 'OCCUPIED' }).eq('id', inv.room_id)
    }

    showToast('success', '미납으로 되돌렸습니다.')
    load()
  }

  /* ─── 청구서 삭제 ─── */
  const deleteInvoice = async (inv: InvoiceWithRoom) => {
    const label  = inv.room?.name ?? '청구서'
    const isPaid = inv.status === 'paid'
    const msg    = isPaid
      ? `${label}은 이미 완납된 청구서입니다. 삭제하면 수납기록도 함께 삭제됩니다. 계속하시겠습니까?`
      : `${label} 청구서를 삭제하시겠습니까?`
    if (!confirm(msg)) return

    if (isPaid) {
      await supabase.from('payments').delete().eq('invoice_id', inv.id)
      const { data: otherPaid } = await supabase
        .from('invoices').select('id')
        .eq('room_id', inv.room_id).eq('status', 'paid').neq('id', inv.id)
      if (!otherPaid || otherPaid.length === 0) {
        await supabase.from('rooms').update({ status: 'OCCUPIED' }).eq('id', inv.room_id)
      }
    }

    const { error } = await supabase.from('invoices').delete().eq('id', inv.id)
    if (error) return showToast('error', error.message)
    showToast('success', '청구서가 삭제되었습니다.')
    load()
  }

  /* ─── 수기 수납처리 ─── */
  const markPaid = async (inv: InvoiceWithRoom) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('invoices').update({
      paid_amount: inv.amount,
      status:      'paid',
      paid_at:     new Date().toISOString(),
    }).eq('id', inv.id)
    if (error) return showToast('error', error.message)
    // rooms.status 는 더 이상 수납 상태를 반영하지 않음 (invoices 가 진실원본)
    showToast('success', '수납 처리되었습니다.')
    load()
  }

  /* ─── 입주사 전화번호 조회 헬퍼 ─── */
  const getTenantPhone = async (roomId: string): Promise<string | null> => {
    const lease = allLeases.find(l => l.room_id === roomId)
    if (!lease?.tenant?.id) return null
    const { data } = await supabase.from('tenants').select('phone').eq('id', lease.tenant.id).single()
    return data?.phone || null
  }

  /* ─── 결제 링크 생성 ─── */
  const getPaymentLink = (inv: InvoiceWithRoom) =>
    `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/pay/${inv.id}`

  /* ─── 청구서 카톡 발송 (수동) ─── */
  const sendInvoiceKakao = async (inv: InvoiceWithRoom) => {
    const t = getTenantByRoom(inv.room_id)
    if (!t?.name) return showToast('error', '입주사 정보가 없습니다.')
    const phone = await getTenantPhone(inv.room_id)
    if (!phone) return showToast('error', '연락처가 없습니다. 입주사 정보에 전화번호를 등록해주세요.')
    try {
      const res = await fetch('/api/alimtalk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: 'INVOICE_ISSUED',
          phone,
          roomName:    inv.room?.name ?? '',
          tenantName:  t.name,
          amount:      String(inv.amount),
          dueDate:     inv.due_date || '',
          paymentLink: getPaymentLink(inv),
          roomId:      inv.room_id
        })
      })
      if (!res.ok) throw new Error('발송 실패')
      showToast('success', '카카오 알림톡을 발송했습니다.')
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '발송 오류')
    }
  }

  /* ─── 청구서 문자 발송 (SMS/LMS) ─── */
  const sendInvoiceSMS = async (inv: InvoiceWithRoom) => {
    const t = getTenantByRoom(inv.room_id)
    if (!t?.name) return showToast('error', '입주사 정보가 없습니다.')
    const phone = await getTenantPhone(inv.room_id)
    if (!phone) return showToast('error', '연락처가 없습니다. 입주사 정보에 전화번호를 등록해주세요.')
    const link = getPaymentLink(inv)
    const text = `[대우오피스] ${inv.year}년 ${inv.month}월 이용료 안내\n\n${inv.room?.name ?? ''}호 ${t.name}님\n금액: ${formatKRW(inv.amount)}\n납부기한: ${inv.due_date || '확인요망'}\n\n결제하기: ${link}`
    try {
      const res = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, text, roomId: inv.room_id, tenantName: t.name })
      })
      if (!res.ok) throw new Error('발송 실패')
      showToast('success', '문자를 발송했습니다.')
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '발송 오류')
    }
  }

  /* ─── 결제 링크 복사 ─── */
  const copyPaymentLink = (inv: InvoiceWithRoom) => {
    const t = getTenantByRoom(inv.room_id)
    const link = getPaymentLink(inv)
    const text = `[대우오피스] ${inv.room?.name ?? ''}호 ${t?.name ?? ''}\n${inv.year}년 ${inv.month}월 이용료: ${formatKRW(inv.amount)}\n결제링크: ${link}`
    navigator.clipboard.writeText(text)
      .then(() => showToast('success', '결제 링크가 복사되었습니다.'))
      .catch(() => showToast('error', '복사에 실패했습니다.'))
  }

  /* ─── 청구서 일괄생성 ─── */
  const generateInvoices = async () => {
    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }

    const [year, month] = yearMonth.split('-').map(Number)

    const { data: rooms } = await supabase
      .from('rooms').select('id, name, owner_id')
      .eq('owner_id', user.id).neq('status', 'VACANT')

    if (!rooms || rooms.length === 0) {
      showToast('error', '입주 중인 호실이 없습니다.'); setImporting(false); return
    }

    const existingIds = new Set(invoices.map(i => i.room_id))
    const newRooms    = rooms.filter(r => !existingIds.has(r.id))

    if (newRooms.length === 0) {
      showToast('error', '이미 모든 청구서가 생성되어 있습니다.'); setImporting(false); return
    }

    // 해당 월 기준 계약 중인 leases 조회 (이용료·연락처·tenant_id)
    const billingDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const { data: leasesForBilling } = await supabase
      .from('leases')
      .select('id, room_id, monthly_rent, payment_day, tenant_id, tenant:tenants(id, name, phone)')
      .in('room_id', newRooms.map(r => r.id))
      .eq('status', 'ACTIVE')
      .or(`lease_end.is.null,lease_end.gte.${billingDate}`)
    type LeaseRow = { id: string; room_id: string; monthly_rent: number; payment_day: number; tenant_id: string; tenant: { id: string; name: string; phone: string | null } | null }
    const leaseByRoom: Record<string, LeaseRow> = {}
    for (const raw of (leasesForBilling || [])) {
      const l = raw as { id:string;room_id:string;monthly_rent:number;payment_day:number;tenant_id:string;tenant:{id:string;name:string;phone:string|null}[]|{id:string;name:string;phone:string|null}|null }
      leaseByRoom[l.room_id] = { ...l, tenant: Array.isArray(l.tenant) ? (l.tenant[0] ?? null) : l.tenant }
    }

    // billing_items 조회 (활성 MONTHLY 항목 합산)
    const leaseIdsForBilling = Object.values(leaseByRoom).map(l => l.id).filter(Boolean)
    let extraByLease: Record<string, number> = {}
    if (leaseIdsForBilling.length > 0) {
      const { data: billingItems } = await supabase
        .from('billing_items')
        .select('lease_id, amount')
        .in('lease_id', leaseIdsForBilling)
        .eq('is_active', true)
        .eq('billing_cycle', 'MONTHLY')
      for (const bi of (billingItems ?? []) as { lease_id: string; amount: number | null }[]) {
        extraByLease[bi.lease_id] = (extraByLease[bi.lease_id] ?? 0) + (bi.amount ?? 0)
      }
    }

    const { data: insertedInvoices, error } = await supabase.from('invoices').insert(
      newRooms.map(r => {
        const lease = leaseByRoom[r.id]
        const extra = lease ? (extraByLease[lease.id] ?? 0) : 0
        return {
          owner_id:     user.id,
          room_id:      r.id,
          lease_id:     lease?.id || null,
          tenant_id:    lease?.tenant_id || null,
          year,
          month,
          amount:       (lease?.monthly_rent ?? 0) + extra,
          base_amount:  lease?.monthly_rent ?? 0,
          extra_amount: extra,
          paid_amount:  0,
          status:       'ready',
          due_date:     new Date(year, month - 1, lease?.payment_day || 10).toISOString().split('T')[0],
        }
      })
    ).select()

    if (error) { showToast('error', error.message); setImporting(false); return }

    // ─── Stage 3: PREPAY 자동 차감 ───
    let prepayUsedCount = 0
    if (insertedInvoices) {
      for (const inv of insertedInvoices) {
        const lease = leaseByRoom[inv.room_id]
        if (!lease) continue
        const result = await deductPrepayForInvoice(supabase, {
          ownerId:       user.id,
          leaseId:       lease.id,
          invoiceId:     inv.id,
          roomId:        inv.room_id,
          invoiceAmount: inv.amount ?? 0,
        })
        if (result.deducted > 0) prepayUsedCount++
      }
    }

    // 알림톡 발송
    if (insertedInvoices) {
      for (const inv of insertedInvoices) {
        const room  = newRooms.find(r => r.id === inv.room_id)
        const lease = leaseByRoom[inv.room_id]
        const phone = lease?.tenant?.phone
        const name  = lease?.tenant?.name || '입주자님'
        if (room && phone) {
          try {
            await fetch('/api/alimtalk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                templateKey: 'INVOICE_ISSUED',
                phone,
                roomName:    room.name,
                tenantName:  name,
                amount:      String(inv.amount ?? 0),
                dueDate:     inv.due_date,
                paymentLink: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/pay/${inv.id}`,
                roomId:      room.id,
              })
            })
          } catch (e) {
            console.error('알림톡 발송 실패', e)
          }
        }
      }
    }

    const prepayMsg = prepayUsedCount > 0 ? ` · 선납금 자동 차감 ${prepayUsedCount}건` : ''
    showToast('success', `${newRooms.length}건 청구서를 생성했습니다.${prepayMsg}`)
    load()
    setImporting(false)
  }

  /* ─── 가상계좌 발급 ─── */
  const issueVirtualAccount = async () => {
    if (!vaModal) return
    setVaLoading(true)
    setVaResult(null)
    try {
      const res  = await fetch('/api/portone/virtual-account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ invoiceId: vaModal.invoiceId, bank: vaBank }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast('error', data.error ?? '가상계좌 발급 실패')
      } else {
        setVaResult(data)
        load()
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '오류 발생')
    }
    setVaLoading(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast('success', '복사되었습니다.'))
  }

  /* ─── 수납내역 CSV 다운로드 ─── */
  const downloadCSV = async () => {
    const { utils, writeFile } = await import('xlsx')
    const rows = filtered.map(inv => ({
      호실:         inv.room?.name ?? '',
      입주사:       getTenantByRoom(inv.room_id)?.name ?? '',
      연락처:       '',
      청구금액:     inv.amount,
      수납금액:     inv.paid_amount,
      미납:         inv.amount - inv.paid_amount,
      상태:         inv.status === 'paid' ? '완납' : inv.status === 'overdue' ? '연체' : isUpcoming(inv) ? '납부예정' : '미납',
      납부기한:     inv.due_date ?? '',
      납부일:       inv.paid_at ? formatDate(inv.paid_at) : '',
      가상계좌:     inv.virtual_account_number ?? '',
      가상계좌은행: inv.virtual_account_bank
        ? (VA_BANKS[inv.virtual_account_bank] ?? inv.virtual_account_bank)
        : '',
    }))
    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, '수납내역')
    writeFile(wb, `수납내역_${yearMonth}.xlsx`)
  }

  const statusMeta: Record<string, { label: string; bg: string; color: string }> = {
    paid:     { label: '완납',     bg: 'var(--color-success-bg)',            color: 'var(--color-success)' },
    upcoming: { label: '납부 예정', bg: 'rgba(59,130,246,0.08)',              color: '#3b82f6'              },
    ready:    { label: '미납',     bg: 'rgba(29,53,87,0.06)',                color: 'var(--color-muted)'   },
    overdue:  { label: '연체',     bg: 'var(--color-danger-bg)',             color: 'var(--color-danger)'  },
  }

  /* ─── 청구서 표시용 상태 키 (isUpcoming 반영) ─── */
  const getStatusKey = (inv: InvoiceWithRoom) =>
    isUpcoming(inv) ? 'upcoming' : inv.status

  /* ─── 검토 모달 통계 ─── */
  const unpaidInvoiceOptions  = invoices.filter(i => i.status !== 'paid')
  const includedCount  = pendingMatches.filter(m => m.included && m.selectedInvoiceId && !m.isDuplicate).length
  const duplicateCount = pendingMatches.filter(m => m.isDuplicate).length
  const unmatchedCount = pendingMatches.filter(m => !m.selectedInvoiceId && !m.isDuplicate).length

  /* ─── 정렬된 검토 목록 ─── */
  const sortedMatches = useMemo(() => {
    const statusOrder = (pm: PendingMatch) => {
      if (pm.isDuplicate) return 3
      if (!pm.selectedInvoiceId) return 2
      if (pm.aiSuggestedId && pm.selectedInvoiceId === pm.aiSuggestedId) return 1
      return 0
    }
    const getRoomLabel = (pm: PendingMatch) => {
      if (pm.selectedInvoiceId?.startsWith('new:')) {
        const r = allRooms.find(r => `new:${r.id}` === pm.selectedInvoiceId)
        if (!r) return ''
        const t = allLeases.find(l => l.room_id === r.id)?.tenant
        return `${r.name} ${t?.name ?? ''}`
      }
      const inv = invoices.find(i => i.id === pm.selectedInvoiceId)
      if (!inv) return ''
      const t = getTenantByRoom(inv.room_id)
      return `${inv.room?.name ?? ''} ${t?.name ?? ''}`
    }
    return [...pendingMatches].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'date')   cmp = (a.bankRow.date || '').localeCompare(b.bankRow.date || '')
      if (sortCol === 'amount') cmp = a.bankRow.amount - b.bankRow.amount
      if (sortCol === 'note')   cmp = (a.bankRow.note || '').localeCompare(b.bankRow.note || '')
      if (sortCol === 'room')   cmp = getRoomLabel(a).localeCompare(getRoomLabel(b))
      if (sortCol === 'status') cmp = statusOrder(a) - statusOrder(b)
      return sortAsc ? cmp : -cmp
    })
  }, [pendingMatches, sortCol, sortAsc, invoices, allRooms])

  const toggleSort = (col: 'date' | 'amount' | 'note' | 'room' | 'status') => {
    if (sortCol === col) setSortAsc(p => !p)
    else { setSortCol(col); setSortAsc(true) }
  }

  /* ══════════════════════════════════
     렌더
  ══════════════════════════════════ */
  return (
    <div className="p-3 sm:p-6 max-w-[1200px]">
      <style>{`
        @keyframes scan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(320%); }
        }
        @keyframes ai-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.65; }
        }
        @keyframes bar {
          0%   { transform: scaleY(0.35); }
          100% { transform: scaleY(1); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
             style={{ background: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          입금내역 검토 모달
      ══════════════════════════════════════════════ */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="rounded-2xl w-full max-w-4xl shadow-2xl"
               style={{ background: 'var(--color-surface)' }}>

            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
                 style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <Eye size={18} style={{ color: 'var(--color-primary)' }} />
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                    입금내역 검토
                  </h2>
                  {aiMatching && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                         style={{
                           background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(99,102,241,0.12))',
                           border: '1px solid rgba(124,58,237,0.25)',
                           color: '#7c3aed',
                           animation: 'ai-pulse 2s ease-in-out infinite',
                         }}>
                      <Sparkles size={11} style={{ animation: 'spin 3s linear infinite' }} />
                      Gemini AI 분석 중
                      <Loader2 size={10} className="animate-spin opacity-60" />
                    </div>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                  총 {pendingMatches.length}건 &middot; 확정 {includedCount}건
                  {duplicateCount > 0 && (
                    <span className="ml-2 font-medium" style={{ color: '#f59e0b' }}>
                      ⚠ 이미 완납 {duplicateCount}건 (자동 제외)
                    </span>
                  )}
                  {unmatchedCount > 0 && (
                    <span className="ml-2 font-medium" style={{ color: 'var(--color-danger)' }}>
                      ✕ 미매칭 {unmatchedCount}건
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => { setShowReview(false); setPendingMatches([]) }}
                      style={{ color: 'var(--color-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* AI 분석 배너 */}
            {aiMatching && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.06) 50%, rgba(59,130,246,0.06) 100%)',
                borderBottom: '1px solid rgba(124,58,237,0.12)',
                padding: '14px 24px',
              }}>
                <div className="flex items-center gap-3">
                  {/* 아이콘 + 핑 */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      position: 'absolute', inset: -6, borderRadius: '50%',
                      background: 'rgba(124,58,237,0.15)',
                      animation: 'ping 1.2s cubic-bezier(0,0,.2,1) infinite',
                    }} />
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                      boxShadow: '0 0 12px rgba(124,58,237,0.4)',
                    }}>
                      <Sparkles size={16} color="white" />
                    </div>
                  </div>
                  {/* 텍스트 */}
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#7c3aed', letterSpacing: '-0.01em' }}>
                      AI가 입금 패턴을 분석하고 있습니다
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(124,58,237,0.65)' }}>
                      Gemini 2.5 Flash · 입금자명·금액·키워드를 종합해 최적 호실을 추론합니다
                    </p>
                  </div>
                  {/* 음파 바 */}
                  <div className="ml-auto flex items-center gap-0.5" style={{ height: 24 }}>
                    {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.4].map((h, i) => (
                      <div key={i} style={{
                        width: 3, borderRadius: 2,
                        background: 'linear-gradient(to top, #7c3aed, #6366f1)',
                        height: `${h * 100}%`,
                        animation: `bar 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                        opacity: 0.7,
                      }} />
                    ))}
                  </div>
                </div>
                {/* 스캔 바 */}
                <div style={{ marginTop: 10, height: 2, borderRadius: 1, background: 'rgba(124,58,237,0.1)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: '35%',
                    background: 'linear-gradient(90deg, transparent, #7c3aed, #6366f1, transparent)',
                    animation: 'scan 1.8s ease-in-out infinite',
                  }} />
                </div>
              </div>
            )}

            {/* 검토 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--color-muted-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>포함</th>
                    {([
                      ['입금일',           'date'],
                      ['입금액',           'amount'],
                      ['내용(비고)',        'note'],
                      ['매칭 호실 / 입주사', 'room'],
                      ['상태',             'status'],
                    ] as [string, 'date' | 'amount' | 'note' | 'room' | 'status'][]).map(([label, col]) => (
                      <th key={col}
                          className="px-4 py-3 text-left text-xs font-semibold cursor-pointer select-none"
                          style={{ color: sortCol === col ? 'var(--color-primary)' : 'var(--color-muted)' }}
                          onClick={() => toggleSort(col)}>
                        <span className="flex items-center gap-1">
                          {label}
                          <span className="text-[10px]">
                            {sortCol === col ? (sortAsc ? '↑' : '↓') : '↕'}
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedMatches.map((pm, i) => {
                    const selInv = invoices.find(inv => inv.id === pm.selectedInvoiceId)
                    const isAutoMatch = pm.suggestedInvoiceId && pm.selectedInvoiceId === pm.suggestedInvoiceId && !pm.aiSuggestedId
                    const isAiMatch   = !!pm.aiSuggestedId && pm.selectedInvoiceId === pm.aiSuggestedId
                    return (
                      <tr key={pm.rowIdx}
                          style={{
                            borderBottom: i < pendingMatches.length - 1 ? '1px solid var(--color-border)' : 'none',
                            opacity:      !pm.included ? 0.45 : 1,
                            background:   pm.isDuplicate ? 'rgba(245,158,11,0.04)' : undefined,
                          }}>

                        {/* 포함 체크박스 */}
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={pm.included}
                            onChange={e =>
                              setPendingMatches(prev =>
                                prev.map(m => m.rowIdx === pm.rowIdx ? { ...m, included: e.target.checked } : m)
                              )
                            }
                            className="w-4 h-4 cursor-pointer"
                            style={{ accentColor: 'var(--color-primary)' }}
                          />
                        </td>

                        {/* 입금일 */}
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-muted)' }}>
                          {pm.bankRow.date || '—'}
                        </td>

                        {/* 입금액 */}
                        <td className="px-4 py-3 font-bold tabular whitespace-nowrap"
                            style={{ color: 'var(--color-primary)' }}>
                          {formatKRW(pm.bankRow.amount)}
                        </td>

                        {/* 내용 */}
                        <td className="px-4 py-3 max-w-[180px] text-xs" style={{ color: 'var(--color-text)' }}>
                          <div className="truncate" title={pm.bankRow.note}>{pm.bankRow.note || '—'}</div>
                          {pm.aiReason && (
                            <div className="flex items-start gap-1 mt-1 px-2 py-1 rounded-md"
                                 style={{
                                   background: 'linear-gradient(135deg, rgba(124,58,237,0.07), rgba(99,102,241,0.07))',
                                   border: '1px solid rgba(124,58,237,0.15)',
                                 }}>
                              <Sparkles size={9} className="shrink-0 mt-0.5" style={{ color: '#7c3aed' }} />
                              <span className="text-[10px] leading-tight font-medium" style={{ color: '#7c3aed' }}>{pm.aiReason}</span>
                            </div>
                          )}
                        </td>

                        {/* 매칭 선택 드롭다운 + 분할 매칭 버튼 */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-1.5">
                          <select
                            value={pm.selectedInvoiceId ?? ''}
                            onChange={e => {
                              const val = e.target.value || null
                              setPendingMatches(prev =>
                                prev.map(m =>
                                  m.rowIdx === pm.rowIdx ? {
                                    ...m,
                                    selectedInvoiceId: val,
                                    included:          !!val,
                                    isDuplicate:       false,  // 수동 변경 시 중복 해제
                                    duplicateLabel:    null,
                                    splits:            null,   // 매칭 변경 시 분할 해제
                                  } : m
                                )
                              )
                            }}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                            style={{
                              border:     '1px solid var(--color-border)',
                              background: 'var(--color-muted-bg)',
                              color:      'var(--color-foreground)',
                              minWidth:   '200px',
                            }}>
                            <option value="">— 미매칭 (제외) —</option>
                            {unpaidInvoiceOptions.length > 0 && (
                              <optgroup label="── 이번 달 청구서 매칭 ──">
                                {unpaidInvoiceOptions.map(inv => (
                                  <option key={inv.id} value={inv.id}>
                                    {inv.room?.name} {getTenantByRoom(inv.room_id)?.name ?? ''} ({formatKRW(inv.amount)})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {allRooms.length > 0 && (
                              <optgroup label="── 새 청구서 생성 후 수납 (과거 내역) ──">
                                {allRooms.map(r => (
                                  <option key={`new:${r.id}`} value={`new:${r.id}`}>
                                    {r.name} {allLeases.find(l => l.room_id === r.id)?.tenant?.name ?? ''} (신규 등록)
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {/* 이미 완납 건 — selInv가 없어도 duplicateLabel로 항상 표시 */}
                            {pm.duplicateLabel && pm.suggestedInvoiceId && (
                              <optgroup label="── 이미 완납 (자동 감지) ──">
                                <option value={pm.suggestedInvoiceId}>
                                  {pm.duplicateLabel} ({formatKRW(pm.bankRow.amount)}) ✓ 완납
                                </option>
                              </optgroup>
                            )}
                            {/* selInv가 완납이고 duplicateLabel이 없는 경우 (수동 선택된 완납 건) */}
                            {!pm.duplicateLabel && selInv && selInv.status === 'paid' && !unpaidInvoiceOptions.find(inv => inv.id === selInv.id) && (
                              <optgroup label="── 이미 완납 ──">
                                <option key={selInv.id} value={selInv.id}>
                                  {selInv.room?.name} {getTenantByRoom(selInv.room_id)?.name ?? ''} ({formatKRW(selInv.amount)})
                                </option>
                              </optgroup>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => openSplitModal(pm.rowIdx)}
                            disabled={!pm.selectedInvoiceId || pm.isDuplicate}
                            title="여러 달 청구서에 나눠 충당"
                            className="shrink-0 flex items-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold border transition disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                              borderColor: pm.splits && pm.splits.length > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                              background:  pm.splits && pm.splits.length > 0 ? 'var(--color-primary)' : 'var(--color-surface)',
                              color:       pm.splits && pm.splits.length > 0 ? '#fff' : 'var(--color-muted)',
                            }}>
                            <Split size={12} />
                            {pm.splits && pm.splits.length > 0 ? `분할 ${pm.splits.length}` : '분할'}
                          </button>
                          </div>
                          {pm.splits && pm.splits.length > 0 && (
                            <div className="mt-1.5 text-[10px] leading-tight" style={{ color: 'var(--color-muted)' }}>
                              {pm.splits.map(s => {
                                const inv = splitInvoices.find(i => i.id === s.invoiceId)
                                  ?? invoices.find(i => i.id === s.invoiceId)
                                const ym = inv ? `${('year' in inv ? inv.year : '')}-${String('month' in inv ? inv.month : '').padStart(2,'0')}` : ''
                                return `${ym} ${formatKRW(s.amount)}`
                              }).join(' · ')}
                            </div>
                          )}
                        </td>

                        {/* 상태 배지 */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {pm.isDuplicate ? (
                            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#f59e0b' }}>
                              <AlertTriangle size={12} />
                              이미 완납
                            </div>
                          ) : pm.selectedInvoiceId?.startsWith('new:') ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                              신규 등록
                            </span>
                          ) : isAiMatch ? (
                            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
                                 style={{
                                   background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                                   color: 'white',
                                   boxShadow: '0 2px 8px rgba(124,58,237,0.35)',
                                   letterSpacing: '0.01em',
                                 }}>
                              <Sparkles size={10} />
                              AI 매칭
                            </div>
                          ) : isAutoMatch ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                              자동매칭
                            </span>
                          ) : pm.selectedInvoiceId ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                              수동선택
                            </span>
                          ) : aiMatching ? (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                                 style={{
                                   background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(99,102,241,0.1))',
                                   color: '#7c3aed',
                                   border: '1px solid rgba(124,58,237,0.2)',
                                   animation: 'ai-pulse 1.5s ease-in-out infinite',
                                 }}>
                              <Sparkles size={9} />
                              AI 추론 중
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                              미매칭
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-between px-6 py-4 border-t gap-4"
                 style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                ✓ 체크된 <strong>{includedCount}건</strong>이 수납 처리됩니다.
                수납 확정 후 호실 현황이 자동으로 동기화됩니다.
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { setShowReview(false); setPendingMatches([]) }}
                  className="px-4 py-2 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  취소
                </button>
                <button
                  onClick={executeMatches}
                  disabled={executing || includedCount === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'var(--color-primary)' }}>
                  {executing
                    ? <Loader2 size={15} className="animate-spin" />
                    : <CheckCircle2 size={15} />}
                  수납 확정 ({includedCount}건)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          분할 매칭 모달
      ══════════════════════════════════════════════ */}
      {splitRowIdx !== null && (() => {
        const pm = pendingMatches.find(m => m.rowIdx === splitRowIdx)
        if (!pm) return null
        const deposit = pm.bankRow.amount
        const allocTotal = Object.values(splitAllocs).reduce((s, v) => s + (Number(v) || 0), 0)
        const remaining  = deposit - allocTotal
        const overflow   = allocTotal > deposit
        const roomId     = resolveRoomId(pm)
        const roomName   = allRooms.find(r => r.id === roomId)?.name ?? ''
        const tenantName = roomId ? (allLeases.find(l => l.room_id === roomId)?.tenant?.name ?? '') : ''

        return (
          <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4"
               onClick={e => { if (e.target === e.currentTarget) closeSplitModal() }}>
            <div className="rounded-2xl w-full max-w-2xl shadow-2xl"
                 style={{ background: 'var(--color-surface)' }}>

              {/* 헤더 */}
              <div className="flex items-center justify-between px-6 py-4 border-b"
                   style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <Split size={18} style={{ color: 'var(--color-primary)' }} />
                    <h2 className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>분할 매칭</h2>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                    한 입금을 여러 달 청구서에 나눠 충당합니다.
                  </p>
                </div>
                <button onClick={closeSplitModal} style={{ color: 'var(--color-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              {/* 입금 정보 + 호실 */}
              <div className="px-6 py-4 grid grid-cols-3 gap-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--color-muted)' }}>입금일</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{pm.bankRow.date || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--color-muted)' }}>입금액</div>
                  <div className="text-sm font-bold tabular" style={{ color: 'var(--color-primary)' }}>
                    {formatKRW(deposit)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--color-muted)' }}>매칭 호실</div>
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                    {roomName} {tenantName && <span style={{ color: 'var(--color-muted)' }}>· {tenantName}</span>}
                  </div>
                </div>
              </div>

              {/* 미납 청구서 목록 */}
              <div className="max-h-[50vh] overflow-y-auto">
                {splitLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2">
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>미납 청구서 조회 중...</p>
                  </div>
                ) : splitInvoices.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 size={24} className="mx-auto mb-2" style={{ color: 'var(--color-success)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>해당 호실의 미납 청구서가 없습니다.</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>분할 매칭을 사용할 수 없습니다.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--color-muted-bg)', borderBottom: '1px solid var(--color-border)' }}>
                        <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>청구월</th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>청구금액</th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>기수납</th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>잔여</th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>충당액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {splitInvoices.map(inv => {
                        const due = Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0))
                        const allocVal = splitAllocs[inv.id] ?? ''
                        const allocNum = Number(allocVal) || 0
                        const isOverDue = allocNum > due
                        return (
                          <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={12} style={{ color: 'var(--color-muted)' }} />
                                <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                                  {inv.year}-{String(inv.month).padStart(2,'0')}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs tabular" style={{ color: 'var(--color-muted)' }}>
                              {formatKRW(inv.amount)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs tabular" style={{ color: 'var(--color-muted)' }}>
                              {formatKRW(inv.paid_amount || 0)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs tabular font-semibold" style={{ color: 'var(--color-danger)' }}>
                              {formatKRW(due)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={allocVal}
                                onChange={e => {
                                  const v = e.target.value.replace(/[^0-9]/g, '')
                                  setSplitAllocs(prev => ({ ...prev, [inv.id]: v }))
                                }}
                                placeholder="0"
                                className="w-28 px-2 py-1.5 rounded-md text-right text-xs tabular outline-none"
                                style={{
                                  border:     `1px solid ${isOverDue ? 'var(--color-danger)' : 'var(--color-border)'}`,
                                  background: 'var(--color-muted-bg)',
                                  color:      isOverDue ? 'var(--color-danger)' : 'var(--color-foreground)',
                                }}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 합계 + 잔여 */}
              <div className="px-6 py-3 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-muted-bg)' }}>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--color-muted)' }}>충당 합계</span>
                  <span className="font-bold tabular" style={{ color: overflow ? 'var(--color-danger)' : 'var(--color-text)' }}>
                    {formatKRW(allocTotal)} / {formatKRW(deposit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span style={{ color: 'var(--color-muted)' }}>
                    {remaining >= 0 ? '잔여 (선납 처리 예정)' : '초과'}
                  </span>
                  <span className="font-bold tabular" style={{ color: overflow ? 'var(--color-danger)' : remaining > 0 ? '#f59e0b' : 'var(--color-success)' }}>
                    {formatKRW(Math.abs(remaining))}
                  </span>
                </div>
                {overflow && (
                  <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-danger)' }}>
                    충당 합계가 입금액을 초과합니다. 금액을 조정해주세요.
                  </p>
                )}
              </div>

              {/* 푸터 */}
              <div className="flex items-center justify-between px-6 py-4 border-t gap-3"
                   style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={clearSplit}
                  className="px-3 py-2 rounded-lg text-xs border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  분할 해제
                </button>
                <div className="flex gap-2">
                  <button onClick={closeSplitModal}
                    className="px-4 py-2 rounded-lg text-sm border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                    취소
                  </button>
                  <button onClick={confirmSplit}
                    disabled={overflow || allocTotal === 0}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: 'var(--color-primary)' }}>
                    <CheckCircle2 size={14} />
                    분할 확정
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══════════════════════════════════════════════
          가상계좌 발급 모달
      ══════════════════════════════════════════════ */}
      {vaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
             onClick={e => { if (e.target === e.currentTarget) { setVaModal(null); setVaResult(null) } }}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl"
               style={{ background: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 size={18} style={{ color: 'var(--color-primary)' }} />
                <h2 className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>가상계좌 발급</h2>
              </div>
              <button onClick={() => { setVaModal(null); setVaResult(null) }}
                      style={{ color: 'var(--color-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-muted)' }}>호실</span>
                <span className="font-medium" style={{ color: 'var(--color-text)' }}>{vaModal.roomName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-muted)' }}>청구금액</span>
                <span className="font-bold tabular" style={{ color: 'var(--color-primary)' }}>
                  {formatKRW(vaModal.amount)}
                </span>
              </div>
            </div>

            {!vaResult ? (
              <>
                <div className="mb-4">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-muted)' }}>
                    가상계좌 은행
                  </label>
                  <select value={vaBank} onChange={e => setVaBank(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-muted-bg)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                    {Object.entries(VA_BANKS).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
                <button onClick={issueVirtualAccount} disabled={vaLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: 'var(--color-primary)' }}>
                  {vaLoading ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />}
                  가상계좌 발급하기
                </button>
              </>
            ) : (
              <div className="space-y-3">
                {vaResult.alreadyIssued && (
                  <div className="text-xs px-3 py-2 rounded-lg"
                       style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                    이미 발급된 가상계좌 정보입니다.
                  </div>
                )}
                <div className="rounded-xl p-4 space-y-2.5"
                     style={{ background: 'var(--color-muted-bg)', border: '1px solid var(--color-border)' }}>
                  {[
                    { label: '은행',     value: vaResult.bankLabel },
                    { label: '입금기한', value: vaResult.expiredAt ? new Date(vaResult.expiredAt).toLocaleDateString('ko-KR') : '—' },
                    { label: '금액',     value: formatKRW(vaModal.amount) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{label}</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: 'var(--color-muted)' }}>계좌번호</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular" style={{ color: 'var(--color-primary)' }}>
                        {vaResult.accountNumber}
                      </span>
                      <button onClick={() => copyToClipboard(vaResult.accountNumber)}
                              className="p-1 rounded" style={{ color: 'var(--color-muted)' }}>
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-center" style={{ color: 'var(--color-muted)' }}>
                  입금 확인 시 자동으로 수납처리됩니다.
                </p>
                <button onClick={() => { setVaModal(null); setVaResult(null) }}
                  className="w-full py-2.5 rounded-lg text-sm font-medium border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          헤더
      ══════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            수납 매칭
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            월별 청구서 발행 및 입금 매칭
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* 월 선택 */}
          <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} />

          {/* 청구서 생성 */}
          <button onClick={generateInvoices} disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
            <RefreshCw size={15} className={importing ? 'animate-spin' : ''} />
            청구서 생성
          </button>

          {/* 호실 동기화 버튼 */}
          <button onClick={syncRooms} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50"
            style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
            <GitMerge size={15} className={syncing ? 'animate-spin' : ''} />
            호실 동기화
          </button>

          {/* 입금내역 업로드 */}
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer"
                 style={{ background: importing ? 'var(--color-muted)' : 'var(--color-primary)', pointerEvents: importing ? 'none' : 'auto' }}>
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            입금내역 업로드
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                   onChange={handleFileUpload} disabled={importing} />
          </label>

          {/* 수납내역 다운로드 */}
          <button onClick={downloadCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'var(--color-surface)' }}>
            <Download size={15} />
          </button>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '총 청구액', value: formatKRW(totalAmount),  color: 'var(--color-primary)', icon: <CreditCard size={18} /> },
          { label: '수납 완료', value: formatKRW(paidAmount),   color: 'var(--color-success)', icon: <CheckCircle2 size={18} /> },
          { label: '미납 잔액', value: formatKRW(unpaidAmount), color: 'var(--color-danger)',  icon: <AlertCircle size={18} /> },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-5"
               style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: k.color }}>
              {k.icon}
              <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{k.label}</span>
            </div>
            <p className="text-xl font-bold tabular" style={{ color: k.color, fontFamily: 'var(--font-display)' }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* 필터 + 검색 */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-muted-bg)' }}>
          {([
            { key: 'ALL',      label: '전체' },
            { key: 'paid',     label: '완납' },
            { key: 'upcoming', label: '납부 예정' },
            { key: 'ready',    label: '미납' },
            { key: 'overdue',  label: '연체' },
          ] as { key: FilterStatus; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filter === t.key ? 'var(--color-surface)' : 'transparent',
                color:      filter === t.key ? 'var(--color-primary)' : 'var(--color-muted)',
                boxShadow:  filter === t.key ? 'var(--shadow-soft)' : 'none',
              }}>
              {t.label} {stats[t.key]}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="호실, 이름 검색..."
            className="pl-9 pr-3 py-1.5 rounded-lg border text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', minWidth: 180 }} />
        </div>
      </div>

      {/* 청구서 테이블 */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-sm" style={{ color: 'var(--color-muted)' }}>
            <FileSpreadsheet size={28} className="mb-2 opacity-30" />
            {invoices.length === 0
              ? '청구서가 없습니다. "청구서 생성" 버튼을 눌러주세요.'
              : '검색 결과가 없습니다.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['호실', '입주사', '청구금액', '수납금액', '미납', '납부기한', '상태', '처리'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                      style={{ color: 'var(--color-muted)', background: 'var(--color-muted-bg)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, i) => {
                const meta   = statusMeta[getStatusKey(inv)] ?? statusMeta.ready
                const unpaid = inv.amount - inv.paid_amount
                const hasVA  = !!inv.virtual_account_number
                return (
                  <tr key={inv.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                      {inv.room?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>
                      {getTenantByRoom(inv.room_id)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 tabular">
                      {editingId === inv.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus type="text" value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveAmount(inv)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="w-28 px-2 py-0.5 rounded text-sm outline-none tabular"
                            style={{ border: '1px solid var(--color-primary)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                          />
                          <button onClick={() => saveAmount(inv)}
                            className="px-2 py-0.5 rounded text-xs text-white"
                            style={{ background: 'var(--color-primary)' }}>저장</button>
                          <button onClick={() => setEditingId(null)}
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{ color: 'var(--color-muted)' }}>✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span style={{ color: 'var(--color-text)' }}>{formatKRW(inv.amount)}</span>
                          {inv.status !== 'paid' && (
                            <button
                              onClick={() => { setEditingId(inv.id); setEditAmount(String(inv.amount)) }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                              style={{ color: 'var(--color-muted)' }}>
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular"
                        style={{ color: inv.paid_amount > 0 ? 'var(--color-success)' : 'var(--color-muted)' }}>
                      {formatKRW(inv.paid_amount)}
                    </td>
                    <td className="px-4 py-3 tabular"
                        style={{ color: unpaid > 0 ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                      {unpaid > 0 ? formatKRW(unpaid) : '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>
                      {inv.due_date ? formatDate(inv.due_date) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {inv.status === 'paid' ? (
                          <button onClick={() => revertToUnpaid(inv)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                            style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
                            <RotateCcw size={11} />
                            미납전환
                          </button>
                        ) : (
                          <>
                            {/* 메시지 발송 드롭다운 */}
                            <div className="relative group/send">
                              <button
                                className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                                style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid currentColor' }}>
                                <Send size={11} />
                                발송
                                <ChevronDown size={10} />
                              </button>
                              <div className="absolute left-0 bottom-full mb-1 w-32 bg-white rounded-lg shadow-xl border border-neutral-200 py-1 z-50 hidden group-hover/send:block">
                                <button onClick={() => sendInvoiceKakao(inv)}
                                  className="w-full px-3 py-2 text-left text-xs hover:bg-neutral-50 flex items-center gap-2 font-medium text-neutral-700">
                                  <MessageSquare size={12} className="text-yellow-500" />
                                  카카오톡
                                </button>
                                <button onClick={() => sendInvoiceSMS(inv)}
                                  className="w-full px-3 py-2 text-left text-xs hover:bg-neutral-50 flex items-center gap-2 font-medium text-neutral-700">
                                  <Send size={12} className="text-green-500" />
                                  문자(SMS)
                                </button>
                              </div>
                            </div>
                            {/* 결제 링크 복사 */}
                            <button onClick={() => copyPaymentLink(inv)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                              style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid currentColor' }}
                              title="결제 링크 복사 (금액 포함)">
                              <Link2 size={11} />
                              링크복사
                            </button>
                            <button
                              onClick={() => {
                                setVaBank('SHINHAN'); setVaResult(null)
                                setVaModal({ invoiceId: inv.id, roomName: inv.room?.name ?? '—', amount: inv.amount })
                                if (hasVA) {
                                  setVaResult({
                                    accountNumber: inv.virtual_account_number!,
                                    bank:          inv.virtual_account_bank ?? '',
                                    bankLabel:     VA_BANKS[inv.virtual_account_bank ?? ''] ?? (inv.virtual_account_bank ?? ''),
                                    expiredAt:     inv.virtual_account_due ?? '',
                                    alreadyIssued: true,
                                  })
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                              style={{
                                background: hasVA ? 'var(--color-info-bg)' : 'var(--color-muted-bg)',
                                color:      hasVA ? 'var(--color-info)'    : 'var(--color-muted)',
                                border:     '1px solid currentColor',
                              }}>
                              <Building2 size={11} />
                              {hasVA ? '계좌확인' : '가상계좌'}
                            </button>
                            {/* 수기 수납처리 */}
                            <button onClick={() => markPaid(inv)}
                              className="px-3 py-1 rounded-lg text-xs font-medium text-white"
                              style={{ background: 'var(--color-primary)' }}>
                              수납처리
                            </button>
                          </>
                        )}
                        <button onClick={() => deleteInvoice(inv)}
                          className="p-1.5 rounded-lg"
                          style={{ color: 'var(--color-muted)' }}
                          title="청구서 삭제">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 수납률 프로그레스 바 */}
      {totalAmount > 0 && (
        <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
          <div className="flex items-center justify-between mb-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            <span>수납률</span>
            <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
              {Math.round(paidAmount / totalAmount * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-muted-bg)' }}>
            <div className="h-full rounded-full transition-all"
                 style={{ width: `${Math.round(paidAmount / totalAmount * 100)}%`, background: 'var(--color-success)' }} />
          </div>
        </div>
      )}
    </div>
  )
}
