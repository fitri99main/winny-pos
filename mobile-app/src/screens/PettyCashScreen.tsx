import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var StyleSheet = RN.StyleSheet;
var ActivityIndicator = RN.ActivityIndicator;
var Alert = RN.Alert;
var TextInput = RN.TextInput;
var Modal = RN.Modal;
var FlatList = RN.FlatList;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
import * as Lucide from 'lucide-react-native';
var ChevronLeft = Lucide.ChevronLeft;
var Wallet = Lucide.Wallet;
var Lock = Lucide.Lock;
var Unlock = Lucide.Unlock;
var History = Lucide.History;
var Plus = Lucide.Plus;
var ArrowUpCircle = Lucide.ArrowUpCircle;
var ArrowDownCircle = Lucide.ArrowDownCircle;
var Printer = Lucide.Printer;
import * as PrinterLib from '../lib/PrinterManager';
var PrinterManager = PrinterLib.PrinterManager;
import * as PettyCashLib from '../lib/PettyCashService';
var PettyCashService = PettyCashLib.PettyCashService;
var getPettyCashErrorMessage = PettyCashLib.getPettyCashErrorMessage;
var isPettyCashSchemaMissingError = PettyCashLib.isPettyCashSchemaMissingError;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;

export default function PettyCashScreen() {
    var navigation = useNavigation();
    var session = useSession();
    var currentBranchId = session.currentBranchId;
    var isAdmin = session.isAdmin;
    var storeSettings = session.storeSettings;
    var branchName = session.branchName;
    
    var stateLoading = React.useState(true);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var stateActiveSession = React.useState(null);
    var activeSession = stateActiveSession[0];
    var setActiveSession = stateActiveSession[1];

    var stateSessions = React.useState([]);
    var sessions = stateSessions[0];
    var setSessions = stateSessions[1];

    var stateTransactions = React.useState([]);
    var transactions = stateTransactions[0];
    var setTransactions = stateTransactions[1];
    
    var stateOpeningAmount = React.useState('');
    var openingAmount = stateOpeningAmount[0];
    var setOpeningAmount = stateOpeningAmount[1];

    var stateShowOpenModal = React.useState(false);
    var showOpenModal = stateShowOpenModal[0];
    var setShowOpenModal = stateShowOpenModal[1];

    var stateShowCloseModal = React.useState(false);
    var showCloseModal = stateShowCloseModal[0];
    var setShowCloseModal = stateShowCloseModal[1];

    var stateShowManualModal = React.useState(false);
    var showManualModal = stateShowManualModal[0];
    var setShowManualModal = stateShowManualModal[1];

    var stateShowAdjustModal = React.useState(false);
    var showAdjustModal = stateShowAdjustModal[0];
    var setShowAdjustModal = stateShowAdjustModal[1];

    var stateManualType = React.useState('SPEND');
    var manualType = stateManualType[0];
    var setManualType = stateManualType[1];

    var stateManualAmount = React.useState('');
    var manualAmount = stateManualAmount[0];
    var setManualAmount = stateManualAmount[1];

    var stateManualDesc = React.useState('');
    var manualDesc = stateManualDesc[0];
    var setManualDesc = stateManualDesc[1];

    var stateAdjustAmount = React.useState('');
    var adjustAmount = stateAdjustAmount[0];
    var setAdjustAmount = stateAdjustAmount[1];

    var stateShowEditTxModal = React.useState(false);
    var showEditTxModal = stateShowEditTxModal[0];
    var setShowEditTxModal = stateShowEditTxModal[1];

    var stateEditingTx = React.useState(null);
    var editingTx = stateEditingTx[0];
    var setEditingTx = stateEditingTx[1];

    var stateEditTxType = React.useState('SPEND');
    var editTxType = stateEditTxType[0];
    var setEditTxType = stateEditTxType[1];

    var stateEditTxAmount = React.useState('');
    var editTxAmount = stateEditTxAmount[0];
    var setEditTxAmount = stateEditTxAmount[1];

    var stateEditTxDesc = React.useState('');
    var editTxDesc = stateEditTxDesc[0];
    var setEditTxDesc = stateEditTxDesc[1];

    var stateClosingPhysicalAmount = React.useState('');
    var closingPhysicalAmount = stateClosingPhysicalAmount[0];
    var setClosingPhysicalAmount = stateClosingPhysicalAmount[1];

    var fetchData = React.useCallback(function() {
        if (!currentBranchId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        return PettyCashService.getActiveSession(currentBranchId)
            .then(function(activeSess) {
                setActiveSession(activeSess);
                if (activeSess) {
                    return PettyCashService.getTransactions(activeSess.id).then(function(txs) {
                        setTransactions(txs);
                    });
                }
            })
            .then(function() {
                return PettyCashService.getSessions(currentBranchId).then(function(history) {
                    setSessions(history);
                });
            })['catch'](function(error) {
                if (isPettyCashSchemaMissingError(error)) {
                    console.warn('Petty cash module is not available in the database yet.');
                } else {
                    console.error('Error fetching petty cash:', error);
                }
                Alert.alert('Error', getPettyCashErrorMessage(error, 'Gagal memuat data Kas Kecil'));
            })
            .finally(function() {
                setLoading(false);
            });
    }, [currentBranchId]);

    React.useEffect(function() {
        fetchData();
    }, [fetchData]);

    var handleOpenSession = function() {
        if (!openingAmount || isNaN(Number(openingAmount))) {
            Alert.alert('Error', 'Nominal saldo real awal tidak valid');
            return;
        }
        return PettyCashService.openSession(currentBranchId, Number(openingAmount))
            .then(function() {
                Alert.alert('Sukses', 'Kas Kecil dibuka (Saldo Real)');
                setOpeningAmount('');
                setShowOpenModal(false);
                fetchData();
            })['catch'](function(error) {
                Alert.alert('Error', getPettyCashErrorMessage(error, 'Gagal membuka Kas Kecil'));
            });
    };

    var handleCloseSession = function() {
        if (!activeSession) return;
        setClosingPhysicalAmount(String(activeSession.expected_balance));
        setShowCloseModal(true);
    };

    var handleFinalClose = function() {
        if (!activeSession) return;
        var finalPhysical = Number(closingPhysicalAmount);
        if (isNaN(finalPhysical)) {
            Alert.alert('Error', 'Nominal tidak valid');
            return;
        }

        var promise = Promise.resolve();
        if (finalPhysical !== activeSession.expected_balance) {
            promise = PettyCashService.setBalance(activeSession.id, activeSession.expected_balance, finalPhysical);
        }

        return promise.then(function() {
            return PettyCashService.closeSession(activeSession.id, finalPhysical);
        })
        .then(function() {
            Alert.alert(
                'Sukses', 
                'Kas Kecil ditutup & direkonsiliasi. Sesi Anda telah berakhir.',
                [{ text: 'OK', onPress: function() { supabase.auth.signOut(); } }]
            );
            setShowCloseModal(false);
        })['catch'](function(error) {
            Alert.alert('Error', getPettyCashErrorMessage(error, 'Gagal menutup Kas Kecil'));
        });
    };

    var handleAdjustBalance = function() {
        if (!activeSession || !adjustAmount) return;
        return PettyCashService.setBalance(activeSession.id, activeSession.expected_balance, Number(adjustAmount))
            .then(function() {
                Alert.alert('Sukses', 'Saldo Real diperbarui');
                setAdjustAmount('');
                setShowAdjustModal(false);
                fetchData();
            })['catch'](function(error) {
                Alert.alert('Error', getPettyCashErrorMessage(error, 'Gagal memperbarui saldo'));
            });
    };

    var handleManualTransaction = function() {
        if (!activeSession) return;
        if (!manualAmount || !manualDesc) {
            Alert.alert('Error', 'Mohon lengkapi nominal dan keterangan');
            return;
        }
        return PettyCashService.addTransaction({
            session_id: activeSession.id,
            type: manualType,
            amount: Number(manualAmount),
            description: manualDesc,
            reference_type: 'manual'
        }).then(function() {
            Alert.alert('Sukses', 'Transaksi dicatat');
            setManualAmount('');
            setManualDesc('');
            setShowManualModal(false);
            fetchData();
        })['catch'](function(error) {
            Alert.alert('Error', getPettyCashErrorMessage(error, 'Gagal mencatat transaksi'));
        });
    };

    var handleDeleteTransaction = function(id) {
        Alert.alert(
            'Konfirmasi',
            'Hapus transaksi ini? Saldo akan dikalkulasi ulang otomatis.',
            [
                { text: 'Batal', style: 'cancel' },
                { 
                    text: 'Hapus', 
                    style: 'destructive',
                    onPress: function() {
                        return PettyCashService.deleteTransaction(id).then(function() {
                            fetchData();
                        })['catch'](function(error) {
                            Alert.alert('Error', 'Gagal menghapus transaksi');
                        });
                    }
                }
            ]
        );
    };

    var handlePrintTransaction = function(tx) {
        var hasPermission = isAdmin || (storeSettings && storeSettings.cashier_can_print_financial_receipt);
        if (!hasPermission) {
            Alert.alert('Akses Ditolak', 'Anda tidak memiliki izin untuk mencetak bukti kas.');
            return;
        }

        var branchInfo = {
            name: branchName,
            address: storeSettings && storeSettings.address,
            receiptHeader: storeSettings && storeSettings.receipt_header,
            receipt_paper_width: (storeSettings && storeSettings.receipt_paper_width) || '58mm'
        };

        return PrinterManager.printPettyCashSlip(tx, branchInfo)['catch'](function(error) {
            Alert.alert('Error', (error && error.message) || 'Gagal mencetak bukti kas');
        });
    };

    var handleUpdateTransaction = function() {
        if (!editingTx) return;
        return PettyCashService.updateTransaction(editingTx.id, {
            type: editTxType,
            amount: Number(editTxAmount),
            description: editTxDesc
        }).then(function() {
            setShowEditTxModal(false);
            setEditingTx(null);
            fetchData();
        })['catch'](function(error) {
            Alert.alert('Error', 'Gagal memperbarui transaksi');
        });
    };

    var handleDeleteSession = function(id) {
        Alert.alert(
            'HAPUS SESI',
            'Hapus riwayat sesi ini beserta SELURUH transaksinya permanen?',
            [
                { text: 'Batal', style: 'cancel' },
                { 
                    text: 'Hapus Permanen', 
                    style: 'destructive',
                    onPress: function() {
                        return PettyCashService.deleteSession(id).then(function() {
                            fetchData();
                        })['catch'](function(error) {
                            Alert.alert('Error', 'Gagal menghapus riwayat');
                        });
                    }
                }
            ]
        );
    };

    var formatCurrency = function(value) {
        var val = value || 0;
        return 'Rp ' + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    if (loading && !activeSession) {
        return React.createElement(SafeAreaView, { style: styles.container },
            React.createElement(View, { style: styles.loadingContainer },
                React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" })
            )
        );
    }

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(View, { style: styles.header },
            React.createElement(TouchableOpacity, { onPress: function() { navigation.goBack(); }, style: styles.backButton },
                React.createElement(ChevronLeft, { size: 28, color: "#1f2937" })
            ),
            React.createElement(Text, { style: styles.headerTitle }, "Kas Kecil (Saldo Real)")
        ),
        React.createElement(ScrollView, { contentContainerStyle: styles.scrollContent },
            !activeSession ? (
                React.createElement(View, { style: styles.emptyContainer },
                    React.createElement(View, { style: styles.emptyIconCircle },
                        React.createElement(Lock, { size: 40, color: "#94a3b8" })
                    ),
                    React.createElement(Text, { style: styles.emptyTitle }, "Sesi Kas Kecil Tertutup"),
                    React.createElement(Text, { style: styles.emptyDesc }, "Harap buka sesi baru untuk mulai mencatat transaksi harian."),
                    React.createElement(TouchableOpacity, { 
                        style: styles.openButton,
                        onPress: function() { setShowOpenModal(true); }
                    },
                        React.createElement(Unlock, { size: 20, color: "#fff", style: { marginRight: 8 } }),
                        React.createElement(Text, { style: styles.openButtonText }, "Buka Sesi Hari Ini")
                    )
                )
            ) : (
                React.createElement(View, null,
                    React.createElement(View, { style: styles.activeCard },
                        React.createElement(View, { style: styles.activeCardHeader },
                            React.createElement(View, { style: styles.activeLabel },
                                React.createElement(Text, { style: styles.activeLabelText }, "AKTIF")
                            ),
                            React.createElement(Text, { style: styles.dateText },
                                new Date(activeSession.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
                            )
                        ),
                        React.createElement(Text, { style: styles.balanceLabel }, "Saldo Real Saat Ini"),
                        React.createElement(View, { style: styles.balanceRow },
                            React.createElement(Text, { style: styles.balanceValue }, formatCurrency(activeSession.expected_balance)),
                            React.createElement(TouchableOpacity, { 
                                style: styles.adjustBtn, 
                                onPress: function() {
                                    setAdjustAmount(String(activeSession.expected_balance));
                                    setShowAdjustModal(true);
                                }
                            },
                                React.createElement(Plus, { size: 18, color: "#94a3b8" })
                            )
                        ),
                        React.createElement(View, { style: styles.activeCardFooter },
                            React.createElement(TouchableOpacity, { 
                                style: styles.closeBtn,
                                onPress: function() { setShowCloseModal(true); }
                            },
                                React.createElement(Lock, { size: 16, color: "#ea580c", style: { marginRight: 6 } }),
                                React.createElement(Text, { style: styles.closeBtnText }, "Tutup Sesi Hari Ini")
                            )
                        )
                    ),
                    React.createElement(View, { style: styles.section },
                        React.createElement(View, { style: styles.sectionHeader },
                            React.createElement(Text, { style: styles.sectionTitle }, "Transaksi Hari Ini"),
                            React.createElement(TouchableOpacity, { 
                                style: styles.manualActionBtn,
                                onPress: function() { setShowManualModal(true); }
                            },
                                React.createElement(Plus, { size: 16, color: "#ea580c" }),
                                React.createElement(Text, { style: styles.manualActionText }, "Input Manual")
                            )
                        ),
                        React.createElement(View, { style: styles.listCard },
                            transactions.length === 0 ? (
                                React.createElement(Text, { style: styles.emptyText }, "Belum ada transaksi")
                            ) : (
                                transactions.map(function(tx, index) {
                                    return React.createElement(View, { key: tx.id, style: [styles.transactionItem, index === transactions.length - 1 && { borderBottomWidth: 0 }] },
                                        React.createElement(View, { style: [styles.txIcon, { backgroundColor: tx.type === 'TOPUP' ? '#f0fdf4' : '#fef2f2' }] },
                                            tx.type === 'TOPUP' ? 
                                                React.createElement(ArrowUpCircle, { size: 20, color: "#22c55e" }) : 
                                                React.createElement(ArrowDownCircle, { size: 20, color: "#ef4444" })
                                        ),
                                        React.createElement(View, { style: { flex: 1 } },
                                            React.createElement(Text, { style: styles.txDesc }, tx.description),
                                            React.createElement(Text, { style: styles.txTime },
                                                new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                            )
                                        ),
                                        React.createElement(Text, { style: [styles.txAmount, { color: tx.type === 'TOPUP' ? '#22c55e' : '#ef4444' }] },
                                            (tx.type === 'TOPUP' ? '+' : '-') + formatCurrency(tx.amount)
                                        ),
                                        React.createElement(View, { style: styles.txActions },
                                            React.createElement(TouchableOpacity, { 
                                                onPress: function() {
                                                    setEditingTx(tx);
                                                    setEditTxType(tx.type);
                                                    setEditTxAmount(String(tx.amount));
                                                    setEditTxDesc(tx.description);
                                                    setShowEditTxModal(true);
                                                },
                                                style: styles.txActionBtn
                                            },
                                                React.createElement(Text, { style: styles.editLabel }, "Edit")
                                            ),
                                            React.createElement(TouchableOpacity, { onPress: function() { handlePrintTransaction(tx); }, style: styles.txActionBtn },
                                                React.createElement(Printer, { size: 16, color: "#64748b" })
                                            ),
                                            React.createElement(TouchableOpacity, { onPress: function() { handleDeleteTransaction(tx.id); }, style: styles.txActionBtn },
                                                React.createElement(Text, { style: styles.deleteLabel }, "✕")
                                            )
                                        )
                                    );
                                })
                            )
                        )
                    )
                )
            ),
            React.createElement(View, { style: styles.section },
                React.createElement(View, { style: styles.sectionHeader },
                    React.createElement(History, { size: 18, color: "#64748b" }),
                    React.createElement(Text, { style: [styles.sectionTitle, { marginLeft: 8 }] }, "Riwayat Sesi")
                ),
                React.createElement(View, { style: styles.listCard },
                    sessions.map(function(item, index) {
                        return React.createElement(View, { key: item.id, style: [styles.historyItem, index === sessions.length - 1 && { borderBottomWidth: 0 }] },
                            React.createElement(View, { style: { flex: 1 } },
                                React.createElement(Text, { style: styles.historyDate },
                                    new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                ),
                                React.createElement(Text, { style: styles.historyStatus },
                                    item.status === 'open' ? 'Masih Terbuka' : 'Selesai'
                                )
                            ),
                            React.createElement(View, { style: { alignItems: 'flex-end' } },
                                React.createElement(Text, { style: styles.historyBalance }, formatCurrency(item.expected_balance)),
                                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                                    React.createElement(TouchableOpacity, { onPress: function() { handleDeleteSession(item.id); }, style: { padding: 4 } },
                                        React.createElement(Text, { style: { color: '#ef4444', fontSize: 10, fontWeight: 'bold' } }, "Hapus")
                                    )
                                )
                            )
                        );
                    })
                )
            )
        ),
        React.createElement(Modal, { visible: showOpenModal, transparent: true, animationType: "fade" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(Text, { style: styles.modalTitle }, "Buka Kas Kecil"),
                    React.createElement(Text, { style: styles.modalSub }, "Input saldo fisik awal yang tersedia di laci kas saat ini."),
                    React.createElement(TextInput, {
                        style: styles.input,
                        placeholder: "Rp 0",
                        keyboardType: "numeric",
                        value: openingAmount,
                        onChangeText: setOpeningAmount,
                        autoFocus: true
                    }),
                    React.createElement(View, { style: styles.modalActions },
                        React.createElement(TouchableOpacity, { style: styles.cancelBtn, onPress: function() { setShowOpenModal(false); } },
                            React.createElement(Text, { style: styles.cancelBtnText }, "Batal")
                        ),
                        React.createElement(TouchableOpacity, { style: styles.confirmBtn, onPress: handleOpenSession },
                            React.createElement(Text, { style: styles.confirmBtnText }, "Buka Sesi")
                        )
                    )
                )
            )
        ),
        React.createElement(Modal, { visible: showCloseModal, transparent: true, animationType: "slide" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(Text, { style: styles.modalTitle }, "Tutup Buku Kas Kecil"),
                    React.createElement(View, { style: { backgroundColor: '#fff7ed', padding: 12, borderRadius: 12, marginBottom: 16 } },
                        React.createElement(Text, { style: { fontSize: 12, color: '#9a3412', fontWeight: 'bold' } }, "SALDO SISTEM"),
                        React.createElement(Text, { style: { fontSize: 20, fontWeight: '900', color: '#ea580c' } },
                            formatCurrency(activeSession ? activeSession.expected_balance : 0)
                        )
                    ),
                    React.createElement(Text, { style: styles.modalSub }, "Berapa total uang fisik yang ada di laci saat ini?"),
                    React.createElement(TextInput, {
                        style: styles.input,
                        placeholder: "Rp 0",
                        keyboardType: "numeric",
                        value: closingPhysicalAmount,
                        onChangeText: setClosingPhysicalAmount,
                        autoFocus: true
                    }),
                    React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 } },
                        React.createElement(Text, { style: { fontSize: 14, color: '#64748b' } }, "Selisih:"),
                        React.createElement(Text, { style: { 
                            fontSize: 14, 
                            fontWeight: 'bold', 
                            color: (Number(closingPhysicalAmount) - (activeSession ? activeSession.expected_balance : 0)) === 0 ? '#64748b' : '#ef4444' 
                        } },
                            formatCurrency(Number(closingPhysicalAmount) - (activeSession ? activeSession.expected_balance : 0))
                        )
                    ),
                    React.createElement(View, { style: styles.modalActions },
                        React.createElement(TouchableOpacity, { style: styles.cancelBtn, onPress: function() { setShowCloseModal(false); } },
                            React.createElement(Text, { style: styles.cancelBtnText }, "Batal")
                        ),
                        React.createElement(TouchableOpacity, { style: styles.confirmBtn, onPress: handleFinalClose },
                            React.createElement(Text, { style: styles.confirmBtnText }, "Tutup Sesi")
                        )
                    )
                )
            )
        ),
        React.createElement(Modal, { visible: showAdjustModal, transparent: true, animationType: "fade" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(Text, { style: styles.modalTitle }, "Koreksi Saldo Real"),
                    React.createElement(Text, { style: styles.modalSub }, "Gunakan ini jika Anda ingin menyesuaikan saldo ke angka baru secara manual."),
                    React.createElement(TextInput, {
                        style: styles.input,
                        placeholder: "Nominal Baru",
                        keyboardType: "numeric",
                        value: adjustAmount,
                        onChangeText: setAdjustAmount,
                        autoFocus: true
                    }),
                    React.createElement(View, { style: styles.modalActions },
                        React.createElement(TouchableOpacity, { style: styles.cancelBtn, onPress: function() { setShowAdjustModal(false); } },
                            React.createElement(Text, { style: styles.cancelBtnText }, "Batal")
                        ),
                        React.createElement(TouchableOpacity, { style: styles.confirmBtn, onPress: handleAdjustBalance },
                            React.createElement(Text, { style: styles.confirmBtnText }, "Simpan")
                        )
                    )
                )
            )
        ),
        React.createElement(Modal, { visible: showManualModal, transparent: true, animationType: "fade" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(Text, { style: styles.modalTitle }, "Catat Kas Manual"),
                    React.createElement(View, { style: styles.typeToggle },
                        React.createElement(TouchableOpacity, { 
                            style: [styles.typeBtn, manualType === 'TOPUP' && styles.topupActive],
                            onPress: function() { setManualType('TOPUP'); }
                        },
                            React.createElement(Text, { style: [styles.typeBtnText, manualType === 'TOPUP' && styles.activeTypeText] }, "TOP UP (Masuk)")
                        ),
                        React.createElement(TouchableOpacity, { 
                            style: [styles.typeBtn, manualType === 'SPEND' && styles.spendActive],
                            onPress: function() { setManualType('SPEND'); }
                        },
                            React.createElement(Text, { style: [styles.typeBtnText, manualType === 'SPEND' && styles.activeTypeText] }, "KELUAR")
                        )
                    ),
                    React.createElement(TextInput, {
                        style: styles.input,
                        placeholder: "Rp 0",
                        keyboardType: "numeric",
                        value: manualAmount,
                        onChangeText: setManualAmount
                    }),
                    React.createElement(TextInput, {
                        style: [styles.input, { fontSize: 14, height: 60, textAlign: 'left' }],
                        placeholder: "Keterangan (misal: Beli Bensin)",
                        value: manualDesc,
                        onChangeText: setManualDesc,
                        multiline: true
                    }),
                    React.createElement(View, { style: styles.modalActions },
                        React.createElement(TouchableOpacity, { style: styles.cancelBtn, onPress: function() { setShowManualModal(false); } },
                            React.createElement(Text, { style: styles.cancelBtnText }, "Batal")
                        ),
                        React.createElement(TouchableOpacity, { style: styles.confirmBtn, onPress: handleManualTransaction },
                            React.createElement(Text, { style: styles.confirmBtnText }, "Simpan")
                        )
                    )
                )
            )
        ),
        React.createElement(Modal, { visible: showEditTxModal, transparent: true, animationType: "fade" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(Text, { style: styles.modalTitle }, "Edit Transaksi"),
                    React.createElement(View, { style: styles.typeToggle },
                        React.createElement(TouchableOpacity, { 
                            style: [styles.typeBtn, editTxType === 'TOPUP' && styles.topupActive],
                            onPress: function() { setEditTxType('TOPUP'); }
                        },
                            React.createElement(Text, { style: [styles.typeBtnText, editTxType === 'TOPUP' && styles.activeTypeText] }, "MASUK")
                        ),
                        React.createElement(TouchableOpacity, { 
                            style: [styles.typeBtn, editTxType === 'SPEND' && styles.spendActive],
                            onPress: function() { setEditTxType('SPEND'); }
                        },
                            React.createElement(Text, { style: [styles.typeBtnText, editTxType === 'SPEND' && styles.activeTypeText] }, "KELUAR")
                        )
                    ),
                    React.createElement(TextInput, {
                        style: styles.input,
                        placeholder: "Rp 0",
                        keyboardType: "numeric",
                        value: editTxAmount,
                        onChangeText: setEditTxAmount
                    }),
                    React.createElement(TextInput, {
                        style: [styles.input, { fontSize: 14, height: 60, textAlign: 'left' }],
                        placeholder: "Keterangan",
                        value: editTxDesc,
                        onChangeText: setEditTxDesc,
                        multiline: true
                    }),
                    React.createElement(View, { style: styles.modalActions },
                        React.createElement(TouchableOpacity, { style: styles.cancelBtn, onPress: function() {
                            setShowEditTxModal(false);
                            setEditingTx(null);
                        } },
                            React.createElement(Text, { style: styles.cancelBtnText }, "Batal")
                        ),
                        React.createElement(TouchableOpacity, { style: styles.confirmBtn, onPress: handleUpdateTransaction },
                            React.createElement(Text, { style: styles.confirmBtnText }, "Simpan")
                        )
                    )
                )
            )
        )
    );
}

var styles = StyleSheet.create({
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
    txActions: { flexDirection: 'row', marginLeft: 12, alignItems: 'center' },
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    modalSub: { fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 20 },
    input: { backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, fontSize: 20, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    modalActions: { flexDirection: 'row' },
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
