import { createClient } from '@supabase/supabase-js'

// Inicialización defensiva de Supabase para evitar caídas en arranque si faltan las variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
