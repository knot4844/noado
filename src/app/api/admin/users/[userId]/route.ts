/**
 * GET /api/admin/users/[userId]
 * 마스터 어드민: 특정 운영사의 전체 데이터 조회
 * - 호실, 청구서, 결제로그, 계약, 알림톡 로그
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyMasterAdmin } from '@/lib/admin-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ctx = await verifyMasterAdmin(req)
  if (!ctx) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { admin } = ctx
  const { userId } = await params

  /* 1) 유저 기본 정보 */
  const { data: { user }, error: userErr } = await admin.auth.admin.getUserById(userId)
  if (userErr || !user) return NextResponse.json({ error: '유저 없음' }, { status: 404 })

  /* 2) 사업장 */
  const { data: businesses } = await admin
    .from('businesses')
    .select('*')
    .eq('owner_id', userId)

  /* 3) 호실 + leases→tenants 병합 */
  const { data: rawRooms } = await admin
    .from('rooms')
    .select('id, name, status, owner_id, business_id, building, area, memo, created_at')
    .eq('owner_id', userId)
    .order('name')

  const { data: leaseData } = await admin
    .from('leases')
    .select('room_id, monthly_rent, pledge_amount, lease_start, lease_end, payment_day, status, tenant:tenants(name, phone, email)')
    .eq('owner_id', userId)
    .eq('status', 'ACTIVE')

  // rooms에 lease 정보 병합
  const leaseByRoom: Record<string, Record<string, unknown>> = {}
  for (const l of (leaseData ?? []) as unknown as { room_id: string; monthly_rent: number; pledge_amount: number; lease_start: string; lease_end: string; tenant: { name: string; phone: string; email: string } | { name: string; phone: string; email: string }[] | null }[]) {
    const t = Array.isArray(l.tenant) ? l.tenant[0] : l.tenant
    leaseByRoom[l.room_id] = {
      tenant_name:  t?.name ?? null,
      tenant_phone: t?.phone ?? null,
      tenant_email: t?.email ?? null,
      monthly_rent: l.monthly_rent ?? 0,
      deposit:      l.pledge_amount ?? 0,
      lease_start:  l.lease_start,
      lease_end:    l.lease_end,
    }
  }
  const rooms = (rawRooms ?? []).map(r => ({
    ...r,
    tenant_name:  null as string | null,
    tenant_phone: null as string | null,
    monthly_rent: 0,
    deposit:      0,
    lease_start:  null as string | null,
    lease_end:    null as string | null,
    ...(leaseByRoom[r.id] || {}),
  }))

  /* 4) 청구서 (최근 6개월) */
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const { data: invoices } = await admin
    .from('invoices')
    .select('*, rooms(name)')
    .eq('owner_id', userId)
    .gte('created_at', sixMonthsAgo.toISOString())
    .order('created_at', { ascending: false })

  /* 5) 결제 로그 */
  const { data: payments } = await admin
    .from('payments')
    .select('*, rooms(name)')
    .eq('owner_id', userId)
    .order('paid_at', { ascending: false })
    .limit(50)

  /* 6) 전자계약 */
  const { data: contracts } = await admin
    .from('contracts')
    .select('*, rooms(name)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  /* 7) 알림톡 로그 */
  const { data: notifications } = await admin
    .from('notification_logs')
    .select('*, rooms(name)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  /* 8) KPI 집계 */
  const roomList  = rooms ?? []
  const invList   = invoices ?? []
  const now = new Date()
  const thisYear  = now.getFullYear()
  const thisMonth = now.getMonth() + 1

  const thisMonthInvoices = invList.filter(i => i.year === thisYear && i.month === thisMonth)
  const totalRent    = thisMonthInvoices.reduce((s, i) => s + (i.amount ?? 0), 0)
  const paidRent     = thisMonthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.paid_amount ?? 0), 0)
  const unpaidRent   = totalRent - paidRent
  const occupiedRooms = roomList.filter(r => r.status !== 'VACANT').length
  const totalRooms    = roomList.length

  const bannedUntil = (user as unknown as { banned_until?: string }).banned_until
  const isBanned    = !!bannedUntil && new Date(bannedUntil) > new Date()

  return NextResponse.json({
    user: {
      id:         user.id,
      email:      user.email ?? '',
      name:       user.user_metadata?.name ?? user.user_metadata?.full_name ?? '',
      phone:      user.user_metadata?.phone ?? '',
      createdAt:  user.created_at,
      lastSignIn: user.last_sign_in_at ?? null,
      isBanned,
    },
    businesses:    businesses ?? [],
    rooms:         roomList,
    invoices:      invList,
    payments:      payments ?? [],
    contracts:     contracts ?? [],
    notifications: notifications ?? [],
    kpi: {
      totalRooms,
      occupiedRooms,
      vacantRooms:      totalRooms - occupiedRooms,
      occupancyRate:    totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
      thisMonthTotal:   totalRent,
      thisMonthPaid:    paidRent,
      thisMonthUnpaid:  unpaidRent,
      paidCount:        thisMonthInvoices.filter(i => i.status === 'paid').length,
      unpaidCount:      thisMonthInvoices.filter(i => i.status !== 'paid').length,
      totalContracts:   (contracts ?? []).length,
      activeContracts:  (contracts ?? []).filter(c => c.status === 'signed').length,
      totalNotifications: (notifications ?? []).length,
      failedNotifications: (notifications ?? []).filter(n => n.status === 'failed').length,
    },
  })
}
