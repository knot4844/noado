-- ── 계약서 샘플 양식 테이블 ─────────────────────────────────
-- 마스터 계정이 업로드한 양식을 저장하고,
-- 다른 사용자가 계약서 작성 시 "샘플 양식" 탭에서 선택 가능

CREATE TABLE IF NOT EXISTS contract_sample_templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  template_url  TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_mime TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contract_sample_templates ENABLE ROW LEVEL SECURITY;

-- 모든 로그인 사용자가 조회 가능 (계약서 작성 시 샘플 목록 표시)
CREATE POLICY "contract_sample_templates: 전체 조회"
  ON contract_sample_templates FOR SELECT
  USING (true);

-- 등록/삭제는 본인만
CREATE POLICY "contract_sample_templates: 본인 INSERT"
  ON contract_sample_templates FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "contract_sample_templates: 본인 DELETE"
  ON contract_sample_templates FOR DELETE
  USING (auth.uid() = owner_id);

-- storage RLS: samples/ 폴더 업로드 허용
DROP POLICY IF EXISTS "contract-templates: samples upload" ON storage.objects;
CREATE POLICY "contract-templates: samples upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contract-templates'
    AND (storage.foldername(name))[1] = 'samples'
  );
