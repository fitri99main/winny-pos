import * as React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions, TextInput, ActivityIndicator, Alert, Modal, Image, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../context/SessionContext';
import CashierSessionModal from '../components/CashierSessionModal';
import ConfirmExitModal from '../components/ConfirmExitModal';
import { Settings, LogOut, Wifi, WifiOff, Trash2, RefreshCw, Printer, Clock, Store, BarChart3, Scissors, PieChart } from 'lucide-react-native';
import { OfflineService } from '../lib/OfflineService';
import SalesReportModal from '../components/SalesReportModal';
import ModernToast from '../components/ModernToast';
import CashierClosingSummaryModal from '../components/CashierClosingSummaryModal';
import { PrinterManager } from '../lib/PrinterManager';

export default function HomeScreen() {
    const navigation = useNavigation();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const isSmallDevice = width < 480;
    const isTablet = Math.min(width, height) >= 600;
    const isWide = width >= 600; 

    const [loading, setLoading] = React.useState(true);
    const { currentSession, isSessionActive, requireMandatorySession, checkSession, isDisplayOnly, loading: sessionLoading, branchName, branchAddress, branchPhone, userName, currentBranchId, storeSettings, isAdmin } = useSession();
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
    const [realtimeStatus, setRealtimeStatus] = React.useState<string>('CONNECTING...');
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [orderToDelete, setOrderToDelete] = React.useState<any>(null);
    const [toastVisible, setToastVisible] = React.useState(false);
    const [toastMessage, setToastMessage] = React.useState('');
    const [toastType, setToastType] = React.useState<'success' | 'info' | 'error'>('success');
    const [showSalesReport, setShowSalesReport] = React.useState(false);
    const [showCurrentSummary, setShowCurrentSummary] = React.useState(false);
    const [summaryData, setSummaryData] = React.useState<any>(null);
    const [summaryLoading, setSummaryLoading] = React.useState(false);
    const [offlineCount, setOfflineCount] = React.useState(0);
    const [isSyncing, setIsSyncing] = React.useState(false);

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
        performDelete(orderToDelete);
    };

    const handleOpenSalesReport = () => setShowSalesReport(true);

    const handleViewCurrentSummary = async () => {
        if (!isSessionActive || !currentSession) {
            Alert.alert('Info', 'Belum ada shift aktif.');
            return;
        }
        setSummaryLoading(true);
        setShowCurrentSummary(true);
        try {
            const openedAt = new Date(currentSession.opened_at).toISOString();
            let allSales: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('sales')
                    .select('*')
                    .eq('branch_id', currentBranchId)
                    .gte('date', openedAt)
                    .range(from, from + pageSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allSales = [...allSales, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else from += pageSize;
                } else {
                    hasMore = false;
                }
            }

            const sales = allSales;

            let cash = 0;
            let nonCash = 0;
            let total = 0;
            let totalTax = 0;
            let totalDiscount = 0;
            let completedCount = 0;
            let paySummary: Record<string, number> = {};
            let catSummary: Record<string, number> = {};

            sales?.forEach(sale => {
                const status = (sale.status || '').toLowerCase();
                const isPaid = ['completed', 'selesai', 'paid', 'served', 'success', 'settlement', 'capture'].includes(status);
                
                if (isPaid) {
                    completedCount++;
                    const amount = (sale.paid_amount || sale.total_amount || 0);
                    total += amount;
                    totalTax += Number(sale.tax || sale.tax_amount || 0);
                    totalDiscount += Number(sale.discount || sale.discount_amount || 0);
                    const method = (sale.payment_method || 'Tunai').trim();
                    paySummary[method] = (paySummary[method] || 0) + amount;

                    const lowerMethod = method.toLowerCase();
                    if (lowerMethod === 'tunai' || lowerMethod === 'cash') cash += amount;
                    else nonCash += amount;
                }
            });

            // Categories
            const saleIds = sales?.map(s => s.id) || [];
            if (saleIds.length > 0) {
                const { data: allProducts } = await supabase.from('products').select('id, name, category');
                const productCatMap: Record<string, string> = {};
                allProducts?.forEach(p => { productCatMap[p.name || ''] = (p.category || 'LAINNYA').toUpperCase(); });

                let allItems: any[] = [];
                let itemFrom = 0;
                let itemHasMore = true;

                while (itemHasMore) {
                    const { data: itemsPage, error: itemError } = await supabase
                        .from('sale_items')
                        .select('product_name, quantity, price')
                        .in('sale_id', saleIds)
                        .range(itemFrom, itemFrom + pageSize - 1);
                    
                    if (itemError) throw itemError;

                    if (itemsPage && itemsPage.length > 0) {
                        allItems = [...allItems, ...itemsPage];
                        if (itemsPage.length < pageSize) itemHasMore = false;
                        else itemFrom += pageSize;
                    } else {
                        itemHasMore = false;
                    }
                }
                
                const items = allItems;
                if (items) {
                    items.forEach(item => {
                        const name = item.product_name || 'Produk';
                        const cat = productCatMap[name] || 'LAINNYA';
                        const amount = Number(item.quantity) * Number(item.price);
                        if (amount > 0) {
                            catSummary[cat] = (catSummary[cat] || 0) + amount;
                        }
                    });
                }
            }

            setSummaryData({
                cash_sales: cash,
                non_cash_sales: nonCash,
                total_sales: total,
                total_tax: totalTax,
                total_discount: totalDiscount,
                total_orders: completedCount,
                expected_cash: currentSession.starting_cash + cash,
                starting_cash: currentSession.starting_cash,
                employee_name: currentSession.employee_name,
                opened_at: currentSession.opened_at,
                payment_summary: Object.entries(paySummary).map(([method, amount]) => ({ method, amount })),
                category_summary: Object.entries(catSummary).map(([name, amount]) => ({ name, amount }))
            });
        } catch (err) {
            console.error('Error fetching current summary:', err);
            Alert.alert('Error', 'Gagal memuat ringkasan.');
        } finally {
            setSummaryLoading(false);
        }
    };

    const handlePrintSummary = async () => {
        if (!summaryData) return;
        try {
            const { data: settings } = await supabase.from('store_settings').select('*').single();
            const reportData = {
                shopName: settings?.store_name || 'WINNY COFFEE PNK',
                address: settings?.address || '',
                phone: settings?.phone || '',
                dateRange: `${new Date(summaryData.opened_at).toLocaleString('id-ID')} - ${new Date().toLocaleString('id-ID')}`,
                totalOrders: summaryData.total_orders,
                totalSales: summaryData.total_sales,
                totalTax: summaryData.total_tax || 0,
                totalDiscount: summaryData.total_discount || 0,
                paymentSummary: summaryData.payment_summary,
                categorySummary: summaryData.category_summary.map((c: any) => ({ category: c.name, amount: c.amount })),
                productSummary: [],
                openingBalance: summaryData.starting_cash,
                cashTotal: summaryData.cash_sales,
                qrTotal: summaryData.non_cash_sales,
                expectedCash: summaryData.expected_cash,
                actualCash: 0,
                variance: 0,
                generatedBy: summaryData.employee_name,
                showLogo: true,
                receiptLogoUrl: settings?.receipt_logo_url || settings?.logo_url,
                address: settings?.address || branchAddress,
                phone: settings?.phone || branchPhone,
                paperWidth: settings?.receipt_paper_width === '80mm' ? 48 : 32
            };
            await PrinterManager.printSalesReport(reportData);
        } catch (err) {
            Alert.alert('Printer Error', 'Gagal mencetak.');
        }
    };

    React.useEffect(() => {
        const checkConn = async () => {
            const forced = await OfflineService.getForcedOfflineMode();
            setIsManualOffline(forced);
            if (forced) setIsOnline(false);
            else {
                const online = await OfflineService.checkConnectivity();
                setIsOnline(online);
            }
            // Update offline count
            const queue = await OfflineService.getOfflineQueue();
            setOfflineCount(queue.length);
        };
        checkConn();
        const interval = setInterval(checkConn, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleSyncNow = async () => {
        if (offlineCount === 0) return;
        if (!isOnline) {
            Alert.alert('Offline', 'Tidak dapat sinkronisasi saat offline.');
            return;
        }

        try {
            setIsSyncing(true);
            const result = await OfflineService.syncQueue();
            const queue = await OfflineService.getOfflineQueue();
            setOfflineCount(queue.length);
            
            if (result.failed === 0) {
                showToast(`Berhasil sinkronisasi ${result.success} transaksi`, 'success');
            } else {
                showToast(`Sinkronisasi selesai: ${result.success} berhasil, ${result.failed} gagal.`, 'error');
            }
        } catch (error: any) {
            showToast('Gagal sinkronisasi: ' + error.message, 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    React.useEffect(() => {
        if (!currentBranchId) return;
        let channel: any = null;
        let isActive = true;
        const connect = () => {
            if (!isActive) return;
            // Use a more standard channel name
            channel = supabase.channel(`home_sync_${currentBranchId}_${Date.now()}`);
            channel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, async (payload: any) => {
                    const newRow = payload.new as any;
                    const eventType = payload.eventType;

                    console.log('[HomeScreen] Real-time Sales Event Received:', {
                        event: eventType,
                        row_id: newRow?.id,
                        row_branch: newRow?.branch_id,
                        current_app_branch: currentBranchId
                    });

                    // Manual filter for branch_id (safer than Postgres filter string)
                    if (newRow && String(newRow.branch_id || '').trim() === String(currentBranchId || '').trim()) {
                        console.log(`[HomeScreen] Sales ${eventType} detected for branch ${currentBranchId}`);
                        
                        if (eventType === 'INSERT' || eventType === 'UPDATE') {
                            if (!isDisplayOnly && (newRow.status === 'Pending' || newRow.status === 'Unpaid')) {
                                console.log(`[HomeScreen] Auto-jumping to POS for ${eventType}:`, newRow.id);
                                // @ts-ignore
                                navigation.navigate('POS', { orderId: newRow.id });
                            }
                        }
                        debouncedFetchPending();
                    } else if (eventType === 'DELETE') {
                        // For deletes, we refresh the list just in case
                        debouncedFetchPending();
                    }
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
                        {offlineCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{offlineCount}</Text>
                            </View>
                        )}
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

                    {/* 8. Ringkasan Button (NEW) */}
                    {isSessionActive && (
                        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: '#ea580c15' }, isSmallDevice && { width: 42, height: 42 }]} onPress={handleViewCurrentSummary}>
                            <PieChart size={18} color="#ea580c" />
                        </TouchableOpacity>
                    )}

                    {/* 7. Logout Button */}
                    <TouchableOpacity style={[styles.logoutButton, { backgroundColor: '#ef444420' }, isSmallDevice && { width: 42, height: 42 }]} onPress={handleLogout}>
                        <Text style={[styles.logoutButtonIcon, isSmallDevice && { fontSize: 18 }]}>🔌</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {offlineCount > 0 && (
                <TouchableOpacity 
                    style={[styles.syncBanner, isSyncing && { opacity: 0.7 }]} 
                    onPress={handleSyncNow}
                    disabled={isSyncing}
                >
                    <RefreshCw size={14} color="white" style={isSyncing ? { transform: [{ rotate: '45deg' }] } : null} />
                    <Text style={styles.syncBannerText}>
                        {isSyncing ? 'Sedang Sinkronisasi...' : `Ada ${offlineCount} transaksi offline. Ketuk untuk Sinkronisasi.`}
                    </Text>
                </TouchableOpacity>
            )}

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

                    {/* Menu Utama / Produksi Section (NEW) */}
                    <View style={[styles.menuSection, isSmallDevice && { paddingHorizontal: 12, marginTop: 10 }]}>
                        <Text style={styles.sectionTitle}>Monitor Produksi</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity 
                                style={[styles.kdsButton, { backgroundColor: '#ea580c' }]} 
                                onPress={() => navigation.navigate('KDS' as never, { initialFilter: 'Kitchen' } as never)}
                            >
                                <Text style={styles.kdsIcon}>🍳</Text>
                                <View>
                                    <Text style={styles.kdsTitle}>Monitor Dapur</Text>
                                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Update pesanan makanan</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.kdsButton, { backgroundColor: '#3b82f6' }]} 
                                onPress={() => navigation.navigate('KDS' as never, { initialFilter: 'Bar' } as never)}
                            >
                                <Text style={styles.kdsIcon}>☕</Text>
                                <View>
                                    <Text style={styles.kdsTitle}>Monitor Bar</Text>
                                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Update pesanan minuman</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                    
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

                </ScrollView>
            </View>

            {/* Modals */}
            <ConfirmExitModal visible={showShiftWarningModal.visible} onClose={() => setShowShiftWarningModal({ visible: false, message: '' })} onConfirm={() => setShowShiftWarningModal({ visible: false, message: '' })} title="Gagal Keluar" message={showShiftWarningModal.message} confirmText="Mengerti" iconType="alert" showCancel={false} />
            <ConfirmExitModal visible={showExitModal} onClose={() => setShowExitModal(false)} onConfirm={() => BackHandler.exitApp()} title="Konfirmasi Keluar" message="Keluar aplikasi?" confirmText="Keluar" iconType="alert" />
            <ConfirmExitModal visible={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={onConfirmDelete} title="Hapus Pesanan?" message="Data akan dihapus permanen" confirmText="Hapus" cancelText="Batal" iconType="trash" />
            <ConfirmExitModal visible={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={confirmLogout} title="Logout" message="Keluar ke login?" confirmText="Keluar" iconType="logout" />
            <CashierSessionModal visible={showSessionModal} onClose={() => setShowSessionModal(false)} mode={sessionMode} session={currentSession} onComplete={checkSession} currentBranchId={currentBranchId} />
            <ModernToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
            <SalesReportModal visible={showSalesReport} onClose={() => setShowSalesReport(false)} currentBranchId={currentBranchId} branchName={branchName} userName={userName} storeSettings={storeSettings} />
            
            <CashierClosingSummaryModal 
                visible={showCurrentSummary}
                onClose={() => setShowCurrentSummary(false)}
                data={summaryData}
                loading={summaryLoading}
                onPrint={handlePrintSummary}
                title="Ringkasan Shift Aktif"
            />
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
    badge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: 'white'
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold'
    },
    syncBanner: {
        backgroundColor: '#f59e0b',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        borderRadius: 12,
        marginTop: 16,
        gap: 8
    },
    syncBannerText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12
    }
});
