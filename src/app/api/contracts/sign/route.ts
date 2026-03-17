import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { contractId, roomId, signature, tenantName, contractContent } = body

  if (!contractId || !roomId || !signature || !tenantName || !contractContent) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  // 법적 요건 1: 서명자 IP 주소 수집
  const signerIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'

  // 법적 요건 2: 계약 내용 SHA-256 해시 (원본 무결성)
  const contentHash = createHash('sha256')
    .update(JSON.stringify(contractContent))
    .digest('hex')

  // Service Role 클라이언트 (RLS bypass)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const signedAt = new Date().toISOString()

  // ── 1. 계약 전체 정보 조회 (tenants 동기화에 사용) ──────────────
  const { data: contract, error: fetchErr } = await supabaseAdmin
    .from('contracts')
    .select('owner_id, room_id, tenant_name, tenant_phone, tenant_email, monthly_rent, deposit, lease_start, lease_end')
    .eq('id', contractId)
    .single()

  if (fetchErr || !contract) {
    console.error('[sign] 계약 조회 실패:', fetchErr)
    return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 })
  }

  // ── 2. contracts 상태 → signed 업데이트 ────────────────────────
  const { error: updateErr } = await supabaseAdmin
    .from('contracts')
    .update({
      signature_data_url: signature,
      signed_at:          signedAt,
      signer_ip:          signerIp,
      content_hash:       contentHash,
      contract_snapshot:  contractContent,
      status:             'signed',
    })
    .eq('id', contractId)

  if (updateErr) {
    console.error('[sign] 계약 업데이트 오류:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // ── 3. tenants 테이블 자동 반영 ────────────────────────────────
  try {
    const today = new Date().toISOString().split('T')[0]

    // 3-1. 기존 활성 입주사 퇴실 처리 (lease_end = 오늘)
    await supabaseAdmin
      .from('tenants')
      .update({ lease_end: today })
      .eq('room_id', contract.room_id)
      .is('lease_end', null)

    // 3-2. 새 입주사 INSERT
    const { error: tenantErr } = await supabaseAdmin.from('tenants').insert({
      owner_id:     contract.owner_id,
      room_id:      contract.room_id,
      name:         contract.tenant_name ?? tenantName,
      phone:        contract.tenant_phone  || null,
      email:        contract.tenant_email  || null,
      monthly_rent: contract.monthly_rent  ?? 0,
      deposit:      contract.deposit       ?? 0,
      lease_start:  contract.lease_start   || null,
      lease_end:    contract.lease_end     || null,
      memo:         `전자계약 서명 완료 (${contractId})`,
    })
    if (tenantErr) console.error('[sign] tenants INSERT 오류:', tenantErr)

    // 3-3. rooms 테이블 캐시 동기화
    const { error: roomErr } = await supabaseAdmin.from('rooms').update({
      tenant_name:  contract.tenant_name  ?? tenantName,
      tenant_phone: contract.tenant_phone || null,
      tenant_email: contract.tenant_email || null,
      monthly_rent: contract.monthly_rent ?? 0,
      deposit:      contract.deposit      ?? 0,
      lease_start:  contract.lease_start  || null,
      lease_end:    contract.lease_end    || null,
      status:       'UNPAID',
    }).eq('id', contract.room_id)
    if (roomErr) console.error('[sign] rooms UPDATE 오류:', roomErr)

  } catch (e) {
    // tenants 동기화 실패해도 서명 자체는 성공으로 처리
    console.error('[sign] tenants 동기화 예외:', e)
  }

  console.log(`[sign] 서명 완료: contractId=${contractId}, room=${contract.room_id}`)

  return NextResponse.json({
    success: true,
    contentHash,
    signerIp,
    signedAt,
  })
}
