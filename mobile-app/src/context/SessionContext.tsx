import React from 'react';
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import AsyncStorage from '@react-native-async-storage/async-storage';
var createContext = React.createContext;
var useContext = React.useContext;
var useState = React.useState;
var useEffect = React.useEffect;

var ACTIVE_BRANCH_STORAGE_KEY = 'mobile_current_branch_id';
var PREFERRED_BRANCH_NAME = 'winny coffee pnk';

export var SessionProvider = function(props) {
    var children = props.children;
    var stateAuthSession = useState(null);
    var authSession = stateAuthSession[0];
    var setAuthSession = stateAuthSession[1];

    var stateCurrentSession = useState(null);
    var currentSession = stateCurrentSession[0];
    var setCurrentSession = stateCurrentSession[1];

    var stateRequireMandatorySession = useState(true);
    var requireMandatorySession = stateRequireMandatorySession[0];
    var setRequireMandatorySession = stateRequireMandatorySession[1];

    var stateStoreSettings = useState(null);
    var storeSettings = stateStoreSettings[0];
    var setStoreSettings = stateStoreSettings[1];

    var statePermissions = useState([]);
    var permissions = statePermissions[0];
    var setPermissions = statePermissions[1];

    var stateIsDisplayOnly = useState(false);
    var isDisplayOnly = stateIsDisplayOnly[0];
    var setIsDisplayOnly = stateIsDisplayOnly[1];

    var stateIsAdmin = useState(false);
    var isAdmin = stateIsAdmin[0];
    var setIsAdmin = stateIsAdmin[1];

    var stateBranchName = useState('');
    var branchName = stateBranchName[0];
    var setBranchName = stateBranchName[1];

    var stateBranchAddress = useState('');
    var branchAddress = stateBranchAddress[0];
    var setBranchAddress = stateBranchAddress[1];

    var stateBranchPhone = useState('');
    var branchPhone = stateBranchPhone[0];
    var setBranchPhone = stateBranchPhone[1];

    var stateUserName = useState('');
    var userName = stateUserName[0];
    var setUserName = stateUserName[1];

    var stateCurrentBranchId = useState('');
    var currentBranchId = stateCurrentBranchId[0];
    var setCurrentBranchId = stateCurrentBranchId[1];

    var stateLoading = useState(true);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var isCheckingRef = React.useRef(false);
    var lastCheckTimeRef = React.useRef(0);

    var resolveOperationalBranchId = function(preferredBranchId) {
        if (preferredBranchId === undefined) preferredBranchId = '';
        return supabase
            .from('branches')
            .select('id, name')
            .order('id')
            .then(function(res) {
                var branches = res.data;
                var error = res.error;

                if (error || !branches || branches.length === 0) {
                    return preferredBranchId || '';
                }

                if (preferredBranchId) {
                    var foundPreferred = false;
                    for (var i = 0; i < branches.length; i++) {
                        if (String(branches[i].id) === preferredBranchId) {
                            foundPreferred = true;
                            break;
                        }
                    }
                    if (foundPreferred) return preferredBranchId;
                }

                var preferredByName = null;
                for (var j = 0; j < branches.length; j++) {
                    var b = branches[j];
                    if (String(b.name || '').trim().toLowerCase() === PREFERRED_BRANCH_NAME) {
                        preferredByName = b;
                        break;
                    }
                }
                
                if (preferredByName) return String(preferredByName.id);

                return String(branches[0].id);
            });
    };

    var checkSession = function(showLoading, force) {
        if (showLoading === undefined) showLoading = true;
        if (force === undefined) force = false;

        var now = Date.now();
        if (isCheckingRef.current || (now - lastCheckTimeRef.current < 2000 && !showLoading && !force)) {
            return;
        }
        
        var failsafe = setTimeout(function() {
            if (loading) {
                setLoading(false);
            }
        }, 8000);
        
        isCheckingRef.current = true;
        lastCheckTimeRef.current = now;
        
        if (showLoading || !currentSession) {
            setLoading(true);
        }
        
        return supabase.auth.getSession()
            .then(function(sessionRes) {
                var session = sessionRes.data.session;
                var sessionError = sessionRes.error;
                
                if (sessionError) {
                    var msg = sessionError.message || '';
                    var isStale = msg.indexOf('Refresh Token Not Found') !== -1 || 
                                    msg.indexOf('invalid refresh token') !== -1 ||
                                    msg.indexOf('session_not_found') !== -1;
                    
                    if (isStale) {
                        return supabase.auth.signOut()
                            .then(function() {
                                return AsyncStorage.getAllKeys();
                            })
                            .then(function(keys) {
                                var authKeys = [];
                                for (var k = 0; k < keys.length; k++) {
                                    if (keys[k].indexOf('supabase.auth') !== -1 || keys[k].indexOf('sb-') !== -1 || keys[k].indexOf('token') !== -1) {
                                        authKeys.push(keys[k]);
                                    }
                                }
                                if (authKeys.length > 0) {
                                    return AsyncStorage.multiRemove(authKeys);
                                }
                            })
                            .then(function() {
                                setAuthSession(null);
                                setCurrentSession(null);
                                setLoading(false);
                                return 'STALE';
                            })['catch'](function() {
                                setAuthSession(null);
                                setCurrentSession(null);
                                setLoading(false);
                                return 'STALE';
                            });
                    }
                }

                setAuthSession(session);
                if (!session) {
                    setCurrentSession(null);
                    setLoading(false);
                    return 'NO_SESSION';
                }

                return supabase.auth.getUser()
                    .then(function(userRes) {
                        var user = userRes.data.user;
                        var userError = userRes.error;

                        if (userError || !user) {
                            if (userError && userError.message && userError.message.indexOf('Refresh Token Not Found') !== -1) {
                                return supabase.auth.signOut().then(function() {
                                    setAuthSession(null);
                                    setCurrentSession(null);
                                    setLoading(false);
                                    return 'ERROR';
                                });
                            }
                            setLoading(false);
                            return 'ERROR';
                        }

                        return Promise.all([
                            supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
                            supabase.from('profiles').select('role, full_name, name, branch_id').eq('id', user.id).maybeSingle(),
                            supabase.from('cashier_sessions').select('*').eq('user_id', user.id).eq('status', 'Open').order('opened_at', { ascending: false }).limit(1).maybeSingle(),
                            AsyncStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY)
                        ]).then(function(results) {
                            var settingsRes = results[0];
                            var profileRes = results[1];
                            var cashierSessionRes = results[2];
                            var cachedBranchId = results[3];

                            var profileData = profileRes.data;
                            var name = 'User';
                            if (profileData) {
                                name = profileData.full_name || profileData.name || (user.user_metadata ? (user.user_metadata.full_name || user.user_metadata.name) : '') || (user.email ? user.email.split('@')[0] : 'User');
                            }
                            setUserName(name);
                            
                            var preferredBranchId = (profileData && profileData.branch_id)
                                ? String(profileData.branch_id)
                                : (cachedBranchId || currentBranchId || '');
                            
                            return resolveOperationalBranchId(preferredBranchId)
                                .then(function(bId) {
                                    if (!bId) bId = preferredBranchId;
                                    
                                    if (bId !== currentBranchId) {
                                        setCurrentBranchId(bId);
                                    }
                                    if (bId) {
                                        AsyncStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, bId);
                                    }

                                    if (settingsRes.data) {
                                        setStoreSettings(settingsRes.data);
                                    }

                                    var roleName = (profileData ? profileData.role : null) || (user.user_metadata ? user.user_metadata.role : null);
                                    var currentPerms = [];
                                    var hasRolePermission = false;

                                    if (roleName) {
                                        return supabase
                                            .from('roles')
                                            .select('permissions')
                                            .ilike('name', roleName.trim())
                                            .maybeSingle()
                                            .then(function(roleRes) {
                                                var roleData = roleRes.data;
                                                if (roleData && roleData.permissions && Array.isArray(roleData.permissions)) {
                                                    currentPerms = roleData.permissions;
                                                    for (var p = 0; p < currentPerms.length; p++) {
                                                        if (currentPerms[p] === 'mandatory_session') {
                                                            hasRolePermission = true;
                                                            break;
                                                        }
                                                    }
                                                }
                                                return finishProcessing();
                                            });
                                    } else {
                                        return finishProcessing();
                                    }

                                    function finishProcessing() {
                                        setPermissions(currentPerms);

                                        var roleStr = (roleName || '').toLowerCase().trim();
                                        var isDisplayRole = roleStr === 'display' || roleStr.indexOf('display') !== -1;
                                        
                                        var hasOrderOnly = false;
                                        for (var p2 = 0; p2 < currentPerms.length; p2++) {
                                            if (currentPerms[p2] === 'pos_order_only' || currentPerms[p2] === 'order_only') {
                                                hasOrderOnly = true;
                                                break;
                                            }
                                        }
                                        var isDisplayOnlyVal = isDisplayRole || hasOrderOnly;
                                        
                                        var adminRoles = ['admin', 'administrator', 'superadmin', 'owner', 'manager', 'manajer', 'supervisor'];
                                        var isAdminVal = false;
                                        for (var a = 0; a < adminRoles.length; a++) {
                                            if (roleStr.indexOf(adminRoles[a]) !== -1) {
                                                isAdminVal = true;
                                                break;
                                            }
                                        }

                                        var globalRequired = (settingsRes.data && settingsRes.data.require_mandatory_session !== undefined) ? settingsRes.data.require_mandatory_session : true;
                                        
                                        setRequireMandatorySession(isAdminVal ? false : (isDisplayOnlyVal ? false : (globalRequired || hasRolePermission)));
                                        setIsDisplayOnly(isDisplayOnlyVal);
                                        setIsAdmin(isAdminVal);

                                        setCurrentSession(cashierSessionRes.data);
                                        return 'SUCCESS';
                                    }
                                });
                        });
                    });
            })['catch'](function(error) {
                console.error('[SessionContext] checkSession failed:', error);
            })['finally'](function() {
                clearTimeout(failsafe);
                setLoading(false);
                isCheckingRef.current = false;
            });
    };

    var fetchBranchDetails = function() {
        if (!currentBranchId || isNaN(Number(currentBranchId))) return;
        return supabase
            .from('branches')
            .select('name, address, phone')
            .eq('id', currentBranchId)
            .single()
            .then(function(res) {
                var data = res.data;
                if (data) {
                    setBranchName(data.name || '');
                    setBranchAddress(data.address || '');
                    setBranchPhone(data.phone || '');
                }
            })['catch'](function(error) {
                console.error('[SessionContext] Error fetching branch details:', error);
            });
    };

    React.useEffect(function() {
        checkSession();
    }, []);

    React.useEffect(function() {
        if (currentBranchId) {
            fetchBranchDetails();
        }
    }, [currentBranchId]);

    React.useEffect(function() {
        var authRes = supabase.auth.onAuthStateChange(function(event, session) {
            if (event === 'SIGNED_OUT') {
                setAuthSession(null);
                setCurrentSession(null);
                setLoading(false);
                return;
            }

            if (event === 'INITIAL_SESSION' && isCheckingRef.current) return;
            
            checkSession(false, true);
        });
        
        var authSubscription = authRes.data.subscription;

        var channel = supabase
            .channel('cashier_sessions_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cashier_sessions' },
                function() { checkSession(false); }
            )
            .subscribe();

        return function() {
            authSubscription.unsubscribe();
            supabase.removeChannel(channel);
        };
    }, []);

    React.useEffect(function() {
        if (!currentBranchId) return;

        var branchChannel = supabase
            .channel('branch_name_changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'branches', filter: 'id=eq.' + currentBranchId },
                function(payload) {
                    if (payload.new.name) setBranchName(payload.new.name);
                    if (payload.new.address) setBranchAddress(payload.new.address);
                    if (payload.new.phone) setBranchPhone(payload.new.phone);
                }
            )
            .subscribe();

        return function() {
            supabase.removeChannel(branchChannel);
        };
    }, [currentBranchId]);

    React.useEffect(function() {
        var settingsChannel = supabase
            .channel('store_settings_changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'store_settings', filter: 'id=eq.1' },
                function(payload) {
                    setStoreSettings(payload.new);
                }
            )
            .subscribe();

        return function() {
            supabase.removeChannel(settingsChannel);
        };
    }, []);

    var contextValue = React.useMemo(function() {
        return {
            currentSession: currentSession,
            authSession: authSession,
            isSessionActive: !!currentSession,
            loading: loading,
            checkSession: checkSession,
            requireMandatorySession: requireMandatorySession,
            storeSettings: storeSettings,
            permissions: permissions,
            isDisplayOnly: isDisplayOnly,
            isAdmin: isAdmin,
            branchName: branchName,
            branchAddress: branchAddress,
            branchPhone: branchPhone,
            userName: userName,
            currentBranchId: currentBranchId
        };
    }, [
        currentSession,
        authSession,
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

    return React.createElement(SessionContext.Provider, { value: contextValue }, children);
};

var SessionContext = createContext(undefined);

export function useSession() {
    var context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
