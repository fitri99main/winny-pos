import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Switch, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
    const navigation = useNavigation();
    const [posFlow, setPosFlow] = React.useState<'table' | 'direct'>('table');
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const savedFlow = await AsyncStorage.getItem('pos_flow');
            if (savedFlow) {
                setPosFlow(savedFlow as 'table' | 'direct');
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        } finally {
            setLoading(false);
        }
    };

    const togglePosFlow = async (value: boolean) => {
        const newFlow = value ? 'direct' : 'table';
        setPosFlow(newFlow);
        try {
            await AsyncStorage.setItem('pos_flow', newFlow);
        } catch (e) {
            console.error('Error saving pos_flow:', e);
        }
    };

    const handleLogout = () => {
        // In a real app, you would clear auth state here
        navigation.reset({
            index: 0,
            routes: [{ name: 'Login' } as any],
        });
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#ea580c" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.innerContainer}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Pengaturan</Text>
                </View>

                <Text style={styles.sectionLabel}>Umum</Text>
                <View style={styles.card}>
                    <TouchableOpacity
                        style={styles.item}
                        onPress={() => navigation.navigate('StoreSettings' as any)}
                    >
                        <Text style={styles.itemText}>Pengaturan Toko</Text>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item}>
                        <Text style={styles.itemText}>Profil Pengguna</Text>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionLabel}>Alur Penjualan</Text>
                <View style={[styles.card, { padding: 16 }]}>
                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Langsung ke Menu</Text>
                            <Text style={styles.settingSubtitle}>Lewati pemilihan meja saat masuk kasir</Text>
                        </View>
                        <Switch
                            value={posFlow === 'direct'}
                            onValueChange={togglePosFlow}
                            trackColor={{ false: '#d1d5db', true: '#fde68a' }}
                            thumbColor={posFlow === 'direct' ? '#ea580c' : '#f3f4f6'}
                        />
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Lainnya</Text>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.item}>
                        <Text style={styles.itemText}>Notifikasi</Text>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.lastItem]}>
                        <Text style={styles.itemText}>Tentang Aplikasi</Text>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    onPress={handleLogout}
                    style={styles.logoutButton}
                >
                    <Text style={styles.logoutText}>Keluar</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    innerContainer: {
        flex: 1,
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        marginRight: 16,
    },
    backButtonText: {
        fontSize: 24,
        color: '#1f2937',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 16,
        letterSpacing: 1,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
    },
    item: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastItem: {
        borderBottomWidth: 0,
    },
    itemText: {
        color: '#374151',
        fontWeight: '500',
        fontSize: 16,
    },
    chevron: {
        color: '#9ca3af',
        fontSize: 20,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    settingSubtitle: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    logoutButton: {
        marginTop: 32,
        backgroundColor: '#fef2f2',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fee2e2',
        alignItems: 'center',
    },
    logoutText: {
        color: '#dc2626',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
