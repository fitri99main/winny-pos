import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform, Image, Animated } from 'react-native';
import { X, Printer, TrendingUp, DollarSign, ShoppingBag, PieChart, Info, Calendar, User, Eye } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import ShiftSummaryPreviewModal from './ShiftSummaryPreviewModal';

interface SummaryData {
    cash_sales: number;
    non_cash_sales: number;
    total_sales: number;
    total_orders: number;
    expected_cash: number;
    payment_summary: { method: string; amount: number }[];
    category_summary: { name: string; amount: number }[];
    product_summary?: { name: string; quantity: number; amount: number; category?: string }[];
    starting_cash: number;
    actual_cash?: number;
    difference?: number;
    employee_name?: string;
    opened_at?: string;
    closed_at?: string;
}

interface CashierClosingSummaryModalProps {
    visible: boolean;
    onClose: () => void;
    data: SummaryData | null;
    loading?: boolean;
    onPrint?: () => void;
    title?: string;
}

export default function CashierClosingSummaryModal({
    visible,
    onClose,
    data,
    loading,
    onPrint,
    title = 'RINGKASAN SHIFT'
}: CashierClosingSummaryModalProps) {
    const [storeSettings, setStoreSettings] = React.useState<any>(null);
    const [showPreview, setShowPreview] = React.useState(false);
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
            fetchStoreSettings();
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible]);

    const fetchStoreSettings = async () => {
        try {
            const { data: settings } = await supabase.from('store_settings').select('*').single();
            setStoreSettings(settings);
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    };
    
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { 
            style: 'currency', 
            currency: 'IDR', 
            minimumFractionDigits: 0 
        }).format(val || 0);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handlePreview = () => {
        setShowPreview(true);
    };

    if (!visible) return null;

    const reportData = data ? {
        shopName: storeSettings?.store_name || 'WINNY COFFEE PNK',
        address: storeSettings?.address || '',
        phone: storeSettings?.phone || '',
        dateRange: `${new Date(data.opened_at || Date.now()).toLocaleString('id-ID')} - ${data.closed_at ? new Date(data.closed_at).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')}`,
        totalOrders: data.total_orders,
        totalSales: data.total_sales,
        cashTotal: data.cash_sales,
        qrTotal: data.non_cash_sales,
        openingBalance: data.starting_cash,
        expectedCash: data.expected_cash,
        actualCash: data.actual_cash,
        variance: data.difference,
        generatedBy: data.employee_name,
        categorySummary: data.category_summary,
        paperWidth: storeSettings?.receipt_paper_width === '80mm' ? 48 : 32
    } : null;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                    <View style={styles.header}>
                        <View style={styles.titleWrapper}>
                            <PieChart size={22} color="#1e293b" />
                            <Text style={styles.title}>{title}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#ea580c" />
                            <Text style={styles.loadingText}>Menyusun Laporan...</Text>
                        </View>
                    ) : !data ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>Data tidak ditemukan</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                            {/* Meta Info */}
                            <View style={styles.metaContainer}>
                                <View style={styles.metaRow}>
                                    <User size={14} color="#64748b" />
                                    <Text style={styles.metaText}>Kasir: {data.employee_name || 'Kasir'}</Text>
                                </View>
                                <View style={styles.metaRow}>
                                    <Calendar size={14} color="#64748b" />
                                    <Text style={styles.metaText}>{formatDate(data.opened_at)} {data.closed_at ? ` - ${formatDate(data.closed_at)}` : '(Aktif)'}</Text>
                                </View>
                            </View>

                            {/* Main Stats */}
                            <View style={styles.statsGrid}>
                                <View style={styles.statCard}>
                                    <ShoppingBag size={20} color="#3b82f6" />
                                    <Text style={styles.statLabel}>Total Order</Text>
                                    <Text style={styles.statValue}>{data.total_orders}</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <TrendingUp size={20} color="#10b981" />
                                    <Text style={styles.statLabel}>Total Sales</Text>
                                    <Text style={styles.statValue}>{formatCurrency(data.total_sales)}</Text>
                                </View>
                            </View>

                            <View style={[styles.statsGrid, { marginTop: 10 }]}>
                                <View style={styles.statCard}>
                                    <TrendingUp size={20} color="#f59e0b" />
                                    <Text style={styles.statLabel}>Rata-rata Order</Text>
                                    <Text style={styles.statValue}>
                                        {formatCurrency(data.total_orders > 0 ? Math.round(data.total_sales / data.total_orders) : 0)}
                                    </Text>
                                </View>
                            </View>

                            {/* Payment Breakdown */}
                            <View style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>DETAIL PEMBAYARAN</Text>
                                {data.payment_summary.map((p, idx) => (
                                    <View key={idx} style={styles.itemRow}>
                                        <Text style={styles.itemLabel}>{p.method.toUpperCase()}</Text>
                                        <Text style={styles.itemValue}>{formatCurrency(p.amount)}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Reconciliation */}
                            <View style={[styles.sectionCard, styles.darkCard]}>
                                <Text style={[styles.sectionTitle, { color: '#f8fafc' }]}>REKONSILIASI TUNAI</Text>
                                <View style={styles.itemRow}>
                                    <Text style={styles.itemLabelLight}>TUNAI (SISTEM)</Text>
                                    <Text style={styles.itemValueLight}>{formatCurrency(data.cash_sales)}</Text>
                                </View>
                                <View style={styles.itemRow}>
                                    <Text style={styles.itemLabelLight}>MODAL AWAL</Text>
                                    <Text style={styles.itemValueLight}>{formatCurrency(data.starting_cash)}</Text>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.itemRow}>
                                    <Text style={styles.itemLabelHighlight}>TOTAL (TUNAI+TUNAI SISTEM)</Text>
                                    <Text style={styles.itemValueHighlight}>{formatCurrency(data.expected_cash)}</Text>
                                </View>
                                {data.actual_cash !== undefined && (
                                    <>
                                        <View style={styles.itemRow}>
                                            <Text style={styles.itemLabelLight}>KAS FISIK KASIR (TUTUP KASIR)</Text>
                                            <Text style={styles.itemValueLight}>{formatCurrency(data.actual_cash)}</Text>
                                        </View>
                                        <View style={styles.itemRow}>
                                            <Text style={[styles.itemLabelHighlight, { color: (data.difference || 0) >= 0 ? '#4ade80' : '#f87171' }]}>SELISIH</Text>
                                            <Text style={[styles.itemValueHighlight, { color: (data.difference || 0) >= 0 ? '#4ade80' : '#f87171' }]}>
                                                {formatCurrency(data.difference || 0)}
                                            </Text>
                                        </View>
                                    </>
                                )}
                            </View>

                            {/* Category Breakdown */}
                            {data.category_summary.length > 0 && (
                                <View style={styles.sectionCard}>
                                    <Text style={styles.sectionTitle}>PENJUALAN PER KATEGORI</Text>
                                    {data.category_summary.map((cat, idx) => (
                                        <View key={idx} style={styles.itemRow}>
                                            <Text style={styles.itemLabel}>{cat.name}</Text>
                                            <Text style={styles.itemValue}>{formatCurrency(cat.amount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    )}

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.closeBtnFooter} onPress={onClose}>
                            <Text style={styles.closeBtnText}>Tutup</Text>
                        </TouchableOpacity>
                        {onPrint && (
                            <>
                                <TouchableOpacity 
                                    style={[styles.printBtn, { backgroundColor: '#f1f5f9', flex: 1 }]} 
                                    onPress={handlePreview} 
                                    disabled={loading}
                                >
                                    <Eye size={18} color="#64748b" />
                                    <Text style={[styles.printBtnText, { color: '#64748b', fontSize: 12 }]}>Pratinjau</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.printBtn, { flex: 1.2 }]} 
                                    onPress={onPrint} 
                                    disabled={loading}
                                >
                                    <Printer size={18} color="white" />
                                    <Text style={[styles.printBtnText, { fontSize: 12 }]}>Cetak</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </Animated.View>
            </View>

            <ShiftSummaryPreviewModal 
                visible={showPreview}
                onClose={() => setShowPreview(false)}
                data={reportData}
                onPrint={() => {
                    setShowPreview(false);
                    onPrint?.();
                }}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'flex-end' },
    container: { backgroundColor: '#f8fafc', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '88%', width: '100%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
    titleWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
    closeBtn: { padding: 4 },
    content: { flex: 1, padding: 16 },
    metaContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, backgroundColor: 'white', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    statCard: { flex: 1, backgroundColor: 'white', padding: 14, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', elevation: 2 },
    statLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', marginTop: 6 },
    statValue: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginTop: 2 },
    sectionCard: { backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
    darkCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
    sectionTitle: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 12 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    itemLabel: { fontSize: 12, color: '#475569', fontWeight: '600' },
    itemValue: { fontSize: 12, color: '#1e293b', fontWeight: '700' },
    itemLabelLight: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
    itemValueLight: { fontSize: 12, color: '#f1f5f9', fontWeight: '600' },
    itemLabelHighlight: { fontSize: 13, color: '#f8fafc', fontWeight: '800' },
    itemValueHighlight: { fontSize: 13, color: '#fb923c', fontWeight: '800' },
    divider: { height: 1, backgroundColor: '#334155', marginVertical: 8 },
    footer: { flexDirection: 'row', padding: 20, gap: 10, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    closeBtnFooter: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16, backgroundColor: '#f1f5f9' },
    closeBtnText: { fontSize: 13, fontWeight: '800', color: '#64748b' },
    printBtn: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: '#ea580c' },
    printBtnText: { fontSize: 13, fontWeight: '800', color: 'white' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#64748b', fontWeight: '600' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: '#ef4444', fontWeight: '700' }
});


