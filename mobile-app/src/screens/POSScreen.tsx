import * as React from 'react';
import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Image, Modal, Alert, StyleSheet, useWindowDimensions, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PaymentModal from '../components/PaymentModal';
import { PrinterManager } from '../lib/PrinterManager';
import ManualItemModal from '../components/ManualItemModal';
import DiscountModal from '../components/DiscountModal';
import SplitBillModal from '../components/SplitBillModal';
import HeldOrdersModal from '../components/HeldOrdersModal';
import { useSession } from '../context/SessionContext';
import { OfflineService } from '../lib/OfflineService';
import { WifiVoucherService } from '../lib/WifiVoucherService';
import { Wifi, WifiOff, Star, ShoppingCart, Printer, ChevronLeft } from 'lucide-react-native';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import HoldNoteModal from '../components/HoldNoteModal';
import ModernToast from '../components/ModernToast';

const getAcronym = (name: string) => {
    return name?.substring(0, 2).toUpperCase() || '??';
};

const ProductCard = memo(({ item, isTablet, onAdd, formatCurrency }: any) => {
    return (
        <TouchableOpacity
            style={[
                styles.productCard,
                { width: '100%', margin: 0, borderRadius: isTablet ? 12 : 8, overflow: 'hidden', backgroundColor: '#f3f4f6', height: isTablet ? 150 : 90 }
            ]}
            onPress={() => onAdd(item)}
        >
            <View style={{ width: '100%', height: '100%', position: 'absolute' }}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff7ed' }}>
                        <Text style={[styles.productAcronym, { fontSize: isTablet ? 24 : 13 }]}>
                            {getAcronym(item.name)}
                        </Text>
                    </View>
                )}
            </View>

            <View style={{ 
                position: 'absolute', 
                bottom: 0, 
                width: '100%', 
                backgroundColor: 'rgba(0, 0, 0, 0.6)', 
                paddingVertical: isTablet ? 6 : 4,
                paddingHorizontal: 4,
                alignItems: 'center'
            }}>
                <Text style={{ 
                    fontSize: isTablet ? 12 : 9, 
                    color: 'white', 
                    textAlign: 'center', 
                    fontWeight: '600' 
                }} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={{ 
                    fontSize: isTablet ? 11 : 8.5, 
                    color: '#fdba74', 
                    fontWeight: 'bold',
                    marginTop: 1
                }}>
                    {formatCurrency(item.price)}
                </Text>
            </View>

        </TouchableOpacity>
    );
});


export default function POSScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { tableNumber, tableNo, waiterName: initialWaiter } = route.params || {};
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const isTablet = Math.min(width, height) >= 600;
    const isLargeTablet = Math.min(width, height) >= 800;
    const isSmallDevice = width < 480;
    const splitProductColumns = isLargeTablet ? 4 : 3;


    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const [categories, setCategories] = useState<string[]>(['Semua']);
    const [topSellingProducts, setTopSellingProducts] = useState<string[]>([]);

    // Master Data
    const [customers, setCustomers] = useState<any[]>([]);
    const [waiters, setWaiters] = useState<any[]>([]);

    // UI State
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successModalConfig, setSuccessModalConfig] = useState({ title: 'Pesanan Terkirim!', message: 'Pesanan Anda telah masuk ke sistem kasir.' });
    const [lastOrderNo, setLastOrderNo] = useState('');
    const [lastSaleId, setLastSaleId] = useState('');
    const [showCartModal, setShowCartModal] = useState(false);
    // const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [currentSaleId, setCurrentSaleId] = useState<number | null>(null);
    const [isOnline, setIsOnline] = useState(true);
    const [isManualOffline, setIsManualOffline] = useState(false);
    const [showMemberLoginModal, setShowMemberLoginModal] = useState(false);
    const [countdown, setCountdown] = useState(5);

    const [memberPhone, setMemberPhone] = useState('');
    const [paymentMethods, setPaymentMethods] = useState<any[]>([
        { id: 'cash', name: 'Tunai', type: 'cash' },
        { id: 'qris', name: 'QRIS', type: 'digital' },
        { id: 'debit', name: 'Debit', type: 'card' }
    ]);

    // Transaction Data
    const [cart, setCart] = useState<any[]>([]);
    const [initialItems, setInitialItems] = useState<any[]>([]); // [NEW] For Smart Printing
    const [selectedTable, setSelectedTable] = useState('-');
    const [orderType, setOrderType] = useState<'dine_in' | 'take_away'>(
        (tableNo && tableNo !== '-' && tableNo !== 'TAKEAWAY') ? 'dine_in' : 'take_away'
    );
    const [customerName, setCustomerName] = useState('Guest');
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [selectedWaiter, setSelectedWaiter] = useState(initialWaiter || '');
    const [posFlow, setPosFlow] = useState<'direct'>('direct');
    const [cashierMode, setCashierMode] = useState(true); // Default to true
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [existingSaleId, setExistingSaleId] = useState<number | string | null>(null);

    // New POS Features State
    const [showManualItemModal, setShowManualItemModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [showSplitBillModal, setShowSplitBillModal] = useState(false);
    const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);
    const [orderDiscount, setOrderDiscount] = useState(0);
    const [discountReason, setDiscountReason] = useState('');
    const [heldOrders, setHeldOrders] = useState<any[]>([]);
    const [showHoldNoteModal, setShowHoldNoteModal] = useState(false);
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [splitItemsToPay, setSplitItemsToPay] = useState<any[]>([]);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [showTableManualModal, setShowTableManualModal] = useState(false);
    const [showWaiterModal, setShowWaiterModal] = useState(false);
    const [waiterSearchQuery, setWaiterSearchQuery] = useState('');
    const [manualTableInput, setManualTableInput] = useState('');
    const [previewOrderData, setPreviewOrderData] = useState<any>(null);
    const [isPrinterReady, setIsPrinterReady] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [receiptPrintMode, setReceiptPrintMode] = useState<'auto' | 'manual'>('manual');
    const [isPartialSplit, setIsPartialSplit] = useState(false);
    const [remoteOrders, setRemoteOrders] = useState<any[]>([]);
    const [isFetchingRemote, setIsFetchingRemote] = useState(false);
    const lastFetchTime = React.useRef(0);
    const fetchInProgress = React.useRef(false);
    const fetchTimeoutRef = React.useRef<any>(null);
    const isFirstRender = React.useRef(true);

    // Toast State
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');

    const uniqueOrders = useMemo(() => {
        const orderMap = new Map();
        // Process local drafts first
        heldOrders.forEach(o => orderMap.set(String(o.id), o));
        // Process remote orders (overwrite if same ID exists, preferring server state)
        remoteOrders.forEach(o => orderMap.set(String(o.id), o));
        
        return Array.from(orderMap.values()).sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [heldOrders, remoteOrders]);

    const pendingCount = uniqueOrders.length;

    const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);
    };

    const renderSplitCartActions = () => (
        <View style={{ marginBottom: 10 }}>
            <View style={[styles.quickActionsRow]}>
                <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => setShowManualItemModal(true)}
                >
                    <Text style={styles.quickActionIcon}>+</Text>
                    <Text style={styles.quickActionText}>Manual</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => setShowDiscountModal(true)}
                >
                    <Text style={styles.quickActionIcon}>%</Text>
                    <Text style={styles.quickActionText}>Diskon</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowSplitBillModal(true)}>
                    <Text style={styles.quickActionIcon}>/</Text>
                    <Text style={styles.quickActionText}>Pisah</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => setShowHoldNoteModal(true)}
                >
                    <Text style={styles.quickActionIcon}>||</Text>
                    <Text style={styles.quickActionText}>Hold</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowHeldOrdersModal(true)}>
                    <View>
                        <Text style={styles.quickActionIcon}>#</Text>
                        {pendingCount > 0 && (
                            <View style={[styles.badgeContainer, { top: -6, right: -10, minWidth: 14, height: 14 }]}>
                                <Text style={[styles.badgeText, { fontSize: 8 }]}>{pendingCount}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.quickActionText}>Daftar</Text>
                </TouchableOpacity>
            </View>
        </View>
);

    const renderSplitCartMeta = () => (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
                <Text style={styles.cartSplitFieldLabel}>{orderType === 'take_away' ? 'ORDER' : 'MEJA'}</Text>
                <View style={styles.cartSplitFieldBox}>
                    <TextInput
                        style={styles.cartSplitFieldInput}
                        value={orderType === 'take_away' ? takeAwayLabel : (selectedTable === '-' ? '' : selectedTable)}
                        onChangeText={(text) => {
                            if (orderType === 'take_away') return;
                            setSelectedTable(text || '-');
                        }}
                        autoCapitalize="characters"
                        placeholder={orderType === 'take_away' ? takeAwayLabel : 'Nomor meja'}
                        placeholderTextColor="#94a3b8"
                        editable={orderType !== 'take_away'}
                    />
                </View>
            </View>
            <TouchableOpacity style={{ flex: 1.4 }} onPress={() => setShowWaiterModal(true)}>
                <Text style={styles.cartSplitFieldLabel}>KASIR</Text>
                <View style={[styles.cartSplitFieldBox, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <Text numberOfLines={1} style={{ flex: 1, color: selectedWaiter ? '#111827' : '#94a3b8', fontSize: 13, fontWeight: '600' }}>
                        {selectedWaiter || 'Pilih kasir'}
                    </Text>
                    <Text style={{ color: '#94a3b8', marginLeft: 8 }}>v</Text>
                </View>
            </TouchableOpacity>
        </View>
    );

    useEffect(() => {
        if (isSideBySide && showCartModal) {
            setShowCartModal(false);
        }
    }, [isSideBySide, showCartModal]);

    useEffect(() => {
        if (orderType === 'take_away') {
            setSelectedTable('TAKEAWAY');
        } else if (selectedTable === 'TAKEAWAY') {
            setSelectedTable('-');
        }
    }, [orderType]);

    useEffect(() => {
        const normalizedTable = String(selectedTable || '').trim().toUpperCase();
        if (!normalizedTable || normalizedTable === '-') return;

        if (normalizedTable === 'TAKEAWAY') {
            setOrderType(prev => prev === 'take_away' ? prev : 'take_away');
            return;
        }

        setOrderType(prev => prev === 'dine_in' ? prev : 'dine_in');
    }, [selectedTable]);

    // Update cashier mode from storage but default to true if not set

    // Load POS Flow Setting
    useEffect(() => {
        const loadPOSFlow = async () => {
            const [savedFlow, savedCashierMode, savedReceiptPrintMode, savedAutoPrint] = await Promise.all([
                AsyncStorage.getItem('pos_flow'),
                AsyncStorage.getItem('cashier_mode'),
                AsyncStorage.getItem('post_payment_receipt_mode'),
                AsyncStorage.getItem('auto_print')
            ]);
            if (savedFlow) {
                setPosFlow('direct');
            }

            if (savedCashierMode !== null) {
                setCashierMode(savedCashierMode === 'true');
            } else {
                setCashierMode(true); // Ensure default true
            }

            if (savedReceiptPrintMode === 'auto' || savedReceiptPrintMode === 'manual') {
                setReceiptPrintMode(savedReceiptPrintMode);
            } else {
                setReceiptPrintMode(savedAutoPrint === 'true' ? 'auto' : 'manual');
            }
        };
        loadPOSFlow();
    }, []);

    const { permissions, isDisplayOnly, loading: sessionLoading, isSessionActive, currentSession, branchName, branchAddress, branchPhone, isAdmin, storeSettings, currentBranchId, userName } = useSession();
    const orderCategoriesEnabled = storeSettings?.enable_order_type_categories !== false;
    const dineInLabel = storeSettings?.order_type_dine_in_label?.trim() || 'Dine In';
    const takeAwayLabel = storeSettings?.order_type_take_away_label?.trim() || 'Take Away';
    const defaultOrderType = orderCategoriesEnabled && storeSettings?.default_order_type === 'take_away'
        ? 'take_away'
        : 'dine_in';
    const hasInitializedOrderType = React.useRef(false);

    useEffect(() => {
        if (hasInitializedOrderType.current) return;

        const tableBasedType = (tableNo && tableNo !== '-' && tableNo !== 'TAKEAWAY')
            ? 'dine_in'
            : undefined;

        setOrderType(tableBasedType || defaultOrderType);
        hasInitializedOrderType.current = true;
    }, [defaultOrderType, tableNo]);

    // Force Display Mode (Order Only) if user has the permission or role
    useEffect(() => {
        if (isDisplayOnly) {
            console.log('[POSScreen] isDisplayOnly detected. Forcing cashierMode=false');
            setCashierMode(false);
        } else {
            // Re-check from storage if NOT display (might have been toggled)
            AsyncStorage.getItem('cashier_mode').then(val => {
                if (val !== null) setCashierMode(val === 'true');
            });
        }
    }, [isDisplayOnly]);

    // [NEW] Set default waiter from logged in user if not provided by route
    useEffect(() => {
        if (!selectedWaiter && userName && userName !== 'User') {
            console.log('[POSScreen] Setting default waiter from session:', userName);
            setSelectedWaiter(userName);
        }
    }, [userName]);

    const isActuallyDisplay = useMemo(() => {
        return isDisplayOnly; // Session context version is usually sufficient
    }, [isDisplayOnly]);
    const isSideBySide = !isActuallyDisplay;
    const productGridColumns = isActuallyDisplay
        ? (isLargeTablet ? 5 : (isTablet ? 4 : (isSmallDevice ? 3 : 4)))
        : (isSideBySide ? splitProductColumns : (isSmallDevice ? 3 : 4));

    useEffect(() => {
        if (!isActuallyDisplay) return;

        setOrderType('take_away');
        setSelectedTable('TAKEAWAY');
        setCustomerName('Guest');
        setSelectedCustomerId(null);
        setSelectedCategory('Semua');
        setShowMemberLoginModal(false);
        setShowHeldOrdersModal(false);
        setShowCartModal(false);
    }, [isActuallyDisplay]);

    // Countdown effect for success screen
    useEffect(() => {
        let timer: any;
        if (showSuccessModal) {
            // [UPDATED] If it's a partial split, we don't auto-navigate
            // If it's final, we give 20 seconds. 
            // BUT if it's display mode, we give only 2 seconds for fast reset.
            const timeout = isActuallyDisplay ? 2 : 20;
            setCountdown(isPartialSplit ? 999 : timeout); 
            
            timer = setInterval(() => {
                setCountdown((prev) => {
                    // [UPDATED] Pause countdown if printing or if it's a partial split
                    if (isPrinting || isPartialSplit) return prev;
                    return prev > 0 ? prev - 1 : 0;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [showSuccessModal, isPartialSplit, isPrinting]);

    // Navigate when countdown reaches zero
    useEffect(() => {
        if (showSuccessModal && !isPartialSplit && countdown === 0) {
            setShowSuccessModal(false);
            if (!isActuallyDisplay) {
                // @ts-ignore
                navigation.navigate('Main');
            }
        }
    }, [countdown, showSuccessModal, isPartialSplit, navigation]);




    const handlePrintReceipt = async (saleIdOverride?: string | number | null, orderNoOverride?: string | null) => {
        const identifier = saleIdOverride
            ? String(saleIdOverride)
            : orderNoOverride || lastSaleId || lastOrderNo;

        if (!identifier) return;
        
        setIsPrinting(true);
        try {
            const orderData = await fetchOrderDataForReceipt(identifier);
            if (!orderData) throw new Error('Order not found');

            const success = await PrinterManager.printOrderReceipt(orderData);

            if (success) {
                showToast('Struk sedang dicetak', 'success');
            } else {
                Alert.alert('Gagal', 'Gagal mencetak struk kasir. Pastikan printer terhubung.');
            }
        } catch (e) {
            console.error('Print Error:', e);
            Alert.alert('Error', 'Terjadi kesalahan saat mencetak');
        } finally {
            setIsPrinting(false);
        }
    };

    const maybeAutoPrintReceipt = (saleId?: string | number | null, orderNo?: string | null) => {
        if (receiptPrintMode !== 'auto' || isDisplayOnly) return;

        handlePrintReceipt(saleId, orderNo).catch((err) => {
            console.error('[POSScreen] Auto print receipt error:', err);
        });
    };

    const handleReconnectPrinters = async () => {
        setToastMessage('Menghubungkan ke semua printer...');
        setToastType('info');
        setToastVisible(true);
        
        try {
            const { results, success } = await PrinterManager.reconnectAllConfiguredPrinters();
            const details = Object.entries(results)
                .map(([label, ok]) => `${label}: ${ok ? '✅' : '❌'}`)
                .join(', ');
            
            setToastMessage(success ? 'Semua printer terhubung!' : `Beberapa printer gagal: ${details}`);
            setToastType(success ? 'success' : 'error');
            setToastVisible(true);
            
            // Re-check status
            const [receiptMac, kitchenMac, barMac] = await Promise.all([
                AsyncStorage.getItem('@selected_printer_address'),
                AsyncStorage.getItem('@kitchen_printer_address'),
                AsyncStorage.getItem('@bar_printer_address')
            ]);
            setIsPrinterReady(!!receiptMac || !!kitchenMac || !!barMac);
        } catch (error) {
            setToastMessage('Gagal menghubungi printer');
            setToastType('error');
            setToastVisible(true);
        }
    };

    const handleRefreshConnectivity = async () => {
        const forced = await OfflineService.getForcedOfflineMode();
        
        if (forced) {
            Alert.alert(
                'Mode Manual Offline',
                'Anda sedang dalam mode Manual Offline. Ingin kembali ke mode Online?',
                [
                    { text: 'Batal', style: 'cancel' },
                    { 
                        text: 'Ya, Kembali Online', 
                        onPress: async () => {
                            await OfflineService.setForcedOfflineMode(false);
                            setIsManualOffline(false);
                            const online = await OfflineService.checkConnectivity();
                            setIsOnline(online);
                            setToastMessage(online ? 'Kembali Online' : 'Offline (Cek Koneksi)');
                            setToastType(online ? 'success' : 'error');
                            setToastVisible(true);
                        }
                    }
                ]
            );
        } else {
            Alert.alert(
                'Masuk Mode Offline?',
                'Gunakan mode ini jika koneksi internet tidak stabil. Data akan disimpan di memori lokal.',
                [
                    { text: 'Batal', style: 'cancel' },
                    { 
                        text: 'Ya, Masuk Offline', 
                        onPress: async () => {
                            await OfflineService.setForcedOfflineMode(true);
                            setIsManualOffline(true);
                            setIsOnline(false);
                            setToastMessage('Mode Manual Offline Aktif');
                            setToastType('warning');
                            setToastVisible(true);
                        }
                    }
                ]
            );
        }
    };
    const handlePreviewReceipt = async () => {
        if (!lastSaleId && !lastOrderNo) return;
        
        try {
            const orderData = await fetchOrderDataForReceipt(lastSaleId || lastOrderNo);
            if (orderData) {
                setPreviewOrderData(orderData);
                setShowReceiptPreview(true);
            }
        } catch (e) {
            Alert.alert('Error', 'Gagal memuat pratinjau struk');
        }
    };

    const fetchOrderDataForReceipt = async (identifier: string) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
        const isNumeric = /^\d+$/.test(identifier);
        
        const query = supabase
            .from('sales')
            .select(`
                *,
                sale_items (
                    *,
                    product:product_id (name, category, is_taxed)
                )
            `);

        if (isUuid || isNumeric) {
            query.eq('id', identifier);
        } else {
            query.eq('order_no', identifier).order('created_at', { ascending: false }).limit(1);
        }

        const { data: sale, error } = await query.single();

        if (error) {
            // PGRST116 with 0 rows: try looking in OfflineService if it's an order_no search
            if (!isUuid) {
                const offlineSale = await OfflineService.getSaleByOrderNo(identifier);
                if (offlineSale) {
                    // Map OfflineSale to the expected format
                    return {
                        ...offlineSale,
                        sale_items: offlineSale.items.map(item => ({
                            ...item,
                            product: { name: item.name } // Minimal product info suffices for receipt
                        }))
                    };
                }
            }
            throw error;
        }

        // Fetch customer tier separately to avoid join errors if FK not defined
        let customerTier = 'Regular';
        if (sale.customer_id) {
            const { data: contact } = await supabase
                .from('contacts')
                .select('tier')
                .eq('id', sale.customer_id)
                .single();
            if (contact) {
                customerTier = contact.tier || 'Regular';
            }
        }

        // WiFi Voucher Fetching
        let wifiVoucher = null;
        if (storeSettings?.enable_wifi_vouchers) {
            const minAmount = Number(storeSettings?.wifi_voucher_min_amount) || 0;
            const multiplier = Number(storeSettings?.wifi_voucher_multiplier) || 0;
            const totalAmount = Number(sale.total_amount) || 0;
            
            if (totalAmount >= minAmount) {
                try {
                    let count = 1;

                    if (multiplier > 0) {
                        count = Math.floor(totalAmount / multiplier);
                    }

                    console.log(`[POSScreen] WiFi Voucher Logic: total=${totalAmount}, min=${minAmount}, mult=${multiplier}, count=${count}`);

                    if (count > 0) {
                        wifiVoucher = await WifiVoucherService.getVoucherForSale(sale.id, currentBranchId || '1', count);
                        if (wifiVoucher) {
                            console.log('[POSScreen] WiFi Vouchers result:', wifiVoucher);
                        } else {
                            console.warn('[POSScreen] WiFi Voucher fetch returned null/empty.');
                        }
                    }

                } catch (e) {
                    console.error('[POSScreen] Failed to fetch WiFi voucher:', e);
                }
            }
        }
        return {
            order_no: sale.order_no,
            table_no: sale.table_no,
            customer_name: sale.customer_name,
            customer_level: customerTier,
            enable_order_type_categories: storeSettings?.enable_order_type_categories,
            order_type_dine_in_label: storeSettings?.order_type_dine_in_label,
            order_type_take_away_label: storeSettings?.order_type_take_away_label,
            cashier_name: (!isDisplayOnly && userName && userName !== 'User') ? userName : '-',
            waiter_name: sale.waiter_name || '-',
            total: sale.total_amount,
            discount: sale.discount || 0,
            tax: sale.tax || 0,
            service_charge: sale.service_charge || 0,
            tax_rate: storeSettings?.tax_rate || 0,
            service_rate: storeSettings?.service_rate || 0,
            receipt_header: storeSettings?.receipt_header,
            receipt_footer: storeSettings?.receipt_footer,
            receipt_paper_width: storeSettings?.receipt_paper_width,
            receipt_logo_url: storeSettings?.receipt_logo_url,
            shop_address: storeSettings?.address,
            show_logo: storeSettings?.show_logo,
            show_date: storeSettings?.show_date,
            show_cashier_name: storeSettings?.show_cashier_name ?? true,
            show_waiter: storeSettings?.show_waiter,
            show_table: storeSettings?.show_table,
            show_customer_name: storeSettings?.show_customer_name,
            enable_wifi_vouchers: storeSettings?.enable_wifi_vouchers,
            wifi_voucher_min_amount: storeSettings?.wifi_voucher_min_amount,
            wifi_voucher_multiplier: storeSettings?.wifi_voucher_multiplier,
            wifi_voucher: wifiVoucher,
            wifi_voucher_notice: storeSettings?.wifi_voucher_notice,
            payment_method: sale.payment_method,
            paid_amount: sale.paid_amount,
            change: sale.change,
            created_at: sale.date,
            shop_name: branchName,
            shop_phone: branchPhone,
            items: sale.sale_items.map((si: any) => ({
                name: si.product ? si.product.name : si.product_name,
                price: si.price,
                quantity: si.quantity,
                target: si.target || 'Kitchen',
                category: si.product?.category || '',
                is_taxed: si.is_taxed || false,
                notes: si.notes
            }))
        };
    };

    useEffect(() => {
        let isMounted = true;

        const loadInitialData = async () => {
            console.log('[POSScreen] Loading initial data...');
            try {
                // 1. Load from Cache for Instant Display
                const [cachedProducts, cachedCategories, cachedPMs] = await Promise.all([
                    AsyncStorage.getItem(`cached_products_${currentBranchId}`),
                    AsyncStorage.getItem(`cached_categories_${currentBranchId}`),
                    AsyncStorage.getItem('cached_payment_methods')
                ]);
                
                if (isMounted) {
                    if (cachedProducts) {
                        console.log('[POSScreen] Using cached products for instant display');
                        setProducts(JSON.parse(cachedProducts));
                        setLoadingProducts(false); // Hide loader early if cache exists
                    }
                    if (cachedCategories) {
                        const parsed = JSON.parse(cachedCategories);
                        // Merge with hardcoded ones to ensure they are always present
                        const merged = [
                            'Semua', 
                            ...parsed.filter((c: string) => ![ 'Semua'].includes(c))
                        ];
                        setCategories(merged);
                    }
                    if (cachedPMs) {
                        setPaymentMethods(JSON.parse(cachedPMs));
                    }
                }

                // 2. Fresh Data from Supabase
                await Promise.all([
                    fetchProducts(),
                    fetchTopSellingProducts(),
                    fetchCategories(),
                    fetchMasterData()
                ]);

                // 4. Load Drafts and Held Orders
                const [savedHeldStr, savedCart, savedCustName, savedCustId, savedTable, savedDiscount, savedWaiter, savedExistingId, savedCustomers] = await Promise.all([
                    AsyncStorage.getItem('pos_held_orders'),
                    AsyncStorage.getItem('pos_cart_draft'),
                    AsyncStorage.getItem('pos_customer_draft_name'),
                    AsyncStorage.getItem('pos_customer_draft_id'),
                    AsyncStorage.getItem('pos_table_draft'),
                    AsyncStorage.getItem('pos_discount_draft'),
                    AsyncStorage.getItem('pos_waiter_draft'),
                    AsyncStorage.getItem('pos_existing_sale_id_draft'),
                    AsyncStorage.getItem('cached_customers')
                ]);

                if (isMounted) {
                    if (savedHeldStr) {
                        try {
                            const parsedHeld = JSON.parse(savedHeldStr);
                            setHeldOrders(parsedHeld.map((h: any) => ({ 
                                ...h, 
                                createdAt: h.createdAt ? new Date(h.createdAt) : new Date() 
                            })));
                        } catch (e) { console.error('Error parsing held orders:', e); }
                    }

                    if (savedCustomers && customers.length === 0) {
                        setCustomers(JSON.parse(savedCustomers));
                    }

                    if (route.params?.orderId) {
                        await loadOrderById(route.params.orderId);
                    } else {
                        if (savedCart) setCart(JSON.parse(savedCart));
                        if (savedCustName) setCustomerName(savedCustName);
                        if (savedCustId) setSelectedCustomerId(savedCustId === 'null' ? null : parseInt(savedCustId));
                        if (savedTable) setSelectedTable(savedTable);
                        if (savedDiscount) setOrderDiscount(parseFloat(savedDiscount) || 0);
                        if (savedWaiter) setSelectedWaiter(savedWaiter || '');
                        if (savedExistingId) setExistingSaleId(savedExistingId === 'null' ? null : parseInt(savedExistingId));
                    }
                }
            } catch (err) {
                console.error('[POSScreen] Load Error:', err);
            } finally {
                isFirstRender.current = false;
                if (isMounted) setLoadingProducts(false);
            }
        };

        loadInitialData();

        const checkConn = async () => {
            const forced = await OfflineService.getForcedOfflineMode();
            setIsManualOffline(forced);
            
            if (forced) {
                setIsOnline(false);
            } else {
                const online = await OfflineService.checkConnectivity();
                setIsOnline(online);
            }

            // Check Printer Status (Receipt, Kitchen, Bar)
            const [receiptMac, kitchenMac, barMac] = await Promise.all([
                AsyncStorage.getItem('@selected_printer_address'),
                AsyncStorage.getItem('@kitchen_printer_address'),
                AsyncStorage.getItem('@bar_printer_address')
            ]);
            setIsPrinterReady(!!receiptMac || !!kitchenMac || !!barMac);
        };
        checkConn();
        const connInterval = setInterval(checkConn, 15000);

        const timer = setTimeout(() => {
            if (isMounted) setLoadingProducts(false);
        }, 5000);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            clearInterval(connInterval);
        };
    }, [currentBranchId, route.params?.orderId]);

    const fetchRemotePendingOrders = async (force: boolean = false) => {
        if (!currentBranchId || isDisplayOnly || (fetchInProgress.current && !force)) return;
        
        try {
            fetchInProgress.current = true;
            setIsFetchingRemote(true);
            const branchIdToUse = typeof currentBranchId === 'string' ? parseInt(currentBranchId) : currentBranchId;
            console.log(`[POSScreen] Fetching pending orders for Branch ID: ${branchIdToUse}`);
            
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .eq('branch_id', branchIdToUse)
                .in('status', ['Pending', 'Unpaid'])
                .order('date', { ascending: false })
                .limit(50);

            if (error) throw error;
            
            console.log(`[POSScreen] Found ${data?.length || 0} remote pending orders`);
            
            const mappedOrders = (data || []).map((sale: any) => ({
                id: String(sale.id),
                orderNo: sale.order_no,
                items: [], 
                discount: sale.discount || 0,
                total: sale.total_amount || 0,
                createdAt: new Date(sale.date || sale.created_at),
                tableNo: sale.table_no || '-',
                note: sale.notes || '',
                isRemote: true
            }));
            
            setRemoteOrders(mappedOrders);
            lastFetchTime.current = Date.now();
        } catch (err) {
            console.error('[POSScreen] Fetch Remote Orders Error:', err);
        } finally {
            setIsFetchingRemote(false);
            fetchInProgress.current = false;
        }
    };

    useEffect(() => {
        if (!currentBranchId || isDisplayOnly) return;
        const branchIdInt = currentBranchId;
        fetchRemotePendingOrders();

        const salesChannel = supabase
            .channel(`pos_realtime_${currentBranchId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sales', filter: `branch_id=eq.${branchIdInt}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newOrder = payload.new as any;
                        if (newOrder.status === 'Pending' || newOrder.status === 'Unpaid') {
                            showToast(`Pesanan Baru: ${newOrder.order_no || newOrder.id} (Meja: ${newOrder.table_no || '-'})`, 'info');
                        }
                    }
                    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
                    fetchTimeoutRef.current = setTimeout(() => {
                        fetchRemotePendingOrders(true);
                    }, 500);
                }
            )
            .subscribe();

        return () => {
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
            supabase.removeChannel(salesChannel);
        };
    }, [currentBranchId, isDisplayOnly]);
 

    const loadOrderById = async (saleId: number) => {
        try {
            console.log('POSScreen: Loading order by ID:', saleId);
            const { data: sale, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    sale_items (
                        *,
                        product:product_id (*)
                    )
                `)
                .eq('id', saleId)
                .single();

            if (sale) {
                setExistingSaleId(sale.id);
                setCustomerName(sale.customer_name || 'Guest');
                setSelectedCustomerId(sale.customer_id);
                setSelectedWaiter(sale.waiter_name || '');
                setSelectedTable(sale.table_no || '-');
                
                const items = sale.sale_items.map((si: any) => ({
                    ...si.product,
                    id: si.product_id,
                    name: si.product_name || si.product?.name,
                    price: si.price,
                    quantity: si.quantity,
                    target: si.target,
                    notes: si.notes || ''
                }));
                setCart(items);
                setInitialItems(items); // [NEW] Set initial for smart printing
                
                if (cashierMode && !isDisplayOnly) {
                    setTimeout(() => {
                        setShowCartModal(true);
                    }, 500);
                }
            }
        } catch (error) {
            console.error('Error loading order by ID:', error);
        }
    };

    const fetchMasterData = async () => {
        try {
            const authorizedRoles = ['Manager', 'Manajer', 'Owner', 'Administrator', 'Admin', 'Supervisor'];
            const [custRes, pmRes, managerRes, allEmpRes] = await Promise.all([
                supabase.from('customers').select('id, name, phone').limit(50),
                supabase.from('payment_methods').select('*').eq('is_active', true),
                supabase.from('employees')
                    .select('name, pin, position, system_role')
                    .not('pin', 'is', null)
                    .or(`position.in.(${authorizedRoles.join(',')}),system_role.in.(${authorizedRoles.join(',')})`),
                supabase.from('employees')
                    .select('id, name, position')
                    .eq('branch_id', currentBranchId)
                    .order('name', { ascending: true })
            ]);
            
            if (!allEmpRes.error && allEmpRes.data) setWaiters(allEmpRes.data);
            if (!custRes.error && custRes.data) {
                setCustomers(custRes.data);
                AsyncStorage.setItem('cached_customers', JSON.stringify(custRes.data));
            }
            if (!pmRes.error && pmRes.data) {
                setPaymentMethods(pmRes.data);
                AsyncStorage.setItem('cached_payment_methods', JSON.stringify(pmRes.data));
            }
            if (!managerRes.error && managerRes.data) {
                AsyncStorage.setItem('cached_manager_pins', JSON.stringify(managerRes.data));
            }
        } catch (error) {
            console.error('Error fetching master data:', error);
        }
    };

    // Persistence: Active Cart Draft
    useEffect(() => {
        if (!isFirstRender.current) {
            const saveDraft = async () => {
                try {
                    await Promise.all([
                        AsyncStorage.setItem('pos_cart_draft', JSON.stringify(cart)),
                        AsyncStorage.setItem('pos_customer_draft_name', customerName),
                        AsyncStorage.setItem('pos_customer_draft_id', String(selectedCustomerId)),
                        AsyncStorage.setItem('pos_table_draft', selectedTable),
                        AsyncStorage.setItem('pos_discount_draft', String(orderDiscount)),
                        AsyncStorage.setItem('pos_waiter_draft', selectedWaiter),
                        AsyncStorage.setItem('pos_existing_sale_id_draft', String(existingSaleId))
                    ]);
                } catch (e) {
                    console.error('Failed to save POS draft:', e);
                }
            };
            saveDraft();
        }
    }, [cart, customerName, selectedCustomerId, selectedTable, orderDiscount, selectedWaiter, existingSaleId]);

    // Persistence: Held Orders
    useEffect(() => {
        if (!isFirstRender.current) {
            AsyncStorage.setItem('pos_held_orders', JSON.stringify(heldOrders));
        }
    }, [heldOrders]);

    // Refresh remote orders when modal opens
    useEffect(() => {
        if (showHeldOrdersModal) {
            fetchRemotePendingOrders(true);
        }
    }, [showHeldOrdersModal]);


    const fetchTopSellingProducts = async () => {
        if (!currentBranchId) return;
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data, error } = await supabase
                .from('sale_items')
                .select('product_name, quantity, sale:sales!inner(date, branch_id)')
                .eq('sale.branch_id', currentBranchId)
                .gte('sale.date', thirtyDaysAgo.toISOString());

            if (error) throw error;

            const counts: Record<string, number> = {};
            (data || []).forEach(item => {
                const name = item.product_name;
                if (name) counts[name] = (counts[name] || 0) + (Number(item.quantity) || 1);
            });

            const sorted = Object.entries(counts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 50)
                .map(([name]) => name);

            setTopSellingProducts(sorted);
        } catch (err) {
            console.error('[POSScreen] Error fetching top selling:', err);
        }
    };

    const fetchCategories = async () => {
        if (!currentBranchId || isNaN(Number(currentBranchId))) return;
        try {
            const { data, error } = await supabase.from('categories').select('name').order('sort_order');
            if (error) throw error;
            if (data) {
                const uniqueSet = new Set<string>();
                data.forEach(c => {
                    if (c && c.name) {
                        const cleanName = c.name.toString().trim();
                        if (cleanName.length > 0 && cleanName.toLowerCase() !== 'semua') uniqueSet.add(cleanName);
                    }
                });
                const uniqueCategories = ['Semua', ...Array.from(uniqueSet)];
                setCategories(uniqueCategories);
                AsyncStorage.setItem(`cached_categories_${currentBranchId}`, JSON.stringify(uniqueCategories));
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchProducts = async () => {
        if (!currentBranchId || isNaN(Number(currentBranchId))) return;
        setLoadingProducts(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, price, image_url, category, target, stock, is_taxed, branch_id, sort_order, is_sellable, is_stock_ready')
                .or(`branch_id.eq.${currentBranchId},branch_id.is.null`)
                .order('sort_order', { ascending: true });
            if (error) throw error;
            if (data) {
                setProducts(data);
                AsyncStorage.setItem(`cached_products_${currentBranchId}`, JSON.stringify(data));
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoadingProducts(false);
        }
    };

    const filteredProducts = useMemo(() => {
        let result = products.filter(p => p.is_sellable !== false && p.is_stock_ready !== false);
        if (selectedCategory !== 'Semua') {
            const lowerSelected = selectedCategory.toLowerCase();
            result = result.filter(p => (p.category || '').toLowerCase() === lowerSelected);
        }
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(lowerQuery));
        }
        return result.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }, [products, searchQuery, selectedCategory]);

    const formatCurrency = useCallback((value: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    }, []);

    const checkMember = async () => {
        if (!memberPhone.trim()) { Alert.alert('Info', 'Masukkan nomor HP'); return; }
        try {
            const { data: exactData } = await supabase.from('customers').select('*').eq('phone', memberPhone).maybeSingle();
            if (!exactData) {
                Alert.alert('Gagal', 'Member tidak ditemukan. Lanjut sebagai tamu?', [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Ya, Tamu', onPress: skipMemberLogin }
                ]);
            } else {
                setCustomerName(exactData.name);
                setSelectedCustomerId(exactData.id);
                setShowMemberLoginModal(false);
                setMemberPhone('');
                Alert.alert('Sukses', `Selamat datang, ${exactData.name}!`);
            }
        } catch (e) { Alert.alert('Error', 'Terjadi kesalahan saat mengecek member'); }
    };

    const skipMemberLogin = () => {
        setCustomerName('Guest');
        setSelectedCustomerId(null);
        setShowMemberLoginModal(false);
        setMemberPhone('');
    };

    const addToCart = useCallback((product: any) => {
        let target = product.target || 'Kitchen';
        if (target === 'Waitress' || !product.target) {
            const categoryLow = (product.category_name || product.category || '').toLowerCase();
            if (categoryLow.includes('makan') || categoryLow.includes('food')) target = 'Kitchen';
            else if (categoryLow.includes('minum') || categoryLow.includes('drink') || categoryLow.includes('bar') || categoryLow.includes('coffee')) target = 'Bar';
        }
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prevCart, { ...product, quantity: 1, target, notes: '' }];
        });
    }, []);

    const removeFromCart = useCallback((productId: number) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === productId);
            if (existingItem && existingItem.quantity > 1) {
                return prevCart.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
            }
            return prevCart.filter(item => item.id !== productId);
        });
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
        setInitialItems([]);
        setCustomerName('Guest');
        setSelectedCustomerId(null);
        setSelectedTable('-');
        setOrderDiscount(0);
        setExistingSaleId(null);
    }, []);

    const calculateSubtotal = () => cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const calculateTaxableSubtotal = () => cart.reduce((sum, item) => item.is_taxed === false ? sum : sum + (item.price * item.quantity), 0);
    const calculateTaxAmount = () => (calculateTaxableSubtotal() * (storeSettings?.tax_rate || 0)) / 100;
    const calculateServiceAmount = () => (calculateTaxableSubtotal() * (storeSettings?.service_rate || 0)) / 100;
    const calculateTotal = () => Math.max(0, (calculateSubtotal() - orderDiscount) + calculateTaxAmount() + calculateServiceAmount());

    const calculateActiveBreakdown = () => {
        if (!isSplitPayment) {
            const subtotal = calculateSubtotal();
            const tax = calculateTaxAmount();
            const service = calculateServiceAmount();
            const total = calculateTotal();
            return { subtotal, tax, serviceCharge: service, discount: orderDiscount, total };
        }
        const totalSubtotal = calculateSubtotal();
        if (totalSubtotal <= 0) return { subtotal: 0, tax: 0, serviceCharge: 0, discount: 0, total: 0 };
        const splitSubtotal = splitItemsToPay.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const splitTaxableSubtotal = splitItemsToPay.reduce((sum, item) => item.is_taxed === false ? sum : sum + (item.price * item.quantity), 0);
        const splitTax = (splitTaxableSubtotal * (storeSettings?.tax_rate || 0)) / 100;
        const splitService = (splitTaxableSubtotal * (storeSettings?.service_rate || 0)) / 100;
        const splitDiscount = orderDiscount * (splitSubtotal / totalSubtotal);
        const splitTotal = Math.max(0, splitSubtotal - splitDiscount + splitTax + splitService);
        return { subtotal: splitSubtotal, tax: splitTax, serviceCharge: splitService, discount: splitDiscount, total: splitTotal };
    };

    const handleAddManualItem = (item: { name: string; price: number; notes?: string }) => {
        const manualItem = {
            id: `manual-${Date.now()}`,
            name: item.name + (item.notes ? ` (${item.notes})` : ''),
            price: item.price,
            quantity: 1,
            isManual: true,
            category: 'Manual',
            notes: item.notes
        };
        setCart(prev => [...prev, manualItem]);
        setShowManualItemModal(false);
    };

    const handleApplyDiscount = (discount: { type: 'percentage' | 'fixed'; value: number; reason?: string }) => {
        let amount = discount.type === 'percentage' ? (calculateSubtotal() * discount.value) / 100 : discount.value;
        setOrderDiscount(amount);
        setDiscountReason(discount.reason || '');
        setShowDiscountModal(false);
    };

    const onSplitCommit = (selectedItems: any[]) => {
        if (selectedItems.length === 0) {
            setIsSplitPayment(false);
            setSplitItemsToPay([]);
        } else {
            setIsSplitPayment(true);
            setSplitItemsToPay(selectedItems);
            setShowPaymentModal(true);
        }
        setShowSplitBillModal(false);
    };

    // ─── SMART PRINTING LOGIC ──────────────────────────────────────────
    const executeSmartPrint = async (saleData: any, currentCart: any[]) => {
        try {
            console.log('[POSScreen] Starting Smart Print check...', { cartSize: currentCart.length, initialSize: initialItems.length });
            const diffItems = currentCart.map(item => {
                // Find matching item by ID (if exists) or Name/Notes (for manual items)
                const initialItem = initialItems.find(ii => {
                    const idMatch = (ii.id && item.id && ii.id === item.id);
                    const nameMatch = (!ii.id && !item.id && ii.name === item.name);
                    const notesMatch = (ii.notes === item.notes);
                    return (idMatch || nameMatch) && notesMatch;
                });

                if (!initialItem) return item;

                if (item.quantity > initialItem.quantity) {
                    return { ...item, quantity: item.quantity - initialItem.quantity };
                }
                return null;
            }).filter(Boolean);

            if (diffItems.length > 0) {
                console.log('[POSScreen] Smart Printing: Sending items to targets', diffItems);
                // First target (Kitchen)
                await PrinterManager.printToTarget(diffItems, 'kitchen', saleData);
                
                // Small gap between targets to prevent BLE issues
                await new Promise(r => setTimeout(r, 1200));
                
                // Second target (Bar)
                await PrinterManager.printToTarget(diffItems, 'bar', saleData);
            } else {
                console.log('[POSScreen] Smart Printing: No new items to print');
            }
        } catch (err) {
            console.error('[POSScreen] Smart Printing Error:', err);
        }
    };

    const handleHoldOrder = async (note: string = '') => {
        if (cart.length === 0) return;
        const saleData = {
            branch_id: (currentBranchId && currentBranchId !== '') ? parseInt(String(currentBranchId)) : 1,
            customer_name: customerName,
            customer_id: selectedCustomerId,
            table_no: selectedTable,
            waiter_name: selectedWaiter || userName,
            total_amount: calculateTotal(),
            discount: orderDiscount,
            status: 'Pending',
            order_no: null 
        };
        try {
            // Offline Fallback Check
            if (isManualOffline || !isOnline) {
                const offlinePayload = {
                    ...saleData,
                    branch_id: (currentBranchId && currentBranchId !== '') ? parseInt(String(currentBranchId)) : 1,
                    items: cart.map(i => ({ ...i, product_id: typeof i.id === 'string' && i.id.startsWith('manual') ? null : i.id }))
                };
                const offlineResult = await OfflineService.saveSale(offlinePayload);
                const branchIdNum = typeof currentBranchId === 'string' ? parseInt(currentBranchId) : (currentBranchId || 1);
                const finalizedSaleData = { ...saleData, branch_id: branchIdNum, order_no: offlineResult.order_no };
                await executeSmartPrint(finalizedSaleData, cart);
                
                const newHeldOrder = {
                    id: offlineResult.id,
                    orderNo: offlineResult.order_no,
                    items: [...cart],
                    discount: saleData.discount,
                    total: saleData.total_amount,
                    createdAt: new Date(),
                    tableNo: saleData.table_no,
                    isRemote: false
                };
                setHeldOrders(prev => [newHeldOrder, ...prev]);
                showToast('Draft disimpan secara lokal (Offline)', 'info');
                
                // [FORCE CLEAR] Clear cart immediately
                setCart([]);
                setInitialItems([]);
                setOrderDiscount(0);
                setExistingSaleId(null);
                setCustomerName('Guest');
                setSelectedTable('-');

                setShowHoldNoteModal(false);
                setShowCartModal(false);
                return;
            }

            const { data, error } = await supabase.rpc('upsert_sale_with_items', {
                p_sale_data: saleData,
                p_items_data: cart.map(i => ({
                    product_id: typeof i.id === 'string' && i.id.startsWith('manual') ? null : i.id,
                    product_name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    target: i.target,
                    notes: i.notes
                })),
                p_target_sale_id: existingSaleId || null
            });
            if (error) throw error;
            const branchIdNum = (currentBranchId && currentBranchId !== '') ? parseInt(String(currentBranchId)) : 1;
            const finalizedSaleData = { ...saleData, branch_id: branchIdNum, order_no: data.order_no };
            
            showToast('Pesanan di-hold & dicetak', 'success');

            // [FORCE CLEAR] Clear cart immediately BEFORE printing to ensure UI feels responsive
            setCart([]);
            setInitialItems([]);
            setOrderDiscount(0);
            setExistingSaleId(null);
            setCustomerName('Guest');
            setSelectedTable('-');
            setShowHoldNoteModal(false);
            setShowCartModal(false);

            console.log('[POSScreen] Hold success, triggering auto-print and state update');
            await executeSmartPrint(finalizedSaleData, cart);
            
            // Refresh from server to be sure
            setTimeout(() => {
                fetchRemotePendingOrders(true);
            }, 2000);
        } catch (err: any) {
            console.error('[POSScreen] Hold Error:', err);
            Alert.alert('Gagal Hold', err.message || 'Database sedang sibuk. Silakan coba lagi.');
        }
    };

    const handleRestoreHeldOrder = async (order: any) => {
        if (cart.length > 0) { Alert.alert('Info', 'Kosongkan keranjang sebelum memuat pesanan'); return; }
        if (order.isRemote) {
            setShowHeldOrdersModal(false);
            await loadOrderById(parseInt(order.id));
            return;
        }
        setCart(order.items);
        setInitialItems(order.items);
        setOrderDiscount(order.discount || 0);
        setSelectedTable(order.tableNo || '-');
        setCustomerName(order.customerName || 'Guest');
        setSelectedCustomerId(order.selectedCustomerId || null);
        setSelectedWaiter(order.selectedWaiter || '');
        setExistingSaleId(order.existingSaleId || null);
        setHeldOrders(prev => prev.filter(h => h.id !== order.id));
        setShowHeldOrdersModal(false);
        if (!isSideBySide) setShowCartModal(true);
    };

    const handleCheckout = async () => {
        if (!isSessionActive && cashierMode && !isActuallyDisplay && !isAdmin) {
            Alert.alert('Shift Belum Dibuka', 'Anda wajib membuka shift kasir terlebih dahulu.');
            return;
        }
        if (cart.length === 0) return;
        if (cashierMode && !isActuallyDisplay) { setShowPaymentModal(true); return; }
        try {
            const saleData = {
                branch_id: currentBranchId ? parseInt(String(currentBranchId)) : null,
                customer_name: customerName,
                customer_id: selectedCustomerId,
                table_no: selectedTable,
                waiter_name: selectedWaiter || userName,
                total_amount: calculateTotal(),
                status: 'Pending',
                discount: orderDiscount,
                tax: calculateTaxAmount(),
                service_charge: calculateServiceAmount()
            };
            const { data, error } = await supabase.rpc('upsert_sale_with_items', {
                p_sale_data: saleData,
                p_items_data: cart.map(i => ({
                    product_id: typeof i.id === 'string' && i.id.startsWith('manual') ? null : i.id,
                    product_name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    target: i.target,
                    notes: i.notes
                })),
                p_target_sale_id: (typeof existingSaleId === 'number') ? existingSaleId : null
            });
            if (error) throw error;
            executeSmartPrint({ ...saleData, order_no: data.order_no }, cart);
            setLastOrderNo(data.order_no);
            setLastSaleId(data.id);
            setSuccessModalConfig({ title: 'Pesanan Terkirim!', message: 'Pesanan berhasil dikirim ke dapur/bar.' });
            setShowSuccessModal(true);
            // [FORCE CLEAR]
            setCart([]);
            setInitialItems([]);
            setOrderDiscount(0);
            setExistingSaleId(null);
            setCustomerName('Guest');
            setSelectedTable('-');
            setShowCartModal(false);
        } catch (err: any) {
            Alert.alert('Gagal', 'Server tidak merespon (Database sibuk). Silakan coba lagi.');
        }
    };

    const handlePaymentConfirm = async (paymentData: { method: string; amount: number; change: number }) => {
        try {
            const breakdown = calculateActiveBreakdown();
            const itemsToProc = isSplitPayment ? splitItemsToPay : cart;
            const saleData = {
                branch_id: currentBranchId ? parseInt(String(currentBranchId)) : null,
                customer_name: customerName,
                customer_id: selectedCustomerId,
                table_no: selectedTable || '-',
                waiter_name: selectedWaiter || userName,
                total_amount: breakdown.total,
                discount: breakdown.discount,
                tax: breakdown.tax,
                service_charge: breakdown.serviceCharge,
                status: 'Paid',
                payment_method: paymentData.method,
                paid_amount: paymentData.amount,
                change: paymentData.change
            };
            // Offline Fallback Check
            if (isManualOffline || !isOnline) {
                const offlinePayload = {
                    ...saleData,
                    branch_id: saleData.branch_id || 1,
                    items: itemsToProc.map(i => ({ ...i, product_id: typeof i.id === 'string' && i.id.startsWith('manual') ? null : i.id }))
                };
                const offlineResult = await OfflineService.saveSale(offlinePayload);
                if (isSplitPayment) {
                    const newCart = [...cart];
                    splitItemsToPay.forEach(sp => {
                        const idx = newCart.findIndex(c => c.id === sp.id);
                        if (idx !== -1) {
                            if (newCart[idx].quantity === sp.quantity) newCart.splice(idx, 1);
                            else newCart[idx].quantity -= sp.quantity;
                        }
                    });
                    setCart(newCart);
                    setInitialItems(newCart);
                    setIsSplitPayment(false);
                    setSplitItemsToPay([]);
                    setIsPartialSplit(true);
                } else {
                    clearCart();
                    setIsPartialSplit(false);
                }
                setLastOrderNo(offlineResult.order_no);
                setLastSaleId(offlineResult.id);
                setSuccessModalConfig({ title: 'Pembayaran Offline Berhasil!', message: 'Transaksi disimpan secara lokal.' });
                setShowSuccessModal(true);
                setShowPaymentModal(false);
                setShowCartModal(false);
                maybeAutoPrintReceipt(offlineResult.id, offlineResult.order_no);
                return;
            }

            const { data, error } = await supabase.rpc('upsert_sale_with_items', {
                p_sale_data: saleData,
                p_items_data: itemsToProc.map(i => ({
                    product_id: typeof i.id === 'string' && i.id.startsWith('manual') ? null : i.id,
                    product_name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    target: i.target,
                    notes: i.notes
                })),
                p_target_sale_id: (!isSplitPayment && typeof existingSaleId === 'number') ? existingSaleId : null
            });
            if (error) throw error;
            if (isSplitPayment) {
                const newCart = [...cart];
                splitItemsToPay.forEach(sp => {
                    const idx = newCart.findIndex(c => c.id === sp.id);
                    if (idx !== -1) {
                        if (newCart[idx].quantity === sp.quantity) newCart.splice(idx, 1);
                        else newCart[idx].quantity -= sp.quantity;
                    }
                });
                setCart(newCart);
                setInitialItems(newCart);
                setIsSplitPayment(false);
                setSplitItemsToPay([]);
                setIsPartialSplit(true);
            } else {
                clearCart();
                setIsPartialSplit(false);
            }
            setLastOrderNo(data.order_no);
            setLastSaleId(data.id);
            setSuccessModalConfig({ title: 'Pembayaran Berhasil!', message: 'Transaksi telah selesai dicatat.' });
            setShowSuccessModal(true);
            setShowPaymentModal(false);
            setShowCartModal(false);
            maybeAutoPrintReceipt(data.id, data.order_no);
        } catch (err) {
            Alert.alert('Gagal Pembayaran', 'Database sibuk. Pastikan internet stabil dan coba lagi.');
        }
    };

    const handleTablePress = () => {
        if (isDisplayOnly || !cashierMode) return;
        setManualTableInput(selectedTable === '-' ? '' : selectedTable);
        setShowTableManualModal(true);
    };

    const updateNote = (productId: string | number, note: string) => {
        setCart(prev => prev.map(item => item.id === productId ? { ...item, notes: note } : item));
    };

    const handleDeleteHeldOrder = async (id: string) => {
        Alert.alert(
            'Hapus Pesanan',
            'Apakah Anda yakin ingin menghapus pesanan ini?',
            [
                { text: 'Batal', style: 'cancel' },
                { 
                    text: 'Hapus', 
                    style: 'destructive',
                    onPress: async () => {
                        const isRemote = remoteOrders.some(o => o.id === id);
                        if (isRemote) {
                            try {
                                const { error } = await supabase.from('sales').delete().eq('id', id);
                                if (error) throw error;
                                setRemoteOrders(prev => prev.filter(o => o.id !== id));
                                showToast('Pesanan dihapus dari server', 'success');
                            } catch (err) {
                                Alert.alert('Gagal', 'Gagal menghapus pesanan di server. Coba lagi.');
                            }
                        } else {
                            setHeldOrders(prev => prev.filter(h => h.id !== id));
                            showToast('Draft lokal dihapus', 'info');
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {/* Back Button Circle */}
                    <TouchableOpacity 
                        style={styles.headerCircleButton} 
                        onPress={() => navigation.goBack()}
                    >
                        <ChevronLeft size={20} color="#374151" strokeWidth={2.5} />
                    </TouchableOpacity>

                    {/* Online Status Circle */}
                    <TouchableOpacity 
                        style={[styles.headerCircleButton, { backgroundColor: isManualOffline ? '#fef2f2' : (isOnline ? '#f0fdf4' : '#fff1f2') }]}
                        onPress={handleRefreshConnectivity}
                    >
                        {isOnline ? (
                            <Wifi size={18} color="#16a34a" />
                        ) : (
                            <WifiOff size={18} color="#ef4444" />
                        )}
                        <View style={[styles.statusDotSmall, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
                    </TouchableOpacity>

                    {/* Printer Status Circle */}
                    {isPrinterReady && (
                        <TouchableOpacity 
                            style={[styles.headerCircleButton, { backgroundColor: '#f0fdf4' }]}
                            onPress={handleReconnectPrinters}
                        >
                            <Printer size={18} color="#16a34a" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitleText} numberOfLines={1}>{branchName || 'Point of Sale'}</Text>
                </View>

                <TouchableOpacity style={styles.headerCircleButton} onPress={() => setShowHeldOrdersModal(true)}>
                    <Text style={{ fontSize: 18 }}>📂</Text>
                    {pendingCount > 0 && (
                        <View style={styles.badgeContainer}>
                            <Text style={styles.badgeText}>{pendingCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Info Bar (Table & Waiter) */}
            <View style={styles.headerInfoBar}>
                <TouchableOpacity 
                    style={styles.infoBarItem}
                    onPress={handleTablePress}
                    disabled={isDisplayOnly}
                >
                    <Text style={styles.infoBarLabel}>{orderType === 'take_away' ? 'ORDER' : 'MEJA'}</Text>
                    <Text style={styles.infoBarValue}>{orderType === 'take_away' ? takeAwayLabel : selectedTable}</Text>
                </TouchableOpacity>
                <View style={styles.infoBarDivider} />
                <TouchableOpacity 
                    style={styles.infoBarItem}
                    onPress={() => !isDisplayOnly && setShowWaiterModal(true)}
                    disabled={isDisplayOnly}
                >
                    <Text style={styles.infoBarLabel}>KASIR</Text>
                    <Text style={styles.infoBarValue} numberOfLines={1}>{selectedWaiter || '-'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tabletMainRow}>
                {/* Left Side: Product Selection */}
                <View style={[styles.flex1, { backgroundColor: '#f9fafb' }]}>
                    {/* Search & Order Type */}
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Cari produk..."
                            placeholderTextColor="#9ca3af"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {/* Order Type Chips */}
                    {orderCategoriesEnabled && (
                        <View style={styles.orderTypeRow}>
                            <TouchableOpacity 
                                style={[styles.orderTypeChip, orderType === 'dine_in' && styles.orderTypeChipActive]}
                                onPress={() => setOrderType('dine_in')}
                            >
                                <Text style={[styles.orderTypeText, orderType === 'dine_in' && styles.orderTypeTextActive]}>🍽️ {dineInLabel}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.orderTypeChip, orderType === 'take_away' && styles.orderTypeChipActive]}
                                onPress={() => setOrderType('take_away')}
                            >
                                <Text style={[styles.orderTypeText, orderType === 'take_away' && styles.orderTypeTextActive]}>🥡 {takeAwayLabel}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.orderTypeChip, { backgroundColor: '#fff7ed', borderColor: '#fdba74' }]}
                                onPress={handleTablePress}
                            >
                                <Text style={[styles.orderTypeText, { color: '#ea580c' }]}>🪑 Meja: {selectedTable}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Categories */}
                    <View style={styles.categoryContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.categoryTab, selectedCategory === cat && styles.activeCategoryTab]}
                                    onPress={() => setSelectedCategory(cat)}
                                >
                                    <Text style={[styles.categoryText, selectedCategory === cat && styles.activeCategoryText]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {loadingProducts ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#ea580c" />
                            <Text style={styles.loadingText}>Memuat menu...</Text>
                        </View>
                    ) : filteredProducts.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>🍽️</Text>
                            <Text style={styles.emptyTitle}>Produk tidak ditemukan</Text>
                            <Text style={styles.emptySubtitle}>Coba cari dengan kata kunci lain atau pilih kategori berbeda.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredProducts}
                            keyExtractor={(item) => item.id.toString()}
                            numColumns={productGridColumns}
                            key={`grid-${productGridColumns}`} // Force re-render when columns change
                            renderItem={({ item }) => (
                                <View style={{ width: `${100 / productGridColumns}%`, padding: isSmallDevice ? 4 : 6 }}>
                                    <ProductCard 
                                        item={item} 
                                        isTablet={isTablet} 
                                        onAdd={addToCart} 
                                        formatCurrency={formatCurrency} 
                                    />
                                </View>
                            )}
                            contentContainerStyle={styles.productListContent}
                        />
                    )}
                </View>

                {/* Right Side: Cart Summary (Tablet Only) */}
                {isSideBySide && (
                    <View style={{ width: isLargeTablet ? 380 : 320, backgroundColor: 'white', borderLeftWidth: 1, borderLeftColor: '#f3f4f6', elevation: 5 }}>
                        <View style={{ flex: 1, padding: 16 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827' }}>Pesanan</Text>
                                <TouchableOpacity onPress={clearCart}>
                                    <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Bersihkan</Text>
                                </TouchableOpacity>
                            </View>

                            {renderSplitCartActions()}
                            {renderSplitCartMeta()}

                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                                {cart.map((item) => (
                                    <View key={item.id} style={[styles.cartItem, { paddingVertical: 10 }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.cartItemName, { fontSize: 13 }]} numberOfLines={2}>{item.name}</Text>
                                            <Text style={styles.cartItemPrice}>{formatCurrency(item.price)}</Text>
                                            <TextInput
                                                style={styles.cartSplitNoteInput}
                                                placeholder="Catatan..."
                                                placeholderTextColor="#fdba74"
                                                value={item.notes}
                                                onChangeText={(text) => updateNote(item.id, text)}
                                            />
                                        </View>
                                        <View style={[styles.quantityControls, { marginLeft: 10, padding: 2 }]}>
                                            <TouchableOpacity style={[styles.qtyButton, { width: 24, height: 24 }]} onPress={() => removeFromCart(item.id)}>
                                                <Text style={[styles.qtyButtonText, { fontSize: 14 }]}>-</Text>
                                            </TouchableOpacity>
                                            <Text style={[styles.qtyText, { fontSize: 13, paddingHorizontal: 6 }]}>{item.quantity}</Text>
                                            <TouchableOpacity style={[styles.qtyButton, { width: 24, height: 24 }]} onPress={() => addToCart(item)}>
                                                <Text style={[styles.qtyButtonText, { fontSize: 14 }]}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                                {cart.length === 0 && (
                                    <View style={styles.cartSplitEmpty}>
                                        <Text style={{ fontSize: 40, marginBottom: 10 }}>🛒</Text>
                                        <Text style={{ color: '#94a3b8', fontWeight: '600', textAlign: 'center' }}>Keranjang Kosong</Text>
                                        <Text style={{ color: '#cbd5e1', fontSize: 11, textAlign: 'center', marginTop: 4 }}>Pilih menu di samping untuk mulai memesan</Text>
                                    </View>
                                )}
                            </ScrollView>

                            <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16, marginTop: 10 }}>
                                <View style={styles.cartTotalRow}>
                                    <Text style={styles.cartTotalLabelLarge}>Subtotal</Text>
                                    <Text style={styles.cartTotalValueLarge}>{formatCurrency(calculateSubtotal())}</Text>
                                </View>
                                {orderDiscount > 0 && (
                                    <View style={[styles.cartTotalRow, { marginTop: 4 }]}>
                                        <Text style={[styles.cartTotalLabelLarge, { color: '#ef4444' }]}>Diskon</Text>
                                        <Text style={[styles.cartTotalValueLarge, { color: '#ef4444' }]}>-{formatCurrency(orderDiscount)}</Text>
                                    </View>
                                )}
                                {(calculateTaxAmount() > 0 || calculateServiceAmount() > 0) && (
                                    <View style={[styles.cartTotalRow, { marginTop: 4 }]}>
                                        <Text style={styles.cartTotalLabelLarge}>Pajak & Layanan</Text>
                                        <Text style={styles.cartTotalValueLarge}>{formatCurrency(calculateTaxAmount() + calculateServiceAmount())}</Text>
                                    </View>
                                )}
                                <View style={[styles.cartTotalRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' }]}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827' }}>Total</Text>
                                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#ea580c' }}>{formatCurrency(calculateTotal())}</Text>
                                </View>

                                <TouchableOpacity 
                                    style={[
                                        styles.confirmButton, 
                                        { marginTop: 16, paddingVertical: 16, borderRadius: 16, backgroundColor: cart.length > 0 ? '#ea580c' : '#cbd5e1' }
                                    ]} 
                                    onPress={handleCheckout}
                                    disabled={cart.length === 0}
                                >
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>
                                        {cashierMode ? 'BAYAR SEKARANG' : (existingSaleId ? 'UPDATE PESANAN' : 'KIRIM PESANAN')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            {/* Compact Cart Bar (Mobile Only) */}
            {cart.length > 0 && !isSideBySide && (
                <View style={[styles.cartSummaryBar, isSmallDevice && { bottom: 12, left: 12, right: 12 }]}>
                    <View style={styles.cartSummaryInfo}>
                        <View style={styles.cartCountBadge}>
                            <Text style={styles.cartCountText}>{cart.reduce((a, b) => a + b.quantity, 0)}</Text>
                        </View>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={styles.cartTotalLabel}>Total Pesanan</Text>
                            <Text style={styles.cartTotalValue}>{formatCurrency(calculateTotal())}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.checkoutButton} onPress={() => setShowCartModal(true)}>
                        <Text style={styles.checkoutButtonText}>Lanjut &rsaquo;</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Modals & Screens */}
            <PaymentModal
                visible={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                total={calculateActiveBreakdown().total}
                subtotal={calculateActiveBreakdown().subtotal}
                tax={calculateActiveBreakdown().tax}
                serviceCharge={calculateActiveBreakdown().serviceCharge}
                discount={calculateActiveBreakdown().discount}
                onConfirm={handlePaymentConfirm}
                paymentMethods={paymentMethods}
                onManualItem={() => { setShowPaymentModal(false); setShowManualItemModal(true); }}
                onDiscount={() => { setShowPaymentModal(false); setShowDiscountModal(true); }}
                onSplitBill={() => { setShowPaymentModal(false); setShowSplitBillModal(true); }}
                onHold={() => { setShowPaymentModal(false); setShowHoldNoteModal(true); }}
            />

            {/* Success Modal */}
            <Modal visible={showSuccessModal} transparent animationType="fade">
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                    <SafeAreaView style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <View style={[styles.modalContent, { width: '90%', maxWidth: 450, alignItems: 'center', padding: 32 }]}>
                            <View style={styles.successIconCircle}>
                                <Text style={styles.successIconText}>✓</Text>
                            </View>
                            <Text style={styles.successTitleText}>{successModalConfig.title}</Text>
                            <Text style={styles.successSubtitleText}>{successModalConfig.message}</Text>

                            <View style={styles.orderNumberBadge}>
                                <Text style={styles.orderNumberLabel}>NOMOR PESANAN</Text>
                                <Text style={styles.orderNumberValue}>{lastOrderNo || '-'}</Text>
                            </View>

                            <View style={{ width: '100%', gap: 12 }}>
                                <TouchableOpacity 
                                    style={[styles.modalButton, { backgroundColor: '#ea580c', paddingVertical: 16 }]} 
                                    onPress={handlePreviewReceipt}
                                >
                                    <Text style={styles.confirmButtonText}>Preview & Cetak Struk</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.cancelButton, { paddingVertical: 16 }]} 
                                    onPress={() => { setShowSuccessModal(false); if (!isActuallyDisplay) navigation.navigate('Main' as never); }}
                                >
                                    <Text style={styles.cancelButtonText}>Selesai</Text>
                                </TouchableOpacity>

                                {isPartialSplit && (
                                    <TouchableOpacity 
                                        style={[styles.modalButton, { backgroundColor: '#1f2937', paddingVertical: 16 }]} 
                                        onPress={() => setShowSuccessModal(false)}
                                    >
                                        <Text style={styles.confirmButtonText}>Lanjut Sisa Pembayaran</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {!isPartialSplit && (
                                <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 24 }}>
                                    Otomatis kembali dalam {countdown} detik.
                                </Text>
                            )}
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>

            {/* Additional Modals from Part 1 */}
            <Modal visible={showCartModal} transparent animationType="slide" onRequestClose={() => setShowCartModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, styles.cartModalContent]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Detail Pesanan</Text>
                            <TouchableOpacity onPress={() => setShowCartModal(false)}>
                                <Text style={{ fontSize: 28, color: '#9ca3af' }}>&times;</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ flex: 1 }}>
                            {renderSplitCartActions()}
                            {renderSplitCartMeta()}
                            {cart.map((item) => (
                                <View key={item.id} style={styles.cartItem}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.cartItemName}>{item.name}</Text>
                                        <Text style={styles.cartItemPrice}>{formatCurrency(item.price)}</Text>
                                        <TextInput
                                            style={styles.cartSplitNoteInput}
                                            placeholder="Tambah catatan..."
                                            placeholderTextColor="#fdba74"
                                            value={item.notes}
                                            onChangeText={(text) => updateNote(item.id, text)}
                                        />
                                    </View>
                                    <View style={styles.quantityControls}>
                                        <TouchableOpacity style={styles.qtyButton} onPress={() => removeFromCart(item.id)}>
                                            <Text style={styles.qtyButtonText}>-</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.qtyText}>{item.quantity}</Text>
                                        <TouchableOpacity style={styles.qtyButton} onPress={() => addToCart(item)}>
                                            <Text style={styles.qtyButtonText}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                        <View style={styles.cartFooter}>
                            <View style={styles.cartTotalRow}>
                                <Text style={styles.cartTotalLabelLarge}>Total Pembayaran</Text>
                                <Text style={[styles.cartTotalValueLarge, { color: '#ea580c' }]}>{formatCurrency(calculateTotal())}</Text>
                            </View>
                            <TouchableOpacity 
                                style={[styles.modalButton, { backgroundColor: '#ea580c', marginTop: 16, paddingVertical: 16 }]} 
                                onPress={handleCheckout}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {cashierMode ? 'PILIH PEMBAYARAN' : (existingSaleId ? 'SIMPAN UPDATE' : 'KONFIRMASI PESANAN')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <HeldOrdersModal
                visible={showHeldOrdersModal}
                onClose={() => setShowHeldOrdersModal(false)}
                orders={uniqueOrders}
                onRestore={handleRestoreHeldOrder}
                onDelete={handleDeleteHeldOrder}
                onRefresh={() => fetchRemotePendingOrders(true)}
                isRefreshing={isFetchingRemote}
            />

            <ManualItemModal
                visible={showManualItemModal}
                onClose={() => setShowManualItemModal(false)}
                onAdd={handleAddManualItem}
            />

            <DiscountModal
                visible={showDiscountModal}
                onClose={() => setShowDiscountModal(false)}
                currentTotal={calculateSubtotal()}
                onApply={handleApplyDiscount}
            />

            <SplitBillModal
                visible={showSplitBillModal}
                onClose={() => setShowSplitBillModal(false)}
                items={cart}
                onSplit={onSplitCommit}
            />

            <ReceiptPreviewModal
                visible={showReceiptPreview}
                onClose={() => setShowReceiptPreview(false)}
                orderData={previewOrderData}
                onPrint={() => handlePrintReceipt()}
            />

            <HoldNoteModal
                visible={showHoldNoteModal}
                onClose={() => setShowHoldNoteModal(false)}
                onConfirm={handleHoldOrder}
            />

            <Modal visible={showWaiterModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Pilih Kasir</Text>
                            <TouchableOpacity onPress={() => setShowWaiterModal(false)}>
                                <Text style={{ fontSize: 24, color: '#9ca3af' }}>&times;</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.searchInput, { marginBottom: 12 }]}
                            placeholder="Cari kasir..."
                            value={waiterSearchQuery}
                            onChangeText={setWaiterSearchQuery}
                        />
                        <ScrollView>
                            {waiters.filter(w => w.name.toLowerCase().includes(waiterSearchQuery.toLowerCase())).map(w => (
                                <TouchableOpacity 
                                    key={w.id} 
                                    style={styles.modalOptionItem} 
                                    onPress={() => { setSelectedWaiter(w.name); setShowWaiterModal(false); }}
                                >
                                    <Text style={styles.modalOptionText}>{w.name}</Text>
                                    <Text style={{ fontSize: 12, color: '#6b7280' }}>{w.position || '-'}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={showTableManualModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Input Nomor Meja</Text>
                        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Masukkan nomor atau label meja secara manual:</Text>
                        <TextInput
                            style={[styles.modalInput, { fontSize: 24, fontWeight: 'bold', textAlign: 'center', height: 70, backgroundColor: '#fff7ed', borderColor: '#ea580c', borderWidth: 1 }]}
                            placeholder="Contoh: A1"
                            value={manualTableInput}
                            onChangeText={setManualTableInput}
                            autoFocus
                            autoCapitalize="characters"
                            placeholderTextColor="#fdba74"
                        />
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { flex: 1 }]} onPress={() => setShowTableManualModal(false)}>
                                <Text style={styles.cancelButtonText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalButton, { flex: 1, backgroundColor: '#ea580c' }]} 
                                onPress={() => { setSelectedTable(manualTableInput.toUpperCase() || '-'); setShowTableManualModal(false); }}
                            >
                                <Text style={styles.confirmButtonText}>Simpan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
        backgroundColor: '#fffaf5',
        paddingHorizontal: 4,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ffedd5',
    },
    quickActionBtn: {
        alignItems: 'center',
        flex: 1,
        paddingVertical: 1,
        paddingHorizontal: 1,
    },
    quickActionIcon: {
        fontSize: 14,
        marginBottom: 1,
        color: '#ea580c',
    },
    quickActionText: {
        fontSize: 8,
        color: '#7c2d12',
        fontWeight: '800',
        letterSpacing: 0.1,
    },
    cartSplitFieldLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#6b7280',
        marginBottom: 3,
    },
    cartSplitFieldBox: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        minHeight: 38,
        justifyContent: 'center',
    },
    cartSplitFieldInput: {
        paddingVertical: 6,
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    cartSplitNoteInput: {
        marginTop: 5,
        fontSize: 10,
        color: '#ea580c',
        backgroundColor: '#fff7ed',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ffedd5',
        fontWeight: '600',
    },
    cartSplitEmpty: {
        alignItems: 'center',
        marginTop: 60,
        paddingHorizontal: 20,
        opacity: 0.8,
    },
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    flex1: {
        flex: 1,
    },
    tabletMainRow: {
        flexDirection: 'row',
        flex: 1,
    },
    header: {
        backgroundColor: 'white',
        paddingVertical: 4,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        zIndex: 10,
    },
    headerCircleButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    statusDotSmall: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: 'white',
    },
    backButtonText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#374151',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    headerInfoBar: {
        flexDirection: 'row',
        backgroundColor: 'white',
        paddingVertical: 4,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        alignItems: 'center',
    },
    infoBarItem: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    infoBarLabel: {
        fontSize: 9,
        color: '#6b7280',
        textTransform: 'uppercase',
        fontWeight: 'bold',
        letterSpacing: 0.4,
    },
    infoBarValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    infoBarDivider: {
        width: 1,
        height: 16,
        backgroundColor: '#f3f4f6',
    },
    searchContainer: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'white',
    },
    orderTypeRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
        paddingBottom: 6,
        paddingTop: 2,
        backgroundColor: 'white',
    },
    orderTypeChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    orderTypeChipActive: {
        backgroundColor: '#fff7ed',
        borderColor: '#fdba74',
    },
    orderTypeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    orderTypeTextActive: {
        color: '#c2410c',
    },
    searchInput: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 10,
        color: '#111827',
        fontSize: 13,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    categoryContainer: {
        backgroundColor: 'white',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    categoryScroll: {
        paddingHorizontal: 12,
        gap: 8,
    },
    categoryTab: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    activeCategoryTab: {
        backgroundColor: '#ea580c',
        borderColor: '#ea580c',
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b5563',
    },
    activeCategoryText: {
        color: 'white',
    },
    productListContent: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        paddingBottom: 200, 
    },
    productCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    productImageContainer: {
        width: '100%',
        aspectRatio: 1, 
        alignItems: 'center',
        justifyContent: 'center',
    },
    productAcronym: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0284c7',
    },
    productInfo: {
        padding: 10,
        flex: 1,
        justifyContent: 'space-between',
    },
    productNameText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1f2937',
        lineHeight: 18,
    },
    productPriceText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ea580c',
        marginTop: 4,
    },
    productFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    productStockText: {
        fontSize: 10,
        color: '#6b7280',
        fontWeight: '500',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#6b7280',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
        marginTop: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    cartModalContent: {
        width: '100%',
        maxWidth: 700,
        height: '90%',
        maxHeight: '90%',
        alignSelf: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#1f2937',
    },
    modalButton: {
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: 'white',
    },
    cancelButton: {
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4b5563',
    },
    modalOptionItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    modalOptionText: {
        fontSize: 16,
        color: '#111827',
    },
    tableOptionItem: {
        width: '30%',
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
        marginBottom: 12,
    },
    selectedTableOption: {
        backgroundColor: '#ebf5ff',
        borderColor: '#2563eb',
    },
    occupiedTableOption: {
        backgroundColor: '#fee2e2',
        borderColor: '#ef4444',
        opacity: 0.7,
    },
    tableOptionText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
    },
    selectedTableText: {
        color: '#2563eb',
    },
    modalInput: {
        backgroundColor: '#f9fafb',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        color: '#111827',
        fontSize: 16,
    },
    confirmButton: {
        backgroundColor: '#2563eb',
    },
    cartSummaryBar: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
        backgroundColor: '#111827',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    cartSummaryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cartCountBadge: {
        backgroundColor: '#ea580c',
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartCountText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    cartTotalLabel: {
        color: '#9ca3af',
        fontSize: 10,
        textTransform: 'uppercase',
    },
    cartTotalValue: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    checkoutButton: {
        backgroundColor: '#ea580c',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 14,
    },
    checkoutButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    modalButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    cartItemList: {
        marginBottom: 20,
    },
    cartItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    cartItemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    cartItemPrice: {
        fontSize: 12,
        color: '#ea580c',
        fontWeight: 'bold',
        marginTop: 1,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 4,
    },
    qtyButton: {
        width: 28,
        height: 28,
        backgroundColor: 'white',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    qtyButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    qtyText: {
        paddingHorizontal: 10,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111827',
    },
    cartFooter: {
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 12,
    },
    cartTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cartTotalLabelLarge: {
        fontSize: 13,
        color: '#4b5563',
        fontWeight: '600',
    },
    cartTotalValueLarge: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    successIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    successIconText: {
        fontSize: 30,
        color: '#22c55e',
        fontWeight: 'bold',
    },
    successTitleText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center',
    },
    successSubtitleText: {
        fontSize: 13,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 20,
    },
    orderNumberBadge: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 30,
        width: '100%',
    },
    orderNumberLabel: {
        fontSize: 10,
        color: '#9ca3af',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    orderNumberValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginTop: 4,
    },
    badgeContainer: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'white',
        zIndex: 50,
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

