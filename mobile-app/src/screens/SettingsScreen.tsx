import * as React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var StyleSheet = RN.StyleSheet;
var Switch = RN.Switch;
var ActivityIndicator = RN.ActivityIndicator;
var ScrollView = RN.ScrollView;
var Alert = RN.Alert;
var Platform = RN.Platform;
var useWindowDimensions = RN.useWindowDimensions;
var Animated = RN.Animated;
var Modal = RN.Modal;
var TextInput = RN.TextInput;
var StatusBar = RN.StatusBar;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as PrinterLib from '../lib/PrinterManager';
var PrinterManager = PrinterLib.PrinterManager;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;
import CashierSessionModal from '../components/CashierSessionModal';
import ConfirmExitModal from '../components/ConfirmExitModal';
import StatusModal from '../components/StatusModal';
import * as Lucide from 'lucide-react-native';
var ChevronLeft = Lucide.ChevronLeft;
var ChevronRight = Lucide.ChevronRight;
var Printer = Lucide.Printer;
var Store = Lucide.Store;
var Users = Lucide.Users;
var Monitor = Lucide.Monitor;
var ShoppingCart = Lucide.ShoppingCart;
var LogOut = Lucide.LogOut;
var Bell = Lucide.Bell;
var Info = Lucide.Info;
var Trash2 = Lucide.Trash2;
var RefreshCw = Lucide.RefreshCw;
var Bluetooth = Lucide.Bluetooth;
var Clock = Lucide.Clock;
var Wifi = Lucide.Wifi;
var WifiOff = Lucide.WifiOff;
var Cloud = Lucide.Cloud;
var Database = Lucide.Database;
var CheckCircle2 = Lucide.CheckCircle2;
var XCircle = Lucide.XCircle;
var X = Lucide.X;
var BarChart3 = Lucide.BarChart3;
var Lock = Lucide.Lock;
var Pencil = Lucide.Pencil;
var Scissors = Lucide.Scissors;
var RefreshCw = Lucide.RefreshCw;
var X = Lucide.X;
var ChevronRight = Lucide.ChevronRight;
import SalesReportModal from '../components/SalesReportModal';
import * as OfflineLib from '../lib/OfflineService';
var OfflineService = OfflineLib.OfflineService;

var SettingItem = React.memo(function(props: any) {
    var Icon = props.icon;
    var label = props.label;
    var subtitle = props.subtitle;
    var value = props.value;
    var onToggle = props.onToggle;
    var onPress = props.onPress;
    var type = props.type || 'navigate';
    var isSmallDevice = props.isSmallDevice;

    return React.createElement(TouchableOpacity, {
        style: [styles.settingItem, isSmallDevice && { padding: 10 }],
        onPress: onPress,
        disabled: type === 'switch',
        activeOpacity: 0.6
    },
        React.createElement(View, { style: [styles.settingIconContainer, isSmallDevice && { width: 34, height: 34, borderRadius: 10 }] },
            React.createElement(Icon, { size: isSmallDevice ? 18 : 20, color: "#6b7280" })
        ),
        React.createElement(View, { style: styles.settingContent },
            React.createElement(Text, { style: [styles.settingLabel, isSmallDevice && { fontSize: 13 }] }, label),
            subtitle ? React.createElement(Text, { style: [styles.settingSubtitleText, isSmallDevice && { fontSize: 11 }] }, subtitle) : null
        ),
        type === 'switch' ? React.createElement(Switch, {
            value: value,
            onValueChange: onToggle,
            trackColor: { false: '#e5e7eb', true: '#fb923c' },
            thumbColor: value ? '#fff' : '#fff',
            ios_backgroundColor: "#e5e7eb",
            style: isSmallDevice ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : undefined
        }) : React.createElement(ChevronRight, { size: isSmallDevice ? 16 : 18, color: "#d1d5db" })
    );
});

export default function SettingsScreen() {
    var navigation = useNavigation();
    var dimensions = useWindowDimensions();
    var width = dimensions.width;
    var height = dimensions.height;
    var isLandscape = width > height;
    var isSmallDevice = width < 380;

    var statePosFlow = React.useState('table');
    var posFlow = statePosFlow[0];
    var setPosFlow = statePosFlow[1];

    var stateLoading = React.useState(false);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var loadingRef = React.useRef(true);
    
    React.useEffect(function() {
        loadingRef.current = loading;
    }, [loading]);

    var stateIsScanning = React.useState(false);
    var isScanning = stateIsScanning[0];
    var setIsScanning = stateIsScanning[1];

    var stateDiscoveredDevices = React.useState([] as any[]);
    var discoveredDevices = stateDiscoveredDevices[0];
    var setDiscoveredDevices = stateDiscoveredDevices[1];

    var stateSelectedPrinters = React.useState({ receipt: null, report: null, kitchen: null, bar: null });
    var selectedPrinters = stateSelectedPrinters[0];
    var setSelectedPrinters = stateSelectedPrinters[1];

    var stateConfiguringPrinterType = React.useState('receipt');
    var configuringPrinterType = stateConfiguringPrinterType[0];
    var setConfiguringPrinterType = stateConfiguringPrinterType[1];

    var stateShowScanModal = React.useState(false);
    var showScanModal = stateShowScanModal[0];
    var setShowScanModal = stateShowScanModal[1];

    var stateReceiptPrintMode = React.useState('manual');
    var receiptPrintMode = stateReceiptPrintMode[0];
    var setReceiptPrintMode = stateReceiptPrintMode[1];
    
    var session = useSession();
    var isAdmin = session.isAdmin;
    var currentSession = session.currentSession;
    var isSessionActive = session.isSessionActive;
    var checkSession = session.checkSession;
    var requireMandatorySession = session.requireMandatorySession;
    var currentBranchId = session.currentBranchId;
    var sessionSettings = session.storeSettings;
    var branchName = session.branchName;
    var branchAddress = session.branchAddress;
    var branchPhone = session.branchPhone;
    var userName = session.userName;

    var stateShowSessionModal = React.useState(false);
    var showSessionModal = stateShowSessionModal[0];
    var setShowSessionModal = stateShowSessionModal[1];

    var stateSessionMode = React.useState('open');
    var sessionMode = stateSessionMode[0];
    var setSessionMode = stateSessionMode[1];

    var stateShowLogoutModal = React.useState(false);
    var showLogoutModal = stateShowLogoutModal[0];
    var setShowLogoutModal = stateShowLogoutModal[1];

    var stateShowPasswordModal = React.useState(false);
    var showPasswordModal = stateShowPasswordModal[0];
    var setShowPasswordModal = stateShowPasswordModal[1];

    var stateShowReportModal = React.useState(false);
    var showReportModal = stateShowReportModal[0];
    var setShowReportModal = stateShowReportModal[1];

    var statePasswordData = React.useState({ new: '', confirm: '' });
    var passwordData = statePasswordData[0];
    var setPasswordData = statePasswordData[1];

    var stateUpdatingPassword = React.useState(false);
    var updatingPassword = stateUpdatingPassword[0];
    var setUpdatingPassword = stateUpdatingPassword[1];

    var stateShowShiftWarningModal = React.useState({ visible: false, message: '' });
    var showShiftWarningModal = stateShowShiftWarningModal[0];
    var setShowShiftWarningModal = stateShowShiftWarningModal[1];

    var statePreparationDuration = React.useState(15);
    var preparationDuration = statePreparationDuration[0];
    var setPreparationDuration = statePreparationDuration[1];

    var stateOfflineQueueCount = React.useState(0);
    var offlineQueueCount = stateOfflineQueueCount[0];
    var setOfflineQueueCount = stateOfflineQueueCount[1];

    var stateIsSyncing = React.useState(false);
    var isSyncing = stateIsSyncing[0];
    var setIsSyncing = stateIsSyncing[1];

    var stateForcedOffline = React.useState(false);
    var forcedOffline = stateForcedOffline[0];
    var setForcedOffline = stateForcedOffline[1];

    var statePrinterStatus = React.useState({});
    var printerStatus = statePrinterStatus[0];
    var setPrinterStatus = statePrinterStatus[1];

    var stateEnableReceipt = React.useState(true);
    var enableReceipt = stateEnableReceipt[0];
    var setEnableReceipt = stateEnableReceipt[1];

    var stateEnableKitchen = React.useState(true);
    var enableKitchen = stateEnableKitchen[0];
    var setEnableKitchen = stateEnableKitchen[1];

    var stateEnableBar = React.useState(true);
    var enableBar = stateEnableBar[0];
    var setEnableBar = stateEnableBar[1];

    var stateShowClearCacheConfirm = React.useState(false);
    var showClearCacheConfirm = stateShowClearCacheConfirm[0];
    var setShowClearCacheConfirm = stateShowClearCacheConfirm[1];

    var stateEnableHoldPrinting = React.useState(false);
    var enableHoldPrinting = stateEnableHoldPrinting[0];
    var setEnableHoldPrinting = stateEnableHoldPrinting[1];

    var stateAutoPreviewReceipt = React.useState(false);
    var autoPreviewReceipt = stateAutoPreviewReceipt[0];
    var setAutoPreviewReceipt = stateAutoPreviewReceipt[1];

    var stateEnableTogelAutoPrint = React.useState(true);
    var enableTogelAutoPrint = stateEnableTogelAutoPrint[0];
    var setEnableTogelAutoPrint = stateEnableTogelAutoPrint[1];

    var stateShowManualModal = React.useState(false);
    var showManualModal = stateShowManualModal[0];
    var setShowManualModal = stateShowManualModal[1];

    var stateManualType = React.useState('receipt');
    var manualType = stateManualType[0];
    var setManualType = stateManualType[1];

    var stateManualAddress = React.useState('');
    var manualAddress = stateManualAddress[0];
    var setManualAddress = stateManualAddress[1];

    var stateFullSettings = React.useState(null);
    var fullSettings = stateFullSettings[0];
    var setFullSettings = stateFullSettings[1];

    var stateStatusModal = React.useState({ visible: false, title: '', message: '', type: 'success' });
    var statusModal = stateStatusModal[0];
    var setStatusModal = stateStatusModal[1];

    var stateToast = React.useState<{visible: boolean, message: string, type: string, submessage?: string}>({ visible: false, message: '', type: 'success' });
    var toast = stateToast[0];
    var setToast = stateToast[1];

    var toastOpacity = React.useRef(new Animated.Value(0)).current;
    var toastTranslateY = React.useRef(new Animated.Value(-20)).current;

    var hideToast = function() {
        Animated.parallel([
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(toastTranslateY, { toValue: -20, duration: 300, useNativeDriver: true })
        ]).start(function() { setToast(function(prev) { return Object.assign({}, prev, { visible: false }); }); });
    };

    var showToast = function(message: string, submessage?: string, type?: string) {
        if (!type) type = 'success';
        setToast({ visible: true, message: message, submessage: submessage, type: type });
        Animated.parallel([
            Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(toastTranslateY, { toValue: 0, duration: 300, useNativeDriver: true })
        ]).start();

        setTimeout(function() {
            hideToast();
        }, 4000);
    };

    var loadOfflineCount = function() {
        return OfflineService.getOfflineQueue().then(function(queue) {
            setOfflineQueueCount(queue.length);
        });
    };

    var loadSettings = function() {
        var failsafeTimeout = setTimeout(function() {
            if (loadingRef.current) {
                setLoading(false);
            }
        }, 5000);

        var queryPromise;
        if (sessionSettings) {
            setFullSettings(sessionSettings);
            setPosFlow(sessionSettings.enable_table_management ? 'table' : 'direct');
            if (sessionSettings.preparation_duration_minutes != null) {
                setPreparationDuration(sessionSettings.preparation_duration_minutes);
            }
            queryPromise = Promise.resolve();
        } else {
            queryPromise = supabase.from('store_settings').select('*').eq('id', 1).maybeSingle().then(function(res) {
                if (res.data) {
                    setFullSettings(res.data);
                    setPosFlow(res.data.enable_table_management ? 'table' : 'direct');
                }
            });
        }

        return queryPromise.then(function() {
            return Promise.all([
                AsyncStorage.getItem('pos_flow'),
                PrinterManager.getSelectedPrinter('receipt')['catch'](function() { return null; }),
                PrinterManager.getSelectedPrinter('report')['catch'](function() { return null; }),
                OfflineService.getForcedOfflineMode()['catch'](function() { return false; }),
                AsyncStorage.getItem('auto_print')['catch'](function() { return 'true'; }),
                AsyncStorage.getItem('post_payment_receipt_mode')['catch'](function() { return null; }),
                AsyncStorage.getItem('enable_receipt_printing')['catch'](function() { return 'true'; }),
                PrinterManager.getSelectedPrinter('kitchen')['catch'](function() { return null; }),
                PrinterManager.getSelectedPrinter('bar')['catch'](function() { return null; }),
                AsyncStorage.getItem('enable_kitchen_printing')['catch'](function() { return 'true'; }),
                AsyncStorage.getItem('enable_bar_printing')['catch'](function() { return 'true'; }),
                AsyncStorage.getItem('enable_hold_printing')['catch'](function() { return 'false'; }),
                AsyncStorage.getItem('auto_preview_receipt')['catch'](function() { return null; }),
                AsyncStorage.getItem('auto_print')['catch'](function() { return 'true'; })
            ]);
        }).then(function(results) {
            var savedFlow = results[0];
            var savedReceipt = results[1];
            var savedReport = results[2];
            var isForced = results[3];
            var savedAutoPrint = results[4];
            var savedReceiptPrintMode = results[5];
            var savedEnableReceipt = results[6];
            var savedKitchen = results[7];
            var savedBar = results[8];
            var savedEnableKitchen = results[9];
            var savedEnableBar = results[10];
            var savedEnableHoldPrintingVal = results[11];
            var savedAutoPreview = results[12];
            var savedTogelAutoPrint = results[13];

            if (savedFlow) setPosFlow(savedFlow);
            setSelectedPrinters({
                receipt: savedReceipt,
                report: savedReport,
                kitchen: savedKitchen,
                bar: savedBar
            });
            
            setEnableReceipt(savedEnableReceipt !== 'false');
            if (savedEnableKitchen !== null) setEnableKitchen(savedEnableKitchen === 'true');
            if (savedEnableBar !== null) setEnableBar(savedEnableBar === 'true');
            if (savedEnableHoldPrintingVal !== null) setEnableHoldPrinting(savedEnableHoldPrintingVal === 'true');
            if (savedAutoPreview !== null) setAutoPreviewReceipt(savedAutoPreview === 'true');
            if (savedTogelAutoPrint !== null) setEnableTogelAutoPrint(savedTogelAutoPrint !== 'false');
            setForcedOffline(!!isForced);
            setReceiptPrintMode(
                savedReceiptPrintMode === 'auto' || savedReceiptPrintMode === 'manual'
                    ? savedReceiptPrintMode
                    : (savedAutoPrint === 'true' || savedTogelAutoPrint !== 'false' ? 'auto' : 'manual')
            );

            setLoading(false);
            clearTimeout(failsafeTimeout);
            return loadOfflineCount();
        })['catch'](function(e) {
            console.error('[SettingsScreen] loadSettings Error:', e);
            setLoading(false);
            clearTimeout(failsafeTimeout);
        });
    };

    React.useEffect(function() {
        loadSettings();
    }, []);

    var updatePrinterStatuses = React.useCallback(function() {
        var statuses = {};
        var receipt = selectedPrinters.receipt;
        var report = selectedPrinters.report;
        var kitchen = selectedPrinters.kitchen;
        var bar = selectedPrinters.bar;
        if (receipt) statuses[receipt] = PrinterManager.getConnectionStatus(receipt);
        if (report) statuses[report] = PrinterManager.getConnectionStatus(report);
        if (kitchen) statuses[kitchen] = PrinterManager.getConnectionStatus(kitchen);
        if (bar) statuses[bar] = PrinterManager.getConnectionStatus(bar);
        setPrinterStatus(statuses);
    }, [selectedPrinters]);

    React.useEffect(function() {
        updatePrinterStatuses();
        var interval = setInterval(updatePrinterStatuses, 5000);
        return function() { clearInterval(interval); };
    }, [updatePrinterStatuses]);

    var handleRefreshAllPrinters = function() {
        var receipt = selectedPrinters.receipt;
        var report = selectedPrinters.report;
        var kitchen = selectedPrinters.kitchen;
        var bar = selectedPrinters.bar;
        if (!receipt && !report && !kitchen && !bar) {
            showToast('Tidak ada printer', 'Tambahkan printer terlebih dahulu', 'info');
            return;
        }

        showToast('Memperbarui Status...', 'Sedang mengecek koneksi printer', 'info');
        
        var promises = [];
        if (receipt) promises.push(PrinterManager.checkConnection(receipt)['catch'](function() {}));
        if (report) promises.push(PrinterManager.checkConnection(report)['catch'](function() {}));
        if (kitchen) promises.push(PrinterManager.checkConnection(kitchen)['catch'](function() {}));
        if (bar) promises.push(PrinterManager.checkConnection(bar)['catch'](function() {}));
        
        return Promise.all(promises).then(function() {
            updatePrinterStatuses();
            showToast('Selesai', 'Status printer telah diperbarui', 'success');
        });
    };

    var handleReconnect = function(mac) {
        return PrinterManager.checkConnection(mac).then(function(success) {
            updatePrinterStatuses();
            if (!success) {
                showToast('Gagal terhubung', 'Pastikan printer aktif dan Bluetooth nyala', 'error');
            } else {
                showToast('Berhasil terhubung', 'Printer siap digunakan', 'success');
            }
        });
    };

    var startScan = function(type) {
        setIsScanning(true);
        setShowScanModal(true);
        setConfiguringPrinterType(type);
        
        return PrinterManager.getPairedPrinters().then(function(paired) {
            if (paired && paired.length > 0) {
                var formattedPaired = paired.map(function(p) {
                    var id = (p as any).address || (p as any).id || (p as any).inner_mac_address || (p as any).macAddress || String(Math.random());
                    return {
                        id: id,
                        name: ((p as any).name || 'Unknown') + (((p as any).name || '').indexOf('(Paired)') === -1 ? ' (Paired)' : '')
                    };
                });
                setDiscoveredDevices(formattedPaired);
            } else {
                setDiscoveredDevices([]);
            }
            
            // Do NOT use ble-plx (BLE scanner) because connecting to a BLE MAC address
            // using Classic Bluetooth SPP (BLEPrinter.connectPrinter) completely freezes
            // the Android OS Bluetooth Adapter. Users MUST pair the printer in Android Settings.
            setIsScanning(false);
        })['catch'](function(e) {
            console.log('Scan error:', e.message);
            setIsScanning(false);
        });
    };

    var selectPrinter = function(device) {
        PrinterManager.stopScan();
        setShowScanModal(false);
        setIsScanning(false);
        
        // Wait 1.5 seconds for the Android Bluetooth Adapter to fully stop scanning
        // before saving and attempting to connect. Concurrent scanning and connecting 
        // causes a complete OS Bluetooth deadlock/freeze on Android.
        return new Promise(function(resolve) { setTimeout(resolve, 1500); }).then(function() {
            return PrinterManager.saveSelectedPrinter(device.id, configuringPrinterType as any);
        }).then(function() {
            setSelectedPrinters(function(prev) {
                var next = Object.assign({}, prev);
                next[configuringPrinterType] = device.id;
                return next;
            });
            
            // Wait for the ScanModal to completely close and unmount from Android's view hierarchy
            // before showing the StatusModal. Multiple Modals in React Native Android cause freezes.
            setTimeout(function() {
                setDiscoveredDevices([]);
                var typeLabel = 'Kasir';
                if (configuringPrinterType === 'report') typeLabel = 'Laporan';
                if (configuringPrinterType === 'kitchen') typeLabel = 'Dapur';
                if (configuringPrinterType === 'bar') typeLabel = 'Bar';

                setStatusModal({
                    visible: true,
                    title: 'Printer Terpilih',
                    message: 'Printer ' + typeLabel + ': ' + (device.name || device.id) + ' berhasil dipilih.',
                    type: 'success'
                });
            }, 600);
        })['catch'](function(e) {
            setTimeout(function() {
                setStatusModal({
                    visible: true,
                    title: 'Error',
                    message: 'Gagal memilih printer: ' + e.message,
                    type: 'warning'
                });
            }, 600);
        });
    };

    var handleTestPrint = function(type) {
        if (!type) type = 'receipt';
        return PrinterManager.testPrint(type).then(function() {
            Alert.alert('Sukses', 'Test print ' + type + ' berhasil dikirim.');
        })['catch'](function(e) {
            var msg = (e && e.message) || '';
            if (msg.indexOf('pairing') !== -1 || msg.indexOf('find the specified') !== -1) {
                Alert.alert(
                    'Gagal Mencetak',
                    'Printer belum terpasang di sistem.\n\nLangkah Solusi:\n1. Buka Pengaturan HP > Bluetooth.\n2. Cari dan "Pasangkan/Pair" printer Anda.\n3. Kembali ke sini dan coba lagi.'
                );
            } else {
                Alert.alert('Error', 'Gagal mencetak test: ' + msg);
            }
        });
    };

    var handleManualSave = function() {
        if (!manualAddress.trim()) return;
        var cleanMAC = manualAddress.trim().toUpperCase();
        return PrinterManager.saveSelectedPrinter(cleanMAC, manualType as any).then(function() {
            setSelectedPrinters(function(prev) {
                var next = Object.assign({}, prev);
                next[manualType] = cleanMAC;
                return next;
            });
            setShowManualModal(false);
            setManualAddress('');
            Alert.alert('Sukses', 'MAC Address berhasil disimpan.');
        })['catch'](function(e) {
            Alert.alert('Error', 'Gagal menyimpan MAC Address');
        });
    };

    var toggleHoldPrinting = function(val) {
        setEnableHoldPrinting(val);
        return AsyncStorage.setItem('enable_hold_printing', val ? 'true' : 'false').then(function() {
            showToast(val ? 'Cetak Hold diaktifkan' : 'Cetak Hold dinonaktifkan');
        });
    };

    var toggleAutoPreview = function(val) {
        setAutoPreviewReceipt(val);
        return AsyncStorage.setItem('auto_preview_receipt', val ? 'true' : 'false').then(function() {
            showToast(val ? 'Pratinjau Otomatis Aktif' : 'Pratinjau Otomatis Mati');
        });
    };

    var toggleTogelAutoPrint = function(val) {
        setEnableTogelAutoPrint(val);
        setReceiptPrintMode(val ? 'auto' : 'manual');
        return Promise.all([
            AsyncStorage.setItem('auto_print', val ? 'true' : 'false'),
            AsyncStorage.setItem('post_payment_receipt_mode', val ? 'auto' : 'manual')
        ]).then(function() {
            showToast(val ? 'Cetak Otomatis Kasir Aktif' : 'Cetak Otomatis Kasir Mati');
        });
    };

    var handleForgetPrinter = function(type) {
        var typeLabel = type === 'receipt' ? 'Kasir' : 'Laporan';
        Alert.alert(
            'Hapus Printer ' + typeLabel,
            'Apakah Anda yakin ingin menghapus printer ' + typeLabel + '?',
            [
                { text: "Batal", style: "cancel" },
                {
                    text: "Hapus",
                    style: "destructive",
                    onPress: function() {
                        return PrinterManager.forgetSelectedPrinter(type).then(function() {
                            setSelectedPrinters(function(prev) {
                                var next = Object.assign({}, prev);
                                next[type] = null;
                                return next;
                            });
                            Alert.alert('Sukses', 'Printer berhasil dihapus.');
                        });
                    }
                }
            ]
        );
    };

    var togglePrinterEnable = function(type, value) {
        var promise;
        if (type === 'receipt') {
            setEnableReceipt(value);
            promise = AsyncStorage.setItem('enable_receipt_printing', value.toString());
        } else if (type === 'kitchen') {
            setEnableKitchen(value);
            promise = AsyncStorage.setItem('enable_kitchen_printing', value.toString());
        } else if (type === 'bar') {
            setEnableBar(value);
            promise = AsyncStorage.setItem('enable_bar_printing', value.toString());
        } else {
            promise = Promise.resolve();
        }
        
        return promise.then(function() {
            showToast('Printer diperbarui', '', 'info');
        })['catch'](function(e) {
            console.error('Error toggling printer:', e);
        });
    };

    var saveReceiptPrintMode = function(value) {
        setReceiptPrintMode(value);
        return Promise.all([
            AsyncStorage.setItem('post_payment_receipt_mode', value),
            AsyncStorage.setItem('auto_print', String(value === 'auto'))
        ]);
    };

    var toggleSetting = function(key, value) {
        if (!fullSettings) return;
        var nextSettings = Object.assign({}, fullSettings);
        nextSettings[key] = value;
        setFullSettings(nextSettings);
        var updateObj = {};
        updateObj[key] = value;
        return supabase.from('store_settings').update(updateObj).eq('id', 1).then(function() {
            if (checkSession) checkSession(false, true);
        })['catch'](function(e) {
            Alert.alert('Error', 'Gagal menyimpan pengaturan');
            loadSettings();
        });
    };

    var savePreparationDuration = function(minutes) {
        var clamped = Math.max(1, Math.min(120, minutes));
        setPreparationDuration(clamped);
        return supabase.from('store_settings').update({ preparation_duration_minutes: clamped }).eq('id', 1).then(function() {
            return AsyncStorage.setItem('preparation_duration_minutes', String(clamped));
        })['catch'](function(e) {
            Alert.alert('Error', 'Gagal menyimpan durasi penyiapan');
        });
    };

    var handleLogout = function() {
        if (isSessionActive && requireMandatorySession) {
            setShowShiftWarningModal({ visible: true, message: 'Anda harus menutup shift kasir terlebih dahulu.' });
            return;
        }
        setShowLogoutModal(true);
    };

    var toggleForcedOffline = function(val) {
        setForcedOffline(val);
        return OfflineService.setForcedOfflineMode(val).then(function() {
            showToast(val ? "Mode Offline Aktif" : "Mode Otomatis Aktif", '', 'info');
        });
    };

    var confirmLogout = function() {
        setShowLogoutModal(false);
        return supabase.auth.signOut().then(function() {})['catch'](function() {});
    };

    var handleSyncOffline = function() {
        if (offlineQueueCount === 0) {
            showToast('Tidak ada transaksi untuk disinkronisasi', '', 'info');
            return;
        }
        setIsSyncing(true);
        return OfflineService.syncQueue().then(function(result) {
            return loadOfflineCount().then(function() {
                if (result.failed === 0) {
                    showToast('Berhasil sinkronisasi ' + result.success + ' transaksi');
                } else {
                    Alert.alert('Sinkronisasi Selesai Sebagian', 'Gagal: ' + result.failed);
                }
            });
        })['catch'](function(error) {
            showToast(error.message || 'Gagal sinkronisasi', '', 'error');
        }).finally(function() {
            setIsSyncing(false);
        });
    };

    var handleClearCache = function() { setShowClearCacheConfirm(true); };
    var confirmClearCache = function() {
        setShowClearCacheConfirm(false);
        return AsyncStorage.clear().then(function() {
            setStatusModal({ visible: true, title: 'Cache Bersih', message: 'Silakan buka ulang aplikasi.', type: 'success' });
        })['catch'](function() {});
    };

    var handleUpdatePassword = function() {
        if (!passwordData.new || passwordData.new !== passwordData.confirm) {
            Alert.alert('Error', 'Password baru tidak cocok atau kosong');
            return;
        }
        setUpdatingPassword(true);
        return supabase.auth.updateUser({ password: passwordData.new }).then(function(res) {
            if (res.error) throw res.error;
            showToast('Password Berhasil diperbarui');
            setShowPasswordModal(false);
            setPasswordData({ new: '', confirm: '' });
        })['catch'](function(e) {
            Alert.alert('Gagal Update', e.message);
        }).finally(function() {
            setUpdatingPassword(false);
        });
    };

    var printersData = [
        { id: 'receipt', label: 'Printer Kasir (Struk)', value: selectedPrinters.receipt },
        { id: 'report', label: 'Printer Laporan (Keuangan)', value: selectedPrinters.report },
        { id: 'kitchen', label: 'Printer Dapur (Makanan)', value: selectedPrinters.kitchen },
        { id: 'bar', label: 'Printer Bar (Minuman)', value: selectedPrinters.bar }
    ];

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(StatusBar, { barStyle: "dark-content", backgroundColor: "#f8fafc" }),
        React.createElement(Modal, { visible: showManualModal, transparent: true, animationType: "fade" },
            React.createElement(TouchableOpacity, { activeOpacity: 1, style: styles.manualModalOverlay, onPress: function() { setShowManualModal(false); } },
                React.createElement(View, { style: styles.modalContentSmall },
                    React.createElement(View, { style: styles.modalHeaderSmall },
                        React.createElement(Text, { style: styles.modalTitleSmall }, "Input MAC Address"),
                        React.createElement(TouchableOpacity, { onPress: function() { setShowManualModal(false); } },
                            React.createElement(X, { size: 20, color: "#64748b" })
                        )
                    ),
                    React.createElement(View, { style: { padding: 16 } },
                        React.createElement(TextInput, {
                            style: styles.manualInput,
                            placeholder: "AA:BB:CC:DD:EE:FF",
                            value: manualAddress,
                            onChangeText: setManualAddress,
                            autoCapitalize: "characters"
                        }),
                        React.createElement(TouchableOpacity, { style: styles.saveBtnModal, onPress: handleManualSave },
                            React.createElement(Text, { style: styles.saveBtnTextModal }, "Simpan MAC Address")
                        )
                    )
                )
            )
        ),
        React.createElement(View, { style: [styles.header, isSmallDevice && { paddingVertical: 10, paddingHorizontal: 12 }] },
            React.createElement(TouchableOpacity, { onPress: function() { navigation.goBack(); }, style: styles.backButton },
                React.createElement(ChevronLeft, { size: isSmallDevice ? 24 : 28, color: "#1f2937" })
            ),
            React.createElement(Text, { style: [styles.headerTitle, isSmallDevice && { fontSize: 16 }] }, "Pengaturan"),
            React.createElement(View, { style: { position: 'absolute', right: 16 } },
                React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold' } }, "VER 1.3.1-PRO")
            )
        ),
        React.createElement(ScrollView, { contentContainerStyle: styles.scrollContent, showsVerticalScrollIndicator: false },
            React.createElement(View, { style: isLandscape ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 4 } : null },
                React.createElement(View, { style: [styles.section, isLandscape && { width: '48.5%' }] },
                    React.createElement(Text, { style: styles.sectionTitle }, "Toko & Profil"),
                    React.createElement(View, { style: styles.card },
                        React.createElement(SettingItem, { 
                            icon: Store, label: "Pengaturan Toko", subtitle: "Nama, alamat & telp outlet",
                            onPress: function() { navigation.navigate('StoreSettings' as never); }, isSmallDevice: isSmallDevice
                        }),
                        React.createElement(View, { style: styles.divider }),
                        React.createElement(SettingItem, { 
                            icon: Users, label: "Daftar Pelayan", subtitle: "Kelola data karyawan & pelayan",
                            onPress: function() { navigation.navigate('EmployeeSettings' as never); }, isSmallDevice: isSmallDevice
                        })
                    )
                ),
                React.createElement(View, { style: [styles.section, isLandscape && { width: '48.5%' }] },
                    React.createElement(Text, { style: styles.sectionTitle }, "Operasional Kasir"),
                    React.createElement(View, { style: styles.card },
                        React.createElement(SettingItem, { 
                            icon: Lock, label: "Sesi Kasir Wajib", subtitle: "Wajib buka shift sebelum transaksi",
                            type: "switch", value: (fullSettings ? fullSettings.require_mandatory_session : true),
                            onToggle: function(val) { toggleSetting('require_mandatory_session', val); }, isSmallDevice: isSmallDevice
                        }),
                        React.createElement(View, { style: styles.divider }),
                        React.createElement(View, { style: styles.settingItem },
                            React.createElement(View, { style: styles.settingIconContainer },
                                React.createElement(Clock, { size: isSmallDevice ? 18 : 20, color: "#6b7280" })
                            ),
                            React.createElement(View, { style: styles.settingContent },
                                React.createElement(Text, { style: [styles.settingLabel, isSmallDevice && { fontSize: 13 }] }, "Durasi Penyiapan"),
                                React.createElement(Text, { style: [styles.settingSubtitleText, isSmallDevice && { fontSize: 11 }] }, "Estimasi waktu siap")
                            ),
                            React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                                React.createElement(TouchableOpacity, { onPress: function() { savePreparationDuration(preparationDuration - 5); }, style: [styles.durationBtn, { marginRight: 8 }] },
                                    React.createElement(Text, { style: styles.durationBtnText }, "\u2212")
                                ),
                                React.createElement(Text, { style: styles.durationValue }, preparationDuration + "m"),
                                React.createElement(TouchableOpacity, { onPress: function() { savePreparationDuration(preparationDuration + 5); }, style: [styles.durationBtn, { marginLeft: 8 }] },
                                    React.createElement(Text, { style: styles.durationBtnText }, "+")
                                )
                            )
                        ),
                        React.createElement(View, { style: styles.divider }),
                        React.createElement(TouchableOpacity, { 
                            style: [styles.sessionBox, isSmallDevice && { padding: 10, margin: 8 }],
                            onPress: function() { setSessionMode(isSessionActive ? 'close' : 'open'); setShowSessionModal(true); }
                        },
                            React.createElement(View, { style: [styles.statusIndicator, { backgroundColor: isSessionActive ? '#22c55e' : '#ef4444' }] }),
                            React.createElement(View, { style: { flex: 1 } },
                                React.createElement(Text, { style: [styles.sessionStatusText, isSmallDevice && { fontSize: 13 }] }, isSessionActive ? 'Shift Aktif' : 'Shift Belum Dibuka'),
                                React.createElement(Text, { style: [styles.sessionActionText, isSmallDevice && { fontSize: 11 }] }, isSessionActive ? 'Ketuk untuk Tutup' : 'Ketuk untuk Buka')
                            ),
                            React.createElement(ChevronRight, { size: isSmallDevice ? 14 : 16, color: "#94a3b8" })
                        )
                    )
                ),
                React.createElement(View, { style: [styles.section, isLandscape && { width: '48.5%' }] },
                    React.createElement(Text, { style: styles.sectionTitle }, "Koneksi & Offline"),
                    React.createElement(View, { style: styles.card },
                        React.createElement(SettingItem, { 
                            icon: WifiOff, label: "Paksa Mode Offline", subtitle: "Gunakan penyimpanan lokal",
                            type: "switch", value: forcedOffline, onToggle: toggleForcedOffline, isSmallDevice: isSmallDevice
                        }),
                        React.createElement(View, { style: styles.divider }),
                        React.createElement(View, { style: [styles.settingItem, { paddingBottom: 8 }] },
                            React.createElement(View, { style: [styles.settingIconContainer, { backgroundColor: offlineQueueCount > 0 ? '#fff7ed' : '#f1f5f9' }] },
                                offlineQueueCount > 0 ? React.createElement(WifiOff, { size: 20, color: "#ea580c" }) : React.createElement(Wifi, { size: 20, color: "#22c55e" })
                            ),
                            React.createElement(View, { style: styles.settingContent },
                                React.createElement(Text, { style: styles.settingLabel }, "Antrean Offline"),
                                React.createElement(Text, { style: { fontSize: 11, color: offlineQueueCount > 0 ? '#ea580c' : '#94a3b8' } }, offlineQueueCount + " transaksi")
                            ),
                            isSyncing ? React.createElement(ActivityIndicator, { size: "small", color: "#ea580c" }) : React.createElement(TouchableOpacity, { 
                                style: [styles.scanBtnSmall, { backgroundColor: offlineQueueCount > 0 ? '#ea580c' : '#94a3b8' }],
                                onPress: handleSyncOffline, disabled: offlineQueueCount === 0
                            }, React.createElement(Text, { style: { color: 'white', fontSize: 11, fontWeight: 'bold' } }, "Sinkron")),
                        )
                    )
                ),
                React.createElement(View, { style: [styles.section, isLandscape && { width: '100%' }] },
                    React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 } },
                        React.createElement(Text, { style: styles.sectionTitle }, "Printer Bluetooth"),
                        React.createElement(TouchableOpacity, { onPress: handleRefreshAllPrinters },
                            React.createElement(Text, { style: { fontSize: 11, color: '#ea580c', fontWeight: 'bold' } }, "Perbarui Status")
                        )
                    ),
                    React.createElement(View, { style: styles.card },
                        React.createElement(View, { style: isLandscape ? { flexDirection: 'row', flexWrap: 'wrap' } : null },
                            printersData.map(function(printer, index) {
                                return React.createElement(View, { key: printer.id, style: isLandscape ? { width: '50%' } : null },
                                    React.createElement(View, { style: styles.printerItem },
                                        React.createElement(View, { style: styles.printerHeader },
                                            React.createElement(View, { style: styles.printerStatusRow },
                                                React.createElement(Bluetooth, { size: 20, color: printer.value ? (printerStatus[printer.value] === 'connected' ? '#22c55e' : '#ea580c') : '#9ca3af' }),
                                                React.createElement(View, { style: { marginLeft: 12, flex: 1 } },
                                                    React.createElement(Text, { style: { fontSize: 13, fontWeight: 'bold' } }, printer.label),
                                                    React.createElement(Text, { style: { fontSize: 12, color: '#94a3b8' }, numberOfLines: 1 }, printer.value || 'Belum ada')
                                                )
                                            ),
                                            React.createElement(Switch, {
                                                value: printer.id === 'receipt' ? enableReceipt : (printer.id === 'kitchen' ? enableKitchen : (printer.id === 'bar' ? enableBar : true)),
                                                onValueChange: function(val) { togglePrinterEnable(printer.id, val); },
                                                disabled: printer.id === 'report',
                                                trackColor: { false: '#e5e7eb', true: '#fb923c' },
                                                style: { transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }
                                            })
                                        ),
                                        React.createElement(View, { style: styles.printerActions },
                                            printer.value ? React.createElement(TouchableOpacity, { onPress: function() { handleReconnect(printer.value); } }, React.createElement(RefreshCw, { size: 14, color: "#3b82f6" })) : null,
                                            printer.value ? React.createElement(TouchableOpacity, { onPress: function() { handleTestPrint(printer.id); } }, React.createElement(Printer, { size: 14, color: "#ea580c" })) : null,
                                            printer.value ? React.createElement(TouchableOpacity, { style: styles.deleteBtnSmall, onPress: function() { handleForgetPrinter(printer.id); } }, React.createElement(Text, { style: { color: '#fff', fontSize: 10 } }, "Hapus")) : null,
                                            React.createElement(TouchableOpacity, { 
                                                style: [styles.scanBtnSmall, { backgroundColor: '#64748b' }],
                                                onPress: function() { setManualType(printer.id); setManualAddress(printer.value || ''); setShowManualModal(true); }
                                            }, React.createElement(Text, { style: { color: '#fff', fontSize: 10 } }, "Manual")),
                                            React.createElement(TouchableOpacity, { 
                                                style: [styles.scanBtnSmall, isScanning && configuringPrinterType === printer.id && { backgroundColor: '#94a3b8' }],
                                                onPress: function() { startScan(printer.id); },
                                                disabled: isScanning
                                            }, 
                                                isScanning && configuringPrinterType === printer.id ? 
                                                    React.createElement(ActivityIndicator, { size: "small", color: "#fff", style: { scaleX: 0.7, scaleY: 0.7 } }) : 
                                                    React.createElement(Text, { style: { color: '#fff', fontSize: 10 } }, "Scan")
                                            )
                                        )
                                    )
                                );
                            })
                        )
                    )
                ),
                React.createElement(View, { style: [styles.section, isLandscape && { width: '100%' }] },
                    React.createElement(Text, { style: styles.sectionTitle }, "Fitur Cetak Togel"),
                    React.createElement(View, { style: styles.card },
                        React.createElement(SettingItem, { 
                            icon: Printer, label: "Cetak Otomatis Kasir", subtitle: "Cetak struk langsung setelah bayar",
                            type: "switch", value: enableTogelAutoPrint,
                            onToggle: toggleTogelAutoPrint, isSmallDevice: isSmallDevice
                        }),
                        React.createElement(View, { style: styles.divider }),
                        React.createElement(SettingItem, { 
                            icon: Clock, label: "Cetak Transaksi HOLD", subtitle: "Cetak struk saat pesanan di-hold",
                            type: "switch", value: enableHoldPrinting,
                            onToggle: toggleHoldPrinting, isSmallDevice: isSmallDevice
                        })
                    )
                )
            ),
            React.createElement(TouchableOpacity, { onPress: handleLogout, style: styles.logoutBtn },
                React.createElement(LogOut, { size: 18, color: "#dc2626" }),
                React.createElement(Text, { style: styles.logoutBtnText }, "Keluar Akun")
            ),
            React.createElement(View, { style: { height: 60 } })
        ),
        React.createElement(CashierSessionModal, {
            visible: showSessionModal,
            onClose: function() { setShowSessionModal(false); },
            mode: sessionMode,
            session: currentSession,
            onComplete: checkSession,
            currentBranchId: currentBranchId
        }),
        React.createElement(ConfirmExitModal, {
            visible: showLogoutModal,
            onClose: function() { setShowLogoutModal(false); },
            onConfirm: confirmLogout,
            title: "Konfirmasi Keluar",
            message: "Apakah Anda yakin ingin keluar?",
            confirmText: "Keluar"
        }),
        React.createElement(SalesReportModal, {
            visible: showReportModal,
            onClose: function() { setShowReportModal(false); },
            currentBranchId: (currentBranchId ? String(currentBranchId) : ''),
            branchName: branchName || 'WINNY POS',
            branchAddress: branchAddress,
            branchPhone: branchPhone,
            userName: userName || 'Kasir',
            storeSettings: sessionSettings
        }),
        React.createElement(StatusModal, {
            visible: statusModal.visible,
            onClose: function() { setStatusModal(function(prev) { return Object.assign({}, prev, { visible: false }); }); },
            title: statusModal.title,
            message: statusModal.message,
            type: statusModal.type
        }),

        React.createElement(Modal, { visible: showScanModal, transparent: true, animationType: "slide" },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: [styles.modalContent, { maxHeight: '80%' }] },
                    React.createElement(View, { style: styles.modalHeader },
                        React.createElement(View, null,
                            React.createElement(Text, { style: styles.modalTitle }, "Pilih Printer Bluetooth"),
                            React.createElement(Text, { style: { fontSize: 12, color: '#64748b' } }, 
                                isScanning ? "Sedang memindai perangkat..." : "Pilih perangkat dari daftar di bawah"
                            )
                        ),
                        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                            React.createElement(TouchableOpacity, { 
                                onPress: function() { startScan(configuringPrinterType); },
                                style: { marginRight: 15 }
                            },
                                React.createElement(RefreshCw, { size: 20, color: "#ea580c" })
                            ),
                            React.createElement(TouchableOpacity, { onPress: function() { PrinterManager.stopScan(); setShowScanModal(false); setIsScanning(false); setDiscoveredDevices([]); } },
                                React.createElement(X, { size: 24, color: "#9ca3af" })
                            )
                        )
                    ),
                    discoveredDevices.length > 0 && React.createElement(Text, { style: { fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: '600' } }, 
                        "Ditemukan " + discoveredDevices.length + " perangkat:"
                    ),
                    isScanning && discoveredDevices.length === 0 && React.createElement(View, { style: { padding: 40, alignItems: 'center' } },
                        React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" }),
                        React.createElement(Text, { style: { marginTop: 16, color: '#64748b', textAlign: 'center' } }, "Mencari perangkat bluetooth di sekitar...")
                    ),
                    React.createElement(ScrollView, { style: { maxHeight: 300, minHeight: 50 } },
                        discoveredDevices.length === 0 && !isScanning && React.createElement(Text, { style: { textAlign: 'center', color: '#94a3b8', padding: 20 } }, "Daftar Kosong"),
                        
                        discoveredDevices.map(function(device, index) {
                            return React.createElement(TouchableOpacity, { 
                                key: String(device.id || index), 
                                onPress: function() { selectPrinter(device); },
                                style: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
                            },
                                React.createElement(View, null,
                                    React.createElement(Text, { style: { fontWeight: '600', color: '#1e293b' } }, String(device.name || 'Printer')),
                                    React.createElement(Text, { style: { fontSize: 11, color: '#94a3b8' } }, String(device.id || 'No MAC'))
                                ),
                                React.createElement(ChevronRight, { size: 18, color: '#cbd5e1' })
                            );
                        }),
                        !isScanning && discoveredDevices.length === 0 && React.createElement(View, { style: { padding: 20, alignItems: 'center' } },
                            React.createElement(Text, { style: { color: '#64748b', textAlign: 'center', lineHeight: 22 } }, 
                                "Daftar Kosong?\n\n" +
                                "1. Buka Pengaturan HP > Bluetooth, cari dan \"PASANGKAN/PAIR\" printer Anda di sana.\n" +
                                "2. Pastikan GPS/Lokasi HP sudah Aktif.\n" +
                                "3. Jika sudah di-pair tapi tidak muncul, tekan ikon refresh di atas.\n\n" +
                                "Atau masukkan alamat MAC secara manual:"
                            ),
                            React.createElement(TouchableOpacity, { 
                                style: [{ backgroundColor: '#ea580c', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }, { marginTop: 15, paddingHorizontal: 30 }],
                                onPress: function() { 
                                    setShowScanModal(false);
                                    setManualType(configuringPrinterType);
                                    setShowManualModal(true);
                                }
                            },
                                React.createElement(Text, { style: { color: 'white', fontWeight: 'bold' } }, "Input MAC Manual")
                            )
                        )
                    ),
                    isScanning && React.createElement(View, { style: { padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' } },
                        React.createElement(ActivityIndicator, { size: "small", color: "#ea580c" })
                    )
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4, marginRight: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    scrollContent: { paddingTop: 8 },
    section: { marginTop: 18, paddingHorizontal: 12 },
    sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 4, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
    settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
    settingIconContainer: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    settingContent: { flex: 1, marginLeft: 12 },
    settingLabel: { fontSize: 14, fontWeight: '600', color: '#334155' },
    settingSubtitleText: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 10 },
    printerItem: { paddingVertical: 12, paddingHorizontal: 12 },
    printerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    printerStatusRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    printerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    deleteBtnSmall: { backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, marginRight: 6 },
    scanBtnSmall: { backgroundColor: '#f97316', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, marginLeft: 6 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 32, marginHorizontal: 16, padding: 18, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#fee2e2' },
    logoutBtnText: { color: '#dc2626', fontSize: 15, fontWeight: 'bold' },
    durationBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    durationBtnText: { fontSize: 18, fontWeight: 'bold', color: '#ea580c' },
    durationValue: { fontSize: 15, fontWeight: 'bold', color: '#334155', minWidth: 36, textAlign: 'center' },
    manualModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContentSmall: { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, overflow: 'hidden' },
    modalHeaderSmall: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitleSmall: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    manualInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 16, color: '#1e293b', marginBottom: 16 },
    saveBtnModal: { backgroundColor: '#ea580c', padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnTextModal: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    sessionBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8 },
    statusIndicator: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    sessionStatusText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    sessionActionText: { fontSize: 12, color: '#64748b', marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '100%', maxWidth: 500 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 15 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    modalOptionItem: { paddingVertical: 16, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalOptionText: { fontSize: 15, fontWeight: '600', color: '#334155' }
});
