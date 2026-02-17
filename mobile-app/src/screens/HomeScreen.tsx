import * as React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet, useWindowDimensions, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function HomeScreen() {
    const navigation = useNavigation();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const isTablet = width >= 768 || height >= 768;
    const isLargeTablet = width >= 1000 || height >= 1000;

    const [tables, setTables] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetchTables();
    }, []);

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
        // @ts-ignore
        navigation.navigate('POS', {
            tableId: table.id,
            tableNumber: table.number,
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
                                <Text style={[styles.username, isTablet && styles.tabletUsername]}>Winny Pangeran Natakusuma</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.logoutButton}
                                onPress={handleLogout}
                            >
                                <Text style={styles.logoutButtonText}>Kembali ke Login</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Table Selection Grid */}
                    <View style={[styles.menuSection, isTablet && styles.tabletMenuSection]}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle]}>Pilih Meja</Text>
                            {loading && <ActivityIndicator color="#2563eb" />}
                        </View>

                        <View style={styles.menuGrid}>
                            {tables.map((table) => (
                                <TouchableOpacity
                                    key={table.id}
                                    style={[
                                        styles.tableCard,
                                        isTablet && styles.tabletTableCard,
                                        isLandscape && { width: isLargeTablet ? '15%' : '23%' },
                                        table.status === 'Occupied' && styles.tableCardOccupied
                                    ]}
                                    onPress={() => handleTablePress(table)}
                                >
                                    <View style={styles.cardHeaderRow}>
                                        <Text style={[styles.tableNumber, isTablet && styles.tabletTableNumber]}>
                                            {table.number}
                                        </Text>
                                        <View style={[
                                            styles.statusBadge,
                                            { backgroundColor: table.status === 'Occupied' ? '#fee2e2' : '#dcfce7' }
                                        ]}>
                                            <View style={[
                                                styles.statusDot,
                                                { backgroundColor: table.status === 'Occupied' ? '#ef4444' : '#16a34a' }
                                            ]} />
                                        </View>
                                    </View>

                                    <View style={styles.cardFooterRow}>
                                        <Text style={[
                                            styles.tableStatusText,
                                            { color: table.status === 'Occupied' ? '#dc2626' : '#166534' }
                                        ]}>
                                            {table.status === 'Occupied' ? 'Terisi' : 'Tersedia'}
                                        </Text>
                                        {table.status === 'Occupied' && (
                                            <Text style={styles.tableTime}>1j 20m</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    flex1: {
        flex: 1,
    },
    header: {
        backgroundColor: 'white',
        padding: 16,
        paddingBottom: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 1,
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
        backgroundColor: '#fee2e2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    logoutButtonText: {
        color: '#dc2626',
        fontSize: 12,
        fontWeight: 'bold',
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
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 16,
    },
    menuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 12,
    },
    // New Card Styles
    tableCard: {
        width: '48%',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        marginBottom: 4,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        minHeight: 100,
    },
    tableCardOccupied: {
        borderColor: '#fecaca',
        backgroundColor: '#fef2f2',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    tableNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1f2937',
    },
    statusBadge: {
        padding: 6,
        borderRadius: 12,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
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
        padding: 24,
        borderRadius: 20,
        minHeight: 140,
    },
    tabletTableNumber: {
        fontSize: 32,
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
});
