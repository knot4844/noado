'use client'

/**
 * Supabase 브라우저 클라이언트
 * 클라이언트 컴포넌트('use client')에서 사용
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
