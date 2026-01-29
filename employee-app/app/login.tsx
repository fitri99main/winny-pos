import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Mail } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function signInWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            Alert.alert('Login Gagal', error.message);
            setLoading(false);
        } else {
            router.replace('/(tabs)');
            setLoading(false);
        }
    }

    return (
        <View className="flex-1 bg-white">
            <LinearGradient
                colors={['#eff6ff', '#ffffff']}
                className="flex-1"
            >
                <SafeAreaView className="flex-1 px-8 justify-center">
                    <View className="items-center mb-0">
                        <Image
                            source={require('../assets/welcome_illustration.png')}
                            style={{ width: width * 0.8, height: width * 0.8 }}
                            resizeMode="contain"
                            className="mb-0"
                        />
                    </View>

                    <View className="-mt-10 mb-10 items-center">
                        <Text className="text-4xl font-black text-slate-900 tracking-tight">Winny Portal</Text>
                        <Text className="text-slate-500 mt-1 font-medium text-base">Portal Mandiri Karyawan</Text>
                    </View>

                    <View className="space-y-4">
                        <View>
                            <Text className="text-slate-700 font-bold mb-2 ml-1">Email Address</Text>
                            <View className="flex-row items-center bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm shadow-slate-200/50">
                                <Mail color="#3b82f6" size={20} />
                                <TextInput
                                    className="flex-1 ml-4 text-slate-900 font-medium text-base"
                                    placeholder="your@email.com"
                                    placeholderTextColor="#94a3b8"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-slate-700 font-bold mb-2 ml-1">Password</Text>
                            <View className="flex-row items-center bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm shadow-slate-200/50">
                                <Lock color="#3b82f6" size={20} />
                                <TextInput
                                    className="flex-1 ml-4 text-slate-900 font-medium text-base"
                                    placeholder="••••••••"
                                    placeholderTextColor="#94a3b8"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={signInWithEmail}
                            disabled={loading}
                            activeOpacity={0.8}
                            className="mt-6"
                        >
                            <LinearGradient
                                colors={['#2563eb', '#1d4ed8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                className="rounded-2xl py-5 shadow-lg shadow-blue-500/40"
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white text-center font-black text-xl tracking-tight uppercase">Masuk</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <View className="mt-8 items-center">
                            <Text className="text-slate-400 text-sm font-medium">Lupa password? Hubungi Admin HRD</Text>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}
