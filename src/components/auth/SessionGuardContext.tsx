import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

interface SessionGuardContextType {
    currentSession: any | null;
    isSessionActive: boolean;
    checkSession: () => Promise<void>;
    canLogout: () => boolean;
    requireMandatorySession: boolean;
}

const SessionGuardContext = createContext<SessionGuardContextType | undefined>(undefined);

export function SessionGuardProvider({ children }: { children: ReactNode }) {
    const { user, permissions } = useAuth();
    const [currentSession, setCurrentSession] = useState<any | null>(null);
    const [requireMandatorySession, setRequireMandatorySession] = useState(true);

    const checkSession = async () => {
        if (!user) {
            setCurrentSession(null);
            return;
        }

        try {
            // 1. Check if mandatory session is required for the ROLE (New feature)
            const hasRolePermission = permissions.includes('mandatory_session');

            // 2. Check if mandatory session is required globally from settings
            const { data: settings } = await supabase
                .from('store_settings')
                .select('require_mandatory_session')
                .eq('id', 1)
                .maybeSingle();

            const globalRequired = settings?.require_mandatory_session ?? true;

            // Enforce if EITHER global is on OR role has specific permission
            setRequireMandatorySession(globalRequired || hasRolePermission);

            // Check for active session
            const { data } = await supabase
                .from('cashier_sessions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'Open')
                .maybeSingle();

            setCurrentSession(data);
        } catch (error) {
            console.error('Error checking session:', error);
            setCurrentSession(null);
        }
    };

    const canLogout = () => {
        // If mandatory session is not required, always allow logout
        if (!requireMandatorySession) return true;

        // If mandatory session is required, only allow logout if no active session
        return !currentSession;
    };

    const isSessionActive = !!currentSession;

    useEffect(() => {
        checkSession();

        // Subscribe to session changes
        const channelSession = supabase
            .channel('session_guard_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cashier_sessions' },
                () => {
                    checkSession();
                }
            )
            .subscribe();

        // Subscribe to settings changes
        const channelSettings = supabase
            .channel('store_settings_changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'store_settings' },
                () => {
                    checkSession();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channelSession);
            supabase.removeChannel(channelSettings);
        };
    }, [user]);

    return (
        <SessionGuardContext.Provider
            value={{
                currentSession,
                isSessionActive,
                checkSession,
                canLogout,
                requireMandatorySession,
            }}
        >
            {children}
        </SessionGuardContext.Provider>
    );
}

export function useSessionGuard() {
    const context = useContext(SessionGuardContext);
    if (context === undefined) {
        throw new Error('useSessionGuard must be used within a SessionGuardProvider');
    }
    return context;
}
