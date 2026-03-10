import * as React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet, useWindowDimensions, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen() {
    const navigation = useNavigation();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const isTablet = width >= 768 || height >= 768;
    const isLargeTablet = width >= 1000 || height >= 1000;

    const [tables, setTables] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showOccupiedModal, setShowOccupiedModal] = React.useState(false);
    const [posFlow, setPosFlow] = React.useState<'table' | 'direct'>('table');

    useFocusEffect(
        React.useCallback(() => {
            fetchTables();
            loadSettings();
        }, [])
    );

    const loadSettings = async () => {
        try {
            const savedFlow = await AsyncStorage.getItem('pos_flow');
            if (savedFlow) {
                setPosFlow(savedFlow as 'table' | 'direct');
            } else {
                setPosFlow('table');
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    };

    const fetchTables = async () => {
        try {
            setLoading(true);
            // Pangeran Natakusuma Branch ID = 7
            const PANGERAN_NATAKUSUMA_ID = 7;

            const { data, error } = await supabase
                .from('tables')
                .select('*')
                .eq('branch_id', PANGERAN_NATAKUSUMA_ID)
                .order('number', { ascending: true });

            if (error) throw error;

            console.log('Tables fetched:', data);
            setTables(data || []);
        } catch (error) {
            console.error('Error fetching tables:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            "Konfirmasi Keluar",
            "Apakah Anda yakin ingin kembali ke halaman login?",
            [
                { text: "Batal", style: "cancel" },
                {
                    text: "Keluar",
                    style: "destructive",
                    onPress: () => {
                        // @ts-ignore
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }
            ]
        );
    };

    const handleTablePress = (table: any) => {
        if (table.status === 'Occupied') {
            setShowOccupiedModal(true);
            return;
        }

        // @ts-ignore
        navigation.navigate('POS', {
            tableId: table.id,
            tableNumber: table.number,
            waiterName: ''
        });
    };

    const handleDirectMenu = () => {
        // @ts-ignore
        navigation.navigate('POS', {
            tableId: null,
            tableNumber: 'Tanpa Meja',
            waiterName: ''
        });
    };

    const handleMenuPress = (route: string) => {
        // @ts-ignore
        navigation.navigate(route);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.flex1}>
                <ScrollView
                    style={styles.flex1}
                    contentContainerStyle={[
                        isTablet && styles.tabletScrollContent,
                        isLandscape && { paddingHorizontal: isLargeTablet ? 80 : 40 }
                    ]}
                >
                    {/* Header */}
                    <View style={[styles.header, isTablet && styles.tabletHeader]}>
                        <View style={styles.headerRow}>
                            <View>
                                <Text style={[styles.greeting, isTablet && styles.tabletGreeting]}>Selamat Datang di</Text>
                                <Text style={[styles.username, isTablet && styles.tabletUsername]}>Winny PNK</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity
                                    style={[styles.logoutButton, { backgroundColor: '#f3f4f6' }]}
                                    onPress={() => navigation.navigate('Settings' as any)}
                                >
                                    <Text style={styles.logoutButtonIcon}>⚙️</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.logoutButton}
                                    onPress={handleLogout}
                                >
                                    <Text style={styles.logoutButtonIcon}>🔌</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {posFlow === 'direct' && (
                            <TouchableOpacity
                                style={styles.directMenuButton}
                                onPress={handleDirectMenu}
                            >
                                <Text style={styles.directMenuIcon}>🛒</Text>
                                <Text style={styles.directMenuText}>Langsung ke Daftar Menu</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Table Selection Grid */}
                    <View style={[styles.menuSection, isTablet && styles.tabletMenuSection]}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle]}>Pilih Meja</Text>
                            {loading && <ActivityIndicator color="#2563eb" />}
                        </View>

                        <View style={styles.menuGrid}>
                            {tables.map((table) => {
                                // Dynamic width: 3 columns for portrait, ~4-5 for mobile landscape, ~6-7 for tablet landscape
                                const cardWidth = isLandscape
                                    ? (isLargeTablet ? '15%' : (isTablet ? '23%' : '23%'))
                                    : '31.3%';

                                return (
                                    <TouchableOpacity
                                        key={table.id}
                                        style={[
                                            styles.tableCard,
                                            isTablet && styles.tabletTableCard,
                                            { width: cardWidth },
                                            table.status === 'Occupied' && styles.tableCardOccupied
                                        ]}
                                        activeOpacity={0.8}
                                        onPress={() => handleTablePress(table)}
                                    >
                                        <View style={styles.cardHeaderRow}>
                                            <Text style={[styles.tableNumber, isTablet && styles.tabletTableNumber]}>
                                                {table.number}
                                            </Text>
                                            <View style={[
                                                styles.statusBadge,
                                                { backgroundColor: table.status === 'Occupied' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)' }
                                            ]}>
                                                <Text style={[styles.statusIcon, { color: table.status === 'Occupied' ? '#ef4444' : '#22c55e' }]}>
                                                    {table.status === 'Occupied' ? '🔴' : '🟢'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.cardInfoRow}>
                                            <Text style={styles.capacityText}>👤 {table.capacity || 4} Kursi</Text>
                                        </View>

                                        <View style={styles.cardFooterRow}>
                                            <View style={[
                                                styles.pillBadge,
                                                { backgroundColor: table.status === 'Occupied' ? '#ef4444' : '#22c55e' }
                                            ]}>
                                                <Text style={styles.pillBadgeText}>
                                                    {table.status === 'Occupied' ? 'TERISI' : 'TERSEDIA'}
                                                </Text>
                                            </View>
                                            {table.status === 'Occupied' && (
                                                <Text style={styles.tableTime}>⌛ 1j 20m</Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>
            </View>

            {/* Modern Occupied Table Modal */}
            <Modal
                visible={showOccupiedModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowOccupiedModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modernModalContent}>
                        <View style={styles.modalIconContainer}>
                            <Text style={styles.modalIcon}>🚫</Text>
                        </View>
                        <Text style={styles.modalTitle}>Meja Sedang Terisi</Text>
                        <Text style={styles.modalDescription}>
                            Maaf, meja ini sedang digunakan oleh pelanggan lain. Silakan pilih meja lain yang masih tersedia (berwarna hijau).
                        </Text>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowOccupiedModal(false)}
                        >
                            <Text style={styles.modalCloseButtonText}>Saya Mengerti</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#d9c3a3',
    },
    flex1: {
        flex: 1,
    },
    header: {
        backgroundColor: '#d9c3a3',
        padding: 20,
        paddingBottom: 24,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 15,
        elevation: 5,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    greeting: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: '500',
    },
    username: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    logoutButton: {
        backgroundColor: '#8b4513', // SaddleBrown color
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.6, // Low opacity to blend in
    },
    logoutButtonIcon: {
        fontSize: 18,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    location: {
        color: '#2563eb',
        fontSize: 12,
        fontWeight: 'bold',
    },
    avatar: {
        width: 40,
        height: 40,
        backgroundColor: '#e5e7eb',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    avatarEmoji: {
        fontSize: 20,
    },
    summaryGrid: {
        flexDirection: 'row',
        gap: 16,
    },
    summaryCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    bgBlue: {
        backgroundColor: '#eff6ff',
        borderColor: '#dbeafe',
    },
    bgPurple: {
        backgroundColor: '#f5f3ff',
        borderColor: '#ede9fe',
    },
    cardLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    textBlue: {
        color: '#2563eb',
    },
    textPurple: {
        color: '#9333ea',
    },
    cardValue: {
        color: '#1f2937',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cardSub: {
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 4,
    },
    menuSection: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    menuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 10,
    },
    // New Card Styles
    tableCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 20,
        marginBottom: 10,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(229, 231, 235, 0.5)',
        minHeight: 130,
    },
    tableCardOccupied: {
        borderColor: '#fecaca',
        backgroundColor: '#fef2f2',
        opacity: 0.7, // Dimmed to show it's unavailable/disabled
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    tableNumber: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1f2937',
    },
    statusBadge: {
        padding: 8,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusIcon: {
        fontSize: 12,
    },
    cardInfoRow: {
        marginBottom: 8,
    },
    capacityText: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
    },
    pillBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: 0.5,
    },
    cardFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    tableStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    tableTime: {
        fontSize: 10,
        color: '#ef4444',
        fontWeight: '500',
    },

    // Tablet Styles for Cards
    tabletTableCard: {
        padding: 32,
        borderRadius: 24,
        minHeight: 180,
    },
    tabletTableNumber: {
        fontSize: 48,
    },

    // Legacy Styles (Keep if needed elsewhere or remove if unused)
    waiterContainer: {
        marginTop: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 8,
    },
    waiterInput: {
        backgroundColor: '#f3f4f6',
        padding: 12,
        borderRadius: 12,
        fontSize: 16,
        color: '#1f2937',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    settingsButton: {
        width: 40,
        height: 40,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    activitySection: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    activityCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f9fafb',
        paddingBottom: 12,
        marginBottom: 12,
    },
    activityItemNoBorder: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    miniIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    bgGreenLight: {
        backgroundColor: '#f0fdf4',
    },
    bgBlueLight: {
        backgroundColor: '#eff6ff',
    },
    activityText: {
        fontWeight: '500',
        color: '#1f2937',
    },
    activityTime: {
        fontSize: 12,
        color: '#6b7280',
    },
    amountPositive: {
        fontWeight: 'bold',
        color: '#16a34a',
    },
    amountInfo: {
        fontWeight: 'bold',
        color: '#2563eb',
    },

    // Tablet Specific Styles
    tabletScrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    tabletHeader: {
        padding: 24,
        paddingBottom: 32,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    tabletGreeting: {
        fontSize: 16,
    },
    tabletUsername: {
        fontSize: 28,
        marginTop: 2,
    },
    tabletLocation: {
        fontSize: 14,
    },
    tabletAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    tabletAvatarEmoji: {
        fontSize: 28,
    },
    tabletSummaryGrid: {
        marginTop: 16,
        gap: 16,
    },
    tabletSummaryCard: {
        padding: 16,
        borderRadius: 16,
    },
    tabletCardLabel: {
        fontSize: 12,
        marginBottom: 6,
    },
    tabletCardValue: {
        fontSize: 20,
    },
    tabletCardSub: {
        fontSize: 12,
        marginTop: 6,
    },
    tabletMenuSection: {
        padding: 24,
    },
    tabletSectionTitle: {
        fontSize: 24,
        marginBottom: 16,
    },
    tabletMenuItem: {
        width: '32%',
        paddingVertical: 32,
        borderRadius: 24,
        marginBottom: 8,
    },
    tabletIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginBottom: 16,
    },
    tabletIcon: {
        fontSize: 32,
    },
    tabletMenuTitle: {
        fontSize: 18,
    },
    tabletActivitySection: {
        paddingHorizontal: 40,
    },
    tabletActivityCard: {
        padding: 24,
        borderRadius: 24,
    },
    tabletActivityItem: {
        paddingBottom: 20,
        marginBottom: 20,
    },
    tabletMiniIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 20,
    },
    tabletMiniIconText: {
        fontSize: 24,
    },
    tabletActivityText: {
        fontSize: 18,
    },
    tabletActivityTime: {
        fontSize: 14,
    },
    tabletAmount: {
        fontSize: 18,
    },
    // Modern Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modernModalContent: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: 'white',
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 10,
    },
    modalIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalIcon: {
        fontSize: 40,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 12,
        textAlign: 'center',
    },
    modalDescription: {
        fontSize: 16,
        color: '#6b7280',
        lineHeight: 24,
        textAlign: 'center',
        marginBottom: 32,
    },
    modalCloseButton: {
        backgroundColor: '#8b4513',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
    },
    modalCloseButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    directMenuButton: {
        backgroundColor: '#ea580c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 20,
        marginTop: 20,
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    directMenuIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    directMenuText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
