import { useState, useEffect } from 'react';
import { Settings, User, Monitor, Globe, Bell, Shield, Save, Clock, Calendar, Printer, FileText, LayoutGrid, Plus, Trash2, Edit, CreditCard, CheckCircle2, XCircle, Database, Upload, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { printerService } from '../../lib/PrinterService';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

import { supabase } from '../../lib/supabase';

interface SettingsViewProps {
    settings: any;
    onUpdateSettings: (settings: any) => void;
    tables?: any[];
    onTableAction?: (action: 'create' | 'update' | 'delete', data: any) => void;
    paymentMethods?: any[];
    onPaymentMethodAction?: (action: 'create' | 'update' | 'delete', data: any) => void;
}

export function SettingsView({
    settings,
    onUpdateSettings,
    tables = [],
    onTableAction,
    paymentMethods = [],
    onPaymentMethodAction
}: SettingsViewProps) {
    const [activeTab, setActiveTab] = useState('general');
    const [localSettings, setLocalSettings] = useState(settings);
    const [hasChanges, setHasChanges] = useState(false);

    // Profile Settings State
    const { user } = useAuth();
    const [profileName, setProfileName] = useState('');
    const [updatingProfile, setUpdatingProfile] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileName(user.user_metadata?.name || user.user_metadata?.full_name || '');
        }
    }, [user]);

    const handleUpdateProfile = async () => {
        if (!user) return;
        setUpdatingProfile(true);
        try {
            // 1. Update Auth Metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: { name: profileName, full_name: profileName }
            });
            if (authError) throw authError;

            // 2. Update Profiles Table
            const { error: dbError } = await supabase
                .from('profiles')
                .update({ name: profileName, full_name: profileName })
                .eq('id', user.id);

            if (dbError) {
                console.warn('Profile DB update failed:', dbError);
            }

            toast.success('Profil berhasil diperbarui!');
        } catch (error: any) {
            toast.error('Gagal update profil: ' + error.message);
        } finally {
            setUpdatingProfile(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingLogo(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError, data } = await supabase.storage
                .from('receipt-logos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('receipt-logos')
                .getPublicUrl(filePath);

            const updated = { ...localSettings, receipt_logo_url: publicUrl };
            handleLocalChange(updated);
            toast.success('Logo produk berhasil diunggah');
        } catch (error: any) {
            toast.error('Gagal upload logo: ' + error.message);
        } finally {
            setUploadingLogo(false);
        }
    };

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleLocalChange = (newSettings: any) => {
        setLocalSettings(newSettings);
        setHasChanges(true);
    };

    const handleThemeAutoSave = (mode: 'light' | 'dark') => {
        const updated = { ...localSettings, theme_mode: mode };
        setLocalSettings(updated);
        // Immediate save for UX
        onUpdateSettings(updated);
    };

    const tabs = [
        { id: 'general', label: 'Umum', icon: Globe },
        { id: 'account', label: 'Akun', icon: User },
        { id: 'hours', label: 'Jam Kerja', icon: Clock },
        { id: 'tables', label: 'Meja', icon: LayoutGrid },
        { id: 'appearance', label: 'Tampilan', icon: Monitor },
        { id: 'notifications', label: 'Notifikasi', icon: Bell },
        { id: 'printer', label: 'Printer', icon: Printer },
        { id: 'receipt', label: 'Templat Struk', icon: FileText },
        { id: 'payment_methods', label: 'Metode Pembayaran', icon: CreditCard },
        { id: 'security', label: 'Keamanan', icon: Shield },
        { id: 'backup', label: 'Backup & Data', icon: Database },
    ];

    // Password Change State
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [loadingPassword, setLoadingPassword] = useState(false);

    const handleUpdatePassword = async () => {
        if (!passwordForm.new || passwordForm.new !== passwordForm.confirm) {
            return toast.error('Password baru tidak cocok atau kosong');
        }
        setLoadingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
            if (error) throw error;
            toast.success('Password berhasil diperbarui');
            setPasswordForm({ current: '', new: '', confirm: '' });
        } catch (err: any) {
            toast.error('Gagal update password: ' + err.message);
        } finally {
            setLoadingPassword(false);
        }
    };

    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    // Table Management State
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    const [editingTable, setEditingTable] = useState<any>(null);
    const [tableForm, setTableForm] = useState({ number: '', capacity: 4 });

    const handleOpenTableModal = (table?: any) => {
        if (table) {
            setEditingTable(table);
            setTableForm({ number: table.number, capacity: table.capacity });
        } else {
            setEditingTable(null);
            setTableForm({ number: '', capacity: 4 });
        }
        setIsTableModalOpen(true);
    };

    const handleSubtitleTable = () => { // Corrected name to generic handleSaveTable if needed, but keeping existing
        if (!tableForm.number) return toast.error('Nomor meja harus diisi');
        if (tableForm.capacity < 1) return toast.error('Kapasitas minimal 1');

        if (onTableAction) {
            if (editingTable) {
                onTableAction('update', { id: editingTable.id, ...tableForm });
            } else {
                onTableAction('create', tableForm);
            }
        }
        setIsTableModalOpen(false);
    };

    // Payment Method Management State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<any>(null);
    const [paymentForm, setPaymentForm] = useState({ name: '', type: 'digital', is_active: true });

    const handleOpenPaymentModal = (method?: any) => {
        if (method) {
            setEditingPayment(method);
            setPaymentForm({ name: method.name, type: method.type, is_active: method.is_active });
        } else {
            setEditingPayment(null);
            setPaymentForm({ name: '', type: 'digital', is_active: true });
        }
        setIsPaymentModalOpen(true);
    };

    const handleSavePaymentMethod = () => {
        if (!paymentForm.name) return toast.error('Nama metode harus diisi');
        if (onPaymentMethodAction) {
            if (editingPayment) {
                onPaymentMethodAction('update', { id: editingPayment.id, ...paymentForm, is_static: editingPayment.is_static });
            } else {
                onPaymentMethodAction('create', paymentForm);
            }
        }
        setIsPaymentModalOpen(false);
    };

    const handleSave = () => {
        if (hasChanges) {
            onUpdateSettings(localSettings);
            setHasChanges(false);
        } else {
            toast.info('Tidak ada perubahan untuk disimpan');
        }
    };

    // --- BACKUP & RESTORE LOGIC ---
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreProgress, setRestoreProgress] = useState('');

    const handleBackup = async () => {
        setIsBackingUp(true);
        toast.info('Memulai proses backup data...');
        try {
            const tablesToBackup = [
                'branches', 'store_settings', 'categories', 'units', 'brands',
                'products', 'ingredients', 'tables', 'shifts', 'employees',
                'contacts', 'sales', 'sale_items', 'purchases', 'stock_movements',
                'attendance_logs', 'payrolls', 'shift_schedules', 'product_addons', 'product_recipes',
                'payment_methods', 'departments'
            ];

            const backupData: any = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                tables: {}
            };

            for (const table of tablesToBackup) {
                const { data, error } = await supabase.from(table).select('*');
                if (error) {
                    console.warn(`Skipping table ${table} due to error:`, error.message);
                    continue;
                }
                backupData.tables[table] = data || [];
            }

            // Create Blob and Download
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-winny-pos-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('Backup selesai! File telah didownload.');

        } catch (err: any) {
            console.error('Backup failed:', err);
            toast.error('Backup gagal: ' + err.message);
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!confirm('PERINGATAN: Restore akan menimpa/menggabungkan data yang ada. Pastikan Anda punya backup sebelumnya. Lanjutkan?')) {
            event.target.value = ''; // Reset input
            return;
        }

        setIsRestoring(true);
        setRestoreProgress('Membaca file...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const backupData = JSON.parse(content);

                if (!backupData.tables) throw new Error('Format file backup tidak valid.');

                const tablesToRestore = [
                    'branches', 'store_settings', 'categories', 'units', 'brands',
                    'payment_methods', 'departments',
                    'products', 'ingredients', 'tables', 'shifts',
                    'employees', 'contacts',
                    'sales', 'sale_items', 'purchases', 'stock_movements',
                    'attendance_logs', 'payrolls', 'shift_schedules',
                    'product_addons', 'product_recipes'
                ];

                for (const table of tablesToRestore) {
                    const rows = backupData.tables[table];
                    if (rows && rows.length > 0) {
                        setRestoreProgress(`Memulihkan ${table} (${rows.length} data)...`);

                        // Process in chunks of 100 to avoid request size limits
                        const chunkSize = 100;
                        for (let i = 0; i < rows.length; i += chunkSize) {
                            const chunk = rows.slice(i, i + chunkSize);
                            const { error } = await supabase.from(table).upsert(chunk);
                            if (error) {
                                console.error(`Error restoring ${table} chunk ${i}:`, error.message);
                                // Optional: throw error to stop, or continue "best effort"
                            }
                        }
                    }
                }

                toast.success('Restore data selesai! Silakan refresh halaman.');

            } catch (err: any) {
                console.error('Restore failed:', err);
                toast.error('Restore gagal: ' + err.message);
            } finally {
                setIsRestoring(false);
                setRestoreProgress('');
                event.target.value = ''; // Reset input
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="p-8 flex gap-8 h-full bg-gray-50/50 dark:bg-gray-900/50">
            {/* Sidebar Settings */}
            <div className="w-56 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
                <div className="mb-6 px-2">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Pengaturan</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Kelola preferensi Anda</p>
                </div>

                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 text-primary'
                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                    >
                        <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-primary' : 'text-gray-400'}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Sub-content Area */}
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 overflow-y-auto">
                {activeTab === 'general' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Pengaturan Umum</h3>
                            <p className="text-sm text-gray-500">Konfigurasi informasi dasar aplikasi.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-gray-700">Nama Toko</label>
                                <input
                                    type="text"
                                    value={localSettings.store_name || ''}
                                    onChange={e => handleLocalChange({ ...localSettings, store_name: e.target.value })}
                                    className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-gray-700">Nomor Telepon</label>
                                <input
                                    type="text"
                                    value={localSettings.phone || ''}
                                    onChange={e => handleLocalChange({ ...localSettings, phone: e.target.value })}
                                    className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="+62..."
                                />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-gray-700">Alamat</label>
                                <textarea
                                    value={localSettings.address || ''}
                                    onChange={e => handleLocalChange({ ...localSettings, address: e.target.value })}
                                    className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 h-24 resize-none"
                                    placeholder="Alamat lengkap..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Pajak (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={localSettings.tax_rate || 0}
                                        onChange={e => handleLocalChange({ ...localSettings, tax_rate: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="0"
                                        min="0"
                                        max="100"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Layanan (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={localSettings.service_rate || 0}
                                        onChange={e => handleLocalChange({ ...localSettings, service_rate: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="0"
                                        min="0"
                                        max="100"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800">
                                <div className="space-y-1">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-orange-600" /> Mode Offline (Darurat)
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                                        Paksa aplikasi berjalan tanpa internet. Aktifkan jika koneksi tidak stabil agar transaksi lebih cepat (data disimpan lokal).
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold ${localSettings.force_offline ? 'text-orange-600' : 'text-gray-400'}`}>
                                        {localSettings.force_offline ? 'Aktif' : 'Non-aktif'}
                                    </span>
                                    <Switch
                                        checked={localSettings.force_offline || false}
                                        onCheckedChange={(checked: boolean) => {
                                            const updated = { ...localSettings, force_offline: checked };
                                            handleLocalChange(updated);
                                            // Also save immediately to localStorage to ensure it hits instantly 
                                            // (though persistent save depends on parent)
                                            localStorage.setItem('force_offline', checked ? 'true' : 'false');
                                            // Dispatch event for same-window listeners
                                            window.dispatchEvent(new Event('force-offline-change'));

                                            // Force reload might be needed to apply to network listeners, 
                                            // but we will make listeners reactive instead.
                                            if (checked) {
                                                toast.warning('Mode Offline Diaktifkan: Koneksi internet akan diabaikan.');
                                            } else {
                                                toast.success('Mode Online Diaktifkan: Mencoba sinkronisasi...');
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Profil Akun</h3>
                            <p className="text-sm text-gray-500">Kelola informasi pribadi Anda.</p>
                        </div>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary border-4 border-white shadow-lg">
                                {profileName ? profileName.charAt(0).toUpperCase() : 'A'}
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-gray-800">{user?.email}</h4>
                                <p className="text-xs text-gray-500 capitalize">{user?.user_metadata?.role || 'User'}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-gray-700">Nama Lengkap</label>
                                <input
                                    type="text"
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Nama lengkap Anda"
                                />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-gray-700">Alamat Email</label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                />
                                <p className="text-[10px] text-gray-400">Email tidak dapat diubah.</p>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button
                                    onClick={handleUpdateProfile}
                                    disabled={updatingProfile}
                                    className="bg-primary hover:bg-primary/90 text-white"
                                >
                                    {updatingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'hours' && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Pengaturan Jam Kerja</h3>
                            <p className="text-sm text-gray-500">Atur jam operasional dan kebijakan waktu perusahaan.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Jam Buka Toko</label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="time"
                                        value={localSettings.opening_time || '08:00'}
                                        onChange={e => handleLocalChange({ ...localSettings, opening_time: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Jam Tutup Toko</label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="time"
                                        value={localSettings.closing_time || '22:00'}
                                        onChange={e => handleLocalChange({ ...localSettings, closing_time: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-bold text-gray-700 block">Hari Kerja Operasional</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {days.map(day => (
                                    <button
                                        key={day}
                                        onClick={() => {
                                            const currentDays = localSettings.working_days || [];
                                            const updated = currentDays.includes(day)
                                                ? currentDays.filter((d: string) => d !== day)
                                                : [...currentDays, day];
                                            handleLocalChange({ ...localSettings, working_days: updated });
                                        }}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${(localSettings.working_days || []).includes(day)
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300'
                                            }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 space-y-4">
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-orange-600" />
                                <h4 className="font-bold text-orange-800">Kebijakan Toleransi</h4>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-orange-700">Toleransi Keterlambatan (Menit)</label>
                                <input
                                    type="number"
                                    value={localSettings.late_tolerance || 0}
                                    onChange={e => handleLocalChange({ ...localSettings, late_tolerance: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none bg-white"
                                    placeholder="contoh: 15"
                                />
                                <p className="text-[10px] text-orange-600/70">Karyawan tidak akan dianggap terlambat jika absen dalam rentang waktu ini setelah shift dimulai.</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'tables' && (
                    <div className="max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Manajemen Meja</h3>
                                <p className="text-sm text-gray-500">Atur layout dan kapasitas meja restoran.</p>
                            </div>
                            <Button onClick={() => handleOpenTableModal()}>
                                <Plus className="w-4 h-4 mr-2" /> Tambah Meja
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {tables.map(table => (
                                <div key={table.id} className="group relative bg-white border border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-primary hover:shadow-lg hover:shadow-primary/5 transition-all">
                                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        <div className="font-bold text-lg">{table.number}</div>
                                    </div>
                                    <p className="text-xs text-gray-500 font-medium">{table.capacity} Kursi</p>

                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenTableModal(table)}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                                        >
                                            <Edit className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => onTableAction && onTableAction('delete', { id: table.id })}
                                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => handleOpenTableModal()}
                                className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all text-gray-400 hover:text-primary"
                            >
                                <Plus className="w-8 h-8" />
                                <span className="text-xs font-bold">Tambah</span>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'appearance' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Tampilan</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Sesuaikan tampilan dan nuansa aplikasi.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleThemeAutoSave('light')}
                                className={`border p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all ${localSettings.theme_mode !== 'dark'
                                    ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Monitor className={`w-5 h-5 ${localSettings.theme_mode !== 'dark' ? 'text-primary' : 'text-gray-400'}`} />
                                    <span className={`font-medium ${localSettings.theme_mode !== 'dark' ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>Mode Terang</span>
                                </div>
                                <div className={`w-4 h-4 rounded-full border ${localSettings.theme_mode !== 'dark' ? 'border-primary bg-primary' : 'border-gray-300'}`} />
                            </button>
                            <button
                                onClick={() => handleThemeAutoSave('dark')}
                                className={`border p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all ${localSettings.theme_mode === 'dark'
                                    ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Monitor className={`w-5 h-5 ${localSettings.theme_mode === 'dark' ? 'text-primary' : 'text-gray-400'}`} />
                                    <span className={`font-medium ${localSettings.theme_mode === 'dark' ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>Mode Gelap</span>
                                </div>
                                <div className={`w-4 h-4 rounded-full border ${localSettings.theme_mode === 'dark' ? 'border-primary bg-primary' : 'border-gray-300'}`} />
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'printer' && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Pengaturan Printer Bluetooth</h3>
                            <p className="text-sm text-gray-500">Hubungkan printer thermal Bluetooth untuk mencetak tiket Dapur dan Bar.</p>
                        </div>

                        <div className="grid gap-6">
                            {/* Kitchen Printer */}
                            <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/30 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                            <Printer className="w-5 h-5 text-orange-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800">Printer Dapur</h4>
                                            <p className="text-xs text-gray-500">Untuk mencetak pesanan makanan</p>
                                        </div>
                                    </div>
                                    {printerService.getConnectedPrinter('Kitchen') ? (
                                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {printerService.getConnectedPrinter('Kitchen')}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400">Belum Terhubung</span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await printerService.connect('Kitchen');
                                                toast.success('Printer Dapur terhubung!');
                                            } catch (e) {
                                                toast.error('Gagal menghubungkan printer. Pastikan Bluetooth aktif.');
                                            }
                                        }}
                                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                                    >
                                        Pair Printer Dapur
                                    </Button>
                                    <Button
                                        disabled={!printerService.getConnectedPrinter('Kitchen')}
                                        onClick={async () => {
                                            await printerService.printTicket('Kitchen', {
                                                orderNo: 'TEST-001',
                                                tableNo: 'T1',
                                                waiterName: 'Admin',
                                                time: new Date().toLocaleTimeString(),
                                                items: [{ name: 'Test Print (Dapur)', quantity: 1 }]
                                            });
                                        }}
                                        variant="outline"
                                    >
                                        Test Print
                                    </Button>
                                </div>
                            </div>

                            {/* Bar Printer */}
                            <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/30 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                            <Printer className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800">Printer Bar</h4>
                                            <p className="text-xs text-gray-500">Untuk mencetak pesanan minuman</p>
                                        </div>
                                    </div>
                                    {printerService.getConnectedPrinter('Bar') ? (
                                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {printerService.getConnectedPrinter('Bar')}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400">Belum Terhubung</span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await printerService.connect('Bar');
                                                toast.success('Printer Bar terhubung!');
                                            } catch (e) {
                                                toast.error('Gagal menghubungkan printer.');
                                            }
                                        }}
                                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                                    >
                                        Pair Printer Bar
                                    </Button>
                                    <Button
                                        disabled={!printerService.getConnectedPrinter('Bar')}
                                        onClick={async () => {
                                            await printerService.printTicket('Bar', {
                                                orderNo: 'TEST-001',
                                                tableNo: 'T1',
                                                waiterName: 'Admin',
                                                time: new Date().toLocaleTimeString(),
                                                items: [{ name: 'Test Print (Bar)', quantity: 1 }]
                                            });
                                        }}
                                        variant="outline"
                                    >
                                        Test Print
                                    </Button>
                                </div>
                            </div>

                            {/* Cashier Printer */}
                            <div className="p-6 rounded-2xl border border-primary/20 bg-primary/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <Printer className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800">Printer Kasir</h4>
                                            <p className="text-xs text-gray-500">Untuk mencetak struk belanja pelanggan</p>
                                        </div>
                                    </div>
                                    {printerService.getConnectedPrinter('Cashier') ? (
                                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {printerService.getConnectedPrinter('Cashier')}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400">Belum Terhubung</span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await printerService.connect('Cashier');
                                                toast.success('Printer Kasir terhubung!');
                                            } catch (e) {
                                                toast.error('Gagal menghubungkan printer.');
                                            }
                                        }}
                                        className="flex-1 bg-primary text-white hover:bg-primary/90 shadow-md"
                                    >
                                        Pair Printer Kasir
                                    </Button>
                                    <Button
                                        disabled={!printerService.getConnectedPrinter('Cashier')}
                                        onClick={async () => {
                                            await printerService.printReceipt({
                                                orderNo: 'POS-001',
                                                tableNo: 'T1',
                                                waiterName: 'Admin',
                                                time: new Date().toLocaleString(),
                                                items: [{ name: 'Test Product', quantity: 1, price: 15000 }],
                                                subtotal: 15000,
                                                discount: 0,
                                                tax: 0,
                                                total: 15000,
                                                paymentType: 'Tunai',
                                                amountPaid: 20000,
                                                change: 5000
                                            });
                                        }}
                                        variant="outline"
                                    >
                                        Test Print Struk
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-2">
                            <h4 className="font-bold text-blue-800 text-sm">Catatan Penting</h4>
                            <p className="text-xs text-blue-700/80 leading-relaxed">
                                Karena batasan keamanan browser, Anda perlu menghubungkan ulang printer setiap kali aplikasi dimuat ulang.
                                Pastikan printer thermal Anda dalam mode "Discoverable" sebelum menekan tombol Pair.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'receipt' && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Pengaturan Templat Struk</h3>
                            <p className="text-sm text-gray-500">Sesuaikan tampilan struk yang dicetak ke pelanggan.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Nama Toko (Header)</Label>
                                    <input
                                        type="text"
                                        value={localSettings.receipt_header || ''}
                                        onChange={e => handleLocalChange({ ...localSettings, receipt_header: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="Contoh: WINNY CAFE"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Alamat / Informasi Tambahan</Label>
                                    <textarea
                                        value={localSettings.address}
                                        onChange={e => handleLocalChange({ ...localSettings, address: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none h-20 resize-none font-mono text-sm"
                                        placeholder="Alamat lengkap toko..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Pesan Penutup (Footer)</Label>
                                    <input
                                        type="text"
                                        value={localSettings.receipt_footer || ''}
                                        onChange={e => handleLocalChange({ ...localSettings, receipt_footer: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="Contoh: Terima Kasih, Datang Lagi ya!"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Ukuran Kertas Printer</Label>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => handleLocalChange({ ...localSettings, receipt_paper_width: '58mm' })}
                                            className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-bold text-sm ${localSettings.receipt_paper_width === '58mm'
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                                                }`}
                                        >
                                            58mm (Kecil)
                                        </button>
                                        <button
                                            onClick={() => handleLocalChange({ ...localSettings, receipt_paper_width: '80mm' })}
                                            className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-bold text-sm ${localSettings.receipt_paper_width === '80mm'
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                                                }`}
                                        >
                                            80mm (Besar)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                                <h4 className="font-bold text-gray-800 text-sm">Opsi Logo</h4>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="show-logo" className="cursor-pointer">Tampilkan Logo</Label>
                                        <Switch
                                            id="show-logo"
                                            checked={localSettings.show_logo}
                                            onCheckedChange={checked => handleLocalChange({ ...localSettings, show_logo: checked })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Logo Struk</Label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-white">
                                                {localSettings.receipt_logo_url ? (
                                                    <img src={localSettings.receipt_logo_url} alt="Logo" className="w-full h-full object-contain" />
                                                ) : (
                                                    <LayoutGrid className="w-8 h-8 text-gray-200" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="file"
                                                    id="logo-upload"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleLogoUpload}
                                                    disabled={uploadingLogo}
                                                />
                                                <Button
                                                    variant="outline"
                                                    onClick={() => document.getElementById('logo-upload')?.click()}
                                                    disabled={uploadingLogo}
                                                    className="w-full"
                                                >
                                                    {uploadingLogo ? 'Mengunggah...' : 'Pilih Logo'}
                                                </Button>
                                                <p className="text-[10px] text-gray-500 mt-1">Saran: Gunakan gambar hitam putih resolusi rendah (kotak).</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                                <h4 className="font-bold text-gray-800 text-sm">Opsi Informasi</h4>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="show-date" className="cursor-pointer">Tampilkan Tanggal & Waktu</Label>
                                        <Switch
                                            id="show-date"
                                            checked={localSettings.show_date}
                                            onCheckedChange={checked => handleLocalChange({ ...localSettings, show_date: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="show-waiter" className="cursor-pointer">Tampilkan Nama Pelayan</Label>
                                        <Switch
                                            id="show-waiter"
                                            checked={localSettings.show_waiter}
                                            onCheckedChange={checked => handleLocalChange({ ...localSettings, show_waiter: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="show-table" className="cursor-pointer">Tampilkan Nomor Meja</Label>
                                        <Switch
                                            id="show-table"
                                            checked={localSettings.show_table}
                                            onCheckedChange={checked => handleLocalChange({ ...localSettings, show_table: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="show-customer-name" className="cursor-pointer">Tampilkan Nama Pelanggan</Label>
                                        <Switch
                                            id="show-customer-name"
                                            checked={localSettings.show_customer_name}
                                            onCheckedChange={checked => handleLocalChange({ ...localSettings, show_customer_name: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="show-customer-status" className="cursor-pointer">Tampilkan Status Pelanggan</Label>
                                        <Switch
                                            id="show-customer-status"
                                            checked={localSettings.show_customer_status}
                                            onCheckedChange={checked => handleLocalChange({ ...localSettings, show_customer_status: checked })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                            <h4 className="font-bold text-gray-800 text-sm">Pratinjau Struk ({localSettings.receipt_paper_width})</h4>
                            <div className={`border border-dashed border-gray-300 p-6 bg-gray-50/50 text-center font-mono text-[10px] space-y-1 text-gray-600 mx-auto transition-all ${localSettings.receipt_paper_width === '80mm' ? 'max-w-xs' : 'max-w-[200px]'
                                }`}>
                                {localSettings.show_logo && localSettings.receipt_logo_url && (
                                    <div className="flex justify-center mb-2">
                                        <img src={localSettings.receipt_logo_url} alt="Logo" className="w-12 h-12 object-contain grayscale" />
                                    </div>
                                )}
                                <p className="font-bold text-xs uppercase text-gray-800">{localSettings.receipt_header || 'NAMA TOKO'}</p>
                                <p className="whitespace-pre-line">{localSettings.address || 'Alamat Toko'}</p>
                                <p>{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                <div className="text-left space-y-0.5">
                                    <p>No: ORD-12345</p>
                                    {localSettings.show_date && <p>Waktu: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>}
                                    {localSettings.show_table && <p>Meja: T-05</p>}
                                    {localSettings.show_customer_name && <p>Pelanggan: Winny</p>}
                                    {localSettings.show_customer_status && <p>Status: Member Gold</p>}
                                    {localSettings.show_waiter && <p>Pelayan: Budi R.</p>}
                                </div>
                                <p>{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                <div className="text-left flex justify-between"><span>KOPI SUSU GULA AREN</span> <span>25.000</span></div>
                                <div className="text-left flex justify-between"><span>PISANG GORENG</span> <span>15.000</span></div>
                                <p>{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                <div className="space-y-0.5">
                                    <div className="flex justify-between"><span>Subtotal</span><span>40.000</span></div>
                                    <div className="flex justify-between text-red-500"><span>Diskon</span><span>0</span></div>
                                    <div className="flex justify-between"><span>Pajak (0%)</span><span>0</span></div>
                                    <div className="font-bold flex justify-between text-xs text-gray-800"><span>TOTAL</span> <span>40.000</span></div>
                                </div>
                                <p>{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                <div className="space-y-0.5 text-left">
                                    <div className="flex justify-between text-left"><span>CASH</span> <span>50.000</span></div>
                                    <div className="flex justify-between text-left"><span>Kembali</span> <span>10.000</span></div>
                                </div>
                                <p>{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                <p className="italic mt-4 text-gray-500">{localSettings.receipt_footer || 'Terima Kasih'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Notifikasi</h3>
                            <p className="text-sm text-gray-500">Atur preferensi pemberitahuan Anda.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex gap-3">
                                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                        <Bell className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">Notifikasi Email</p>
                                        <p className="text-xs text-gray-500">Terima ringkasan penjualan via email</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={localSettings.enable_email_notif}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, enable_email_notif: c })}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex gap-3">
                                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                        <Bell className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">Push Notification</p>
                                        <p className="text-xs text-gray-500">Pop-up notifikasi di browser</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={localSettings.enable_push_notif}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, enable_push_notif: c })}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex gap-3">
                                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                        <Bell className="w-4 h-4 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">Peringatan Stok Rendah</p>
                                        <p className="text-xs text-gray-500">Beri tahu jika stok bahan menipis</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={localSettings.low_stock_alert}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, low_stock_alert: c })}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'backup' && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Backup & Recovery</h3>
                            <p className="text-sm text-gray-500">Amankan data aplikasi Anda atau pulihkan dari file backup.</p>
                        </div>

                        <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                    <Download className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800">Backup Data</h4>
                                    <p className="text-xs text-gray-500">Download semua data database dalam format JSON.</p>
                                </div>
                            </div>
                            <div className="pl-[52px]">
                                <Button
                                    onClick={handleBackup}
                                    disabled={isBackingUp}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {isBackingUp ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Memproses Backup...
                                        </>
                                    ) : (
                                        'Download Backup'
                                    )}
                                </Button>
                                <p className="text-[10px] text-gray-400 mt-2">
                                    Berisi data Produk, Penjualan, Karyawan, Stok, dan Pengaturan.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100 space-y-4 relative overflow-hidden">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                    <Upload className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800">Restore Data</h4>
                                    <p className="text-xs text-gray-500">Pulihkan data dari file backup JSON.</p>
                                </div>
                            </div>

                            <div className="pl-[52px] space-y-3">
                                {isRestoring ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-orange-700 font-medium">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {restoreProgress}
                                        </div>
                                        <div className="w-full bg-orange-200 h-1.5 rounded-full overflow-hidden">
                                            <div className="h-full bg-orange-500 animate-pulse w-full origin-left"></div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Button
                                                variant="outline"
                                                className="border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
                                                onClick={() => document.getElementById('restore-upload')?.click()}
                                            >
                                                Pilih File Backup
                                            </Button>
                                            <input
                                                type="file"
                                                id="restore-upload"
                                                className="hidden"
                                                accept=".json"
                                                onChange={handleRestore}
                                            />
                                        </div>

                                        <div className="flex items-start gap-2 bg-white/50 p-3 rounded-lg border border-orange-100/50">
                                            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-orange-700 leading-relaxed">
                                                <strong>PERHATIAN:</strong> Proses ini akan menggabungkan data backup dengan data yang ada (Upsert).
                                                Data dengan ID yang sama akan ditimpa. Pastikan Anda tahu apa yang Anda lakukan.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'security' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Keamanan</h3>
                            <p className="text-sm text-gray-500">Kelola keamanan akun dan password.</p>
                        </div>

                        <div className="border border-red-100 bg-red-50/50 rounded-2xl p-6 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="bg-white p-2.5 rounded-xl border border-red-100 shadow-sm">
                                    <Shield className="w-5 h-5 text-red-600" />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <h4 className="text-base font-bold text-gray-800">Ganti Password</h4>
                                        <p className="text-xs text-gray-500 mt-1">Gunakan password yang kuat untuk keamanan akun Anda.</p>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <Label className="text-xs mb-1.5 block font-bold text-gray-600">Password Baru</Label>
                                            <input
                                                type="password"
                                                value={passwordForm.new}
                                                onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500/10"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs mb-1.5 block font-bold text-gray-600">Konfirmasi Password</Label>
                                            <input
                                                type="password"
                                                value={passwordForm.confirm}
                                                onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500/10"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        disabled={loadingPassword || !passwordForm.new}
                                        onClick={handleUpdatePassword}
                                        className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100"
                                    >
                                        {loadingPassword ? 'Menyimpan...' : 'Update Password'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'payment_methods' && (
                    <div className="max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Metode Pembayaran</h3>
                                <p className="text-sm text-gray-500">Kelola pilihan pembayaran yang tersedia di POS.</p>
                            </div>
                            <Button onClick={() => handleOpenPaymentModal()} className="bg-primary text-white">
                                <Plus className="w-4 h-4 mr-2" /> Tambah Metode
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {paymentMethods.map(method => (
                                <div key={method.id} className="group relative bg-white border border-gray-200 rounded-2xl p-5 hover:border-primary hover:shadow-lg hover:shadow-primary/5 transition-all">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`p-2.5 rounded-xl ${method.is_active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                                            <CreditCard className="w-5 h-5" />
                                        </div>
                                        <div className="flex gap-1 group-hover:opacity-100 opacity-0 transition-opacity">
                                            <button onClick={() => handleOpenPaymentModal(method)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => onPaymentMethodAction && onPaymentMethodAction('delete', method)}
                                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-gray-800">{method.name}</h4>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
                                            {method.type === 'cash' ? 'Tunai' : method.type === 'card' ? 'Kartu' : 'Digital'} {method.is_static && '• Sistem'}
                                        </p>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-4">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${method.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                            {method.is_active ? 'AKTIF' : 'NONAKTIF'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Fallback not needed anymore as all tabs are covered */}

                {/* Action Footer */}
                <div className="mt-10 pt-6 border-t border-gray-100 flex justify-end">
                    <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-100">
                        <Save className="w-4 h-4 mr-2" />
                        Simpan Perubahan
                    </Button>
                </div>
            </div>

            {/* Modal Table */}
            {
                isTableModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">{editingTable ? 'Edit Meja' : 'Tambah Meja Baru'}</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nomor Meja</Label>
                                    <input
                                        type="text"
                                        value={tableForm.number}
                                        onChange={e => setTableForm({ ...tableForm, number: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="Contoh: T-01"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kapasitas (Orang)</Label>
                                    <input
                                        type="number"
                                        value={tableForm.capacity}
                                        onChange={e => setTableForm({ ...tableForm, capacity: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <Button variant="outline" className="flex-1" onClick={() => setIsTableModalOpen(false)}>Batal</Button>
                                    <Button className="flex-1" onClick={handleSubtitleTable}>Simpan</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Payment Method */}
            {
                isPaymentModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">{editingPayment ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran'}</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nama Metode</Label>
                                    <input
                                        type="text"
                                        value={paymentForm.name}
                                        onChange={e => setPaymentForm({ ...paymentForm, name: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="Contoh: QRIS, Transfer Bank, dll"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tipe</Label>
                                    <select
                                        value={paymentForm.type}
                                        onChange={e => setPaymentForm({ ...paymentForm, type: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                                    >
                                        <option value="cash">Tunai (Cash)</option>
                                        <option value="card">Kartu (Debit/Kredit)</option>
                                        <option value="digital">Digital (E-Wallet/QRIS)</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <Label className="cursor-pointer">Aktifkan Metode</Label>
                                    <Switch
                                        checked={paymentForm.is_active}
                                        onCheckedChange={c => setPaymentForm({ ...paymentForm, is_active: c })}
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <Button variant="outline" className="flex-1" onClick={() => setIsPaymentModalOpen(false)}>Batal</Button>
                                    <Button className="flex-1 bg-primary text-white" onClick={handleSavePaymentMethod}>Simpan</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
