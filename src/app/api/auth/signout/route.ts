import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // request.url의 origin 기준으로 리다이렉트 (로컬/프로덕션 모두 정확히 동작)
  const url = new URL('/login', request.url)
  return NextResponse.redirect(url, { status: 302 })
}
