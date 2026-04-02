/**
 * POST /api/auth/reset-password
 * 휴대폰 번호로 유저 조회 → Supabase Admin API로 재설정 링크 생성 → SMS 발송
 *
 * body: { phone: "01012345678" }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSMS, normalizePhone } from '@/lib/alimtalk'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone) {
      return NextResponse.json({ error: '휴대폰 번호를 입력해주세요.' }, { status: 400 })
    }

    const normalized = normalizePhone(phone)

    // 1. 전체 유저 목록에서 phone 메타데이터로 검색
    const { data: authData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) {
      console.error('[reset-password] listUsers 에러:', listErr)
      return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
    }

    const matchedUser = authData.users.find(u => {
      const userPhone = normalizePhone(u.user_metadata?.phone ?? '')
      return userPhone === normalized
    })

    if (!matchedUser || !matchedUser.email) {
      // 보안상 유저 존재 여부를 노출하지 않음
      return NextResponse.json({ ok: true, message: '등록된 번호라면 메시지가 발송됩니다.' })
    }

    // 2. Supabase Admin API로 재설정 링크 생성
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.noado.kr'
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: matchedUser.email,
      options: {
        redirectTo: `${origin}/auth/callback?type=recovery&next=${encodeURIComponent('/settings?reset=true')}`,
      },
    })

    if (linkErr || !linkData) {
      console.error('[reset-password] generateLink 에러:', linkErr)
      return NextResponse.json({ error: '링크 생성에 실패했습니다.' }, { status: 500 })
    }

    // 3. generateLink가 반환하는 링크에서 token_hash와 type 추출하여 직접 콜백 URL 구성
    // Supabase generateLink는 이메일용 링크를 반환하므로, 직접 콜백 URL을 구성
    const actionLink = linkData.properties?.action_link
    let resetUrl: string

    if (actionLink) {
      // action_link에서 token_hash 추출
      const linkUrl = new URL(actionLink)
      const tokenHash = linkUrl.searchParams.get('token_hash') || linkUrl.searchParams.get('token')
      const hashed_token = linkUrl.hash // fragment에 있을 수도 있음

      if (tokenHash) {
        resetUrl = `${origin}/auth/callback?token_hash=${tokenHash}&type=recovery&next=${encodeURIComponent('/settings?reset=true')}`
      } else {
        // action_link 자체를 사용 (Supabase 호스팅 링크)
        resetUrl = actionLink
      }
    } else {
      return NextResponse.json({ error: '링크 생성에 실패했습니다.' }, { status: 500 })
    }

    // 4. SMS로 재설정 링크 발송
    const userName = matchedUser.user_metadata?.full_name || matchedUser.user_metadata?.name || ''
    const smsText = `[노아도] 비밀번호 재설정\n\n${userName ? userName + '님, ' : ''}아래 링크를 눌러 새 비밀번호를 설정해주세요.\n\n${resetUrl}`

    const sent = await sendSMS(normalized, smsText)

    if (!sent) {
      console.error('[reset-password] SMS 발송 실패:', normalized)
      return NextResponse.json({ error: 'SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
    }

    console.log(`✅ [reset-password] SMS 발송 성공: ${normalized}`)
    return NextResponse.json({ ok: true, message: '등록된 번호라면 메시지가 발송됩니다.' })

  } catch (err) {
    console.error('[reset-password] 서버 오류:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
