-- ============================================================
-- noado 전체 스키마
-- Supabase SQL Editor에 전체 복붙 후 실행
-- ============================================================

-- ── 0. UUID 확장 ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ── 1. businesses (사업장) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT NOT NULL DEFAULT '',
  owner_name  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "businesses: 본인만 접근" ON businesses
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);


-- ── 2. rooms (호실) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'VACANT'
                           CHECK (status IN ('PAID', 'UNPAID', 'VACANT')),
  tenant_name            TEXT,
  tenant_phone           TEXT,
  tenant_email           TEXT,
  monthly_rent           INTEGER NOT NULL DEFAULT 0,
  deposit                INTEGER NOT NULL DEFAULT 0,
  lease_start            DATE,
  lease_end              DATE,
  memo                   TEXT,
  virtual_account_number TEXT,   -- KG이니시스 가상계좌번호
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms: 본인만 접근" ON rooms
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 3. invoices (청구서) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount      INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'ready'
                CHECK (status IN ('ready', 'paid', 'overdue')),
  due_date    DATE,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 멱등성: 같은 호실·연·월 청구서 중복 방지
  UNIQUE (room_id, year, month)
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices: 본인만 접근" ON invoices
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_invoices_owner_year_month
  ON invoices (owner_id, year, month);


-- ── 4. payments (결제 로그) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id          UUID REFERENCES invoices(id) ON DELETE SET NULL,
  room_id             UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  portone_payment_id  TEXT UNIQUE,   -- PortOne V2 멱등성 키
  amount              INTEGER NOT NULL DEFAULT 0,
  paid_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments: 본인만 접근" ON payments
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);


-- ── 5. contracts (전자계약) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id               UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  tenant_name           TEXT,
  tenant_phone          TEXT,
  tenant_email          TEXT,
  address               TEXT,
  monthly_rent          INTEGER NOT NULL DEFAULT 0,
  deposit               INTEGER NOT NULL DEFAULT 0,
  lease_start           DATE,
  lease_end             DATE,
  special_terms         TEXT,
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'sent', 'signed', 'expired')),
  sign_token            TEXT,
  sign_token_expires_at TIMESTAMPTZ,
  content_hash          TEXT,
  signer_ip             TEXT,
  signed_at             TIMESTAMPTZ,
  signature_data_url    TEXT,        -- base64 서명 이미지
  contract_snapshot     JSONB,       -- 계약 내용 스냅샷
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts: 본인만 접근" ON contracts
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 임차인 서명용: sign_token으로 공개 조회 허용
CREATE POLICY "contracts: sign_token 공개 조회" ON contracts
  FOR SELECT USING (sign_token IS NOT NULL);


-- ── 6. notification_logs (알림톡 발송 내역) ─────────────────
CREATE TABLE IF NOT EXISTS notification_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  room_id         UUID REFERENCES rooms(id) ON DELETE SET NULL,
  template_key    TEXT NOT NULL,
  recipient_name  TEXT,
  recipient_phone TEXT,
  status          TEXT NOT NULL DEFAULT 'success'
                    CHECK (status IN ('success', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_logs: 본인만 접근" ON notification_logs
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);


-- ── 7. 완료 확인 ────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'businesses', 'rooms', 'invoices',
    'payments', 'contracts', 'notification_logs'
  )
ORDER BY table_name;
