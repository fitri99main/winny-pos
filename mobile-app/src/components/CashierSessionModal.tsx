import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { PrinterManager } from '../lib/PrinterManager';
import { PettyCashService } from '../lib/PettyCashService';

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

    useEffect(() => {
        if (visible) {
            if (mode === 'open') {
                setStartingCash('');
                setNotes('');
            } else if ((mode === 'close' || mode === 'force_close') && session) {
                calculateClosingData();
            }
        }
    }, [visible, mode, session]);

    const calculateClosingData = async () => {
        if (!session?.opened_at) {
            console.error('No session opened_at found');
            return;
        }
        setLoading(true);
        try {
            // [MODIFIED] Use ISO string for robust date comparison across timezones
            const openedAt = new Date(session.opened_at).toISOString();

            const { data: sales, error } = await supabase
                .from('sales')
                .select('*')
                .gte('created_at', openedAt);

            if (error) throw error;

            let cash = 0;
            let nonCash = 0;
            let total = 0;
            let completedCount = 0;
            let paySummary: Record<string, number> = {};

            sales?.forEach(sale => {
                const status = (sale.status || '').toLowerCase();
                // [MODIFIED] Broaden paid status check
                const isPaid = ['completed', 'selesai', 'paid', 'served', 'success', 'settlement', 'capture'].includes(status);
                
                if (isPaid) {
                    completedCount++;
                    const amount = (sale.paid_amount || sale.total_amount || 0);
                    total += amount;
                    const rawMethod = sale.payment_method || 'Tunai';
                    const method = rawMethod.trim();
                    paySummary[method] = (paySummary[method] || 0) + amount;

                    const lowerMethod = method.toLowerCase();
                    const isCash = lowerMethod === 'cash' || 
                                  lowerMethod === 'tunai' || 
                                  lowerMethod === 'uang tunai' ||
                                  lowerMethod === 'cash ';

                    if (isCash) cash += amount;
                    else nonCash += amount;
                }
            });

            // Fetch Sale Items for Category & Product Summary
            const saleIds = sales?.map(s => s.id) || [];
            let catSummary: Record<string, number> = {};
            let prodSummary: Record<string, { quantity: number; amount: number; category: string }> = {};

            if (saleIds.length > 0) {
                // [NEW] Robust category lookup maps
                const { data: allProducts } = await supabase.from('products').select('id, name, category');
                const productCatMap: Record<string, string> = {};
                const productIdMap: Record<number, string> = {};
                
                allProducts?.forEach(p => {
                    const cat = (p.category || 'LAINNYA').toUpperCase();
                    if (p.name) productCatMap[p.name] = cat;
                    if (p.id) productIdMap[Number(p.id)] = cat;
                });

                const { data: items, error: itemsError } = await supabase
                    .from('sale_items')
                    .select('product_id, product_name, quantity, price') // Corrected column names
                    .in('sale_id', saleIds);
                
                if (!itemsError && items && items.length > 0) {
                    items.forEach(item => {
                        // [MODIFIED] Multi-layer category lookup
                        const name = item.product_name || 'Produk';
                        const productId = item.product_id ? Number(item.product_id) : null;
                        const cat = (productId ? productIdMap[productId] : null) || productCatMap[name] || 'LAINNYA';
                        
                        const qty = Number(item.quantity) || 0;
                        const price = Number(item.price) || 0;
                        const amount = qty * price;

                        if (amount > 0) {
                            catSummary[cat] = (catSummary[cat] || 0) + amount;
                            if (!prodSummary[name]) prodSummary[name] = { quantity: 0, amount: 0, category: cat };
                            prodSummary[name].quantity += qty;
                            prodSummary[name].amount += amount;
                        }
                    });
                }
            }

            const startCash = parseFloat(session.starting_cash) || 0;
            const finalClosingData = {
                cash_sales: cash,
                non_cash_sales: nonCash,
                total_sales: total,
                total_orders: completedCount, 
                expected_cash: startCash + cash,
                payment_summary: Object.entries(paySummary).map(([method, amount]) => ({ method, amount })),
                category_summary: Object.entries(catSummary).map(([name, amount]) => ({ name, amount })),
                product_summary: Object.entries(prodSummary).map(([name, data]) => ({ 
                    name, 
                    quantity: data.quantity, 
                    amount: data.amount,
                    category: data.category
                }))
            };
            setClosingData(finalClosingData);
        } catch (err: any) {
            console.error('Error calculating closing:', err);
            Alert.alert('Error', 'Gagal memuat ringkasan shift: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenSession = async () => {
        const cashValue = parseFloat(startingCash) || 0;
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            if (!currentBranchId) throw new Error('Branch ID tidak ditemukan. Hubungi Administrator.');

            const newSession = {
                user_id: user.id,
                branch_id: currentBranchId, 
                employee_name: user.email?.split('@')[0] || 'Kasir',
                opened_at: new Date().toISOString(),
                starting_cash: cashValue,
                status: 'Open',
                notes: notes
            };

            const { error } = await supabase.from('cashier_sessions').insert(newSession);
            if (error) throw error;

            onComplete();
            onClose();
        } catch (err: any) {
            Alert.alert('Error', 'Gagal membuka shift: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintReport = async (data: any) => {
        try {
            const { data: settings } = await supabase.from('store_settings').select('*').single();
            const reportData = {
                shopName: settings?.store_name || 'WINNY COFFEE PNK',
                address: settings?.address || '',
                phone: settings?.phone || '',
                dateRange: `${new Date(session.opened_at).toLocaleString('id-ID')} - ${new Date().toLocaleString('id-ID')}`,
                totalOrders: data.total_orders || 0,
                totalSales: data.total_sales,
                totalTax: 0,
                totalDiscount: 0,
                paymentSummary: data.payment_summary || [],
                categorySummary: (data.category_summary || []).map((c: any) => ({ category: c.name, amount: c.amount })),
                productSummary: (data.product_summary || []).map((p: any) => ({
                    ...p,
                    name: p.category ? `[${p.category}] ${p.name}` : p.name
                })),
                openingBalance: parseFloat(session.starting_cash),
                cashTotal: data.cash_sales,
                qrTotal: data.non_cash_sales,
                expectedCash: data.expected_cash,
                actualCash: parseFloat(actualCash),
                variance: parseFloat(actualCash) - data.expected_cash,
                generatedBy: session.employee_name || 'Kasir',
                showLogo: true,
                receiptLogoUrl: settings?.logo_url
            };

            await PrinterManager.printSalesReport(reportData);
        } catch (printErr: any) {
            console.error('Print error:', printErr);
            Alert.alert('Printer Error', 'Gagal mencetak laporan: ' + printErr.message);
        }
    };

    const handleCloseSession = async () => {
        const actual = parseFloat(actualCash) || 0;
        const expected = closingData?.expected_cash || 0;
        const difference = actual - expected;

        setLoading(true);
        try {
            const updateData = {
                closed_at: new Date().toISOString(),
                status: 'Closed',
                cash_sales: closingData?.cash_sales || 0,
                card_sales: 0,
                qris_sales: closingData?.non_cash_sales || 0,
                total_sales: closingData?.total_sales || 0,
                expected_cash: expected,
                actual_cash: actual,
                difference: difference,
                notes: notes
            };

            if (!session?.id) {
                throw new Error('ID sesi tidak ditemukan. Sesi mungkin sudah tertutup atau belum dibuat.');
            }

            const { data, error } = await supabase
                .from('cashier_sessions')
                .update(updateData)
                .eq('id', session.id)
                .select(); 

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('Gagal memperbarui shift di database. Sesi tidak ditemukan.');
            }

            await handlePrintReport(closingData);

            // [NEW] Automatic Petty Cash Deposit
            try {
                const branchId = currentBranchId || '7';
                const activePcSession = await PettyCashService.getActiveSession(branchId);
                if (activePcSession) {
                    await PettyCashService.addTransaction({
                        session_id: activePcSession.id,
                        type: 'TOPUP',
                        amount: actual,
                        description: `Setoran Kasir: Shift #${session.id}`,
                        reference_type: 'cashier_closing',
                        reference_id: String(session.id)
                    });
                }
            } catch (pcErr) {
                console.error('Petty Cash Deposit Error:', pcErr);
            }

            Alert.alert(
                'Shift Ditutup', 
                `Selisih: ${formatCurrency(difference)}`,
                [
                    { 
                        text: 'OK', 
                        onPress: async () => {
                            await supabase.auth.signOut();
                            onComplete();
                            onClose();
                        }
                    }
                ]
            );
        } catch (err: any) {
            Alert.alert('Error', 'Gagal menutup shift: ' + err.message);
        } finally {
            setLoading(true);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>
                        {mode === 'open' ? 'Buka Shift Kasir' : (mode === 'force_close' ? 'Tutup Paksa Shift' : 'Tutup Shift Kasir')}
                    </Text>
                    
                    <ScrollView style={styles.content}>
                        {mode === 'open' ? (
                            <View>
                                <Text style={styles.label}>Modal Awal (Cash)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    value={startingCash}
                                    onChangeText={setStartingCash}
                                    keyboardType="numeric"
                                    autoFocus
                                />
                                <Text style={styles.label}>Catatan</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Cth: Shift Pagi"
                                    value={notes}
                                    onChangeText={setNotes}
                                />
                            </View>
                        ) : (
                            <View>
                                {loading ? (
                                    <ActivityIndicator size="large" color="#ea580c" style={{ margin: 20 }} />
                                ) : (
                                    <View>
                                        <View style={styles.summaryCard}>
                                            <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>Penjualan Tunai</Text>
                                                <Text style={styles.summaryValue}>{formatCurrency(closingData?.cash_sales)}</Text>
                                            </View>
                                            <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>Modal Awal</Text>
                                                <Text style={styles.summaryValue}>{formatCurrency(session?.starting_cash)}</Text>
                                            </View>
                                            <View style={[styles.summaryRow, styles.summaryTotal]}>
                                                <Text style={styles.summaryLabelLarge}>Total Seharusnya</Text>
                                                <Text style={styles.summaryValueLarge}>{formatCurrency(closingData?.expected_cash)}</Text>
                                            </View>
                                        </View>

                                        <Text style={styles.label}>Uang Tunai Fisik (Laci)</Text>
                                        <TextInput
                                            style={styles.inputLarge}
                                            placeholder="0"
                                            value={actualCash}
                                            onChangeText={setActualCash}
                                            keyboardType="numeric"
                                            autoFocus
                                        />

                                        {actualCash !== '' && (
                                            <View style={[styles.diffCard, { backgroundColor: (parseFloat(actualCash) - (closingData?.expected_cash || 0)) === 0 ? '#f0fdf4' : '#fef2f2' }]}>
                                                <Text style={styles.diffLabel}>Selisih</Text>
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
                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
                            <Text style={styles.cancelText}>Batal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.button, styles.confirmButton, loading && styles.disabledButton]} 
                            onPress={mode === 'open' ? handleOpenSession : handleCloseSession}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.confirmText}>{mode === 'open' ? 'Buka Shift' : (mode === 'force_close' ? 'Tutup Paksa' : 'Tutup Shift')}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    container: { backgroundColor: 'white', borderRadius: 24, padding: 24, maxHeight: '90%' },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#111827' },
    content: { marginBottom: 20 },
    label: { fontSize: 13, color: '#6b7280', marginBottom: 8, fontWeight: 'bold' },
    input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 16 },
    inputLarge: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
    summaryCard: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 16, marginBottom: 20 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    summaryLabel: { color: '#6b7280', fontSize: 13 },
    summaryValue: { fontWeight: 'bold', color: '#111827' },
    summaryTotal: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
    summaryLabelLarge: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
    summaryValueLarge: { fontSize: 16, fontWeight: 'bold', color: '#ea580c' },
    diffCard: { padding: 12, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    diffLabel: { fontSize: 13, fontWeight: 'bold', color: '#4b5563' },
    diffValue: { fontSize: 14, fontWeight: 'bold' },
    footer: { flexDirection: 'row', gap: 12 },
    button: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: '#f3f4f6' },
    confirmButton: { backgroundColor: '#ea580c' },
    disabledButton: { opacity: 0.7 },
    cancelText: { fontWeight: 'bold', color: '#4b5563' },
    confirmText: { fontWeight: 'bold', color: 'white' }
});
