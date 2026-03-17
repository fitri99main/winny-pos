import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface HeldOrder {
    id: string;
    items: any[];
    discount: number;
    total: number;
    createdAt: Date;
    tableNo?: string;
}

interface HeldOrdersModalProps {
    visible: boolean;
    onClose: () => void;
    orders: HeldOrder[];
    onRestore: (order: HeldOrder) => void;
    onDelete: (id: string) => void;
}

export default function HeldOrdersModal({ visible, onClose, orders, onRestore, onDelete }: HeldOrdersModalProps) {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Pesanan Ditangguhkan</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        {orders.length === 0 ? (
                            <View style={styles.empty}>
                                <Text style={styles.emptyIcon}>⏰</Text>
                                <Text style={styles.emptyText}>Tidak ada pesanan ditangguhkan</Text>
                            </View>
                        ) : (
                            orders.map(order => (
                                <View key={order.id} style={styles.orderCard}>
                                    <View style={styles.orderHeader}>
                                        <View>
                                            <Text style={styles.orderId}>Pesanan #{order.id.slice(-4)}</Text>
                                            <Text style={styles.orderTime}>{formatTime(order.createdAt)} - {order.items.length} item</Text>
                                            <Text style={styles.orderTable}>Meja: {order.tableNo || '-'}</Text>
                                        </View>
                                        <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
                                    </View>
                                    <View style={styles.actions}>
                                        <TouchableOpacity style={styles.restoreBtn} onPress={() => onRestore(order)}>
                                            <Text style={styles.restoreText}>▶ Kembalikan</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(order.id)}>
                                            <Text style={styles.deleteText}>🗑️</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    closeIcon: { fontSize: 20, color: '#6b7280' },
    content: { padding: 20 },
    empty: { padding: 40, alignItems: 'center' },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { color: '#6b7280', fontSize: 14 },
    orderCard: { backgroundColor: '#f9fafb', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f3f4f6' },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    orderId: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
    orderTime: { fontSize: 11, color: '#6b7280', marginTop: 2 },
    orderTable: { fontSize: 11, fontWeight: 'bold', color: '#ea580c', marginTop: 2 },
    orderTotal: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    actions: { flexDirection: 'row', gap: 12 },
    restoreBtn: { flex: 1, backgroundColor: '#0d9488', padding: 12, borderRadius: 8, alignItems: 'center' },
    restoreText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    deleteBtn: { width: 44, height: 44, backgroundColor: '#fee2e2', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    deleteText: { fontSize: 16 }
});
