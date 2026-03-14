/**
 * POST /api/alimtalk
 * 알림톡 단건 발송 + notification_logs 기록
 *
 * body: {
 *   templateKey: 'UNPAID_REMINDER' | 'PAYMENT_DONE' | 'DAILY_BRIEFING'
 *   phone: string
 *   roomName?: string
 *   tenantName?: string
 *   amount?: string
 *   dueDate?: string
 *   roomId?: string
 * }
 *
 * ⚠️ 아래 getVariables()의 변수 키를 Solapi 대시보드 템플릿 변수명과 일치시켜야 합니다.
 *    대시보드 > 알림톡 > 템플릿 조회 > 변수명 확인
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { sendKakaoAlimtalk, normalizePhone, type TemplateKey } from '@/lib/alimtalk'

/* ─── 템플릿별 변수 매핑 ─────────────────────────────────────────────────
 * ⚠️ Solapi 대시보드에서 각 템플릿의 변수명을 확인 후 키를 맞게 수정하세요.
 * 현재: 한글 형식 (#{이름}, #{호실}, #{금액} 등)
 * ─────────────────────────────────────────────────────────────────────── */
function getVariables(
  templateKey: string,
  params: { roomName: string; tenantName: string; amount: string; dueDate: string; paymentLink: string }
): Record<string, string> {
  const { roomName, tenantName, amount, dueDate, paymentLink } = params
  switch (templateKey) {
    case 'INVOICE_ISSUED':
      return {
        '#{세입자}': tenantName,
        '#{호실}':  roomName,
        '#{금액}':  amount,
        '#{기한}':  dueDate,
        '#{결제링크}': paymentLink,
      }
    case 'UNPAID_REMINDER':
      return {
        '#{세입자}': tenantName,
        '#{호실}':  roomName,
        '#{금액}':  amount,
      }
    case 'PAYMENT_DONE':
      return {
        '#{세입자}': tenantName,
        '#{호실}':  roomName,
        '#{금액}':  amount,
      }
    case 'DAILY_BRIEFING':
      return {
        '#{내용}':  amount,   // 브리핑 내용을 amount 파라미터로 전달
      }
    default:
      return {
        '#{이름}':  tenantName,
        '#{호실}':  roomName,
        '#{금액}':  amount,
        '#{기한}':  dueDate,
      }
  }
}

export async function POST(req: NextRequest) {
  /* ─── 인증 확인 ─── */
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    templateKey,
    phone,
    roomName   = '',
    tenantName = '',
    amount     = '',
    dueDate    = '매월 10일',
    roomId,
    paymentLink = '',
  } = body as {
    templateKey: string
    phone:       string
    roomName?:   string
    tenantName?: string
    amount?:     string
    dueDate?:    string
    roomId?:     string
    paymentLink?: string
  }

  if (!templateKey || !phone) {
    return NextResponse.json({ error: 'templateKey와 phone은 필수입니다.' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone)
  const variables = getVariables(templateKey, { roomName, tenantName, amount, dueDate, paymentLink: paymentLink ?? '' })

  let status: 'success' | 'failed' = 'success'
  try {
    const ok = await sendKakaoAlimtalk({
      templateKey: templateKey as TemplateKey,
      to:          normalizedPhone,
      variables,
    })
    if (!ok) status = 'failed'
  } catch (e) {
    console.error('[alimtalk] 발송 실패:', e)
    status = 'failed'
  }

  /* ─── 로그 기록 (recipient_name, room_id 포함) ─── */
  const svc = createServiceClient()
  await svc.from('notification_logs').insert({
    owner_id:        user.id,
    room_id:         roomId ?? null,
    template_key:    templateKey,
    recipient_name:  tenantName || null,
    recipient_phone: normalizedPhone,
    status,
  })

  return NextResponse.json({ ok: status === 'success', status })
}
