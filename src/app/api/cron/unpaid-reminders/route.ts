/**
 * Cron: 매월 11일 09:00 - 미납 독촉 알림톡 발송
 * vercel.json: { "crons": [{ "path": "/api/cron/unpaid-reminders", "schedule": "0 0 11 * *" }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'
import { sendKakaoAlimtalk } from '@/lib/alimtalk'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  /* ─── 미납 인보이스 + 호실 조회 ─── */
  const { data: unpaid, error } = await supabase
    .from('invoices')
    .select('id, amount, room_id, rooms(name, tenant_name, tenant_phone)')
    .eq('year', year)
    .eq('month', month)
    .in('status', ['ready', 'overdue'])

  if (error) {
    console.error('[Cron:unpaid-reminders] fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0, failed = 0

  for (const inv of (unpaid || [])) {
    const room = (inv as Record<string, unknown>).rooms as {
      name: string; tenant_name?: string; tenant_phone?: string
    } | null

    if (!room?.tenant_phone) { failed++; continue }

    try {
      await sendKakaoAlimtalk({
        templateKey:  'UNPAID_REMINDER',
        to:           room.tenant_phone,
        variables:    {
          '#{호실}':   room.name,
          '#{금액}':   inv.amount.toLocaleString(),
          '#{세입자}': room.tenant_name ?? '',
        },
      })

      // overdue 상태로 업데이트
      await supabase.from('invoices').update({ status: 'overdue' }).eq('id', inv.id)

      // 발송 로그
      await supabase.from('notification_logs').insert({
        room_id:        inv.room_id,
        template_key:   'UNPAID_REMINDER',
        recipient_name: room.tenant_name ?? null,
        recipient_phone: room.tenant_phone,
        status:         'success',
      })
      sent++
    } catch (e) {
      console.error('[Cron:unpaid-reminders] 발송 실패:', room.tenant_phone, e)
      await supabase.from('notification_logs').insert({
        room_id:        inv.room_id,
        template_key:   'UNPAID_REMINDER',
        recipient_name: room.tenant_name ?? null,
        recipient_phone: room.tenant_phone,
        status:         'failed',
      })
      failed++
    }
  }

  console.log(`[Cron:unpaid-reminders] 발송완료: ${sent}건 성공, ${failed}건 실패`)
  return NextResponse.json({ ok: true, sent, failed, year, month })
}
