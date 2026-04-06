import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SessionContextType {
    currentSession: any | null;
    authSession: any | null;
    isSessionActive: boolean;
    loading: boolean;
    checkSession: (showLoading?: boolean, force?: boolean) => Promise<void>;
    requireMandatorySession: boolean;
    storeSettings: any;
    permissions: string[];
    isDisplayOnly: boolean;
    isAdmin: boolean;
    branchName: string;
    branchAddress: string;
    branchPhone: string;
    userName: string;
    currentBranchId: string;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [authSession, setAuthSession] = useState<any | null>(null);
    const [currentSession, setCurrentSession] = useState<any | null>(null);
    const [requireMandatorySession, setRequireMandatorySession] = useState(true);
    const [storeSettings, setStoreSettings] = useState<any>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [isDisplayOnly, setIsDisplayOnly] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [branchName, setBranchName] = useState('');
    const [branchAddress, setBranchAddress] = useState('');
    const [branchPhone, setBranchPhone] = useState('');
    const [userName, setUserName] = useState('');
    const [currentBranchId, setCurrentBranchId] = useState('');
    const [loading, setLoading] = useState(true);

    const isCheckingRef = React.useRef(false);
    const lastCheckTimeRef = React.useRef(0);

    const checkSession = async (showLoading = true, force = false) => {
        const now = Date.now();
        // Throttle rapid calls unless it's a forced full update
        if (isCheckingRef.current || (now - lastCheckTimeRef.current < 2000 && !showLoading && !force)) {
            console.log('[SessionContext] checkSession: Throttled or already checking');
            return;
        }
        
        // Failsafe timeout to prevent infinite loading screen
        const failsafe = setTimeout(() => {
            if (loading) {
                console.warn('[SessionContext] checkSession: FAILSAFE TIMEOUT - Forcing loading off');
                setLoading(false);
            }
        }, 8000); // 8 seconds failsafe for global session
        
        try {
            isCheckingRef.current = true;
            lastCheckTimeRef.current = now;
            console.log('[SessionContext] Starting checkSession (showLoading:', showLoading, ')');
            
            // Only show full-screen loader if we don't have a session or if explicitly requested
            if (showLoading || !currentSession) {
                setLoading(true);
            }
            
            // 1. Silent Session Check
            const { data: { session } } = await supabase.auth.getSession();
            setAuthSession(session);
            if (!session) {
                console.log('[SessionContext] No active session found.');
                setCurrentSession(null);
                setLoading(false);
                return;
            }

            // 2. Verified User Fetch
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                if (userError) console.warn('[SessionContext] getUser issue:', userError.message);
                setCurrentSession(null);
                setLoading(false);
                return;
            }

            console.log('[SessionContext] User verified:', user.email);

            // 3. Parallelize ALL remaining fetches
            const [settingsRes, profileRes, sessionRes] = await Promise.all([
                supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
                supabase.from('profiles').select('role, full_name, name, branch_id').eq('id', user.id).maybeSingle(),
                supabase.from('cashier_sessions').select('*').eq('user_id', user.id).eq('status', 'Open').order('opened_at', { ascending: false }).limit(1).maybeSingle()
            ]);

            // Handle errors
            if (settingsRes.error) console.warn('[SessionContext] settings error:', settingsRes.error.message);
            if (profileRes.error) console.warn('[SessionContext] profile error:', profileRes.error.message);
            if (sessionRes.error) console.warn('[SessionContext] session error:', sessionRes.error.message);

            // Process Profile & Branch
            const profileData = profileRes.data;
            const name = profileData?.full_name || profileData?.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
            setUserName(name);
            
            if (profileData?.branch_id) {
                const bId = String(profileData.branch_id);
                if (bId !== currentBranchId) setCurrentBranchId(bId);
            }

            // Process Settings
            if (settingsRes.data) {
                console.log('[SessionContext] Global Store Settings Loaded:', {
                    enable_wifi_vouchers: settingsRes.data.enable_wifi_vouchers,
                    multiplier: settingsRes.data.wifi_voucher_multiplier,
                    min_amount: settingsRes.data.wifi_voucher_min_amount
                });
                setStoreSettings(settingsRes.data);
            }

            // 3. Role Permissions (Conditional but fast)
            let roleName = profileData?.role || user.user_metadata?.role;
            let currentPerms: string[] = [];
            let hasRolePermission = false;

            if (roleName) {
                const { data: roleData } = await supabase
                    .from('roles')
                    .select('permissions')
                    .ilike('name', roleName.trim())
                    .maybeSingle();
                
                if (roleData?.permissions && Array.isArray(roleData.permissions)) {
                    currentPerms = roleData.permissions;
                    hasRolePermission = currentPerms.includes('mandatory_session');
                }
            }

            setPermissions(currentPerms);

            // Calculate Permissions Flags
            const roleStr = (roleName || '').toLowerCase().trim();
            const isDisplayRole = roleStr === 'display' || roleStr.includes('display');
            const isDisplayOnlyVal = isDisplayRole || currentPerms.includes('pos_order_only') || currentPerms.includes('order_only');
            const isAdminVal = roleStr === 'admin' || roleStr === 'administrator' || roleStr === 'superadmin' || roleStr === 'owner';
            const globalRequired = settingsRes.data?.require_mandatory_session ?? true;
            
            // Admins NEVER require mandatory session
            setRequireMandatorySession(isAdminVal ? false : (isDisplayOnlyVal ? false : (globalRequired || hasRolePermission)));
            setIsDisplayOnly(isDisplayOnlyVal);
            setIsAdmin(isAdminVal);

            // 4. Update Session
            setCurrentSession(sessionRes.data);
            
        } catch (error: any) {
            console.error('[SessionContext] checkSession failed:', error?.message || error);
        } finally {
            clearTimeout(failsafe);
            setLoading(false);
            isCheckingRef.current = false;
            console.log('[SessionContext] checkSession complete.');
        }
    };

    const fetchBranchDetails = async () => {
        if (!currentBranchId || isNaN(Number(currentBranchId))) return; // Prevent SQL error 22P02 for string IDs like 'b1'
        try {
            const { data, error } = await supabase
                .from('branches')
                .select('name, address, phone')
                .eq('id', currentBranchId)
                .single();

            if (error) throw error;
            if (data) {
                setBranchName(data.name || '');
                setBranchAddress(data.address || '');
                setBranchPhone(data.phone || '');
            }
        } catch (error) {
            console.error('[SessionContext] Error fetching branch details:', error);
        }
    };

    useEffect(() => {
        checkSession();
    }, []);

    useEffect(() => {
        if (currentBranchId) {
            fetchBranchDetails();
        }
    }, [currentBranchId]);

    useEffect(() => {
        // 1. Auth state change listener - Only once on mount
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[SessionContext] Auth event:', event, 'User:', session?.user?.email);
            checkSession(false); // Don't block screen for background auth changes
        });

        // 2. Realtime session changes - Only once on mount
        const channel = supabase
            .channel('cashier_sessions_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cashier_sessions' },
                () => checkSession(false)
            )
            .subscribe();

        return () => {
            authSubscription.unsubscribe();
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        // 3. Realtime branch changes - Depends on currentBranchId
        if (!currentBranchId) return;

        const branchChannel = supabase
            .channel('branch_name_changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'branches', filter: `id=eq.${currentBranchId}` },
                (payload) => {
                    console.log('[SessionContext] Branch updated:', payload.new.name);
                    if (payload.new.name) setBranchName(payload.new.name);
                    if (payload.new.address) setBranchAddress(payload.new.address);
                    if (payload.new.phone) setBranchPhone(payload.new.phone);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(branchChannel);
        };
    }, [currentBranchId]);

    useEffect(() => {
        // 4. Realtime store_settings changes
        const settingsChannel = supabase
            .channel('store_settings_changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'store_settings', filter: 'id=eq.1' },
                (payload) => {
                    console.log('[SessionContext] Store settings updated:', payload.new);
                    setStoreSettings(payload.new);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(settingsChannel);
        };
    }, []);

    const contextValue = React.useMemo(() => ({
        currentSession,
        authSession,
        isSessionActive: !!currentSession,
        loading,
        checkSession,
        requireMandatorySession,
        storeSettings,
        permissions,
        isDisplayOnly,
        isAdmin,
        branchName,
        branchAddress,
        branchPhone,
        userName,
        currentBranchId
    }), [
        currentSession,
        loading,
        requireMandatorySession,
        storeSettings,
        permissions,
        isDisplayOnly,
        isAdmin,
        branchName,
        branchAddress,
        branchPhone,
        userName,
        currentBranchId
    ]);

    return (
        <SessionContext.Provider value={contextValue}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
