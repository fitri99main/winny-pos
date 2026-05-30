import * as React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var FlatList = RN.FlatList;
var StyleSheet = RN.StyleSheet;
var useWindowDimensions = RN.useWindowDimensions;
var ActivityIndicator = RN.ActivityIndicator;
var TextInput = RN.TextInput;
var Modal = RN.Modal;
var Alert = RN.Alert;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
var useFocusEffect = NavNative.useFocusEffect;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import PaymentModal from '../components/PaymentModal';
import * as PrinterLib from '../lib/PrinterManager';
var PrinterManager = PrinterLib.PrinterManager;
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import * as WifiLib from '../lib/WifiVoucherService';
var WifiVoucherService = WifiLib.WifiVoucherService;
import * as OrderLib from '../lib/orderTypeUtils';
var resolveOrderTypeDisplay = OrderLib.resolveOrderTypeDisplay;
import * as OfflineLib from '../lib/OfflineService';
var OfflineService = OfflineLib.OfflineService;
import ManagerAuthModal from '../components/ManagerAuthModal';
import StatusModal from '../components/StatusModal';
import * as DateLib from '../lib/dateUtils';
var getLocalISOString = DateLib.getLocalISOString;
var getLocalDateString = DateLib.getLocalDateString;
import * as Lucide from 'lucide-react-native';
var Edit2 = Lucide.Edit2;
var Trash2 = Lucide.Trash2;
var Plus = Lucide.Plus;

export default function HistoryScreen() {
    var navigation = useNavigation();
    var dims = useWindowDimensions();
    var width = dims.width;
    var height = dims.height;
    var useMultiColumn = width >= 600;
    var isSmallDevice = width < 480;
    
    var session = useSession();
    var currentBranchId = session.currentBranchId;
    var branchName = session.branchName;
    var branchAddress = session.branchAddress;
    var branchPhone = session.branchPhone;
    var userName = session.userName;
    var storeSettings = session.storeSettings;
    var isAdmin = session.isAdmin;

    var stateLoading = React.useState(true);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var stateIsOnline = React.useState(true);
    var isOnline = stateIsOnline[0];
    var setIsOnline = stateIsOnline[1];

    var stateHistory = React.useState([] as any[]);
    var history = stateHistory[0];
    var setHistory = stateHistory[1];

    var stateFilteredHistory = React.useState([] as any[]);
    var filteredHistory = stateFilteredHistory[0];
    var setFilteredHistory = stateFilteredHistory[1];

    var stateSearchQuery = React.useState('');
    var searchQuery = stateSearchQuery[0];
    var setSearchQuery = stateSearchQuery[1];

    var stateDateFilter = React.useState('today');
    var dateFilter = stateDateFilter[0];
    var setDateFilter = stateDateFilter[1];

    var stateStatusFilter = React.useState('all');
    var statusFilter = stateStatusFilter[0];
    var setStatusFilter = stateStatusFilter[1];

    var stateCashierFilter = React.useState('all');
    var cashierFilter = stateCashierFilter[0];
    var setCashierFilter = stateCashierFilter[1];

    var stateEffectiveBranchId = React.useState(currentBranchId);
    var effectiveBranchId = stateEffectiveBranchId[0];
    var setEffectiveBranchId = stateEffectiveBranchId[1];

    React.useEffect(function() {
        if (currentBranchId) {
            setEffectiveBranchId(currentBranchId);
        } else {
            AsyncStorage.getItem('mobile_current_branch_id').then(function(v) {
                if (v) setEffectiveBranchId(v);
            });
        }
    }, [currentBranchId]);
    
    var stateStartDate = React.useState(getLocalDateString());
    var startDate = stateStartDate[0];
    var setStartDate = stateStartDate[1];

    var stateEndDate = React.useState(getLocalDateString());
    var endDate = stateEndDate[0];
    var setEndDate = stateEndDate[1];

    var stateShowDateRangeModal = React.useState(false);
    var showDateRangeModal = stateShowDateRangeModal[0];
    var setShowDateRangeModal = stateShowDateRangeModal[1];

    var stateShowPaymentModal = React.useState(false);
    var showPaymentModal = stateShowPaymentModal[0];
    var setShowPaymentModal = stateShowPaymentModal[1];

    var stateShowDetailModal = React.useState(false);
    var showDetailModal = stateShowDetailModal[0];
    var setShowDetailModal = stateShowDetailModal[1];

    var stateShowSuccessModal = React.useState(false);
    var showSuccessModal = stateShowSuccessModal[0];
    var setShowSuccessModal = stateShowSuccessModal[1];

    var stateSelectedSale = React.useState(null as any);
    var selectedSale = stateSelectedSale[0];
    var setSelectedSale = stateSelectedSale[1];

    var stateIsLoadingDetail = React.useState(false);
    var isLoadingDetail = stateIsLoadingDetail[0];
    var setIsLoadingDetail = stateIsLoadingDetail[1];

    var statePrinting = React.useState(false);
    var printing = statePrinting[0];
    var setPrinting = statePrinting[1];

    var stateShowPreviewModal = React.useState(false);
    var showPreviewModal = stateShowPreviewModal[0];
    var setShowPreviewModal = stateShowPreviewModal[1];

    var stateShowEditModal = React.useState(false);
    var showEditModal = stateShowEditModal[0];
    var setShowEditModal = stateShowEditModal[1];

    var stateEditData = React.useState({ customer_name: '', table_no: '' });
    var editData = stateEditData[0];
    var setEditData = stateEditData[1];

    var stateIsSaving = React.useState(false);
    var isSaving = stateIsSaving[0];
    var setIsSaving = stateIsSaving[1];

    var stateShowDeleteConfirm = React.useState(false);
    var showDeleteConfirm = stateShowDeleteConfirm[0];
    var setShowDeleteConfirm = stateShowDeleteConfirm[1];

    var stateStatusModal = React.useState({ visible: false, title: '', message: '', type: 'success' });
    var statusModal = stateStatusModal[0];
    var setStatusModal = stateStatusModal[1];

    var stateShowCreateModal = React.useState(false);
    var showCreateModal = stateShowCreateModal[0];
    var setShowCreateModal = stateShowCreateModal[1];

    var stateNewData = React.useState({ customer_name: '', table_no: '', amount: '' });
    var newData = stateNewData[0];
    var setNewData = stateNewData[1];

    var stateShowReceiptPreview = React.useState(false);
    var showReceiptPreview = stateShowReceiptPreview[0];
    var setShowReceiptPreview = stateShowReceiptPreview[1];

    var statePreviewOrderData = React.useState(null);
    var previewOrderData = statePreviewOrderData[0];
    var setPreviewOrderData = statePreviewOrderData[1];

    var stateHasMore = React.useState(true);
    var hasMore = stateHasMore[0];
    var setHasMore = stateHasMore[1];

    var stateLoadingMore = React.useState(false);
    var loadingMore = stateLoadingMore[0];
    var setLoadingMore = stateLoadingMore[1];

    var stateShowAuthModal = React.useState(false);
    var showAuthModal = stateShowAuthModal[0];
    var setShowAuthModal = stateShowAuthModal[1];

    var statePendingAction = React.useState(null);
    var pendingAction = statePendingAction[0];
    var setPendingAction = statePendingAction[1];

    var stateAuthTitle = React.useState('Otorisasi Manager');
    var authTitle = stateAuthTitle[0];
    var setAuthTitle = stateAuthTitle[1];

    var formatCurrency = function(value) {
        if (value === undefined || value === null) return 'Rp 0';
        var valNum = Math.floor(Number(value));
        return 'Rp ' + valNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    var formatDate = function(dateString) {
        if (!dateString) return '-';
        try {
            var dateObj = new Date(dateString);
            if (isNaN(dateObj.getTime())) return '-';
            var dd = String(dateObj.getDate());
            if (dd.length < 2) dd = '0' + dd;
            var monthsArr = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            var mm = monthsArr[dateObj.getMonth()];
            var yy = dateObj.getFullYear();
            var hh = String(dateObj.getHours());
            if (hh.length < 2) hh = '0' + hh;
            var mmin = String(dateObj.getMinutes());
            if (mmin.length < 2) mmin = '0' + mmin;
            return dd + ' ' + mm + ' ' + yy + ', ' + hh + ':' + mmin;
        } catch (e) {
            return '-';
        }
    };

    var fetchHistory = function(isLoadMore) {
        var bId = effectiveBranchId || currentBranchId;
        if (!bId) return;

        if (isLoadMore) setLoadingMore(true); else setLoading(true);
        return OfflineService.checkConnectivity()
            .then(function(online) {
                setIsOnline(online);
                if (online) {
                    var query = supabase
                        .from('sales')
                        .select('*') // Hanya ambil data header saja
                        .eq('branch_id', bId)
                        .order('date', { ascending: false });

                    if (dateFilter === 'today') {
                        var start = new Date();
                        start.setHours(0, 0, 0, 0);
                        query = query.gte('date', start.toISOString());
                    } else if (dateFilter === 'week') {
                        var startWeek = new Date();
                        startWeek.setDate(startWeek.getDate() - 6);
                        startWeek.setHours(0, 0, 0, 0);
                        query = query.gte('date', startWeek.toISOString());
                    } else if (dateFilter === 'month') {
                        var startMonth = new Date();
                        startMonth.setDate(startMonth.getDate() - 29);
                        startMonth.setHours(0, 0, 0, 0);
                        query = query.gte('date', startMonth.toISOString());
                    } else if (dateFilter === 'custom') {
                        var sParts = startDate.split('-');
                        var s = new Date(Number(sParts[0]), Number(sParts[1]) - 1, Number(sParts[2]), 0, 0, 0, 0);
                        var eParts = endDate.split('-');
                        var e = new Date(Number(eParts[0]), Number(eParts[1]) - 1, Number(eParts[2]), 23, 59, 59, 999);
                        query = query.gte('date', s.toISOString()).lte('date', e.toISOString());
                    }

                    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
                    if (cashierFilter !== 'all') query = query.eq('waiter_name', cashierFilter);

                    var pageSize = 50;
                    var startIdx = isLoadMore ? history.length : 0;
                    return query.range(startIdx, startIdx + pageSize - 1).then(function(res) {
                        if (res.error) throw res.error;
                        var newDataItems = res.data || [];
                        if (isLoadMore) {
                            setHistory(function(prev) { return prev.concat(newDataItems); });
                        } else {
                            setHistory(newDataItems);
                        }
                        setHasMore(newDataItems.length === pageSize);
                    });
                }
            })['catch'](function(e) {
                Alert.alert('Error', 'Gagal memuat data');
            })
            .finally(function() {
                setLoading(false);
                setLoadingMore(false);
            });
    };

    useFocusEffect(
        React.useCallback(function() {
            fetchHistory(false);
        }, [dateFilter, startDate, endDate, effectiveBranchId])
    );

    var uniqueCashiers = React.useMemo(function() {
        var list = ['all'];
        history.forEach(function(item) {
            var name = item.waiter_name || item.employee_name;
            if (name && list.indexOf(name) === -1) {
                list.push(name);
            }
        });
        return list;
    }, [history]);

    React.useEffect(function() {
        var filtered = history;
        
        // Apply search query
        if (searchQuery) {
            var q = searchQuery.toLowerCase();
            filtered = filtered.filter(function(item) {
                return (item.order_no || '').toLowerCase().indexOf(q) !== -1 || 
                       (item.table_no || '').toLowerCase().indexOf(q) !== -1 || 
                       (item.customer_name || '').toLowerCase().indexOf(q) !== -1;
            });
        }

        // Apply cashier filter
        if (cashierFilter !== 'all') {
            filtered = filtered.filter(function(item) {
                return (item.waiter_name === cashierFilter) || (item.employee_name === cashierFilter);
            });
        }

        setFilteredHistory(filtered);
    }, [searchQuery, history, cashierFilter]);

    var handleOpenDetail = function(sale) {
        setSelectedSale(sale);
        setShowDetailModal(true);
        
        // LAZY LOAD: Ambil sale_items dan wifi_voucher jika belum ada
        if (!sale.sale_items || sale.sale_items.length === 0) {
            setIsLoadingDetail(true);
            
            var itemsPromise = supabase
                .from('sale_items')
                .select('*, product:product_id (name, category)')
                .eq('sale_id', sale.id);
                
            var wifiPromise = storeSettings && storeSettings.enable_wifi_vouchers 
                ? WifiVoucherService.getVoucherForSale(sale.id, currentBranchId || '1', 1) 
                : Promise.resolve(null);
                
            Promise.all([itemsPromise, wifiPromise])
                .then(function(results) {
                    var res = results[0];
                    var wifiVoucher = results[1];
                    
                    if (res.error) throw res.error;
                    var items = res.data || [];
                    
                    setSelectedSale(function(prev) {
                        if (!prev || prev.id !== sale.id) return prev;
                        return Object.assign({}, prev, { 
                            sale_items: items,
                            wifi_voucher: wifiVoucher
                        });
                    });
                })['catch'](function(err) {
                    console.error('[HistoryScreen] Lazy load error:', err);
                })
                .finally(function() {
                    setIsLoadingDetail(false);
                });
        }
    };

    var handlePrintReceipt = function() {
        if (!selectedSale) return;
        setPrinting(true);
        var orderData = Object.assign({}, selectedSale, {
            receipt_header: (storeSettings && storeSettings.receipt_header) || branchName || 'WINNY POS',
            receipt_footer: (storeSettings && storeSettings.receipt_footer) || 'Terima Kasih',
            receipt_paper_width: (storeSettings && storeSettings.receipt_paper_width) || '58mm',
            shop_address: branchAddress || '',
            shop_phone: branchPhone || '',
            show_logo: (storeSettings && storeSettings.show_logo) !== false,
            receipt_logo_url: (storeSettings && storeSettings.receipt_logo_url) || '',
            enable_wifi_vouchers: storeSettings ? storeSettings.enable_wifi_vouchers : false,
            wifi_voucher: selectedSale.wifi_voucher,
            wifi_voucher_notice: storeSettings ? storeSettings.wifi_voucher_notice : '',
            items: (selectedSale.sale_items || []).map(function(it) {
                return {
                    name: it.product_name || (it.product && it.product.name) || 'Produk',
                    quantity: it.quantity,
                    price: it.price,
                    notes: it.notes
                };
            })
        });
        return PrinterManager.printOrderReceipt(orderData)
            .then(function(success) {
                if (success) Alert.alert('Sukses', 'Struk dicetak');
            })['catch'](function(e) {
                Alert.alert('Error', 'Gagal cetak');
            })
            .finally(function() {
                setPrinting(false);
            });
    };

    var handlePrintTarget = function(type) {
        if (!selectedSale) return;
        setPrinting(true);
        var items = (selectedSale.sale_items || []).map(function(it) {
            return {
                name: it.product_name || (it.product && it.product.name) || 'Produk',
                quantity: it.quantity,
                notes: it.notes,
                target: it.target || (it.product ? it.product.target : ''),
                category: it.product ? it.product.category : ''
            };
        });
        PrinterManager.printToTarget(items, type, selectedSale)
            .then(function(res) {
                if (res.success && res.count > 0) {
                    Alert.alert('Sukses', 'Cetak ke ' + type + ' berhasil');
                } else if (res.count === 0) {
                    Alert.alert('Info', 'Tidak ada item untuk ' + type);
                }
            })
            .finally(function() { setPrinting(false); });
    };

    var handleShowPreview = function() {
        if (!selectedSale) return;
        setShowPreviewModal(true);
    };

    var handleEditSale = function() {
        if (!selectedSale) return;
        setEditData({ customer_name: selectedSale.customer_name || '', table_no: selectedSale.table_no || '' });
        setShowEditModal(true);
    };

    var saveEdit = function() {
        if (!selectedSale) return;
        setIsSaving(true);
        supabase.from('sales')
            .update({ customer_name: editData.customer_name, table_no: editData.table_no })
            .eq('id', selectedSale.id)
            .then(function(res) {
                if (res.error) throw res.error;
                setShowEditModal(false);
                setShowDetailModal(false);
                fetchHistory(false);
                Alert.alert('Sukses', 'Data diperbarui');
            })['catch'](function(e) {
                Alert.alert('Error', 'Gagal menyimpan perubahan');
            })
            .finally(function() { setIsSaving(false); });
    };

    var handleDeleteSale = function() {
        if (!selectedSale) return;
        
        // Selalu minta otorisasi manager untuk hapus transaksi
        setAuthTitle('Otorisasi Hapus Transaksi');
        setPendingAction(function() {
            Alert.alert('Hapus Transaksi', 'Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.', [
                { text: 'Batal', style: 'cancel' },
                { text: 'Hapus Permanen', style: 'destructive', onPress: function() {
                    setLoading(true);
                    
                    var saleItemIds = (selectedSale.sale_items || []).map(function(it) { return it.id; }).filter(Boolean);

                    // 1. Unlink wifi_vouchers terlebih dahulu agar tidak melanggar foreign key
                    supabase.from('wifi_vouchers').update({ is_used: false, used_at: null, sale_id: null }).eq('sale_id', selectedSale.id)
                        .then(function() {
                            // 2. Hapus stock_movements yang terkait dengan item di sale ini
                            if (saleItemIds.length > 0) {
                                return supabase.from('stock_movements').delete().in('sale_item_id', saleItemIds);
                            }
                            return Promise.resolve();
                        })
                        .then(function() {
                            // 3. Hapus item detail produk
                            return supabase.from('sale_items').delete().eq('sale_id', selectedSale.id);
                        })
                        .then(function() {
                            // 4. Hapus header transaksi utama
                            return supabase.from('sales').delete().eq('id', selectedSale.id);
                        })
                        .then(function(res) {
                            if (res.error) throw res.error;
                            setShowDetailModal(false);
                            fetchHistory(false);
                            Alert.alert('Sukses', 'Transaksi berhasil dihapus secara permanen');
                        })['catch'](function(e) {
                            console.error('[HistoryScreen] Delete Sale Error:', e);
                            var errorMsg = e.message || (typeof e === 'string' ? e : 'Terjadi kesalahan sistem');
                            Alert.alert('Error', 'Gagal menghapus transaksi: ' + errorMsg + '\n\nPastikan koneksi internet stabil atau hubungi admin.');
                        })
                        .finally(function() { setLoading(false); });
                }}
            ]);
        });
        setShowAuthModal(true);
    };

    var handleCancelSale = function() {
        if (!selectedSale) return;
        if (selectedSale.status === 'Cancelled' || selectedSale.status === 'Batal') {
            Alert.alert('Info', 'Transaksi sudah dibatalkan');
            return;
        }

        setAuthTitle('Otorisasi Pembatalan');
        setPendingAction(function() {
            Alert.alert('Batalkan Transaksi', 'Stok akan dikembalikan secara otomatis. Lanjutkan?', [
                { text: 'Tidak', style: 'cancel' },
                { text: 'Ya, Batalkan', onPress: function() {
                    setLoading(true);
                    supabase.from('sales').update({ status: 'Batal' }).eq('id', selectedSale.id)
                        .then(function(res) {
                            if (res.error) throw res.error;
                            setSelectedSale(Object.assign({}, selectedSale, { status: 'Batal' }));
                            fetchHistory(false);
                            Alert.alert('Sukses', 'Transaksi telah dibatalkan');
                        })['catch'](function(err) {
                            console.error('[HistoryScreen] Cancel Sale Error:', err);
                            var errorMsg = err.message || (typeof err === 'string' ? err : 'Gagal membatalkan');
                            Alert.alert('Error', 'Gagal membatalkan transaksi: ' + errorMsg);
                        })
                        .finally(function() { setLoading(false); });
                }}
            ]);
        });
        setShowAuthModal(true);
    };

    var handleMarkSelesai = function() {
        if (!selectedSale) return;
        setLoading(true);
        supabase.from('sales').update({ status: 'Selesai' }).eq('id', selectedSale.id)
            .then(function(res) {
                if (res.error) throw res.error;
                setSelectedSale(Object.assign({}, selectedSale, { status: 'Selesai' }));
                fetchHistory(false);
                Alert.alert('Sukses', 'Transaksi ditandai selesai & stok telah dikurangi');
            })['catch'](function() {
                Alert.alert('Error', 'Gagal memperbarui status');
            })
            .finally(function() { setLoading(false); });
    };

    var handleCreateManual = function() {
        setNewData({ customer_name: '', table_no: '', amount: '' });
        setShowCreateModal(true);
    };

    var saveNewManual = function() {
        var bId = effectiveBranchId || currentBranchId;
        if (!bId || !newData.amount) return;
        setIsSaving(true);
        var orderNo = 'MNL-' + Date.now();
        supabase.from('sales').insert([{
            branch_id: bId,
            order_no: orderNo,
            customer_name: newData.customer_name,
            table_no: newData.table_no,
            total_amount: Number(newData.amount),
            status: 'Paid',
            payment_method: 'Cash',
            waiter_name: userName,
            date: new Date().toISOString()
        }]).then(function(res) {
            if (res.error) throw res.error;
            setShowCreateModal(false);
            fetchHistory(false);
            Alert.alert('Sukses', 'Transaksi manual berhasil ditambahkan');
        })['catch'](function() {
            Alert.alert('Error', 'Gagal menambah transaksi');
        })
        .finally(function() { setIsSaving(false); });
    };

    var renderHistoryItem = function(info) {
        var item = info.item;
        var orderInfo = resolveOrderTypeDisplay(item.table_no, storeSettings);
        return React.createElement(TouchableOpacity, {
            key: item.id,
            style: styles.slimCard,
            onPress: function() { handleOpenDetail(item); }
        },
            React.createElement(View, { style: styles.slimMain },
                React.createElement(View, { style: { flex: 1 } },
                    React.createElement(View, { style: styles.slimHeader },
                        React.createElement(Text, { style: styles.slimOrderNo }, item.order_no),
                        React.createElement(Text, { style: styles.slimTable }, " • " + (orderInfo.orderTypeLabel || orderInfo.tableValue || '-'))
                    ),
                    React.createElement(View, { style: styles.slimSub },
                        React.createElement(Text, { style: styles.slimDate }, formatDate(item.date).split(',')[0]),
                        React.createElement(Text, { style: styles.slimCustomer }, " • " + (item.customer_name || 'Guest'))
                    )
                ),
                React.createElement(View, { style: { alignItems: 'flex-end' } },
                    React.createElement(Text, { style: styles.slimAmount }, formatCurrency(item.total_amount)),
                    React.createElement(View, { style: [styles.miniStatus, (item.status === 'Paid' || item.status === 'Selesai' || item.status === 'Completed') ? { backgroundColor: '#f0fdf4' } : { backgroundColor: '#fff7ed' }] },
                        React.createElement(Text, { style: [styles.miniStatusText, (item.status === 'Paid' || item.status === 'Selesai' || item.status === 'Completed') ? { color: '#16a34a' } : { color: '#ea580c' }] },
                            (item.status || 'Pending').toUpperCase()
                        )
                    )
                )
            )
        );
    };

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(View, { style: styles.header },
            React.createElement(TouchableOpacity, { onPress: function() { navigation.goBack(); }, style: styles.backButton },
                React.createElement(Text, { style: { fontSize: 24 } }, "◀")
            ),
            React.createElement(Text, { style: styles.headerTitle }, "Riwayat Transaksi"),
            React.createElement(TouchableOpacity, { onPress: handleCreateManual, style: { marginRight: 15 } },
                React.createElement(Plus, { size: 24, color: "#ea580c" })
            ),
            React.createElement(TouchableOpacity, { onPress: function() { fetchHistory(false); } },
                React.createElement(Text, { style: { color: '#ea580c', fontSize: 20 } }, "↻")
            )
        ),

        React.createElement(View, { style: styles.searchSection },
            React.createElement(View, { style: styles.searchBar },
                React.createElement(TextInput, { 
                    style: styles.searchInput, 
                    placeholder: "Cari order, meja...", 
                    value: searchQuery, 
                    onChangeText: setSearchQuery 
                })
            ),
            React.createElement(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { marginBottom: 8 } },
                ['today', 'week', 'month', 'custom'].map(function(f) {
                    return React.createElement(TouchableOpacity, { 
                        key: f, 
                        style: [styles.filterChip, dateFilter === f && styles.filterChipActive, { marginRight: 8 }], 
                        onPress: function() { f === 'custom' ? setShowDateRangeModal(true) : setDateFilter(f); }
                    },
                        React.createElement(Text, { style: [styles.filterChipText, dateFilter === f && styles.filterChipTextActive] },
                            f === 'today' ? 'Hari Ini' : (f === 'week' ? '7 Hari' : (f === 'month' ? '30 Hari' : 'Kustom'))
                        )
                    );
                })
            ),
            React.createElement(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false },
                uniqueCashiers.map(function(c) {
                    return React.createElement(TouchableOpacity, { 
                        key: c, 
                        style: [styles.filterChip, cashierFilter === c && styles.filterChipActive, { marginRight: 8 }], 
                        onPress: function() { setCashierFilter(c); }
                    },
                        React.createElement(Text, { style: [styles.filterChipText, cashierFilter === c && styles.filterChipTextActive] },
                            c === 'all' ? 'Semua Kasir' : c
                        )
                    );
                })
            )
        ),

        loading && history.length === 0 ? (
            React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } },
                React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" })
            )
        ) : (
            React.createElement(FlatList, {
                data: filteredHistory,
                keyExtractor: function(item, index) { return (item.id || index).toString(); },
                renderItem: renderHistoryItem,
                contentContainerStyle: { padding: 12 },
                onEndReached: function() { if (hasMore && !loadingMore) fetchHistory(true); },
                onEndReachedThreshold: 0.5
            })
        ),

        React.createElement(Modal, { visible: showDetailModal, transparent: true, animationType: "slide" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(View, { style: styles.modalHeaderInner },
                        React.createElement(Text, { style: styles.modalTitle }, "Detail Transaksi"),
                        React.createElement(View, { style: { flexDirection: 'row' } },
                            React.createElement(TouchableOpacity, { onPress: handleEditSale, style: { marginRight: 15 } },
                                React.createElement(Edit2, { size: 20, color: "#64748b" })
                            ),
                            React.createElement(TouchableOpacity, { onPress: handleDeleteSale, style: { marginRight: 15 } },
                                React.createElement(Trash2, { size: 20, color: "#ef4444" })
                            ),
                            React.createElement(TouchableOpacity, { onPress: function() { setShowDetailModal(false); } },
                                React.createElement(Text, { style: { fontSize: 24 } }, "✕")
                            )
                        )
                    ),
                    selectedSale && React.createElement(ScrollView, { style: { padding: 16 } },
                        React.createElement(View, { style: styles.detailRow },
                            React.createElement(Text, { style: styles.detailLabel }, "ORDER"),
                            React.createElement(Text, { style: styles.detailValue }, selectedSale.order_no)
                        ),
                        React.createElement(View, { style: styles.detailRow },
                            React.createElement(Text, { style: styles.detailLabel }, "PELANGGAN"),
                            React.createElement(Text, { style: styles.detailValue }, selectedSale.customer_name || 'Guest')
                        ),
                        React.createElement(View, { style: styles.detailRow },
                            React.createElement(Text, { style: styles.detailLabel }, "WAKTU"),
                            React.createElement(Text, { style: styles.detailValue }, formatDate(selectedSale.date))
                        ),
                        React.createElement(View, { style: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 } }),
                        
                        isLoadingDetail ? (
                            React.createElement(View, { style: { padding: 20, alignItems: 'center' } },
                                React.createElement(ActivityIndicator, { color: '#ea580c' }),
                                React.createElement(Text, { style: { fontSize: 12, color: '#94a3b8', marginTop: 8 } }, "Memuat rincian...")
                            )
                        ) : (
                            (selectedSale.sale_items || []).length === 0 ? (
                                React.createElement(Text, { style: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginVertical: 10 } }, "Tidak ada rincian barang")
                            ) : (
                                (selectedSale.sale_items || []).map(function(it, i) {
                                    return React.createElement(View, { key: i, style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 } },
                                        React.createElement(View, { style: { flex: 1, marginRight: 10 } },
                                            React.createElement(Text, { style: { fontSize: 13, fontWeight: '500' } }, it.product_name || (it.product ? it.product.name : 'Produk')),
                                            React.createElement(Text, { style: { fontSize: 11, color: '#94a3b8' } }, it.quantity + " x " + formatCurrency(it.price))
                                        ),
                                        React.createElement(Text, { style: { fontWeight: 'bold' } }, formatCurrency(it.quantity * it.price))
                                    );
                                })
                            )
                        ),
                        React.createElement(View, { style: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 } }),
                        React.createElement(View, { style: styles.summaryRow },
                            React.createElement(Text, { style: styles.summaryLabel }, "TOTAL"),
                            React.createElement(Text, { style: styles.summaryValue }, formatCurrency(selectedSale.total_amount))
                        ),

                        (selectedSale.status !== 'Completed' && selectedSale.status !== 'Selesai' && selectedSale.status !== 'slesai' && selectedSale.status !== 'Batal') && React.createElement(TouchableOpacity, { 
                            style: [styles.actionBtn, { backgroundColor: '#10b981', marginTop: 16, paddingVertical: 14 }], 
                            onPress: handleMarkSelesai
                        },
                            React.createElement(Text, { style: styles.actionBtnText }, "KONFIRMASI SELESAI (POTONG STOK)")
                        ),

                        (selectedSale.status !== 'Batal' && selectedSale.status !== 'Cancelled') && React.createElement(TouchableOpacity, { 
                            style: [styles.actionBtn, { backgroundColor: '#fecaca', marginTop: 10, paddingVertical: 12 }], 
                            onPress: handleCancelSale
                        },
                            React.createElement(Text, { style: [styles.actionBtnText, { color: '#b91c1c' }] }, "BATALKAN TRANSAKSI")
                        ),
                        
                        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 } },
                            React.createElement(TouchableOpacity, { 
                                style: [styles.actionBtnSecondary, { flex: 1, marginRight: 8 }], 
                                onPress: handleShowPreview 
                            },
                                React.createElement(Text, { style: styles.actionBtnTextSecondary }, "PRATINJAU")
                            ),
                            React.createElement(TouchableOpacity, { 
                                style: [styles.actionBtn, { flex: 1 }], 
                                onPress: handlePrintReceipt,
                                disabled: printing
                            },
                                React.createElement(Text, { style: styles.actionBtnText }, printing ? "MENCETAK..." : "CETAK STRUK")
                            )
                        ),

                        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 } },
                            React.createElement(TouchableOpacity, { 
                                style: [styles.actionBtnOutline, { flex: 1, marginRight: 8 }], 
                                onPress: function() { handlePrintTarget('kitchen'); }
                            },
                                React.createElement(Text, { style: styles.actionBtnTextOutline }, "REPRINT DAPUR")
                            ),
                            React.createElement(TouchableOpacity, { 
                                style: [styles.actionBtnOutline, { flex: 1 }], 
                                onPress: function() { handlePrintTarget('bar'); }
                            },
                                React.createElement(Text, { style: styles.actionBtnTextOutline }, "REPRINT BAR")
                            )
                        )
                    ),
                    React.createElement(TouchableOpacity, { style: { padding: 16, alignItems: 'center' }, onPress: function() { setShowDetailModal(false); } },
                        React.createElement(Text, { style: { color: '#94a3b8' } }, "Tutup")
                    )
                )
            )
        ),
        
        React.createElement(Modal, { visible: showEditModal, transparent: true, animationType: "fade" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: [styles.modalContent, { padding: 20 }] },
                    React.createElement(Text, { style: styles.modalTitle }, "Ubah Data"),
                    React.createElement(TextInput, { 
                        style: [styles.textInput, { marginTop: 15 }], 
                        value: editData.customer_name, 
                        onChangeText: function(v) { setEditData(Object.assign({}, editData, { customer_name: v })); },
                        placeholder: "Nama Pelanggan" 
                    }),
                    React.createElement(TextInput, { 
                        style: [styles.textInput, { marginTop: 10 }], 
                        value: editData.table_no, 
                        onChangeText: function(v) { setEditData(Object.assign({}, editData, { table_no: v })); },
                        placeholder: "Meja/Keterangan" 
                    }),
                    React.createElement(View, { style: { flexDirection: 'row', marginTop: 20 } },
                        React.createElement(TouchableOpacity, { style: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center', marginRight: 10 }, onPress: function() { setShowEditModal(false); } },
                            React.createElement(Text, null, "Batal")
                        ),
                        React.createElement(TouchableOpacity, { 
                            style: { flex: 1, padding: 12, backgroundColor: '#ea580c', borderRadius: 8, alignItems: 'center' }, 
                            onPress: saveEdit,
                            disabled: isSaving
                        },
                            isSaving ? React.createElement(ActivityIndicator, { size: "small", color: "white" }) : React.createElement(Text, { style: { color: 'white' } }, "Simpan")
                        )
                    )
                )
            )
        ),

        React.createElement(Modal, { visible: showCreateModal, transparent: true, animationType: "fade" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: [styles.modalContent, { padding: 20 }] },
                    React.createElement(Text, { style: styles.modalTitle }, "Transaksi Manual"),
                    React.createElement(TextInput, { 
                        style: [styles.textInput, { marginTop: 15 }], 
                        value: newData.customer_name, 
                        onChangeText: function(v) { setNewData(Object.assign({}, newData, { customer_name: v })); },
                        placeholder: "Nama Pelanggan" 
                    }),
                    React.createElement(TextInput, { 
                        style: [styles.textInput, { marginTop: 10 }], 
                        value: newData.table_no, 
                        onChangeText: function(v) { setNewData(Object.assign({}, newData, { table_no: v })); },
                        placeholder: "Meja/Order Type" 
                    }),
                    React.createElement(TextInput, { 
                        style: [styles.textInput, { marginTop: 10 }], 
                        value: newData.amount, 
                        onChangeText: function(v) { setNewData(Object.assign({}, newData, { amount: v })); },
                        placeholder: "Total Amount (Nominal)",
                        keyboardType: "numeric"
                    }),
                    React.createElement(View, { style: { flexDirection: 'row', marginTop: 20 } },
                        React.createElement(TouchableOpacity, { style: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center', marginRight: 10 }, onPress: function() { setShowCreateModal(false); } },
                            React.createElement(Text, null, "Batal")
                        ),
                        React.createElement(TouchableOpacity, { 
                            style: { flex: 1, padding: 12, backgroundColor: '#ea580c', borderRadius: 8, alignItems: 'center' }, 
                            onPress: saveNewManual,
                            disabled: isSaving
                        },
                            isSaving ? React.createElement(ActivityIndicator, { size: "small", color: "white" }) : React.createElement(Text, { style: { color: 'white' } }, "Tambah")
                        )
                    )
                )
            )
        ),

        React.createElement(Modal, { visible: showDateRangeModal, transparent: true, animationType: "fade" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: [styles.modalContent, { padding: 20 }] },
                    React.createElement(Text, { style: styles.modalTitle }, "Pilih Rentang Tanggal"),
                    React.createElement(TextInput, { style: styles.textInput, value: startDate, onChangeText: setStartDate, placeholder: "Mulai (YYYY-MM-DD)" }),
                    React.createElement(TextInput, { style: [styles.textInput, { marginTop: 10 }], value: endDate, onChangeText: setEndDate, placeholder: "Selesai (YYYY-MM-DD)" }),
                    React.createElement(View, { style: { flexDirection: 'row', marginTop: 20 } },
                        React.createElement(TouchableOpacity, { style: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center', marginRight: 10 }, onPress: function() { setShowDateRangeModal(false); } },
                            React.createElement(Text, null, "Batal")
                        ),
                        React.createElement(TouchableOpacity, { style: { flex: 1, padding: 12, backgroundColor: '#ea580c', borderRadius: 8, alignItems: 'center' }, onPress: function() { setDateFilter('custom'); setShowDateRangeModal(false); } },
                            React.createElement(Text, { style: { color: 'white' } }, "Pilih")
                        )
                    )
                )
            )
        ),

        selectedSale && React.createElement(ReceiptPreviewModal, {
            visible: showPreviewModal,
            onClose: function() { setShowPreviewModal(false); },
            orderData: Object.assign({}, selectedSale, {
                receipt_header: (storeSettings && storeSettings.receipt_header) || branchName || 'WINNY POS',
                receipt_footer: (storeSettings && storeSettings.receipt_footer) || 'Terima Kasih',
                receipt_paper_width: (storeSettings && storeSettings.receipt_paper_width) || '58mm',
                shop_address: branchAddress || '',
                shop_phone: branchPhone || '',
                show_logo: (storeSettings && storeSettings.show_logo) !== false,
                receipt_logo_url: (storeSettings && storeSettings.receipt_logo_url) || '',
                enable_wifi_vouchers: storeSettings ? storeSettings.enable_wifi_vouchers : false,
                wifi_voucher: selectedSale.wifi_voucher,
                wifi_voucher_notice: storeSettings ? storeSettings.wifi_voucher_notice : '',
                items: (selectedSale.sale_items || []).map(function(it) {
                    return {
                        name: it.product_name || (it.product && it.product.name) || 'Produk',
                        quantity: it.quantity,
                        price: it.price,
                        notes: it.notes
                    };
                })
            }),
            onPrint: function() { 
                setShowPreviewModal(false); 
                setTimeout(handlePrintReceipt, 300); 
            }
        }),

        React.createElement(ManagerAuthModal, {
            visible: showAuthModal,
            onClose: function() { setShowAuthModal(false); setPendingAction(null); },
            onSuccess: function() {
                setShowAuthModal(false);
                if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                }
            },
            title: authTitle
        })
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    headerTitle: { fontSize: 16, fontWeight: 'bold', flex: 1, color: '#1e293b' },
    searchSection: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    searchBar: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, height: 36, marginBottom: 8, justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
    searchInput: { fontSize: 12 },
    filterChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#f8fafc', marginRight: 6, borderWidth: 1, borderColor: '#f1f5f9' },
    filterChipActive: { backgroundColor: '#fff7ed', borderColor: '#ea580c' },
    filterChipText: { fontSize: 10, color: '#64748b', fontWeight: '600' },
    filterChipTextActive: { color: '#ea580c', fontWeight: 'bold' },
    slimCard: { backgroundColor: 'white', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: '#f1f5f9' },
    slimMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    slimHeader: { flexDirection: 'row', alignItems: 'center' },
    slimOrderNo: { fontSize: 12, fontWeight: '800', color: '#ea580c' },
    slimTable: { fontSize: 11, color: '#475569', fontWeight: '600' },
    slimSub: { flexDirection: 'row', marginTop: 1 },
    slimDate: { fontSize: 10, color: '#94a3b8' },
    slimCustomer: { fontSize: 10, color: '#64748b', fontWeight: '500' },
    slimAmount: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
    miniStatus: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    miniStatusText: { fontSize: 8, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 20 },
    modalHeaderInner: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' },
    detailValue: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
    summaryValue: { fontSize: 18, fontWeight: '900', color: '#ea580c' },
    actionBtn: {
        backgroundColor: '#ea580c',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    actionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    actionBtnSecondary: {
        backgroundColor: '#f1f5f9',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    actionBtnTextSecondary: { color: '#64748b', fontWeight: 'bold', fontSize: 13 },
    actionBtnOutline: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    actionBtnTextOutline: { color: '#64748b', fontWeight: 'bold', fontSize: 10 },
    textInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 13 }
});
