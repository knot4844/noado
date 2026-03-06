import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { roomId, signature, tenantName, contractContent } = body;

    if (!roomId || !signature || !tenantName || !contractContent) {
        return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
    }

    // 법적 요건 1: 서명자 IP 주소 수집
    const signerIp =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        '127.0.0.1';

    // 법적 요건 2: 계약 내용 SHA-256 해시 (원본 무결성)
    const contentHash = createHash('sha256')
        .update(JSON.stringify(contractContent))
        .digest('hex');

    // Service Role 클라이언트 (RLS bypass)
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabaseAdmin
        .from('contracts')
        .upsert({
            room_id: roomId,
            tenant_name: tenantName,
            signature,                          // base64 PNG 서명 이미지
            signed_at: new Date().toISOString(), // UTC 타임스탬프
            signer_ip: signerIp,                // 서명자 IP
            content_hash: contentHash,           // 계약 내용 해시
            contract_snapshot: contractContent,  // 계약 내용 스냅샷 (JSON)
        }, { onConflict: 'room_id' });

    if (error) {
        console.error('계약서 저장 오류:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        contentHash,
        signerIp,
        signedAt: new Date().toISOString(),
    });
}
