/**
 * POST /api/contracts/send
 * 계약서 발송: status → 'sent' + 세입자에게 서명 링크 알림톡 발송
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { sendKakaoAlimtalk, sendSMS, normalizePhone } from '@/lib/alimtalk'

export async function POST(request: NextRequest) {
  const { contractId, sendMethod = 'kakao' } = await request.json() as { contractId: string; sendMethod?: 'kakao' | 'sms' }
  if (!contractId) {
    return NextResponse.json({ error: 'contractId 필요' }, { status: 400 })
  }

  // ── 인증 확인 ────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // ── Service Role 클라이언트 ──────────────────────────────────────
  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ── 계약서 조회 ──────────────────────────────────────────────────
  const { data: contract, error: fetchErr } = await supabaseAdmin
    .from('contracts')
    .select('id, owner_id, status, sign_token, sign_token_expires_at, tenant_name, tenant_phone, lease_start, lease_end, monthly_rent, rooms(name)')
    .eq('id', contractId)
    .eq('owner_id', user.id)   // 본인 계약서만
    .single()

  if (fetchErr || !contract) {
    return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (contract.status !== 'draft') {
    return NextResponse.json({ error: '초안 상태의 계약서만 발송할 수 있습니다.' }, { status: 400 })
  }

  if (!contract.sign_token) {
    return NextResponse.json({ error: '서명 토큰이 없습니다.' }, { status: 400 })
  }

  // ── status → 'sent' 업데이트 ────────────────────────────────────
  const { error: updateErr } = await supabaseAdmin
    .from('contracts')
    .update({ status: 'sent' })
    .eq('id', contractId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // ── 알림톡 발송 ──────────────────────────────────────────────────
  const baseUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.noado.kr'
  const signLink  = `${baseUrl}/invite/${contract.sign_token}`
  const roomName  = (contract.rooms as { name?: string } | null)?.name ?? ''
  const leaseEnd  = contract.lease_end
    ? new Date(contract.lease_end).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '미정'

  let messageSent = false

  if (contract.tenant_phone) {
    const phone = normalizePhone(contract.tenant_phone)

    try {
      if (sendMethod === 'sms') {
        const smsText = `[노아도] 전자계약 서명 요청\n\n${contract.tenant_name ?? '입주자'}님, ${roomName ? roomName + ' ' : ''}계약서가 준비되었습니다.\n\n아래 링크에서 계약 내용을 확인하고 서명해주세요.\n${signLink}`
        messageSent = await sendSMS(phone, smsText)
      } else {
        messageSent = await sendKakaoAlimtalk({
          templateKey: 'CONTRACT_SIGN',
          to: phone,
          variables: {
            '#{세입자}':   contract.tenant_name ?? '입주자님',
            '#{호실}':     roomName,
            '#{만료일}':   leaseEnd,
            '#{서명링크}': signLink,
          },
        })
      }
    } catch (e) {
      console.error(`[contracts/send] ${sendMethod} 발송 에러:`, e)
    }

    // 발송 로그 기록
    await supabaseAdmin.from('notification_logs').insert({
      owner_id:        user.id,
      room_id:         null,
      template_key:    sendMethod === 'sms' ? 'CONTRACT_SIGN_SMS' : 'CONTRACT_SIGN',
      recipient_name:  contract.tenant_name  ?? null,
      recipient_phone: phone,
      status:          messageSent ? 'success' : 'failed',
    })
  }

  const methodLabel = sendMethod === 'sms' ? '문자' : '알림톡'
  console.log(`[contracts/send] 발송 완료: contractId=${contractId}, ${methodLabel}=${messageSent}`)

  return NextResponse.json({
    ok: true,
    signLink,
    alimtalkSent: messageSent,
    message: messageSent
      ? `계약서가 발송되고 ${methodLabel}이 전송되었습니다.`
      : `계약서가 발송되었습니다. (${methodLabel} 미발송 — 연락처 확인 필요)`,
  })
}
