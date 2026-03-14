/**
 * PortOne V2 Webhook
 * - HMAC-SHA256 서명 검증
 * - 결제 완료(PAID) 시 invoice 매칭 + room 상태 업데이트
 * - 멱등성: portone_payment_id UNIQUE constraint 활용
 *
 * invoice 조회 우선순위:
 * 1) orderId 로 invoices.id 직접 조회 (SDK 결제 흐름)
 * 2) paymentId 로 invoices.portone_payment_id 조회 (서버 가상계좌 발급 흐름)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

/* ─── HMAC 서명 검증 ─── */
async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false

  // PortOne V2: "v1=<hex_signature>" 포맷
  const parts = signatureHeader.split(',')
  const v1    = parts.find(p => p.startsWith('v1='))?.slice(3)
  if (!v1) return false

  const key    = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const hex    = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === v1
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const secret  = process.env.PORTONE_WEBHOOK_SECRET ?? ''

  /* ─── 서명 검증 ─── */
  const sigHeader = req.headers.get('webhook-signature')
  if (secret && !(await verifyWebhookSignature(rawBody, sigHeader, secret))) {
    console.warn('[Webhook] 서명 불일치', sigHeader)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try { body = JSON.parse(rawBody) }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { type, data } = body as {
    type: string
    data: {
      paymentId: string
      orderId?:  string
      status:    string
      amount:    { total: number }
      paidAt?:   string
    }
  }

  // PAID, FAILED, CANCELLED 등 상태 업데이트가 필요한 이벤트만 처리
  const validEvents = ['Transaction.Paid', 'Transaction.Failed', 'Transaction.Cancelled', 'Transaction.Expired']
  if (!validEvents.includes(type) || !data?.paymentId) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { paymentId, orderId, amount, paidAt } = data
  const supabase = createClient()

  /* ─── 멱등성 체크: 이미 처리된 결제인지 확인 ─── */
  // 동시성 제어 1차 방어막: 조회
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('portone_payment_id', paymentId)
    .single()

  if (existing) {
    console.log(`[Webhook] 중복 웹훅 수신 방어 (PaymentID: ${paymentId})`);
    return NextResponse.json({ ok: true, duplicate: true })
  }

  /* ─── invoice 조회 (두 가지 경로 지원) ─── */
  let invoice: { id: string; room_id: string; owner_id: string; amount: number } | null = null

  // 1) orderId = invoice.id (JS SDK 결제 흐름)
  if (orderId) {
    const { data: inv } = await supabase
      .from('invoices')
      .select('id, room_id, owner_id, amount')
      .eq('id', orderId)
      .single()
    invoice = inv ?? null
  }

  // 2) paymentId = invoices.portone_payment_id (서버 가상계좌 발급 흐름)
  if (!invoice) {
    const { data: inv } = await supabase
      .from('invoices')
      .select('id, room_id, owner_id, amount')
      .eq('portone_payment_id', paymentId)
      .single()
    invoice = inv ?? null
  }

  if (!invoice) {
    console.error('[Webhook] Invoice not found: orderId=', orderId, 'paymentId=', paymentId)
    return NextResponse.json({ ok: true, warning: 'Invoice not found' })
  }

  const paidAmount = amount?.total ?? 0
  const now        = paidAt ?? new Date().toISOString()

  /* ─── 상태별 분기 처리 ─── */
  if (type === 'Transaction.Paid') {
    /* ─── payments 삽입 ─── */
    const { error: payErr } = await supabase.from('payments').insert({
      owner_id:           invoice.owner_id,
      invoice_id:         invoice.id,
      room_id:            invoice.room_id,
      portone_payment_id: paymentId,
      amount:             paidAmount,
      paid_at:            now,
      note:               `PortOne V2 자동수납 (${paymentId})`,
    })

    if (payErr) {
      if (payErr.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
      console.error('[Webhook] payments insert error:', payErr)
      return NextResponse.json({ error: payErr.message }, { status: 500 })
    }

    /* ─── invoice 상태 업데이트 ─── */
    await supabase.from('invoices').update({
      paid_amount: paidAmount,
      status:      paidAmount >= invoice.amount ? 'paid' : 'ready',
      paid_at:     now,
    }).eq('id', invoice.id)

    /* ─── room 상태 업데이트 ─── */
    if (paidAmount >= invoice.amount) {
      await supabase.from('rooms').update({ status: 'PAID' }).eq('id', invoice.room_id)
    }

    console.log(`[Webhook] 수납완료: invoice=${invoice.id} amount=${paidAmount}`)
  } 
  else {
    // FAILED, CANCELLED, EXPIRED 등
    console.log(`[Webhook] 결제 실패/취소 이벤트 수신: ${type} (PaymentID: ${paymentId})`)
    
    // 해당 인보이스가 이미 'paid'가 아니라면, 상태를 'overdue' 나 다시 발급 가능하도록 초기화.
    // 여기서는 실패한 결제 ID(portone_payment_id)를 null로 비워주어 다시 재발급/재결제 할 수 있게 열어줍니다.
    await supabase.from('invoices').update({
      portone_payment_id: null,
      virtual_account_number: null,
      virtual_account_bank: null,
      virtual_account_due: null,
    }).eq('id', invoice.id).neq('status', 'paid') 

    // payments 테이블에도 실패 기록을 남기려면 여기서 insert 하거나, 현행대로 생략합니다.
    // 지금은 인보이스 초기화만 진행합니다.
  }

  console.log(`[Webhook] 수납완료: invoice=${invoice.id} amount=${paidAmount}`)
  return NextResponse.json({ ok: true })
}
