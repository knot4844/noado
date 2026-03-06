/**
 * Supabase 서비스 롤 클라이언트
 * API Route 서버 코드에서만 사용 — RLS 우회, 관리자 권한
 * ⚠️ 절대 클라이언트 컴포넌트에서 사용 금지
 */
import { createClient as _createClient } from '@supabase/supabase-js'

function make() {
  return _createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/** Named exports for both import styles */
export const createClient        = make
export const createServiceClient = make
