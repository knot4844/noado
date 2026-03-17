-- invoices 테이블에 contract_id 컬럼 추가
-- 납부 요청 시 계약서와 청구서를 연결하기 위함
-- 납부 완료 시에만 계약서 다운로드 가능

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS contract_id UUID
    REFERENCES contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_contract_id ON invoices (contract_id);
