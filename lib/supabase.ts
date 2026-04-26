import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Client for browser (public)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client for server (admin operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)
