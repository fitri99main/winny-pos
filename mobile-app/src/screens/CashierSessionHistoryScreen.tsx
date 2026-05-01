import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, StyleSheet, useWindowDimensions, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Clock, User, DollarSign, TrendingUp, ChevronLeft, Calendar, Search, Eye, Power, Trash2, Edit, Plus, Save, X, RefreshCw, Filter, CheckCircle2, FileText, Printer as PrinterIcon, AlertTriangle } from 'lucide-react-native';
import { useSession } from '../context/SessionContext';
import CashierSessionModal from '../components/CashierSessionModal';
import CashierClosingSummaryModal from '../components/CashierClosingSummaryModal';
import ConfirmExitModal from '../components/ConfirmExitModal';
import StatusModal from '../components/StatusModal';
import { PrinterManager } from '../lib/PrinterManager';
import { getLocalISOString, getLocalDateString } from '../lib/dateUtils';

interface CashierSession {
    id: string;
    employee_name: string;
    opened_at: string;
    closed_at: string | null;
    starting_cash: number;
    actual_cash: number | null;
    total_sales: number;
    expected_cash: number;
    difference: number;
    status: 'Open' | 'Closed';
    cash_sales?: number;
    qris_sales?: number;
}

export default function CashierSessionHistoryScreen() {
    const navigation = useNavigation();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState<CashierSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<CashierSession | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [summaryData, setSummaryData] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    
    // Filter States
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('today');
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [endDate, setEndDate] = useState(getLocalDateString());
    const [statusFilter, setStatusFilter] = useState<'all' | 'Open' | 'Closed'>('all');
    const [cashierFilter, setCashierFilter] = useState<string>('all');
    const [availableCashiers, setAvailableCashiers] = useState<string[]>([]);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [showDateRangeModal, setShowDateRangeModal] = useState(false);

    const { currentBranchId, isAdmin, userName, branchAddress, branchPhone, storeSettings, loading: sessionLoading } = useSession();
    
    useEffect(() => {
        if (!sessionLoading && !isAdmin && storeSettings && !storeSettings.cashier_can_view_session_history) {
            Alert.alert('Akses Ditolak', 'Anda tidak memiliki izin untuk melihat riwayat kasir.');
            navigation.goBack();
        }
    }, [isAdmin, storeSettings, sessionLoading]);
    
    // CRUD States
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState({ starting_cash: '', actual_cash: '', status: 'Closed' });
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualData, setManualData] = useState({ employee_name: '', starting_cash: '', actual_cash: '', opened_at: getLocalISOString() });
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [statusModal, setStatusModal] = useState({ visible: false, title: '', message: '', type: 'success' as any });

    useEffect(() => {
        if (currentBranchId) {
            fetchSessions();
            if (isAdmin) {
                fetchAvailableCashiers();
            }
        }
    }, [currentBranchId, dateFilter, startDate, endDate, statusFilter, cashierFilter]);

    const fetchAvailableCashiers = async () => {
        try {
            // Only show cashiers who have actually opened a session in this branch
            const { data, error } = await supabase
                .from('cashier_sessions')
                .select('employee_name')
                .eq('branch_id', currentBranchId);
            
            if (error) throw error;
            
            if (Array.isArray(data)) {
                // Extract unique names and sort them
                const uniqueNames = Array.from(new Set(data.map(s => s.employee_name))).filter(Boolean).sort();
                setAvailableCashiers(uniqueNames);
            }
        } catch (error) {
            console.error('Fetch Cashiers Error:', error);
        }
    };

    const fetchSessions = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('cashier_sessions')
                .select('*')
                .eq('branch_id', currentBranchId)
                .order('opened_at', { ascending: false });

            // Apply Date Filters
            if (dateFilter === 'today') {
                const start = new Date();
                start.setHours(0, 0, 0, 0);
                query = query.gte('opened_at', start.toISOString());
            } else if (dateFilter === 'week') {
                const start = new Date();
                start.setDate(start.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                query = query.gte('opened_at', start.toISOString());
            } else if (dateFilter === 'month') {
                const start = new Date();
                start.setDate(start.getDate() - 29);
                start.setHours(0, 0, 0, 0);
                query = query.gte('opened_at', start.toISOString());
            } else if (dateFilter === 'custom') {
                // Properly parse local YYYY-MM-DD string to start/end of day local time
                const [sY, sM, sD] = startDate.split('-').map(Number);
                const start = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
                
                const [eY, eM, eD] = endDate.split('-').map(Number);
                const end = new Date(eY, eM - 1, eD, 23, 59, 59, 999);
                
                query = query.gte('opened_at', start.toISOString()).lte('opened_at', end.toISOString());
            }

            // Apply Status Filter
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            // Apply Cashier Filter
            if (cashierFilter !== 'all') {
                query = query.eq('employee_name', cashierFilter);
            }

            let allSessions: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await query.range(from, from + pageSize - 1);
                if (error) throw error;
                if (data && data.length > 0) {
                    allSessions = [...allSessions, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else from += pageSize;
                } else {
                    hasMore = false;
                }
            }

            setSessions(allSessions);
        } catch (error: any) {
            console.error('Fetch Sessions Error:', error);
            Alert.alert('Error', 'Gagal memuat riwayat shift: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSession = () => {
        if (!selectedSession) return;
        setShowDeleteConfirm(true);
    };

    const onConfirmDelete = async () => {
        setShowDeleteConfirm(false);
        if (!selectedSession) return;
        
        try {
            setLoading(true);
            const { error } = await supabase
                .from('cashier_sessions')
                .delete()
                .eq('id', selectedSession.id);

            if (error) throw error;

            setShowDetail(false);
            fetchSessions();
            setStatusModal({
                visible: true,
                title: 'Berhasil Dihapus',
                message: 'Data riwayat shift telah berhasil dihapus secara permanen dari sistem.',
                type: 'success'
            });
        } catch (error: any) {
            console.error('Delete Session Error:', error);
            Alert.alert('Error', 'Gagal menghapus data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSession = async () => {
        if (!selectedSession) return;

        try {
            setIsSaving(true);
            const { error } = await supabase
                .from('cashier_sessions')
                .update({
                    starting_cash: parseFloat(editData.starting_cash) || 0,
                    actual_cash: editData.status === 'Closed' ? (parseFloat(editData.actual_cash) || 0) : null,
                    expected_cash: (selectedSession.cash_sales || 0) + (parseFloat(editData.starting_cash) || 0),
                    difference: editData.status === 'Closed' ? ((parseFloat(editData.actual_cash) || 0) - ((selectedSession.cash_sales || 0) + (parseFloat(editData.starting_cash) || 0))) : 0
                })
                .eq('id', selectedSession.id);

            if (error) throw error;

            setShowEditModal(false);
            fetchSessions();
            setShowDetail(false);
            setStatusModal({
                visible: true,
                title: 'Data Diperbarui',
                message: 'Perubahan pada data shift telah berhasil disimpan.',
                type: 'success'
            });
        } catch (error: any) {
            console.error('Update Session Error:', error);
            Alert.alert('Error', 'Gagal memperbarui data: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveManual = async () => {
        if (!manualData.employee_name || !manualData.starting_cash) {
            Alert.alert('Error', 'Nama kasir dan modal awal harus diisi.');
            return;
        }

        try {
            setIsSaving(true);
            const startCash = parseFloat(manualData.starting_cash) || 0;
            const endCash = parseFloat(manualData.actual_cash) || 0;
            const totalSales = 0; // Manual entry starts with 0 sales usually
            
            const { error } = await supabase
                .from('cashier_sessions')
                .insert([{
                    employee_name: manualData.employee_name,
                    starting_cash: startCash,
                    actual_cash: endCash,
                    cash_sales: 0,
                    total_sales: totalSales,
                    expected_cash: startCash + totalSales,
                    difference: endCash - (startCash + totalSales),
                    opened_at: manualData.opened_at,
                    closed_at: new Date().toISOString(),
                    status: 'Closed', // Manual entries are usually for past closed shifts
                    branch_id: currentBranchId
                }]);

            if (error) throw error;

            setShowManualModal(false);
            setManualData({ employee_name: '', starting_cash: '', actual_cash: '', opened_at: getLocalISOString() });
            fetchSessions();
            setStatusModal({
                visible: true,
                title: 'Shift Ditambahkan',
                message: 'Shift manual baru telah berhasil dicatat ke dalam sistem.',
                type: 'success'
            });
        } catch (error: any) {
            console.error('Save Manual Error:', error);
            Alert.alert('Error', 'Gagal menyimpan: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleViewSummary = async (session: CashierSession) => {
        setSummaryLoading(true);
        setShowSummary(true);
        try {
            const openedAt = new Date(session.opened_at).toISOString();
            const closedAt = session.closed_at ? new Date(session.closed_at).toISOString() : new Date().toISOString();

            let allSales: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('sales')
                    .select('*')
                    .gte('created_at', openedAt)
                    .lte('created_at', closedAt)
                    .range(from, from + pageSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allSales = [...allSales, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else from += pageSize;
                } else {
                    hasMore = false;
                }
            }

            const sales = allSales;

            let cash = 0;
            let nonCash = 0;
            let total = 0;
            let totalTax = 0;
            let totalDiscount = 0;
            let completedCount = 0;
            let paySummary: Record<string, number> = {};
            let catSummary: Record<string, number> = {};

            sales?.forEach(sale => {
                const status = (sale.status || '').toLowerCase();
                const isPaid = ['completed', 'selesai', 'paid', 'served', 'success', 'settlement', 'capture'].includes(status);
                
                if (isPaid) {
                    completedCount++;
                    // ALWAYS use total_amount for revenue/cash calculations to prevent change (kembalian) from inflating the cash drawer amount
                    const amount = (sale.total_amount || 0);
                    total += amount;
                    totalTax += Number(sale.tax || sale.tax_amount || 0);
                    totalDiscount += Number(sale.discount || sale.discount_amount || 0);
                    const method = (sale.payment_method || 'Tunai').trim();
                    paySummary[method] = (paySummary[method] || 0) + amount;

                    const lowerMethod = method.toLowerCase();
                    if (lowerMethod === 'tunai' || lowerMethod === 'cash') cash += amount;
                    else nonCash += amount;
                }
            });

            // Fetch Items for Category Summary
            const saleIds = sales?.map(s => s.id) || [];
            if (saleIds.length > 0) {
                const { data: allProducts } = await supabase.from('products').select('id, name, category');
                const productCatMap: Record<string, string> = {};
                allProducts?.forEach(p => { productCatMap[p.name || ''] = (p.category || 'LAINNYA').toUpperCase(); });

                let allItems: any[] = [];
                let itemFrom = 0;
                let itemHasMore = true;

                while (itemHasMore) {
                    const { data: itemsPage, error: itemError } = await supabase
                        .from('sale_items')
                        .select('product_name, quantity, price')
                        .in('sale_id', saleIds)
                        .range(itemFrom, itemFrom + pageSize - 1);
                    
                    if (itemError) throw itemError;

                    if (itemsPage && itemsPage.length > 0) {
                        allItems = [...allItems, ...itemsPage];
                        if (itemsPage.length < pageSize) itemHasMore = false;
                        else itemFrom += pageSize;
                    } else {
                        itemHasMore = false;
                    }
                }
                
                const items = allItems;
                items.forEach(item => {
                    const name = item.product_name || 'Produk';
                    const cat = productCatMap[name] || 'LAINNYA';
                    const amount = Number(item.quantity) * Number(item.price);
                    if (amount > 0) {
                        catSummary[cat] = (catSummary[cat] || 0) + amount;
                    }
                });
            }

            setSummaryData({
                cash_sales: cash,
                non_cash_sales: nonCash,
                total_sales: total,
                total_tax: totalTax,
                total_discount: totalDiscount,
                total_orders: completedCount,
                expected_cash: session.starting_cash + cash,
                starting_cash: session.starting_cash,
                actual_cash: session.actual_cash || 0,
                difference: session.difference,
                employee_name: session.employee_name,
                opened_at: session.opened_at,
                closed_at: session.closed_at,
                payment_summary: Object.entries(paySummary).map(([method, amount]) => ({ method, amount })),
                category_summary: Object.entries(catSummary).map(([name, amount]) => ({ name, amount }))
            });
        } catch (err) {
            console.error('Error fetching summary:', err);
            Alert.alert('Error', 'Gagal memuat ringkasan detail.');
        } finally {
            setSummaryLoading(false);
        }
    };

    const handlePrintSummary = async () => {
        if (!summaryData) return;
        try {
            const { data: settings } = await supabase.from('store_settings').select('*').single();
            const reportData = {
                shopName: settings?.store_name || 'WINNY COFFEE PNK',
                address: settings?.address || '',
                phone: settings?.phone || '',
                dateRange: `${new Date(summaryData.opened_at).toLocaleString('id-ID')} - ${new Date(summaryData.closed_at || new Date()).toLocaleString('id-ID')}`,
                totalOrders: summaryData.total_orders,
                totalSales: summaryData.total_sales,
                totalTax: summaryData.total_tax || 0,
                totalDiscount: summaryData.total_discount || 0,
                paymentSummary: summaryData.payment_summary,
                categorySummary: summaryData.category_summary.map((c: any) => ({ category: c.name, amount: c.amount })),
                productSummary: [],
                openingBalance: summaryData.starting_cash,
                cashTotal: summaryData.cash_sales,
                qrTotal: summaryData.non_cash_sales,
                expectedCash: summaryData.expected_cash,
                actualCash: summaryData.actual_cash,
                variance: summaryData.difference,
                generatedBy: summaryData.employee_name,
                showLogo: true,
                receiptLogoUrl: settings?.receipt_logo_url || settings?.logo_url,
                showCategoryOnSummary: settings?.show_category_on_summary !== false,
                address: settings?.address || branchAddress,
                phone: settings?.phone || branchPhone,
                paperWidth: settings?.receipt_paper_width === '80mm' ? 48 : 32
            };
            await PrinterManager.printSalesReport(reportData);
        } catch (err) {
            Alert.alert('Printer Error', 'Gagal mencetak.');
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', { 
            style: 'currency', 
            currency: 'IDR', 
            minimumFractionDigits: 0 
        }).format(value);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const totalSales = sessions.reduce((sum, s) => sum + (s.total_sales || 0), 0);
    const totalVariance = sessions.filter(s => s.status === 'Closed').reduce((sum, s) => sum + (s.difference || 0), 0);

    const renderSummaryCard = (icon: any, label: string, value: string, color: string) => (
        <View style={styles.summaryCard}>
            <View style={[styles.summaryIconContainer, { backgroundColor: color + '10' }]}>
                {icon}
            </View>
            <View>
                <Text style={styles.summaryLabel}>{label}</Text>
                <Text style={styles.summaryValue}>{value}</Text>
            </View>
        </View>
    );

    if (loading && sessions.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ea580c" />
                    <Text style={styles.loadingText}>Memuat riwayat shift...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.flex1}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <ChevronLeft size={32} color="#1f2937" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Riwayat Kasir</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
                        {isAdmin && (
                            <TouchableOpacity 
                                style={styles.addManualBtn} 
                                onPress={() => setShowManualModal(true)}
                            >
                                <Plus size={18} color="#ea580c" />
                                <Text style={styles.addManualBtnText}>Shift Manual</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            style={[styles.filterToggleBtn, (statusFilter !== 'all' || cashierFilter !== 'all' || dateFilter === 'custom') && styles.filterToggleActive]}
                            onPress={() => setShowAdvancedFilter(true)}
                        >
                            <Filter size={18} color={(statusFilter !== 'all' || cashierFilter !== 'all' || dateFilter === 'custom') ? "#fff" : "#ea580c"} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={fetchSessions}>
                            <RefreshCw size={24} color="#ea580c" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Filter Chips Bar */}
                <View style={styles.filterBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsContent}>
                        {[
                            { id: 'today', label: 'Hari Ini' },
                            { id: 'week', label: '7 Hari' },
                            { id: 'month', label: '30 Hari' },
                            { id: 'custom', label: 'Rentang' }
                        ].map((chip) => (
                            <TouchableOpacity 
                                key={chip.id} 
                                style={[styles.filterChip, dateFilter === chip.id && styles.filterChipActive]}
                                onPress={() => {
                                    if (chip.id === 'custom') {
                                        setShowDateRangeModal(true);
                                    } else {
                                        setDateFilter(chip.id as any);
                                    }
                                }}
                            >
                                <Text style={[styles.filterChipText, dateFilter === chip.id && styles.filterChipTextActive]}>
                                    {chip.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Summary View */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.summaryContainer}
                >
                    {renderSummaryCard(<Clock size={20} color="#3b82f6" />, "Total Shift", (sessions?.length || 0).toString(), "#3b82f6")}
                    {renderSummaryCard(<DollarSign size={20} color="#16a34a" />, "Total Penjualan", formatCurrency(totalSales), "#16a34a")}
                    {renderSummaryCard(<TrendingUp size={20} color={totalVariance >= 0 ? "#16a34a" : "#dc2626"} />, "Total Selisih", formatCurrency(totalVariance), totalVariance >= 0 ? "#16a34a" : "#dc2626")}
                </ScrollView>

                {sessions.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Clock size={64} color="#d1d5db" />
                        <Text style={styles.emptyTitle}>Belum ada riwayat shift</Text>
                    </View>
                ) : (
                    <FlatList
                        data={sessions}
                        keyExtractor={(item, index) => (item?.id ?? index).toString()}
                        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.card}
                                onPress={() => {
                                    setSelectedSession(item);
                                    setShowDetail(true);
                                }}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.cashierInfo}>
                                        <View style={styles.userIconContainer}>
                                            <User size={16} color="#4b5563" />
                                        </View>
                                        <Text style={styles.cashierName}>{item.employee_name || 'Kasir'}</Text>
                                    </View>
                                    <View style={[
                                        styles.statusBadge,
                                        item.status === 'Open' ? styles.statusOpen : styles.statusClosed
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            item.status === 'Open' ? styles.statusTextOpen : styles.statusTextClosed
                                        ]}>
                                            {item.status === 'Open' ? 'BUKA' : 'TUTUP'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.timeInfo}>
                                    <View style={styles.timeRow}>
                                        <Text style={styles.timeLabel}>Buka:</Text>
                                        <Text style={styles.timeValue}>{formatDate(item.opened_at)}</Text>
                                    </View>
                                    <View style={styles.timeRow}>
                                        <Text style={styles.timeLabel}>Tutup:</Text>
                                        <Text style={styles.timeValue}>{formatDate(item.closed_at)}</Text>
                                    </View>
                                </View>

                                <View style={styles.cardFooter}>
                                    <View>
                                        <Text style={styles.footerLabel}>Modal Utama</Text>
                                        <Text style={styles.footerValue}>{formatCurrency(item.starting_cash || 0)}</Text>
                                    </View>
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={styles.footerLabel}>Penjualan</Text>
                                        <Text style={[styles.footerValue, { color: '#16a34a' }]}>{formatCurrency(item.total_sales || 0)}</Text>
                                    </View>
                                    <View style={styles.varianceContainer}>
                                        <Text style={styles.footerLabel}>Selisih Kas</Text>
                                        <Text style={[
                                            styles.varianceValue,
                                            item.difference >= 0 ? styles.textSuccess : styles.textDanger
                                        ]}>
                                            {formatCurrency(item.difference || 0)}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>

            {/* Detail Modal */}
            <Modal
                visible={showDetail}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDetail(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Detail Shift</Text>
                            <TouchableOpacity onPress={() => setShowDetail(false)}>
                                <Text style={styles.closeButton}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedSession && (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>KASIR</Text>
                                    <Text style={styles.detailValue}>{selectedSession.employee_name}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>STATUS</Text>
                                    <View style={[
                                        styles.statusBadge,
                                        selectedSession.status === 'Open' ? styles.statusOpen : styles.statusClosed
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            selectedSession.status === 'Open' ? styles.statusTextOpen : styles.statusTextClosed
                                        ]}>
                                            {selectedSession.status === 'Open' ? 'BUKA' : 'TUTUP'}
                                        </Text>
                                    </View>
                                </View>
                                
                                <View style={styles.divider} />
                                
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>WAKTU BUKA</Text>
                                    <Text style={styles.detailValue}>{formatDate(selectedSession.opened_at)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>WAKTU TUTUP</Text>
                                    <Text style={styles.detailValue}>{formatDate(selectedSession.closed_at)}</Text>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>TUNAI (SISTEM)</Text>
                                    <Text style={[styles.detailValue, styles.textSuccess]}>{formatCurrency(selectedSession.cash_sales || 0)}</Text>
                                </View>
                                
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>MODAL AWAL</Text>
                                    <Text style={styles.detailValue}>{formatCurrency(selectedSession.starting_cash)}</Text>
                                </View>
                                
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>PENJUALAN QRIS/NON-TUNAI</Text>
                                    <Text style={styles.detailValue}>{formatCurrency((selectedSession.total_sales || 0) - (selectedSession.cash_sales || 0))}</Text>
                                </View>
                                
                                <View style={[styles.detailRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#f1f5f9' }]}>
                                    <Text style={[styles.detailLabel, { fontWeight: 'bold' }]}>TOTAL PENJUALAN (NETT)</Text>
                                    <Text style={[styles.detailValue, { fontWeight: 'bold' }]}>{formatCurrency(selectedSession.total_sales)}</Text>
                                </View>

                                <View style={styles.divider} />

                                <View style={[styles.infoBox, { backgroundColor: '#f8fafc', marginBottom: 15 }]}>
                                    <Text style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold', marginBottom: 4 }}>PERHITUNGAN KAS (REKONSILIASI)</Text>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 2 }}>
                                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1e293b' }}>TOTAL (TUNAI+SISTEM)</Text>
                                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ea580c' }}>{formatCurrency(selectedSession.expected_cash)}</Text>
                                    </View>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>KAS FISIK KASIR (TUTUP KASIR)</Text>
                                    <Text style={[styles.detailValue, { fontWeight: 'bold' }]}>{formatCurrency(selectedSession.actual_cash || 0)}</Text>
                                </View>
                                
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>SELISIH</Text>
                                    <Text style={[
                                        styles.detailValue, 
                                        styles.bold,
                                        selectedSession.difference >= 0 ? styles.textSuccess : styles.textDanger
                                    ]}>
                                        {formatCurrency(selectedSession.difference || 0)}
                                    </Text>
                                </View>
                                
                                {selectedSession.status === 'Open' && (
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoText}>Shift ini masih terbuka. Data penjualan akan terus diperbarui sampai shift ditutup.</Text>
                                    </View>
                                )}
                                {isAdmin && (
                                    <View style={styles.adminActionRow}>
                                        <TouchableOpacity 
                                            style={[styles.adminActionBtn, { backgroundColor: '#f1f5f9' }]}
                                            onPress={() => {
                                                setEditData({
                                                    starting_cash: selectedSession.starting_cash.toString(),
                                                    actual_cash: (selectedSession.actual_cash || 0).toString(),
                                                    status: selectedSession.status
                                                });
                                                setShowEditModal(true);
                                            }}
                                        >
                                            <Edit size={16} color="#4b5563" />
                                            <Text style={styles.adminActionBtnText}>Edit Shift</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            style={[styles.adminActionBtn, { backgroundColor: '#fef2f2' }]}
                                            onPress={handleDeleteSession}
                                        >
                                            <Trash2 size={16} color="#dc2626" />
                                            <Text style={[styles.adminActionBtnText, { color: '#dc2626' }]}>Hapus</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TouchableOpacity 
                                    style={[styles.forceCloseButton, { backgroundColor: '#ea580c', marginTop: 16 }]}
                                    onPress={() => {
                                        setShowDetail(false);
                                        handleViewSummary(selectedSession);
                                    }}
                                >
                                    <FileText size={18} color="#fff" />
                                    <Text style={styles.forceCloseButtonText}>Lihat Ringkasan Lengkap</Text>
                                </TouchableOpacity>

                                {selectedSession.status === 'Open' && isAdmin && (
                                    <TouchableOpacity 
                                        style={styles.forceCloseButton}
                                        onPress={() => {
                                            setShowDetail(false);
                                            setShowCloseModal(true);
                                        }}
                                    >
                                        <Power size={18} color="#fff" />
                                        <Text style={styles.forceCloseButtonText}>Tutup Paksa Shift (ADMIN)</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        )}

                        <TouchableOpacity 
                            style={styles.modalFooterButton}
                            onPress={() => setShowDetail(false)}
                        >
                            <Text style={styles.modalFooterButtonText}>Tutup</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <CashierSessionModal
                visible={showCloseModal}
                onClose={() => setShowCloseModal(false)}
                mode="force_close"
                session={selectedSession}
                onComplete={() => {
                    fetchSessions();
                    setShowCloseModal(false);
                }}
                currentBranchId={currentBranchId}
            />

            <CashierClosingSummaryModal 
                visible={showSummary}
                onClose={() => setShowSummary(false)}
                data={summaryData}
                loading={summaryLoading}
                onPrint={handlePrintSummary}
            />

            <ConfirmExitModal 
                visible={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={onConfirmDelete}
                title="Hapus Data Shift?"
                message="Data shift ini akan dihapus permanen dan tidak dapat dikembalikan."
                confirmText="Hapus"
                cancelText="Batal"
                iconType="trash"
            />

            <StatusModal 
                visible={statusModal.visible}
                onClose={() => setStatusModal({ ...statusModal, visible: false })}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
            />

            {/* Edit Modal */}
            <Modal
                visible={showEditModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowEditModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 400, padding: 24 }]}>
                        <View style={styles.modalHeaderInner}>
                            <Text style={styles.modalTitle}>Edit Data Shift</Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <X size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Modal Awal (Starting Cash)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editData.starting_cash}
                                onChangeText={(val) => setEditData({ ...editData, starting_cash: val })}
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Uang Fisik Akhir (Ending Cash)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editData.actual_cash}
                                onChangeText={(val) => setEditData({ ...editData, actual_cash: val })}
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </View>

                        <View style={styles.modalFooterRow}>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: '#f1f5f9' }]} 
                                onPress={() => setShowEditModal(false)}
                            >
                                <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: '#ea580c' }]} 
                                onPress={handleUpdateSession}
                                disabled={isSaving}
                            >
                                {isSaving ? <ActivityIndicator size="small" color="white" /> : (
                                    <>
                                        <Save size={18} color="white" />
                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Simpan</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Manual Entry Modal */}
            <Modal
                visible={showManualModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowManualModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 400, padding: 24 }]}>
                        <View style={styles.modalHeaderInner}>
                            <Text style={styles.modalTitle}>Input Shift Manual</Text>
                            <TouchableOpacity onPress={() => setShowManualModal(false)}>
                                <X size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Nama Kasir</Text>
                            <TextInput
                                style={styles.textInput}
                                value={manualData.employee_name}
                                onChangeText={(val) => setManualData({ ...manualData, employee_name: val })}
                                placeholder="Nama Kasir"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Modal Awal (Starting Cash)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={manualData.starting_cash}
                                onChangeText={(val) => setManualData({ ...manualData, starting_cash: val })}
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Uang Fisik Akhir (Ending Cash)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={manualData.actual_cash}
                                onChangeText={(val) => setManualData({ ...manualData, actual_cash: val })}
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </View>

                        <View style={styles.modalFooterRow}>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: '#f1f5f9' }]} 
                                onPress={() => setShowManualModal(false)}
                            >
                                <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: '#ea580c' }]} 
                                onPress={handleSaveManual}
                                disabled={isSaving}
                            >
                                {isSaving ? <ActivityIndicator size="small" color="white" /> : (
                                    <>
                                        <Plus size={18} color="white" />
                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Tambah Record</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Advanced Filter Modal */}
            <Modal
                visible={showAdvancedFilter}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowAdvancedFilter(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 450 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filter Lanjutan</Text>
                            <TouchableOpacity onPress={() => setShowAdvancedFilter(false)}>
                                <X size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Status Filter */}
                            <Text style={styles.filterGroupLabel}>Status Shift</Text>
                            <View style={styles.filterChipRow}>
                                {[
                                    { id: 'all', label: 'Semua' },
                                    { id: 'Open', label: 'Masih Buka' },
                                    { id: 'Closed', label: 'Sudah Tutup' }
                                ].map((item) => (
                                    <TouchableOpacity 
                                        key={item.id}
                                        style={[styles.modalFilterChip, statusFilter === item.id && styles.modalFilterChipActive]}
                                        onPress={() => setStatusFilter(item.id as any)}
                                    >
                                        <Text style={[styles.modalFilterChipText, statusFilter === item.id && styles.modalFilterChipTextActive]}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.divider} />

                            {/* Cashier Filter (Admins Only) */}
                            {isAdmin && (
                                <>
                                    <Text style={styles.filterGroupLabel}>Pilih Kasir</Text>
                                    <View style={styles.cashierList}>
                                        <TouchableOpacity 
                                            style={[styles.cashierItem, cashierFilter === 'all' && styles.cashierItemActive]}
                                            onPress={() => setCashierFilter('all')}
                                        >
                                            <Text style={[styles.cashierItemText, cashierFilter === 'all' && styles.cashierItemTextActive]}>Semua Kasir</Text>
                                            {cashierFilter === 'all' && <CheckCircle2 size={16} color="#ea580c" />}
                                        </TouchableOpacity>
                                        {(availableCashiers || []).map((name) => (
                                            <TouchableOpacity 
                                                key={name}
                                                style={[styles.cashierItem, cashierFilter === name && styles.cashierItemActive]}
                                                onPress={() => setCashierFilter(name)}
                                            >
                                                <Text style={[styles.cashierItemText, cashierFilter === name && styles.cashierItemTextActive]}>{name}</Text>
                                                {cashierFilter === name && <CheckCircle2 size={16} color="#ea580c" />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            {dateFilter === 'custom' && (
                                <>
                                    <View style={styles.divider} />
                                    <Text style={styles.filterGroupLabel}>Rentang Tanggal</Text>
                                    <View style={styles.dateRangeTextRow}>
                                        <Calendar size={14} color="#64748b" />
                                        <Text style={styles.dateRangeSummaryText}>
                                            {formatDate(startDate).split(',')[0]} s/d {formatDate(endDate).split(',')[0]}
                                        </Text>
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.changeDateBtn}
                                        onPress={() => setShowDateRangeModal(true)}
                                    >
                                        <Text style={styles.changeDateBtnText}>Ubah Rentang Tanggal</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooterActions}>
                            <TouchableOpacity 
                                style={styles.resetFilterBtn}
                                onPress={() => {
                                    setCashierFilter('all');
                                    setStatusFilter('all');
                                    setDateFilter('today');
                                    setShowAdvancedFilter(false);
                                }}
                            >
                                <Text style={styles.resetFilterBtnText}>Reset Filter</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.applyFilterBtn}
                                onPress={() => setShowAdvancedFilter(false)}
                            >
                                <Text style={styles.applyFilterBtnText}>Tampilkan Hasil</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Date Range Modal */}
            <Modal
                visible={showDateRangeModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDateRangeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 400, padding: 24 }]}>
                        <Text style={styles.modalTitle}>Pilih Rentang Tanggal</Text>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Tanggal Mulai</Text>
                            <TextInput
                                style={styles.textInput}
                                value={startDate}
                                onChangeText={setStartDate}
                                placeholder="YYYY-MM-DD"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Tanggal Akhir</Text>
                            <TextInput
                                style={styles.textInput}
                                value={endDate}
                                onChangeText={setEndDate}
                                placeholder="YYYY-MM-DD"
                            />
                        </View>

                        <View style={styles.modalFooterRow}>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: '#f1f5f9' }]} 
                                onPress={() => setShowDateRangeModal(false)}
                            >
                                <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: '#ea580c' }]} 
                                onPress={() => {
                                    setDateFilter('custom');
                                    setShowDateRangeModal(false);
                                }}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Pilih</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    flex1: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#6b7280' },
    header: {
        backgroundColor: 'white',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
        zIndex: 10,
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    summaryContainer: { padding: 12, gap: 10 },
    summaryCard: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minWidth: 140,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    summaryIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryLabel: { fontSize: 10, color: '#6b7280', fontWeight: '500' },
    summaryValue: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
    card: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 10,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    cashierInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    userIconContainer: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
    cashierName: { fontSize: 13, fontWeight: 'bold', color: '#1f2937' },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    statusOpen: { backgroundColor: '#f0fdf4' },
    statusClosed: { backgroundColor: '#f3f4f6' },
    statusText: { fontSize: 8, fontWeight: 'bold' },
    statusTextOpen: { color: '#16a34a' },
    statusTextClosed: { color: '#6b7280' },
    timeInfo: { gap: 1, marginBottom: 6, paddingVertical: 4, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f9fafb' },
    timeRow: { flexDirection: 'row', gap: 4 },
    timeLabel: { fontSize: 10, color: '#6b7280', width: 36 },
    timeValue: { fontSize: 10, color: '#374151', fontWeight: '500' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerLabel: { fontSize: 8, color: '#9ca3af', marginBottom: 0 },
    footerValue: { fontSize: 12, fontWeight: 'bold', color: '#111827' },
    varianceContainer: { alignItems: 'flex-end' },
    varianceValue: { fontSize: 12, fontWeight: 'bold' },
    textSuccess: { color: '#16a34a' },
    textDanger: { color: '#dc2626' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#9ca3af', marginTop: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 24, overflow: 'hidden', maxHeight: '80%' },
    modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
    closeButton: { fontSize: 20, color: '#9ca3af', padding: 4 },
    modalBody: { padding: 20 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    detailLabel: { fontSize: 10, fontWeight: 'bold', color: '#9ca3af' },
    detailValue: { fontSize: 16, color: '#1f2937', fontWeight: '500' },
    bold: { fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 8 },
    modalFooterButton: { backgroundColor: '#f3f4f6', padding: 16, alignItems: 'center' },
    modalFooterButtonText: { fontWeight: 'bold', color: '#4b5563' },
    infoBox: { backgroundColor: '#eff6ff', padding: 12, borderRadius: 12, marginTop: 12 },
    infoText: { fontSize: 12, color: '#3b82f6', lineHeight: 18, textAlign: 'center' },
    forceCloseButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    forceCloseButton: {
        backgroundColor: '#dc2626',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        marginTop: 16,
        gap: 8,
    },
    addManualBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff7ed',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ffedd5',
        gap: 6,
    },
    addManualBtnText: {
        color: '#ea580c',
        fontWeight: 'bold',
        fontSize: 12,
    },
    adminActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
        marginBottom: 10,
    },
    adminActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 8,
    },
    adminActionBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4b5563',
    },
    modalHeaderInner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#64748b',
        marginBottom: 6,
    },
    textInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#1e293b',
    },
    modalFooterRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        gap: 8,
    },
    // Filter Styles
    filterBar: {
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    filterChipsContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    filterChipActive: {
        backgroundColor: '#fff7ed',
        borderColor: '#ea580c',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
    },
    filterChipTextActive: {
        color: '#ea580c',
    },
    filterToggleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff7ed',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ffedd5',
    },
    filterToggleActive: {
        backgroundColor: '#ea580c',
        borderColor: '#ea580c',
    },
    filterGroupLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#4b5563',
        marginBottom: 12,
    },
    filterChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    modalFilterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    modalFilterChipActive: {
        backgroundColor: '#ea580c',
        borderColor: '#ea580c',
    },
    modalFilterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    modalFilterChipTextActive: {
        color: 'white',
    },
    cashierList: {
        gap: 4,
    },
    cashierItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
    },
    cashierItemActive: {
        backgroundColor: '#fff7ed',
    },
    cashierItemText: {
        fontSize: 14,
        color: '#334155',
    },
    cashierItemTextActive: {
        fontWeight: 'bold',
        color: '#ea580c',
    },
    dateRangeTextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f1f5f9',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
    dateRangeSummaryText: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '500',
    },
    changeDateBtn: {
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
    },
    changeDateBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    modalFooterActions: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    resetFilterBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    resetFilterBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#64748b',
    },
    applyFilterBtn: {
        flex: 2,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#ea580c',
        alignItems: 'center',
    },
    applyFilterBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: 'white',
    }
});
