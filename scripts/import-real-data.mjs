/**
 * import-real-data.mjs
 * 임차인현황_import.xlsx + 25년 거래내역.md → Supabase DB 임포트
 *
 * 실행: node scripts/import-real-data.mjs
 */

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

const SUPABASE_URL = 'https://zswazaviqcaikefpkxee.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2F6YXZpcWNhaWtlZnBreGVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg5MTUxMCwiZXhwIjoyMDg4NDY3NTEwfQ.ES_d7JNqg3laQHvZ6d6sEpPuJ2srkHjW-UKGG1DFxXA'
const OWNER_EMAIL = 'knot4844@gmail.com'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ── 날짜 헬퍼 (월말 초과 시 말일로 clamp) ────────────────
const d = (y, m, day = 1) => {
  const lastDay = new Date(y, m, 0).getDate() // m월의 마지막 날
  const safeDay = Math.min(day, lastDay)
  return `${y}-${String(m).padStart(2,'0')}-${String(safeDay).padStart(2,'0')}`
}

// ── 임차인 데이터 (xlsx 기준 + md 메모 반영) ──────────────
// vat: 'VAT_INVOICE' | 'CASH_RECEIPT' | 'NONE'
const TENANTS_DATA = [
  { room: '205호', name: '문용광',             phone: '',           rent: 330000, vat: 'VAT_INVOICE',   payDay: 10, leaseStart: '2024-01-01' },
  { room: '213호', name: '기업경영연구소',      phone: '',           rent: 308000, vat: 'VAT_INVOICE',   payDay: 15, leaseStart: '2024-01-01' },
  { room: '214호', name: '(주)더파트너즈',      phone: '',           rent: 330000, vat: 'VAT_INVOICE',   payDay: 14, leaseStart: '2024-01-01' },
  { room: '215호', name: '주상완',              phone: '',           rent: 517000, vat: 'NONE',          payDay:  5, leaseStart: '2024-01-01', memo: '에이비마케팅' },
  { room: '217호', name: '설진태',              phone: '',           rent: 297000, vat: 'VAT_INVOICE',   payDay:  1, leaseStart: '2024-01-01', memo: '일산컴샘' },
  { room: '218호', name: '인용식',              phone: '',           rent: 330000, vat: 'VAT_INVOICE',   payDay:  1, leaseStart: '2024-01-01', memo: '24시 바로콜' },
  { room: '219호', name: '김옥분',              phone: '',           rent: 319000, vat: 'VAT_INVOICE',   payDay: 31, leaseStart: '2024-01-01', memo: '도로시' },
  { room: '220호', name: '최지원',              phone: '',           rent: 330000, vat: 'CASH_RECEIPT',  payDay: 26, leaseStart: '2025-03-01' },
  { room: '222호', name: '(주)케이엠무역',      phone: '',           rent: 330000, vat: 'VAT_INVOICE',   payDay:  1, leaseStart: '2024-01-01' },
  { room: '230호', name: '김진혁',              phone: '',           rent: 297000, vat: 'VAT_INVOICE',   payDay: 13, leaseStart: '2024-01-01', memo: '팜푸드(230)' },
  { room: '231호', name: '팜푸드',              phone: '',           rent: 280000, vat: 'VAT_INVOICE',   payDay: 10, leaseStart: '2025-01-01' },
  { room: '232호', name: '고즈웰',              phone: '',           rent: 264000, vat: 'CASH_RECEIPT',  payDay: 10, leaseStart: '2024-01-01', memo: 'VAT 포함 30만' },
  { room: '236호', name: '주식회사미래씨앤에스', phone: '',           rent: 330000, vat: 'VAT_INVOICE',   payDay:  5, leaseStart: '2024-01-01' },
  { room: '237호', name: '주식회사더부띠끄',    phone: '',           rent: 605000, vat: 'VAT_INVOICE',   payDay:  5, leaseStart: '2024-07-01' },
  { room: '238호', name: '강욱희',              phone: '',           rent: 280000, vat: 'NONE',          payDay: 31, leaseStart: '2024-01-01', memo: '비사업자' },
]

// ── 2025년 월별 납부 현황 ───────────────────────────────────
// 25년 거래내역.md에서 추출
// { month: { paid: bool, paidAt: 'YYYY-MM-DD', amount: number } }
// paidAt = null이면 미납
const PAYMENTS_2025 = {
  '205호': {
     1: { paid: true, paidAt: '2025-01-10', amount: 330000 },
     2: { paid: true, paidAt: '2025-02-10', amount: 330000 },
     3: { paid: true, paidAt: '2025-03-10', amount: 330000 },
     4: { paid: true, paidAt: '2025-04-10', amount: 330000 },
     5: { paid: true, paidAt: '2025-05-12', amount: 330000 },
     6: { paid: true, paidAt: '2025-06-10', amount: 330000 },
     7: { paid: true, paidAt: '2025-07-10', amount: 330000 },
     8: { paid: true, paidAt: '2025-08-10', amount: 330000 },
     9: { paid: true, paidAt: '2025-09-10', amount: 330000 },
    10: { paid: true, paidAt: '2025-10-10', amount: 330000 },
    11: { paid: true, paidAt: '2025-11-10', amount: 330000 },
    12: { paid: true, paidAt: '2025-12-10', amount: 330000 },
  },
  '213호': { // 기업경영연구소 — 격월 납부 패턴(늦게 납부)
     1: { paid: true, paidAt: '2025-01-22', amount: 308000 },
     2: { paid: true, paidAt: '2025-03-11', amount: 308000 }, // 3월에 2월치 납부
     3: { paid: true, paidAt: '2025-04-09', amount: 308000 },
     4: { paid: true, paidAt: '2025-05-29', amount: 308000 }, // 늦게
     5: { paid: true, paidAt: '2025-06-15', amount: 308000 }, // 추정
     6: { paid: true, paidAt: '2025-07-08', amount: 308000 },
     7: { paid: true, paidAt: '2025-08-10', amount: 308000 }, // 추정
     8: { paid: true, paidAt: '2025-09-10', amount: 308000 },
     9: { paid: true, paidAt: '2025-10-10', amount: 308000 }, // 추정
    10: { paid: true, paidAt: '2025-11-05', amount: 308000 },
    11: { paid: true, paidAt: '2025-12-10', amount: 308000 }, // 추정
    12: { paid: true, paidAt: '2026-01-08', amount: 308000 }, // 1월에 12월치 납부
  },
  '214호': { // (주)더파트너즈 — 완납
     1: { paid: true, paidAt: '2025-01-14', amount: 330000 },
     2: { paid: true, paidAt: '2025-02-14', amount: 330000 },
     3: { paid: true, paidAt: '2025-03-14', amount: 330000 },
     4: { paid: true, paidAt: '2025-04-15', amount: 330000 },
     5: { paid: true, paidAt: '2025-05-15', amount: 330000 },
     6: { paid: true, paidAt: '2025-06-15', amount: 330000 },
     7: { paid: true, paidAt: '2025-07-15', amount: 330000 },
     8: { paid: true, paidAt: '2025-08-14', amount: 330000 },
     9: { paid: true, paidAt: '2025-09-14', amount: 330000 },
    10: { paid: true, paidAt: '2025-10-15', amount: 330000 },
    11: { paid: true, paidAt: '2025-11-14', amount: 330000 },
    12: { paid: true, paidAt: '2025-12-14', amount: 330000 },
  },
  '215호': { // 주상완 (에이비마케팅) — 거의 완납, 8월 김유경 대납
     1: { paid: true, paidAt: '2025-01-14', amount: 517000 }, // 일부 2회 납부 추정
     2: { paid: true, paidAt: '2025-02-05', amount: 517000 },
     3: { paid: true, paidAt: '2025-03-05', amount: 517000 },
     4: { paid: true, paidAt: '2025-04-06', amount: 517000 },
     5: { paid: true, paidAt: '2025-05-05', amount: 517000 },
     6: { paid: true, paidAt: '2025-06-05', amount: 517000 },
     7: { paid: true, paidAt: '2025-07-05', amount: 517000 },
     8: { paid: true, paidAt: '2025-08-05', amount: 517000 }, // 김유경 대납
     9: { paid: true, paidAt: '2025-09-05', amount: 517000 },
    10: { paid: true, paidAt: '2025-10-05', amount: 517000 },
    11: { paid: true, paidAt: '2025-11-05', amount: 297000 }, // 금액 다름(메모: 일부)
    12: { paid: false, paidAt: null,         amount: 517000 }, // 미확인
  },
  '217호': { // 설진태 (일산컴샘) — 완납
     1: { paid: true, paidAt: '2025-01-01', amount: 297000 },
     2: { paid: true, paidAt: '2025-02-01', amount: 297000 },
     3: { paid: true, paidAt: '2025-03-01', amount: 297000 },
     4: { paid: true, paidAt: '2025-04-01', amount: 297000 },
     5: { paid: true, paidAt: '2025-05-01', amount: 297000 },
     6: { paid: true, paidAt: '2025-06-01', amount: 297000 },
     7: { paid: true, paidAt: '2025-07-01', amount: 297000 },
     8: { paid: true, paidAt: '2025-08-01', amount: 297000 },
     9: { paid: true, paidAt: '2025-09-01', amount: 297000 },
    10: { paid: true, paidAt: '2025-10-01', amount: 297000 },
    11: { paid: true, paidAt: '2025-11-01', amount: 297000 },
    12: { paid: true, paidAt: '2025-12-01', amount: 297000 },
  },
  '218호': { // 인용식 (24시바로콜) → 9월부터 김앤김/김수철 교체
     1: { paid: true, paidAt: '2025-01-21', amount: 330000 }, // 일부 이중 납부 정리 후
     2: { paid: true, paidAt: '2025-02-01', amount: 330000 },
     3: { paid: true, paidAt: '2025-03-04', amount: 330000 },
     4: { paid: true, paidAt: '2025-04-02', amount: 330000 },
     5: { paid: true, paidAt: '2025-05-04', amount: 330000 },
     6: { paid: true, paidAt: '2025-06-04', amount: 330000 },
     7: { paid: true, paidAt: '2025-07-05', amount: 330000 },
     8: { paid: true, paidAt: '2025-08-01', amount: 330000 },
     9: { paid: true, paidAt: '2025-09-30', amount: 396000 }, // 김수철/김앤김 396,000
    10: { paid: true, paidAt: '2025-10-01', amount: 396000 },
    11: { paid: true, paidAt: '2025-11-01', amount: 396000 },
    12: { paid: true, paidAt: '2025-12-01', amount: 396000 },
  },
  '219호': { // 김옥분 (도로시)
     1: { paid: true, paidAt: '2025-01-31', amount: 319000 },
     2: { paid: true, paidAt: '2025-02-28', amount: 319000 },
     3: { paid: true, paidAt: '2025-03-31', amount: 319000 },
     4: { paid: true, paidAt: '2025-04-30', amount: 319000 },
     5: { paid: true, paidAt: '2025-06-01', amount: 319000 }, // 6월1일에 5월치
     6: { paid: true, paidAt: '2025-06-30', amount: 319000 },
     7: { paid: true, paidAt: '2025-08-02', amount: 319000 },
     8: { paid: true, paidAt: '2025-08-31', amount: 319000 },
     9: { paid: true, paidAt: '2025-10-01', amount: 319000 }, // 추정
    10: { paid: true, paidAt: '2025-10-20', amount: 319000 }, // 추정
    11: { paid: true, paidAt: '2025-11-10', amount: 319000 }, // 추정
    12: { paid: true, paidAt: '2025-12-10', amount: 319000 }, // 추정
  },
  '220호': { // 최지원 — 2025년 3월 입주 추정
     3: { paid: true, paidAt: '2025-04-25', amount: 330000 }, // 4/25 납부(3월분)
     4: { paid: true, paidAt: '2025-04-26', amount: 530000 }, // 2개월치? 4/5
     5: { paid: true, paidAt: '2025-05-27', amount: 330000 },
     6: { paid: true, paidAt: '2025-06-27', amount: 330000 },
     7: { paid: true, paidAt: '2025-07-26', amount: 330000 },
     8: { paid: true, paidAt: '2025-08-27', amount: 330000 },
     9: { paid: true, paidAt: '2025-09-26', amount: 330000 },
    10: { paid: true, paidAt: '2025-10-26', amount: 330000 },
    11: { paid: true, paidAt: '2025-11-27', amount: 330000 },
    12: { paid: false, paidAt: null,         amount: 330000 },
  },
  '222호': { // (주)케이엠무역 — 완납
     1: { paid: true, paidAt: '2025-01-02', amount: 330000 },
     2: { paid: true, paidAt: '2025-02-01', amount: 330000 },
     3: { paid: true, paidAt: '2025-03-01', amount: 330000 },
     4: { paid: true, paidAt: '2025-04-02', amount: 330000 },
     5: { paid: true, paidAt: '2025-05-01', amount: 330000 },
     6: { paid: true, paidAt: '2025-06-04', amount: 330000 },
     7: { paid: true, paidAt: '2025-07-01', amount: 330000 },
     8: { paid: true, paidAt: '2025-08-01', amount: 330000 },
     9: { paid: true, paidAt: '2025-09-01', amount: 330000 },
    10: { paid: true, paidAt: '2025-10-01', amount: 330000 },
    11: { paid: true, paidAt: '2025-11-01', amount: 330000 },
    12: { paid: true, paidAt: '2025-12-01', amount: 330000 },
  },
  '230호': { // 김진혁 — 거의 완납
     1: { paid: true, paidAt: '2025-01-12', amount: 297000 },
     2: { paid: true, paidAt: '2025-02-14', amount: 297000 },
     3: { paid: true, paidAt: '2025-03-18', amount: 297000 },
     4: { paid: true, paidAt: '2025-04-15', amount: 297000 },
     5: { paid: true, paidAt: '2025-05-16', amount: 297000 },
     6: { paid: true, paidAt: '2025-06-15', amount: 297000 },
     7: { paid: true, paidAt: '2025-07-13', amount: 297000 },
     8: { paid: true, paidAt: '2025-08-14', amount: 297000 },
     9: { paid: false, paidAt: null,         amount: 297000 }, // 미확인
    10: { paid: true, paidAt: '2025-10-14', amount: 297000 }, // 관리비 포함
    11: { paid: true, paidAt: '2025-11-16', amount: 297000 },
    12: { paid: false, paidAt: null,         amount: 297000 }, // 미확인
  },
  '231호': { // 팜푸드 — 2025년 입주 (데이터 부족)
     1: { paid: true, paidAt: '2025-01-10', amount: 280000 },
     2: { paid: true, paidAt: '2025-02-10', amount: 280000 },
     3: { paid: true, paidAt: '2025-03-10', amount: 280000 },
     4: { paid: true, paidAt: '2025-04-10', amount: 280000 },
     5: { paid: true, paidAt: '2025-05-10', amount: 280000 },
     6: { paid: true, paidAt: '2025-06-10', amount: 280000 },
     7: { paid: true, paidAt: '2025-07-10', amount: 280000 },
     8: { paid: true, paidAt: '2025-08-10', amount: 280000 },
     9: { paid: true, paidAt: '2025-09-10', amount: 280000 },
    10: { paid: true, paidAt: '2025-10-10', amount: 280000 },
    11: { paid: true, paidAt: '2025-11-10', amount: 280000 },
    12: { paid: false, paidAt: null,         amount: 280000 }, // 미확인
  },
  '232호': { // 고즈웰 — 완납 264,000
     1: { paid: true, paidAt: '2025-01-17', amount: 264000 },
     2: { paid: true, paidAt: '2025-02-10', amount: 264000 },
     3: { paid: true, paidAt: '2025-03-10', amount: 264000 },
     4: { paid: true, paidAt: '2025-04-08', amount: 264000 },
     5: { paid: true, paidAt: '2025-05-08', amount: 264000 },
     6: { paid: true, paidAt: '2025-06-09', amount: 264000 },
     7: { paid: true, paidAt: '2025-07-08', amount: 264000 },
     8: { paid: true, paidAt: '2025-08-08', amount: 264000 },
     9: { paid: true, paidAt: '2025-09-08', amount: 264000 },
    10: { paid: true, paidAt: '2025-10-23', amount: 300000 }, // 금액 변경(관리비?)
    11: { paid: true, paidAt: '2025-11-24', amount: 300000 },
    12: { paid: true, paidAt: '2025-12-23', amount: 300000 },
  },
  '236호': { // 주식회사미래씨앤에스 — 11,12월 미납
     1: { paid: true, paidAt: '2025-01-05', amount: 330000 },
     2: { paid: true, paidAt: '2025-02-06', amount: 330000 },
     3: { paid: true, paidAt: '2025-03-17', amount: 330000 },
     4: { paid: true, paidAt: '2025-04-11', amount: 330000 },
     5: { paid: true, paidAt: '2025-05-12', amount: 330000 },
     6: { paid: true, paidAt: '2025-06-09', amount: 330000 },
     7: { paid: true, paidAt: '2025-07-23', amount: 330000 },
     8: { paid: true, paidAt: '2025-08-11', amount: 330000 },
     9: { paid: true, paidAt: '2025-09-04', amount: 330000 },
    10: { paid: true, paidAt: '2025-10-13', amount: 330000 },
    11: { paid: false, paidAt: null,         amount: 330000 }, // 미납
    12: { paid: false, paidAt: null,         amount: 330000 }, // 미납
  },
  '237호': { // 주식회사더부띠끄 — 하반기 입주(2025년 7~8월 시작)
     9: { paid: true, paidAt: '2025-09-10', amount: 605000 },
    10: { paid: true, paidAt: '2025-10-01', amount: 605000 },
    11: { paid: true, paidAt: '2025-11-03', amount: 605000 },
    12: { paid: true, paidAt: '2025-12-08', amount: 605000 },
  },
  '238호': { // 강욱희 — 완납 280,000
     1: { paid: true, paidAt: '2025-01-31', amount: 280000 },
     2: { paid: true, paidAt: '2025-02-28', amount: 280000 },
     3: { paid: true, paidAt: '2025-04-03', amount: 280000 }, // 늦게
     4: { paid: true, paidAt: '2025-04-30', amount: 280000 },
     5: { paid: true, paidAt: '2025-06-02', amount: 280000 }, // 늦게
     6: { paid: true, paidAt: '2025-06-30', amount: 280000 },
     7: { paid: true, paidAt: '2025-07-31', amount: 280000 },
     8: { paid: true, paidAt: '2025-08-31', amount: 280000 },
     9: { paid: true, paidAt: '2025-09-30', amount: 280000 },
    10: { paid: true, paidAt: '2025-11-01', amount: 280000 }, // 늦게
    11: { paid: true, paidAt: '2025-11-30', amount: 280000 },
    12: { paid: true, paidAt: '2025-12-31', amount: 280000 },
  },
}

// ── 메인 임포트 ───────────────────────────────────────────
async function main() {
  console.log('=== Noado 실데이터 임포트 시작 ===\n')

  // 1. owner_id 조회
  const { data: { users }, error: uErr } = await sb.auth.admin.listUsers()
  if (uErr) { console.error('사용자 조회 실패:', uErr.message); process.exit(1) }
  const owner = users.find(u => u.email === OWNER_EMAIL)
  if (!owner) { console.error(`Owner(${OWNER_EMAIL}) 없음`); process.exit(1) }
  const ownerId = owner.id
  console.log(`✓ Owner: ${owner.email} (${ownerId})\n`)

  // 2. leases 테이블 존재 확인 (마이그레이션 체크)
  const { error: leasesCheck } = await sb.from('leases').select('id').limit(1)
  const newSchema = !leasesCheck
  console.log(`✓ 스키마: ${newSchema ? 'leases 테이블 존재 (신규 스키마)' : '구 스키마 (leases 없음)'}\n`)

  // 3. 기존 데이터 확인 및 처리 방법 확인
  const { data: existingRooms } = await sb
    .from('rooms').select('id, name').eq('owner_id', ownerId)
  const staleRooms = (existingRooms ?? []).filter(r => !r.name.endsWith('호'))

  if (staleRooms.length > 0) {
    console.log(`⚠️  "호" 없는 기존 호실 ${staleRooms.length}개 발견:`)
    staleRooms.forEach(r => console.log(`   - ${r.name} (${r.id})`))
    console.log()
    const ans = await ask(
      `이 데이터를 어떻게 처리할까요?\n` +
      `  [d] 삭제 (관련 invoices·payments·leases 포함)\n` +
      `  [k] 유지 (그대로 둠)\n` +
      `선택 (d/k): `
    )
    if (ans.toLowerCase() === 'd') {
      const staleIds = staleRooms.map(r => r.id)
      // 관련 invoices 조회 → payments 삭제
      const { data: staleInvs } = await sb.from('invoices').select('id').in('room_id', staleIds)
      if (staleInvs?.length) {
        await sb.from('payments').delete().in('invoice_id', staleInvs.map(i => i.id))
      }
      await sb.from('invoices').delete().in('room_id', staleIds)
      await sb.from('leases').delete().in('room_id', staleIds)
      await sb.from('rooms').delete().in('id', staleIds)
      console.log(`  ✓ ${staleRooms.length}개 호실 및 관련 데이터 삭제 완료\n`)
    } else {
      console.log('  → 기존 데이터 유지\n')
    }
  }

  let stats = { rooms: 0, tenants: 0, leases: 0, invoices: 0, payments: 0, skipped: 0 }

  for (const td of TENANTS_DATA) {
    console.log(`\n── ${td.room} ${td.name} ──`)

    // 3. room — 기존 조회 후 없으면 INSERT
    let room
    const { data: existingRoom } = await sb
      .from('rooms').select('id').eq('owner_id', ownerId).eq('name', td.room).maybeSingle()

    if (existingRoom) {
      room = existingRoom
      console.log(`  → room 기존: ${room.id}`)
    } else {
      const { data: newRoom, error: roomErr } = await sb
        .from('rooms')
        .insert({ owner_id: ownerId, name: td.room, status: 'PAID', memo: td.memo ?? null })
        .select('id').single()
      if (roomErr || !newRoom) {
        console.error(`  rooms 오류:`, roomErr?.message); stats.skipped++; continue
      }
      room = newRoom
      stats.rooms++
      console.log(`  ✓ room 신규: ${room.id}`)
    }

    // 4. tenant — 기존 조회 후 없으면 INSERT
    let tenant
    const { data: existingTenant } = await sb
      .from('tenants').select('id').eq('owner_id', ownerId).eq('name', td.name).maybeSingle()

    if (existingTenant) {
      tenant = existingTenant
      console.log(`  → tenant 기존: ${tenant.id}`)
    } else {
      const { data: newTenant, error: tenantErr } = await sb
        .from('tenants')
        .insert({ owner_id: ownerId, name: td.name, phone: td.phone || null })
        .select('id').single()
      if (tenantErr || !newTenant) {
        console.error(`  tenants 오류:`, tenantErr?.message); stats.skipped++; continue
      }
      tenant = newTenant
      stats.tenants++
      console.log(`  ✓ tenant 신규: ${tenant.id}`)
    }

    let leaseId = null

    if (newSchema) {
      // 5a. lease — 기존 조회 후 없으면 INSERT
      const { data: existingLease } = await sb
        .from('leases').select('id')
        .eq('owner_id', ownerId).eq('room_id', room.id).eq('tenant_id', tenant.id)
        .maybeSingle()

      if (existingLease) {
        leaseId = existingLease.id
        console.log(`  → lease 기존: ${leaseId}`)
      } else {
        const { data: lease, error: leaseErr } = await sb
          .from('leases')
          .insert({
            owner_id:      ownerId,
            room_id:       room.id,
            tenant_id:     tenant.id,
            contract_type: 'OCCUPANCY',
            rate_type:     'MONTHLY',
            monthly_rent:  td.rent,
            pledge_amount: 0,
            lease_start:   td.leaseStart,
            lease_end:     null,
            payment_day:   td.payDay,
            vat_type:      td.vat,
            status:        'ACTIVE',
          })
          .select('id').single()

        if (leaseErr || !lease) {
          console.error(`  leases 오류:`, leaseErr?.message)
        } else {
          leaseId = lease.id
          stats.leases++
          console.log(`  ✓ lease 신규: ${lease.id}`)
        }
      }
    } else {
      // 5b. 구 스키마: tenants에 room_id, monthly_rent 등 업데이트
      await sb.from('tenants').update({
        monthly_rent: td.rent,
        lease_start:  td.leaseStart,
        lease_end:    null,
      }).eq('id', tenant.id)
    }

    // 6. invoices + payments (2025년 월별)
    const monthMap = PAYMENTS_2025[td.room] ?? {}
    const allMonths = Object.keys(monthMap).map(Number).sort((a, b) => a - b)

    if (allMonths.length === 0) {
      console.log(`  ⚠ 납부 내역 없음 (스킵)`)
      continue
    }

    for (const m of allMonths) {
      const p = monthMap[m]
      const year = 2025
      const dueDate = d(year, m, td.payDay)
      const status  = p.paid ? 'paid' : (m < 3 ? 'overdue' : 'ready') // 2025 기준

      // invoice 이미 존재하는지 확인
      const { data: existingInv } = await sb
        .from('invoices')
        .select('id, status')
        .eq('owner_id', ownerId)
        .eq('room_id', room.id)
        .eq('year', year)
        .eq('month', m)
        .maybeSingle()

      let invId = existingInv?.id

      if (!invId) {
        const invRow = {
          owner_id:    ownerId,
          room_id:     room.id,
          tenant_id:   tenant.id,
          year,
          month: m,
          amount:      p.amount,
          paid_amount: p.paid ? p.amount : 0,
          status,
          due_date:    dueDate,
          paid_at:     p.paidAt ? p.paidAt + 'T10:00:00+09:00' : null,
        }
        if (newSchema && leaseId) {
          invRow.lease_id      = leaseId
          invRow.base_amount   = p.amount
          invRow.extra_amount  = 0
        }

        const { data: inv, error: invErr } = await sb
          .from('invoices').insert(invRow).select('id').single()

        if (invErr) {
          console.error(`  invoices 오류 (${year}-${m}):`, invErr.message)
          continue
        }
        invId = inv.id
        stats.invoices++
      }

      // payment 기록 (완납만)
      if (p.paid && p.paidAt && invId) {
        const { data: existingPay } = await sb
          .from('payments')
          .select('id')
          .eq('invoice_id', invId)
          .maybeSingle()

        if (!existingPay) {
          const payRow = {
            owner_id:   ownerId,
            room_id:    room.id,
            invoice_id: invId,
            amount:     p.amount,
            paid_at:    p.paidAt + 'T10:00:00+09:00',
            note:       `${td.name} ${year}년 ${m}월 월세`,
          }
          if (newSchema && leaseId) payRow.lease_id = leaseId

          const { error: payErr } = await sb.from('payments').insert(payRow)
          if (payErr) console.error(`  payments 오류 (${year}-${m}):`, payErr.message)
          else stats.payments++
        }
      }
    }

    console.log(`  ✓ 청구서 ${Object.keys(monthMap).length}건 처리`)
  }

  // 7. room status 업데이트 (최근 납부 상태 기준)
  console.log('\n── room 상태 업데이트 ──')
  for (const td of TENANTS_DATA) {
    const monthMap = PAYMENTS_2025[td.room] ?? {}
    const dec = monthMap[12]
    const status = dec?.paid ? 'PAID' : 'UNPAID'
    await sb.from('rooms').update({ status })
      .eq('owner_id', ownerId).eq('name', td.room)
  }
  console.log('  ✓ 완료')

  console.log('\n=== 임포트 완료 ===')
  console.log(`rooms: ${stats.rooms}개`)
  console.log(`tenants: ${stats.tenants}개`)
  console.log(`leases: ${stats.leases}개`)
  console.log(`invoices: ${stats.invoices}건`)
  console.log(`payments: ${stats.payments}건`)
  console.log(`skipped: ${stats.skipped}개`)
}

main().catch(console.error)
