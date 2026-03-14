import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// .env.local 에서 환경변수 로드
const envPath = path.resolve(process.cwd(), '.env.local');
let webhookSecret = 'test_secret';
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const getEnv = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].replace(/['"]/g, '').trim() : '';
  };
  webhookSecret = getEnv('PORTONE_WEBHOOK_SECRET');
  supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
}

if (!supabaseUrl || !supabaseKey) {
  console.error('[TEST] Supabase 환경변수를 찾을 수 없습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TARGET_URL = 'http://localhost:3000/api/webhook/portone';

async function runConcurrencyTest() {
  try {
    const TEST_PAYMENT_ID = `test_concurrent_${Date.now()}`;
    
    // 1. Create a real dummy invoice
    const { data: bizes, error: bizErr } = await supabase.from('businesses').select('id, owner_id').limit(1);
    if (bizErr) throw bizErr;
    if (!bizes || bizes.length === 0) throw new Error("No businesses found");
    const biz = bizes[0];

    const { data: room, error: rErr} = await supabase.from('rooms').insert({
      business_id: biz.id, owner_id: biz.owner_id, name: `Lock Test ${Date.now()}`, status: 'UNPAID', monthly_rent: 100, deposit: 0
    }).select('id').single();
    if (rErr) throw rErr;

    const { data: invoice, error: iErr } = await supabase.from('invoices').insert({
      owner_id: biz.owner_id, room_id: room.id, year: 2026, month: 1, amount: 100, paid_amount: 0, status: 'ready',
      portone_payment_id: TEST_PAYMENT_ID
    }).select('id').single();
    if (iErr) throw iErr;

    console.log(`[TEST] 세팅 완료. Invoice ID: ${invoice.id}, Payment ID: ${TEST_PAYMENT_ID}`);

    // 2. Fire 10 webhooks simultaneously
    const payload = {
      type: 'Transaction.Paid',
      data: { paymentId: TEST_PAYMENT_ID, status: 'PAID', amount: { total: 100 }, paidAt: new Date().toISOString() }
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const signatureHeader = `v1=${signature}`;

    console.log(`[TEST] 10개의 웹훅을 동시에 전송합니다...`);

    const requests = Array.from({ length: 10 }).map((_, i) => {
      return fetch(TARGET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'webhook-signature': signatureHeader },
        body: rawBody
      }).then(res => res.json()).then(data => ({ id: i, data }));
    });

    const results = await Promise.all(requests);
    
    console.log('\n[TEST] 응답 결과 요약:');
    const duplicates = results.filter(r => r.data && r.data.duplicate);
    const success = results.filter(r => r.data && r.data.ok && !r.data.duplicate && !r.data.warning);
    const errors = results.filter(r => !r.data || r.data.error || (!r.data.duplicate && !r.data.ok && !r.data.warning));
    
    console.log(`총 요청: 10`);
    console.log(`정상 통과 성공(수납 완료): ${success.length}`);
    console.log(`중복 차단(duplicate): ${duplicates.length}`);
    if (errors.length > 0) console.log(`기타 오류: ${errors.length}`, errors.map(e => e.data));

    // 3. Verify Database State
    const { data: payments } = await supabase.from('payments').select('id, amount').eq('portone_payment_id', TEST_PAYMENT_ID);
    console.log(`\n[TEST] 생성된 payments 레코드 수: ${payments ? payments.length : 0}`); // Should be exactly 1!

    const { data: checkInvoice } = await supabase.from('invoices').select('paid_amount, status').eq('id', invoice.id).single();
    console.log(`[TEST] 최종 Invoice 상태: amount=${checkInvoice?.paid_amount}, status=${checkInvoice?.status}`); // Should be amount=100

    // 4. Cleanup
    await supabase.from('payments').delete().eq('portone_payment_id', TEST_PAYMENT_ID);
    await supabase.from('invoices').delete().eq('id', invoice.id);
    await supabase.from('rooms').delete().eq('id', room.id);
  } catch (err) {
    console.error(`[TEST] Error:`, err);
  }
}

runConcurrencyTest();
