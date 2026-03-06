-- ============================================================
-- Noado — 통합 DB 스키마 마이그레이션
-- Supabase SQL Editor에서 순서대로 실행하세요.
-- ============================================================

-- ── 유틸 함수 ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. BUSINESSES (사업장)
-- ============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  owner_name TEXT,
  owner_phone TEXT,
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "biz_select" ON businesses;
DROP POLICY IF EXISTS "biz_insert" ON businesses;
DROP POLICY IF EXISTS "biz_update" ON businesses;
DROP POLICY IF EXISTS "biz_delete" ON businesses;

CREATE POLICY "biz_select" ON businesses FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "biz_insert" ON businesses FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "biz_update" ON businesses FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "biz_delete" ON businesses FOR DELETE USING (owner_id = auth.uid());

-- ============================================================
-- 2. ROOMS (호실)
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,                          -- 예: "201호"
  status                  TEXT NOT NULL DEFAULT 'VACANT'
                            CHECK (status IN ('PAID','UNPAID','VACANT')),
  tenant_name             TEXT,
  tenant_contact          TEXT,
  tenant_company_name     TEXT,
  tenant_business_reg_num TEXT,
  monthly_rent            INTEGER DEFAULT 0,
  deposit                 INTEGER DEFAULT 0,
  due_date                TEXT DEFAULT '매월 25일',
  is_vat_included         BOOLEAN DEFAULT FALSE,
  auto_notify             BOOLEAN DEFAULT TRUE,
  lease_start             DATE,
  lease_end               DATE,
  unpaid_months           INTEGER DEFAULT 0,
  unpaid_amount           INTEGER DEFAULT 0,
  virtual_account         TEXT,                                   -- KG이니시스 고정 가상계좌
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_insert" ON rooms;
DROP POLICY IF EXISTS "rooms_update" ON rooms;
DROP POLICY IF EXISTS "rooms_delete" ON rooms;

CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "rooms_delete" ON rooms FOR DELETE USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

DROP TRIGGER IF EXISTS rooms_updated_at ON rooms;
CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. INVOICES (청구서) — 매월 자동 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tenant_name TEXT,
  amount      INTEGER NOT NULL,
  due_date    DATE NOT NULL,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ready'
                CHECK (status IN ('ready','paid','overdue')),
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  -- 멱등성: 같은 호실·연·월 청구서 중복 방지
  UNIQUE (room_id, year, month)
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_select" ON invoices;
DROP POLICY IF EXISTS "inv_insert" ON invoices;
DROP POLICY IF EXISTS "inv_update" ON invoices;

CREATE POLICY "inv_select" ON invoices FOR SELECT USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "inv_insert" ON invoices FOR INSERT WITH CHECK (true); -- service role
CREATE POLICY "inv_update" ON invoices FOR UPDATE USING (true);       -- service role

-- ============================================================
-- 4. PAYMENTS (결제 로그) — PortOne V2 웹훅 수신 시 저장
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID REFERENCES invoices(id),
  room_id             UUID REFERENCES rooms(id),
  business_id         UUID REFERENCES businesses(id),
  portone_payment_id  TEXT UNIQUE,                                -- 멱등성 키
  tenant_name         TEXT,
  amount              INTEGER NOT NULL,
  paid_at             DATE NOT NULL,
  month               TEXT NOT NULL,                             -- "YYYY-MM"
  status              TEXT NOT NULL DEFAULT 'PAID'
                        CHECK (status IN ('PAID','UNPAID','PARTIAL')),
  note                TEXT,
  raw_webhook         JSONB,                                     -- 웹훅 원본 보관
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pay_select" ON payments;
DROP POLICY IF EXISTS "pay_insert" ON payments;
DROP POLICY IF EXISTS "pay_update" ON payments;

CREATE POLICY "pay_select" ON payments FOR SELECT USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "pay_insert" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY "pay_update" ON payments FOR UPDATE USING (true);

-- ============================================================
-- 5. CONTRACTS (전자계약)
-- ============================================================
CREATE TABLE IF NOT EXISTS contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tenant_name           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','sent','signed','expired')),
  -- 전자서명 법적 증적
  signature             TEXT,                                    -- base64 PNG
  signed_at             TIMESTAMPTZ,
  signer_ip             TEXT,
  content_hash          TEXT,                                    -- SHA-256 해시
  -- 계약 내용 스냅샷
  contract_snapshot     JSONB,
  -- 서명 링크 토큰 (1회성 · 7일 만료)
  sign_token            TEXT UNIQUE,
  sign_token_expires_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contract_select" ON contracts;
DROP POLICY IF EXISTS "contract_insert" ON contracts;
DROP POLICY IF EXISTS "contract_update" ON contracts;

CREATE POLICY "contract_select" ON contracts FOR SELECT USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "contract_insert" ON contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "contract_update" ON contracts FOR UPDATE USING (true);

-- ============================================================
-- 6. NOTIFICATION_LOGS (알림톡 발송 내역)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           UUID REFERENCES rooms(id),
  business_id       UUID NOT NULL REFERENCES businesses(id),
  tenant_name       TEXT,
  template_type     TEXT NOT NULL
                      CHECK (template_type IN (
                        'daily_briefing','unpaid_reminder',
                        'payment_done','monthly_invoice'
                      )),
  sent_at           TIMESTAMPTZ DEFAULT NOW(),
  status            TEXT NOT NULL DEFAULT 'success'
                      CHECK (status IN ('success','failed')),
  solapi_message_id TEXT
);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select" ON notification_logs;
DROP POLICY IF EXISTS "notif_insert" ON notification_logs;

CREATE POLICY "notif_select" ON notification_logs FOR SELECT USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "notif_insert" ON notification_logs FOR INSERT WITH CHECK (true);

-- ============================================================
-- 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rooms_business    ON rooms(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_room     ON invoices(room_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_yearmonth ON invoices(year, month);
CREATE INDEX IF NOT EXISTS idx_payments_portone  ON payments(portone_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_contracts_token   ON contracts(sign_token);
CREATE INDEX IF NOT EXISTS idx_notif_business    ON notification_logs(business_id);
