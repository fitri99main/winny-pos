import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styled } from 'nativewind';
import { useNavigation } from '@react-navigation/native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
            <StyledView className="flex-1">
                {/* Header */}
                <StyledView className="bg-white p-4 flex-row items-center shadow-sm z-10">
                    <StyledTouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                        <StyledText className="text-2xl">←</StyledText>
                    </StyledTouchableOpacity>
                    <StyledText className="text-xl font-bold text-gray-800">Riwayat Penjualan</StyledText>
                </StyledView>

                {/* List */}
                <FlatList
                    data={MOCK_HISTORY}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 16 }}
                    renderItem={({ item }) => (
                        <StyledView className="bg-white p-4 rounded-2xl mb-4 shadow-sm border border-gray-100">
                            <StyledView className="flex-row justify-between items-start mb-3">
                                <StyledView>
                                    <StyledText className="text-blue-600 font-bold font-mono text-sm">{item.invoiceNo}</StyledText>
                                    <StyledText className="text-gray-400 text-xs mt-1">{item.date}</StyledText>
                                </StyledView>
                                <StyledView className="bg-green-50 px-2 py-1 rounded-md border border-green-100">
                                    <StyledText className="text-green-600 text-[10px] font-bold">Selesai</StyledText>
                                </StyledView>
                            </StyledView>

                            {/* Products List */}
                            <StyledView className="border-t border-b border-gray-50 py-3 mb-3">
                                {item.items.map((prod, idx) => (
                                    <StyledView key={idx} className="flex-row justify-between items-center mb-1">
                                        <StyledView className="flex-row items-center flex-1">
                                            <StyledText className="text-gray-600 text-sm">{prod.name} x{prod.quantity}</StyledText>
                                            {prod.isManual && (
                                                <StyledView className="bg-orange-100 px-1 ml-1 rounded-sm">
                                                    <StyledText className="text-orange-600 text-[8px] font-bold">MANUAL</StyledText>
                                                </StyledView>
                                            )}
                                        </StyledView>
                                        <StyledText className="text-gray-400 text-sm">{formatCurrency(prod.price * prod.quantity)}</StyledText>
                                    </StyledView>
                                ))}
                            </StyledView>

                            <StyledView className="flex-row justify-between items-center">
                                <StyledView>
                                    <StyledText className="text-gray-400 text-[10px]">Pembayaran: {item.paymentMethod}</StyledText>
                                </StyledView>
                                <StyledView className="items-end">
                                    <StyledText className="text-gray-400 text-[10px]">Total</StyledText>
                                    <StyledText className="text-lg font-bold text-gray-800">{formatCurrency(item.total)}</StyledText>
                                </StyledView>
                            </StyledView>
                        </StyledView>
                    )}
                />
            </StyledView>
        </SafeAreaView>
    );
}
