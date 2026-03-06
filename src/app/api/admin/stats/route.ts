import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    // 1. Check authorization via Supabase Auth
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized. Missing token.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json(
            { error: 'Server configuration missing: SUPABASE_SERVICE_ROLE_KEY is required.' },
            { status: 500 }
        );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized. Invalid token.' }, { status: 401 });
    }

    const userEmail = user.email || '';
    const masterAdminEmails = (process.env.MASTER_ADMIN_EMAILS || '').split(',').map(email => email.trim());

    if (!masterAdminEmails.includes(userEmail)) {
        return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    try {
        // 3. Fetch aggregated stats
        const { count: businessesCount } = await supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true });
        const { count: roomsCount } = await supabaseAdmin.from('rooms').select('*', { count: 'exact', head: true });
        const { count: tenantsCount } = await supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true });

        // 4. Fetch recent businesses
        const { data: recentBusinesses } = await supabaseAdmin
            .from('businesses')
            .select('id, name, owner_id, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

        return NextResponse.json({
            stats: {
                totalBusinesses: businessesCount || 0,
                totalRooms: roomsCount || 0,
                totalTenants: tenantsCount || 0,
                monthlyRecurringRevenue: (businessesCount || 0) * 29000, // Dummy calculation for MRR based on 29k Pro plan
            },
            recentBusinesses: recentBusinesses || [],
        });
    } catch (error: any) {
        console.error('Error fetching admin stats:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
