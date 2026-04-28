import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet, ActivityIndicator, Alert, FlatList, Modal, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { CheckCircle2, X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useSession } from '../context/SessionContext';

export default function KDSScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { initialFilter = 'All' } = (route.params as any) || {};
    const { width, height } = useWindowDimensions();
    const isSmallDevice = width < 480;
    const isLandscape = width > height;
    const isWide = width >= 600;
    const numColumns = isWide ? 4 : (width >= 500 ? 2 : 1);
    const { currentBranchId } = useSession();

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'All' | 'Kitchen' | 'Bar'>(initialFilter);
    const [now, setNow] = useState(new Date());
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [completing, setCompleting] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!currentBranchId) return;

        fetchActiveOrders();

        const branchIdInt = parseInt(currentBranchId);
        const filterValue = isNaN(branchIdInt) ? currentBranchId : branchIdInt;
        console.log('[KDSScreen] Subscribing to branch:', currentBranchId, '(Filter:', filterValue, ')');

        const salesSub = supabase.channel(`kds_sales_${currentBranchId}`)
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'sales' }, 
                (payload) => {
                    const newRow = payload.new as any;
                    const eventType = payload.eventType;

                    console.log('[KDSScreen] Real-time Sales Event Received:', {
                        event: eventType,
                        row_id: newRow?.id,
                        row_branch: newRow?.branch_id,
                        current_app_branch: currentBranchId
                    });

                    // Manual filter for branch_id (safer than Postgres filter string)
                    if (newRow && String(newRow.branch_id || '').trim() === String(currentBranchId || '').trim()) {
                        console.log('[KDSScreen] Match found! Refreshing orders...');
                        fetchActiveOrders();
                    } else if (eventType === 'DELETE') {
                        fetchActiveOrders();
                    }
                }
            );

        salesSub.subscribe((status) => {
            console.log(`[KDSScreen] Sales subscription status for branch ${currentBranchId}:`, status);
            if (status === 'SUBSCRIBED') {
                fetchActiveOrders();
            }
        });

        const itemsSub = supabase.channel(`kds_items_${currentBranchId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, () => {
                console.log('[KDSScreen] Item change detected');
                fetchActiveOrders();
            });

        itemsSub.subscribe((status) => {
            console.log(`[KDSScreen] Items subscription status for branch ${currentBranchId}:`, status);
        });

        // Polling fallback (60s as KDS is less critical for instant entry than POS but good to have)
        const pollingInterval = setInterval(fetchActiveOrders, 60000);

        return () => {
            supabase.removeChannel(salesSub);
            supabase.removeChannel(itemsSub);
            clearInterval(pollingInterval);
        };
    }, [currentBranchId]);

    const fetchActiveOrders = async () => {
        if (!currentBranchId) return;
        
        try {
            // Loosened status filter: Fetch ALL orders to identify what's hiding them
            const { data, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    items:sale_items(*)
                `)
                .eq('branch_id', currentBranchId)
                .neq('status', 'Completed') // Only active orders
                .order('date', { ascending: false })
                .limit(50);

            if (error) throw error;

            console.log('[KDS] Raw orders fetched:', data?.length);
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching KDS orders:', error);
            showToast('Gagal memuat data: ' + (error as any).message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const getElapsedTime = (dateStr: string) => {
        if (!dateStr) return '0m';
        const start = new Date(dateStr).getTime();
        const diff = now.getTime() - start;
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m`;
    };

    const handleUpdateItemStatus = async (itemId: number, newStatus: string) => {
        // Optimistic UI Update
        const originalOrders = [...orders];
        setOrders(prevOrders => 
            prevOrders.map(order => ({
                ...order,
                items: (order.items || []).map((item: any) => 
                    item.id === itemId ? { ...item, status: newStatus } : item
                )
            }))
        );

        try {
            console.log('[KDS] Updating item:', itemId, 'to', newStatus);
            const { error } = await supabase
                .from('sale_items')
                .update({ status: newStatus })
                .eq('id', itemId);

            if (error) {
                // Revert state on error
                setOrders(originalOrders);
                throw error;
            }
            
            console.log('[KDS] Item status updated successfully');
        } catch (error: any) {
            console.error('Error updating item status:', error);
            const msg = error.message || 'Periksa koneksi internet Anda';
            Alert.alert('Gagal Update', `Tidak bisa mengubah status item: ${msg}`);
        }
    };

    const handleCompleteOrder = (orderId: number) => {
        setSelectedOrderId(orderId);
        setShowCompleteModal(true);
    };

    const confirmCompleteOrder = async () => {
        if (!selectedOrderId) return;
        
        const originalOrders = [...orders];
        const orderIdToComplete = selectedOrderId; // Local copy to avoid race conditions

        const currentFilter = filter;
        const dummy = true;

        try {
            setCompleting(true);
            
            // 1. Update local state
            setOrders(prev => prev.map(o => {
                if (o.id === orderIdToComplete) {
                    return {
                        ...o,
                        items: (o.items || []).map((item: any) => 
                            (currentFilter === 'All' || (item.target || determineTarget(item)) === currentFilter)
                                ? { ...item, status: 'Served' }
                                : item
                        )
                    };
                }
                return o;
            }));
            setShowCompleteModal(false);

            // 2. Update DB
            if (currentFilter === 'All') {
                await supabase.from('sale_items').update({ status: 'Served' }).eq('sale_id', orderIdToComplete);
            } else {
                await supabase.from('sale_items').update({ status: 'Served' }).eq('sale_id', orderIdToComplete).eq('target', currentFilter);
            }

            // 3. Check if all items are served
            const order = originalOrders.find(o => o.id === orderIdToComplete);
            if (order) {
                const updatedItems = (order.items || []).map((item: any) => 
                    (currentFilter === 'All' || (item.target || determineTarget(item)) === currentFilter)
                        ? { ...item, status: 'Served' }
                        : item
                );
                const allServed = updatedItems.every((i: any) => i.status === 'Served');

                if (allServed) {
                    let waitingTime = '';
                    const start = new Date(order.created_at || order.date).getTime();
                    const diff = Date.now() - start;
                    const minutes = Math.floor(diff / 60000);
                    waitingTime = `${minutes} menit`;

                    await supabase
                        .from('sales')
                        .update({ 
                            status: 'Completed',
                            waiting_time: waitingTime
                        })
                        .eq('id', orderIdToComplete);
                    
                    setOrders(prev => prev.filter(o => o.id !== orderIdToComplete));
                }
            }
            setSelectedOrderId(null);
            return;
        } catch (error: any) {
            console.error('Error completing order station items:', error);
            setOrders(originalOrders);
            return;
        }
        setOrders(prev => prev.filter(o => o.id !== orderIdToComplete));
        setShowCompleteModal(false);
        
        try {
            setCompleting(true);
            
            // Calculate waiting time
            const order = originalOrders.find(o => o.id === orderIdToComplete);
            let waitingTime = '';
            if (order) {
                const start = new Date(order.created_at || order.date).getTime();
                const diff = Date.now() - start;
                const minutes = Math.floor(diff / 60000);
                waitingTime = `${minutes} menit`;
            }

            console.log('[KDS] Completing order:', orderIdToComplete);
            
            const { error } = await supabase
                .from('sales')
                .update({ 
                    status: 'Completed',
                    waiting_time: waitingTime
                })
                .eq('id', orderIdToComplete);

            if (error) {
                // Revert state if error
                setOrders(originalOrders);
                throw error;
            }
            
            console.log('[KDS] Order completed successfully:', orderIdToComplete);
            setSelectedOrderId(null);
        } catch (error: any) {
            console.error('Error completing order:', error);
            const msg = error.message || 'Koneksi terganggu';
            Alert.alert('Gagal Selesai', `Gagal menyimpan status pesanan: ${msg}`);
            setOrders(originalOrders);
        } finally {
            setCompleting(false);
        }
    };

    const determineTarget = (item: any) => {
        // Robust Heuristic: Matches Web version
        const nameLow = (item.product_name || item.name || '').toLowerCase();
        const categoryLow = (item.category || '').toLowerCase();

        const isDrink = [
            'minum', 'drink', 'beverage', 'juice', 'jus', 'tea', 'teh', 'coffee', 'kopi', 
            'susu', 'milk', 'water', 'air', 'mineral', 'soda', 'cola', 'coke', 'sprite', 'fanta',
            'beer', 'bir', 'wine', 'cocktail', 'mocktail', 'smoothie', 'shake', 'milo', 
            'boba', 'thai tea', 'green tea', 'lemongrass', 'jeruk', 'lemon', 'alpukat', 'mangga', 
            'strawberry', 'jahe', 'madu', 'sirup', 'cendol', 'dawet', 'wedang', 'gembira', 'arak',
            'espresso', 'latte', 'cappuccino', 'frappe'
        ].some(k => categoryLow.includes(k) || nameLow.includes(k)) || 
        nameLow.startsWith('es ') || nameLow.startsWith('ice ') || 
        nameLow.includes(' es ') || nameLow.includes(' ice ') ||
        nameLow.includes(' panas') || nameLow.includes(' hot') || 
        nameLow.includes(' dingin') || nameLow.includes(' cold');

        return isDrink ? 'Bar' : 'Kitchen';
    };

    const filteredOrders = orders.map(order => {
        const items = (order.items || []).filter((item: any) => {
            if (filter === 'All') return true;
            // Use existing target or fallback to smart determination
            const finalTarget = item.target || determineTarget(item);
            return finalTarget === filter;
        });
        return { ...order, items: items.filter((item: any) => item.status !== 'Served') };
    }).filter(order => order.items.length > 0);

    const renderOrderItem = ({ item: order }: { item: any }) => {
        const allItemsReady = (order.items || []).every((i: any) => i.status === 'Ready');
        const elapsed = parseInt(getElapsedTime(order.date));

        return (
            <View style={[
                styles.orderCard,
                isSmallDevice && { width: '100%', padding: 12, borderRadius: 16 }
            ]}>
                <View style={[
                    styles.orderHeader,
                    isSmallDevice && { marginBottom: 8, paddingBottom: 8 }
                ]}>
                    <View>
                        <Text style={styles.orderNo}>{order.order_no}</Text>
                        <Text style={[
                            styles.tableName,
                            isSmallDevice && { fontSize: 14 }
                        ]}>Meja {order.table_no || '-'}</Text>
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={[styles.timeText, elapsed > 15 && styles.timeWarning]}>
                            {elapsed}m lalu
                        </Text>
                        <Text style={styles.waiterName}>👤 {order.waiter_name || 'Kiosk'}</Text>
                    </View>
                </View>

                <View style={[
                    styles.itemsList,
                    isSmallDevice && { marginBottom: 12 }
                ]}>
                    {order.items.map((item: any, index: number) => (
                        <View key={`item-${item.id || index}-${index}`} style={styles.itemRow}>
                            <View style={styles.itemMain}>
                                <View style={[
                                    styles.quantityBadge, 
                                    item.status === 'Ready' && styles.quantityBadgeReady,
                                    isSmallDevice && { width: 22, height: 22, borderRadius: 6, marginRight: 6 }
                                ]}>
                                    <Text style={[
                                        styles.quantityText,
                                        isSmallDevice && { fontSize: 10 }
                                    ]}>{item.quantity}</Text>
                                </View>
                                <Text 
                                    style={[
                                        styles.itemName, 
                                        item.status === 'Ready' && styles.itemNameReady,
                                        isSmallDevice && { fontSize: 11 }
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {item.product_name}
                                </Text>
                                {item.notes ? (
                                    <View style={{ marginLeft: 32, marginTop: 1 }}>
                                        <Text style={{ fontSize: 10, color: '#ea580c', fontStyle: 'italic' }}>
                                            • {item.notes}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                            {item.status !== 'Ready' && (
                                <TouchableOpacity 
                                    style={[
                                        styles.readyButton,
                                        isSmallDevice && { paddingVertical: 2, paddingHorizontal: 6 }
                                    ]}
                                    onPress={() => handleUpdateItemStatus(item.id, 'Ready')}
                                >
                                    <Text style={[
                                        styles.readyButtonText,
                                        isSmallDevice && { fontSize: 9 }
                                    ]}>Check</Text>
                                </TouchableOpacity>
                            )}
                            {item.status === 'Ready' && (
                                <Text style={[
                                    styles.readyBadge,
                                    isSmallDevice && { fontSize: 12 }
                                ]}>✅</Text>
                            )}
                        </View>
                    ))}
                </View>

                <TouchableOpacity 
                    style={[
                        styles.completeButton, 
                        !allItemsReady && styles.completeButtonDisabled,
                        isSmallDevice && { paddingVertical: 10, borderRadius: 10 }
                    ]}
                    disabled={!allItemsReady}
                    onPress={() => handleCompleteOrder(order.id)}
                >
                    <Text style={[
                        styles.completeButtonText, 
                        !allItemsReady && styles.completeButtonTextDisabled,
                        isSmallDevice && { fontSize: 12 }
                    ]}>
                        {allItemsReady ? 'Siap Sajikan' : 'Belum Lengkap'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>&lsaquo;</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Monitor Pesanan</Text>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>Cabang: {currentBranchId || 'Tidak Diketahui'} • Total: {orders.length} Data</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => {
                        fetchActiveOrders();
                    }} 
                    style={{ backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 }}
                >
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#ea580c' }}>Segarkan</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tabsContainer}>
                {(['All', 'Kitchen', 'Bar'] as const).map((t) => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.tab, filter === t && styles.activeTab]}
                        onPress={() => setFilter(t)}
                    >
                        <Text style={[styles.tabText, filter === t && styles.activeTabText]}>
                            {t === 'All' ? 'Semua' : t === 'Kitchen' ? 'Dapur' : 'Bar'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#ea580c" />
                </View>
            ) : filteredOrders.length === 0 ? (
                <View style={styles.centerContent}>
                    <Text style={styles.emptyText}>Tidak ada pesanan aktif</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredOrders}
                    renderItem={renderOrderItem}
                    keyExtractor={(item, index) => `order-${item?.id || index}-${index}`}
                    contentContainerStyle={[
                        styles.listContent,
                        isSmallDevice && { padding: 8 }
                    ]}
                    numColumns={numColumns}
                    key={`kds-grid-${numColumns}`}
                />
            )}

            {/* Modern Complete Order Modal */}
            <Modal
                visible={showCompleteModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCompleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modernModalContent}>
                        <TouchableOpacity 
                            style={styles.closeModalButton}
                            onPress={() => setShowCompleteModal(false)}
                        >
                            <X size={20} color="#94a3b8" />
                        </TouchableOpacity>

                        <View style={styles.modalIconContainer}>
                            <CheckCircle2 size={32} color="#10b981" />
                        </View>
                        
                        <Text style={styles.modalTitle}>Selesaikan Pesanan</Text>
                        <Text style={styles.modalDescription}>
                            Semua item telah siap. Tandai pesanan ini sebagai selesai diproses?
                        </Text>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelModalButton}
                                onPress={() => setShowCompleteModal(false)}
                            >
                                <Text style={styles.cancelModalButtonText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmModalButton}
                                onPress={confirmCompleteOrder}
                                disabled={completing}
                            >
                                {completing ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text style={styles.confirmModalButtonText}>Ya, Selesai</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    backButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    backButtonText: {
        fontSize: 40,
        lineHeight: 40,
        color: '#1f2937',
        textAlign: 'center',
        marginTop: -4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    tabsContainer: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: 'white',
        gap: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
    },
    activeTab: {
        backgroundColor: '#ea580c',
    },
    tabText: {
        fontWeight: 'bold',
        color: '#6b7280',
    },
    activeTabText: {
        color: 'white',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#9ca3af',
        fontWeight: '500',
    },
    listContent: {
        padding: 12,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    orderCard: {
        width: '48.5%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    orderNo: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#ea580c',
    },
    tableName: {
        fontSize: 14,
        fontWeight: '900',
        color: '#1f2937',
    },
    headerInfo: {
        alignItems: 'flex-end',
    },
    timeText: {
        fontSize: 10,
        color: '#6b7280',
    },
    timeWarning: {
        color: '#ef4444',
        fontWeight: 'bold',
    },
    waiterName: {
        fontSize: 10,
        color: '#9ca3af',
        marginTop: 2,
    },
    itemsList: {
        marginBottom: 16,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemMain: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    quantityBadge: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    quantityBadgeReady: {
        backgroundColor: '#dcfce7',
    },
    quantityText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#4b5563',
    },
    itemName: {
        fontSize: 11,
        color: '#374151',
        fontWeight: '500',
        flex: 1,
    },
    itemNameReady: {
        color: '#9ca3af',
        textDecorationLine: 'line-through',
    },
    readyButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: '#fff7ed',
        borderWidth: 1,
        borderColor: '#fdba74',
    },
    readyButtonText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#ea580c',
    },
    readyBadge: {
        fontSize: 14,
    },
    completeButton: {
        backgroundColor: '#1f2937',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    completeButtonDisabled: {
        backgroundColor: '#f3f4f6',
    },
    completeButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 13,
    },
    completeButtonTextDisabled: {
        color: '#9ca3af',
    },
    // Modern Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modernModalContent: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: 'white',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },
    closeModalButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 4,
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#ecfdf5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 10,
    },
    modalDescription: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
        paddingHorizontal: 10,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelModalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    cancelModalButtonText: {
        color: '#64748b',
        fontWeight: 'bold',
        fontSize: 14,
    },
    confirmModalButton: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#10b981',
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmModalButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
