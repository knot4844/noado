import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: 특정 사업장의 호실 목록
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let query = supabaseAdmin
        .from('rooms')
        .select('*, businesses!inner(owner_id)')
        .eq('businesses.owner_id', user.id);
    if (businessId) query = query.eq('business_id', businessId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ rooms: data });
}

// POST: 호실 추가
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // 해당 businessId가 본인 소유인지 확인
    const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('id', body.businessId)
        .eq('owner_id', user.id)
        .single();
    if (!biz) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

    const { data, error } = await supabaseAdmin.from('rooms').insert({
        id: crypto.randomUUID(),
        business_id: body.businessId,
        owner_id: user.id,
        name: body.name,
        status: body.status || 'VACANT',
        tenant_name: body.tenantName || null,
        tenant_contact: body.tenantContact || null,
        tenant_company_name: body.tenantCompanyName || null,
        monthly_rent: body.monthlyRent || 0,
        deposit: body.deposit || 0,
        due_date: body.dueDate || '매월 25일',
        is_vat_included: body.isVATIncluded || false,
        auto_notify: true,
        lease_start: body.leaseStart || null,
        lease_end: body.leaseEnd || null,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ room: data }, { status: 201 });
}

// PATCH: 호실 수정
export async function PATCH(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, ...updates } = body;

    const { data, error } = await supabaseAdmin.from('rooms').update({
        name: updates.name,
        status: updates.status,
        tenant_name: updates.tenantName,
        tenant_contact: updates.tenantContact,
        tenant_company_name: updates.tenantCompanyName,
        monthly_rent: updates.monthlyRent,
        deposit: updates.deposit,
        due_date: updates.dueDate,
        is_vat_included: updates.isVATIncluded,
        lease_start: updates.leaseStart,
        lease_end: updates.leaseEnd,
        unpaid_months: updates.unpaidMonths,
        unpaid_amount: updates.unpaidAmount,
    }).eq('id', id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ room: data });
}

// DELETE: 호실 삭제
export async function DELETE(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json();
    const { error } = await supabaseAdmin.from('rooms').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
