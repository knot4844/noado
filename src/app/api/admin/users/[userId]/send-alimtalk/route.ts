import { NextRequest, NextResponse } from 'next/server'
import { verifyMasterAdmin, makeAdminClient } from '@/lib/admin-auth'
import { sendKakaoAlimtalk } from '@/lib/alimtalk'

/**
 * POST /api/admin/users/[userId]/send-alimtalk
 * 마스터 어드민이 특정 운영사의 호실에 알림톡 발송
 * body: { roomIds: string[], type: 'UNPAID_REMINDER' | 'PAYMENT_CONFIRM' }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const master = await verifyMasterAdmin(req)
  if (!master) {
    return NextResponse.json({ error: '마스터 어드민 권한이 필요합니다.' }, { status: 403 })
  }

  try {
    const { userId } = await params
    const body = await req.json()
    const { roomIds, type } = body as { roomIds: string[]; type: 'UNPAID_REMINDER' | 'PAYMENT_CONFIRM' }

    if (!roomIds || roomIds.length === 0) {
      return NextResponse.json({ error: '호실 ID가 필요합니다.' }, { status: 400 })
    }

    const admin = makeAdminClient()

    // 해당 운영사(userId) 소유 호실만 대상으로 조회 (보안)
    const { data: rooms, error: roomError } = await admin
      .from('rooms')
      .select('id, name, tenant_name, tenant_contact, unpaid_amount, unpaid_months, status')
      .in('id', roomIds)
      .eq('owner_id', userId)

    if (roomError) throw roomError

    const results: { roomId: string; room: string; sent: boolean; reason?: string }[] = []
    let sentCount = 0

    for (const room of rooms ?? []) {
      if (!room.tenant_contact) {
        results.push({ roomId: room.id, room: room.name, sent: false, reason: '연락처 없음' })
        continue
      }

      let templateCode: string
      let variables: Record<string, string>

      if (type === 'UNPAID_REMINDER') {
        templateCode = 'KA01TP260302200441583wMOcyLIy71M'
        variables = {
          '#{세입자}': room.tenant_name || '입주사',
          '#{호실}':   room.name,
          '#{금액}':   (room.unpaid_amount || 0).toLocaleString(),
        }
      } else {
        templateCode = 'KA01TP2603022005171505KORmx0Qpva'
        variables = {
          '#{세입자}': room.tenant_name || '입주사',
          '#{호실}':   room.name,
        }
      }

      const sent = await sendKakaoAlimtalk({
        to: room.tenant_contact.replace(/-/g, ''),
        templateCode,
        variables,
      })

      results.push({ roomId: room.id, room: room.name, sent })
      if (sent) sentCount++
    }

    return NextResponse.json({
      success: true,
      message: `${sentCount}건 발송 완료 (실패: ${results.length - sentCount}건)`,
      results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/admin/users/[userId]/send-alimtalk]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
