import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, StyleSheet, useWindowDimensions, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import PaymentModal from '../components/PaymentModal';
import { PrinterManager } from '../lib/PrinterManager';
import { Search, Filter, Calendar, RefreshCw, ChevronLeft, Printer, X, Receipt, User, MapPin, CheckCircle2, Edit, Trash2 } from 'lucide-react-native';

import { useSession } from '../context/SessionContext';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';

export default function HistoryScreen() {
    const navigation = useNavigation();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const isSmallDevice = width < 380;
    const { currentBranchId, branchName } = useSession();

    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);
    const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'this_month' | 'all' | 'custom'>('today');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Pending'>('all');
    
    // Custom Date Range State
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [showDateRangeModal, setShowDateRangeModal] = useState(false);
    
    // UI Modals
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState<any>(null);
    const [printing, setPrinting] = useState(false);
    
    // CRUD State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState({ customer_name: '', table_no: '' });
    const [isSaving, setIsSaving] = useState(false);
    
    // Create State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newData, setNewData] = useState({ customer_name: '', table_no: '', amount: '' });
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [previewOrderData, setPreviewOrderData] = useState<any>(null);

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [dateFilter, startDate, endDate])
    );

    useEffect(() => {
        let filtered = history;
        
        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(item => item.status === statusFilter);
        }
        
        // Apply search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                item.order_no?.toLowerCase().includes(query) || 
                item.table_no?.toLowerCase().includes(query) ||
                item.customer_name?.toLowerCase().includes(query)
            );
        }
        
        setFilteredHistory(filtered);
    }, [searchQuery, statusFilter, history]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const now = new Date();
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    sale_items (
                        *,
                        product:product_id (name)
                    )
                `)
                .eq('branch_id', parseInt(currentBranchId))
                .order('date', { ascending: false });

            if (dateFilter === 'today') {
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                query = query.gte('date', startOfDay.toISOString());
            } else if (dateFilter === 'yesterday') {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                const endOfYesterday = new Date();
                endOfYesterday.setHours(0, 0, 0, 0);
                query = query.gte('date', yesterday.toISOString()).lt('date', endOfYesterday.toISOString());
            } else if (dateFilter === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(now.getDate() - 7);
                query = query.gte('date', weekAgo.toISOString());
            } else if (dateFilter === 'this_month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                query = query.gte('date', startOfMonth.toISOString());
            } else if (dateFilter === 'custom') {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query = query.gte('date', start.toISOString()).lte('date', end.toISOString());
            }

            const { data, error } = await query.limit(100);

            if (error) throw error;
            setHistory(data || []);
        } catch (error: any) {
            console.error('Fetch History Error:', error);
            Alert.alert('Error', 'Gagal memuat riwayat: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDetail = (sale: any) => {
        setSelectedSale(sale);
        setShowDetailModal(true);
    };

    const handlePayFromDetail = () => {
        setShowDetailModal(false);
        setShowPaymentModal(true);
    };

    const handlePreviewReceipt = () => {
        if (!selectedSale) return;
        
        const orderData = {
            orderNo: selectedSale.order_no,
            tableNo: selectedSale.table_no,
            customerName: selectedSale.customer_name || 'Guest',
            waiterName: selectedSale.waiter_name || '-',
            total: selectedSale.total_amount,
            payment_method: selectedSale.payment_method,
            date: selectedSale.date,
            items: selectedSale.sale_items.map((item: any) => ({
                name: item.product_name || (item.product?.name || 'Produk'),
                quantity: item.quantity,
                price: item.price,
                isManual: !!item.isManual
            })),
            shopName: branchName || 'Catering'
        };

        setPreviewOrderData(orderData);
        setShowReceiptPreview(true);
    };

    const handlePrintReceipt = async () => {
        if (!selectedSale) return;
        
        try {
            setPrinting(true);
            const orderData = {
                orderNo: selectedSale.order_no,
                tableNo: selectedSale.table_no,
                customerName: selectedSale.customer_name || 'Guest',
                waiterName: selectedSale.waiter_name || '-',
                total: selectedSale.total_amount,
                payment_method: selectedSale.payment_method,
                date: selectedSale.date,
                items: selectedSale.sale_items.map((item: any) => ({
                    name: item.product_name || (item.product?.name || 'Produk'),
                    quantity: item.quantity,
                    price: item.price,
                    isManual: !!item.isManual
                })),
                shopName: branchName || 'Catering'
            };

            const success = await PrinterManager.printOrderReceipt(orderData);
            if (success) {
                Alert.alert('Sukses', 'Struk berhasil dicetak.');
            } else {
                Alert.alert('Gagal', 'Gagal mencetak struk. Pastikan printer terhubung di menu Pengaturan.');
            }
        } catch (error) {
            console.error('Print Error:', error);
            Alert.alert('Error', 'Terjadi kesalahan saat mencetak.');
        } finally {
            setPrinting(false);
        }
    };

    const handleDeleteSale = async () => {
        if (!selectedSale) return;

        Alert.alert(
            'Konfirmasi Hapus',
            'Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.',
            [
                { text: 'Batal', style: 'cancel' },
                { 
                    text: 'Hapus', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            // 1. Delete sale_items first due to foreign key
                            const { error: itemsError } = await supabase
                                .from('sale_items')
                                .delete()
                                .eq('sale_id', selectedSale.id);
                            
                            if (itemsError) throw itemsError;

                            // 2. Delete the sale
                            const { error: saleError } = await supabase
                                .from('sales')
                                .delete()
                                .eq('id', selectedSale.id);

                            if (saleError) throw saleError;

                            // 3. Free up table if needed
                            if (selectedSale.table_no && selectedSale.table_no !== 'Tanpa Meja') {
                                await supabase
                                    .from('tables')
                                    .update({ status: 'Available' })
                                    .eq('number', selectedSale.table_no);
                            }

                            setShowDetailModal(false);
                            fetchHistory();
                            Alert.alert('Sukses', 'Transaksi berhasil dihapus.');
                        } catch (error: any) {
                            console.error('Delete Sale Error:', error);
                            Alert.alert('Error', 'Gagal menghapus transaksi: ' + error.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleOpenEdit = () => {
        setEditData({
            customer_name: selectedSale.customer_name || '',
            table_no: selectedSale.table_no || ''
        });
        setShowEditModal(true);
    };

    const handleUpdateSale = async () => {
        if (!selectedSale) return;

        try {
            setIsSaving(true);
            const { error } = await supabase
                .from('sales')
                .update({
                    customer_name: editData.customer_name,
                    table_no: editData.table_no || 'Tanpa Meja'
                })
                .eq('id', selectedSale.id);

            if (error) throw error;

            setShowEditModal(false);
            // Refresh local selectedSale
            setSelectedSale({ ...selectedSale, ...editData });
            fetchHistory();
            Alert.alert('Sukses', 'Data transaksi diperbarui.');
        } catch (error: any) {
            console.error('Update Sale Error:', error);
            Alert.alert('Error', 'Gagal memperbarui data: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateManualSale = async () => {
        if (!newData.amount || parseFloat(newData.amount) <= 0) {
            Alert.alert('Error', 'Jumlah pembayaran harus diisi.');
            return;
        }

        try {
            setIsSaving(true);
            const total = parseFloat(newData.amount);
            const orderNo = `MAN-${Date.now().toString().slice(-6)}`;

            const { data, error } = await supabase
                .from('sales')
                .insert([{
                    order_no: orderNo,
                    branch_id: parseInt(currentBranchId),
                    customer_name: newData.customer_name || 'Manual Entry',
                    table_no: newData.table_no || 'Tanpa Meja',
                    total_amount: total,
                    payment_method: 'Manual',
                    status: 'Paid',
                    date: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            setShowCreateModal(false);
            setNewData({ customer_name: '', table_no: '', amount: '' });
            fetchHistory();
            Alert.alert('Sukses', 'Transaksi manual berhasil ditambahkan.');
        } catch (error: any) {
            console.error('Create Manual Sale Error:', error);
            Alert.alert('Error', 'Gagal menambah transaksi: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePaymentConfirm = async (paymentData: { method: string; amount: number; change: number }) => {
        if (!selectedSale) return;

        try {
            setLoading(true);
            const { error: saleError } = await supabase
                .from('sales')
                .update({
                    status: 'Paid',
                    payment_method: paymentData.method,
                })
                .eq('id', selectedSale.id);

            if (saleError) throw saleError;

            if (selectedSale.table_no && selectedSale.table_no !== 'Tanpa Meja') {
                await supabase
                    .from('tables')
                    .update({ status: 'Available' })
                    .eq('number', selectedSale.table_no);
            }

            setShowPaymentModal(false);
            setShowSuccessModal(true);
            fetchHistory();
        } catch (error: any) {
            console.error('Payment Confirm Error:', error);
            Alert.alert('Error', 'Gagal memproses pembayaran: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Calculate preparation duration between order creation and payment
    const formatDuration = (createdAt: string | null, paidAt: string | null): string | null => {
        if (!createdAt || !paidAt) return null;
        const start = new Date(createdAt).getTime();
        const end = new Date(paidAt).getTime();
        const diffMs = end - start;
        if (diffMs <= 0) return null;
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        if (mins === 0) return `${secs}d`;
        if (mins < 60) return `${mins}m ${secs}d`;
        const hours = Math.floor(mins / 60);
        return `${hours}j ${mins % 60}m`;
    };

    const SuccessModal = () => (
        <Modal
            visible={showSuccessModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowSuccessModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { maxWidth: 300, padding: 24, alignItems: 'center' }]}>
                    <View style={styles.successIconCircle}>
                        <CheckCircle2 size={48} color="#22c55e" />
                    </View>
                    <Text style={styles.successTitleText}>Pembayaran Berhasil</Text>
                    <Text style={styles.successSubtitleText}>
                        Status transaksi telah diperbarui menjadi lunas.
                    </Text>
                    <TouchableOpacity 
                        style={[styles.payBtnLarge, { width: '100%', marginTop: 8 }]} 
                        onPress={() => setShowSuccessModal(false)}
                    >
                        <Text style={styles.payBtnTextLarge}>Selesai</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    const DetailModal = () => (
        <Modal
            visible={showDetailModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDetailModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, isSmallDevice && { width: '95%' }]}>
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>Detail Transaksi</Text>
                            <Text style={styles.modalSubtitle}>{selectedSale?.order_no}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.closeBtn}>
                            <X size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll}>
                        {/* Info Section */}
                        <View style={styles.infoGrid}>
                            <View style={styles.infoItem}>
                                <Calendar size={16} color="#94a3b8" />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.infoLabel}>Tanggal Pesanan</Text>
                                    <Text style={styles.infoValue}>{selectedSale ? formatDate(selectedSale.created_at || selectedSale.date) : '-'}</Text>
                                </View>
                            </View>
                            <View style={styles.infoItem}>
                                <Calendar size={16} color="#94a3b8" />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.infoLabel}>Tanggal Bayar</Text>
                                    <Text style={styles.infoValue}>{selectedSale ? formatDate(selectedSale.date) : '-'}</Text>
                                </View>
                            </View>
                            {(selectedSale?.status === 'Paid' || selectedSale?.status === 'Completed' || selectedSale?.status === 'Served' || selectedSale?.status === 'Ready') && (() => {
                                // Prioritize waiting_time field from DB
                                const dur = selectedSale.waiting_time || formatDuration(selectedSale.created_at, selectedSale.date);
                                return dur ? (
                                    <View style={[styles.infoItem, { backgroundColor: '#fff7ed', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#ffedd5' }]}>
                                        <Text style={{ fontSize: 18 }}>⏱️</Text>
                                        <View style={{ marginLeft: 8 }}>
                                            <Text style={styles.infoLabel}>Waktu Penyiapan</Text>
                                            <Text style={[styles.infoValue, { color: '#ea580c', fontWeight: 'bold' }]}>{dur}</Text>
                                        </View>
                                    </View>
                                ) : null;
                            })()}
                            <View style={styles.infoItem}>
                                <User size={16} color="#94a3b8" />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.infoLabel}>Pelanggan</Text>
                                    <Text style={styles.infoValue}>{selectedSale?.customer_name || 'Guest'}</Text>
                                </View>
                            </View>
                            <View style={styles.infoItem}>
                                <MapPin size={16} color="#94a3b8" />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.infoLabel}>Meja</Text>
                                    <Text style={styles.infoValue}>{selectedSale?.table_no || 'Tanpa Meja'}</Text>
                                </View>
                            </View>
                            <View style={styles.infoItem}>
                                <Receipt size={16} color="#94a3b8" />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.infoLabel}>Metode</Text>
                                    <Text style={styles.infoValue}>{selectedSale?.payment_method || '-'}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.modalDivider} />

                        {/* Items Section */}
                        <Text style={styles.sectionTitle}>Rincian Pesanan</Text>
                        {selectedSale?.sale_items?.map((item: any, idx: number) => (
                            <View key={idx} style={styles.detailItemRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.detailItemName}>{item.product_name || (item.product?.name || 'Produk')}</Text>
                                    <Text style={styles.detailItemSub}>{item.quantity} x {formatCurrency(item.price)}</Text>
                                </View>
                                <Text style={styles.detailItemTotal}>{formatCurrency(item.quantity * item.price)}</Text>
                            </View>
                        ))}

                        <View style={styles.modalDivider} />

                        {/* Summary Section */}
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total Pembayaran</Text>
                            <Text style={styles.summaryValue}>{formatCurrency(selectedSale?.total_amount || 0)}</Text>
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        {(selectedSale?.status === 'Paid' || selectedSale?.status === 'Completed' || selectedSale?.status === 'Served' || selectedSale?.status === 'Ready') ? (
                            <>
                                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                                    <Text style={styles.totalLabel}>Total Bayar</Text>
                                    <Text style={styles.totalAmountLarge}>{formatCurrency(selectedSale.total_amount)}</Text>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                                    <TouchableOpacity 
                                        style={[styles.actionBtn, { backgroundColor: '#f1f5f9' }]}
                                        onPress={handleOpenEdit}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Edit size={16} color="#64748b" style={{ marginRight: 6 }} />
                                            <Text style={{ color: '#475569', fontWeight: 'bold' }}>Edit</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]}
                                        onPress={handleDeleteSale}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Trash2 size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                            <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Hapus</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                    <TouchableOpacity 
                                        style={[styles.actionBtn, { flex: 1, backgroundColor: '#ea580c' }]}
                                        onPress={handlePrintReceipt}
                                        disabled={printing}
                                    >
                                        {printing ? <ActivityIndicator size="small" color="white" /> : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Printer size={16} color="white" style={{ marginRight: 8 }} />
                                                <Text style={styles.actionBtnText}>Cetak</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={[styles.actionBtn, { flex: 1, backgroundColor: '#f1f5f9' }]}
                                        onPress={handlePreviewReceipt}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Receipt size={16} color="#64748b" style={{ marginRight: 8 }} />
                                            <Text style={[styles.actionBtnText, { color: '#64748b' }]}>Preview</Text>
                                        </View>
                                    </TouchableOpacity>

                                    {(selectedSale.status !== 'Paid' && selectedSale.status !== 'Completed' && selectedSale.status !== 'Served' && selectedSale.status !== 'Ready') && (
                                        <TouchableOpacity 
                                            style={[styles.actionBtn, { flex: 1, backgroundColor: '#22c55e' }]}
                                            onPress={handlePayFromDetail}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Receipt size={16} color="white" style={{ marginRight: 8 }} />
                                                <Text style={styles.actionBtnText}>Bayar Sekarang</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <TouchableOpacity 
                                    style={[styles.closeBtnDetail, { marginTop: 15 }]} 
                                    onPress={() => setShowDetailModal(false)}
                                >
                                    <Text style={styles.closeBtnText}>Tutup</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity style={styles.payBtnLarge} onPress={handlePayFromDetail}>
                                <Text style={styles.payBtnTextLarge}>Bayar Sekarang</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );

    const EditModal = () => (
        <Modal
            visible={showEditModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowEditModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { maxWidth: 400, padding: 24 }]}>
                    <Text style={styles.modalTitle}>Edit Transaksi</Text>
                    
                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.inputLabel}>Nama Pelanggan</Text>
                        <TextInput
                            style={styles.textInput}
                            value={editData.customer_name}
                            onChangeText={(val) => setEditData({ ...editData, customer_name: val })}
                            placeholder="Contoh: Budi"
                        />
                    </View>

                    <View style={{ marginBottom: 24 }}>
                        <Text style={styles.inputLabel}>Nomor Meja</Text>
                        <TextInput
                            style={styles.textInput}
                            value={editData.table_no}
                            onChangeText={(val) => setEditData({ ...editData, table_no: val })}
                            placeholder="Contoh: 05, atau biarkan kosong"
                        />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity 
                            style={[styles.modalBtnSimple, { flex: 1, backgroundColor: '#f1f5f9' }]} 
                            onPress={() => setShowEditModal(false)}
                        >
                            <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Batal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.modalBtnSimple, { flex: 1, backgroundColor: '#ea580c' }]} 
                            onPress={handleUpdateSale}
                            disabled={isSaving}
                        >
                            {isSaving ? <ActivityIndicator size="small" color="white" /> : (
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Simpan</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const CreateModal = () => (
        <Modal
            visible={showCreateModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowCreateModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { maxWidth: 400, padding: 24 }]}>
                    <Text style={styles.modalTitle}>Tambah Transaksi Manual</Text>
                    
                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.inputLabel}>Jumlah Pembayaran (Rp)</Text>
                        <TextInput
                            style={styles.textInput}
                            value={newData.amount}
                            onChangeText={(val) => setNewData({ ...newData, amount: val })}
                            placeholder="Contoh: 50000"
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.inputLabel}>Nama Pelanggan</Text>
                        <TextInput
                            style={styles.textInput}
                            value={newData.customer_name}
                            onChangeText={(val) => setNewData({ ...newData, customer_name: val })}
                            placeholder="Opsional"
                        />
                    </View>

                    <View style={{ marginBottom: 24 }}>
                        <Text style={styles.inputLabel}>Nomor Meja</Text>
                        <TextInput
                            style={styles.textInput}
                            value={newData.table_no}
                            onChangeText={(val) => setNewData({ ...newData, table_no: val })}
                            placeholder="Opsional"
                        />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity 
                            style={[styles.modalBtnSimple, { flex: 1, backgroundColor: '#f1f5f9' }]} 
                            onPress={() => setShowCreateModal(false)}
                        >
                            <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Batal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.modalBtnSimple, { flex: 1, backgroundColor: '#ea580c' }]} 
                            onPress={handleCreateManualSale}
                            disabled={isSaving}
                        >
                            {isSaving ? <ActivityIndicator size="small" color="white" /> : (
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Tambah</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            <ReceiptPreviewModal 
                visible={showReceiptPreview}
                onClose={() => setShowReceiptPreview(false)}
                orderData={previewOrderData}
                onPrint={() => {
                    handlePrintReceipt();
                }}
            />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <ChevronLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Riwayat Transaksi</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#fff7ed', padding: 6, borderRadius: 8, borderWidth: 1, borderColor: '#ffedd5' }} 
                        onPress={() => setShowCreateModal(true)}
                    >
                        <Text style={{ color: '#ea580c', fontWeight: 'bold', fontSize: 12 }}>+ Manual</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.refreshBtn} onPress={fetchHistory} disabled={loading}>
                        <RefreshCw size={20} color={loading ? "#94a3b8" : "#ea580c"} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Search size={18} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Cari order, meja, atau pelanggan..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                    <TouchableOpacity 
                        style={[styles.filterChip, dateFilter === 'today' && styles.filterChipActive]}
                        onPress={() => setDateFilter('today')}
                    >
                        <Text style={[styles.filterChipText, dateFilter === 'today' && styles.filterChipTextActive]}>Hari Ini</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.filterChip, dateFilter === 'yesterday' && styles.filterChipActive]}
                        onPress={() => setDateFilter('yesterday')}
                    >
                        <Text style={[styles.filterChipText, dateFilter === 'yesterday' && styles.filterChipTextActive]}>Kemarin</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.filterChip, dateFilter === 'week' && styles.filterChipActive]}
                        onPress={() => setDateFilter('week')}
                    >
                        <Text style={[styles.filterChipText, dateFilter === 'week' && styles.filterChipTextActive]}>7 Hari</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.filterChip, dateFilter === 'this_month' && styles.filterChipActive]}
                        onPress={() => setDateFilter('this_month')}
                    >
                        <Text style={[styles.filterChipText, dateFilter === 'this_month' && styles.filterChipTextActive]}>Bulan Ini</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.filterChip, dateFilter === 'all' && styles.filterChipActive]}
                        onPress={() => setDateFilter('all')}
                    >
                        <Text style={[styles.filterChipText, dateFilter === 'all' && styles.filterChipTextActive]}>Semua</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.filterChip, dateFilter === 'custom' && styles.filterChipActive]}
                        onPress={() => setShowDateRangeModal(true)}
                    >
                        <Calendar size={14} color={dateFilter === 'custom' ? 'white' : '#64748b'} style={{ marginRight: 4 }} />
                        <Text style={[styles.filterChipText, dateFilter === 'custom' && styles.filterChipTextActive]}>Rentang</Text>
                    </TouchableOpacity>
                </ScrollView>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                    <Filter size={14} color="#64748b" style={{ marginRight: 8 }} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                        <TouchableOpacity 
                            style={[styles.statusToggle, statusFilter === 'all' && styles.statusToggleActive]}
                            onPress={() => setStatusFilter('all')}
                        >
                            <Text style={[styles.statusToggleText, statusFilter === 'all' && styles.statusToggleTextActive]}>Semua</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.statusToggle, statusFilter === 'Paid' && styles.statusToggleActive]}
                            onPress={() => setStatusFilter('Paid')}
                        >
                            <Text style={[styles.statusToggleText, statusFilter === 'Paid' && styles.statusToggleTextActive]}>Lunas</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.statusToggle, statusFilter === 'Pending' && styles.statusToggleActive]}
                            onPress={() => setStatusFilter('Pending')}
                        >
                            <Text style={[styles.statusToggleText, statusFilter === 'Pending' && styles.statusToggleTextActive]}>Pending</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>

            {loading && history.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ea580c" />
                    <Text style={styles.loadingText}>Memuat riwayat...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredHistory}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={styles.slimCard}
                            activeOpacity={0.7}
                            onPress={() => handleOpenDetail(item)}
                        >
                            <View style={styles.slimMain}>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.slimHeader}>
                                        <Text style={styles.slimOrderNo}>{item.order_no}</Text>
                                        <View style={styles.dot} />
                                        <Text style={styles.slimTable}>{item.table_no === 'Tanpa Meja' ? 'TA' : item.table_no}</Text>
                                    </View>
                                    <View style={styles.slimSub}>
                                        <Text style={styles.slimDate}>{formatDate(item.date).split(',')[0]}</Text>
                                        <Text style={styles.slimCustomer}> • {item.customer_name || 'Guest'}</Text>
                                    </View>
                                    {/* Preparation Duration Badge - prioritized database field */}
                                    {(item.status === 'Paid' || item.status === 'Completed' || item.status === 'Served' || item.status === 'Ready') && (() => {
                                        const dur = item.waiting_time || formatDuration(item.created_at, item.date);
                                        return dur ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Text style={{ fontSize: 10, color: '#6b7280' }}>⏱ Siap dalam: </Text>
                                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#ea580c' }}>{dur}</Text>
                                            </View>
                                        ) : null;
                                    })()}
                                </View>

                                <View style={styles.slimRight}>
                                    <Text style={styles.slimAmount}>{formatCurrency(item.total_amount).replace('Rp', '').trim()}</Text>
                                    <View style={[
                                        styles.miniStatus,
                                        (item.status === 'Paid' || item.status === 'Completed' || item.status === 'Served' || item.status === 'Ready') ? styles.statusPaid : 
                                        (item.status === 'Preparing') ? styles.statusPreparing : styles.statusPending
                                    ]}>
                                        <Text style={[
                                            styles.miniStatusText,
                                            (item.status === 'Paid' || item.status === 'Completed' || item.status === 'Served' || item.status === 'Ready') ? styles.statusTextPaid : 
                                            (item.status === 'Preparing') ? styles.statusTextPreparing : styles.statusTextPending
                                        ]}>
                                            {item.status === 'Paid' ? 'LUNAS' : 
                                             item.status === 'Completed' ? 'SELESAI' :
                                             item.status === 'Served' ? 'TERSAJI' :
                                             item.status === 'Preparing' ? 'DIPROSES' :
                                             item.status === 'Ready' ? 'SIAP' : 
                                             item.status === 'Unpaid' ? 'PENDING' : 'PENDING'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📭</Text>
                            <Text style={styles.emptyTitle}>Tidak ada riwayat</Text>
                            <Text style={styles.emptySub}>Belum ada transaksi untuk periode ini.</Text>
                        </View>
                    }
                />
            )}

            <DetailModal />
            <EditModal />
            <CreateModal />
            <SuccessModal />

            {/* Custom Date Range Modal */}
            <Modal
                visible={showDateRangeModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowDateRangeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Pilih Rentang Tanggal</Text>
                            <TouchableOpacity onPress={() => setShowDateRangeModal(false)}>
                                <Text style={styles.closeBtnText}>Tutup</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ marginBottom: 20 }}>
                            <View style={{ marginBottom: 16 }}>
                                <Text style={styles.inputLabel}>Tanggal Awal (YYYY-MM-DD)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={startDate}
                                    onChangeText={setStartDate}
                                    placeholder="2024-01-01"
                                />
                            </View>
                            <View style={{ marginBottom: 16 }}>
                                <Text style={styles.inputLabel}>Tanggal Akhir (YYYY-MM-DD)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={endDate}
                                    onChangeText={setEndDate}
                                    placeholder="2024-12-31"
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.payBtnLarge}
                                onPress={() => {
                                    setDateFilter('custom');
                                    setShowDateRangeModal(false);
                                }}
                            >
                                <Text style={styles.payBtnTextLarge}>Terapkan Rentang</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <PaymentModal
                visible={showPaymentModal}
                total={selectedSale?.total_amount || 0}
                onClose={() => setShowPaymentModal(false)}
                onConfirm={handlePaymentConfirm}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: { padding: 4, marginRight: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', flex: 1 },
    refreshBtn: { padding: 8 },
    searchSection: { padding: 16, backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        marginBottom: 12,
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#334155' },
    filterScroll: { flexDirection: 'row' },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterChipActive: { backgroundColor: '#fff7ed', borderColor: '#ea580c' },
    filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    filterChipTextActive: { color: '#ea580c' },
    statusToggle: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f8fafc',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statusToggleActive: {
        backgroundColor: '#eff6ff',
        borderColor: '#3b82f6',
    },
    statusToggleText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    statusToggleTextActive: {
        color: '#2563eb',
        fontWeight: 'bold',
    },
    card: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 1,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    invoiceNo: { color: '#ea580c', fontWeight: 'bold', fontSize: 15 },
    dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
    date: { color: '#94a3b8', fontSize: 11 },
    // Slim Styles
    slimCard: {
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 1,
    },
    slimMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    slimHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    slimOrderNo: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ea580c',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#cbd5e1',
        marginHorizontal: 8,
    },
    slimTable: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    slimSub: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    slimDate: {
        fontSize: 11,
        color: '#94a3b8',
    },
    slimCustomer: {
        fontSize: 11,
        color: '#64748b',
        fontStyle: 'italic',
    },
    slimRight: {
        alignItems: 'flex-end',
    },
    slimAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    miniStatus: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    miniStatusText: {
        fontSize: 9,
        fontWeight: 'bold',
    },

    // Old Styles (some may still be used by Modal)
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusPaid: { backgroundColor: '#f0fdf4' },
    statusPending: { backgroundColor: '#fff7ed' },
    statusPreparing: { backgroundColor: '#eff6ff' },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    statusTextPaid: { color: '#16a34a' },
    statusTextPending: { color: '#ea580c' },
    statusTextPreparing: { color: '#2563eb' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    loadingText: { marginTop: 12, color: '#64748b' },
    emptyContainer: { alignItems: 'center', padding: 40, marginTop: 40 },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'center' },

    // Success Modal Styles
    successIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    successTitleText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 8,
    },
    successSubtitleText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },

    // CRUD & Detail Action Styles
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        flex: 1,
    },
    actionBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: 'white',
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    modalBtnSimple: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    totalLabel: { fontSize: 14, color: '#64748b', fontWeight: 'bold' },
    totalAmountLarge: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    closeBtnDetail: {
        paddingVertical: 14,
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    closeBtnText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%', width: '100%', alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    modalSubtitle: { fontSize: 14, color: '#ea580c', fontWeight: '600' },
    closeBtn: { padding: 4 },
    modalScroll: { marginBottom: 20 },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 8 },
    infoItem: { width: '45%', flexDirection: 'row', alignItems: 'center' },
    infoLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' },
    infoValue: { fontSize: 13, fontWeight: 'bold', color: '#334155' },
    modalDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
    detailItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    detailItemName: { fontSize: 14, color: '#334155', fontWeight: '500' },
    detailItemSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    detailItemTotal: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    summaryLabel: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
    summaryValue: { fontSize: 24, fontWeight: 'bold', color: '#ea580c' },
    modalFooter: { gap: 12 },
    printBtn: { backgroundColor: '#1e293b', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    printBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    payBtnLarge: { backgroundColor: '#ea580c', padding: 16, borderRadius: 16, alignItems: 'center' },
    payBtnTextLarge: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
