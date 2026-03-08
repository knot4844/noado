/**
 * PortOne V2 가상계좌 발급 API
 * POST /api/portone/virtual-account
 *
 * body: { invoiceId: string, bank?: string }
 *
 * 흐름:
 * 1. invoice 조회 (room 정보 포함)
 * 2. PortOne V2 REST API로 가상계좌 발급 요청
 * 3. 발급된 계좌번호를 invoices 테이블에 저장
 * 4. 입금되면 webhook/portone 이 자동으로 수납처리
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

const PORTONE_API_URL = 'https://api.portone.io'

// 지원 은행 목록 (PortOne V2 코드)
export const VA_BANKS: Record<string, string> = {
  SHINHAN:  '신한은행',
  KOOKMIN:  '국민은행',
  HANA:     '하나은행',
  WOORI:    '우리은행',
  NH:       '농협은행',
  IBK:      'IBK기업은행',
  BUSAN:    '부산은행',
  DAEGU:    '대구은행',
  GWANGJU:  '광주은행',
}

export async function POST(req: NextRequest) {
  try {
    const { invoiceId, bank = 'SHINHAN' } = await req.json()

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId가 필요합니다.' }, { status: 400 })
    }

    const apiSecret    = process.env.PORTONE_API_SECRET
    const channelKey   = process.env.PORTONE_CHANNEL_KEY_VIRTUAL

    if (!apiSecret || !channelKey || channelKey === 'your_virtual_account_channel_key_here') {
      return NextResponse.json(
        { error: 'PortOne 가상계좌 채널키가 설정되지 않았습니다. .env.local의 PORTONE_CHANNEL_KEY_VIRTUAL을 확인하세요.' },
        { status: 500 }
      )
    }

    const supabase = createClient()

    /* ─── 청구서 조회 ─── */
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*, rooms(name, tenant_name, tenant_phone)')
      .eq('id', invoiceId)
      .single()

    if (invErr || !invoice) {
      return NextResponse.json({ error: '청구서를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: '이미 수납완료된 청구서입니다.' }, { status: 400 })
    }

    if (invoice.virtual_account_number) {
      // 이미 발급된 경우 기존 정보 반환
      return NextResponse.json({
        alreadyIssued:         true,
        accountNumber:         invoice.virtual_account_number,
        bank:                  invoice.virtual_account_bank,
        bankLabel:             VA_BANKS[invoice.virtual_account_bank ?? ''] ?? invoice.virtual_account_bank,
        expiredAt:             invoice.virtual_account_due,
        portone_payment_id:    invoice.portone_payment_id,
      })
    }

    /* ─── paymentId = invoice.id (UUID)로 고정 ─── */
    const paymentId = invoiceId

    /* ─── 입금기한: due_date 또는 오늘 + 7일 ─── */
    const expiredAt = invoice.due_date
      ? new Date(`${invoice.due_date}T23:59:59+09:00`).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const room = invoice.rooms as { name: string; tenant_name: string | null; tenant_phone: string | null } | null

    /* ─── PortOne V2 가상계좌 발급 ─── */
    const portoneRes = await fetch(
      `${PORTONE_API_URL}/payments/${encodeURIComponent(paymentId)}/virtual-account`,
      {
        method: 'POST',
        headers: {
          'Authorization': `PortOne ${apiSecret}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          channelKey,
          bank,
          expiredAt,
          amount: {
            total:    invoice.amount,
            currency: 'KRW',
          },
          currency:  'KRW',
          orderName: `${invoice.year}년 ${invoice.month}월 월세 - ${room?.name ?? ''}`,
          customer:  {
            fullName:    room?.tenant_name    || '세입자',
            phoneNumber: room?.tenant_phone   || '',
          },
        }),
      }
    )

    const portoneBody = await portoneRes.json()

    if (!portoneRes.ok) {
      console.error('[VA] PortOne 오류:', portoneBody)
      const msg = portoneBody?.message ?? portoneBody?.code ?? '가상계좌 발급 실패'
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    /* ─── 응답 구조 파싱 ─── */
    // PortOne V2 응답: { status, id, virtualAccount: { bank, accountNumber, accountName, expiredAt } }
    const va = portoneBody?.virtualAccount ?? portoneBody

    const accountNumber = va?.accountNumber ?? va?.account_number
    const bankCode      = va?.bank ?? bank
    const vaExpiredAt   = va?.expiredAt ?? expiredAt

    if (!accountNumber) {
      console.error('[VA] 계좌번호 없음:', portoneBody)
      return NextResponse.json({ error: '가상계좌 번호를 받지 못했습니다.' }, { status: 502 })
    }

    /* ─── invoices 테이블에 저장 ─── */
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        portone_payment_id:     paymentId,
        virtual_account_number: accountNumber,
        virtual_account_bank:   bankCode,
        virtual_account_due:    vaExpiredAt,
      })
      .eq('id', invoiceId)

    if (updateErr) {
      console.error('[VA] DB 저장 오류:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      accountNumber,
      bank:      bankCode,
      bankLabel: VA_BANKS[bankCode] ?? bankCode,
      expiredAt: vaExpiredAt,
      portone_payment_id: paymentId,
    })

  } catch (e) {
    console.error('[VA] 예외:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '알 수 없는 오류' },
      { status: 500 }
    )
  }
}
