import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

// Clean helpers to detect default/empty values
const isValidUrl = supabaseUrl && supabaseUrl !== 'YOUR_SUPABASE_URL' && supabaseUrl.trim() !== '';
const isValidKey = supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY' && supabaseAnonKey.trim() !== '';

export const isDemoMode = !isValidUrl || !isValidKey;

export const supabase = !isDemoMode 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (isDemoMode) {
  console.log('--- SYSTEM STATUS: running in DEMO MODE (local storage fallback) ---');
} else {
  console.log('--- SYSTEM STATUS: Connected to Supabase ---');
}
