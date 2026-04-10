/**
 * GET  /api/billing?businessId=xxx
 *   이번 달 청구서 목록 (room 정보 포함)
 *
 * POST /api/billing
 *   { action: 'common_fee',  businessId, amount }
 *     → 이번 달 청구서 전체에 금액 추가
 *   { action: 'utilities',   businessId, entries: [{ roomId, amount }] }
 *     → 호실별 실비 추가
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!

function makeAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function authenticate(req: NextRequest) {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const token = auth.replace('Bearer ', '').trim()
  const admin = makeAdmin()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  return { user, admin }
}

/* ─── GET ─── */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  const { user, admin } = ctx

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  let query = admin
    .from('invoices')
    .select('*, rooms(id, name, status, business_id)')
    .eq('owner_id', user.id)
    .eq('year', year)
    .eq('month', month)
    .order('created_at', { ascending: false })

  if (businessId && businessId !== 'ALL') {
    // rooms.business_id 로 필터링하기 위해 rooms 조인 후 필터
    const { data: roomIds } = await admin
      .from('rooms')
      .select('id')
      .eq('business_id', businessId)
      .eq('owner_id', user.id)

    if (roomIds && roomIds.length > 0) {
      query = query.in('room_id', roomIds.map((r: { id: string }) => r.id))
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // leases → tenants 경유로 입주사 정보 보강 (rooms 테이블에서 tenant_* 컬럼 제거됨)
  const invoiceRows = data ?? []
  if (invoiceRows.length > 0) {
    const roomIds = [...new Set(invoiceRows.map((i: { room_id: string }) => i.room_id))]
    const { data: leaseData } = await admin
      .from('leases')
      .select('room_id, monthly_rent, tenant:tenants(name, phone)')
      .eq('status', 'ACTIVE')
      .in('room_id', roomIds)

    const leaseByRoom: Record<string, { tenant_name: string | null; tenant_contact: string | null; monthly_rent: number | null }> = {}
    for (const l of (leaseData ?? []) as unknown as { room_id: string; monthly_rent: number | null; tenant: { name: string; phone: string } | { name: string; phone: string }[] | null }[]) {
      const t = Array.isArray(l.tenant) ? l.tenant[0] : l.tenant
      leaseByRoom[l.room_id] = {
        tenant_name: t?.name ?? null,
        tenant_contact: t?.phone ?? null,
        monthly_rent: l.monthly_rent,
      }
    }

    // rooms 객체에 tenant 정보 병합 (프론트엔드 호환성 유지)
    for (const inv of invoiceRows) {
      const room = (inv as { rooms: Record<string, unknown> | null }).rooms
      const lease = leaseByRoom[(inv as { room_id: string }).room_id]
      if (room && lease) {
        room.tenant_name = lease.tenant_name
        room.tenant_contact = lease.tenant_contact
        room.monthly_rent = lease.monthly_rent
      }
    }
  }

  return NextResponse.json({ invoices: invoiceRows, year, month })
}

/* ─── POST ─── */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  const { user, admin } = ctx

  const body = await req.json()
  const { action, businessId, amount, entries } = body

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  /* 이번 달 청구서 조회 (businessId 필터 포함) */
  let invoiceIds: string[] = []

  if (action === 'common_fee') {
    // 해당 businessId 의 이번 달 모든 청구서 조회
    let roomQuery = admin
      .from('rooms')
      .select('id')
      .eq('owner_id', user.id)

    if (businessId && businessId !== 'ALL') {
      roomQuery = roomQuery.eq('business_id', businessId)
    }

    const { data: roomIds } = await roomQuery

    if (!roomIds || roomIds.length === 0) {
      return NextResponse.json({ error: '호실 없음' }, { status: 400 })
    }

    const { data: invoices } = await admin
      .from('invoices')
      .select('id, amount')
      .eq('owner_id', user.id)
      .eq('year', year)
      .eq('month', month)
      .in('room_id', roomIds.map((r: { id: string }) => r.id))
      .neq('status', 'paid')

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ error: '적용할 청구서가 없습니다.' }, { status: 400 })
    }

    // 각 청구서 금액 업데이트
    const updates = invoices.map((inv: { id: string; amount: number }) =>
      admin.from('invoices')
        .update({ amount: (inv.amount ?? 0) + Number(amount) })
        .eq('id', inv.id)
        .eq('owner_id', user.id)
    )
    await Promise.all(updates)
    invoiceIds = invoices.map((i: { id: string }) => i.id)

    return NextResponse.json({ ok: true, updated: invoiceIds.length, year, month })
  }

  if (action === 'utilities') {
    // entries: [{ roomId, amount }]
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'entries 필요' }, { status: 400 })
    }

    const results = []
    for (const entry of entries) {
      const { roomId, amount: utilAmt } = entry
      if (!utilAmt || Number(utilAmt) <= 0) continue

      // 해당 호실의 이번달 청구서 조회
      const { data: inv } = await admin
        .from('invoices')
        .select('id, amount')
        .eq('owner_id', user.id)
        .eq('room_id', roomId)
        .eq('year', year)
        .eq('month', month)
        .neq('status', 'paid')
        .single()

      if (inv) {
        await admin
          .from('invoices')
          .update({ amount: (inv.amount ?? 0) + Number(utilAmt) })
          .eq('id', inv.id)
          .eq('owner_id', user.id)
        results.push(inv.id)
      }
    }

    return NextResponse.json({ ok: true, updated: results.length, year, month })
  }

  return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
}
