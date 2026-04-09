import * as React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet, useWindowDimensions, TextInput, ActivityIndicator, Alert, Modal, Image, BackHandler } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../context/SessionContext';
import CashierSessionModal from '../components/CashierSessionModal';
import ConfirmExitModal from '../components/ConfirmExitModal';
import { Settings, LogOut, Wifi, WifiOff, Trash2, RefreshCw, Printer, Clock, Store, BarChart3, Scissors } from 'lucide-react-native';
import { OfflineService } from '../lib/OfflineService';
import ManagerAuthModal from '../components/ManagerAuthModal';
import SalesReportModal from '../components/SalesReportModal';
import ModernToast from '../components/ModernToast';

export default function HomeScreen() {
    const navigation = useNavigation();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const isSmallDevice = width < 480;
    const isTablet = Math.min(width, height) >= 600;
    const isWide = width >= 600; 

    const [loading, setLoading] = React.useState(true);
    const { currentSession, isSessionActive, requireMandatorySession, checkSession, isDisplayOnly, loading: sessionLoading, branchName, userName, currentBranchId, storeSettings, isAdmin } = useSession();
    const [showSessionModal, setShowSessionModal] = React.useState(false);
    const [sessionMode, setSessionMode] = React.useState<'open' | 'close'>('open');
    const [showExitModal, setShowExitModal] = React.useState(false);
    const [showLogoutModal, setShowLogoutModal] = React.useState(false);
    const [showShiftWarningModal, setShowShiftWarningModal] = React.useState({ visible: false, message: '' });
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
    const [showSalesReport, setShowSalesReport] = React.useState(false);

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
            return () => subscription.remove();
        }, [isSessionActive, requireMandatorySession])
    );

    React.useEffect(() => {
        if (!sessionLoading) {
            if (!isSessionActive && requireMandatorySession && !isDisplayOnly && !showSessionModal) {
                setSessionMode('open');
                setShowSessionModal(true);
            }
            if (!isDisplayOnly && currentBranchId) {
                fetchPendingOrders();
            }
        }
    }, [isSessionActive, requireMandatorySession, isDisplayOnly, sessionLoading, currentBranchId]);

    const fetchPendingOrders = React.useCallback(async () => {
        if (!currentBranchId || isNaN(Number(currentBranchId))) return;
        try {
            setFetchingPending(true);
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .eq('branch_id', currentBranchId)
                .in('status', ['Pending', 'Unpaid'])
                .order('date', { ascending: false });

            if (error) throw error;
            setPendingOrders(data || []);
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
            const { error: itemsError } = await supabase.from('sale_items').delete().eq('sale_id', order.id);
            if (itemsError) throw itemsError;
            const { error: saleError } = await supabase.from('sales').delete().eq('id', order.id);
            if (saleError) throw saleError;
            if (order.table_no && order.table_no !== 'Tanpa Meja' && order.table_no !== '-') {
                await supabase.from('tables').update({ status: 'Available' }).eq('table_no', order.table_no).eq('branch_id', currentBranchId);
            }
            showToast('Pesanan berhasil dihapus', 'success');
            fetchPendingOrders();
        } catch (err: any) {
            console.error('[HomeScreen] Delete Error:', err);
            showToast('Gagal menghapus pesanan', 'error');
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

    const handleOpenSalesReport = () => setShowSalesReport(true);

    React.useEffect(() => {
        const checkConn = async () => {
            const forced = await OfflineService.getForcedOfflineMode();
            setIsManualOffline(forced);
            if (forced) setIsOnline(false);
            else {
                const online = await OfflineService.checkConnectivity();
                setIsOnline(online);
            }
        };
        checkConn();
        const interval = setInterval(checkConn, 15000);
        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        if (!currentBranchId) return;
        let channel: any = null;
        let isActive = true;
        const connect = () => {
            if (!isActive) return;
            channel = supabase.channel(`home_sync_${currentBranchId}_${Date.now()}`);
            channel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `branch_id=eq.${currentBranchId}` }, async (payload: any) => {
                    const newRow = payload.new as any;
                    if (payload.eventType === 'INSERT') {
                        if (!isDisplayOnly && (newRow.status === 'Pending' || newRow.status === 'Unpaid')) {
                            setNewOrderNotif({ visible: true, orderId: newRow.id, tableNo: newRow.table_no || 'Tanpa Meja', orderNo: newRow.order_no || String(newRow.id), itemCount: 0 });
                        }
                    }
                    debouncedFetchPending();
                })
                .subscribe((status: string) => {
                    if (!isActive) return;
                    setRealtimeStatus(status.toUpperCase());
                    if (status === 'SUBSCRIBED') fetchPendingOrders();
                });
        };
        connect();
        return () => {
            isActive = false;
            if (channel) supabase.removeChannel(channel);
        };
    }, [currentBranchId, isDisplayOnly, fetchPendingOrders, debouncedFetchPending]);

    const handleShiftAction = () => {
        setSessionMode(isSessionActive ? 'close' : 'open');
        setShowSessionModal(true);
    };

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

    const confirmLogout = async () => {
        setShowLogoutModal(false);
        try { await supabase.auth.signOut(); } catch (err) {}
    };

    const handleDirectMenu = () => {
        if (!isSessionActive && requireMandatorySession && !isDisplayOnly) {
            setShowSessionModal(true);
            return;
        }
        // @ts-ignore
        navigation.navigate('POS', { tableId: null, tableNumber: 'Tanpa Meja', waiterName: '' });
    };

    const renderHeader = () => (
        <View style={[styles.header, isTablet && styles.tabletHeader, isSmallDevice && { padding: 12, paddingBottom: 16 }]}>
            <View style={[styles.headerRow, isSmallDevice && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={[isSmallDevice && { width: '100%', marginBottom: 16 }]}>
                    <Text style={[styles.greeting, isSmallDevice && { fontSize: 11 }, { color: '#64748b', marginBottom: 4 }]}>Selamat Datang di</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: isSmallDevice ? '100%' : 'auto' }}>
                        <View style={[styles.branchContainer, isSmallDevice && { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }]}>
                            <Text style={[styles.username, isSmallDevice && { fontSize: 14 }, styles.premiumText]}>{branchName}</Text>
                            <Text style={{ fontSize: 8, color: '#ea580c80', marginLeft: 4 }}>v1.2-FOLD</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                           <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isOnline ? '#22c55e15' : '#ef444415', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isOnline ? '#22c55e' : '#ef4444', marginRight: 4 }} />
                                <Text style={{ fontSize: 8, fontWeight: '700', color: isOnline ? '#16a34a' : '#dc2626' }}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
                           </View>
                        </View>
                    </View>
                    <TouchableOpacity style={[styles.sessionBanner, isSmallDevice && { marginTop: 8 }]} onPress={handleShiftAction}>
                        <View style={[styles.statusDot, { backgroundColor: isSessionActive ? '#22c55e' : '#ef4444' }]} />
                        <Text style={styles.sessionStatusText}>{isSessionActive ? `Shift Aktif: ${userName}` : 'Shift Tutup'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Restored Utility Icon Row (with flexwrap for Foldable screens) */}
                <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, isSmallDevice && { width: '100%', marginTop: 8 }]}>
                    {/* 1. Shift Action Button (RESTORED) */}
                    <TouchableOpacity style={[styles.logoutButton, isSmallDevice && { width: 42, height: 42 }]} onPress={handleShiftAction}>
                        <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>💼</Text>
                    </TouchableOpacity>

                    {/* 2. History Orders Button */}
                    <TouchableOpacity style={[styles.logoutButton, isSmallDevice && { width: 42, height: 42 }]} onPress={() => navigation.navigate('History' as never)}>
                        <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>🕒</Text>
                    </TouchableOpacity>

                    {/* 3. Session History Button (RESTORED) */}
                    {(!isAdmin ? storeSettings?.cashier_can_view_session_history : true) && (
                        <TouchableOpacity style={[styles.logoutButton, isSmallDevice && { width: 42, height: 42 }]} onPress={() => navigation.navigate('CashierSessionHistory' as never)}>
                            <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>🏪</Text>
                        </TouchableOpacity>
                    )}

                    {/* 4. Accounting Button */}
                    {(!isAdmin ? storeSettings?.cashier_can_view_reports : true) && (
                        <TouchableOpacity style={[styles.logoutButton, isSmallDevice && { width: 42, height: 42 }]} onPress={() => navigation.navigate('Accounting' as never)}>
                            <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>📊</Text>
                        </TouchableOpacity>
                    )}

                    {/* 4b. Purchases Button */}
                    {(!isAdmin ? storeSettings?.cashier_can_view_reports : true) && (
                        <TouchableOpacity style={[styles.logoutButton, isSmallDevice && { width: 42, height: 42 }]} onPress={() => navigation.navigate('Purchases' as never)}>
                            <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>📦</Text>
                        </TouchableOpacity>
                    )}

                    {/* 5. Settings Button */}
                    <TouchableOpacity style={[styles.logoutButton, isSmallDevice && { width: 42, height: 42 }]} onPress={() => navigation.navigate('Settings' as never)}>
                        <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>⚙️</Text>
                    </TouchableOpacity>

                    {/* 6. Printer/Report Button (RESTORED) */}
                    {(!isAdmin ? storeSettings?.cashier_can_view_reports : true) && (
                        <TouchableOpacity style={[styles.logoutButton, isSmallDevice && { width: 42, height: 42 }]} onPress={handleOpenSalesReport}>
                            <Printer size={18} color="#1e293b" />
                        </TouchableOpacity>
                    )}

                    {/* 7. Logout Button */}
                    <TouchableOpacity style={[styles.logoutButton, { backgroundColor: '#ef444420' }, isSmallDevice && { width: 42, height: 42 }]} onPress={handleLogout}>
                        <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>🔌</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity style={styles.directMenuButton} onPress={handleDirectMenu}>
                <Text style={styles.directMenuIcon}>🛒</Text>
                <Text style={styles.directMenuText}>Buka POS / Order Baru</Text>
            </TouchableOpacity>
        </View>
    );

    if (sessionLoading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#ea580c" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Background Watermark (FIXED: Restore to original contain & centering) */}
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
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    {renderHeader()}
                    
                    {/* Pending Orders Section (GRID v1.2-FOLD) */}
                    {!isDisplayOnly && pendingOrders.length > 0 && (
                        <View style={[styles.menuSection, isSmallDevice && { paddingHorizontal: 12 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Pesanan Menunggu ({pendingOrders.length})</Text>
                                    <TouchableOpacity 
                                        onPress={fetchPendingOrders}
                                        style={{ backgroundColor: '#ea580c15', padding: 6, borderRadius: 10 }}
                                    >
                                        <RefreshCw size={16} color="#ea580c" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            
                            <View style={[
                                { width: '100%' },
                                isWide && { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }
                            ]}>
                                {pendingOrders.map((order) => (
                                    <TouchableOpacity
                                        key={order.id}
                                        style={[
                                            { 
                                                backgroundColor: 'white', 
                                                padding: 16, 
                                                borderRadius: 15, 
                                                marginBottom: 12, 
                                                borderLeftWidth: 5, 
                                                borderLeftColor: '#ea580c',
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.05,
                                                shadowRadius: 5,
                                                elevation: 2
                                            },
                                            isWide ? { width: isTablet ? '31%' : '48%' } : { width: '100%' }
                                        ]}
                                        onPress={() => openNewOrder(order.id)}
                                    >
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#1e293b' }}>
                                                    #{order.order_no.split('-').pop()}
                                                </Text>
                                                <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                                                    {order.table_no || 'Tanpa Meja'}
                                                </Text>
                                            </View>
                                            <TouchableOpacity 
                                                style={{ padding: 4 }}
                                                onPress={(e) => { e.stopPropagation(); handleDeletePendingOrder(order); }}
                                            >
                                                <Trash2 size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                            <Text style={{ fontSize: 11, color: '#64748b' }}>
                                                {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#ea580c', fontWeight: 'bold' }}>Lihat →</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {!isDisplayOnly && (
                        <View style={[styles.menuSection, isSmallDevice && { paddingHorizontal: 12 }]}>
                            <Text style={styles.sectionTitle}>Monitor Produksi</Text>
                            <View style={{ flexDirection: 'row', gap: 15 }}>
                                <TouchableOpacity style={[styles.kdsButton, { backgroundColor: '#ea580c' }]} onPress={() => navigation.navigate('KDS' as never)}>
                                    <Text style={styles.kdsIcon}>👨‍🍳</Text>
                                    <View>
                                        <Text style={styles.kdsTitle}>Dapur</Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Produksi Makanan</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.kdsButton, { backgroundColor: '#2563eb' }]} onPress={() => navigation.navigate('KDS' as never)}>
                                    <Text style={styles.kdsIcon}>☕</Text>
                                    <View>
                                        <Text style={styles.kdsTitle}>Bar</Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Produksi Minuman</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* Modals */}
            <ConfirmExitModal visible={showShiftWarningModal.visible} onClose={() => setShowShiftWarningModal({ visible: false, message: '' })} onConfirm={() => setShowShiftWarningModal({ visible: false, message: '' })} title="Gagal Keluar" message={showShiftWarningModal.message} confirmText="Mengerti" iconType="alert" showCancel={false} />
            <ConfirmExitModal visible={showExitModal} onClose={() => setShowExitModal(false)} onConfirm={() => BackHandler.exitApp()} title="Konfirmasi Keluar" message="Keluar aplikasi?" confirmText="Keluar" iconType="alert" />
            <ConfirmExitModal visible={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={onConfirmDelete} title="Hapus Pesanan?" message="Data akan dihapus permanen" confirmText="Hapus" cancelText="Batal" iconType="trash" />
            <ConfirmExitModal visible={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={confirmLogout} title="Logout" message="Keluar ke login?" confirmText="Keluar" iconType="logout" />
            <CashierSessionModal visible={showSessionModal} onClose={() => setShowSessionModal(false)} mode={sessionMode} session={currentSession} onComplete={checkSession} currentBranchId={currentBranchId} />
            <ManagerAuthModal visible={showManagerAuth} title={managerAuthTitle} onClose={() => setShowManagerAuth(false)} onSuccess={handleManagerAuthSuccess} />
            <ModernToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
            <SalesReportModal visible={showSalesReport} onClose={() => setShowSalesReport(false)} currentBranchId={currentBranchId} branchName={branchName} userName={userName} storeSettings={storeSettings} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fdfcfb' },
    flex1: { flex: 1 },
    watermarkBg: { position: 'absolute', opacity: 0.1 },
    header: { padding: 20 },
    tabletHeader: { paddingHorizontal: 40, paddingVertical: 30 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    greeting: { fontSize: 13 },
    username: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    branchContainer: { backgroundColor: 'white', padding: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
    premiumText: { color: '#ea580c', fontWeight: 'bold' },
    sessionBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 8, borderRadius: 8, marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    sessionStatusText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
    logoutButton: { width: 45, height: 45, borderRadius: 12, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    logoutButtonIcon: { fontSize: 18 },
    directMenuButton: { backgroundColor: '#ea580c', flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, marginTop: 20, elevation: 4, shadowColor: '#ea580c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    directMenuIcon: { fontSize: 24, marginRight: 12 },
    directMenuText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    menuSection: { marginTop: 24, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
    kdsButton: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
    kdsIcon: { fontSize: 20, marginRight: 12 },
    kdsTitle: { color: 'white', fontWeight: 'bold', fontSize: 14 },
});
