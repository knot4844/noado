-- ── 자동생성 양식 커스텀 업로드 테이블 ─────────────────────────
-- 각 임대인(사용자)이 "자동생성" 탭의 3개 양식(basic-lease, shared-office, short-term)에
-- 자기 사업장용 커스텀 이미지/PDF를 업로드하면 Canvas 자동생성 대신 해당 파일 사용
-- owner_id + template_key 복합 유니크 → 사용자별로 각 양식 슬롿에 1개씩만 허용

CREATE TABLE IF NOT EXISTS contract_builtin_uploads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key  TEXT NOT NULL,              -- 'basic-lease' | 'shared-office' | 'short-term'
  template_url  TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_mime TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, template_key)
);

ALTER TABLE contract_builtin_uploads ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 조회
CREATE POLICY "contract_builtin_uploads: 본인 조회"
  ON contract_builtin_uploads FOR SELECT
  USING (auth.uid() = owner_id);

-- 등록/수정/삭제는 본인만
CREATE POLICY "contract_builtin_uploads: 본인 INSERT"
  ON contract_builtin_uploads FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "contract_builtin_uploads: 본인 UPDATE"
  ON contract_builtin_uploads FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "contract_builtin_uploads: 본인 DELETE"
  ON contract_builtin_uploads FOR DELETE
  USING (auth.uid() = owner_id);

-- storage RLS: builtin-uploads/ 폴더 업로드 허용
DROP POLICY IF EXISTS "contract-templates: builtin upload" ON storage.objects;
CREATE POLICY "contract-templates: builtin upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contract-templates'
    AND (storage.foldername(name))[1] = 'builtin-uploads'
  );
