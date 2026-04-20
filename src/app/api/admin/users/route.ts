/**
 * GET /api/admin/users
 * 마스터 어드민: 전체 운영사 목록 조회
 * - auth.users + businesses + 호실/청구서 집계
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyMasterAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  const ctx = await verifyMasterAdmin(req)
  if (!ctx) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { admin } = ctx

  /* 1) 모든 auth 유저 목록 (페이지당 1000명) */
  const { data: authData, error: authErr } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  /* LANDLORD 역할만 (TENANT 제외) */
  const landlords = (authData.users ?? []).filter(u => {
    const role = u.user_metadata?.role ?? 'LANDLORD'
    return role !== 'TENANT'
  })

  /* 2) businesses */
  const { data: businesses } = await admin
    .from('businesses')
    .select('id, name, owner_id, created_at')

  /* 3) 호실 수 집계 */
  const { data: rooms } = await admin
    .from('rooms')
    .select('owner_id, status')

  /* 4) 청구서 미납 수 집계 */
  const { data: invoices } = await admin
    .from('invoices')
    .select('owner_id, status')

  /* 조합 */
  const bizMap = new Map((businesses ?? []).map(b => [b.owner_id, b]))
  // rooms.status 는 이제 입주/퇴실/공실만 의미. 미납 수는 invoices 에서 집계
  const roomMap = new Map<string, { total: number; vacant: number }>()
  ;(rooms ?? []).forEach(r => {
    if (!roomMap.has(r.owner_id)) roomMap.set(r.owner_id, { total: 0, vacant: 0 })
    const m = roomMap.get(r.owner_id)!
    m.total++
    if (r.status === 'VACANT')  m.vacant++
  })

  const invoiceMap = new Map<string, { total: number; unpaid: number }>()
  ;(invoices ?? []).forEach(i => {
    if (!invoiceMap.has(i.owner_id)) invoiceMap.set(i.owner_id, { total: 0, unpaid: 0 })
    const m = invoiceMap.get(i.owner_id)!
    m.total++
    if (i.status !== 'paid') m.unpaid++
  })

  const result = landlords.map(u => {
    const biz       = bizMap.get(u.id)
    const rm        = roomMap.get(u.id)   ?? { total: 0, vacant: 0 }
    const inv       = invoiceMap.get(u.id) ?? { total: 0, unpaid: 0 }
    const bannedUntil = (u as unknown as { banned_until?: string }).banned_until
    const isBanned  = !!bannedUntil && new Date(bannedUntil) > new Date()
    return {
      id:           u.id,
      email:        u.email ?? '',
      name:         u.user_metadata?.name ?? u.user_metadata?.full_name ?? '',
      phone:        u.user_metadata?.phone ?? '',
      bizName:      biz?.name ?? '',
      createdAt:    u.created_at,
      lastSignIn:   u.last_sign_in_at ?? null,
      isBanned,
      rooms:        rm,
      invoices:     inv,
    }
  })

  /* 최근 가입순 정렬 */
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json({ users: result })
}
