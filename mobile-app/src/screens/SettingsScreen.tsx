import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, ScrollView, Alert, Platform, useWindowDimensions, Animated, Modal, TextInput, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrinterManager } from '../lib/PrinterManager';
import { Device } from 'react-native-ble-plx';
import { supabase } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import CashierSessionModal from '../components/CashierSessionModal';
import ConfirmExitModal from '../components/ConfirmExitModal';
import StatusModal from '../components/StatusModal';
import { 
    ChevronLeft, 
    ChevronRight, 
    Printer, 
    User, 
    Users,
    Monitor, 
    ShoppingCart, 
    LogOut, 
    Bell, 
    Info, 
    Trash2,
    RefreshCw,
    Bluetooth,
    Clock,
    Wifi,
    WifiOff,
    Cloud,
    Database,
    CheckCircle2,
    XCircle,
    X,
    BarChart3,
    Lock,
    Pencil,
    Store,
    Scissors
} from 'lucide-react-native';
import SalesReportModal from '../components/SalesReportModal';
import { OfflineService } from '../lib/OfflineService';

const SettingItem = React.memo(({ icon: Icon, label, subtitle, value, onToggle, onPress, type = 'navigate', isSmallDevice }: any) => (
    <TouchableOpacity 
        style={[
            styles.settingItem,
            isSmallDevice && { padding: 10 }
        ]} 
        onPress={onPress} 
        disabled={type === 'switch'}
        activeOpacity={0.6}
    >
        <View style={[
            styles.settingIconContainer,
            isSmallDevice && { width: 34, height: 34, borderRadius: 10 }
        ]}>
            <Icon size={isSmallDevice ? 18 : 20} color="#6b7280" />
        </View>
        <View style={styles.settingContent}>
            <Text style={[
                styles.settingLabel,
                isSmallDevice && { fontSize: 13 }
            ]}>{label}</Text>
            {subtitle ? <Text style={[
                styles.settingSubtitleText,
                isSmallDevice && { fontSize: 11 }
            ]}>{subtitle}</Text> : null}
        </View>
        {type === 'switch' ? (
            <Switch 
                value={value} 
                onValueChange={onToggle}
                trackColor={{ false: '#e5e7eb', true: '#fb923c' }}
                thumbColor={value ? '#fff' : '#fff'}
                ios_backgroundColor="#e5e7eb"
                style={isSmallDevice ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : undefined}
            />
        ) : (
            <ChevronRight size={isSmallDevice ? 16 : 18} color="#d1d5db" />
        )}
    </TouchableOpacity>
));

export default function SettingsScreen() {
    const navigation = useNavigation();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const isSmallDevice = width < 380;
    const [posFlow, setPosFlow] = React.useState<'table' | 'direct'>('table');
    const [loading, setLoading] = React.useState(false); // DEFAULT TO FALSE FOR INSTANT OPEN
    const loadingRef = React.useRef(true);
    
    // Add effect to sync ref with state
    React.useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);
    const [isScanning, setIsScanning] = React.useState(false);
    const [discoveredDevices, setDiscoveredDevices] = React.useState<Device[]>([]);
    const [selectedPrinters, setSelectedPrinters] = React.useState<{receipt: string | null, report: string | null, kitchen: string | null, bar: string | null}>({ receipt: null, report: null, kitchen: null, bar: null });
    const [configuringPrinterType, setConfiguringPrinterType] = React.useState<'receipt' | 'report'>('receipt');
    const [receiptPrintMode, setReceiptPrintMode] = React.useState<'auto' | 'manual'>('manual');
    const { isAdmin, currentSession, isSessionActive, checkSession, requireMandatorySession, permissions, currentBranchId, storeSettings: sessionSettings, branchName, branchAddress, branchPhone, userName } = useSession();
    const [showSessionModal, setShowSessionModal] = React.useState(false);
    const [sessionMode, setSessionMode] = React.useState<'open' | 'close'>('open');
    const [showLogoutModal, setShowLogoutModal] = React.useState(false);
    const [showPasswordModal, setShowPasswordModal] = React.useState(false);
    const [showReportModal, setShowReportModal] = React.useState(false);
    const [passwordData, setPasswordData] = React.useState({ new: '', confirm: '' });
    const [updatingPassword, setUpdatingPassword] = React.useState(false);
    const [showShiftWarningModal, setShowShiftWarningModal] = React.useState({ visible: false, message: '' });
    const [preparationDuration, setPreparationDuration] = React.useState<number>(15);
    const [offlineQueueCount, setOfflineQueueCount] = React.useState<number>(0);
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [forcedOffline, setForcedOffline] = React.useState<boolean>(false);
    const [printerStatus, setPrinterStatus] = React.useState<Record<string, 'connected' | 'disconnected' | 'connecting'>>({});
    const [enableReceipt, setEnableReceipt] = React.useState<boolean>(true);
    const [enableKitchen, setEnableKitchen] = React.useState<boolean>(true);
    const [enableBar, setEnableBar] = React.useState<boolean>(true);
    const [showClearCacheConfirm, setShowClearCacheConfirm] = React.useState(false);
    const [enableHoldPrinting, setEnableHoldPrinting] = React.useState<boolean>(false);
    const [autoPreviewReceipt, setAutoPreviewReceipt] = React.useState<boolean>(false);

    const [showManualModal, setShowManualModal] = React.useState(false);
    const [manualType, setManualType] = React.useState<'receipt' | 'report' | 'kitchen' | 'bar'>('receipt');
    const [manualAddress, setManualAddress] = React.useState('');

    const [fullSettings, setFullSettings] = React.useState<any>(null);
    const [statusModal, setStatusModal] = React.useState({ visible: false, title: '', message: '', type: 'success' as any });
    const [toast, setToast] = React.useState<{ visible: boolean; message: string; submessage?: string; type: 'success' | 'info' | 'error' }>({ visible: false, message: '', type: 'success' });
    const toastOpacity = React.useRef(new Animated.Value(0)).current;
    const toastTranslateY = React.useRef(new Animated.Value(-20)).current;

    const showToast = (message: string, submessage?: string, type: 'success'|'info'|'error' = 'success') => {
        setToast({ visible: true, message, submessage, type });
        Animated.parallel([
            Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(toastTranslateY, { toValue: 0, duration: 300, useNativeDriver: true })
        ]).start();

        setTimeout(() => {
            hideToast();
        }, 4000);
    };

    const hideToast = () => {
        Animated.parallel([
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(toastTranslateY, { toValue: -20, duration: 300, useNativeDriver: true })
        ]).start(() => setToast(prev => ({ ...prev, visible: false })));
    };

    React.useEffect(() => {
        loadSettings();
        loadOfflineCount();
    }, []);

    const loadOfflineCount = async () => {
        const queue = await OfflineService.getOfflineQueue();
        setOfflineQueueCount(queue.length);
    };

    const loadSettings = async () => {
        try {
            console.log('[SettingsScreen] loadSettings: START');
            
            // Failsafe timeout
            const failsafeTimeout = setTimeout(() => {
                if (loadingRef.current) {
                    console.warn('[SettingsScreen] loadSettings: FAILSAFE');
                    setLoading(false);
                }
            }, 5000);

            // 1. Critical Settings from Session or Supabase
            if (sessionSettings) {
                setFullSettings(sessionSettings);
                setPosFlow(sessionSettings.enable_table_management ? 'table' : 'direct');
                if (sessionSettings.preparation_duration_minutes != null) {
                    setPreparationDuration(sessionSettings.preparation_duration_minutes);
                }
            } else {
                // Fallback fetch only if session context somehow missed it
                const { data } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
                if (data) {
                    setFullSettings(data);
                    setPosFlow(data.enable_table_management ? 'table' : 'direct');
                }
            }

            // 2. Parallelize ALL remaining local storage and printer status fetches
            // This is the key optimization: no more sequential awaits
            const [
                savedFlow, 
                savedPrinters, 
                isForced, 
                savedAutoPrint, 
                savedReceiptPrintMode,
                savedEnableReceipt,
                savedKitchenPrinters,
                savedEnableKitchen,
                savedEnableBar,
                savedEnableHoldPrinting
            ] = await Promise.all([
                AsyncStorage.getItem('pos_flow'),
                Promise.all([
                    PrinterManager.getSelectedPrinter('receipt').catch(() => null),
                    PrinterManager.getSelectedPrinter('report').catch(() => null)
                ]),
                OfflineService.getForcedOfflineMode().catch(() => false),
                AsyncStorage.getItem('auto_print').catch(() => 'true'),
                AsyncStorage.getItem('post_payment_receipt_mode').catch(() => null),
                AsyncStorage.getItem('enable_receipt_printing').catch(() => 'true'),
                Promise.all([
                    PrinterManager.getSelectedPrinter('kitchen').catch(() => null),
                    PrinterManager.getSelectedPrinter('bar').catch(() => null)
                ]),
                AsyncStorage.getItem('enable_kitchen_printing').catch(() => 'true'),
                AsyncStorage.getItem('enable_bar_printing').catch(() => 'true'),
                AsyncStorage.getItem('enable_hold_printing').catch(() => 'false')
            ]);
 
            // Apply results
            if (savedFlow) setPosFlow(savedFlow as any);
            setSelectedPrinters({
                receipt: savedPrinters[0],
                report: savedPrinters[1],
                kitchen: (savedKitchenPrinters as any)[0],
                bar: (savedKitchenPrinters as any)[1]
            });
            
            setEnableReceipt(savedEnableReceipt !== 'false');
            if (savedEnableKitchen !== null) setEnableKitchen(savedEnableKitchen === 'true');
            if (savedEnableBar !== null) setEnableBar(savedEnableBar === 'true');
            if (savedEnableHoldPrinting !== null) setEnableHoldPrinting(savedEnableHoldPrinting === 'true');

            const savedAutoPreview = await AsyncStorage.getItem('auto_preview_receipt');
            if (savedAutoPreview !== null) setAutoPreviewReceipt(savedAutoPreview === 'true');
            setForcedOffline(!!isForced);
            setReceiptPrintMode(
                savedReceiptPrintMode === 'auto' || savedReceiptPrintMode === 'manual'
                    ? savedReceiptPrintMode
                    : (savedAutoPrint === 'true' ? 'auto' : 'manual')
            );

            if (sessionSettings) {
                setFullSettings(sessionSettings);
            }

            setEnableReceipt(savedEnableReceipt !== 'false');

            // EXIT CRITICAL LOADING ASAP
            setLoading(false);
            clearTimeout(failsafeTimeout);
            console.log('[SettingsScreen] loadSettings: CRITICAL DONE');

            // 3. Background/Non-blocking fetches
            loadOfflineCount();
            
        } catch (e) {
            console.error('[SettingsScreen] loadSettings Error:', e);
            setLoading(false);
        }
    };

    const updatePrinterStatuses = React.useCallback(async () => {
        const statuses: Record<string, any> = {};
        const { receipt, report, kitchen, bar } = selectedPrinters;
        if (receipt) statuses[receipt] = PrinterManager.getConnectionStatus(receipt);
        if (report) statuses[report] = PrinterManager.getConnectionStatus(report);
        if (kitchen) statuses[kitchen] = PrinterManager.getConnectionStatus(kitchen);
        if (bar) statuses[bar] = PrinterManager.getConnectionStatus(bar);
        setPrinterStatus(statuses);
    }, [selectedPrinters]);

    React.useEffect(() => {
        updatePrinterStatuses();
        const interval = setInterval(updatePrinterStatuses, 5000);
        return () => clearInterval(interval);
    }, [updatePrinterStatuses]);

    // Independent effect for initial component stabilization (NO AUTO-CONNECT)
    React.useEffect(() => {
        console.log('[SettingsScreen] Component stabilized - Auto-Connect DISABLED for stability');
    }, []);

    const handleRefreshAllPrinters = async () => {
        const { receipt, report } = selectedPrinters;
        if (!receipt && !report) {
            showToast('Tidak ada printer', 'Tambahkan printer terlebih dahulu', 'info');
            return;
        }

        showToast('Memperbarui Status...', 'Sedang mengecek koneksi printer', 'info');
        
        // Use Promise.all with individual timeouts or catch to keep UI alive
        await Promise.allSettled([
            receipt ? PrinterManager.checkConnection(receipt) : Promise.resolve(),
            report ? PrinterManager.checkConnection(report) : Promise.resolve(),
            kitchen ? PrinterManager.checkConnection(kitchen) : Promise.resolve(),
            bar ? PrinterManager.checkConnection(bar) : Promise.resolve()
        ]);
        
        updatePrinterStatuses();
        showToast('Selesai', 'Status printer telah diperbarui', 'success');
    };

    const handleReconnect = async (mac: string) => {
        const success = await PrinterManager.checkConnection(mac);
        updatePrinterStatuses();
        if (!success) {
            showToast('Gagal terhubung', 'Pastikan printer aktif dan Bluetooth nyala', 'error');
        } else {
            showToast('Berhasil terhubung', 'Printer siap digunakan', 'success');
        }
    };

    const startScan = async (type: 'receipt' | 'report') => {
        setIsScanning(true);
        setConfiguringPrinterType(type);
        setDiscoveredDevices([]);
        try {
            // 1. Get already paired devices first
            const paired = await PrinterManager.getPairedPrinters();
            if (paired && paired.length > 0) {
                const formattedPaired = (paired as any[]).map(p => ({
                    id: p.inner_mac_address,
                    name: `${p.device_name || 'Printer'} (Paired)`,
                } as any));
                setDiscoveredDevices(formattedPaired);
            }

            // 2. Start scanning for new BLE devices
            await PrinterManager.scanPrinters((device) => {
                setDiscoveredDevices((prev) => {
                    if (prev.find(d => d.id === device.id)) return prev;
                    return [...prev, device];
                });
            });
            setTimeout(() => setIsScanning(false), 15000);
        } catch (e: any) {
            Alert.alert('Scan Gagal', e.message);
            setIsScanning(false);
        }
    };

    const selectPrinter = async (device: Device) => {
        try {
            await PrinterManager.saveSelectedPrinter(device.id, configuringPrinterType);
            
            setSelectedPrinters(prev => {
                if (configuringPrinterType === 'receipt') return { ...prev, receipt: device.id };
                if (configuringPrinterType === 'report') return { ...prev, report: device.id };
                if (configuringPrinterType === 'kitchen') return { ...prev, kitchen: device.id };
                if (configuringPrinterType === 'bar') return { ...prev, bar: device.id };
                return prev;
            });
            
            setDiscoveredDevices([]);
            let typeLabel = 'Kasir';
            if (configuringPrinterType === 'report') typeLabel = 'Laporan';
            if (configuringPrinterType === 'kitchen') typeLabel = 'Dapur';
            if (configuringPrinterType === 'bar') typeLabel = 'Bar';

            setStatusModal({
                visible: true,
                title: 'Printer Terpilih',
                message: `Printer ${typeLabel}: ${device.name || device.id} berhasil dipilih.`,
                type: 'success'
            });
        } catch (e: any) {
            setStatusModal({
                visible: true,
                title: 'Error',
                message: 'Gagal memilih printer: ' + e.message,
                type: 'warning'
            });
        }
    };

    const handleTestPrint = async (type: 'receipt' | 'report' = 'receipt') => {
        try {
            await PrinterManager.testPrint(type);
            Alert.alert('Sukses', `Test print ${type} berhasil dikirim.`);
        } catch (e: any) {
            const msg = e.message || '';
            if (msg.includes('pairing') || msg.includes('find the specified')) {
                Alert.alert(
                    'Gagal Mencetak',
                    'Printer belum terpasang di sistem.\n\nLangkah Solusi:\n1. Buka Pengaturan HP > Bluetooth.\n2. Cari dan "Pasangkan/Pair" printer Anda.\n3. Kembali ke sini dan coba lagi.'
                );
            } else {
                Alert.alert('Error', 'Gagal mencetak test: ' + msg);
            }
        }
    };

    const handleManualSave = async () => {
        if (!manualAddress.trim()) return;
        
        // Basic MAC validation
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        const cleanMAC = manualAddress.trim().toUpperCase();
        
        if (!macRegex.test(cleanMAC)) {
            Alert.alert('Format Salah', 'Gunakan format MAC Address yang benar (e.g., AA:BB:CC:DD:EE:FF)');
            return;
        }

        try {
            await PrinterManager.saveSelectedPrinter(cleanMAC, manualType);
            setSelectedPrinters(prev => ({ ...prev, [manualType]: cleanMAC }));
            setShowManualModal(false);
            setManualAddress('');
            Alert.alert('Sukses', `MAC Address untuk ${manualType === 'receipt' ? 'Kasir' : (manualType === 'kitchen' ? 'Dapur' : (manualType === 'bar' ? 'Bar' : 'Laporan'))} berhasil disimpan.`);
        } catch (e) {
            console.error('Error saving manual printer:', e);
            Alert.alert('Error', 'Gagal menyimpan MAC Address');
        }
    };

    const toggleHoldPrinting = async (val: boolean) => {
        try {
            setEnableHoldPrinting(val);
            await AsyncStorage.setItem('enable_hold_printing', val ? 'true' : 'false');
            showToast(val ? 'Cetak Hold diaktifkan' : 'Cetak Hold dinonaktifkan', undefined, 'success');
        } catch (e) {
            console.error('Error saving hold printing setting:', e);
        }
    };

    const toggleAutoPreview = async (val: boolean) => {
        try {
            setAutoPreviewReceipt(val);
            await AsyncStorage.setItem('auto_preview_receipt', val ? 'true' : 'false');
            showToast(val ? 'Pratinjau Otomatis Aktif' : 'Pratinjau Otomatis Mati', undefined, 'success');
        } catch (e) {
            console.error('Error saving auto preview setting:', e);
        }
    };

    const handleForgetPrinter = async (type: 'receipt' | 'report') => {
        const typeLabel = type === 'receipt' ? 'Kasir' : 'Laporan';
        Alert.alert(
            `Hapus Printer ${typeLabel}`,
            `Apakah Anda yakin ingin menghapus printer ${typeLabel}?`,
            [
                { text: "Batal", style: "cancel" },
                {
                    text: "Hapus",
                    style: "destructive",
                    onPress: async () => {
                        await PrinterManager.forgetSelectedPrinter(type);
                        setSelectedPrinters(prev => {
                            if (type === 'receipt') return { ...prev, receipt: null };
                            if (type === 'report') return { ...prev, report: null };
                            if (type === 'kitchen') return { ...prev, kitchen: null };
                            if (type === 'bar') return { ...prev, bar: null };
                            return prev;
                        });
                        Alert.alert('Sukses', 'Printer berhasil dihapus.');
                    }
                }
            ]
        );
    };

    const togglePrinterEnable = async (type: 'receipt' | 'kitchen' | 'bar', value: boolean) => {
        try {
            if (type === 'receipt') {
                setEnableReceipt(value);
                await AsyncStorage.setItem('enable_receipt_printing', value.toString());
            } else if (type === 'kitchen') {
                setEnableKitchen(value);
                await AsyncStorage.setItem('enable_kitchen_printing', value.toString());
            } else if (type === 'bar') {
                setEnableBar(value);
                await AsyncStorage.setItem('enable_bar_printing', value.toString());
            }

            let label = 'Struk';
            if (type === 'kitchen') label = 'Dapur';
            if (type === 'bar') label = 'Bar';
            
            showToast(
                `Printer ${label} ${value ? 'Aktif' : 'Nonaktif'}`,
                value ? 'Siap digunakan' : 'Cetak akan dilewati secara otomatis',
                'info'
            );
        } catch (e) {
            console.error('Error toggling printer:', e);
        }
    };


    const saveReceiptPrintMode = async (value: 'auto' | 'manual') => {
        setReceiptPrintMode(value);
        try {
            await Promise.all([
                AsyncStorage.setItem('post_payment_receipt_mode', value),
                AsyncStorage.setItem('auto_print', String(value === 'auto'))
            ]);
        } catch (e) {
            console.error('Error saving post-payment receipt mode:', e);
        }
    };

    const toggleSetting = async (key: string, value: boolean) => {
        if (!fullSettings) return;
        const updatedSettings = { ...fullSettings, [key]: value };
        setFullSettings(updatedSettings);
        try {
            await supabase.from('store_settings').update({ [key]: value }).eq('id', 1);
            checkSession(false, true); // Silent force refresh to prevent reload flash
        } catch (e) {
            Alert.alert('Error', 'Gagal menyimpan pengaturan');
            loadSettings(); // Rollback on error
        }
    };

    const savePreparationDuration = async (minutes: number) => {
        const clamped = Math.max(1, Math.min(120, minutes));
        setPreparationDuration(clamped);
        try {
            await supabase.from('store_settings').update({ preparation_duration_minutes: clamped }).eq('id', 1);
            await AsyncStorage.setItem('preparation_duration_minutes', String(clamped));
        } catch (e) {
            Alert.alert('Error', 'Gagal menyimpan durasi penyiapan');
        }
    };

    const handleLogout = () => {
        if (isSessionActive && requireMandatorySession) {
            setShowShiftWarningModal({ visible: true, message: 'Anda harus menutup shift kasir terlebih dahulu.' });
            return;
        }
        setShowLogoutModal(true);
    };

    const toggleForcedOffline = async (val: boolean) => {
        setForcedOffline(val);
        await OfflineService.setForcedOfflineMode(val);
        
        showToast(
            val ? "Mode Offline Aktif" : "Mode Otomatis Aktif",
            val 
                ? "Transaksi akan selalu disimpan secara lokal." 
                : "Deteksi koneksi internet kembali otomatis.",
            val ? 'info' : 'success'
        );
    };

    const confirmLogout = async () => {
        setShowLogoutModal(false);
        try {
            await supabase.auth.signOut();
            // AppNavigator will handle redirection automatically
        } catch (err: any) {
            console.error('[SettingsScreen] Error during sign out:', err);
            // Redirection is handled automatically by AppNavigator
        }
    };

    const handleSyncOffline = async () => {
        if (offlineQueueCount === 0) {
            showToast('Tidak ada transaksi untuk disinkronisasi', 'info');
            return;
        }

        try {
            setIsSyncing(true);
            const result = await OfflineService.syncQueue();
            await loadOfflineCount();

            if (result.failed === 0) {
                showToast(`Berhasil sinkronisasi ${result.success} transaksi`, 'success');
            } else {
                const firstError = result.errors && result.errors.length > 0 ? result.errors[0] : 'Error tidak diketahui';
                Alert.alert(
                    'Sinkronisasi Selesai Sebagian',
                    `Berhasil: ${result.success}\nGagal: ${result.failed}\n\nDetail Error Pertama:\n${firstError}\n\nCek koneksi atau hubungi admin jika error berlanjut.`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error: any) {
            showToast(error.message || 'Gagal sinkronisasi', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleClearCache = () => {
        setShowClearCacheConfirm(true);
    };

    const confirmClearCache = async () => {
        setShowClearCacheConfirm(false);
        try {
            await AsyncStorage.clear();
            setStatusModal({
                visible: true,
                title: 'Cache Bersih',
                message: 'Semua data cache telah dibersihkan. Aplikasi akan memuat data terbaru dari server.',
                type: 'success'
            });
        } catch (e) {
            showToast('Gagal bersihkan cache', 'error');
        }
    };

    const handleUpdatePassword = async () => {
        if (!passwordData.new || passwordData.new !== passwordData.confirm) {
            Alert.alert('Error', 'Password baru tidak cocok atau kosong');
            return;
        }

        if (passwordData.new.length < 6) {
            Alert.alert('Error', 'Password minimal 6 karakter');
            return;
        }

        setUpdatingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: passwordData.new });
            if (error) throw error;
            
            showToast('Password Berhasil', 'Password Anda telah diperbarui', 'success');
            setShowPasswordModal(false);
            setPasswordData({ new: '', confirm: '' });
        } catch (e: any) {
            Alert.alert('Gagal Update', e.message);
        } finally {
            setUpdatingPassword(false);
        }
    };

    const renderManualModal = () => (
        <Modal
            visible={showManualModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowManualModal(false)}
        >
            <TouchableOpacity 
                activeOpacity={1} 
                style={styles.manualModalOverlay} 
                onPress={() => setShowManualModal(false)}
            >
                <View style={styles.modalContentSmall}>
                    <View style={styles.modalHeaderSmall}>
                        <Text style={styles.modalTitleSmall}>
                            Input MAC Address {manualType === 'receipt' ? 'Kasir' : (manualType === 'kitchen' ? 'Dapur' : (manualType === 'bar' ? 'Bar' : 'Laporan'))}
                        </Text>
                        <TouchableOpacity onPress={() => setShowManualModal(false)}>
                            <X size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={{ padding: 16 }}>
                        <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                            Masukkan MAC Address Bluetooth (e.g. 66:22:90:3A:4E:51). Anda bisa menemukannya di struk Self-Test printer.
                        </Text>
                        
                        <TextInput
                            style={styles.manualInput}
                            placeholder="AA:BB:CC:DD:EE:FF"
                            value={manualAddress}
                            onChangeText={setManualAddress}
                            autoCapitalize="characters"
                            autoCorrect={false}
                        />
                        
                        <TouchableOpacity style={styles.saveBtnModal} onPress={handleManualSave}>
                            <Text style={styles.saveBtnTextModal}>Simpan MAC Address</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
            {renderManualModal()}
            <View style={[
                styles.header,
                isSmallDevice && { paddingVertical: 10, paddingHorizontal: 12 }
            ]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={isSmallDevice ? 24 : 28} color="#1f2937" />
                </TouchableOpacity>
                <Text style={[
                    styles.headerTitle,
                    isSmallDevice && { fontSize: 16 }
                ]}>Pengaturan</Text>
                <View style={{ position: 'absolute', right: 16 }}>
                    <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>VER 1.3.1-PRO</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={isLandscape ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 4 } : null}>
                    {/* Toko & Profil */}
                    <View style={[styles.section, isLandscape && { width: '48.5%' }]}>
                        <Text style={styles.sectionTitle}>Toko & Profil</Text>
                        <View style={styles.card}>
                            <SettingItem 
                                icon={Store} 
                                label="Pengaturan Toko" 
                                subtitle="Nama, alamat & telp outlet"
                                onPress={() => (navigation as any).navigate('StoreSettings')} 
                                isSmallDevice={isSmallDevice}
                            />
                            <View style={styles.divider} />
                            <SettingItem 
                                icon={Users} 
                                label="Daftar Pelayan" 
                                subtitle="Kelola data karyawan & pelayan"
                                onPress={() => (navigation as any).navigate('EmployeeSettings')} 
                                isSmallDevice={isSmallDevice}
                            />
                        </View>
                    </View>

                    {/* Sesi Kasir */}
                    <View style={[styles.section, isLandscape && { width: '48.5%' }]}>
                        <Text style={styles.sectionTitle}>Operasional Kasir</Text>
                        <View style={styles.card}>
                            <SettingItem 
                                icon={Lock} 
                                label="Sesi Kasir Wajib" 
                                subtitle="Wajib buka shift sebelum transaksi"
                                type="switch"
                                value={fullSettings?.require_mandatory_session ?? true}
                                onToggle={(val: boolean) => toggleSetting('require_mandatory_session', val)}
                                isSmallDevice={isSmallDevice}
                            />
                            <View style={styles.divider} />
                            {/* Preparation Duration */}
                            <View style={styles.settingItem}>
                                <View style={styles.settingIconContainer}>
                                    <Clock size={isSmallDevice ? 18 : 20} color="#6b7280" />
                                </View>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingLabel, isSmallDevice && { fontSize: 13 }]}>Durasi Penyiapan</Text>
                                    <Text style={[styles.settingSubtitleText, isSmallDevice && { fontSize: 11 }]}>Perkiraan waktu siap untuk pelanggan</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => savePreparationDuration(preparationDuration - 5)}
                                        style={styles.durationBtn}
                                    >
                                        <Text style={styles.durationBtnText}>−</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.durationValue}>{preparationDuration}m</Text>
                                    <TouchableOpacity
                                        onPress={() => savePreparationDuration(preparationDuration + 5)}
                                        style={styles.durationBtn}
                                    >
                                        <Text style={styles.durationBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={styles.divider} />
                            <SettingItem 
                                icon={ShoppingCart}
                                label="Wajib Modal Awal" 
                                subtitle="Input kas awal saat buka shift"
                                type="switch"
                                value={fullSettings?.require_starting_cash ?? true}
                                onToggle={(val: boolean) => toggleSetting('require_starting_cash', val)}
                                isSmallDevice={isSmallDevice}
                            />
                            <View style={styles.divider} />
                            <TouchableOpacity 
                                style={[
                                    styles.sessionBox,
                                    isSmallDevice && { padding: 10, margin: 8 }
                                ]}
                                activeOpacity={0.8}
                                onPress={() => {
                                    setSessionMode(isSessionActive ? 'close' : 'open');
                                    setShowSessionModal(true);
                                }}
                            >
                                <View style={[styles.statusIndicator, { backgroundColor: isSessionActive ? '#22c55e' : '#ef4444' }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[
                                        styles.sessionStatusText,
                                        isSmallDevice && { fontSize: 13 }
                                    ]}>{isSessionActive ? 'Shift Sedang Aktif' : 'Shift Belum Dibuka'}</Text>
                                    <Text style={[
                                        styles.sessionActionText,
                                        isSmallDevice && { fontSize: 11 }
                                    ]}>{isSessionActive ? 'Ketuk untuk Tutup Shift' : 'Ketuk untuk Buka Shift'}</Text>
                                </View>
                                <ChevronRight size={isSmallDevice ? 14 : 16} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                    </View>

                {/* Koneksi & Offline */}
                <View style={[styles.section, isLandscape && { width: '48.5%' }]}>
                    <Text style={styles.sectionTitle}>Koneksi & Offline</Text>
                    <View style={styles.card}>
                        <SettingItem 
                            icon={WifiOff} 
                            label="Paksa Mode Offline" 
                            subtitle="Gunakan penyimpanan lokal meskipun ada internet"
                            type="switch"
                            value={forcedOffline}
                            onToggle={toggleForcedOffline}
                            isSmallDevice={isSmallDevice}
                        />
                        <View style={styles.divider} />
                        <View style={[styles.settingItem, { paddingBottom: 8 }]}>
                            <View style={[styles.settingIconContainer, { backgroundColor: offlineQueueCount > 0 ? '#fff7ed' : '#f1f5f9' }]}>
                                {offlineQueueCount > 0 ? <WifiOff size={20} color="#ea580c" /> : <Wifi size={20} color="#22c55e" />}
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingLabel}>Status Antrean Offline</Text>
                                <Text style={[styles.settingSubtitleText, { color: offlineQueueCount > 0 ? '#ea580c' : '#94a3b8' }]}>
                                    {offlineQueueCount > 0 
                                        ? `${offlineQueueCount} transaksi belum tersinkron` 
                                        : 'Semua data sudah sinkron'}
                                </Text>
                            </View>
                            {isSyncing ? (
                                <ActivityIndicator size="small" color="#ea580c" />
                            ) : (
                                <TouchableOpacity 
                                    style={[styles.scanBtn, { backgroundColor: offlineQueueCount > 0 ? '#ea580c' : '#94a3b8' }]}
                                    onPress={handleSyncOffline}
                                    disabled={offlineQueueCount === 0 || isSyncing}
                                >
                                    <Cloud size={16} color="#fff" />
                                    <Text style={styles.scanBtnText}>Sinkron</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={styles.divider} />
                        <SettingItem 
                            icon={Database} 
                            label="Muat Ulang Data (Cache)" 
                            subtitle="Segarkan data produk & pelanggan"
                            onPress={handleClearCache}
                            isSmallDevice={isSmallDevice}
                        />
                    </View>
                </View>

                {/* Printer */}
                <View style={[styles.section, isLandscape && { width: '100%' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Printer Bluetooth</Text>
                        <TouchableOpacity 
                            onPress={handleRefreshAllPrinters} 
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 2 }}
                        >
                            <RefreshCw size={12} color="#ea580c" />
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ea580c' }}>Perbarui Semua Status</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.card}>
                        <View style={isLandscape ? { flexDirection: 'row', flexWrap: 'wrap' } : null}>
                            {[
                                { id: 'receipt', label: 'Printer Kasir (Struk)', value: selectedPrinters.receipt },
                                { id: 'report', label: 'Printer Laporan (Keuangan)', value: selectedPrinters.report },
                                { id: 'kitchen', label: 'Printer Dapur (Makanan)', value: selectedPrinters.kitchen },
                                { id: 'bar', label: 'Printer Bar (Minuman)', value: selectedPrinters.bar }
                            ].map((printer, index) => (
                                <View key={printer.id} style={isLandscape ? { width: '50.0%', borderRightWidth: (index % 2 === 0) ? 1 : 0, borderRightColor: '#f1f5f9' } : null}>
                                    {index > 0 && !isLandscape && <View style={styles.divider} />}
                                    <View style={[styles.printerItem, isLandscape && { paddingHorizontal: 12 }]}>
                                        <View style={styles.printerHeader}>
                                            <View style={styles.printerStatusRow}>
                                                <Bluetooth 
                                                    size={20} 
                                                    color={
                                                        printer.value 
                                                            ? (printerStatus[printer.value] === 'connected' ? '#22c55e' : '#ea580c') 
                                                            : '#9ca3af'
                                                    } 
                                                />
                                                <View style={{ marginLeft: 12, flex: 1 }}>
                                                    <Text style={[styles.settingLabel, { fontSize: 13 }]}>{printer.label}</Text>
                                                    <Text style={styles.printerNameText} numberOfLines={1}>{printer.value || 'Belum ada printer'}</Text>
                                                </View>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={{ fontSize: 9, color: '#9ca3af', marginBottom: 2, fontWeight: 'bold' }}>LOKAL</Text>
                                                <Switch 
                                                    value={
                                                        printer.id === 'receipt' ? enableReceipt : 
                                                        printer.id === 'kitchen' ? enableKitchen : 
                                                        printer.id === 'bar' ? enableBar : true
                                                    }
                                                    onValueChange={(val) => {
                                                        if (printer.id === 'report') return;
                                                        togglePrinterEnable(printer.id as any, val);
                                                    }}
                                                    disabled={printer.id === 'report'}
                                                    trackColor={{ false: '#e5e7eb', true: '#fb923c' }}
                                                    style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                                                />
                                            </View>
                                        </View>

                                        <View style={styles.printerActions}>
                                            {printer.value && (
                                                <View style={[
                                                    styles.statusBadgeSmall, 
                                                    { marginRight: 'auto', marginLeft: 0 },
                                                    printerStatus[printer.value] === 'connected' && { backgroundColor: '#f0fdf4', borderColor: '#dcfce7', borderWidth: 1 }
                                                ]}>
                                                    <View style={{ 
                                                        width: 6, 
                                                        height: 6, 
                                                        borderRadius: 3, 
                                                        backgroundColor: printerStatus[printer.value] === 'connected' ? '#22c55e' : (printerStatus[printer.value] === 'connecting' ? '#f59e0b' : '#ef4444') 
                                                    }} />
                                                    <Text style={[
                                                        styles.statusTextSmall,
                                                        printerStatus[printer.value] === 'connected' && { color: '#16a34a' }
                                                    ]}>
                                                        {printerStatus[printer.value] === 'connected' ? 'Connected' : (printerStatus[printer.value] === 'connecting' ? 'Connecting...' : 'Disconnected')}
                                                    </Text>
                                                </View>
                                            )}
                                        
                                            {printer.value && printerStatus[printer.value] !== 'connected' && (
                                                <TouchableOpacity style={styles.iconBtnSmall} onPress={() => handleReconnect(printer.value!)}>
                                                    <RefreshCw size={14} color="#3b82f6" />
                                                </TouchableOpacity>
                                            )}
                                            {printer.value && (
                                                <TouchableOpacity style={styles.iconBtnSmall} onPress={() => handleTestPrint(printer.id as any)}>
                                                    <Printer size={14} color="#ea580c" />
                                                </TouchableOpacity>
                                            )}
                                            {printer.value && (
                                                <TouchableOpacity 
                                                    style={styles.deleteBtnSmall} 
                                                    onPress={() => handleForgetPrinter(printer.id as any)}
                                                >
                                                    <Trash2 size={12} color="#fff" />
                                                    <Text style={styles.deleteBtnTextSmall}>Hapus</Text>
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity 
                                                style={[styles.scanBtnSmall, { backgroundColor: '#64748b', marginRight: 4 }]} 
                                                onPress={() => {
                                                    setManualType(printer.id as any);
                                                    setManualAddress(printer.value || '');
                                                    setShowManualModal(true);
                                                }}
                                            >
                                                <Pencil size={12} color="#fff" />
                                                <Text style={styles.scanBtnTextSmall}>Manual</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                style={[styles.scanBtnSmall, isScanning && configuringPrinterType === printer.id && { backgroundColor: '#cbd5e1' }]} 
                                                onPress={() => startScan(printer.id as any)}
                                                disabled={isScanning}
                                            >
                                                {isScanning && configuringPrinterType === printer.id ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <RefreshCw size={12} color="#fff" />
                                                )}
                                                <Text style={styles.scanBtnTextSmall}>{isScanning && configuringPrinterType === printer.id ? '...' : 'Scan'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>

                        {isScanning && (
                            <View style={styles.scanProgress}>
                                <ActivityIndicator size="small" color="#f97316" style={{ marginBottom: 4 }} />
                                <Text style={styles.scanProgressText}>Mencari untuk {
                                    configuringPrinterType === 'receipt' ? 'Kasir' : 
                                    (configuringPrinterType === 'report' ? 'Laporan' : 
                                    (configuringPrinterType === 'kitchen' ? 'Dapur' : 'Bar'))
                                }...</Text>
                            </View>
                        )}

                        {discoveredDevices.length > 0 && (
                            <View style={styles.deviceList}>
                                {discoveredDevices.map((device) => (
                                    <TouchableOpacity key={device.id} style={styles.deviceItem} onPress={() => selectPrinter(device)}>
                                        <View style={styles.deviceIcon}>
                                            <Printer size={16} color="#4b5563" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.deviceLabel}>{device.name || 'Unknown Device'}</Text>
                                            <Text style={styles.deviceAddress}>{device.id}</Text>
                                        </View>
                                        <View style={styles.chooseBadge}>
                                            <Text style={styles.chooseText}>Pilih</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <View style={styles.divider} />
                        <View style={styles.divider} />
                        <SettingItem 
                            icon={Printer} 
                            label="Cetak Kasir Otomatis" 
                            subtitle="Struk langsung dicetak setelah pembayaran"
                            type="switch"
                            value={receiptPrintMode === 'auto'}
                            onToggle={(val: boolean) => saveReceiptPrintMode(val ? 'auto' : 'manual')}
                            isSmallDevice={isSmallDevice}
                        />

                        <View style={styles.divider} />
                        <SettingItem 
                            icon={Monitor} 
                            label="Pratinjau Struk (Preview)" 
                            subtitle="Tampilkan struk di layar sebelum cetak ke kertas"
                            type="switch"
                            value={autoPreviewReceipt}
                            onToggle={toggleAutoPreview}
                            isSmallDevice={isSmallDevice}
                        />

                        <View style={styles.divider} />
                        <SettingItem 
                            icon={Scissors} 
                            label="Potong Kertas Otomatis" 
                            subtitle="Kirim perintah potong kertas ke printer"
                            type="switch"
                            value={fullSettings?.enable_auto_cut ?? true}
                            onToggle={(val: boolean) => toggleSetting('enable_auto_cut', val)}
                            isSmallDevice={isSmallDevice}
                        />

                        <View style={styles.divider} />
                        <SettingItem 
                            icon={Printer} 
                            label="Cetak Dapur/Bar saat Hold" 
                            subtitle="Kirim pesanan ke dapur saat klik Simpan (Hold)"
                            type="switch"
                            value={enableHoldPrinting}
                            onToggle={toggleHoldPrinting}
                            isSmallDevice={isSmallDevice}
                        />
                    </View>
                </View>

                {/* Laporan & Rekap */}
                {(!isAdmin ? sessionSettings?.cashier_can_view_reports : true) && (
                    <View style={[styles.section, isLandscape && { width: '48.5%' }]}>
                        <Text style={styles.sectionTitle}>Laporan & Rekap</Text>
                        <View style={styles.card}>
                            <SettingItem 
                                icon={BarChart3} 
                                label="Cetak Laporan Penjualan" 
                                subtitle="Ringkasan transaksi ke printer thermal"
                                onPress={() => setShowReportModal(true)} 
                                isSmallDevice={isSmallDevice}
                            />
                        </View>
                    </View>
                )}

                {/* Lainnya */}
                <View style={[styles.section, isLandscape && { width: '48.5%' }]}>
                    <Text style={styles.sectionTitle}>Lainnya</Text>
                    <View style={styles.card}>
                        <SettingItem icon={Bell} label="Notifikasi" />
                        <View style={styles.divider} />
                        <SettingItem icon={Info} label="Tentang Aplikasi" />
                    </View>
                </View>
                </View>

                <TouchableOpacity 
                    onPress={handleLogout} 
                    style={[
                        styles.logoutBtn,
                        isSmallDevice && { marginTop: 20, padding: 14, borderRadius: 16 }
                    ]} 
                    activeOpacity={0.8}
                >
                    <LogOut size={isSmallDevice ? 16 : 18} color="#dc2626" />
                    <Text style={[
                        styles.logoutBtnText,
                        isSmallDevice && { fontSize: 14 }
                    ]}>Keluar Akun</Text>
                </TouchableOpacity>

                <View style={{ height: 60 }} />
            </ScrollView>

            <CashierSessionModal
                visible={showSessionModal}
                onClose={() => setShowSessionModal(false)}
                mode={sessionMode}
                session={currentSession}
                onComplete={checkSession}
                currentBranchId={currentBranchId}
            />

            {/* Premium Toast Notification */}
            {toast.visible && (
                <Animated.View style={[
                    styles.toastContainer,
                    { 
                        opacity: toastOpacity,
                        transform: [{ translateY: toastTranslateY }] as any
                    }
                ]}>
                    <View style={[
                        styles.toastContent,
                        toast.type === 'info' && { borderLeftColor: '#3b82f6' },
                        toast.type === 'error' && { borderLeftColor: '#ef4444' }
                    ]}>
                        <View style={[
                            styles.toastIconContainer,
                            toast.type === 'info' && { backgroundColor: '#eff6ff' },
                            toast.type === 'error' && { backgroundColor: '#fef2f2' }
                        ]}>
                            {toast.type === 'success' && <CheckCircle2 size={20} color="#22c55e" />}
                            {toast.type === 'info' && <Wifi size={20} color="#3b82f6" />}
                            {toast.type === 'error' && <XCircle size={20} color="#ef4444" />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.toastTitle}>{toast.message}</Text>
                            {toast.submessage && <Text style={styles.toastSubtitle}>{toast.submessage}</Text>}
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* Password Modal */}
            <Modal visible={showPasswordModal} transparent animationType="fade">
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <View style={[styles.modalContent, { maxWidth: 400, alignSelf: 'center' }]}>
                        <View style={{ marginBottom: 20 }}>
                            <Text style={styles.modalTitle}>Ubah Password</Text>
                            <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Gunakan password minimal 6 karakter</Text>
                        </View>
                        
                        <View style={{ gap: 12 }}>
                            <View>
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 6 }}>Password Baru</Text>
                                <TextInput
                                    style={[styles.input, { marginBottom: 0 }]}
                                    placeholder="Masukkan password baru"
                                    secureTextEntry
                                    value={passwordData.new}
                                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, new: text }))}
                                />
                            </View>
                            
                            <View>
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 6 }}>Konfirmasi Password</Text>
                                <TextInput
                                    style={[styles.input, { marginBottom: 0 }]}
                                    placeholder="Ulangi password baru"
                                    secureTextEntry
                                    value={passwordData.confirm}
                                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirm: text }))}
                                />
                            </View>
                        </View>

                        <View style={[styles.modalButtons, { marginTop: 24 }]}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => {
                                    setShowPasswordModal(false);
                                    setPasswordData({ new: '', confirm: '' });
                                }}
                                disabled={updatingPassword}
                            >
                                <Text style={styles.cancelBtnText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.saveBtn, { backgroundColor: '#ea580c' }]}
                                onPress={handleUpdatePassword}
                                disabled={updatingPassword}
                            >
                                {updatingPassword ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Update Password</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <ConfirmExitModal
                visible={showShiftWarningModal.visible}
                onClose={() => setShowShiftWarningModal({ visible: false, message: '' })}
                onConfirm={() => setShowShiftWarningModal({ visible: false, message: '' })}
                title="Gagal Keluar"
                message={showShiftWarningModal.message}
                confirmText="Mengerti"
                iconType="alert"
                showCancel={false}
            />

            <ConfirmExitModal
                visible={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={confirmLogout}
                title="Konfirmasi Keluar"
                message="Apakah Anda yakin ingin keluar dari akun ini?"
                confirmText="Keluar"
                iconType="logout"
            />
            {/* Session Modals */}
            <CashierSessionModal
                visible={showSessionModal}
                onClose={() => setShowSessionModal(false)}
                mode={sessionMode}
                session={currentSession}
                onComplete={checkSession}
                currentBranchId={currentBranchId}
            />

            <ConfirmExitModal
                visible={showShiftWarningModal.visible}
                onClose={() => setShowShiftWarningModal({ visible: false, message: '' })}
                onConfirm={() => setShowShiftWarningModal({ visible: false, message: '' })}
                title="Shift Wajib"
                message={showShiftWarningModal.message}
                confirmText="Mengerti"
                iconType="alert"
                showCancel={false}
            />

            <ConfirmExitModal
                visible={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={confirmLogout}
                title="Keluar Akun"
                message="Apakah Anda yakin ingin keluar dari akun?"
                confirmText="Keluar"
                iconType="logout"
            />
            <SalesReportModal
                visible={showReportModal}
                onClose={() => setShowReportModal(false)}
                currentBranchId={currentBranchId || ''}
                branchName={branchName || 'WINNY POS'}
                branchAddress={branchAddress}
                branchPhone={branchPhone}
                userName={userName || 'Kasir'}
                receiptPaperWidth={fullSettings?.receipt_paper_width || '58mm'}
                storeSettings={sessionSettings}
            />
            <ConfirmExitModal 
                visible={showClearCacheConfirm}
                onClose={() => setShowClearCacheConfirm(false)}
                onConfirm={confirmClearCache}
                title="Bersihkan Cache?"
                message="Data produk & pelanggan akan dimuat ulang. Anda harus login kembali."
                confirmText="Bersihkan"
                cancelText="Batal"
                iconType="trash"
            />
            <StatusModal 
                visible={statusModal.visible}
                onClose={() => setStatusModal({ ...statusModal, visible: false })}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
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
        padding: 4,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    scrollContent: {
        paddingTop: 8,
    },
    section: {
        marginTop: 18,
        paddingHorizontal: 12,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
        marginLeft: 4,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 4,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    settingIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingContent: {
        flex: 1,
        marginLeft: 12,
    },
    settingLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
    settingSubtitleText: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    printModeRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    printModeChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    printModeChipActive: {
        backgroundColor: '#fff7ed',
        borderColor: '#fb923c',
    },
    printModeChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
    },
    printModeChipTextActive: {
        color: '#c2410c',
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginHorizontal: 10,
    },
    printerItem: {
        paddingVertical: 12,
    },
    printerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    printerStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    printerNameText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#334155',
    },
    printerStatusText: {
        fontSize: 12,
        color: '#94a3b8',
    },
    printerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
        paddingLeft: 32, // align with text start after icon
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#fef2f2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBtnSmall: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ef4444',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 10,
        gap: 4,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    deleteBtnSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 3,
    },
    deleteBtnText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    deleteBtnTextSmall: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    scanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f97316',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
        shadowColor: '#f97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    scanBtnSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f97316',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 10,
        gap: 4,
    },
    scanBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    scanBtnTextSmall: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    statusBadgeSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#f1f5f9',
    },
    statusTextSmall: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '700',
    },
    scanProgress: {
        paddingBottom: 16,
        alignItems: 'center',
    },
    scanProgressText: {
        fontSize: 11,
        color: '#ea580c',
        fontStyle: 'italic',
    },
    deviceList: {
        paddingHorizontal: 12,
        paddingBottom: 16,
    },
    deviceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    deviceIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    deviceLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#334155',
    },
    deviceAddress: {
        fontSize: 11,
        color: '#94a3b8',
    },
    chooseBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: '#fff7ed',
        borderRadius: 8,
    },
    chooseText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#ea580c',
    },
    testBtn: {
        margin: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    testBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#64748b',
    },
    // Shift Styles
    sessionBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginTop: 8,
    },
    statusIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 12,
    },
    sessionStatusText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    sessionActionText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 32,
        marginHorizontal: 16,
        padding: 18,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#fee2e2',
        gap: 12,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    logoutBtnText: {
        color: '#dc2626',
        fontSize: 15,
        fontWeight: 'bold',
    },
    durationBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    durationBtnText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ea580c',
        lineHeight: 22,
    },
    durationValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#334155',
        minWidth: 36,
        textAlign: 'center',
    },
    // Manual Modal Styles
    manualModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContentSmall: {
        backgroundColor: '#fff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 400,
        overflow: 'hidden'
    },
    modalHeaderSmall: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    modalTitleSmall: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b'
    },
    manualInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: '#1e293b',
        marginBottom: 16
    },
    saveBtnModal: {
        backgroundColor: '#ea580c',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center'
    },
    saveBtnTextModal: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14
    },
    toastContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 20,
        right: 20,
        zIndex: 9999,
        alignItems: 'center',
    },
    toastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        width: '100%',
        maxWidth: 360,
        alignSelf: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    toastIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    toastTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    toastSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 1,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: '#f1f5f9',
    },
    saveBtn: {
        backgroundColor: '#ea580c',
    },
    cancelBtnText: {
        color: '#64748b',
        fontWeight: 'bold',
        fontSize: 14,
    },
    saveBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
