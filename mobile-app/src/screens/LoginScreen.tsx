import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator, StyleSheet, Image, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Mail, Lock } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

import { useSession } from '../context/SessionContext';

export default function LoginScreen() {
    const { branchName } = useSession();
    const navigation = useNavigation<any>();
    const { width } = useWindowDimensions();
    const isSmallDevice = width < 380;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Eror', 'Silakan isi email dan kata sandi');
            return;
        }

        console.log('[Login] Starting login for:', email);
        setLoading(true);

        const config = (supabase as any).supabaseUrl;
        if (!config || config.includes('undefined')) {
             console.error('[Login] Supabase configuration missing!');
             Alert.alert('Eror Konfigurasi', 'URL Supabase tidak ditemukan. Pastikan file .env sudah benar.');
             setLoading(false);
             return;
        }

        const timeoutId = setTimeout(() => {
            if (isMounted.current) {
                console.warn('[Login] Timeout reached (20s)');
                setLoading(false);
                Alert.alert('Waktu Habis', 'Proses login terlalu lama (20 detik). Periksa koneksi internet Anda.');
            }
        }, 20000);

        try {
            console.log('[Login] Attempting auth.signInWithPassword...');
            const { error, data } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });

            console.log('[Login] signInWithPassword returned:', { hasError: !!error, hasData: !!data });
            clearTimeout(timeoutId);

            if (isMounted.current) {
                if (error) {
                    setLoading(false);
                    // Gunakan console.warn saja agar tidak memicu layar merah (LogBox) di Expo (Development)
                    console.warn('[Login] Gagal:', error.message);
                    Alert.alert('Gagal Masuk', 'Cek email atau password anda salah!!!');
                } else {
                    console.log('[Login] Sign-in successful, navigating to Main...');
                    navigation.navigate('Main');
                    // We don't setLoading(false) here because we're navigating away
                }
            }
        } catch (err: any) {
            clearTimeout(timeoutId);
            console.warn('[Login] Unexpected system error:', err.message);
            if (isMounted.current) {
                setLoading(false);
                Alert.alert('Eror Sistem', `Terjadi kesalahan saat login!!!`);
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Image 
                source={require('../../assets/cafe-bg.jpg')}
                style={styles.watermarkBg}
                resizeMode="cover"
            />

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex1}
            >
                <View style={[
                    styles.innerContainer,
                    isSmallDevice && { paddingHorizontal: 20 }
                ]}>
                    <View style={[
                        styles.header,
                        isSmallDevice && { marginBottom: 20 }
                    ]}>
                        <View style={[
                            styles.logoContainer,
                            isSmallDevice && { width: 80, height: 80, borderRadius: 40, marginBottom: 12 }
                        ]}>
                            <Image 
                                source={require('../../assets/logo.png')} 
                                style={[
                                    styles.logoImage,
                                    isSmallDevice && { width: 55, height: 55 }
                                ]} 
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={[
                            styles.subLogo,
                            isSmallDevice && { fontSize: 14 }
                        ]}>{branchName}</Text>
                    </View>

                    <View style={[
                        styles.card,
                        isSmallDevice && { padding: 20, borderRadius: 20 }
                    ]}>
                        <Text style={[
                            styles.cardTitle,
                            isSmallDevice && { fontSize: 18, marginBottom: 20 }
                        ]}>Sign In</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <View style={styles.inputWrapper}>
                                <Mail size={isSmallDevice ? 18 : 20} color="#94a3b8" style={styles.inputIcon} />
                                <TextInput
                                    style={[
                                        styles.input,
                                        isSmallDevice && { paddingVertical: 12, fontSize: 14 }
                                    ]}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    autoComplete="email"
                                    textContentType="emailAddress"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.inputWrapper}>
                                <Lock size={isSmallDevice ? 18 : 20} color="#94a3b8" style={styles.inputIcon} />
                                <TextInput
                                    style={[
                                        styles.input,
                                        isSmallDevice && { paddingVertical: 12, fontSize: 14 }
                                    ]}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    autoComplete="password"
                                    textContentType="password"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.button, 
                                loading && styles.buttonDisabled,
                                isSmallDevice && { padding: 14, borderRadius: 14 }
                            ]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={[
                                    styles.buttonText,
                                    isSmallDevice && { fontSize: 15 }
                                ]}>Login</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={[
                        styles.footer,
                        isSmallDevice && { marginTop: 20 }
                    ]}>
                        <Text style={styles.footerText}>© 2026 {branchName} System</Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    flex1: {
        flex: 1,
    },
    watermarkBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.04,
        width: '100%',
        height: '100%',
    },
    innerContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
        borderWidth: 2,
        borderColor: '#f1f5f9',
    },
    logoImage: {
        width: 70,
        height: 70,
    },
    subLogo: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: 28,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
        elevation: 5,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 28,
        color: '#1e293b',
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: '#64748b',
        marginBottom: 8,
        fontWeight: '600',
        fontSize: 13,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 15,
        color: '#0f172a',
    },
    button: {
        width: '100%',
        backgroundColor: '#ea580c',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 12,
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 0.5,
    },
    footer: {
        marginTop: 40,
        alignItems: 'center',
    },
    footerText: {
        color: '#94a3b8',
        fontSize: 13,
    },
});
