/**
 * POST /api/contracts/request
 *
 * "납부 요청" 통합 API
 * 1. 당월 청구서 찾기 or 생성
 * 2. 계약서 찾기 or 생성 (leases 기반)
 * 3. invoice.contract_id 연결
 * 4. 카카오 알림톡: 청구 안내
 * 5. SMS: 납부 링크 별도 발송
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

  // ── 1. 입주사 조회 ────────────────────────────────────────────────
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .select('id, name, phone, email, owner_id')
    .eq('id', tenantId)
    .eq('owner_id', user.id)
    .single()

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: '입주사를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!tenant.phone) {
    return NextResponse.json({ error: '입주사 연락처가 등록되지 않았습니다. 먼저 연락처를 등록해주세요.' }, { status: 400 })
  }

  // ── 2. 활성 계약(lease) 조회 — room 정보 포함 ─────────────────────
  const { data: lease, error: leaseErr } = await supabaseAdmin
    .from('leases')
    .select('id, room_id, monthly_rent, payment_day, lease_start, lease_end, room:rooms(name)')
    .eq('tenant_id', tenantId)
    .eq('owner_id', user.id)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (leaseErr || !lease) {
    return NextResponse.json({ error: '활성 계약을 찾을 수 없습니다. 먼저 계약을 등록해주세요.' }, { status: 404 })
  }

  const roomRaw = lease.room as { name: string } | { name: string }[] | null
  const room = Array.isArray(roomRaw) ? roomRaw[0] : roomRaw
  if (!room) {
    return NextResponse.json({ error: '호실 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  const now        = new Date()
  const year       = now.getFullYear()
  const month      = now.getMonth() + 1
  const paymentDay = lease.payment_day ?? 10
  const dueDate    = new Date(year, month - 1, paymentDay).toISOString().split('T')[0]

  // ── 3. 당월 청구서 찾기 or 생성 ──────────────────────────────────
  const { data: existingInvoice } = await supabaseAdmin
    .from('invoices')
    .select('id, status, contract_id')
    .eq('room_id', lease.room_id)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  let invoiceId: string
  if (existingInvoice?.id) {
    invoiceId = existingInvoice.id
    if (existingInvoice.status === 'paid') {
      return NextResponse.json({ error: `${year}년 ${month}월 청구서는 이미 납부 완료 상태입니다.` }, { status: 400 })
    }
  } else {
    const { data: newInvoice, error: invErr } = await supabaseAdmin
      .from('invoices')
      .insert({
        owner_id:  user.id,
        room_id:   lease.room_id,
        tenant_id: tenantId,
        lease_id:  lease.id,
        year,
        month,
        amount:    lease.monthly_rent ?? 0,
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

  // ── 4. 계약서 찾기 or 생성 ────────────────────────────────────────
  let contractId: string | null = existingInvoice?.contract_id ?? null

  if (!contractId) {
    const { data: existingContract } = await supabaseAdmin
      .from('contracts')
      .select('id')
      .eq('room_id', lease.room_id)
      .eq('owner_id', user.id)
      .in('status', ['draft', 'sent', 'signed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingContract?.id) {
      contractId = existingContract.id
    } else {
      const { data: newContract, error: contErr } = await supabaseAdmin
        .from('contracts')
        .insert({
          owner_id:    user.id,
          room_id:     lease.room_id,
          tenant_name:  tenant.name,
          tenant_phone: tenant.phone,
          tenant_email: tenant.email,
          monthly_rent: lease.monthly_rent ?? 0,
          deposit:      0,
          lease_start:  lease.lease_start,
          lease_end:    lease.lease_end,
          status:       'sent',
        })
        .select('id')
        .single()

      if (contErr || !newContract) {
        return NextResponse.json({ error: `계약서 생성 실패: ${contErr?.message}` }, { status: 500 })
      }
      contractId = newContract.id
    }

    await supabaseAdmin
      .from('invoices')
      .update({ contract_id: contractId })
      .eq('id', invoiceId)
  }

  // ── 5. 알림톡 발송 ──────────────────────────────────────────────
  const baseUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.noado.kr'
  const paymentLink = `${baseUrl}/pay/${invoiceId}`
  let alimtalkSent  = false
  let smsSent       = false

  const normalizedPhone = normalizePhone(tenant.phone)

  try {
    alimtalkSent = await sendKakaoAlimtalk({
      templateKey: 'INVOICE_ISSUED',
      to: normalizedPhone,
      variables: {
        '#{이름}':    tenant.name,
        '#{호실}':    room.name,
        '#{year}':   String(now.getFullYear()),
        '#{month}':  String(now.getMonth() + 1),
        '#{금액}':    (lease.monthly_rent ?? 0).toLocaleString('ko-KR'),
        '#{납부기한}': dueDate,
        '#{링크}':    paymentLink,
      },
    })
  } catch (e) {
    console.error('[contracts/request] 알림톡 발송 에러:', e)
  }

  // SMS: 납부 링크 별도 발송
  try {
    const smsText = `[노아도] ${tenant.name}님, ${room.name} ${now.getMonth() + 1}월 이용료 납부 링크입니다.\n${paymentLink}`
    smsSent = await sendSMS(normalizedPhone, smsText)
  } catch (e) {
    console.error('[contracts/request] SMS 발송 에러:', e)
  }

  // 발송 로그
  await supabaseAdmin.from('notification_logs').insert({
    owner_id:        user.id,
    room_id:         lease.room_id,
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
