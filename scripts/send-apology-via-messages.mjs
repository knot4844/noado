/**
 * Mac Messages(AppleScript)로 사과 메시지 일괄 발송
 * - 대상: 실 입주사 19명 (테스트 계정 제외)
 * - 방식: SMS 서비스 사용 (iPhone Continuity 필요) → 실패 시 iMessage
 * - 간격: 2초
 *
 * Usage:
 *   node scripts/send-apology-via-messages.mjs           # 실 발송
 *   node scripts/send-apology-via-messages.mjs --test    # 본인 번호로 1건만 테스트
 */
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const MESSAGE = '[대우오피스] 청구 메시지가 실수로 일괄 발송되었습니다. 불편 드려 진심으로 사과드립니다.'

const ALL_RECIPIENTS = [
  { name: '한규동',        phone: '01043194430', room: '212호' },
  { name: '강욱희',        phone: '01087113711', room: '231호' },
  { name: '이근식',        phone: '01073966080', room: '215호' },
  { name: 'PENG YIBO',     phone: '01030661996', room: '218호' },
  { name: '정재훈',        phone: '01050007978', room: '238호' },
  { name: '박상민',        phone: '01037757035', room: '234호' },
  { name: '손옥발',        phone: '01033075366', room: '221호' },
  { name: '이주희',        phone: '01037955228', room: '213호' },
  { name: '김담비',        phone: '01079254656', room: '219호' },
  { name: '대통',          phone: '01030525242', room: '235호' },
  { name: '김나래',        phone: '01027312994', room: '216호' },
  { name: '고즈웰',        phone: '01082425385', room: '232호' },
  { name: '김종우',        phone: '01052292462', room: '222호' },
  { name: '최지원',        phone: '01063169585', room: '220호' },
  { name: '더파트너즈',    phone: '01022711616', room: '214호' },
  { name: '설진태',        phone: '01048026904', room: '217호' },
  { name: '미래씨앤에스',  phone: '01087537874', room: '236호' },
  { name: '김진혁',        phone: '01042314507', room: '230호' },
  { name: '문용광',        phone: '01041446949', room: '233호' },
]

const TEST_RECIPIENT = { name: '본인(테스트)', phone: '01088854844', room: '테스트' }

function toIntlFormat(phone) {
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.startsWith('0')) return '+82' + digits.slice(1)
  return '+82' + digits
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function escAS(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function sendOne(intlPhone, msg) {
  const script = `tell application "Messages"
	set targetService to missing value
	try
		set targetService to 1st service whose service type = SMS
	on error
		try
			set targetService to 1st service whose service type = iMessage
		end try
	end try
	if targetService is missing value then
		error "No SMS or iMessage service available"
	end if
	set targetBuddy to buddy "${escAS(intlPhone)}" of targetService
	send "${escAS(msg)}" to targetBuddy
end tell
`
  const tmpFile = join(tmpdir(), `send-msg-${Date.now()}-${Math.random().toString(36).slice(2)}.applescript`)
  writeFileSync(tmpFile, script, 'utf8')
  try {
    execSync(`/usr/bin/osascript ${JSON.stringify(tmpFile)}`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, err: String(e.stderr ?? e.message).trim() }
  } finally {
    try { unlinkSync(tmpFile) } catch {}
  }
}

async function main() {
  const isTest = process.argv.includes('--test')
  const recipients = isTest ? [TEST_RECIPIENT] : ALL_RECIPIENTS

  console.log(`\n📤 ${isTest ? '테스트 발송' : '사과 메시지 일괄 발송'} (총 ${recipients.length}명)\n`)
  console.log(`문구: ${MESSAGE}\n`)
  console.log('─'.repeat(60))

  const results = []
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    const intl = toIntlFormat(r.phone)
    process.stdout.write(`[${i + 1}/${recipients.length}] ${r.room} ${r.name} (${intl}) ... `)
    const res = sendOne(intl, MESSAGE)
    if (res.ok) {
      console.log('✓')
      results.push({ ...r, ok: true })
    } else {
      console.log(`✗ ${res.err?.slice(0, 120)}`)
      results.push({ ...r, ok: false, err: res.err })
    }
    if (i < recipients.length - 1) await sleep(2000)
  }

  console.log('─'.repeat(60))
  const ok = results.filter(r => r.ok).length
  const fail = results.filter(r => !r.ok).length
  console.log(`\n✅ 성공: ${ok}명   ❌ 실패: ${fail}명\n`)

  if (fail > 0) {
    console.log('실패 목록:')
    for (const r of results.filter(x => !x.ok)) {
      console.log(`  - ${r.room} ${r.name} (${r.phone}): ${r.err?.slice(0, 150)}`)
    }
    process.exit(1)
  }
}

main()
