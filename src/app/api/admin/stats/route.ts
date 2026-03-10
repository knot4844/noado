/**
 * GET /api/admin/stats
 * 마스터 어드민: SaaS 전체 통계
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyMasterAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  const ctx = await verifyMasterAdmin(req)
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 })
  }

  const { admin } = ctx

  try {
    /* ── 1. 임대인 수 (TENANT 역할 제외) ── */
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const landlords = (authData?.users ?? []).filter(u => {
      const role = u.user_metadata?.role ?? 'LANDLORD'
      return role !== 'TENANT'
    })

    /* ── 2. 사업장 수 ── */
    const { count: businessesCount } = await admin
      .from('businesses')
      .select('*', { count: 'exact', head: true })

    /* ── 3. 호실 현황 ── */
    const { data: rooms } = await admin
      .from('rooms')
      .select('status, monthly_rent')

    const roomList      = rooms ?? []
    const totalRooms    = roomList.length
    const occupiedRooms = roomList.filter(r => r.status !== 'VACANT').length
    const unpaidRooms   = roomList.filter(r => r.status === 'UNPAID').length
    const vacantRooms   = roomList.filter(r => r.status === 'VACANT').length

    /* ── 4. 실제 MRR (입주 호실의 월세 합산) ── */
    const monthlyRecurringRevenue = roomList
      .filter(r => r.status !== 'VACANT')
      .reduce((sum, r) => sum + (r.monthly_rent ?? 0), 0)

    /* ── 5. 이번달 수납 현황 ── */
    const now       = new Date()
    const thisYear  = now.getFullYear()
    const thisMonth = now.getMonth() + 1

    const { data: invoices } = await admin
      .from('invoices')
      .select('status, amount, paid_amount')
      .eq('year',  thisYear)
      .eq('month', thisMonth)

    const invList          = invoices ?? []
    const thisMonthTotal   = invList.reduce((s, i) => s + (i.amount ?? 0), 0)
    const thisMonthPaid    = invList.filter(i => i.status === 'paid').reduce((s, i) => s + (i.paid_amount ?? 0), 0)
    const thisMonthUnpaid  = invList.filter(i => i.status !== 'paid').length

    /* ── 6. 최근 가입 사업장 (대시보드 미리보기용) ── */
    const { data: recentBusinesses } = await admin
      .from('businesses')
      .select('id, name, owner_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      stats: {
        totalLandlords:          landlords.length,
        totalBusinesses:         businessesCount ?? 0,
        totalRooms,
        occupiedRooms,
        vacantRooms,
        unpaidRooms,
        totalTenants:            occupiedRooms,    // 입주 호실 = 임차인 수
        monthlyRecurringRevenue,
        thisMonthTotal,
        thisMonthPaid,
        thisMonthUnpaidCount:    thisMonthUnpaid,
        collectionRate:          thisMonthTotal > 0
          ? Math.round((thisMonthPaid / thisMonthTotal) * 100)
          : 0,
      },
      recentBusinesses: recentBusinesses ?? [],
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[GET /api/admin/stats]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
