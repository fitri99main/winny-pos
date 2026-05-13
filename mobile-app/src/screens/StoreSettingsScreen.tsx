import * as React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var StyleSheet = RN.StyleSheet;
var ScrollView = RN.ScrollView;
var TextInput = RN.TextInput;
var ActivityIndicator = RN.ActivityIndicator;
var Alert = RN.Alert;
var Switch = RN.Switch;
var Image = RN.Image;
var Modal = RN.Modal;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import * as Lucide from 'lucide-react-native';
var ChevronLeft = Lucide.ChevronLeft;
var Store = Lucide.Store;
var MapPin = Lucide.MapPin;
var Phone = Lucide.Phone;
var Save = Lucide.Save;
var Shield = Lucide.Shield;
var Layout = Lucide.Layout;
var CheckCircle2 = Lucide.CheckCircle2;
var Clock = Lucide.Clock;
var Calendar = Lucide.Calendar;
var Lock = Lucide.Lock;
var Monitor = Lucide.Monitor;
var Percent = Lucide.Percent;
var Printer = Lucide.Printer;
var Wifi = Lucide.Wifi;
var ImageIcon = Lucide.Image;
var RefreshCw = Lucide.RefreshCw;
var Scissors = Lucide.Scissors;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;

export default function StoreSettingsScreen() {
    var navigation = useNavigation();
    var stateLoading = React.useState(false);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var stateSaving = React.useState(false);
    var saving = stateSaving[0];
    var setSaving = stateSaving[1];

    var stateShowSuccess = React.useState(false);
    var showSuccess = stateShowSuccess[0];
    var setShowSuccess = stateShowSuccess[1];

    var stateSuccessMsg = React.useState('');
    var successMsg = stateSuccessMsg[0];
    var setSuccessMsg = stateSuccessMsg[1];
    
    var session = useSession();
    var currentBranchId = session.currentBranchId;
    var sessionSettings = session.storeSettings;
    var isAdmin = session.isAdmin;
    var checkSession = session.checkSession;
    
    var stateBranchData = React.useState({
        name: '',
        address: '',
        phone: ''
    });
    var branchData = stateBranchData[0];
    var setBranchData = stateBranchData[1];

    var stateStoreSettings = React.useState(null);
    var storeSettings = stateStoreSettings[0];
    var setStoreSettings = stateStoreSettings[1];

    var fetchData = function() {
        setLoading(true);
        var bId = currentBranchId;
        if (!bId) {
            setLoading(false);
            return;
        }

        var branchPromise = supabase.from('branches').select('*').eq('id', bId).single();
        var settingsPromise = sessionSettings 
            ? Promise.resolve({ data: sessionSettings, error: null }) 
            : supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();

        return Promise.all([branchPromise, settingsPromise]).then(function(results) {
            var branchRes = results[0];
            var settingsRes = results[1];

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
        })['catch'](function(error) {
            console.error('[StoreSettingsScreen] fetchData: ERROR:', error);
            Alert.alert('Error', 'Gagal memuat data toko');
        }).finally(function() {
            setLoading(false);
        });
    };

    React.useEffect(function() {
        fetchData();
    }, []);

    var handleSaveBranch = function() {
        if (!branchData.name.trim()) {
            Alert.alert('Peringatan', 'Nama cabang tidak boleh kosong');
            return;
        }

        setSaving(true);
        return supabase
            .from('branches')
            .update({
                name: branchData.name.trim(),
                address: branchData.address.trim(),
                phone: branchData.phone.trim()
            })
            .eq('id', currentBranchId)
            .then(function(res) {
                if (res.error) throw res.error;
                setSuccessMsg('Data cabang berhasil diperbarui');
                setShowSuccess(true);
                setTimeout(function() { setShowSuccess(false); }, 2000);
            })['catch'](function(error) {
                console.error('Error saving branch:', error);
                Alert.alert('Error', 'Gagal menyimpan perubahan');
            }).finally(function() {
                setSaving(false);
            });
    };

    var toggleSetting = function(key, value) {
        if (!storeSettings) return;
        
        var updateObj = {};
        updateObj[key] = value;
        return supabase
            .from('store_settings')
            .update(updateObj)
            .eq('id', 1)
            .then(function(res) {
                if (res.error) throw res.error;
                
                var newSettings = Object.assign({}, storeSettings);
                newSettings[key] = value;
                setStoreSettings(newSettings);
                
                setSuccessMsg('Pengaturan diperbarui');
                setShowSuccess(true);
                setTimeout(function() { setShowSuccess(false); }, 2000);
            })['catch'](function(error) {
                console.error('Error updating setting:', error);
                Alert.alert('Error', 'Gagal memperbarui pengaturan');
            });
    };

    var toggleWorkingDay = function(day) {
        if (!storeSettings) return;
        var currentDays = storeSettings.working_days || [];
        var newDays = [];
        if (currentDays.indexOf(day) !== -1) {
            for (var i = 0; i < currentDays.length; i++) {
                if (currentDays[i] !== day) newDays.push(currentDays[i]);
            }
        } else {
            newDays = currentDays.concat([day]);
        }
        
        toggleSetting('working_days', newDays);
    };

    var days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    var refreshSettings = function() {
        setLoading(true);
        return supabase
            .from('store_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle()
            .then(function(res) {
                if (res.error) throw res.error;
                if (res.data) {
                    setStoreSettings(res.data);
                    if (checkSession) checkSession(false, true);
                    Alert.alert('Sukses', 'Pengaturan berhasil disinkronkan dari database.');
                } else {
                    Alert.alert('Peringatan', 'Data pengaturan tidak ditemukan di database.');
                }
            })['catch'](function(err) {
                Alert.alert('Gagal', 'Gagal memuat ulang pengaturan: ' + (err.message || err));
            }).finally(function() {
                setLoading(false);
            });
    };

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(View, { style: styles.header },
            React.createElement(TouchableOpacity, { onPress: function() { navigation.goBack(); }, style: styles.backButton },
                React.createElement(ChevronLeft, { size: 28, color: "#1f2937" })
            ),
            React.createElement(Text, { style: styles.headerTitle }, "Pengaturan Toko"),
            React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                React.createElement(View, { style: { marginRight: 12 } }),
                React.createElement(TouchableOpacity, { 
                    style: styles.refreshButton,
                    onPress: refreshSettings
                },
                    React.createElement(RefreshCw, { size: 20, color: "#64748b" })
                ),
                React.createElement(TouchableOpacity, { 
                    style: styles.saveButton,
                    onPress: function() { Alert.alert('Sukses', 'Semua perubahan telah disimpan otomatis.'); }
                },
                    React.createElement(Save, { size: 20, color: "#fff" })
                )
            )
        ),
        React.createElement(ScrollView, { contentContainerStyle: styles.scrollContent, showsVerticalScrollIndicator: false },
            React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Profil Cabang"),
                React.createElement(View, { style: styles.card },
                    React.createElement(View, { style: styles.inputGroup },
                        React.createElement(View, { style: styles.inputLabelRow },
                            React.createElement(Store, { size: 16, color: "#64748b" }),
                            React.createElement(Text, { style: styles.inputLabel }, "Nama Cabang")
                        ),
                        React.createElement(TextInput, {
                            style: styles.input,
                            value: branchData.name,
                            onChangeText: function(text) { setBranchData(Object.assign({}, branchData, { name: text })); },
                            placeholder: "Nama Toko / Cabang"
                        })
                    ),
                    React.createElement(View, { style: styles.inputGroup },
                        React.createElement(View, { style: styles.inputLabelRow },
                            React.createElement(MapPin, { size: 16, color: "#64748b" }),
                            React.createElement(Text, { style: styles.inputLabel }, "Alamat")
                        ),
                        React.createElement(TextInput, {
                            style: [styles.input, { height: 80, textAlignVertical: 'top' }],
                            value: branchData.address,
                            onChangeText: function(text) { setBranchData(Object.assign({}, branchData, { address: text })); },
                            placeholder: "Alamat lengkap untuk struk...",
                            multiline: true
                        })
                    ),
                    React.createElement(View, { style: styles.inputGroup },
                        React.createElement(View, { style: styles.inputLabelRow },
                            React.createElement(Phone, { size: 16, color: "#64748b" }),
                            React.createElement(Text, { style: styles.inputLabel }, "Nomor Telepon")
                        ),
                        React.createElement(TextInput, {
                            style: styles.input,
                            value: branchData.phone,
                            onChangeText: function(text) { setBranchData(Object.assign({}, branchData, { phone: text })); },
                            placeholder: "e.g. 0812-xxxx-xxxx",
                            keyboardType: "phone-pad"
                        })
                    ),
                    React.createElement(TouchableOpacity, { 
                        style: [styles.saveButton, saving && { opacity: 0.7 }], 
                        onPress: handleSaveBranch,
                        disabled: saving
                    },
                        saving ? React.createElement(ActivityIndicator, { size: "small", color: "#fff" }) : React.createElement(React.Fragment, null,
                            React.createElement(Save, { size: 18, color: "#fff", style: { marginRight: 8 } }),
                            React.createElement(Text, { style: styles.saveButtonText }, "Simpan Profil")
                        )
                    )
                )
            ),
            React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "WiFi Voucher"),
                React.createElement(View, { style: styles.card },
                    React.createElement(View, { style: styles.switchItem },
                        React.createElement(View, { style: styles.switchContent },
                            React.createElement(View, { style: styles.switchLabelRow },
                                React.createElement(Wifi, { size: 18, color: "#2563eb" }),
                                React.createElement(Text, { style: [styles.switchLabel, { color: '#1e40af' }] }, "Aktifkan WiFi Voucher")
                            ),
                            React.createElement(Text, { style: styles.switchSubtitle }, "Cetak kode voucher otomatis pada struk")
                        ),
                        React.createElement(Switch, {
                            value: (storeSettings ? storeSettings.enable_wifi_vouchers : false),
                            onValueChange: function(val) { toggleSetting('enable_wifi_vouchers', val); },
                            trackColor: { false: '#e2e8f0', true: '#2563eb' }
                        })
                    ),
                    (storeSettings && storeSettings.enable_wifi_vouchers) ? React.createElement(View, { style: { marginTop: 12 } },
                        React.createElement(View, { style: styles.divider }),
                        React.createElement(View, { style: { flexDirection: 'row' } },
                            React.createElement(View, { style: { flex: 1, marginRight: 12 } },
                                React.createElement(Text, { style: styles.inputLabel }, "Minimal Belanja (Rp)"),
                                React.createElement(TextInput, {
                                    style: [styles.input, { marginTop: 8 }],
                                    value: String(storeSettings.wifi_voucher_min_amount || 0),
                                    onChangeText: function(text) { setStoreSettings(Object.assign({}, storeSettings, { wifi_voucher_min_amount: parseInt(text) || 0 })); },
                                    onBlur: function() { toggleSetting('wifi_voucher_min_amount', storeSettings.wifi_voucher_min_amount); },
                                    placeholder: "50000",
                                    keyboardType: "numeric"
                                })
                            ),
                            React.createElement(View, { style: { flex: 1 } },
                                React.createElement(Text, { style: styles.inputLabel }, "Kelipatan (Rp)"),
                                React.createElement(TextInput, {
                                    style: [styles.input, { marginTop: 8 }],
                                    value: String(storeSettings.wifi_voucher_multiplier || 0),
                                    onChangeText: function(text) { setStoreSettings(Object.assign({}, storeSettings, { wifi_voucher_multiplier: parseInt(text) || 0 })); },
                                    onBlur: function() { toggleSetting('wifi_voucher_multiplier', storeSettings.wifi_voucher_multiplier); },
                                    placeholder: "20000",
                                    keyboardType: "numeric"
                                })
                            )
                        ),
                        React.createElement(View, null,
                            React.createElement(Text, { style: styles.inputLabel }, "Pesan Header Voucher"),
                            React.createElement(TextInput, {
                                style: [styles.input, { marginTop: 8 }],
                                value: storeSettings.wifi_voucher_notice || '',
                                onChangeText: function(text) { setStoreSettings(Object.assign({}, storeSettings, { wifi_voucher_notice: text })); },
                                onBlur: function() { toggleSetting('wifi_voucher_notice', storeSettings.wifi_voucher_notice); },
                                placeholder: "Gunakan kode ini untuk WiFi"
                            })
                        )
                    ) : null
                )
            ),
            isAdmin ? React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Operasional & Keamanan"),
                React.createElement(View, { style: styles.card },
                    React.createElement(View, { style: styles.switchItem },
                        React.createElement(View, { style: styles.switchContent },
                            React.createElement(View, { style: styles.switchLabelRow },
                                React.createElement(Shield, { size: 18, color: "#64748b" }),
                                React.createElement(Text, { style: styles.switchLabel }, "Sesi Kasir Wajib")
                            ),
                            React.createElement(Text, { style: styles.switchSubtitle }, "Wajib buka shift sebelum transaksi")
                        ),
                        React.createElement(Switch, {
                            value: (storeSettings ? storeSettings.require_mandatory_session : true),
                            onValueChange: function(val) { toggleSetting('require_mandatory_session', val); },
                            trackColor: { false: '#e2e8f0', true: '#f97316' }
                        })
                    ),
                    React.createElement(View, { style: styles.divider }),
                    React.createElement(View, { style: styles.switchItem },
                        React.createElement(View, { style: styles.switchContent },
                            React.createElement(View, { style: styles.switchLabelRow },
                                React.createElement(Shield, { size: 18, color: "#ea580c" }),
                                React.createElement(Text, { style: styles.switchLabel }, "Kasir Bisa Buka Laporan")
                            ),
                            React.createElement(Text, { style: styles.switchSubtitle }, "Izin melihat Laporan Penjualan & Grafik")
                        ),
                        React.createElement(Switch, {
                            value: (storeSettings ? storeSettings.cashier_can_view_reports : false),
                            onValueChange: function(val) { toggleSetting('cashier_can_view_reports', val); },
                            trackColor: { false: '#e2e8f0', true: '#ea580c' }
                        })
                    ),
                    React.createElement(View, { style: styles.divider }),
                    React.createElement(View, { style: styles.switchItem },
                        React.createElement(View, { style: styles.switchContent },
                            React.createElement(View, { style: styles.switchLabelRow },
                                React.createElement(Store, { size: 18, color: "#ea580c" }),
                                React.createElement(Text, { style: styles.switchLabel }, "Kasir Bisa Lihat Riwayat Sesi")
                            ),
                            React.createElement(Text, { style: styles.switchSubtitle }, "Izin membuka riwayat shift sebelumnya")
                        ),
                        React.createElement(Switch, {
                            value: (storeSettings ? storeSettings.cashier_can_view_session_history : false),
                            onValueChange: function(val) { toggleSetting('cashier_can_view_session_history', val); },
                            trackColor: { false: '#e2e8f0', true: '#ea580c' }
                        })
                    ),
                    React.createElement(View, { style: styles.divider }),
                    React.createElement(View, { style: styles.switchItem },
                        React.createElement(View, { style: styles.switchContent },
                            React.createElement(View, { style: styles.switchLabelRow },
                                React.createElement(Printer, { size: 18, color: "#ea580c" }),
                                React.createElement(Text, { style: styles.switchLabel }, "Kasir Bisa Cetak Bukti Kas")
                            ),
                            React.createElement(Text, { style: styles.switchSubtitle }, "Izin cetak struk Kas Masuk/Kas Keluar")
                        ),
                        React.createElement(Switch, {
                            value: (storeSettings ? storeSettings.cashier_can_print_financial_receipt : false),
                            onValueChange: function(val) { toggleSetting('cashier_can_print_financial_receipt', val); },
                            trackColor: { false: '#e2e8f0', true: '#ea580c' }
                        })
                    ),
                    React.createElement(View, { style: styles.divider }),
                    React.createElement(View, { style: styles.switchItem },
                        React.createElement(View, { style: styles.switchContent },
                            React.createElement(View, { style: styles.switchLabelRow },
                                React.createElement(Printer, { size: 18, color: "#ea580c" }),
                                React.createElement(Text, { style: styles.switchLabel }, "Kasir Bisa Cetak Lap. Omzet")
                            ),
                            React.createElement(Text, { style: styles.switchSubtitle }, "Izin cetak ringkasan laporan penjualan")
                        ),
                        React.createElement(Switch, {
                            value: (storeSettings ? storeSettings.cashier_can_print_sales_summary : false),
                            onValueChange: function(val) { toggleSetting('cashier_can_print_sales_summary', val); },
                            trackColor: { false: '#e2e8f0', true: '#ea580c' }
                        })
                    ),
                    React.createElement(View, { style: styles.divider }),
                    React.createElement(View, { style: styles.switchItem },
                        React.createElement(View, { style: styles.switchContent },
                            React.createElement(View, { style: styles.switchLabelRow },
                                React.createElement(Scissors, { size: 18, color: "#ea580c" }),
                                React.createElement(Text, { style: styles.switchLabel }, "Potong Kertas Otomatis")
                            ),
                            React.createElement(Text, { style: styles.switchSubtitle }, "Kirim perintah potong kertas ke printer")
                        ),
                        React.createElement(Switch, {
                            value: (storeSettings ? storeSettings.enable_auto_cut : true),
                            onValueChange: function(val) { toggleSetting('enable_auto_cut', val); },
                            trackColor: { false: '#e2e8f0', true: '#ea580c' }
                        })
                    ),
                    React.createElement(View, { style: styles.divider }),
                    React.createElement(View, { style: styles.switchItem },
                        React.createElement(View, { style: styles.switchContent },
                            React.createElement(View, { style: styles.switchLabelRow },
                                React.createElement(Lock, { size: 18, color: "#ea580c" }),
                                React.createElement(Text, { style: styles.switchLabel }, "Batasi Diskon (Butuh PIN)")
                            ),
                            React.createElement(Text, { style: styles.switchSubtitle }, "Kasir butuh PIN Manager untuk beri diskon")
                        ),
                        React.createElement(Switch, {
                            value: (storeSettings ? storeSettings.restrict_discount : false),
                            onValueChange: function(val) { toggleSetting('restrict_discount', val); },
                            trackColor: { false: '#e2e8f0', true: '#ea580c' }
                        })
                    )
                )
            ) : null,
            React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Jam Operasional"),
                React.createElement(View, { style: styles.card },
                    React.createElement(View, { style: { flexDirection: 'row', marginBottom: 20 } },
                        React.createElement(View, { style: { flex: 1 } },
                            React.createElement(View, { style: styles.inputLabelRow },
                                React.createElement(Clock, { size: 16, color: "#64748b" }),
                                React.createElement(Text, { style: styles.inputLabel }, "Jam Buka")
                            ),
                            React.createElement(TextInput, {
                                style: styles.input,
                                value: (storeSettings ? storeSettings.opening_time : '08:00'),
                                onChangeText: function(text) { setStoreSettings(Object.assign({}, storeSettings, { opening_time: text })); },
                                onBlur: function() { toggleSetting('opening_time', storeSettings.opening_time); },
                                placeholder: "08:00"
                            })
                        ),
                        React.createElement(View, { style: { flex: 1 } },
                            React.createElement(View, { style: styles.inputLabelRow },
                                React.createElement(Clock, { size: 16, color: "#64748b" }),
                                React.createElement(Text, { style: styles.inputLabel }, "Jam Tutup")
                            ),
                            React.createElement(TextInput, {
                                style: styles.input,
                                value: (storeSettings ? storeSettings.closing_time : '22:00'),
                                onChangeText: function(text) { setStoreSettings(Object.assign({}, storeSettings, { closing_time: text })); },
                                onBlur: function() { toggleSetting('closing_time', storeSettings.closing_time); },
                                placeholder: "22:00"
                            })
                        )
                    ),
                    React.createElement(View, { style: styles.inputLabelRow },
                        React.createElement(Calendar, { size: 16, color: "#64748b" }),
                        React.createElement(Text, { style: styles.inputLabel }, "Hari Operasional")
                    ),
                    React.createElement(View, { style: styles.daysContainer },
                        days.map(function(day) {
                            var isActive = storeSettings && storeSettings.working_days && storeSettings.working_days.indexOf(day) !== -1;
                            return React.createElement(TouchableOpacity, {
                                key: day,
                                style: [styles.dayChip, isActive && styles.dayChipActive],
                                onPress: function() { toggleWorkingDay(day); }
                            },
                                React.createElement(Text, { style: [styles.dayText, isActive && styles.dayTextActive] }, day.substring(0, 3))
                            );
                        })
                    )
                )
            ),
            React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Pajak & Biaya Layanan"),
                React.createElement(View, { style: styles.card },
                    React.createElement(View, { style: { flexDirection: 'row' } },
                        React.createElement(View, { style: { flex: 1, marginRight: 12 } },
                            React.createElement(View, { style: styles.inputLabelRow },
                                React.createElement(Percent, { size: 16, color: "#64748b" }),
                                React.createElement(Text, { style: styles.inputLabel }, "Pajak (%)")
                            ),
                            React.createElement(TextInput, {
                                style: styles.input,
                                value: String(storeSettings ? storeSettings.tax_rate : 0),
                                onChangeText: function(text) { setStoreSettings(Object.assign({}, storeSettings, { tax_rate: parseFloat(text) || 0 })); },
                                onBlur: function() { toggleSetting('tax_rate', storeSettings.tax_rate); },
                                placeholder: "0",
                                keyboardType: "numeric"
                            })
                        ),
                        React.createElement(View, { style: { flex: 1 } },
                            React.createElement(View, { style: styles.inputLabelRow },
                                React.createElement(Percent, { size: 16, color: "#64748b" }),
                                React.createElement(Text, { style: styles.inputLabel }, "Layanan (%)")
                            ),
                            React.createElement(TextInput, {
                                style: styles.input,
                                value: String(storeSettings ? storeSettings.service_rate : 0),
                                onChangeText: function(text) { setStoreSettings(Object.assign({}, storeSettings, { service_rate: parseFloat(text) || 0 })); },
                                onBlur: function() { toggleSetting('service_rate', storeSettings.service_rate); },
                                placeholder: "0",
                                keyboardType: "numeric"
                            })
                        )
                    )
                )
            ),
            React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Templat Struk"),
                React.createElement(View, { style: styles.card },
                    React.createElement(View, { style: styles.inputGroup },
                        React.createElement(View, { style: styles.inputLabelRow },
                            React.createElement(Layout, { size: 16, color: "#64748b" }),
                            React.createElement(Text, { style: styles.inputLabel }, "Header Struk (Nama Toko)")
                        ),
                        React.createElement(TextInput, {
                            style: styles.input,
                            value: (storeSettings ? storeSettings.receipt_header : ''),
                            onChangeText: function(text) { setStoreSettings(Object.assign({}, storeSettings, { receipt_header: text })); },
                            onBlur: function() { toggleSetting('receipt_header', storeSettings.receipt_header); },
                            placeholder: "WINNY POS"
                        })
                    ),
                    React.createElement(View, { style: styles.inputGroup },
                        React.createElement(View, { style: styles.inputLabelRow },
                            React.createElement(ImageIcon, { size: 16, color: "#64748b" }),
                            React.createElement(Text, { style: styles.inputLabel }, "URL Logo (Sync dari Web)")
                        ),
                        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                            React.createElement(TextInput, {
                                style: [styles.input, { flex: 1, marginRight: 12 }],
                                value: (storeSettings ? storeSettings.receipt_logo_url : ''),
                                onChangeText: function(text) { setStoreSettings(Object.assign({}, storeSettings, { receipt_logo_url: text })); },
                                onBlur: function() { toggleSetting('receipt_logo_url', storeSettings.receipt_logo_url); },
                                placeholder: "https://example.com/logo.png"
                            }),
                            (storeSettings && storeSettings.receipt_logo_url) ? React.createElement(View, { style: styles.logoPreviewContainer },
                                React.createElement(Image, { 
                                    source: { uri: storeSettings.receipt_logo_url }, 
                                    style: styles.logoPreview,
                                    resizeMode: "contain"
                                })
                            ) : React.createElement(View, { style: [styles.logoPreviewContainer, { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }] },
                                React.createElement(ImageIcon, { size: 20, color: "#cbd5e1" })
                            )
                        )
                    ),
                    React.createElement(View, { style: styles.inputGroup },
                        React.createElement(View, { style: styles.inputLabelRow },
                            React.createElement(Layout, { size: 16, color: "#64748b" }),
                            React.createElement(Text, { style: styles.inputLabel }, "Footer Struk (Pesan)")
                        ),
                        React.createElement(TextInput, {
                            style: styles.input,
                            value: (storeSettings ? storeSettings.receipt_footer : ''),
                            onChangeText: function(text) { setStoreSettings(Object.assign({}, storeSettings, { receipt_footer: text })); },
                            onBlur: function() { toggleSetting('receipt_footer', storeSettings.receipt_footer); },
                            placeholder: "Terima Kasih"
                        })
                    )
                )
            ),
            React.createElement(View, { style: { height: 40 } })
        ),
        React.createElement(Modal, { transparent: true, visible: showSuccess, animationType: "fade", onRequestClose: function() { setShowSuccess(false); } },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.successCard },
                    React.createElement(View, { style: styles.successIconOuter },
                        React.createElement(View, { style: styles.successIconInner },
                            React.createElement(CheckCircle2, { size: 32, color: "#fff" })
                        )
                    ),
                    React.createElement(Text, { style: styles.successTitle }, "Berhasil!"),
                    React.createElement(Text, { style: styles.successMessage }, successMsg)
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4, marginRight: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    scrollContent: { paddingTop: 8 },
    section: { marginTop: 24, paddingHorizontal: 16 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, elevation: 3, borderWidth: 1, borderColor: '#f1f5f9' },
    inputGroup: { marginBottom: 20 },
    inputLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginLeft: 6 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#334155' },
    saveButton: { flexDirection: 'row', backgroundColor: '#ea580c', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8, elevation: 4 },
    saveButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    switchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    switchContent: { flex: 1 },
    switchLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    switchLabel: { fontSize: 15, fontWeight: '600', color: '#334155', marginLeft: 8 },
    switchSubtitle: { fontSize: 12, color: '#94a3b8' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 4 },
    daysContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
    dayChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', minWidth: 50, alignItems: 'center' },
    dayChipActive: { backgroundColor: '#fff7ed', borderColor: '#f97316' },
    dayText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    dayTextActive: { color: '#f97316' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center' },
    successCard: { backgroundColor: '#fff', borderRadius: 28, padding: 30, width: '80%', maxWidth: 320, alignItems: 'center', elevation: 10 },
    successIconOuter: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    successIconInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center', elevation: 4 },
    successTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    successMessage: { fontSize: 14, color: '#64748b', textAlign: 'center' },
    logoPreviewContainer: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', backgroundColor: '#fff' },
    logoPreview: { width: '100%', height: '100%' },
    refreshButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }
});
