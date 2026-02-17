import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { getDeviceFingerprint, getDeviceInfo } from '../../lib/deviceFingerprint';
import { toast } from 'sonner';

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
            // Use ilike for case-insensitive matching to be safer
            const { data: roleData, error: roleError } = await supabase
                .from('roles')
                .select('permissions')
                .ilike('name', (profile.role || '').trim())
                .maybeSingle(); // Use maybeSingle to avoid error if not found immediately

            if (roleData && roleData.permissions) {
                // Ensure it's an array
                const perms = Array.isArray(roleData.permissions)
                    ? roleData.permissions
                    : [];
                console.log(`[Auth] Role: ${profile.role}, Perms Loaded: ${perms.length}`);
                setPermissions(perms);
            } else {
                console.warn(`[Auth] Role '${profile.role}' has no permissions or not found in roles table.`);
                setPermissions([]);
            }
        } catch (err) {
            console.error('Auth Enrichment Error:', err);
        }
    };

    // 1. INITIALIZATION EFFECT (Fast, Non-Blocking)
    useEffect(() => {
        let mounted = true;

        const initSession = async () => {
            try {
                // Check session locally
                const { data: { session } } = await supabase.auth.getSession();

                if (mounted) {
                    if (session?.user) {
                        setSession(session);
                        setUser(session.user);
                        // Do NOT await profile fetch here - let it happen in the watcher
                    }
                }
            } catch (err) {
                console.error('Session init error:', err);
            } finally {
                if (mounted) {
                    setLoading(false); // ALWAYS release the UI immediately
                }
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        initSession();

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // 2. PROFILE FETCH EFFECT (Reactive, Background)
    useEffect(() => {
        if (user) {
            // Fetch profile data silently when user is available
            fetchProfileAndPermissions(user.id);
        } else {
            setRole(null);
            setPermissions([]);
        }
    }, [user]);

    // 3. DEVICE SESSION MANAGEMENT
    useEffect(() => {
        if (!user) return;

        let mounted = true;
        let heartbeatInterval: NodeJS.Timeout;

        const registerDeviceSession = async () => {
            try {
                // Check if single device enforcement is enabled
                const { data: settings } = await supabase
                    .from('store_settings')
                    .select('enforce_single_device')
                    .eq('id', 1)
                    .single();

                if (!settings?.enforce_single_device) {
                    console.log('[DeviceSession] Single device enforcement disabled');
                    return;
                }

                const deviceFingerprint = getDeviceFingerprint();
                const deviceInfo = getDeviceInfo();

                // Check for existing sessions from other devices
                const { data: existingSessions } = await supabase
                    .from('user_sessions')
                    .select('*')
                    .eq('user_id', user.id);

                if (existingSessions && existingSessions.length > 0) {
                    // Check if any session is from a different device
                    const otherDeviceSessions = existingSessions.filter(
                        s => s.device_fingerprint !== deviceFingerprint
                    );

                    if (otherDeviceSessions.length > 0) {
                        console.log('[DeviceSession] Found sessions from other devices, logging them out');

                        // Delete other device sessions
                        await supabase
                            .from('user_sessions')
                            .delete()
                            .eq('user_id', user.id)
                            .neq('device_fingerprint', deviceFingerprint);

                        toast.info('Perangkat lain telah logout otomatis', {
                            description: 'Anda sekarang login di perangkat ini.',
                            duration: 4000
                        });
                    }
                }

                // Register or update current device session
                const { error: upsertError } = await supabase
                    .from('user_sessions')
                    .upsert({
                        user_id: user.id,
                        device_fingerprint: deviceFingerprint,
                        device_info: deviceInfo,
                        last_active_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id,device_fingerprint'
                    });

                if (upsertError) {
                    console.error('[DeviceSession] Failed to register session:', upsertError);
                    return;
                }

                console.log('[DeviceSession] Session registered successfully');

                // Start heartbeat to keep session alive
                heartbeatInterval = setInterval(async () => {
                    if (!mounted) return;

                    try {
                        // Update last_active_at
                        const { error: updateError } = await supabase
                            .from('user_sessions')
                            .update({ last_active_at: new Date().toISOString() })
                            .eq('user_id', user.id)
                            .eq('device_fingerprint', deviceFingerprint);

                        if (updateError) {
                            console.error('[DeviceSession] Heartbeat failed:', updateError);
                        }

                        // Check if this session still exists (might be deleted by another device)
                        const { data: currentSession } = await supabase
                            .from('user_sessions')
                            .select('*')
                            .eq('user_id', user.id)
                            .eq('device_fingerprint', deviceFingerprint)
                            .maybeSingle();

                        if (!currentSession) {
                            console.log('[DeviceSession] Session invalidated by another device, logging out');
                            toast.error('Anda telah login di perangkat lain', {
                                description: 'Sesi ini akan diakhiri.',
                                duration: 3000
                            });

                            // Force logout
                            setTimeout(() => {
                                supabase.auth.signOut();
                            }, 2000);
                        }
                    } catch (err) {
                        console.error('[DeviceSession] Heartbeat error:', err);
                    }
                }, 5 * 60 * 1000); // Every 5 minutes

            } catch (error) {
                console.error('[DeviceSession] Registration error:', error);
            }
        };

        registerDeviceSession();

        return () => {
            mounted = false;
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }

            // Cleanup session on unmount (logout)
            if (user) {
                const deviceFingerprint = getDeviceFingerprint();
                (async () => {
                    try {
                        await supabase
                            .from('user_sessions')
                            .delete()
                            .eq('user_id', user.id)
                            .eq('device_fingerprint', deviceFingerprint);
                        console.log('[DeviceSession] Session cleaned up');
                    } catch (err) {
                        console.error('[DeviceSession] Cleanup error:', err);
                    }
                })();
            }
        };
    }, [user]);

    // SAFETY FALBACK: Force loading to false after 3 seconds max
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <AuthContext.Provider value={{ user, session, loading, permissions, role }}>
            {!loading ? children : (
                <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium">Memuat data pengguna...</p>

                    {/* Escape Hatch if loading takes too long */}
                    <button
                        onClick={() => {
                            // Nuclear option: Clear everything and reload
                            localStorage.clear();
                            setLoading(false);
                            setUser(null);
                            setSession(null);
                            window.location.reload();
                        }}
                        className="text-xs text-red-500 hover:underline mt-4 cursor-pointer"
                    >
                        Klik di sini jika loading terlalu lama (Reset Total)
                    </button>
                </div>
            )}
        </AuthContext.Provider>
    );
}
