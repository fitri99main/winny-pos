import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface SplitBillModalProps {
    visible: boolean;
    onClose: () => void;
    items: any[];
    onSplit: (selectedItems: any[]) => void;
}

export default function SplitBillModal({ visible, onClose, items, onSplit }: SplitBillModalProps) {
    const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

    useEffect(() => {
        if (visible) {
            setSelectedQuantities({});
        }
    }, [visible]);

    const handleQtyChange = (itemId: string, maxQty: number, delta: number) => {
        const current = selectedQuantities[itemId] || 0;
        const next = Math.max(0, Math.min(maxQty, current + delta));
        setSelectedQuantities({ ...selectedQuantities, [itemId]: next });
    };

    const getSplitItems = () => {
        return items
            .filter(item => selectedQuantities[item.id] > 0)
            .map(item => ({
                ...item,
                quantity: selectedQuantities[item.id]
            }));
    };

    const calculateSplitTotal = () => {
        return getSplitItems().reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Pisah Tagihan</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        {items.map(item => (
                            <View key={item.id} style={styles.itemRow}>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <Text style={styles.itemPrice}>{formatCurrency(item.price)} (Tersedia: {item.quantity})</Text>
                                </View>
                                <View style={styles.controls}>
                                    <TouchableOpacity 
                                        style={styles.controlBtn} 
                                        onPress={() => handleQtyChange(item.id, item.quantity, -1)}
                                    >
                                        <Text style={styles.controlText}>-</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.qtyText}>{selectedQuantities[item.id] || 0}</Text>
                                    <TouchableOpacity 
                                        style={styles.controlBtn} 
                                        onPress={() => handleQtyChange(item.id, item.quantity, 1)}
                                    >
                                        <Text style={styles.controlText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    <View style={styles.footer}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total Terpisah</Text>
                            <Text style={styles.totalValue}>{formatCurrency(calculateSplitTotal())}</Text>
                        </View>
                        <TouchableOpacity 
                            style={[styles.payBtn, calculateSplitTotal() === 0 && styles.disabledBtn]} 
                            disabled={calculateSplitTotal() === 0}
                            onPress={() => {
                                onSplit(getSplitItems());
                                onClose();
                            }}
                        >
                            <Text style={styles.payBtnText}>Bayar Item Terpilih</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    closeIcon: { fontSize: 20, color: '#6b7280' },
    content: { padding: 20 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#f9fafb', padding: 12, borderRadius: 12 },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
    itemPrice: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', padding: 4, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
    controlBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    controlText: { fontSize: 18, fontWeight: 'bold' },
    qtyText: { fontSize: 14, fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    totalLabel: { fontSize: 14, color: '#6b7280', fontWeight: 'bold' },
    totalValue: { fontSize: 20, fontWeight: 'bold', color: '#ea580c' },
    payBtn: { backgroundColor: '#0d9488', padding: 16, borderRadius: 12, alignItems: 'center' },
    payBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    disabledBtn: { opacity: 0.5 }
});
