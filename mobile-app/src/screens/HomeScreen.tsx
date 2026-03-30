import * as React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet, useWindowDimensions, TextInput, ActivityIndicator, Alert, Modal, Image, BackHandler } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../context/SessionContext';
import CashierSessionModal from '../components/CashierSessionModal';
import ConfirmExitModal from '../components/ConfirmExitModal';
import { Settings, LogOut, Wifi, WifiOff, Trash2, RefreshCw } from 'lucide-react-native';
import { OfflineService } from '../lib/OfflineService';
import ManagerAuthModal from '../components/ManagerAuthModal';
import ModernToast from '../components/ModernToast';

export default function HomeScreen() {
    const navigation = useNavigation();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const isSmallDevice = width < 380;
    const isTablet = Math.min(width, height) >= 600;
    const isLargeTablet = Math.min(width, height) >= 800;

    const [loading, setLoading] = React.useState(true);
    const [showOccupiedModal, setShowOccupiedModal] = React.useState(false);
    const [posFlow, setPosFlow] = React.useState<'direct'>('direct');
    const { currentSession, isSessionActive, requireMandatorySession, checkSession, isDisplayOnly, loading: sessionLoading, branchName, userName, currentBranchId, storeSettings } = useSession();
    const [showSessionModal, setShowSessionModal] = React.useState(false);
    const [showExitModal, setShowExitModal] = React.useState(false);
    const [showLogoutModal, setShowLogoutModal] = React.useState(false);
    const [showShiftWarningModal, setShowShiftWarningModal] = React.useState({ visible: false, message: '' });
    // New Order Notification State (for mobile cashier)
    const [newOrderNotif, setNewOrderNotif] = React.useState<{ visible: boolean; orderId: number | null; tableNo: string; orderNo: string; itemCount: number }>({ visible: false, orderId: null, tableNo: '', orderNo: '', itemCount: 0 });
    const lastKnownOrderIdRef = React.useRef<number>(0);
    const fetchPendingDebounceRef = React.useRef<NodeJS.Timeout | null>(null);
    const [pendingOrders, setPendingOrders] = React.useState<any[]>([]);
    const [fetchingPending, setFetchingPending] = React.useState(false);
    const [isOnline, setIsOnline] = React.useState(true);
    const [isManualOffline, setIsManualOffline] = React.useState(false);
    const [showManagerAuth, setShowManagerAuth] = React.useState(false);
    const [managerAuthTitle, setManagerAuthTitle] = React.useState('Otorisasi Manager');
    const [pendingAction, setPendingAction] = React.useState<(() => void) | null>(null);
    const [realtimeStatus, setRealtimeStatus] = React.useState<string>('CONNECTING...');
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [orderToDelete, setOrderToDelete] = React.useState<any>(null);
    const [toastVisible, setToastVisible] = React.useState(false);
    const [toastMessage, setToastMessage] = React.useState('');
    const [toastType, setToastType] = React.useState<'success' | 'info' | 'error'>('success');

    const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);
    };

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                if (isSessionActive && requireMandatorySession) {
                    setShowShiftWarningModal({ visible: true, message: 'Anda harus menutup shift kasir terlebih dahulu sebelum keluar aplikasi.' });
                    return true;
                }
                setShowExitModal(true);
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            // checkSession(); // Removed redundant call to prevent constant "Memuat Sesi" screens

            return () => subscription.remove();
        }, [isSessionActive, requireMandatorySession])
    );

    React.useEffect(() => {
        if (!sessionLoading) {
            console.log('[HomeScreen] Session State Check:', {
                isSessionActive,
                requireMandatorySession,
                isDisplayOnly,
                showSessionModal
            });

            // Only show modal if session is not active AND it's required AND it's NOT a display-only role
            if (!isSessionActive && requireMandatorySession && !isDisplayOnly) {
                setShowSessionModal(true);
            }
            if (!isDisplayOnly && currentBranchId) {
                fetchPendingOrders();
            }
        }
    }, [isSessionActive, requireMandatorySession, isDisplayOnly, sessionLoading, currentBranchId]);

    const fetchPendingOrders = React.useCallback(async () => {
        if (!currentBranchId) return;
        try {
            setFetchingPending(true);
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .eq('branch_id', currentBranchId)
                .in('status', ['Pending', 'Unpaid'])
                .order('date', { ascending: false });

            if (error) throw error;
            console.log(`[HomeScreen] Fetched ${data?.length || 0} pending orders for branch ${currentBranchId}`);
            setPendingOrders(data || []);

            // Update lastKnownOrderId to avoid duplicate notifications for existing items
            if (data && data.length > 0) {
                const maxId = Math.max(...data.map((o: any) => o.id));
                if (maxId > lastKnownOrderIdRef.current) {
                    lastKnownOrderIdRef.current = maxId;
                }
            }
        } catch (err) {
            console.error('[HomeScreen] Fetch Pending Error:', err);
        } finally {
            setFetchingPending(false);
        }
    }, [currentBranchId]);

    const debouncedFetchPending = React.useCallback(() => {
        if (fetchPendingDebounceRef.current) clearTimeout(fetchPendingDebounceRef.current);
        fetchPendingDebounceRef.current = setTimeout(() => {
            fetchPendingOrders();
        }, 1000);
    }, [fetchPendingOrders]);

    const handleManagerAuthSuccess = () => {
        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
    };

    const performDelete = async (order: any) => {
        try {
            // 1. Delete sale_items
            const { error: itemsError } = await supabase
                .from('sale_items')
                .delete()
                .eq('sale_id', order.id);
            
            if (itemsError) throw itemsError;

            // 2. Delete sale
            const { error: saleError } = await supabase
                .from('sales')
                .delete()
                .eq('id', order.id);

            if (saleError) throw saleError;

            // 3. Update table status if applicable
            if (order.table_no && order.table_no !== 'Tanpa Meja' && order.table_no !== '-') {
                await supabase
                    .from('tables')
                    .update({ status: 'Available' })
                    .eq('table_no', order.table_no)
                    .eq('branch_id', currentBranchId);
            }

            showToast('Pesanan berhasil dihapus', 'success');
            fetchPendingOrders();
        } catch (err: any) {
            console.error('[HomeScreen] Delete Error:', err);
            showToast('Gagal menghapus pesanan: ' + err.message, 'error');
        }
    };

    const handleDeletePendingOrder = (order: any) => {
        setOrderToDelete(order);
        setShowDeleteConfirm(true);
    };

    const onConfirmDelete = () => {
        setShowDeleteConfirm(false);
        if (!orderToDelete) return;

        if (storeSettings?.enable_manager_auth) {
            setManagerAuthTitle('Otorisasi Hapus Pesanan');
            setPendingAction(() => () => performDelete(orderToDelete));
            setShowManagerAuth(true);
        } else {
            performDelete(orderToDelete);
        }
    };


    React.useEffect(() => {
        const checkConn = async () => {
            const forced = await OfflineService.getForcedOfflineMode();
            setIsManualOffline(forced);

            if (forced) {
                setIsOnline(false);
            } else {
                const online = await OfflineService.checkConnectivity();
                setIsOnline(online);
            }
        };
        checkConn();
        const interval = setInterval(checkConn, 15000); // Check every 15s
        return () => clearInterval(interval);
    }, []);

    // ─── Real-time Monitor + New Order Notification for Cashier ───────
    React.useEffect(() => {
        if (!currentBranchId) return;

        let channel: any = null;
        let isActive = true;
        let retryCount = 0;

        const connect = () => {
            if (!isActive) return;
            
            const channelName = `home_sync_${currentBranchId}_${Date.now()}`;
            console.log(`[Realtime] Connecting to ${channelName} (attempt ${retryCount + 1})`);
            setRealtimeStatus('CONNECTING...');

            channel = supabase.channel(channelName);
            
            channel
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'sales' },
                    async (payload: any) => {
                        const newRow = payload.new as any;
                        
                        // 1. Process Insert (New Order Notification)
                        if (payload.eventType === 'INSERT') {
                            if (newRow && String(newRow.branch_id) === String(currentBranchId)) {
                                // Important: Only trigger popup for cashier
                                if (!isDisplayOnly && (newRow.status === 'Pending' || newRow.status === 'Unpaid')) {
                                    setNewOrderNotif({
                                        visible: true,
                                        orderId: newRow.id,
                                        tableNo: newRow.table_no || 'Tanpa Meja',
                                        orderNo: newRow.order_no || String(newRow.id),
                                        itemCount: 0,
                                    });
                                    
                                    if (newRow.id > lastKnownOrderIdRef.current) {
                                        lastKnownOrderIdRef.current = newRow.id;
                                    }
                                }
                                debouncedFetchPending();
                            }
                        } else {
                            // 2. Process other changes (Update/Delete)
                            if (newRow && String(newRow.branch_id) === String(currentBranchId)) {
                                debouncedFetchPending();
                            } else if (payload.old && String(payload.old.branch_id) === String(currentBranchId)) {
                                debouncedFetchPending();
                            }
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'store_settings', filter: 'id=eq.1' },
                    () => console.log('[Realtime] Store settings updated')
                )
                .subscribe((status: string) => {
                    if (!isActive) return;
                    console.log(`[Realtime] Status for ${channelName}: ${status}`);
                    setRealtimeStatus(status.toUpperCase());

                    if (status === 'SUBSCRIBED') {
                        retryCount = 0;
                        fetchPendingOrders();
                    } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                        // RECONNECT LOGIC
                        supabase.removeChannel(channel);
                        const nextRetry = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exp backoff
                        setTimeout(() => {
                            if (isActive) {
                                retryCount++;
                                connect();
                            }
                        }, nextRetry);
                    }
                });
        };

        connect();

        // ─── Fallback Polling (Every 30s) ─────────────────────────────────
        const pollInterval = setInterval(() => {
            if (isActive && realtimeStatus !== 'SUBSCRIBED') {
                console.log('[Realtime] Fallback polling due to connection: ', realtimeStatus);
                fetchPendingOrders();
            }
        }, 30000);

        return () => {
            isActive = false;
            if (channel) supabase.removeChannel(channel);
            clearInterval(pollInterval);
            if (fetchPendingDebounceRef.current) clearTimeout(fetchPendingDebounceRef.current);
        };
    }, [currentBranchId, isDisplayOnly, fetchPendingOrders, debouncedFetchPending]);

    const openNewOrder = (orderId: number) => {
        setNewOrderNotif(prev => ({ ...prev, visible: false }));
        // @ts-ignore
        navigation.navigate('POS', { orderId, tableNumber: 'Tanpa Meja' });
    };

    const handleLogout = () => {
        if (isSessionActive && requireMandatorySession) {
            setShowShiftWarningModal({ visible: true, message: 'Anda harus menutup shift kasir terlebih dahulu sebelum keluar akun.' });
            return;
        }
        setShowLogoutModal(true);
    };

    const confirmLogout = () => {
        setShowLogoutModal(false);
        // @ts-ignore
        navigation.reset({
            index: 0,
            routes: [{ name: 'Login' } as never],
        });
    };

    const handleDirectMenu = () => {
        if (!isSessionActive && requireMandatorySession && !isDisplayOnly) {
            setShowSessionModal(true);
            return;
        }
        // @ts-ignore
        navigation.navigate('POS', {
            tableId: null,
            tableNumber: 'Tanpa Meja',
            waiterName: ''
        });
    };
    const renderHeader = () => (
        <View style={[
            styles.header,
            isTablet && styles.tabletHeader,
            isSmallDevice && { padding: 12, paddingBottom: 16 },
            { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 }
        ]}>
            <View style={[
                styles.headerRow,
                isSmallDevice && { flexDirection: 'column', alignItems: 'flex-start' }
            ]}>
                <View style={[
                    isSmallDevice && { width: '100%', marginBottom: 16 }
                ]}>
                    <Text style={[
                        styles.greeting,
                        isTablet && styles.tabletGreeting,
                        isSmallDevice && { fontSize: 11 },
                        { color: '#e5e7eb', marginBottom: 4 }
                    ]}>Selamat Datang di</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: isSmallDevice ? '100%' : 'auto' }}>
                        <View style={[
                            styles.branchContainer,
                            isSmallDevice && { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 0 }
                        ]}>
                            <Text style={[
                                styles.username,
                                isTablet && styles.tabletUsername,
                                isSmallDevice && { fontSize: 14 },
                                styles.premiumText
                            ]}>{branchName}</Text>
                        </View>

                        {/* Connection Indicator */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginLeft: 8,
                            backgroundColor: isOnline ? '#22c55e15' : '#ef444415',
                            paddingHorizontal: 6,
                            paddingVertical: 1,
                            borderRadius: 6,
                            borderWidth: 0.5,
                            borderColor: isOnline ? '#22c55e40' : '#ef444440'
                        }}>
                            <View style={{
                                width: 4,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: isOnline ? '#22c55e' : '#ef4444',
                                marginRight: 4
                            }} />
                             <Text style={{
                                fontSize: 8,
                                fontWeight: '700',
                                color: isOnline ? '#16a34a' : '#dc2626',
                                letterSpacing: 0.5
                            }}>
                                {isManualOffline ? 'OFF_M' : (isOnline ? 'ONLINE' : 'OFFLINE')}
                            </Text>
                        </View>

                        {/* Realtime Status Indicator */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginLeft: 4,
                            backgroundColor: realtimeStatus === 'SUBSCRIBED' ? '#0ea5e915' : '#f59e0b15',
                            paddingHorizontal: 6,
                            paddingVertical: 1,
                            borderRadius: 6,
                            borderWidth: 0.5,
                            borderColor: realtimeStatus === 'SUBSCRIBED' ? '#0ea5e940' : '#f59e0b40'
                        }}>
                            <Text style={{
                                fontSize: 8,
                                fontWeight: '700',
                                color: realtimeStatus === 'SUBSCRIBED' ? '#0284c7' : '#d97706',
                                letterSpacing: 0.5
                            }}>
                                {realtimeStatus === 'SUBSCRIBED' ? 'SIAP!' : `RT: ${realtimeStatus}`}
                            </Text>
                        </View>
                    </View>

                    {/* Session Status Banner */}
                    <View style={[styles.sessionBanner, isSmallDevice && { marginTop: 8 }]}>
                        <View style={[styles.statusDot, { backgroundColor: isSessionActive ? '#22c55e' : '#ef4444' }]} />
                        <Text style={styles.sessionStatusText}>
                            {isSessionActive ? `Shift Aktif: ${userName}` : 'Shift Tutup'}
                            {isSmallDevice ? '' : (requireMandatorySession ? ' (Wajib)' : ' (Opsional)')}
                        </Text>
                    </View>
                </View>

                {/* Utility Buttons Row */}
                <View style={[
                    { flexDirection: 'row', gap: isSmallDevice ? 8 : 12 },
                    isSmallDevice && { width: '100%', justifyContent: 'space-between' }
                ]}>
                    {!isDisplayOnly && (
                        <>
                            <TouchableOpacity
                                style={[
                                    styles.logoutButton,
                                    { backgroundColor: 'rgba(255,255,255,0.2)' },
                                    isSmallDevice && { width: 42, height: 42, borderRadius: 12 }
                                ]}
                                onPress={() => navigation.navigate('History' as never)}
                            >
                                <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>🕒</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.logoutButton, 
                                    { backgroundColor: 'rgba(255,255,255,0.2)' },
                                    isSmallDevice && { width: 42, height: 42, borderRadius: 12 }
                                ]}
                                onPress={() => navigation.navigate('CashierSessionHistory' as never)}
                            >
                                <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>🏪</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.logoutButton, 
                                    { backgroundColor: 'rgba(255,255,255,0.2)' },
                                    isSmallDevice && { width: 42, height: 42, borderRadius: 12 }
                                ]}
                                onPress={() => navigation.navigate('Accounting' as never)}
                            >
                                <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>📊</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    <TouchableOpacity
                        style={[
                            styles.logoutButton,
                            { backgroundColor: 'rgba(255,255,255,0.2)' },
                            isSmallDevice && { width: 42, height: 42, borderRadius: 12 }
                        ]}
                        onPress={() => navigation.navigate('Settings' as never)}
                    >
                        <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>⚙️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.logoutButton,
                            { backgroundColor: 'rgba(239, 68, 68, 0.4)' },
                            isSmallDevice && { width: 42, height: 42, borderRadius: 12 }
                        ]}
                        onPress={handleLogout}
                    >
                        <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>🔌</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                style={[
                    styles.directMenuButton,
                    isSmallDevice && { padding: 12, borderRadius: 16, marginTop: 12 }
                ]}
                onPress={handleDirectMenu}
            >
                <Text style={[styles.directMenuIcon, isSmallDevice && { fontSize: 20 }]}>🛒</Text>
                <Text style={[styles.directMenuText, isSmallDevice && { fontSize: 13, marginLeft: 8 }]}>Buka POS / Order Baru</Text>
            </TouchableOpacity>
        </View>
    );

    if (sessionLoading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#ea580c" />
                <Text style={{ marginTop: 12, color: '#64748b', fontWeight: 'bold' }}>Memuat Sesi...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Background Watermark */}
            <Image
                source={require('../../assets/winny-bg.jpg')}
                style={[
                    styles.watermarkBg,
                    {
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100%',
                        height: '100%',
                    }
                ]}
                resizeMode="contain"
            />

            <View style={styles.flex1}>
                <ScrollView
                    style={styles.flex1}
                    contentContainerStyle={[
                        isTablet && styles.tabletScrollContent,
                        isLandscape && { paddingHorizontal: isLargeTablet ? 80 : 40 }
                    ]}
                >
                    {renderHeader()}

                    {/* Pending Orders Section (Restored) */}
                    {!isDisplayOnly && pendingOrders.length > 0 && (
                        <View style={[styles.menuSection, isSmallDevice ? { marginTop: -10, paddingHorizontal: 12 } : { marginTop: -15 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={[styles.sectionTitle, { color: 'white', marginBottom: 0 }]}>Pesanan Menunggu ({pendingOrders.length})</Text>
                                    <TouchableOpacity 
                                        onPress={() => fetchPendingOrders()}
                                        style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 10 }}
                                        disabled={fetchingPending}
                                    >
                                        <RefreshCw size={16} color="white" style={fetchingPending ? { opacity: 0.5 } : {}} />
                                    </TouchableOpacity>
                                </View>
                                {fetchingPending && <ActivityIndicator size="small" color="white" />}
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                                {pendingOrders.map((order) => (
                                    <TouchableOpacity
                                        key={order.id}
                                        style={{
                                            backgroundColor: 'white',
                                            padding: 16,
                                            borderRadius: 20,
                                            marginRight: 12,
                                            width: 180,
                                            borderLeftWidth: 6,
                                            borderLeftColor: '#ea580c',
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 6,
                                            elevation: 3
                                        }}
                                        onPress={() => openNewOrder(order.id)}
                                    >
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: '900', fontSize: 16, color: '#1e293b', marginBottom: 2 }}>
                                                    #{order.order_no.split('-').pop()}
                                                </Text>
                                                <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                                                    {order.table_no && order.table_no !== 'Tanpa Meja' ? `🪑 Meja ${order.table_no}` : '🛍️ Take Away'}
                                                </Text>
                                            </View>
                                            <TouchableOpacity 
                                                style={{ padding: 4, marginTop: -4, marginRight: -8 }}
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    handleDeletePendingOrder(order);
                                                }}
                                            >
                                                <Trash2 size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                                                {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#ea580c', fontWeight: 'bold' }}>Lihat →</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Summary Status Section */}


                    {/* Table Selection Grid */}

                    {/* Monitor Produksi (KDS) - Hidden for User Display */}
                    {!isDisplayOnly && (
                        <View style={[
                            styles.menuSection,
                            isTablet && styles.tabletMenuSection,
                            isSmallDevice && { padding: 12 }
                        ]}>
                            <Text style={[
                                styles.sectionTitle,
                                isTablet && styles.tabletSectionTitle,
                                isSmallDevice && { fontSize: 12 },
                                { color: 'white' }
                            ]}>Monitor Produksi</Text>
                            <View style={[
                                styles.menuGrid,
                                isSmallDevice && { gap: 8 }
                            ]}>
                                <TouchableOpacity
                                    style={[
                                        styles.kdsButton,
                                        { backgroundColor: '#ea580c' },
                                        isSmallDevice && { padding: 12, borderRadius: 16 }
                                    ]}
                                    onPress={() => navigation.navigate('KDS' as never)}
                                >
                                    <Text style={[
                                        styles.kdsIcon,
                                        isSmallDevice && { fontSize: 20 }
                                    ]}>👨‍🍳</Text>
                                    <View>
                                        <Text style={[
                                            styles.kdsTitle,
                                            isSmallDevice && { fontSize: 13 }
                                        ]}>Dapur</Text>
                                        <Text style={[
                                            styles.kdsSub,
                                            isSmallDevice && { fontSize: 9 }
                                        ]}>Makanan</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.kdsButton,
                                        { backgroundColor: '#2563eb' },
                                        isSmallDevice && { padding: 12, borderRadius: 16 }
                                    ]}
                                    onPress={() => navigation.navigate('KDS' as never)}
                                >
                                    <Text style={[
                                        styles.kdsIcon,
                                        isSmallDevice && { fontSize: 20 }
                                    ]}>☕</Text>
                                    <View>
                                        <Text style={[
                                            styles.kdsTitle,
                                            isSmallDevice && { fontSize: 13 }
                                        ]}>Bar</Text>
                                        <Text style={[
                                            styles.kdsSub,
                                            isSmallDevice && { fontSize: 9 }
                                        ]}>Minuman</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>


            {/* Shift Warning Modal */}
            <ConfirmExitModal
                visible={showShiftWarningModal.visible}
                onClose={() => setShowShiftWarningModal({ visible: false, message: '' })}
                onConfirm={() => setShowShiftWarningModal({ visible: false, message: '' })}
                title="Gagal Keluar"
                message={showShiftWarningModal.message}
                confirmText="Mengerti"
                iconType="alert"
                showCancel={false}
            />

            <ConfirmExitModal
                visible={showExitModal}
                onClose={() => setShowExitModal(false)}
                onConfirm={() => BackHandler.exitApp()}
                title="Konfirmasi Keluar"
                message="Apakah Anda yakin ingin keluar dari aplikasi?"
                confirmText="Keluar"
                iconType="alert"
            />

            <ConfirmExitModal
                visible={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={onConfirmDelete}
                title="Hapus Pesanan?"
                message={`Pesanan #${orderToDelete?.order_no?.split('-').pop() || orderToDelete?.id} akan dihapus.`}
                confirmText="Hapus"
                cancelText="Batal"
                iconType="trash"
            />

            {/* Logout Modal */}
            <ConfirmExitModal
                visible={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={confirmLogout}
                title="Keluar Sesi Kasir"
                message="Apakah Anda yakin ingin kembali ke halaman login?"
                confirmText="Keluar"
                iconType="logout"
            />

            <CashierSessionModal
                visible={showSessionModal}
                onClose={() => setShowSessionModal(false)}
                mode="open"
                onComplete={checkSession}
                currentBranchId={currentBranchId}
            />

            {/* New Order Notification Modal — auto-navigates to POS */}
            <Modal
                visible={newOrderNotif.visible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setNewOrderNotif(prev => ({ ...prev, visible: false }))}
            >
                <View style={[styles.modalOverlay]}>
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: 24,
                        padding: 24,
                        borderTopWidth: 5,
                        borderTopColor: '#ea580c',
                        alignItems: 'center',
                        width: '90%',
                        maxWidth: 400,
                    }}>
                        <Text style={{ fontSize: 32, marginBottom: 8 }}>🔔</Text>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 }}>
                            Pesanan Baru Masuk!
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
                            {newOrderNotif.tableNo && newOrderNotif.tableNo !== 'Tanpa Meja'
                                ? `🪑 Meja ${newOrderNotif.tableNo}`
                                : '🛍️ Take Away'
                            } — #{newOrderNotif.orderNo}
                        </Text>


                        <TouchableOpacity
                            style={{ backgroundColor: '#ea580c', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14, width: '100%', alignItems: 'center', marginBottom: 10 }}
                            onPress={() => openNewOrder(newOrderNotif.orderId!)}
                        >
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Buka Sekarang 🚀</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ padding: 12 }}
                            onPress={() => setNewOrderNotif(prev => ({ ...prev, visible: false }))}
                        >
                            <Text style={{ color: '#9ca3af', fontWeight: 'bold' }}>Abaikan</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <ManagerAuthModal
                visible={showManagerAuth}
                title={managerAuthTitle}
                onClose={() => setShowManagerAuth(false)}
                onSuccess={handleManagerAuthSuccess}
            />

            <ModernToast
                visible={toastVisible}
                message={toastMessage}
                type={toastType}
                onHide={() => setToastVisible(false)}
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#d9c3a3',
    },
    flex1: {
        flex: 1,
    },
    watermarkBg: {
        position: 'absolute',
        opacity: 0.1,
    },
    header: {
        backgroundColor: 'transparent',
        padding: 20,
        paddingBottom: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    greeting: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: '500',
    },
    username: {
        fontSize: 20,
        fontWeight: '900',
        color: 'white',
        letterSpacing: 0.5,
    },
    branchContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        alignSelf: 'flex-start',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    premiumText: {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    sessionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    sessionStatusText: {
        color: '#f3f4f6',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.3,
    },
    logoutButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    logoutButtonIcon: {
        fontSize: 20,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    location: {
        color: '#2563eb',
        fontSize: 12,
        fontWeight: 'bold',
    },
    avatar: {
        width: 40,
        height: 40,
        backgroundColor: '#e5e7eb',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    avatarEmoji: {
        fontSize: 20,
    },
    summaryGrid: {
        flexDirection: 'row',
        gap: 16,
    },
    summaryCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    bgBlue: {
        backgroundColor: '#eff6ff',
        borderColor: '#dbeafe',
    },
    bgPurple: {
        backgroundColor: '#f5f3ff',
        borderColor: '#ede9fe',
    },
    cardLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    textBlue: {
        color: '#2563eb',
    },
    textPurple: {
        color: '#9333ea',
    },
    cardValue: {
        color: '#1f2937',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cardSub: {
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 4,
    },
    menuSection: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    menuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 10,
    },
    // New Card Styles
    tableCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 20,
        marginBottom: 10,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(229, 231, 235, 0.5)',
        minHeight: 130,
    },
    tableCardOccupied: {
        borderColor: '#fecaca',
        backgroundColor: '#fef2f2',
        opacity: 0.7,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    tableNumber: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1f2937',
    },
    statusBadge: {
        padding: 8,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusIcon: {
        fontSize: 12,
    },
    cardInfoRow: {
        marginBottom: 8,
    },
    capacityText: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
    },
    pillBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: 0.5,
    },
    cardFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    tableStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    tableTime: {
        fontSize: 10,
        color: '#ef4444',
        fontWeight: '500',
    },

    // Tablet Styles for Cards
    tabletTableCard: {
        padding: 32,
        borderRadius: 24,
        minHeight: 180,
    },
    tabletTableNumber: {
        fontSize: 48,
    },

    // Legacy Styles (Keep if needed elsewhere or remove if unused)
    waiterContainer: {
        marginTop: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 8,
    },
    waiterInput: {
        backgroundColor: '#f3f4f6',
        padding: 12,
        borderRadius: 12,
        fontSize: 16,
        color: '#1f2937',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    settingsButton: {
        width: 40,
        height: 40,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    activitySection: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    activityCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f9fafb',
        paddingBottom: 12,
        marginBottom: 12,
    },
    activityItemNoBorder: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    miniIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    bgGreenLight: {
        backgroundColor: '#f0fdf4',
    },
    bgBlueLight: {
        backgroundColor: '#eff6ff',
    },
    activityText: {
        fontWeight: '500',
        color: '#1f2937',
    },
    activityTime: {
        fontSize: 12,
        color: '#6b7280',
    },
    amountPositive: {
        fontWeight: 'bold',
        color: '#16a34a',
    },
    amountInfo: {
        fontWeight: 'bold',
        color: '#2563eb',
    },

    // Tablet Specific Styles
    tabletScrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    tabletHeader: {
        padding: 24,
        paddingBottom: 32,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    tabletGreeting: {
        fontSize: 16,
    },
    tabletUsername: {
        fontSize: 28,
        marginTop: 2,
    },
    tabletLocation: {
        fontSize: 14,
    },
    tabletAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    tabletAvatarEmoji: {
        fontSize: 28,
    },
    tabletSummaryGrid: {
        marginTop: 16,
        gap: 16,
    },
    tabletSummaryCard: {
        padding: 16,
        borderRadius: 16,
    },
    tabletCardLabel: {
        fontSize: 12,
        marginBottom: 6,
    },
    tabletCardValue: {
        fontSize: 20,
    },
    tabletCardSub: {
        fontSize: 12,
        marginTop: 6,
    },
    tabletMenuSection: {
        padding: 24,
    },
    tabletSectionTitle: {
        fontSize: 24,
        marginBottom: 16,
    },
    tabletMenuItem: {
        width: '32%',
        paddingVertical: 32,
        borderRadius: 24,
        marginBottom: 8,
    },
    tabletIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginBottom: 16,
    },
    tabletIcon: {
        fontSize: 32,
    },
    tabletMenuTitle: {
        fontSize: 18,
        textAlign: 'center',
    },
    tabletActivitySection: {
        paddingHorizontal: 40,
    },
    tabletActivityCard: {
        padding: 24,
        borderRadius: 24,
    },
    tabletActivityItem: {
        paddingBottom: 20,
        marginBottom: 20,
    },
    tabletMiniIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 20,
    },
    tabletMiniIconText: {
        fontSize: 24,
    },
    tabletActivityText: {
        fontSize: 18,
    },
    tabletActivityTime: {
        fontSize: 14,
    },
    tabletAmount: {
        fontSize: 18,
    },
    // Modern Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modernModalContent: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: 'white',
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 10,
    },
    modalIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalIcon: {
        fontSize: 40,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 12,
        textAlign: 'center',
    },
    modalDescription: {
        fontSize: 16,
        color: '#6b7280',
        lineHeight: 24,
        textAlign: 'center',
        marginBottom: 32,
    },
    modalCloseButton: {
        backgroundColor: '#8b4513',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
    },
    modalCloseButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    directMenuButton: {
        backgroundColor: '#ea580c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 20,
        marginTop: 20,
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    directMenuIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    directMenuText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 12,
    },
    kdsButton: {
        width: '48.5%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    kdsIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    kdsTitle: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    kdsSub: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 20,
        width: '90%',
        maxWidth: 400,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    successIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f0fdf4',
        borderWidth: 2,
        borderColor: '#22c55e',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    successTitleText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1f2937',
        textAlign: 'center',
    },
    modalButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#22c55e',
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
