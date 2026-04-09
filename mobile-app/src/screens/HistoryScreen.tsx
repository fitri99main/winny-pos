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
import { WifiVoucherService } from '../lib/WifiVoucherService';
import ManagerAuthModal from '../components/ManagerAuthModal';
import DateStepper from '../components/DateStepper';

export default function HistoryScreen() {
    const navigation = useNavigation();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const useMultiColumn = width >= 600;
    const isSmallDevice = width < 480;
    const { currentBranchId, branchName, branchAddress, branchPhone, userName, storeSettings, isAdmin } = useSession();

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
    const [showManagerAuth, setShowManagerAuth] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [dateFilter, startDate, endDate, currentBranchId])
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
        if (!currentBranchId || isNaN(Number(currentBranchId))) return;
        try {
            setLoading(true);
            const now = new Date();
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    sale_items (
                        *,
                        product:product_id (name, category)
                    )
                `)
                .eq('branch_id', currentBranchId)
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

    const handlePreviewReceipt = async () => {
        if (!selectedSale) return;
        setShowDetailModal(false);
        
        const templateFields = {
            receipt_header: storeSettings?.receipt_header || branchName || 'WINNY POS',
            receipt_footer: storeSettings?.receipt_footer || 'Terima Kasih Atas\nKunjungan Anda',
            receipt_paper_width: storeSettings?.receipt_paper_width,
            receipt_logo_url: storeSettings?.receipt_logo_url,
            show_logo: storeSettings?.show_logo,
            shop_address: storeSettings?.address || branchAddress || '',
            shop_phone: storeSettings?.phone || branchPhone || '',
            show_date: storeSettings?.show_date !== false,
            show_table: storeSettings?.show_table !== false,
            show_waiter: storeSettings?.show_waiter !== false,
            show_customer_name: storeSettings?.show_customer_name !== false,
            show_cashier_name: storeSettings?.show_cashier_name !== false,
            enable_wifi_vouchers: storeSettings?.enable_wifi_vouchers || false,
            wifi_voucher_min_amount: storeSettings?.wifi_voucher_min_amount || 0,
            wifi_voucher_multiplier: storeSettings?.wifi_voucher_multiplier || 0,
            wifi_voucher_notice: storeSettings?.wifi_voucher_notice || '',
        };

        // WiFi Voucher Fetching
        let wifiVoucher = null;
        const minAmount = storeSettings?.wifi_voucher_min_amount || 0;
        
        if (storeSettings?.enable_wifi_vouchers && Number(selectedSale.total_amount) >= minAmount) {
            try {
                const multiplier = storeSettings?.wifi_voucher_multiplier || 0;
                let count = 1;
                if (multiplier > 0) {
                    count = Math.floor(Number(selectedSale.total_amount) / multiplier);
                }
                
                if (count > 0) {
                    wifiVoucher = await WifiVoucherService.getVoucherForSale(selectedSale.id, currentBranchId || 'default', count);
                }
            } catch (e) {
                console.warn('[HistoryScreen] Failed to fetch WiFi voucher:', e);
            }
        }

        const orderData = {
            ...templateFields,
            wifi_voucher: wifiVoucher,
            wifi_voucher_notice: templateFields.wifi_voucher_notice,
            order_no: selectedSale.order_no,
            table_no: selectedSale.table_no,
            customer_name: selectedSale.customer_name || 'Guest',
            cashier_name: userName || '',
            waiter_name: selectedSale.waiter_name || '',
            total: Number(selectedSale.total_amount),
            total_amount: Number(selectedSale.total_amount),
            discount: selectedSale.discount || 0,
            tax: selectedSale.tax || 0,
            service_charge: selectedSale.service_charge || 0,
            tax_rate: storeSettings?.tax_rate || 0,
            service_rate: storeSettings?.service_rate || 0,
            payment_method: selectedSale.payment_method,
            created_at: selectedSale.date,
            items: selectedSale.sale_items.map((item: any) => {
                const itemPrice = typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0').replace(/[^0-9.]/g, '')) || 0;
                return {
                    name: item.product_name || (item.product?.name || 'Produk'),
                    quantity: item.quantity,
                    price: itemPrice,
                    target: item.target || '',
                    category: item.product?.category || '',
                    isManual: !!item.isManual,
                    notes: item.notes
                };
            }),
        };

        setPreviewOrderData(orderData);
        setShowReceiptPreview(true);
    };

    const handlePrintReceipt = async () => {
        if (!selectedSale) return;
        
        try {
            setPrinting(true);

            const templateFields = {
                receipt_header: storeSettings?.receipt_header || branchName || 'WINNY POS',
                receipt_footer: storeSettings?.receipt_footer || 'Terima Kasih Atas\nKunjungan Anda',
                receipt_paper_width: storeSettings?.receipt_paper_width,
                receipt_logo_url: storeSettings?.receipt_logo_url,
                show_logo: storeSettings?.show_logo,
                shop_address: storeSettings?.address || branchAddress || '',
                shop_phone: storeSettings?.phone || branchPhone || '',
                show_date: storeSettings?.show_date !== false,
                show_table: storeSettings?.show_table !== false,
                show_waiter: storeSettings?.show_waiter !== false,
                show_customer_name: storeSettings?.show_customer_name !== false,
                show_cashier_name: storeSettings?.show_cashier_name !== false,
                enable_wifi_vouchers: storeSettings?.enable_wifi_vouchers || false,
                wifi_voucher_notice: storeSettings?.wifi_voucher_notice || '',
            };

            // WiFi Voucher Fetching
            let wifiVoucher = null;
            const minAmount = storeSettings?.wifi_voucher_min_amount || 0;
            const totalStr = String(selectedSale.total_amount || '0');
            const total = Number(totalStr);
            
            if (storeSettings?.enable_wifi_vouchers && total >= minAmount) {
                try {
                    const multiplier = storeSettings?.wifi_voucher_multiplier || 0;
                    let count = 1;
                    if (multiplier > 0) {
                        count = Math.floor(total / multiplier);
                    }

                    console.log(`[HistoryScreen] Reprint Logic: total=${total}, min=${minAmount}, multiplier=${multiplier}, calculatedCount=${count}`);

                    if (count > 0) {
                        wifiVoucher = await WifiVoucherService.getVoucherForSale(selectedSale.id, currentBranchId || 'default', count);
                        console.log(`[HistoryScreen] Reprint WiFi Voucher Result: ${wifiVoucher}`);
                    }
                } catch (e) {
                    console.warn('[HistoryScreen] Failed to fetch WiFi voucher:', e);
                }
            }

            const orderData = {
                ...templateFields,
                wifi_voucher: wifiVoucher,
                wifi_voucher_notice: templateFields.wifi_voucher_notice,
                order_no: selectedSale.order_no,
                table_no: selectedSale.table_no,
                customer_name: selectedSale.customer_name || 'Guest',
                cashier_name: userName || '',
                waiter_name: selectedSale.waiter_name || '',
                total: selectedSale.total_amount,
                discount: selectedSale.discount || 0,
                tax: selectedSale.tax || 0,
                service_charge: selectedSale.service_charge || 0,
                tax_rate: storeSettings?.tax_rate || 0,
                service_rate: storeSettings?.service_rate || 0,
                payment_method: selectedSale.payment_method,
                created_at: selectedSale.date,
                items: (selectedSale.sale_items || []).map((item: any) => {
                    const itemPrice = typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0').replace(/[^0-9.]/g, '')) || 0;
                    return {
                        name: item.product_name || (item.product?.name || 'Produk'),
                        quantity: item.quantity || 0,
                        price: itemPrice,
                        target: item.target || '',
                        category: item.product?.category || '',
                        isManual: !!item.isManual,
                        notes: item.notes
                    };
                }),
            };

            console.log('[HistoryScreen] Printing with items count:', orderData.items?.length);


            const success = await PrinterManager.printOrderReceipt(orderData);
            
            // 2. Also reprint Kitchen and Bar tickets
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to avoid BT congestion
            const kitchenSuccess = await PrinterManager.printToTarget(orderData.items, 'kitchen', orderData);
            const barSuccess = await PrinterManager.printToTarget(orderData.items, 'bar', orderData);

            if (!kitchenSuccess) {
                Alert.alert('Printer Dapur Error', 'Printer Dapur/Kitchen belum diatur atau tidak terhubung');
            }
            if (!barSuccess) {
                Alert.alert('Printer Bar Error', 'Printer Bar belum diatur atau tidak terhubung');
            }

            if (success) {
                Alert.alert('Sukses', 'Struk berhasil dicetak.');
            } else {
                Alert.alert('Gagal', 'Gagal mencetak struk. Pastikan printer terhubung di menu Pengaturan.');
            }
        } catch (error: any) {
            console.error('Print Error:', error);
            if (error.stack) console.error('Stack Trace:', error.stack);
            Alert.alert('Error', 'Terjadi kesalahan saat mencetak: ' + (error.message || 'Unknown error'));
        } finally {
            setPrinting(false);
        }
    };

    const handleDeleteSale = async () => {
        if (!selectedSale) return;
        handleQuickDelete(selectedSale);
    };

    const handleQuickDelete = async (sale: any) => {
        const processDelete = async () => {
            try {
                setLoading(true);
                // 1. Delete associated data first to avoid Foreign Key constraints (Error 23503)
                await supabase.from('sale_items').delete().eq('sale_id', sale.id);
                await supabase.from('sales_returns').delete().eq('sale_id', sale.id);
                
                // Financial Sync Deletion
                await supabase.from('journal_entries').delete().eq('reference_id', String(sale.id)).eq('source_type', 'sale');
                if (sale.order_no) {
                    await supabase.from('journal_entries').delete().ilike('description', `%${sale.order_no}%`);
                }

                // Unlink WiFi Vouchers
                await supabase.from('wifi_vouchers')
                    .update({ is_used: false, used_at: null, sale_id: null })
                    .eq('sale_id', sale.id);

                // 2. Delete the sale record
                const { error: saleError } = await supabase
                    .from('sales')
                    .delete()
                    .eq('id', sale.id);

                if (saleError) throw saleError;

                // 3. Free up table if needed
                if (sale.table_no && sale.table_no !== 'Tanpa Meja') {
                    await supabase
                        .from('tables')
                        .update({ status: 'Available' })
                        .eq('number', sale.table_no);
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
        };

        const confirmDelete = () => {
            Alert.alert(
                'Konfirmasi Hapus',
                `Apakah Anda yakin ingin menghapus transaksi ${sale.order_no}? Tindakan ini tidak dapat dibatalkan.`,
                [
                    { text: 'Batal', style: 'cancel' },
                    { 
                        text: 'Hapus', 
                        style: 'destructive',
                        onPress: processDelete
                    }
                ]
            );
        };

        if (storeSettings?.enable_manager_auth) {
            setPendingAction(() => confirmDelete);
            setShowManagerAuth(true);
        } else {
            confirmDelete();
        }
    };

    const handleBulkDelete = async () => {
        if (filteredHistory.length === 0) {
            Alert.alert('Info', 'Tidak ada transaksi yang bisa dihapus pada filter ini.');
            return;
        }

        const processBulkDelete = async () => {
            try {
                setLoading(true);
                const ids = filteredHistory.map(h => h.id);
                
                // 1. Delete associated data for all selected IDs
                await supabase.from('sale_items').delete().in('sale_id', ids);
                await supabase.from('sales_returns').delete().in('sale_id', ids);
                
                // Financial Sync Deletion (Bulk)
                await supabase.from('journal_entries').delete().in('reference_id', ids.map(id => String(id))).eq('source_type', 'sale');

                // Unlink WiFi Vouchers (Bulk)
                await supabase.from('wifi_vouchers')
                    .update({ is_used: false, used_at: null, sale_id: null })
                    .in('sale_id', ids);

                // 2. Delete sales records
                const { error: saleError } = await supabase
                    .from('sales')
                    .delete()
                    .in('id', ids);

                if (saleError) throw saleError;

                // 3. Reset tables status if these sales were active (though history usually means finished)
                const tableNumbers = filteredHistory
                    .map(h => h.table_no)
                    .filter(t => t && t !== 'Tanpa Meja');
                
                if (tableNumbers.length > 0) {
                    await supabase
                        .from('tables')
                        .update({ status: 'Available' })
                        .in('number', tableNumbers);
                }

                fetchHistory();
                Alert.alert('Sukses', `${ids.length} transaksi berhasil dihapus.`);
            } catch (error: any) {
                console.error('Bulk Delete Error:', error);
                Alert.alert('Error', 'Gagal menghapus beberapa transaksi: ' + error.message);
            } finally {
                setLoading(false);
            }
        };

        Alert.alert(
            'Konfirmasi Hapus Semua',
            `Anda akan menghapus SEMUA (${filteredHistory.length}) transaksi yang muncul di filter ini. Tindakan ini tidak dapat dibatalkan.\n\nLanjutkan?`,
            [
                { text: 'Batal', style: 'cancel' },
                { 
                    text: 'Hapus Semua', 
                    style: 'destructive',
                    onPress: () => {
                        // [MODIFIED] Enforce manager auth for Cashiers (non-admins) even if global setting is off
                        // Filtered/Bulk delete is a high-risk action.
                        if (!isAdmin) {
                            setPendingAction(() => processBulkDelete);
                            setShowManagerAuth(true);
                        } else if (storeSettings?.enable_manager_auth) {
                            setPendingAction(() => processBulkDelete);
                            setShowManagerAuth(true);
                        } else {
                            processBulkDelete();
                        }
                    }
                }
            ]
        );
    };

    const handleOpenEdit = () => {
        setShowDetailModal(false);
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
                    branch_id: currentBranchId,
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

                    <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                        {/* Info Section - More Compact */}
                        <View style={styles.compactInfoRow}>
                            <View style={styles.compactInfoItem}>
                                <Calendar size={12} color="#94a3b8" />
                                <Text style={styles.compactInfoLabel}>{selectedSale ? formatDate(selectedSale.date) : '-'}</Text>
                            </View>
                            <View style={styles.compactInfoItem}>
                                <User size={12} color="#94a3b8" />
                                <Text style={styles.compactInfoLabel}>{selectedSale?.customer_name || 'Guest'}</Text>
                            </View>
                            <View style={styles.compactInfoItem}>
                                <MapPin size={12} color="#94a3b8" />
                                <Text style={styles.compactInfoLabel}>{selectedSale?.table_no || 'No Table'}</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <View style={[styles.compactInfoItem, { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                                <Receipt size={12} color="#64748b" />
                                <Text style={[styles.compactInfoLabel, { color: '#475569' }]}>{selectedSale?.payment_method || '-'}</Text>
                            </View>
                            {(selectedSale?.status === 'Paid' || selectedSale?.status === 'Completed' || selectedSale?.status === 'Served' || selectedSale?.status === 'Ready') && (() => {
                                const dur = selectedSale.waiting_time || formatDuration(selectedSale.created_at, selectedSale.date);
                                return dur ? (
                                    <View style={[styles.compactInfoItem, { backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                                        <Text style={{ fontSize: 12 }}>⏱️</Text>
                                        <Text style={[styles.compactInfoLabel, { color: '#ea580c', fontWeight: 'bold' }]}>{dur}</Text>
                                    </View>
                                ) : null;
                            })()}
                        </View>

                        {/* Items Section */}
                        <Text style={[styles.sectionTitle, { marginTop: 12, marginBottom: 8 }]}>Rincian Item</Text>
                        {selectedSale?.sale_items?.map((item: any, idx: number) => (
                            <View key={item.id || idx} style={[styles.detailItemRow, { marginBottom: 6 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.detailItemName, { fontSize: 13 }]}>{item.product_name || (item.product?.name || 'Produk')}</Text>
                                    {item.notes ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }}>
                                            <Text style={{ fontSize: 10 }}>✍️</Text>
                                            <Text style={{ fontSize: 11, color: '#ea580c', fontWeight: '600', fontStyle: 'italic' }}>
                                                {item.notes}
                                            </Text>
                                        </View>
                                    ) : null}
                                    <Text style={styles.detailItemSub}>{item.quantity} x {formatCurrency(item.price)}</Text>
                                </View>
                                <Text style={[styles.detailItemTotal, { fontSize: 13 }]}>{formatCurrency(item.quantity * item.price)}</Text>
                            </View>
                        ))}

                        {/* Summary Section */}
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total Pembayaran</Text>
                            <Text style={styles.summaryValue}>{formatCurrency(selectedSale?.total_amount || 0)}</Text>
                        </View>
                    </ScrollView>
                    <View style={styles.modalFooter}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12 }}>
                            <Text style={{ fontSize: 14, color: '#64748b', fontWeight: 'bold' }}>Total Bayar</Text>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1e293b' }}>{formatCurrency(selectedSale?.total_amount || 0)}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                            {/* Actions Group 1: Print & Preview */}
                            <TouchableOpacity 
                                style={[styles.compactActionBtn, { backgroundColor: '#ea580c' }]}
                                onPress={handlePrintReceipt}
                                disabled={printing}
                            >
                                {printing ? <ActivityIndicator size="small" color="white" /> : (
                                    <>
                                        <Printer size={16} color="white" />
                                        <Text style={styles.compactActionBtnText}>Cetak</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.compactActionBtn, { backgroundColor: '#f1f5f9' }]}
                                onPress={handlePreviewReceipt}
                            >
                                <Receipt size={16} color="#64748b" />
                                <Text style={[styles.compactActionBtnText, { color: '#64748b' }]}>Preview</Text>
                            </TouchableOpacity>

                            {/* Actions Group 2: Edit & Delete */}
                            <TouchableOpacity 
                                style={[styles.compactActionBtn, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }]}
                                onPress={handleOpenEdit}
                            >
                                <Edit size={14} color="#64748b" />
                                <Text style={[styles.compactActionBtnText, { color: '#64748b' }]}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.compactActionBtn, { backgroundColor: '#fef2f2' }]}
                                onPress={handleDeleteSale}
                            >
                                <Trash2 size={14} color="#ef4444" />
                                <Text style={[styles.compactActionBtnText, { color: '#ef4444' }]}>Hapus</Text>
                            </TouchableOpacity>

                            {/* Conditional: Pay Now */}
                            {selectedSale && !['Paid', 'Completed', 'Served', 'Ready'].includes(selectedSale.status) && (
                                <TouchableOpacity 
                                    style={[styles.compactActionBtn, { backgroundColor: '#22c55e', width: '100%' }]}
                                    onPress={handlePayFromDetail}
                                >
                                    <Receipt size={16} color="white" />
                                    <Text style={styles.compactActionBtnText}>Bayar Sekarang</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity 
                            style={[styles.closeBtnSimple, { marginTop: 4 }]} 
                            onPress={() => setShowDetailModal(false)}
                        >
                            <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>Tutup</Text>
                        </TouchableOpacity>
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
                    <ChevronLeft size={32} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Riwayat Transaksi</Text>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#fff7ed', padding: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ffedd5' }} 
                        onPress={() => setShowCreateModal(true)}
                    >
                        <Text style={{ color: '#ea580c', fontWeight: 'bold', fontSize: 12 }}>+ Manual</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#fef2f2', padding: 6, borderRadius: 8, borderWidth: 1, borderColor: '#fee2e2' }} 
                        onPress={handleBulkDelete}
                    >
                        <Trash2 size={18} color="#ef4444" />
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
                    key={useMultiColumn ? 'multi-col' : 'single-col'}
                    numColumns={useMultiColumn ? 2 : 1}
                    keyExtractor={(item, index) => (item?.id ?? index).toString()}
                    columnWrapperStyle={useMultiColumn ? { gap: 12, paddingHorizontal: 12 } : null}
                    contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={[
                                styles.slimCard,
                                useMultiColumn && { flex: 1, marginRight: 0 }
                            ]}
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
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{ alignItems: 'flex-end' }}>
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
                                        <TouchableOpacity 
                                            onPress={() => handleQuickDelete(item)}
                                            style={{ backgroundColor: '#fef2f2', padding: 6, borderRadius: 8, marginLeft: 4 }}
                                        >
                                            <Trash2 size={16} color="#ef4444" />
                                        </TouchableOpacity>
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
                            <DateStepper 
                                label="Tanggal Awal" 
                                value={startDate} 
                                onChange={setStartDate} 
                            />
                            <DateStepper 
                                label="Tanggal Akhir" 
                                value={endDate} 
                                onChange={setEndDate} 
                            />
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
            <ManagerAuthModal
                visible={showManagerAuth}
                onClose={() => {
                    setShowManagerAuth(false);
                    setPendingAction(null);
                }}
                onSuccess={() => {
                    if (pendingAction) {
                        pendingAction();
                        setPendingAction(null);
                    }
                }}
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
    backButton: { 
        width: 48, 
        height: 48, 
        borderRadius: 24, 
        backgroundColor: '#f1f5f9', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginRight: 8 
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', flex: 1 },
    refreshBtn: { padding: 8 },
    searchSection: { padding: 12, backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 10,
        height: 40,
        marginBottom: 10,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: '#334155' },
    filterScroll: { flexDirection: 'row' },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        marginRight: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterChipActive: { backgroundColor: '#fff7ed', borderColor: '#ea580c' },
    filterChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
    filterChipTextActive: { color: '#ea580c' },
    statusToggle: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        marginRight: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statusToggleActive: {
        backgroundColor: '#eff6ff',
        borderColor: '#3b82f6',
    },
    statusToggleText: {
        fontSize: 11,
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
        padding: 10,
        borderRadius: 12,
        marginBottom: 6,
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
        marginBottom: 2,
    },
    slimOrderNo: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#ea580c',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#cbd5e1',
        marginHorizontal: 6,
    },
    slimTable: {
        fontSize: 11,
        fontWeight: '600',
        color: '#334155',
    },
    slimSub: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    slimDate: {
        fontSize: 10,
        color: '#94a3b8',
    },
    slimCustomer: {
        fontSize: 10,
        color: '#64748b',
        fontStyle: 'italic',
    },
    slimRight: {
        alignItems: 'flex-end',
    },
    slimAmount: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 2,
    },
    miniStatus: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    miniStatusText: {
        fontSize: 8,
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
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '85%', width: '100%', alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    modalSubtitle: { fontSize: 12, color: '#ea580c', fontWeight: '600' },
    closeBtn: { padding: 4 },
 
    // Compact Info Styles
    compactInfoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
    compactInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    compactInfoLabel: { fontSize: 11, color: '#64748b', fontWeight: '500' },
 
    modalScroll: { marginBottom: 16 },
    modalDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
    sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    detailItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    detailItemName: { fontSize: 13, color: '#334155', fontWeight: '500' },
    detailItemSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
    detailItemTotal: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    summaryLabel: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
    summaryValue: { fontSize: 18, fontWeight: 'bold', color: '#ea580c' },
    modalFooter: { gap: 8, marginTop: 4 },
    compactActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        flex: 1,
        minWidth: '45%',
        gap: 6,
    },
    compactActionBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: 'white',
    },
    closeBtnSimple: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    printBtn: { backgroundColor: '#1e293b', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    printBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    payBtnLarge: { backgroundColor: '#ea580c', padding: 16, borderRadius: 16, alignItems: 'center' },
    payBtnTextLarge: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
