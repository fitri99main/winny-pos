import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

interface HistoryItem {
    name: string;
    quantity: number;
    price: number;
    isManual?: boolean;
}

interface HistoryData {
    id: string;
    invoiceNo: string;
    date: string;
    total: number;
    paymentMethod: string;
    items: HistoryItem[];
}

// Mock Data
const MOCK_HISTORY: HistoryData[] = [
    {
        id: '1',
        invoiceNo: 'INV-2026-0001',
        date: '20 Jan 2026, 09:30',
        total: 45000,
        paymentMethod: 'Tunai',
        items: [
            { name: 'Kopi Susu Gula Aren', quantity: 1, price: 20000 },
            { name: 'Croissant Chocolate', quantity: 1, price: 25000 },
        ]
    },
    {
        id: '2',
        invoiceNo: 'INV-2026-0002',
        date: '20 Jan 2026, 10:15',
        total: 22000,
        paymentMethod: 'QRIS',
        items: [
            { name: 'Iced Americano', quantity: 1, price: 22000 },
        ]
    },
    {
        id: '3',
        invoiceNo: 'INV-2026-0003',
        date: '20 Jan 2026, 10:45',
        total: 105000,
        paymentMethod: 'Debit',
        items: [
            { name: 'Nasi Goreng Spesial', quantity: 2, price: 45000 },
            { name: 'Teh Tarik', quantity: 1, price: 15000 },
        ]
    },
    {
        id: '4',
        invoiceNo: 'INV-2026-0004',
        date: '20 Jan 2026, 11:20',
        total: 25000,
        paymentMethod: 'Tunai',
        items: [
            { name: 'Jasa Custom Packaging', quantity: 1, price: 15000, isManual: true },
            { name: 'Ongkos Kirim', quantity: 1, price: 10000, isManual: true },
        ]
    }
];

export default function HistoryScreen() {
    const navigation = useNavigation();

    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const isTablet = width >= 768 || height >= 768;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.flex1}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Riwayat Penjualan</Text>
                </View>

                {/* List */}
                <FlatList
                    key={isLandscape ? 'landscape-list' : 'portrait-list'}
                    data={MOCK_HISTORY}
                    keyExtractor={(item) => item.id}
                    numColumns={isLandscape ? 2 : 1}
                    contentContainerStyle={{ padding: 16 }}
                    columnWrapperStyle={isLandscape ? { gap: 16 } : undefined}
                    renderItem={({ item }) => (
                        <View style={[styles.card, isLandscape && { flex: 1 }]}>
                            <View style={styles.cardHeader}>
                                <View>
                                    <Text style={styles.invoiceNo}>{item.invoiceNo}</Text>
                                    <Text style={styles.date}>{item.date}</Text>
                                </View>
                                <View style={styles.statusBadge}>
                                    <Text style={styles.statusText}>Selesai</Text>
                                </View>
                            </View>

                            {/* Products List */}
                            <View style={styles.itemsList}>
                                {item.items.map((prod: HistoryItem, idx: number) => (
                                    <View key={idx} style={styles.itemRow}>
                                        <View style={styles.itemNameContainer}>
                                            <Text style={styles.itemName}>{prod.name} x{prod.quantity}</Text>
                                            {prod.isManual && (
                                                <View style={styles.manualBadge}>
                                                    <Text style={styles.manualText}>MANUAL</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.itemPrice}>{formatCurrency(prod.price * prod.quantity)}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.cardFooter}>
                                <View>
                                    <Text style={styles.paymentMethod}>Pembayaran: {item.paymentMethod}</Text>
                                </View>
                                <View style={styles.totalContainer}>
                                    <Text style={styles.totalLabel}>Total</Text>
                                    <Text style={styles.totalAmount}>{formatCurrency(item.total)}</Text>
                                </View>
                            </View>
                        </View>
                    )}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    flex1: {
        flex: 1,
    },
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
    backButton: {
        marginRight: 16,
    },
    backButtonText: {
        fontSize: 24,
        color: '#1f2937',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
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
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    invoiceNo: {
        color: '#2563eb',
        fontWeight: 'bold',
        fontSize: 14,
    },
    date: {
        color: '#9ca3af',
        fontSize: 12,
        marginTop: 4,
    },
    statusBadge: {
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    statusText: {
        color: '#16a34a',
        fontSize: 10,
        fontWeight: 'bold',
    },
    itemsList: {
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#f9fafb',
        paddingVertical: 12,
        marginBottom: 12,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    itemName: {
        color: '#4b5563',
        fontSize: 14,
    },
    manualBadge: {
        backgroundColor: '#ffedd5',
        paddingHorizontal: 4,
        marginLeft: 4,
        borderRadius: 2,
    },
    manualText: {
        color: '#ea580c',
        fontSize: 8,
        fontWeight: 'bold',
    },
    itemPrice: {
        color: '#9ca3af',
        fontSize: 14,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentMethod: {
        color: '#9ca3af',
        fontSize: 10,
    },
    totalContainer: {
        alignItems: 'flex-end',
    },
    totalLabel: {
        color: '#9ca3af',
        fontSize: 10,
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
    },
});
