/**
 * 선납금(PREPAY) 잔액 관리 유틸
 *
 * 모델:
 *   deposits 테이블의 type='PREPAY' 행을 누적 잔액 원장으로 사용한다.
 *   - 양수 amount = 선납금 적립 (입주사 입금 잔여)
 *   - 음수 amount = 선납금 차감 (청구서 자동 충당)
 *   - 잔액  = SUM(amount) WHERE lease_id=? AND type='PREPAY' AND refunded_at IS NULL
 *
 * 환불(refund) 시에는 refunded_at 컬럼을 세팅해 잔액 계산에서 제외한다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PrepayDeductResult {
  deducted:  number  // 실제 차감된 금액
  balance:   number  // 차감 후 남은 PREPAY 잔액
  fullyPaid: boolean // 청구서가 완납되었는가
}

/** 특정 lease의 현재 PREPAY 잔액 */
export async function getPrepayBalance(
  supabase: SupabaseClient,
  leaseId:  string,
): Promise<number> {
  const { data, error } = await supabase
    .from('deposits')
    .select('amount')
    .eq('lease_id', leaseId)
    .eq('type', 'PREPAY')
    .is('refunded_at', null)
  if (error) {
    console.error('[prepay] balance query error:', error.message)
    return 0
  }
  return (data ?? []).reduce((s: number, d: { amount: number }) => s + (d.amount || 0), 0)
}

/**
 * PREPAY로 청구서를 자동 차감한다.
 * - 잔액이 청구액 이상이면 청구액 전액 차감 → 'paid'
 * - 잔액이 청구액보다 적으면 잔액만큼 부분 차감 → 'ready' 유지
 */
export async function deductPrepayForInvoice(
  supabase: SupabaseClient,
  params: {
    ownerId:       string
    leaseId:       string
    invoiceId:     string
    roomId:        string
    invoiceAmount: number
  },
): Promise<PrepayDeductResult> {
  const { ownerId, leaseId, invoiceId, roomId, invoiceAmount } = params

  const balance = await getPrepayBalance(supabase, leaseId)
  if (balance <= 0 || invoiceAmount <= 0) {
    return { deducted: 0, balance, fullyPaid: false }
  }

  const deduct    = Math.min(balance, invoiceAmount)
  const fullyPaid = deduct >= invoiceAmount
  const nowIso    = new Date().toISOString()

  // 1) 차감 원장 (음수 entry)
  await supabase.from('deposits').insert({
    owner_id:    ownerId,
    lease_id:    leaseId,
    type:        'PREPAY',
    amount:      -deduct,
    received_at: nowIso,
    note:        `청구서 자동 차감 (invoice=${invoiceId})`,
  })

  // 2) 청구서 paid_amount + status 업데이트
  await supabase.from('invoices').update({
    paid_amount: deduct,
    status:      fullyPaid ? 'paid' : 'ready',
    paid_at:     fullyPaid ? nowIso : null,
  }).eq('id', invoiceId)

  // 3) 감사 추적용 payments 기록
  await supabase.from('payments').insert({
    owner_id:   ownerId,
    invoice_id: invoiceId,
    room_id:    roomId,
    amount:     deduct,
    paid_at:    nowIso,
    note:       '선납금 자동 차감',
  })

  return { deducted: deduct, balance: balance - deduct, fullyPaid }
}

/**
 * 입금 잔여(분할 매칭에서 사용 후 남은 금액)를 PREPAY로 적립한다.
 */
export async function addPrepayCredit(
  supabase: SupabaseClient,
  params: {
    ownerId:  string
    leaseId:  string
    amount:   number
    note?:    string
  },
): Promise<void> {
  const { ownerId, leaseId, amount, note } = params
  if (amount <= 0) return

  await supabase.from('deposits').insert({
    owner_id:    ownerId,
    lease_id:    leaseId,
    type:        'PREPAY',
    amount,
    received_at: new Date().toISOString(),
    note:        note ?? '입금 잔여 자동 적립',
  })
}
