-- ── 전자계약 양식 파일 업로드 지원 ─────────────────────────
-- 임대인이 자체 계약서 양식(PDF/이미지)을 업로드하면
-- 임차인 서명 페이지와 미리보기에서 그대로 노출

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS template_url  TEXT,
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS template_mime TEXT;

-- ── Storage 버킷 생성 ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-templates',
  'contract-templates',
  TRUE, -- 임차인이 sign_token 페이지에서 직접 보기 때문에 public read
  52428800, -- 50 MB (PDF→PNG 변환 후 다중 페이지 대응)
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public           = EXCLUDED.public,
      file_size_limit  = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage RLS 정책 ──────────────────────────────────────
-- 업로드: 로그인한 본인만 (경로 = {owner_id}/...)
DROP POLICY IF EXISTS "contract-templates: owner upload" ON storage.objects;
CREATE POLICY "contract-templates: owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contract-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 삭제: 본인만
DROP POLICY IF EXISTS "contract-templates: owner delete" ON storage.objects;
CREATE POLICY "contract-templates: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contract-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 조회: public (sign_token 페이지에서 anon 접근)
DROP POLICY IF EXISTS "contract-templates: public read" ON storage.objects;
CREATE POLICY "contract-templates: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contract-templates');
