import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function StoreSettingsScreen() {
    const navigation = useNavigation();
    const [waiters, setWaiters] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [modalVisible, setModalVisible] = React.useState(false);
    const [editingWaiter, setEditingWaiter] = React.useState<any>(null);
    const [newWaiterName, setNewWaiterName] = React.useState('');

    React.useEffect(() => {
        fetchWaiters();
    }, []);

    const fetchWaiters = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .or('position.ilike.%waiter%,position.ilike.%staff%,position.ilike.%pelayan%')
                .order('name', { ascending: true });

            if (error) throw error;
            setWaiters(data || []);
        } catch (error) {
            console.error('Error fetching waiters:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newWaiterName.trim()) return;

        try {
            if (editingWaiter) {
                const { error } = await supabase
                    .from('employees')
                    .update({ name: newWaiterName.trim() })
                    .eq('id', editingWaiter.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('employees')
                    .insert([{
                        name: newWaiterName.trim(),
                        position: 'Waiter',
                        department: 'Operations',
                        status: 'Active'
                    }]);
                if (error) throw error;
            }
            setModalVisible(false);
            setNewWaiterName('');
            setEditingWaiter(null);
            fetchWaiters();
        } catch (error) {
            console.error('Error saving waiter:', error);
            Alert.alert('Error', 'Gagal menyimpan data pelayan');
        }
    };

    const handleDelete = (waiter: any) => {
        Alert.alert(
            'Hapus Pelayan',
            `Apakah Anda yakin ingin menghapus ${waiter.name}?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('employees')
                                .delete()
                                .eq('id', waiter.id);
                            if (error) throw error;
                            fetchWaiters();
                        } catch (error) {
                            console.error('Error deleting waiter:', error);
                            Alert.alert('Error', 'Gagal menghapus pelayan');
                        }
                    }
                }
            ]
        );
    };

    const openEdit = (waiter: any) => {
        setEditingWaiter(waiter);
        setNewWaiterName(waiter.name);
        setModalVisible(true);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pengaturan Pelayan</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => {
                        setEditingWaiter(null);
                        setNewWaiterName('');
                        setModalVisible(true);
                    }}
                >
                    <Text style={styles.addButtonText}>+ Tambah</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            ) : (
                <FlatList
                    data={waiters}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <View style={styles.waiterItem}>
                            <View style={styles.waiterInfo}>
                                <Text style={styles.waiterName}>{item.name}</Text>
                                <Text style={styles.waiterPosition}>{item.position}</Text>
                            </View>
                            <View style={styles.actions}>
                                <TouchableOpacity onPress={() => openEdit(item)} style={[styles.actionBtn, styles.editBtn]}>
                                    <Text style={styles.actionText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionBtn, styles.deleteBtn]}>
                                    <Text style={styles.actionText}>Hapus</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Belum ada pelayan terdaftar</Text>
                        </View>
                    }
                />
            )}

            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingWaiter ? 'Edit Pelayan' : 'Tambah Pelayan'}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nama Pelayan"
                            value={newWaiterName}
                            onChangeText={setNewWaiterName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelBtnText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.saveBtn]}
                                onPress={handleSave}
                            >
                                <Text style={styles.saveBtnText}>Simpan</Text>
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
        backgroundColor: '#f9fafb',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    backButton: {
        marginRight: 16,
    },
    backButtonText: {
        fontSize: 24,
        color: '#1f2937',
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    addButton: {
        backgroundColor: '#2563eb',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    addButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    listContent: {
        padding: 16,
    },
    waiterItem: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    waiterInfo: {
        flex: 1,
    },
    waiterName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    waiterPosition: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    editBtn: {
        backgroundColor: '#eff6ff',
    },
    deleteBtn: {
        backgroundColor: '#fef2f2',
    },
    actionText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#374151',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        marginTop: 100,
        alignItems: 'center',
    },
    emptyText: {
        color: '#6b7280',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#1f2937',
    },
    input: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: '#f3f4f6',
    },
    saveBtn: {
        backgroundColor: '#2563eb',
    },
    cancelBtnText: {
        color: '#4b5563',
        fontWeight: 'bold',
    },
    saveBtnText: {
        color: 'white',
        fontWeight: 'bold',
    },
});
