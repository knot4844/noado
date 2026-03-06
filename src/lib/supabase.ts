import { createBrowserClient } from '@supabase/ssr'

// We will use fallback environment variables to prevent crashes if the user
// hasn't set them up yet, allowing the app to still build but show warnings.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (supabaseUrl === 'https://placeholder-project.supabase.co') {
    console.warn('⚠️ Supabase URL is not set. Please set NEXT_PUBLIC_SUPABASE_URL in your .env.local file. Falling back to placeholder.')
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
