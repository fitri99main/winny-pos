import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Store, MapPin, Phone, Save, Shield, Layout, CheckCircle2, Clock, Calendar, Lock, Monitor, Percent, Printer, Wifi, Image as ImageIcon, RefreshCw } from 'lucide-react-native';
import { Modal } from 'react-native';
import { useSession } from '../context/SessionContext';

export default function StoreSettingsScreen() {
    const navigation = useNavigation();
    const [loading, setLoading] = React.useState(false); // DEFAULT TO FALSE FOR INSTANT OPEN
    const [saving, setSaving] = React.useState(false);
    const [showSuccess, setShowSuccess] = React.useState(false);
    const [successMsg, setSuccessMsg] = React.useState('');
    const { currentBranchId, storeSettings: sessionSettings, isAdmin, checkSession } = useSession();
    
    // Branch state
    const [branchData, setBranchData] = React.useState({
        name: '',
        address: '',
        phone: ''
    });

    // Global settings state (sync with store_settings table)
    const [storeSettings, setStoreSettings] = React.useState<any>(null);

    React.useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            console.log('[StoreSettingsScreen] fetchData: START');
            setLoading(true);
            


            // 1. Fetch Current Branch
            const bId = currentBranchId;
            if (!bId) {
                console.warn('[StoreSettingsScreen] fetchData: NO branchId');
                setLoading(false);
                return;
            }

            // Parallelize branch and settings fetching
            const [branchRes, settingsRes] = await Promise.all([
                supabase.from('branches').select('*').eq('id', bId).single(),
                sessionSettings 
                    ? Promise.resolve({ data: sessionSettings, error: null }) 
                    : supabase.from('store_settings').select('*').eq('id', 1).maybeSingle()
            ]);

            if (branchRes.data) {
                setBranchData({
                    name: branchRes.data.name || '',
                    address: branchRes.data.address || '',
                    phone: branchRes.data.phone || ''
                });
            }

            if (settingsRes.data) {
                setStoreSettings(settingsRes.data);
            }

            console.log('[StoreSettingsScreen] fetchData: SUCCESS');
        } catch (error) {
            console.error('[StoreSettingsScreen] fetchData: ERROR:', error);
            Alert.alert('Error', 'Gagal memuat data toko');
        } finally {
            console.log('[StoreSettingsScreen] fetchData: FINALLY');
            setLoading(false);
        }
    };

    const handleSaveBranch = async () => {
        if (!branchData.name.trim()) {
            Alert.alert('Peringatan', 'Nama cabang tidak boleh kosong');
            return;
        }

        try {
            setSaving(true);
            const { error } = await supabase
                .from('branches')
                .update({
                    name: branchData.name.trim(),
                    address: branchData.address.trim(),
                    phone: branchData.phone.trim()
                })
                .eq('id', currentBranchId);

            if (error) throw error;
            setSuccessMsg('Data cabang berhasil diperbarui');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        } catch (error) {
            console.error('Error saving branch:', error);
            Alert.alert('Error', 'Gagal menyimpan perubahan');
        } finally {
            setSaving(false);
        }
    };

    const toggleSetting = async (key: string, value: boolean) => {
        if (!storeSettings) return;
        
        try {
            const { error } = await supabase
                .from('store_settings')
                .update({ [key]: value })
                .eq('id', 1);

            if (error) throw error;
            setStoreSettings({ ...storeSettings, [key]: value });
            setSuccessMsg('Pengaturan diperbarui');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        } catch (error) {
            console.error('Error updating setting:', error);
            Alert.alert('Error', 'Gagal memperbarui pengaturan');
        }
    };

    const toggleWorkingDay = (day: string) => {
        if (!storeSettings) return;
        const currentDays = storeSettings.working_days || [];
        const newDays = currentDays.includes(day)
            ? currentDays.filter((d: string) => d !== day)
            : [...currentDays, day];
        
        toggleSetting('working_days', newDays);
    };

    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    const refreshSettings = async () => {
        try {
            setLoading(true);
            console.log('[StoreSettings] Manual refresh triggered...');
            const { data, error } = await supabase
                .from('store_settings')
                .select('*')
                .eq('id', 1)
                .maybeSingle();
            
            if (error) throw error;
            if (data) {
                console.log('[StoreSettings] Fetched from DB:', data);
                setStoreSettings(data);
                if (checkSession) checkSession(false, true); // Update global session too
                Alert.alert('Sukses', 'Pengaturan berhasil disinkronkan dari database.');
            } else {
                console.warn('[StoreSettings] No data found for ID 1');
                Alert.alert('Peringatan', 'Data pengaturan tidak ditemukan di database.');
            }
        } catch (err: any) {
            console.error('[StoreSettings] Refresh failed:', err);
            Alert.alert('Gagal', 'Gagal memuat ulang pengaturan: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={28} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pengaturan Toko</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity 
                        style={styles.refreshButton}
                        onPress={refreshSettings}
                    >
                        <RefreshCw size={20} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.saveButton}
                        onPress={() => Alert.alert('Sukses', 'Semua perubahan telah disimpan otomatis.')}
                    >
                        <Save size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Branch Profile Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Profil Cabang</Text>
                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <View style={styles.inputLabelRow}>
                                <Store size={16} color="#64748b" />
                                <Text style={styles.inputLabel}>Nama Cabang</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={branchData.name}
                                onChangeText={(text) => setBranchData({ ...branchData, name: text })}
                                placeholder="Nama Toko / Cabang"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.inputLabelRow}>
                                <MapPin size={16} color="#64748b" />
                                <Text style={styles.inputLabel}>Alamat</Text>
                            </View>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={branchData.address}
                                onChangeText={(text) => setBranchData({ ...branchData, address: text })}
                                placeholder="Alamat lengkap untuk struk..."
                                multiline
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.inputLabelRow}>
                                <Phone size={16} color="#64748b" />
                                <Text style={styles.inputLabel}>Nomor Telepon</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={branchData.phone}
                                onChangeText={(text) => setBranchData({ ...branchData, phone: text })}
                                placeholder="e.g. 0812-xxxx-xxxx"
                                keyboardType="phone-pad"
                            />
                        </View>

                        <TouchableOpacity 
                            style={[styles.saveButton, saving && { opacity: 0.7 }]} 
                            onPress={handleSaveBranch}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Save size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.saveButtonText}>Simpan Profil</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* WiFi Voucher Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>WiFi Voucher</Text>
                    <View style={styles.card}>
                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <View style={styles.switchLabelRow}>
                                    <Wifi size={18} color="#2563eb" />
                                    <Text style={[styles.switchLabel, { color: '#1e40af' }]}>Aktifkan WiFi Voucher</Text>
                                </View>
                                <Text style={styles.switchSubtitle}>Cetak kode voucher otomatis pada struk</Text>
                            </View>
                            <Switch
                                value={storeSettings?.enable_wifi_vouchers ?? false}
                                onValueChange={(val) => toggleSetting('enable_wifi_vouchers', val)}
                                trackColor={{ false: '#e2e8f0', true: '#2563eb' }}
                            />
                        </View>

                        {storeSettings?.enable_wifi_vouchers && (
                            <View style={{ marginTop: 12, gap: 16 }}>
                                <View style={styles.divider} />
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Minimal Belanja (Rp)</Text>
                                        <TextInput
                                            style={[styles.input, { marginTop: 8 }]}
                                            value={String(storeSettings?.wifi_voucher_min_amount || 0)}
                                            onChangeText={(text) => setStoreSettings({ ...storeSettings, wifi_voucher_min_amount: parseInt(text) || 0 })}
                                            onBlur={() => toggleSetting('wifi_voucher_min_amount', storeSettings.wifi_voucher_min_amount)}
                                            placeholder="50000"
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Kelipatan (Rp)</Text>
                                        <TextInput
                                            style={[styles.input, { marginTop: 8 }]}
                                            value={String(storeSettings?.wifi_voucher_multiplier || 0)}
                                            onChangeText={(text) => setStoreSettings({ ...storeSettings, wifi_voucher_multiplier: parseInt(text) || 0 })}
                                            onBlur={() => toggleSetting('wifi_voucher_multiplier', storeSettings.wifi_voucher_multiplier)}
                                            placeholder="20000"
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>
                                <View>
                                    <Text style={styles.inputLabel}>Pesan Header Voucher</Text>
                                    <TextInput
                                        style={[styles.input, { marginTop: 8 }]}
                                        value={storeSettings?.wifi_voucher_notice || ''}
                                        onChangeText={(text) => setStoreSettings({ ...storeSettings, wifi_voucher_notice: text })}
                                        onBlur={() => toggleSetting('wifi_voucher_notice', storeSettings.wifi_voucher_notice)}
                                        placeholder="Gunakan kode ini untuk WiFi"
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {isAdmin && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Operasional & Keamanan</Text>
                        <View style={styles.card}>
                            <View style={styles.switchItem}>
                                <View style={styles.switchContent}>
                                    <View style={styles.switchLabelRow}>
                                        <Shield size={18} color="#64748b" />
                                        <Text style={styles.switchLabel}>Sesi Kasir Wajib</Text>
                                    </View>
                                    <Text style={styles.switchSubtitle}>Wajib buka shift sebelum transaksi</Text>
                                </View>
                                <Switch
                                    value={storeSettings?.require_mandatory_session ?? true}
                                    onValueChange={(val) => toggleSetting('require_mandatory_session', val)}
                                    trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                                />
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.switchItem}>
                                <View style={styles.switchContent}>
                                    <View style={styles.switchLabelRow}>
                                        <Shield size={18} color="#ea580c" />
                                        <Text style={styles.switchLabel}>Kasir Bisa Buka Laporan</Text>
                                    </View>
                                    <Text style={styles.switchSubtitle}>Izin melihat Laporan Penjualan & Grafik</Text>
                                </View>
                                <Switch
                                    value={storeSettings?.cashier_can_view_reports ?? false}
                                    onValueChange={(val) => toggleSetting('cashier_can_view_reports', val)}
                                    trackColor={{ false: '#e2e8f0', true: '#ea580c' }}
                                />
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.switchItem}>
                                <View style={styles.switchContent}>
                                    <View style={styles.switchLabelRow}>
                                        <Store size={18} color="#ea580c" />
                                        <Text style={styles.switchLabel}>Kasir Bisa Lihat Riwayat Sesi</Text>
                                    </View>
                                    <Text style={styles.switchSubtitle}>Izin membuka riwayat shift sebelumnya</Text>
                                </View>
                                <Switch
                                    value={storeSettings?.cashier_can_view_session_history ?? false}
                                    onValueChange={(val) => toggleSetting('cashier_can_view_session_history', val)}
                                    trackColor={{ false: '#e2e8f0', true: '#ea580c' }}
                                />
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.divider} />
                            <View style={styles.switchItem}>
                                <View style={styles.switchContent}>
                                    <View style={styles.switchLabelRow}>
                                        <Printer size={18} color="#ea580c" />
                                        <Text style={styles.switchLabel}>Kasir Bisa Cetak Bukti Kas</Text>
                                    </View>
                                    <Text style={styles.switchSubtitle}>Izin cetak struk Kas Masuk/Kas Keluar</Text>
                                </View>
                                <Switch
                                    value={storeSettings?.cashier_can_print_financial_receipt ?? false}
                                    onValueChange={(val) => toggleSetting('cashier_can_print_financial_receipt', val)}
                                    trackColor={{ false: '#e2e8f0', true: '#ea580c' }}
                                />
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.switchItem}>
                                <View style={styles.switchContent}>
                                    <View style={styles.switchLabelRow}>
                                        <Printer size={18} color="#ea580c" />
                                        <Text style={styles.switchLabel}>Kasir Bisa Cetak Lap. Omzet</Text>
                                    </View>
                                    <Text style={styles.switchSubtitle}>Izin cetak ringkasan laporan penjualan</Text>
                                </View>
                                <Switch
                                    value={storeSettings?.cashier_can_print_sales_summary ?? false}
                                    onValueChange={(val) => toggleSetting('cashier_can_print_sales_summary', val)}
                                    trackColor={{ false: '#e2e8f0', true: '#ea580c' }}
                                />
                            </View>
                        </View>
                    </View>
                )}

                {/* Working Hours Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Jam Operasional</Text>
                    <View style={styles.card}>
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.inputLabelRow}>
                                    <Clock size={16} color="#64748b" />
                                    <Text style={styles.inputLabel}>Jam Buka</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    value={storeSettings?.opening_time || '08:00'}
                                    onChangeText={(text) => setStoreSettings({ ...storeSettings, opening_time: text })}
                                    onBlur={() => toggleSetting('opening_time', storeSettings.opening_time)}
                                    placeholder="08:00"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={styles.inputLabelRow}>
                                    <Clock size={16} color="#64748b" />
                                    <Text style={styles.inputLabel}>Jam Tutup</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    value={storeSettings?.closing_time || '22:00'}
                                    onChangeText={(text) => setStoreSettings({ ...storeSettings, closing_time: text })}
                                    onBlur={() => toggleSetting('closing_time', storeSettings.closing_time)}
                                    placeholder="22:00"
                                />
                            </View>
                        </View>

                        <View style={styles.inputLabelRow}>
                            <Calendar size={16} color="#64748b" />
                            <Text style={styles.inputLabel}>Hari Operasional</Text>
                        </View>
                        <View style={styles.daysContainer}>
                            {days.map(day => {
                                const isActive = storeSettings?.working_days?.includes(day);
                                return (
                                    <TouchableOpacity
                                        key={day}
                                        style={[styles.dayChip, isActive && styles.dayChipActive]}
                                        onPress={() => toggleWorkingDay(day)}
                                    >
                                        <Text style={[styles.dayText, isActive && styles.dayTextActive]}>
                                            {day.substring(0, 3)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Tax & Service Settings Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pajak & Biaya Layanan</Text>
                    <View style={styles.card}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.inputLabelRow}>
                                    <Percent size={16} color="#64748b" />
                                    <Text style={styles.inputLabel}>Pajak (%)</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    value={String(storeSettings?.tax_rate || 0)}
                                    onChangeText={(text) => setStoreSettings({ ...storeSettings, tax_rate: parseFloat(text) || 0 })}
                                    onBlur={() => toggleSetting('tax_rate', storeSettings.tax_rate)}
                                    placeholder="0"
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={styles.inputLabelRow}>
                                    <Percent size={16} color="#64748b" />
                                    <Text style={styles.inputLabel}>Layanan (%)</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    value={String(storeSettings?.service_rate || 0)}
                                    onChangeText={(text) => setStoreSettings({ ...storeSettings, service_rate: parseFloat(text) || 0 })}
                                    onBlur={() => toggleSetting('service_rate', storeSettings.service_rate)}
                                    placeholder="0"
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Receipt Template Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Templat Struk</Text>
                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <View style={styles.inputLabelRow}>
                                <Layout size={16} color="#64748b" />
                                <Text style={styles.inputLabel}>Header Struk (Nama Toko)</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={storeSettings?.receipt_header || ''}
                                onChangeText={(text) => setStoreSettings({ ...storeSettings, receipt_header: text })}
                                onBlur={() => toggleSetting('receipt_header', storeSettings.receipt_header)}
                                placeholder="WINNY POS"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.inputLabelRow}>
                                <ImageIcon size={16} color="#64748b" />
                                <Text style={styles.inputLabel}>URL Logo (Sync dari Web)</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    value={storeSettings?.receipt_logo_url || ''}
                                    onChangeText={(text) => setStoreSettings({ ...storeSettings, receipt_logo_url: text })}
                                    onBlur={() => toggleSetting('receipt_logo_url', storeSettings.receipt_logo_url)}
                                    placeholder="https://example.com/logo.png"
                                />
                                {storeSettings?.receipt_logo_url ? (
                                    <View style={styles.logoPreviewContainer}>
                                        <Image 
                                            source={{ uri: storeSettings.receipt_logo_url }} 
                                            style={styles.logoPreview}
                                            resizeMode="contain"
                                            onError={(e) => console.error('[StoreSettings] Logo image load error:', e.nativeEvent.error, 'URL:', storeSettings.receipt_logo_url)}
                                            onLoad={() => console.log('[StoreSettings] Logo image loaded successfully')}
                                        />
                                    </View>
                                ) : (
                                    <View style={[styles.logoPreviewContainer, { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }]}>
                                        <ImageIcon size={20} color="#cbd5e1" />
                                    </View>
                                )}
                            </View>
                            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                                * Link gambar logo (Gunakan link yang sama dengan versi web).
                            </Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.inputLabelRow}>
                                <Layout size={16} color="#64748b" />
                                <Text style={styles.inputLabel}>Footer Struk (Pesan)</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={storeSettings?.receipt_footer || ''}
                                onChangeText={(text) => setStoreSettings({ ...storeSettings, receipt_footer: text })}
                                onBlur={() => toggleSetting('receipt_footer', storeSettings.receipt_footer)}
                                placeholder="Terima Kasih"
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <View style={styles.inputLabelRow}>
                                <Printer size={16} color="#64748b" />
                                <Text style={styles.inputLabel}>Baris Kosong Akhir Struk</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={storeSettings?.receipt_footer_feed !== undefined ? String(storeSettings.receipt_footer_feed) : '4'}
                                onChangeText={(text) => setStoreSettings({ ...storeSettings, receipt_footer_feed: parseInt(text) || 0 })}
                                onBlur={() => toggleSetting('receipt_footer_feed', storeSettings.receipt_footer_feed)}
                                placeholder="4"
                                keyboardType="numeric"
                            />
                            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                                * Jumlah baris kosong sebelum kertas dipotong.
                            </Text>
                        </View>

                        <View style={styles.divider} />
                        <Text style={[styles.inputLabel, { marginBottom: 12, marginTop: 4 }]}>Opsi Tampilan Struk</Text>

                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <Text style={styles.switchLabel}>Tampilkan Logo</Text>
                            </View>
                            <Switch
                                value={storeSettings?.show_logo ?? true}
                                onValueChange={(val) => toggleSetting('show_logo', val)}
                                trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            />
                        </View>

                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <Text style={styles.switchLabel}>Tampilkan Tanggal</Text>
                            </View>
                            <Switch
                                value={storeSettings?.show_date ?? true}
                                onValueChange={(val) => toggleSetting('show_date', val)}
                                trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            />
                        </View>

                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <Text style={styles.switchLabel}>Tampilkan Kasir</Text>
                            </View>
                            <Switch
                                value={storeSettings?.show_cashier_name ?? true}
                                onValueChange={(val) => toggleSetting('show_cashier_name', val)}
                                trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            />
                        </View>

                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <Text style={styles.switchLabel}>Tampilkan Pelayan</Text>
                            </View>
                            <Switch
                                value={storeSettings?.show_waiter ?? true}
                                onValueChange={(val) => toggleSetting('show_waiter', val)}
                                trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            />
                        </View>

                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <Text style={styles.switchLabel}>Tampilkan Meja</Text>
                            </View>
                            <Switch
                                value={storeSettings?.show_table ?? true}
                                onValueChange={(val) => toggleSetting('show_table', val)}
                                trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            />
                        </View>

                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <Text style={styles.switchLabel}>Tampilkan Pelanggan</Text>
                            </View>
                            <Switch
                                value={storeSettings?.show_customer_name ?? true}
                                onValueChange={(val) => toggleSetting('show_customer_name', val)}
                                trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            />
                        </View>

                        <View style={styles.divider} />
                        <Text style={[styles.inputLabel, { marginBottom: 12, marginTop: 4 }]}>Opsi Laporan Penjualan</Text>

                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <Text style={styles.switchLabel}>Detail Pajak di Laporan</Text>
                            </View>
                            <Switch
                                value={storeSettings?.show_tax_on_report ?? true}
                                onValueChange={(val) => toggleSetting('show_tax_on_report', val)}
                                trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            />
                        </View>

                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <Text style={styles.switchLabel}>Detail Diskon di Laporan</Text>
                            </View>
                            <Switch
                                value={storeSettings?.show_discount_on_report ?? true}
                                onValueChange={(val) => toggleSetting('show_discount_on_report', val)}
                                trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            />
                        </View>

                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <Text style={styles.switchLabel}>Rincian QRIS di Laporan</Text>
                            </View>
                            <Switch
                                value={storeSettings?.show_qris_on_report ?? true}
                                onValueChange={(val) => toggleSetting('show_qris_on_report', val)}
                                trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            />
                        </View>
                        
                        <View style={styles.switchItem}>
                            <View style={styles.switchContent}>
                                <Text style={styles.switchLabel}>Tampilkan Kategori di Laporan</Text>
                            </View>
                            <Switch
                                value={storeSettings?.show_category_on_summary ?? true}
                                onValueChange={(val) => toggleSetting('show_category_on_summary', val)}
                                trackColor={{ false: '#e2e8f0', true: '#ea580c' }}
                            />
                        </View>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Modern Success Modal */}
            <Modal
                transparent
                visible={showSuccess}
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.successCard}>
                        <View style={styles.successIconOuter}>
                            <View style={styles.successIconInner}>
                                <CheckCircle2 size={32} color="#fff" />
                            </View>
                        </View>
                        <Text style={styles.successTitle}>Berhasil!</Text>
                        <Text style={styles.successMessage}>{successMsg}</Text>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        marginBottom: 12,
        marginLeft: 4,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    input: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#334155',
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: '#ea580c',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    switchItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    switchContent: {
        flex: 1,
    },
    switchLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    switchLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#334155',
    },
    switchSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 4,
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    dayChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minWidth: 50,
        alignItems: 'center',
    },
    dayChipActive: {
        backgroundColor: '#fff7ed',
        borderColor: '#f97316',
    },
    dayText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    dayTextActive: {
        color: '#f97316',
    },
    // Success Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successCard: {
        backgroundColor: '#fff',
        borderRadius: 28,
        padding: 30,
        width: '80%',
        maxWidth: 320,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 25,
        elevation: 10,
    },
    successIconOuter: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#f0fdf4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    successIconInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    successTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
    },
    successMessage: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
    },
    logoPreviewContainer: {
        width: 48,
        height: 48,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        backgroundColor: '#fff',
    },
    logoPreview: {
        width: '100%',
        height: '100%',
    },
    refreshButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    }
});
