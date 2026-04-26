import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, useWindowDimensions, FlatList, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { 
    BarChart3, 
    TrendingUp, 
    ShoppingCart, 
    Calendar, 
    ChevronRight, 
    ChevronLeft,
    Award,
    Clock,
    Wallet,
    Printer,
    Search,
    Info
} from 'lucide-react-native';
import { PrinterManager } from '../lib/PrinterManager';
import { useSession } from '../context/SessionContext';
import DateStepper from '../components/DateStepper';
import { getLocalDateString } from '../lib/dateUtils';


type FilterType = 'today' | 'week' | 'month' | 'custom';

export default function AccountingScreen() {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isSmallDevice = width < 380;
    const { isAdmin, storeSettings, currentBranchId, branchName, loading: sessionLoading } = useSession();
    
    useEffect(() => {
        if (!sessionLoading && !isAdmin && storeSettings && !storeSettings.cashier_can_view_reports) {
            Alert.alert('Akses Ditolak', 'Anda tidak memiliki izin untuk melihat laporan penjualan.');
            navigation.goBack();
        }
    }, [isAdmin, storeSettings, sessionLoading]);

    const [filter, setFilter] = useState<FilterType>('today');
    const [loading, setLoading] = useState(true);
    
    // Custom Date Range State
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [endDate, setEndDate] = useState(getLocalDateString());
    const [showDateRangeModal, setShowDateRangeModal] = useState(false);
    const [stats, setStats] = useState({
        totalOmzet: 0,
        totalSales: 0,
        avgTicket: 0,
        totalDiscount: 0,
        totalTax: 0,
        totalService: 0,
        estimatedProfit: 0
    });
    
    const [globalTopProducts, setGlobalTopProducts] = useState<any[]>([]);
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const [sortBy, setSortBy] = useState<'qty' | 'revenue'>('qty');
    const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
    const [paymentBreakdown, setPaymentBreakdown] = useState<any[]>([]);
    const [recentSales, setRecentSales] = useState<any[]>([]);

    useFocusEffect(
        useCallback(() => {
            if (currentBranchId) {
                fetchDashboardData();
            }
        }, [filter, startDate, endDate, currentBranchId])
    );

    const fetchDashboardData = async () => {
        const bId = currentBranchId;
        if (!bId) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const now = new Date();
            let startQueryDate = new Date();
            let endQueryDate: Date | null = null;
            
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
            let allSales: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            const PAID_STATUSES = ['Paid', 'Completed', 'Selesai', 'Settlement', 'Served', 'Capture', 'Success', 'Ready'];

            while (hasMore) {
                let query = supabase
                    .from('sales')
                    .select('*')
                    .eq('branch_id', bId)
                    .in('status', PAID_STATUSES)
                    .gte('date', startQueryDate.toISOString())
                    .order('date', { ascending: false })
                    .range(from, from + pageSize - 1);

                if (endQueryDate) {
                    query = query.lte('date', endQueryDate.toISOString());
                }

                const { data, error } = await query;
                if (error) throw error;
                
                if (data && data.length > 0) {
                    allSales = [...allSales, ...data];
                    if (data.length < pageSize) {
                        hasMore = false;
                    } else {
                        from += pageSize;
                    }
                } else {
                    hasMore = false;
                }
            }

            const sales = allSales;

            const totalOmzet = sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
            const totalDiscount = sales?.reduce((sum, s) => sum + (s.discount || 0), 0) || 0;
            const totalTax = sales?.reduce((sum, s) => sum + (s.tax || 0), 0) || 0;
            const totalService = sales?.reduce((sum, s) => sum + (s.service_charge || 0), 0) || 0;
            const totalSalesCount = sales?.length || 0;
            const avgTicket = totalSalesCount > 0 ? totalOmzet / totalSalesCount : 0;

            // Payment Breakdown
            const payments: Record<string, number> = {};
            sales?.forEach(s => {
                const method = s.payment_method || 'Tunai';
                payments[method] = (payments[method] || 0) + (s.total_amount || 0);
            });
            setPaymentBreakdown(Object.keys(payments).map(method => ({ method, amount: payments[method] })).sort((a,b) => b.amount - a.amount));

            setStats({
                totalOmzet,
                totalSales: totalSalesCount,
                avgTicket,
                totalDiscount,
                totalTax,
                totalService,
                estimatedProfit: 0 // Will update below
            });

            setRecentSales(sales?.slice(0, 5) || []);

            // 2. Fetch Detailed Items for Analytics with Pagination
            let allItems: any[] = [];
            let itemsFrom = 0;
            let itemsHasMore = true;

            while (itemsHasMore) {
                let itemsQuery = supabase
                    .from('sale_items')
                    .select(`
                        quantity,
                        product_name,
                        price,
                        cost,
                        product:product_id (category),
                        sale:sales!inner(date, branch_id, status)
                    `)
                    .eq('sale.branch_id', bId)
                    .in('sale.status', PAID_STATUSES)
                    .gte('sale.date', startQueryDate.toISOString())
                    .range(itemsFrom, itemsFrom + pageSize - 1);

                if (endQueryDate) {
                    itemsQuery = itemsQuery.lte('sale.date', endQueryDate.toISOString());
                }

                const { data: itemsPage, error: itemsError } = await itemsQuery;
                if (itemsError) throw itemsError;

                if (itemsPage && itemsPage.length > 0) {
                    allItems = [...allItems, ...itemsPage];
                    if (itemsPage.length < pageSize) {
                        itemsHasMore = false;
                    } else {
                        itemsFrom += pageSize;
                    }
                } else {
                    itemsHasMore = false;
                }
            }

            const items = allItems;

            // Process Analytics
            const productGroups: Record<string, { qty: number, revenue: number, cost: number }> = {};
            const catGroups: Record<string, { revenue: number, qty: number }> = {};
            let totalCost = 0;

            items?.forEach(item => {
                const name = item.product_name || 'Produk';
                const qty = item.quantity || 0;
                const price = item.price || 0;
                const cost = item.cost || 0;
                const category = (item.product as any)?.category || 'Lainnya';
                
                // Global Top Products
                if (!productGroups[name]) productGroups[name] = { qty: 0, revenue: 0, cost: 0, category: category };
                productGroups[name].qty += qty;
                productGroups[name].revenue += (price * qty);
                productGroups[name].cost += (cost * qty);
                
                // Category Breakdown
                if (!catGroups[category]) catGroups[category] = { revenue: 0, qty: 0 };
                catGroups[category].revenue += (price * qty);
                catGroups[category].qty += qty;
                
                totalCost += (cost * qty);
            });

            // Update Estimated Profit
            setStats(prev => ({ ...prev, estimatedProfit: prev.totalOmzet - totalCost }));

            // Sort and Set Results
            const allSold = Object.keys(productGroups)
                .map(name => ({ name, ...productGroups[name] }))
                .sort((a, b) => b.qty - a.qty);
            
            setAllProducts(allSold);
            setGlobalTopProducts(allSold.slice(0, 10));

            const categories = Object.keys(catGroups)
                .map(name => ({ name, ...catGroups[name] }))
                .sort((a, b) => b.revenue - a.revenue);
            setCategoryBreakdown(categories);

        } catch (error: any) {
            console.error('Fetch Dashboard Error:', error);
            Alert.alert('Error', 'Gagal memuat dashboard: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintSummary = async () => {
        try {
            const hasPermission = isAdmin || (storeSettings && storeSettings.cashier_can_print_sales_summary);
            if (!hasPermission) {
                Alert.alert('Akses Ditolak', 'Anda tidak memiliki izin untuk mencetak laporan penjualan.');
                return;
            }

            const periodLabel = filter === 'today' ? 'Hari Ini' : filter === 'week' ? '7 Hari Terakhir' : filter === 'month' ? '30 Hari Terakhir' : `${startDate} s/d ${endDate}`;
            
            // Collect all best sellers into one list for printing
            const allBestSellers = globalTopProducts;

            const reportData = {
                receiptHeader: storeSettings?.receipt_header,
                address: storeSettings?.address,
                phone: storeSettings?.phone,
                dateRange: periodLabel,
                totalOrders: stats.totalSales,
                totalSales: stats.totalOmzet,
                productSummary: allBestSellers.map(p => ({
                    name: p.name,
                    quantity: p.qty,
                    amount: 0 // We don't have individual amounts here, but qty is enough for summary
                })),
                generatedBy: isAdmin ? 'Admin' : 'Kasir',
                receipt_paper_width: storeSettings?.receipt_paper_width || '58mm'
            };

            await PrinterManager.printSalesReport(reportData);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Gagal mencetak laporan');
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', { 
            style: 'currency', 
            currency: 'IDR', 
            minimumFractionDigits: 0 
        }).format(value);
    };

    const StatCard = ({ title, value, icon: Icon, color, subValue }: any) => (
        <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
                <Icon size={18} color={color} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.statLabel}>{title}</Text>
                <Text style={styles.statValue}>{value}</Text>
                {subValue && <Text style={styles.statSub}>{subValue}</Text>}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={28} color="#1f2937" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Laporan Penjualan</Text>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>{branchName}</Text>
                </View>
                <TouchableOpacity 
                    onPress={handlePrintSummary} 
                    style={{ marginLeft: 'auto', padding: 8 }}
                >
                    <Printer size={24} color="#ea580c" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Filter Tabs */}
                <View style={styles.filterContainer}>
                    {(['today', 'week', 'month', 'custom'] as FilterType[]).map((f) => (
                        <TouchableOpacity 
                            key={f}
                            style={[styles.filterTab, filter === f && styles.filterTabActive]}
                            onPress={() => {
                                if (f === 'custom') {
                                    setShowDateRangeModal(true);
                                } else {
                                    setFilter(f);
                                }
                            }}
                        >
                            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                                {f === 'today' ? 'Hari Ini' : f === 'week' ? '7 Hari' : f === 'month' ? '30 Hari' : 'Rentang'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading || sessionLoading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
                        <ActivityIndicator size="large" color="#ea580c" />
                        <Text style={{ marginTop: 12, color: '#64748b' }}>Memuat Laporan...</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.gridRow}>
                            <StatCard 
                                title="Total Omzet" 
                                value={formatCurrency(stats.totalOmzet)} 
                                icon={TrendingUp} 
                                color="#22c55e" 
                            />
                            <StatCard 
                                title="Transaksi" 
                                value={stats.totalSales} 
                                icon={ShoppingCart} 
                                color="#a855f7" 
                            />
                        </View>

                        <View style={styles.gridRow}>
                            <StatCard 
                                title="Rata-rata Order" 
                                value={formatCurrency(stats.avgTicket)} 
                                icon={TrendingUp} 
                                color="#f59e0b" 
                            />
                            <StatCard 
                                title="Potongan" 
                                value={formatCurrency(stats.totalDiscount)} 
                                icon={Wallet} 
                                color="#ef4444" 
                            />
                        </View>

                        {/* Payment Breakdown */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Wallet size={18} color="#64748b" />
                                <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
                            </View>
                            <View style={styles.card}>
                                {paymentBreakdown.length === 0 ? (
                                    <Text style={styles.emptyText}>Tidak ada data pembayaran</Text>
                                ) : (
                                    paymentBreakdown.map((item, index) => (
                                        <View key={'payment-' + index} style={[styles.listItem, index === paymentBreakdown.length - 1 && { borderBottomWidth: 0 }]}>
                                            <Text style={styles.listItemName}>{item.method}</Text>
                                            <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
                                        </View>
                                    ))
                                )}
                            </View>
                        </View>

                        {/* Top Products Leaderboard */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Award size={18} color="#ea580c" />
                                <Text style={styles.sectionTitle}>
                                    {productSearch.trim() !== '' ? 'Hasil Pencarian Produk' : '10 Produk Terlaris (Global)'}
                                </Text>
                            </View>

                            {/* Product Search Bar */}
                            <View style={styles.searchBarContainer}>
                                <Search size={18} color="#94a3b8" style={{ marginLeft: 12 }} />
                                <TextInput
                                    placeholder="Cari produk terjual..."
                                    value={productSearch}
                                    onChangeText={setProductSearch}
                                    style={styles.searchPromptInput}
                                    placeholderTextColor="#94a3b8"
                                />
                                {productSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setProductSearch('')} style={{ padding: 8 }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>Batal</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Category Pills */}
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                style={styles.categoryPills}
                                contentContainerStyle={{ paddingHorizontal: 4 }}
                            >
                                <TouchableOpacity 
                                    style={[styles.pill, selectedCategory === 'Semua' && styles.pillActive]}
                                    onPress={() => setSelectedCategory('Semua')}
                                >
                                    <Text style={[styles.pillText, selectedCategory === 'Semua' && styles.pillTextActive]}>Semua</Text>
                                </TouchableOpacity>
                                {[...new Set(allProducts.map(p => p.category))].sort().map(cat => (
                                    <TouchableOpacity 
                                        key={cat}
                                        style={[styles.pill, selectedCategory === cat && styles.pillActive]}
                                        onPress={() => setSelectedCategory(cat)}
                                    >
                                        <Text style={[styles.pillText, selectedCategory === cat && styles.pillTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Sort Controls */}
                            <View style={styles.sortControls}>
                                <Text style={styles.sortTitle}>Urutkan:</Text>
                                <TouchableOpacity 
                                    style={[styles.sortBtn, sortBy === 'qty' && styles.sortBtnActive]}
                                    onPress={() => setSortBy('qty')}
                                >
                                    <Award size={12} color={sortBy === 'qty' ? '#ea580c' : '#94a3b8'} />
                                    <Text style={[styles.sortBtnText, sortBy === 'qty' && styles.sortBtnTextActive]}>Terlaris</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.sortBtn, sortBy === 'revenue' && styles.sortBtnActive]}
                                    onPress={() => setSortBy('revenue')}
                                >
                                    <Wallet size={12} color={sortBy === 'revenue' ? '#ea580c' : '#94a3b8'} />
                                    <Text style={[styles.sortBtnText, sortBy === 'revenue' && styles.sortBtnTextActive]}>Omzet</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.card}>
                                {(() => {
                                    const filtered = allProducts
                                        .filter(p => {
                                            const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
                                            const matchesCat = selectedCategory === 'Semua' || p.category === selectedCategory;
                                            return matchesSearch && matchesCat;
                                        })
                                        .sort((a, b) => sortBy === 'qty' ? b.qty - a.qty : b.revenue - a.revenue)
                                        .slice(0, 50);

                                    if (filtered.length === 0) {
                                        return <Text style={styles.emptyText}>Produk tidak ditemukan</Text>;
                                    }

                                    return filtered.map((item, index) => {
                                        const originalRank = allProducts.findIndex(p => p.name === item.name) + 1;
                                        return (
                                            <View key={'top-' + index} style={[styles.listItem, index === filtered.length - 1 && { borderBottomWidth: 0 }]}>
                                                <View style={[styles.rankBadge, originalRank === 1 && { backgroundColor: '#fef3c7' }]}>
                                                    <Text style={[styles.rankText, originalRank === 1 && { color: '#d97706' }]}>{originalRank}</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.listItemName} numberOfLines={1}>{item.name}</Text>
                                                    <Text style={styles.itemSubText}>{item.category} • {formatCurrency(item.revenue)}</Text>
                                                </View>
                                                <Text style={styles.listItemQty}>{item.qty} Pcs</Text>
                                            </View>
                                        );
                                    });
                                })()}
                            </View>
                            {productSearch.trim() !== '' && allProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).length > 50 && (
                                <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
                                    Menampilkan 50 hasil teratas
                                </Text>
                            )}
                        </View>

                        {/* Category Sales Distribution */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <BarChart3 size={18} color="#64748b" />
                                <Text style={styles.sectionTitle}>Distribusi Per Kategori</Text>
                            </View>
                            <View style={styles.card}>
                                {categoryBreakdown.length === 0 ? (
                                    <Text style={styles.emptyText}>Tidak ada data kategori</Text>
                                ) : (
                                    categoryBreakdown.map((item, index) => {
                                        const percentage = stats.totalOmzet > 0 ? (item.revenue / stats.totalOmzet) : 0;
                                        return (
                                            <View key={'cat-' + index} style={{ padding: 12, borderBottomWidth: index === categoryBreakdown.length - 1 ? 0 : 1, borderBottomColor: '#f8fafc' }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <Text style={styles.catName}>{item.name}</Text>
                                                    <Text style={styles.catValue}>{formatCurrency(item.revenue)}</Text>
                                                </View>
                                                <View style={styles.progressBarBg}>
                                                    <View style={[styles.progressBarFill, { width: `${percentage * 100}%`, backgroundColor: index % 2 === 0 ? '#ea580c' : '#3b82f6' }]} />
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        </View>

                        {/* Recent Transactions */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Clock size={18} color="#64748b" />
                                <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
                            </View>
                            <View style={styles.card}>
                                {recentSales.length === 0 ? (
                                    <Text style={styles.emptyText}>Belum ada transaksi</Text>
                                ) : (
                                    recentSales.map((sale, index) => (
                                        <TouchableOpacity 
                                            key={sale.id || index} 
                                            style={[styles.listItem, index === recentSales.length - 1 && { borderBottomWidth: 0 }]}
                                            onPress={() => navigation.navigate('History' as never)}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.orderNo}>#{sale.order_no}</Text>
                                                <Text style={styles.timeText}>{new Date(sale.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.amountText}>{formatCurrency(sale.total_amount)}</Text>
                                                <Text style={styles.methodTextSmall}>{sale.payment_method || 'Tunai'}</Text>
                                            </View>
                                            <ChevronRight size={16} color="#d1d5db" style={{ marginLeft: 8 }} />
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        </View>
                    </>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
                {/* Custom Date Range Modal */}
                <Modal
                    visible={showDateRangeModal}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowDateRangeModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Pilih Rentang Tanggal</Text>
                                <TouchableOpacity onPress={() => setShowDateRangeModal(false)}>
                                    <Text style={styles.closeBtnText}>Tutup</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ marginBottom: 20 }}>
                                <DateStepper 
                                    label="Tanggal Awal" 
                                    value={startDate} 
                                    onChange={setStartDate} 
                                />
                                <DateStepper 
                                    label="Tanggal Akhir" 
                                    value={endDate} 
                                    onChange={setEndDate} 
                                />
                                <TouchableOpacity
                                    style={styles.payBtnLarge}
                                    onPress={() => {
                                        setFilter('custom');
                                        setShowDateRangeModal(false);
                                    }}
                                >
                                    <Text style={styles.payBtnTextLarge}>Terapkan Rentang</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fdfdfd' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: { padding: 4, marginRight: 8 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '85%', width: '100%', alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    closeBtnText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
    inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
    textInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#0f172a',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    payBtnLarge: { backgroundColor: '#ea580c', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
    payBtnTextLarge: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    scrollContent: { padding: 16 },
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 14,
        padding: 4,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    filterTabActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    filterTabText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
    filterTabTextActive: { color: '#ea580c' },
    gridRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    statCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statLabel: { fontSize: 10, color: '#64748b', fontWeight: 'bold', letterSpacing: 0.3 },
    statValue: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginTop: 0 },
    statSub: { fontSize: 8, color: '#94a3b8', marginTop: 1 },
    section: { marginTop: 4, marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 4 },
    sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    rankBadge: {
        width: 22,
        height: 22,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    rankText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
    listItemName: { flex: 1, fontSize: 13, color: '#0f172a', fontWeight: '600' },
    itemSubText: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
    listItemQty: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    catName: { fontSize: 12, color: '#334155', fontWeight: 'bold' },
    catValue: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    progressBarBg: { height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 2 },
    emptyText: { textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12 },
    orderNo: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
    timeText: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
    amountText: { fontSize: 13, fontWeight: 'bold', color: '#10b981' },
    methodTextSmall: { fontSize: 10, color: '#94a3b8', marginTop: 1, fontWeight: '500' },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        marginBottom: 12,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchPromptInput: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontSize: 13,
        color: '#0f172a',
    },
    categoryPills: {
        marginBottom: 12,
        paddingBottom: 4,
    },
    pill: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    pillActive: {
        backgroundColor: '#fef3c7',
        borderColor: '#fcd34d',
    },
    pillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    pillTextActive: {
        color: '#d97706',
    },
    sortControls: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
        gap: 8,
    },
    sortTitle: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: 'bold',
        marginRight: 4,
    },
    sortBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        gap: 4,
    },
    sortBtnActive: {
        borderColor: '#ea580c',
        backgroundColor: '#fff7ed',
    },
    sortBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
    },
    sortBtnTextActive: {
        color: '#ea580c',
    },
});
