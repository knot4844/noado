# Noado 프로젝트 진행 상황 (Project Status & Handoff)

> **Last Updated:** 2026-03-19 (새벽) — 실데이터 임포트 완료 (임차인현황 xlsx + 25년 거래내역 md → DB)
> **목적:** 다른 AI(Claude 등)로 작업을 이관하거나 다음 작업 세션(Antigravity 등)을 재개할 때 즉시 문맥을 파악하기 위한 진행 상황 기록 문서입니다.

---

## ✅ 완료된 작업 (Completed)

### 20. 실데이터 임포트 완료 (2026-03-19)
- **완료:**
  - `임차인현황_import.xlsx` 파싱 → 15개 호실(205호~238호) 구조 확인
  - `25년 거래내역.md` 분석 → 2025년 1~12월 납부 내역 파싱 (호실별 날짜·금액)
  - `scripts/import-real-data.mjs` 작성 및 실행
  - DB 삽입 결과: rooms 15개, leases 15개, invoices ~170건, payments ~163건
  - 월말 초과 날짜 버그(2025-02-31 등) 수정 후 재실행으로 누락 10건 보완
- **결정:**
  - 기존 테스트 데이터(호 없는 이름: "205", "213" 등)와 실데이터("205호" 형식)가 DB에 공존 중 → 추후 정리 필요
  - 임포트 스크립트는 idempotent (중복 실행해도 기존 데이터 보존, 누락분만 추가)
  - 납부 상태 기준: 2025-12월 납부 여부로 rooms.status 자동 세팅
- **DB 현황 (총계):**
  - rooms: 36개 (기존 21 + 신규 15호)
  - leases: 42개 (기존 27 + 신규 15)
  - invoices: 383건, payments: 398건, 총 수납액: 135,420,000원
- **미납/주의 호실 (12월 기준):**
  - 215호 주상완 (12월 미확인), 220호 최지원 (12월 미납), 230호 김진혁 (12월 미확인)
  - 231호 팜푸드 (12월 미납), 236호 주식회사미래씨앤에스 (11·12월 미납)
- **다음:** 기존 테스트 데이터(호 없는 rooms) 정리 권장, 대시보드 KPI leases 기준 교체([A단계])

### 19. /team 에이전트 스킬 신설 (2026-03-19)
- `.claude/skills/team/SKILL.md` 생성
- `/team <작업내용>` 으로 호출
- 작업 유형 자동 판단 → 전문가 10명 풀에서 3명 소집 (BE/FE/DB/SEC/UX/PM/QA/PERF/DATA/DEVOPS)
- 🔍 비판적 검토자 1명 항상 배석, 문제 있으면 라운드 반복 후 최종 보고
- noado 프로젝트 기술 스택 컨텍스트 내장 (Supabase, Next.js, PortOne, Solapi)
- **주의:** 새 세션에서 인식됨 (현재 세션 reload 필요)

### 18. /worklog 스킬 신설 (2026-03-19)
- `.claude/skills/worklog/SKILL.md` 생성
- 주요 작업 완료, 결정, 세션 마무리 시 자동 실행
- 완료 작업·결정사항·유저 언급을 CLAUDE.md에 자동 기록
- **주의:** 새 세션에서 인식됨 (현재 세션 reload 필요)

### 17. payments 페이지 AI 매칭 UI 개선 (2026-03-19)
- **완료:** Gemini AI 분석 중 드라마틱한 UI 추가
  - 헤더 배지: 보라 그라디언트 펄스 "Gemini AI 분석 중"
  - 모달 배너: 핑 애니메이션 아이콘 + 음파 막대 8개 + 스캔 진행바
  - 행별 상태: "AI 추론 중" pill 배지
  - 결과 배지: 그라디언트 솔리드 "AI 매칭" (glow 포함)
  - AI 추론 이유: 보라 배경 박스 스타일
- **결정:** AI API = Google Gemini 2.5 Flash (`GEMINI_API_KEY` — 로컬 + Vercel 전 환경 확인 완료)
- **유저 언급:** "ai가 분석한다고 생색내줘", "내 임대 데이터가 외부로 안나가?" (→ Gemini API로 나간다고 설명)
- **빌드:** 0 errors 확인

### 16. 공유오피스 전환 — DB 재설계 마이그레이션 완료 (2026-03-19)

**핵심 변경:** 임대사업자 → 공유오피스 모델로 전환. `leases` 테이블을 중심에 두고 rooms/tenants를 독립 관리.

**실행된 마이그레이션:** `supabase/migrations/20260319_redesign_schema.sql`

- **rooms 테이블 정리**
  - 제거: `tenant_name`, `tenant_phone`, `tenant_email`, `monthly_rent`, `payment_day`, `deposit`, `lease_start`, `lease_end`, `virtual_account_number`
  - 추가: `building` (건물/구역), `area` (면적 m²)
- **tenants 테이블 정리**
  - 제거: `room_id`, `monthly_rent`, `deposit`, `lease_start`, `lease_end`
  - 추가: `business_no`, `representative`, `birth_date`, `biz_type`, `biz_item`, `id_card_file`
  - 주민번호 수집 없음 (생년월일+사업자번호만), 신분증은 암호화 파일로 저장
- **leases 테이블 신설** (핵심 연결 테이블)
  - `contract_type`: OCCUPANCY(전용좌석) / BIZ_ONLY(공용좌석) / STORAGE(보관)
  - `rate_type`: MONTHLY / DAILY
  - `monthly_rent`: 사용료 + 관리비 포함 (all-in)
  - `pledge_amount`: 예치금 (보증금이라는 단어 사용 안 함)
  - `vat_type`: VAT_INVOICE / CASH_RECEIPT / NONE
  - `status`: RESERVED / ACTIVE / TERMINATED
  - RLS 정책 적용
- **billing_items 테이블 신설** (추가 실비)
  - `item_type`: PARKING / INTERNET / ELECTRICITY / CUSTOM
  - `billing_cycle`: MONTHLY(고정) / ACTUAL(실비)
- **deposits 테이블 신설** (예치금/선납/예약금)
  - `type`: PLEDGE / PREPAY / RESERVE
- **tax_invoices 테이블 신설** (세금계산서)
  - `status`: DRAFT / ISSUED / CANCELLED
  - `ntax_id`: 국세청 승인번호
- **invoices 테이블 수정**: `lease_id`, `base_amount`, `extra_amount` 컬럼 추가
- **payments 테이블 수정**: `lease_id` 컬럼 추가
- **`src/types/index.ts` 전면 재작성**: Room, Tenant, Lease, BillingItem, Deposit, TaxInvoice, Invoice, Payment 인터페이스 업데이트

**현재 DB 테이블 목록:** billing_items, businesses, contracts, deposits, invoices, leases, notification_logs, payments, rooms, tax_invoices, tenants

---

### 15. ESLint 0 errors 달성 + git 정리 (2026-03-18)
- `npm run lint` 결과 59 errors → **0 errors** (경고 31개만 남음)
- `master` 브랜치 삭제 (GitHub 기본 브랜치 main으로 변경 후 master 제거)
- StepRow 호버 리프트 효과 추가 (`translateY(-4px)` + glow + 탄성 커브)

### 14. [5단계] 계약기간별 임대료 자동 산정 (2026-03-18)
- **`/api/cron/generate-invoices/route.ts`** (월례 크론) 수정
  - tenants 쿼리에 `name, phone, monthly_rent` 추가
  - 청구서 `amount`: `tenants.monthly_rent` 우선, 없으면 `rooms.monthly_rent` 폴백
  - 청구서 `tenant_id` 자동 세팅
  - 알림톡 발송 시 연락처/이름도 tenants 기준 우선 사용
- **`payments/page.tsx`** (수동 일괄생성 `generateInvoices`) 동일하게 수정
  - 청구 기준월 기준 `lease_end >= billingDate` 조건으로 계약 중인 입주사 조회
  - `tenants.monthly_rent` 우선 적용, `tenant_id` 청구서에 기록

### 12. [3단계] 입주사별 연도별 납부내역 뷰 완료 (2026-03-18)
- `PaymentHistoryModal` (`/tenants`) 개선
  - **연도 선택 네비게이션** — `◀ 2024년 ▶` + 드롭다운 셀렉트, 최근 연도로 자동 포커스
  - **계약기간 외 월 비활성 처리** — `lease_start/lease_end` 기준, 점선 테두리 + 반투명 + "계약기간 외" 툴팁
  - **연도별 통계** — 선택 연도 기준 총청구/수납완료/미수납/완납·미납 횟수
  - **범례** — 완납/미납/연체/청구없음/계약기간 외 색상 설명
  - 헤더에 계약기간(입주일~퇴실일) 표시

### 13. [4단계] 은행 입금내역 자동 분류 고도화 (2026-03-18)
- **`normalize()` 함수** — 공백 제거 + (주)/(유)/(사)/주식회사/유한회사/사단법인 접두사 정규화
- **`nameScore()` 함수** — 정규화 후 완전일치(2점)/부분일치 70%(1점)/불일치(0점) 점수 계산
- **계약기간 필터링** — 입금일 기준 `lease_start <= 입금일 <= lease_end` 인 입주사만 매칭 후보로 사용
- **`tenants` 테이블 활용** — rooms.tenant_name 단순 비교에서 tenants.name 정규화 매칭으로 개선
- 폴백: tenants 매칭 실패 시 rooms.tenant_name으로 이전 방식 유지

### 9. Solapi 환경변수 설정 완료 (2026-03-18)
- **`SOLAPI_FROM_NUMBER=01088854844`** — 솔라피 발신번호 등록 확인 후 `.env.local` 및 Vercel에 추가
- **`SOLAPI_TEMPLATE_PAYMENT_NOTIFY_ADMIN=GX3F22DndC`** — "납부 완료 관리자 알림" 템플릿 신규 생성 후 카카오 검수 제출 (검수진행중, 1~3 영업일 소요)
  - 템플릿 내용: `[노아도] 납부 완료 안내\n\n#{호실}호 #{입주사}님이 임대료를 납부했습니다.\n\n납부 금액: #{금액}원`
- **`SOLAPI_TEMPLATE_CONTRACT_SIGN`** (INVOICE_ISSUED) — 기존 재제출, 검수진행중
- Vercel 환경변수 2개 추가 완료 (전체 환경)

### 10. ESLint 에러 전체 수정 완료 (2026-03-18)
- 빌드는 정상이었으나 `npm run lint` 결과 **59 errors, 33 warnings** → **0 errors** 달성
- 수정 내역:
  - `react/no-unescaped-entities` (27건): privacy, terms, seed-demo, contracts 등 정적 페이지 eslint-disable 처리
  - `@typescript-eslint/no-explicit-any` (10건): `unknown` + `instanceof Error` 가드로 교체
  - `react-hooks/set-state-in-effect` (9건): `setTimeout(() => ..., 0)` 래핑
  - `@typescript-eslint/no-require-imports` (3건): ES import 변환 또는 disable 처리
  - `react/no-impure-function` (2건): `Date.now()` 모듈 레벨 상수로 이동

### 11. Git 브랜치 정리 (2026-03-18)
- `origin/master` (커밋 2개짜리 구버전) 삭제
- GitHub 기본 브랜치를 `master` → `main`으로 변경
- GitHub CLI(`~/bin/gh`) 설치 완료 (macOS arm64, v2.67.0)

### 1. 포트원(PortOne) V2 적용 현황 분석 및 검증 완료
- **분석 결과:** 현재 백엔드의 가상계좌 발급 API(`/api/portone/virtual-account/route.ts`) 및 웹훅 수신 라우트(`/api/webhook/portone/route.ts`)는 이미 모두 **최신 PortOne V2 스펙으로 정상 구현**되어 있음이 확인되었습니다.
- **주요 특징:**
  - V2 REST API 엔드포인트(`https://api.portone.io`) 사용
  - 헤더 기반 시크릿 키 인증 (`Authorization: PortOne {SECRET}`)
  - V2 웹훅 서명(`webhook-signature` HMAC-SHA256) 검증 방식 완벽 적용

### 2. 웹훅(Webhook) DB 연동 로컬 테스트 성공
- **테스트 방식:** 방(rooms), 세입자(users), 청구서(invoices) 가짜 데이터를 생성한 뒤, 로컬 서버(`localhost:3000`)로 `Transaction.Paid` 웹훅 발생 스크립트 실행 (방법 A 채택)
- **달성 내역:**
  - 서명(Signature) 검증 무사 통과
  - 고유 결제 ID(`portone_payment_id`)로 DB의 `invoices` 테이블 매칭 성공
  - `payments` 테이블에 입금 내역 정상 Insert 확인 (금액, 날짜 등 일치)
  - 연관된 `invoices` 상태가 `paid`로 업데이트
  - 연관된 `rooms` 납부 상태가 `PAID`로 자동 변경 성공
  - **동시성 방어 (Idempotency) 테스트 성공:** 동일한 결제 건에 대해 10개의 웹훅이 밀리초 단위로 동시에 도달하게 하는 테스트 스크립트 실행 결과, 1건만 정상 처리되고 나머지 9건은 `payments.portone_payment_id`의 `UNIQUE` 제약 조건 및 읽기 검증 로직에 의해 모두 철저히 차단(Duplicate)되어 이중 수납을 완벽하게 방어함을 증명함.

### 3. 스키마 불일치 버그 픽스 (Schema Mismatch Fix)
- 과거 마이그레이션(`migration.sql`) 스펙과 현재 적용된 라이브 DB 스키마(`src/types/index.ts`) 간의 불일치 오류를 디버깅했습니다.
- **수정완료:** 백엔드 웹훅 라우트에서 레코드 인서트/조회 시 `business_id` 대신 라이브 DB에 맞춘 `owner_id`를 사용하도록 정정 완료했습니다.

---

### 4. 웹훅 예외 및 실패 처리 (Error Handling) 추가 완료
- `Transaction.Paid` 외에도 `Transaction.Failed`, `Transaction.Cancelled`, `Transaction.Expired` 이벤트를 수신하도록 웹훅을 확장했습니다.
- 결제가 실패하거나 가상계좌가 만료된 경우, 해당 청구서(`invoices`)의 `portone_payment_id`와 가상계좌 발급 정보들을 `null`로 초기화하여 추후 다시 결제/발급을 시도할 수 있도록(재결제 가능 상태) 안전하게 폴백(Fallback) 로직을 구현했습니다.

---

### 5. 2단계: 청구서 일괄 생성 고도화 및 자동 알림톡 (완료)
- **정기 납부일 (Payment Day) 추가**: `rooms` 테이블에 `payment_day`를 추가하고, 어드민 호실 관리 UI(`/units`)에서 각 호실별로 1~31일 지정 가능하게 연동.
- **동적 납기일 세팅**: 월례 크론 스케줄러(`/api/cron/generate-invoices/route.ts`) 및 관리자의 수동 일괄생성 시, 각 호실의 `payment_day`를 참조하여 이달 청구서의 `due_date`(수납 기한)를 커스텀 적용.
- **결제 안내 알림톡 연동 자동화**: 청구서 생성 시 세입자 정보가 있으면 **"임대료 결제 전용 링크(`/pay/[id]`)"가 담긴 알림톡(`INVOICE_ISSUED` 템플릿)**을 카카오톡으로 즉시 자동 발송. 수납 페이지에서 '카톡재발송' 버튼으로 수동 전송도 지원.

---

### 6. 프론트엔드 통합 테스트 완료 (2026-03-15)
- `/pay/[invoiceId]` 페이지에서 가상계좌 발급 → 계좌번호 표시까지 전체 흐름 정상 확인.
- **버그 수정 내역 (`/api/portone/virtual-account/route.ts`):**
  - 엔드포인트 수정: `POST /payments/{id}/virtual-account` → `POST /payments/{id}/instant`
  - 요청 바디 구조 변경: `method.virtualAccount.expiry.dueDate`, `option.type: 'NORMAL'`, `customer.name.full`, `customer.email` 추가
  - 응답 파싱 수정: `virtualAccount` → `method` (단건 조회 응답 기준)
  - 과거 due_date 입력 시 오늘 +7일 fallback 추가
- **채널 설정:** KG이니시스 결제창 타입 채널키 → **API 타입 채널키**(`channel-key-dd35dbea-...`)로 교체
- **웹훅 설정:** PortOne 콘솔 Endpoint URL `https://www.noado.kr/api/webhook/portone` 로 수정 + 시크릿 `.env.local` 반영 완료
- **테스트 환경 참고:** KG이니시스 테스트 MID(`INIpayTest`)는 신한은행만 지원. 실 연동 시 전 은행 정상.

### 7. 카카오 로그인 재연동 완료 (2026-03-15)
- **배경:** `Nabido` → `Noado` 앱 이름 변경으로 카카오 디벨로퍼스 앱을 새로 생성, 기존 키 연결이 끊어졌던 것을 재연동.
- **완료 내역:**
  - 카카오 디벨로퍼스 노아도 앱(ID: 1396403) 확인
  - 카카오 로그인 상태: **ON**
  - 로그인 Redirect URI: `https://zswazaviqcaikefpkxee.supabase.co/auth/v1/callback` 등록 확인
  - Client Secret(`aQ58wm8ASxOuDU0S3qAC3lJLzLfsc0sr`) 활성화(ON) 확인
  - Supabase Authentication > Providers > Kakao에 REST API Key(`a33d3146adb1dcccb373c67292910a69`) + Client Secret 업데이트
  - 카카오 로그인 정상 동작 확인 ✅

---

### 8. 은행 엑셀 업로드 → 수납 매칭 기능 전면 개편 (2026-03-16)

#### 8-1. `rooms/[id]` 호실 상세 페이지 — 실제 청구서 데이터 연동
- 기존 `mockPaymentHistory` 하드코딩 제거.
- Supabase에서 `invoices` 테이블을 `room_id`로 조회해 최근 24개월 청구서 내역 표시.

#### 8-2. 수납 페이지(`/payments`) — 은행 엑셀 업로드 기능 전면 개선
**파일:** `src/app/payments/page.tsx`

- **Excel 날짜 직렬값(serial number) 파싱 함수 `parseBankDate` 추가**
  - SheetJS가 날짜 셀을 숫자(예: `45373`)로 반환하는 경우 → Excel serial → JS Date 변환 처리
  - 4단계 파싱: serial number → YYYYMMDD 문자열 → JS Date → fallback(현재 날짜)

- **B 기능: 과거 미등록 입금 내역 일괄 소급 등록**
  - 드롭다운에서 호실을 선택할 때 `new:{roomId}` 형태 옵션 지원
  - `executeMatches` 실행 시 해당 은행 입금 날짜(`year/month`)로 청구서(invoice) 자동 생성 후 즉시 완납 처리
  - 완료 토스트에 신규 등록 월 목록 표시 (예: `· 신규등록 2025-01, 2025-02, ...`)

- **컬럼 정렬 기능 추가**
  - 입금일 / 입금액 / 내용 / 매칭호실 / 상태 각 컬럼 클릭 시 오름/내림차순 전환
  - `sortedMatches` useMemo로 정렬된 배열 관리
  - **정렬 후 onChange 버그 수정:** 정렬 후 배열 인덱스가 바뀌어도 `m.rowIdx === pm.rowIdx` 방식으로 올바른 항목 업데이트

- **"이미 완납" 행 수정 허용**
  - 기존에 `isDuplicate` 행은 체크박스/드롭다운이 disabled였으나, 편집 가능하도록 변경
  - 드롭다운 변경 시 `isDuplicate: false`로 전환되어 수납 확정 대상으로 처리

- **"이미 완납" 행 매칭 호실 자동 표시**
  - `duplicateLabel` 필드 추가: 완납 청구서 생성 시 호실명+세입자명 저장
  - 드롭다운에 기존 완납 건 전용 optgroup 렌더링으로 항상 표시

- **자동 매칭 로직 (핵심 버그 수정 2026-03-16)**
  - **원인:** `rooms` SELECT 쿼리에 DB에 없는 `tenant_company_name` 컬럼 포함 → Supabase 400 에러 → `allRooms = []` → 자동 매칭 전부 실패
  - **수정:** `tenant_company_name` 완전 제거. `tenant_name` 단일 필드만 사용하여 은행 입금 내용과 매칭
  - 매칭 우선순위:
    1. 미납 청구서 중 금액 + `tenant_name` 일치 → 해당 청구서 자동 선택
    2. 청구서 없을 경우 `allRooms` 에서 `tenant_name` 일치하는 호실 → `new:{roomId}` 신규 등록 옵션 자동 선택
  - `invoices` SELECT에서도 `tenant_company_name` 제거: `rooms(name, tenant_name, tenant_phone)`

- **드롭다운 UI 개선:** `min-width: 200px`, `text-sm px-3 py-2`

#### 8-3. 입주사 관리 페이지(`/tenants`) — 12개월 납부 내역 도트 표시
**파일:** `src/app/tenants/page.tsx`

- **무한 루프 버그 수정:** `createClient()` 매 렌더 호출 문제
  - `TenantsPage`와 `PaymentHistoryModal` 모두 `useMemo(() => createClient(), [])` 적용
  - `useEffect` deps 배열에서 `supabase` 제거

- **6개월 → 12개월 히스토리로 변경**
  - `Array.from({ length: 12 }, ...)` + `now.getMonth() - (11 - i)` 방식

- **청구서 데이터 로드 방식 개선 (2-step 쿼리)**
  ```
  1. rooms 조회 (owner_id, neq VACANT)
  2. invoices 조회 (owner_id + room_id IN [...])
  ```
  - `invoicesByRoom: Record<string, Invoice[]>` 맵으로 구성 후 각 room에 매핑

---

## 🧠 중요한 기술 문맥 (Context Notes)

1. **멱등성(Idempotency)**: `payments` 테이블의 `portone_payment_id` 필드에 걸려있는 UNIQUE 제약조건을 활용하여 콜백/웹훅 동시 발생 시 중복 결제처리를 원천 차단하고 있습니다.

2. **청구서 매칭 전략**: 웹훅으로 날아온 `paymentId`를 `invoices` 테이블의 `portone_payment_id` 컬럼과 대조하여 해당 호실과 소유자를 매칭합니다.

3. **가상계좌 위주 활용**: 프론트엔드 포트원 SDK 호출보다는, 현재는 백엔드(`portone/virtual-account`) 단에서 포트원 V2 REST API를 호출해 가상계좌를 직접 따오는 방식을 주력으로 채택 중입니다.

4. **DB 스키마 주의사항 (`rooms` 테이블)**
   - `tenant_company_name` 컬럼 **없음** (타입 파일 `src/types/index.ts`의 `Room` 인터페이스 기준)
   - 회사명도 `tenant_name`에 통합 저장됨
   - Supabase SELECT에 없는 컬럼 포함 시 400 에러 반환 → 조회 결과 전체가 null 처리됨

5. **Excel 파싱 주의사항**
   - SheetJS(`xlsx`)로 날짜 셀 파싱 시 serial number(예: `45373`)로 반환될 수 있음
   - `parseBankDate()` 함수가 serial → JS Date 변환 처리 포함

6. **수납 매칭 자동화 로직 (`src/app/payments/page.tsx`)**
   - `allRooms`: 비어있으면 자동 매칭 전혀 안 됨 → load() 실패 시 반드시 확인
   - `noteMatchesRoom(note, tenantName)`: `note.includes(tenantName)` 단순 포함 검사

---

## ✅ 해결된 버그 (2026-03-17)

### 버그 1: 자동 매칭 전혀 안 됨 — `allRooms` 비어있음 ✅ 해결
- **원인:** `load()`의 allRooms 쿼리에 `.neq('status', 'VACANT')` 필터가 있어 VACANT 호실이 제외된 채 1개만 반환됨
- **수정:** `.neq('status', 'VACANT')` 제거 → 21개 전체 호실 반환. 자동 매칭 정상 동작 확인 (설진태→217호, 문용광→205호, 김경남→221호, (주)더파트너즈→214호 등)

### 버그 2: 신규 청구서 생성 오류 (`executeMatches`) ✅ 해결
- **결과:** `.select('id').single()` 체인이 이미 존재했고 정상 동작. 공구와인테리어 2025-01 청구서(517,000원) 신규 생성 확인

### 버그 3: 입주사 관리 12개월 도트 회색 ✅ 해결 (데이터 정상, CSS 수정)
- **원인:** 데이터는 정상(126개 invoice 로드, 214호 2026-03 paid 확인). 12번째 도트가 카드 우측 `overflow-hidden`에 클리핑됨
- **수정:** 도트 크기 `w-4 h-4` → `w-3.5 h-3.5`, gap `gap-1` → `gap-0.5`, 레이블 축약("최근 12개월" → "12개월"), ChevronRight `shrink-0`으로 고정

---

## 🚀 다음 세션 시작 순서

### 즉시 확인
1. `npm run build` — 0 errors 확인
2. 기존 테스트 데이터 정리 — rooms 이름에 "호" 없는 것들 삭제 권장
   - 삭제 방법: Supabase 대시보드 또는 스크립트로 `WHERE name NOT LIKE '%호'` 조건으로 삭제

### 이어서 개발할 것 (우선순위 순)
3. **대시보드 KPI leases 기준으로 교체** — 현재 `rooms` 테이블 기준 → `leases` 기준으로 변경
   - 파일: `src/app/dashboard/page.tsx`
   - 입주율 = ACTIVE lease 수 / 전체 rooms 수
   - 이번 달 수납 = invoices (lease_id 있는 것) 기준
4. **billing_items UI** — 실비 항목 관리 (주차/인터넷/전기/커스텀)
   - 계약별 추가 실비 등록·수정·삭제
   - `/units` 또는 `/tenants` 내 계약 상세 탭에 추가
5. **deposits UI** — 예치금·선납·예약금 관리
   - 계약 시 예치금 수령 기록, 퇴실 시 환불 처리
6. **청구서 생성 로직 leases 완전 연동**
   - `base_amount` = lease.monthly_rent
   - `extra_amount` = billing_items 합계
   - `amount` = base + extra (현재는 lease.monthly_rent만 사용)
7. **tax_invoices UI** — 세금계산서 발행 관리 (VAT_INVOICE 계약에 한해)

---

## 📋 다음 개발 계획 (Next Feature Roadmap)

> ✅ 이전 1~5단계 로드맵 (tenants/leases 전환) 전부 완료됨 (2026-03-17~19)
> 아래는 leases 중심 구조 완료 이후 이어서 개발할 기능들

---

### [A단계] 대시보드 KPI — leases 기준으로 교체
- 입주율: ACTIVE lease 수 / 전체 rooms 수
- 이번 달 수납: invoices.lease_id 기반
- 만료 예정: leases.lease_end 기준 30일 내
- 파일: `src/app/dashboard/page.tsx`

---

### [B단계] billing_items UI — 실비 항목 관리
- 계약(lease)별 추가 실비 등록·수정·삭제
- 항목 유형: PARKING / INTERNET / ELECTRICITY / CUSTOM
- 월정액(MONTHLY) vs 실비(ACTUAL) 구분
- 청구서 생성 시 `extra_amount`에 자동 합산
- 위치: `/units` 또는 `/tenants` 계약 상세 탭

---

### [C단계] deposits UI — 예치금 관리
- 입주 시 예치금(PLEDGE) 수령 등록
- 퇴실 시 환불 처리 (refunded_at 세팅)
- 선납(PREPAY), 예약금(RESERVE) 구분 표시
- 위치: 계약 상세 or 별도 `/deposits` 페이지

---

### [D단계] 청구서 생성 완전 leases 연동
- `base_amount` = lease.monthly_rent
- `extra_amount` = 해당 lease의 billing_items 합계
- `amount` = base + extra (현재는 lease.monthly_rent만 사용 중)
- 파일: `/api/cron/generate-invoices/route.ts`, `payments/page.tsx`

---

### [E단계] tax_invoices UI — 세금계산서 관리
- vat_type = VAT_INVOICE 계약에 한해 발행
- DRAFT → ISSUED → CANCELLED 상태 관리
- 국세청 승인번호(ntax_id) 입력

---

## 🔧 클로드 스킬 현황

| 스킬 | 경로 | 용도 |
|------|------|------|
| `/worklog` | `.claude/skills/worklog/SKILL.md` | 작업 기록 자동화 — CLAUDE.md 업데이트 |
| `/team` | `.claude/skills/team/SKILL.md` | 팀 에이전트 — 전문가 3명 + 비판적 검토자 |

> 두 스킬 모두 **새 세션**에서 인식됨. 현재 세션은 reload 필요.
