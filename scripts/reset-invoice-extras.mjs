/**
 * reset-invoice-extras.mjs
 * 이번 달 invoices의 amount를 base_amount로 리셋 (공용관리비/실비 일괄 적용분 제거)
 *
 * 실행:
 *   node scripts/reset-invoice-extras.mjs --dry         (현재 상태 확인만)
 *   node scripts/reset-invoice-extras.mjs               (실제 리셋 실행)
 *   node scripts/reset-invoice-extras.mjs --month=4 --year=2026
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zswazaviqcaikefpkxee.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2F6YXZpcWNhaWtlZnBreGVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg5MTUxMCwiZXhwIjoyMDg4NDY3NTEwfQ.ES_d7JNqg3laQHvZ6d6sEpPuJ2srkHjW-UKGG1DFxXA'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const DRY = process.argv.includes('--dry')

const now = new Date()
const yearArg = process.argv.find(a => a.startsWith('--year='))
const monthArg = process.argv.find(a => a.startsWith('--month='))
const YEAR  = yearArg ? Number(yearArg.split('=')[1])  : now.getFullYear()
const MONTH = monthArg ? Number(monthArg.split('=')[1]) : now.getMonth() + 1

console.log(`📅 대상: ${YEAR}년 ${MONTH}월\n`)

async function main() {
  /* 이번 달 invoices 전체 조회 */
  const { data: invoices, error } = await sb
    .from('invoices')
    .select('id, room_id, lease_id, amount, base_amount, extra_amount, status, room:rooms(name), lease:leases(monthly_rent)')
    .eq('year', YEAR)
    .eq('month', MONTH)
    .order('room_id')

  if (error) { console.error('❌ 조회 실패:', error.message); process.exit(1) }
  if (!invoices || invoices.length === 0) {
    console.log('대상 청구서 없음.')
    process.exit(0)
  }

  console.log(`📊 ${YEAR}-${MONTH} 청구서 ${invoices.length}건\n`)

  /* 차이가 있는 항목만 필터 — base_amount가 0/null이면 lease.monthly_rent 우선 사용 */
  const diffs = invoices
    .map(inv => {
      const lr = inv.lease?.monthly_rent ?? 0
      const baseRaw = inv.base_amount && inv.base_amount > 0 ? inv.base_amount : lr
      const base = baseRaw > 0 ? baseRaw : (inv.amount ?? 0)  // 둘 다 없으면 amount 유지
      const diff = (inv.amount ?? 0) - base
      return { ...inv, base, diff, _baseSource: inv.base_amount && inv.base_amount > 0 ? 'base_amount' : (lr > 0 ? 'lease.monthly_rent' : 'fallback(amount)') }
    })
    .filter(x => x.diff !== 0)

  if (diffs.length === 0) {
    console.log('✓ 이미 base_amount와 amount가 일치 — 리셋할 항목 없음.')
    process.exit(0)
  }

  console.log(`▶ 리셋 대상 (amount ≠ base): ${diffs.length}건`)
  diffs.slice(0, 30).forEach(x => {
    console.log(`   ${x.room?.name ?? '—'} · ${x.status} · amount ₩${(x.amount ?? 0).toLocaleString()} → base ₩${x.base.toLocaleString()} (차이 ${x.diff > 0 ? '+' : ''}₩${x.diff.toLocaleString()}) [${x._baseSource}]`)
  })
  if (diffs.length > 30) console.log(`   ... 외 ${diffs.length - 30}건`)
  console.log()

  if (DRY) {
    console.log('🔎 dry run — 변경 안 함')
    process.exit(0)
  }

  /* 일괄 업데이트 */
  let ok = 0, fail = 0
  for (const x of diffs) {
    const { error: uErr } = await sb
      .from('invoices')
      .update({ amount: x.base, extra_amount: 0 })
      .eq('id', x.id)
    if (uErr) { fail++; console.log(`   ❌ ${x.room?.name}: ${uErr.message}`) }
    else ok++
  }

  console.log(`\n🎉 리셋 완료: ${ok}건 성공, ${fail}건 실패`)
}

main().catch(e => { console.error(e); process.exit(1) })
