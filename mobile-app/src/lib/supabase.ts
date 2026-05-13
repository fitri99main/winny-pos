import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SupabaseJS from '@supabase/supabase-js';
var createClient = SupabaseJS.createClient;

var supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
var supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

var finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
var finalKey = supabaseAnonKey || 'placeholder';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] CRITICAL: URL or Anon Key is missing!');
}

export var supabase = createClient(finalUrl, finalKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
