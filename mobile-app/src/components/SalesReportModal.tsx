import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Platform, TextInput } from 'react-native';
import { X, Printer, Calendar, CheckSquare, Square, ChevronRight, Filter } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { PrinterManager } from '../lib/PrinterManager';
import DateStepper from './DateStepper';

interface SalesReportModalProps {
    visible: boolean;
    onClose: () => void;
    currentBranchId: string;
    branchName: string;
    branchAddress?: string;
    branchPhone?: string;
    userName: string;
    receiptPaperWidth?: string;
    storeSettings?: any;
}

export default function SalesReportModal({
    visible,
    onClose,
    currentBranchId,
    branchName,
    branchAddress,
    branchPhone,
    userName,
    receiptPaperWidth = '58mm',
    storeSettings
}: SalesReportModalProps) {
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'grouped' | 'manual'>('grouped');
    const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'custom'>('today');
    const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [sales, setSales] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        if (visible && currentBranchId && !isNaN(Number(currentBranchId))) {
            fetchSales();
        }
    }, [visible, dateRange, customStartDate, customEndDate, currentBranchId]);

    const fetchSales = async () => {
        if (!currentBranchId || isNaN(Number(currentBranchId))) return;
        try {
            setLoading(true);
            const now = new Date();
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    sale_items (
                        *,
                        product:product_id (name, category)
                    )
                `)
                .eq('branch_id', currentBranchId)
                .order('date', { ascending: false });

            if (dateRange === 'today') {
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                query = query.gte('date', startOfDay.toISOString());
            } else if (dateRange === 'yesterday') {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                const endOfYesterday = new Date();
                endOfYesterday.setHours(0, 0, 0, 0);
                query = query.gte('date', yesterday.toISOString()).lt('date', endOfYesterday.toISOString());
            } else if (dateRange === 'custom') {
                const start = new Date(customStartDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customEndDate);
                end.setHours(23, 59, 59, 999);
                query = query.gte('date', start.toISOString()).lte('date', end.toISOString());
            }

            const { data, error } = await query;
            if (error) throw error;
            setSales(data || []);
            // Default select all in manual mode if fetched
            setSelectedIds((data || []).map(s => s.id));
        } catch (e: any) {
            console.error('Fetch Sales Error:', e);
            Alert.alert('Error', 'Gagal memuat data penjualan: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handlePrint = async () => {
        const targetSales = mode === 'grouped' ? sales : sales.filter(s => selectedIds.includes(s.id));
        
        if (targetSales.length === 0) {
            Alert.alert('Peringatan', 'Tidak ada data penjualan untuk dicetak.');
            return;
        }

        try {
            setPrinting(true);
            
            // Calculate Aggregates
            const totalAmount = targetSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
            const totalTax = targetSales.reduce((sum, s) => sum + (Number(s.tax) || 0), 0);
            const totalDiscount = targetSales.reduce((sum, s) => sum + (Number(s.discount) || 0), 0);
            const totalOrders = targetSales.length;
            
            const paymentMap: Record<string, number> = {};
            const categoryMap: Record<string, number> = {};
            
            targetSales.forEach(sale => {
                const method = sale.payment_method || 'Tunai';
                paymentMap[method] = (paymentMap[method] || 0) + (Number(sale.total_amount) || 0);
                
                sale.sale_items?.forEach((item: any) => {
                    const cat = item.product?.category || 'Lainnya';
                    const amount = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                    categoryMap[cat] = (categoryMap[cat] || 0) + amount;
                });
            });

            const reportData = {
                receiptHeader: storeSettings?.receipt_header || branchName || 'WINNY COFFEE PNK',
                shop_address: storeSettings?.shop_address || branchAddress,
                shop_phone: storeSettings?.shop_phone || branchPhone,
                dateRange: dateRange === 'today' ? 'Hari Ini (' + new Date().toLocaleDateString('id-ID') + ')' : 
                           dateRange === 'yesterday' ? 'Kemarin (' + new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString('id-ID') + ')' :
                           new Date(customStartDate).toLocaleDateString('id-ID') + ' - ' + new Date(customEndDate).toLocaleDateString('id-ID'),
                totalSales: totalAmount,
                totalTax,
                totalDiscount,
                totalOrders,
                paymentSummary: Object.entries(paymentMap).map(([method, amount]) => ({ method, amount })),
                categorySummary: Object.entries(categoryMap).map(([name, amount]) => ({ name, amount })),
                generatedBy: userName,
                receipt_paper_width: receiptPaperWidth,
                showTax: storeSettings?.show_tax_on_report ?? true,
                showDiscount: storeSettings?.show_discount_on_report ?? true,
                showQRISDetails: storeSettings?.show_qris_on_report ?? true,
                showLogo: storeSettings?.show_logo ?? true,
                showDate: storeSettings?.show_date ?? true,
                receiptFooter: storeSettings?.receipt_footer,
                receiptLogoUrl: storeSettings?.receipt_logo_url
            };

            const success = await PrinterManager.printSalesReport(reportData);
            if (success) {
                Alert.alert('Sukses', 'Laporan berhasil dicetak.');
                onClose();
            }
        } catch (e: any) {
            Alert.alert('Gagal Cetak', e.message);
        } finally {
            setPrinting(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Cetak Laporan Penjualan</Text>
                            <Text style={styles.subtitle}>{branchName}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                        {/* Period Selection */}
                        <Text style={styles.sectionTitle}>Periode Laporan</Text>
                        <View style={styles.rangeRow}>
                            <TouchableOpacity 
                                style={[styles.rangeBtn, dateRange === 'today' && styles.rangeBtnActive]}
                                onPress={() => setDateRange('today')}
                            >
                                <Text style={[styles.rangeBtnText, dateRange === 'today' && styles.rangeBtnTextActive]}>Hari Ini</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.rangeBtn, dateRange === 'yesterday' && styles.rangeBtnActive]}
                                onPress={() => setDateRange('yesterday')}
                            >
                                <Text style={[styles.rangeBtnText, dateRange === 'yesterday' && styles.rangeBtnTextActive]}>Kemarin</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.rangeBtn, dateRange === 'custom' && styles.rangeBtnActive]}
                                onPress={() => setDateRange('custom')}
                            >
                                <Text style={[styles.rangeBtnText, dateRange === 'custom' && styles.rangeBtnTextActive]}>Kustom</Text>
                            </TouchableOpacity>
                        </View>

                        {dateRange === 'custom' && (
                            <View style={{ marginBottom: 20 }}>
                                <DateStepper 
                                    label="Mulai:" 
                                    value={customStartDate} 
                                    onChange={setCustomStartDate} 
                                />
                                <DateStepper 
                                    label="Sampai:" 
                                    value={customEndDate} 
                                    onChange={setCustomEndDate} 
                                />
                            </View>
                        )}

                        {/* Mode Selection */}
                        <Text style={styles.sectionTitle}>Metode Seleksi</Text>
                        <View style={styles.modeContainer}>
                            <TouchableOpacity 
                                style={[styles.modeBtn, mode === 'grouped' && styles.modeBtnActive]}
                                onPress={() => setMode('grouped')}
                            >
                                <Filter size={18} color={mode === 'grouped' ? '#ea580c' : '#64748b'} />
                                <Text style={[styles.modeBtnText, mode === 'grouped' && styles.modeBtnTextActive]}>Semua Terfilter ({sales.length})</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modeBtn, mode === 'manual' && styles.modeBtnActive]}
                                onPress={() => setMode('manual')}
                            >
                                <CheckSquare size={18} color={mode === 'manual' ? '#ea580c' : '#64748b'} />
                                <Text style={[styles.modeBtnText, mode === 'manual' && styles.modeBtnTextActive]}>Pilih Manual</Text>
                            </TouchableOpacity>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color="#ea580c" style={{ marginVertical: 40 }} />
                        ) : mode === 'manual' ? (
                            <View style={styles.manualList}>
                                {sales.length === 0 ? (
                                    <Text style={styles.emptyText}>Tidak ada data penjualan.</Text>
                                ) : (
                                    sales.map(sale => (
                                        <TouchableOpacity 
                                            key={sale.id} 
                                            style={styles.saleItem}
                                            onPress={() => toggleSelection(sale.id)}
                                        >
                                            {selectedIds.includes(sale.id) ? (
                                                <CheckSquare size={20} color="#ea580c" />
                                            ) : (
                                                <Square size={20} color="#cbd5e1" />
                                            )}
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={styles.saleOrderNo}>{sale.order_no}</Text>
                                                <Text style={styles.saleInfo}>{sale.customer_name} • {sale.payment_method}</Text>
                                            </View>
                                            <Text style={styles.saleAmount}>Rp {Number(sale.total_amount).toLocaleString('id-ID')}</Text>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        ) : (
                            <View style={styles.receiptPreview}>
                                <View style={styles.paperEffect}>
                                    <View style={styles.receiptHeader}>
                                        {storeSettings?.show_logo && (
                                            <Text style={[styles.receiptTextCenter, { marginBottom: 5, fontWeight: 'bold' }]}>[LOGO]</Text>
                                        )}
                                        <Text style={styles.receiptShopName}>{(storeSettings?.receipt_header || branchName || 'WINNY COFFEE PNK').toUpperCase()}</Text>
                                        {(storeSettings?.shop_address || branchAddress) && <Text style={styles.receiptTextCenter}>{storeSettings?.shop_address || branchAddress}</Text>}
                                        {(storeSettings?.shop_phone || branchPhone) && <Text style={styles.receiptTextCenter}>Telp: {storeSettings?.shop_phone || branchPhone}</Text>}
                                        <Text style={styles.receiptLine}>--------------------------------</Text>
                                        <Text style={styles.receiptTitle}>LAPORAN PENJUALAN</Text>
                                        {storeSettings?.show_date !== false && (
                                            <Text style={styles.receiptTextCenter}>
                                                {dateRange === 'today' ? 'Hari Ini' : dateRange === 'yesterday' ? 'Kemarin' : 'Periode Kustom'}
                                            </Text>
                                        )}
                                        <Text style={styles.receiptLine}>================================</Text>
                                    </View>

                                    <View style={styles.receiptBody}>
                                        <View style={styles.receiptRow}>
                                            <Text style={styles.receiptTextBold}>Transaksi:</Text>
                                            <Text style={styles.receiptTextBold}>{sales.length}</Text>
                                        </View>
                                        <View style={styles.receiptRow}>
                                            <Text style={styles.receiptTextBold}>TOTAL NET:</Text>
                                            <Text style={styles.receiptTextBold}>Rp {sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0).toLocaleString('id-ID')}</Text>
                                        </View>
                                        {(storeSettings?.show_tax_on_report ?? true) && (
                                            <View style={styles.receiptRow}>
                                                <Text style={styles.receiptText}>Total Pajak:</Text>
                                                <Text style={styles.receiptText}>Rp {sales.reduce((sum, s) => sum + (Number(s.tax) || 0), 0).toLocaleString('id-ID')}</Text>
                                            </View>
                                        )}
                                        {(storeSettings?.show_discount_on_report ?? true) && (
                                            <View style={styles.receiptRow}>
                                                <Text style={styles.receiptText}>Total Diskon:</Text>
                                                <Text style={styles.receiptText}>-Rp {sales.reduce((sum, s) => sum + (Number(s.discount) || 0), 0).toLocaleString('id-ID')}</Text>
                                            </View>
                                        )}
                                        <Text style={styles.receiptLine}>--------------------------------</Text>

                                        {sales.length > 0 && (
                                            <>
                                                <Text style={styles.receiptTextBold}>PEMBAYARAN</Text>
                                                {Object.entries(
                                                    sales.reduce((acc: any, s) => {
                                                        const method = s.payment_method || 'Tunai';
                                                        acc[method] = (acc[method] || 0) + (Number(s.total_amount) || 0);
                                                        return acc;
                                                    }, {})
                                                ).map(([method, amount]: any) => (
                                                    <View key={method} style={styles.receiptRow}>
                                                        <Text style={styles.receiptText}>{method}</Text>
                                                        <Text style={styles.receiptText}>{amount.toLocaleString('id-ID')}</Text>
                                                    </View>
                                                ))}
                                                <Text style={styles.receiptLine}>--------------------------------</Text>

                                                <Text style={styles.receiptTextBold}>KATEGORI</Text>
                                                {Object.entries(
                                                    sales.reduce((acc: any, s) => {
                                                        s.sale_items?.forEach((item: any) => {
                                                            const cat = item.product?.category || 'Lainnya';
                                                            const amount = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                                                            acc[cat] = (acc[cat] || 0) + amount;
                                                        });
                                                        return acc;
                                                    }, {})
                                                ).map(([cat, amount]: any) => (
                                                    <View key={cat} style={styles.receiptRow}>
                                                        <Text style={styles.receiptText}>{cat}</Text>
                                                        <Text style={styles.receiptText}>{amount.toLocaleString('id-ID')}</Text>
                                                    </View>
                                                ))}
                                            </>
                                        )}
                                    </View>

                                    <View style={styles.receiptFooter}>
                                        <Text style={styles.receiptLine}>--------------------------------</Text>
                                        <Text style={styles.receiptTextSmall}>Waktu Cetak: {new Date().toLocaleString('id-ID')}</Text>
                                        {userName && <Text style={styles.receiptTextSmall}>Kasir: {userName}</Text>}
                                        
                                        {storeSettings?.receipt_footer && (
                                            <View style={{ marginTop: 10 }}>
                                                <Text style={styles.receiptTextCenter}>{storeSettings.receipt_footer}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity 
                            style={[styles.printBtn, (printing || sales.length === 0) && { opacity: 0.7 }]}
                            onPress={handlePrint}
                            disabled={printing || sales.length === 0}
                        >
                            {printing ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Printer size={20} color="white" />
                                    <Text style={styles.printBtnText}>Cetak Laporan Penjualan</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    title: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    closeBtn: { padding: 4 },
    body: { padding: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '900', color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    rangeRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    rangeBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    rangeBtnActive: { backgroundColor: '#fff7ed', borderColor: '#ea580c' },
    rangeBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    rangeBtnTextActive: { color: '#ea580c' },
    modeContainer: { gap: 10, marginBottom: 24 },
    modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    modeBtnActive: { backgroundColor: '#fff7ed', borderColor: '#ea580c' },
    modeBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    modeBtnTextActive: { color: '#ea580c' },
    manualList: { gap: 8, marginBottom: 20 },
    saleItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'white', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 12 },
    saleOrderNo: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    saleInfo: { fontSize: 12, color: '#64748b', marginTop: 2 },
    saleAmount: { fontSize: 14, fontWeight: '900', color: '#1e293b' },
    summaryPreview: { backgroundColor: '#f8fafc', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20 },
    summaryMain: { alignItems: 'center' },
    summaryMainLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    summaryMainValue: { fontSize: 24, fontWeight: '900', color: '#1e293b', marginVertical: 8 },
    summaryMainSub: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold' },
    emptyText: { textAlign: 'center', color: '#94a3b8', marginVertical: 40 },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    printBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#ea580c', paddingVertical: 16, borderRadius: 14 },
    printBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    receiptPreview: { padding: 10, alignItems: 'center', marginBottom: 20 },
    paperEffect: { 
        backgroundColor: 'white', 
        width: '100%', 
        maxWidth: 320, 
        padding: 20, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.1, 
        shadowRadius: 10, 
        elevation: 5,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    receiptHeader: { alignItems: 'center', marginBottom: 10 },
    receiptShopName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    receiptTextCenter: { fontSize: 12, color: '#475569', textAlign: 'center' },
    customDateContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    dateInputWrapper: { flex: 1 },
    dateInputLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
    dateInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#1e293b' },
    receiptLine: { fontSize: 12, color: '#94a3b8', marginVertical: 5, letterSpacing: -1 },
    receiptTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginVertical: 5 },
    receiptBody: { marginBottom: 10 },
    receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
    receiptTextBold: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
    receiptText: { fontSize: 13, color: '#334155', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    receiptFooter: { alignItems: 'center' },
    receiptTextSmall: { fontSize: 10, color: '#94a3b8', textAlign: 'center' }
});
