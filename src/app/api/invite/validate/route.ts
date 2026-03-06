import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ error: '토큰이 없습니다.' }, { status: 400 });
    }

    // 데모 토큰 바이패스
    if (token.startsWith('demo-token-')) {
        return NextResponse.json({
            roomId: token.replace('demo-token-', ''),
            roomName: '데모 호실',
            businessName: '데모 사업장',
            tenantName: '데모 임차인',
            tenantEmail: 'demo-tenant@example.com',
        });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: room, error } = await supabaseAdmin
        .from('rooms')
        .select('id, name, business_id, tenant_name, tenant_email, tenant_auth_id, invite_expires_at, businesses(name)')
        .eq('tenant_invite_token', token)
        .single();

    if (error || !room) {
        return NextResponse.json({ error: '유효하지 않은 초대 링크입니다.' }, { status: 404 });
    }

    // 이미 가입한 경우
    if (room.tenant_auth_id) {
        return NextResponse.json({ error: '이미 가입이 완료된 링크입니다.', alreadySignedUp: true }, { status: 409 });
    }

    // 만료 체크
    if (room.invite_expires_at && new Date(room.invite_expires_at) < new Date()) {
        return NextResponse.json({ error: '만료된 초대 링크입니다. 관리자에게 문의하세요.' }, { status: 410 });
    }

    return NextResponse.json({
        roomId: room.id,
        roomName: room.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        businessName: (room.businesses as any)?.name ?? '',
        tenantName: room.tenant_name ?? '',
        tenantEmail: room.tenant_email ?? '',
    });
}
