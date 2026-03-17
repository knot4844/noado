/**
 * POST /api/seed-demo          — 데모 데이터 생성 (3케이스 전체)
 * POST /api/seed-demo?case=A   — A케이스만 (소호사무실)
 * POST /api/seed-demo?case=B   — B케이스만 (상가)
 * POST /api/seed-demo?case=C   — C케이스만 (고시원)
 * DELETE /api/seed-demo        — 데모 데이터 전체 삭제
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 데모 데이터 식별 태그 (memo 필드에 삽입)
const TAG = '__DEMO__'

// ── 납부 패턴 ─────────────────────────────────────────────
type Pattern =
  | 'perfect'      // 12개월 모두 완납 (이상적 세입자)
  | 'miss_mid'     // 4개월 전 한 번 미납 후 재납 (가끔 연체)
  | 'two_behind'   // 최근 2달 연속 미납 (주의 필요)
  | 'three_behind' // 최근 3달 연속 미납 (독촉 필요)
  | 'new_tenant'   // 최근 입주 (입주일 기준 이전 이력 없음)

function isPaid(pattern: Pattern, monthsAgo: number): boolean {
  if (pattern === 'perfect')      return true
  if (pattern === 'miss_mid')     return monthsAgo !== 4     // 4개월 전 1회 미납
  if (pattern === 'two_behind')   return monthsAgo >= 2      // 2달 전부터 완납
  if (pattern === 'three_behind') return monthsAgo >= 3      // 3달 전부터 완납
  if (pattern === 'new_tenant')   return true                // 입주 후 모두 납부
  return true
}

// ── 날짜 헬퍼 ─────────────────────────────────────────────
const d = (y: number, m: number, day = 1) =>
  `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`

function monthsAgo(n: number): string {
  const dt = new Date()
  dt.setDate(1)
  dt.setMonth(dt.getMonth() - n)
  return dt.toISOString().split('T')[0]
}

// ── 호실 시드 타입 ────────────────────────────────────────
interface RoomSeed {
  name:       string
  tenant:     string
  phone:      string
  rent:       number   // 월세 (관리비 포함)
  deposit:    number
  start:      string   // lease_start (YYYY-MM-DD)
  end:        string | null  // lease_end
  payDay:     number   // 납부일
  pattern:    Pattern
  note?:      string   // 추가 메모
}

// ══════════════════════════════════════════════════════════
// 케이스 A — 소호사무실 20개
// 30만 × 10 (101~110), 50만 × 10 (201~210)
// 매달 고정비 100만원 (전기세·관리비)
// ══════════════════════════════════════════════════════════
const CASE_A: RoomSeed[] = [
  // ── 30만원 구역 (101~110) ─────────────────────────────
  { name:'101호', tenant:'김민준',        phone:'01011112222', rent:300000, deposit:300000, start:'2024-02-01', end:'2026-01-31',  payDay:10, pattern:'perfect' },
  { name:'102호', tenant:'이서연',        phone:'01022223333', rent:300000, deposit:300000, start:'2024-04-01', end:'2026-03-31',  payDay:10, pattern:'perfect',   note:'계약 만료 임박' },
  { name:'103호', tenant:'박준혁 통번역', phone:'01033334444', rent:300000, deposit:300000, start:'2023-11-01', end:null,          payDay:10, pattern:'miss_mid' },
  { name:'104호', tenant:'최유나',        phone:'01044445555', rent:300000, deposit:300000, start:'2024-05-01', end:null,          payDay:10, pattern:'perfect' },
  { name:'105호', tenant:'정재원 IT컨설',phone:'01055556666', rent:300000, deposit:300000, start:'2024-03-01', end:'2026-04-15',  payDay:10, pattern:'perfect',   note:'계약 만료 D-29' },
  { name:'106호', tenant:'한소희 글공방', phone:'01066667777', rent:300000, deposit:300000, start:'2023-08-01', end:null,          payDay:10, pattern:'perfect' },
  { name:'107호', tenant:'오승민',        phone:'01077778888', rent:300000, deposit:300000, start:'2024-07-01', end:'2026-06-30',  payDay:10, pattern:'two_behind', note:'최근 2달 미납 — 연락 필요' },
  { name:'108호', tenant:'윤지현 회계사', phone:'01088889999', rent:300000, deposit:300000, start:'2024-04-01', end:null,          payDay:10, pattern:'perfect' },
  { name:'109호', tenant:'임성훈 스튜디오',phone:'01099990000',rent:300000, deposit:300000, start:'2024-06-01', end:'2026-05-31',  payDay:10, pattern:'perfect' },
  { name:'110호', tenant:'강다혜',        phone:'01011223344', rent:300000, deposit:300000, start:monthsAgo(2), end:null,          payDay:10, pattern:'new_tenant', note:'신규 입주 (2개월 전)' },
  // ── 50만원 구역 (201~210) ─────────────────────────────
  { name:'201호', tenant:'(주)테크스타트',  phone:'01022334455', rent:500000, deposit:1000000, start:'2024-01-01', end:'2026-12-31',  payDay:10, pattern:'perfect' },
  { name:'202호', tenant:'블루마케팅',      phone:'01033445566', rent:500000, deposit:1000000, start:'2024-03-01', end:null,          payDay:10, pattern:'perfect' },
  { name:'203호', tenant:'디자인웍스',      phone:'01044556677', rent:500000, deposit:1000000, start:'2023-10-01', end:'2026-09-30',  payDay:10, pattern:'miss_mid' },
  { name:'204호', tenant:'이노벨컨설팅',    phone:'01055667788', rent:500000, deposit:1000000, start:'2024-02-01', end:null,          payDay:10, pattern:'perfect' },
  { name:'205호', tenant:'그린에너지솔루션',phone:'01066778899', rent:500000, deposit:1000000, start:'2024-04-01', end:'2026-09-30',  payDay:10, pattern:'perfect' },
  { name:'206호', tenant:'스마트솔루션즈',  phone:'01077889900', rent:500000, deposit:1000000, start:'2023-09-01', end:null,          payDay:10, pattern:'perfect' },
  { name:'207호', tenant:'한국IT교육원',    phone:'01088990011', rent:500000, deposit:1000000, start:'2024-01-01', end:'2026-12-31',  payDay:10, pattern:'perfect' },
  { name:'208호', tenant:'미래건축사무소',  phone:'01099001122', rent:500000, deposit:1000000, start:'2024-05-01', end:null,          payDay:10, pattern:'three_behind', note:'3달 연체 — 내용증명 고려' },
  { name:'209호', tenant:'크리에이티브랩',  phone:'01011334455', rent:500000, deposit:1000000, start:'2024-03-01', end:'2026-04-01',  payDay:10, pattern:'perfect',     note:'계약 만료 D-15' },
  { name:'210호', tenant:'넥스트레벨',      phone:'01022445566', rent:500000, deposit:1000000, start:monthsAgo(1), end:null,          payDay:10, pattern:'new_tenant',    note:'신규 입주 (1개월 전)' },
]

// ══════════════════════════════════════════════════════════
// 케이스 B — 상가 8개
// 1층 3개 (임대료 + 관리비 3만)
// 2층 5개 (임대료 + 관리비 3만 + 엘리베이터 2만)
// ══════════════════════════════════════════════════════════
const CASE_B: RoomSeed[] = [
  // ── 1층 (관리비 30,000 포함) ──────────────────────────
  { name:'101호', tenant:'(주)카페봄봄',    phone:'01011102020', rent:2530000, deposit:5000000, start:'2023-03-01', end:'2027-02-28',  payDay:15, pattern:'perfect' },
  { name:'102호', tenant:'헤어클리닉',       phone:'01022203030', rent:1530000, deposit:3000000, start:'2023-01-01', end:'2026-12-31',  payDay:15, pattern:'perfect' },
  { name:'103호', tenant:'건강약국',         phone:'01033304040', rent:2030000, deposit:4000000, start:'2022-10-01', end:null,          payDay:15, pattern:'miss_mid', note:'24년 5월 지연납 이력' },
  // ── 2층 (관리비 30,000 + 엘베 20,000 포함) ────────────
  { name:'201호', tenant:'영수아이학원',     phone:'01044405050', rent:1050000, deposit:2000000, start:'2023-06-01', end:'2025-05-31',  payDay:15, pattern:'perfect',      note:'계약 만료됨 — 갱신 협의 필요' },
  { name:'202호', tenant:'더클리닉피부과',   phone:'01055506060', rent: 950000, deposit:2000000, start:'2023-08-01', end:'2025-07-31',  payDay:15, pattern:'two_behind',   note:'2달 미납 — 독촉장 발송' },
  { name:'203호', tenant:'삼성회계법인',     phone:'01066607070', rent:1250000, deposit:3000000, start:'2022-12-01', end:null,          payDay:15, pattern:'perfect' },
  { name:'204호', tenant:'홈스타일인테리어', phone:'01077708080', rent:1050000, deposit:2000000, start:'2023-04-01', end:'2026-03-31',  payDay:15, pattern:'perfect',      note:'계약 만료 이달 말' },
  { name:'205호', tenant:'한국법무사사무소', phone:'01088809090', rent:1050000, deposit:2000000, start:'2023-05-01', end:null,          payDay:15, pattern:'perfect' },
]

// ══════════════════════════════════════════════════════════
// 케이스 C — 고시원 30개 룸
// 25만 × 20 (101~120), 35만 × 10 (201~210)
// 고정 관리비 150만원 (전기세·관리비)
// ══════════════════════════════════════════════════════════
const NAMES_25 = [
  ['김지훈','01011110001'], ['이민수','01022220002'], ['박성호','01033330003'],
  ['최진욱','01044440004'], ['정우성','01055550005'], ['한가람','01066660006'],
  ['오대성','01077770007'], ['윤태호','01088880008'], ['임현준','01099990009'],
  ['강인국','01011110010'], ['조민혁','01022220011'], ['신창수','01033330012'],
  ['황성진','01044440013'], ['안준서','01055550014'], ['류시우','01066660015'],
  ['서동현','01077770016'], ['홍민재','01088880017'], ['전승우','01099990018'],
  ['차준범','01011110019'], ['류민준','01022220020'],
]
const NAMES_35 = [
  ['김다은','01033330021'], ['이채원','01044440022'], ['박소영','01055550023'],
  ['최지수','01066660024'], ['정예슬','01077770025'], ['한수진','01088880026'],
  ['오민지','01099990027'], ['윤하은','01011110028'], ['임세은','01022220029'],
  ['강혜린','01033330030'],
]
// 납부 패턴 분배 (현실적 비율)
const PAT_25: Pattern[] = [
  'perfect','perfect','perfect','perfect','perfect',
  'perfect','perfect','perfect','perfect','perfect',
  'perfect','perfect','perfect','miss_mid','miss_mid',
  'miss_mid','two_behind','two_behind','three_behind','new_tenant',
]
const PAT_35: Pattern[] = [
  'perfect','perfect','perfect','perfect','perfect',
  'perfect','perfect','miss_mid','two_behind','three_behind',
]

function goshiwonStart(pattern: Pattern, i: number): string {
  if (pattern === 'new_tenant') return monthsAgo(1 + (i % 2))
  // 입주일 분산: 6~18개월 전
  const d = new Date()
  d.setMonth(d.getMonth() - (6 + (i * 7) % 13))
  d.setDate(1)
  return d.toISOString().split('T')[0]
}

const CASE_C: RoomSeed[] = [
  ...NAMES_25.map(([name, phone], i) => ({
    name:    `${100 + i + 1}호`,
    tenant:  name,
    phone,
    rent:    250000,
    deposit: 250000,
    start:   goshiwonStart(PAT_25[i], i),
    end:     null,
    payDay:  1,
    pattern: PAT_25[i],
    note:    PAT_25[i] !== 'perfect' ? ({
      miss_mid:'한 달 연체 이력',two_behind:'2달 미납',three_behind:'3달 미납 — 퇴실 협의',new_tenant:'신규 입주',
    } as Record<Pattern,string>)[PAT_25[i]] : undefined,
  } as RoomSeed)),
  ...NAMES_35.map(([name, phone], i) => ({
    name:    `${200 + i + 1}호`,
    tenant:  name,
    phone,
    rent:    350000,
    deposit: 350000,
    start:   goshiwonStart(PAT_35[i], i),
    end:     null,
    payDay:  1,
    pattern: PAT_35[i],
    note:    PAT_35[i] !== 'perfect' ? ({
      miss_mid:'한 달 연체 이력',two_behind:'2달 미납',three_behind:'3달 미납 — 퇴실 협의',new_tenant:'신규 입주',
    } as Record<Pattern,string>)[PAT_35[i]] : undefined,
  } as RoomSeed)),
]

// ── 케이스별 메타 ─────────────────────────────────────────
const CASES: Record<string, { label: string; rooms: RoomSeed[] }> = {
  A: { label: '소호사무실',  rooms: CASE_A },
  B: { label: '상가빌딩',    rooms: CASE_B },
  C: { label: '고시원',      rooms: CASE_C },
}

// ══════════════════════════════════════════════════════════
// POST — 데모 데이터 생성
// ══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caseParam = new URL(req.url).searchParams.get('case')?.toUpperCase()
  const targets   = caseParam && CASES[caseParam]
    ? { [caseParam]: CASES[caseParam] }
    : CASES

  const now   = new Date()
  const today = now.toISOString().split('T')[0]
  const summary: Record<string, { created: number; skipped: number }> = {}

  for (const [caseKey, { rooms }] of Object.entries(targets)) {
    let created = 0
    let skipped = 0

    for (const seed of rooms) {
      const memo = `${TAG}${caseKey} ${seed.note ?? ''}`

      // ── 1. rooms 삽입 ─────────────────────────────────
      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .insert({
          owner_id:     user.id,
          name:         seed.name,
          status:       seed.pattern === 'two_behind' || seed.pattern === 'three_behind' ? 'UNPAID' : 'PAID',
          tenant_name:  seed.tenant,
          tenant_phone: seed.phone,
          monthly_rent: seed.rent,
          deposit:      seed.deposit,
          lease_start:  seed.start,
          lease_end:    seed.end,
          payment_day:  seed.payDay,
          memo,
        })
        .select('id')
        .single()

      if (roomErr || !room) { skipped++; continue }

      // ── 2. tenants 삽입 ───────────────────────────────
      const { data: tenant } = await supabase
        .from('tenants')
        .insert({
          owner_id:     user.id,
          room_id:      room.id,
          name:         seed.tenant,
          phone:        seed.phone,
          monthly_rent: seed.rent,
          deposit:      seed.deposit,
          lease_start:  seed.start,
          lease_end:    seed.end,
          memo,
        })
        .select('id')
        .single()

      // ── 3. 12개월 청구서 + 납부 이력 생성 ────────────
      const leaseStart = new Date(seed.start)

      for (let mo = 11; mo >= 0; mo--) {
        // 해당 월 1일
        const invDate  = new Date(now.getFullYear(), now.getMonth() - mo, 1)
        // lease_start 이전이면 스킵
        if (invDate < new Date(leaseStart.getFullYear(), leaseStart.getMonth(), 1)) continue

        const invYear  = invDate.getFullYear()
        const invMonth = invDate.getMonth() + 1
        const dueDate  = d(invYear, invMonth, seed.payDay)
        const paid     = isPaid(seed.pattern, mo)
        const isCurrent = mo === 0

        const status: string = paid ? 'paid' : (isCurrent ? 'ready' : 'overdue')

        const { data: inv } = await supabase
          .from('invoices')
          .insert({
            owner_id:    user.id,
            room_id:     room.id,
            tenant_id:   tenant?.id ?? null,
            year:        invYear,
            month:       invMonth,
            amount:      seed.rent,
            paid_amount: paid ? seed.rent : 0,
            status,
            due_date:    dueDate,
            paid_at:     paid ? d(invYear, invMonth, Math.max(1, seed.payDay - 3)) + 'T10:00:00+09:00' : null,
          })
          .select('id')
          .single()

        // 완납 시 payments 기록
        if (paid && inv) {
          await supabase.from('payments').insert({
            owner_id:   user.id,
            room_id:    room.id,
            invoice_id: inv.id,
            amount:     seed.rent,
            paid_at:    d(invYear, invMonth, Math.max(1, seed.payDay - 3)) + 'T10:00:00+09:00',
            note:       `${seed.tenant} ${invYear}년 ${invMonth}월 월세`,
          })
        }
      }

      created++
    }

    summary[`케이스${caseKey} (${CASES[caseKey].label})`] = { created, skipped }
  }

  return NextResponse.json({ ok: true, summary })
}

// ══════════════════════════════════════════════════════════
// DELETE — 데모 데이터 전체 삭제
// ══════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // memo에 TAG가 포함된 호실 조회
  const { data: demoRooms } = await supabase
    .from('rooms')
    .select('id')
    .eq('owner_id', user.id)
    .like('memo', `%${TAG}%`)

  if (!demoRooms?.length) {
    return NextResponse.json({ ok: true, deleted: 0 })
  }

  const roomIds = demoRooms.map(r => r.id)

  // invoices 조회 → payments 삭제
  const { data: invs } = await supabase
    .from('invoices').select('id').in('room_id', roomIds)
  if (invs?.length) {
    await supabase.from('payments').delete().in('invoice_id', invs.map(i => i.id))
  }

  // 순서대로 삭제 (FK 제약 순서)
  await supabase.from('invoices').delete().in('room_id', roomIds)
  await supabase.from('contracts').delete().in('room_id', roomIds)
  await supabase.from('tenants').delete().in('room_id', roomIds)
  await supabase.from('rooms').delete().in('id', roomIds)

  return NextResponse.json({ ok: true, deleted: roomIds.length })
}
