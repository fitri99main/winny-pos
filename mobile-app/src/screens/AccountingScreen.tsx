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
    Clock
} from 'lucide-react-native';
import { useSession } from '../context/SessionContext';
import DateStepper from '../components/DateStepper';


type FilterType = 'today' | 'week' | 'month' | 'custom';

export default function AccountingScreen() {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isSmallDevice = width < 380;
    const { currentBranchId, branchName, loading: sessionLoading } = useSession();

    const [filter, setFilter] = useState<FilterType>('today');
    const [loading, setLoading] = useState(true);
    
    // Custom Date Range State
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [showDateRangeModal, setShowDateRangeModal] = useState(false);
    const [stats, setStats] = useState({
        totalOmzet: 0,
        totalSales: 0,
        avgTicket: 0
    });
    const [coffeeBestSellers, setCoffeeBestSellers] = useState<any[]>([]);
    const [nonCoffeeBestSellers, setNonCoffeeBestSellers] = useState<any[]>([]);
    const [recentSales, setRecentSales] = useState<any[]>([]);

    useFocusEffect(
        useCallback(() => {
            if (currentBranchId) {
                fetchDashboardData();
            }
        }, [filter, startDate, endDate, currentBranchId])
    );

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const now = new Date();
            let startQueryDate = new Date();
            let endQueryDate: Date | null = null;
            
            if (filter === 'today') {
                startQueryDate.setHours(0, 0, 0, 0);
            } else if (filter === 'week') {
                startQueryDate.setDate(now.getDate() - 7);
            } else if (filter === 'month') {
                startQueryDate.setMonth(now.getMonth() - 1);
            } else if (filter === 'custom') {
                startQueryDate = new Date(startDate);
                startQueryDate.setHours(0, 0, 0, 0);
                endQueryDate = new Date(endDate);
                endQueryDate.setHours(23, 59, 59, 999);
            }

            // 1. Fetch Sales Summary
            const bId = currentBranchId;
            if (!bId) {
                setLoading(false);
                return;
            }

            let salesQuery = supabase
                .from('sales')
                .select('*')
                .eq('branch_id', bId)
                .in('status', ['Paid', 'Completed', 'Served', 'Ready'])
                .gte('date', startQueryDate.toISOString());

            if (endQueryDate) {
                salesQuery = salesQuery.lte('date', endQueryDate.toISOString());
            }
            
            salesQuery = salesQuery.order('date', { ascending: false });

            const { data: sales, error: salesError } = await salesQuery;

            if (salesError) throw salesError;

            const totalOmzet = sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
            const totalSalesCount = sales?.length || 0;
            const avgTicket = totalSalesCount > 0 ? totalOmzet / totalSalesCount : 0;

            setStats({
                totalOmzet,
                totalSales: totalSalesCount,
                avgTicket
            });

            setRecentSales(sales?.slice(0, 5) || []);

            // 2. Fetch Best Sellers
            let itemsQuery = supabase
                .from('sale_items')
                .select(`
                    quantity,
                    product_name,
                    product:product_id (category),
                    sales!inner(date, branch_id, status)
                `)
                .eq('sales.branch_id', bId)
                .in('sales.status', ['Paid', 'Completed', 'Served', 'Ready'])
                .gte('sales.date', startQueryDate.toISOString());

            if (endQueryDate) {
                itemsQuery = itemsQuery.lte('sales.date', endQueryDate.toISOString());
            }

            const { data: items, error: itemsError } = await itemsQuery;

            if (itemsError) throw itemsError;

            // Group by product name with category separation
            const coffeeGrouping: any = {};
            const nonCoffeeGrouping: any = {};

            items?.forEach(item => {
                const name = item.product_name || 'Produk';
                const qty = item.quantity || 0;
                const category = (item.product as any)?.category?.toLowerCase() || '';
                const lowerName = name.toLowerCase();
                
                if (category.includes('kopi') || lowerName.startsWith('kopi')) {
                    if (!coffeeGrouping[name]) coffeeGrouping[name] = 0;
                    coffeeGrouping[name] += qty;
                } else {
                    if (!nonCoffeeGrouping[name]) nonCoffeeGrouping[name] = 0;
                    nonCoffeeGrouping[name] += qty;
                }
            });

            const sortedCoffee = Object.keys(coffeeGrouping)
                .map(name => ({ name, qty: coffeeGrouping[name] }))
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5);

            const sortedNonCoffee = Object.keys(nonCoffeeGrouping)
                .map(name => ({ name, qty: nonCoffeeGrouping[name] }))
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5);

            setCoffeeBestSellers(sortedCoffee);
            setNonCoffeeBestSellers(sortedNonCoffee);

        } catch (error: any) {
            console.error('Fetch Dashboard Error:', error);
            Alert.alert('Error', 'Gagal memuat dashboard: ' + error.message);
        } finally {
            setLoading(false);
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
        <View style={[styles.statCard, isSmallDevice && { padding: 12 }]}>
            <View style={[styles.statIconContainer, { backgroundColor: color + '10' }]}>
                <Icon size={isSmallDevice ? 20 : 24} color={color} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.statLabel}>{title}</Text>
                <Text style={[styles.statValue, isSmallDevice && { fontSize: 16 }]}>{value}</Text>
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
                        {/* Highlights */}
                        <View style={styles.row}>
                            <StatCard 
                                title="Total Omzet" 
                                value={formatCurrency(stats.totalOmzet)} 
                                icon={TrendingUp} 
                                color="#22c55e" 
                            />
                        </View>
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <StatCard 
                                    title="Transaksi" 
                                    value={stats.totalSales} 
                                    icon={ShoppingCart} 
                                    color="#3b82f6" 
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <StatCard 
                                    title="Rata-rata" 
                                    value={formatCurrency(stats.avgTicket)} 
                                    icon={BarChart3} 
                                    color="#a855f7" 
                                />
                            </View>
                        </View>

                        {/* Best Sellers - Coffee */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Award size={20} color="#ea580c" />
                                <Text style={styles.sectionTitle}>Kopi Terlaris</Text>
                            </View>
                            <View style={styles.card}>
                                {coffeeBestSellers.length === 0 ? (
                                    <Text style={styles.emptyText}>Tidak ada data produk kopi</Text>
                                ) : (
                                    coffeeBestSellers.map((item, index) => (
                                        <View key={'coffee-' + index} style={[styles.listItem, index === coffeeBestSellers.length - 1 && { borderBottomWidth: 0 }]}>
                                            <View style={styles.rankBadge}>
                                                <Text style={styles.rankText}>{index + 1}</Text>
                                            </View>
                                            <Text style={styles.listItemName} numberOfLines={1}>{item.name}</Text>
                                            <Text style={styles.listItemQty}>{item.qty} Porsi</Text>
                                        </View>
                                    ))
                                )}
                            </View>
                        </View>

                        {/* Best Sellers - Non Coffee */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Award size={20} color="#3b82f6" />
                                <Text style={styles.sectionTitle}>Non-Kopi Terlaris</Text>
                            </View>
                            <View style={styles.card}>
                                {nonCoffeeBestSellers.length === 0 ? (
                                    <Text style={styles.emptyText}>Tidak ada data produk non-kopi</Text>
                                ) : (
                                    nonCoffeeBestSellers.map((item, index) => (
                                        <View key={'noncoffee-' + index} style={[styles.listItem, index === nonCoffeeBestSellers.length - 1 && { borderBottomWidth: 0 }]}>
                                            <View style={[styles.rankBadge, { backgroundColor: '#eff6ff' }]}>
                                                <Text style={[styles.rankText, { color: '#3b82f6' }]}>{index + 1}</Text>
                                            </View>
                                            <Text style={styles.listItemName} numberOfLines={1}>{item.name}</Text>
                                            <Text style={styles.listItemQty}>{item.qty} Porsi</Text>
                                        </View>
                                    ))
                                )}
                            </View>
                        </View>

                        {/* Recent Transactions */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Clock size={20} color="#64748b" />
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
                                            <Text style={styles.amountText}>{formatCurrency(sale.total_amount)}</Text>
                                            <ChevronRight size={16} color="#d1d5db" />
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
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: { padding: 4, marginRight: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%', width: '100%', alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    closeBtnText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
    inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    textInput: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    payBtnLarge: { backgroundColor: '#ea580c', padding: 16, borderRadius: 16, alignItems: 'center' },
    payBtnTextLarge: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    scrollContent: { padding: 16 },
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    filterTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    filterTabActive: {
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    filterTabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    filterTabTextActive: { color: '#ea580c' },
    row: { flexDirection: 'row', marginBottom: 16 },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 1,
    },
    statIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
    statValue: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 2 },
    statSub: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
    section: { marginTop: 8, marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: 4 },
    sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginLeft: 10 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 1,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    rankBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff7ed',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    rankText: { fontSize: 12, fontWeight: 'bold', color: '#ea580c' },
    listItemName: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500' },
    listItemQty: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    emptyText: { textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 },
    orderNo: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    timeText: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    amountText: { fontSize: 14, fontWeight: 'bold', color: '#22c55e', marginRight: 10 },
});
