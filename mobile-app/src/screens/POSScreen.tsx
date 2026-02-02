import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styled } from 'nativewind';
import { useNavigation } from '@react-navigation/native';


// Styled Components
const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);

// Mock Data (Consistent across the app for now)
const mockProducts = [
    { id: '1', name: 'Kopi Susu Gula Aren', price: 18000, category: 'Beverages', image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=300&h=300' },
    { id: '2', name: 'Americano', price: 15000, category: 'Beverages', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=300&h=300' },
    { id: '3', name: 'Croissant', price: 12000, category: 'Food', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=300&h=300' },
    { id: '4', name: 'Nasi Goreng Special', price: 25000, category: 'Food', image: 'https://images.unsplash.com/photo-1603133872878-684f57143026?auto=format&fit=crop&q=80&w=300&h=300' },
    { id: '5', name: 'Matcha Latte', price: 22000, category: 'Beverages', image: 'https://images.unsplash.com/photo-1515825838458-f2a94b20105a?auto=format&fit=crop&q=80&w=300&h=300' },
    { id: '6', name: 'Kentang Goreng', price: 10000, category: 'Snacks', image: 'https://images.unsplash.com/photo-1573080496987-aeb4d91c04aa?auto=format&fit=crop&q=80&w=300&h=300' },
];

export default function POSScreen() {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);

    const [showSuccess, setShowSuccess] = useState(false);
    const [manualModal, setManualModal] = useState({ show: false, name: '', price: '' });
    const [discountModal, setDiscountModal] = useState({ show: false, type: 'percentage', value: '' });
    const [heldOrders, setHeldOrders] = useState<any[]>([]);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [waiterName, setWaiterName] = useState('');

    // Filter Logic
    const filteredProducts = useMemo(() => {
        if (!searchQuery) return mockProducts;
        return mockProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [searchQuery]);

    // Cart Logic
    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const handleCheckout = () => {
        setShowSuccess(true);
    };

    const handleNewTransaction = () => {
        setCart([]);
        setShowSuccess(false);
        setDiscountAmount(0);
    };

    const addManualItem = () => {
        const trimmedName = manualModal.name.trim();
        const numericPrice = parseFloat(manualModal.price.replace(/,/g, ''));

        if (!trimmedName || isNaN(numericPrice)) return;

        const product = {
            id: `manual-${Date.now()}`,
            name: trimmedName,
            price: numericPrice,
            isManual: true,
            image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=300&h=300'
        };
        addToCart(product);
        setManualModal({ show: false, name: '', price: '' });
    };

    const applyDiscount = () => {
        const val = parseFloat(discountModal.value) || 0;
        let amount = 0;
        if (discountModal.type === 'percentage') {
            amount = (cartTotal * val) / 100;
        } else {
            amount = val;
        }
        setDiscountAmount(amount);
        setDiscountModal({ ...discountModal, show: false, value: '' });
    };

    const handleHoldOrder = () => {
        if (cart.length === 0) return;
        const newHeld = {
            id: `held-${Date.now()}`,
            items: [...cart],
            total: cartTotal - discountAmount,
            discount: discountAmount,
            date: new Date().toLocaleTimeString()
        };
        setHeldOrders([newHeld, ...heldOrders]);
        setCart([]);
        setDiscountAmount(0);
        Alert.alert('Sukses', 'Pesanan berhasil ditunda');
    };

    const restoreOrder = (held: any) => {
        if (cart.length > 0) {
            Alert.alert('Error', 'Kosongkan keranjang sebelum mengembalikan pesanan');
            return;
        }
        setCart(held.items);
        setDiscountAmount(held.discount);
        setHeldOrders(prev => prev.filter(h => h.id !== held.id));
        Alert.alert('Sukses', 'Pesanan dikembalikan');
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
    }, [cart]);

    const cartCount = useMemo(() => {
        return cart.reduce((count, item) => count + item.quantity, 0);
    }, [cart]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f9fafb' }}>
            <StyledView className="flex-1">
                {/* Header */}
                <StyledView className="bg-white p-4 flex-row items-center shadow-sm z-10">
                    <StyledTouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                        <StyledText className="text-2xl">🔙</StyledText>
                    </StyledTouchableOpacity>
                    <StyledView>
                        <StyledText className="text-xl font-bold text-gray-800">Mesin Kasir</StyledText>
                        <StyledView className="flex-row items-center">
                            <StyledText className="text-[10px] text-blue-600 font-bold">📍 Winny Cafe Pusat</StyledText>
                            <StyledText className="text-[10px] text-gray-300 mx-1">|</StyledText>
                            <StyledTextInput
                                className="text-[10px] text-gray-500 font-bold p-0 m-0"
                                placeholder="Pilih Pelayan..."
                                value={waiterName}
                                onChangeText={setWaiterName}
                            />
                        </StyledView>
                    </StyledView>
                </StyledView>

                {/* Search Bar */}
                <StyledView className="p-4 bg-white border-b border-gray-100">
                    <StyledTextInput
                        className="bg-gray-100 p-3 rounded-xl text-gray-800"
                        placeholder="Cari produk..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </StyledView>

                {/* Quick Actions Row */}
                <StyledView className="flex-row p-4 gap-2 bg-white mb-1">
                    <StyledTouchableOpacity
                        onPress={() => setManualModal({ ...manualModal, show: true })}
                        className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100 items-center justify-center"
                    >
                        <StyledText className="text-[10px] font-bold text-gray-700">➕ Manual</StyledText>
                    </StyledTouchableOpacity>
                    <StyledTouchableOpacity
                        onPress={() => setDiscountModal({ ...discountModal, show: true })}
                        className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100 items-center justify-center"
                    >
                        <StyledText className="text-[10px] font-bold text-gray-700">🏷️ Diskon</StyledText>
                    </StyledTouchableOpacity>
                    <StyledTouchableOpacity
                        onPress={handleHoldOrder}
                        className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100 items-center justify-center"
                    >
                        <StyledText className="text-[10px] font-bold text-gray-700">⏸️ Hold</StyledText>
                    </StyledTouchableOpacity>
                    <StyledTouchableOpacity
                        onPress={() => {
                            if (heldOrders.length === 0) return Alert.alert('Info', 'Tidak ada pesanan tertunda');
                            Alert.alert(
                                'Pesanan Tertunda',
                                `Ada ${heldOrders.length} pesanan tertunda. Kembalikan yang terbaru?`,
                                [
                                    { text: 'Batal', style: 'cancel' },
                                    { text: 'Ya', onPress: () => restoreOrder(heldOrders[0]) }
                                ]
                            );
                        }}
                        className="flex-2 bg-orange-50 p-3 rounded-xl border border-orange-100 items-center justify-center"
                    >
                        <StyledText className="text-[10px] font-bold text-orange-600">📂 List Hold ({heldOrders.length})</StyledText>
                    </StyledTouchableOpacity>
                </StyledView>

                {/* Product Grid */}
                <FlatList
                    key={6}
                    data={filteredProducts}
                    keyExtractor={(item) => item.id}
                    numColumns={6}
                    contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
                    columnWrapperStyle={{ justifyContent: 'flex-start', gap: 8 }}
                    renderItem={({ item }) => (
                        <StyledTouchableOpacity
                            className="bg-white rounded-lg mb-2 w-[14%] shadow-sm overflow-hidden border border-gray-100"
                            onPress={() => addToCart(item)}
                        >
                            <Image
                                source={{ uri: item.image }}
                                style={{ width: '100%', height: 80 }}
                                resizeMode="cover"
                            />
                            <StyledView className="p-2">
                                <StyledText className="text-[10px] font-bold text-gray-800 mb-0.5" numberOfLines={1}>{item.name}</StyledText>
                                <StyledText className="text-[10px] text-blue-600 font-bold">{formatCurrency(item.price)}</StyledText>
                            </StyledView>
                        </StyledTouchableOpacity>
                    )}
                />

                {/* Sticky Cart Summary */}
                {cart.length > 0 && (
                    <StyledView className="absolute bottom-0 w-full bg-white p-4 border-t border-gray-200 shadow-lg">
                        <StyledView className="flex-row justify-between items-center mb-4">
                            <StyledView>
                                <StyledText className="text-gray-500 font-medium">{cartCount} Item</StyledText>
                                {discountAmount > 0 && (
                                    <StyledText className="text-red-500 text-xs">- {formatCurrency(discountAmount)}</StyledText>
                                )}
                            </StyledView>
                            <StyledText className="text-xl font-bold text-gray-800">{formatCurrency(cartTotal - discountAmount)}</StyledText>
                        </StyledView>
                        <StyledTouchableOpacity
                            className="bg-blue-600 p-4 rounded-xl items-center"
                            onPress={handleCheckout}
                        >
                            <StyledText className="text-white font-bold text-lg">Bayar Sekarang</StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                )}

                {/* Manual Item Modal */}
                <Modal visible={manualModal.show} transparent animationType="fade">
                    <StyledView className="flex-1 bg-black/50 justify-center p-6">
                        <StyledView className="bg-white p-6 rounded-3xl shadow-2xl">
                            <StyledText className="text-xl font-bold mb-4 text-gray-800">Item Manual</StyledText>
                            <StyledTextInput
                                className="bg-gray-50 p-4 rounded-xl mb-3 text-gray-800"
                                placeholder="Nama Item"
                                placeholderTextColor="#9ca3af"
                                value={manualModal.name}
                                onChangeText={(text) => setManualModal({ ...manualModal, name: text })}
                            />
                            <StyledTextInput
                                className="bg-gray-50 p-4 rounded-xl mb-6 text-gray-800"
                                placeholder="Harga (IDR)"
                                placeholderTextColor="#9ca3af"
                                keyboardType="numeric"
                                value={manualModal.price}
                                onChangeText={(text) => setManualModal({ ...manualModal, price: text })}
                            />
                            <StyledView className="flex-row gap-3">
                                <StyledTouchableOpacity
                                    onPress={() => setManualModal({ ...manualModal, show: false })}
                                    className="flex-1 p-4 rounded-xl bg-gray-100 items-center border border-gray-200"
                                >
                                    <StyledText className="font-bold text-gray-600">Batal</StyledText>
                                </StyledTouchableOpacity>
                                <StyledTouchableOpacity
                                    onPress={addManualItem}
                                    className="flex-1 p-4 rounded-xl bg-blue-600 items-center shadow-lg"
                                >
                                    <StyledText className="font-bold text-white">Tambah</StyledText>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </Modal>

                {/* Discount Modal */}
                <Modal visible={discountModal.show} transparent animationType="fade">
                    <StyledView className="flex-1 bg-black/50 justify-center p-6">
                        <StyledView className="bg-white p-6 rounded-3xl shadow-2xl">
                            <StyledText className="text-xl font-bold mb-4 text-gray-800">Tambah Diskon</StyledText>
                            <StyledView className="flex-row mb-4 gap-2">
                                <StyledTouchableOpacity
                                    onPress={() => setDiscountModal({ ...discountModal, type: 'percentage' })}
                                    className={`flex-1 p-3 rounded-xl items-center ${discountModal.type === 'percentage' ? 'bg-blue-600 border-blue-700' : 'bg-gray-50 border-gray-200'} border`}
                                >
                                    <StyledText className={`font-bold ${discountModal.type === 'percentage' ? 'text-white' : 'text-gray-500'}`}>Persen (%)</StyledText>
                                </StyledTouchableOpacity>
                                <StyledTouchableOpacity
                                    onPress={() => setDiscountModal({ ...discountModal, type: 'fixed' })}
                                    className={`flex-1 p-3 rounded-xl items-center ${discountModal.type === 'fixed' ? 'bg-blue-600 border-blue-700' : 'bg-gray-50 border-gray-200'} border`}
                                >
                                    <StyledText className={`font-bold ${discountModal.type === 'fixed' ? 'text-white' : 'text-gray-500'}`}>Nominal (Rp)</StyledText>
                                </StyledTouchableOpacity>
                            </StyledView>
                            <StyledTextInput
                                className="bg-gray-50 p-4 rounded-xl mb-6 text-gray-800"
                                placeholder={discountModal.type === 'percentage' ? 'Contoh: 10' : 'Contoh: 5000'}
                                placeholderTextColor="#9ca3af"
                                keyboardType="numeric"
                                value={discountModal.value}
                                onChangeText={(text) => setDiscountModal({ ...discountModal, value: text })}
                            />
                            <StyledView className="flex-row gap-3">
                                <StyledTouchableOpacity
                                    onPress={() => setDiscountModal({ ...discountModal, show: false })}
                                    className="flex-1 p-4 rounded-xl bg-gray-100 items-center border border-gray-200"
                                >
                                    <StyledText className="font-bold text-gray-600">Batal</StyledText>
                                </StyledTouchableOpacity>
                                <StyledTouchableOpacity
                                    onPress={applyDiscount}
                                    className="flex-1 p-4 rounded-xl bg-blue-600 items-center shadow-lg"
                                >
                                    <StyledText className="font-bold text-white">Simpan</StyledText>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </Modal>

                {/* Success Modal Overlay */}
                {showSuccess && (
                    <StyledView className="absolute inset-0 bg-black/50 items-center justify-center p-4">
                        <StyledView className="bg-white p-6 rounded-2xl w-full max-w-sm items-center">
                            <StyledView className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
                                <StyledText className="text-4xl">✅</StyledText>
                            </StyledView>
                            <StyledText className="text-2xl font-bold text-gray-800 mb-2">Pembayaran Berhasil!</StyledText>
                            <StyledText className="text-gray-500 mb-6 text-center">Transaksi telah berhasil disimpan.</StyledText>

                            <StyledView className="w-full bg-gray-50 p-4 rounded-xl mb-6">
                                <StyledView className="flex-row justify-between mb-2">
                                    <StyledText className="text-gray-500">Total Transaksi</StyledText>
                                    <StyledText className="font-bold text-gray-800">{formatCurrency(cartTotal)}</StyledText>
                                </StyledView>
                                <StyledView className="flex-row justify-between">
                                    <StyledText className="text-gray-500">Metode</StyledText>
                                    <StyledText className="font-bold text-gray-800">Tunai</StyledText>
                                </StyledView>
                            </StyledView>

                            <StyledTouchableOpacity
                                className="w-full bg-blue-600 p-4 rounded-xl items-center"
                                onPress={handleNewTransaction}
                            >
                                <StyledText className="text-white font-bold">Transaksi Baru</StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                )}
            </StyledView>
        </SafeAreaView>
    );
}
