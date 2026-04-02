/**
 * POST /api/auth/send-otp
 * Solapi SMS로 인증번호 발송
 * body: { phone: "01012345678" }
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, normalizePhone } from '@/lib/alimtalk'

// 메모리 OTP 저장소 (프로덕션에서는 Redis/DB 사용 권장)
// key: phone, value: { code, expiresAt }
type OtpEntry = { code: string; expiresAt: number }
const g = globalThis as unknown as { __otpStore?: Map<string, OtpEntry> }
if (!g.__otpStore) g.__otpStore = new Map()
const otpStore = g.__otpStore

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone) {
      return NextResponse.json({ error: '휴대폰 번호를 입력해주세요.' }, { status: 400 })
    }

    const normalized = normalizePhone(phone)
    if (!normalized.match(/^010\d{8}$/)) {
      return NextResponse.json({ error: '올바른 휴대폰 번호를 입력해주세요.' }, { status: 400 })
    }

    // 재발송 제한 (60초)
    const existing = otpStore.get(normalized)
    if (existing && existing.expiresAt - Date.now() > 4 * 60 * 1000) {
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 })
    }

    // 6자리 인증번호 생성
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5분

    // 저장
    otpStore.set(normalized, { code, expiresAt })

    // SMS 발송
    const sent = await sendSMS(normalized, `[노아도] 인증번호: ${code}\n5분 내에 입력해주세요.`)

    if (!sent) {
      otpStore.delete(normalized)
      return NextResponse.json({ error: 'SMS 발송에 실패했습니다.' }, { status: 500 })
    }

    console.log(`✅ [OTP] ${normalized} → ${code} (5분 유효)`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-otp] 에러:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
