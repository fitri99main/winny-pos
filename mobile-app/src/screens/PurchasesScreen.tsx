import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet, useWindowDimensions, TextInput, ActivityIndicator, FlatList, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import { ArrowLeft, Plus, History, ShoppingCart, Search, Trash2, CheckCircle, Package, User, Edit } from 'lucide-react-native';
import ModernToast from '../components/ModernToast';
import { PettyCashService } from '../lib/PettyCashService';

export default function PurchasesScreen() {
    const navigation = useNavigation();
    const { currentBranchId, storeSettings } = useSession();
    const [activeTab, setActiveTab] = useState<'history' | 'input'>('history');
    const [loading, setLoading] = useState(false);
    
    // History State
    const [purchases, setPurchases] = useState<any[]>([]);
    
    // Input State
    const [supplier, setSupplier] = useState('');
    const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Tunai');
    const paymentMethods = ['Tunai', 'Transfer', 'Kas Kecil', 'Hutang'];
    
    // Master Data
    const [contacts, setContacts] = useState<any[]>([]);
    const [masterItems, setMasterItems] = useState<any[]>([]);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [itemSearch, setItemSearch] = useState('');
    
    // Manual Input State
    const [isManualSupplier, setIsManualSupplier] = useState(false);
    const [manualSupplierName, setManualSupplierName] = useState('');
    const [showManualItemModal, setShowManualItemModal] = useState(false);
    const [manualItemForm, setManualItemForm] = useState({ name: '', price: '' });

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [purchaseNo, setPurchaseNo] = useState('');


    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch History
            const { data: pData } = await supabase
                .from('purchases')
                .select('*')
                .eq('branch_id', currentBranchId)
                .order('date', { ascending: false });
            
            if (pData) setPurchases(pData);

            // Fetch Contacts (Suppliers)
            const { data: cData } = await supabase
                .from('contacts')
                .select('*')
                .eq('type', 'Supplier');
            
            if (cData) setContacts(cData);

            // Fetch Ingredients & Products for selection
            const [ingRes, prodRes] = await Promise.all([
                supabase.from('ingredients').select('id, name, code, cost_per_unit, unit').eq('branch_id', currentBranchId),
                supabase.from('products').select('id, name, code, price').eq('branch_id', currentBranchId)
            ]);

            const mergedItems = [
                ...(ingRes.data || []).map(i => ({ ...i, type: 'Ingredient', cost: i.cost_per_unit })),
                ...(prodRes.data || []).map(p => ({ ...p, type: 'Product', cost: p.price }))
            ];
            setMasterItems(mergedItems);

        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePurchase = async () => {
        const finalSupplier = isManualSupplier ? manualSupplierName : supplier;
        
        if (!finalSupplier) return showToast('Pilih atau input supplier terlebih dahulu', 'error');
        if (purchaseItems.length === 0) return showToast('Tambahkan item pembelian', 'error');

        setLoading(true);
        try {
            const totalAmount = purchaseItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const finalPO = purchaseNo || `PO-MOB-${Date.now().toString().slice(-6)}`;

            const payload = {
                purchase_no: finalPO,
                supplier_name: finalSupplier,
                date: new Date().toISOString().split('T')[0],
                items_count: purchaseItems.reduce((sum, i) => sum + i.quantity, 0),
                total_amount: totalAmount,
                status: isEditing ? 'Completed' : 'Pending',
                payment_method: paymentMethod,
                branch_id: currentBranchId,
                items_list: purchaseItems
            };

            if (isEditing && editingId) {
                const { error } = await supabase.from('purchases').update(payload).eq('id', editingId);
                if (error) throw error;
                showToast('Pembelian diupdate');
            } else {
                const { error } = await supabase.from('purchases').insert([payload]);
                if (error) throw error;
                showToast('Pembelian disimpan');
            }

            // Petty Cash Integration
            if (paymentMethod === 'Kas Kecil') {
                try {
                    const activeSession = await PettyCashService.getActiveSession(currentBranchId!);
                    if (activeSession) {
                        await PettyCashService.addTransaction({
                            session_id: activeSession.id,
                            type: 'SPEND',
                            amount: totalAmount,
                            description: `Pembelian: ${finalPO}`,
                            reference_type: 'purchase',
                            reference_id: finalPO
                        });
                        showToast('Saldo Kas Kecil terpotong');
                    } else {
                        showToast('PO Berhasil, namun tidak ada sesi Kas Kecil aktif', 'info');
                    }
                } catch (pcErr) {
                    console.error('Petty Cash Sync Error:', pcErr);
                }
            }

            // Reset
            setPurchaseItems([]);
            setSupplier('');
            setManualSupplierName('');
            setIsManualSupplier(false);
            setIsEditing(false);
            setEditingId(null);
            setPurchaseNo('');
            setPaymentMethod('Tunai');
            setActiveTab('history');
            fetchData();
        } catch (err) {
            console.error('Save error:', err);
            showToast('Gagal menyimpan pembelian', 'error');
        } finally {
            setLoading(false);
        }
    };


    const formatCurrency = (val: number) => {
        return `Rp ${val.toLocaleString('id-ID')}`;
    };

    const filteredMasterItems = useMemo(() => {
        if (!itemSearch) return masterItems.slice(0, 50);
        return masterItems.filter(i => 
            i.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
            (i.code && i.code.toLowerCase().includes(itemSearch.toLowerCase()))
        );
    }, [masterItems, itemSearch]);

    const stats = useMemo(() => {
        const now = new Date();
        const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM
        const monthPurchases = purchases.filter(p => p.date?.includes(thisMonth));
        
        return {
            totalThisMonth: monthPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0),
            countThisMonth: monthPurchases.length,
            overallTotal: purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0)
        };
    }, [purchases]);


    const handleAddItem = (item: any) => {
        const existing = purchaseItems.findIndex(i => i.name === item.name);
        if (existing >= 0) {
            const newItems = [...purchaseItems];
            newItems[existing].quantity += 1;
            setPurchaseItems(newItems);
        } else {
            setPurchaseItems([...purchaseItems, { name: item.name, price: item.cost || 0, quantity: 1, type: item.type }]);
        }
        showToast(`Menambahkan ${item.name}`);
    };

    const handleEditPurchase = (item: any) => {
        setIsEditing(true);
        setEditingId(item.id);
        setPurchaseNo(item.purchase_no);
        
        // Find if supplier is in contacts
        const isKnown = contacts.some(c => c.name === item.supplier_name);
        if (isKnown) {
            setSupplier(item.supplier_name);
            setIsManualSupplier(false);
        } else {
            setManualSupplierName(item.supplier_name);
            setIsManualSupplier(true);
        }

        setPurchaseItems(item.items_list || []);
        setPaymentMethod(item.payment_method || 'Tunai');
        setActiveTab('input');
    };

    const handleDeletePurchase = async (id: number, no: string) => {
        const deleteAction = async () => {
            setLoading(true);
            try {
                const { error } = await supabase.from('purchases').delete().eq('id', id);
                if (error) throw error;
                showToast('Pembelian dihapus');
                fetchData();
            } catch (err) {
                showToast('Gagal menghapus', 'error');
            } finally {
                setLoading(false);
            }
        };

        // In React Native, we use Alert for confirmation
        // But since this is a web-ready assistant, I'll use a direct confirm if in a web-like context 
        // OR I'll assume standard React Native Alert.
        // For now, I'll assume the environment supports standard Alert.
        try {
            const { Alert } = require('react-native');
            Alert.alert(
                'Konfirmasi Hapus',
                `Apakah Anda yakin ingin menghapus PO ${no}?`,
                [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Hapus', style: 'destructive', onPress: deleteAction }
                ]
            );
        } catch {
            // Fallback for non-RN environments (if any)
            if (window.confirm(`Hapus PO ${no}?`)) deleteAction();
        }
    };


    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color="#1e293b" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pembelian (Keluar Uang)</Text>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'history' && styles.activeTab]} 
                    onPress={() => setActiveTab('history')}
                >
                    <History size={18} color={activeTab === 'history' ? '#ea580c' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>Riwayat</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'input' && styles.activeTab]} 
                    onPress={() => setActiveTab('input')}
                >
                    <Plus size={18} color={activeTab === 'input' ? '#ea580c' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'input' && styles.activeTabText]}>Input Baru</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#ea580c" />
                </View>
            ) : activeTab === 'history' ? (
                <FlatList
                    data={purchases}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    ListHeaderComponent={
                        <View style={styles.statsContainer}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Total Belanja (Bulan Ini)</Text>
                                <Text style={styles.statValue}>{formatCurrency(stats.totalThisMonth)}</Text>
                                <Text style={styles.statSub}>{stats.countThisMonth} Transaksi</Text>
                            </View>
                            <View style={styles.indicatorRow}>
                                <View style={styles.indicator}>
                                    <Text style={styles.indicatorLabel}>Total Keseluruhan</Text>
                                    <Text style={styles.indicatorValue}>{formatCurrency(stats.overallTotal)}</Text>
                                </View>
                            </View>
                            <Text style={styles.sectionTitle}>Riwayat Transaksi</Text>
                        </View>
                    }
                    renderItem={({ item }) => (

                        <View style={styles.purchaseCard}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.poNumber}>{item.purchase_no}</Text>
                                <View style={[styles.statusBadge, item.status === 'Completed' ? styles.statusSuccess : styles.statusPending]}>
                                    <Text style={styles.statusText}>{item.status}</Text>
                                </View>
                            </View>
                            <Text style={styles.supplierText}>{item.supplier_name}</Text>
                            <View style={styles.cardFooter}>
                                <View>
                                    <Text style={styles.dateText}>{item.date}</Text>
                                    <Text style={styles.amountText}>{formatCurrency(item.total_amount)}</Text>
                                </View>
                                <View style={styles.actionRow}>
                                    <TouchableOpacity 
                                        style={[styles.actionBtn, { backgroundColor: '#eff6ff' }]} 
                                        onPress={() => handleEditPurchase(item)}
                                    >
                                        <Edit size={16} color="#2563eb" />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]} 
                                        onPress={() => handleDeletePurchase(item.id, item.purchase_no)}
                                    >
                                        <Trash2 size={16} color="#dc2626" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={styles.emptyText}>Belum ada riwayat pembelian</Text>}
                />
            ) : (
                <View style={{ flex: 1 }}>
                    {isEditing && (
                        <View style={styles.editingBanner}>
                            <Text style={styles.editingBannerText}>Sedang mengedit PO: {purchaseNo}</Text>
                            <TouchableOpacity onPress={() => {
                                setIsEditing(false);
                                setEditingId(null);
                                setPurchaseNo('');
                                setPurchaseItems([]);
                                setSupplier('');
                                setManualSupplierName('');
                            }}>
                                <Text style={styles.cancelEditText}>Batal</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <ScrollView contentContainerStyle={styles.scrollContent}>

                    <View style={styles.formGroup}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={styles.label}>Pilih Supplier</Text>
                            <TouchableOpacity onPress={() => setIsManualSupplier(!isManualSupplier)}>
                                <Text style={{ fontSize: 12, color: '#ea580c', fontWeight: 'bold' }}>
                                    {isManualSupplier ? 'Pilih dari Daftar' : 'Input Manual'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        
                        {isManualSupplier ? (
                            <TextInput
                                style={styles.manualInput}
                                placeholder="Ketik nama supplier manual..."
                                value={manualSupplierName}
                                onChangeText={setManualSupplierName}
                            />
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.supplierScroll}>
                                {contacts.map(c => (
                                    <TouchableOpacity 
                                        key={c.id} 
                                        style={[styles.supplierTag, supplier === c.name && styles.activeSupplierTag]}
                                        onPress={() => setSupplier(c.name)}
                                    >
                                        <User size={14} color={supplier === c.name ? 'white' : '#64748b'} />
                                        <Text style={[styles.supplierTagText, supplier === c.name && styles.activeSupplierTagText]}>{c.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Metode Pembayaran</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.supplierScroll}>
                            {paymentMethods.map(m => (
                                <TouchableOpacity 
                                    key={m} 
                                    style={[styles.paymentMethodTag, paymentMethod === m && styles.activePaymentTag]}
                                    onPress={() => setPaymentMethod(m)}
                                >
                                    <Text style={[styles.paymentTagText, paymentMethod === m && styles.activePaymentTagText]}>{m}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Daftar Item</Text>
                        {purchaseItems.map((item, idx) => (
                            <View key={idx} style={styles.itemRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <Text style={styles.itemSub}>{formatCurrency(item.price)}</Text>
                                </View>
                                <View style={styles.qtyContainer}>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            const newItems = [...purchaseItems];
                                            if (newItems[idx].quantity > 1) {
                                                newItems[idx].quantity -= 1;
                                                setPurchaseItems(newItems);
                                            } else {
                                                setPurchaseItems(newItems.filter((_, i) => i !== idx));
                                            }
                                        }}
                                        style={styles.qtyBtn}
                                    >
                                        <Text>-</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            const newItems = [...purchaseItems];
                                            newItems[idx].quantity += 1;
                                            setPurchaseItems(newItems);
                                        }}
                                        style={styles.qtyBtn}
                                    >
                                        <Text>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity 
                                style={[styles.addItemBtn, { flex: 1 }]}
                                onPress={() => setShowSearchModal(true)}
                            >
                                <Search size={20} color="#ea580c" />
                                <Text style={styles.addItemText}>Cari Item</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.addItemBtn, { flex: 1, borderColor: '#2563eb' }]}
                                onPress={() => setShowManualItemModal(true)}
                            >
                                <Edit size={20} color="#2563eb" />
                                <Text style={[styles.addItemText, { color: '#2563eb' }]}>Item Manual</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Quick Item List for Prototype/Easy Add */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Klik untuk Tambah Item</Text>
                        <View style={styles.quickList}>
                            {masterItems.slice(0, 10).map(item => (
                                <TouchableOpacity 
                                    key={item.id} 
                                    style={styles.quickItem}
                                    onPress={() => {
                                        const existing = purchaseItems.findIndex(i => i.name === item.name);
                                        if (existing >= 0) {
                                            const newItems = [...purchaseItems];
                                            newItems[existing].quantity += 1;
                                            setPurchaseItems(newItems);
                                        } else {
                                            setPurchaseItems([...purchaseItems, { name: item.name, price: item.cost || 0, quantity: 1, type: item.type }]);
                                        }
                                    }}
                                >
                                    <Package size={14} color="#64748b" />
                                    <Text style={styles.quickItemText}>{item.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <TouchableOpacity style={[styles.saveButton, isEditing && { backgroundColor: '#2563eb' }]} onPress={handleSavePurchase}>
                        <Text style={styles.saveButtonText}>{isEditing ? 'Update Pembelian' : 'Simpan Pembelian'}</Text>
                    </TouchableOpacity>

                </ScrollView>
                </View>
            )}

            <ModernToast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

            {/* Search Modal */}
            <Modal visible={showSearchModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Pencarian Item</Text>
                            <TouchableOpacity onPress={() => setShowSearchModal(false)} style={styles.closeBtn}>
                                <Text style={styles.closeBtnText}>Tutup</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.searchBarContainer}>
                            <Search size={20} color="#94a3b8" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Cari nama atau kode barang..."
                                value={itemSearch}
                                onChangeText={setItemSearch}
                                autoFocus
                            />
                        </View>

                        <FlatList
                            data={filteredMasterItems}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.searchResultItem}
                                    onPress={() => {
                                        handleAddItem(item);
                                        setShowSearchModal(false);
                                    }}
                                >
                                    <View>
                                        <Text style={styles.resultName}>{item.name}</Text>
                                        <Text style={styles.resultSub}>{item.type} • {formatCurrency(item.cost || 0)}</Text>
                                    </View>
                                    <Plus size={20} color="#ea580c" />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={styles.emptyText}>Item tidak ditemukan</Text>}
                        />
                    </View>
                </View>
            </Modal>

            {/* Manual Item Modal */}
            <Modal visible={showManualItemModal} animationType="fade" transparent={true}>
                <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
                    <View style={[styles.modalContent, { height: 'auto', borderRadius: 20 }]}>
                        <Text style={[styles.modalTitle, { marginBottom: 20 }]}>Tambah Item Manual</Text>
                        
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Nama Item</Text>
                            <TextInput
                                style={styles.manualInput}
                                placeholder="Contoh: Belanja Sayur ke Pasar"
                                value={manualItemForm.name}
                                onChangeText={(text) => setManualItemForm({ ...manualItemForm, name: text })}
                            />
                        </View>
                        
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Harga / Biaya Total</Text>
                            <TextInput
                                style={styles.manualInput}
                                placeholder="0"
                                keyboardType="numeric"
                                value={manualItemForm.price}
                                onChangeText={(text) => setManualItemForm({ ...manualItemForm, price: text })}
                            />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <TouchableOpacity 
                                style={[styles.saveButton, { flex: 1, backgroundColor: '#f1f5f9' }]}
                                onPress={() => {
                                    setShowManualItemModal(false);
                                    setManualItemForm({ name: '', price: '' });
                                }}
                            >
                                <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.saveButton, { flex: 2 }]}
                                onPress={() => {
                                    if (!manualItemForm.name || !manualItemForm.price) {
                                        return showToast('Lengkapi nama dan harga', 'error');
                                    }
                                    handleAddItem({
                                        name: manualItemForm.name,
                                        cost: parseFloat(manualItemForm.price) || 0,
                                        type: 'Manual'
                                    });
                                    setShowManualItemModal(false);
                                    setManualItemForm({ name: '', price: '' });
                                }}
                            >
                                <Text style={styles.saveButtonText}>Tambah Item</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'white' },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    tabContainer: { flexDirection: 'row', padding: 15, gap: 10 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0' },
    activeTab: { backgroundColor: '#ea580c10', borderColor: '#ea580c' },
    tabText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
    activeTabText: { color: '#ea580c' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: {
        padding: 16,
    },
    statsContainer: {
        marginBottom: 20,
    },
    statBox: {
        backgroundColor: '#fff7ed',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ffedd5',
        marginBottom: 12,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#9a3412',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#ea580c',
        marginVertical: 4,
    },
    statSub: {
        fontSize: 12,
        color: '#c2410c',
        fontWeight: '600',
    },
    indicatorRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    indicator: {
        flex: 1,
        backgroundColor: '#f8fafc',
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    indicatorLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    indicatorValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 10,
    },
    purchaseCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    poNumber: { fontSize: 14, fontWeight: 'bold', color: '#2563eb' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusPending: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' },
    statusSuccess: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bcf0da' },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    supplierText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
    dateText: { fontSize: 12, color: '#64748b' },
    amountText: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 2 },
    actionRow: { flexDirection: 'row', gap: 10 },
    actionBtn: { padding: 8, borderRadius: 10 },
    editingBanner: { backgroundColor: '#dbeafe', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, borderRadius: 12, marginTop: 10 },
    editingBannerText: { color: '#1e40af', fontSize: 13, fontWeight: '700' },
    cancelEditText: { color: '#2563eb', fontWeight: '800', fontSize: 13 },
    scrollContent: { padding: 20 },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#94a3b8' },
    inputContainer: { padding: 15 },
    formGroup: { marginBottom: 20 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 10 },
    supplierScroll: { flexDirection: 'row' },
    supplierTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    activeSupplierTag: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
    supplierTagText: { fontSize: 13, color: '#64748b' },
    activeSupplierTagText: { color: 'white' },
    itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 8 },
    itemName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    itemSub: { fontSize: 12, color: '#94a3b8' },
    qtyContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    qtyBtn: { width: 30, height: 30, backgroundColor: '#f1f5f9', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    qtyValue: { fontWeight: 'bold' },
    addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ea580c', borderRadius: 12, marginTop: 10 },
    addItemText: { color: '#ea580c', fontWeight: 'bold' },
    quickList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    quickItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'white', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    quickItemText: { fontSize: 12, color: '#64748b' },
    saveButton: { backgroundColor: '#ea580c', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20 },
    saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    manualInput: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 14, color: '#1e293b' },
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '80%', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    closeBtn: { padding: 10 },
    closeBtnText: { color: '#ef4444', fontWeight: 'bold' },
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f1f5f9', paddingHorizontal: 15, borderRadius: 15, marginBottom: 20 },
    searchInput: { flex: 1, height: 50, fontSize: 16 },
    searchResultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    resultName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    resultSub: { fontSize: 12, color: '#94a3b8' },
    paymentMethodTag: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 8,
    },
    activePaymentTag: {
        backgroundColor: '#ea580c',
        borderColor: '#ea580c',
    },
    paymentTagText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#64748b',
    },
    activePaymentTagText: {
        color: '#fff',
    },
});
