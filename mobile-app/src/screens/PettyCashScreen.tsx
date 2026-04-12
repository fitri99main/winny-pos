import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Wallet, Lock, Unlock, History, Plus, ArrowUpCircle, ArrowDownCircle, Printer } from 'lucide-react-native';
import { PrinterManager } from '../lib/PrinterManager';
import { PettyCashService, PettyCashSession, PettyCashTransaction } from '../lib/PettyCashService';
import { useSession } from '../context/SessionContext';

export default function PettyCashScreen() {
    const navigation = useNavigation();
    const { currentBranchId, isAdmin, storeSettings, branchName } = useSession();
    
    const [loading, setLoading] = useState(true);
    const [activeSession, setActiveSession] = useState<PettyCashSession | null>(null);
    const [sessions, setSessions] = useState<PettyCashSession[]>([]);
    const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
    
    const [openingAmount, setOpeningAmount] = useState('');
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [manualType, setManualType] = useState('SPEND');
    const [manualAmount, setManualAmount] = useState('');
    const [manualDesc, setManualDesc] = useState('');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [showEditTxModal, setShowEditTxModal] = useState(false);
    const [editingTx, setEditingTx] = useState<PettyCashTransaction | null>(null);
    const [editTxType, setEditTxType] = useState('SPEND');
    const [editTxAmount, setEditTxAmount] = useState('');
    const [editTxDesc, setEditTxDesc] = useState('');
    const [closingPhysicalAmount, setClosingPhysicalAmount] = useState('');

    const fetchData = useCallback(async () => {
        if (!currentBranchId || isNaN(Number(currentBranchId))) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const session = await PettyCashService.getActiveSession(currentBranchId);
            setActiveSession(session);
            
            if (session) {
                const txs = await PettyCashService.getTransactions(session.id);
                setTransactions(txs);
            }
            
            const history = await PettyCashService.getSessions(currentBranchId);
            setSessions(history);
        } catch (error) {
            console.error('Error fetching petty cash:', error);
            Alert.alert('Error', 'Gagal memuat data Kas Kecil');
        } finally {
            setLoading(false);
        }
    }, [currentBranchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenSession = async () => {
        if (!openingAmount || isNaN(Number(openingAmount))) {
            Alert.alert('Error', 'Nominal saldo real awal tidak valid');
            return;
        }
        try {
            await PettyCashService.openSession(currentBranchId!, Number(openingAmount));
            Alert.alert('Sukses', 'Kas Kecil dibuka (Saldo Real)');
            setOpeningAmount('');
            setShowOpenModal(false);
            fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Gagal membuka Kas Kecil');
        }
    };

    const handleCloseSession = async () => {
        if (!activeSession) return;
        setClosingPhysicalAmount(String(activeSession.expected_balance));
        setShowCloseModal(true);
    };

    const handleFinalClose = async () => {
        if (!activeSession) return;
        try {
            const finalPhysical = Number(closingPhysicalAmount);
            if (isNaN(finalPhysical)) {
                Alert.alert('Error', 'Nominal tidak valid');
                return;
            }

            // 1. Correction if needed
            if (finalPhysical !== activeSession.expected_balance) {
                await PettyCashService.setBalance(activeSession.id, activeSession.expected_balance, finalPhysical);
            }

            // 2. Close session
            await PettyCashService.closeSession(activeSession.id, finalPhysical);
            
            Alert.alert('Sukses', 'Kas Kecil ditutup & direkonsiliasi');
            setShowCloseModal(false);
            fetchData();
        } catch (error) {
            Alert.alert('Error', 'Gagal menutup Kas Kecil');
        }
    };

    const handleAdjustBalance = async () => {
        if (!activeSession || !adjustAmount) return;
        try {
            await PettyCashService.setBalance(activeSession.id, activeSession.expected_balance, Number(adjustAmount));
            Alert.alert('Sukses', 'Saldo Real diperbarui');
            setAdjustAmount('');
            setShowAdjustModal(false);
            fetchData();
        } catch (error) {
            Alert.alert('Error', 'Gagal memperbarui saldo');
        }
    };

    const handleManualTransaction = async () => {
        if (!activeSession) return;
        if (!manualAmount || !manualDesc) {
            Alert.alert('Error', 'Mohon lengkapi nominal dan keterangan');
            return;
        }
        try {
            await PettyCashService.addTransaction({
                session_id: activeSession.id,
                type: manualType as any,
                amount: Number(manualAmount),
                description: manualDesc,
                reference_type: 'manual'
            });
            Alert.alert('Sukses', 'Transaksi dicatat');
            setManualAmount('');
            setManualDesc('');
            setShowManualModal(false);
            fetchData();
        } catch (error) {
            Alert.alert('Error', 'Gagal mencatat transaksi');
        }
    };

    const handleDeleteTransaction = async (id: number) => {
        Alert.alert(
            'Konfirmasi',
            'Hapus transaksi ini? Saldo akan dikalkulasi ulang otomatis.',
            [
                { text: 'Batal', style: 'cancel' },
                { 
                    text: 'Hapus', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await PettyCashService.deleteTransaction(id);
                            fetchData();
                        } catch (error) {
                            Alert.alert('Error', 'Gagal menghapus transaksi');
                        }
                    }
                }
            ]
        );
    };

    const handlePrintTransaction = async (tx: PettyCashTransaction) => {
        try {
            const hasPermission = isAdmin || (storeSettings && storeSettings.cashier_can_print_financial_receipt);
            if (!hasPermission) {
                Alert.alert('Akses Ditolak', 'Anda tidak memiliki izin untuk mencetak bukti kas.');
                return;
            }

            const branchInfo = {
                name: branchName,
                address: storeSettings?.address,
                receiptHeader: storeSettings?.receipt_header,
                receipt_paper_width: storeSettings?.receipt_paper_width || '58mm'
            };

            await PrinterManager.printPettyCashSlip(tx, branchInfo);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Gagal mencetak bukti kas');
        }
    };

    const handleUpdateTransaction = async () => {
        if (!editingTx) return;
        try {
            await PettyCashService.updateTransaction(editingTx.id, {
                type: editTxType as any,
                amount: Number(editTxAmount),
                description: editTxDesc
            });
            setShowEditTxModal(false);
            setEditingTx(null);
            fetchData();
        } catch (error) {
            Alert.alert('Error', 'Gagal memperbarui transaksi');
        }
    };

    const handleDeleteSession = async (id: number) => {
        Alert.alert(
            'HAPUS SESI',
            'Hapus riwayat sesi ini beserta SELURUH transaksinya permanen?',
            [
                { text: 'Batal', style: 'cancel' },
                { 
                    text: 'Hapus Permanen', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await PettyCashService.deleteSession(id);
                            fetchData();
                        } catch (error) {
                            Alert.alert('Error', 'Gagal menghapus riwayat');
                        }
                    }
                }
            ]
        );
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', { 
            style: 'currency', 
            currency: 'IDR', 
            minimumFractionDigits: 0 
        }).format(value);
    };

    if (loading && !activeSession) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ea580c" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={28} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Kas Kecil (Saldo Real)</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {!activeSession ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <Lock size={40} color="#94a3b8" />
                        </View>
                        <Text style={styles.emptyTitle}>Sesi Kas Kecil Tertutup</Text>
                        <Text style={styles.emptyDesc}>Harap buka sesi baru untuk mulai mencatat transaksi harian.</Text>
                        <TouchableOpacity 
                            style={styles.openButton}
                            onPress={() => setShowOpenModal(true)}
                        >
                            <Unlock size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.openButtonText}>Buka Sesi Hari Ini</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Active Session Card */}
                        <View style={styles.activeCard}>
                            <View style={styles.activeCardHeader}>
                                <View style={styles.activeLabel}>
                                    <Text style={styles.activeLabelText}>AKTIF</Text>
                                </View>
                                <Text style={styles.dateText}>{new Date(activeSession.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
                            </View>
                            
                            <Text style={styles.balanceLabel}>Saldo Real Saat Ini</Text>
                            <View style={styles.balanceRow}>
                                <Text style={styles.balanceValue}>{formatCurrency(activeSession.expected_balance)}</Text>
                                <TouchableOpacity 
                                    style={styles.adjustBtn} 
                                    onPress={() => {
                                        setAdjustAmount(String(activeSession.expected_balance));
                                        setShowAdjustModal(true);
                                    }}
                                >
                                    <Plus size={18} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                            
                            <View style={styles.activeCardFooter}>
                                <TouchableOpacity 
                                    style={styles.closeBtn}
                                    onPress={() => setShowCloseModal(true)}
                                >
                                    <Lock size={16} color="#ea580c" style={{ marginRight: 6 }} />
                                    <Text style={styles.closeBtnText}>Tutup Sesi Hari Ini</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Recent Transactions */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Transaksi Hari Ini</Text>
                                <TouchableOpacity 
                                    style={styles.manualActionBtn}
                                    onPress={() => setShowManualModal(true)}
                                >
                                    <Plus size={16} color="#ea580c" />
                                    <Text style={styles.manualActionText}>Input Manual</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.listCard}>
                                {transactions.length === 0 ? (
                                    <Text style={styles.emptyText}>Belum ada transaksi</Text>
                                ) : (
                                    transactions.map((tx, index) => (
                                        <View key={tx.id} style={[styles.transactionItem, index === transactions.length - 1 && { borderBottomWidth: 0 }]}>
                                            <View style={[styles.txIcon, { backgroundColor: tx.type === 'TOPUP' ? '#f0fdf4' : '#fef2f2' }]}>
                                                {tx.type === 'TOPUP' ? 
                                                    <ArrowUpCircle size={20} color="#22c55e" /> : 
                                                    <ArrowDownCircle size={20} color="#ef4444" />
                                                }
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.txDesc}>{tx.description}</Text>
                                                <Text style={styles.txTime}>{new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</Text>
                                            </View>
                                            <Text style={[styles.txAmount, { color: tx.type === 'TOPUP' ? '#22c55e' : '#ef4444' }]}>
                                                {tx.type === 'TOPUP' ? '+' : '-'}{formatCurrency(tx.amount)}
                                            </Text>
                                            <View style={styles.txActions}>
                                                <TouchableOpacity 
                                                    onPress={() => {
                                                        setEditingTx(tx);
                                                        setEditTxType(tx.type);
                                                        setEditTxAmount(String(tx.amount));
                                                        setEditTxDesc(tx.description);
                                                        setShowEditTxModal(true);
                                                    }}
                                                    style={styles.txActionBtn}
                                                >
                                                    <Text style={styles.editLabel}>Edit</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handlePrintTransaction(tx)} style={styles.txActionBtn}>
                                                    <Printer size={16} color="#64748b" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleDeleteTransaction(tx.id)} style={styles.txActionBtn}>
                                                    <Text style={styles.deleteLabel}>✕</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        </View>
                    </>
                )}

                {/* History Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <History size={18} color="#64748b" />
                        <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>Riwayat Sesi</Text>
                    </View>
                    <View style={styles.listCard}>
                        {sessions.map((item, index) => (
                            <View key={item.id} style={[styles.historyItem, index === sessions.length - 1 && { borderBottomWidth: 0 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                                    <Text style={styles.historyStatus}>{item.status === 'open' ? 'Masih Terbuka' : 'Selesai'}</Text>
                                </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.historyBalance}>{formatCurrency(item.expected_balance)}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <TouchableOpacity onPress={() => handleDeleteSession(item.id)} style={{ padding: 4 }}>
                                                <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>Hapus</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Modal Buka Sesi */}
            <Modal visible={showOpenModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Buka Kas Kecil</Text>
                        <Text style={styles.modalSub}>Input saldo fisik awal yang tersedia di laci kas saat ini.</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Rp 0"
                            keyboardType="numeric"
                            value={openingAmount}
                            onChangeText={setOpeningAmount}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowOpenModal(false)}>
                                <Text style={styles.cancelBtnText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleOpenSession}>
                                <Text style={styles.confirmBtnText}>Buka Sesi</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Rekonsiliasi Penutupan */}
            <Modal visible={showCloseModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Tutup Buku Kas Kecil</Text>
                        <View style={{ backgroundColor: '#fff7ed', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                            <Text style={{ fontSize: 12, color: '#9a3412', fontWeight: 'bold' }}>SALDO SISTEM</Text>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#ea580c' }}>{formatCurrency(activeSession?.expected_balance || 0)}</Text>
                        </View>
                        
                        <Text style={styles.modalSub}>Berapa total uang fisik yang ada di laci saat ini?</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Rp 0"
                            keyboardType="numeric"
                            value={closingPhysicalAmount}
                            onChangeText={setClosingPhysicalAmount}
                            autoFocus
                        />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Text style={{ fontSize: 14, color: '#64748b' }}>Selisih:</Text>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: (Number(closingPhysicalAmount) - (activeSession?.expected_balance || 0)) === 0 ? '#64748b' : '#ef4444' }}>
                                {formatCurrency(Number(closingPhysicalAmount) - (activeSession?.expected_balance || 0))}
                            </Text>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCloseModal(false)}>
                                <Text style={styles.cancelBtnText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleFinalClose}>
                                <Text style={styles.confirmBtnText}>Tutup Sesi</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Koreksi Saldo */}
            <Modal visible={showAdjustModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Koreksi Saldo Real</Text>
                        <Text style={styles.modalSub}>Gunakan ini jika Anda ingin menyesuaikan saldo ke angka baru secara manual.</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nominal Baru"
                            keyboardType="numeric"
                            value={adjustAmount}
                            onChangeText={setAdjustAmount}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdjustModal(false)}>
                                <Text style={styles.cancelBtnText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleAdjustBalance}>
                                <Text style={styles.confirmBtnText}>Simpan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Transaksi Manual */}
            <Modal visible={showManualModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Catat Kas Manual</Text>
                        
                        <View style={styles.typeToggle}>
                            <TouchableOpacity 
                                style={[styles.typeBtn, manualType === 'TOPUP' && styles.topupActive]}
                                onPress={() => setManualType('TOPUP')}
                            >
                                <Text style={[styles.typeBtnText, manualType === 'TOPUP' && styles.activeTypeText]}>TOP UP (Masuk)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.typeBtn, manualType === 'SPEND' && styles.spendActive]}
                                onPress={() => setManualType('SPEND')}
                            >
                                <Text style={[styles.typeBtnText, manualType === 'SPEND' && styles.activeTypeText]}>KELUAR</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Rp 0"
                            keyboardType="numeric"
                            value={manualAmount}
                            onChangeText={setManualAmount}
                        />
                        <TextInput
                            style={[styles.input, { fontSize: 14, height: 60, textAlign: 'left' }]}
                            placeholder="Keterangan (misal: Beli Bensin)"
                            value={manualDesc}
                            onChangeText={setManualDesc}
                            multiline
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowManualModal(false)}>
                                <Text style={styles.cancelBtnText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleManualTransaction}>
                                <Text style={styles.confirmBtnText}>Simpan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Edit Transaksi */}
            <Modal visible={showEditTxModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Transaksi</Text>
                        
                        <View style={styles.typeToggle}>
                            <TouchableOpacity 
                                style={[styles.typeBtn, editTxType === 'TOPUP' && styles.topupActive]}
                                onPress={() => setEditTxType('TOPUP')}
                            >
                                <Text style={[styles.typeBtnText, editTxType === 'TOPUP' && styles.activeTypeText]}>MASUK</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.typeBtn, editTxType === 'SPEND' && styles.spendActive]}
                                onPress={() => setEditTxType('SPEND')}
                            >
                                <Text style={[styles.typeBtnText, editTxType === 'SPEND' && styles.activeTypeText]}>KELUAR</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Rp 0"
                            keyboardType="numeric"
                            value={editTxAmount}
                            onChangeText={setEditTxAmount}
                        />
                        <TextInput
                            style={[styles.input, { fontSize: 14, height: 60, textAlign: 'left' }]}
                            placeholder="Keterangan"
                            value={editTxDesc}
                            onChangeText={setEditTxDesc}
                            multiline
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                                setShowEditTxModal(false);
                                setEditingTx(null);
                            }}>
                                <Text style={styles.cancelBtnText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleUpdateTransaction}>
                                <Text style={styles.confirmBtnText}>Simpan</Text>
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
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: { marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    scrollContent: { padding: 16 },
    
    emptyContainer: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderStyle: 'dashed',
        marginTop: 20,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 8 },
    emptyDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    openButton: {
        backgroundColor: '#ea580c',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
    },
    openButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    
    activeCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#ffedd5',
        elevation: 2,
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    activeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    activeLabel: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    activeLabelText: { fontSize: 10, fontWeight: '900', color: '#16a34a' },
    dateText: { fontSize: 12, color: '#64748b' },
    balanceLabel: { fontSize: 13, color: '#64748b', marginBottom: 4 },
    balanceValue: { fontSize: 28, fontWeight: '900', color: '#1e293b' },
    activeCardFooter: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#fef3c7' },
    closeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    closeBtnText: { color: '#ea580c', fontWeight: 'bold', fontSize: 14 },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    adjustBtn: {
        padding: 6,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    
    section: { marginTop: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingLeft: 4 },
    sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#334155' },
    listCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', padding: 8 },
    transactionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    txDesc: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
    txTime: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    txAmount: { fontSize: 14, fontWeight: 'bold' },
    txActions: { flexDirection: 'row', gap: 12, marginLeft: 12, alignItems: 'center' },
    txActionBtn: { padding: 4 },
    editLabel: { fontSize: 10, color: '#3b82f6', fontWeight: 'bold' },
    deleteLabel: { fontSize: 12, color: '#94a3b8' },
    
    emptyText: { textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 14, fontStyle: 'italic' },
    
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    historyDate: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
    historyStatus: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    historyBalance: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    historyDiff: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    modalSub: { fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 20 },
    input: { backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, fontSize: 20, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    modalActions: { flexDirection: 'row', gap: 12 },
    cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
    confirmBtn: { flex: 2, backgroundColor: '#1e293b', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
    confirmBtnText: { color: '#fff', fontWeight: 'bold' },
    manualActionBtn: {
        marginLeft: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#fff7ed',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fdba74',
    },
    manualActionText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#ea580c',
        marginLeft: 4,
    },
    typeToggle: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    typeBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    topupActive: { backgroundColor: '#f0fdf4', borderColor: '#bcf0da' },
    spendActive: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
    typeBtnText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
    activeTypeText: { color: '#1e293b' },
});
