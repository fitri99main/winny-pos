import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styled } from 'nativewind';
import { useNavigation } from '@react-navigation/native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function SettingsScreen() {
    const navigation = useNavigation();

    const handleLogout = () => {
        // In a real app, you would clear auth state here
        navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
        } as any);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
            <StyledView className="flex-1 p-6">
                <StyledView className="flex-row items-center mb-6">
                    <StyledTouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                        <StyledText className="text-2xl">←</StyledText>
                    </StyledTouchableOpacity>
                    <StyledText className="text-2xl font-bold text-gray-800">Pengaturan</StyledText>
                </StyledView>

                <StyledView className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <StyledTouchableOpacity className="p-4 border-b border-gray-100 flex-row justify-between items-center">
                        <StyledText className="text-gray-700 font-medium">Profil Pengguna</StyledText>
                        <StyledText className="text-gray-400">›</StyledText>
                    </StyledTouchableOpacity>
                    <StyledTouchableOpacity className="p-4 border-b border-gray-100 flex-row justify-between items-center">
                        <StyledText className="text-gray-700 font-medium">Notifikasi</StyledText>
                        <StyledText className="text-gray-400">›</StyledText>
                    </StyledTouchableOpacity>
                    <StyledTouchableOpacity className="p-4 flex-row justify-between items-center">
                        <StyledText className="text-gray-700 font-medium">Tentang Aplikasi</StyledText>
                        <StyledText className="text-gray-400">›</StyledText>
                    </StyledTouchableOpacity>
                </StyledView>

                <StyledTouchableOpacity
                    onPress={handleLogout}
                    className="mt-6 bg-red-50 p-4 rounded-xl border border-red-100 items-center"
                >
                    <StyledText className="text-red-600 font-bold">Keluar</StyledText>
                </StyledTouchableOpacity>
            </StyledView>
        </SafeAreaView>
    );
}
