/**
 * Cron: 매월 1일 00:00 - 청구서 일괄 생성
 * vercel.json: { "crons": [{ "path": "/api/cron/generate-invoices", "schedule": "0 0 1 * *" }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'
import { sendKakaoAlimtalk } from '@/lib/alimtalk'

export async function GET(req: NextRequest) {
  /* ─── CRON_SECRET 검증 ─── */
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // 납부 기한: 해당 월 10일
  const dueDate = new Date(year, month - 1, 10).toISOString().split('T')[0]

  /* ─── 모든 임대인의 입주 중인 호실 조회 ─── */
  const { data: rooms, error: roomErr } = await supabase
    .from('rooms')
    .select('id, owner_id, monthly_rent, payment_day, tenant_name, tenant_phone, name')
    .neq('status', 'VACANT')

  if (roomErr || !rooms) {
    console.error('[Cron:generate-invoices] rooms fetch error:', roomErr)
    return NextResponse.json({ error: roomErr?.message }, { status: 500 })
  }

  /* ─── 이미 생성된 청구서 제외 (멱등성) ─── */
  const { data: existing } = await supabase
    .from('invoices')
    .select('room_id')
    .eq('year', year)
    .eq('month', month)

  const existingRoomIds = new Set((existing || []).map(e => e.room_id))
  const newRooms = rooms.filter(r => !existingRoomIds.has(r.id))

  if (newRooms.length === 0) {
    console.log('[Cron:generate-invoices] 모든 청구서 이미 생성됨')
    return NextResponse.json({ ok: true, created: 0 })
  }

  const { data: insertedInvoices, error: insertErr } = await supabase.from('invoices').insert(
    newRooms.map(r => ({
      owner_id:    r.owner_id,
      room_id:     r.id,
      year,
      month,
      amount:      r.monthly_rent,
      paid_amount: 0,
      status:      'ready',
      due_date:    new Date(year, month - 1, r.payment_day || 10).toISOString().split('T')[0],
    }))
  ).select()

  if (insertErr) {
    console.error('[Cron:generate-invoices] insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  /* ─── 청구서 발행 알림톡 발송 (결제 링크 포함) ─── */
  if (insertedInvoices && insertedInvoices.length > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.noado.kr'
    for (const inv of insertedInvoices) {
      const room = newRooms.find(r => r.id === inv.room_id)
      if (room && room.tenant_phone) {
        const paymentLink = `${baseUrl}/pay/${inv.id}`
        
        // 1. 카카오톡 발송
        let status: 'success' | 'failed' = 'success'
        try {
          const ok = await sendKakaoAlimtalk({
             templateKey: 'INVOICE_ISSUED',
             to: room.tenant_phone,
             variables: {
               '#{세입자}': room.tenant_name || '입주자님',
               '#{호실}': room.name,
               '#{금액}': String(room.monthly_rent),
               '#{기한}': inv.due_date || '',
               '#{결제링크}': paymentLink
             }
          })
          if (!ok) status = 'failed'
        } catch (e) {
          console.error('[Cron:generate-invoices] 발송 에러:', e)
          status = 'failed'
        }

        // 2. 발송 로그 DB 기록
        await supabase.from('notification_logs').insert({
           owner_id: room.owner_id,
           room_id: room.id,
           template_key: 'INVOICE_ISSUED',
           recipient_name: room.tenant_name || null,
           recipient_phone: room.tenant_phone.replace(/[\s\-]/g, ''),
           status
        })
      }
    }
  }

  console.log(`[Cron:generate-invoices] ${newRooms.length}건 청구서 생성 (${year}-${month})`)
  return NextResponse.json({ ok: true, created: newRooms.length, year, month })
}
