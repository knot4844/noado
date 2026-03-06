import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { roomId, tenantEmail, tenantName } = body;

    if (!roomId) {
        return NextResponse.json({ error: 'roomId가 필요합니다.' }, { status: 400 });
    }

    // 현재 로그인한 관리자 확인 (데모 버전에서는 클라이언트 측 localStorage에 의존하므로
    // 서버 사이드 엄격한 세션 체크는 임시로 생략합니다.)
    /*
    const cookieStore = await cookies();
    const supabaseUser = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll() } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
    */

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 데모 호실 (메모리 데이터) 처리 우회
    if (roomId.startsWith('r_')) {
        const token = `demo-token-${roomId}`;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin');
        const inviteUrl = `${baseUrl}/invite/${token}`;
        return NextResponse.json({ success: true, inviteUrl, expiresAt });
    }

    // 해당 호실이 관리자 소유인지 확인 (실제 DB 호실)
    const { data: room, error: roomError } = await supabaseAdmin
        .from('rooms')
        .select('id, business_id, businesses(owner_id)')
        .eq('id', roomId)
        .single();

    if (roomError || !room) {
        return NextResponse.json({ error: '호실을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 데모 버전: 소유권 체크 로직도 임시 우회 (어떤 호실이든 초대 가능하게)
    /*
    const ownerIdFromDb = (room.businesses as any)?.owner_id;
    if (ownerIdFromDb && ownerIdFromDb !== user.id) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }
    */

    // 초대 토큰 생성 (7일 유효)
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const updateData: Record<string, string> = {
        tenant_invite_token: token,
        invite_expires_at: expiresAt,
    };
    if (tenantEmail) updateData.tenant_email = tenantEmail;
    if (tenantName) updateData.tenant_name = tenantName;

    const { error: updateError } = await supabaseAdmin
        .from('rooms')
        .update(updateData)
        .eq('id', roomId);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin');
    const inviteUrl = `${baseUrl}/invite/${token}`;
    return NextResponse.json({ success: true, inviteUrl, expiresAt });
}
