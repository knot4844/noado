/**
 * POST /api/contracts/owner-sign
 * 임대인 전자서명 처리
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { contractId, signature } = await request.json()

  if (!contractId || !signature) {
    return NextResponse.json({ error: 'contractId, signature 필요' }, { status: 400 })
  }

  // 인증 확인
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 서명자 IP
  const signerIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'

  // Service Role 클라이언트
  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 계약 소유 확인
  const { data: contract, error: fetchErr } = await supabaseAdmin
    .from('contracts')
    .select('id, owner_id, status')
    .eq('id', contractId)
    .eq('owner_id', user.id)
    .single()

  if (fetchErr || !contract) {
    return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (contract.status !== 'draft') {
    return NextResponse.json({ error: '초안 상태에서만 서명할 수 있습니다.' }, { status: 400 })
  }

  const signedAt = new Date().toISOString()

  const { error: updateErr } = await supabaseAdmin
    .from('contracts')
    .update({
      status: 'owner_signed',
      owner_signature_url: signature,
      owner_signed_at: signedAt,
      owner_signer_ip: signerIp,
    })
    .eq('id', contractId)

  if (updateErr) {
    console.error('[owner-sign] 업데이트 오류:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  console.log(`[owner-sign] 임대인 서명 완료: contractId=${contractId}, ip=${signerIp}`)

  return NextResponse.json({
    ok: true,
    signedAt,
    signerIp,
  })
}
