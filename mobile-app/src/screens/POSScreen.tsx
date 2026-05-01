import * as React from 'react';
import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Image, Modal, Alert, StyleSheet, useWindowDimensions, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PaymentModal from '../components/PaymentModal';
import { PrinterManager } from '../lib/PrinterManager';
import { Bluetooth, Printer as PrinterIcon } from 'lucide-react-native';
import ManualItemModal from '../components/ManualItemModal';
import { getLocalISOString } from '../lib/dateUtils';
import DiscountModal from '../components/DiscountModal';
import SplitBillModal from '../components/SplitBillModal';
import HeldOrdersModal from '../components/HeldOrdersModal';
import { useSession } from '../context/SessionContext';
import { OfflineService } from '../lib/OfflineService';
import { WifiVoucherService } from '../lib/WifiVoucherService';
import { Wifi, WifiOff, Star, ShoppingCart, ChevronLeft } from 'lucide-react-native';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import HoldNoteModal from '../components/HoldNoteModal';
import ModernToast from '../components/ModernToast';
import ManagerAuthModal from '../components/ManagerAuthModal';

const getAcronym = (name: string) => {
    return name?.substring(0, 2).toUpperCase() || '??';
};

const generateNumericId = () => {
    // Create a 16-digit numeric ID: timestamp (13 digits) + 3 random digits
    // This fits in JS MAX_SAFE_INTEGER and Postgres BIGINT
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return parseInt(`${timestamp}${random}`);
};

const resolveItemTarget = (product: any) => {
    let target = (product.target || '').trim();
    
    // If target is already Bar or Kitchen, keep it (but normalize)
    const lowTarget = target.toLowerCase();
    if (lowTarget === 'bar' || lowTarget === 'kitchen' || lowTarget === 'dapur') {
        return target;
    }

    // Heuristic based on category if target is empty or 'Waitress'
    if (!target || lowTarget === 'waitress') {
        const categoryLow = (product.category_name || product.category || '').toLowerCase();
        if (categoryLow.includes('makan') || categoryLow.includes('food')) return 'Kitchen';
        if (categoryLow.includes('minum') || categoryLow.includes('drink') || categoryLow.includes('bar') || 
            categoryLow.includes('coffee') || categoryLow.includes('kopi') || categoryLow.includes('teh') ||
            categoryLow.includes('jus') || categoryLow.includes('juice') || categoryLow.includes('susu') ||
            categoryLow.includes('milk') || categoryLow.includes('es') || categoryLow.includes('ice') ||
            categoryLow.includes('latte') || categoryLow.includes('boba') || categoryLow.includes('thai')) {
            return 'Bar';
        }
    }

    return target || 'Kitchen'; // Default to Kitchen
};

const ProductCard = memo(({ item, isTablet, onAdd, formatCurrency }: any) => {
    return (
        <TouchableOpacity
            style={[
                styles.productCard,
                { 
                    width: '100%', 
                    margin: 0, 
                    borderRadius: isTablet ? 10 : 6, 
                    overflow: 'hidden', 
                    backgroundColor: '#f3f4f6', 
                    height: isTablet ? 130 : 85 
                }
            ]}
            onPress={() => onAdd(item)}
        >
            <View style={{ width: '100%', height: '100%', position: 'absolute' }}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff7ed' }}>
                        <Text style={[styles.productAcronym, { fontSize: isTablet ? 20 : 12 }]}>
                            {getAcronym(item.name)}
                        </Text>
                    </View>
                )}
            </View>

            <View style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                paddingVertical: isTablet ? 4 : 3,
                paddingHorizontal: 4,
                alignItems: 'center'
            }}>
                <Text style={{
                    fontSize: isTablet ? 11 : 8,
                    color: 'white',
                    textAlign: 'center',
                    fontWeight: '700'
                }} numberOfLines={1}>
                    {item.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={{
                        fontSize: isTablet ? 10 : 7.5,
                        color: '#fdba74',
                        fontWeight: 'bold',
                        marginTop: 0
                    }}>
                        {formatCurrency(item.price)}
                    </Text>
                    {item.is_taxed !== false && (
                        <Text style={{ color: '#fdba74', fontSize: isTablet ? 10 : 8, fontWeight: 'bold' }}>*</Text>
                    )}
                </View>
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
    const isSmallDevice = width < 380;
    const isRegularPhone = width >= 380 && width < 600;
    const splitProductColumns = isLargeTablet ? 4 : (width > 900 ? 4 : 3);


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
    const [syncStatus, setSyncStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [printerStatus, setPrinterStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
    const [lastOrderNo, setLastOrderNo] = useState('');
    const [lastSaleId, setLastSaleId] = useState('');
    const [showCartModal, setShowCartModal] = useState(false);
    const [currentSaleId, setCurrentSaleId] = useState<number | null>(null);
    const [isOnline, setIsOnline] = useState(true);
    const [isManualOffline, setIsManualOffline] = useState(false);
    const [showMemberLoginModal, setShowMemberLoginModal] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [deviceId, setDeviceId] = useState<string>('');

    const [memberPhone, setMemberPhone] = useState('');
    const [paymentMethods, setPaymentMethods] = useState<any[]>([
        { id: 'cash', name: 'Tunai', type: 'cash' },
        { id: 'qris', name: 'QRIS', type: 'digital' },
        { id: 'debit', name: 'Debit', type: 'card' }
    ]);

    // Transaction Data
    const [cart, setCart] = useState<any[]>([]);
    const [selectedTable, setSelectedTable] = useState(tableNo || tableNumber || '-');
    const [orderType, setOrderType] = useState<'dine_in' | 'take_away'>(
        (tableNo === 'TAKEAWAY' || tableNumber === 'TAKEAWAY') ? 'take_away' : 'dine_in'
    );
    const [customerName, setCustomerName] = useState('Guest');
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [selectedWaiter, setSelectedWaiter] = useState(initialWaiter || '');
    const [posFlow, setPosFlow] = useState<'direct'>('direct');
    const [cashierMode, setCashierMode] = useState(true); // Default to true
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [existingSaleId, setExistingSaleId] = useState<number | null>(null);

    // New POS Features State
    const [showManualItemModal, setShowManualItemModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [showSplitBillModal, setShowSplitBillModal] = useState(false);
    const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);
    const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);
    const [pendingAuth, setPendingAuth] = useState<{
        action: 'discount' | 'hold' | 'delete' | 'manual' | 'split';
        data?: any;
    } | null>(null);
    const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null);
    const [isFetchingRemote, setIsFetchingRemote] = useState(false);

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
    const [isPrinting, setIsPrinting] = useState(false);
    const [receiptPrintMode, setReceiptPrintMode] = useState<'auto' | 'manual'>('manual');
    const [isPartialSplit, setIsPartialSplit] = useState(false);
    const [remoteOrders, setRemoteOrders] = useState<any[]>([]);
    const [enableHoldPrinting, setEnableHoldPrinting] = useState<boolean>(false);
    const [autoPreviewReceipt, setAutoPreviewReceipt] = useState<boolean>(false);
    const lastFetchTime = React.useRef(0);
    const fetchInProgress = React.useRef(false);
    const fetchTimeoutRef = React.useRef<any>(null);
    const paymentInProgress = React.useRef(false);
    const retryTimerRef = React.useRef<any>(null);
    const channelRef = React.useRef<any>(null);
    const isFirstRender = React.useRef(true);
    const cartRef = React.useRef<any[]>([]);
    const existingSaleIdRef = React.useRef<number | null>(null);

    // Printer status tracking
    useEffect(() => {
        const checkPrinter = async () => {
            const mac = await PrinterManager.getSelectedPrinter('receipt');
            if (mac) {
                const status = PrinterManager.getConnectionStatus(mac);
                setPrinterStatus(status);
            } else {
                setPrinterStatus('disconnected');
            }
        };
        checkPrinter();
        const interval = setInterval(checkPrinter, 5000);
        return () => clearInterval(interval);
    }, []);

    // Sync refs for use in real-time callbacks without re-subscribing
    React.useEffect(() => {
        cartRef.current = cart;
    }, [cart]);

    React.useEffect(() => {
        existingSaleIdRef.current = existingSaleId;
    }, [existingSaleId]);


    // Toast State
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');

    const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);
    };

    const renderSplitCartActions = () => (
        <View style={[styles.quickActionsRow, { marginBottom: 10 }]}>
            <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => {
                    if (isAdmin || !storeSettings?.restrict_manual_item) {
                        setShowManualItemModal(true);
                    } else {
                        setPendingAuth({ action: 'manual' });
                        setShowDeleteAuthModal(true);
                    }
                }}
            >
                <Text style={styles.quickActionIcon}>+</Text>
                <Text style={styles.quickActionText}>Manual</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => {
                    if (isAdmin || !storeSettings?.restrict_discount) {
                        setShowDiscountModal(true);
                    } else {
                        setPendingAuth({ action: 'discount' });
                        setShowDeleteAuthModal(true);
                    }
                }}
            >
                <Text style={styles.quickActionIcon}>%</Text>
                <Text style={styles.quickActionText}>Diskon</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.quickActionBtn} 
                onPress={() => {
                    if (isAdmin || !storeSettings?.restrict_split_bill) {
                        setShowSplitBillModal(true);
                    } else {
                        setPendingAuth({ action: 'split' });
                        setShowDeleteAuthModal(true);
                    }
                }}
            >
                <Text style={styles.quickActionIcon}>/</Text>
                <Text style={styles.quickActionText}>Pisah</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => {
                    if (isAdmin || !storeSettings?.restrict_hold_order) {
                        setShowHoldNoteModal(true);
                    } else {
                        setPendingAuth({ action: 'hold' });
                        setShowDeleteAuthModal(true);
                    }
                }}
            >
                <Text style={styles.quickActionIcon}>||</Text>
                <Text style={styles.quickActionText}>Hold</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowHeldOrdersModal(true)}>
                <Text style={styles.quickActionIcon}>#</Text>
                <Text style={styles.quickActionText}>Daftar</Text>
            </TouchableOpacity>
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

    // Load settings every time the screen is focused (ensures sync with SettingsScreen)
    useFocusEffect(
        React.useCallback(() => {
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

                const savedHoldPrint = await AsyncStorage.getItem('enable_hold_printing');
                if (savedHoldPrint !== null) {
                    setEnableHoldPrinting(savedHoldPrint === 'true');
                }

                const savedAutoPreview = await AsyncStorage.getItem('auto_preview_receipt');
                if (savedAutoPreview !== null) {
                    setAutoPreviewReceipt(savedAutoPreview === 'true');
                }
            };
            loadPOSFlow();
        }, [])
    );

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

    // [FIX] Side-by-side mode should only trigger on tablets or in landscape.
    // This prevents the cramped two-column layout on portrait mobile phones.
    const isSideBySide = !isActuallyDisplay && (isTablet || isLandscape);

    const productGridColumns = isActuallyDisplay
        ? (isLargeTablet ? 6 : (isTablet ? 5 : (isRegularPhone ? 4 : 3)))
        : (isSideBySide ? splitProductColumns : (isRegularPhone ? 4 : 3));

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

    // Centralized Countdown & Auto-Reset Logic
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (showSuccessModal && !isPartialSplit) {
            // [SUPER FAST RESET] 3s for Display, 20s for Cashier
            const initialTimeout = isActuallyDisplay ? 3 : 20;
            setCountdown(initialTimeout);
            
            timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        console.log('[POSScreen] Success Modal Auto-Reset triggered.');
                        
                        // CLEAR EVERYTHING AGAIN JUST TO BE SAFE
                        if (isActuallyDisplay) {
                            clearCart();
                            showToast("Sesi Pesanan Direset", "info");
                        }
                        
                        setShowSuccessModal(false);
                        
                        if (!isActuallyDisplay) {
                            // @ts-ignore
                            navigation.navigate('Main');
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [showSuccessModal, isActuallyDisplay, isPartialSplit, clearCart]);





    const triggerTargetPrints = async (orderNo: string, items: any[]) => {
        try {
            console.log('[POSScreen] triggerTargetPrints for Order:', orderNo, 'Items:', items.length);

            const receiptMac = await PrinterManager.getSelectedPrinter('receipt');
            const kitchenMac = await PrinterManager.getSelectedPrinter('kitchen');
            const barMac = await PrinterManager.getSelectedPrinter('bar');

            // Filter for diagnostics
            const kitchenItems = items.filter(i => {
                const target = (i.target || '').toLowerCase().trim();
                return target === 'kitchen' || target === 'dapur' || target === 'kds' || (!target || target === 'waitress');
            });
            
            const barItems = items.filter(i => (i.target || '').toLowerCase().trim() === 'bar');

            if (kitchenItems.length > 0 && kitchenMac) {
                // Skip if same as receipt printer to avoid double cutting the same paper
                if (kitchenMac.toUpperCase() !== receiptMac?.toUpperCase()) {
                    console.log('[POSScreen] Printing to Kitchen...');
                    await PrinterManager.printToTarget(kitchenItems, 'kitchen', {
                        orderNo,
                        customerName: customerName || 'Guest',
                        tableNo: selectedTable || '-'
                    });
                } else {
                    console.log('[POSScreen] Kitchen printer same as receipt, skipping redundant print.');
                }
            }

            if (barItems.length > 0 && barMac) {
                // Skip if same as receipt printer
                if (barMac.toUpperCase() !== receiptMac?.toUpperCase()) {
                    console.log('[POSScreen] Printing to Bar...');
                    await PrinterManager.printToTarget(barItems, 'bar', {
                        orderNo,
                        customerName: customerName || 'Guest',
                        tableNo: selectedTable || '-'
                    });
                } else {
                    console.log('[POSScreen] Bar printer same as receipt, skipping redundant print.');
                }
            }
        } catch (error) {
            console.error('[POSScreen] triggerTargetPrints Error:', error);
        }
    };

    const [lastTransactionData, setLastTransactionData] = React.useState<any>(null);

    const handlePrintReceipt = async (saleIdOverride?: string | number | null, orderNoOverride?: string | null, paymentOverride?: any) => {
        try {
            const identifier = String(saleIdOverride || orderNoOverride || lastSaleId || lastOrderNo);
            if (!identifier || identifier === 'undefined') return;
            
            console.log('[POSScreen] handlePrintReceipt:', identifier);
            const data = await fetchOrderDataForReceipt(identifier);
            if (!data) return;

            console.log('[POSScreen] Data Struk Terdeteksi:', {
                subtotal: data.total + (data.discount || 0) - (data.tax || 0) - (data.service_charge || 0),
                tax: data.tax,
                discount: data.discount,
                total: data.total
            });

            // Priority 1: Direct paymentOverride (from handlePaymentConfirm)
            // Priority 2: local lastTransactionData (if identifier matches recent sale)
            // Priority 3: Database data (fallback)
            const override = paymentOverride || ((identifier === lastSaleId || identifier === lastOrderNo) ? lastTransactionData : null);

            if (override) {
                console.log('[POSScreen] Applying data injection to receipt:', override);
                data.paid_amount = override.paid_amount ?? data.paid_amount;
                data.change = override.change ?? data.change;
                data.payment_method = override.payment_method ?? data.payment_method;
                data.discount = override.discount ?? data.discount;
                data.tax = override.tax ?? data.tax;
                data.service_charge = override.service_charge ?? data.service_charge;
            }

            await PrinterManager.printOrderReceipt(data);
        } catch (e) {
            console.error('[POSScreen] Print Error:', e);
            Alert.alert('Error', 'Gagal mencetak struk');
        }
    };

    const handlePreviewReceipt = async (saleIdOverride?: string | number | null, orderNoOverride?: string | null, paymentOverride?: any) => {
        try {
            const identifier = String(saleIdOverride || orderNoOverride || lastSaleId || lastOrderNo);
            if (!identifier || identifier === 'undefined') return;

            const orderData = await fetchOrderDataForReceipt(identifier);
            if (orderData) {
                const override = paymentOverride || ((identifier === lastSaleId || identifier === lastOrderNo) ? lastTransactionData : null);
                
                if (override) {
                    orderData.paid_amount = override.paid_amount ?? orderData.paid_amount;
                    orderData.change = override.change ?? orderData.change;
                    orderData.payment_method = override.payment_method ?? orderData.payment_method;
                    orderData.discount = override.discount ?? orderData.discount;
                    orderData.tax = override.tax ?? orderData.tax;
                    orderData.service_charge = override.service_charge ?? orderData.service_charge;
                }
                setPreviewOrderData(orderData);
                setShowReceiptPreview(true);
            }
        } catch (e) {
            console.error('[POSScreen] Preview Error:', e);
            Alert.alert('Error', 'Gagal memuat pratinjau struk');
        }
    };

    const maybeAutoPreviewReceipt = (saleId?: any, orderNo?: any, paymentOverride?: any) => {
        if (!autoPreviewReceipt || isDisplayOnly) return;
        handlePreviewReceipt(String(saleId || orderNo || lastSaleId || lastOrderNo), orderNo, paymentOverride);
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
            const totalAmount = Number(sale.total_amount || sale.total || 0);

            if (totalAmount >= minAmount && totalAmount > 0) {
                try {
                    // Calculate count based on multiples
                    // Use multiplier if set (>0), otherwise use minAmount as the step.
                    // If both are 0, default to 1 voucher.
                    const step = multiplier > 0 ? multiplier : (minAmount > 0 ? minAmount : 0);
                    
                    let count = 1;
                    if (step > 0) {
                        count = Math.floor(totalAmount / step);
                    }
                    
                    // Final safety: ensure at least 1 if they met the minimum spend
                    if (count < 1) {
                        count = 1;
                    }

                    console.log(`[POSScreen] WiFi Voucher Logic: total=${totalAmount}, min=${minAmount}, mult=${multiplier}, step=${step}, count=${count}`);

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
            cashier_name: (!isDisplayOnly && (userName && userName !== 'User' && userName !== 'Kasir')) 
                ? userName 
                : (sale.waiter_name || '-'),
            waiter_name: sale.waiter_name || '-',
            total: sale.total_amount || sale.total || 0,
            discount: sale.discount || sale.discount_amount || 0,
            tax: sale.tax || sale.tax_amount || 0,
            service_charge: sale.service_charge || sale.service_amount || 0,
            tax_rate: sale.tax_rate || storeSettings?.tax_rate || 0,
            service_rate: sale.service_rate || storeSettings?.service_rate || 0,
            receipt_header: storeSettings?.receipt_header || branchName || 'WINNY POS',
            receipt_footer: storeSettings?.receipt_footer,
            receipt_paper_width: storeSettings?.receipt_paper_width || '58mm',
            receipt_logo_url: storeSettings?.receipt_logo_url,
            shop_address: branchAddress || storeSettings?.address,
            shop_phone: branchPhone || storeSettings?.phone,
            show_logo: storeSettings?.show_logo ?? (!!storeSettings?.receipt_logo_url),
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
            payment_method: sale.payment_method || 'Tunai',
            paid_amount: sale.paid_amount ?? sale.total_amount,
            change: sale.change ?? 0,
            created_at: sale.date,
            shop_name: branchName,
            shop_phone: branchPhone,
            items: sale.sale_items.map((si: any) => ({
                name: si.product ? si.product.name : si.product_name,
                price: Number(si.price || 0),
                quantity: Number(si.quantity || 0),
                target: resolveItemTarget(si.product ? { ...si.product, target: si.target } : { category: '', target: si.target }),
                category: si.product?.category || '',
                is_taxed: si.is_taxed === true || si.product?.is_taxed === true,
                notes: si.notes || ''
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
                            ...parsed.filter((c: string) => !['Semua'].includes(c))
                        ];
                        setCategories(merged);
                    }
                    if (cachedPMs) {
                        setPaymentMethods(JSON.parse(cachedPMs));
                    }
                }

                // 2. Fetch Fresh Data from Supabase
                await Promise.all([
                    fetchProducts(),
                    fetchTopSellingProducts(),
                    fetchCategories(),
                    fetchMasterData()
                ]);

                // 4. Load Drafts and Held Orders in Parallel
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
                    // Process Held Orders
                    if (savedHeldStr) {
                        try {
                            const parsedHeld = JSON.parse(savedHeldStr);
                            setHeldOrders(parsedHeld.map((h: any) => ({
                                ...h,
                                createdAt: h.createdAt ? new Date(h.createdAt) : new Date()
                            })));
                        } catch (e) { console.error('Error parsing held orders:', e); }
                    }

                    // Process Customers Fallback
                    if (savedCustomers && customers.length === 0) {
                        setCustomers(JSON.parse(savedCustomers));
                    }

                    // Process Order-specific Loading
                    if (route.params?.orderId) {
                        await loadOrderById(route.params.orderId);
                    } else {
                        // Apply Drafts
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

            // Initialize Device ID for multi-device support
            let dId = await AsyncStorage.getItem('pos_unique_device_id');
            if (!dId) {
                dId = `dev-${Math.random().toString(36).substring(2, 11)}`;
                await AsyncStorage.setItem('pos_unique_device_id', dId);
            }
            setDeviceId(dId);

            if (forced) {
                setIsOnline(false);
            } else {
                const online = await OfflineService.checkConnectivity();
                setIsOnline(online);
            }
        };
        checkConn();
        const connInterval = setInterval(checkConn, 15000);

        // Safety timeout (reduced to 5s for faster fallback)
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
        if (!currentBranchId || isDisplayOnly || fetchInProgress.current) return;

        // Remove restrictive throttle to ensure orders are never missed.
        // We still use fetchInProgress ref to prevent parallel overlapping calls.

        try {
            fetchInProgress.current = true;
            setIsFetchingRemote(true);
            console.log('[POSScreen] Fetching remote pending orders...');
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .eq('branch_id', currentBranchId)
                .in('status', ['Pending', 'Unpaid'])
                .order('date', { ascending: false })
                .limit(50);

            if (error) throw error;

            // Map Supabase sales to HeldOrder format for the modal
            const mappedOrders = (data || []).map((sale: any) => ({
                id: String(sale.id),
                orderNo: sale.order_no,
                items: [], // Items will be fetched on-demand when 'Restore' is clicked
                discount: sale.discount || 0,
                total: sale.total_amount || 0,
                createdAt: new Date(sale.date),
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

    // ─── Real-time Order Listener ──────────────────────────────────────────

    // ─── Real-time Order Listener ──────────────────────────────────────────
    const reconnectSync = useCallback(() => {
        console.log('[POSScreen] Manual re-sync triggered');
        setSyncStatus('connecting');
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
        // Force a re-render of the effect by touching a state if needed? 
        // No, we'll just manually call the subscription logic if we extract it.
        // But the effect depends on currentBranchId, so we can just trigger it.
        triggerSync();
    }, [currentBranchId]);

    const triggerSync = useCallback(() => {
        if (!currentBranchId) return;

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const branchIdStr = String(currentBranchId);
        let retryCount = 0;
        const maxRetries = 5;

        const subscribeToOrders = () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }

            channelRef.current = supabase
                .channel(`pos_branch_${branchIdStr || 'global'}_${deviceId || 'shared'}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'sales' },
                    (payload) => {
                        const newOrder = payload.new as any;
                        const eventType = payload.eventType;
                        
                        console.log('[POSScreen] Real-time Sales Event:', eventType, newOrder?.id);

                        const orderBranchId = String(newOrder?.branch_id || (payload.old as any)?.branch_id || '');
                        const myBranchId = String(currentBranchId || '');

                        if (orderBranchId.trim() !== myBranchId.trim()) return;

                        if (eventType === 'INSERT' || eventType === 'UPDATE') {
                            const orderStatus = (newOrder.status || '').toLowerCase();
                            
                            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
                            fetchTimeoutRef.current = setTimeout(() => fetchRemotePendingOrders(true), 500);

                            if (eventType === 'INSERT' && (orderStatus === 'pending' || orderStatus === 'unpaid')) {
                                showToast(`Pesanan Baru: ${newOrder.order_no || newOrder.id}`, 'info');
                                
                                setTimeout(() => {
                                    if (cartRef.current.length === 0 && !showPaymentModal) {
                                        loadOrderById(newOrder.id);
                                    }
                                }, 500);
                            }
                            
                            if (eventType === 'UPDATE' && existingSaleIdRef.current && Number(newOrder.id) === Number(existingSaleIdRef.current)) {
                                setTimeout(() => loadOrderById(newOrder.id), 800);
                            }
                        }
                    }
                )
                .subscribe((status) => {
                    console.log(`[POSScreen] Sync Status: ${status}`);
                    if (status === 'SUBSCRIBED') {
                        retryCount = 0;
                        setSyncStatus('connected');
                        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        setSyncStatus('error');
                        if (status === 'CHANNEL_ERROR') {
                            console.error('[POSScreen] CHANNEL_ERROR: Check replication publication on Supabase dashboard.');
                        }
                        
                        if (retryCount < maxRetries && status !== 'CLOSED') {
                            retryCount++;
                            console.log(`[POSScreen] Retrying sync... (${retryCount}/${maxRetries})`);
                            retryTimerRef.current = setTimeout(subscribeToOrders, 5000 * retryCount); // Exponential backoff
                        }
                    }
                });
        };

        subscribeToOrders();
    }, [currentBranchId]);

    useEffect(() => {
        if (!currentBranchId) return;
        
        fetchRemotePendingOrders();
        triggerSync();

        return () => {
            console.log('[POSScreen] Cleanup real-time sync');
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [currentBranchId, isDisplayOnly, triggerSync]);

    const loadOrderById = async (saleId: number, retryCount: number = 0) => {
        try {
            console.log(`POSScreen: Loading order by ID: ${saleId} (Retry: ${retryCount})`);

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
                // RACE CONDITION CHECK: If sale exists but items are empty, wait and retry
                if (sale.sale_items.length === 0 && retryCount < 3) {
                    console.log(`[POSScreen] Sale found but items are empty (Retry ${retryCount}). Waiting...`);
                    showToast("Sedang mengambil detail pesanan...", "info");
                    setTimeout(() => {
                        loadOrderById(saleId, retryCount + 1);
                    }, 1500);
                    return;
                }

                if (sale.sale_items.length === 0) {
                    console.warn('[POSScreen] Sale items still empty after retries.');
                    showToast("Gagal memuat detail pesanan (Kosong)", "error");
                    return;
                }

                // Map items to cart format
                const items = sale.sale_items.map((si: any) => ({
                    ...si.product,
                    id: si.product_id,
                    name: si.product_name || si.product?.name,
                    price: si.price,
                    quantity: si.quantity,
                    target: resolveItemTarget(si.product ? { ...si.product, target: si.target } : { category: '', target: si.target }),
                    notes: si.notes || ''
                }));

                // Set all states in one sequence
                setExistingSaleId(sale.id);
                setCustomerName(sale.customer_name || 'Guest');
                setSelectedCustomerId(sale.customer_id);
                setSelectedWaiter(sale.waiter_name || '');
                setSelectedTable(sale.table_no || '-');
                setCart(items);

                console.log('POSScreen: Order loaded successfully');
                showToast("Pesanan otomatis dimuat", "success");

                // AUTO-CART: Automatically show cart modal for cashier review
                if (cashierMode && !isDisplayOnly) {
                    console.log('POSScreen: Auto-triggering cart modal');
                    setTimeout(() => {
                        setShowCartModal(true);
                    }, 500);
                }
            }
        } catch (error) {
            console.error('Error loading order by ID:', error);
            showToast("Gagal memuat pesanan otomatis", "error");
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

            // Handle All Employees for Waiter Selection
            if (!allEmpRes.error && allEmpRes.data) {
                setWaiters(allEmpRes.data);
            }
            // Handle Customers
            if (!custRes.error && custRes.data) {
                setCustomers(custRes.data);
                AsyncStorage.setItem('cached_customers', JSON.stringify(custRes.data));
            } else if (customers.length === 0) {
                setCustomers([
                    { id: '1', name: 'Guest', phone: '-' },
                    { id: '2', name: 'Member A', phone: '08123' },
                ]);
            }


            // Handle Payment Methods
            if (!pmRes.error && pmRes.data) {
                setPaymentMethods(pmRes.data);
                AsyncStorage.setItem('cached_payment_methods', JSON.stringify(pmRes.data));
            }

            // Handle Manager PINs
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
                        AsyncStorage.setItem('pos_existing_sale_id_draft', String(existingSaleId)),
                        AsyncStorage.setItem('pos_draft_timestamp', String(Date.now()))
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
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
            thirtyDaysAgo.setHours(0, 0, 0, 0);

            // [FIX] Added limit(500) and explicit ordering by id to aggregate only the most recent items.
            // Using id instead of created_at because sale_items table does not have a created_at column.
            const { data, error } = await supabase
                .from('sale_items')
                .select('product_name, quantity, sale:sales!inner(date, branch_id)')
                .eq('sale.branch_id', currentBranchId)
                .gte('sale.date', thirtyDaysAgo.toISOString())
                .order('id', { ascending: false })
                .limit(500);

            if (error) throw error;

            const counts: Record<string, number> = {};
            (data || []).forEach(item => {
                const name = item.product_name;
                if (name) {
                    counts[name] = (counts[name] || 0) + (Number(item.quantity) || 1);
                }
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
            const { data, error } = await supabase
                .from('categories')
                .select('name')
                .order('sort_order');

            if (error) throw error;

            if (data) {
                const uniqueSet = new Set<string>();
                data.forEach(c => {
                    if (c && c.name) {
                        const cleanName = c.name.toString().trim();
                        if (cleanName.length > 0 && cleanName.toLowerCase() !== 'semua') {
                            uniqueSet.add(cleanName);
                        }
                    }
                });

                const uniqueCategories = [
                    'Semua',
                    ...Array.from(uniqueSet)
                ];
                setCategories(uniqueCategories);
                // Save to Cache
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
            // Speed optimization: Select only required columns
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


    // Filter Logic
    const filteredProducts = useMemo(() => {
        let result = products;

        // 1. Filter out products that are NOT sellable or NOT ready (Kosong)
        result = result.filter(p => p.is_sellable !== false && p.is_stock_ready !== false);

        // 2. Filter by Category
        if (selectedCategory !== 'Semua') {
            const lowerSelected = selectedCategory.toLowerCase();
            result = result.filter(p => {
                const pCat = (p.category || '').toLowerCase();
                return pCat === lowerSelected;
            });
        }

        // 3. Filter by Search Query
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(lowerQuery));
        }

        // 4. Map Best Seller status and Sort
        return result
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }, [products, searchQuery, selectedCategory, topSellingProducts]);



    // Cart Total used in Apply Discount


    const formatCurrency = useCallback((value: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    }, []);

    const checkMember = async () => {
        if (!memberPhone.trim()) {
            Alert.alert('Info', 'Masukkan nomor HP');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .ilike('phone', `%${memberPhone}%`) // Allow partial match or exact? Using ilike for flexibility or eq for strict. strict for now.
                .maybeSingle();

            // Re-query with eq if strictly needed, but let's try strict first
            const { data: exactData, error: exactError } = await supabase
                .from('customers')
                .select('*')
                .eq('phone', memberPhone)
                .maybeSingle();

            const member = exactData || data;

            if (!member) {
                Alert.alert('Gagal', 'Member tidak ditemukan. Lanjut sebagai tamu?', [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Ya, Tamu', onPress: skipMemberLogin }
                ]);
            } else {
                setCustomerName(member.name);
                setSelectedCustomerId(member.id);
                setShowMemberLoginModal(false);
                setMemberPhone('');
                Alert.alert('Sukses', `Selamat datang, ${member.name}!`);
            }
        } catch (e) {
            Alert.alert('Error', 'Terjadi kesalahan saat mengecek member');
        }
    };

    const skipMemberLogin = () => {
        setCustomerName('Guest');
        setSelectedCustomerId(null);
        setShowMemberLoginModal(false);
        setMemberPhone('');
    };

    const addToCart = useCallback((product: any) => {
        const target = resolveItemTarget(product);

        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prevCart, { ...product, quantity: 1, target, notes: '' }];
        });
    }, []);

    const removeFromCart = useCallback((productId: number) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === productId);
            if (existingItem && existingItem.quantity > 1) {
                return prevCart.map(item =>
                    item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
                );
            }
            return prevCart.filter(item => item.id !== productId);
        });
    }, []);

    const clearCart = useCallback(async () => {
        // 1. Clear Memory State
        setCart([]);
        setCustomerName('Guest');
        setSelectedCustomerId(null);
        setSelectedTable('-');
        setOrderDiscount(0);
        setExistingSaleId(null);
        setSearchQuery('');
        setSelectedCategory('Semua');
        setMemberPhone('');
        setShowMemberLoginModal(false);

        // 2. Clear Persistence Storage Explicitly
        try {
            await Promise.all([
                AsyncStorage.removeItem('pos_cart_draft'),
                AsyncStorage.removeItem('pos_customer_draft_name'),
                AsyncStorage.removeItem('pos_customer_draft_id'),
                AsyncStorage.removeItem('pos_table_draft'),
                AsyncStorage.removeItem('pos_discount_draft'),
                AsyncStorage.removeItem('pos_waiter_draft'),
                AsyncStorage.removeItem('pos_existing_sale_id_draft'),
                AsyncStorage.removeItem('pos_draft_timestamp')
            ]);
            console.log('[POSScreen] Cart and drafts cleared successfully.');
        } catch (e) {
            console.warn('[POSScreen] Failed to clear storage drafts:', e);
        }
    }, [setSelectedTable, setSelectedCategory]); // Added stable dependencies

    const calculateSubtotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const calculateTaxableSubtotal = () => {
        return cart.reduce((sum, item) => {
            if (item.is_taxed === false) return sum;
            return sum + (item.price * item.quantity);
        }, 0);
    };

    const calculateTaxAmount = () => {
        const taxableSubtotal = calculateTaxableSubtotal();
        const subtotal = calculateSubtotal();
        const taxRate = Number(storeSettings?.tax_rate || 0);

        // Apply discount ratio to taxable amount to match web logic
        const discountRatio = subtotal > 0 ? (subtotal - orderDiscount) / subtotal : 0;
        const taxableAmount = taxableSubtotal * discountRatio;

        return (taxableAmount * taxRate) / 100;
    };

    const calculateServiceAmount = () => {
        const taxableSubtotal = calculateTaxableSubtotal();
        const subtotal = calculateSubtotal();
        const serviceRate = Number(storeSettings?.service_rate || 0);

        // Apply discount ratio to taxable amount to match web logic
        const discountRatio = subtotal > 0 ? (subtotal - orderDiscount) / subtotal : 0;
        const taxableAmount = taxableSubtotal * discountRatio;

        return (taxableAmount * serviceRate) / 100;
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        const tax = calculateTaxAmount();
        const service = calculateServiceAmount();
        return Math.max(0, (subtotal - orderDiscount) + tax + service);
    };

    const calculateActiveTotal = () => {
        const { total } = calculateActiveBreakdown();
        return total;
    };

    const calculateActiveBreakdown = () => {
        if (!isSplitPayment) {
            const subtotal = calculateSubtotal();
            const tax = calculateTaxAmount();
            const service = calculateServiceAmount();
            const discount = orderDiscount;
            const total = Math.max(0, (subtotal - discount) + tax + service);
            return { subtotal, tax, serviceCharge: service, discount, total };
        }

        const totalSubtotal = calculateSubtotal();
        if (totalSubtotal <= 0) return { subtotal: 0, tax: 0, serviceCharge: 0, discount: 0, total: 0 };

        const splitSubtotal = splitItemsToPay.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Split Tax/Service based ONLY on split taxable items (independent of discount)
        const splitTaxableSubtotal = splitItemsToPay.reduce((sum, item) => {
            if (item.is_taxed === false) return sum;
            return sum + (item.price * item.quantity);
        }, 0);

        const taxRate = storeSettings?.tax_rate || 0;
        const serviceRate = storeSettings?.service_rate || 0;

        const splitTax = (splitTaxableSubtotal * taxRate) / 100;
        const splitService = (splitTaxableSubtotal * serviceRate) / 100;

        const splitDiscount = orderDiscount * (splitSubtotal / totalSubtotal);
        const splitTotal = Math.max(0, splitSubtotal - splitDiscount + splitTax + splitService);

        return {
            subtotal: splitSubtotal,
            tax: splitTax,
            serviceCharge: splitService,
            discount: splitDiscount,
            total: splitTotal
        };
    };

    // New POS Action Handlers
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
        let amount = 0;
        if (discount.type === 'percentage') {
            amount = (calculateSubtotal() * discount.value) / 100;
        } else {
            amount = discount.value;
        }
        setOrderDiscount(amount);
        setDiscountReason(discount.reason || '');
    };

    const handleHoldOrder = async (note: string = '') => {
        if (cart.length === 0) return;

        const tempOrderNo = `HOLD-${Date.now().toString().slice(-6)}`;

        // Trigger prints if enabled
        if (enableHoldPrinting) {
            triggerTargetPrints(tempOrderNo, cart);
        }

        const newHeldOrder = {
            id: tempOrderNo,
            items: [...cart],
            discount: orderDiscount,
            discountReason: discountReason,
            total: calculateTotal(),
            createdAt: new Date(),
            tableNo: selectedTable,
            existingSaleId: existingSaleId,
            customerName: customerName,
            selectedCustomerId: selectedCustomerId,
            selectedWaiter: selectedWaiter,
            note: note
        };

        setHeldOrders(prev => [newHeldOrder, ...prev]);

        showToast('Pesanan ditangguhkan', 'success');

        clearCart();
        setOrderDiscount(0);
        setDiscountReason('');
        setShowCartModal(false);
    };

    const handleRestoreHeldOrder = async (order: any) => {
        if (cart.length > 0) {
            Alert.alert('Info', 'Kosongkan keranjang sebelum mengembalikan pesanan');
            return;
        }

        if (order.isRemote) {
            setShowHeldOrdersModal(false);
            await loadOrderById(parseInt(order.id));
            return;
        }

        setCart(order.items);
        setOrderDiscount(order.discount || 0);
        setSelectedTable(order.tableNo || '-');
        setCustomerName(order.customerName || 'Guest');
        setSelectedCustomerId(order.selectedCustomerId || null);
        setSelectedWaiter(order.selectedWaiter || '');
        setExistingSaleId(order.existingSaleId || null);

        setHeldOrders(prev => prev.filter(h => h.id !== order.id));
        setShowHeldOrdersModal(false);
        setShowCartModal(true);
    };

    const handleTablePress = () => {
        // [RESTRICTED] Only allow manual table entry for cashiers
        if (isDisplayOnly || !cashierMode) {
            console.log('[POSScreen] Manual table entry is restricted for non-cashier users.');
            return;
        }
        setManualTableInput(selectedTable === '-' ? '' : selectedTable);
        setShowTableManualModal(true);
    };

    const updateNote = (productId: string | number, note: string) => {
        setCart(prev => prev.map(item =>
            item.id === productId ? { ...item, notes: note } : item
        ));
    };

    const handleDeleteHeldOrder = (id: string) => {
        setOrderToDeleteId(id);
        if (isAdmin || !storeSettings?.restrict_cashier_delete) {
            confirmDeleteOrder(id);
        } else {
            setPendingAuth({ action: 'delete', data: id });
            setShowDeleteAuthModal(true);
        }
    };

    const handleAuthSuccess = () => {
        if (!pendingAuth) return;
        
        switch (pendingAuth.action) {
            case 'discount':
                setShowDiscountModal(true);
                break;
            case 'hold':
                setShowHoldNoteModal(true);
                break;
            case 'manual':
                setShowManualItemModal(true);
                break;
            case 'split':
                setShowSplitBillModal(true);
                break;
            case 'delete':
                confirmDeleteOrder(pendingAuth.data);
                break;
        }
        setPendingAuth(null);
    };

    const confirmDeleteOrder = async (directId?: string) => {
        const targetId = directId || orderToDeleteId;
        if (!targetId) return;

        try {
            // Check if it's local or remote
            const isRemote = remoteOrders.some(r => r.id === targetId);

            if (isRemote) {
                console.log('[POSScreen] Deleting remote order:', targetId);
                const { error } = await supabase
                    .from('sales')
                    .delete()
                    .eq('id', targetId);

                if (error) throw error;
                showToast("Pesanan remote berhasil dihapus", "success");
            } else {
                // Local held orders
                setHeldOrders(prev => prev.filter(h => h.id !== targetId));
                showToast("Pesanan lokal dihapus", "success");
            }

            // Refresh list
            fetchRemotePendingOrders(true);
        } catch (err) {
            console.error('[POSScreen] Delete Order Error:', err);
            showToast("Gagal menghapus pesanan", "error");
        } finally {
            setOrderToDeleteId(null);
        }
    };


    // Helper for invoice numbering
    const generateOrderNo = (online: boolean) => {
        const mode = online ? storeSettings?.invoice_mode : (storeSettings?.offline_invoice_mode || 'auto');
        const prefix = online ? (storeSettings?.invoice_prefix || 'ORD') : (storeSettings?.offline_invoice_prefix || 'OFF');
        const lastNumber = online ? (Number(storeSettings?.invoice_last_number) || 0) : (Number(storeSettings?.offline_invoice_last_number) || 0);

        if (mode === 'auto') {
            const nextNumber = lastNumber + 1;
            const newNo = `${prefix}-${nextNumber.toString().padStart(4, '0')}`;

            if (online) {
                // Background increment (best effort)
                supabase.from('store_settings').update({ invoice_last_number: nextNumber }).eq('id', 1).then(() => {
                    console.log('[POSScreen] Online Counter Incremented');
                });
            } else {
                supabase.from('store_settings').update({ offline_invoice_last_number: nextNumber }).eq('id', 1).then(() => {
                    console.log('[POSScreen] Offline Counter Incremented');
                });
            }
            return newNo;
        } else {
            const timestamp = Date.now().toString().slice(-6);
            return `${prefix}-${new Date().getFullYear()}-${timestamp}`;
        }
    };


    const onSplitCommit = (selectedItems: any[]) => {
        setSplitItemsToPay(selectedItems);
        setIsSplitPayment(true);
        setShowSplitBillModal(false);
        setShowPaymentModal(true);
    };

    const handleCheckout = async () => {
        if (paymentInProgress.current) return;
        paymentInProgress.current = true;

        // [FIXED] Close Cart Modal immediately to remove the "floating" screen 
        // as soon as the user confirms their order.
        setShowCartModal(false);

        console.log('[POSScreen] Checkout Attempt:', {
            isSessionActive,
            cashierMode,
            isDisplayOnly,
            sessionLoading
        });

        // Bypass session check if user is in display-only mode
        console.log('[POSScreen] Checkout Check:', { isSessionActive, cashierMode, isActuallyDisplay });

        if (!isSessionActive && cashierMode && !isActuallyDisplay && !isAdmin) {
            Alert.alert('Shift Belum Dibuka', 'Anda wajib membuka shift kasir terlebih dahulu sebelum bertransaksi.');
            paymentInProgress.current = false;
            return;
        }

        if (sessionLoading) {
            Alert.alert('Satu Momen', 'Sedang mensinkronisasi data pengguna...');
            paymentInProgress.current = false;
            return;
        }

        if (cart.length === 0) {
            Alert.alert('Info', 'Keranjang masih kosong');
            paymentInProgress.current = false;
            return;
        }


        if (cashierMode && !isActuallyDisplay) {
            setShowPaymentModal(true);
            paymentInProgress.current = false;
            return;
        }

        try {
            if (!currentBranchId) {
                Alert.alert('Error', 'Data cabang belum dimuat. Silakan tunggu atau login ulang.');
                paymentInProgress.current = false;
                return;
            }
            const totalAmount = calculateTotal();
            let orderNoText = '';
            let sale: any = null;

            // 1. Prepare Data for Atomic Upsert
            const saleData: any = {
                // [DEPRECATED] Suffix removal was risky in multi-terminal setup.
                // Switching to SERVER-SIDE numbering. Pass null for order_no on NEW orders.
                order_no: existingSaleId ? undefined : null, 
                branch_id: (currentBranchId && currentBranchId !== 'null') ? currentBranchId : (storeSettings?.branch_id || '1'),
                customer_name: customerName || 'Guest',
                customer_id: selectedCustomerId,
                table_no: selectedTable || '-',
                waiter_name: selectedWaiter || userName || 'Kasir',
                total_amount: totalAmount,
                status: 'Pending',
                payment_method: 'Tunai',
                discount: orderDiscount,
                tax: calculateTaxAmount(),
                service_charge: calculateServiceAmount(),
                date: getLocalISOString()
            };

            console.log('[POSScreen] Sending Order to Branch:', saleData.branch_id);

            const itemsToInsert = cart.map(item => ({
                product_id: typeof item.id === 'string' && item.id.startsWith('manual') ? null : item.id,
                product_name: item.name,
                name: item.name, // [FIXED] For PrinterManager compatibility
                quantity: item.quantity,
                price: item.price,
                cost: 0,
                target: resolveItemTarget(item),
                status: 'Pending',
                is_taxed: item.is_taxed !== false,
                notes: item.notes || ''
            }));

            // [ULTIMATE ATOMIC FIX] Use the enhanced Upsert RPC
            // Handles both NEW orders and UPDATES to held orders in one transaction.
            const { data: rpcData, error: rpcError } = await supabase.rpc('upsert_sale_with_items', {
                p_sale_data: saleData,
                p_items_data: itemsToInsert,
                p_target_sale_id: existingSaleId // If null, it creates new. If set, it updates.
            });

            if (rpcError) {
                console.error('[POSScreen] RPC Error:', rpcError);
                
                // [AUTO-REPAIR] Session conflict handling (Multi-device login)
                if (rpcError.message?.includes('JWT') || rpcError.message?.includes('Unauthorized') || rpcError.code === 'PGRST301') {
                   console.log('[POSScreen] Session expired/conflict. Attempting anonymous fallback...');
                   // Retry once without auth header (supabase handles this if we sign out or just retry)
                   const { data: retryData, error: retryError } = await supabase.rpc('upsert_sale_with_items', {
                       p_sale_data: saleData,
                       p_items_data: itemsToInsert,
                       p_target_sale_id: existingSaleId
                   });
                   
                   if (!retryError) {
                       sale = retryData;
                   } else {
                       Alert.alert('Gagal Mengirim Pesanan', 'Terjadi kesalahan di server. Detail: ' + rpcError.message);
                       return;
                   }
                } else {
                    Alert.alert('Gagal Mengirim Pesanan', 'Terjadi kesalahan di server. Detail: ' + rpcError.message);
                    return;
                }
            }
            
            sale = rpcData;
            orderNoText = sale.order_no;
            const finalSaleId = sale.id;

            setLastOrderNo(orderNoText);
            setLastSaleId(finalSaleId);
            setCurrentSaleId(finalSaleId);

            // [FIXED] Sequential background printing to avoid Bluetooth race conditions
            // We group these and don't await the main block, but we await each print INSIDE the block.
            const runCheckoutPrints = async () => {
                try {
                    if (finalSaleId) {
                        const paymentOverride = {
                            discount: orderDiscount,
                            tax: calculateTaxAmount(),
                            service_charge: calculateServiceAmount()
                        };
                        maybeAutoPreviewReceipt(finalSaleId, orderNoText, paymentOverride);
                    }
                    await triggerTargetPrints(orderNoText, itemsToInsert);
                } catch (pErr) {
                    console.error('[POSScreen] Background print error:', pErr);
                }
            };
            runCheckoutPrints();

            // [GHOST BUSTER] Explicitly clear cart and UI state AFTER printing is done
            setCart([]);

            // [PRIORITY UI] Show success modal
            setTimeout(() => {
                setSuccessModalConfig({
                    title: 'Pesanan Terkirim!',
                    message: isActuallyDisplay 
                        ? 'Pesanan Anda telah masuk ke sistem kasir. Silakan tunggu.'
                        : (existingSaleId ? 'Pesanan berhasil diperbarui' : 'Pesanan baru berhasil dibuat')
                });
                setShowSuccessModal(true);
            }, 50);

            // [INSTANT CLEAN]
            // We clear context variables (customerName, tableNo) only after prints are triggered
            if (isActuallyDisplay) {
                clearCart();
            } else {
                clearCart();
                setExistingSaleId(null);
            }

            setExistingSaleId(null);
            setSelectedCustomerId(null);
            setCustomerName('');
            setSelectedTable('');

        } catch (error: any) {
            console.error('Checkout Error Details:', error);
            const errorMessage = error?.message || error?.details || 'Koneksi bermasalah atau database sibuk';
            
            // Log specifically for debugging multi-device session issues
            if (errorMessage.includes('JWT') || errorMessage.includes('Unauthorized')) {
                console.warn('[POSScreen] Session conflict detected (Multi-device login). Attempting repair...');
            }

            const totalAmount = calculateTotal();
            
            const alertButtons: any[] = [
                { text: 'Batal', style: 'cancel' },
                { text: 'Coba Lagi', onPress: () => handleCheckout() }
            ];

            // Only offer Offline if explicitly enabled in settings
            if (storeSettings?.offline_invoice_mode === 'auto' || isManualOffline) {
                alertButtons.push({
                    text: 'Simpan Offline (OFF)',
                    style: 'destructive',
                    onPress: async () => {
                        const localOrderNo = (storeSettings?.offline_invoice_mode === 'auto')
                            ? `${storeSettings?.offline_invoice_prefix || 'OFF'}-${(Number(storeSettings?.offline_invoice_last_number || 0) + 1).toString().padStart(5, '0')}`
                            : `OFF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

                        const saleData = {
                            order_no: localOrderNo,
                            branch_id: currentBranchId || storeSettings?.branch_id || '1',
                            customer_name: customerName,
                            customer_id: selectedCustomerId,
                            table_no: selectedTable,
                            waiter_name: selectedWaiter,
                            total_amount: totalAmount,
                            status: 'Pending',
                            payment_method: 'Tunai',
                            discount: orderDiscount,
                            tax: calculateTaxAmount(),
                            service_charge: calculateServiceAmount()
                        };

                        const success = await OfflineService.queueOfflineSale(saleData, cart);
                        if (success) {
                            if (storeSettings?.offline_invoice_mode === 'auto') {
                                const nextNum = Number(storeSettings?.offline_invoice_last_number) + 1;
                                supabase.from('store_settings').update({ offline_invoice_last_number: nextNum }).eq('id', 1).then(() => { });
                            }
                            setShowCartModal(false);
                            setTimeout(() => {
                                setSuccessModalConfig({
                                    title: 'Tersimpan Offline!',
                                    message: 'Pesanan disimpan di HP karena gangguan koneksi. Segera cek sinkronisasi di Pengaturan.'
                                });
                                setShowSuccessModal(true);
                                clearCart();
                            }, 150);
                        }
                    }
                });
            }

            Alert.alert('Gagal Mengirim Pesanan', errorMessage, alertButtons);
        } finally {
            paymentInProgress.current = false;
        }
    };

    const handlePaymentConfirm = async (paymentData: { method: string; amount: number; change: number }) => {
        if (paymentInProgress.current) return;
        paymentInProgress.current = true;

        if (!currentBranchId) {
            Alert.alert('Error', 'Data cabang belum dimuat.');
            paymentInProgress.current = false;
            return;
        }
        try {
            // [FIXED] Proportional Calculation for Split Bill
            let finalTotal = calculateTotal();
            let currentDiscount = orderDiscount;
            let currentTax = calculateTaxAmount();
            let currentService = calculateServiceAmount();

            if (isSplitPayment) {
                const totalSubtotal = calculateSubtotal();

                if (totalSubtotal > 0) {
                    const splitSubtotal = splitItemsToPay.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    const splitTaxableSubtotal = splitItemsToPay.reduce((sum, item) => {
                        if (item.is_taxed === false) return sum;
                        return sum + (item.price * item.quantity);
                    }, 0);

                    currentDiscount = orderDiscount * (splitSubtotal / totalSubtotal);

                    const taxRate = storeSettings?.tax_rate || 0;
                    const serviceRate = storeSettings?.service_rate || 0;

                    currentTax = (splitTaxableSubtotal * taxRate) / 100;
                    currentService = (splitTaxableSubtotal * serviceRate) / 100;

                    finalTotal = splitSubtotal - currentDiscount + currentTax + currentService;
                } else {
                    finalTotal = 0;
                    currentDiscount = 0;
                    currentTax = 0;
                    currentService = 0;
                }
            }

            const itemsToProc = isSplitPayment ? splitItemsToPay : cart;

            // 1. Prepare Primary Sale Data with Robust Branch ID
            const activeBranchId = currentBranchId || storeSettings?.branch_id || '1'; // Default to 1 as global fallback
            
            const saleData = {
                // Pass NULL to let the server handle sequential numbering atomically
                order_no: (existingSaleId && !isSplitPayment) ? undefined : null, 
                branch_id: activeBranchId,
                customer_name: customerName || 'Guest',
                customer_id: selectedCustomerId,
                table_no: selectedTable || '-',
                waiter_name: selectedWaiter || userName || 'Kasir',
                total_amount: finalTotal,
                discount: currentDiscount,
                tax: currentTax,
                service_charge: currentService,
                status: 'Paid',
                payment_method: paymentData.method,
                paid_amount: paymentData.amount,
                change: paymentData.change,
                date: getLocalISOString()
            };

            const itemsToInsert = itemsToProc.map(item => ({
                product_id: typeof item.id === 'string' && item.id.startsWith('manual') ? null : item.id,
                product_name: item.name,
                name: item.name, // [FIXED] For PrinterManager compatibility
                quantity: item.quantity,
                price: item.price,
                cost: 0,
                target: resolveItemTarget(item),
                status: 'Pending',
                is_taxed: item.is_taxed || false,
                notes: item.notes || ''
            }));

            // [ATOMIC FIX] Use Upsert RPC for Primary Payment Record
            const { data: rpcData, error: rpcError } = await supabase.rpc('upsert_sale_with_items', {
                p_sale_data: saleData,
                p_items_data: itemsToInsert,
                p_target_sale_id: (existingSaleId && !isSplitPayment) ? existingSaleId : null
            });

            if (rpcError) throw rpcError;
            
            const sale = rpcData;
            const orderNoText = sale.order_no;

            // 2. [FIXED] Sequence background printing with robust delays to prevent printer collisions
            const runPaymentPrints = async () => {
                try {
                    const paymentOverride = {
                        paid_amount: paymentData.amount,
                        change: paymentData.change,
                        payment_method: paymentData.method,
                        discount: currentDiscount,
                        tax: currentTax,
                        service_charge: currentService
                    };

                    // Store for re-print reliability before DB sync
                    setLastTransactionData(paymentOverride);

                    if (receiptPrintMode === 'auto' && !isDisplayOnly && !autoPreviewReceipt) {
                        console.log('[POSScreen] Starting Auto-Print Receipt...');
                        await handlePrintReceipt(sale.id, orderNoText, paymentOverride);
                        // Add significant delay after receipt to allow physical printing/cutting to finish
                        await new Promise(r => setTimeout(r, 2500));
                    }

                    // [FIX] Ensure kitchen/bar tickets are printed when paying directly in cashier mode
                    console.log('[POSScreen] Starting Target Prints (Kitchen/Bar)...');
                    await triggerTargetPrints(orderNoText, itemsToInsert);

                    maybeAutoPreviewReceipt(sale.id, orderNoText, paymentOverride);
                } catch (pErr) {
                    console.error('[POSScreen] Background payment print error:', pErr);
                }
            };
            
            // Execute background prints without blocking UI completion, but internally sequential
            runPaymentPrints();

            // 3. Update UI
            if (isSplitPayment) {
                // Remove paid items from cart
                const newCart = [...cart];
                splitItemsToPay.forEach(splitItem => {
                    const index = newCart.findIndex(item => item.id === splitItem.id);
                    if (index !== -1) {
                        if (newCart[index].quantity === splitItem.quantity) {
                            newCart.splice(index, 1);
                        } else {
                            newCart[index] = { ...newCart[index], quantity: newCart[index].quantity - splitItem.quantity };
                        }
                    }
                });
                setCart(newCart);
                setIsSplitPayment(false);
                setSplitItemsToPay([]);

                // [FIXED] Use Atomic Upsert to update the original held order after split.
                if (existingSaleId) {
                    try {
                        const remSubtotal = newCart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
                        const totalSubtotal = calculateSubtotal();
                        const remRatio = totalSubtotal > 0 ? remSubtotal / totalSubtotal : 0;

                        const remDiscount = orderDiscount * remRatio;
                        const remTax = calculateTaxAmount() * remRatio;
                        const remService = calculateServiceAmount() * remRatio;
                        const remTotal = Math.max(0, remSubtotal - remDiscount + remTax + remService);

                        const remSaleData = {
                            total_amount: remTotal,
                            discount: remDiscount,
                            tax: remTax,
                            service_charge: remService,
                            date: getLocalISOString()
                        };

                        const remItemsData = newCart.map((item: any) => ({
                            product_id: typeof item.id === 'string' && item.id.startsWith('manual') ? null : item.id,
                            product_name: item.name,
                            quantity: item.quantity,
                            price: item.price,
                            cost: 0,
                            target: item.target || 'Waitress',
                            status: 'Pending',
                            is_taxed: item.is_taxed || false
                        }));

                        await supabase.rpc('upsert_sale_with_items', {
                            p_sale_data: remSaleData,
                            p_items_data: remItemsData,
                            p_target_sale_id: existingSaleId
                        });

                        console.log('[POSScreen] Original held order updated atomically after split.');
                    } catch (err) {
                        console.error('[POSScreen] Failed to update original held order after split:', err);
                    }
                }

                // [UPDATED] Show Success Modal for Partial Split
                setLastOrderNo(orderNoText);
                setLastSaleId(sale.id);
                setCurrentSaleId(sale.id);
                setIsPartialSplit(true);
                setSuccessModalConfig({
                    title: 'Pembayaran Sebagian Berhasil!',
                    message: 'Silakan cetak struk untuk bagian ini jika diperlukan.'
                });
                setShowSuccessModal(true);
                // maybeAutoPrintReceipt(sale.id, orderNoText); removed: redundant with runPaymentPrints
            } else {
                // Clear Cart
                clearCart();
                await clearCart();
                setOrderDiscount(0);
                setExistingSaleId(null);
                setIsPartialSplit(false); // Ensure final mode


                setLastOrderNo(orderNoText);
                setLastSaleId(sale.id);
                
                // [UPDATED] Always show Success Modal, including in Display Mode.
                setSuccessModalConfig({
                    title: 'Pembayaran Berhasil!',
                    message: isActuallyDisplay 
                        ? 'Terima kasih! Pembayaran Anda telah diterima dan pesanan diproses.'
                        : 'Transaksi telah selesai dan pembayaran diterima.'
                });
                setShowSuccessModal(true);
                // maybeAutoPrintReceipt(sale.id, orderNoText); removed: redundant with runPaymentPrints
            }
            setShowPaymentModal(false);
            setShowCartModal(false);
            setCurrentSaleId(sale.id);
            await clearCart();
        } catch (error: any) {
            console.error('Payment Confirm Error:', error);

            // [STRICT ONLINE] Payment fallback is now interactive
            const errorMessage = error.message || 'Koneksi terganggu saat memproses pembayaran';
            
            const alertButtons: any[] = [
                { text: 'Batal', style: 'cancel' },
                { text: 'Coba Lagi', onPress: () => handlePaymentConfirm(paymentData) }
            ];

            if ((storeSettings?.offline_invoice_mode === 'auto' || isManualOffline) && !isSplitPayment) {
                alertButtons.push({
                    text: 'Simpan Offline (OFF)',
                    style: 'destructive',
                    onPress: async () => {
                        const finalTotal = calculateTotal();
                        const localOrderNo = (storeSettings?.offline_invoice_mode === 'auto')
                            ? `${storeSettings?.offline_invoice_prefix || 'OFF'}-${(Number(storeSettings?.offline_invoice_last_number || 0) + 1).toString().padStart(5, '0')}`
                            : `OFF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

                        const saleData = {
                            order_no: localOrderNo,
                            branch_id: currentBranchId || storeSettings?.branch_id || '1',
                            customer_name: customerName,
                            customer_id: selectedCustomerId,
                            table_no: selectedTable || '-',
                            waiter_name: userName || selectedWaiter,
                            total_amount: finalTotal,
                            discount: orderDiscount,
                            tax: calculateTaxAmount(), // using calculated values
                            service_charge: calculateServiceAmount(),
                            status: 'Paid',
                            payment_method: paymentData.method,
                            paid_amount: paymentData.amount,
                            change: paymentData.change,
                            date: getLocalISOString(),
                            enable_wifi_vouchers: storeSettings?.enable_wifi_vouchers,
                            wifi_voucher_notice: storeSettings?.wifi_voucher_notice,
                            wifi_voucher: ''
                        };

                        const success = await OfflineService.queueOfflineSale(saleData, cart);
                        if (success) {
                            if (storeSettings?.offline_invoice_mode === 'auto') {
                                const nextNum = Number(storeSettings?.offline_invoice_last_number) + 1;
                                supabase.from('store_settings').update({ offline_invoice_last_number: nextNum }).eq('id', 1).then(() => { });
                            }
                            clearCart();
                            setOrderDiscount(0);
                            setExistingSaleId(null);
                            setLastOrderNo(localOrderNo);
                            setLastSaleId('');
                            setSuccessModalConfig({
                                title: 'Pembayaran Offline!',
                                message: 'Pembayaran disimpan lokal. Hubungkan ke internet untuk sinkronisasi otomatis.'
                            });
                            setShowSuccessModal(true);
                            setShowPaymentModal(false);
                            setShowCartModal(false);
                        }
                    }
                });
            }

            Alert.alert('Gagal Memproses Pembayaran', errorMessage, alertButtons);
            throw error; // Re-throw to inform PaymentModal
        } finally {
            paymentInProgress.current = false;
        }
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
            <View style={styles.flex1}>
                {/* [SLIM HEADER] Row 1: Back | Search | Folder */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    gap: 8,
                    borderBottomWidth: 0.5,
                    borderBottomColor: '#f1f5f9',
                    zIndex: 100
                }}>
                    <TouchableOpacity
                        style={{
                            width: 32,
                            height: 32,
                            justifyContent: 'center',
                            alignItems: 'center',
                            position: 'relative'
                        }}
                        onPress={() => navigation.goBack()}
                    >
                        <ChevronLeft size={22} color="#1e293b" strokeWidth={2.5} />
                        {/* Sync Status Dot */}
                        <View style={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: syncStatus === 'connected' ? '#22c55e' : (syncStatus === 'connecting' ? '#f59e0b' : '#ef4444'),
                            borderWidth: 1.5,
                            borderColor: 'white'
                        }} />
                    </TouchableOpacity>

                    {/* Printer Status Indicator */}
                    <TouchableOpacity 
                        style={{ width: 32, height: 32, justifyContent: 'center', alignItems: 'center', position: 'relative', marginRight: 4 }}
                        onPress={async () => {
                            const mac = await PrinterManager.getSelectedPrinter('receipt');
                            if (mac) {
                                showToast('Menghubungkan printer...', 'info');
                                await PrinterManager.checkConnection(mac);
                            } else {
                                showToast('Printer belum disetel', 'error');
                            }
                        }}
                    >
                        <PrinterIcon size={18} color={printerStatus === 'connected' ? '#22c55e' : '#64748b'} />
                        <View style={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: printerStatus === 'connected' ? '#22c55e' : (printerStatus === 'connecting' ? '#f59e0b' : '#ef4444'),
                            borderWidth: 1.5,
                            borderColor: 'white'
                        }} />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#f1f5f9',
                            borderRadius: 10,
                            paddingHorizontal: 10,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                            height: 38
                        }}>
                            <Text style={{ fontSize: 14, marginRight: 6, opacity: 0.5 }}>🔍</Text>
                            <TextInput
                                style={{ flex: 1, fontSize: 13, color: '#1e293b', fontWeight: '500' }}
                                placeholder="Cari produk..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Text style={{ fontSize: 18, color: '#94a3b8', marginLeft: 8 }}>&times;</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {!isActuallyDisplay && (
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            {syncStatus === 'error' && (
                                <TouchableOpacity 
                                    onPress={reconnectSync}
                                    style={{
                                        backgroundColor: '#fee2e2',
                                        paddingHorizontal: 10,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: '#fecaca'
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#dc2626' }}>Hubungkan Ulang</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={{
                                    width: 38,
                                    height: 38,
                                    backgroundColor: (heldOrders.length + remoteOrders.length) > 0 ? '#fff7ed' : '#ffffff',
                                    borderRadius: 10,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: (heldOrders.length + remoteOrders.length) > 0 ? '#fdba74' : '#e2e8f0',
                                    position: 'relative'
                                }}
                                onPress={() => setShowHeldOrdersModal(true)}
                            >
                                <Text style={{ fontSize: 16 }}>📂</Text>
                                {(heldOrders.length + remoteOrders.length) > 0 && (
                                    <View style={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        backgroundColor: '#ea580c',
                                        paddingHorizontal: 4,
                                        minWidth: 14,
                                        height: 14,
                                        borderRadius: 7,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1.5,
                                        borderColor: 'white'
                                    }}>
                                        <Text style={{ color: 'white', fontSize: 7, fontWeight: 'bold' }}>{heldOrders.length + remoteOrders.length}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* [SLIM HEADER] Row 2: Scrollable Chips for Status & Info */}
                {!isActuallyDisplay && (
                    <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6, gap: 8 }}
                        >
                            {/* Branch Chip */}
                            <View style={{ backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748b' }}>🏪 {branchName}</Text>
                            </View>

                            {/* Online/Offline Status Chip */}
                            <TouchableOpacity
                                onPress={() => setIsManualOffline(!isManualOffline)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: (isOnline && !isManualOffline) ? '#22c55e10' : '#ef444410',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: (isOnline && !isManualOffline) ? '#22c55e30' : '#ef444430'
                                }}
                            >
                                {(isOnline && !isManualOffline) ? <Wifi size={10} color="#16a34a" style={{ marginRight: 4 }} /> : <WifiOff size={10} color="#dc2626" style={{ marginRight: 4 }} />}
                                <Text style={{ fontSize: 9, fontWeight: '800', color: (isOnline && !isManualOffline) ? '#16a34a' : '#dc2626' }}>
                                    {isManualOffline ? 'OFFLINE (M)' : (isOnline ? 'ONLINE' : 'OFFLINE')}
                                </Text>
                            </TouchableOpacity>

                            {/* Order Type Toggle Chip */}
                            <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 6, padding: 2, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                <TouchableOpacity
                                    onPress={() => setOrderType('dine_in')}
                                    style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: orderType === 'dine_in' ? 'white' : 'transparent' }}
                                >
                                    <Text style={{ fontSize: 9, fontWeight: '700', color: orderType === 'dine_in' ? '#ea580c' : '#64748b' }}>{dineInLabel}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setOrderType('take_away')}
                                    style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: orderType === 'take_away' ? 'white' : 'transparent' }}
                                >
                                    <Text style={{ fontSize: 9, fontWeight: '700', color: orderType === 'take_away' ? '#ea580c' : '#64748b' }}>{takeAwayLabel}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Table Info Chip */}
                            <TouchableOpacity
                                style={{ backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}
                                onPress={() => !isSideBySide && setShowCartModal(true)}
                            >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#1e293b' }}>
                                    🪑 {orderType === 'take_away' ? takeAwayLabel : (selectedTable || '-')}
                                </Text>
                            </TouchableOpacity>

                            {/* Customer Info Chip */}
                            <TouchableOpacity
                                style={{ backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}
                                onPress={() => setShowMemberLoginModal(true)}
                            >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#1e293b' }}>
                                    👤 {customerName || 'Guest'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                )}

                {/* Main POS Row (Split View in WideScreen/Landscape) */}
                <View style={[styles.flex1, isSideBySide && { flexDirection: 'row' }]}>
                    <View style={[styles.flex1, isSideBySide && { flex: isLargeTablet ? 0.68 : 0.64 }]}>
                        {/* Categories Top Bar */}
                        <View style={[
                            styles.categoryContainer,
                            { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: 'white', minHeight: isTablet ? 55 : 38, justifyContent: 'center' }
                        ]}>
                            <ScrollView
                                horizontal={true}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={[
                                    styles.categoryScroll,
                                    { paddingHorizontal: 12, gap: 8, alignItems: 'center', height: '100%' },
                                    isActuallyDisplay && { paddingLeft: 50 }
                                ]}
                            >
                                {categories.map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[
                                            styles.categoryTab,
                                            selectedCategory === cat && styles.activeCategoryTab,
                                            isTablet && { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12 }
                                        ]}
                                        onPress={() => setSelectedCategory(cat)}
                                    >
                                        <Text style={[
                                            styles.categoryText,
                                            selectedCategory === cat && styles.activeCategoryText,
                                            isTablet && { fontSize: 13 }
                                        ]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Main Content Area */}
                        <View style={styles.flex1}>
                            {/* Product Grid */}
                            {loadingProducts ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#ea580c" />
                                    <Text style={styles.loadingText}>Memuat produk...</Text>
                                </View>
                            ) : filteredProducts.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyIcon}>📦</Text>
                                    <Text style={styles.emptyTitle}>Produk Kosong</Text>
                                    <Text style={styles.emptySubtitle}>Tidak ada produk dalam kategori ini atau coba kata kunci lain.</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={filteredProducts}
                                    key={`grid-${productGridColumns}`}
                                    numColumns={productGridColumns}
                                    keyExtractor={(item) => item.id.toString()}
                                    showsVerticalScrollIndicator={true}
                                    windowSize={5}
                                    initialNumToRender={15}
                                    maxToRenderPerBatch={10}
                                    removeClippedSubviews={true}
                                    columnWrapperStyle={{
                                        gap: isTablet ? 10 : 8,
                                        paddingHorizontal: isTablet ? 12 : 8,
                                        marginBottom: isTablet ? 10 : 8
                                    }}
                                    contentContainerStyle={[
                                        styles.productListContent,
                                        { paddingBottom: isSideBySide ? 32 : 150 }
                                    ]}
                                    renderItem={({ item }) => {
                                        const numCols = productGridColumns;
                                        return (
                                            <View style={{ flex: 1, maxWidth: `${100 / numCols}%` }}>
                                                <ProductCard
                                                    item={item}
                                                    isTablet={isTablet}
                                                    onAdd={addToCart}
                                                    formatCurrency={formatCurrency}
                                                />
                                            </View>
                                        );
                                    }}
                                />
                            )}
                        </View>
                    </View>

                    {/* Right Column: Split Cart Panel */}
                    {isSideBySide && !isDisplayOnly && (
                        <View style={{ flex: isLargeTablet ? 0.32 : 0.36, backgroundColor: '#fcfcfd', borderLeftWidth: 1, borderLeftColor: '#e5e7eb', height: '100%' }}>
                            <View style={{ paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eceff3', backgroundColor: '#fffaf5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1f2937' }}>🛒 Pesanan</Text>
                                <View style={{ position: 'absolute', left: 12, top: 8, zIndex: 2, backgroundColor: '#fffaf5', paddingRight: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                        <ShoppingCart size={14} color="#ea580c" strokeWidth={2.4} />
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                            {cart.reduce((sum, item) => sum + item.quantity, 0)} item aktif
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={clearCart} style={{ backgroundColor: '#fff1f2', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#ffe4e6' }}>
                                    <Text style={{ fontSize: 10, color: '#e11d48', fontWeight: '800', letterSpacing: 0.2 }}>Reset</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ paddingHorizontal: 8, paddingTop: 8 }}>
                                {renderSplitCartActions()}
                                {renderSplitCartMeta()}
                            </View>
                            <ScrollView style={{ flex: 1, paddingHorizontal: 8 }} contentContainerStyle={{ paddingBottom: 8 }}>
                                {cart.map((item, index) => (
                                    <View key={`cart-${item.id || index}-${index}`} style={{ marginBottom: 8, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#eef2f7', padding: 10, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{item.name}</Text>
                                                <Text style={{ fontSize: 11, color: '#ea580c', fontWeight: '800', marginTop: 2 }}>{formatCurrency(item.price)}</Text>
                                                <TextInput
                                                    style={styles.cartSplitNoteInput}
                                                    placeholder="Catatan item..."
                                                    placeholderTextColor="#fdba74"
                                                    value={item.notes}
                                                    onChangeText={(text) => updateNote(item.id, text)}
                                                />
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, padding: 2, borderWidth: 1, borderColor: '#e2e8f0', marginLeft: 8 }}>
                                                <TouchableOpacity onPress={() => removeFromCart(item.id)} style={{ paddingHorizontal: 6, paddingVertical: 3 }}><Text style={{ fontSize: 15, fontWeight: 'bold', color: '#64748b' }}>-</Text></TouchableOpacity>
                                                <Text style={{ fontWeight: 'bold', marginHorizontal: 3, minWidth: 18, textAlign: 'center', fontSize: 12 }}>{item.quantity}</Text>
                                                <TouchableOpacity onPress={() => addToCart(item)} style={{ paddingHorizontal: 6, paddingVertical: 3 }}><Text style={{ fontSize: 15, fontWeight: 'bold', color: '#ea580c' }}>+</Text></TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>

                            <View style={{ paddingHorizontal: 8, paddingTop: 10, paddingBottom: 22, borderTopWidth: 1, borderTopColor: '#eceff3', backgroundColor: 'white', gap: 4 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: '#64748b', fontSize: 11 }}>Subtotal</Text>
                                    <Text style={{ fontWeight: '600', fontSize: 11 }}>{formatCurrency(calculateSubtotal())}</Text>
                                </View>
                                {orderDiscount > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: '#ef4444', fontSize: 11 }}>Diskon</Text>
                                        <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 11 }}>-{formatCurrency(orderDiscount)}</Text>
                                    </View>
                                )}
                                {calculateServiceAmount() > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: '#64748b', fontSize: 11 }}>Layanan</Text>
                                        <Text style={{ fontWeight: '600', fontSize: 11 }}>{formatCurrency(calculateServiceAmount())}</Text>
                                    </View>
                                )}
                                {calculateTaxAmount() > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: '#64748b', fontSize: 11 }}>Pajak</Text>
                                        <Text style={{ fontWeight: '600', fontSize: 11 }}>{formatCurrency(calculateTaxAmount())}</Text>
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6, marginTop: 2 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#1e293b' }}>Total</Text>
                                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#ea580c' }}>{formatCurrency(calculateTotal())}</Text>
                                </View>
                                <TouchableOpacity
                                    style={{
                                        backgroundColor: '#ea580c',
                                        paddingVertical: 10,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        marginTop: 6,
                                        shadowColor: '#ea580c',
                                        shadowOffset: { width: 0, height: 5 },
                                        shadowOpacity: 0.18,
                                        shadowRadius: 8,
                                        elevation: 4,
                                        opacity: cart.length === 0 ? 0.5 : 1
                                    }}
                                    onPress={handleCheckout}
                                    disabled={cart.length === 0}
                                >
                                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 12, letterSpacing: 0.1 }}>Bayar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>







                <PaymentModal
                    visible={showPaymentModal && !isDisplayOnly}
                    {...calculateActiveBreakdown()}
                    paymentMethods={paymentMethods}
                    onClose={() => setShowPaymentModal(false)}
                    onConfirm={handlePaymentConfirm}
                    onManualItem={() => {
                        setShowPaymentModal(false);
                        setShowManualItemModal(true);
                    }}
                    onDiscount={() => {
                        setShowPaymentModal(false);
                        setShowDiscountModal(true);
                    }}
                    onSplitBill={() => { setShowPaymentModal(false); setShowSplitBillModal(true); }}
                    onHold={() => {
                        setShowPaymentModal(false);
                        setShowHoldNoteModal(true);
                    }}
                />

                <HoldNoteModal
                    visible={showHoldNoteModal}
                    onClose={() => setShowHoldNoteModal(false)}
                    onConfirm={(note) => handleHoldOrder(note)}
                />

                <ModernToast
                    visible={toastVisible}
                    message={toastMessage}
                    type={toastType}
                    onHide={() => setToastVisible(false)}
                />

                {/* Modern Success Modal (Full Screen Overlay) */}
                <Modal visible={showSuccessModal} transparent={false} animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
                    <SafeAreaView style={{ flex: 1, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        <View style={{ alignItems: 'center', gap: 20 }}>
                            <View style={{
                                width: isTablet ? 120 : 80,
                                height: isTablet ? 120 : 80,
                                borderRadius: isTablet ? 60 : 40,
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 4,
                                borderColor: 'white'
                            }}>
                                <Text style={{ fontSize: isTablet ? 60 : 40, color: 'white' }}>✓</Text>
                            </View>

                            <Text style={{
                                fontSize: isTablet ? 32 : 24,
                                fontWeight: 'bold',
                                color: 'white',
                                textAlign: 'center'
                            }}>{successModalConfig.title}</Text>

                            <Text style={{
                                fontSize: isTablet ? 18 : 14,
                                color: 'rgba(255,255,255,0.9)',
                                textAlign: 'center',
                                maxWidth: 400
                            }}>
                                {successModalConfig.message}
                            </Text>

                            {!isDisplayOnly && (
                                <View style={{
                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                    borderRadius: 999,
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.2)'
                                }}>
                                    <Text style={{
                                        color: 'white',
                                        fontSize: isTablet ? 14 : 12,
                                        fontWeight: '700',
                                        textAlign: 'center'
                                    }}>
                                        Mode cetak: {receiptPrintMode === 'auto' ? 'Otomatis' : 'Manual'}
                                    </Text>
                                </View>
                            )}

                            {/* Preparation Time Info — shown to User Display only */}
                            {isDisplayOnly && storeSettings?.preparation_duration_minutes && (
                                <View style={{
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    borderRadius: 16,
                                    paddingVertical: 16,
                                    paddingHorizontal: 24,
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.35)',
                                    width: '100%',
                                    maxWidth: 320,
                                }}>
                                    <Text style={{ fontSize: 28, marginBottom: 4 }}>⏱️</Text>
                                    <Text style={{ color: 'white', fontSize: isTablet ? 16 : 13, textAlign: 'center', opacity: 0.9 }}>
                                        Estimasi waktu penyiapan
                                    </Text>
                                    <Text style={{ color: 'white', fontSize: isTablet ? 36 : 28, fontWeight: 'bold', marginTop: 4 }}>
                                        {storeSettings.preparation_duration_minutes} menit
                                    </Text>
                                </View>
                            )}

                            <View style={{ width: '100%', maxWidth: 300, marginTop: 40, gap: 12 }}>
                                <TouchableOpacity
                                    style={{
                                        backgroundColor: 'white',
                                        paddingVertical: 16,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        shadowColor: "#000",
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 10,
                                        elevation: 5
                                    }}
                                    onPress={async () => {
                                        if (isActuallyDisplay) {
                                            await clearCart();
                                        }
                                        setShowSuccessModal(false);
                                        if (!isPartialSplit) {
                                            if (!isActuallyDisplay) {
                                                // @ts-ignore
                                                navigation.navigate('Main');
                                            }
                                        } else {
                                            setIsPartialSplit(false);
                                        }
                                    }}
                                >
                                    <Text style={{ color: '#22c55e', fontWeight: 'bold', fontSize: 16 }}>
                                        {isPartialSplit ? 'Lanjut Sisa Pembayaran' : (isActuallyDisplay ? 'Pesan Baru Sekarang' : 'Kembali ke Utama')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginTop: 12,
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
                                    {isManualOffline ? 'MANUAL OFFLINE' : (isOnline ? 'ONLINE' : 'OFFLINE')}
                                </Text>
                            </View>

                            {!isPartialSplit && (
                                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 24 }}>
                                    Otomatis kembali dalam {countdown} detik.
                                </Text>
                            )}
                        </View>
                    </SafeAreaView>
                </Modal>
                {/* Member Login Modal */}
                <Modal visible={showMemberLoginModal} transparent animationType="fade" onRequestClose={skipMemberLogin}>
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={skipMemberLogin}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={[styles.modalContent, { maxWidth: 500, width: '90%' }]}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                    <Text style={{ fontSize: 20 }}>👤</Text>
                                </View>
                                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1f2937' }}>Member Login</Text>
                                <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 4 }}>Dapatkan poin & diskon khusus member!</Text>
                            </View>

                            <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 20 }}>
                                {/* Left: QR Scan Placeholder */}
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        aspectRatio: 1,
                                        backgroundColor: '#1f2937',
                                        borderRadius: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 150
                                    }}
                                    onPress={() => Alert.alert('Info', 'Fitur Scan QR akan segera hadir!')}
                                >
                                    <View style={{ width: 40, height: 40, borderBlockColor: 'white', borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}>
                                        <Text style={{ color: 'white', fontSize: 20 }}>📷</Text>
                                    </View>
                                    <Text style={{ color: 'white', fontWeight: 'bold', marginTop: 10 }}>Scan QR Member</Text>
                                </TouchableOpacity>

                                {/* Right: Phone Input */}
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <View style={{ marginBottom: 16 }}>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#4b5563', marginBottom: 6 }}>Input Nomor HP</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12 }}>
                                            <Text style={{ color: '#9ca3af', marginRight: 8 }}>📞</Text>
                                            <TextInput
                                                style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: '#111827' }}
                                                placeholder="08xxx"
                                                keyboardType="phone-pad"
                                                value={memberPhone}
                                                onChangeText={setMemberPhone}
                                                onSubmitEditing={checkMember}
                                            />
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.modalButton, { backgroundColor: '#ea580c' }]}
                                        onPress={checkMember}
                                    >
                                        <Text style={styles.confirmButtonText}>Cek Member</Text>
                                    </TouchableOpacity>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 }}>
                                        <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
                                        <Text style={{ fontSize: 10, color: '#9ca3af' }}>ATAU</Text>
                                        <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
                                    </View>

                                    <TouchableOpacity onPress={skipMemberLogin} style={{ alignSelf: 'center' }}>
                                        <Text style={{ color: '#6b7280', fontSize: 12 }}>Lewati, Lanjut sebagai Tamu &rsaquo;</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>




                {/* Customer Selection Modal */}
                <Modal visible={showCustomerModal} transparent animationType="fade" onRequestClose={() => setShowCustomerModal(false)}>
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowCustomerModal(false)}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={styles.modalContent}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <Text style={styles.modalTitle}>Pilih Pelanggan</Text>
                            {/* Simple Search for Customer could be added here later */}
                            <ScrollView style={{ maxHeight: 300 }}>
                                {customers.map((cust) => (
                                    <TouchableOpacity
                                        key={cust.id}
                                        style={styles.modalOptionItem}
                                        onPress={() => {
                                            setCustomerName(cust.name);
                                            setSelectedCustomerId(cust.id);
                                            setShowCustomerModal(false);
                                        }}
                                    >
                                        <Text style={styles.modalOptionText}>{cust.name} ({cust.phone || '-'})</Text>
                                    </TouchableOpacity>
                                ))}
                                {customers.length === 0 && <Text style={{ textAlign: 'center', color: '#6b7280' }}>Tidak ada data pelanggan</Text>}
                            </ScrollView>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { marginTop: 16 }]} onPress={() => setShowCustomerModal(false)}>
                                <Text style={styles.cancelButtonText}>Tutup</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>


                {/* Cart Summary Bar (Automatic Appearance) - Only show in Compact mode or Display Mode */}
                {cart.length > 0 && !isSideBySide && !showSuccessModal && (
                    <View style={[
                        styles.cartSummaryBar,
                        isSmallDevice && { bottom: 80, left: 12, right: 12, padding: 8, paddingHorizontal: 14, borderRadius: 16 }
                    ]}>
                        <View style={styles.cartSummaryInfo}>
                            <View style={[
                                styles.cartCountBadge,
                                isSmallDevice && { width: 20, height: 20 }
                            ]}>
                                <Text style={[
                                    styles.cartCountText,
                                    isSmallDevice && { fontSize: 10 }
                                ]}>{cart.reduce((a, b) => a + b.quantity, 0)}</Text>
                            </View>
                            <View style={{ marginLeft: isSmallDevice ? 8 : 12 }}>
                                <Text style={[
                                    styles.cartTotalLabel,
                                    isSmallDevice && { fontSize: 8 }
                                ]}>Total Pesanan</Text>
                                <Text style={[
                                    styles.cartTotalValue,
                                    isSmallDevice && { fontSize: 14 }
                                ]}>{formatCurrency(calculateTotal())}</Text>
                                {orderDiscount > 0 && <Text style={{ fontSize: 9, color: '#fca5a5' }}>Diskon: -{formatCurrency(orderDiscount)}</Text>}
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.checkoutButton,
                                isSmallDevice && { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }
                            ]}
                            onPress={() => setShowCartModal(true)}
                        >
                            <Text style={[
                                styles.checkoutButtonText,
                                isSmallDevice && { fontSize: 11 }
                            ]}>Keranjang &rsaquo;</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Cart Modal */}
                <Modal visible={showCartModal} transparent animationType="slide" onRequestClose={() => setShowCartModal(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, styles.cartModalContent]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Keranjang Pesanan</Text>
                                <TouchableOpacity onPress={() => setShowCartModal(false)}>
                                    <Text style={{ fontSize: 24, color: '#6b7280' }}>&times;</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Quick Actions Row */}
                            <View style={styles.quickActionsRow}>
                                {!isDisplayOnly && (
                                    <TouchableOpacity
                                        style={styles.quickActionBtn}
                                        onPress={() => {
                                            if (isAdmin || !storeSettings?.restrict_manual_item) {
                                                setShowManualItemModal(true);
                                            } else {
                                                setPendingAuth({ action: 'manual' });
                                                setShowDeleteAuthModal(true);
                                            }
                                        }}
                                    >
                                        <Text style={styles.quickActionIcon}>➕</Text>
                                        <Text style={styles.quickActionText}>Manual</Text>
                                    </TouchableOpacity>
                                )}
                                {!isDisplayOnly && (
                                    <>
                                        <TouchableOpacity
                                            style={styles.quickActionBtn}
                                            onPress={() => {
                                                if (isAdmin || !storeSettings?.restrict_discount) {
                                                    setShowDiscountModal(true);
                                                } else {
                                                    setPendingAuth({ action: 'discount' });
                                                    setShowDeleteAuthModal(true);
                                                }
                                            }}
                                        >
                                            <Text style={styles.quickActionIcon}>🏷️</Text>
                                            <Text style={styles.quickActionText}>Diskon</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            style={styles.quickActionBtn} 
                                            onPress={() => {
                                                if (isAdmin || !storeSettings?.restrict_split_bill) {
                                                    setShowSplitBillModal(true);
                                                } else {
                                                    setPendingAuth({ action: 'split' });
                                                    setShowDeleteAuthModal(true);
                                                }
                                            }}
                                        >
                                            <Text style={styles.quickActionIcon}>✂️</Text>
                                            <Text style={styles.quickActionText}>Pisah</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                                {!isDisplayOnly && (
                                    <TouchableOpacity
                                        style={styles.quickActionBtn}
                                        onPress={() => {
                                            if (isAdmin || !storeSettings?.restrict_hold_order) {
                                                setShowHoldNoteModal(true);
                                            } else {
                                                setPendingAuth({ action: 'hold' });
                                                setShowDeleteAuthModal(true);
                                            }
                                        }}
                                    >
                                        <Text style={styles.quickActionIcon}>⏸️</Text>
                                        <Text style={styles.quickActionText}>Hold</Text>
                                    </TouchableOpacity>
                                )}
                                {!isDisplayOnly && (
                                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowHeldOrdersModal(true)}>
                                        <Text style={styles.quickActionIcon}>📂</Text>
                                        <Text style={styles.quickActionText}>Daftar</Text>
                                    </TouchableOpacity>
                                )}
                                {isDisplayOnly && (
                                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 'bold' }}>MENU PESANAN</Text>
                                    </View>
                                )}
                            </View>

                            {/* NEW: Table & Cashier Row inside Cart Modal for Cashiers */}
                            {!isDisplayOnly && (
                                <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fafafa' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#6b7280', marginBottom: 4 }}>NOMOR MEJA</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 8 }}>
                                            <Text style={{ fontSize: 12 }}>📝</Text>
                                            <TextInput
                                                style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 4, fontSize: 14, fontWeight: 'bold', color: '#111827' }}
                                                value={selectedTable === '-' ? '' : selectedTable}
                                                onChangeText={(text) => setSelectedTable(text || '-')}
                                                autoCapitalize="characters"
                                            />
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={{ flex: 1.5 }}
                                        onPress={() => setShowWaiterModal(true)}
                                    >
                                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#6b7280', marginBottom: 4 }}>KASIR</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 8, height: 42 }}>
                                            <Text style={{ fontSize: 12 }}>👨‍🍳</Text>
                                            <Text style={{ flex: 1, paddingHorizontal: 4, fontSize: 14, color: selectedWaiter ? '#111827' : '#94a3b8' }}>
                                                {selectedWaiter || 'Pilih Kasir'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: 12 }}>
                                {cart.map((item) => (
                                    <View key={item.id} style={{ marginBottom: 12, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#eef2f7', padding: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{item.name}{item.is_taxed !== false ? '*' : ''}</Text>
                                                <Text style={{ fontSize: 13, color: '#ea580c', fontWeight: '800', marginTop: 4 }}>{formatCurrency(item.price)}</Text>
                                                <TextInput
                                                    style={{ backgroundColor: '#fff7ed', borderRadius: 8, padding: 8, marginTop: 8, fontSize: 12 }}
                                                    placeholder="Catatan..."
                                                    value={item.notes}
                                                    onChangeText={(text) => updateNote(item.id, text)}
                                                />
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: '#e2e8f0', marginLeft: 12 }}>
                                                <TouchableOpacity onPress={() => removeFromCart(item.id)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ fontSize: 18, fontWeight: 'bold' }}>-</Text></TouchableOpacity>
                                                <Text style={{ fontWeight: 'bold', marginHorizontal: 8, fontSize: 14 }}>{item.quantity}</Text>
                                                <TouchableOpacity onPress={() => addToCart(item)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ea580c' }}>+</Text></TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>

                            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#eceff3', backgroundColor: 'white', gap: 6 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: '#64748b' }}>Subtotal</Text>
                                    <Text style={{ fontWeight: '600' }}>{formatCurrency(calculateSubtotal())}</Text>
                                </View>
                                {orderDiscount > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: '#ef4444' }}>Diskon</Text>
                                        <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>-{formatCurrency(orderDiscount)}</Text>
                                    </View>
                                )}
                                {calculateServiceAmount() > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: '#64748b' }}>Layanan</Text>
                                        <Text style={{ fontWeight: '600' }}>{formatCurrency(calculateServiceAmount())}</Text>
                                    </View>
                                )}
                                {calculateTaxAmount() > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: '#64748b' }}>Pajak</Text>
                                        <Text style={{ fontWeight: '600' }}>{formatCurrency(calculateTaxAmount())}</Text>
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12, marginTop: 6 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '800' }}>Total</Text>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#ea580c' }}>{formatCurrency(calculateTotal())}</Text>
                                </View>
                                <TouchableOpacity
                                    style={{ backgroundColor: '#ea580c', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12, opacity: cart.length === 0 ? 0.5 : 1 }}
                                    onPress={handleCheckout}
                                    disabled={cart.length === 0}
                                >
                                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>
                                        {isActuallyDisplay ? 'Kirim Pesanan Sekarang' : (existingSaleId ? 'Perbarui Pesanan' : 'Lanjut Pembayaran')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Cashier Selection Modal */}
                <Modal
                    visible={showWaiterModal}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowWaiterModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Pilih Kasir</Text>
                                <TouchableOpacity onPress={() => setShowWaiterModal(false)}>
                                    <Text style={{ fontSize: 24, color: '#6b7280' }}>&times;</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                                <TextInput
                                    style={{
                                        backgroundColor: '#f3f4f6',
                                        borderRadius: 8,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        fontSize: 14,
                                        borderWidth: 1,
                                        borderColor: '#e5e7eb'
                                    }}
                                    placeholder="Cari nama kasir..."
                                    value={waiterSearchQuery}
                                    onChangeText={setWaiterSearchQuery}
                                />
                            </View>

                            <ScrollView style={{ paddingHorizontal: 16 }}>
                                <TouchableOpacity
                                    style={{
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#f3f4f6',
                                        backgroundColor: selectedWaiter === '' ? '#fff7ed' : 'transparent'
                                    }}
                                    onPress={() => { setSelectedWaiter(''); setShowWaiterModal(false); }}
                                >
                                    <Text style={{ fontSize: 15, color: '#6b7280' }}>-- Tanpa Kasir --</Text>
                                </TouchableOpacity>
                                {waiters
                                    .filter(w => (w.name || '').toLowerCase().includes(waiterSearchQuery.toLowerCase()))
                                    .map((w) => (
                                        <TouchableOpacity
                                            key={w.id}
                                            style={{
                                                paddingVertical: 14,
                                                borderBottomWidth: 1,
                                                borderBottomColor: '#f3f4f6',
                                                backgroundColor: selectedWaiter === w.name ? '#fff7ed' : 'transparent'
                                            }}
                                            onPress={() => {
                                                setSelectedWaiter(w.name);
                                                setShowWaiterModal(false);
                                                setWaiterSearchQuery('');
                                            }}
                                        >
                                            <Text style={{ fontSize: 16, color: '#111827', fontWeight: selectedWaiter === w.name ? 'bold' : 'normal' }}>{w.name}</Text>
                                            {w.position && <Text style={{ fontSize: 12, color: '#6b7280' }}>{w.position}</Text>}
                                        </TouchableOpacity>
                                    ))}
                                {waiters.length === 0 && (
                                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                        <Text style={{ color: '#94a3b8' }}>Daftar karyawan tidak ditemukan</Text>
                                    </View>
                                )}
                            </ScrollView>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton, { margin: 16 }]}
                                onPress={() => setShowWaiterModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Batal</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                <ManualItemModal
                    visible={showManualItemModal}
                    onClose={() => setShowManualItemModal(false)}
                    onAdd={handleAddManualItem}
                />

                <DiscountModal
                    visible={showDiscountModal}
                    currentTotal={calculateSubtotal()}
                    onClose={() => setShowDiscountModal(false)}
                    onApply={handleApplyDiscount}
                />

                <SplitBillModal
                    visible={showSplitBillModal}
                    items={cart}
                    orderDiscount={orderDiscount}
                    totalSubtotal={calculateSubtotal()}
                    onClose={() => setShowSplitBillModal(false)}
                    onSplit={(splitItems) => {
                        setSplitItemsToPay(splitItems);
                        setIsSplitPayment(true);
                        setShowSplitBillModal(false);
                        setShowPaymentModal(true);
                    }}
                />

                <HeldOrdersModal
                    visible={showHeldOrdersModal}
                    orders={[...heldOrders, ...remoteOrders]}
                    onClose={() => setShowHeldOrdersModal(false)}
                    onRestore={handleRestoreHeldOrder}
                    onDelete={(isAdmin || !storeSettings?.restrict_cashier_delete) ? handleDeleteHeldOrder : undefined}
                    onRefresh={() => fetchRemotePendingOrders(true)}
                    isRefreshing={isFetchingRemote}
                />

                <ReceiptPreviewModal
                    visible={showReceiptPreview}
                    orderData={previewOrderData}
                    onClose={() => setShowReceiptPreview(false)}
                    onPrint={() => {
                        if (previewOrderData) {
                            handlePrintReceipt(previewOrderData.id, previewOrderData.order_no);
                        }
                    }}
                />

                <ManagerAuthModal
                    visible={showDeleteAuthModal}
                    onClose={() => {
                        setShowDeleteAuthModal(false);
                        setPendingAuth(null);
                    }}
                    onSuccess={handleAuthSuccess}
                    title={
                        pendingAuth?.action === 'discount' ? "Otorisasi Diskon" :
                        pendingAuth?.action === 'hold' ? "Otorisasi Tahan Pesanan" :
                        pendingAuth?.action === 'manual' ? "Otorisasi Item Manual" :
                        pendingAuth?.action === 'split' ? "Otorisasi Split Bill" :
                        "Otorisasi Manager"
                    }
                />

                {/* Manual Table Modal */}
                <Modal
                    visible={showTableManualModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowTableManualModal(false)}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ backgroundColor: 'white', width: '85%', borderRadius: 20, padding: 24, elevation: 5 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#111827' }}>Nomor Meja</Text>
                            <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>Masukkan nomor meja secara manual:</Text>

                            <TextInput
                                style={{
                                    backgroundColor: '#f3f4f6',
                                    borderRadius: 12,
                                    padding: 16,
                                    fontSize: 18,
                                    fontWeight: 'bold',
                                    color: '#111827',
                                    textAlign: 'center',
                                    borderWidth: 1,
                                    borderColor: '#e5e7eb'
                                }}
                                placeholder="Contoh: A1"
                                autoFocus
                                value={manualTableInput}
                                onChangeText={setManualTableInput}
                                autoCapitalize="characters"
                            />

                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                                <TouchableOpacity
                                    style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' }}
                                    onPress={() => setShowTableManualModal(false)}
                                >
                                    <Text style={{ fontWeight: 'bold', color: '#4b5563' }}>Batal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#ea580c', alignItems: 'center' }}
                                    onPress={() => {
                                        setSelectedTable(manualTableInput.trim().toUpperCase() || '-');
                                        setShowTableManualModal(false);
                                    }}
                                >
                                    <Text style={{ fontWeight: 'bold', color: 'white' }}>Simpan</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

            </View>
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
    headerBackButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
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
        paddingVertical: 2,
        paddingHorizontal: 12,
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
        fontSize: 11,
        fontWeight: '600',
        color: '#111827',
    },
    infoBarDivider: {
        width: 1,
        height: 16,
        backgroundColor: '#f3f4f6',
    },
    backButtonText: {
        fontSize: 22,
    },
    searchContainer: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: 'white',
    },
    orderTypeRow: {
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 8,
        paddingBottom: 4,
        paddingTop: 1,
        backgroundColor: 'white',
    },
    orderTypeChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
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
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 8,
        color: '#111827',
        fontSize: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    categoryContainer: {
        backgroundColor: 'white',
        paddingVertical: 3,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    categoryScroll: {
        paddingHorizontal: 8,
        gap: 6,
    },
    categoryTab: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    activeCategoryTab: {
        backgroundColor: '#ea580c',
        borderColor: '#ea580c',
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4b5563',
        textTransform: 'uppercase', // More premium look
        letterSpacing: 0.3
    },
    activeCategoryText: {
        color: 'white',
    },
    productListContent: {
        paddingHorizontal: 4,
        paddingVertical: 4,
        paddingBottom: 200, // Extra space for cart bar
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
        aspectRatio: 1, // Robust square look
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
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
    // Modals & Options
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
    // New Cart Styles
    cartSummaryBar: {
        position: 'absolute',
        bottom: 20,
        left: 12,
        right: 12,
        backgroundColor: '#111827',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        paddingHorizontal: 16,
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
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartCountText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    cartTotalLabel: {
        color: '#9ca3af',
        fontSize: 10,
        textTransform: 'uppercase',
    },
    cartTotalValue: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    checkoutButton: {
        backgroundColor: '#ea580c',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    checkoutButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    // Detailed Cart Modal Styles
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
    // Modern Success Modal Styles
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
});
