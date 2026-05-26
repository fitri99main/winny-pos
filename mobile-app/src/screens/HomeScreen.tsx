import * as React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var StyleSheet = RN.StyleSheet;
var useWindowDimensions = RN.useWindowDimensions;
var TextInput = RN.TextInput;
var ActivityIndicator = RN.ActivityIndicator;
var Alert = RN.Alert;
var Modal = RN.Modal;
var Image = RN.Image;
var BackHandler = RN.BackHandler;
var Platform = RN.Platform;

import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
var useFocusEffect = NavNative.useFocusEffect;

import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;

import * as Lucide from 'lucide-react-native';
var User = Lucide.User;
var LayoutDashboard = Lucide.LayoutDashboard;
var ShoppingCart = Lucide.ShoppingCart;
var Package = Lucide.Package;
var History = Lucide.History;
var Wallet = Lucide.Wallet;
var Settings = Lucide.Settings;
var LogOut = Lucide.LogOut;
var BarChart3 = Lucide.BarChart3;
var Clock = Lucide.Clock;
var ChevronRight = Lucide.ChevronRight;
var Store = Lucide.Store;
var ChefHat = Lucide.ChefHat;
var Coffee = Lucide.Coffee;
var Users = Lucide.Users;
var Wifi = Lucide.Wifi;
var WifiOff = Lucide.WifiOff;

import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';

import * as OfflineLib from '../lib/OfflineService';
var OfflineService = OfflineLib.OfflineService;
import * as WifiLib from '../lib/WifiVoucherService';
var WifiVoucherService = WifiLib.WifiVoucherService;

import CashierSessionModal from '../components/CashierSessionModal';
import ConfirmExitModal from '../components/ConfirmExitModal';
import ModernToast from '../components/ModernToast';
var logoImg = require('../../assets/logo.png');
var winnyLogo = require('../../assets/winny-bg.jpg');

function formatCurrency(value, decimals) {
    if (value === undefined || value === null) return 'Rp 0';
    var num = Number(value);
    var dec = (typeof decimals === 'number') ? decimals : 0;
    var parts = num.toFixed(dec).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return 'Rp ' + (dec > 0 ? parts.join(',') : parts[0]);
}

function formatCompactCurrency(value) {
    var num = Number(value) || 0;
    if (num >= 1000000000) return 'Rp ' + (num / 1000000000).toFixed(1).replace('.0', '') + 'M';
    if (num >= 1000000) return 'Rp ' + (num / 1000000).toFixed(1).replace('.0', '') + 'jt';
    if (num >= 1000) return 'Rp ' + Math.round(num / 1000) + 'rb';
    return 'Rp ' + Math.round(num);
}

function formatHourLabel(hour) {
    var h = String(hour);
    if (h.length < 2) h = '0' + h;
    return h + ':00';
}

function toLocalDateKey(value) {
    var d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return y + '-' + m + '-' + day;
}

function shadeColor(color, percent) {
    var R = parseInt(color.substring(1,3), 16);
    var G = parseInt(color.substring(3,5), 16);
    var B = parseInt(color.substring(5,7), 16);
    R = Math.floor(R * (100 + percent) / 100);
    G = Math.floor(G * (100 + percent) / 100);
    B = Math.floor(B * (100 + percent) / 100);
    R = (R < 255) ? R : 255; G = (G < 255) ? G : 255; B = (B < 255) ? B : 255;
    var RR = ((R.toString(16).length == 1) ? "0" + R.toString(16) : R.toString(16));
    var GG = ((G.toString(16).length == 1) ? "0" + G.toString(16) : G.toString(16));
    var BB = ((B.toString(16).length == 1) ? "0" + B.toString(16) : B.toString(16));
    return "#" + RR + GG + BB;
}
function getGreeting() {
    var hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 19) return 'Selamat Sore';
    return 'Selamat Malam';
}

export default function HomeScreen() {
    var navigation = useNavigation();
    var dims = useWindowDimensions();
    var width = dims.width;
    
    var session = useSession();
    var isSessionActive = session.isSessionActive;
    var requireMandatorySession = session.requireMandatorySession;
    var checkSession = session.checkSession;
    var currentSession = session.currentSession;
    var branchName = session.branchName;
    var userName = session.userName;
    var currentBranchId = session.currentBranchId;
    var isAdmin = session.isAdmin;
    var storeSettings = session.storeSettings;
    var isDisplayOnly = session.isDisplayOnly;
    var role = session.role;

    var stateTodayStats = React.useState({ revenue: 0, count: 0, average: 0 });
    var todayStats = stateTodayStats[0];
    var setTodayStats = stateTodayStats[1];

    var stateVoucherStats = React.useState({ total: 0, used: 0, available: 0 });
    var voucherStats = stateVoucherStats[0];
    var setVoucherStats = stateVoucherStats[1];

    var stateActiveCashiers = React.useState({ count: 0, names: '' });
    var activeCashiers = stateActiveCashiers[0];
    var setActiveCashiers = stateActiveCashiers[1];

    var stateWeeklySales = React.useState([] as any[]);
    var weeklySales = stateWeeklySales[0];
    var setWeeklySales = stateWeeklySales[1];

    var stateWeeklySales = React.useState([] as any[]);
    var weeklySales = stateWeeklySales[0];
    var setWeeklySales = stateWeeklySales[1];

    var stateChartFilter = React.useState('today');
    var chartFilter = stateChartFilter[0];
    var setChartFilter = stateChartFilter[1];

    var stateBestSellers = React.useState([] as any[]);
    var bestSellers = stateBestSellers[0];
    var setBestSellers = stateBestSellers[1];

    var stateIsOnline = React.useState(true);
    var isOnline = stateIsOnline[0];
    var setIsOnline = stateIsOnline[1];

    var stateShowExitModal = React.useState(false);
    var showExitModal = stateShowExitModal[0];
    var setShowExitModal = stateShowExitModal[1];

    var stateShowLogoutModal = React.useState(false);
    var showLogoutModal = stateShowLogoutModal[0];
    var setShowLogoutModal = stateShowLogoutModal[1];

    var stateToastVisible = React.useState(false);
    var toastVisible = stateToastVisible[0];
    var setToastVisible = stateToastVisible[1];
    var stateToastMessage = React.useState('');
    var toastMessage = stateToastMessage[0];
    var setToastMessage = stateToastMessage[1];
    var stateToastType = React.useState('success');
    var toastType = stateToastType[0];
    var setToastType = stateToastType[1];

    var showToast = function(msg, type) {
        setToastMessage(msg); setToastType(type || 'success'); setToastVisible(true);
    };

    var PAID_STATUSES = ['Paid', 'Completed', 'Selesai', 'Settlement', 'Served', 'Capture', 'Success', 'Ready'];

    var fetchStats = function() {
        if (!currentBranchId) return;
        
        // Basic Today stats for non-admins or as fallback
        var start = new Date();
        start.setHours(0,0,0,0);
        
        if (!isAdmin) {
            supabase.from('sales')
                .select('id, total_amount, date')
                .eq('branch_id', currentBranchId)
                .in('status', PAID_STATUSES)
                .gte('date', start.toISOString())
                .then(function(res) {
                    if (res.data) {
                        var total = 0;
                        for (var i = 0; i < res.data.length; i++) total += (res.data[i].total_amount || 0);
                        var avg = res.data.length > 0 ? total / res.data.length : 0;
                        setTodayStats({ revenue: total, count: res.data.length, average: avg });
                    }
                })['catch'](function(e) {});
        }
            
        WifiVoucherService.getCounts(currentBranchId).then(setVoucherStats);

        supabase.from('cashier_sessions')
            .select('employee_name')
            .eq('branch_id', currentBranchId)
            .is('closed_at', null)
            .then(function(res) {
                if (res.data) {
                    var names = res.data.map(function(s) { return s.employee_name; }).join(', ');
                    setActiveCashiers({ count: res.data.length, names: names });
                }
            })['catch'](function(err) { console.error('Error fetching active cashiers:', err); });

        if (isAdmin) {
            var chartStart = new Date();
            var chartEnd = new Date();
            var days = 0;
            if (chartFilter === 'today') {
                chartStart.setHours(0,0,0,0);
            } else if (chartFilter === '30d') {
                chartStart.setDate(chartStart.getDate() - 29);
                chartStart.setHours(0,0,0,0);
                days = 30;
            } else {
                chartStart.setDate(chartStart.getDate() - 6);
                chartStart.setHours(0,0,0,0);
                days = 7;
            }
            
            var salesPageSize = 1000;
            var fetchSalesPage = function(fromIdx, acc) {
                return supabase.from('sales')
                    .select('total_amount, date, status')
                    .eq('branch_id', currentBranchId)
                    .in('status', PAID_STATUSES)
                    .gte('date', chartStart.toISOString())
                    .lte('date', chartEnd.toISOString())
                    .order('date', { ascending: false })
                    .range(fromIdx, fromIdx + salesPageSize - 1)
                    .then(function(res) {
                        if (res && res.error) throw res.error;
                        var rows = (res && res.data) || [];
                        var merged = acc.concat(rows);
                        if (rows.length === salesPageSize) {
                            return fetchSalesPage(fromIdx + salesPageSize, merged);
                        }
                        return merged;
                    });
            };

            fetchSalesPage(0, []).then(function(salesRows) {
                var totalRevenue = 0;
                var totalCount = salesRows.length;
                var groups = {};

                if (chartFilter === 'today') {
                    for (var h = 0; h < 24; h += 2) {
                        var label = formatHourLabel(h);
                        groups[h] = { label: label, value: 0, sortKey: h };
                    }
                    salesRows.forEach(function(s) {
                        totalRevenue += (s.total_amount || 0);
                        var hour = new Date(s.date).getHours();
                        var bucket = Math.floor(hour / 2) * 2;
                        if (groups[bucket]) groups[bucket].value += s.total_amount;
                    });
                } else {
                    for (var i = 0; i < days; i++) {
                        var d = new Date(chartStart);
                        d.setDate(d.getDate() + i);
                        var dStr = toLocalDateKey(d);
                        var dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
                        var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                        var labelStr = dayNames[d.getDay()] + ', ' + d.getDate() + ' ' + monthNames[d.getMonth()];

                        groups[dStr] = {
                            label: labelStr,
                            date: dStr,
                            value: 0,
                            sortKey: i
                        };
                    }

                    salesRows.forEach(function(s) {
                        totalRevenue += (s.total_amount || 0);
                        var ds = toLocalDateKey(s.date);
                        if (groups[ds]) groups[ds].value += s.total_amount;
                    });
                }

                var finalAvg = totalCount > 0 ? totalRevenue / totalCount : 0;
                setTodayStats({ revenue: totalRevenue, count: totalCount, average: finalAvg });

                var sorted = Object.keys(groups).sort(function(a, b) {
                    return groups[a].sortKey - groups[b].sortKey;
                }).map(function(k) { return groups[k]; });
                setWeeklySales(sorted);
            })['catch'](function() {});

            // Best Sellers Optimization
            var productToCategoryMap = {};
            
            // Fetch category mapping first to avoid heavy joins
            supabase.from('products').select('id, category').then(function(pRes) {
                if (pRes.data) {
                    pRes.data.forEach(function(p) { productToCategoryMap[p.id] = p.category; });
                }
                
                var saleItemsPageSize = 1000;
                var fetchSaleItemsPage = function(fromIdx, acc) {
                    return supabase.from('sale_items')
                        .select('product_name, quantity, product_id, sales!inner(branch_id, date, status)')
                        .eq('sales.branch_id', currentBranchId)
                        .in('sales.status', PAID_STATUSES)
                        .gte('sales.date', chartStart.toISOString())
                        .lte('sales.date', chartEnd.toISOString())
                        .order('id', { ascending: true })
                        .range(fromIdx, fromIdx + saleItemsPageSize - 1)
                        .then(function(res) {
                            if (res && res.error) throw res.error;
                            var rows = (res && res.data) || [];
                            var merged = acc.concat(rows);
                            if (rows.length === saleItemsPageSize) {
                                return fetchSaleItemsPage(fromIdx + saleItemsPageSize, merged);
                            }
                            return merged;
                        });
                };

                return fetchSaleItemsPage(0, []);
            }).then(function(items: any) {
                if (items) {
                    var pMap = {};
                    items.forEach(function(item) {
                        var n = item.product_name || 'Produk';
                        var cat = productToCategoryMap[item.product_id] || '';
                        if (!pMap[n]) pMap[n] = { qty: 0, cat: cat };
                        pMap[n].qty += (item.quantity || 0);
                    });
                    var sortedP = Object.keys(pMap).map(function(k) {
                        return { name: k, qty: pMap[k].qty, category: pMap[k].cat };
                    }).sort(function(a,b) { return b.qty - a.qty; }).slice(0, 5); // Show top 5
                    setBestSellers(sortedP);
                }
            })['catch'](function(err) { console.error('Error fetching best sellers:', err); });
        }
    };

    var checkConnectivity = function(showMsg) {
        return OfflineService.checkConnectivity().then(function(online) {
            setIsOnline(online);
            if (showMsg === true) {
                showToast(online ? 'Aplikasi Online' : 'Aplikasi Offline (Mode Lokal)', online ? 'success' : 'error');
            }
        });
    };

    useFocusEffect(React.useCallback(function() {
        fetchStats();
        checkConnectivity(false);
        
        var interval = setInterval(function() { checkConnectivity(false); }, 10000);
        
        var onBack = function() {
            setShowExitModal(true);
            return true;
        };
        var sub = BackHandler.addEventListener('hardwareBackPress', onBack);
        return function() { 
            sub.remove();
            clearInterval(interval);
        };
    }, [currentBranchId, chartFilter]));
    
    // [AUTO-OPEN] Realtime listener untuk mendeteksi pesanan KIOSK/Self-Service masuk saat di Home
    React.useEffect(function() {
        if (!currentBranchId || isDisplayOnly || isAdmin) return;

        var channel = supabase
            .channel('orders_home_' + currentBranchId)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'sales', 
                filter: 'branch_id=eq.' + currentBranchId 
            }, function(payload) {
                var newOrder = payload.new;
                // Hanya otomatis buka jika statusnya Self-Service atau Pending (Kios)
                if (newOrder && (newOrder.status === 'Self-Service' || newOrder.status === 'Pending')) {
                    console.log('[HomeScreen] New remote order detected, auto-navigating to POS:', newOrder.id);
                    (navigation as any).navigate('POS', { orderId: newOrder.id });
                }
            })
            .subscribe();

        return function() {
            supabase.removeChannel(channel);
        };
    }, [currentBranchId, isDisplayOnly, isAdmin, navigation]);

    var handleLogout = function() {
        setShowLogoutModal(true);
    };

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(RN.StatusBar, { barStyle: "dark-content", backgroundColor: "white" }),
        
        // Watermark
        React.createElement(View, { style: styles.watermarkContainer, pointerEvents: 'none' },
            React.createElement(Image, { 
                source: winnyLogo, 
                style: styles.watermarkImage, 
                resizeMode: 'contain' 
            })
        ),

        // Compact Streamlined Header
        React.createElement(View, { style: styles.headerCompact },
            React.createElement(Image, { source: logoImg, style: styles.headerLogo, resizeMode: 'contain' }),
            React.createElement(View, { style: styles.headerRight },
                React.createElement(TouchableOpacity, { 
                    onPress: function() { checkConnectivity(true); },
                    style: [styles.statusIndicator, { backgroundColor: isOnline ? '#f0fdf4' : '#fff1f2' }]
                },
                    isOnline ? React.createElement(Wifi, { size: 14, color: "#22c55e" }) : React.createElement(WifiOff, { size: 14, color: "#ef4444" })
                ),
                React.createElement(View, { style: styles.headerTextGroup },
                    React.createElement(Text, { style: styles.branchName }, branchName || 'WINNY POS'),
                    React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                        React.createElement(Text, { style: styles.userName }, getGreeting() + ', ' + (userName || 'Staff')),
                        React.createElement(View, { style: [styles.roleBadge, { backgroundColor: isAdmin ? '#eff6ff' : '#f8fafc' }] },
                            React.createElement(Text, { style: [styles.roleText, { color: isAdmin ? '#2563eb' : '#64748b' }] }, isAdmin ? 'ADMIN' : 'KASIR')
                        )
                    )
                ),
                React.createElement(TouchableOpacity, { onPress: handleLogout, style: styles.logoutButtonSmall },
                    React.createElement(LogOut, { size: 16, color: "#ef4444" })
                )
            )
        ),

        React.createElement(ScrollView, { 
            style: styles.content, 
            contentContainerStyle: { paddingBottom: 20 },
            showsVerticalScrollIndicator: false
        },
            // Slim Shift Status (Hidden for Admins/Display)
            (!isAdmin && !isDisplayOnly) && React.createElement(TouchableOpacity, { 
                style: [styles.shiftBarSlim, { backgroundColor: isSessionActive ? '#f0fdf4' : '#fff1f2' }],
                onPress: function() { (navigation as any).navigate('Settings'); } 
            },
                React.createElement(View, { style: [styles.shiftDot, { backgroundColor: isSessionActive ? '#22c55e' : '#ef4444' }] }),
                React.createElement(Text, { style: [styles.shiftStatusText, { color: isSessionActive ? '#166534' : '#991b1b' }] }, 
                    isSessionActive ? ('Aktif: ' + (currentSession && currentSession.employee_name || userName)) : 'Shift Belum Dibuka'
                ),
                React.createElement(ChevronRight, { size: 14, color: isSessionActive ? '#166534' : '#991b1b' })
            ),

            // Section Header: Insights
            !isDisplayOnly && React.createElement(View, { style: styles.sectionHeader },
                React.createElement(Text, { style: styles.sectionTitle }, 
                    "Ringkasan (" + (chartFilter === 'today' ? 'Hari Ini' : chartFilter === '7d' ? '7 Hari' : '30 Hari') + ")"
                ),
                React.createElement(TouchableOpacity, { onPress: function() { fetchStats(); } },
                    React.createElement(Lucide.RefreshCw, { size: 14, color: '#94a3b8' })
                )
            ),

            // Simple & Attractive Statistics Row
            !isDisplayOnly && React.createElement(View, { style: styles.statsRowCompact },
                isAdmin && React.createElement(View, { style: [styles.statCardSimple, { borderLeftColor: '#ea580c' }] },
                    React.createElement(Text, { style: [styles.statLabelSimple, { color: '#ea580c' }] }, "Penjualan"),
                    React.createElement(Text, { style: styles.statValueSimple, numberOfLines: 1 }, formatCurrency(todayStats.revenue, 0).replace('Rp ', ''))
                ),
                React.createElement(View, { style: [styles.statCardSimple, { borderLeftColor: '#334155' }] },
                    React.createElement(Text, { style: [styles.statLabelSimple, { color: '#334155' }] }, "Transaksi"),
                    React.createElement(Text, { style: styles.statValueSimple }, todayStats.count)
                ),
                isAdmin && React.createElement(View, { style: [styles.statCardSimple, { borderLeftColor: '#0ea5e9' }] },
                    React.createElement(Text, { style: [styles.statLabelSimple, { color: '#0ea5e9' }] }, "Rata-rata"),
                    React.createElement(Text, { style: styles.statValueSimple, numberOfLines: 1 }, formatCurrency(todayStats.average, 2).replace('Rp ', ''))
                ),
                React.createElement(View, { style: [styles.statCardSimple, { borderLeftColor: '#8b5cf6' }] },
                    React.createElement(Text, { style: [styles.statLabelSimple, { color: '#8b5cf6' }] }, "Voucher"),
                    React.createElement(Text, { style: styles.statValueSimple }, voucherStats.available)
                ),
                isAdmin && React.createElement(View, { style: [styles.statCardSimple, { borderLeftColor: '#10b981' }] },
                    React.createElement(Text, { style: [styles.statLabelSimple, { color: '#10b981' }] }, "Kasir Aktif"),
                    React.createElement(Text, { style: styles.statValueSimple }, activeCashiers.count),
                    activeCashiers.names ? React.createElement(Text, { style: styles.statSubValue, numberOfLines: 1 }, activeCashiers.names) : null
                )
            ),




            // Section Header: Menu
            React.createElement(View, { style: [styles.sectionHeader, { marginTop: 24 }] },
                React.createElement(Text, { style: styles.sectionTitle }, "Menu Utama")
            ),

            // High-Density Menu Grid (Responsive columns)
            React.createElement(View, { style: styles.menuGridContainer },
                [
                    { id: 'pos', name: 'Kasir', img: 'https://img.icons8.com/3d-fluency/100/shopping-cart.png', icon: ShoppingCart, color: '#ff6b6b', route: 'POS' },
                    { id: 'kds', name: 'Monitor Pesanan', img: 'https://img.icons8.com/3d-fluency/100/restaurant.png', icon: ChefHat, color: '#fca311', route: 'KDS', params: { initialFilter: 'All' } },
                    { id: 'products', name: 'Produk', img: 'https://img.icons8.com/3d-fluency/100/package.png', icon: Package, color: '#4cc9f0', route: 'Products' },
                    { id: 'history', name: 'Riwayat', img: 'https://img.icons8.com/3d-fluency/100/clock.png', icon: History, color: '#7209b7', route: 'History' },
                    { id: 'accounting', name: 'Laporan', img: 'https://img.icons8.com/3d-fluency/100/combo-chart.png', icon: BarChart3, color: '#f72585', route: 'Accounting' },
                    { id: 'cash', name: 'Kas Kecil', img: 'https://img.icons8.com/3d-fluency/100/money-bag.png', icon: Wallet, color: '#4361ee', route: 'PettyCash' },
                    { id: 'shifts', name: 'Shift', img: 'https://img.icons8.com/3d-fluency/100/conference-call.png', icon: Users, color: '#3a0ca3', route: 'CashierSessionHistory' },
                    { id: 'settings', name: 'Opsi', img: 'https://img.icons8.com/3d-fluency/100/control-panel.png', icon: Settings, color: '#4a4e69', route: 'Settings' }
                ].filter(function(item) {
                    // Filter untuk Mode Display (Self-Order)
                    if (isDisplayOnly) {
                        return item.id === 'pos'; // Hanya tampilkan menu Kasir (Katalog)
                    }

                    if (item.id === 'accounting') {
                        return isAdmin || (storeSettings && storeSettings.cashier_can_view_reports);
                    }
                    if (item.id === 'products') {
                        return role && role.toLowerCase() === 'administrator';
                    }
                    return true;
                }).map(function(item) {
                    var stateImgError = React.useState(false);
                    var imgError = stateImgError[0];
                    var setImgError = stateImgError[1];
                    return React.createElement(TouchableOpacity, { 
                        key: item.id, 
                        style: [styles.menuItemDense, { width: width > 600 ? '16.66%' : '25%' }],
                        onPress: function() { (navigation as any).navigate(item.route, item.params); }
                    },
                        React.createElement(View, { style: styles.menuIconCircle },
                            (!imgError) ? React.createElement(Image, { 
                                source: { uri: item.img }, 
                                style: { width: 56, height: 56 },
                                resizeMode: 'contain',
                                onError: function() { setImgError(true); }
                            }) : React.createElement(item.icon, { size: 32, color: item.color })
                        ),
                        React.createElement(Text, { style: styles.menuLabelDense }, item.name)
                    );
                })
            ),

            // Weekly Sales Curve Chart for Admins (Moved to bottom)
            isAdmin && weeklySales.length > 0 && React.createElement(View, { style: styles.chartCard },
                React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
                    React.createElement(View, null,
                        React.createElement(Text, { style: [styles.chartTitle, { marginBottom: 2 }] }, "Analitik Penjualan"),
                        React.createElement(Text, { style: { fontSize: 7, color: '#94a3b8', fontWeight: '600' } }, "Terakhir diperbarui: " + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
                    ),
                    React.createElement(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false },
                        [
                            { id: 'today', label: 'Hari Ini' },
                            { id: '7d', label: '7 Hari' },
                            { id: '30d', label: '30 Hari' }
                        ].map(function(f) {
                            return React.createElement(TouchableOpacity, { 
                                key: f.id, 
                                onPress: function() { setChartFilter(f.id); },
                                style: [styles.miniFilterChip, chartFilter === f.id && styles.miniFilterChipActive]
                            },
                                React.createElement(Text, { style: [styles.miniFilterChipText, chartFilter === f.id && styles.miniFilterChipTextActive] }, f.label)
                            );
                        })
                    )
                ),
                React.createElement(View, { style: styles.chartBody },
                    React.createElement(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { marginTop: 12 }, contentContainerStyle: { paddingRight: 8 } },
                    (weeklySales && weeklySales.length > 0) ? (function() {
                        var baseWidth = width - 64;
                        var chartWidth = chartFilter === 'today'
                            ? Math.max(baseWidth, weeklySales.length * 44)
                            : (chartFilter === '30d' ? Math.max(800, weeklySales.length * 40) : baseWidth);
                        var chartHeight = 150;
                        
                        var maxV = 1;
                        for (var i = 0; i < weeklySales.length; i++) {
                            if (weeklySales[i].value > maxV) maxV = weeklySales[i].value;
                        }

                        var yAxisValues = [1, 0.75, 0.5, 0.25, 0].map(function(ratio) {
                            return Math.round(maxV * ratio);
                        });
                        
                        var points = weeklySales.map(function(day, i) {
                            var x = (i / (weeklySales.length - 1 || 1)) * chartWidth;
                            var y = chartHeight - (Math.max(5, (day.value / maxV) * chartHeight));
                            return { x: x, y: y };
                        });

                        var dPath = points.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p.x + ',' + p.y; }).join('');
                        var aPath = dPath + 'L' + chartWidth + ',' + chartHeight + 'L0,' + chartHeight + 'Z';

                        return React.createElement(View, { style: styles.chartFrame },
                            React.createElement(View, { style: styles.yAxisColumn },
                                yAxisValues.map(function(value, idx) {
                                    return React.createElement(Text, { key: idx, style: styles.yAxisLabel }, formatCompactCurrency(value));
                                })
                            ),
                            React.createElement(View, { style: { width: chartWidth } },
                            React.createElement(Svg, { width: chartWidth, height: chartHeight },
                                React.createElement(Defs, null,
                                    React.createElement(LinearGradient, { id: "grad", x1: "0", y1: "0", x2: "0", y2: "1" },
                                        React.createElement(Stop, { offset: "0", stopColor: "#ea580c", stopOpacity: "0.2" }),
                                        React.createElement(Stop, { offset: "1", stopColor: "#ea580c", stopOpacity: "0" })
                                    )
                                ),
                                yAxisValues.map(function(value, idx) {
                                    var yLine = idx === yAxisValues.length - 1
                                        ? chartHeight - 1
                                        : Math.max(0, (chartHeight / (yAxisValues.length - 1)) * idx);
                                    return React.createElement(Line, {
                                        key: 'grid-' + idx,
                                        x1: "0",
                                        y1: String(yLine),
                                        x2: String(chartWidth),
                                        y2: String(yLine),
                                        stroke: "#e2e8f0",
                                        strokeWidth: "1",
                                        strokeDasharray: idx === yAxisValues.length - 1 ? undefined : "4 4"
                                    });
                                }),
                                React.createElement(Path, { d: aPath, fill: "url(#grad)" }),
                                React.createElement(Path, { d: dPath, fill: "none", stroke: "#ea580c", strokeWidth: "3" })
                            ),
                            React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 } },
                                weeklySales.map(function(day, idx) {
                                    var showLabel = true;
                                    if (chartFilter === '30d') showLabel = (idx % 3 === 0 || idx === weeklySales.length - 1);
                                    if (chartFilter === '7d') showLabel = true;
                                    return React.createElement(View, { key: idx, style: { width: chartWidth / (weeklySales.length - 1 || 1), alignItems: 'center' } },
                                        showLabel ? React.createElement(Text, {
                                            style: [
                                                styles.barLabel,
                                                { textAlign: 'center' },
                                                chartFilter === 'today' ? styles.barLabelHour : styles.barLabelDate
                                            ]
                                        }, day.label) : null
                                    );
                                })
                            )
                            )
                        );
                    })() : React.createElement(View, { style: { height: 140, justifyContent: 'center', alignItems: 'center', width: width - 64 } },
                        React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8' } }, "Belum ada data")
                    )
                    )
                ),
                bestSellers.length > 0 && React.createElement(View, { style: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 } },
                        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 } },
                            React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                                React.createElement(Lucide.Award, { size: 16, color: '#ea580c', style: { marginRight: 8 } }),
                                React.createElement(Text, { style: { fontSize: 12, fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 } }, "5 Produk Terlaris")
                            ),
                            React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8' } }, "Berdasarkan Qty")
                        ),
                        React.createElement(View, null,
                            bestSellers.map(function(p, idx) {
                                var maxQty = bestSellers[0].qty || 1;
                                var barWidth = (p.qty / maxQty) * 100;
                                return React.createElement(View, { key: idx, style: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 } },
                                    React.createElement(Text, { style: { width: 14, fontSize: 10, fontWeight: 'bold', color: '#94a3b8' } }, idx + 1),
                                    React.createElement(View, { style: { flex: 2, marginRight: 8 } },
                                        React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', color: '#1e293b' }, numberOfLines: 1 }, p.name)
                                    ),
                                    React.createElement(View, { style: { flex: 3, height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, marginRight: 8, overflow: 'hidden' } },
                                        React.createElement(View, { style: { width: barWidth + '%', height: '100%', backgroundColor: idx === 0 ? '#ea580c' : '#fdba74' } })
                                    ),
                                    React.createElement(Text, { style: { width: 40, fontSize: 10, fontWeight: '900', color: '#ea580c', textAlign: 'right' } }, p.qty)
                                );
                            })
                        )
                    )
            ),
        ),

        // Modals & Toast
        React.createElement(ConfirmExitModal, { 
            visible: showExitModal, 
            onClose: function() { setShowExitModal(false); }, 
            onConfirm: function() { BackHandler.exitApp(); }, 
            title: "Keluar?", 
            message: "Tutup aplikasi?", 
            confirmText: "Ya", 
            iconType: "alert" 
        }),
        React.createElement(ConfirmExitModal, { 
            visible: showLogoutModal, 
            onClose: function() { setShowLogoutModal(false); }, 
            onConfirm: function() { supabase.auth.signOut(); }, 
            title: "Logout?", 
            message: "Keluar dari akun?", 
            confirmText: "Logout", 
            iconType: "logout" 
        }),
        React.createElement(ModernToast, { 
            visible: toastVisible, 
            message: toastMessage, 
            type: toastType, 
            onHide: function() { setToastVisible(false); } 
        })
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    watermarkContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: -1,
        opacity: 0.05,
    },
    watermarkImage: {
        width: '80%',
        height: '80%',
    },
    headerCompact: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerLogo: { width: 80, height: 24 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    statusIndicator: { padding: 6, borderRadius: 8, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
    headerTextGroup: { alignItems: 'flex-end', marginRight: 12 },
    branchName: { fontSize: 9, fontWeight: 'bold', color: '#ea580c', textTransform: 'uppercase' },
    userName: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },
    roleBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    roleText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
    logoutButtonSmall: { padding: 6, borderRadius: 8, backgroundColor: '#fef2f2' },
    content: { flex: 1 },
    shiftBarSlim: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    shiftDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
    shiftStatusText: { fontSize: 13, fontWeight: 'bold', flex: 1 },
    statsRowCompact: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        marginTop: 12,
        justifyContent: 'space-between',
    },
    statCardSimple: {
        flex: 1,
        marginHorizontal: 2,
        paddingVertical: 10,
        paddingHorizontal: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 10,
        borderLeftWidth: 3,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    statLabelSimple: { fontSize: 7, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
    statValueSimple: { fontSize: 11, fontWeight: 'bold', color: '#1e293b' },
    statSubValue: { fontSize: 10, color: '#1e293b', marginTop: 2, fontWeight: 'bold' },
    voucherCardContainer: { paddingHorizontal: 16, marginTop: 16 },
    voucherCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        borderRadius: 16,
        padding: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    voucherIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#f0f9ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    voucherTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    voucherSubtitle: { fontSize: 10, color: '#64748b' },
    voucherAvailableCount: { fontSize: 20, fontWeight: '900', color: '#0ea5e9' },
    progressBarBg: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#0ea5e9' },
    voucherProgressText: { fontSize: 9, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' },
    menuGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 8,
        marginTop: 15,
        justifyContent: 'flex-start'
    },
    menuItemDense: {
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 20,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    menuIconCircle: {
        width: 68,
        height: 68,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    menuLabelDense: {
        fontSize: 10,
        fontWeight: '700',
        color: '#334155',
        textAlign: 'center',
    },
    chartCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        marginHorizontal: 16,
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    chartTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    chartBody: {
        marginTop: 4,
    },
    chartFrame: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    yAxisColumn: {
        width: 58,
        height: 150,
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingRight: 8,
        paddingBottom: 2,
    },
    yAxisLabel: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '700',
    },
    chartArea: {
        height: 180,
        justifyContent: 'center',
        paddingTop: 30,
    },
    chartColumn: {
        flex: 1,
        alignItems: 'center',
    },
    barContainer: {
        flex: 1,
        width: 12,
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    barFill: {
        width: '100%',
        backgroundColor: '#94a3b8',
        borderRadius: 6,
    },
    barLabel: {
        fontSize: 8,
        color: '#64748b',
        marginTop: 8,
        fontWeight: '600'
    },
    barLabelHour: {
        fontSize: 8,
        minWidth: 32,
    },
    barLabelDate: {
        fontSize: 7,
        maxWidth: 52,
    },
    miniFilterChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        marginLeft: 6,
    },
    miniFilterChipActive: {
        backgroundColor: '#fff7ed',
        borderWidth: 1,
        borderColor: '#ea580c',
    },
    miniFilterChipText: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '600'
    },
    miniFilterChipTextActive: {
        color: '#ea580c',
        fontWeight: 'bold'
    },
    bestSellerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
    },
    bestSellerName: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    bestSellerQty: {
        fontSize: 12,
        fontWeight: '900',
        color: '#ea580c',
        marginLeft: 12,
    }
});
