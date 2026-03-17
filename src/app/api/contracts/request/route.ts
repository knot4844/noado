/**
 * POST /api/contracts/request
 *
 * "납부 요청" 통합 API
 * 1. 당월 청구서 찾기 or 생성
 * 2. 계약서 찾기 or 생성 (rooms 기반)
 * 3. invoice.contract_id 연결
 * 4. 카카오 알림톡: 청구 안내 (링크 없음 — 카카오 정책상 결제 링크 불가)
 * 5. SMS: 납부 링크 별도 발송 (카카오 심사 불필요)
 *
 * 납부 완료 후에만 /pay/{invoiceId} 에서 계약서 다운로드 가능
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { sendKakaoAlimtalk, sendSMS, normalizePhone } from '@/lib/alimtalk'

export async function POST(request: NextRequest) {
  const { tenantId } = await request.json()
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId 필요' }, { status: 400 })
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

  // ── 1. 입주사 + 호실 정보 조회 ────────────────────────────────────
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .select('*, rooms(name, payment_day)')
    .eq('id', tenantId)
    .eq('owner_id', user.id)
    .single()

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: '입주사를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!tenant.phone) {
    return NextResponse.json({ error: '입주사 연락처가 등록되지 않았습니다. 먼저 연락처를 등록해주세요.' }, { status: 400 })
  }

  const room = tenant.rooms as { name: string; payment_day?: number } | null
  if (!room) {
    return NextResponse.json({ error: '호실 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  const now        = new Date()
  const year       = now.getFullYear()
  const month      = now.getMonth() + 1
  const paymentDay = room.payment_day ?? 10
  const dueDate    = new Date(year, month - 1, paymentDay).toISOString().split('T')[0]

  // ── 2. 당월 청구서 찾기 or 생성 ──────────────────────────────────
  const { data: existingInvoice } = await supabaseAdmin
    .from('invoices')
    .select('id, status, contract_id')
    .eq('room_id', tenant.room_id)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  let invoiceId: string
  if (existingInvoice?.id) {
    invoiceId = existingInvoice.id
    // 이미 납부 완료된 경우
    if (existingInvoice.status === 'paid') {
      return NextResponse.json({ error: `${year}년 ${month}월 청구서는 이미 납부 완료 상태입니다.` }, { status: 400 })
    }
  } else {
    const { data: newInvoice, error: invErr } = await supabaseAdmin
      .from('invoices')
      .insert({
        owner_id:  user.id,
        room_id:   tenant.room_id,
        tenant_id: tenantId,
        year,
        month,
        amount:    tenant.monthly_rent,
        due_date:  dueDate,
        status:    'ready',
      })
      .select('id')
      .single()

    if (invErr || !newInvoice) {
      return NextResponse.json({ error: `청구서 생성 실패: ${invErr?.message}` }, { status: 500 })
    }
    invoiceId = newInvoice.id
  }

  // ── 3. 계약서 찾기 or 생성 ────────────────────────────────────────
  // 이미 연결된 계약서가 있으면 재사용
  let contractId: string | null = existingInvoice?.contract_id ?? null

  if (!contractId) {
    // draft 또는 sent 상태의 최신 계약서 조회
    const { data: existingContract } = await supabaseAdmin
      .from('contracts')
      .select('id')
      .eq('room_id', tenant.room_id)
      .eq('owner_id', user.id)
      .in('status', ['draft', 'sent', 'signed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingContract?.id) {
      contractId = existingContract.id
    } else {
      // 새 계약서 자동 생성
      const { data: newContract, error: contErr } = await supabaseAdmin
        .from('contracts')
        .insert({
          owner_id:    user.id,
          room_id:     tenant.room_id,
          tenant_name:  tenant.name,
          tenant_phone: tenant.phone,
          tenant_email: tenant.email,
          monthly_rent: tenant.monthly_rent,
          deposit:      tenant.deposit,
          lease_start:  tenant.lease_start,
          lease_end:    tenant.lease_end,
          status:       'sent',
        })
        .select('id')
        .single()

      if (contErr || !newContract) {
        return NextResponse.json({ error: `계약서 생성 실패: ${contErr?.message}` }, { status: 500 })
      }
      contractId = newContract.id
    }

    // invoice.contract_id 업데이트
    await supabaseAdmin
      .from('invoices')
      .update({ contract_id: contractId })
      .eq('id', invoiceId)
  }

  // ── 4. 알림톡 발송 (INVOICE_ISSUED: 청구 안내, 링크 없음) ────────────
  // 카카오 정책상 납부 유도 링크는 PG사만 허용 → 링크 제거 후 재승인
  const baseUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.noado.kr'
  const paymentLink = `${baseUrl}/pay/${invoiceId}`
  const nowDate     = new Date()
  let alimtalkSent  = false
  let smsSent       = false

  const normalizedPhone = normalizePhone(tenant.phone)

  // 알림톡: 청구 안내 + 이용 내역 확인 링크
  try {
    alimtalkSent = await sendKakaoAlimtalk({
      templateKey: 'INVOICE_ISSUED',
      to: normalizedPhone,
      variables: {
        '#{이름}':    tenant.name,
        '#{호실}':    room.name,
        '#{year}':   String(nowDate.getFullYear()),
        '#{month}':  String(nowDate.getMonth() + 1),
        '#{금액}':    tenant.monthly_rent.toLocaleString('ko-KR'),
        '#{납부기한}': dueDate,
        '#{링크}':    paymentLink,
      },
    })
  } catch (e) {
    console.error('[contracts/request] 알림톡 발송 에러:', e)
  }

  // SMS: 납부 링크 별도 발송 (카카오 심사 불필요)
  try {
    const smsText = `[노아도] ${tenant.name}님, ${room.name}호 ${nowDate.getMonth() + 1}월 이용료 납부 링크입니다.\n${paymentLink}`
    smsSent = await sendSMS(normalizedPhone, smsText)
  } catch (e) {
    console.error('[contracts/request] SMS 발송 에러:', e)
  }

  // 발송 로그
  await supabaseAdmin.from('notification_logs').insert({
    owner_id:        user.id,
    room_id:         tenant.room_id,
    template_key:    'INVOICE_ISSUED',
    recipient_name:  tenant.name,
    recipient_phone: normalizedPhone,
    status:          (alimtalkSent || smsSent) ? 'success' : 'failed',
  })

  console.log(`[contracts/request] 납부요청 완료: tenant=${tenantId} invoice=${invoiceId} contract=${contractId} alimtalk=${alimtalkSent} sms=${smsSent}`)

  const sentMethods = [alimtalkSent && '알림톡', smsSent && 'SMS'].filter(Boolean).join(' + ')
  return NextResponse.json({
    ok: true,
    invoiceId,
    contractId,
    paymentLink,
    alimtalkSent,
    smsSent,
    message: sentMethods
      ? `납부 요청이 발송되었습니다. (${room.name} · ${tenant.name} / ${sentMethods})`
      : `납부 링크가 생성되었습니다. (발송 실패 — 연락처 확인 필요)\n링크: ${paymentLink}`,
  })
}
