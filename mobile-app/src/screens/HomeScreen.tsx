import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styled } from 'nativewind';
import { useNavigation } from '@react-navigation/native';

// Styled Components
const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function HomeScreen() {
    const navigation = useNavigation();

    // Mock Data
    const summaryData = {
        salesToday: 'Rp 2.500.000',
        transactionCount: 24,
    };

    const menuItems = [
        { id: 'pos', title: 'Mesin Kasir', icon: '🛒', route: 'POS', color: 'bg-blue-600' },
        { id: 'history', title: 'Riwayat', icon: '📜', route: 'History', color: 'bg-orange-500' },
        { id: 'products', title: 'Produk', icon: '📦', route: 'Products', color: 'bg-green-600' },
        { id: 'accounting', title: 'Akuntansi', icon: '📊', route: 'Accounting', color: 'bg-purple-600' },
        { id: 'settings', title: 'Pengaturan', icon: '⚙️', route: 'Settings', color: 'bg-gray-600' },
    ];

    const handleMenuPress = (route: string) => {
        // @ts-ignore
        navigation.navigate(route);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
            <StyledView className="flex-1">
                <StyledScrollView className="flex-1">
                    {/* Header */}
                    <StyledView className="bg-white p-6 pb-8 rounded-b-3xl shadow-sm">
                        <StyledView className="flex-row justify-between items-center mb-4">
                            <StyledView>
                                <StyledText className="text-gray-500 text-sm font-medium">Selamat Datang,</StyledText>
                                <StyledText className="text-2xl font-bold text-gray-800">Admin Staff</StyledText>
                                <StyledView className="flex-row items-center mt-1">
                                    <StyledText className="text-blue-600 text-xs font-bold">📍 Winny Cafe Pusat</StyledText>
                                </StyledView>
                            </StyledView>
                            <StyledView className="w-10 h-10 bg-gray-200 rounded-full items-center justify-center border border-gray-100">
                                <StyledText className="text-xl">👤</StyledText>
                            </StyledView>
                        </StyledView>

                        {/* Summary Cards */}
                        <StyledView className="flex-row space-x-4">
                            <StyledView className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <StyledText className="text-blue-600 text-[10px] font-bold mb-1 uppercase tracking-tight">Shift Hari Ini</StyledText>
                                <StyledText className="text-gray-800 text-base font-bold">Shift Pagi</StyledText>
                                <StyledText className="text-blue-500 text-[10px] font-bold mt-1">07:00 - 15:00</StyledText>
                            </StyledView>
                            <StyledView className="flex-1 bg-purple-50 p-4 rounded-xl border border-purple-100">
                                <StyledText className="text-purple-600 text-[10px] font-bold mb-1 uppercase tracking-tight">Tugas Karyawan</StyledText>
                                <StyledText className="text-gray-800 text-base font-bold">4 Orang</StyledText>
                                <StyledText className="text-purple-500 text-[10px] font-bold mt-1">Ready di Outlet</StyledText>
                            </StyledView>
                        </StyledView>
                    </StyledView>

                    {/* Main Menu Grid */}
                    <StyledView className="p-6">
                        <StyledText className="text-lg font-bold text-gray-800 mb-4">Menu Utama</StyledText>
                        <StyledView className="flex-row flex-wrap justify-between">
                            {menuItems.map((item) => (
                                <StyledTouchableOpacity
                                    key={item.id}
                                    className="w-[48%] bg-white p-4 rounded-2xl mb-4 shadow-sm border border-gray-100 items-center justify-center py-8"
                                    onPress={() => handleMenuPress(item.route)}
                                >
                                    <StyledView className={`w-14 h-14 ${item.color} rounded-full items-center justify-center mb-3 shadow-sm`}>
                                        <StyledText className="text-2xl text-white">{item.icon}</StyledText>
                                    </StyledView>
                                    <StyledText className="font-semibold text-gray-700 text-base">{item.title}</StyledText>
                                </StyledTouchableOpacity>
                            ))}
                        </StyledView>
                    </StyledView>

                    {/* Recent Activity Section (Placeholder) */}
                    <StyledView className="px-6 pb-6">
                        <StyledText className="text-lg font-bold text-gray-800 mb-4">Aktivitas Terkini</StyledText>
                        <StyledView className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <StyledView className="flex-row items-center border-b border-gray-50 pb-3 mb-3">
                                <StyledView className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mr-3">
                                    <StyledText>💵</StyledText>
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="font-medium text-gray-800">Pembayaran #ORDER-001</StyledText>
                                    <StyledText className="text-xs text-gray-500">Baru saja</StyledText>
                                </StyledView>
                                <StyledText className="font-bold text-green-600">+ Rp 150.000</StyledText>
                            </StyledView>
                            <StyledView className="flex-row items-center">
                                <StyledView className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mr-3">
                                    <StyledText>📦</StyledText>
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="font-medium text-gray-800">Stok Masuk: Kopi Susu</StyledText>
                                    <StyledText className="text-xs text-gray-500">2 jam yang lalu</StyledText>
                                </StyledView>
                                <StyledText className="font-bold text-blue-600">+ 50 Unit</StyledText>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </StyledScrollView>
            </StyledView>
        </SafeAreaView>
    );
}
