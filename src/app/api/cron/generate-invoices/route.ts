/**
 * Cron: 매월 1일 00:00 - 청구서 일괄 생성
 * vercel.json: { "crons": [{ "path": "/api/cron/generate-invoices", "schedule": "0 0 1 * *" }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

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
    .select('id, owner_id, monthly_rent')
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

  const { error: insertErr } = await supabase.from('invoices').insert(
    newRooms.map(r => ({
      owner_id:    r.owner_id,
      room_id:     r.id,
      year,
      month,
      amount:      r.monthly_rent,
      paid_amount: 0,
      status:      'ready',
      due_date:    dueDate,
    }))
  )

  if (insertErr) {
    console.error('[Cron:generate-invoices] insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  console.log(`[Cron:generate-invoices] ${newRooms.length}건 청구서 생성 (${year}-${month})`)
  return NextResponse.json({ ok: true, created: newRooms.length, year, month })
}
