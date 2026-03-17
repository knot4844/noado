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

  /* ─── 현재 활성 입주사 조회 (임대료·연락처·tenant_id 세팅용) ─── */
  const today = now.toISOString().split('T')[0]
  const { data: activeTenants } = await supabase
    .from('tenants')
    .select('id, room_id, name, phone, monthly_rent')
    .in('room_id', newRooms.map(r => r.id))
    .or(`lease_end.is.null,lease_end.gte.${today}`)

  type ActiveTenant = { id: string; room_id: string; name: string; phone: string | null; monthly_rent: number }
  const tenantByRoom: Record<string, ActiveTenant> = {}
  for (const t of (activeTenants || []) as ActiveTenant[]) tenantByRoom[t.room_id] = t

  const { data: insertedInvoices, error: insertErr } = await supabase.from('invoices').insert(
    newRooms.map(r => {
      const tenant = tenantByRoom[r.id]
      return {
        owner_id:    r.owner_id,
        room_id:     r.id,
        tenant_id:   tenant?.id || null,
        year,
        month,
        // tenants.monthly_rent 우선, 없으면 rooms.monthly_rent 폴백
        amount:      tenant?.monthly_rent ?? r.monthly_rent,
        paid_amount: 0,
        status:      'ready',
        due_date:    new Date(year, month - 1, r.payment_day || 10).toISOString().split('T')[0],
      }
    })
  ).select()

  if (insertErr) {
    console.error('[Cron:generate-invoices] insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  /* ─── 청구서 발행 알림톡 발송 (결제 링크 포함) ─── */
  if (insertedInvoices && insertedInvoices.length > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.noado.kr'
    for (const inv of insertedInvoices) {
      const room   = newRooms.find(r => r.id === inv.room_id)
      const tenant = tenantByRoom[inv.room_id]
      // 연락처: tenants.phone 우선, 없으면 rooms.tenant_phone 폴백
      const phone     = tenant?.phone || room?.tenant_phone
      const name      = tenant?.name  || room?.tenant_name || '입주자님'
      const amount    = inv.amount ?? tenant?.monthly_rent ?? room?.monthly_rent ?? 0
      if (room && phone) {
        const paymentLink = `${baseUrl}/pay/${inv.id}`

        // 1. 카카오톡 발송
        let status: 'success' | 'failed' = 'success'
        try {
          const ok = await sendKakaoAlimtalk({
            templateKey: 'INVOICE_ISSUED',
            to: phone,
            variables: {
              '#{세입자}':   name,
              '#{호실}':     room.name,
              '#{금액}':     String(amount),
              '#{기한}':     inv.due_date || '',
              '#{결제링크}': paymentLink,
            }
          })
          if (!ok) status = 'failed'
        } catch (e) {
          console.error('[Cron:generate-invoices] 발송 에러:', e)
          status = 'failed'
        }

        // 2. 발송 로그 DB 기록
        await supabase.from('notification_logs').insert({
          owner_id:        room.owner_id,
          room_id:         room.id,
          template_key:    'INVOICE_ISSUED',
          recipient_name:  name,
          recipient_phone: phone.replace(/[\s\-]/g, ''),
          status,
        })
      }
    }
  }

  console.log(`[Cron:generate-invoices] ${newRooms.length}건 청구서 생성 (${year}-${month})`)
  return NextResponse.json({ ok: true, created: newRooms.length, year, month })
}
