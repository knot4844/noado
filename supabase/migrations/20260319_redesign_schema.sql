-- ============================================================
-- Noado DB 재설계 마이그레이션
-- 2026-03-19
-- 임대사업자 → 공유오피스 전환 + leases 테이블 중심 구조
-- ============================================================

-- ────────────────────────────────────────
-- 1. rooms 테이블 정리
--    - 제거: tenant_name, tenant_phone, tenant_email,
--            monthly_rent, payment_day, deposit,
--            lease_start, lease_end, virtual_account_number
--    - 추가: building, area
-- ────────────────────────────────────────
ALTER TABLE rooms
  DROP COLUMN IF EXISTS tenant_name,
  DROP COLUMN IF EXISTS tenant_phone,
  DROP COLUMN IF EXISTS tenant_email,
  DROP COLUMN IF EXISTS monthly_rent,
  DROP COLUMN IF EXISTS payment_day,
  DROP COLUMN IF EXISTS deposit,
  DROP COLUMN IF EXISTS lease_start,
  DROP COLUMN IF EXISTS lease_end,
  DROP COLUMN IF EXISTS virtual_account_number;

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS building text,
  ADD COLUMN IF NOT EXISTS area     numeric(6,2);

-- ────────────────────────────────────────
-- 2. tenants 테이블 정리
--    - 제거: room_id, monthly_rent, deposit, lease_start, lease_end
--    - 추가: business_no, representative, birth_date,
--            biz_type, biz_item, id_card_file
-- ────────────────────────────────────────
ALTER TABLE tenants
  DROP COLUMN IF EXISTS room_id,
  DROP COLUMN IF EXISTS monthly_rent,
  DROP COLUMN IF EXISTS deposit,
  DROP COLUMN IF EXISTS lease_start,
  DROP COLUMN IF EXISTS lease_end;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS business_no    text,
  ADD COLUMN IF NOT EXISTS representative text,
  ADD COLUMN IF NOT EXISTS birth_date     date,
  ADD COLUMN IF NOT EXISTS biz_type       text,
  ADD COLUMN IF NOT EXISTS biz_item       text,
  ADD COLUMN IF NOT EXISTS id_card_file   text;  -- 암호화된 파일 경로 or base64

-- ────────────────────────────────────────
-- 3. leases 테이블 신설 (핵심 연결 테이블)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES auth.users NOT NULL,
  room_id         uuid REFERENCES rooms(id)   ON DELETE CASCADE NOT NULL,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,

  -- 계약 유형
  contract_type   text NOT NULL DEFAULT 'OCCUPANCY'
                  CHECK (contract_type IN ('OCCUPANCY','BIZ_ONLY','STORAGE')),

  -- 요금 체계
  rate_type       text NOT NULL DEFAULT 'MONTHLY'
                  CHECK (rate_type IN ('MONTHLY','DAILY')),
  monthly_rent    integer NOT NULL DEFAULT 0,  -- 사용료 + 관리비 포함
  daily_rate      integer,                      -- 추후 일정액 사용 시

  -- 예치금 (보증금 X)
  pledge_amount   integer NOT NULL DEFAULT 0,

  -- 계약 기간
  lease_start     date NOT NULL,
  lease_end       date,                         -- null = 진행 중

  -- 납부 설정
  payment_day     integer DEFAULT 15
                  CHECK (payment_day BETWEEN 1 AND 31),

  -- 세금 유형
  vat_type        text NOT NULL DEFAULT 'NONE'
                  CHECK (vat_type IN ('VAT_INVOICE','CASH_RECEIPT','NONE')),

  -- 계약 상태
  status          text NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('RESERVED','ACTIVE','TERMINATED')),

  memo            text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- leases RLS
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leases_owner" ON leases;
CREATE POLICY "leases_owner" ON leases
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ────────────────────────────────────────
-- 4. billing_items 테이블 신설 (추가 실비)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES auth.users NOT NULL,
  lease_id        uuid REFERENCES leases(id) ON DELETE CASCADE NOT NULL,

  item_type       text NOT NULL DEFAULT 'CUSTOM'
                  CHECK (item_type IN ('PARKING','INTERNET','ELECTRICITY','CUSTOM')),
  name            text NOT NULL,               -- 항목명 (직접 입력)
  billing_cycle   text NOT NULL DEFAULT 'MONTHLY'
                  CHECK (billing_cycle IN ('MONTHLY','ACTUAL')),
  amount          integer DEFAULT 0,           -- 고정금액 (MONTHLY일 때)
  unit_price      integer,                     -- 단가 (ACTUAL 실비일 때)
  is_active       boolean NOT NULL DEFAULT true,
  memo            text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_items_owner" ON billing_items;
CREATE POLICY "billing_items_owner" ON billing_items
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ────────────────────────────────────────
-- 5. deposits 테이블 신설 (예치금·선납·예약금)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deposits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES auth.users NOT NULL,
  lease_id        uuid REFERENCES leases(id) ON DELETE CASCADE NOT NULL,

  type            text NOT NULL DEFAULT 'PLEDGE'
                  CHECK (type IN ('PLEDGE','PREPAY','RESERVE')),
  -- PLEDGE  = 예치금 (입주 시 수령)
  -- PREPAY  = 선납 (월세 선불)
  -- RESERVE = 예약금 (계약 전 보관)

  amount          integer NOT NULL,
  received_at     date,
  refunded_at     date,                        -- 환불일
  note            text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deposits_owner" ON deposits;
CREATE POLICY "deposits_owner" ON deposits
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ────────────────────────────────────────
-- 6. tax_invoices 테이블 신설 (세금계산서)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES auth.users NOT NULL,
  lease_id        uuid REFERENCES leases(id) ON DELETE SET NULL,
  invoice_id      uuid REFERENCES invoices(id) ON DELETE SET NULL,

  issue_date      date,
  supply_amount   integer NOT NULL DEFAULT 0,  -- 공급가액
  vat_amount      integer NOT NULL DEFAULT 0,  -- 세액
  total_amount    integer NOT NULL DEFAULT 0,  -- 합계금액

  status          text NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT','ISSUED','CANCELLED')),
  ntax_id         text,                        -- 국세청 승인번호

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax_invoices_owner" ON tax_invoices;
CREATE POLICY "tax_invoices_owner" ON tax_invoices
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ────────────────────────────────────────
-- 7. invoices 테이블 수정
--    - 추가: lease_id, base_amount, extra_amount
-- ────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS lease_id     uuid REFERENCES leases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS base_amount  integer NOT NULL DEFAULT 0,  -- 기본 임대료
  ADD COLUMN IF NOT EXISTS extra_amount integer NOT NULL DEFAULT 0;  -- 추가 실비 합계

-- amount = base_amount + extra_amount (총 청구액)
-- 기존 amount 컬럼은 유지 (총 청구액 캐시)

-- ────────────────────────────────────────
-- 8. payments 테이블 수정
--    - 추가: lease_id
-- ────────────────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS lease_id uuid REFERENCES leases(id) ON DELETE SET NULL;

-- ────────────────────────────────────────
-- 9. 인덱스
-- ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leases_owner     ON leases(owner_id);
CREATE INDEX IF NOT EXISTS idx_leases_room      ON leases(room_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant    ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_status    ON leases(status);
CREATE INDEX IF NOT EXISTS idx_billing_lease    ON billing_items(lease_id);
CREATE INDEX IF NOT EXISTS idx_deposits_lease   ON deposits(lease_id);
CREATE INDEX IF NOT EXISTS idx_tax_lease        ON tax_invoices(lease_id);
CREATE INDEX IF NOT EXISTS idx_invoices_lease   ON invoices(lease_id);
CREATE INDEX IF NOT EXISTS idx_payments_lease   ON payments(lease_id);

-- ────────────────────────────────────────
-- 10. updated_at 자동 갱신 트리거
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leases_updated_at ON leases;
CREATE TRIGGER leases_updated_at
  BEFORE UPDATE ON leases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tax_invoices_updated_at ON tax_invoices;
CREATE TRIGGER tax_invoices_updated_at
  BEFORE UPDATE ON tax_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

