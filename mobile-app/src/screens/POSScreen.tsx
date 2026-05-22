import React from 'react';
var memo = React.memo;
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TextInput = RN.TextInput;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var FlatList = RN.FlatList;
var Image = RN.Image;
var Modal = RN.Modal;
var Alert = RN.Alert;
var StyleSheet = RN.StyleSheet;
var useWindowDimensions = RN.useWindowDimensions;
var ActivityIndicator = RN.ActivityIndicator;
var Linking = RN.Linking;
var InteractionManager = RN.InteractionManager;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
var useRoute = NavNative.useRoute;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import AsyncStorage from '@react-native-async-storage/async-storage';
import PaymentModal from '../components/PaymentModal';
import * as PrinterLib from '../lib/PrinterManager';
var PrinterManager = PrinterLib.PrinterManager;
import ManualItemModal from '../components/ManualItemModal';
import DiscountModal from '../components/DiscountModal';
import SplitBillModal from '../components/SplitBillModal';
import HeldOrdersModal from '../components/HeldOrdersModal';
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;
import * as OfflineLib from '../lib/OfflineService';
var OfflineService = OfflineLib.OfflineService;
import * as WifiLib from '../lib/WifiVoucherService';
var WifiVoucherService = WifiLib.WifiVoucherService;
import * as Lucide from 'lucide-react-native';
var Wifi = Lucide.Wifi;
var WifiOff = Lucide.WifiOff;
var Star = Lucide.Star;
var ShoppingCart = Lucide.ShoppingCart;
var Printer = Lucide.Printer;
var ChevronLeft = Lucide.ChevronLeft;

import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import HoldNoteModal from '../components/HoldNoteModal';
import ModernToast from '../components/ModernToast';
import ManagerAuthModal from '../components/ManagerAuthModal';

var getAcronym = function(name) {
    return name ? name.substring(0, 2).toUpperCase() : '??';
};

var merge = function(target, source) {
    if (!source) return target;
    for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
        }
    }
    return target;
};

var CHECKOUT_RPC_TIMEOUT_MS = 15000;
var TIMEOUT_VERIFY_DELAY_MS = 2000;
var TIMEOUT_VERIFY_ATTEMPTS = 3;

var sleep = function(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
};

var createClientTransactionId = function(prefix) {
    return [prefix || 'sale', Date.now(), Math.random().toString(36).slice(2, 8)].join('-');
};

var makeRpcTimeoutError = function(clientTransactionId) {
    var err = new Error('Koneksi ke server terputus (Timeout).');
    (err as any).code = 'CLIENT_TX_TIMEOUT';
    (err as any).clientTransactionId = clientTransactionId || null;
    return err;
};

var isRpcTimeoutError = function(err) {
    return !!(err && ((err as any).code === 'CLIENT_TX_TIMEOUT'));
};

var ProductCard = memo(function(props) {
    var item = (props as any).item;
    var isTablet = (props as any).isTablet;
    var onAdd = (props as any).onAdd;
    var formatCurrency = (props as any).formatCurrency;

    return React.createElement(TouchableOpacity, {
        style: [
            styles.productCard,
            { width: '100%', margin: 0, borderRadius: isTablet ? 12 : 8, overflow: 'hidden', backgroundColor: '#f3f4f6', height: isTablet ? 150 : 90 }
        ],
        onPress: function() { onAdd(item); }
    },
        React.createElement(View, { style: { width: '100%', height: '100%', position: 'absolute' } },
            item.image_url ? (
                React.createElement(Image, { source: { uri: item.image_url }, style: { width: '100%', height: '100%' }, resizeMode: "cover" })
            ) : (
                React.createElement(View, { style: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff7ed' } },
                    React.createElement(Text, { style: [styles.productAcronym, { fontSize: isTablet ? 24 : 13 }] },
                        getAcronym(item.name)
                    )
                )
            )
        ),

        React.createElement(View, { style: { 
            position: 'absolute', 
            bottom: 0, 
            width: '100%', 
            backgroundColor: 'rgba(0, 0, 0, 0.6)', 
            paddingVertical: isTablet ? 6 : 4,
            paddingHorizontal: 4,
            alignItems: 'center'
        } },
            React.createElement(Text, { style: { 
                fontSize: isTablet ? 12 : 9, 
                color: 'white', 
                textAlign: 'center', 
                fontWeight: '600' 
            }, numberOfLines: 1 }, item.name),
            React.createElement(Text, { style: { 
                fontSize: isTablet ? 11 : 8.5, 
                color: '#fdba74', 
                fontWeight: 'bold',
                marginTop: 1
            } }, formatCurrency(item.price))
        )
    );
});


export default function POSScreen() {
    var navigation = useNavigation();
    var route = useRoute();
    var params = (route.params || {}) as any;
    var tableNumber = params.tableNumber;
    var tableNo = params.tableNo;
    var initialWaiter = params.waiterName;

    var dimensions = useWindowDimensions();
    var width = dimensions.width;
    var height = dimensions.height;
    
    var isLandscape = width > height;
    var isTablet = Math.min(width, height) >= 480;
    var isLargeTablet = Math.min(width, height) >= 800;
    var isSmallDevice = width < 480;
    var splitProductColumns = isLargeTablet ? 4 : 3;

    var stateSearchQuery = React.useState('');
    var searchQuery = stateSearchQuery[0];
    var setSearchQuery = stateSearchQuery[1];

    var stateProducts = React.useState([]);
    var products = stateProducts[0];
    var setProducts = stateProducts[1];

    var stateLoadingProducts = React.useState(true);
    var loadingProducts = stateLoadingProducts[0];
    var setLoadingProducts = stateLoadingProducts[1];

    var stateSelectedCategory = React.useState('Semua');
    var selectedCategory = stateSelectedCategory[0];
    var setSelectedCategory = stateSelectedCategory[1];

    var stateCategories = React.useState(['Semua']);
    var categories = stateCategories[0];
    var setCategories = stateCategories[1];

    var stateTopSellingProducts = React.useState([]);
    var topSellingProducts = stateTopSellingProducts[0];
    var setTopSellingProducts = stateTopSellingProducts[1];

    var stateCustomers = React.useState([]);
    var customers = stateCustomers[0];
    var setCustomers = stateCustomers[1];

    var stateWaiters = React.useState([]);
    var waiters = stateWaiters[0];
    var setWaiters = stateWaiters[1];

    var stateShowCustomerModal = React.useState(false);
    var showCustomerModal = stateShowCustomerModal[0];
    var setShowCustomerModal = stateShowCustomerModal[1];

    var stateShowSuccessModal = React.useState(false);
    var showSuccessModal = stateShowSuccessModal[0];
    var setShowSuccessModal = stateShowSuccessModal[1];

    var stateSuccessModalConfig = React.useState({ title: 'Pesanan Terkirim!', message: 'Pesanan Anda telah masuk ke sistem kasir.' });
    var successModalConfig = stateSuccessModalConfig[0];
    var setSuccessModalConfig = stateSuccessModalConfig[1];

    var stateLastOrderNo = React.useState('');
    var lastOrderNo = stateLastOrderNo[0];
    var setLastOrderNo = stateLastOrderNo[1];

    var stateLastSaleId = React.useState('');
    var lastSaleId = stateLastSaleId[0];
    var setLastSaleId = stateLastSaleId[1];

    var stateShowCartModal = React.useState(false);
    var showCartModal = stateShowCartModal[0];
    var setShowCartModal = stateShowCartModal[1];

    var stateCurrentSaleId = React.useState(null);
    var currentSaleId = stateCurrentSaleId[0];
    var setCurrentSaleId = stateCurrentSaleId[1];

    var stateIsOnline = React.useState(true);
    var isOnline = stateIsOnline[0];
    var setIsOnline = stateIsOnline[1];

    var stateIsManualOffline = React.useState(false);
    var isManualOffline = stateIsManualOffline[0];
    var setIsManualOffline = stateIsManualOffline[1];

    var stateShowMemberLoginModal = React.useState(false);
    var showMemberLoginModal = stateShowMemberLoginModal[0];
    var setShowMemberLoginModal = stateShowMemberLoginModal[1];

    var stateCountdown = React.useState(5);
    var countdown = stateCountdown[0];
    var setCountdown = stateCountdown[1];

    var stateMemberPhone = React.useState('');
    var memberPhone = stateMemberPhone[0];
    var setMemberPhone = stateMemberPhone[1];

    var statePaymentMethods = React.useState([
        { id: 'cash', name: 'Tunai', type: 'cash' },
        { id: 'qris', name: 'QRIS', type: 'digital' },
        { id: 'debit', name: 'Debit', type: 'card' }
    ]);
    var paymentMethods = statePaymentMethods[0];
    var setPaymentMethods = statePaymentMethods[1];

    var stateCart = React.useState([]);
    var cart = stateCart[0];
    var setCart = stateCart[1];

    var stateInitialItems = React.useState([]);
    var initialItems = stateInitialItems[0];
    var setInitialItems = stateInitialItems[1];

    var stateSelectedTable = React.useState('-');
    var selectedTable = stateSelectedTable[0];
    var setSelectedTable = stateSelectedTable[1];

    var stateOrderType = React.useState((tableNo && tableNo === 'TAKEAWAY') ? 'take_away' : 'dine_in');
    var orderType = stateOrderType[0];
    var setOrderType = stateOrderType[1];

    var stateCustomerName = React.useState('Guest');
    var customerName = stateCustomerName[0];
    var setCustomerName = stateCustomerName[1];

    var stateSelectedCustomerId = React.useState(null);
    var selectedCustomerId = stateSelectedCustomerId[0];
    var setSelectedCustomerId = stateSelectedCustomerId[1];

    var stateSelectedWaiter = React.useState(initialWaiter || '');
    var selectedWaiter = stateSelectedWaiter[0];
    var setSelectedWaiter = stateSelectedWaiter[1];

    var statePosFlow = React.useState('direct');
    var posFlow = statePosFlow[0];
    var setPosFlow = statePosFlow[1];

    var stateCashierMode = React.useState(true);
    var cashierMode = stateCashierMode[0];
    var setCashierMode = stateCashierMode[1];

    var stateShowPaymentModal = React.useState(false);
    var showPaymentModal = stateShowPaymentModal[0];
    var setShowPaymentModal = stateShowPaymentModal[1];

    var stateExistingSaleId = React.useState(null);
    var existingSaleId = stateExistingSaleId[0];
    var setExistingSaleId = stateExistingSaleId[1];

    var stateShowManualItemModal = React.useState(false);
    var showManualItemModal = stateShowManualItemModal[0];
    var setShowManualItemModal = stateShowManualItemModal[1];

    var stateShowDiscountModal = React.useState(false);
    var showDiscountModal = stateShowDiscountModal[0];
    var setShowDiscountModal = stateShowDiscountModal[1];

    var stateShowSplitBillModal = React.useState(false);
    var showSplitBillModal = stateShowSplitBillModal[0];
    var setShowSplitBillModal = stateShowSplitBillModal[1];

    var stateShowHeldOrdersModal = React.useState(false);
    var showHeldOrdersModal = stateShowHeldOrdersModal[0];
    var setShowHeldOrdersModal = stateShowHeldOrdersModal[1];

    var stateOrderDiscount = React.useState(0);
    var orderDiscount = stateOrderDiscount[0];
    var setOrderDiscount = stateOrderDiscount[1];

    var stateDiscountReason = React.useState('');
    var discountReason = stateDiscountReason[0];
    var setDiscountReason = stateDiscountReason[1];

    var stateHeldOrders = React.useState([]);
    var heldOrders = stateHeldOrders[0];
    var setHeldOrders = stateHeldOrders[1];

    var stateShowHoldNoteModal = React.useState(false);
    var showHoldNoteModal = stateShowHoldNoteModal[0];
    var setShowHoldNoteModal = stateShowHoldNoteModal[1];

    var stateIsSplitPayment = React.useState(false);
    var isSplitPayment = stateIsSplitPayment[0];
    var setIsSplitPayment = stateIsSplitPayment[1];

    var stateIsSelfServiceOrder = React.useState(false);
    var isSelfServiceOrder = stateIsSelfServiceOrder[0];
    var setIsSelfServiceOrder = stateIsSelfServiceOrder[1];

    var stateSplitItemsToPay = React.useState([]);
    var splitItemsToPay = stateSplitItemsToPay[0];
    var setSplitItemsToPay = stateSplitItemsToPay[1];

    var stateShowReceiptPreview = React.useState(false);
    var showReceiptPreview = stateShowReceiptPreview[0];
    var setShowReceiptPreview = stateShowReceiptPreview[1];

    var stateShowTableManualModal = React.useState(false);
    var showTableManualModal = stateShowTableManualModal[0];
    var setShowTableManualModal = stateShowTableManualModal[1];

    var stateShowWaiterModal = React.useState(false);
    var showWaiterModal = stateShowWaiterModal[0];
    var setShowWaiterModal = stateShowWaiterModal[1];

    var stateWaiterSearchQuery = React.useState('');
    var waiterSearchQuery = stateWaiterSearchQuery[0];
    var setWaiterSearchQuery = stateWaiterSearchQuery[1];

    var stateManualTableInput = React.useState('');
    var manualTableInput = stateManualTableInput[0];
    var setManualTableInput = stateManualTableInput[1];

    var stateShowManagerAuthModal = React.useState(false);
    var showManagerAuthModal = stateShowManagerAuthModal[0];
    var setShowManagerAuthModal = stateShowManagerAuthModal[1];

    var statePreviewOrderData = React.useState(null);
    var previewOrderData = statePreviewOrderData[0];
    var setPreviewOrderData = statePreviewOrderData[1];

    var stateIsPrinterReady = React.useState(false);
    var isPrinterReady = stateIsPrinterReady[0];
    var setIsPrinterReady = stateIsPrinterReady[1];

    var stateIsPrinting = React.useState(false);
    var isPrinting = stateIsPrinting[0];
    var setIsPrinting = stateIsPrinting[1];

    var stateReceiptPrintMode = React.useState('manual');
    var receiptPrintMode = stateReceiptPrintMode[0];
    var setReceiptPrintMode = stateReceiptPrintMode[1];

    var stateIsPartialSplit = React.useState(false);
    var isPartialSplit = stateIsPartialSplit[0];
    var setIsPartialSplit = stateIsPartialSplit[1];

    var stateRemoteOrders = React.useState([]);
    var remoteOrders = stateRemoteOrders[0];
    var setRemoteOrders = stateRemoteOrders[1];

    var stateEnableHoldPrinting = React.useState(false);
    var enableHoldPrinting = stateEnableHoldPrinting[0];
    var setEnableHoldPrinting = stateEnableHoldPrinting[1];

    var stateIsFetchingRemote = React.useState(false);
    var isFetchingRemote = stateIsFetchingRemote[0];
    var setIsFetchingRemote = stateIsFetchingRemote[1];

    var stateIsSubmitting = React.useState(false);
    var isSubmitting = stateIsSubmitting[0];
    var setIsSubmitting = stateIsSubmitting[1];

    var lastFetchTime = React.useRef(0);
    var fetchInProgress = React.useRef(false);
    var fetchTimeoutRef = React.useRef(null);
    var isFirstRender = React.useRef(true);

    var stateToastVisible = React.useState(false);
    var toastVisible = stateToastVisible[0];
    var setToastVisible = stateToastVisible[1];

    var paymentRequestIdRef = React.useRef(null);
    var checkoutRequestIdRef = React.useRef(null);
    var holdRequestIdRef = React.useRef(null);

    var stateToastMessage = React.useState('');
    var toastMessage = stateToastMessage[0];
    var setToastMessage = stateToastMessage[1];

    var stateToastType = React.useState('success');
    var toastType = stateToastType[0];
    var setToastType = stateToastType[1];

    var showToast = function(message, type) {
        if (!type) type = 'success';
        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);
    };

    var resetPendingRequestIds = function() {
        paymentRequestIdRef.current = null;
        checkoutRequestIdRef.current = null;
        holdRequestIdRef.current = null;
    };

    var getOrCreateRequestId = function(refObj, prefix) {
        if (!refObj.current) {
            refObj.current = createClientTransactionId(prefix);
        }
        return refObj.current;
    };

    var verifySaleByClientTransactionId = function(clientTransactionId) {
        if (!clientTransactionId) return Promise.resolve(null);
        return supabase
            .from('sales')
            .select('id, order_no, status')
            .eq('client_transaction_id', clientTransactionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(function(res) {
                if (res.error) throw res.error;
                return res.data || null;
            })['catch'](function(err) {
                console.error('[POSScreen] Verify client transaction error:', err);
                return null;
            });
    };

    var verifyTimedOutSale = function(clientTransactionId, attemptsLeft) {
        if (attemptsLeft === undefined) attemptsLeft = TIMEOUT_VERIFY_ATTEMPTS;
        return verifySaleByClientTransactionId(clientTransactionId).then(function(foundSale) {
            if (foundSale) return foundSale;
            if (attemptsLeft <= 1) return null;
            return sleep(TIMEOUT_VERIFY_DELAY_MS).then(function() {
                return verifyTimedOutSale(clientTransactionId, attemptsLeft - 1);
            });
        });
    };

    var runUpsertSaleRequest = function(saleData, itemsData, targetSaleId, clientTransactionId) {
        var rpcPromise = supabase.rpc('upsert_sale_with_items', {
            p_sale_data: Object.assign({}, saleData, { client_transaction_id: clientTransactionId || null }),
            p_items_data: mapItemsForSupabase(itemsData),
            p_target_sale_id: targetSaleId
        });
        var timeoutPromise = new Promise(function(_, reject) {
            setTimeout(function() {
                reject(makeRpcTimeoutError(clientTransactionId));
            }, CHECKOUT_RPC_TIMEOUT_MS);
        });

        return Promise.race([
            rpcPromise,
            timeoutPromise
        ])['catch'](function(err) {
            if (!isRpcTimeoutError(err)) throw err;
            return verifyTimedOutSale(clientTransactionId).then(function(foundSale) {
                if (foundSale) {
                    return {
                        data: {
                            id: foundSale.id,
                            order_no: foundSale.order_no,
                            status: foundSale.status,
                            verified_after_timeout: true
                        },
                        error: null
                    };
                }
                throw err;
            });
        });
    };

    var renderSplitCartActions = function() {
        if (isActuallyDisplay) return null; // Sembunyikan aksi kasir di mode Display

        return React.createElement(View, { style: { marginBottom: 10 } },
            existingSaleId && React.createElement(View, { style: { backgroundColor: '#fff7ed', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#fdba74', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
                React.createElement(View, null,
                    React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', color: '#c2410c' } }, "EDIT PESANAN AKTIF"),
                    React.createElement(Text, { style: { fontSize: 12, color: '#9a3412' } }, "ID: " + existingSaleId)
                ),
                React.createElement(TouchableOpacity, { 
                    style: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#fdba74' },
                    onPress: function() {
                        Alert.alert('Batal Edit', 'Apakah Anda ingin membatalkan perubahan dan mengosongkan keranjang?', [
                            { text: 'Tidak', style: 'cancel' },
                            { text: 'Ya, Batal', onPress: function() { clearCart(); } }
                        ]);
                    }
                },
                    React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', color: '#ea580c' } }, "BATAL")
                )
            ),
            React.createElement(View, { style: [styles.quickActionsRow] },
                React.createElement(TouchableOpacity, {
                    style: styles.quickActionBtn,
                    onPress: function() { setShowManualItemModal(true); }
                },
                    React.createElement(Text, { style: styles.quickActionIcon }, "+"),
                    React.createElement(Text, { style: styles.quickActionText }, "Manual")
                ),
                React.createElement(TouchableOpacity, {
                    style: styles.quickActionBtn,
                    onPress: function() { 
                        if (isAdmin) {
                            setShowDiscountModal(true); 
                        } else {
                            setShowManagerAuthModal(true);
                        }
                    }
                },
                    React.createElement(Text, { style: styles.quickActionIcon }, "%"),
                    React.createElement(Text, { style: styles.quickActionText }, "Diskon")
                ),
                (!(storeSettings && storeSettings.restrict_split_bill) || isAdmin) && React.createElement(TouchableOpacity, { 
                    style: styles.quickActionBtn, 
                    onPress: function() { setShowSplitBillModal(true); } 
                },
                    React.createElement(Text, { style: styles.quickActionIcon }, "/"),
                    React.createElement(Text, { style: styles.quickActionText }, "Pisah")
                ),
                (cashierMode || isAdmin) && React.createElement(TouchableOpacity, {
                    style: styles.quickActionBtn,
                    onPress: function() { setShowHoldNoteModal(true); }
                },
                    React.createElement(Text, { style: styles.quickActionIcon }, "||"),
                    React.createElement(Text, { style: styles.quickActionText }, "Hold")
                ),
                React.createElement(TouchableOpacity, { style: styles.quickActionBtn, onPress: function() { setShowHeldOrdersModal(true); } },
                    React.createElement(Text, { style: styles.quickActionIcon }, "#"),
                    React.createElement(Text, { style: styles.quickActionText }, "Daftar")
                )
            )
        );
    };

    var renderSplitCartMeta = function() {
        if (isActuallyDisplay) return null; // Sembunyikan Meja/Kasir di pop-up pelanggan

        return React.createElement(View, { style: { flexDirection: 'row', marginBottom: 10 } },
            React.createElement(View, { style: { flex: 1, marginRight: 10 } },
                React.createElement(Text, { style: styles.cartSplitFieldLabel }, orderType === 'take_away' ? 'ORDER' : 'MEJA'),
                React.createElement(View, { style: styles.cartSplitFieldBox },
                    React.createElement(TextInput, {
                        style: styles.cartSplitFieldInput,
                        value: orderType === 'take_away' ? takeAwayLabel : (selectedTable === '-' ? '' : selectedTable),
                        onChangeText: function(text) {
                            if (orderType === 'take_away') return;
                            setSelectedTable(text || '-');
                        },
                        autoCapitalize: "characters",
                        placeholder: orderType === 'take_away' ? takeAwayLabel : 'Nomor meja',
                        placeholderTextColor: "#94a3b8",
                        editable: orderType !== 'take_away'
                    })
                )
            ),
            React.createElement(TouchableOpacity, { 
                style: { flex: 1.4 }, 
                onPress: function() { setShowWaiterModal(true); } 
            },
                React.createElement(Text, { style: styles.cartSplitFieldLabel }, "KASIR"),
                React.createElement(View, { style: [styles.cartSplitFieldBox, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }] },
                    React.createElement(Text, { numberOfLines: 1, style: { flex: 1, color: selectedWaiter ? '#111827' : '#94a3b8', fontSize: 13, fontWeight: '600' } },
                        selectedWaiter || 'Pilih kasir'
                    ),
                    React.createElement(Text, { style: { color: '#94a3b8', marginLeft: 8 } }, "v")
                )
            )
        );
    };

    React.useEffect(function() {
        if (isSideBySide && showCartModal) {
            setShowCartModal(false);
        }
    }, [isSideBySide, showCartModal]);

    React.useEffect(function() {
        if (orderType === 'take_away') {
            setSelectedTable('TAKEAWAY');
        } else if (selectedTable === 'TAKEAWAY') {
            setSelectedTable('-');
        }
    }, [orderType]);

    React.useEffect(function() {
        var normalizedTable = String(selectedTable || '').trim().toUpperCase();
        if (!normalizedTable || normalizedTable === '-') return;

        if (normalizedTable === 'TAKEAWAY') {
            setOrderType(function(prev) { return prev === 'take_away' ? prev : 'take_away'; });
            return;
        }

        setOrderType(function(prev) { return prev === 'dine_in' ? prev : 'dine_in'; });
    }, [selectedTable]);

    // Update cashier mode from storage but default to true if not set

    // Load POS Flow Setting
    React.useEffect(function() {
        var loadPOSFlow = function() {
            Promise.all([
                AsyncStorage.getItem('pos_flow'),
                AsyncStorage.getItem('cashier_mode'),
                AsyncStorage.getItem('post_payment_receipt_mode'),
                AsyncStorage.getItem('auto_print')
            ]).then(function(results) {
                var savedFlow = results[0];
                var savedCashierMode = results[1];
                var savedReceiptPrintMode = results[2];
                var savedAutoPrint = results[3];

                if (savedFlow) {
                    setPosFlow('direct');
                }

                if (savedCashierMode !== null) {
                    setCashierMode(savedCashierMode === 'true');
                } else {
                    setCashierMode(true);
                }

                if (savedReceiptPrintMode === 'auto' || savedReceiptPrintMode === 'manual') {
                    setReceiptPrintMode(savedReceiptPrintMode);
                } else {
                    // Default to 'auto' if not explicitly set to 'false'
                    setReceiptPrintMode(savedAutoPrint !== 'false' ? 'auto' : 'manual');
                }

                AsyncStorage.getItem('enable_hold_printing').then(function(val) {
                    if (val !== null) setEnableHoldPrinting(val === 'true');
                });
            });
        };
        loadPOSFlow();
    }, []);

    var sessionData = useSession();
    var permissions = sessionData.permissions;
    var isDisplayOnly = sessionData.isDisplayOnly;
    var sessionLoading = sessionData.loading;
    var isSessionActive = sessionData.isSessionActive;
    var currentSession = sessionData.currentSession;
    var branchName = sessionData.branchName;
    var branchAddress = sessionData.branchAddress;
    var branchPhone = sessionData.branchPhone;
    var isAdmin = sessionData.isAdmin;
    var storeSettings = sessionData.storeSettings;
    var currentBranchId = sessionData.currentBranchId;
    var userName = sessionData.userName;

    var orderCategoriesEnabled = storeSettings ? storeSettings.enable_order_type_categories !== false : true;
    var dineInLabel = (storeSettings && storeSettings.order_type_dine_in_label) ? storeSettings.order_type_dine_in_label.trim() : 'Dine In';
    var takeAwayLabel = (storeSettings && storeSettings.order_type_take_away_label) ? storeSettings.order_type_take_away_label.trim() : 'Take Away';
    var defaultOrderType = (orderCategoriesEnabled && storeSettings && storeSettings.default_order_type === 'take_away') ? 'take_away' : 'dine_in';
    var hasInitializedOrderType = React.useRef(false);

    React.useEffect(function() {
        if (hasInitializedOrderType.current) return;

        var tableBasedType = (tableNo && tableNo !== '-' && tableNo !== 'TAKEAWAY')
            ? 'dine_in'
            : undefined;

        setOrderType(tableBasedType || defaultOrderType);
        hasInitializedOrderType.current = true;
    }, [defaultOrderType, tableNo]);

    // Force Display Mode (Order Only) if user has the permission or role
    React.useEffect(function() {
        if (isDisplayOnly) {
            console.log('[POSScreen] isDisplayOnly detected. Forcing cashierMode=false');
            setCashierMode(false);
        } else {
            AsyncStorage.getItem('cashier_mode').then(function(val) {
                if (val !== null) setCashierMode(val === 'true');
            });
        }
    }, [isDisplayOnly]);

    // [NEW] Set default waiter from logged in user if not provided by route
    React.useEffect(function() {
        if (!selectedWaiter && userName && userName !== 'User') {
            console.log('[POSScreen] Setting default waiter from session:', userName);
            setSelectedWaiter(userName);
        }
    }, [userName]);

    var isActuallyDisplay = React.useMemo(function() {
        return isDisplayOnly;
    }, [isDisplayOnly]);
    var isSideBySide = !isActuallyDisplay && (isTablet || width >= 720);

    // Refs for realtime closure safety
    var cartRef = React.useRef(cart);
    var cashierModeRef = React.useRef(cashierMode);
    var isActuallyDisplayRef = React.useRef(isActuallyDisplay);
    React.useEffect(function() { cartRef.current = cart; }, [cart]);
    React.useEffect(function() { cashierModeRef.current = cashierMode; }, [cashierMode]);
    React.useEffect(function() { isActuallyDisplayRef.current = isActuallyDisplay; }, [isActuallyDisplay]);
    var productGridColumns = isActuallyDisplay
        ? (isLargeTablet ? 5 : (isTablet ? 4 : (isSmallDevice ? 3 : 4)))
        : (isSideBySide ? splitProductColumns : (isSmallDevice ? 3 : 4));

    React.useEffect(function() {
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
    React.useEffect(function() {
        var timer;
        if (showSuccessModal) {
            var timeout = isActuallyDisplay ? 2 : 20;
            setCountdown(isPartialSplit ? 999 : timeout); 
            
            timer = setInterval(function() {
                setCountdown(function(prev) {
                    if (isPrinting || isPartialSplit) return prev;
                    return prev > 0 ? prev - 1 : 0;
                });
            }, 1000);
        }
        return function() {
            if (timer) clearInterval(timer);
        };
    }, [showSuccessModal, isPartialSplit, isPrinting]);

    // Navigate when countdown reaches zero
    React.useEffect(function() {
        if (showSuccessModal && !isPartialSplit && countdown === 0) {
            setShowSuccessModal(false);
            if (!isActuallyDisplay) {
                (navigation as any).navigate('Main');
            }
        }
    }, [countdown, showSuccessModal, isPartialSplit, navigation]);







    var handleReconnectPrinters = function() {
        setToastMessage('Menghubungkan ke semua printer...');
        setToastType('info');
        setToastVisible(true);
        
        PrinterManager.reconnectAllConfiguredPrinters().then(function(resultsObj) {
            var results = resultsObj.results;
            var success = resultsObj.success;
            var detailsArr = [];
            for (var label in results) {
                detailsArr.push(label + ': ' + (results[label] ? '✅' : '❌'));
            }
            var details = detailsArr.join(', ');
            
            setToastMessage(success ? 'Semua printer terhubung!' : 'Beberapa printer gagal: ' + details);
            setToastType(success ? 'success' : 'error');
            setToastVisible(true);
            
            return Promise.all([
                AsyncStorage.getItem('@selected_printer_address'),
                AsyncStorage.getItem('@kitchen_printer_address'),
                AsyncStorage.getItem('@bar_printer_address')
            ]);
        }).then(function(macs) {
            var receiptMac = macs[0];
            var kitchenMac = macs[1];
            var barMac = macs[2];
            setIsPrinterReady(!!receiptMac || !!kitchenMac || !!barMac);
        })['catch'](function(error) {
            setToastMessage('Gagal menghubungi printer');
            setToastType('error');
            setToastVisible(true);
        });
    };

    var handleRefreshConnectivity = function() {
        OfflineService.getForcedOfflineMode().then(function(forced) {
            if (forced) {
                Alert.alert(
                    'Mode Manual Offline',
                    'Anda sedang dalam mode Manual Offline. Ingin kembali ke mode Online?',
                    [
                        { text: 'Batal', style: 'cancel' },
                        { 
                            text: 'Ya, Kembali Online', 
                            onPress: function() {
                                OfflineService.setForcedOfflineMode(false).then(function() {
                                    setIsManualOffline(false);
                                    return OfflineService.checkConnectivity();
                                }).then(function(online) {
                                    setIsOnline(online);
                                    setToastMessage(online ? 'Kembali Online' : 'Offline (Cek Koneksi)');
                                    setToastType(online ? 'success' : 'error');
                                    setToastVisible(true);
                                });
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
                            onPress: function() {
                                OfflineService.setForcedOfflineMode(true).then(function() {
                                    setIsManualOffline(true);
                                    setIsOnline(false);
                                    setToastMessage('Mode Manual Offline Aktif');
                                    setToastType('warning');
                                    setToastVisible(true);
                                });
                            }
                        }
                    ]
                );
            }
        });
    };
    var handlePreviewReceipt = function() {
        if (!lastSaleId && !lastOrderNo) return;
        
        fetchOrderDataForReceipt(lastSaleId || lastOrderNo).then(function(orderData) {
            if (orderData) {
                setPreviewOrderData(orderData);
                setShowReceiptPreview(true);
            }
        })['catch'](function(e) {
            Alert.alert('Error', 'Gagal memuat pratinjau struk');
        });
    };
    
    var handlePrePaymentPreview = function() {
        var breakdown = calculateActiveBreakdown();
        var currentData = {
            order_no: 'DRAFT-' + (Date.now().toString().slice(-4)),
            table_no: selectedTable || '-',
            customer_name: customerName || 'Guest',
            customer_level: 'Regular',
            cashier_name: userName || '-',
            waiter_name: selectedWaiter || userName || '-',
            total: breakdown.total,
            subtotal: breakdown.subtotal,
            discount: breakdown.discount,
            tax: breakdown.tax,
            service_charge: breakdown.serviceCharge,
            items: cart.map(function(item) {
                return {
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    notes: item.notes,
                    target: item.target || 'Kitchen'
                };
            }),
            created_at: new Date().toISOString(),
            shop_name: branchName,
            shop_address: branchAddress,
            shop_phone: branchPhone,
            receipt_header: (storeSettings && storeSettings.receipt_header) || '',
            receipt_footer: (storeSettings && storeSettings.receipt_footer) || '',
            receipt_paper_width: (storeSettings && storeSettings.receipt_paper_width) || '58mm',
            show_logo: (storeSettings && storeSettings.show_logo) !== false,
            show_date: (storeSettings && storeSettings.show_date) !== false,
            show_cashier_name: (storeSettings && storeSettings.show_cashier_name) !== false,
            show_waiter: (storeSettings && storeSettings.show_waiter) !== false,
            show_table: (storeSettings && storeSettings.show_table) !== false,
            show_customer_name: (storeSettings && storeSettings.show_customer_name) !== false,
            show_customer_status: (storeSettings && storeSettings.show_customer_status) !== false,
            receipt_footer_feed: (storeSettings && storeSettings.receipt_footer_feed) !== undefined ? storeSettings.receipt_footer_feed : 4,
            enable_wifi_vouchers: (storeSettings && storeSettings.enable_wifi_vouchers) || false,
            wifi_voucher: (storeSettings && storeSettings.enable_wifi_vouchers) ? '[VOUCHER MUNCUL DI STRUK ASLI]' : '',
            wifi_voucher_notice: (storeSettings && storeSettings.wifi_voucher_notice) || 'Gunakan kode ini untuk akses WiFi',
            receipt_logo_url: (storeSettings && storeSettings.receipt_logo_url) || ''
        };
        
        setPreviewOrderData(currentData);
        setShowReceiptPreview(true);
    };

    var fetchOrderDataForReceipt = function(identifier) {
        var isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
        var isNumeric = /^\d+$/.test(identifier);
        
        var query = supabase
            .from('sales')
            .select('*, sale_items (*, product:product_id (name, category, is_taxed))');

        if (isUuid || isNumeric) {
            query.eq('id', identifier);
        } else {
            query.eq('order_no', identifier).order('created_at', { ascending: false }).limit(1);
        }

        return (query.single() as any).then(function(result: any) {
            var sale: any = result.data;
            var error = result.error;

            if (error) {
                if (!isUuid) {
                    return OfflineService.getSaleByOrderNo(identifier).then(function(offlineSale) {
                        if (offlineSale) {
                            return {
                                id: offlineSale.id,
                                order_no: offlineSale.order_no,
                                table_no: offlineSale.tableNo,
                                customer_name: offlineSale.customerName,
                                customer_level: 'Regular',
                                total: offlineSale.total,
                                subtotal: offlineSale.subtotal,
                                items: offlineSale.items.map(function(item) {
                                    return {
                                        name: item.name,
                                        price: item.price,
                                        quantity: item.quantity,
                                        notes: (item as any).notes,
                                        target: item.target || 'Kitchen'
                                    };
                                })
                            };
                        }
                        throw error;
                    });
                }
                throw error;
            }

            var customerTier = 'Regular';
            var wifiVoucher = null;

            var fetchTier = function() {
                if (sale.customer_id) {
                    return supabase
                        .from('contacts')
                        .select('tier')
                        .eq('id', sale.customer_id)
                        .single()
                        .then(function(contactResult) {
                            if (contactResult.data) {
                                customerTier = contactResult.data.tier || 'Regular';
                            }
                        });
                }
                return Promise.resolve();
            };

            var fetchWifi = function() {
                if (storeSettings && storeSettings.enable_wifi_vouchers) {
                    var minAmount = Number(storeSettings.wifi_voucher_min_amount) || 0;
                    var multiplier = Number(storeSettings.wifi_voucher_multiplier) || 0;
                    var totalAmount = Number(sale.total_amount) || 0;
                    
                    if (totalAmount >= minAmount) {
                        // Jika multiplier tidak diatur (0), gunakan minAmount sebagai pembagi
                        var divisor = multiplier > 0 ? multiplier : minAmount;
                        var count = divisor > 0 ? Math.floor(totalAmount / divisor) : 1;
                        if (count < 1) count = 1; // Pastikan minimal 1 voucher jika minAmount tercapai
                        
                        if (count > 0) {
                            return WifiVoucherService.getVoucherForSale(sale.id, currentBranchId || '1', count).then(function(v) {
                                wifiVoucher = v;
                            })['catch'](function(e) {
                                console.error('[POSScreen] WiFi fetch error:', e);
                            });
                        }
                    }
                }
                return Promise.resolve();
            };

            return fetchTier().then(fetchWifi).then(function() {
                return {
                    order_no: sale.order_no,
                    table_no: sale.table_no,
                    customer_name: sale.customer_name,
                    customer_level: customerTier,
                    enable_order_type_categories: storeSettings ? storeSettings.enable_order_type_categories : true,
                    order_type_dine_in_label: storeSettings ? storeSettings.order_type_dine_in_label : 'Dine In',
                    order_type_take_away_label: storeSettings ? storeSettings.order_type_take_away_label : 'Take Away',
                    cashier_name: (!isDisplayOnly && userName && userName !== 'User') ? userName : '-',
                    waiter_name: sale.waiter_name || '-',
                    total: sale.total_amount,
                    discount: sale.discount || 0,
                    tax: sale.tax || 0,
                    service_charge: sale.service_charge || 0,
                    tax_rate: storeSettings ? storeSettings.tax_rate : 0,
                    service_rate: storeSettings ? storeSettings.service_rate : 0,
                    receipt_header: storeSettings ? storeSettings.receipt_header : '',
                    receipt_footer: storeSettings ? storeSettings.receipt_footer : '',
                    receipt_paper_width: (storeSettings && storeSettings.receipt_paper_width) ? storeSettings.receipt_paper_width : '58mm',
                    receipt_logo_url: storeSettings ? storeSettings.receipt_logo_url : '',
                    shop_address: storeSettings ? storeSettings.address : '',
                    show_logo: storeSettings ? storeSettings.show_logo : true,
                    show_date: storeSettings ? storeSettings.show_date : true,
                    show_cashier_name: (storeSettings && storeSettings.show_cashier_name !== undefined) ? storeSettings.show_cashier_name : true,
                    show_waiter: storeSettings ? storeSettings.show_waiter : true,
                    show_table: storeSettings ? storeSettings.show_table : true,
                    show_customer_name: storeSettings ? storeSettings.show_customer_name : true,
                    show_customer_status: storeSettings ? storeSettings.show_customer_status : true,
                    receipt_footer_feed: storeSettings ? storeSettings.receipt_footer_feed : 4,
                    enable_wifi_vouchers: storeSettings ? storeSettings.enable_wifi_vouchers : false,
                    wifi_voucher: wifiVoucher,
                    wifi_voucher_notice: storeSettings ? storeSettings.wifi_voucher_notice : '',
                    payment_method: sale.payment_method,
                    paid_amount: sale.paid_amount,
                    change: sale.change,
                    created_at: sale.date,
                    shop_name: branchName,
                    shop_phone: branchPhone,
                    items: sale.sale_items.map(function(si) {
                        return {
                            name: si.product ? si.product.name : si.product_name,
                            price: si.price,
                            quantity: si.quantity,
                            target: si.target || determineTarget({ name: si.product_name, category: (si.product && si.product.category) ? si.product.category : '' }),
                            category: (si.product && si.product.category) ? si.product.category : '',
                            is_taxed: si.is_taxed || false,
                            notes: si.notes
                        };
                    })
                };
            });
        });
    };

    React.useEffect(function() {
        var isMounted = true;

        var loadInitialData = function() {
            console.log('[POSScreen] Loading initial data...');
            Promise.all([
                AsyncStorage.getItem('cached_products_' + currentBranchId),
                AsyncStorage.getItem('cached_categories_' + currentBranchId),
                AsyncStorage.getItem('cached_payment_methods')
            ]).then(function(cached) {
                var cachedProducts = cached[0];
                var cachedCategories = cached[1];
                var cachedPMs = cached[2];
                
                if (isMounted) {
                    if (cachedProducts) {
                        try {
                            var parsedProducts = JSON.parse(cachedProducts);
                            if (Array.isArray(parsedProducts)) setProducts(parsedProducts);
                            setLoadingProducts(false);
                        } catch (e) { console.error('Error parsing cached products:', e); }
                    }
                    if (cachedCategories) {
                        try {
                            var parsed = JSON.parse(cachedCategories);
                            if (Array.isArray(parsed)) {
                                var merged = ['Semua'].concat(parsed.filter(function(c) { return c !== 'Semua'; }));
                                setCategories(merged);
                            }
                        } catch (e) { console.error('Error parsing cached categories:', e); }
                    }
                    if (cachedPMs) {
                        try {
                            var parsedPMs = JSON.parse(cachedPMs);
                            if (Array.isArray(parsedPMs)) setPaymentMethods(parsedPMs);
                        } catch (e) { console.error('Error parsing cached PMs:', e); }
                    }
                }

                return Promise.all([
                    fetchProducts(),
                    fetchTopSellingProducts(),
                    fetchCategories(),
                    fetchMasterData()
                ]);
            }).then(function() {
                return Promise.all([
                    AsyncStorage.getItem('pos_held_orders'),
                    AsyncStorage.getItem('local_held_orders'),
                    AsyncStorage.getItem('pos_cart_draft'),
                    AsyncStorage.getItem('pos_customer_draft_name'),
                    AsyncStorage.getItem('pos_customer_draft_id'),
                    AsyncStorage.getItem('pos_table_draft'),
                    AsyncStorage.getItem('pos_discount_draft'),
                    AsyncStorage.getItem('pos_waiter_draft'),
                    AsyncStorage.getItem('pos_existing_sale_id_draft'),
                    AsyncStorage.getItem('cached_customers')
                ]);
            }).then(function(saved) {
                var savedHeldStr = saved[0];
                var savedLocalHeldStr = saved[1];
                var savedCart = saved[2];
                var savedCustName = saved[3];
                var savedCustId = saved[4];
                var savedTable = saved[5];
                var savedDiscount = saved[6];
                var savedWaiter = saved[7];
                var savedExistingId = saved[8];
                var savedCustomers = saved[9];

                if (isMounted) {
                    if (savedHeldStr || savedLocalHeldStr) {
                        try {
                            var parsedHeld = savedHeldStr ? JSON.parse(savedHeldStr) : [];
                            var parsedLocalHeld = savedLocalHeldStr ? JSON.parse(savedLocalHeldStr) : [];
                            var mergedHeldMap = {};
                            []
                                .concat(Array.isArray(parsedHeld) ? parsedHeld : [])
                                .concat(Array.isArray(parsedLocalHeld) ? parsedLocalHeld : [])
                                .forEach(function(h) {
                                    if (!h || !h.id) return;
                                    var obj = merge({}, h);
                                    obj.createdAt = h.createdAt || h.date || new Date().toISOString();
                                    obj.total = Number(h.total != null ? h.total : h.total_amount) || 0;
                                    obj.tableNo = h.tableNo || h.table_no || '-';
                                    obj.customerName = h.customerName || h.customer_name || 'Guest';
                                    obj.selectedCustomerId = h.selectedCustomerId != null ? h.selectedCustomerId : (h.customer_id || null);
                                    obj.selectedWaiter = h.selectedWaiter || h.waiter_name || '';
                                    obj.isRemote = h.isRemote === true;
                                    mergedHeldMap[String(h.id)] = obj;
                                });

                            var mergedHeld = Object.keys(mergedHeldMap).map(function(key) {
                                var obj = mergedHeldMap[key];
                                obj.createdAt = new Date(obj.createdAt);
                                return obj;
                            });

                            if (mergedHeld.length > 0) {
                                setHeldOrders(mergedHeld);
                            }
                        } catch (e) { console.error('Error parsing held orders:', e); }
                    }

                    if (savedCustomers && customers.length === 0) {
                        try {
                            var parsedCusts = JSON.parse(savedCustomers);
                            if (Array.isArray(parsedCusts)) setCustomers(parsedCusts);
                        } catch (e) { console.error('Error parsing saved customers:', e); }
                    }

                    if (route.params) {
                        var orderId = (route.params as any).orderId;
                        if (orderId) loadOrderById(orderId);
                    } else {
                        if (savedCart) {
                            try {
                                var parsedCart = JSON.parse(savedCart);
                                if (Array.isArray(parsedCart)) setCart(normalizeCartItems(parsedCart));
                            } catch (e) { console.error('Error parsing saved cart:', e); }
                        }
                        if (savedCustName) setCustomerName(savedCustName);
                        if (savedCustId) {
                            var isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(savedCustId);
                            setSelectedCustomerId(savedCustId === 'null' ? null : (isUuid ? savedCustId : parseInt(savedCustId)));
                        }
                        if (savedTable) setSelectedTable(savedTable);
                        if (savedDiscount) setOrderDiscount(parseFloat(savedDiscount) || 0);
                        if (savedWaiter) setSelectedWaiter(savedWaiter || '');
                        if (savedExistingId) {
                            var isExistingUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(savedExistingId);
                            setExistingSaleId(savedExistingId === 'null' ? null : (isExistingUuid ? savedExistingId : parseInt(savedExistingId)));
                        }
                    }
                }
            })['catch'](function(err) {
                console.error('[POSScreen] Load Error:', err);
            }).finally(function() {
                isFirstRender.current = false;
                if (isMounted) setLoadingProducts(false);
            });

        };

        loadInitialData();

        var checkConn = function() {
            OfflineService.getForcedOfflineMode()
                .then(function(forced) {
                    setIsManualOffline(forced);
                    if (forced) {
                        setIsOnline(false);
                        return Promise.resolve(false);
                    } else {
                        return OfflineService.checkConnectivity().then(function(online) {
                            setIsOnline(online);
                            return online;
                        });
                    }
                })
                .then(function() {
                    return Promise.all([
                        AsyncStorage.getItem('@selected_printer_address'),
                        AsyncStorage.getItem('@kitchen_printer_address'),
                        AsyncStorage.getItem('@bar_printer_address')
                    ]);
                })
                .then(function(macs) {
                    setIsPrinterReady(!!macs[0] || !!macs[1] || !!macs[2]);
                });
        };
        checkConn();
        var connInterval = setInterval(checkConn, 15000);
        var timer = setTimeout(function() { if (isMounted) setLoadingProducts(false); }, 5000);

        return function() {
            isMounted = false;
            clearTimeout(timer);
            clearInterval(connInterval);
        };
    }, [currentBranchId, route.params ? (route.params as any).orderId : null]);

    var fetchRemotePendingOrders = function(force?: boolean) {
        if (force === undefined) force = false;
        if (!currentBranchId || isDisplayOnly || fetchInProgress.current) return;
        
        fetchInProgress.current = true;
        setIsFetchingRemote(true);
        console.log('[POSScreen] Fetching remote pending orders...');
        
        supabase
            .from('sales')
            .select('*')
            .eq('branch_id', currentBranchId)
            .in('status', ['Pending', 'Unpaid'])
            .order('date', { ascending: false })
            .limit(50)
            .then(function(res) {
                var data = res.data;
                var error = res.error;
                if (error) throw error;
                
                var mappedOrders = (data || []).map(function(sale) {
                    return {
                        id: String(sale.id),
                        orderNo: sale.order_no,
                        items: [], 
                        discount: sale.discount || 0,
                        total: sale.total_amount || 0,
                        createdAt: new Date(sale.date),
                        tableNo: sale.table_no || '-',
                        note: sale.notes || '',
                        isRemote: true
                    };
                });
                
                setRemoteOrders(mappedOrders);
                lastFetchTime.current = Date.now();
            })
            ['catch'](function(err) {
                console.error('[POSScreen] Fetch Remote Orders Error:', err);
            })
            .finally(function() {
                setIsFetchingRemote(false);
                fetchInProgress.current = false;
            });
    };

    React.useEffect(function() {
        if (!currentBranchId || isDisplayOnly) return;
        var branchIdInt = currentBranchId;
        fetchRemotePendingOrders();

        var salesChannel = supabase
            .channel('pos_realtime_' + currentBranchId)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'sales', filter: 'branch_id=eq.' + branchIdInt },
                function(payload) {
                    var newOrder = payload.new;
                    if (newOrder.status === 'Pending' || newOrder.status === 'Unpaid' || newOrder.status === 'Self-Service') {
                        var label = newOrder.status === 'Self-Service' ? 'SELF-SERVICE' : 'PESANAN';
                        console.log('[POSRealtime] New order received:', newOrder.id, 'Status:', newOrder.status, 'Cart Length:', cartRef.current.length);
                        showToast(label + ' MASUK: ' + (newOrder.order_no || newOrder.id) + ' (Meja: ' + (newOrder.table_no || '-') + ')', 'info');

                        // AUTO-LOAD: Jika keranjang kosong dan ini adalah mode kasir, langsung muat pesanan
                        if (cartRef.current.length === 0 && cashierModeRef.current && !isActuallyDisplayRef.current) {
                            console.log('[POSScreen] Auto-loading incoming ' + label + ' order:', newOrder.id);
                            // Beri jeda sangat singkat agar toast muncul dulu
                            setTimeout(function() {
                                handleRestoreHeldOrder({
                                    id: String(newOrder.id),
                                    orderNo: newOrder.order_no,
                                    items: [], 
                                    discount: newOrder.discount || 0,
                                    total: newOrder.total_amount || 0,
                                    createdAt: new Date(newOrder.date),
                                    tableNo: newOrder.table_no || '-',
                                    isRemote: true
                                });
                            }, 100);
                        }
                    }
                    
                    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
                    fetchTimeoutRef.current = setTimeout(function() {
                        fetchRemotePendingOrders(true);
                    }, 500);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'sales', filter: 'branch_id=eq.' + branchIdInt },
                function() {
                    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
                    fetchTimeoutRef.current = setTimeout(function() {
                        fetchRemotePendingOrders(true);
                    }, 500);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'sales', filter: 'branch_id=eq.' + branchIdInt },
                function() {
                    fetchRemotePendingOrders(true);
                }
            )
            .subscribe();

        return function() {
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
            supabase.removeChannel(salesChannel);
        };
    }, [currentBranchId, isDisplayOnly]);

    var loadFullSaleData = function(saleId) {
        return supabase
            .from('sales')
            .select('*, sale_items (*, product:product_id (*)), wifi_vouchers (*)')
            .eq('id', saleId)
            .single()
            .then(function(res) {
                var sale = res.data;
                var error = res.error;
                if (error) throw error;
                if (!sale) return null;

                return {
                    order_no: sale.order_no,
                    table_no: sale.table_no,
                    customer_name: sale.customer_name,
                    waiter_name: sale.waiter_name,
                    cashier_name: (!isDisplayOnly && userName && userName !== 'User') ? userName : '-',
                    total: sale.total_amount,
                    discount: sale.discount || 0,
                    tax: sale.tax || 0,
                    service_charge: sale.service_charge || 0,
                    payment_method: sale.payment_method,
                    paid_amount: sale.paid_amount,
                    change: sale.change,
                    created_at: sale.date,
                    // Tambahkan Store Settings & Flags
                    shop_name: branchName,
                    shop_address: (storeSettings && storeSettings.address) || '',
                    shop_phone: branchPhone,
                    receipt_header: (storeSettings && storeSettings.receipt_header) || '',
                    receipt_footer: (storeSettings && storeSettings.receipt_footer) || '',
                    show_logo: (storeSettings && storeSettings.show_logo) !== false,
                    show_date: (storeSettings && storeSettings.show_date) !== false,
                    show_table: (storeSettings && storeSettings.show_table) !== false,
                    show_customer_name: false, // Paksa sembunyikan sesuai permintaan
                    show_waiter: false,        // Paksa sembunyikan sesuai permintaan
                    show_cashier_name: (storeSettings && storeSettings.show_cashier_name) !== false,
                    receipt_logo_url: (storeSettings && storeSettings.receipt_logo_url) || '',
                    tax_rate: (storeSettings && storeSettings.tax_rate) || 0,
                    service_rate: (storeSettings && storeSettings.service_rate) || 0,
                    enable_wifi_vouchers: (storeSettings && storeSettings.enable_wifi_vouchers) === true,
                    wifi_notice: (storeSettings && storeSettings.wifi_voucher_notice) || 'Gunakan kode di bawah ini untuk akses WiFi',
                    wifi_voucher: (sale.wifi_vouchers && sale.wifi_vouchers.length > 0) 
                        ? sale.wifi_vouchers.map(function(v) { return v.code; }).join(', ') 
                        : null,
                    items: sale.sale_items.map(function(si) {
                        return {
                            name: si.product_name || (si.product ? si.product.name : 'Produk'),
                            price: si.price,
                            quantity: si.quantity,
                            target: si.target || determineTarget({ name: si.product_name, category: (si.product && si.product.category) ? si.product.category : '' }),
                            notes: si.notes
                        };
                    })
                };
            });
    };

    var loadOrderById = function(saleId) {
        console.log('POSScreen: Loading order by ID:', saleId);
        supabase
            .from('sales')
            .select('*, sale_items (*, product:product_id (*))')
            .eq('id', saleId)
            .single()
            .then(function(res) {
                var sale = res.data;
                var error = res.error;
                if (error) throw error;

                if (sale) {
                    setExistingSaleId(sale.id);
                    setCustomerName(sale.customer_name || 'Guest');
                    setSelectedCustomerId(sale.customer_id);
                    setSelectedWaiter(sale.waiter_name || '');
                    setSelectedTable(sale.table_no || '-');
                    setIsSelfServiceOrder(sale.status === 'Self-Service');
                    
                    var items = normalizeCartItems(sale.sale_items.map(function(si) {
                        return {
                            id: si.product_id,
                            product_id: si.product_id,
                            name: si.product_name || (si.product && si.product.name),
                            price: si.price,
                            quantity: si.quantity,
                            category: (si.product && si.product.category) ? si.product.category : '',
                            is_taxed: si.is_taxed,
                            target: si.target || determineTarget({ name: si.product_name, category: (si.product && si.product.category) ? si.product.category : '' }),
                            notes: si.notes || ''
                        };
                    }));
                    setCart(items);
                    setInitialItems(items);
                    
                    if (cashierMode && !isDisplayOnly) {
                        setTimeout(function() {
                            setShowCartModal(true);
                        }, 500);
                    }
                }
            })
            ['catch'](function(error) {
                console.error('Error loading order by ID:', error);
            });
    };

    var fetchMasterData = function() {
        var authorizedRoles = ['Manager', 'Manajer', 'Owner', 'Administrator', 'Admin', 'Supervisor'];
        Promise.all([
            supabase.from('customers').select('id, name, phone').limit(50),
            supabase.from('payment_methods').select('*').eq('is_active', true),
            supabase.from('employees')
                .select('name, pin, position, system_role')
                .not('pin', 'is', null)
                .or('position.in.(' + authorizedRoles.join(',') + '),system_role.in.(' + authorizedRoles.join(',') + ')'),
            supabase.from('employees')
                .select('id, name, position')
                .eq('branch_id', currentBranchId)
                .order('name', { ascending: true })
        ]).then(function(results) {
            var custRes = results[0];
            var pmRes = results[1];
            var managerRes = results[2];
            var allEmpRes = results[3];

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
        })['catch'](function(error) {
            console.error('Error fetching master data:', error);
        });
    };

    React.useEffect(function() {
        if (!isFirstRender.current) {
            var isCancelled = false;
            var interactionTask = null;
            // Tunggu interaksi selesai agar tap produk tidak terasa tersendat.
            var draftTimer = setTimeout(function() {
                interactionTask = InteractionManager.runAfterInteractions(function() {
                    if (isCancelled) return;
                    AsyncStorage.multiSet([
                        ['pos_cart_draft', JSON.stringify(cart)],
                        ['pos_customer_draft_name', customerName],
                        ['pos_customer_draft_id', String(selectedCustomerId)],
                        ['pos_table_draft', selectedTable],
                        ['pos_discount_draft', String(orderDiscount)],
                        ['pos_waiter_draft', selectedWaiter],
                        ['pos_existing_sale_id_draft', String(existingSaleId)]
                    ]).catch(function(e) { console.error('Error saving cart draft:', e); });
                });
            }, 1000);
            return function() {
                isCancelled = true;
                clearTimeout(draftTimer);
                if (interactionTask && typeof interactionTask.cancel === 'function') {
                    interactionTask.cancel();
                }
            };
        }
    }, [cart, customerName, selectedCustomerId, selectedTable, orderDiscount, selectedWaiter, existingSaleId]);

    React.useEffect(function() {
        if (!isFirstRender.current) {
            AsyncStorage.setItem('pos_held_orders', JSON.stringify(heldOrders));
        }
    }, [heldOrders]);

    React.useEffect(function() {
        if (showHeldOrdersModal) {
            fetchRemotePendingOrders(true);
        }
    }, [showHeldOrdersModal]);

    // Pre-connecting ditiadakan karena sering menyebabkan race condition pada bridge Bluetooth
    // PrinterManager akan melakukan koneksi secara on-demand saat print dimulai

    var fetchTopSellingProducts = function() {
        if (!currentBranchId) return;
        var thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        supabase
            .from('sale_items')
            .select('product_name, quantity, sale:sales!inner(date, branch_id)')
            .eq('sale.branch_id', currentBranchId)
            .gte('sale.date', thirtyDaysAgo.toISOString())
            .then(function(res) {
                var data = res.data;
                var error = res.error;
                if (error) throw error;

                var counts = {};
                (data || []).forEach(function(item) {
                    var name = item.product_name;
                    if (name) counts[name] = (counts[name] || 0) + (Number(item.quantity) || 1);
                });

                var sorted = Object.keys(counts)
                    .sort(function(a, b) { return counts[b] - counts[a]; })
                    .slice(0, 50);

                setTopSellingProducts(sorted);
            })
            ['catch'](function(err) {
                console.error('[POSScreen] Error fetching top selling:', err);
            });
    };

    var fetchCategories = function() {
        if (!currentBranchId) return;
        supabase.from('categories').select('name').order('sort_order')
            .then(function(res) {
                var data = res.data;
                var error = res.error;
                if (error) throw error;
                if (data) {
                    var uniqueSet = {};
                    data.forEach(function(c) {
                        if (c && c.name) {
                            var cleanName = c.name.toString().trim();
                            if (cleanName.length > 0 && cleanName.toLowerCase() !== 'semua') uniqueSet[cleanName] = true;
                        }
                    });
                    var uniqueCategories = ['Semua'].concat(Object.keys(uniqueSet));
                    setCategories(uniqueCategories);
                    AsyncStorage.setItem('cached_categories_' + currentBranchId, JSON.stringify(uniqueCategories));
                }
            })
            ['catch'](function(error) {
                console.error('Error fetching categories:', error);
            });
    };

    var fetchProducts = function() {
        if (!currentBranchId) return;
        setLoadingProducts(true);
        supabase
            .from('products')
            .select('id, name, price, image_url, category, target, stock, is_taxed, branch_id, sort_order, is_sellable, is_stock_ready')
            .or('branch_id.eq.' + currentBranchId + ',branch_id.is.null')
            .order('sort_order', { ascending: true })
            .then(function(res) {
                var data = res.data;
                var error = res.error;
                if (error) throw error;
                if (data) {
                    setProducts(data);
                    AsyncStorage.setItem('cached_products_' + currentBranchId, JSON.stringify(data));
                }
            })
            ['catch'](function(error) {
                console.error('Error fetching products:', error);
            })
            .finally(function() {
                setLoadingProducts(false);
            });
    };

    var filteredProducts = React.useMemo(function() {
        var result = products.filter(function(p) { return p.is_sellable !== false && p.is_stock_ready !== false; });
        if (selectedCategory !== 'Semua') {
            var lowerSelected = selectedCategory.toLowerCase();
            result = result.filter(function(p) { return (p.category || '').toLowerCase() === lowerSelected; });
        }
        if (searchQuery) {
            var lowerQuery = searchQuery.toLowerCase();
            result = result.filter(function(p) { return (p.name || '').toLowerCase().includes(lowerQuery); });
        }
        return result.sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    }, [products, searchQuery, selectedCategory]);


    var formatCurrency = React.useCallback(function(value) {
        if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
        }
        var valNum = Math.floor(Number(value));
        return 'Rp ' + valNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }, []);

    var checkMember = function() {
        if (!memberPhone.trim()) { Alert.alert('Info', 'Masukkan nomor HP'); return; }
        supabase.from('customers').select('*').eq('phone', memberPhone).maybeSingle()
            .then(function(res) {
                var exactData = res.data;
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
                    Alert.alert('Sukses', 'Selamat datang, ' + exactData.name + '!');
                }
            })
            ['catch'](function() { Alert.alert('Error', 'Terjadi kesalahan saat mengecek member'); });
    };

    var skipMemberLogin = function() {
        setCustomerName('Guest');
        setSelectedCustomerId(null);
        setShowMemberLoginModal(false);
        setMemberPhone('');
    };

    function determineTarget(item) {
        if (item.target && item.target !== 'Waitress') return item.target;
        
        var nameLow = (item.product_name || item.name || '').toLowerCase();
        var categoryLow = (item.category_name || item.category || '').toLowerCase();
        var drinks = ['minum', 'drink', 'beverage', 'juice', 'jus', 'tea', 'teh', 'coffee', 'kopi', 'susu', 'milk', 'water', 'air', 'mineral', 'soda', 'cola', 'coke', 'sprite', 'fanta', 'beer', 'bir', 'wine', 'cocktail', 'mocktail', 'smoothie', 'shake', 'milo', 'boba', 'thai tea', 'green tea', 'lemongrass', 'jeruk', 'lemon', 'alpukat', 'mangga', 'strawberry', 'jahe', 'madu', 'sirup', 'cendol', 'dawet', 'wedang', 'gembira', 'arak', 'espresso', 'latte', 'cappuccino', 'frappe'];
        
        var isDrink = false;
        for (var i = 0; i < drinks.length; i++) {
            if (categoryLow.indexOf(drinks[i]) !== -1 || nameLow.indexOf(drinks[i]) !== -1) {
                isDrink = true;
                break;
            }
        }
        if (!isDrink) {
            if (nameLow.indexOf('es ') === 0 || nameLow.indexOf('ice ') === 0 || nameLow.indexOf(' es ') !== -1 || nameLow.indexOf(' ice ') !== -1 || nameLow.indexOf(' panas') !== -1 || nameLow.indexOf(' hot') !== -1 || nameLow.indexOf(' dingin') !== -1 || nameLow.indexOf(' cold') !== -1) {
                isDrink = true;
            }
        }
        return isDrink ? 'Bar' : 'Kitchen';
    }

    var normalizeCartItem = function(item) {
        if (!item) return null;

        var rawId = item.id != null ? item.id : item.product_id;
        var fallbackId = 'manual-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        var normalizedId = rawId != null ? rawId : fallbackId;
        var isManualItem = item.isManual === true || String(normalizedId).indexOf('manual-') === 0;
        var normalized = {
            id: normalizedId,
            name: item.name || item.product_name || 'Produk',
            price: Number(item.price) || 0,
            quantity: Math.max(1, Number(item.quantity) || 1),
            target: item.target || determineTarget(item),
            notes: item.notes || ''
        } as any;

        var category = item.category || item.category_name;
        if (category) normalized.category = category;
        if (item.is_taxed === false) normalized.is_taxed = false;
        if (isManualItem) normalized.isManual = true;
        if (!isManualItem && item.product_id != null) normalized.product_id = item.product_id;

        return normalized;
    };

    var normalizeCartItems = function(items) {
        if (!Array.isArray(items)) return [];
        return items.map(function(item) {
            return normalizeCartItem(item);
        }).filter(function(item) {
            return !!item;
        });
    };

    var addToCart = React.useCallback(function(product) {
        var normalizedProduct = normalizeCartItem(product);
        if (!normalizedProduct) return;

        setCart(function(prevCart) {
            var existingItem = null;
            for (var k = 0; k < prevCart.length; k++) {
                if (prevCart[k].id === normalizedProduct.id) { existingItem = prevCart[k]; break; }
            }
            if (existingItem) {
                return prevCart.map(function(item) { 
                    if (item.id === normalizedProduct.id) {
                        var obj = merge({}, item);
                        obj.quantity = item.quantity + 1;
                        return obj;
                    }
                    return item;
                });
            }
            return prevCart.concat([normalizedProduct]);
        });
    }, []);

    var removeFromCart = React.useCallback(function(productId) {
        setCart(function(prevCart) {
            var existingItem = null;
            for (var k = 0; k < prevCart.length; k++) {
                if (prevCart[k].id === productId) { existingItem = prevCart[k]; break; }
            }
            if (existingItem && existingItem.quantity > 1) {
                return prevCart.map(function(item) { 
                    if (item.id === productId) {
                        var obj = merge({}, item);
                        obj.quantity = item.quantity - 1;
                        return obj;
                    }
                    return item;
                });
            }
            return prevCart.filter(function(item) { return item.id !== productId; });
        });
    }, []);

    var clearCart = React.useCallback(function() {
        setCart([]);
        setInitialItems([]);
        setExistingSaleId(null);
        setOrderDiscount(0);
        setDiscountReason('');
        setSelectedTable('-');
        setCustomerName('Guest');
        setSelectedCustomerId(null);
        setIsSelfServiceOrder(false);
        resetPendingRequestIds();
        
        // Bersihkan draft di storage ditangani oleh useEffect
    }, []);

    var calculateSubtotal = function() { return cart.reduce(function(total, item) { return total + (item.price * item.quantity); }, 0); };
    var calculateTaxableSubtotal = function() { return cart.reduce(function(sum, item) { return item.is_taxed === false ? sum : sum + (item.price * item.quantity); }, 0); };
    var calculateTaxAmount = function() { return (calculateTaxableSubtotal() * (storeSettings && storeSettings.tax_rate || 0)) / 100; };
    var calculateServiceAmount = function() { return (calculateTaxableSubtotal() * (storeSettings && storeSettings.service_rate || 0)) / 100; };
    var calculateTotal = function() { return Math.max(0, (calculateSubtotal() - orderDiscount) + calculateTaxAmount() + calculateServiceAmount()); };

    var calculateActiveBreakdown = React.useCallback(function() {
        if (!isSplitPayment) {
            var subtotal = calculateSubtotal();
            var tax = calculateTaxAmount();
            var service = calculateServiceAmount();
            var total = calculateTotal();
            return { subtotal: subtotal, tax: tax, serviceCharge: service, discount: orderDiscount, total: total };
        }
        var totalSubtotal = calculateSubtotal();
        if (totalSubtotal <= 0) return { subtotal: 0, tax: 0, serviceCharge: 0, discount: 0, total: 0 };
        var splitSubtotal = splitItemsToPay.reduce(function(sum, item) { return sum + (item.price * item.quantity); }, 0);
        var splitTaxableSubtotal = splitItemsToPay.reduce(function(sum, item) { return item.is_taxed === false ? sum : sum + (item.price * item.quantity); }, 0);
        var splitTax = (splitTaxableSubtotal * (storeSettings && storeSettings.tax_rate || 0)) / 100;
        var splitService = (splitTaxableSubtotal * (storeSettings && storeSettings.service_rate || 0)) / 100;
        var splitDiscount = orderDiscount * (splitSubtotal / totalSubtotal);
        var splitTotal = Math.max(0, splitSubtotal - splitDiscount + splitTax + splitService);
        return { subtotal: splitSubtotal, tax: splitTax, serviceCharge: splitService, discount: splitDiscount, total: splitTotal };
    }, [cart, splitItemsToPay, isSplitPayment, orderDiscount, storeSettings, calculateSubtotal, calculateTaxAmount, calculateServiceAmount, calculateTotal]);

    var activeBreakdown = React.useMemo(function() {
        return calculateActiveBreakdown();
    }, [calculateActiveBreakdown]);

    var handleAddManualItem = function(item) {
        var manualItem = normalizeCartItem({
            id: 'manual-' + Date.now(),
            name: item.name + (item.notes ? ' (' + item.notes + ')' : ''),
            price: item.price,
            quantity: 1,
            isManual: true,
            category: 'Manual',
            notes: item.notes
        });
        if (!manualItem) return;
        setCart(function(prev) { return prev.concat([manualItem]); });
        setShowManualItemModal(false);
    };

    var handleApplyDiscount = function(discount) {
        var amount = discount.type === 'percentage' ? (calculateSubtotal() * discount.value) / 100 : discount.value;
        setOrderDiscount(amount);
        setDiscountReason(discount.reason || '');
    };

    // --- SMART PRINTING LOGIC ------------------------------------------
    var executeSmartPrint = function(saleData, currentCart, referenceItems, silent) {
        if (silent === undefined) silent = false;
        try {
            var ref = referenceItems || initialItems || [];
            // 1. Tentukan item mana yang benar-benar baru (untuk menghindari cetak ulang)
            var diffItems = currentCart.map(function(item) {
                var initialItem = null;
                for (var k = 0; k < ref.length; k++) {
                    if (ref[k].id === item.id) { initialItem = ref[k]; break; }
                }
                if (!initialItem) return item;
                if (item.quantity > initialItem.quantity) {
                    var obj = Object.assign({}, item);
                    obj.quantity = item.quantity - initialItem.quantity;
                    return obj;
                }
                return null;
            }).filter(function(i) { return !!i; });

            if (diffItems.length > 0) {
                console.log('[POSScreen] Smart Printing: Memproses ' + diffItems.length + ' item baru.');
                
                // Pastikan item memiliki target yang benar sebelum dikirim
                var itemsWithTarget = diffItems.map(function(it) {
                    var obj = Object.assign({}, it);
                    obj.target = it.target || determineTarget(it);
                    console.log('[POSScreen] Item: ' + it.name + ', Target: ' + obj.target);
                    return obj;
                });

                // 1. Cetak Bar Dahulu
                var barDiff = itemsWithTarget.filter(function(it) { 
                    var t = (it.target || '').toUpperCase();
                    return t === 'BAR'; 
                });
                var barPromise = Promise.resolve();
                if (barDiff.length > 0) {
                    console.log('[POSScreen] Mencetak ' + barDiff.length + ' item ke BAR');
                    // Alert.alert('Debug Bar', 'Ditemukan ' + barDiff.length + ' item Bar'); // Debug
                    barPromise = PrinterManager.printToTarget(barDiff, 'bar', saleData, silent).catch(function(e) {
                        console.error('[POSScreen] Gagal cetak BAR:', e);
                    });
                }

                // 2. Cetak Kitchen SETELAH Bar Selesai (dengan jeda tambahan)
                barPromise.then(function() {
                    setTimeout(function() {
                        var kitchenDiff = itemsWithTarget.filter(function(it) {
                            var targetUp = (it.target || '').toUpperCase();
                            // Default ke KITCHEN jika tidak ada target
                            return targetUp === 'KITCHEN' || targetUp === 'DAPUR' || !targetUp;
                        });
                        if (kitchenDiff.length > 0) {
                            console.log('[POSScreen] Mencetak ' + kitchenDiff.length + ' item ke DAPUR');
                            PrinterManager.printToTarget(kitchenDiff, 'kitchen', saleData, silent).catch(function(e) {
                                console.error('[POSScreen] Gagal cetak DAPUR:', e);
                            });
                        }
                    }, 1500); // Jeda 1.5 detik agar koneksi bluetooth stabil
                });
            }
        } catch (err) {
            console.error('[POSScreen] Smart Printing Critical Error:', err);
        }
    };
    
    var mapItemsForSupabase = function(items) {
        return items.map(function(i) {
            // Pastikan product_id adalah angka atau null (untuk item manual/lokal)
            var rawId = i.product_id || i.id;
            var pid = (rawId && !isNaN(Number(rawId)) && String(rawId).indexOf('manual') === -1) ? Number(rawId) : null;
            
            var productName = i.name || i.product_name || 'Produk';
            return {
                product_id: pid,
                product_name: productName,
                price: Number(i.price) || 0,
                quantity: Number(i.quantity) || 1,
                notes: i.notes || '',
                target: i.target || (i.category ? determineTarget(i) : 'Bar')
            };
        });
    };

    var saveHeldOrderLocally = function(note) {
        return AsyncStorage.getItem('local_held_orders')
            .then(function(localHolds) {
                var holds = localHolds ? JSON.parse(localHolds) : [];
                var existingIdx = -1;
                var localId = existingSaleId || ('local-' + Date.now());
                for (var k = 0; k < holds.length; k++) {
                    if (holds[k].id === localId) { existingIdx = k; break; }
                }
                var localSaleData = {
                    id: localId,
                    branch_id: currentBranchId,
                    customer_name: customerName,
                    customerName: customerName,
                    customer_id: selectedCustomerId || null,
                    selectedCustomerId: selectedCustomerId || null,
                    table_no: selectedTable,
                    tableNo: selectedTable,
                    waiter_name: selectedWaiter || userName,
                    selectedWaiter: selectedWaiter || userName,
                    total_amount: calculateTotal(),
                    total: calculateTotal(),
                    discount: orderDiscount,
                    status: 'Pending',
                    note: note || '',
                    createdAt: new Date().toISOString(),
                    date: new Date().toISOString(),
                    items: cart,
                    isRemote: false
                };
                if (existingIdx >= 0) holds[existingIdx] = localSaleData;
                else holds.push(localSaleData);
                setHeldOrders(function(prev) {
                    var next = prev.filter(function(h) { return h.id !== localId; });
                    next.push(localSaleData);
                    return next;
                });
                return AsyncStorage.setItem('local_held_orders', JSON.stringify(holds));
            });
    };

    var handleHoldOrder = function(note) {
        if (cart.length === 0) return;

        if (isOnline) {
            var pSaleData = {
                branch_id: Number(currentBranchId),
                customer_name: customerName || 'Guest',
                customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
                table_no: selectedTable || '-',
                waiter_name: selectedWaiter || userName || 'Kasir',
                total_amount: Number(calculateTotal()),
                discount: Number(orderDiscount || 0),
                status: 'Pending',
                date: new Date().toISOString()
            };
            var targetId = null;
            if (existingSaleId) {
                var numericHoldId = Number(existingSaleId);
                if (!isNaN(numericHoldId) && numericHoldId > 0) targetId = numericHoldId;
            }
            var holdRequestId = getOrCreateRequestId(holdRequestIdRef, 'hold');

            setIsSubmitting(true);
            return runUpsertSaleRequest(
                pSaleData,
                cart,
                targetId,
                holdRequestId
            ).then(function(res) {
                var data = res.data as any;
                var error = res.error;
                if (error) throw error;
                var smartPrintData = Object.assign({}, pSaleData, { order_no: data.order_no });
                executeSmartPrint(smartPrintData, cart, initialItems, true);
                holdRequestIdRef.current = null;

                showToast('Pesanan di-hold & sinkron', 'success');
                clearCart();
                setShowHoldNoteModal(false);
                setShowCartModal(false);
                fetchRemotePendingOrders(true);
            })['catch'](function(err) {
                console.error('[POSScreen] Hold Error:', err);
                if (isRpcTimeoutError(err)) {
                    Alert.alert('Hold Sedang Diverifikasi', 'Status pesanan belum bisa dipastikan. Jangan tekan hold berulang. Cek daftar pesanan dalam beberapa detik.');
                    return;
                }
                var errorMsg = err && err.message ? err.message : 'Terjadi kesalahan saat menyimpan pesanan ke cloud.';
                Alert.alert('Gagal Hold', errorMsg);
            })['finally'](function() {
                setIsSubmitting(false);
            });
        } else {
            saveHeldOrderLocally(note)
                .then(function() {
                    showToast('Pesanan disimpan LOKAL', 'success');
                    clearCart();
                    setShowHoldNoteModal(false);
                    setShowCartModal(false);
                })
                ['catch'](function(err) {
                    console.error('[POSScreen] Offline Hold Error:', err);
                });
        }
    };

    var saveOfflineSaleAndComplete = function(saleData, itemsToProc, paymentData, breakdown, isExistingOrder) {
        var localItems = itemsToProc.slice();
        var offlineSaleData = Object.assign({}, saleData, {
            items: localItems,
            status: 'Paid'
        });

        return OfflineService.saveSale(offlineSaleData)
            .then(function(savedOffline) {
                var offlineId = savedOffline.id;
                var offlineOrderNo = savedOffline.order_no;

                setLastOrderNo(offlineOrderNo);
                setLastSaleId(offlineId);

                setSuccessModalConfig({ 
                    title: 'Pembayaran Offline Berhasil!', 
                    message: 'Transaksi disimpan secara lokal dan akan disinkronkan saat online.' 
                });
                paymentRequestIdRef.current = null;
                setShowSuccessModal(true);
                setShowPaymentModal(false);
                setShowCartModal(false);

                if (isSplitPayment) {
                    var newCart = cart.slice();
                    splitItemsToPay.forEach(function(sp) {
                        var idx = -1;
                        for (var k = 0; k < newCart.length; k++) {
                            if (newCart[k].id === sp.id) { idx = k; break; }
                        }
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

                setTimeout(function() {
                    try {
                        handleAutomaticPrinting(offlineId, offlineOrderNo, localItems, isExistingOrder, paymentData, breakdown);
                    } catch (e) {
                        console.error('[POSScreen] Offline Background print execution error:', e);
                    }
                }, 800);
            })
            .catch(function(err) {
                console.error('[POSScreen] Offline Payment Save Error:', err);
                Alert.alert('Gagal Pembayaran', 'Gagal menyimpan transaksi offline ke memori lokal.');
            });
    };

    var handlePaymentConfirm = function(paymentData) {
        var itemsToProc = isSplitPayment ? splitItemsToPay : cart;
        if (itemsToProc.length === 0) {
            Alert.alert('Info', 'Tidak ada item untuk dibayar.');
            return;
        }
        
        var saleData, targetId, isExistingOrder;
        try {
            var breakdown = activeBreakdown;
            isExistingOrder = !!existingSaleId;
            saleData = {
                branch_id: Number(currentBranchId),
                customer_name: customerName || 'Guest',
                customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
                table_no: selectedTable || '-',
                waiter_name: selectedWaiter || userName || 'Kasir',
                total_amount: Number(breakdown.total),
                discount: Number(breakdown.discount),
                tax: Number(breakdown.tax),
                service_charge: Number(breakdown.serviceCharge),
                status: 'Paid',
                payment_method: paymentData.method,
                paid_amount: Number(paymentData.amount),
                change: Number(paymentData.change),
                date: new Date().toISOString()
            };

            var rawItems = isSplitPayment ? splitItemsToPay : cart;
            itemsToProc = rawItems.map(function(it) {
                var obj = Object.assign({}, it);
                if (!obj.target) obj.target = determineTarget(it);
                return obj;
            });

            targetId = null;
            if (!isSplitPayment && existingSaleId) {
                var numId = Number(existingSaleId);
                if (!isNaN(numId) && numId > 0) targetId = numId;
            }
        } catch (syncErr) {
            console.error('[POSScreen] Data prep error:', syncErr);
            Alert.alert('Error Internal', 'Gagal memproses data keranjang.');
            return Promise.reject(syncErr);
        }

        if (!isOnline) {
            return saveOfflineSaleAndComplete(saleData, itemsToProc, paymentData, breakdown, isExistingOrder);
        }

        var paymentRequestId = getOrCreateRequestId(paymentRequestIdRef, 'pay');
        saleData.client_transaction_id = paymentRequestId;
        setIsSubmitting(true);
        return runUpsertSaleRequest(
            saleData,
            itemsToProc,
            targetId,
            paymentRequestId
        ).then(function(res: any) {
            var data = res.data;
            var error = res.error;
            if (error) throw error;
            
            paymentRequestIdRef.current = null;
            setLastOrderNo(data.order_no);
            setLastSaleId(data.id);

            // 1. TAMPILKAN SUKSES & TUTUP MODAL SECEPATNYA (AGAR UI TIDAK FREEZE)
            setSuccessModalConfig({
                title: 'Pembayaran Berhasil!',
                message: data.verified_after_timeout
                    ? 'Transaksi berhasil ditemukan kembali setelah verifikasi server.'
                    : 'Transaksi telah selesai dicatat.'
            });
            setShowSuccessModal(true);
            setShowPaymentModal(false);
            setShowCartModal(false);

            if (isSplitPayment) {
                var newCart = cart.slice();
                splitItemsToPay.forEach(function(sp) {
                    var idx = -1;
                    for (var k = 0; k < newCart.length; k++) {
                        if (newCart[k].id === sp.id) { idx = k; break; }
                    }
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

            // 2. JALANKAN PROSES CETAK SECARA FAST-BACKGROUND
            // Memberi jeda lebih lama agar UI (Modal Success) selesai beranimasi/transisi
            setTimeout(function() {
                try {
                    // Cetak Otomatis (Struk & KDS) dalam satu flow
                    handleAutomaticPrinting(data.id, data.order_no, itemsToProc, isExistingOrder, paymentData, breakdown);
                } catch (e) {
                    console.error('[POSScreen] Background print execution error:', e);
                }
            }, 800);
        })['catch'](function(err) {
            console.error('[POSScreen] Payment Confirm Error:', err);
            if (isRpcTimeoutError(err)) {
                throw new Error('Status transaksi belum terkonfirmasi. Jangan tekan bayar ulang dengan transaksi baru. Tunggu beberapa detik lalu cek riwayat atau daftar pesanan.');
            }
            var errorMsg = err.message || (typeof err === 'string' ? err : 'Database sibuk');
            
            Alert.alert(
                'Gagal Pembayaran Online',
                'Gagal menghubungi server (' + errorMsg + ').\n\nApakah Anda ingin menyimpan transaksi ini secara OFFLINE (Lokal) agar struk tetap bisa dicetak?',
                [
                    { text: 'Batal', style: 'cancel' },
                    { 
                        text: 'Simpan Offline', 
                        onPress: function() {
                            saveOfflineSaleAndComplete(saleData, itemsToProc, paymentData, breakdown, isExistingOrder);
                        }
                    }
                ]
            );
            
            throw err;
        })['finally'](function() {
            setIsSubmitting(false);
        });
    };

    var handleRestoreHeldOrder = function(order: any) {
        if (cartRef.current.length > 0) { Alert.alert('Info', 'Kosongkan keranjang sebelum memuat pesanan'); return; }
        
        if (order.isRemote) {
            setShowHeldOrdersModal(false);
            loadOrderById(order.id);
            return;
        }

        var items = normalizeCartItems(order.items || []);
        setCart(items);
        setInitialItems(items);
        setOrderDiscount(order.discount || 0);
        setSelectedTable(order.table_no || order.tableNo || '-');
        setCustomerName(order.customer_name || order.customerName || 'Guest');
        setSelectedCustomerId(order.customer_id || order.selectedCustomerId || null);
        setSelectedWaiter(order.waiter_name || order.selectedWaiter || '');
        setExistingSaleId(order.id || order.existingSaleId || null);
        
        setShowHeldOrdersModal(false);
        if (!isSideBySide) setShowCartModal(true);
    };

    var handleCheckout = function() {
        if (!isSessionActive && cashierMode && !isActuallyDisplay && !isAdmin) {
            Alert.alert('Shift Belum Dibuka', 'Anda wajib membuka shift kasir terlebih dahulu.');
            return;
        }
        if (cart.length === 0) return;
        
        if (cashierMode && !isActuallyDisplay) { 
            setShowPaymentModal(true); 
            return; 
        }
        
        var pSaleData, targetId;
        try {
            pSaleData = {
                branch_id: Number(currentBranchId),
                customer_name: customerName || 'Guest',
                customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
                table_no: selectedTable || '-',
                waiter_name: selectedWaiter || userName || 'Kasir',
                total_amount: Number(calculateTotal()),
                status: isActuallyDisplay ? 'Self-Service' : 'Pending',
                discount: Number(orderDiscount || 0),
                tax: Number(calculateTaxAmount()),
                service_charge: Number(calculateServiceAmount()),
                date: new Date().toISOString()
            };

            targetId = null;
            if (existingSaleId) {
                var numId = Number(existingSaleId);
                if (!isNaN(numId) && numId > 0) targetId = numId;
            }
        } catch (syncErr) {
            console.error('[POSScreen] Kiosk Data prep error:', syncErr);
            Alert.alert('Error Internal', 'Gagal memproses data pesanan.');
            return Promise.reject(syncErr);
        }

        var checkoutRequestId = getOrCreateRequestId(checkoutRequestIdRef, 'checkout');
        pSaleData.client_transaction_id = checkoutRequestId;
        setIsSubmitting(true);
        return runUpsertSaleRequest(
            pSaleData,
            cart,
            targetId,
            checkoutRequestId
        ).then(function(res: any) {
            var data = res.data as any;
            var error = res.error;
            if (error) throw error;
            checkoutRequestIdRef.current = null;
            var smartPrintData = Object.assign({}, pSaleData, { order_no: data.order_no });
            // Jangan cetak otomatis ke Bar/Dapur jika dalam mode Self-Service (Kiosk)
            if (!isActuallyDisplay) {
                executeSmartPrint(smartPrintData, cart);
            }
            setLastOrderNo(data.order_no);
            setLastSaleId(data.id);
            if (isActuallyDisplay) {
                setSuccessModalConfig({ 
                    title: 'Pesanan Terkirim!', 
                    message: 'Pesanan Anda sudah masuk ke sistem. Silakan lakukan pembayaran di kasir.' 
                });
                setShowSuccessModal(true);
                clearCart();
            } else {
                setSuccessModalConfig({ 
                    title: 'Berhasil!', 
                    message: 'Pesanan berhasil dikirim ke dapur/bar.' 
                });
                setShowSuccessModal(true);
                clearCart();
            }
            setShowCartModal(false);
        })['catch'](function(err) {
            console.error('[POSScreen] Checkout/Send KDS Error:', err);
            if (isRpcTimeoutError(err)) {
                Alert.alert('Pesanan Sedang Diverifikasi', 'Status pesanan belum bisa dipastikan. Jangan kirim ulang dengan transaksi baru. Tunggu beberapa detik lalu cek daftar pesanan.');
                return;
            }
            Alert.alert('Gagal', 'Server tidak merespon. Silakan coba lagi.');
            throw err;
        })['finally'](function() {
            setIsSubmitting(false);
        });
    };

    var handlePrintReceipt = function(saleId) {
        if (!saleId) return Promise.resolve();
        setIsFetchingRemote(true);
        setIsPrinting(true);
        return loadFullSaleData(saleId).then(function(fullData) {
            // RE-TRY LOGIC: Jika fitur WiFi aktif tapi voucher belum muncul, tunggu sebentar dan coba lagi sekali
            if (fullData && fullData.enable_wifi_vouchers && !fullData.wifi_voucher) {
                console.log('[POSScreen] Wifi enabled but no voucher found, retrying in 1.5s...');
                return new Promise(function(resolve) {
                    setTimeout(function() {
                        loadFullSaleData(saleId).then(resolve);
                    }, 1500);
                }).then(function(refreshedData: any) {
                    return PrinterManager.printOrderReceipt(refreshedData || fullData);
                });
            }

            if (fullData) {
                return PrinterManager.printOrderReceipt(fullData);
            }
        })['catch'](function(err) {
            console.error('[POSScreen] Print Receipt Error:', err);
            Alert.alert('Gagal Cetak', 'Gagal memuat data transaksi untuk dicetak.');
        }).finally(function() {
            setIsFetchingRemote(false);
            setIsPrinting(false);
        });
    };

    var handleAutomaticPrinting = function(saleId, orderNo, items, isExisting, paymentData, breakdown) {
        console.log('[POSScreen] Starting Automatic Printing (Fast Flow)...');
        
        // 1. Konstruksi data struk lokal (Menghindari fetch Supabase yang lambat)
        var localOrderData = {
            id: saleId,
            order_no: orderNo,
            orderNo: orderNo,
            table_no: selectedTable || '-',
            customer_name: customerName || 'Guest',
            waiter_name: selectedWaiter || userName || 'Kasir',
            cashier_name: userName || '-',
            total: breakdown.total,
            subtotal: breakdown.subtotal,
            discount: breakdown.discount,
            tax: breakdown.tax,
            service_charge: breakdown.serviceCharge,
            payment_method: (paymentData && paymentData.method) || 'Tunai',
            paid_amount: (paymentData && paymentData.amount) || breakdown.total,
            change: (paymentData && paymentData.change) || 0,
            date: new Date().toISOString(),
            // Pengaturan Toko (diambil dari session context/storeSettings)
            shop_name: branchName,
            shop_address: branchAddress,
            shop_phone: branchPhone,
            receipt_header: (storeSettings && storeSettings.receipt_header) || '',
            receipt_footer: (storeSettings && storeSettings.receipt_footer) || '',
            show_logo: (storeSettings && storeSettings.show_logo) !== false,
            show_date: (storeSettings && storeSettings.show_date) !== false,
            show_table: (storeSettings && storeSettings.show_table) !== false,
            show_customer_name: (storeSettings && storeSettings.show_customer_name) !== false,
            show_waiter: (storeSettings && storeSettings.show_waiter) !== false,
            show_cashier_name: (storeSettings && storeSettings.show_cashier_name) !== false,
            receipt_logo_url: (storeSettings && storeSettings.receipt_logo_url) || '',
            receipt_paper_width: (storeSettings && storeSettings.receipt_paper_width) || '58mm',
            items: items.map(function(item) {
                return {
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    notes: item.notes,
                    target: item.target || determineTarget(item)
                };
            })
        };

        var prepareLocalData = function() {
            var localData = Object.assign({}, localOrderData);
            if (storeSettings && storeSettings.enable_wifi_vouchers) {
                localData.enable_wifi_vouchers = true;
                localData.wifi_voucher_notice = storeSettings.wifi_voucher_notice || 'Gunakan kode di bawah ini untuk akses WiFi';
                
                var minAmount = Number(storeSettings.wifi_voucher_min_amount) || 0;
                var multiplier = Number(storeSettings.wifi_voucher_multiplier) || 0;
                
                if (breakdown.total >= minAmount) {
                    if (!isOnline || String(saleId).indexOf('off-') === 0) {
                        return Promise.resolve(localData);
                    }
                    var divisor = multiplier > 0 ? multiplier : minAmount;
                    var count = divisor > 0 ? Math.floor(breakdown.total / divisor) : 1;
                    if (count < 1) count = 1;
                    
                    return WifiVoucherService.getVoucherForSale(saleId, currentBranchId || '1', count).then(function(v) {
                        localData.wifi_voucher = v;
                        return localData;
                    })['catch'](function(e) {
                        console.error('[POSScreen] Fast Auto-Print WiFi Error:', e);
                        return localData;
                    });
                }
            }
            return Promise.resolve(localData);
        };

        // 2. Jalankan Printing
        prepareLocalData().then(function(finalOrderData) {
            AsyncStorage.getItem('auto_print').then(function(val) {
                var isAuto = (val !== 'false');
                
                if (isAuto && !isDisplayOnly) {
                    console.log('[POSScreen] Executing Fast Auto-Print...');
                    PrinterManager.printOrderReceipt(finalOrderData, true)['catch'](function(e) {
                        console.error('[POSScreen] Fast Auto-Print Error:', e);
                    });
                }

                // 3. Tiket Bar/Dapur (Smart Print)
                var smartPrintData = {
                    order_no: orderNo,
                    table_no: finalOrderData.table_no,
                    customer_name: finalOrderData.customer_name,
                    waiter_name: finalOrderData.waiter_name,
                    created_at: finalOrderData.date
                };
                
                // Identifikasi Self-Service agar diperlakukan seperti Transaksi Langsung (cetak semua)
                var isSelfService = isSelfServiceOrder || isActuallyDisplay;
                var refItems = (isExisting && !isSelfService) ? undefined : [];

                // Jeda 2 detik sebelum cetak tiket Bar/Dapur agar printer belanja selesai proses
                setTimeout(function() {
                    executeSmartPrint(smartPrintData, items, refItems, false);
                }, 2000);
            });
        });
    };

    var handleTablePress = function() {
        if (isDisplayOnly || !cashierMode) return;
        setManualTableInput(selectedTable === '-' ? '' : selectedTable);
        setShowTableManualModal(true);
    };

    var updateNote = function(productId, note) {
        setCart(function(prev) {
            return prev.map(function(item) {
                if (item.id === productId) {
                    var newItem = {} as any;
                    for (var nk in item) { newItem[nk] = (item as any)[nk]; }
                    newItem.notes = note;
                    return newItem;
                }
                return item;
            });
        });
    };

    var handleDeleteHeldOrder = function(order) {
        if (!order || !order.id) return;

        Alert.alert('Hapus Pesanan', 'Yakin ingin menghapus pesanan ditangguhkan ini?', [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Hapus',
                style: 'destructive',
                onPress: function() {
                    if (order.isRemote) {
                        setIsSubmitting(true);
                        supabase
                            .from('wifi_vouchers')
                            .update({ is_used: false, used_at: null, sale_id: null })
                            .eq('sale_id', order.id)
                            .then(function() {
                                return supabase.from('sale_items').delete().eq('sale_id', order.id);
                            })
                            .then(function() {
                                return supabase.from('sales').delete().eq('id', order.id);
                            })
                            .then(function(res) {
                                if (res.error) throw res.error;
                                setRemoteOrders(function(prev) {
                                    return prev.filter(function(h) { return h.id !== order.id; });
                                });
                                showToast('Pesanan hold cloud dihapus', 'success');
                                fetchRemotePendingOrders(true);
                            })
                            ['catch'](function(err) {
                                console.error('[POSScreen] Delete held remote order error:', err);
                                Alert.alert('Gagal Hapus', (err && err.message) ? err.message : 'Pesanan hold cloud gagal dihapus.');
                            })
                            .finally(function() {
                                setIsSubmitting(false);
                            });
                        return;
                    }

                    setHeldOrders(function(prev) {
                        return prev.filter(function(h) { return h.id !== order.id; });
                    });

                    AsyncStorage.getItem('local_held_orders')
                        .then(function(localHolds) {
                            var holds = localHolds ? JSON.parse(localHolds) : [];
                            var filtered = Array.isArray(holds)
                                ? holds.filter(function(h) { return h.id !== order.id; })
                                : [];
                            return AsyncStorage.setItem('local_held_orders', JSON.stringify(filtered));
                        })
                        ['catch'](function(err) {
                            console.error('[POSScreen] Delete local held cache error:', err);
                        });

                    showToast('Pesanan hold lokal dihapus', 'success');
                }
            }
        ]);
    };

    var onSplitCommit = function(selectedItems) {
        setSplitItemsToPay(selectedItems);
        setIsSplitPayment(true);
        setShowSplitBillModal(false);
        setShowPaymentModal(true);
    };

    var handleBackToMainMenu = function() {
        if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
            navigation.goBack();
            return;
        }
        (navigation as any).navigate('Main');
    };

    // --- MEMOIZED UI COMPONENTS (To prevent Hook violation & optimize performance) ---
    var memoizedCategoryTabs = React.useMemo(function() {
        return React.createElement(ScrollView, { 
            horizontal: true, 
            showsHorizontalScrollIndicator: false, 
            contentContainerStyle: styles.categoryScroll 
        },
            categories.map(function(cat) {
                return React.createElement(TouchableOpacity, {
                    key: cat,
                    style: [styles.categoryTab, selectedCategory === cat && styles.activeCategoryTab],
                    onPress: function() { setSelectedCategory(cat); }
                },
                    React.createElement(Text, { style: [styles.categoryText, selectedCategory === cat && styles.activeCategoryText] }, cat)
                );
            })
        );
    }, [categories, selectedCategory]);

    var memoizedProductGrid = React.useMemo(function() {
        if (loadingProducts || filteredProducts.length === 0) return null;
        return React.createElement(FlatList, {
            data: filteredProducts,
            keyExtractor: function(item) { return String((item as any).id || Math.random()); },
            numColumns: productGridColumns,
            key: 'grid-' + productGridColumns,
            renderItem: function(info) {
                var item = info.item;
                return React.createElement(View, { style: { width: (100 / productGridColumns).toFixed(1) + '%' as any, padding: (isSmallDevice ? 4 : 6) as any } },
                    React.createElement(ProductCard as any, { 
                        item: item, 
                        isTablet: isTablet, 
                        onAdd: addToCart, 
                        formatCurrency: formatCurrency 
                    })
                );
            },
            contentContainerStyle: styles.productListContent,
            removeClippedSubviews: true,
            initialNumToRender: 12,
            maxToRenderPerBatch: 24,
            windowSize: 5
        });
    }, [filteredProducts, productGridColumns, addToCart, formatCurrency, isTablet, isSmallDevice, loadingProducts]);

    var heldOrdersForModal = React.useMemo(function() {
        var combined = [].concat(heldOrders).concat(remoteOrders as any);
        return combined.sort(function(a, b) {
            return new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime();
        });
    }, [heldOrders, remoteOrders]);

    return React.createElement(SafeAreaView, { edges: ['top', 'left', 'right'], style: styles.container },
        isActuallyDisplay && React.createElement(View, { style: styles.displayHeader },
            React.createElement(TouchableOpacity, {
                style: styles.displayBackButton,
                onPress: handleBackToMainMenu
            },
                React.createElement(ChevronLeft, { size: 18, color: "#374151", strokeWidth: 2.5 }),
                React.createElement(Text, { style: styles.displayBackButtonText }, "Menu Utama")
            ),
            React.createElement(Text, { style: styles.displayHeaderTitle, numberOfLines: 1 }, branchName || 'Katalog Pesanan')
        ),
        !isActuallyDisplay && React.createElement(View, { style: styles.header },
            React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                React.createElement(View, { style: { marginRight: 10 } }),
                React.createElement(TouchableOpacity, { 
                    style: styles.headerCircleButton, 
                    onPress: function() { navigation.goBack(); }
                },
                    React.createElement(ChevronLeft, { size: 20, color: "#374151", strokeWidth: 2.5 })
                ),

                React.createElement(TouchableOpacity, { 
                    style: [styles.headerCircleButton, { backgroundColor: isManualOffline ? '#fef2f2' : (isOnline ? '#f0fdf4' : '#fff1f2') }],
                    onPress: handleRefreshConnectivity
                },
                    isOnline ? (
                        React.createElement(Wifi, { size: 18, color: "#16a34a" })
                    ) : (
                        React.createElement(WifiOff, { size: 18, color: "#ef4444" })
                    ),
                    React.createElement(View, { style: [styles.statusDotSmall, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }] })
                ),
 
                isPrinterReady && React.createElement(TouchableOpacity, { 
                    style: [styles.headerCircleButton, { backgroundColor: '#f0fdf4' }],
                    onPress: handleReconnectPrinters
                },
                    React.createElement(Printer, { size: 18, color: "#16a34a" })
                )
            ),

            React.createElement(View, { style: styles.headerTitleContainer },
                React.createElement(Text, { style: styles.headerTitleText, numberOfLines: 1 }, branchName || 'Point of Sale')
            ),

            !isActuallyDisplay && React.createElement(TouchableOpacity, { 
                style: [styles.headerCircleButton, { backgroundColor: '#fee2e2' }], 
                onPress: function() { 
                    if (cart.length > 0 || existingSaleId) {
                        Alert.alert('Transaksi Baru', 'Kosongkan keranjang dan mulai transaksi baru?', [
                            { text: 'Batal', style: 'cancel' },
                            { text: 'Ya, Baru', onPress: function() { clearCart(); showToast('Memulai transaksi baru'); } }
                        ]);
                    } else {
                        showToast('Siap untuk transaksi baru');
                    }
                } 
            },
                React.createElement(Text, { style: { fontSize: 16 } }, "\u2728")
            ),

            !isActuallyDisplay && React.createElement(TouchableOpacity, { style: styles.headerCircleButton, onPress: function() { setShowHeldOrdersModal(true); } },
                React.createElement(Text, { style: { fontSize: 18 } }, "\uD83D\uDCC1")
            )
        ),

        !isActuallyDisplay && React.createElement(View, { style: styles.headerInfoBar },
            React.createElement(TouchableOpacity, { 
                style: styles.infoBarItem,
                onPress: handleTablePress,
                disabled: isDisplayOnly
            },
                React.createElement(Text, { style: styles.infoBarLabel }, orderType === 'take_away' ? 'ORDER' : 'MEJA'),
                React.createElement(Text, { style: styles.infoBarValue }, orderType === 'take_away' ? takeAwayLabel : selectedTable)
            ),
            React.createElement(View, { style: styles.infoBarDivider }),
            React.createElement(TouchableOpacity, { 
                style: styles.infoBarItem,
                onPress: function() { if (!isDisplayOnly) setShowWaiterModal(true); },
                disabled: isDisplayOnly
            },
                React.createElement(Text, { style: styles.infoBarLabel }, "KASIR"),
                React.createElement(Text, { style: styles.infoBarValue, numberOfLines: 1 }, selectedWaiter || '-')
            )
        ),

        React.createElement(View, { style: styles.tabletMainRow },
            React.createElement(View, { style: [styles.flex1, { backgroundColor: '#f9fafb' }] },
                React.createElement(View, { style: styles.searchContainer },
                    React.createElement(TextInput, {
                        style: styles.searchInput,
                        placeholder: "Cari produk...",
                        placeholderTextColor: "#9ca3af",
                        value: searchQuery,
                        onChangeText: setSearchQuery
                    })
                ),

                (orderCategoriesEnabled && !isActuallyDisplay) && React.createElement(View, { style: styles.orderTypeRow },
                    React.createElement(TouchableOpacity, { 
                        style: [styles.orderTypeChip, orderType === 'dine_in' && styles.orderTypeChipActive],
                        onPress: function() { setOrderType('dine_in'); }
                    },
                        React.createElement(Text, { style: [styles.orderTypeText, orderType === 'dine_in' && styles.orderTypeTextActive] }, "\uD83C\uDF7D\uFE0F " + dineInLabel)
                    ),
                    React.createElement(TouchableOpacity, { 
                        style: [styles.orderTypeChip, orderType === 'take_away' && styles.orderTypeChipActive],
                        onPress: function() { setOrderType('take_away'); }
                    },
                        React.createElement(Text, { style: [styles.orderTypeText, orderType === 'take_away' && styles.orderTypeTextActive] }, "\uD83D\uDCE6 " + takeAwayLabel)
                    ),
                    React.createElement(TouchableOpacity, { 
                        style: [styles.orderTypeChip, { backgroundColor: '#fff7ed', borderColor: '#fdba74' }],
                        onPress: handleTablePress
                    },
                        React.createElement(Text, { style: [styles.orderTypeText, { color: '#ea580c' }] }, "\uD83E\uDE91 Meja: " + selectedTable)
                    )
                ),

                React.createElement(View, { style: styles.categoryContainer },
                    memoizedCategoryTabs
                ),

                loadingProducts ? (
                    React.createElement(View, { style: styles.loadingContainer },
                        React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" }),
                        React.createElement(Text, { style: styles.loadingText }, "Memuat menu...")
                    )
                ) : filteredProducts.length === 0 ? (
                    React.createElement(View, { style: styles.emptyContainer },
                        React.createElement(Text, { style: styles.emptyIcon }, "\uD83C\uDF7D\uFE0F"),
                        React.createElement(Text, { style: styles.emptyTitle }, "Produk tidak ditemukan"),
                        React.createElement(Text, { style: styles.emptySubtitle }, "Coba cari dengan kata kunci lain atau pilih kategori berbeda.")
                    )
                ) : (
                    memoizedProductGrid
                )
            ),

            isSideBySide && React.createElement(View, { style: { width: isLargeTablet ? 380 : 320, backgroundColor: 'white', borderLeftWidth: 1, borderLeftColor: '#f3f4f6', elevation: 5 } },
                React.createElement(View, { style: { flex: 1, padding: 16 } },
                    React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
                        React.createElement(Text, { style: { fontSize: 18, fontWeight: 'bold', color: '#111827' } }, "Pesanan"),
                        React.createElement(TouchableOpacity, { onPress: clearCart },
                            React.createElement(Text, { style: { fontSize: 12, color: '#ef4444', fontWeight: '600' } }, "Bersihkan")
                        )
                    ),

                    renderSplitCartActions(),
                    renderSplitCartMeta(),

                    React.createElement(ScrollView, { style: { flex: 1 }, showsVerticalScrollIndicator: false },
                        cart.map(function(item) {
                            return React.createElement(View, { key: item.id, style: [styles.cartItem, { paddingVertical: 10 }] },
                                React.createElement(View, { style: { flex: 1 } },
                                    React.createElement(Text, { style: [styles.cartItemName, { fontSize: 13 }], numberOfLines: 2 }, item.name),
                                    React.createElement(Text, { style: styles.cartItemPrice }, formatCurrency(item.price)),
                                    React.createElement(TextInput, {
                                        style: styles.cartSplitNoteInput,
                                        placeholder: "Catatan...",
                                        placeholderTextColor: "#fdba74",
                                        value: item.notes,
                                        onChangeText: function(text) { updateNote(item.id, text); }
                                    })
                                ),
                                React.createElement(View, { style: [styles.quantityControls, { marginLeft: 10, padding: 2 }] },
                                    React.createElement(TouchableOpacity, { style: [styles.qtyButton, { width: 24, height: 24 }], onPress: function() { removeFromCart(item.id); } },
                                        React.createElement(Text, { style: [styles.qtyButtonText, { fontSize: 14 }] }, "-")
                                    ),
                                    React.createElement(Text, { style: [styles.qtyText, { fontSize: 13, paddingHorizontal: 6 }] }, item.quantity),
                                    React.createElement(TouchableOpacity, { style: [styles.qtyButton, { width: 24, height: 24 }], onPress: function() { addToCart(item); } },
                                        React.createElement(Text, { style: [styles.qtyButtonText, { fontSize: 14 }] }, "+")
                                    )
                                )
                            );
                        }),
                        cart.length === 0 && React.createElement(View, { style: styles.cartSplitEmpty },
                            React.createElement(Text, { style: { fontSize: 40, marginBottom: 10 } }, "\uD83D\uDED2"),
                            React.createElement(Text, { style: { color: '#94a3b8', fontWeight: '600', textAlign: 'center' } }, "Keranjang Kosong"),
                            React.createElement(Text, { style: { color: '#cbd5e1', fontSize: 11, textAlign: 'center', marginTop: 4 } }, "Pilih menu di samping untuk mulai memesan")
                        )
                    ),

                    React.createElement(View, { style: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16, marginTop: 10 } },
                        React.createElement(View, { style: styles.cartTotalRow },
                            React.createElement(Text, { style: styles.cartTotalLabelLarge }, "Subtotal"),
                            React.createElement(Text, { style: styles.cartTotalValueLarge }, formatCurrency(calculateSubtotal()))
                        ),
                        orderDiscount > 0 && React.createElement(View, { style: [styles.cartTotalRow, { marginTop: 4 }] },
                            React.createElement(Text, { style: [styles.cartTotalLabelLarge, { color: '#ef4444' }] }, "Diskon"),
                            React.createElement(Text, { style: [styles.cartTotalValueLarge, { color: '#ef4444' }] }, "-" + formatCurrency(orderDiscount))
                        ),
                        (calculateTaxAmount() > 0 || calculateServiceAmount() > 0) && React.createElement(View, { style: [styles.cartTotalRow, { marginTop: 4 }] },
                            React.createElement(Text, { style: styles.cartTotalLabelLarge }, "Pajak & Layanan"),
                            React.createElement(Text, { style: styles.cartTotalValueLarge }, formatCurrency(calculateTaxAmount() + calculateServiceAmount()))
                        ),
                        React.createElement(View, { style: [styles.cartTotalRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' }] },
                            React.createElement(Text, { style: { fontSize: 16, fontWeight: 'bold', color: '#111827' } }, "Total"),
                            React.createElement(Text, { style: { fontSize: 24, fontWeight: 'bold', color: '#ea580c' } }, formatCurrency(calculateTotal()))
                        ),

                        React.createElement(TouchableOpacity, { 
                            style: [
                                styles.confirmButton, 
                                { marginTop: 16, paddingVertical: 16, borderRadius: 16, backgroundColor: (cart.length > 0 && !isSubmitting) ? '#ea580c' : '#cbd5e1' }
                            ], 
                            onPress: handleCheckout,
                            disabled: cart.length === 0 || isSubmitting
                        },
                            isSubmitting ? React.createElement(ActivityIndicator, { color: "white", size: "small" }) : React.createElement(Text, { style: { color: 'white', fontWeight: 'bold', fontSize: 16, textAlign: 'center' } },
                                cashierMode ? 'BAYAR SEKARANG' : (existingSaleId ? 'UPDATE PESANAN' : 'KIRIM PESANAN')
                            )
                        )
                    )
                )
            )
        ),

        cart.length > 0 && !isSideBySide && React.createElement(View, { style: [styles.cartSummaryBar, isSmallDevice && { bottom: 12, left: 12, right: 12 }] },
            React.createElement(View, { style: styles.cartSummaryInfo },
                React.createElement(View, { style: styles.cartCountBadge },
                    React.createElement(Text, { style: styles.cartCountText }, cart.reduce(function(a, b) { return a + b.quantity; }, 0))
                ),
                React.createElement(View, { style: { marginLeft: 12 } },
                    React.createElement(Text, { style: styles.cartTotalLabel }, "Total Pesanan"),
                    React.createElement(Text, { style: styles.cartTotalValue }, formatCurrency(calculateTotal()))
                ),
                React.createElement(TouchableOpacity, { style: styles.checkoutButton, onPress: function() { setShowCartModal(true); } },
                    React.createElement(Text, { style: styles.checkoutButtonText }, "Lanjut \u203A")
                )
            ),
        ),

        showPaymentModal && React.createElement(PaymentModal, {
            visible: showPaymentModal,
            onClose: function() { setShowPaymentModal(false); },
            subtotal: activeBreakdown.subtotal,
            tax: activeBreakdown.tax,
            serviceCharge: activeBreakdown.serviceCharge,
            discount: activeBreakdown.discount,
            total: activeBreakdown.total,
            onConfirm: handlePaymentConfirm,
            onManualItem: function() { setShowPaymentModal(false); setShowManualItemModal(true); },
            onDiscount: function() { 
                setShowPaymentModal(false); 
                if (isAdmin) {
                    setShowDiscountModal(true);
                } else {
                    setShowManagerAuthModal(true);
                }
            },
            onSplitBill: function() { setShowPaymentModal(false); setShowSplitBillModal(true); },
            onHold: function() { setShowPaymentModal(false); setShowHoldNoteModal(true); },
            onPreview: handlePrePaymentPreview,
            canHold: cashierMode || isAdmin,
            paymentMethods: paymentMethods
        }),

        showManagerAuthModal && React.createElement(ManagerAuthModal, {
            visible: showManagerAuthModal,
            onClose: function() { setShowManagerAuthModal(false); },
            onSuccess: function() {
                setShowManagerAuthModal(false);
                setShowDiscountModal(true);
            },
            title: "Otorisasi Diskon"
        }),

        showSuccessModal && React.createElement(Modal, { visible: showSuccessModal, transparent: true, animationType: "fade" },
            React.createElement(View, { style: [styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }] },
                React.createElement(SafeAreaView, { style: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' } },
                    React.createElement(View, { style: [styles.modalContent, { width: '90%', maxWidth: 450, alignItems: 'center', padding: 32 }] },
                        React.createElement(View, { style: styles.successIconCircle },
                            React.createElement(Text, { style: styles.successIconText }, "✓")
                        ),
                        React.createElement(Text, { style: styles.successTitleText }, successModalConfig.title),
                        React.createElement(Text, { style: styles.successSubtitleText }, successModalConfig.message),

                        React.createElement(View, { style: styles.orderNumberBadge },
                            React.createElement(Text, { style: styles.orderNumberLabel }, "NOMOR PESANAN"),
                            React.createElement(Text, { style: styles.orderNumberValue }, lastOrderNo || '-')
                        ),

                        React.createElement(View, { style: { width: '100%' } },
                            !isActuallyDisplay && React.createElement(TouchableOpacity, { 
                                style: [styles.modalButton, { backgroundColor: '#ea580c', paddingVertical: 16 }], 
                                onPress: handlePreviewReceipt
                            },
                                React.createElement(Text, { style: styles.confirmButtonText }, "Preview & Cetak Struk")
                            ),

                            !isActuallyDisplay && React.createElement(TouchableOpacity, { 
                                style: [styles.modalButton, { backgroundColor: '#10b981', paddingVertical: 16, marginTop: 10 }], 
                                onPress: function() { handlePrintReceipt(lastSaleId, lastOrderNo); }
                            },
                                React.createElement(Text, { style: styles.confirmButtonText }, "Direct Cetak (Cetak Ulang)")
                            ),

                            React.createElement(TouchableOpacity, { 
                                style: [styles.modalButton, isActuallyDisplay ? { backgroundColor: '#ea580c' } : styles.cancelButton, { paddingVertical: 16, marginTop: 10 }], 
                                onPress: function() { 
                                    setShowSuccessModal(false); 
                                    if (!isActuallyDisplay) (navigation as any).navigate('Main');
                                }
                            },
                                React.createElement(Text, { style: isActuallyDisplay ? styles.confirmButtonText : styles.cancelButtonText }, isActuallyDisplay ? "PESAN LAGI" : "Selesai")
                            ),

                            isPartialSplit && React.createElement(TouchableOpacity, { 
                                style: [styles.modalButton, { backgroundColor: '#1f2937', paddingVertical: 16 }], 
                                onPress: function() { setShowSuccessModal(false); }
                            },
                                React.createElement(Text, { style: styles.confirmButtonText }, "Lanjut Sisa Pembayaran")
                            )
                        ),

                        !isPartialSplit && React.createElement(Text, { style: { fontSize: 12, color: '#9ca3af', marginTop: 24 } },
                            "Otomatis kembali dalam " + countdown + " detik."
                        )
                    )
                )
            )
        ),

        showCartModal && React.createElement(Modal, { visible: showCartModal, transparent: true, animationType: "slide", onRequestClose: function() { setShowCartModal(false); } },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: [styles.modalContent, styles.cartModalContent] },
                    React.createElement(View, { style: styles.modalHeader },
                        React.createElement(View, { style: { flex: 1 } },
                            React.createElement(Text, { style: styles.modalTitle }, "Detail Pesanan"),
                            isSelfServiceOrder && React.createElement(View, { style: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 } },
                                React.createElement(Text, { style: { color: '#ef4444', fontSize: 10, fontWeight: 'bold' } }, "PESANAN MANDIRI (SELF-SERVICE)")
                            )
                        ),
                        React.createElement(TouchableOpacity, { onPress: function() { setShowCartModal(false); } },
                            React.createElement(Text, { style: { fontSize: 28, color: '#9ca3af' } }, "\u00D7")
                        )
                    ),
                    React.createElement(ScrollView, { style: { flex: 1 } },
                        renderSplitCartActions(),
                        renderSplitCartMeta(),
                        cart.map(function(item) {
                            return React.createElement(View, { key: item.id, style: styles.cartItem },
                                React.createElement(View, { style: { flex: 1 } },
                                    React.createElement(Text, { style: styles.cartItemName }, item.name),
                                    React.createElement(Text, { style: styles.cartItemPrice }, formatCurrency(item.price)),
                                    React.createElement(TextInput, {
                                        style: styles.cartSplitNoteInput,
                                        placeholder: "Tambah catatan...",
                                        placeholderTextColor: "#fdba74",
                                        value: (item as any).notes,
                                        onChangeText: function(text) { updateNote(item.id, text); }
                                    })
                                ),
                                React.createElement(View, { style: styles.quantityControls },
                                    React.createElement(TouchableOpacity, { style: styles.qtyButton, onPress: function() { removeFromCart(item.id); } },
                                        React.createElement(Text, { style: styles.qtyButtonText }, "-")
                                    ),
                                    React.createElement(Text, { style: styles.qtyText }, item.quantity),
                                    React.createElement(TouchableOpacity, { style: styles.qtyButton, onPress: function() { addToCart(item); } },
                                        React.createElement(Text, { style: styles.qtyButtonText }, "+")
                                    )
                                )
                            );
                        })
                    ),
                    React.createElement(View, { style: styles.cartFooter },
                        React.createElement(View, { style: styles.cartTotalRow },
                            React.createElement(Text, { style: styles.cartTotalLabelLarge }, "Total Pembayaran"),
                            React.createElement(Text, { style: [styles.cartTotalValueLarge, { color: '#ea580c' }] }, formatCurrency(calculateTotal()))
                        ),
                        React.createElement(TouchableOpacity, { 
                            style: [styles.modalButton, { backgroundColor: (!isSubmitting) ? '#ea580c' : '#cbd5e1', marginTop: 16, paddingVertical: 16 }], 
                            onPress: handleCheckout,
                            disabled: isSubmitting
                        },
                            isSubmitting ? React.createElement(ActivityIndicator, { color: "white", size: "small" }) : React.createElement(Text, { style: styles.confirmButtonText },
                                isActuallyDisplay ? 'KIRIM KE KASIR' : (cashierMode ? 'PILIH PEMBAYARAN' : (existingSaleId ? 'SIMPAN UPDATE' : 'KONFIRMASI PESANAN'))
                            )
                        )
                    )
                )
            )
        ),

        showHeldOrdersModal && React.createElement(HeldOrdersModal, {
            visible: showHeldOrdersModal,
            onClose: function() { setShowHeldOrdersModal(false); },
            orders: heldOrdersForModal,
            onRestore: handleRestoreHeldOrder,
            onDelete: handleDeleteHeldOrder,
            onRefresh: function() { fetchRemotePendingOrders(true); },
            isRefreshing: isFetchingRemote
        }),

        showManualItemModal && React.createElement(ManualItemModal, {
            visible: showManualItemModal,
            onClose: function() { setShowManualItemModal(false); },
            onAdd: handleAddManualItem
        }),

        showDiscountModal && React.createElement(DiscountModal, {
            visible: showDiscountModal,
            onClose: function() { setShowDiscountModal(false); },
            currentTotal: calculateSubtotal(),
            onApply: handleApplyDiscount
        }),

        showSplitBillModal && React.createElement(SplitBillModal, {
            visible: showSplitBillModal,
            onClose: function() { setShowSplitBillModal(false); },
            items: cart,
            onSplit: onSplitCommit
        }),

        showReceiptPreview && React.createElement(ReceiptPreviewModal, {
            visible: showReceiptPreview,
            onClose: function() { setShowReceiptPreview(false); },
            orderData: previewOrderData,
            onPrint: function() { handlePrintReceipt(null, null, previewOrderData); }
        }),

        showHoldNoteModal && React.createElement(HoldNoteModal, {
            visible: showHoldNoteModal,
            onClose: function() { setShowHoldNoteModal(false); },
            onConfirm: handleHoldOrder
        }),

        showWaiterModal && React.createElement(Modal, { visible: showWaiterModal, transparent: true, animationType: "slide" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: [styles.modalContent, { maxHeight: '80%' }] },
                    React.createElement(View, { style: styles.modalHeader },
                        React.createElement(Text, { style: styles.modalTitle }, "Pilih Kasir"),
                        React.createElement(TouchableOpacity, { onPress: function() { setShowWaiterModal(false); } },
                            React.createElement(Text, { style: { fontSize: 24, color: '#9ca3af' } }, "\u00D7")
                        )
                    ),
                    React.createElement(TextInput, {
                        style: [styles.searchInput, { marginBottom: 12 }],
                        placeholder: "Cari kasir...",
                        value: waiterSearchQuery,
                        onChangeText: setWaiterSearchQuery
                    }),
                    React.createElement(ScrollView, null,
                        waiters.filter(function(w) { return (w.name || '').toLowerCase().indexOf(waiterSearchQuery.toLowerCase()) !== -1; }).map(function(w) {
                            return React.createElement(TouchableOpacity, { 
                                key: w.id, 
                                style: styles.modalOptionItem, 
                                onPress: function() { setSelectedWaiter(w.name); setShowWaiterModal(false); }
                            },
                                React.createElement(Text, { style: styles.modalOptionText }, w.name),
                                React.createElement(Text, { style: { fontSize: 12, color: '#6b7280' } }, (w as any).position || '-')
                            );
                        })
                    )
                )
            )
        ),

        showTableManualModal && React.createElement(Modal, { visible: showTableManualModal, transparent: true, animationType: "fade" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(Text, { style: styles.modalTitle }, "Input Nomor Meja"),
                    React.createElement(Text, { style: { fontSize: 13, color: '#6b7280', marginBottom: 12 } }, "Masukkan nomor atau label meja secara manual:"),
                    React.createElement(TextInput, {
                        style: [styles.modalInput, { fontSize: 24, fontWeight: 'bold', textAlign: 'center', height: 70, backgroundColor: '#fff7ed', borderColor: '#ea580c', borderWidth: 1 }],
                        placeholder: "Contoh: A1",
                        value: manualTableInput,
                        onChangeText: setManualTableInput,
                        autoFocus: true,
                        autoCapitalize: "characters",
                        placeholderTextColor: "#fdba74"
                    }),
                    React.createElement(View, { style: { flexDirection: 'row', marginTop: 12 } },
                        React.createElement(TouchableOpacity, { style: [styles.modalButton, styles.cancelButton, { flex: 1 }], onPress: function() { setShowTableManualModal(false); } },
                            React.createElement(Text, { style: styles.cancelButtonText }, "Batal")
                        ),
                        React.createElement(TouchableOpacity, { 
                            style: [styles.modalButton, { flex: 1, backgroundColor: '#ea580c' }], 
                            onPress: function() { setSelectedTable(manualTableInput.toUpperCase() || '-'); setShowTableManualModal(false); }
                        },
                            React.createElement(Text, { style: styles.confirmButtonText }, "Simpan")
                        )
                    )
                )
            )
        ),

        React.createElement(ModernToast, { 
            visible: toastVisible, 
            message: toastMessage, 
            type: toastType, 
            onHide: function() { setToastVisible(false); } 
        })
    );
}

var styles = StyleSheet.create({
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
        backgroundColor: '#fffaf5',
        paddingHorizontal: 4,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ffedd5'
    },
    quickActionBtn: {
        alignItems: 'center',
        flex: 1,
        paddingVertical: 1,
        paddingHorizontal: 1
    },
    quickActionIcon: {
        fontSize: 14,
        marginBottom: 1,
        color: '#ea580c'
    },
    quickActionText: {
        fontSize: 8,
        color: '#7c2d12',
        fontWeight: '800',
        letterSpacing: 0.1
    },
    cartSplitFieldLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#6b7280',
        marginBottom: 3
    },
    cartSplitFieldBox: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        minHeight: 38,
        justifyContent: 'center'
    },
    cartSplitFieldInput: {
        paddingVertical: 6,
        fontSize: 12,
        fontWeight: '600',
        color: '#111827'
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
        fontWeight: '600'
    },
    cartSplitEmpty: {
        alignItems: 'center',
        marginTop: 60,
        paddingHorizontal: 20,
        opacity: 0.8
    },
    container: {
        flex: 1,
        backgroundColor: '#f9fafb'
    },
    flex1: {
        flex: 1
    },
    tabletMainRow: {
        flexDirection: 'row',
        flex: 1
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
        zIndex: 10
    },
    displayHeader: {
        backgroundColor: 'white',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    displayBackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8
    },
    displayBackButtonText: {
        marginLeft: 4,
        fontSize: 12,
        fontWeight: '800',
        color: '#374151'
    },
    displayHeaderTitle: {
        flex: 1,
        textAlign: 'right',
        marginLeft: 12,
        fontSize: 13,
        fontWeight: '800',
        color: '#111827'
    },
    headerCircleButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb'
    },
    statusDotSmall: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: 'white'
    },
    backButtonText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#374151'
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center'
    },
    headerTitleText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827'
    },
    headerInfoBar: {
        flexDirection: 'row',
        backgroundColor: 'white',
        paddingVertical: 4,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        alignItems: 'center'
    },
    infoBarItem: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8
    },
    infoBarLabel: {
        fontSize: 9,
        color: '#6b7280',
        textTransform: 'uppercase',
        fontWeight: 'bold',
        letterSpacing: 0.4
    },
    infoBarValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#111827',
        marginLeft: 4
    },
    infoBarDivider: {
        width: 1,
        height: 16,
        backgroundColor: '#f3f4f6'
    },
    searchContainer: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'white'
    },
    orderTypeRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingBottom: 6,
        paddingTop: 2,
        backgroundColor: 'white'
    },
    orderTypeChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 8
    },
    orderTypeChipActive: {
        backgroundColor: '#fff7ed',
        borderColor: '#fdba74'
    },
    orderTypeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b'
    },
    orderTypeTextActive: {
        color: '#c2410c'
    },
    searchInput: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 10,
        color: '#111827',
        fontSize: 13,
        borderWidth: 1,
        borderColor: '#e5e7eb'
    },
    categoryContainer: {
        backgroundColor: 'white',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6'
    },
    categoryScroll: {
        paddingHorizontal: 12,
        marginRight: 8
    },
    categoryTab: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb'
    },
    activeCategoryTab: {
        backgroundColor: '#ea580c',
        borderColor: '#ea580c'
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b5563'
    },
    activeCategoryText: {
        color: 'white'
    },
    productListContent: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        paddingBottom: 200
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
        borderColor: '#f1f5f9'
    },
    productImageContainer: {
        width: '100%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    productAcronym: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0284c7'
    },
    productInfo: {
        padding: 10,
        flex: 1,
        justifyContent: 'space-between'
    },
    productNameText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1f2937',
        lineHeight: 18
    },
    productPriceText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ea580c',
        marginTop: 4
    },
    productFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6
    },
    productStockText: {
        fontSize: 10,
        color: '#6b7280',
        fontWeight: '500'
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    loadingText: {
        marginTop: 12,
        color: '#6b7280'
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937'
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
        marginTop: 8
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 24
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10
    },
    cartModalContent: {
        width: '100%',
        maxWidth: 700,
        height: '90%',
        maxHeight: '90%',
        alignSelf: 'center'
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#1f2937'
    },
    modalButton: {
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    confirmButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: 'white'
    },
    cancelButton: {
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb'
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4b5563'
    },
    modalOptionItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6'
    },
    modalOptionText: {
        fontSize: 16,
        color: '#111827'
    },
    tableOptionItem: {
        width: '30%',
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
        marginBottom: 12
    },
    selectedTableOption: {
        backgroundColor: '#ebf5ff',
        borderColor: '#2563eb'
    },
    occupiedTableOption: {
        backgroundColor: '#fee2e2',
        borderColor: '#ef4444',
        opacity: 0.7
    },
    tableOptionText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827'
    },
    selectedTableText: {
        color: '#2563eb'
    },
    modalInput: {
        backgroundColor: '#f9fafb',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        color: '#111827',
        fontSize: 16
    },
    confirmButton: {
        backgroundColor: '#2563eb'
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
        elevation: 10
    },
    cartSummaryInfo: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    cartCountBadge: {
        backgroundColor: '#ea580c',
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center'
    },
    cartCountText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16
    },
    cartTotalLabel: {
        color: '#9ca3af',
        fontSize: 10,
        textTransform: 'uppercase'
    },
    cartTotalValue: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold'
    },
    checkoutButton: {
        backgroundColor: '#ea580c',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 14
    },
    checkoutButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    },
    modalButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    cartItemList: {
        marginBottom: 20
    },
    cartItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6'
    },
    cartItemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827'
    },
    cartItemPrice: {
        fontSize: 12,
        color: '#ea580c',
        fontWeight: 'bold',
        marginTop: 1
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 4
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
        elevation: 1
    },
    qtyButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827'
    },
    qtyText: {
        paddingHorizontal: 10,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111827'
    },
    cartFooter: {
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 12
    },
    cartTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    cartTotalLabelLarge: {
        fontSize: 13,
        color: '#4b5563',
        fontWeight: '600'
    },
    cartTotalValueLarge: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827'
    },
    successIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    successIconText: {
        fontSize: 30,
        color: '#22c55e',
        fontWeight: 'bold'
    },
    successTitleText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center'
    },
    successSubtitleText: {
        fontSize: 13,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 20
    },
    orderNumberBadge: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 30,
        width: '100%'
    },
    orderNumberLabel: {
        fontSize: 10,
        color: '#9ca3af',
        fontWeight: 'bold',
        letterSpacing: 1
    },
    orderNumberValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginTop: 4
    }
});
