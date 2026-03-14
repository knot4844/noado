'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, Download, Search, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, FileSpreadsheet, X, CreditCard, Building2, Copy, Pencil, RotateCcw, Trash2,
  GitMerge, Eye, AlertTriangle, MessageSquare,
} from 'lucide-react'
import { formatKRW, formatDate } from '@/lib/utils'
import type { Invoice, Room } from '@/types'

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
  room?: Pick<Room, 'name' | 'tenant_name' | 'tenant_phone'>
}

type FilterStatus = 'ALL' | 'paid' | 'upcoming' | 'ready' | 'overdue'

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
      .select('*, rooms(name, tenant_name, tenant_phone)')
      .eq('owner_id', user.id)
      .eq('year', year)
      .eq('month', month)
      .order('created_at', { ascending: false })

    setInvoices((data || []).map((inv: InvoiceWithRoom & { rooms?: Room }) => ({
      ...inv,
      room: inv.rooms,
    })))
    setLoading(false)
  }, [supabase, yearMonth])

  useEffect(() => { load() }, [load])

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

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
    const matchSearch = !q ||
      inv.room?.name?.toLowerCase().includes(q) ||
      inv.room?.tenant_name?.toLowerCase().includes(q) ||
      inv.room?.tenant_phone?.includes(q)
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
      const noteKey  = colKeys.find(k => /^내용$|내용\(|적요|note|memo/i.test(k)) ?? colKeys[2]

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
     검토 화면 열기 (자동 매칭 제안)
  ══════════════════════════════════ */
  const openReview = (bankRows: BankRow[]) => {
    const matches: PendingMatch[] = bankRows.map((row, idx) => {
      /* 중복 감지: 이미 완납된 건과 금액+이름이 일치 */
      const alreadyPaid = invoices.find(inv =>
        inv.status === 'paid' &&
        inv.amount === row.amount &&
        !!inv.room?.tenant_name &&
        row.note.includes(inv.room.tenant_name)
      )
      if (alreadyPaid) {
        return {
          rowIdx:             idx,
          bankRow:            row,
          suggestedInvoiceId: alreadyPaid.id,
          selectedInvoiceId:  alreadyPaid.id,
          included:           false,   // 중복은 기본 제외
          isDuplicate:        true,
        }
      }

      /* 자동 매칭 1순위: 미납 청구서 중 금액 + 이름 모두 일치 */
      const byNameAndAmount = invoices.find(inv =>
        inv.status !== 'paid' &&
        inv.amount === row.amount &&
        !!inv.room?.tenant_name &&
        row.note.includes(inv.room.tenant_name)
      )
      /* 자동 매칭 2순위: 이름 매칭 없이 금액만 일치 (차선책) */
      const byAmountOnly = !byNameAndAmount
        ? invoices.find(inv => inv.status !== 'paid' && inv.amount === row.amount)
        : null

      const suggested = byNameAndAmount ?? byAmountOnly

      return {
        rowIdx:             idx,
        bankRow:            row,
        suggestedInvoiceId: suggested?.id ?? null,
        selectedInvoiceId:  suggested?.id ?? null,
        included:           !!suggested,   // 제안 있으면 기본 포함
        isDuplicate:        false,
      }
    })

    setPendingMatches(matches)
    setShowReview(true)
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

    for (const pm of pendingMatches) {
      if (!pm.included || !pm.selectedInvoiceId) { skipped++; continue }

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
    showToast('success', `${matched}건 수납 확정 완료${skipped > 0 ? ` (제외 ${skipped}건)` : ''}`)
    load()
  }

  /* ══════════════════════════════════
     호실 현황 동기화 (invoices → rooms)
  ══════════════════════════════════ */
  const syncRoomsInternal = async (userId: string) => {
    const [year, month] = yearMonth.split('-').map(Number)

    const { data: paidInvs } = await supabase
      .from('invoices').select('room_id')
      .eq('owner_id', userId).eq('status', 'paid')
      .eq('year', year).eq('month', month)

    const paidRoomIds = [...new Set((paidInvs || []).map((i: { room_id: string }) => i.room_id))]

    const { data: unpaidInvs } = await supabase
      .from('invoices').select('room_id')
      .eq('owner_id', userId).in('status', ['ready', 'overdue'])
      .eq('year', year).eq('month', month)

    const unpaidRoomIds = [...new Set((unpaidInvs || []).map((i: { room_id: string }) => i.room_id))]
      .filter(id => !paidRoomIds.includes(id))

    if (paidRoomIds.length > 0) {
      await supabase.from('rooms').update({ status: 'PAID' }).in('id', paidRoomIds).eq('owner_id', userId)
    }
    if (unpaidRoomIds.length > 0) {
      await supabase.from('rooms').update({ status: 'OCCUPIED' }).in('id', unpaidRoomIds).eq('owner_id', userId)
    }
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
    await supabase.from('rooms').update({ status: 'PAID' }).eq('id', inv.room_id)
    showToast('success', '수납 처리되었습니다.')
    load()
  }

  /* ─── 청구서 카톡 발송 (수동) ─── */
  const sendInvoiceKakao = async (inv: InvoiceWithRoom) => {
    if (!inv.room?.tenant_phone) return showToast('error', '연락처가 없습니다.')
    try {
      const res = await fetch('/api/alimtalk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: 'INVOICE_ISSUED',
          phone:       inv.room.tenant_phone,
          roomName:    inv.room.name,
          tenantName:  inv.room.tenant_name || '입주자님',
          amount:      String(inv.amount),
          dueDate:     inv.due_date || '',
          paymentLink: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/pay/${inv.id}`,
          roomId:      inv.room_id
        })
      })
      if (!res.ok) throw new Error('발송 실패')
      showToast('success', '청구서 알림톡을 발송했습니다.')
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '발송 오류')
    }
  }

  /* ─── 청구서 일괄생성 ─── */
  const generateInvoices = async () => {
    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }

    const [year, month] = yearMonth.split('-').map(Number)

    const { data: rooms } = await supabase
      .from('rooms').select('id, monthly_rent, owner_id, payment_day, tenant_name, tenant_phone, name')
      .eq('owner_id', user.id).neq('status', 'VACANT')

    if (!rooms || rooms.length === 0) {
      showToast('error', '입주 중인 호실이 없습니다.'); setImporting(false); return
    }

    const existingIds = new Set(invoices.map(i => i.room_id))
    const newRooms    = rooms.filter(r => !existingIds.has(r.id))

    if (newRooms.length === 0) {
      showToast('error', '이미 모든 청구서가 생성되어 있습니다.'); setImporting(false); return
    }

    const { data: insertedInvoices, error } = await supabase.from('invoices').insert(
      newRooms.map(r => ({
        owner_id:    user.id,
        room_id:     r.id,
        year,
        month,
        amount:      r.monthly_rent,
        paid_amount: 0,
        status:      'ready',
        due_date:    new Date(year, month - 1, r.payment_day || 10).toISOString().split('T')[0],
      }))
    ).select()
    
    if (error) { showToast('error', error.message); setImporting(false); return }

    // 알림톡 발송
    if (insertedInvoices) {
      for (const inv of insertedInvoices) {
        const room = newRooms.find(r => r.id === inv.room_id)
        if (room && room.tenant_phone) {
          try {
            await fetch('/api/alimtalk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                templateKey: 'INVOICE_ISSUED',
                phone:       room.tenant_phone,
                roomName:    room.name,
                tenantName:  room.tenant_name || '입주자님',
                amount:      String(room.monthly_rent),
                dueDate:     inv.due_date,
                paymentLink: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/pay/${inv.id}`,
                roomId:      room.id
              })
            })
          } catch (e) {
            console.error('알림톡 발송 실패', e)
          }
        }
      }
    }

    showToast('success', `${newRooms.length}건 청구서를 생성했습니다.`)
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
      호실:         inv.room?.name        ?? '',
      입주사:       inv.room?.tenant_name  ?? '',
      연락처:       inv.room?.tenant_phone ?? '',
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

  /* ══════════════════════════════════
     렌더
  ══════════════════════════════════ */
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

            {/* 검토 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--color-muted-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    {['포함', '입금일', '입금액', '내용(비고)', '매칭 호실 / 입주사', '상태'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                          style={{ color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingMatches.map((pm, i) => {
                    const selInv = invoices.find(inv => inv.id === pm.selectedInvoiceId)
                    const isAutoMatch = pm.suggestedInvoiceId && pm.selectedInvoiceId === pm.suggestedInvoiceId
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
                            disabled={pm.isDuplicate}
                            onChange={e =>
                              setPendingMatches(prev =>
                                prev.map((m, idx) => idx === i ? { ...m, included: e.target.checked } : m)
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
                        <td className="px-4 py-3 max-w-[160px] truncate text-xs"
                            style={{ color: 'var(--color-text)' }}
                            title={pm.bankRow.note}>
                          {pm.bankRow.note || '—'}
                        </td>

                        {/* 매칭 선택 드롭다운 */}
                        <td className="px-4 py-3">
                          <select
                            value={pm.selectedInvoiceId ?? ''}
                            disabled={pm.isDuplicate}
                            onChange={e => {
                              const val = e.target.value || null
                              setPendingMatches(prev =>
                                prev.map((m, idx) =>
                                  idx === i ? { ...m, selectedInvoiceId: val, included: !!val } : m
                                )
                              )
                            }}
                            className="w-full max-w-[220px] px-2 py-1.5 rounded-lg text-xs outline-none"
                            style={{
                              border:     '1px solid var(--color-border)',
                              background: 'var(--color-muted-bg)',
                              color:      'var(--color-foreground)',
                            }}>
                            <option value="">— 미매칭 (제외) —</option>
                            {unpaidInvoiceOptions.map(inv => (
                              <option key={inv.id} value={inv.id}>
                                {inv.room?.name} {inv.room?.tenant_name} ({formatKRW(inv.amount)})
                              </option>
                            ))}
                            {/* 중복인 경우 완납 건도 표시 */}
                            {pm.isDuplicate && selInv && (
                              <option key={selInv.id} value={selInv.id}>
                                {selInv.room?.name} {selInv.room?.tenant_name} ({formatKRW(selInv.amount)})
                              </option>
                            )}
                          </select>
                        </td>

                        {/* 상태 배지 */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {pm.isDuplicate ? (
                            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#f59e0b' }}>
                              <AlertTriangle size={12} />
                              이미 완납
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
                      {inv.room?.tenant_name ?? '—'}
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
                            <button onClick={() => sendInvoiceKakao(inv)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                              style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid currentColor' }}>
                              <MessageSquare size={11} />
                              카톡재발송
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
