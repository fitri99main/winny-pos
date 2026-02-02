import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styled } from 'nativewind';
import { useNavigation } from '@react-navigation/native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function ProductScreen() {
    const navigation = useNavigation();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
            <StyledView className="flex-1 p-6">
                <StyledView className="flex-row items-center mb-6">
                    <StyledTouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                        <StyledText className="text-2xl">←</StyledText>
                    </StyledTouchableOpacity>
                    <StyledText className="text-2xl font-bold text-gray-800">Produk</StyledText>
                </StyledView>

                <StyledView className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-1 justify-center items-center">
                    <StyledText className="text-4xl mb-4">📦</StyledText>
                    <StyledText className="text-lg font-semibold text-gray-800 mb-2">Manajemen Produk</StyledText>
                    <StyledText className="text-gray-500 text-center">
                        Daftar produk akan ditampilkan di sini.
                    </StyledText>
                </StyledView>
            </StyledView>
        </SafeAreaView>
    );
}
