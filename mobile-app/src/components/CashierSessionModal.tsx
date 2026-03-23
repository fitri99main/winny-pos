import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

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
            const { data: sales, error } = await supabase
                .from('sales')
                .select('*')
                .gte('created_at', session.opened_at);

            if (error) throw error;

            let cash = 0;
            let card = 0;
            let qris = 0;
            let total = 0;

            sales?.forEach(sale => {
                const amount = sale.total_amount || 0;
                total += amount;
                const method = sale.payment_method;
                if (method === 'Tunai' || method === 'Cash') cash += amount;
                else if (method === 'Debit' || method === 'Kredit' || method === 'Card') card += amount;
                else qris += amount; // QRIS, Transfer, Cek, etc.
            });

            const startCash = parseFloat(session.starting_cash) || 0;
            setClosingData({
                cash_sales: cash,
                card_sales: card,
                qris_sales: qris,
                total_sales: total,
                expected_cash: startCash + cash
            });
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
                card_sales: closingData?.card_sales || 0,
                qris_sales: closingData?.qris_sales || 0,
                total_sales: closingData?.total_sales || 0,
                expected_cash: expected,
                actual_cash: actual,
                difference: difference,
                notes: notes
            };

            const { error } = await supabase
                .from('cashier_sessions')
                .update(updateData)
                .eq('id', session.id);

            if (error) throw error;

            Alert.alert('Shift Ditutup', `Selisih: ${formatCurrency(difference)}`);
            onComplete();
            onClose();
        } catch (err: any) {
            Alert.alert('Error', 'Gagal menutup shift: ' + err.message);
        } finally {
            setLoading(false);
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
