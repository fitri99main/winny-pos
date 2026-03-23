import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface HeldOrder {
    id: string;
    orderNo?: string;
    items: any[];
    discount: number;
    total: number;
    createdAt: Date;
    tableNo?: string;
    note?: string;
    isRemote?: boolean;
}

interface HeldOrdersModalProps {
    visible: boolean;
    onClose: () => void;
    orders: HeldOrder[];
    onRestore: (order: HeldOrder) => void;
    onDelete: (id: string) => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

export default function HeldOrdersModal({ visible, onClose, orders, onRestore, onDelete, onRefresh, isRefreshing }: HeldOrdersModalProps) {
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Text style={styles.title}>Pesanan Ditangguhkan</Text>
                            {onRefresh && (
                                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} disabled={isRefreshing}>
                                    <Text style={styles.refreshIcon}>{isRefreshing ? '⏳' : '🔄'}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
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
                                <View key={order.id} style={[styles.orderCard, order.isRemote && styles.remoteCard]}>
                                    <View style={styles.orderHeader}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={styles.orderId}>
                                                    {order.isRemote ? `☁️ Remote #${(order.orderNo || order.id).slice(-4)}` : `📝 Draft #${order.id.slice(-4)}`}
                                                </Text>
                                                {order.isRemote && (
                                                    <View style={styles.remoteBadge}>
                                                        <Text style={styles.remoteBadgeText}>UNPAID</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.orderTime}>{formatTime(order.createdAt)} - {order.isRemote ? 'Cloud Sync' : `${order.items.length} item`}</Text>
                                            <Text style={styles.orderTable}>Meja: {order.tableNo || '-'}</Text>
                                            {order.note ? <Text style={styles.orderNote}>Catatan: {order.note}</Text> : null}
                                        </View>
                                        <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
                                    </View>
                                    <View style={styles.actions}>
                                        <TouchableOpacity 
                                            style={[styles.restoreBtn, order.isRemote && styles.remoteRestoreBtn]} 
                                            onPress={() => onRestore(order)}
                                        >
                                            <Text style={styles.restoreText}>
                                                {order.isRemote ? '⚡ Terima & Bayar' : '▶ Kembalikan'}
                                            </Text>
                                        </TouchableOpacity>
                                        {!order.isRemote && (
                                            <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(order.id)}>
                                                <Text style={styles.deleteText}>🗑️</Text>
                                            </TouchableOpacity>
                                        )}
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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    refreshBtn: { padding: 4, backgroundColor: '#f3f4f6', borderRadius: 8 },
    refreshIcon: { fontSize: 16 },
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
    orderNote: { fontSize: 11, color: '#4b5563', fontStyle: 'italic', marginTop: 2 },
    orderTotal: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    actions: { flexDirection: 'row', gap: 12 },
    restoreBtn: { flex: 1, backgroundColor: '#0d9488', padding: 12, borderRadius: 8, alignItems: 'center' },
    restoreText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    deleteBtn: { width: 44, height: 44, backgroundColor: '#fee2e2', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    deleteText: { fontSize: 16 },
    remoteCard: { borderColor: '#0d9488', borderLeftWidth: 4 },
    remoteBadge: { backgroundColor: '#0d9488', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    remoteBadgeText: { color: 'white', fontSize: 8, fontWeight: 'bold' },
    remoteRestoreBtn: { backgroundColor: '#ea580c' }
});
