import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var StyleSheet = RN.StyleSheet;
var ActivityIndicator = RN.ActivityIndicator;
var Alert = RN.Alert;
var useWindowDimensions = RN.useWindowDimensions;
var FlatList = RN.FlatList;
var Modal = RN.Modal;
var TextInput = RN.TextInput;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
var useFocusEffect = NavNative.useFocusEffect;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import * as Lucide from 'lucide-react-native';
var BarChart3 = Lucide.BarChart3;
var TrendingUp = Lucide.TrendingUp;
var ShoppingCart = Lucide.ShoppingCart;
var Calendar = Lucide.Calendar;
var ChevronRight = Lucide.ChevronRight;
var ChevronLeft = Lucide.ChevronLeft;
var Award = Lucide.Award;
var Clock = Lucide.Clock;
var Wallet = Lucide.Wallet;
var Printer = Lucide.Printer;
var Search = Lucide.Search;
var Info = Lucide.Info;
import * as PrinterLib from '../lib/PrinterManager';
var PrinterManager = PrinterLib.PrinterManager;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;
import DateStepper from '../components/DateStepper';
import * as DateLib from '../lib/dateUtils';
var getLocalDateString = DateLib.getLocalDateString;

export default function AccountingScreen() {
    var navigation = useNavigation();
    var dims = useWindowDimensions();
    var width = dims.width;
    var isSmallDevice = width < 380;
    
    var session = useSession();
    var isAdmin = session.isAdmin;
    var storeSettings = session.storeSettings;
    var currentBranchId = session.currentBranchId;
    var branchName = session.branchName;
    var sessionLoading = session.loading;
    
    React.useEffect(function() {
        if (!sessionLoading && !isAdmin && storeSettings && !storeSettings.cashier_can_view_reports) {
            Alert.alert('Akses Ditolak', 'Anda tidak memiliki izin untuk melihat laporan penjualan.');
            navigation.goBack();
        }
    }, [isAdmin, storeSettings, sessionLoading]);

    var stateFilter = React.useState('today');
    var filter = stateFilter[0];
    var setFilter = stateFilter[1];

    var stateLoading = React.useState(true);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];
    
    var stateStartDate = React.useState(getLocalDateString());
    var startDate = stateStartDate[0];
    var setStartDate = stateStartDate[1];

    var stateEndDate = React.useState(getLocalDateString());
    var endDate = stateEndDate[0];
    var setEndDate = stateEndDate[1];

    var stateShowDateRangeModal = React.useState(false);
    var showDateRangeModal = stateShowDateRangeModal[0];
    var setShowDateRangeModal = stateShowDateRangeModal[1];

    var stateStats = React.useState({
        totalOmzet: 0,
        totalSales: 0,
        avgTicket: 0,
        totalDiscount: 0,
        totalTax: 0,
        totalService: 0,
        estimatedProfit: 0
    });
    var stats = stateStats[0];
    var setStats = stateStats[1];
    
    var stateGlobalTopProducts = React.useState([]);
    var globalTopProducts = stateGlobalTopProducts[0];
    var setGlobalTopProducts = stateGlobalTopProducts[1];

    var stateAllProducts = React.useState([]);
    var allProducts = stateAllProducts[0];
    var setAllProducts = stateAllProducts[1];

    var stateProductSearch = React.useState('');
    var productSearch = stateProductSearch[0];
    var setProductSearch = stateProductSearch[1];

    var stateSelectedCategory = React.useState('Semua');
    var selectedCategory = stateSelectedCategory[0];
    var setSelectedCategory = stateSelectedCategory[1];

    var stateSortBy = React.useState('qty');
    var sortBy = stateSortBy[0];
    var setSortBy = stateSortBy[1];

    var stateCategoryBreakdown = React.useState([]);
    var categoryBreakdown = stateCategoryBreakdown[0];
    var setCategoryBreakdown = stateCategoryBreakdown[1];

    var statePaymentBreakdown = React.useState([]);
    var paymentBreakdown = statePaymentBreakdown[0];
    var setPaymentBreakdown = statePaymentBreakdown[1];

    var stateRecentSales = React.useState([]);
    var recentSales = stateRecentSales[0];
    var setRecentSales = stateRecentSales[1];

    var fetchDashboardData = function() {
        var bId = currentBranchId;
        if (!bId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        var now = new Date();
        var startQueryDate = new Date();
        var endQueryDate = null;
        
        if (filter === 'today') {
            startQueryDate.setHours(0, 0, 0, 0);
        } else if (filter === 'week') {
            startQueryDate.setDate(now.getDate() - 6);
            startQueryDate.setHours(0, 0, 0, 0);
        } else if (filter === 'month') {
            startQueryDate.setDate(now.getDate() - 29);
            startQueryDate.setHours(0, 0, 0, 0);
        } else if (filter === 'custom') {
            startQueryDate = new Date(startDate);
            startQueryDate.setHours(0, 0, 0, 0);
            endQueryDate = new Date(endDate);
            endQueryDate.setHours(23, 59, 59, 999);
        }
        
        var allSales = [];
        var PAID_STATUSES = ['Paid', 'Completed', 'Selesai', 'Settlement', 'Served', 'Capture', 'Success', 'Ready'];
        var pageSize = 200; // Smaller page size because we are fetching nested items

        var fetchSalesPage = function(fromIdx) {
            // Optimization: Only fetch necessary columns, avoid deep nested joins for every item
            var query = supabase
                .from('sales')
                .select('id, total_amount, discount, tax, service_charge, payment_method, date, sale_items(product_name, quantity, price, cost, product_id)')
                .eq('branch_id', bId)
                .in('status', PAID_STATUSES)
                .gte('date', startQueryDate.toISOString())
                .order('date', { ascending: false })
                .range(fromIdx, fromIdx + pageSize - 1);

            if (endQueryDate) {
                query = query.lte('date', endQueryDate.toISOString());
            }

            return query.then(function(res) {
                if (res.error) throw res.error;
                var data = res.data;
                if (data && data.length > 0) {
                    allSales = allSales.concat(data);
                    if (data.length === pageSize) {
                        return fetchSalesPage(fromIdx + pageSize);
                    }
                }
                return allSales;
            });
        };

        var masterCategories = [];
        var productToCategoryMap = {};
        
        // Fetch categories and product mapping separately to avoid heavy joins
        var fetchAuxData = function() {
            var p1 = supabase.from('categories').select('name').order('sort_order', { ascending: true }).then(function(res) {
                if (res.data) masterCategories = res.data.map(function(c) { return c.name; });
            });
            
            var p2 = supabase.from('products').select('id, category').then(function(res) {
                if (res.data) {
                    res.data.forEach(function(p) { productToCategoryMap[p.id] = p.category; });
                }
            });
            
            return Promise.all([p1, p2]);
        };

        return fetchAuxData().then(function() {
            return fetchSalesPage(0);
        }).then(function() {
            var totalOmzet = 0;
            var totalDiscount = 0;
            var totalTax = 0;
            var totalService = 0;
            
            var productGroups = {};
            var catGroups = {};
            
            // Initialize with all master categories
            for (var cIdx = 0; cIdx < masterCategories.length; cIdx++) {
                catGroups[masterCategories[cIdx]] = { revenue: 0, qty: 0 };
            }

            var totalCost = 0;
            var paymentsMap = {};

            for (var i = 0; i < allSales.length; i++) {
                var sale = allSales[i];
                totalOmzet += (sale.total_amount || 0);
                totalDiscount += (sale.discount || 0);
                totalTax += (sale.tax || 0);
                totalService += (sale.service_charge || 0);

                var method = sale.payment_method || 'Tunai';
                paymentsMap[method] = (paymentsMap[method] || 0) + (sale.total_amount || 0);

                var items = sale.sale_items || [];
                for (var j = 0; j < items.length; j++) {
                    var item = items[j];
                    var name = item.product_name || 'Produk';
                    var qty = item.quantity || 0;
                    var price = item.price || 0;
                    var cost = item.cost || 0;
                    
                    // Use optimized map instead of nested join data
                    var category = productToCategoryMap[item.product_id] || 'Lainnya';
                    
                    if (!productGroups[name]) productGroups[name] = { qty: 0, revenue: 0, cost: 0, category: category };
                    productGroups[name].qty += qty;
                    productGroups[name].revenue += (price * qty);
                    productGroups[name].cost += (cost * qty);
                    
                    if (!catGroups[category]) catGroups[category] = { revenue: 0, qty: 0 };
                    catGroups[category].revenue += (price * qty);
                    catGroups[category].qty += qty;
                    
                    totalCost += (cost * qty);
                }
            }

            var totalSalesCount = allSales.length;
            var avgTicket = totalSalesCount > 0 ? totalOmzet / totalSalesCount : 0;

            var payList = [];
            var payKeys = Object.keys(paymentsMap);
            for (var k = 0; k < payKeys.length; k++) {
                payList.push({ method: payKeys[k], amount: paymentsMap[payKeys[k]] });
            }
            setPaymentBreakdown(payList.sort(function(a, b) { return b.amount - a.amount; }));

            setStats({
                totalOmzet: totalOmzet,
                totalSales: totalSalesCount,
                avgTicket: avgTicket,
                totalDiscount: totalDiscount,
                totalTax: totalTax,
                totalService: totalService,
                estimatedProfit: (totalOmzet - totalTax - totalService) - totalCost
            });

            setRecentSales(allSales.slice(0, 5));

            var prodKeys = Object.keys(productGroups);
            var allSoldList = [];
            for (var n = 0; n < prodKeys.length; n++) {
                allSoldList.push(Object.assign({ name: prodKeys[n] }, productGroups[prodKeys[n]]));
            }
            allSoldList.sort(function(a, b) { return b.qty - a.qty; });
            
            setAllProducts(allSoldList);
            setGlobalTopProducts(allSoldList.slice(0, 10));

            var catKeys = Object.keys(catGroups);
            var categoriesList = [];
            for (var p = 0; p < catKeys.length; p++) {
                categoriesList.push(Object.assign({ name: catKeys[p] }, catGroups[catKeys[p]]));
            }
            categoriesList.sort(function(a, b) { return b.revenue - a.revenue; });
            setCategoryBreakdown(categoriesList);

        })['catch'](function(error) {
            console.error('Fetch Dashboard Error:', error);
            Alert.alert('Error', 'Gagal memuat dashboard.');
        }).finally(function() {
            setLoading(false);
        });
    };

    useFocusEffect(
        React.useCallback(function() {
            if (currentBranchId) {
                fetchDashboardData();
            }
        }, [filter, startDate, endDate, currentBranchId])
    );

    var handlePrintSummary = function() {
        var hasPermission = isAdmin || (storeSettings && storeSettings.cashier_can_view_reports);
        if (!hasPermission) {
            Alert.alert('Akses Ditolak', 'Anda tidak memiliki izin untuk mencetak laporan penjualan.');
            return;
        }

        var periodLabel = filter === 'today' ? 'Hari Ini' : (filter === 'week' ? '7 Hari Terakhir' : (filter === 'month' ? '30 Hari Terakhir' : startDate + " s/d " + endDate));
        
        var reportData = {
            receiptHeader: storeSettings && storeSettings.receipt_header,
            address: storeSettings && storeSettings.address,
            phone: storeSettings && storeSettings.phone,
            dateRange: periodLabel,
            totalOrders: stats.totalSales,
            totalSales: stats.totalOmzet,
            productSummary: globalTopProducts.map(function(p) {
                return { name: p.name, quantity: p.qty, amount: 0 };
            }),
            generatedBy: isAdmin ? 'Admin' : 'Kasir',
            receipt_paper_width: (storeSettings && storeSettings.receipt_paper_width) || '58mm'
        };

        return PrinterManager.printSalesReport(reportData)['catch'](function(error) {
            Alert.alert('Error', 'Gagal mencetak laporan');
        });
    };

    var formatCurrency = function(value, decimals) {
        if (value === undefined || value === null) return 'Rp 0';
        var num = Number(value);
        var dec = (typeof decimals === 'number') ? decimals : 0;
        var parts = num.toFixed(dec).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return 'Rp ' + (dec > 0 ? parts.join(',') : parts[0]);
    };

    var StatCard = function(props) {
        var title = props.title;
        var value = props.value;
        var IconComp = props.icon;
        var color = props.color;
        var subValue = props.subValue;
        
        return React.createElement(View, { style: styles.statCard },
            React.createElement(View, { style: [styles.statIconContainer, { backgroundColor: color + '15' }] },
                React.createElement(IconComp, { size: 18, color: color })
            ),
            React.createElement(View, { style: { flex: 1, marginLeft: 10 } },
                React.createElement(Text, { style: styles.statLabel }, title),
                React.createElement(Text, { style: styles.statValue }, value),
                subValue ? React.createElement(Text, { style: styles.statSub }, subValue) : null
            )
        );
    };

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(View, { style: styles.header },
            React.createElement(TouchableOpacity, { onPress: function() { navigation.goBack(); }, style: styles.backButton },
                React.createElement(ChevronLeft, { size: 28, color: "#1f2937" })
            ),
            React.createElement(View, null,
                React.createElement(Text, { style: styles.headerTitle }, "Laporan Penjualan"),
                React.createElement(Text, { style: { fontSize: 12, color: '#64748b' } }, branchName)
            ),
            React.createElement(TouchableOpacity, { onPress: handlePrintSummary, style: { marginLeft: 'auto', padding: 8 } },
                React.createElement(Printer, { size: 24, color: "#ea580c" })
            )
        ),
        React.createElement(ScrollView, { contentContainerStyle: styles.scrollContent, showsVerticalScrollIndicator: false },
            React.createElement(View, { style: styles.filterContainer },
                ['today', 'week', 'month', 'custom'].map(function(f) {
                    return React.createElement(TouchableOpacity, {
                        key: f,
                        style: [styles.filterTab, filter === f && styles.filterTabActive],
                        onPress: function() { if (f === 'custom') setShowDateRangeModal(true); else setFilter(f); }
                    }, React.createElement(Text, { style: [styles.filterTabText, filter === f && styles.filterTabTextActive] },
                        f === 'today' ? 'Hari Ini' : (f === 'week' ? '7 Hari' : (f === 'month' ? '30 Hari' : 'Rentang'))
                    ));
                })
            ),
            (loading || sessionLoading) ? React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 } },
                React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" }),
                React.createElement(Text, { style: { marginTop: 12, color: '#64748b' } }, "Memuat Laporan...")
            ) : React.createElement(React.Fragment, null,
                React.createElement(View, { style: styles.gridRow },
                    React.createElement(StatCard, { title: "Total Omzet", value: formatCurrency(stats.totalOmzet, 0), icon: TrendingUp, color: "#22c55e" }),
                    React.createElement(StatCard, { title: "Transaksi", value: stats.totalSales, icon: ShoppingCart, color: "#a855f7" })
                ),
                React.createElement(View, { style: styles.gridRow },
                    React.createElement(StatCard, { title: "Rata-rata Order", value: formatCurrency(stats.avgTicket, 2), icon: TrendingUp, color: "#f59e0b" }),
                    React.createElement(StatCard, { title: "Potongan", value: formatCurrency(stats.totalDiscount, 0), icon: Wallet, color: "#ef4444" })
                ),
                React.createElement(View, { style: styles.section },
                    React.createElement(View, { style: styles.sectionHeader },
                        React.createElement(Wallet, { size: 18, color: "#64748b" }),
                        React.createElement(Text, { style: styles.sectionTitle }, "Metode Pembayaran")
                    ),
                    React.createElement(View, { style: styles.card },
                        paymentBreakdown.length === 0 ? React.createElement(Text, { style: styles.emptyText }, "Tidak ada data pembayaran") :
                        paymentBreakdown.map(function(item, idx) {
                            return React.createElement(View, { key: 'pay-' + idx, style: [styles.listItem, idx === paymentBreakdown.length - 1 && { borderBottomWidth: 0 }] },
                                React.createElement(Text, { style: styles.listItemName }, item.method),
                                React.createElement(Text, { style: styles.catValue }, formatCurrency(item.amount, 0))
                            );
                        })
                    )
                ),
                React.createElement(View, { style: styles.section },
                    React.createElement(View, { style: styles.sectionHeader },
                        React.createElement(Award, { size: 18, color: "#ea580c" }),
                        React.createElement(Text, { style: styles.sectionTitle }, productSearch.trim() !== '' ? 'Hasil Pencarian Produk' : 'Penjualan Per Produk')
                    ),
                    React.createElement(View, { style: styles.searchBarContainer },
                        React.createElement(Search, { size: 18, color: "#94a3b8", style: { marginLeft: 12 } }),
                        React.createElement(TextInput, {
                            placeholder: "Cari produk terjual...",
                            value: productSearch,
                            onChangeText: setProductSearch,
                            style: styles.searchPromptInput,
                            placeholderTextColor: "#94a3b8"
                        }),
                        productSearch.length > 0 ? React.createElement(TouchableOpacity, { onPress: function() { setProductSearch(''); }, style: { padding: 8 } },
                            React.createElement(Text, { style: { color: '#94a3b8', fontSize: 12 } }, "Batal")
                        ) : null
                    ),
                    React.createElement(RN.ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { marginBottom: 12, paddingHorizontal: 4 } },
                        ['Semua'].concat(categoryBreakdown.map(function(c) { return c.name; })).map(function(cat) {
                            var isActive = selectedCategory === cat;
                            return React.createElement(TouchableOpacity, {
                                key: 'cat-chip-' + cat,
                                onPress: function() { setSelectedCategory(cat); },
                                style: [styles.catChip, isActive && styles.catChipActive]
                            },
                                React.createElement(Text, { style: [styles.catChipText, isActive && styles.catChipTextActive] }, cat)
                            );
                        })
                    ),
                    React.createElement(View, { style: styles.card },
                        (function() {
                            var filtered = allProducts.filter(function(p) {
                                var matchesSearch = (p.name || '').toLowerCase().indexOf(productSearch.toLowerCase()) !== -1;
                                var matchesCat = selectedCategory === 'Semua' || p.category === selectedCategory;
                                return matchesSearch && matchesCat;
                            }).sort(function(a, b) {
                                return sortBy === 'qty' ? b.qty - a.qty : b.revenue - a.revenue;
                            });

                            if (filtered.length === 0) return React.createElement(Text, { style: styles.emptyText }, "Produk tidak ditemukan");

                            // IF "Semua" is selected, show a flat ranked list
                            if (selectedCategory === 'Semua') {
                                return filtered.map(function(item, idx) {
                                    return React.createElement(View, { key: 'top-' + idx, style: [styles.listItem, idx === filtered.length - 1 && { borderBottomWidth: 0 }] },
                                        React.createElement(View, { style: styles.rankBadge },
                                            React.createElement(Text, { style: styles.rankText }, idx + 1)
                                        ),
                                        React.createElement(View, { style: { flex: 1 } },
                                            React.createElement(Text, { style: styles.listItemName }, item.name),
                                            React.createElement(Text, { style: styles.itemSubText }, item.category + " \u2022 " + formatCurrency(item.revenue, 0))
                                        ),
                                        React.createElement(Text, { style: styles.listItemQty }, item.qty + " Pcs")
                                    );
                                });
                            }

                            // Group by category for specific selections
                            var groups = {};
                            filtered.forEach(function(p) {
                                if (!groups[p.category]) groups[p.category] = [];
                                groups[p.category].push(p);
                            });

                            var catList = Object.keys(groups).sort();
                            var elements = [];

                            catList.forEach(function(cat, cIdx) {
                                elements.push(
                                    React.createElement(View, { key: 'cat-h-' + cIdx, style: styles.catGroupHeader },
                                        React.createElement(Text, { style: styles.catGroupTitle }, cat)
                                    )
                                );
                                
                                groups[cat].forEach(function(item, pIdx) {
                                    elements.push(
                                        React.createElement(View, { key: 'p-' + cat + '-' + pIdx, style: [styles.listItem, pIdx === groups[cat].length - 1 && cIdx === catList.length - 1 && { borderBottomWidth: 0 }] },
                                            React.createElement(View, { style: { flex: 1 } },
                                                React.createElement(Text, { style: styles.listItemName }, item.name),
                                                React.createElement(Text, { style: styles.itemSubText }, formatCurrency(item.revenue, 0))
                                            ),
                                            React.createElement(Text, { style: styles.listItemQty }, item.qty + " Pcs")
                                        )
                                    );
                                });
                            });

                            return elements;
                        })()
                    )
                ),
                React.createElement(View, { style: styles.section },
                    React.createElement(View, { style: styles.sectionHeader },
                        React.createElement(BarChart3, { size: 18, color: "#64748b" }),
                        React.createElement(Text, { style: styles.sectionTitle }, "Distribusi Per Kategori")
                    ),
                    React.createElement(View, { style: styles.card },
                        categoryBreakdown.length === 0 ? React.createElement(Text, { style: styles.emptyText }, "Tidak ada data kategori") :
                        categoryBreakdown.map(function(item, idx) {
                            var percentage = stats.totalOmzet > 0 ? (item.revenue / stats.totalOmzet) : 0;
                            return React.createElement(View, { key: 'cat-' + idx, style: { padding: 12, borderBottomWidth: idx === categoryBreakdown.length - 1 ? 0 : 1, borderBottomColor: '#f8fafc' } },
                                React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 } },
                                    React.createElement(Text, { style: styles.catName }, item.name),
                                    React.createElement(Text, { style: styles.catValue }, formatCurrency(item.revenue, 0))
                                ),
                                React.createElement(View, { style: styles.progressBarBg },
                                    React.createElement(View, { style: [styles.progressBarFill, { width: (percentage * 100) + ("%" as any), backgroundColor: idx % 2 === 0 ? '#ea580c' : '#3b82f6' }] })
                                )
                            );
                        })
                    )
                )
            ),
            React.createElement(View, { style: { height: 40 } })
        ),
        React.createElement(Modal, {
            visible: showDateRangeModal,
            animationType: "slide",
            transparent: true,
            onRequestClose: function() { setShowDateRangeModal(false); }
        }, React.createElement(View, { style: styles.modalOverlay },
            React.createElement(View, { style: styles.modalContent },
                React.createElement(View, { style: styles.modalHeader },
                    React.createElement(Text, { style: styles.modalTitle }, "Pilih Rentang Tanggal"),
                    React.createElement(TouchableOpacity, { onPress: function() { setShowDateRangeModal(false); } },
                        React.createElement(Text, { style: styles.closeBtnText }, "Tutup")
                    )
                ),
                React.createElement(View, { style: { marginBottom: 20 } },
                    React.createElement(DateStepper, { label: "Tanggal Awal", value: startDate, onChange: setStartDate }),
                    React.createElement(DateStepper, { label: "Tanggal Akhir", value: endDate, onChange: setEndDate }),
                    React.createElement(TouchableOpacity, {
                        style: styles.payBtnLarge,
                        onPress: function() { setFilter('custom'); setShowDateRangeModal(false); }
                    }, React.createElement(Text, { style: styles.payBtnTextLarge }, "Terapkan Rentang"))
                )
            )
        ))
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fdfdfd' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4, marginRight: 8 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '85%', width: '100%', alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    closeBtnText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
    payBtnLarge: { backgroundColor: '#ea580c', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
    payBtnTextLarge: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    scrollContent: { padding: 16 },
    filterContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 14, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    filterTabActive: { backgroundColor: '#fff', elevation: 3 },
    filterTabText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
    filterTabTextActive: { color: '#ea580c' },
    gridRow: { flexDirection: 'row', marginBottom: 12 },
    statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#f1f5f9', elevation: 1, marginRight: 12 },
    statIconContainer: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    statLabel: { fontSize: 10, color: '#64748b', fontWeight: 'bold', letterSpacing: 0.3 },
    statValue: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginTop: 0 },
    statSub: { fontSize: 8, color: '#94a3b8', marginTop: 1 },
    section: { marginTop: 4, marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 4 },
    sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#f1f5f9', elevation: 1 },
    listItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    rankBadge: { width: 22, height: 22, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    rankText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
    listItemName: { flex: 1, fontSize: 13, color: '#0f172a', fontWeight: '600' },
    itemSubText: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
    listItemQty: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    catName: { fontSize: 12, color: '#334155', fontWeight: 'bold' },
    catValue: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    progressBarBg: { height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 2 },
    emptyText: { textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12 },
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, marginBottom: 12, marginHorizontal: 4, borderWidth: 1, borderColor: '#e2e8f0' },
    searchPromptInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, color: '#0f172a' },
    catGroupHeader: { backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    catGroupTitle: { fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
    catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    catChipActive: { backgroundColor: '#fff', borderColor: '#ea580c', elevation: 2 },
    catChipText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
    catChipTextActive: { color: '#ea580c' },
});
