/**
 * 사과 메시지 발송 대상자 조회 스크립트
 * ACTIVE 계약 중인 입주사의 phone을 수집
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function normalizePhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/[^0-9]/g, '')
  // 한국 휴대폰: 010xxxxxxxx (11자리)
  if (digits.length === 11 && digits.startsWith('010')) return digits
  if (digits.length === 10 && digits.startsWith('10')) return '0' + digits
  return null
}

async function main() {
  // ACTIVE 계약 → tenant 조인으로 전화번호 수집
  const { data: leases, error } = await supabase
    .from('leases')
    .select('id, room_id, tenant_id, status, rooms(name), tenants(id, name, phone)')
    .eq('status', 'ACTIVE')

  if (error) {
    console.error('ERROR:', error)
    process.exit(1)
  }

  const uniqByTenant = new Map()
  for (const l of leases ?? []) {
    const t = l.tenants
    if (!t) continue
    const phone = normalizePhone(t.phone)
    if (!phone) continue
    if (!uniqByTenant.has(t.id)) {
      uniqByTenant.set(t.id, {
        tenantName: t.name,
        phone,
        roomName: l.rooms?.name ?? '',
      })
    }
  }

  const list = Array.from(uniqByTenant.values())
  console.log(JSON.stringify({
    total: list.length,
    list,
  }, null, 2))
}

main()
