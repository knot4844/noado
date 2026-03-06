import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { token, authId, name, phone, ssn, email, address } = body;

    if (!token || !authId || !name || !phone || !ssn) {
        return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 토큰으로 호실 조회
    const { data: room, error: roomError } = await supabaseAdmin
        .from('rooms')
        .select('id, tenant_auth_id')
        .eq('tenant_invite_token', token)
        .single();

    if (roomError || !room) {
        return NextResponse.json({ error: '유효하지 않은 초대 링크입니다.' }, { status: 404 });
    }

    if (room.tenant_auth_id) {
        return NextResponse.json({ error: '이미 가입이 완료된 링크입니다.' }, { status: 409 });
    }

    // 주민번호 SHA-256 해시 (원문 미저장)
    const ssnHash = createHash('sha256').update(ssn).digest('hex');
    const ssnLast4 = ssn.length >= 7 ? ssn[7] + 'xxxxxx' : 'xxxxxxx';

    // tenant_profiles 저장
    const { error: profileError } = await supabaseAdmin.from('tenant_profiles').upsert({
        auth_id: authId,
        room_id: room.id,
        name,
        phone,
        ssn_hash: ssnHash,
        ssn_last4: ssnLast4,
        email: email ?? '',
        address: address ?? '',
    }, { onConflict: 'auth_id' });

    if (profileError) {
        console.error('프로필 저장 오류:', profileError);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // rooms.tenant_auth_id 연결 + 토큰 무효화
    const { error: roomUpdateError } = await supabaseAdmin
        .from('rooms')
        .update({
            tenant_auth_id: authId,
            tenant_name: name,
            tenant_contact: phone,
            tenant_invite_token: null, // 토큰 소진
        })
        .eq('id', room.id);

    if (roomUpdateError) {
        return NextResponse.json({ error: roomUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, roomId: room.id });
}
