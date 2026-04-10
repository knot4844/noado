/**
 * POST /api/sms
 * LMS/SMS 단건 발송 + notification_logs 기록
 *
 * body: { phone, text, roomId?, tenantName? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { sendSMS, normalizePhone } from '@/lib/alimtalk'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone, text, roomId, tenantName } = await req.json() as {
    phone: string
    text: string
    roomId?: string
    tenantName?: string
  }

  if (!phone || !text) {
    return NextResponse.json({ error: 'phone과 text는 필수입니다.' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone)
  let status: 'success' | 'failed' = 'success'

  try {
    const ok = await sendSMS(normalizedPhone, text)
    if (!ok) status = 'failed'
  } catch (e) {
    console.error('[sms] 발송 실패:', e)
    status = 'failed'
  }

  const svc = createServiceClient()
  await svc.from('notification_logs').insert({
    owner_id:        user.id,
    room_id:         roomId ?? null,
    template_key:    'SMS_PAYMENT_LINK',
    recipient_name:  tenantName || null,
    recipient_phone: normalizedPhone,
    status,
  })

  return NextResponse.json({ ok: status === 'success', status })
}
