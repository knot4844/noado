/**
 * POST /api/admin/users/[userId]/manage
 * 마스터 어드민: 임대인 계정 관리
 * body: { action: 'suspend' | 'activate' | 'delete' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyMasterAdmin } from '@/lib/admin-auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ctx = await verifyMasterAdmin(req)
  if (!ctx) return NextResponse.json({ error: '마스터 어드민 권한이 필요합니다.' }, { status: 403 })

  const { userId } = await params
  const { action } = await req.json() as { action: 'suspend' | 'activate' | 'delete' }

  if (!['suspend', 'activate', 'delete'].includes(action)) {
    return NextResponse.json({ error: '잘못된 action입니다.' }, { status: 400 })
  }

  // 마스터 어드민 본인 계정은 조작 불가
  if (userId === ctx.user.id) {
    return NextResponse.json({ error: '본인 계정은 변경할 수 없습니다.' }, { status: 400 })
  }

  const { admin } = ctx

  try {
    if (action === 'suspend') {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: '87600h', // 10년 = 사실상 영구 정지
      })
      if (error) throw error
      return NextResponse.json({ success: true, message: '계정이 정지되었습니다.' })
    }

    if (action === 'activate') {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      })
      if (error) throw error
      return NextResponse.json({ success: true, message: '계정이 활성화되었습니다.' })
    }

    if (action === 'delete') {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) throw error
      return NextResponse.json({ success: true, message: '계정이 삭제되었습니다.' })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[POST /api/admin/users/${userId}/manage] action=${action}`, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
