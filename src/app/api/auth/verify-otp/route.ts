/**
 * POST /api/auth/verify-otp
 * OTP 인증번호 검증
 * body: { phone: "01012345678", code: "123456" }
 */
import { NextRequest, NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/alimtalk'

// send-otp와 동일한 저장소 참조
type OtpEntry = { code: string; expiresAt: number }
const g = globalThis as unknown as { __otpStore?: Map<string, OtpEntry> }
if (!g.__otpStore) g.__otpStore = new Map()
const otpStore = g.__otpStore

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json()
    if (!phone || !code) {
      return NextResponse.json({ error: '번호와 인증번호를 입력해주세요.' }, { status: 400 })
    }

    const normalized = normalizePhone(phone)
    const stored = otpStore.get(normalized)

    if (!stored) {
      return NextResponse.json({ error: '인증번호를 먼저 요청해주세요.' }, { status: 400 })
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(normalized)
      return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }, { status: 400 })
    }

    if (stored.code !== code) {
      return NextResponse.json({ error: '인증번호가 올바르지 않습니다.' }, { status: 400 })
    }

    // 인증 성공 → 삭제
    otpStore.delete(normalized)

    console.log(`✅ [OTP] ${normalized} 인증 성공`)
    return NextResponse.json({ ok: true, verified: true })
  } catch (err) {
    console.error('[verify-otp] 에러:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
