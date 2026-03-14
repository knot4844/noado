import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createReadyInvoice() {
  console.log('[1] 방금 생성된 테스트 유저/호실을 하나 가져옵니다...')
  
  const { data: existingRooms, error: rErr } = await supabase
    .from('rooms')
    .select('id, owner_id')
    .limit(1)

  if (rErr || !existingRooms || existingRooms.length === 0) {
    console.error('기존 방 조회 실패:', rErr)
    return
  }

  const room = existingRooms[0]

  // Update room with fake tenant info to ensure it shows up nicely in the UI
  await supabase.from('rooms').update({
    tenant_name: '테스트 컴퍼니 (데모)',
    tenant_phone: '010-9999-8888',
    monthly_rent: 150000
  }).eq('id', room.id)

  console.log('[2] READY 상태의 INVOICE 레코드를 생성합니다...')
  const { data: invoice, error: iErr } = await supabase.from('invoices').insert({
    owner_id: room.owner_id, 
    room_id: room.id, 
    year: 2026, 
    month: 1, 
    amount: 150000, 
    paid_amount: 0, 
    status: 'ready'
  }).select('id').single()

  if (iErr) {
    console.error('인보이스 생성 실패', iErr)
    return
  }

  const url = `http://localhost:3000/pay/${invoice.id}`
  console.log('\n🎉 통과!');
  console.log(`URL=${url}`);
}

createReadyInvoice()
