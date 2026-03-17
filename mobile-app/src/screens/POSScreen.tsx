import * as React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Wifi, WifiOff } from 'lucide-react-native';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';



export default function POSScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { tableNumber, tableNo, waiterName: initialWaiter } = route.params || {};
    const { width, height } = useWindowDimensions();

    const isLandscape = width > height;
    const isTablet = Math.min(width, height) >= 600;
    const isLargeTablet = Math.min(width, height) >= 800;
    const isSmallDevice = width < 380;

    const getAcronym = (name: string) => {
        return name?.substring(0, 2).toUpperCase() || '??';
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const [categories, setCategories] = useState<string[]>(['Semua']);

    // Master Data
    const [customers, setCustomers] = useState<any[]>([]);
    const [waiters, setWaiters] = useState<any[]>([]);

    // UI State
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successModalConfig, setSuccessModalConfig] = useState({ title: 'Pesanan Terkirim!', message: 'Pesanan Anda telah masuk ke sistem kasir.' });
    const [lastOrderNo, setLastOrderNo] = useState('');
    const [showCartModal, setShowCartModal] = useState(false);
    // const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [currentSaleId, setCurrentSaleId] = useState<number | null>(null);
    const [isOnline, setIsOnline] = useState(true);
    const [isManualOffline, setIsManualOffline] = useState(false);
    const [showMemberLoginModal, setShowMemberLoginModal] = useState(false);
    const [countdown, setCountdown] = useState(5);

    const [memberPhone, setMemberPhone] = useState('');

    // Transaction Data
    const [cart, setCart] = useState<any[]>([]);
    const [selectedTable, setSelectedTable] = useState('Tanpa Meja');
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
    const [heldOrders, setHeldOrders] = useState<any[]>([]);
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [splitItemsToPay, setSplitItemsToPay] = useState<any[]>([]);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [previewOrderData, setPreviewOrderData] = useState<any>(null);
    const isFirstRender = React.useRef(true);

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

    // Countdown effect for success screen
    useEffect(() => {
        let timer: any;
        if (showSuccessModal) {
            setCountdown(10); // Increase to 10s to give time for printing
            timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        setShowSuccessModal(false);
                        // @ts-ignore
                        navigation.navigate('Main');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [showSuccessModal, navigation]);

    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrintReceipt = async () => {
        if (!lastOrderNo) return;
        
        setIsPrinting(true);
        try {
            const orderData = await fetchOrderDataForReceipt(lastOrderNo);
            if (!orderData) throw new Error('Order not found');

            const success = await PrinterManager.printOrderReceipt(orderData);
            if (success) {
                Alert.alert('Sukses', 'Struk sedang dicetak');
            } else {
                Alert.alert('Gagal', 'Gagal mencetak struk. Pastikan printer terhubung di Pengaturan.');
            }
        } catch (e) {
            console.error('Print Error:', e);
            Alert.alert('Error', 'Terjadi kesalahan saat mencetak');
        } finally {
            setIsPrinting(false);
        }
    };

    const handlePreviewReceipt = async () => {
        if (!lastOrderNo) return;
        
        try {
            const orderData = await fetchOrderDataForReceipt(lastOrderNo);
            if (orderData) {
                setPreviewOrderData(orderData);
                setShowReceiptPreview(true);
            }
        } catch (e) {
            Alert.alert('Error', 'Gagal memuat pratinjau struk');
        }
    };

    const fetchOrderDataForReceipt = async (orderNo: string) => {
        const { data: sale, error } = await supabase
            .from('sales')
            .select(`
                *,
                sale_items (
                    *,
                    product:product_id (name)
                )
            `)
            .eq('order_no', orderNo)
            .single();

        if (error) throw error;

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

        return {
            orderNo: sale.order_no,
            tableNo: sale.table_no,
            customerName: sale.customer_name,
            customer_level: customerTier,
            waiterName: (!isDisplayOnly && userName && userName !== 'User') ? userName : (sale.waiter_name || '-'),
            total: sale.total_amount,
            discount: sale.discount || 0,
            tax: sale.tax || 0,
            service_charge: sale.service_charge || 0,
            tax_rate: storeSettings?.tax_rate || 0,
            service_rate: storeSettings?.service_rate || 0,
            receipt_header: storeSettings?.receipt_header,
            receipt_footer: storeSettings?.receipt_footer,
            address: storeSettings?.address,
            show_logo: storeSettings?.show_logo,
            show_date: storeSettings?.show_date,
            show_waiter: storeSettings?.show_waiter,
            show_table: storeSettings?.show_table,
            show_customer_name: storeSettings?.show_customer_name,
            payment_method: sale.payment_method,
            date: sale.date,
            shopName: branchName,
            shopAddress: branchAddress,
            shopPhone: branchPhone,
            items: sale.sale_items.map((si: any) => ({
                name: si.product ? si.product.name : si.product_name,
                price: si.price,
                quantity: si.quantity
            }))
        };
    };

    useEffect(() => {
        let isMounted = true;

        const loadInitialData = async () => {
            console.log('[POSScreen] Loading initial data...');
            try {
                // 1. Load from Cache for Instant Display
                const cachedProducts = await AsyncStorage.getItem(`cached_products_${currentBranchId}`);
                const cachedCategories = await AsyncStorage.getItem(`cached_categories_${currentBranchId}`);
                
                if (cachedProducts && isMounted) {
                    console.log('[POSScreen] Using cached products');
                    setProducts(JSON.parse(cachedProducts));
                    setLoadingProducts(false);
                }
                if (cachedCategories && isMounted) {
                    console.log('[POSScreen] Using cached categories');
                    setCategories(JSON.parse(cachedCategories));
                }

                // 2. Fetch Fresh Data from Supabase
                await Promise.all([
                    fetchProducts(),
                    fetchCategories(),
                    fetchMasterData()
                ]);

                // Load Cached Customers fallback
                const cachedCustomers = await AsyncStorage.getItem(`cached_customers`);
                if (cachedCustomers && isMounted && customers.length === 0) {
                    setCustomers(JSON.parse(cachedCustomers));
                }

                // Load Held Orders (Always load from storage)
                const savedHeldStr = await AsyncStorage.getItem('pos_held_orders');
                if (savedHeldStr && isMounted) {
                    try {
                        const parsedHeld = JSON.parse(savedHeldStr);
                        setHeldOrders(parsedHeld.map((h: any) => ({ 
                            ...h, 
                            createdAt: h.createdAt ? new Date(h.createdAt) : new Date() 
                        })));
                    } catch (e) {
                        console.error('Error parsing held orders:', e);
                    }
                }

                if (route.params?.orderId) {
                    await loadOrderById(route.params.orderId);
                } else {
                    // Load Drafts
                    const [savedCart, savedCustName, savedCustId, savedTable, savedDiscount, savedWaiter, savedExistingId] = await Promise.all([
                        AsyncStorage.getItem('pos_cart_draft'),
                        AsyncStorage.getItem('pos_customer_draft_name'),
                        AsyncStorage.getItem('pos_customer_draft_id'),
                        AsyncStorage.getItem('pos_table_draft'),
                        AsyncStorage.getItem('pos_discount_draft'),
                        AsyncStorage.getItem('pos_waiter_draft'),
                        AsyncStorage.getItem('pos_existing_sale_id_draft')
                    ]);

                    if (savedCart && isMounted) setCart(JSON.parse(savedCart));
                    if (savedCustName && isMounted) setCustomerName(savedCustName);
                    if (savedCustId && isMounted) setSelectedCustomerId(savedCustId === 'null' ? null : parseInt(savedCustId));
                    if (savedTable && isMounted) setSelectedTable(savedTable);
                    if (savedDiscount && isMounted) setOrderDiscount(parseFloat(savedDiscount) || 0);
                    if (savedWaiter && isMounted) setSelectedWaiter(savedWaiter || '');
                    if (savedExistingId && isMounted) setExistingSaleId(savedExistingId === 'null' ? null : parseInt(savedExistingId));
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

        // Safety timeout...
        const timer = setTimeout(() => {
            if (isMounted) setLoadingProducts(false);
        }, 10000);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            clearInterval(connInterval);
        };
    }, [currentBranchId, route.params?.orderId]);
 

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
                setSelectedTable(sale.table_no || 'Tanpa Meja');
                
                // Map items to cart format
                const items = sale.sale_items.map((si: any) => ({
                    ...si.product,
                    id: si.product_id,
                    name: si.product_name || si.product?.name,
                    price: si.price,
                    quantity: si.quantity,
                    target: si.target
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
            // 1. Fetch Active Session (Redundant: removed, using context instead)



            // 3. Fetch Customers (Try fallback if table fails)
            const { data: customerData, error: custError } = await supabase
                .from('customers')
                .select('id, name, phone')
                .limit(50);

            if (!custError && customerData) {
                setCustomers(customerData);
                AsyncStorage.setItem('cached_customers', JSON.stringify(customerData));
            } else {
                // Fallback Mock Customers if table doesn't exist
                setCustomers([
                    { id: '1', name: 'Guest', phone: '-' },
                    { id: '2', name: 'Member A', phone: '08123' },
                ]);
            }


            // 5. Waiters skipped (feature hidden)

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


    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('name')
                .order('name');

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

                const uniqueCategories = ['Semua', ...Array.from(uniqueSet)];
                setCategories(uniqueCategories);
                // Save to Cache
                AsyncStorage.setItem(`cached_categories_${currentBranchId}`, JSON.stringify(uniqueCategories));
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('branch_id', parseInt(currentBranchId));

            if (error) throw error;

            if (data) {
                setProducts(data);
                // Save to Cache
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
        if (selectedCategory !== 'Semua') {
            const lowerSelected = selectedCategory.toLowerCase();
            result = result.filter(p => {
                const pCat = (p.category || '').toLowerCase();
                const pCatName = (p.category_name || '').toLowerCase();
                return pCat === lowerSelected || pCatName === lowerSelected;
            });
        }
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(lowerQuery));
        }
        return result;
    }, [products, searchQuery, selectedCategory]);

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
        const category = (product.category_name || product.category || '').toLowerCase();
        let target = 'Waitress';
        if (category.includes('makan') || category.includes('food')) target = 'Kitchen';
        else if (category.includes('minum') || category.includes('drink') || category.includes('bar') || category.includes('coffee')) target = 'Bar';

        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prevCart, { ...product, quantity: 1, target }];
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
        setSelectedTable('Tanpa Meja');
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
        const subtotal = calculateSubtotal();
        if (subtotal === 0) return 0;
        
        const taxableSubtotal = calculateTaxableSubtotal();
        const discountRatio = (subtotal - orderDiscount) / subtotal;
        const taxableAmount = taxableSubtotal * discountRatio;
        const taxRate = storeSettings?.tax_rate || 0;
        
        return (taxableAmount * taxRate) / 100;
    };

    const calculateServiceAmount = () => {
        const subtotal = calculateSubtotal();
        if (subtotal === 0) return 0;
        
        const taxableSubtotal = calculateTaxableSubtotal(); // Service charge usually follows taxable items or total? 
        // Parity with Web: taxableAmount = taxableSubtotal * discountRatio; serviceAmount = (taxableAmount * serviceRate) / 100
        const discountRatio = (subtotal - orderDiscount) / subtotal;
        const taxableAmount = taxableSubtotal * discountRatio;
        const serviceRate = storeSettings?.service_rate || 0;
        
        return (taxableAmount * serviceRate) / 100;
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        const tax = calculateTaxAmount();
        const service = calculateServiceAmount();
        return Math.max(0, (subtotal - orderDiscount) + tax + service);
    };

    // New POS Action Handlers
    const handleAddManualItem = (item: { name: string; price: number }) => {
        const manualItem = {
            id: `manual-${Date.now()}`,
            name: item.name,
            price: item.price,
            quantity: 1,
            isManual: true,
            category: 'Manual'
        };
        setCart(prev => [...prev, manualItem]);
    };

    const handleApplyDiscount = (discount: { type: 'percentage' | 'fixed'; value: number }) => {
        let amount = 0;
        if (discount.type === 'percentage') {
            amount = (calculateSubtotal() * discount.value) / 100;
        } else {
            amount = discount.value;
        }
        setOrderDiscount(amount);
    };

    const handleHoldOrder = async () => {
        if (cart.length === 0) return;
        
        const newHeldOrder = {
            id: `held-${Date.now()}`,
            items: [...cart],
            discount: orderDiscount,
            total: calculateTotal(),
            createdAt: new Date(),
            tableNo: selectedTable,
            existingSaleId: existingSaleId,
            customerName: customerName,
            selectedCustomerId: selectedCustomerId,
            selectedWaiter: selectedWaiter
        };

        setHeldOrders(prev => [newHeldOrder, ...prev]);
        clearCart();
        setOrderDiscount(0);
        setShowCartModal(false);
        Alert.alert('Sukses', 'Pesanan ditangguhkan');
    };

    const handleRestoreHeldOrder = (order: any) => {
        if (cart.length > 0) {
            Alert.alert('Info', 'Kosongkan keranjang sebelum mengembalikan pesanan');
            return;
        }
        setCart(order.items);
        setOrderDiscount(order.discount || 0);
        setSelectedTable(order.tableNo || 'Tanpa Meja');
        setCustomerName(order.customerName || 'Guest');
        setSelectedCustomerId(order.selectedCustomerId || null);
        setSelectedWaiter(order.selectedWaiter || '');
        setExistingSaleId(order.existingSaleId || null);
        
        setHeldOrders(prev => prev.filter(h => h.id !== order.id));
        setShowHeldOrdersModal(false);
        setShowCartModal(true);
    };

    const handleDeleteHeldOrder = (id: string) => {
        setHeldOrders(prev => prev.filter(h => h.id !== id));
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
        // ADDED: Safety fallback check directly from metadata
        const { data: { user } } = await supabase.auth.getUser();
        const isActuallyDisplay = isDisplayOnly || 
            (user?.user_metadata?.role || '').toLowerCase().includes('display');

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
                const { error: saleError } = await supabase
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
                    .eq('id', existingSaleId);

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
                    status: 'Pending'
                }));

                const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;

                setSuccessModalConfig({
                    title: 'Pesanan Terkirim!',
                    message: isActuallyDisplay ? 'Pesanan berhasil dikirim ke kasir' : 'Pesanan berhasil diperbarui'
                });
                setShowSuccessModal(true);
            } else {
                // Create New Sale
                const orderNo = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
                const { data: sale, error: saleError } = await supabase
                    .from('sales')
                    .insert([{
                        order_no: orderNo,
                        branch_id: parseInt(currentBranchId),
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
                    status: 'Pending'
                }));

                const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;
                
                setLastOrderNo(orderNo);
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
                const orderNo = `OFF-INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
                
                const saleData = {
                    order_no: orderNo,
                    branch_id: parseInt(currentBranchId),
                    customer_name: customerName,
                    customer_id: selectedCustomerId,
                    table_no: selectedTable,
                    waiter_name: selectedWaiter,
                    total_amount: totalAmount,
                    status: 'Pending',
                    payment_method: 'Tunai',
                    discount: orderDiscount,
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
            }

            Alert.alert('Error', 'Gagal memproses pesanan: ' + error.message);
        }
    };

    const handlePaymentConfirm = async (paymentData: { method: string; amount: number; change: number }) => {
        if (!currentBranchId) {
            Alert.alert('Error', 'Data cabang belum dimuat.');
            return;
        }
        try {
            const finalTotal = isSplitPayment 
                ? splitItemsToPay.reduce((sum, item) => sum + (item.price * item.quantity), 0)
                : calculateTotal();
            
            const itemsToProc = isSplitPayment ? splitItemsToPay : cart;

            // 1. Create or Update Sale
            let sale: any = null;
            let orderNoText = '';

            if (existingSaleId) {
                const { data: updatedSale, error: saleError } = await supabase
                    .from('sales')
                    .update({
                        customer_name: customerName,
                        customer_id: selectedCustomerId,
                        table_no: selectedTable || 'Tanpa Meja',
                        waiter_name: userName || selectedWaiter, // [UPDATED] Use current cashier name
                        total_amount: finalTotal,
                        discount: isSplitPayment ? 0 : orderDiscount,
                        tax: isSplitPayment ? 0 : calculateTaxAmount(),
                        service_charge: isSplitPayment ? 0 : calculateServiceAmount(),
                        status: 'Paid',
                        payment_method: paymentData.method,
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
                orderNoText = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
                const { data: newSale, error: saleError } = await supabase
                    .from('sales')
                    .insert([{
                        order_no: orderNoText,
                        branch_id: parseInt(currentBranchId),
                        customer_name: customerName,
                        customer_id: selectedCustomerId,
                        table_no: selectedTable || 'Tanpa Meja',
                        waiter_name: userName || selectedWaiter, // [UPDATED] Use current cashier name
                        total_amount: finalTotal,
                        discount: isSplitPayment ? 0 : orderDiscount,
                        tax: isSplitPayment ? 0 : calculateTaxAmount(),
                        service_charge: isSplitPayment ? 0 : calculateServiceAmount(),
                        status: 'Paid',
                        payment_method: paymentData.method,
                        date: new Date().toISOString()
                    }])
                    .select()
                    .single();

                if (saleError) throw saleError;
                sale = newSale;
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
                status: 'Pending'
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
                Alert.alert('Sukses', 'Pembayaran sebagian berhasil');
            } else {
                // Clear Cart
                clearCart();
                setOrderDiscount(0);
                setExistingSaleId(null);
                

                setLastOrderNo(orderNoText);
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
                const orderNoText = `OFF-INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
                
                const saleData = {
                    order_no: orderNoText,
                    branch_id: parseInt(currentBranchId),
                    customer_name: customerName,
                    customer_id: selectedCustomerId,
                    table_no: selectedTable || 'Tanpa Meja',
                    waiter_name: selectedWaiter,
                    total_amount: finalTotal,
                    discount: orderDiscount,
                    status: 'Paid',
                    payment_method: paymentData.method,
                };

                const success = await OfflineService.queueOfflineSale(saleData, cart);
                if (success) {
                    clearCart();
                    setOrderDiscount(0);
                    setExistingSaleId(null);
                    setLastOrderNo(orderNoText);
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
                    <TouchableOpacity style={[styles.headerBackButton, { width: 32, height: 32 }]} onPress={() => navigation.goBack()}>
                        <Text style={[styles.backButtonText, { fontSize: 20 }]}>&lsaquo;</Text>
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.headerTitleText, { fontSize: 14 }]}>{branchName}</Text>
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
                                    {isManualOffline ? 'MANUAL OFFLINE' : (isOnline ? 'ONLINE' : 'OFFLINE')}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={[styles.headerBackButton, { width: 32, height: 32, backgroundColor: heldOrders.length > 0 ? '#ffedd5' : 'transparent', borderRadius: 8 }]} 
                        onPress={() => setShowHeldOrdersModal(true)}
                    >
                        <Text style={{ fontSize: 16 }}>📂</Text>
                    </TouchableOpacity>
                </View>

                {/* Info Bar (Meja, Pelanggan, Pelayan) */}
                <View style={[styles.headerInfoBar, { paddingVertical: 2, justifyContent: 'space-around' }]}>
                    <TouchableOpacity style={[styles.infoBarItem, { flex: 1 }]} onPress={() => setShowMemberLoginModal(true)}>
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
                            data={Array.from({ length: Math.ceil(filteredProducts.length / 5) }, (v, i) =>
                                filteredProducts.slice(i * 5, i * 5 + 5)
                            )}
                            key={isTablet ? "tablet-horizontal" : "mobile-horizontal"}
                            horizontal={true}
                            showsHorizontalScrollIndicator={false}
                            windowSize={3}
                            initialNumToRender={10}
                            maxToRenderPerBatch={10}
                            removeClippedSubviews={true}
                            contentContainerStyle={[
                                styles.productListContent, 
                                { padding: 4, paddingBottom: 16 },
                                isTablet && { paddingHorizontal: 16 }
                            ]}
                            renderItem={({ item: chunk }) => (
                                <View style={{ width: isTablet ? 140 : 80, gap: isTablet ? 12 : 6, marginHorizontal: isTablet ? 8 : 3 }}>
                                    {chunk.map((item: any) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[
                                                styles.productCard,
                                                { width: '100%', padding: 0, borderRadius: isTablet ? 12 : 8, overflow: 'hidden', flex: 1, backgroundColor: '#f3f4f6' }
                                            ]}
                                            onPress={() => addToCart(item)}
                                        >
                                            {/* Full Frame Background Image */}
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

                                            {/* Modern Text Overlay */}
                                            <View style={{ 
                                                position: 'absolute', 
                                                bottom: 0, 
                                                width: '100%', 
                                                backgroundColor: 'rgba(0, 0, 0, 0.55)', 
                                                paddingVertical: isTablet ? 6 : 4,
                                                paddingHorizontal: 4,
                                                alignItems: 'center'
                                            }}>
                                                <Text style={{ 
                                                    fontSize: isTablet ? 12 : 8.5, 
                                                    color: 'white', 
                                                    textAlign: 'center', 
                                                    fontWeight: '600' 
                                                }} numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                                <Text style={{ 
                                                    fontSize: isTablet ? 11 : 8, 
                                                    color: '#fdba74', 
                                                    fontWeight: 'bold',
                                                    marginTop: 1
                                                }}>
                                                    {formatCurrency(item.price)}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                    {chunk.length < 5 && Array.from({ length: 5 - chunk.length }).map((_, i) => (
                                        <View key={`empty-${i}`} style={{ flex: 1 }} />
                                    ))}
                                </View>
                            )}
                        />
                    )}
                </View>







                <PaymentModal
                    visible={showPaymentModal && !isDisplayOnly}
                    total={calculateTotal()}
                    onClose={() => setShowPaymentModal(false)}
                    onConfirm={handlePaymentConfirm}
                    onManualItem={() => { setShowPaymentModal(false); setShowManualItemModal(true); }}
                    onDiscount={() => { setShowPaymentModal(false); setShowDiscountModal(true); }}
                    onSplitBill={() => { setShowPaymentModal(false); setShowSplitBillModal(true); }}
                    onHold={() => { setShowPaymentModal(false); handleHoldOrder(); }}
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
                                        // @ts-ignore
                                        navigation.navigate('Main');
                                    }}
                                >
                                    <Text style={{ color: '#22c55e', fontWeight: 'bold', fontSize: 16 }}>Kembali ke Utama</Text>
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

                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 24 }}>
                                Otomatis kembali dalam {countdown} detik.
                            </Text>
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


                {/* Cart Summary Bar (Automatic Appearance) */}
                {cart.length > 0 && (
                    <View style={[
                        styles.cartSummaryBar,
                        isSmallDevice && { bottom: 12, left: 12, right: 12, padding: 8, paddingHorizontal: 14, borderRadius: 16 }
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
                                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowManualItemModal(true)}>
                                        <Text style={styles.quickActionIcon}>➕</Text>
                                        <Text style={styles.quickActionText}>Manual</Text>
                                    </TouchableOpacity>
                                )}
                                {!isDisplayOnly && (
                                    <>
                                        {(!storeSettings?.restrict_discount || isAdmin) && (
                                            <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowDiscountModal(true)}>
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
                                    <TouchableOpacity style={styles.quickActionBtn} onPress={handleHoldOrder}>
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

                            <ScrollView style={styles.cartItemList}>
                                {cart.map((item) => (
                                    <View key={item.id} style={styles.cartItem}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cartItemName}>{item.name}</Text>
                                            <Text style={styles.cartItemPrice}>{formatCurrency(item.price)}</Text>
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
                                    <View style={[styles.cartTotalRow, { marginTop: 4 }]}>
                                        <Text style={[styles.cartTotalLabelLarge, { color: '#ef4444' }]}>Diskon</Text>
                                        <Text style={[styles.cartTotalValueLarge, { color: '#ef4444' }]}>-{formatCurrency(orderDiscount)}</Text>
                                    </View>
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
                    orders={heldOrders}
                    onRestore={handleRestoreHeldOrder}
                    onDelete={handleDeleteHeldOrder}
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
