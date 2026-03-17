import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Switch, ActivityIndicator, ScrollView, Alert, Platform, useWindowDimensions, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrinterManager } from '../lib/PrinterManager';
import { Device } from 'react-native-ble-plx';
import { supabase } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import CashierSessionModal from '../components/CashierSessionModal';
import ConfirmExitModal from '../components/ConfirmExitModal';
import { 
    ChevronLeft, 
    ChevronRight, 
    Printer, 
    User, 
    Users,
    Store, 
    Monitor, 
    ShoppingCart, 
    Lock, 
    LogOut, 
    Bell, 
    Info, 
    LayoutDashboard,
    Trash2,
    RefreshCw,
    Bluetooth,
    Clock,
    Wifi,
    WifiOff,
    Cloud,
    Database,
    CheckCircle2,
    XCircle
} from 'lucide-react-native';
import { OfflineService } from '../lib/OfflineService';

export default function SettingsScreen() {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isSmallDevice = width < 380;
    const [posFlow, setPosFlow] = React.useState<'table' | 'direct'>('table');
    const [cashierMode, setCashierMode] = React.useState<boolean>(false);
    const [loading, setLoading] = React.useState(true);
    const [isScanning, setIsScanning] = React.useState(false);
    const [discoveredDevices, setDiscoveredDevices] = React.useState<Device[]>([]);
    const [selectedPrinter, setSelectedPrinter] = React.useState<string | null>(null);
    const [autoPrint, setAutoPrint] = React.useState<boolean>(false);
    const { currentSession, isSessionActive, checkSession, requireMandatorySession, permissions } = useSession();
    const [showSessionModal, setShowSessionModal] = React.useState(false);
    const [sessionMode, setSessionMode] = React.useState<'open' | 'close'>('open');
    const [showLogoutModal, setShowLogoutModal] = React.useState(false);
    const [showShiftWarningModal, setShowShiftWarningModal] = React.useState({ visible: false, message: '' });
    const [preparationDuration, setPreparationDuration] = React.useState<number>(15);
    const [offlineQueueCount, setOfflineQueueCount] = React.useState<number>(0);
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [forcedOffline, setForcedOffline] = React.useState<boolean>(false);

    const [fullSettings, setFullSettings] = React.useState<any>(null);
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

    React.useEffect(() => {
        if (permissions?.includes('pos_order_only')) {
            setCashierMode(false);
        }
    }, [permissions]);

    const loadSettings = async () => {
        try {
            const { data: settings, error } = await supabase
                .from('store_settings')
                .select('*')
                .eq('id', 1)
                .maybeSingle();

            if (!error && settings) {
                setFullSettings(settings);
                const syncedFlow = settings.enable_table_management ? 'table' : 'direct';
                setPosFlow(syncedFlow);
                await AsyncStorage.setItem('pos_flow', syncedFlow);
                if (settings.preparation_duration_minutes != null) {
                    setPreparationDuration(settings.preparation_duration_minutes);
                }
            }

            const savedFlow = await AsyncStorage.getItem('pos_flow');
            if (savedFlow) setPosFlow(savedFlow as 'table' | 'direct');

            const savedCashierMode = await AsyncStorage.getItem('cashier_mode');
            if (savedCashierMode !== null) setCashierMode(savedCashierMode === 'true');

            const savedPrinter = await PrinterManager.getSelectedPrinter();
            setSelectedPrinter(savedPrinter);

            const isForced = await OfflineService.getForcedOfflineMode();
            setForcedOffline(isForced);

            const savedAutoPrint = await AsyncStorage.getItem('auto_print');
            setAutoPrint(savedAutoPrint === 'true');
        } catch (e) {
            console.error('Error loading settings:', e);
        } finally {
            setLoading(false);
        }
    };

    const startScan = async () => {
        setIsScanning(true);
        setDiscoveredDevices([]);
        try {
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
            await PrinterManager.saveSelectedPrinter(device.id);
            setSelectedPrinter(device.id);
            setDiscoveredDevices([]);
            Alert.alert('Sukses', `Printer ${device.name || device.id} berhasil dipilih.`);
        } catch (e) {
            Alert.alert('Error', 'Gagal memilih printer');
        }
    };

    const handleTestPrint = async () => {
        try {
            await PrinterManager.testPrint();
            Alert.alert('Sukses', 'Test print berhasil dikirim.');
        } catch (e: any) {
            Alert.alert('Error', 'Gagal mencetak test: ' + e.message);
        }
    };

    const handleForgetPrinter = async () => {
        Alert.alert(
            "Hapus Printer",
            "Apakah Anda yakin ingin menghapus printer yang terpilih?",
            [
                { text: "Batal", style: "cancel" },
                {
                    text: "Hapus",
                    style: "destructive",
                    onPress: async () => {
                        await PrinterManager.forgetSelectedPrinter();
                        setSelectedPrinter(null);
                        Alert.alert('Sukses', 'Printer berhasil dihapus.');
                    }
                }
            ]
        );
    };


    const toggleAutoPrint = async (value: boolean) => {
        setAutoPrint(value);
        try {
            await AsyncStorage.setItem('auto_print', value.toString());
        } catch (e) {
            console.error('Error saving auto_print:', e);
        }
    };

    const toggleCashierMode = async (value: boolean) => {
        setCashierMode(value);
        try {
            await AsyncStorage.setItem('cashier_mode', value.toString());
        } catch (e) {
            console.error('Error saving cashier_mode:', e);
        }
    };

    const toggleSetting = async (key: string, value: boolean) => {
        if (!fullSettings) return;
        const updatedSettings = { ...fullSettings, [key]: value };
        setFullSettings(updatedSettings);
        try {
            await supabase.from('store_settings').update({ [key]: value }).eq('id', 1);
            checkSession();
        } catch (e) {
            Alert.alert('Error', 'Gagal menyimpan pengaturan');
            loadSettings();
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

    const confirmLogout = () => {
        setShowLogoutModal(false);
        navigation.reset({ index: 0, routes: [{ name: 'Login' } as any] });
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
                showToast(`Sinkronisasi selesai: ${result.success} berhasil, ${result.failed} gagal. Periksa koneksi internet Anda.`, 'error');
            }
        } catch (error: any) {
            showToast(error.message || 'Gagal sinkronisasi', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleClearCache = async () => {
        Alert.alert(
            "Bersihkan Cache",
            "Data produk & pelanggan akan dimuat ulang dari server. Lanjutkan?",
            [
                { text: "Batal", style: "cancel" },
                { 
                    text: "Ya, Bersihkan", 
                    onPress: async () => {
                        const keys = [
                            `cached_products_`,
                            `cached_categories_`,
                            `pos_cart_draft`,
                        ];
                        // Note: currentBranchId might be needed for precise keys, 
                        // but let's clear the standard ones.
                        await AsyncStorage.clear(); 
                        Alert.alert('Sukses', 'Cache dibersihkan. Silakan muat ulang halaman POS.');
                    } 
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#ea580c" />
            </View>
        );
    }

    const SettingItem = ({ icon: Icon, label, subtitle, value, onToggle, onPress, type = 'navigate' }: any) => (
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
    );

    return (
        <SafeAreaView style={styles.container}>
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
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Toko & Profil */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Toko & Profil</Text>
                    <View style={styles.card}>
                        <SettingItem 
                            icon={Store} 
                            label="Profil Toko" 
                            subtitle="Nama, alamat & telp outlet"
                            onPress={() => navigation.navigate('StoreSettings' as never)} 
                        />
                        <View style={styles.divider} />
                        <SettingItem 
                            icon={Users} 
                            label="Daftar Pelayan" 
                            subtitle="Kelola data karyawan & pelayan"
                            onPress={() => navigation.navigate('EmployeeSettings' as never)} 
                        />
                    </View>
                </View>

                {/* Sesi Kasir */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Operasional Kasir</Text>
                    <View style={styles.card}>
                        <SettingItem 
                            icon={Lock} 
                            label="Sesi Kasir Wajib" 
                            subtitle="Wajib buka shift sebelum transaksi"
                            type="switch"
                            value={fullSettings?.require_mandatory_session ?? true}
                            onToggle={(val: boolean) => toggleSetting('require_mandatory_session', val)}
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

                {/* Mode Aplikasi */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferensi Aplikasi</Text>
                    <View style={styles.card}>
                        <SettingItem 
                            icon={LayoutDashboard} 
                            label="Mode Kasir Lengkap" 
                            subtitle="Aktifkan fitur pembayaran mobile"
                            type="switch"
                            value={cashierMode}
                            onToggle={toggleCashierMode}
                        />
                    </View>
                </View>

                {/* Koneksi & Offline */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Koneksi & Offline</Text>
                    <View style={styles.card}>
                        <SettingItem 
                            icon={WifiOff} 
                            label="Paksa Mode Offline" 
                            subtitle="Gunakan penyimpanan lokal meskipun ada internet"
                            type="switch"
                            value={forcedOffline}
                            onToggle={toggleForcedOffline}
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
                        />
                    </View>
                </View>

                {/* Printer */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Printer Bluetooth</Text>
                    <View style={styles.card}>
                        <View style={styles.printerHeader}>
                            <View style={styles.printerStatusRow}>
                                <Bluetooth size={22} color={selectedPrinter ? '#ea580c' : '#9ca3af'} />
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={styles.printerNameText}>{selectedPrinter || 'Belum ada printer'}</Text>
                                    <Text style={styles.printerStatusText}>{selectedPrinter ? 'Terkoneksi' : 'Siap dipasangkan'}</Text>
                                </View>
                            </View>
                            <View style={styles.printerActions}>
                                {selectedPrinter && (
                                    <TouchableOpacity style={styles.iconBtn} onPress={handleForgetPrinter}>
                                        <Trash2 size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity 
                                    style={[styles.scanBtn, isScanning && { backgroundColor: '#cbd5e1' }]} 
                                    onPress={startScan}
                                    disabled={isScanning}
                                >
                                    {isScanning ? <ActivityIndicator size="small" color="#fff" /> : <RefreshCw size={16} color="#fff" />}
                                    <Text style={styles.scanBtnText}>{isScanning ? 'Scanning...' : 'Scan'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {isScanning && (
                            <View style={styles.scanProgress}>
                                <ActivityIndicator size="small" color="#f97316" style={{ marginBottom: 4 }} />
                                <Text style={styles.scanProgressText}>Mencari perangkat di sekitar...</Text>
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
                        <SettingItem 
                            icon={Printer} 
                            label="Cetak Struk Otomatis" 
                            subtitle="Cetak saat pembayaran selesai"
                            type="switch"
                            value={autoPrint}
                            onToggle={toggleAutoPrint}
                        />
                        {selectedPrinter && (
                            <>
                                <View style={styles.divider} />
                                <TouchableOpacity style={styles.testBtn} onPress={handleTestPrint}>
                                    <Text style={styles.testBtnText}>Cetak Test Receipt</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                {/* Lainnya */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Lainnya</Text>
                    <View style={styles.card}>
                        <SettingItem icon={Bell} label="Notifikasi" />
                        <View style={styles.divider} />
                        <SettingItem icon={Info} label="Tentang Aplikasi" />
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
            />

            {/* Premium Toast Notification */}
            {toast.visible && (
                <Animated.View style={[
                    styles.toastContainer,
                    { 
                        opacity: toastOpacity,
                        transform: [{ translateY: toastTranslateY }]
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

            {/* Shift Warning Modal */}
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
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 6,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    settingIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingContent: {
        flex: 1,
        marginLeft: 14,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#334155',
    },
    settingSubtitleText: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginHorizontal: 14,
    },
    sessionBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        margin: 10,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    statusIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 14,
    },
    sessionStatusText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#334155',
    },
    sessionActionText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    printerHeader: {
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    printerStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
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
        gap: 8,
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#fef2f2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ea580c',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 12,
        gap: 8,
    },
    scanBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
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
    // Toast Styles
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
});
