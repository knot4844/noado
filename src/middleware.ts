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

  // 공개 경로 (인증 불필요)
  const isPublicPath =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/portal/') ||   // 임차인 포털 (토큰 기반 접근)
    pathname.startsWith('/invite/')      // 초대 링크

  // 임대인 전용 경로
  const isLandlordPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/units') ||
    pathname.startsWith('/tenants') ||
    pathname.startsWith('/payments') ||
    pathname.startsWith('/contracts') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings')

  // 비로그인 → 보호된 경로 접근 시 로그인으로
  if (!user && !isPublicPath) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 로그인 상태 → /login 접근 시 대시보드로
  if (user && pathname === '/login') {
    const role = user.user_metadata?.role || 'LANDLORD'
    url.pathname = role === 'TENANT' ? '/portal' : '/dashboard'
    return NextResponse.redirect(url)
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
