import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ManagerAuthModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title?: string;
}

export default function ManagerAuthModal({ visible, onClose, onSuccess, title = 'Otorisasi Manager' }: ManagerAuthModalProps) {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            setPin('');
            setError(null);
        }
    }, [visible]);

    const handleNumberPress = (num: string) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleVerify = async () => {
        if (pin.length < 4) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Try Online Verification first
            const authorizedRoles = ['Manager', 'Manajer', 'Owner', 'Administrator', 'Admin', 'Supervisor'];
            
            const { data, error: fetchError } = await supabase
                .from('employees')
                .select('id, name, position, system_role, pin')
                .eq('pin', pin)
                .maybeSingle();

            let isAuthorized = false;
            let userName = '';

            if (data) {
                const pos = (data.position || '').toLowerCase();
                const sys = (data.system_role || '').toLowerCase();
                isAuthorized = authorizedRoles.some(role => 
                    pos.includes(role.toLowerCase()) || sys.includes(role.toLowerCase())
                );
                userName = data.name;
            }

            if (isAuthorized) {
                console.log('[ManagerAuth] Authorized by:', userName);
                onClose();
                setTimeout(() => {
                    onSuccess();
                }, 400);
            } else {
                // 2. Try Offline Cache if online fails or returns nothing (or if user wasn't authorized)
                const cachedManagersRaw = await AsyncStorage.getItem('cached_manager_pins');
                if (cachedManagersRaw) {
                    const cachedManagers = JSON.parse(cachedManagersRaw);
                    const matched = cachedManagers.find((m: any) => m.pin === pin);
                    if (matched) {
                        console.log('[ManagerAuth] Authorized Offline by:', matched.name);
                        onClose();
                        setTimeout(() => {
                            onSuccess();
                        }, 400);
                        setLoading(false);
                        return;
                    }
                }
                setError(data ? 'Anda tidak memiliki otoritas Manager' : 'PIN Salah');
                setPin('');
            }
        } catch (err) {
            console.error('[ManagerAuth] Sync Error:', err);
            // Fallback to offline cache even on error
            const cachedManagersRaw = await AsyncStorage.getItem('cached_manager_pins');
            if (cachedManagersRaw) {
                const cachedManagers = JSON.parse(cachedManagersRaw);
                const matched = cachedManagers.find((m: any) => m.pin === pin);
                if (matched) {
                    onClose();
                    setTimeout(() => {
                        onSuccess();
                    }, 400);
                    setLoading(false);
                    return;
                }
            }
            setError('Gagal verifikasi. Periksa koneksi.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-verify if 6 digits (optional, standard in many POS)
    useEffect(() => {
        if (pin.length === 6) {
            handleVerify();
        }
    }, [pin]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>Masukkan PIN Manager untuk melanjutkan</Text>

                    <View style={styles.pinDisplay}>
                        {[...Array(6)].map((_, i) => (
                            <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotFilled]} />
                        ))}
                    </View>

                    {error && <Text style={styles.errorText}>{error}</Text>}

                    <View style={styles.numpad}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map((item) => (
                            <TouchableOpacity
                                key={item.toString()}
                                style={[styles.numBtn, item === 'C' && styles.clearBtn]}
                                onPress={() => {
                                    if (item === 'C') setPin('');
                                    else if (item === '⌫') handleDelete();
                                    else handleNumberPress((item || '').toString());
                                }}
                                disabled={loading}
                            >
                                <Text style={[styles.numText, (item === 'C' || item === '⌫') && styles.actionNumText]}>
                                    {item}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity 
                        style={[styles.verifyBtn, (pin.length < 4 || loading) && styles.disabledBtn]} 
                        onPress={handleVerify}
                        disabled={pin.length < 4 || loading}
                    >
                        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.verifyText}>VERIFIKASI</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    container: { backgroundColor: 'white', borderRadius: 24, padding: 24, width: '90%', maxWidth: 400 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    closeBtn: { padding: 8 },
    closeText: { fontSize: 18, color: '#9ca3af' },
    subtitle: { textAlign: 'center', color: '#6b7280', marginBottom: 24, fontSize: 14 },
    pinDisplay: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 },
    pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#e5e7eb' },
    pinDotFilled: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
    errorText: { color: '#ef4444', textAlign: 'center', marginBottom: 16, fontWeight: '600' },
    numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
    numBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
    numText: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
    clearBtn: { backgroundColor: '#fee2e2' },
    actionNumText: { color: '#ef4444' },
    verifyBtn: { backgroundColor: '#ea580c', padding: 18, borderRadius: 16, marginTop: 24, alignItems: 'center' },
    verifyText: { color: 'white', fontWeight: 'bold', fontSize: 18, letterSpacing: 1 },
    disabledBtn: { opacity: 0.5 }
});
