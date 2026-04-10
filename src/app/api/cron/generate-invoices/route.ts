/**
 * Cron: 매월 1일 00:00 - 청구서 일괄 생성
 * vercel.json: { "crons": [{ "path": "/api/cron/generate-invoices", "schedule": "0 0 1 * *" }] }
 *
 * 동작:
 *   1. 모든 ACTIVE leases 대상으로 이번 달 청구서 생성 (멱등 — 이미 있으면 스킵)
 *   2. 각 청구서에 대해 PREPAY 잔액이 있으면 자동 차감 (Stage 3)
 *   3. 발송 가능한 입주사에게 결제 링크 알림톡 전송
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'
import { sendKakaoAlimtalk } from '@/lib/alimtalk'
import { deductPrepayForInvoice } from '@/lib/prepay'

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
  const today = now.toISOString().split('T')[0]

  /* ─── ACTIVE leases (room + tenant 조인) ─── */
  const { data: leases, error: leaseErr } = await supabase
    .from('leases')
    .select(`
      id, owner_id, room_id, tenant_id, monthly_rent, payment_day, lease_end,
      room:rooms(id, name),
      tenant:tenants(id, name, phone)
    `)
    .eq('status', 'ACTIVE')
    .or(`lease_end.is.null,lease_end.gte.${today}`)

  if (leaseErr || !leases) {
    console.error('[Cron:generate-invoices] leases fetch error:', leaseErr)
    return NextResponse.json({ error: leaseErr?.message }, { status: 500 })
  }

  type LeaseRow = {
    id: string; owner_id: string; room_id: string; tenant_id: string | null
    monthly_rent: number; payment_day: number; lease_end: string | null
    room:   { id: string; name: string } | { id: string; name: string }[] | null
    tenant: { id: string; name: string; phone: string | null } | { id: string; name: string; phone: string | null }[] | null
  }
  const normLeases = (leases as LeaseRow[]).map(l => ({
    ...l,
    room:   Array.isArray(l.room)   ? (l.room[0]   ?? null) : l.room,
    tenant: Array.isArray(l.tenant) ? (l.tenant[0] ?? null) : l.tenant,
  }))

  /* ─── 이미 생성된 청구서 제외 (멱등) ─── */
  const { data: existing } = await supabase
    .from('invoices')
    .select('lease_id')
    .eq('year', year)
    .eq('month', month)
    .not('lease_id', 'is', null)

  const existingLeaseIds = new Set((existing ?? []).map(e => e.lease_id))
  const newLeases = normLeases.filter(l => !existingLeaseIds.has(l.id))

  if (newLeases.length === 0) {
    console.log('[Cron:generate-invoices] 모든 청구서 이미 생성됨')
    return NextResponse.json({ ok: true, created: 0 })
  }

  /* ─── 청구서 일괄 INSERT ─── */
  const { data: insertedInvoices, error: insertErr } = await supabase
    .from('invoices')
    .insert(
      newLeases.map(l => ({
        owner_id:     l.owner_id,
        room_id:      l.room_id,
        lease_id:     l.id,
        tenant_id:    l.tenant_id,
        year,
        month,
        amount:       l.monthly_rent,
        base_amount:  l.monthly_rent,
        extra_amount: 0,
        paid_amount:  0,
        status:       'ready',
        due_date:     new Date(year, month - 1, l.payment_day || 10).toISOString().split('T')[0],
      }))
    )
    .select()

  if (insertErr) {
    console.error('[Cron:generate-invoices] insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const leaseById = Object.fromEntries(newLeases.map(l => [l.id, l]))

  /* ─── Stage 3: PREPAY 자동 차감 ─── */
  let prepayUsed = 0
  for (const inv of (insertedInvoices ?? [])) {
    const lease = leaseById[inv.lease_id as string]
    if (!lease) continue
    const result = await deductPrepayForInvoice(supabase, {
      ownerId:       lease.owner_id,
      leaseId:       lease.id,
      invoiceId:     inv.id,
      roomId:        lease.room_id,
      invoiceAmount: inv.amount ?? 0,
    })
    if (result.deducted > 0) prepayUsed++
  }

  /* ─── 청구서 발행 알림톡 발송 (결제 링크 포함) ─── */
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.noado.kr'
  for (const inv of (insertedInvoices ?? [])) {
    const lease = leaseById[inv.lease_id as string]
    if (!lease || !lease.tenant?.phone || !lease.room) continue

    // 완납된 청구서(=PREPAY 전액 차감)는 결제 안내 생략
    if (inv.status === 'paid') continue

    const phone  = lease.tenant.phone
    const name   = lease.tenant.name || '입주자님'
    const amount = inv.amount ?? 0
    const paymentLink = `${baseUrl}/pay/${inv.id}`

    let status: 'success' | 'failed' = 'success'
    try {
      const ok = await sendKakaoAlimtalk({
        templateKey: 'INVOICE_ISSUED',
        to: phone,
        variables: {
          '#{세입자}':   name,
          '#{호실}':     lease.room.name,
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

    await supabase.from('notification_logs').insert({
      owner_id:        lease.owner_id,
      room_id:         lease.room_id,
      template_key:    'INVOICE_ISSUED',
      recipient_name:  name,
      recipient_phone: phone.replace(/[\s\-]/g, ''),
      status,
    })
  }

  console.log(`[Cron:generate-invoices] ${newLeases.length}건 청구서 생성, PREPAY 차감 ${prepayUsed}건 (${year}-${month})`)
  return NextResponse.json({ ok: true, created: newLeases.length, prepayUsed, year, month })
}
