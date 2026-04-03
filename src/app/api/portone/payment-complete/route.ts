import { NextRequest, NextResponse } from 'next/server'

const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET!
const PORTONE_API_URL = 'https://api.portone.io'

/**
 * POST /api/portone/payment-complete
 * 결제창 일반결제 완료 후 서버에서 결제 검증
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentId } = await req.json()

    if (!paymentId) {
      return NextResponse.json({ error: '결제 ID가 필요합니다.' }, { status: 400 })
    }

    // 포트원 서버에서 결제 정보 조회 (검증)
    const res = await fetch(`${PORTONE_API_URL}/payments/${paymentId}`, {
      headers: {
        'Authorization': `PortOne ${PORTONE_API_SECRET}`,
      },
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error('[payment-complete] verification failed:', errBody)
      return NextResponse.json(
        { error: errBody.message || '결제 검증에 실패했습니다.' },
        { status: 400 }
      )
    }

    const payment = await res.json()

    // 결제 상태 확인
    if (payment.status !== 'PAID') {
      return NextResponse.json(
        { error: `결제가 완료되지 않았습니다. 상태: ${payment.status}` },
        { status: 400 }
      )
    }

    console.log('[payment-complete] verified:', {
      paymentId,
      amount: payment.amount?.total,
      status: payment.status,
      method: payment.method?.type,
    })

    return NextResponse.json({
      success: true,
      paymentId,
      amount: payment.amount?.total,
      status: payment.status,
    })
  } catch (err: unknown) {
    console.error('[payment-complete] error:', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
