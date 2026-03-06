/**
 * Cron: 매일 08:00 - AI 일일 브리핑 생성 및 캐시
 * vercel.json: { "crons": [{ "path": "/api/cron/daily-briefing", "schedule": "0 23 * * *" }] }
 * (UTC 23:00 = KST 08:00)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  /* ─── 모든 임대인의 이달 현황 집계 ─── */
  const { data: owners } = await supabase
    .from('rooms')
    .select('owner_id')
    .neq('status', 'VACANT')

  if (!owners) return NextResponse.json({ ok: true, skipped: 'no owners' })

  const ownerIds = [...new Set(owners.map(o => o.owner_id))]

  for (const ownerId of ownerIds) {
    const [{ data: rooms }, { data: invoices }] = await Promise.all([
      supabase.from('rooms').select('id, status').eq('owner_id', ownerId),
      supabase.from('invoices').select('status, amount, paid_amount')
        .eq('owner_id', ownerId).eq('year', year).eq('month', month),
    ])

    const totalRooms  = (rooms || []).length
    const paidRooms   = (rooms || []).filter(r => r.status === 'PAID').length
    const unpaidRooms = (rooms || []).filter(r => r.status === 'UNPAID').length
    const vacantRooms = (rooms || []).filter(r => r.status === 'VACANT').length

    const totalAmount = (invoices || []).reduce((s, i) => s + (i.amount || 0), 0)
    const paidAmount  = (invoices || []).reduce((s, i) => s + (i.paid_amount || 0), 0)
    const unpaidAmount= totalAmount - paidAmount

    const occupancyRate = totalRooms > 0 ? Math.round((paidRooms + unpaidRooms) / totalRooms * 100) : 0

    /* ─── AI 브리핑 생성 ─── */
    let briefing = `📊 오늘의 수납 현황 요약\n\n`
    briefing += `• 입주율: ${occupancyRate}% (${paidRooms + unpaidRooms}/${totalRooms}세대)\n`
    briefing += `• 이번달 수납액: ${paidAmount.toLocaleString()}원 / ${totalAmount.toLocaleString()}원\n`
    briefing += `• 미납: ${unpaidRooms}세대 (${unpaidAmount.toLocaleString()}원)\n`

    if (vacantRooms > 0) briefing += `• 공실: ${vacantRooms}세대\n`

    if (unpaidRooms > 0) {
      briefing += `\n⚠️ 미납 ${unpaidRooms}세대에 독촉 알림톡을 고려해보세요.`
    } else {
      briefing += `\n✅ 이번달 수납이 모두 완료되었습니다.`
    }

    // briefings 테이블이 있다면 저장, 없으면 스킵 (옵션)
    // await supabase.from('briefings').upsert({ owner_id: ownerId, date: now.toISOString().split('T')[0], content: briefing })

    console.log(`[Cron:daily-briefing] owner=${ownerId}: ${briefing.slice(0, 80)}...`)
  }

  return NextResponse.json({ ok: true, processed: ownerIds.length })
}
