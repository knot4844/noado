import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 샘플 입주사 데이터
const SAMPLE_TENANTS = [
  { name: '101호', tenant_name: '김민준', tenant_phone: '01011112222', deposit: 500000,  monthly_rent: 400000 },
  { name: '102호', tenant_name: '이서연', tenant_phone: '01022223333', deposit: 300000,  monthly_rent: 300000 },
  { name: '103호', tenant_name: '박지훈', tenant_phone: '01033334444', deposit: 800000,  monthly_rent: 450000 },
  { name: '104호', tenant_name: '최수아', tenant_phone: '01044445555', deposit: 1000000, monthly_rent: 500000 },
  { name: '105호', tenant_name: '정도현', tenant_phone: '01055556666', deposit: 600000,  monthly_rent: 380000 },
  { name: '201호', tenant_name: '한지민', tenant_phone: '01066667777', deposit: 400000,  monthly_rent: 320000 },
  { name: '202호', tenant_name: '오세훈', tenant_phone: '01077778888', deposit: 700000,  monthly_rent: 420000 },
  { name: '203호', tenant_name: '윤아름', tenant_phone: '01088889999', deposit: 500000,  monthly_rent: 350000 },
  { name: '204호', tenant_name: '임태양', tenant_phone: '01099990000', deposit: 900000,  monthly_rent: 480000 },
  { name: '205호', tenant_name: '강나리', tenant_phone: '01011223344', deposit: 300000,  monthly_rent: 300000 },
]

export async function POST(req: NextRequest) {
  // 인증 확인
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // 계약 시작일: 1년 전, 만료일: 1~2년 후
  const leaseStart = new Date(now)
  leaseStart.setFullYear(leaseStart.getFullYear() - 1)
  const leaseStartStr = leaseStart.toISOString().split('T')[0]

  const results: { room: string; status: string }[] = []

  for (let i = 0; i < SAMPLE_TENANTS.length; i++) {
    const t = SAMPLE_TENANTS[i]
    // 짝수: 완납, 홀수: 미납 (다양하게)
    const isPaid = i % 3 !== 2  // 0,1→완납 / 2→미납 패턴

    const leaseEnd = new Date(now)
    leaseEnd.setMonth(leaseEnd.getMonth() + 6 + i)  // 6~15개월 후
    const leaseEndStr = leaseEnd.toISOString().split('T')[0]

    // ── 1. rooms 생성 ──────────────────────────────
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .insert({
        owner_id:     user.id,
        name:         t.name,
        tenant_name:  t.tenant_name,
        tenant_phone: t.tenant_phone,
        monthly_rent: t.monthly_rent,
        deposit:      t.deposit,
        lease_start:  leaseStartStr,
        lease_end:    leaseEndStr,
        status:       isPaid ? 'PAID' : 'UNPAID',
      })
      .select()
      .single()

    if (roomErr || !room) {
      results.push({ room: t.name, status: `room_error: ${roomErr?.message}` })
      continue
    }

    // ── 2. 청구서(invoice) 생성 ──────────────────────
    const dueDate = `${year}-${String(month).padStart(2,'0')}-10`
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from('invoices')
      .insert({
        owner_id:    user.id,
        room_id:     room.id,
        year,
        month,
        amount:      t.monthly_rent,
        paid_amount: isPaid ? t.monthly_rent : 0,
        status:      isPaid ? 'paid' : 'ready',
        due_date:    dueDate,
      })
      .select()
      .single()

    if (invErr) {
      results.push({ room: t.name, status: `invoice_error: ${invErr?.message}` })
      continue
    }

    // ── 3. 완납 입주사는 payments도 생성 ─────────────
    if (isPaid && invoice) {
      // 입금일: 이번 달 5~8일 중 랜덤
      const day = 5 + (i % 4)
      const paidAt = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T10:00:00+09:00`

      await supabaseAdmin
        .from('payments')
        .insert({
          invoice_id:  invoice.id,
          room_id:     room.id,
          owner_id:    user.id,
          amount:      t.monthly_rent,
          paid_at:     paidAt,
          note:        `${t.tenant_name} 월세`,
          method:      'bank_transfer',
        })
    }

    // ── 4. 계약서(contract) 생성 ─────────────────────
    const signToken = crypto.randomBytes(32).toString('hex')
    const snapshot = {
      address:      `서울시 강남구 테헤란로 123 ${t.name}`,
      deposit:      t.deposit,
      monthly_rent: t.monthly_rent,
      lease_start:  leaseStartStr,
      lease_end:    leaseEndStr,
      tenant_name:  t.tenant_name,
      tenant_phone: t.tenant_phone,
    }
    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex')

    // 짝수 호실은 서명 완료, 홀수는 발송됨
    const contractStatus = i % 2 === 0 ? 'signed' : 'sent'
    const signedAt = i % 2 === 0
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : null

    await supabaseAdmin
      .from('contracts')
      .insert({
        owner_id:          user.id,
        room_id:           room.id,
        tenant_name:       t.tenant_name,
        tenant_phone:      t.tenant_phone,
        monthly_rent:      t.monthly_rent,
        deposit:           t.deposit,
        lease_start:       leaseStartStr,
        lease_end:         leaseEndStr,
        status:            contractStatus,
        sign_token:        signToken,
        content_hash:      contentHash,
        contract_snapshot: snapshot,
        signed_at:         signedAt,
        signer_ip:         signedAt ? '127.0.0.1' : null,
      })

    results.push({ room: t.name, status: `ok_${isPaid ? '완납' : '미납'}` })
  }

  return NextResponse.json({
    message: '샘플 데이터 생성 완료',
    created: results.length,
    results,
  })
}

// 샘플 데이터 전체 삭제 (초기화용)
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sampleRoomNames = SAMPLE_TENANTS.map(t => t.name)

  // rooms 조회
  const { data: rooms } = await supabaseAdmin
    .from('rooms')
    .select('id')
    .eq('owner_id', user.id)
    .in('name', sampleRoomNames)

  if (rooms && rooms.length > 0) {
    const roomIds = rooms.map((r: { id: string }) => r.id)

    // invoices 조회 후 payments 삭제
    const { data: invs } = await supabaseAdmin
      .from('invoices').select('id').in('room_id', roomIds)
    if (invs && invs.length > 0) {
      const invIds = invs.map((i: { id: string }) => i.id)
      await supabaseAdmin.from('payments').delete().in('invoice_id', invIds)
    }

    await supabaseAdmin.from('invoices').delete().in('room_id', roomIds)
    await supabaseAdmin.from('contracts').delete().in('room_id', roomIds)
    await supabaseAdmin.from('rooms').delete().in('id', roomIds)
  }

  return NextResponse.json({ message: '샘플 데이터 삭제 완료', deleted: rooms?.length ?? 0 })
}
