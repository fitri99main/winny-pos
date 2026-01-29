import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// SSR-safe storage or fallback
const isWeb = Platform.OS === 'web';
const isServer = typeof window === 'undefined';

// Safe storage fallback
const storage = (!isServer && AsyncStorage) ? AsyncStorage : {
    getItem: (key: string) => Promise.resolve(null),
    setItem: (key: string, value: string) => Promise.resolve(),
    removeItem: (key: string) => Promise.resolve(),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: storage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: isWeb && !isServer,
    },
});

if (!isServer) {
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}
