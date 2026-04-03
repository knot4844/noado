import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET!
const PORTONE_API_URL = 'https://api.portone.io'

/**
 * POST /api/portone/subscribe
 * 빌링키로 첫 결제 실행 + 구독 정보 저장
 */
export async function POST(req: NextRequest) {
  try {
    const { billingKey, planName, amount } = await req.json()

    if (!billingKey || !amount) {
      return NextResponse.json({ error: '빌링키와 금액은 필수입니다.' }, { status: 400 })
    }

    // 1. 빌링키로 첫 결제 실행
    const paymentId = `SUB_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const payRes = await fetch(`${PORTONE_API_URL}/payments/${paymentId}/billing-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `PortOne ${PORTONE_API_SECRET}`,
      },
      body: JSON.stringify({
        billingKey,
        orderName: planName || 'noado 구독',
        amount: { total: amount },
        currency: 'KRW',
      }),
    })

    if (!payRes.ok) {
      const errBody = await payRes.json().catch(() => ({}))
      console.error('[subscribe] billing payment failed:', errBody)
      return NextResponse.json(
        { error: errBody.message || '빌링키 결제에 실패했습니다.' },
        { status: 400 }
      )
    }

    const payData = await payRes.json()
    console.log('[subscribe] billing payment success:', payData)

    // 2. Supabase에 구독 정보 저장 (TODO: subscriptions 테이블 생성 후 활성화)
    // const supabase = createClient(
    //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //   process.env.SUPABASE_SERVICE_ROLE_KEY!
    // )
    // await supabase.from('subscriptions').insert({
    //   billing_key: billingKey,
    //   plan_name: planName,
    //   amount,
    //   status: 'active',
    //   last_payment_id: paymentId,
    //   next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    // })

    return NextResponse.json({
      success: true,
      paymentId,
      message: '구독이 정상적으로 등록되었습니다.',
    })
  } catch (err: unknown) {
    console.error('[subscribe] error:', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
