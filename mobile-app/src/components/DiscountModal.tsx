import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet } from 'react-native';

interface DiscountModalProps {
    visible: boolean;
    onClose: () => void;
    currentTotal: number;
    onApply: (discount: { type: 'percentage' | 'fixed'; value: number; reason?: string }) => void;
}

export default function DiscountModal({ visible, onClose, currentTotal, onApply }: DiscountModalProps) {
    const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');

    const handleApply = () => {
        const numValue = parseFloat(value) || 0;
        if (numValue <= 0) return;
        onApply({ type, value: numValue, reason: reason.trim() || undefined });
        setValue('');
        setReason('');
        onClose();
    };

    const calculateAmount = () => {
        const numValue = parseFloat(value) || 0;
        if (type === 'percentage') return (currentTotal * numValue) / 100;
        return numValue;
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity style={styles.container} activeOpacity={1} onPress={e => e.stopPropagation()}>
                    <Text style={styles.title}>Terapkan Diskon</Text>
                    
                    <View style={styles.tabs}>
                        <TouchableOpacity 
                            style={[styles.tab, type === 'percentage' && styles.activeTab]} 
                            onPress={() => setType('percentage')}
                        >
                            <Text style={[styles.tabText, type === 'percentage' && styles.activeTabText]}>Persen (%)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.tab, type === 'fixed' && styles.activeTab]} 
                            onPress={() => setType('fixed')}
                        >
                            <Text style={[styles.tabText, type === 'fixed' && styles.activeTabText]}>Jumlah Tetap</Text>
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder={type === 'percentage' ? 'Persen (misal: 10)' : 'Jumlah (misal: 10000)'}
                        value={value}
                        onChangeText={setValue}
                        keyboardType="numeric"
                        autoFocus
                    />

                    <View style={{ marginTop: 16 }}>
                        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, fontWeight: '600' }}>Alasan Diskon (Opsional)</Text>
                        <TextInput
                            style={[styles.input, { fontSize: 14, fontWeight: 'normal' }]}
                            placeholder="Misal: Promo Ulang Tahun, Member..."
                            value={reason}
                            onChangeText={setReason}
                        />
                    </View>

                    {value !== '' && (
                        <View style={styles.summary}>
                            <Text style={styles.summaryLabel}>Potongan:</Text>
                            <Text style={styles.summaryValue}>-{formatCurrency(calculateAmount())}</Text>
                        </View>
                    )}

                    <View style={styles.footer}>
                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                            <Text style={styles.cancelText}>Batal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.button, styles.confirmButton, !value && styles.disabledButton]} 
                            onPress={handleApply}
                            disabled={!value}
                        >
                            <Text style={styles.confirmText}>Terapkan</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    container: { backgroundColor: 'white', borderRadius: 24, padding: 24 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#111827' },
    tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
    activeTab: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
    tabText: { fontWeight: '600', color: '#4b5563', fontSize: 13 },
    activeTabText: { color: 'white' },
    input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 18, fontWeight: 'bold' },
    summary: { marginTop: 16, padding: 12, backgroundColor: '#fff7ed', borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between' },
    summaryLabel: { color: '#9a3412', fontWeight: '600' },
    summaryValue: { color: '#ea580c', fontWeight: 'bold' },
    footer: { flexDirection: 'row', gap: 12, marginTop: 20 },
    button: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
    cancelButton: { backgroundColor: '#f3f4f6' },
    confirmButton: { backgroundColor: '#ea580c' },
    disabledButton: { opacity: 0.5 },
    cancelText: { fontWeight: 'bold', color: '#4b5563' },
    confirmText: { fontWeight: 'bold', color: 'white' }
});
