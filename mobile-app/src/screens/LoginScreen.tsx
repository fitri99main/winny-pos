import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { styled } from 'nativewind';
import { supabase } from '../lib/supabase';
import { Alert, ActivityIndicator } from 'react-native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledSafeAreaView = styled(SafeAreaView);

export default function LoginScreen() {
    const navigation = useNavigation<any>();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Eror', 'Silakan isi email dan kata sandi');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        setLoading(false);
        if (error) {
            Alert.alert('Autentikasi Gagal', error.message);
        } else {
            navigation.navigate('Main');
        }
    };

    return (
        <StyledSafeAreaView className="flex-1 bg-gray-50">
            <StyledView className="flex-1 justify-center px-8">
                <StyledView className="items-center mb-10">
                    <StyledText className="text-4xl font-bold text-blue-600 mb-2">Winny</StyledText>
                    <StyledText className="text-gray-500 text-lg">POS & ERP System</StyledText>
                </StyledView>

                <StyledView className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <StyledText className="text-xl font-semibold mb-6 text-gray-800">Sign In</StyledText>

                    <StyledView className="mb-4">
                        <StyledText className="text-gray-600 mb-2 font-medium">Email</StyledText>
                        <StyledTextInput
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800"
                            placeholder="Enter your email"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </StyledView>

                    <StyledView className="mb-6">
                        <StyledText className="text-gray-600 mb-2 font-medium">Password</StyledText>
                        <StyledTextInput
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800"
                            placeholder="Enter your password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </StyledView>

                    <StyledTouchableOpacity
                        className="w-full bg-blue-600 p-4 rounded-xl items-center shadow-md active:bg-blue-700"
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <StyledText className="text-white font-bold text-lg">Login</StyledText>
                        )}
                    </StyledTouchableOpacity>
                </StyledView>

                <StyledView className="mt-8 items-center">
                    <StyledText className="text-gray-400 text-sm">© 2026 Winny System</StyledText>
                </StyledView>
            </StyledView>
        </StyledSafeAreaView>
    );
}
