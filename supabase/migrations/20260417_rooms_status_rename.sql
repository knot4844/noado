-- ─────────────────────────────────────────────────────────────
-- rooms.status 의미 전환
--   기존: PAID / UNPAID / VACANT  (납부 상태를 rooms 에 저장)
--   신규: OCCUPIED / VACATED / VACANT (공간 점유 상태만 저장)
-- 납부 상태는 invoices/payments 에서 산출해야 함 (단일 진실 원천).
-- ─────────────────────────────────────────────────────────────

-- CHECK constraint 제거 (status 값 제한)
ALTER TABLE rooms
  DROP CONSTRAINT IF EXISTS rooms_status_check;

-- 기존 값 매핑
UPDATE rooms SET status = 'OCCUPIED' WHERE status IN ('PAID', 'UNPAID');
-- VACANT 은 그대로 둠

-- 신규 CHECK constraint
ALTER TABLE rooms
  ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('OCCUPIED', 'VACATED', 'VACANT'));
