-- 임대인 전자서명 필드 추가
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS owner_signed_at TIMESTAMPTZ;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS owner_signature_url TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS owner_signer_ip TEXT;
