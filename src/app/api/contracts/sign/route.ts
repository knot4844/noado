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

  // ── 1. 계약 전체 정보 조회 ──────────────────────────────────
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

  // ── 3. rooms 상태 업데이트 (status만 — 제거된 컬럼 참조하지 않음) ──
  try {
    await supabaseAdmin.from('rooms').update({
      status: 'UNPAID',
    }).eq('id', contract.room_id)
  } catch (e) {
    console.error('[sign] rooms 상태 업데이트 예외:', e)
  }

  console.log(`[sign] 서명 완료: contractId=${contractId}, room=${contract.room_id}, ip=${signerIp}`)

  return NextResponse.json({
    success: true,
    contentHash,
    signerIp,
    signedAt,
  })
}
