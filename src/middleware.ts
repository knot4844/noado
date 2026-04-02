import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const url      = request.nextUrl.clone()
  const pathname = url.pathname

  // Supabase 인증 코드/에러가 루트로 리다이렉트된 경우 → 적절한 페이지로 전달
  if (pathname === '/') {
    // PKCE 코드가 루트로 온 경우 → /auth/callback으로 전달
    const code = url.searchParams.get('code')
    if (code) {
      url.pathname = '/auth/callback'
      // 기존 쿼리 파라미터 유지 (code, type, next 등)
      return NextResponse.redirect(url)
    }

    // 에러가 루트로 온 경우 → /login으로 전달
    const errorCode = url.searchParams.get('error_code')
    const errorDesc = url.searchParams.get('error_description')
    const errorParam = url.searchParams.get('error')
    if (errorParam || errorCode) {
      url.pathname = '/login'
      if (errorCode === 'otp_expired') {
        url.search = `?error=${encodeURIComponent('비밀번호 재설정 링크가 만료되었습니다. 다시 요청해주세요.')}`
      } else if (errorDesc) {
        url.search = `?error=${encodeURIComponent(errorDesc)}`
      }
      return NextResponse.redirect(url)
    }
  }

  // 공개 경로 (인증 불필요)
  const isPublicPath =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/complete-profile' ||   // 프로필 완성 (카카오 가입 후)
    pathname === '/master-admin/login' || // 마스터 어드민 로그인 페이지
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/portal/') ||   // 임차인 포털 (토큰 기반 접근)
    pathname.startsWith('/invite/') ||   // 초대 링크
    pathname.startsWith('/pay/')         // 세입자 결제 페이지

  // 임대인 전용 경로 (임차인 role 접근 차단)
  const isLandlordPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/units') ||
    pathname.startsWith('/rooms') ||
    pathname.startsWith('/tenants') ||
    pathname.startsWith('/payments') ||
    pathname.startsWith('/contracts') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/seed-demo') ||
    pathname.startsWith('/master-admin')

  // 비로그인 → 보호된 경로 접근 시 로그인으로
  if (!user && !isPublicPath) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 로그인 상태 → /login 또는 /signup 접근 시 대시보드로
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const role = user.user_metadata?.role || 'LANDLORD'
    url.pathname = role === 'TENANT' ? '/portal' : '/dashboard'
    return NextResponse.redirect(url)
  }

  // 로그인 상태 + 휴대폰 미등록 → 프로필 완성 페이지로 리다이렉트
  if (user && isLandlordPath && pathname !== '/complete-profile') {
    const phone = user.user_metadata?.phone
    if (!phone) {
      url.pathname = '/complete-profile'
      return NextResponse.redirect(url)
    }
  }

  // 임차인이 임대인 경로 접근 시 포털로
  if (user && isLandlordPath) {
    const role = user.user_metadata?.role || 'LANDLORD'
    if (role === 'TENANT') {
      url.pathname = '/portal'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
