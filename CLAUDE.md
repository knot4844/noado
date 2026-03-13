# Noado 프로젝트 진행 상황 (Project Status & Handoff)

> **Last Updated:** 2026-03-13 (PortOne V2 Webhook 검증 완료)
> **목적:** 다른 AI(Claude 등)로 작업을 이관하거나 다음 작업 세션(Antigravity 등)을 재개할 때 즉시 문맥을 파악하기 위한 진행 상황 기록 문서입니다.

---

## ✅ 완료된 작업 (Completed)

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

## 🚀 진행 중이거나 앞으로 해야 할 작업 (Pending / Next Steps)

다음 번 작업 세션 시작 시 아래의 작업부터 이어서 진행하면 됩니다.

### 2. 프론트엔드 연동 및 통합 테스트 (Integration)
- 프론트엔드의 결제창(`TossCheckout.tsx` 등)과 PortOne 가상계좌 발급 프로세스가 사용자 UI/UX 단에서 부드럽게 이어지는지 점검하고, QA(샌드박스 망) 통합 테스트 진행.

### 3. 카카오 로그인 연동 재설정 (새 앱 설정 적용)
- **배경:** 최근 `Nabido`에서 `Noado`로 앱 이름을 변경하면서 카카오 디벨로퍼스 앱을 새로 생성함에 따라 기존 REST API 키 연결이 끊어짐.
- **수행 필요 작업:**
  1. **카카오 디벨로퍼스 (noado 앱)**
     * [앱 키]에서 `REST API 키` 복사
     * [보안] 탭에서 `Client Secret` 활성화 및 코드 복사
     * [카카오 로그인] 탭에서 상태 'ON' 확인 및 `Redirect URI`에 `https://zswazaviqcaikefpkxee.supabase.co/auth/v1/callback` 등록
     * [비즈니스] 탭에서 '카카오톡 채널' 연결 상태 점검
  2. **Supabase 대시보드 연동**
     * [Authentication] > [Providers] > **Kakao** 항목 열기
     * 복사한 `REST API 키`를 **Client ID**에, `Client Secret`을 붙여넣기 후 Save.

---

## 🧠 중요한 기술 문맥 (Context Notes)
1. **멱등성(Idempotency)**: `payments` 테이블의 `portone_payment_id` 필드에 걸려있는 UNIQUE 제약조건을 활용하여 콜백/웹훅 동시 발생 시 중복 결제처리를 원천 차단하고 있습니다.
2. **청구서 매칭 전략**: 웹훅으로 날아온 `paymentId`를 `invoices` 테이블의 `portone_payment_id` 컬럼과 대조하여 해당 호실과 소유자를 매칭합니다.
3. **가상계좌 위주 활용**: 프론트엔드 포트원 SDK 호출보다는, 현재는 백엔드(`portone/virtual-account`) 단에서 포트원 V2 REST API를 호출해 가상계좌를 직접 따오는 방식을 주력으로 채택 중입니다.
