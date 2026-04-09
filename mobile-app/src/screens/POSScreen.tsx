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
import { Wifi, WifiOff, Star } from 'lucide-react-native';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import ManagerAuthModal from '../components/ManagerAuthModal';
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

            {item.is_best_seller && (
                <View style={{
                    position: 'absolute',
                    top: 5,
                    left: 5,
                    backgroundColor: '#f97316',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    elevation: 3,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 1.41,
                }}>
                    <Star size={8} color="white" fill="white" style={{ marginRight: 2 }} />
                    <Text style={{ color: 'white', fontSize: 7, fontWeight: 'bold' }}>Terlaris</Text>
                </View>
            )}
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
    // [FULL SCREEN FOR FOLDABLES] Heighten threshold to 900 to keep 100% menu width on Samsung Fold 3 (unfolded width ~674px)
    const isSideBySide = width >= 900;


    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const [categories, setCategories] = useState<string[]>([
        'Semua', 
        'Makanan Terlaris', 
        'Minuman Terlaris', 
        'Snack Terlaris', 
        'Produk Terlaris'
    ]);
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
    const [selectedTable, setSelectedTable] = useState('-');
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
    const [isPartialSplit, setIsPartialSplit] = useState(false);
    const [remoteOrders, setRemoteOrders] = useState<any[]>([]);
    const [isFetchingRemote, setIsFetchingRemote] = useState(false);
    const lastFetchTime = React.useRef(0);
    const fetchInProgress = React.useRef(false);
    const fetchTimeoutRef = React.useRef<any>(null);
    const isFirstRender = React.useRef(true);

    // Manager Auth state
    const [showManagerAuth, setShowManagerAuth] = useState(false);
    const [managerAuthTitle, setManagerAuthTitle] = useState('Otorisasi Manager');
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    // Toast State
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');

    const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);
    };

    const handleManagerAuthSuccess = () => {
        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
    };

    // Update cashier mode from storage but default to true if not set

    // Load POS Flow Setting
    useEffect(() => {
        const loadPOSFlow = async () => {
            const savedFlow = await AsyncStorage.getItem('pos_flow');
            if (savedFlow) {
                setPosFlow('direct');
            }

            const savedCashierMode = await AsyncStorage.getItem('cashier_mode');
            if (savedCashierMode !== null) {
                setCashierMode(savedCashierMode === 'true');
            } else {
                setCashierMode(true); // Ensure default true
            }
        };
        loadPOSFlow();
    }, []);

    const { permissions, isDisplayOnly, loading: sessionLoading, isSessionActive, currentSession, branchName, branchAddress, branchPhone, isAdmin, storeSettings, currentBranchId, userName } = useSession();

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




    const handlePrintReceipt = async () => {
        if (!lastSaleId && !lastOrderNo) return;
        
        setIsPrinting(true);
        try {
            const orderData = await fetchOrderDataForReceipt(lastSaleId || lastOrderNo);
            if (!orderData) throw new Error('Order not found');

            // 1. Print Main Receipt
            const success = await PrinterManager.printOrderReceipt(orderData);
            
            // 2. [NEW] Print Kitchen and Bar Tickets
            console.log(`[POSScreen] Starting kitchen/bar prints for items: ${orderData.items.length}`);
            
            await new Promise(resolve => setTimeout(resolve, 1500)); // Delay after main receipt
            const kitchenSuccess = await PrinterManager.printToTarget(orderData.items, 'kitchen', orderData);
            
            await new Promise(resolve => setTimeout(resolve, 1500)); // Increased delay between targets
            const barSuccess = await PrinterManager.printToTarget(orderData.items, 'bar', orderData);

            if (success) {
                showToast('Struk sedang dicetak', 'success');
            } else {
                Alert.alert('Gagal', 'Gagal mencetak struk kasir. Pastikan printer terhubung.');
            }
            
            if (!kitchenSuccess) {
                showToast('Printer Dapur/Kitchen belum diatur atau tidak terhubung', 'error');
            }
            if (!barSuccess) {
                showToast('Printer Bar belum diatur atau tidak terhubung', 'error');
            }

        } catch (e) {
            console.error('Print Error:', e);
            Alert.alert('Error', 'Terjadi kesalahan saat mencetak');
        } finally {
            setIsPrinting(false);
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
                    // [IMPROVED] Use multiplier if set, otherwise fallback to minAmount for per-voucher calculation
                    const effectiveMultiplier = multiplier > 0 ? multiplier : minAmount;
                    let count = 1;
                    
                    if (effectiveMultiplier > 0) {
                        // Ensure at least 1 voucher if min amount is met, otherwise calculate multiples
                        count = Math.max(1, Math.floor(totalAmount / effectiveMultiplier));
                    }

                    console.log(`[POSScreen] WiFi Voucher Logic: total=${totalAmount}, min=${minAmount}, mult=${multiplier}, effective=${effectiveMultiplier}, count=${count}`);

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
                            'Makanan Terlaris', 
                            'Minuman Terlaris', 
                            'Snack Terlaris', 
                            'Produk Terlaris',
                            ...parsed.filter((c: string) => ![ 'Semua', 'Makanan Terlaris', 'Minuman Terlaris', 'Snack Terlaris', 'Produk Terlaris'].includes(c))
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
    useEffect(() => {
        if (!currentBranchId || isDisplayOnly) return;

        const branchIdInt = currentBranchId;
        
        // Initial fetch
        fetchRemotePendingOrders();

        console.log('[POSScreen] Subscribing to real-time orders for branch:', branchIdInt);
        const salesChannel = supabase
            .channel(`pos_realtime_${currentBranchId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sales', filter: `branch_id=eq.${branchIdInt}` },
                (payload) => {
                    console.log('[POSScreen] Real-time sales change detected:', payload.eventType);
                    
                    // 1. Instant UI Feedback for new orders
                    if (payload.eventType === 'INSERT') {
                        const newOrder = payload.new as any;
                        if (newOrder.status === 'Pending' || newOrder.status === 'Unpaid') {
                            showToast(`Pesanan Baru: ${newOrder.order_no || newOrder.id} (Meja: ${newOrder.table_no || '-'})`, 'info');
                        }
                    }

                    // 2. DEBOUNCED List Refresh: Wait 500ms of silence before fetching
                    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
                    fetchTimeoutRef.current = setTimeout(() => {
                        fetchRemotePendingOrders(true);
                    }, 500);
                }
            )
            .subscribe((status) => {
                console.log(`[POSScreen] Sales subscription status for branch ${branchIdInt}: ${status}`);
            });

        return () => {
            console.log('[POSScreen] Unsubscribing from real-time orders');
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
            supabase.removeChannel(salesChannel);
        };
    }, [currentBranchId, isDisplayOnly]);
 

    // DEBUG LOG
    // DEBUG LOG
    useEffect(() => {
        console.log('=== DEBUG CATEGORIES STATE ===', JSON.stringify(categories));
    }, [categories]);


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
                
                // Map items to cart format
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
                console.log('POSScreen: Order loaded successfully');

                // AUTO-CART: Automatically show cart modal for cashier review
                if (cashierMode && !isDisplayOnly) {
                    console.log('POSScreen: Auto-triggering cart modal');
                    setTimeout(() => {
                        setShowCartModal(true);
                    }, 500); // Small delay to ensure state is settled
                }
            }
        } catch (error) {
            console.error('Error loading order by ID:', error);
        }
    };


    const fetchMasterData = async () => {
        try {
            const authorizedRoles = ['Manager', 'Manajer', 'Owner', 'Administrator', 'Admin', 'Supervisor'];
            
            // Parallelize all master data fetches
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
                .select('product_name, quantity, sales!inner(date)')
                .eq('branch_id', currentBranchId)
                .gte('sales.date', thirtyDaysAgo.toISOString());

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
                    'Makanan Terlaris', 
                    'Minuman Terlaris', 
                    'Snack Terlaris', 
                    'Produk Terlaris',
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
        setLoadingProducts(true);
        try {
            // Speed optimization: Select only required columns
            const { data, error } = await supabase
                .from('products')
                .select('id, name, price, image_url, category, target, stock, is_taxed, branch_id, sort_order, is_sellable, is_stock_ready')
                .eq('branch_id', currentBranchId)
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

    const fetchTopSellingProducts = async () => {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data, error } = await supabase
                .from('sale_items')
                .select('product_name, quantity, sales!inner(date)')
                .eq('branch_id', currentBranchId)
                .gte('sales.date', thirtyDaysAgo.toISOString());

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
            console.error('Failed to fetch top selling products mobile:', err);
        }
    };


    // Filter Logic
    const filteredProducts = useMemo(() => {
        let result = products;

        // 1. Filter out products that are NOT sellable or NOT ready (Kosong)
        result = result.filter(p => p.is_sellable !== false && p.is_stock_ready !== false);

        // 2. Filter by Category
        if (selectedCategory === 'Makanan Terlaris') {
            result = result.filter(p => topSellingProducts.includes(p.name) && (p.category || '').toLowerCase().includes('makan'));
        } else if (selectedCategory === 'Minuman Terlaris') {
            result = result.filter(p => topSellingProducts.includes(p.name) && (p.category || '').toLowerCase().includes('minum'));
        } else if (selectedCategory === 'Snack Terlaris') {
            result = result.filter(p => topSellingProducts.includes(p.name) && (p.category || '').toLowerCase().includes('snack'));
        } else if (selectedCategory === 'Produk Terlaris') {
            result = result.filter(p => topSellingProducts.includes(p.name) && (p.category || '').toLowerCase().includes('kemasan'));
        } else if (selectedCategory === 'Terlaris') {
            result = result.filter(p => topSellingProducts.includes(p.name));
        } else if (selectedCategory !== 'Semua') {
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
            .map(p => ({
                ...p,
                is_best_seller: topSellingProducts.includes(p.name)
            }))
            .sort((a, b) => {
                if (a.is_best_seller && !b.is_best_seller) return -1;
                if (!a.is_best_seller && b.is_best_seller) return 1;
                return (a.sort_order || 0) - (b.sort_order || 0);
            });
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
        let target = product.target || 'Kitchen';
        
        // Fallback heuristic if target is not defined or is 'Waitress'
        if (target === 'Waitress' || !product.target) {
            const categoryLow = (product.category_name || product.category || '').toLowerCase();
            if (categoryLow.includes('makan') || categoryLow.includes('food')) target = 'Kitchen';
            else if (categoryLow.includes('minum') || categoryLow.includes('drink') || categoryLow.includes('bar') || categoryLow.includes('coffee')) target = 'Bar';
        }

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

    const clearCart = useCallback(() => {
        setCart([]);
        setCustomerName('Guest');
        setSelectedCustomerId(null);
        setSelectedTable('-');
        setOrderDiscount(0);
        setExistingSaleId(null);
        // Drafts will be overwritten by useEffect
    }, []);

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
        const taxRate = storeSettings?.tax_rate || 0;
        
        return (taxableSubtotal * taxRate) / 100;
    };

    const calculateServiceAmount = () => {
        const taxableSubtotal = calculateTaxableSubtotal();
        const serviceRate = storeSettings?.service_rate || 0;
        
        return (taxableSubtotal * serviceRate) / 100;
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
        
        const newHeldOrder = {
            id: `held-${Date.now()}`,
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

        if (storeSettings?.print_kds_on_hold) {
            try {
                const orderDataForPrint = {
                    orderNo: `HOLD-${Date.now().toString().slice(-4)}`,
                    tableNo: selectedTable,
                    customerName: customerName,
                    waiterName: selectedWaiter || userName,
                    date: new Date(),
                    notes: note,
                    cashier_name: userName
                };
                await PrinterManager.printToTarget(cart, 'kitchen', orderDataForPrint);
                await PrinterManager.printToTarget(cart, 'bar', orderDataForPrint);
                showToast('Pesanan ditangguhkan & tiket dikirim ke dapur!', 'success');
            } catch (err) {
                console.error("Print KDS on Hold Error:", err);
                showToast('Pesanan ditangguhkan, namun gagal print ke dapur', 'error');
            }
        } else {
            showToast('Pesanan ditangguhkan', 'success');
        }

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
        setHeldOrders(prev => prev.filter(h => h.id !== id));
    };

    // Helper for invoice numbering
    const generateOrderNo = (online: boolean) => {
        const mode = online ? storeSettings?.invoice_mode : (storeSettings?.offline_invoice_mode || 'auto');
        const prefix = online ? (storeSettings?.invoice_prefix || 'INV') : (storeSettings?.offline_invoice_prefix || 'OFF');
        const lastNumber = online ? (Number(storeSettings?.invoice_last_number) || 0) : (Number(storeSettings?.offline_invoice_last_number) || 0);

        if (mode === 'auto') {
            const nextNumber = lastNumber + 1;
            const newNo = `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
            
            if (online) {
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
            return;
        }

        if (sessionLoading) {
            Alert.alert('Satu Momen', 'Sedang mensinkronisasi data pengguna...');
            return;
        }

        if (cart.length === 0) {
            Alert.alert('Info', 'Keranjang masih kosong');
            return;
        }


        if (cashierMode && !isActuallyDisplay) {
            setShowPaymentModal(true);
            return;
        }

        try {
            if (!currentBranchId) {
            Alert.alert('Error', 'Data cabang belum dimuat. Silakan tunggu atau login ulang.');
            return;
        }

        const totalAmount = calculateTotal();
            
            if (existingSaleId) {
                // Update Existing Sale
                const { data: updatedSale, error: saleError } = await supabase
                    .from('sales')
                    .update({
                        customer_name: customerName,
                        customer_id: selectedCustomerId,
                        waiter_name: selectedWaiter,
                        total_amount: totalAmount,
                        discount: orderDiscount,
                        tax: calculateTaxAmount(),
                        service_charge: calculateServiceAmount(),
                        date: new Date().toISOString()
                    })
                    .eq('id', existingSaleId)
                    .select()
                    .single();

                if (saleError) throw saleError;

                // Delete old items and insert new ones (simpler than syncing)
                await supabase.from('sale_items').delete().eq('sale_id', existingSaleId);
                
                const itemsToInsert = cart.map(item => ({
                    sale_id: existingSaleId,
                    product_id: typeof item.id === 'string' && item.id.startsWith('manual') ? null : item.id,
                    product_name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    cost: 0,
                    target: item.target || 'Waitress',
                    status: 'Pending',
                    is_taxed: item.is_taxed || false,
                    notes: item.notes || ''
                }));

                const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;

                setLastOrderNo(updatedSale.order_no || '');
                setLastSaleId(String(existingSaleId) || '');
                setSuccessModalConfig({
                    title: 'Pesanan Terkirim!',
                    message: isActuallyDisplay ? 'Pesanan berhasil dikirim ke kasir' : 'Pesanan berhasil diperbarui'
                });
                setShowSuccessModal(true);
            } else {
                // Create New Sale
                const effectiveOnline = isOnline && !isManualOffline;
                const orderNo = generateOrderNo(effectiveOnline); // Respect manual offline toggle
                const { data: sale, error: saleError } = await supabase
                    .from('sales')
                    .insert([{
                        order_no: orderNo,
                        branch_id: currentBranchId,
                        customer_name: customerName,
                        customer_id: selectedCustomerId,
                        table_no: selectedTable,
                        waiter_name: selectedWaiter,
                        total_amount: totalAmount,
                        status: 'Pending',
                        payment_method: 'Tunai',
                        discount: orderDiscount,
                        tax: calculateTaxAmount(),
                        service_charge: calculateServiceAmount(),
                        date: new Date().toISOString()
                    }])
                    .select()
                    .single();

                if (saleError) throw saleError;

                const itemsToInsert = cart.map(item => ({
                    sale_id: sale.id,
                    product_id: typeof item.id === 'string' && item.id.startsWith('manual') ? null : item.id,
                    product_name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    cost: 0,
                    target: item.target || 'Waitress',
                    status: 'Pending',
                    is_taxed: item.is_taxed || false,
                    notes: item.notes || ''
                }));

                const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;
                
                setLastOrderNo(orderNo);
                setLastSaleId(sale.id);
                setCurrentSaleId(sale.id);
                setSuccessModalConfig({
                    title: 'Pesanan Terkirim!',
                    message: isActuallyDisplay ? 'Pesanan telah terkirim ke kasir' : 'Pesanan baru berhasil dibuat'
                });
                setShowSuccessModal(true);
            }


            clearCart();
            setShowCartModal(false);
            setExistingSaleId(null);

        } catch (error: any) {
            console.error('Checkout Error:', error);
            
            // Check if it's a network error (Supabase usually returns specific error codes or just fails)
            // We'll queue it if it's not a business logic error
            if (!existingSaleId) {
                const totalAmount = calculateTotal();
                // REGENERATED with Offline Prefix for fallback
                const orderNo = (storeSettings?.offline_invoice_mode === 'auto') 
                    ? `${storeSettings?.offline_invoice_prefix || 'OFF'}-${(Number(storeSettings?.offline_invoice_last_number) + 1).toString().padStart(4, '0')}`
                    : `OFF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
                
                // Increment offline counter in DB even if we are offline (it will be non-blocking)
                if (storeSettings?.offline_invoice_mode === 'auto') {
                    const nextNum = Number(storeSettings?.offline_invoice_last_number) + 1;
                    supabase.from('store_settings').update({ offline_invoice_last_number: nextNum }).eq('id', 1).then(() => {});
                }

                const saleData = {
                    order_no: orderNo,
                    branch_id: currentBranchId,
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
                    setLastOrderNo(orderNo);
                    setSuccessModalConfig({
                        title: 'Tersimpan Offline!',
                        message: 'Koneksi bermasalah. Pesanan disimpan di HP dan akan dikirim saat internet aktif kembali.'
                    });
                    setShowSuccessModal(true);
                    clearCart();
                    setShowCartModal(false);
                    return;
                }

            Alert.alert('Error', 'Gagal memproses pesanan: ' + error.message);
        }
    };
    };

    const handlePaymentConfirm = async (paymentData: { method: string; amount: number; change: number }) => {
        if (!currentBranchId) {
            Alert.alert('Error', 'Data cabang belum dimuat.');
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

            // 1. Create or Update Sale
            let sale: any = null;
            let orderNoText = '';

            // [FIXED] If it's a split payment, ALWAYS create a NEW sale record.
            // Only update the existingSaleId if it's a FINAL full payment (!isSplitPayment).
            if (existingSaleId && !isSplitPayment) {
                const { data: updatedSale, error: saleError } = await supabase
                    .from('sales')
                    .update({
                        customer_name: customerName,
                        customer_id: selectedCustomerId,
                        table_no: selectedTable || '-',
                        waiter_name: selectedWaiter || userName, // [FIXED]
                        total_amount: finalTotal,
                        discount: currentDiscount,
                        tax: currentTax,
                        service_charge: currentService,

                        status: 'Paid',
                        payment_method: paymentData.method,
                        paid_amount: paymentData.amount,
                        change: paymentData.change,
                        date: new Date().toISOString()
                    })
                    .eq('id', existingSaleId)
                    .select()
                    .single();
                
                if (saleError) throw saleError;
                sale = updatedSale;
                orderNoText = updatedSale.order_no;
                
                // Clear existing items if updating, to be replaced by current cart
                const { error: deleteError } = await supabase.from('sale_items').delete().eq('sale_id', existingSaleId);
                if (deleteError) console.warn('Failed to clear old items:', deleteError);
            } else {
                const effectiveOnline = isOnline && !isManualOffline;
                orderNoText = generateOrderNo(effectiveOnline); // Attempt prefix based on manual toggle
                try {
                    const { data: newSale, error: saleError } = await supabase
                        .from('sales')
                        .insert([{
                            order_no: orderNoText,
                            branch_id: currentBranchId,
                            customer_name: customerName,
                            customer_id: selectedCustomerId,
                            table_no: selectedTable || '-',
                            waiter_name: selectedWaiter || userName, // [FIXED]
                            total_amount: finalTotal,
                            discount: currentDiscount,
                            tax: currentTax,
                            service_charge: currentService,

                            status: 'Paid',
                            payment_method: paymentData.method,
                            paid_amount: paymentData.amount,
                            change: paymentData.change,
                            date: new Date().toISOString()
                        }])
                        .select()
                        .single();

                    if (saleError) throw saleError;
                    sale = newSale;
                } catch (err) {
                    console.log('[POSScreen] Online payment save failed, falling back to offline:', err);
                    
                    // REGENERATE with Offline Prefix for fallback
                    orderNoText = (storeSettings?.offline_invoice_mode === 'auto')
                        ? `${storeSettings?.offline_invoice_prefix || 'OFF'}-${(Number(storeSettings?.offline_invoice_last_number) + 1).toString().padStart(4, '0')}`
                        : `OFF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
                    
                    // Increment offline counter in DB non-blocking
                    if (storeSettings?.offline_invoice_mode === 'auto') {
                        const nextNum = Number(storeSettings?.offline_invoice_last_number) + 1;
                        supabase.from('store_settings').update({ offline_invoice_last_number: nextNum }).eq('id', 1).then(() => {});
                    }

                    const offlineSaleData = {
                        order_no: orderNoText,
                        branch_id: currentBranchId,
                        customer_name: customerName,
                        customer_id: selectedCustomerId,
                        table_no: selectedTable || '-',
                        waiter_name: userName || selectedWaiter,
                        total_amount: finalTotal,
                        discount: currentDiscount,
                        tax: currentTax,
                        service_charge: currentService,
                        status: 'Paid',
                        payment_method: paymentData.method,
                        paid_amount: paymentData.amount,
                        change: paymentData.change,
                        date: new Date().toISOString()
                    };

                    const success = await OfflineService.queueOfflineSale(offlineSaleData, itemsToProc);
                    if (success) {
                        setLastOrderNo(orderNoText);
                        setLastSaleId(''); // No UUID for offline yet
                        setSuccessModalConfig({
                            title: 'Tersimpan Offline!',
                            message: 'Pembayaran diterima dan disimpan lokal karena gangguan koneksi.'
                        });
                        setShowSuccessModal(true);
                        clearCart();
                        setShowPaymentModal(false);
                        return; // Exit early as it's handled offline
                    }
                    throw err; // Rethrow if offline queuing also fails
                }
            }

            // 2. Create Sale Items
            const itemsToInsert = itemsToProc.map(item => ({
                sale_id: sale.id,
                product_id: typeof item.id === 'string' && item.id.startsWith('manual') ? null : item.id,
                product_name: item.name,
                quantity: item.quantity,
                price: item.price,
                cost: 0,
                target: item.target || 'Waitress',
                status: 'Pending',
                is_taxed: item.is_taxed || false,
                notes: item.notes || ''
            }));

            const { error: itemsError } = await supabase
                .from('sale_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

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
                
                // [FIXED] If we are splitting an existing held order, 
                // we must update the original record to remove the paid items.
                if (existingSaleId) {
                    try {
                        // Calculate remaining totals
                        const remSubtotal = newCart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
                        const totalSubtotal = calculateSubtotal(); 
                        const remRatio = totalSubtotal > 0 ? remSubtotal / totalSubtotal : 0;
                        
                        const remDiscount = orderDiscount * remRatio;
                        const remTax = calculateTaxAmount() * remRatio;
                        const remService = calculateServiceAmount() * remRatio;
                        const remTotal = Math.max(0, remSubtotal - remDiscount + remTax + remService);

                        await supabase.from('sales').update({
                            total_amount: remTotal,
                            discount: remDiscount,
                            tax: remTax,
                            service_charge: remService,
                            date: new Date().toISOString()
                        }).eq('id', existingSaleId);

                        // Update items for original sale
                        await supabase.from('sale_items').delete().eq('sale_id', existingSaleId);
                        const remItemsToInsert = newCart.map((item: any) => ({
                            sale_id: existingSaleId,
                            product_id: typeof item.id === 'string' && item.id.startsWith('manual') ? null : item.id,
                            product_name: item.name,
                            quantity: item.quantity,
                            price: item.price,
                            cost: 0,
                            target: item.target || 'Waitress',
                            status: 'Pending',
                            is_taxed: item.is_taxed || false
                        }));
                        await supabase.from('sale_items').insert(remItemsToInsert);
                        console.log('[POSScreen] Original held order updated successfully after split.');
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
            } else {
                // Clear Cart
                clearCart();
                setOrderDiscount(0);
                setExistingSaleId(null);
                setIsPartialSplit(false); // Ensure final mode
                

                setLastOrderNo(orderNoText);
                setLastSaleId(sale.id);
                setSuccessModalConfig({
                    title: 'Pembayaran Berhasil!',
                    message: 'Transaksi telah selesai dan pembayaran diterima.'
                });
                setShowSuccessModal(true);

                // Auto Print Logic
                const savedAutoPrint = await AsyncStorage.getItem('auto_print');
                if (savedAutoPrint === 'true') {
                    // Slight delay to ensure sequence of state updates doesn't conflict
                    setTimeout(() => {
                        handlePrintReceipt();
                    }, 1000);
                }
            }
            setShowPaymentModal(false);
            setShowCartModal(false);
            setCurrentSaleId(sale.id);
        } catch (error: any) {
            console.error('Payment Confirm Error:', error);

            // Queue Payment Offline
            if (!isSplitPayment) {
                const finalTotal = calculateTotal();
                const orderNoText = generateOrderNo(false);
                
                const saleData = {
                    order_no: orderNoText,
                    branch_id: currentBranchId,
                    customer_name: customerName,
                    customer_id: selectedCustomerId,
                    table_no: selectedTable || '-',
                    waiter_name: userName || selectedWaiter,
                    total_amount: finalTotal,
                    discount: orderDiscount,
                    status: 'Paid',
                    payment_method: paymentData.method,
                    paid_amount: paymentData.amount,
                    change: paymentData.change,
                };

                const success = await OfflineService.queueOfflineSale(saleData, cart);
                if (success) {
                    clearCart();
                    setOrderDiscount(0);
                    setExistingSaleId(null);
                    setLastOrderNo(orderNoText);
                    setLastSaleId(''); // Manual offline has no UUID yet
                    setSuccessModalConfig({
                        title: 'Pembayaran Offline!',
                        message: 'Pembayaran disimpan di HP. Silakan sinkronisasi di Pengaturan setelah internet aktif.'
                    });
                    setShowSuccessModal(true);
                    setShowPaymentModal(false);
                    setShowCartModal(false);
                    return;
                }
            }
        }
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
            <View style={styles.flex1}>
                {/* Header */}
                <View style={[styles.header, { paddingVertical: 2 }]}>
                    <TouchableOpacity style={[styles.headerBackButton, { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }]} onPress={() => navigation.goBack()}>
                        <Text style={[styles.backButtonText, { fontSize: 40, lineHeight: 40, textAlign: 'center', marginTop: -4 }]}>&lsaquo;</Text>
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.headerTitleText, { fontSize: 14 }]}>{branchName}</Text>
                            <TouchableOpacity 
                                onPress={() => setIsManualOffline(!isManualOffline)}
                                style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    marginLeft: 8, 
                                    backgroundColor: (isOnline && !isManualOffline) ? '#22c55e15' : '#ef444415',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: (isOnline && !isManualOffline) ? '#22c55e40' : '#ef444440'
                                }}
                            >
                                {(isOnline && !isManualOffline) ? <Wifi size={10} color="#16a34a" style={{ marginRight: 4 }} /> : <WifiOff size={10} color="#dc2626" style={{ marginRight: 4 }} />}
                                <Text style={{ 
                                    fontSize: 9, 
                                    fontWeight: '800', 
                                    color: (isOnline && !isManualOffline) ? '#16a34a' : '#dc2626',
                                    letterSpacing: 0.5
                                }}>
                                    {isManualOffline ? 'OFFLINE (M)' : (isOnline ? 'ONLINE' : 'OFFLINE')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={[styles.headerBackButton, { 
                            width: 32, 
                            height: 32, 
                            backgroundColor: (heldOrders.length + remoteOrders.length) > 0 ? '#ffedd5' : 'transparent', 
                            borderRadius: 8,
                            position: 'relative'
                        }]} 
                        onPress={() => setShowHeldOrdersModal(true)}
                    >
                        <Text style={{ fontSize: 16 }}>📂</Text>
                        {remoteOrders.length > 0 && (
                            <View style={{
                                position: 'absolute',
                                top: -2,
                                right: -2,
                                backgroundColor: '#ef4444',
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                borderWidth: 1.5,
                                borderColor: 'white'
                            }} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Info Bar (Meja, Pelanggan, Pelayan) */}
                <View style={[styles.headerInfoBar, { paddingVertical: 2, justifyContent: 'space-around' }]}>
                    <View style={[styles.infoBarItem, { flex: 2, borderRightWidth: 1, borderRightColor: '#f3f4f6' }]}>
                        <Text style={[styles.infoBarLabel, { fontSize: 8 }]}>MEJA</Text>
                        <Text style={[styles.infoBarValue, { fontSize: 11, color: '#111827' }]} numberOfLines={1}>
                            {selectedTable}
                        </Text>
                    </View>
                    <TouchableOpacity style={[styles.infoBarItem, { flex: 2 }]} onPress={() => setShowMemberLoginModal(true)}>
                        <Text style={[styles.infoBarLabel, { fontSize: 8 }]}>Pelanggan</Text>
                        <Text style={[styles.infoBarValue, { fontSize: 11 }]} numberOfLines={1}>{customerName}</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={[styles.searchContainer, { paddingVertical: 2 }]}>
                    <TextInput
                        style={[styles.searchInput, { paddingVertical: 4, fontSize: 12, borderRadius: 8 }, isTablet && { width: 400, alignSelf: 'center' }]}
                        placeholder="Cari produk..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Main POS Row (Split View in WideScreen/Landscape) */}
                <View style={[styles.flex1, isSideBySide && { flexDirection: 'row' }]}>
                    <View style={[styles.flex1, isSideBySide && { flex: 0.6 }]}>
                        {/* Categories Top Bar */}
                        <View style={[
                            styles.categoryContainer,
                            { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: 'white', minHeight: isTablet ? 60 : 45, justifyContent: 'center' }
                        ]}>
                    <ScrollView
                        horizontal={true}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[
                            styles.categoryScroll, 
                            { paddingHorizontal: 16, gap: 10, alignItems: 'center', height: '100%' }
                        ]}
                    >
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.categoryTab,
                                    selectedCategory === cat && styles.activeCategoryTab,
                                    { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, minHeight: 32, justifyContent: 'center' },
                                    isTablet && { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24, minHeight: 44 }
                                ]}
                                onPress={() => setSelectedCategory(cat)}
                            >
                                <Text style={[
                                    styles.categoryText,
                                    selectedCategory === cat && styles.activeCategoryText,
                                    { fontSize: isTablet ? 14 : 12 },
                                    selectedCategory === cat && { fontWeight: 'bold' }
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
                                key={isSideBySide ? "wide-4col" : (isSmallDevice ? "compact-3col" : "mobile-4col")}
                                numColumns={isSideBySide ? 4 : (isSmallDevice ? 3 : 4)}
                            keyExtractor={(item) => item.id.toString()}
                            showsVerticalScrollIndicator={true}
                            windowSize={5}
                            initialNumToRender={15}
                            maxToRenderPerBatch={10}
                            removeClippedSubviews={true}
                            columnWrapperStyle={{ 
                                gap: isTablet ? 12 : 8,
                                paddingHorizontal: isTablet ? 16 : 8,
                                marginBottom: isTablet ? 12 : 8
                            }}
                            contentContainerStyle={[
                                styles.productListContent, 
                                { paddingBottom: 150 }
                            ]}
                             renderItem={({ item }) => {
                                 const numCols = isSideBySide ? 4 : (isSmallDevice ? 3 : 4);
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

                    {/* Right Column: Mini Cart (Wide Screen Only) */}
                    {isSideBySide && !isDisplayOnly && (
                        <View style={{ flex: 0.4, backgroundColor: 'white', borderLeftWidth: 1, borderLeftColor: '#f3f4f6', height: '100%' }}>
                            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#f9fafb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1f2937' }}>🛒 Pesanan</Text>
                                <TouchableOpacity onPress={clearCart}>
                                    <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: 'bold' }}>Bersihkan</Text>
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={{ flex: 1, padding: 12 }}>
                                {cart.map((item) => (
                                    <View key={item.id} style={{ marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{item.name}</Text>
                                                <Text style={{ fontSize: 12, color: '#ea580c', fontWeight: 'bold', marginTop: 2 }}>{formatCurrency(item.price)}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                                <TouchableOpacity onPress={() => removeFromCart(item.id)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ fontSize: 16, fontWeight: 'bold', color: '#64748b' }}>-</Text></TouchableOpacity>
                                                <Text style={{ fontWeight: 'bold', marginHorizontal: 4, minWidth: 20, textAlign: 'center' }}>{item.quantity}</Text>
                                                <TouchableOpacity onPress={() => addToCart(item)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ fontSize: 16, fontWeight: 'bold', color: '#ea580c' }}>+</Text></TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                                {cart.length === 0 && (
                                    <View style={{ alignItems: 'center', marginTop: 60, opacity: 0.3 }}>
                                        <Text style={{ fontSize: 48 }}>🛒</Text>
                                        <Text style={{ fontSize: 14, marginTop: 10, fontWeight: 'bold' }}>Keranjang Kosong</Text>
                                    </View>
                                )}
                            </ScrollView>
                            
                            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fafafa', gap: 6 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: '#64748b', fontSize: 13 }}>Subtotal</Text>
                                    <Text style={{ fontWeight: '600', fontSize: 13 }}>{formatCurrency(calculateSubtotal())}</Text>
                                </View>
                                {orderDiscount > 0 && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: '#ef4444', fontSize: 13 }}>Diskon</Text>
                                        <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>-{formatCurrency(orderDiscount)}</Text>
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, marginTop: 4 }}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>Total</Text>
                                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ea580c' }}>{formatCurrency(calculateTotal())}</Text>
                                </View>
                                <TouchableOpacity 
                                    style={{ 
                                        backgroundColor: '#ea580c', 
                                        paddingVertical: 14, 
                                        borderRadius: 12, 
                                        alignItems: 'center', 
                                        marginTop: 10,
                                        shadowColor: '#ea580c',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.2,
                                        shadowRadius: 8,
                                        elevation: 4
                                    }}
                                    onPress={handleCheckout}
                                    disabled={cart.length === 0}
                                >
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Bayar Sekarang &rsaquo;</Text>
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
                        if (storeSettings?.enable_manager_auth) {
                            setManagerAuthTitle('Otorisasi Item Manual');
                            setPendingAction(() => () => { setShowPaymentModal(false); setShowManualItemModal(true); });
                            setShowManagerAuth(true);
                        } else {
                            setShowPaymentModal(false);
                            setShowManualItemModal(true);
                        }
                    }}
                    onDiscount={() => {
                        if (storeSettings?.enable_manager_auth) {
                            setManagerAuthTitle('Otorisasi Diskon');
                            setPendingAction(() => () => { setShowPaymentModal(false); setShowDiscountModal(true); });
                            setShowManagerAuth(true);
                        } else {
                            setShowPaymentModal(false);
                            setShowDiscountModal(true);
                        }
                    }}
                    onSplitBill={() => { setShowPaymentModal(false); setShowSplitBillModal(true); }}
                        onHold={() => {
                            if (storeSettings?.enable_manager_auth) {
                                setManagerAuthTitle('Otorisasi Hold Order');
                                setPendingAction(() => () => { 
                                    setShowPaymentModal(false); 
                                    setShowHoldNoteModal(true);
                                });
                                setShowManagerAuth(true);
                            } else {
                                setShowPaymentModal(false);
                                setShowHoldNoteModal(true);
                            }
                        }}
                />

                <ManagerAuthModal
                    visible={showManagerAuth}
                    title={managerAuthTitle}
                    onClose={() => setShowManagerAuth(false)}
                    onSuccess={handleManagerAuthSuccess}
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
                                {!isDisplayOnly && (
                                    <TouchableOpacity
                                        style={{ 
                                            backgroundColor: '#ea580c', 
                                            paddingVertical: 16, 
                                            borderRadius: 12,
                                            alignItems: 'center',
                                            shadowColor: "#000",
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 10,
                                            elevation: 5,
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            gap: 10
                                        }}
                                        onPress={handlePrintReceipt}
                                        disabled={isPrinting}
                                    >
                                        {isPrinting ? (
                                            <ActivityIndicator color="white" size="small" />
                                        ) : (
                                            <>
                                                <Text style={{ fontSize: 18 }}>🖨️</Text>
                                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Cetak Struk</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}

                                {!isDisplayOnly && (
                                    <TouchableOpacity
                                        style={{ 
                                            backgroundColor: '#f8fafc', 
                                            paddingVertical: 16, 
                                            borderRadius: 12,
                                            alignItems: 'center',
                                            borderWidth: 1,
                                            borderColor: '#e2e8f0',
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            gap: 10
                                        }}
                                        onPress={handlePreviewReceipt}
                                    >
                                        <Text style={{ fontSize: 18 }}>👁️</Text>
                                        <Text style={{ color: '#64748b', fontWeight: 'bold', fontSize: 16 }}>Pratinjau Struk</Text>
                                    </TouchableOpacity>
                                )}

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
                                    onPress={() => {
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


                {/* Cart Summary Bar (Automatic Appearance) - Only show in Compact mode */}
                {cart.length > 0 && !isSideBySide && (
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
                                {!isDisplayOnly && (!storeSettings?.restrict_manual_item || isAdmin) && (
                                    <TouchableOpacity 
                                        style={styles.quickActionBtn} 
                                        onPress={() => {
                                            if (storeSettings?.enable_manager_auth) {
                                                setManagerAuthTitle('Otorisasi Item Manual');
                                                setPendingAction(() => () => setShowManualItemModal(true));
                                                setShowManagerAuth(true);
                                            } else {
                                                setShowManualItemModal(true);
                                            }
                                        }}
                                    >
                                        <Text style={styles.quickActionIcon}>➕</Text>
                                        <Text style={styles.quickActionText}>Manual</Text>
                                    </TouchableOpacity>
                                )}
                                {!isDisplayOnly && (
                                    <>
                                        {(!storeSettings?.restrict_discount || isAdmin) && (
                                            <TouchableOpacity 
                                                style={styles.quickActionBtn} 
                                                onPress={() => {
                                                    if (storeSettings?.enable_manager_auth) {
                                                        setManagerAuthTitle('Otorisasi Diskon');
                                                        setPendingAction(() => () => setShowDiscountModal(true));
                                                        setShowManagerAuth(true);
                                                    } else {
                                                        setShowDiscountModal(true);
                                                    }
                                                }}
                                            >
                                                <Text style={styles.quickActionIcon}>🏷️</Text>
                                                <Text style={styles.quickActionText}>Diskon</Text>
                                            </TouchableOpacity>
                                        )}
                                        {(!storeSettings?.restrict_split_bill || isAdmin) && (
                                            <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowSplitBillModal(true)}>
                                                <Text style={styles.quickActionIcon}>✂️</Text>
                                                <Text style={styles.quickActionText}>Pisah</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                                {!isDisplayOnly && (!storeSettings?.restrict_hold_order || isAdmin) && (
                                    <TouchableOpacity 
                                        style={styles.quickActionBtn} 
                                        onPress={() => {
                                            if (storeSettings?.enable_manager_auth) {
                                                setManagerAuthTitle('Otorisasi Hold Order');
                                                setPendingAction(() => () => {
                                                    setShowHoldNoteModal(true);
                                                });
                                                setShowManagerAuth(true);
                                            } else {
                                                setShowHoldNoteModal(true);
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
                            
                            {/* NEW: Table & Waiter Row inside Cart Modal for Cashiers */}
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
                                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#6b7280', marginBottom: 4 }}>PELAYAN (WAITER)</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 8, height: 42 }}>
                                            <Text style={{ fontSize: 12 }}>👨‍🍳</Text>
                                            <Text style={{ flex: 1, paddingHorizontal: 4, fontSize: 14, color: selectedWaiter ? '#111827' : '#94a3b8' }}>
                                                {selectedWaiter || 'Pilih Pelayan...'}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: '#94a3b8' }}>▼</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Info-only Row for Customers in Cart Modal */}
                            {isDisplayOnly && (
                                <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                                    <Text style={{ fontSize: 12, color: '#4b5563' }}>Meja: <Text style={{ fontWeight: 'bold' }}>{selectedTable}</Text></Text>
                                    <Text style={{ fontSize: 12, color: '#4b5563', marginLeft: 16 }}>Waiter: <Text style={{ fontWeight: 'bold' }}>{selectedWaiter || '-'}</Text></Text>
                                </View>
                            )}


                            <ScrollView style={styles.cartItemList}>
                                {cart.map((item) => (
                                    <View key={item.id} style={styles.cartItem}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cartItemName}>{item.name}</Text>
                                            {item.notes ? (
                                                <Text style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', marginTop: 1 }}>• {item.notes}</Text>
                                            ) : null}
                                            <Text style={styles.cartItemPrice}>{formatCurrency(item.price)}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                                <Text style={{ fontSize: 10 }}>✍️</Text>
                                                <TextInput
                                                    style={{ 
                                                        flex: 1,
                                                        fontSize: 11, 
                                                        color: '#ea580c', 
                                                        backgroundColor: '#fff7ed',
                                                        paddingHorizontal: 10,
                                                        paddingVertical: 6,
                                                        borderRadius: 8,
                                                        borderWidth: 1,
                                                        borderColor: '#ffedd5',
                                                        fontWeight: '500'
                                                    }}
                                                    placeholder="Catatan (contoh: Pedas, Tanpa MSG)..."
                                                    placeholderTextColor="#fdba74"
                                                    value={item.notes}
                                                    onChangeText={(text) => updateNote(item.id, text)}
                                                />
                                            </View>
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
                                    <Text style={styles.cartTotalLabelLarge}>Subtotal</Text>
                                    <Text style={styles.cartTotalValueLarge}>{formatCurrency(calculateSubtotal())}</Text>
                                </View>
                                {orderDiscount > 0 && (
                                    <>
                                        <View style={[styles.cartTotalRow, { marginTop: 4 }]}>
                                            <Text style={[styles.cartTotalLabelLarge, { color: '#ef4444' }]}>Diskon</Text>
                                            <Text style={[styles.cartTotalValueLarge, { color: '#ef4444' }]}>-{formatCurrency(orderDiscount)}</Text>
                                        </View>
                                        <View style={[styles.cartTotalRow, { marginTop: 4 }]}>
                                            <Text style={[styles.cartTotalLabelLarge, { fontWeight: '600' }]}>Total Setelah Diskon</Text>
                                            <Text style={[styles.cartTotalValueLarge, { fontWeight: '600' }]}>{formatCurrency(calculateSubtotal() - orderDiscount)}</Text>
                                        </View>
                                    </>
                                )}
                                {calculateServiceAmount() > 0 && (
                                    <View style={[styles.cartTotalRow, { marginTop: 4 }]}>
                                        <Text style={styles.cartTotalLabelLarge}>Layanan ({storeSettings?.service_rate}%)</Text>
                                        <Text style={styles.cartTotalValueLarge}>{formatCurrency(calculateServiceAmount())}</Text>
                                    </View>
                                )}
                                {calculateTaxAmount() > 0 && (
                                    <View style={[styles.cartTotalRow, { marginTop: 4 }]}>
                                        <Text style={styles.cartTotalLabelLarge}>Pajak ({storeSettings?.tax_rate}%)</Text>
                                        <Text style={styles.cartTotalValueLarge}>{formatCurrency(calculateTaxAmount())}</Text>
                                    </View>
                                )}
                                <View style={[styles.cartTotalRow, { marginTop: 4, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 4 }]}>
                                    <Text style={[styles.cartTotalLabelLarge, { fontWeight: 'bold' }]}>Total</Text>
                                    <Text style={[styles.cartTotalValueLarge, { color: '#ea580c' }]}>{formatCurrency(calculateTotal())}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { flex: 1 }]} onPress={clearCart}>
                                        <Text style={styles.cancelButtonText}>Kosongkan</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalButton, styles.confirmButton, { flex: 2 }]} onPress={() => { setShowCartModal(false); handleCheckout(); }}>
                                        <Text style={styles.confirmButtonText}>
                                            {isDisplayOnly ? 'Kirim ke Kasir' : 'Konfirmasi Pesanan'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Held Orders Modal */}
                <HeldOrdersModal
                    visible={showHeldOrdersModal}
                    onClose={() => setShowHeldOrdersModal(false)}
                    orders={useMemo(() => 
                        [...heldOrders, ...remoteOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
                        [heldOrders, remoteOrders]
                    )}
                    onRestore={handleRestoreHeldOrder}
                    onDelete={handleDeleteHeldOrder}
                    onRefresh={fetchRemotePendingOrders}
                    isRefreshing={isFetchingRemote}
                />

                {/* Manual Item Modal */}
                <ManualItemModal
                    visible={showManualItemModal}
                    onClose={() => setShowManualItemModal(false)}
                    onAdd={handleAddManualItem}
                />

                {/* Discount Modal */}
                <DiscountModal
                    visible={showDiscountModal}
                    onClose={() => setShowDiscountModal(false)}
                    currentTotal={calculateSubtotal()}
                    onApply={handleApplyDiscount}
                />

                {/* Split Bill Modal */}
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
                onPrint={() => {
                    handlePrintReceipt();
                }}
            />

            {/* Waiter Selection Modal */}
            <Modal
                visible={showWaiterModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowWaiterModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Pilih Pelayan (Waiter)</Text>
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
                                placeholder="Cari nama karyawan..."
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
                                <Text style={{ fontSize: 15, color: '#6b7280' }}>-- Tanpa Pelayan --</Text>
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
            {/* Debug Role Banner (Sangat berguna untuk pemecahan masalah) */}
            <View style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: isDisplayOnly ? '#f0fdf4' : '#fef2f2',
                padding: 4,
                borderTopWidth: 1,
                borderColor: isDisplayOnly ? '#16a34a' : '#ef4444',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 10,
                zIndex: 9999
            }}>
                <Text style={{ fontSize: 9, color: isDisplayOnly ? '#16a34a' : '#ef4444', fontWeight: 'bold' }}>
                    Role: {isDisplayOnly ? 'DISPLAY MODE (Aktif)' : 'KASIR MODE'}
                </Text>
                {sessionLoading && <ActivityIndicator size="small" color="#ea580c" />}
            </View>
        </View>
    </SafeAreaView >

    );
}

const styles = StyleSheet.create({
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        backgroundColor: '#f9fafb',
        padding: 8,
        borderRadius: 12,
    },
    quickActionBtn: {
        alignItems: 'center',
        flex: 1,
    },
    quickActionIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    quickActionText: {
        fontSize: 10,
        color: '#4b5563',
        fontWeight: 'bold',
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
    backButtonText: {
        fontSize: 22,
    },
    searchContainer: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'white',
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
