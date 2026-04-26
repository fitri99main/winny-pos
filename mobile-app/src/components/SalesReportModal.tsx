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
    const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'custom'>('today');
    const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
    const [sales, setSales] = useState<any[]>([]);
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchCategories();
        }
    }, [visible]);

    const getTargetCategory = (item: any) => {
        const cat = (item.product?.category || '').toLowerCase();
        const name = (item.product?.name || item.name || '').toLowerCase();
        
        // Use the same keywords as the web version (ReportsView.tsx)
        const coffeeKeywords = ['kopi', 'coffee', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'macchiato', 'v60', 'vietnam drip'];
        const drinkKeywords = ['minum', 'teh', 'jus', 'juice', 'susu', 'milk', 'tea', 'soda', 'es ', 'ice', 'beverage', 'smoothie'];
        
        if (cat.includes('makan')) return 'Makanan';
        if (cat.includes('snack')) return 'Snack';
        if (cat.includes('non kopi') || cat.includes('non-kopi')) return 'Minuman Non Kopi';
        if (cat.includes('kopi')) return 'Minuman Kopi';
        
        // Fallback detections
        if (coffeeKeywords.some(kw => name.includes(kw))) return 'Minuman Kopi';
        if (drinkKeywords.some(kw => cat.includes(kw) || name.includes(kw))) return 'Minuman Non Kopi';
        if (cat.includes('produk') || cat.includes('kemasan')) return 'Snack';
        
        return 'Lainnya';
    };

    const fetchCategories = async () => {
        // As requested: Only these 4 categories in the filter and report
        setCategories(['Minuman Kopi', 'Minuman Non Kopi', 'Makanan', 'Snack']);
    };

    useEffect(() => {
        if (visible && currentBranchId) {
            fetchSales();
        }
    }, [visible, dateRange, customStartDate, customEndDate, currentBranchId, selectedCategory]);

    const fetchSales = async () => {
        if (!currentBranchId) return;
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
            } else if (dateRange === '7days') {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
                sevenDaysAgo.setHours(0, 0, 0, 0);
                query = query.gte('date', sevenDaysAgo.toISOString());
            } else if (dateRange === '30days') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
                thirtyDaysAgo.setHours(0, 0, 0, 0);
                query = query.gte('date', thirtyDaysAgo.toISOString());
            } else if (dateRange === 'custom') {
                const start = new Date(customStartDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customEndDate);
                end.setHours(23, 59, 59, 999);
                query = query.gte('date', start.toISOString()).lte('date', end.toISOString());
            }

            let allSales: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await query.range(from, from + pageSize - 1);
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

            setSales(allSales);
        } catch (e: any) {
            console.error('Fetch Sales Error:', e);
            Alert.alert('Error', 'Gagal memuat data penjualan: ' + e.message);
        } finally {
            setLoading(false);
        }
    };



    const handlePrint = async () => {
        let targetSales = sales;
        
        // Filter items by category if selected
        if (selectedCategory !== 'Semua') {
            targetSales = sales.map(sale => ({
                ...sale,
                sale_items: sale.sale_items?.filter((item: any) => getTargetCategory(item) === selectedCategory)
            })).filter(sale => sale.sale_items && sale.sale_items.length > 0);
        }
        
        if (targetSales.length === 0) {
            Alert.alert('Peringatan', 'Tidak ada data penjualan untuk kategori ini.');
            return;
        }

        try {
            setPrinting(true);
            
            // Calculate Aggregates based on filtered items
            let totalAmount = 0;
            let totalTax = 0;
            let totalDiscount = 0;
            const totalOrders = targetSales.length;
            
            const paymentMap: Record<string, number> = {};
            const categoryMap: Record<string, number> = {};
            
            targetSales.forEach(sale => {
                let saleAmount = 0;
                sale.sale_items?.forEach((item: any) => {
                    const amount = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                    saleAmount += amount;
                    
                    const cat = item.product?.category || 'Lainnya';
                    categoryMap[cat] = (categoryMap[cat] || 0) + amount;
                });

                // If filtering by category, we only count the items' subtotal for the payment map
                // Note: Tax and Discount are usually sale-level, but if we filter by category, 
                // it's tricky to attribute them. We'll show the item totals.
                const method = sale.payment_method || 'Tunai';
                paymentMap[method] = (paymentMap[method] || 0) + saleAmount;
                
                totalAmount += saleAmount;
                // Add proportional tax/discount or ignore for category specific? 
                // Standard practice is to show item totals for category reports.
            });

            const reportData = {
                receiptHeader: storeSettings?.receipt_header || branchName || 'WINNY COFFEE PNK',
                shop_address: storeSettings?.shop_address || branchAddress,
                shop_phone: storeSettings?.shop_phone || branchPhone,
                dateRange: (dateRange === 'today' ? 'Hari Ini (' + new Date().toLocaleDateString('id-ID') + ')' : 
                           dateRange === '7days' ? '7 Hari Terakhir' :
                           dateRange === '30days' ? '30 Hari Terakhir' :
                           new Date(customStartDate).toLocaleDateString('id-ID') + ' - ' + new Date(customEndDate).toLocaleDateString('id-ID')) + 
                           (selectedCategory !== 'Semua' ? `\nKategori: ${selectedCategory}` : ''),
                totalSales: totalAmount,
                totalTax: 0, // Tax is sale-level, usually omitted in category reports
                totalDiscount: 0, // Discount is sale-level
                totalOrders,
                paymentSummary: Object.entries(paymentMap).map(([method, amount]) => ({ method, amount })),
                categorySummary: Object.entries(categoryMap)
                    .map(([name, amount]) => ({ name, amount }))
                    .sort((a, b) => {
                        const priority = ['Minuman Kopi', 'Minuman Non Kopi', 'Makanan', 'Snack'];
                        const scoreA = priority.indexOf(a.name);
                        const scoreB = priority.indexOf(b.name);
                        return (scoreA === -1 ? 999 : scoreA) - (scoreB === -1 ? 999 : scoreB);
                    }),
                generatedBy: userName,
                receipt_paper_width: receiptPaperWidth,
                showTax: selectedCategory === 'Semua' ? (storeSettings?.show_tax_on_report ?? true) : false,
                showDiscount: selectedCategory === 'Semua' ? (storeSettings?.show_discount_on_report ?? true) : false,
                showQRISDetails: storeSettings?.show_qris_on_report ?? true,
                showCategoryOnSummary: storeSettings?.show_category_on_summary !== false,
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
                        <Text style={styles.sectionTitle}>Metode Seleksi (Filter)</Text>
                        <View style={styles.rangeRow}>
                            <TouchableOpacity 
                                style={[styles.rangeBtn, dateRange === 'today' && styles.rangeBtnActive]}
                                onPress={() => setDateRange('today')}
                            >
                                <Text style={[styles.rangeBtnText, dateRange === 'today' && styles.rangeBtnTextActive]}>Hari Ini</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.rangeBtn, dateRange === '7days' && styles.rangeBtnActive]}
                                onPress={() => setDateRange('7days')}
                            >
                                <Text style={[styles.rangeBtnText, dateRange === '7days' && styles.rangeBtnTextActive]}>7 Hari</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.rangeBtn, dateRange === '30days' && styles.rangeBtnActive]}
                                onPress={() => setDateRange('30days')}
                            >
                                <Text style={[styles.rangeBtnText, dateRange === '30days' && styles.rangeBtnTextActive]}>30 Hari</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.rangeBtn, dateRange === 'custom' && styles.rangeBtnActive]}
                                onPress={() => setDateRange('custom')}
                            >
                                <Text style={[styles.rangeBtnText, dateRange === 'custom' && styles.rangeBtnTextActive]}>Rentang</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Category Filter */}
                        <Text style={styles.sectionTitle}>Kategori Produk</Text>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            style={{ marginBottom: 20 }}
                            contentContainerStyle={{ gap: 8 }}
                        >
                            <TouchableOpacity 
                                style={[styles.rangeBtn, selectedCategory === 'Semua' && styles.rangeBtnActive, { width: 100 }]}
                                onPress={() => setSelectedCategory('Semua')}
                            >
                                <Text style={[styles.rangeBtnText, selectedCategory === 'Semua' && styles.rangeBtnTextActive]}>Semua</Text>
                            </TouchableOpacity>
                            {categories.map(cat => (
                                <TouchableOpacity 
                                    key={cat}
                                    style={[styles.rangeBtn, selectedCategory === cat && styles.rangeBtnActive, { paddingHorizontal: 16 }]}
                                    onPress={() => setSelectedCategory(cat)}
                                >
                                    <Text style={[styles.rangeBtnText, selectedCategory === cat && styles.rangeBtnTextActive]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

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

                        {loading ? (
                            <ActivityIndicator size="large" color="#ea580c" style={{ marginVertical: 40 }} />
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
                                                {dateRange === 'today' ? 'Hari Ini' : dateRange === '7days' ? '7 Hari Terakhir' : dateRange === '30days' ? '30 Hari Terakhir' : 'Periode Kustom'}
                                                {selectedCategory !== 'Semua' && `\nKategori: ${selectedCategory}`}
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
                                            <Text style={styles.receiptTextBold}>
                                                Rp {(() => {
                                                    const filteredSales = selectedCategory === 'Semua' ? sales : 
                                                        sales.map(sale => ({
                                                            ...sale,
                                                            sale_items: sale.sale_items?.filter((item: any) => (item.product?.category || 'Lainnya') === selectedCategory)
                                                        })).filter(sale => sale.sale_items && sale.sale_items.length > 0);
                                                    
                                                    const total = filteredSales.reduce((sum, s) => {
                                                        if (selectedCategory === 'Semua') return sum + (Number(s.total_amount) || 0);
                                                        const saleItemTotal = s.sale_items?.reduce((itemSum: number, item: any) => itemSum + (Number(item.price) * Number(item.quantity)), 0) || 0;
                                                        return sum + saleItemTotal;
                                                    }, 0);
                                                    return total.toLocaleString('id-ID');
                                                })()}
                                            </Text>
                                        </View>
                                        <View style={styles.receiptRow}>
                                            <Text style={styles.receiptText}>Rata-rata/Order:</Text>
                                            <Text style={styles.receiptText}>Rp {sales.length > 0 ? Math.round(sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0) / sales.length).toLocaleString('id-ID') : 0}</Text>
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
                                                            const cat = getTargetCategory(item);
                                                            const amount = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                                                            acc[cat] = (acc[cat] || 0) + amount;
                                                        });
                                                        return acc;
                                                    }, {})
                                                ).sort((a, b) => {
                                                    const priority = ['Minuman Kopi', 'Minuman Non Kopi', 'Makanan', 'Snack'];
                                                    const scoreA = priority.indexOf(a[0]);
                                                    const scoreB = priority.indexOf(b[0]);
                                                    return (scoreA === -1 ? 999 : scoreA) - (scoreB === -1 ? 999 : scoreB);
                                                }).map(([cat, amount]: any) => (
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
    body: { padding: 16 },
    sectionTitle: { fontSize: 13, fontWeight: '900', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
    rangeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    rangeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    rangeBtnActive: { backgroundColor: '#fff7ed', borderColor: '#ea580c' },
    rangeBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    rangeBtnTextActive: { color: '#ea580c' },
    modeContainer: { gap: 10, marginBottom: 16 },
    modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    modeBtnActive: { backgroundColor: '#fff7ed', borderColor: '#ea580c' },
    modeBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
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
