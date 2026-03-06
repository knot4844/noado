/**
 * POST /api/alimtalk
 * 알림톡 단건 발송 + notification_logs 기록
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { sendKakaoAlimtalk } from '@/lib/alimtalk'

export async function POST(req: NextRequest) {
  /* ─── 인증 확인 ─── */
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { templateKey, phone, roomName, amount, dueDate, customMsg } = body as {
    templateKey: string
    phone:       string
    roomName:    string
    amount:      string
    dueDate?:    string
    customMsg?:  string
  }

  if (!templateKey || !phone) {
    return NextResponse.json({ error: 'templateKey와 phone은 필수입니다.' }, { status: 400 })
  }

  const variables: Record<string, string> = {
    '#{호실}':   roomName ?? '',
    '#{금액}':   amount   ?? '',
    '#{세입자}': '',
    '#{기한}':   dueDate  ?? '매월 10일',
  }

  let status: 'success' | 'failed' = 'success'

  try {
    if (customMsg) {
      // 커스텀 메시지면 표준 알림톡 미사용, 로그만 기록
      console.log(`[alimtalk] Custom to ${phone}: ${customMsg}`)
    } else {
      await sendKakaoAlimtalk({ templateKey, to: phone, variables })
    }
  } catch (e) {
    console.error('[alimtalk] 발송 실패:', e)
    status = 'failed'
  }

  /* ─── 로그 기록 ─── */
  const svc = createServiceClient()
  await svc.from('notification_logs').insert({
    owner_id:        user.id,
    template_key:    templateKey,
    recipient_phone: phone,
    status,
  })

  return NextResponse.json({ ok: status === 'success', status })
}
