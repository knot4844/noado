import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url    = new URL(request.url)
  const origin = url.origin

  const code       = url.searchParams.get('code')
  const token_hash = url.searchParams.get('token_hash')
  const type       = url.searchParams.get('type')
  const next       = url.searchParams.get('next') ?? '/dashboard'

  // Supabase가 에러를 파라미터로 보낸 경우
  const errorParam = url.searchParams.get('error')
  const errorDesc  = url.searchParams.get('error_description')
  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDesc || errorParam)}`
    )
  }

  const supabase = await createClient()

  // 비밀번호 재설정(recovery) 여부 판별
  const isRecovery = type === 'recovery'

  // 방법 1: PKCE 코드 플로우
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      )
    }
    // PKCE에서도 recovery 감지 → 설정 페이지로 이동
    if (isRecovery) {
      return NextResponse.redirect(`${origin}/settings?reset=true`)
    }
  }
  // 방법 2: token_hash 플로우 (이메일 OTP / 새 Supabase 버전)
  else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change',
    })
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      )
    }
    // 비밀번호 재설정 플로우 → 설정 페이지로 이동
    if (isRecovery) {
      return NextResponse.redirect(`${origin}/settings?reset=true`)
    }
  }

  // 세션 확인 후 역할에 맞게 이동
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const role = user.user_metadata?.role
    // next 파라미터에 recovery 경로가 포함된 경우 (PKCE 폴백)
    const decodedNext = decodeURIComponent(next)
    if (decodedNext.includes('reset=true')) {
      return NextResponse.redirect(`${origin}/settings?reset=true`)
    }
    return NextResponse.redirect(
      `${origin}${role === 'TENANT' ? '/portal' : decodedNext}`
    )
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('인증 처리 중 문제가 발생했습니다. 다시 시도해주세요.')}`
  )
}
