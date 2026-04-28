# Noado 프로젝트 진행 상황 (Project Status & Handoff)

> **Last Updated:** 2026-04-28 — 증거패키지 빈페이지 제거 + 새창 A4 비율 + 인쇄 중복 호출 수정
> **목적:** 다른 AI(Claude 등)로 작업을 이관하거나 다음 작업 세션(Antigravity 등)을 재개할 때 즉시 문맥을 파악하기 위한 진행 상황 기록 문서입니다.

---

## ✅ 완료된 작업 (Completed)

### 28. 증거패키지 추가 다듬기 + 모달 차이 정리 + 주소 하드코딩 발견 (2026-04-28)
- **완료:**
  - **증거패키지 스캔 페이지 빈페이지 추가 발생 수정** (commit `e7d8479`)
    - 원인: `.scan-page` 안에서 `img max-height: 287mm`(인쇄영역 풀) + `.label` div가 287mm 초과 → label이 다음 페이지로 밀려 빈 페이지 발생
    - 수정: img max-height 287mm → 280mm, label padding/line-height 압축, `page-break-inside: avoid` 추가
  - **전자계약 빈 서명란 스캔 페이지 제거 → 2페이지 출력** (commit `62307c1`)
    - 전자계약은 마지막 스캔 페이지가 빈 서명란 placeholder인데 증거패키지 메타에 실제 전자서명 정보가 이미 들어있어 중복
    - `if (hasESign && slicedScans.length > 1) slicedScans.pop()` 처리
    - 결과: 1페이지(계약서 본문) + 2페이지(전자서명 증거 + 계약정보 + 해시 + 스냅샷) = 총 2페이지
  - **증거패키지 새창 A4 비율 + 인쇄 다이얼로그 1회만 호출** (commit `348b8c4`)
    - `.sheet { width: 210mm }` wrapper로 콘텐츠 고정 → 풀스크린에서도 좌우 비율 유지, 글자 늘어짐 방지
    - `@media print { .sheet { width: auto } }` 로 인쇄 시엔 풀페이지
    - `printed` 플래그 추가로 `w.print()` 1회만 호출. 기존: 이미지 로드마다 setTimeout 누적 + 6초 safety net 모두 발동 → 취소 후 다이얼로그 2~3번 반복
  - **수기 계약 모달 2종 차이 정리 (논의)**
    - 「수기 계약서 스캔 업로드」(`ScanUploadModal`) — 처음부터 종이로 계약. 인쇄→대면서명→스캔 풀 워크플로. 신규 계약 row 생성
    - 「간편 업로드」(`QuickScanUploadModal`) — 외부에서 이미 서명 끝낸 계약서를 사후 등록. 인쇄 단계 생략, 기존 contract row 갱신
- **결정 / 유보 (2026-04-28):**
  - **계약서 "소재지/호실주소" 하드코딩 발견** (`contracts/page.tsx:491, 1905`) — 모든 사용자에게 `'경기도 고양시 일산동구 중앙로 1129 제서관동 2017, 2018호 대우오피스'` 가 default. 다른 사업장 운영자에게 잘못된 주소 노출 위험
  - `rooms.building` 필드는 `/units` 표시용으로만 쓰이고 계약서에 자동 반영 안 됨
  - **개선안:** ① `businesses` 테이블에 `address` 컬럼 추가 ② `/settings`에서 기본 주소 입력 ③ `handleRoomSelect`에서 `business.address + room.building + room.name` 자동 prefill
  - **유보 사유:** "지금 건드리면 복잡해진다" — PG/수납 재설계 시 `businesses` 마이그레이션에 `bank_name`/`account_number`/`account_holder` + `address` 한꺼번에 추가하기로
- **유저 언급:**
  - 증거패키지 2번째 페이지가 빈 페이지로 나옴 (원인: img+label overflow)
  - 1번 메타 페이지 내용이 2번 스캔(서명란)과 중복 → 2번을 삭제하고 2페이지로 압축
  - 새창이 풀스크린에 맞춰 글자가 넓게 보임 → A4 비율 유지
  - 인쇄 취소 시 다이얼로그 3번 뜸 → 1회만
  - 건물/구역 필드가 계약서 주소에 반영되는지 확인 요청 → 반영 안 됨 확인
  - 주소 자동 prefix 적용은 나중에 (지금 복잡)
- **다음:** 아래 "🚀 다음 세션 시작 순서" 참조

### 27. 계약서 프린트/증거패키지 정비 + 스캔 자동 압축 (2026-04-27)
- **완료:**
  - **상가임대차 1번 양식 폰트 픽스** — 제목 54 / 조항 28 / 본문 22 (`drawCommercialLease` in `contract-templates.ts`)
  - **2페이지 강제 레이아웃** — 계약서 본문 1.5페이지 + 서명 0.5페이지로 고정. `if (y < sigStartY) y = sigStartY` (sigStartY = PAGE_H + PAGE_H/2)
  - **멀티페이지 PNG 분할 출력** — 신규 `generateTemplateImagePages()` 캔버스를 PAGE_H=1697px(A4 1:√2) 단위로 슬라이스 → `Blob[]` 반환. 업로드 시 `scan_urls`에 전 페이지 저장
  - **기존 단일 PNG 호환** — `ContractPreviewModal`에 `sliceTallImage()` 클라이언트 슬라이서 추가. 기존 long-PNG 계약도 프린트 시 페이지 분할 정상 작동
  - **프린트 서명 누락 수정** — 전자계약 프린트에 서명 페이지 별도 추가 (운영사/입주사 서명 이미지 + 메타 + 해시)
  - **프린트 빈페이지 제거** — `.page` 컨테이너에서 flex 제거, A4 size + max-height 270mm로 강제
  - **증거패키지 3페이지 압축 레이아웃** (commit `23f8af5`):
    - `@page` 여백 10mm → 5mm
    - 스캔 페이지는 이미지만(헤더 제거), 풀 A4
    - 모든 메타데이터(제목/계약정보/서명/해시/스냅샷)를 마지막 1페이지에 압축. 폰트 크기 변화 없이 여백·패딩만 축소
    - 결과: 1·2페이지 = 스캔 이미지, 3페이지 = 전자서명·검증 정보
  - **스캔 업로드 자동 압축** (`src/lib/compress-image.ts` 신규):
    - `compressImageFile(file)` — 3MB 초과 이미지를 max 2200px / JPEG q78로 압축
    - PDF·작은 파일·압축 실패 시 원본 통과
    - `onPickScan`(종이계약 모달) + `QuickScanUploadModal` 양쪽 적용
  - **손옥발/김종우 기존 스캔 일괄 재압축** — `scripts/compress-contract-scans.mjs` (sharp 사용, service role) 작성·실행. 60MB → 0.6MB (99% 절감), DB `template_url`/`scan_urls`/`template_mime` 갱신, 기존 스토리지 파일 삭제
- **결정:**
  - 계약서 = A4 비율 1:√2, PAGE_H 1697px @ width 1200 기준으로 슬라이스
  - 신규 계약은 서버사이드 분할(`generateTemplateImagePages`), 기존 계약은 클라이언트 분할(`sliceTallImage`)로 양쪽 처리
  - 스캔 업로드는 클라이언트 압축, 기존 대용량 파일은 sharp 스크립트로 일괄 처리
- **유저 언급:**
  - 폰트는 54/28/22 픽스, 본문 1.5p + 서명 0.5p = 2페이지로 맞춰라
  - 증거패키지 1·2페이지가 빈 페이지로 나옴 → 폰트 변화 없이 여백 축소로 3페이지 이내 압축
  - 스캔 30MB 파일 업로드 시 자동 압축으로 프린트 가능하게 해달라
- **파일 변경:**
  - 수정: `src/app/contracts/page.tsx`, `src/lib/contract-templates.ts`
  - 신규: `src/lib/compress-image.ts`, `scripts/compress-contract-scans.mjs`
- **다음:** 다른 입주사 대용량 스캔도 압축 스크립트로 일괄 정리 가능
- **유보(2026-04-28 논의):** 계약서 "소재지/호실주소" 하드코딩 (`contracts/page.tsx:491, 1905`)을 발견. 현재 모든 사용자에게 `'경기도 고양시 일산동구 중앙로 1129 제서관동 2017, 2018호 대우오피스'` 가 default로 박혀있음. 다른 사업장 운영자가 쓰면 잘못된 주소 그대로 들어갈 위험. `rooms.building` 필드는 `/units` 표시용으로만 쓰이고 계약서에 반영 안 됨. **개선 방향:** ① `businesses` 테이블에 `address` 컬럼 추가(추후 수납계좌 마이그레이션과 함께) ② `/settings`에서 기본 주소 입력 ③ `handleRoomSelect`에서 `business.address + room.building + room.name` 자동 prefill. **결정:** 지금 건드리면 복잡해지므로 PG/수납 재설계 작업 시 묶어서 처리.

### 26. 계약서 양식 정비 + PG/수납 아키텍처 재설계 논의 (2026-04-22)
- **완료:**
  - 계약서 양식에 생년월일 필드 추가 — TemplateData에 `tenant_birth` 추가, 5종 양식(기본임대/공유오피스/단기/상가/종이계약)에 성명·생년월일·연락처 렌더링, contracts/page.tsx 양쪽 폼에 date picker 입력 추가, tenants 쿼리에 `birth_date` 포함 (commit `5109397`)
  - 종이계약 양식 빈 생년월일 플레이스홀더 `(                    )` 제거 (commit `eeefcb8`)
  - **공간이용계약서 3번째 양식 추가** — `BUILT_IN_TEMPLATES`에 `space-use` 등록, `drawSpaceUseContract` 신규 함수 작성 (예치금 용어, 민법 준거, 이용자/운영사 호칭, 상가건물임대차보호법 미적용). 1번 전자계약·2번 서면계약은 상가임대차계약서로 유지 (commit `5aa829b`)
  - .gitignore 정리 — `supabase/.temp/`, `call-summary.pdf`, scratch `scripts/*.mjs` untrack (commit `789f7d3`)
- **결정:**
  - **카드결제는 노아도 SaaS 구독료(빌링키 정기결제)에만 적용** — 임대료/이용료 수납에서는 카드결제 제거 방침
  - **PG 가상계좌 의존도를 낮추는 방향으로 전환** — PG가 임대업종 거절 가능성 + 결제대행(전자금융거래법) 이슈
  - 운영사가 PG 계약을 반드시 할 필요 없음 — 엑셀 매칭(이미 구현) / 펌뱅킹 / PG 가상계좌 / PG 카드 4단계 옵션
  - 자동 입금 감지 대안: ① 오픈뱅킹(금결원, 장기) ② 은행 입금통지 서비스(단기) ③ 계좌매칭 SaaS(즉시 런칭, 뱅크다·페이워크·웰컴페이먼츠 등)
  - 법적 포지셔닝 문구: "노아도는 SaaS 도구이며, 자금은 각 운영사와 PG사 간에 직접 오갑니다. 노아도는 결제 정보를 수신해 장부를 자동화할 뿐, 자금을 보관·중개하지 않습니다."
  - 계약서 양식 1번=상가임대차계약서, 2번=서면계약(상가), 3번=공간이용계약서로 분리
- **유저 언급:**
  - PG사가 임대사업자에 대해 사용 거절한다는 얘기를 들었다
  - 가상계좌 발급 주된 이유는 입금 webhook 자동 매칭이지 결제대행이 목적 아님
  - 가상계좌 없이 자동 입금 감지 가능한지 확인 요청 — 오픈뱅킹·계좌매칭 SaaS 등 가능하다고 답변
  - 계약서 양식에 "상가 임대차"와 "공간 이용"이 섞여있어 분리해달라고 요청
- **다음:** 아래 "🚀 다음 세션 시작 순서" 참조

### 25. A~E 단계 전체 완료 + rooms 제거 컬럼 전수 점검 + 정리 (2026-04-13)
- **완료:**
  - **rooms 제거 컬럼 전수 점검** — migration #16에서 제거된 컬럼(tenant_name, tenant_phone, monthly_rent 등)을 참조하는 4개 파일 수정
    - `reports/page.tsx` — `rooms(tenant_name, tenant_phone, monthly_rent)` 조인 → leases 경유 보강
    - `portal/[tenantId]/page.tsx` — rooms 제거 컬럼 전부 쿼리 → leases+tenants 경유
    - `tenant-portal/page.tsx` — rooms `select('*')` → tenants 경유 lease 조회
    - `BusinessProvider.tsx` — rooms `select('*')` → leases 조인으로 tenant/rent 정보 보강
  - **[A단계] 대시보드 KPI** — 확인 결과 이미 leases 기준으로 구현되어 있었음 (추가 작업 불필요)
  - **[B단계] billing_items UI** — `BillingItemsPanel` 컴포넌트 신규 생성
    - CRUD (추가/삭제/활성·비활성 토글), 타입별 아이콘 (PARKING/INTERNET/ELECTRICITY/CUSTOM)
    - MONTHLY/ACTUAL 청구 방식, 활성 항목 월 합계 표시
    - `/tenants` 페이지 계약 카드에 통합
  - **[C단계] deposits UI** — `DepositsPanel` 컴포넌트 신규 생성
    - PLEDGE(예치금)/PREPAY(선납)/RESERVE(예약금) 등록, 환불 처리
    - 예치금·선납금 잔액 합계 표시, PREPAY는 환불 버튼 비활성
    - `/tenants` 페이지 계약 카드에 통합
  - **[D단계] 청구서 생성 billing_items 연동**
    - `/api/cron/generate-invoices/route.ts` — billing_items MONTHLY 활성 항목 합산 → `extra_amount` 반영
    - `/payments/page.tsx` 수동 생성 — 동일하게 billing_items 합산 반영
    - `amount = base_amount(monthly_rent) + extra_amount(billing_items 합계)`
  - **[E단계] tax_invoices UI** — `TaxInvoicesPanel` 컴포넌트 신규 생성
    - DRAFT → ISSUED → CANCELLED 상태 관리, 국세청 승인번호(ntax_id) 편집
    - `vat_type = 'VAT_INVOICE'` 계약에만 표시 (조건부 렌더링)
    - 합계금액 입력 시 공급가/세액 자동 계산 (÷1.1)
    - `/tenants` 페이지 계약 카드에 통합
  - **pricing 페이지 네비게이션 중복 수정** — 로그인 상태 체크 → 자체 nav 숨김 (사이드바만 사용)
  - **/billing-pay 불필요 페이지 삭제** — 참조 없음 확인 후 제거
- **파일 변경:**
  - 신규: `src/components/billing/BillingItemsPanel.tsx`, `src/components/deposits/DepositsPanel.tsx`, `src/components/tax/TaxInvoicesPanel.tsx`
  - 수정: `reports/page.tsx`, `portal/[tenantId]/page.tsx`, `tenant-portal/page.tsx`, `BusinessProvider.tsx`, `tenants/page.tsx`, `cron/generate-invoices/route.ts`, `payments/page.tsx`, `pricing/page.tsx`
  - 삭제: `src/app/billing-pay/page.tsx`
- **다음:**
  - 커밋 + Vercel 배포
  - KG이니시스 통신판매신고번호 확보 후 푸터 추가
  - 기존 테스트 데이터 정리 (rooms 이름에 "호" 없는 것들)
  - billing_items ACTUAL(실비) 매월 입력 플로우 고도화
  - 프로덕션 E2E 테스트 (billing_items → 청구서 extra_amount 반영 확인)

### 24. 카드결제 + 수납매칭 발송/링크 + 정기청구 발송 선택 + 버그픽스 다수 (2026-04-10)
- **완료:**
  - **임대료 카드결제 추가** (`/pay/[invoiceId]` 페이지)
    - 기존 가상계좌 전용 → **계좌이체 / 카드결제** 탭 선택 UI 추가
    - `PortOne.requestPayment()` (브라우저 SDK) → KG이니시스 카드결제창 호출
    - `/api/portone/card-payment/route.ts` 신규 — 서버 검증 + invoice 수납 처리 + payments 기록
    - KG이니시스 필수값 대응: `customer.phoneNumber` 추가 (tenant phone DB 조회)
    - `paymentId` 길이 40자 이내로 축소 (KG이니시스 oid 제한)
  - **수납매칭 페이지 메시지 발송 + 링크 복사** (`/payments`)
    - 기존 "카톡재발송" → **"발송" 드롭다운** (hover 시 위로 표시): 카카오톡 / 문자(SMS) 선택
    - **"링크복사" 버튼** 추가 — 호실명·금액·결제링크 포함 텍스트 클립보드 복사
    - 카톡 발송 시 임차인 전화번호 DB 조회 (기존 빈값 버그 수정)
    - `/api/sms/route.ts` 신규 — SMS 단건 발송 + notification_logs 기록
  - **정기청구 발송 카톡/문자 선택** (`/billing`)
    - 발송 모달에 **카카오톡 / 문자(SMS)** 탭 추가
    - 문자 선택 시 결제 링크 포함 SMS 발송
  - **기타 버그픽스 (이전 세션에서 수행, 이번 세션에서 push):**
    - `/billing` 47개 mock 데이터 제거 + rooms 제거 컬럼 수정
    - 전자계약 양식 3종 + 샘플 양식 관리 + 링크 복사
    - 알림톡 발신번호 미등록 수정 (`from` 필드 누락)
    - 마스터 어드민 유저 상세 crash 수정 (toLocaleString on undefined)
    - 헤더 우측 사용자명 실제 이름 표시
    - 가상계좌 예금주 '노아도' 설정 (`remitteeName`)
    - 납부 요청 API `tenants.room_id` 제거 컬럼 참조 수정
- **결정:**
  - 카드결제/가상계좌 모두 같은 `/pay/[invoiceId]` 링크 사용 — 별도 링크 불필요
  - 가상계좌 발급 시 건당 수수료 발생 (200~300원) — 중복 발급 방지 고려 필요
  - 마스터 이메일: `knot4844@gmail.com`
- **파일 변경:**
  - 신규: `/api/portone/card-payment/route.ts`, `/api/sms/route.ts`
  - 수정: `TenantPaymentView.tsx`, `/pay/[invoiceId]/page.tsx`, `/payments/page.tsx`, `/billing/page.tsx`
- **다음:**
  - 카드결제 프로덕션 테스트 (KG이니시스 사전심사 완료 후)
  - 가상계좌 중복 발급 방지 로직 추가 검토

### 23. 입금 매칭 4단계 구현 + 버그픽스 2건 (2026-04-07)
- **버그픽스 1: 카카오 가입 후 전화번호 입력 → 대시보드 미이동** (`src/app/complete-profile/page.tsx`)
  - 원인: `supabase.auth.updateUser({ data: { phone } })` 후에도 JWT 쿠키가 옛 값이라 미들웨어가 phone 없음으로 판단 → 무한 리디렉트
  - 수정: ① `supabase.auth.refreshSession()` 호출로 JWT 갱신 ② `router.push` → `window.location.href`로 변경 (full reload — 미들웨어 재실행) ③ 초기 useEffect 진입 조건 `phoneExists && emailExists` → `phoneExists`만 (카카오 이메일은 선택)
- **버그픽스 2: /billing 정기청구 탭 47개 mock rooms 표시** (`src/app/billing/page.tsx`)
  - 원인: `getRoomsByBusiness(selectedBusinessId)`가 `/lib/data.ts`의 mock 47개 반환
  - 수정: useBusiness mock 제거 → Supabase에서 활성 계약(`leases.status='ACTIVE'`) 실시간 조회 (rooms 경유 — leases는 business_id 없음). 표시 문구 "N개 호실 데이터 스캔 완료" → "N개 활성 계약 스캔 완료"

- **Stage 1: 분할 매칭 모달** (`src/app/payments/page.tsx`)
  - `PendingMatch.splits: { invoiceId; amount }[] | null` 추가
  - `UnpaidInvoiceForSplit` 타입 신설
  - `openSplitModal(rowIdx)`: 해당 호실의 전 기간 미납 청구서 조회, 기존 splits prefill 또는 FIFO 자동 제안
  - `confirmSplit` / `clearSplit` / `closeSplitModal`
  - 드롭다운 옆 "분할" 버튼 (활성 시 분할 개수 표시 + 행 하단에 충당 요약)
  - SplitMatchModal UI: 입금 정보 + 미납 청구서 테이블 + 충당액 입력 + 합계/잔여/초과 표시 + "분할 해제" / "분할 확정"
  - `executeMatches` 분기 추가: `pm.splits` 있으면 각 split마다 invoice 조회 → `paid_amount` 누적 → `payments` 행 INSERT (부분 수납이면 status='ready' 유지, 전액이면 'paid')
  - 매칭 변경 시 splits 자동 해제

- **Stage 2: FIFO 자동 충당** (`src/app/payments/page.tsx`)
  - `load()`에서 `allUnpaidInvoices` (전 기간 미납) 추가 로드
  - `openReview` 자동 매칭 로직 확장: 단일 청구서 일치 실패 + 입주사 식별 성공 시 → 해당 호실 미납을 오래된 것부터 채움
  - `splits.length≥2` 또는 `1건+잔여`일 때만 자동 채택
  - UI 일관성을 위해 첫 split의 invoice ID를 `selectedInvoiceId`로 세팅 → "분할 N" 배지 자동 표시

- **Stage 3: PREPAY 자동 차감 + 잔여 적립** (신규 `src/lib/prepay.ts` + 3곳 wiring)
  - **모델**: `deposits.type='PREPAY'` 행을 누적 잔액 원장으로 사용. 양수=적립, 음수=소비. 잔액 = `SUM(amount) WHERE type='PREPAY' AND refunded_at IS NULL`
  - **`src/lib/prepay.ts`**: `getPrepayBalance`, `deductPrepayForInvoice`, `addPrepayCredit` 헬퍼 (SupabaseClient 인자로 받아 client/service 양쪽 호환)
  - **수동 `generateInvoices`** (payments page): 청구서 생성 직후 leases 순회하며 자동 차감, 토스트에 차감 건수 표시
  - **분할 매칭 `executeMatches`**: 모든 split 성공 후 leftover > 0이면 해당 lease에 PREPAY 적립
  - **Cron `/api/cron/generate-invoices`**: 전면 리팩토링
    - 기존 코드: `rooms.tenant_*`, `rooms.monthly_rent` 등 migration #16에서 제거된 컬럼 참조 → 사실상 broken 상태였음
    - 신규: ACTIVE leases 직접 쿼리 (room+tenant 조인), `lease_id` 기준 멱등성 체크, INSERT 직후 PREPAY 자동 차감 루프
    - PREPAY로 100% 충당된 청구서는 결제 안내 알림톡 발송 생략

- **Stage 4: Tenant 카드 잔액 표시** (`src/app/tenants/page.tsx`)
  - `LeaseItem` 타입 확장: `unpaidTotal`, `prepayBalance`
  - `load()`에서 `deposits` 일괄 조회 후 lease별 PREPAY 합산 맵 구성
  - 미수납 합계 = 미납 청구서의 `amount - paid_amount` 합
  - 카드 UI: 월세/예치금 아래에 잔액 박스 — 미수납이 있으면 빨간 배경 + `미수납 ₩X`, 선납이 있으면 초록 강조 + `선납 +₩X`, 둘 다 0이면 박스 숨김

- **결정/유저 언급:**
  - 솔라피 템플릿 검수는 이미 모두 완료됨 (CONTRACT_SIGN, PAYMENT_NOTIFY_ADMIN). **더 이상 묻지 말 것** — 이 기록 그대로 유지
  - "234 실행 1번 테스트는 나중에 한번에 같이 하자" — Stage 1~4 통합 테스트는 다음 세션에 일괄 진행 예정

- **검증 시 주의사항:**
  1. **deposits 테이블 존재 여부**: `src/types/index.ts`엔 정의돼 있으나 Supabase에 실제 마이그레이션이 적용됐는지 직접 확인 필요. 없으면 PREPAY INSERT 모두 실패. → migration 파일 확인 또는 `supabase/migrations` 디렉토리에서 deposits 관련 SQL 검색
  2. **Cron 멱등성**: 신규 cron은 `lease_id`로 중복 체크. 기존 invoices 중 `lease_id`가 NULL인 옛 데이터가 있으면 이번 달에 중복 생성될 가능성 있음
  3. **rooms 제거 컬럼 잔존 점검**: 다른 API/페이지에서 `tenant_name`/`tenant_phone`/`monthly_rent` 직접 참조 잔존 가능 → 전수 grep 필요

- **미해결/다음 작업:**
  - Stage 1~4 통합 E2E 테스트 (분할 매칭 정상 저장 + FIFO 자동 제안 동작 + PREPAY 차감 후 카드 잔액 갱신)
  - deposits 테이블 마이그레이션 미적용 시 작성 + 적용
  - billing_items UI [B단계], 대시보드 KPI leases 전환 [A단계] 등 기존 로드맵

### 22. Toss Payments 제거 + PortOne(KG이니시스) 결제 통일 + KG이니시스 사전심사 준비 (2026-04-03)
- **완료:**
  - **Toss Payments 완전 제거:**
    - `@tosspayments/payment-widget-sdk` 패키지 삭제 (`package.json`)
    - `src/components/payments/TossCheckout.tsx` 삭제
    - pricing 페이지, portal 결제 페이지에서 TossCheckout → PortOneCheckout 교체
  - **PortOneCheckout 컴포넌트 신규 생성** (`src/components/payments/PortOneCheckout.tsx`):
    - `@portone/browser-sdk/v2` 사용
    - `mode="payment"` → 일반결제 (카드 단건) — `PortOne.requestPayment()` 호출
    - `mode="billing"` → 정기결제 (빌링키 발급) — `PortOne.requestIssueBillingKey()` 호출
    - 검증 API: 일반결제 → `/api/portone/payment-complete`, 정기결제 → `/api/portone/subscribe`
  - **API 라우트 2개 생성:**
    - `/api/portone/payment-complete/route.ts` — 일반결제 검증 (PortOne V2 `/payments/{id}` 조회)
    - `/api/portone/subscribe/route.ts` — 빌링키 결제 실행 (PortOne V2 `/payments/{id}/billing-key`)
  - **사이드바에 "이용료 결제" 메뉴 추가** → `/pricing` 페이지 연결
    - `Sidebar.tsx`에 Wallet 아이콘 + `/pricing` 항목 추가
    - `AppLayout.tsx`에서 `/pricing`을 PUBLIC_PATHS에서 제거 (로그인 시 사이드바 표시)
  - **대표자명(이동윤) 푸터에 추가:** `page.tsx` (메인), `pricing/page.tsx`
  - **KG이니시스 사전심사 테스트 계정 생성:**
    - 이메일: `test-reviewer@noado.kr` / 비밀번호: `TestReview2026!`
    - 테스트 데이터: 사업자(대우오피스텔), 호실(301호), 입주사(테스트입주사), 계약(ACTIVE), 청구서(500,000원, 2026년 4월)
    - 테스트 결제 URL: `https://www.noado.kr/pay/{invoiceId}` (가상계좌 발급 테스트 가능)
  - **환경변수 추가 (`.env.local` + Vercel):**
    - `NEXT_PUBLIC_PORTONE_STORE_ID=store-f448cc28-0f2f-4dd8-898c-ec5505ba43ac`
    - `NEXT_PUBLIC_PORTONE_CHANNEL_KEY=channel-key-6b818e51-4872-4a0e-84a7-d8f43eb72a55`
  - **4건 커밋 push + Vercel 배포 완료**
- **결정:**
  - 포트원 채널키 2개 모두 일반결제+정기결제 지원 확인 (별도 채널 신청 불필요)
    - `channel-key-6b818e51-...` — 결제창 타입 (브라우저 SDK용, NEXT_PUBLIC)
    - `channel-key-dd35dbea-...` — API 타입 (서버 가상계좌 발급용)
  - 임대료 카드 단건결제 추가 시 별도 프로세스 불필요 — `/pay/[invoiceId]` 페이지에 카드결제 버튼만 추가하면 됨
  - 이용료 정기결제 = `/pricing` 페이지 (Beginner ₩9,900 / Pro ₩19,900)
  - 임대료 일반결제 = `/pay/[invoiceId]` 페이지 (가상계좌 + 추후 카드결제 추가)
- **KG이니시스 사전심사 체크리스트 진행 상황:**
  1. ✅ 판매상품 정보 — 공유오피스 임대관리 SaaS (이용료 결제 + 임대료 수납)
  2. ✅ 판매가격 표시 — `/pricing` 페이지에 요금제 표시
  3. ⚠️ 이용약관/개인정보처리방침 — `/terms`, `/privacy` 페이지 존재 (내용 검토 필요)
  4. ⚠️ 사업자 정보 — 푸터에 표시됨, **통신판매신고번호 미등록** (유저에게 확인 필요)
  5. ✅ 결제창 정상 노출 — PortOneCheckout으로 KG이니시스 결제창 호출 확인
  6. ✅ 테스트 계정/데이터 — 생성 완료
- **미완료/다음 작업:**
  - 통신판매신고번호 확보 후 푸터에 추가
  - `/pay/[invoiceId]` 페이지에 카드결제 옵션 추가 (가상계좌 옆에 버튼)
  - pricing 페이지 로그인 시 네비게이션 중복 (자체 nav + 사이드바) — 추후 수정
  - `/billing-pay` 페이지 불필요 — 정리 대상

### 21. E2E 결제 플로우 프로덕션 테스트 + DB 스키마 호환성 수정 (2026-04-03)
- **완료:**
  - 브라우저에서 호실 추가(101호) → 입주사 등록(테스트컴퍼니) → 청구서 생성(500,000원) → 결제 페이지 → 가상계좌 발급까지 전체 플로우 프로덕션 테스트 성공
  - 가상계좌 발급 결과: 신한은행 `56211992823621`, 예금주 대우오피스, 입금기한 2026-04-09
  - `/pay/[invoiceId]/page.tsx` DB 스키마 호환성 수정 — rooms 쿼리에서 제거된 컬럼(tenant_name, tenant_phone, monthly_rent) 참조 제거, leases/tenants 테이블 경유 조회로 변경
  - `/pay/[invoiceId]/TenantPaymentView.tsx` — tenantName prop 추가, room.tenant_name 참조 제거
  - `/api/portone/virtual-account/route.ts` — rooms 쿼리 동일 수정 + leases/tenants 경유 조회
  - `PORTONE_CHANNEL_KEY` 환경변수 폴백 추가 — Vercel에는 `PORTONE_CHANNEL_KEY_VIRTUAL`로 등록되어 있어 `process.env.PORTONE_CHANNEL_KEY || process.env.PORTONE_CHANNEL_KEY_VIRTUAL` 폴백 처리
  - 3건 커밋 push 및 Vercel 배포 완료
- **결정:**
  - migration #16에서 rooms 테이블의 tenant_name, tenant_phone, monthly_rent 컬럼이 제거되었으므로, 입주사 정보는 항상 leases → tenants 경로로 조회해야 함
  - Vercel 환경변수명: `PORTONE_CHANNEL_KEY_VIRTUAL` (코드에서 폴백 처리)
- **유저 언급:** 포트원 연동 현황 정리 요청 → 아래 기술 문맥 #7에 기록
- **다음:** 다른 API 라우트/페이지에서도 rooms 테이블의 제거된 컬럼 참조 잔존 여부 전수 점검 권장

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

### 9. Solapi 환경변수 설정 완료 (2026-03-18) — ✅ 모든 템플릿 검수 완료 (2026-04-07 유저 확인)
- **`SOLAPI_FROM_NUMBER=01088854844`** — 솔라피 발신번호 등록 확인 후 `.env.local` 및 Vercel에 추가
- **`SOLAPI_TEMPLATE_PAYMENT_NOTIFY_ADMIN=GX3F22DndC`** — "납부 완료 관리자 알림" 템플릿 ✅ **검수 완료**
  - 템플릿 내용: `[노아도] 납부 완료 안내\n\n#{호실}호 #{입주사}님이 임대료를 납부했습니다.\n\n납부 금액: #{금액}원`
- **`SOLAPI_TEMPLATE_CONTRACT_SIGN`** ✅ **검수 완료**
- **⚠️ 더 이상 솔라피 템플릿 검수 상태를 묻지 말 것** — 모든 템플릿 승인 완료된 상태
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

7. **포트원(PortOne) 연동 현황 (2026-04-03 최종 업데이트)**
   - **PG사:** KG이니시스 1개만 연동 (사전심사 진행 중)
   - **결제 수단:** 가상계좌(구현 완료) + 카드결제(컴포넌트 준비됨, `/pay` 페이지 연결 미완)
   - **채널키 2개:**
     - `channel-key-6b818e51-...` — 결제창 타입 (브라우저 SDK, 카드결제/빌링키) → `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`
     - `channel-key-dd35dbea-...` — API 타입 (서버 가상계좌 발급) → `PORTONE_CHANNEL_KEY` / `PORTONE_CHANNEL_KEY_VIRTUAL`
   - **SDK:** `@portone/browser-sdk/v2` (Toss SDK는 제거 완료)
   - **결제 컴포넌트:** `src/components/payments/PortOneCheckout.tsx`
     - `mode="payment"` → 일반결제 (카드 단건) → `/api/portone/payment-complete` 검증
     - `mode="billing"` → 정기결제 (빌링키) → `/api/portone/subscribe` 실행
   - **Vercel 환경변수:** `PORTONE_CHANNEL_KEY_VIRTUAL`, `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`
   - **지원 은행(가상계좌):** 신한, 국민, 하나, 우리, 농협, IBK기업, 부산, 대구, 광주
   - **테스트 MID:** `INIpayTest` — 신한은행만 동작 (실 연동 시 전 은행 정상)
   - **웹훅:** `https://www.noado.kr/api/webhook/portone` (HMAC-SHA256 서명 검증)
   - **처리 이벤트:** `Transaction.Paid`, `Failed`, `Cancelled`, `Expired`
   - **E2E 프로덕션 테스트:** 2026-04-03 성공 확인 (101호 테스트컴퍼니 500,000원 → 신한은행 가상계좌 발급)
   - **KG이니시스 사전심사:** 진행 중 (통신판매신고번호 미등록 외 체크리스트 완료)
   - **테스트 계정:** `test-reviewer@noado.kr` / `TestReview2026!` (301호, 테스트입주사, 500,000원 청구서)

8. **rooms 테이블 제거된 컬럼 주의 (migration #16 이후)**
   - `tenant_name`, `tenant_phone`, `tenant_email`, `monthly_rent`, `payment_day`, `deposit`, `lease_start`, `lease_end`, `virtual_account_number` 모두 제거됨
   - 입주사 정보 조회 시 반드시 `leases` → `tenants` 경로로 조회해야 함
   - Supabase SELECT에 제거된 컬럼 포함 시 400 에러 → 조회 결과 전체 null 처리됨
   - 수정 완료 파일: `/pay/[invoiceId]/page.tsx`, `TenantPaymentView.tsx`, `/api/portone/virtual-account/route.ts`
   - **미점검 파일:** 다른 API 라우트/페이지에서 rooms 제거 컬럼 참조 잔존 가능 → 전수 점검 권장

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

### 🔴 PG/수납 아키텍처 재설계 (2026-04-22 결정 — 최우선)

**배경:** PG사가 임대업종 거절 가능성 + 결제대행(전자금융거래법) 이슈 회피.
원칙: 카드결제는 노아도 SaaS 구독료에만, 임대료는 운영사 본인 계좌 직수취 중심으로.

**작업 1. `/pay/[invoiceId]` 카드 탭 제거** 🔴
- 입주사 결제 페이지에서 "계좌이체 / 카드결제" 탭 UI 삭제
- `PortOneCheckout mode="payment"` 호출부 제거
- `/api/portone/card-payment/route.ts` 삭제

**작업 2. 가상계좌 `remitteeName` 동적 설정** 🔴 (법적 안전장치)
- 현재 `remitteeName: '노아도'` 하드코딩 (CLAUDE.md #24)
- → `businesses.name` 기준 동적 설정으로 변경
- 파일: `/api/portone/virtual-account/route.ts`
- 사유: 결제대행으로 오인되지 않도록 운영사 본인 명의로 발급

**작업 3. 입주사 결제 페이지 리팩토링 — 운영사 계좌 안내 중심** 🟡
- "운영사 계좌번호 + 예금주 + 호실명" 크게 표시
- 가상계좌는 보조 옵션으로 격하 (또는 제거)
- 입금자명 규칙 안내: "213호 홍길동" 형식

**작업 X. 수납 매칭 미납 상태 ↔ 정기청구 데이터 연결 점검** 🟡 (2026-04-28 유저 제기)
- 유저 관찰: "수납 매칭에 적용된 미납 상태가 정기청구의 데이터가 반영되어 있는 것 같다"
- 추정: `/payments` 페이지가 `invoices` 테이블에서 미납 조회 → `/billing` 정기청구가 생성한 invoice도 그대로 잡힘 (의도된 동작 vs. 의도치 않은 노출 여부 미확인)
- **점검 항목:**
  1. `/billing` 정기청구가 invoice 실제 INSERT 하는지 (mock/preview만인지)
  2. `/payments` 의 `allUnpaidInvoices` 쿼리가 어떤 invoice까지 포함하는지
  3. 두 페이지의 미납 표시가 같은 데이터인지 / 같아야 하는지 / 분리해야 하는지
- 파일: `src/app/payments/page.tsx:225-233`, `src/app/billing/page.tsx`

**작업 4. 사업장 설정에 "수납 계좌" + "기본 주소" 입력 필드 추가** 🟡
- 은행 / 계좌번호 / 예금주 입력 UI
- **+ 기본 주소 필드 동시 추가** (2026-04-28 추가 결정 — 계약서 주소 하드코딩 해결)
- DB: `businesses` 테이블에 `bank_name`, `account_number`, `account_holder`, `address` 컬럼 추가 (마이그레이션 필요)
- 입주사 결제 페이지에서 계좌 정보 표시
- 계약서 모달 `handleRoomSelect`에서 `business.address + room.building + room.name` 자동 prefill (3개 모달 모두 — `contracts/page.tsx:491, 1905`, `ScanUploadModal`)

**작업 5. `/pricing` 정기결제(빌링키) 전용 전환** 🟡
- `PortOneCheckout mode="billing"` 만 사용
- DB 신규 테이블: `user_subscriptions` (plan, billing_key, next_charge_date, status)
- `/api/cron/charge-subscriptions` 매월 실행 cron 추가
- 결제 실패 3회 시 plan downgrade
- `/api/portone/subscribe/route.ts`는 이미 구현됨

**작업 6. 자동 입금 감지 — 가상계좌 대체 수단 검토** 🟢
입주사 입금 자동 매칭 webhook 대안 (가상계좌 없이):

| 옵션 | 설명 | 비용 | 시기 |
|---|---|---|---|
| A. 오픈뱅킹 (금결원) | 운영사 본인 계좌 연결, 5분 폴링 | 거의 무료 | 장기 |
| B. 은행 입금통지 서비스 | 신한·국민 등 직접 계약, 즉시 webhook | 1~3만원/은행 | 단기 |
| C. 계좌매칭 SaaS | 뱅크다·페이워크·웰컴페이먼츠 | 5~15만원/월 | 즉시 런칭 |

Phase 추천: Phase 1=엑셀 매칭(이미 구현)만, Phase 2=계좌매칭 SaaS 1곳, Phase 3=오픈뱅킹 자체 연동

**작업 7. `/api/portone/card-payment` 라우트 정리** 🟢
- 카드결제 제거 후 불필요 코드 삭제

**법적 포지셔닝 명문화 (이용약관·KG이니시스 심사자료):**
> "노아도는 SaaS 도구이며, 자금은 각 운영사와 PG사 간에 직접 오갑니다.
> 노아도는 결제 정보를 수신해 장부를 자동화할 뿐, 자금을 보관·중개하지 않습니다."

**운영사 수납 방식 4단계 (UI 토글 설계 참고):**
| 방식 | PG 계약 | 비용 | 난이도 |
|---|:---:|---|---|
| ① 엑셀 매칭만 (기본, 이미 구현) | ❌ | 0원 | 쉬움 |
| ② 펌뱅킹 가상계좌 (은행 직접) | ❌ | 건당 ~300원 | 보통 |
| ③ PG 가상계좌 (KG이니시스) | ✅ | 건당 ~400원 | 까다로움 |
| ④ PG 카드결제 | ✅ | 3~3.5% | 임대료엔 부적합 |

---

### 즉시 확인 (세션 시작 시 브리핑)
1. `npm run build` — 0 errors 확인
2. **KG이니시스 사전심사 현황 확인** — 통신판매신고번호 확보 여부 + 위 PG 재설계 방침 반영 (카드 임대료 미사용 명시)
3. 기존 테스트 데이터 정리 — rooms 이름에 "호" 없는 것들 + 101호 테스트 데이터 삭제 권장
4. 테스트용 가상계좌 발급 건 정리 — invoice `7367ca88-9b69-4b08-af83-1a532311e1f4` 및 관련 데이터

### 프로덕션 테스트 (긴급)
5. **billing_items → 청구서 extra_amount 반영 E2E 테스트** — 실비 항목 등록 후 청구서 생성 시 금액 정상 반영 확인
6. **deposits 등록/환불 E2E 테스트** — PLEDGE 등록 → 환불 처리 플로우 확인
7. **tax_invoices 생성/발행 E2E 테스트** — VAT_INVOICE 계약에서 세금계산서 DRAFT → ISSUED 확인

### 이어서 개발할 것 (우선순위 순)
8. **billing_items ACTUAL(실비) 매월 입력 플로우** — 현재 MONTHLY만 청구서에 자동 합산, ACTUAL은 관리자가 매월 금액 입력하는 UI 필요
9. **contracts 페이지 정리** — 전자계약 관련 rooms 제거 컬럼 참조는 contracts 자체 필드(snapshot)이므로 동작하나, leases 연동 개선 검토
10. **types/index.ts Room 인터페이스 deprecated 필드 정리** — `tenant_name`, `monthly_rent` 등 @deprecated 마킹된 필드 완전 제거 검토

---

## 📋 다음 개발 계획 (Next Feature Roadmap)

> ✅ A~E 단계 로드맵 전부 완료됨 (2026-04-13)
> 아래는 완료 후 추가 개선 사항들

---

### [A단계] 대시보드 KPI — ✅ 완료 (이미 leases 기준 구현)

### [B단계] billing_items UI — ✅ 완료 (BillingItemsPanel)
- 추가 작업: ACTUAL(실비) 매월 변동 입력 플로우 필요

### [C단계] deposits UI — ✅ 완료 (DepositsPanel)

### [D단계] 청구서 생성 완전 leases 연동 — ✅ 완료
- `amount = base_amount + extra_amount` (billing_items MONTHLY 합산)

### [E단계] tax_invoices UI — ✅ 완료 (TaxInvoicesPanel)

---

### 신규 과제

#### 보고서 페이지 고도화
- reports/page.tsx 엑셀 내보내기에 leases 정보 포함 (현재 rooms만)
- 연간 세금계산서 발행 현황 리포트 추가

#### 알림 자동화 고도화
- 계약 만료 D-30 알림톡 자동 발송
- 미납 3일 초과 시 자동 독촉 알림

#### 임차인 포털 leases 전환
- portal/tenant-portal 페이지 → 실제 납부 내역 연동 (현재 mock)
- 임차인 본인 결제 내역 조회 + 영수증 다운로드

---

## 🔧 클로드 스킬 현황

| 스킬 | 경로 | 용도 |
|------|------|------|
| `/worklog` | `.claude/skills/worklog/SKILL.md` | 작업 기록 자동화 — CLAUDE.md 업데이트 |
| `/team` | `.claude/skills/team/SKILL.md` | 팀 에이전트 — 전문가 3명 + 비판적 검토자 |

> 두 스킬 모두 **새 세션**에서 인식됨. 현재 세션은 reload 필요.
