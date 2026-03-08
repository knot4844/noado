-- rooms 테이블에 가상계좌번호 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS virtual_account_number TEXT DEFAULT NULL;

COMMENT ON COLUMN rooms.virtual_account_number IS 'KG이니시스 가상계좌번호 (임차인별 고정)';
