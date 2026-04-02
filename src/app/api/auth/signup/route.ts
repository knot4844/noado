/**
 * POST /api/auth/signup
 * SMS 인증 완료 후 회원가입 처리
 * - Admin API로 유저 생성 (이메일 인증 스킵, 즉시 확인 처리)
 * - user_metadata에 이름, 휴대폰 번호 저장
 *
 * body: { name, phone, email, password }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, password } = await req.json()

    if (!name || !phone || !email || !password) {
      return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
    }

    // 이메일 중복 체크
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
    const duplicate = existing?.users?.find(u => u.email === email)
    if (duplicate) {
      return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 409 })
    }

    // Admin API로 유저 생성 (email_confirm: true → 이메일 인증 스킵)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        name,
        phone,
      },
    })

    if (error) {
      console.error('[signup] createUser 에러:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, userId: data.user.id })
  } catch (err) {
    console.error('[signup] 서버 오류:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
