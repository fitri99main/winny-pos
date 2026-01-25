import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    permissions: string[];
    role: string | null;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    permissions: [],
    role: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [role, setRole] = useState<string | null>(null);

    // Helper to fetch extended profile data
    const fetchProfileAndPermissions = async (uid: string) => {
        try {
            // 1. Get Profile (to get role name)
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', uid)
                .single();

            if (profileError || !profile) {
                console.warn('Profile fetch failed:', profileError);
                return;
            }

            setRole(profile.role);

            // 2. Get Permissions (from roles table)
            const { data: roleData, error: roleError } = await supabase
                .from('roles')
                .select('permissions')
                .eq('name', profile.role)
                .single();

            if (roleData && roleData.permissions) {
                // Ensure it's an array
                const perms = Array.isArray(roleData.permissions)
                    ? roleData.permissions
                    : [];
                setPermissions(perms);
            } else {
                setPermissions([]);
            }
        } catch (err) {
            console.error('Auth Enrichment Error:', err);
        }
    };

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfileAndPermissions(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                fetchProfileAndPermissions(session.user.id);
            } else {
                setPermissions([]);
                setRole(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Effect to unset loading once profile fetch is done (or if it takes too long)
    useEffect(() => {
        // Simple safety timeout to prevent infinite loading if profile fetch hangs
        const timer = setTimeout(() => {
            if (loading) setLoading(false);
        }, 2000); // 2s max wait for profile

        // If we have user and role (or no user), loading is done
        if (!user || role) {
            setLoading(false);
        }

        return () => clearTimeout(timer);
    }, [user, role]);

    return (
        <AuthContext.Provider value={{ user, session, loading, permissions, role }}>
            {!loading ? children : (
                <div className="h-screen w-full flex items-center justify-center bg-gray-50">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </AuthContext.Provider>
    );
}
