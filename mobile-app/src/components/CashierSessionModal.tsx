import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, ScrollView, Alert, Animated, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { PrinterManager } from '../lib/PrinterManager';
import { useSession } from '../context/SessionContext';
import { PettyCashService } from '../lib/PettyCashService';
import { X, Lock, Unlock, DollarSign, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import CashierClosingSummaryModal from './CashierClosingSummaryModal';

interface CashierSessionModalProps {
    visible: boolean;
    onClose: () => void;
    mode: 'open' | 'close' | 'force_close';
    session?: any;
    onComplete: () => void;
    currentBranchId?: string;
}

export default function CashierSessionModal({ visible, onClose, mode, session, onComplete, currentBranchId }: CashierSessionModalProps) {
    const [loading, setLoading] = useState(false);
    const [startingCash, setStartingCash] = useState('');
    const [actualCash, setActualCash] = useState('');
    const [notes, setNotes] = useState('');
    const [closingData, setClosingData] = useState<any>(null);
    const [showFullSummary, setShowFullSummary] = useState(false);
    const { branchAddress, branchPhone, storeSettings: sessionSettings } = useSession();
    const [storeSettings, setStoreSettings] = useState<any>(null);
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            if (mode === 'open') {
                setStartingCash('');
                setNotes('');
            } else if ((mode === 'close' || mode === 'force_close') && session) {
                calculateClosingData();
            }
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible, mode, session]);

    const calculateClosingData = async () => {
        if (!session?.opened_at) {
            console.error('[Shift] No session opened_at found');
            return;
        }
        setLoading(true);
        
        const calcTimeout = setTimeout(() => {
            setLoading(false);
            Alert.alert('Perhatian', 'Proses menghitung ringkasan memakan waktu lebih lama. Anda tetap bisa mencoba menutup shift.');
        }, 15000);

        try {
            const { data: settings } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
            if (settings) setStoreSettings(settings);

            const openedAt = new Date(session.opened_at).toISOString();
            const { data: sales, error } = await supabase
                .from('sales')
                .select('*')
                .eq('branch_id', currentBranchId || session.branch_id)
                .gte('date', openedAt);

            if (error) throw error;

            let cash = 0;
            let nonCash = 0;
            let total = 0;
            let totalTax = 0;
            let totalDiscount = 0;
            let completedCount = 0;
            let paySummary: Record<string, number> = {};

            sales?.forEach(sale => {
                const status = (sale.status || '').toLowerCase();
                const isPaid = ['completed', 'selesai', 'paid', 'served', 'success', 'settlement', 'capture', 'ready'].includes(status);
                
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
                    const isCash = lowerMethod === 'cash' || lowerMethod === 'tunai' || lowerMethod === 'uang tunai';
                    if (isCash) cash += amount;
                    else nonCash += amount;
                }
            });

            const saleIds = sales?.map(s => s.id) || [];
            let catSummary: Record<string, number> = {};
            let prodSummary: Record<string, any> = {};

            if (saleIds.length > 0) {
                const fetchItemsInChunks = async (ids: any[]) => {
                    const chunkSize = 200;
                    let allItems: any[] = [];
                    for (let i = 0; i < ids.length; i += chunkSize) {
                        const chunk = ids.slice(i, i + chunkSize);
                        const { data } = await supabase.from('sale_items').select('product_id, product_name, quantity, price').in('sale_id', chunk);
                        if (data) allItems = [...allItems, ...data];
                    }
                    return allItems;
                };

                const items = await fetchItemsInChunks(saleIds);
                if (items?.length > 0) {
                    const soldProductNameList = Array.from(new Set(items.map(i => i.product_name).filter(Boolean)));
                    const soldProductIdList = Array.from(new Set(items.map(i => i.product_id).filter(id => id != null)));

                    const { data: specificProducts } = await supabase.from('products').select('id, name, category')
                        .or(`name.in.(${soldProductNameList.map(n => `"${n}"`).join(',')}),id.in.(${soldProductIdList.join(',')})`);

                    const productCatMap: Record<string, string> = {};
                    const productIdMap: Record<number, string> = {};
                    specificProducts?.forEach(p => {
                        const cat = (p.category || 'LAINNYA').toUpperCase();
                        if (p.name) productCatMap[p.name] = cat;
                        if (p.id) productIdMap[Number(p.id)] = cat;
                    });

                    items.forEach(item => {
                        const name = item.product_name || 'Produk';
                        const productId = item.product_id ? Number(item.product_id) : null;
                        const cat = (productId ? productIdMap[productId] : null) || productCatMap[name] || 'LAINNYA';
                        const qty = Number(item.quantity) || 0;
                        const amount = qty * (Number(item.price) || 0);

                        if (amount > 0) {
                            catSummary[cat] = (catSummary[cat] || 0) + amount;
                            if (!prodSummary[name]) prodSummary[name] = { quantity: 0, amount: 0, category: cat };
                            prodSummary[name].quantity += qty;
                            prodSummary[name].amount += amount;
                        }
                    });
                }
            }

            // [NEW] Fetch Returns during the shift (Subtract from Expected Cash)
            let cashRefunds = 0;
            try {
                const { data: returnData } = await supabase
                    .from('sales_returns')
                    .select('refund_amount, payment_method')
                    .eq('branch_id', currentBranchId || session.branch_id)
                    .gte('created_at', openedAt);
                
                (returnData || []).forEach(ret => {
                    const method = (ret.payment_method || '').toLowerCase().trim();
                    if (['tunai', 'cash', 'uang tunai'].includes(method)) {
                        cashRefunds += (Number(ret.refund_amount) || 0);
                    }
                });
            } catch (err) {
                console.error('[Shift] Error fetching refunds:', err);
            }

            // [NEW] Fetch Petty Cash Expenses during the shift (Subtract from Expected Cash)
            let cashExpenses = 0;
            let cashTopups = 0;
            try {
                const { data: expenseData } = await supabase
                    .from('petty_cash_transactions')
                    .select('amount, type, description')
                    .gte('created_at', openedAt);
                
                (expenseData || []).forEach(exp => {
                    if (exp.type === 'SPEND') {
                        cashExpenses += (Number(exp.amount) || 0);
                    } else if (exp.type === 'TOPUP' && exp.description !== 'Saldo Awal') {
                        cashTopups += (Number(exp.amount) || 0);
                    }
                });
            } catch (err) {
                console.error('[Shift] Error fetching expenses:', err);
            }

            const startCash = parseFloat(session.starting_cash) || 0;
            setClosingData({
                cash_sales: cash,
                non_cash_sales: nonCash,
                cash_refunds: cashRefunds,
                cash_expenses: cashExpenses,
                cash_topups: cashTopups,
                total_sales: total,
                total_tax: totalTax,
                total_discount: totalDiscount,
                total_orders: completedCount, 
                expected_cash: startCash + cash + cashTopups - cashRefunds - cashExpenses,
                payment_summary: Object.entries(paySummary).map(([method, amount]) => ({ method, amount })),
                category_summary: Object.entries(catSummary).map(([name, amount]) => ({ name, amount })),
                product_summary: Object.entries(prodSummary).map(([name, data]) => ({ name, ...data }))
            });
        } catch (err: any) {
            Alert.alert('Error', 'Gagal memuat ringkasan: ' + err.message);
        } finally {
            clearTimeout(calcTimeout);
            setLoading(false);
        }
    };

    const handleOpenSession = async () => {
        const cashValue = parseFloat(startingCash) || 0;
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            if (!currentBranchId) throw new Error('Branch ID tidak ditemukan.');

            const { data: emp } = await supabase.from('employees').select('name').eq('email', user.email).single();
            const realName = emp?.name || user.email?.split('@')[0] || 'Kasir';

            const { error } = await supabase.from('cashier_sessions').insert({
                user_id: user.id,
                branch_id: currentBranchId, 
                employee_name: realName,
                opened_at: new Date().toISOString(),
                starting_cash: cashValue,
                status: 'Open',
                notes: notes
            });
            if (error) throw error;
            onComplete();
            onClose();
        } catch (err: any) {
            Alert.alert('Error', 'Gagal membuka shift: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSession = async () => {
        const actual = parseFloat(actualCash) || 0;
        const expected = closingData?.expected_cash || 0;
        setLoading(true);
        try {
            if (!session?.id) {
                const { data: active } = await supabase.from('cashier_sessions').select('id').eq('status', 'Open').limit(1).maybeSingle();
                if (active) session.id = active.id;
                else throw new Error('Sesi tidak ditemukan.');
            }

            const { error } = await supabase.from('cashier_sessions').update({
                closed_at: new Date().toISOString(),
                status: 'Closed',
                cash_sales: closingData?.cash_sales || 0,
                qris_sales: closingData?.non_cash_sales || 0,
                total_sales: closingData?.total_sales || 0,
                expected_cash: expected,
                actual_cash: actual,
                difference: actual - expected,
                notes: notes
            }).eq('id', session.id);
            if (error) throw error;

            setLoading(false);
            onClose();
            setTimeout(async () => {
                try {
                    // Non-blocking sign out with timeout
                    await Promise.race([
                        supabase.auth.signOut(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Sign out timeout')), 3000))
                    ]).catch(err => console.warn('[Shift] Sign out timeout or error:', err));
                } catch (e) {
                    console.error('[Shift] Final sign out error:', e);
                }
                onComplete();
            }, 500);
        } catch (err: any) {
            Alert.alert('Error', 'Gagal menutup shift: ' + err.message);
            setLoading(false);
        }
    };

    const handlePrintSummary = async () => {
        if (!closingData) return;
        try {
            const dataForReport = {
                ...closingData,
                starting_cash: parseFloat(session?.starting_cash) || 0,
                actual_cash: parseFloat(actualCash) || 0,
                difference: (parseFloat(actualCash) || 0) - (closingData?.expected_cash || 0),
                employee_name: session?.employee_name,
                opened_at: session?.opened_at
            };

            const reportData = {
                shopName: storeSettings?.store_name || 'WINNY COFFEE PNK',
                address: storeSettings?.address || branchAddress || '',
                phone: storeSettings?.phone || branchPhone || '',
                dateRange: `${new Date(dataForReport.opened_at).toLocaleString('id-ID')} - ${new Date().toLocaleString('id-ID')}`,
                totalOrders: dataForReport.total_orders,
                totalSales: dataForReport.total_sales,
                totalTax: dataForReport.total_tax || 0,
                totalDiscount: dataForReport.total_discount || 0,
                paymentSummary: dataForReport.payment_summary,
                categorySummary: dataForReport.category_summary.map((c: any) => ({ category: c.name, amount: c.amount })),
                productSummary: [],
                openingBalance: dataForReport.starting_cash,
                cashTotal: dataForReport.cash_sales,
                qrTotal: dataForReport.non_cash_sales,
                expectedCash: dataForReport.expected_cash,
                actualCash: dataForReport.actual_cash,
                variance: dataForReport.difference,
                generatedBy: dataForReport.employee_name,
                showLogo: true,
                receiptLogoUrl: storeSettings?.receipt_logo_url || storeSettings?.logo_url || sessionSettings?.receipt_logo_url,
                showCategoryOnSummary: storeSettings?.show_category_on_summary !== false,
                paperWidth: storeSettings?.receipt_paper_width === '80mm' ? 48 : 32
            };
            await PrinterManager.printSalesReport(reportData);
        } catch (err) {
            console.error('[Shift] Print Error:', err);
            Alert.alert('Printer Error', 'Gagal mencetak.');
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                    <View style={styles.headerRow}>
                        <View style={[styles.iconBox, { backgroundColor: mode === 'open' ? '#f0fdf4' : '#fff7ed' }]}>
                            {mode === 'open' ? <Unlock size={24} color="#16a34a" /> : <Lock size={24} color="#ea580c" />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.title}>{mode === 'open' ? 'Buka Sesi Baru' : 'Tutup Sesi Kasir'}</Text>
                            <Text style={styles.subtitle}>{mode === 'open' ? 'Input modal awal untuk memulai' : `Shift #${session?.id || '...'}`}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                    
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {mode === 'open' ? (
                            <View style={styles.inputSection}>
                                <Text style={styles.label}>MODAL AWAL TUNAI</Text>
                                <View style={styles.inputWrapper}>
                                    <DollarSign size={20} color="#64748b" style={styles.inputIcon} />
                                    <TextInput style={styles.input} placeholder="0" value={startingCash} onChangeText={setStartingCash} keyboardType="numeric" autoFocus />
                                </View>
                                <Text style={styles.label}>CATATAN SHIFT (OPSIONAL)</Text>
                                <TextInput style={[styles.input, styles.textArea]} placeholder="Cth: Shift Pagi" value={notes} onChangeText={setNotes} multiline numberOfLines={2} />
                            </View>
                        ) : (
                            <View>
                                {loading ? (
                                    <View style={styles.loadingBox}><ActivityIndicator size="large" color="#ea580c" /><Text style={styles.loadingText}>Menghitung Ringkasan...</Text></View>
                                ) : (
                                    <View>
                                        <View style={styles.summaryGrid}>
                                            <View style={styles.summaryItem}>
                                                <Text style={styles.summaryLabel}>TUNAI (SISTEM)</Text>
                                                <Text style={styles.summaryValue}>{formatCurrency(closingData?.cash_sales)}</Text>
                                            </View>
                                            <View style={styles.summaryItem}>
                                                <Text style={styles.summaryLabel}>MODAL AWAL</Text>
                                                <Text style={styles.summaryValue}>{formatCurrency(session?.starting_cash)}</Text>
                                            </View>
                                        </View>
                                        
                                        <View style={styles.expectedBox}>
                                            <Text style={styles.expectedLabel}>TOTAL (TUNAI+SISTEM)</Text>
                                            <Text style={styles.expectedValue}>{formatCurrency(closingData?.expected_cash)}</Text>
                                        </View>

                                        <View style={styles.actualSection}>
                                            <Text style={styles.label}>TOTAL UANG TUNAI DI LACI</Text>
                                            <TextInput style={styles.actualInput} placeholder="0" value={actualCash} onChangeText={setActualCash} keyboardType="numeric" autoFocus />
                                            <Text style={styles.hint}>* Masukkan total uang fisik termasuk modal awal</Text>
                                        </View>

                                        {actualCash !== '' && (
                                            <View style={[styles.diffBox, { backgroundColor: (parseFloat(actualCash) - (closingData?.expected_cash || 0)) === 0 ? '#f0fdf4' : '#fef2f2' }]}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    { (parseFloat(actualCash) - (closingData?.expected_cash || 0)) === 0 ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertTriangle size={16} color="#ef4444" /> }
                                                    <Text style={styles.diffLabel}>Selisih Kas</Text>
                                                </View>
                                                <Text style={[styles.diffValue, { color: (parseFloat(actualCash) - (closingData?.expected_cash || 0)) === 0 ? '#16a34a' : '#ef4444' }]}>
                                                    {formatCurrency(parseFloat(actualCash) - (closingData?.expected_cash || 0))}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.footer}>
                        {mode !== 'open' && (
                            <TouchableOpacity style={styles.summaryBtn} onPress={() => setShowFullSummary(true)} disabled={loading}>
                                <FileText size={18} color="#475569" />
                                <Text style={styles.summaryBtnText}>Lihat Detail</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={loading}>
                            <Text style={styles.cancelBtnText}>Batal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.confirmButton, { backgroundColor: mode === 'open' ? '#16a34a' : '#ea580c' }, loading && styles.disabledButton]} onPress={mode === 'open' ? handleOpenSession : handleCloseSession} disabled={loading}>
                            {loading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.confirmBtnText}>{mode === 'open' ? 'Buka Shift' : 'Tutup Shift'}</Text>}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>

            <CashierClosingSummaryModal visible={showFullSummary} onClose={() => setShowFullSummary(false)} data={closingData ? { ...closingData, starting_cash: parseFloat(session?.starting_cash) || 0, actual_cash: parseFloat(actualCash) || 0, difference: (parseFloat(actualCash) || 0) - (closingData?.expected_cash || 0), employee_name: session?.employee_name, opened_at: session?.opened_at } : null} loading={loading} onPrint={handlePrintSummary} />
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    container: { backgroundColor: 'white', borderRadius: 28, width: '100%', maxWidth: 450, maxHeight: '85%', overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
    headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
    subtitle: { fontSize: 12, color: '#64748b', marginTop: 1 },
    closeBtn: { padding: 6 },
    content: { padding: 20 },
    inputSection: { gap: 12 },
    label: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 4 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1e293b', fontWeight: '600' },
    textArea: { textAlignVertical: 'top', minHeight: 60, paddingHorizontal: 14, backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    loadingBox: { padding: 30, alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#64748b', fontWeight: '600' },
    summaryGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    summaryItem: { flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    summaryLabel: { fontSize: 10, color: '#64748b', fontWeight: '700', marginBottom: 2 },
    summaryValue: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
    expectedBox: { backgroundColor: '#fff7ed', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#ffedd5', marginBottom: 16 },
    expectedLabel: { fontSize: 10, fontWeight: '800', color: '#c2410c', letterSpacing: 0.5, marginBottom: 2 },
    expectedValue: { fontSize: 20, fontWeight: '900', color: '#ea580c' },
    actualSection: { marginBottom: 12 },
    actualInput: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, fontSize: 24, fontWeight: '900', color: '#1e293b', textAlign: 'center' },
    hint: { fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
    diffBox: { padding: 12, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    diffLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
    diffValue: { fontSize: 14, fontWeight: '800' },
    footer: { flexDirection: 'row', padding: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, gap: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#f8fafc' },
    summaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    summaryBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    cancelButton: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
    cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    confirmButton: { flex: 1.5, paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#ea580c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    confirmBtnText: { fontWeight: '800', color: 'white', fontSize: 14 },
    disabledButton: { opacity: 0.5, elevation: 0 }
});

