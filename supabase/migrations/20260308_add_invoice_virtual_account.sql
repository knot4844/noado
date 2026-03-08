-- invoices 테이블에 PortOne V2 가상계좌 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS portone_payment_id  TEXT,
  ADD COLUMN IF NOT EXISTS virtual_account_number TEXT,
  ADD COLUMN IF NOT EXISTS virtual_account_bank   TEXT,
  ADD COLUMN IF NOT EXISTS virtual_account_due    TIMESTAMPTZ;

COMMENT ON COLUMN invoices.portone_payment_id      IS 'PortOne V2 paymentId (가상계좌 발급 시 = invoice UUID)';
COMMENT ON COLUMN invoices.virtual_account_number  IS '발급된 가상계좌 번호';
COMMENT ON COLUMN invoices.virtual_account_bank    IS '가상계좌 은행코드 (예: SHINHAN)';
COMMENT ON COLUMN invoices.virtual_account_due     IS '가상계좌 입금기한';

-- PostgREST 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
