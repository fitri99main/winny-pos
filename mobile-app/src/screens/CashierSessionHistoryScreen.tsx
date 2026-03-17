import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, StyleSheet, useWindowDimensions, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Clock, User, DollarSign, TrendingUp, ChevronLeft, Calendar, Search, Eye, Power } from 'lucide-react-native';
import { useSession } from '../context/SessionContext';
import CashierSessionModal from '../components/CashierSessionModal';

interface CashierSession {
    id: string;
    employee_name: string;
    opened_at: string;
    closed_at: string | null;
    starting_cash: number;
    ending_cash: number | null;
    total_sales: number;
    expected_cash: number;
    variance: number;
    status: 'Open' | 'Closed';
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
    const { currentBranchId, isAdmin } = useSession();

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('cashier_sessions')
                .select('*')
                .eq('branch_id', currentBranchId)
                .order('opened_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setSessions(data || []);
        } catch (error: any) {
            console.error('Fetch Sessions Error:', error);
            Alert.alert('Error', 'Gagal memuat riwayat shift: ' + error.message);
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
    const totalVariance = sessions.filter(s => s.status === 'Closed').reduce((sum, s) => sum + (s.variance || 0), 0);

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
                        <ChevronLeft size={28} color="#1f2937" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Riwayat Kasir</Text>
                    <TouchableOpacity onPress={fetchSessions} style={{ marginLeft: 'auto' }}>
                        <Text style={{ fontSize: 20 }}>🔄</Text>
                    </TouchableOpacity>
                </View>

                {/* Summary View */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.summaryContainer}
                >
                    {renderSummaryCard(<Clock size={20} color="#3b82f6" />, "Total Shift", sessions.length.toString(), "#3b82f6")}
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
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ padding: 16 }}
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
                                            item.variance >= 0 ? styles.textSuccess : styles.textDanger
                                        ]}>
                                            {formatCurrency(item.variance || 0)}
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
                                    <Text style={styles.detailLabel}>MODAL AWAL</Text>
                                    <Text style={styles.detailValue}>{formatCurrency(selectedSession.starting_cash)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>TOTAL PENJUALAN</Text>
                                    <Text style={[styles.detailValue, styles.textSuccess]}>{formatCurrency(selectedSession.total_sales)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>UANG AKHIR (FISIK)</Text>
                                    <Text style={styles.detailValue}>{formatCurrency(selectedSession.ending_cash || 0)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>SELISIH (VARIANCE)</Text>
                                    <Text style={[
                                        styles.detailValue, 
                                        styles.bold,
                                        selectedSession.variance >= 0 ? styles.textSuccess : styles.textDanger
                                    ]}>
                                        {formatCurrency(selectedSession.variance)}
                                    </Text>
                                </View>
                                
                                {selectedSession.status === 'Open' && (
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoText}>Shift ini masih terbuka. Data penjualan akan terus diperbarui sampai shift ditutup.</Text>
                                    </View>
                                )}

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
    backButton: { marginRight: 12 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    summaryContainer: { padding: 16, gap: 12 },
    summaryCard: {
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 160,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    summaryIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryLabel: { fontSize: 10, color: '#6b7280', fontWeight: '500' },
    summaryValue: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
    card: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    cashierInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    userIconContainer: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
    cashierName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusOpen: { backgroundColor: '#f0fdf4' },
    statusClosed: { backgroundColor: '#f3f4f6' },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    statusTextOpen: { color: '#16a34a' },
    statusTextClosed: { color: '#6b7280' },
    timeInfo: { gap: 4, marginBottom: 12, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f9fafb' },
    timeRow: { flexDirection: 'row', gap: 8 },
    timeLabel: { fontSize: 12, color: '#6b7280', width: 45 },
    timeValue: { fontSize: 12, color: '#374151', fontWeight: '500' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
    footerLabel: { fontSize: 10, color: '#9ca3af', marginBottom: 2 },
    footerValue: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
    varianceContainer: { alignItems: 'flex-end' },
    varianceValue: { fontSize: 14, fontWeight: 'bold' },
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
    forceCloseButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
