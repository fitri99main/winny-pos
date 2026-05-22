import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var SafeAreaView = RN.SafeAreaView;
var StyleSheet = RN.StyleSheet;
var ActivityIndicator = RN.ActivityIndicator;
var Alert = RN.Alert;
var FlatList = RN.FlatList;
var Modal = RN.Modal;
var useWindowDimensions = RN.useWindowDimensions;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
var useRoute = NavNative.useRoute;
var useFocusEffect = NavNative.useFocusEffect;
import * as Lucide from 'lucide-react-native';
var CheckCircle2 = Lucide.CheckCircle2;
var X = Lucide.X;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;

export default function KDSScreen() {
    var navigation = useNavigation();
    var route = useRoute();
    var params = route.params || {};
    var initialFilter = params.initialFilter || 'All';
    var dims = useWindowDimensions();
    var width = dims.width;
    var height = dims.height;
    var isSmallDevice = width < 480;
    var isLandscape = width > height;
    var isWide = width >= 600;
    var numColumns = isWide ? 4 : (width >= 380 ? 2 : 1);
    var session = useSession();
    var currentBranchId = session.currentBranchId;

    var stateOrders = React.useState([]);
    var orders = stateOrders[0];
    var setOrders = stateOrders[1];

    var stateLoading = React.useState(true);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var stateFilter = React.useState(initialFilter);
    var filter = stateFilter[0];
    var setFilter = stateFilter[1];

    var stateNow = React.useState(new Date());
    var now = stateNow[0];
    var setNow = stateNow[1];

    var stateShowCompleteModal = React.useState(false);
    var showCompleteModal = stateShowCompleteModal[0];
    var setShowCompleteModal = stateShowCompleteModal[1];

    var stateSelectedOrderId = React.useState(null);
    var selectedOrderId = stateSelectedOrderId[0];
    var setSelectedOrderId = stateSelectedOrderId[1];

    var stateCompleting = React.useState(false);
    var completing = stateCompleting[0];
    var setCompleting = stateCompleting[1];

    React.useEffect(function() {
        var interval = setInterval(function() { setNow(new Date()); }, 30000);
        return function() { clearInterval(interval); };
    }, []);

    var fetchActiveOrders = function() {
        if (!currentBranchId) {
            setLoading(false);
            return;
        }
        return supabase
            .from('sales')
            .select('*, items:sale_items(*)')
            .eq('branch_id', currentBranchId)
            .neq('status', 'Completed')
            .order('date', { ascending: false })
            .limit(50)
            .then(function(res) {
                if (res.error) throw res.error;
                setOrders(res.data || []);
            })['catch'](function(error) {
                console.error('Error fetching KDS orders:', error);
            })
            .finally(function() {
                setLoading(false);
            });
    };

    React.useEffect(function() {
        if (!currentBranchId) {
            if (!session.loading) {
                setLoading(false);
            }
            return;
        }

        setLoading(true);
        fetchActiveOrders();

        var salesSub = supabase.channel('kds_sales_' + currentBranchId)
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'sales' }, 
                function(payload) {
                    var newRow = payload.new;
                    var eventType = payload.eventType;
                    if (newRow && String(newRow.branch_id || '').trim() === String(currentBranchId || '').trim()) {
                        fetchActiveOrders();
                    } else if (eventType === 'DELETE') {
                        fetchActiveOrders();
                    }
                }
            );

        salesSub.subscribe(function(status) {
            if (status === 'SUBSCRIBED') {
                fetchActiveOrders();
            }
        });

        var itemsSub = supabase.channel('kds_items_' + currentBranchId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, function() {
                fetchActiveOrders();
            });

        itemsSub.subscribe();

        var pollingInterval = setInterval(fetchActiveOrders, 60000);

        return function() {
            supabase.removeChannel(salesSub);
            supabase.removeChannel(itemsSub);
            clearInterval(pollingInterval);
        };
    }, [currentBranchId, session.loading]);

    var determineTarget = function(item) {
        var nameLow = (item.product_name || item.name || '').toLowerCase();
        var categoryLow = (item.category || '').toLowerCase();
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
    };

    var getElapsedTime = function(dateStr) {
        if (!dateStr) return '0m';
        var start = new Date(dateStr).getTime();
        var diff = now.getTime() - start;
        var minutes = Math.floor(diff / 60000);
        return minutes + 'm';
    };

    var handleUpdateItemStatus = function(itemId, newStatus) {
        var originalOrders = JSON.parse(JSON.stringify(orders));
        setOrders(function(prevOrders) {
            return prevOrders.map(function(order) {
                var newItems = (order.items || []).map(function(item) {
                    return item.id === itemId ? Object.assign({}, item, { status: newStatus }) : item;
                });
                return Object.assign({}, order, { items: newItems });
            });
        });

        return supabase
            .from('sale_items')
            .update({ status: newStatus })
            .eq('id', itemId)
            .then(function(res) {
                if (res.error) throw res.error;
            })['catch'](function(error) {
                setOrders(originalOrders);
                Alert.alert('Gagal Update', 'Tidak bisa mengubah status item.');
            });
    };

    var handleCompleteOrder = function(orderId) {
        setSelectedOrderId(orderId);
        setShowCompleteModal(true);
    };

    var confirmCompleteOrder = function() {
        if (!selectedOrderId) return;
        var orderIdToComplete = selectedOrderId;
        var originalOrders = JSON.parse(JSON.stringify(orders));
        var currentFilter = filter;

        setOrders(function(prev) {
            return prev.map(function(o) {
                if (o.id === orderIdToComplete) {
                    var newItems = (o.items || []).map(function(item) {
                        if (currentFilter === 'All' || (item.target || determineTarget(item)) === currentFilter) {
                            return Object.assign({}, item, { status: 'Served' });
                        }
                        return item;
                    });
                    return Object.assign({}, o, { items: newItems });
                }
                return o;
            });
        });
        
        setShowCompleteModal(false);
        setSelectedOrderId(null);

        var updatePromise = currentFilter === 'All' ? 
            supabase.from('sale_items').update({ status: 'Served' }).eq('sale_id', orderIdToComplete) :
            supabase.from('sale_items').update({ status: 'Served' }).eq('sale_id', orderIdToComplete).eq('target', currentFilter);

        return updatePromise.then(function() {
            var order = null;
            for (var i = 0; i < originalOrders.length; i++) {
                if (originalOrders[i].id === orderIdToComplete) {
                    order = originalOrders[i];
                    break;
                }
            }

            if (order) {
                var updatedItems = (order.items || []).map(function(item) {
                    if (currentFilter === 'All' || (item.target || determineTarget(item)) === currentFilter) {
                        return Object.assign({}, item, { status: 'Served' });
                    }
                    return item;
                });
                var allServed = true;
                for (var j = 0; j < updatedItems.length; j++) {
                    if (updatedItems[j].status !== 'Served') {
                        allServed = false;
                        break;
                    }
                }

                if (allServed) {
                    var start = new Date(order.created_at || order.date).getTime();
                    var diff = Date.now() - start;
                    var minutes = Math.floor(diff / 60000);
                    var waitingTime = minutes + ' menit';

                    return supabase
                        .from('sales')
                        .update({ 
                            status: 'Completed',
                            waiting_time: waitingTime
                        })
                        .eq('id', orderIdToComplete)
                        .then(function() {
                            setOrders(function(prev) {
                                return prev.filter(function(o) { return o.id !== orderIdToComplete; });
                            });
                        });
                }
            }
        })['catch'](function(error) {
            setOrders(originalOrders);
            Alert.alert('Gagal Selesai', 'Gagal menyimpan status pesanan.');
        });
    };

    var filteredOrders = orders.map(function(order) {
        var items = (order.items || []).filter(function(item) {
            if (filter === 'All') return true;
            var finalTarget = item.target || determineTarget(item);
            return finalTarget === filter;
        });
        var activeItems = items.filter(function(item) { return item.status !== 'Served'; });
        return Object.assign({}, order, { items: activeItems });
    }).filter(function(order) { return order.items.length > 0; });

    var renderOrderItem = function(params) {
        var order = params.item;
        var allItemsReady = true;
        for (var i = 0; i < order.items.length; i++) {
            if (order.items[i].status !== 'Ready') {
                allItemsReady = false;
                break;
            }
        }
        var elapsedStr = getElapsedTime(order.date);
        var elapsed = parseInt(elapsedStr);

        return React.createElement(View, { style: [styles.orderCard, isSmallDevice && { width: '100%', padding: 12, borderRadius: 16 }] },
            React.createElement(View, { style: [styles.orderHeader, isSmallDevice && { marginBottom: 8, paddingBottom: 8 }] },
                React.createElement(View, null,
                    React.createElement(Text, { style: styles.orderNo }, order.order_no),
                    React.createElement(Text, { style: [styles.tableName, isSmallDevice && { fontSize: 14 }] }, "Meja " + (order.table_no || '-'))
                ),
                React.createElement(View, { style: styles.headerInfo },
                    React.createElement(Text, { style: [styles.timeText, elapsed > 15 && styles.timeWarning] }, elapsedStr + " lalu"),
                    React.createElement(Text, { style: styles.waiterName }, "\uD83D\uDC64 " + (order.waiter_name || 'Kiosk'))
                )
            ),
            React.createElement(View, { style: [styles.itemsList, isSmallDevice && { marginBottom: 12 }] },
                order.items.map(function(item, index) {
                    return React.createElement(View, { key: 'item-' + (item.id || index) + '-' + index, style: styles.itemRow },
                        React.createElement(View, { style: styles.itemMain },
                            React.createElement(View, { style: [styles.quantityBadge, item.status === 'Ready' && styles.quantityBadgeReady, isSmallDevice && { width: 22, height: 22, borderRadius: 6, marginRight: 6 }] },
                                React.createElement(Text, { style: [styles.quantityText, isSmallDevice && { fontSize: 10 }] }, item.quantity)
                            ),
                            React.createElement(Text, { 
                                style: [styles.itemName, item.status === 'Ready' && styles.itemNameReady, isSmallDevice && { fontSize: 11 }],
                                numberOfLines: 1,
                                ellipsizeMode: "tail"
                            }, item.product_name),
                            item.notes ? React.createElement(View, { style: { marginLeft: 32, marginTop: 1 } },
                                React.createElement(Text, { style: { fontSize: 10, color: '#ea580c', fontStyle: 'italic' } }, "\u2022 " + item.notes)
                            ) : null
                        ),
                        item.status !== 'Ready' ? React.createElement(TouchableOpacity, { 
                            style: [styles.readyButton, item.status === 'Preparing' ? { backgroundColor: '#ecfdf5', borderColor: '#10b981' } : { backgroundColor: '#fff7ed', borderColor: '#fdba74' }, isSmallDevice && { paddingVertical: 2, paddingHorizontal: 6 }],
                            onPress: function() { handleUpdateItemStatus(item.id, item.status === 'Preparing' ? 'Ready' : 'Preparing'); }
                        },
                            React.createElement(Text, { style: [styles.readyButtonText, item.status === 'Preparing' ? { color: '#10b981' } : { color: '#ea580c' }, isSmallDevice && { fontSize: 9 }] },
                                item.status === 'Preparing' ? 'Selesai' : 'Proses'
                            )
                        ) : React.createElement(Text, { style: [styles.readyBadge, isSmallDevice && { fontSize: 12 }] }, "\u2705")
                    );
                })
            ),
            React.createElement(TouchableOpacity, { 
                style: [styles.completeButton, !allItemsReady && styles.completeButtonDisabled, isSmallDevice && { paddingVertical: 10, borderRadius: 10 }],
                disabled: !allItemsReady,
                onPress: function() { handleCompleteOrder(order.id); }
            },
                React.createElement(Text, { style: [styles.completeButtonText, !allItemsReady && styles.completeButtonTextDisabled, isSmallDevice && { fontSize: 12 }] },
                    allItemsReady ? 'Siap Sajikan' : 'Belum Lengkap'
                )
            )
        );
    };

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(View, { style: styles.header },
            React.createElement(TouchableOpacity, { onPress: function() { navigation.goBack(); }, style: styles.backButton },
                React.createElement(Text, { style: styles.backButtonText }, "\u2039")
            ),
            React.createElement(View, { style: { flex: 1 } },
                React.createElement(Text, { style: styles.headerTitle }, "Monitor Pesanan"),
                React.createElement(Text, { style: { fontSize: 10, color: '#64748b' } }, "Cabang: " + (currentBranchId || 'Tidak Diketahui') + " \u2022 Total: " + orders.length + " Data")
            ),
            React.createElement(TouchableOpacity, { 
                onPress: function() { fetchActiveOrders(); }, 
                style: { backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 }
            },
                React.createElement(Text, { style: { fontSize: 12, fontWeight: 'bold', color: '#ea580c' } }, "Segarkan")
            )
        ),
        React.createElement(View, { style: styles.tabsContainer },
            ['All', 'Kitchen', 'Bar'].map(function(t) {
                return React.createElement(TouchableOpacity, {
                    key: t,
                    style: [styles.tab, filter === t && styles.activeTab],
                    onPress: function() { setFilter(t); }
                },
                    React.createElement(Text, { style: [styles.tabText, filter === t && styles.activeTabText] },
                        t === 'All' ? 'Semua' : t === 'Kitchen' ? 'Dapur' : 'Bar'
                    )
                );
            })
        ),
        loading ? React.createElement(View, { style: styles.centerContent },
            React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" })
        ) : (!currentBranchId ? React.createElement(View, { style: styles.centerContent },
            React.createElement(Text, { style: styles.emptyText }, "Cabang tidak terdeteksi")
        ) : (filteredOrders.length === 0 ? React.createElement(View, { style: styles.centerContent },
            React.createElement(Text, { style: styles.emptyText }, "Tidak ada pesanan aktif")
        ) : React.createElement(FlatList, {
            data: filteredOrders,
            renderItem: renderOrderItem,
            keyExtractor: function(item, index) { return 'order-' + (item.id || index) + '-' + index; },
            contentContainerStyle: [styles.listContent, isSmallDevice && { padding: 8 }],
            numColumns: numColumns,
            key: 'kds-grid-' + numColumns
        })),
        React.createElement(Modal, {
            visible: showCompleteModal,
            transparent: true,
            animationType: "fade",
            onRequestClose: function() { setShowCompleteModal(false); }
        },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modernModalContent },
                    React.createElement(TouchableOpacity, { 
                        style: styles.closeModalButton,
                        onPress: function() { setShowCompleteModal(false); }
                    },
                        React.createElement(X, { size: 20, color: "#94a3b8" })
                    ),
                    React.createElement(View, { style: styles.modalIconContainer },
                        React.createElement(CheckCircle2, { size: 32, color: "#10b981" })
                    ),
                    React.createElement(Text, { style: styles.modalTitle }, "Selesaikan Pesanan"),
                    React.createElement(Text, { style: styles.modalDescription }, "Semua item telah siap. Tandai pesanan ini sebagai selesai diproses?"),
                    React.createElement(View, { style: styles.modalFooter },
                        React.createElement(TouchableOpacity, {
                            style: styles.cancelModalButton,
                            onPress: function() { setShowCompleteModal(false); }
                        },
                            React.createElement(Text, { style: styles.cancelModalButtonText }, "Batal")
                        ),
                        React.createElement(TouchableOpacity, {
                            style: styles.confirmModalButton,
                            onPress: confirmCompleteOrder,
                            disabled: completing
                        },
                            completing ? React.createElement(ActivityIndicator, { size: "small", color: "white" }) : React.createElement(Text, { style: styles.confirmModalButtonText }, "Ya, Selesai")
                        )
                    )
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    backButtonText: { fontSize: 24, lineHeight: 24, color: '#1f2937', textAlign: 'center', marginTop: -2 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    tabsContainer: { flexDirection: 'row', padding: 6, backgroundColor: 'white' },
    tab: { flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', marginRight: 6 },
    activeTab: { backgroundColor: '#ea580c' },
    tabText: { fontWeight: 'bold', color: '#6b7280' },
    activeTabText: { color: 'white' },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 16, color: '#9ca3af', fontWeight: '500' },
    listContent: { padding: 6 },
    orderCard: { flex: 1, margin: 4, backgroundColor: 'white', borderRadius: 12, padding: 10, elevation: 2 },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    orderNo: { fontSize: 10, fontWeight: 'bold', color: '#ea580c' },
    tableName: { fontSize: 13, fontWeight: '900', color: '#1f2937' },
    headerInfo: { alignItems: 'flex-end' },
    timeText: { fontSize: 9, color: '#6b7280' },
    timeWarning: { color: '#ef4444', fontWeight: 'bold' },
    waiterName: { fontSize: 9, color: '#9ca3af', marginTop: 1 },
    itemsList: { marginBottom: 8 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    itemMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    quantityBadge: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
    quantityBadgeReady: { backgroundColor: '#dcfce7' },
    quantityText: { fontSize: 10, fontWeight: 'bold', color: '#4b5563' },
    itemName: { fontSize: 10, color: '#374151', fontWeight: '500', flex: 1 },
    itemNameReady: { color: '#9ca3af', textDecorationLine: 'line-through' },
    readyButton: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' },
    readyButtonText: { fontSize: 10, fontWeight: 'bold', color: '#ea580c' },
    readyBadge: { fontSize: 14 },
    completeButton: { backgroundColor: '#1f2937', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    completeButtonDisabled: { backgroundColor: '#f3f4f6' },
    completeButtonText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    completeButtonTextDisabled: { color: '#9ca3af' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modernModalContent: { width: '100%', maxWidth: 340, backgroundColor: 'white', borderRadius: 28, padding: 24, alignItems: 'center', elevation: 10 },
    closeModalButton: { position: 'absolute', top: 16, right: 16, padding: 4 },
    modalIconContainer: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
    modalDescription: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 10 },
    modalFooter: { flexDirection: 'row', width: '100%' },
    cancelModalButton: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center' },
    cancelModalButtonText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
    confirmModalButton: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#10b981', alignItems: 'center', elevation: 4 },
    confirmModalButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
});
