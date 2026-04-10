/**
 * POST /api/portone/card-payment
 * 임대료 카드결제 완료 후 서버 검증 + invoice 수납 처리
 *
 * body: { paymentId: string, invoiceId: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET!
const PORTONE_API_URL = 'https://api.portone.io'

export async function POST(req: NextRequest) {
  try {
    const { paymentId, invoiceId } = await req.json()

    if (!paymentId || !invoiceId) {
      return NextResponse.json({ error: 'paymentId와 invoiceId가 필요합니다.' }, { status: 400 })
    }

    // 1) 포트원 서버에서 결제 정보 조회 (검증)
    const res = await fetch(`${PORTONE_API_URL}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { 'Authorization': `PortOne ${PORTONE_API_SECRET}` },
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error('[card-payment] verification failed:', errBody)
      return NextResponse.json(
        { error: errBody.message || '결제 검증에 실패했습니다.' },
        { status: 400 }
      )
    }

    const payment = await res.json()

    if (payment.status !== 'PAID') {
      return NextResponse.json(
        { error: `결제가 완료되지 않았습니다. 상태: ${payment.status}` },
        { status: 400 }
      )
    }

    const paidAmount = payment.amount?.total ?? 0

    // 2) invoice 조회
    const supabase = createClient()
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, owner_id, room_id, amount, paid_amount, status')
      .eq('id', invoiceId)
      .single()

    if (invErr || !invoice) {
      return NextResponse.json({ error: '청구서를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: '이미 수납 완료된 청구서입니다.' }, { status: 400 })
    }

    // 3) 금액 검증
    const invoiceAmount = invoice.amount ?? 0
    if (paidAmount < invoiceAmount) {
      return NextResponse.json(
        { error: `결제 금액(${paidAmount})이 청구 금액(${invoiceAmount})보다 적습니다.` },
        { status: 400 }
      )
    }

    const nowIso = new Date().toISOString()

    // 4) invoice 수납 처리
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_amount: invoiceAmount,
        paid_at: nowIso,
        portone_payment_id: paymentId,
      })
      .eq('id', invoiceId)

    // 5) payments 기록
    await supabase.from('payments').insert({
      owner_id:   invoice.owner_id,
      invoice_id: invoiceId,
      room_id:    invoice.room_id,
      amount:     invoiceAmount,
      paid_at:    nowIso,
      portone_payment_id: paymentId,
      note:       '카드결제',
    })

    console.log(`[card-payment] 수납 완료: invoice=${invoiceId} payment=${paymentId} amount=${paidAmount}`)

    return NextResponse.json({
      success: true,
      paymentId,
      amount: paidAmount,
    })
  } catch (err: unknown) {
    console.error('[card-payment] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '서버 오류' },
      { status: 500 }
    )
  }
}
