import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAuthenticatedClient(token: string) {
    return createClient(supabaseUrl, serviceRoleKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
    });
}

// GET /api/payments?businessId=xxx
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];

        // Verify user
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const businessId = searchParams.get('businessId');

        const client = getAuthenticatedClient(token);
        let query = client
            .from('payments')
            .select('*')
            .order('paid_at', { ascending: false });

        if (businessId && businessId !== 'ALL') {
            query = query.eq('business_id', businessId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ payments: data });
    } catch (error: unknown) {
        console.error('[GET /api/payments]', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}

// POST /api/payments
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];

        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }

        const body = await request.json();
        const { businessId, roomId, tenantName, amount, paidAt, month, status, note } = body;

        if (!businessId || !amount || !month || !status) {
            return NextResponse.json({ error: '필수 항목이 누락되었습니다. (businessId, amount, month, status)' }, { status: 400 });
        }

        const client = getAuthenticatedClient(token);
        const { data, error } = await client
            .from('payments')
            .insert({
                business_id: businessId,
                room_id: roomId || null,
                owner_id: user.id,
                tenant_name: tenantName || '',
                amount,
                paid_at: paidAt || new Date().toISOString().split('T')[0],
                month,
                status,
                note: note || null,
            })
            .select()
            .single();

        if (error) throw error;

        // rooms 테이블 상태도 업데이트 (납부 완료 시 PAID, 미납 시 UNPAID)
        if (roomId) {
            await client
                .from('rooms')
                .update({ status: status === 'PAID' ? 'PAID' : 'UNPAID' })
                .eq('id', roomId)
                .eq('owner_id', user.id);
        }

        return NextResponse.json({ payment: data }, { status: 201 });
    } catch (error: unknown) {
        console.error('[POST /api/payments]', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}

// PATCH /api/payments — 수납 상태 업데이트
export async function PATCH(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];

        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }

        const body = await request.json();
        const { id, status, note } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id와 status가 필요합니다.' }, { status: 400 });
        }

        const client = getAuthenticatedClient(token);
        const { data, error } = await client
            .from('payments')
            .update({ status, note: note ?? undefined })
            .eq('id', id)
            .eq('owner_id', user.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ payment: data });
    } catch (error: unknown) {
        console.error('[PATCH /api/payments]', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
