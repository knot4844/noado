/**
 * 마스터 어드민 인증 유틸
 * - Bearer 토큰 검증 + MASTER_ADMIN_EMAILS 화이트리스트 확인
 * - API Route에서만 사용 (서버사이드)
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function verifyMasterAdmin(req: NextRequest) {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null

  const token  = auth.replace('Bearer ', '').trim()
  const admin  = makeAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null

  const whitelist = (process.env.MASTER_ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim()).filter(Boolean)
  if (!whitelist.includes(user.email ?? '')) return null

  return { user, admin }
}
