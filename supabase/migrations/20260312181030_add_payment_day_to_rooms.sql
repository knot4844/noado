-- 업(Up) 마이그레이션: rooms 테이블에 payment_day 컬럼 추가 (기본값 10)
ALTER TABLE "public"."rooms" 
ADD COLUMN IF NOT EXISTS "payment_day" smallint DEFAULT 10;

COMMENT ON COLUMN "public"."rooms"."payment_day" IS '매월 정기 월세 납부일 (예: 5일, 10일, 25일)';
