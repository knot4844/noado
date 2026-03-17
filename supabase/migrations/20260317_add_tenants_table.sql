-- ============================================================
-- [1단계] 입주사(tenants) 테이블 신설
-- rooms 테이블의 tenant 컬럼들은 backward-compat용으로 유지
-- Supabase SQL Editor 또는 supabase db push 로 실행
-- ============================================================


-- ── 1. tenants 테이블 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id      UUID NOT NULL REFERENCES rooms(id)      ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  monthly_rent INTEGER NOT NULL DEFAULT 0,
  deposit      INTEGER NOT NULL DEFAULT 0,
  lease_start  DATE,
  lease_end    DATE,    -- NULL = 현재 입주 중
  memo         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants: 본인만 접근" ON tenants
  USING  (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_tenants_room_id   ON tenants (room_id);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id  ON tenants (owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_lease_end ON tenants (lease_end);


-- ── 2. invoices 테이블에 tenant_id 컬럼 추가 ──────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices (tenant_id);


-- ── 3. 기존 rooms 데이터 → tenants 마이그레이션 ────────────
-- 조건: tenant_name이 있고 VACANT가 아닌 호실만 대상
INSERT INTO tenants (
  owner_id,
  room_id,
  name,
  phone,
  email,
  monthly_rent,
  deposit,
  lease_start,
  lease_end,
  created_at
)
SELECT
  owner_id,
  id           AS room_id,
  tenant_name  AS name,
  tenant_phone AS phone,
  tenant_email AS email,
  monthly_rent,
  deposit,
  lease_start,
  lease_end,
  created_at
FROM rooms
WHERE tenant_name IS NOT NULL
  AND tenant_name <> ''
  AND status      <> 'VACANT'
ON CONFLICT DO NOTHING;


-- ── 4. 완료 확인 ──────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM tenants)  AS tenants_count,
  (SELECT COUNT(*) FROM rooms WHERE tenant_name IS NOT NULL AND status <> 'VACANT') AS rooms_with_tenant;
