import { useState, useEffect } from 'react';
import { Settings, User, Monitor, Globe, Bell, Shield, Save, Clock, Calendar, Printer, FileText, LayoutGrid, Plus, Trash2, Edit, CreditCard, CheckCircle2, XCircle, Database, Upload, Download, AlertTriangle, Loader2, Calculator, RotateCcw, Zap, Info, ExternalLink, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TableQRPrintView } from './TableQRPrintView';
import { printerService } from '../../lib/PrinterService';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

import { supabase } from '../../lib/supabase';
import { fingerprint } from '../../lib/fingerprint';

interface SettingsViewProps {
    settings: any;
    onUpdateSettings: (settings: any) => void;
    tables?: any[];
    onTableAction?: (action: 'create' | 'update' | 'delete', data: any) => void;
    paymentMethods?: any[];
    onPaymentMethodAction?: (action: 'create' | 'update' | 'delete', data: any) => void;
    branchId?: string;
}

export function SettingsView({
    settings,
    onUpdateSettings,
    tables = [],
    onTableAction,
    paymentMethods = [],
    onPaymentMethodAction,
    branchId = '7'
}: SettingsViewProps) {
    const [activeTab, setActiveTab] = useState('general');
    const [localSettings, setLocalSettings] = useState(settings);
    const [hasChanges, setHasChanges] = useState(false);
    const [previewType, setPreviewType] = useState<'receipt' | 'kitchen' | 'bar'>('receipt');
    const [settingsSubTab, setSettingsSubTab] = useState<'receipt' | 'kitchen' | 'bar'>('receipt');
    const [connectedPrinters, setConnectedPrinters] = useState<{
        Kitchen: string | null;
        Bar: string | null;
        Cashier: string | null;
    }>({
        Kitchen: printerService.getConnectedPrinter('Kitchen'),
        Bar: printerService.getConnectedPrinter('Bar'),
        Cashier: printerService.getConnectedPrinter('Cashier')
    });

    const refreshPrinters = () => {
        setConnectedPrinters({
            Kitchen: printerService.getConnectedPrinter('Kitchen'),
            Bar: printerService.getConnectedPrinter('Bar'),
            Cashier: printerService.getConnectedPrinter('Cashier')
        });
    };

    // Profile Settings State
    const { user } = useAuth();
    const [profileName, setProfileName] = useState('');
    const [updatingProfile, setUpdatingProfile] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [sdkStatus, setSdkStatus] = useState<'idle' | 'checking' | 'active' | 'error'>('idle');
    const [isPrintingTableQRs, setIsPrintingTableQRs] = useState(false);

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
        { id: 'hours', label: 'Absensi & Jam Kerja', icon: Clock },
        { id: 'tables', label: 'Meja', icon: LayoutGrid },
        { id: 'appearance', label: 'Tampilan', icon: Monitor },
        { id: 'notifications', label: 'Notifikasi', icon: Bell },
        { id: 'cashier', label: 'Kasir', icon: Calculator },
        { id: 'printer', label: 'Printer', icon: Printer },
        { id: 'receipt', label: 'Templat Struk', icon: FileText },
        { id: 'wifi', label: 'WiFi Voucher', icon: Globe },
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

    const handleVoucherFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                let codes: string[] = [];

                if (file.name.toLowerCase().endsWith('.csv')) {
                    // Simple CSV parsing: take first column and handle potential quotes
                    codes = text.split('\n')
                        .map(line => {
                            const firstCol = line.split(',')[0].trim();
                            return firstCol.replace(/^["'](.+)["']$/, '$1');
                        })
                        .filter(c => c.length > 0 && !c.toLowerCase().includes('username') && !c.toLowerCase().includes('code'));
                } else {
                    // Plain text: one code per line
                    codes = text.split('\n')
                        .map(c => c.trim())
                        .filter(c => c.length > 0);
                }

                const area = document.getElementById('wifi-import-area') as HTMLTextAreaElement;
                if (area) {
                    area.value = codes.join('\n');
                    toast.success(`${codes.length} kode berhasil diekstrak dari file!`);
                }
            } catch (err: any) {
                toast.error('Gagal membaca file: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset for next use
    };

    // WiFi Voucher Stats
    const [voucherStats, setVoucherStats] = useState({ total: 0, used: 0, available: 0 });
    const [vouchers, setVouchers] = useState<any[]>([]);
    const [voucherCount, setVoucherCount] = useState(0);
    const [voucherPage, setVoucherPage] = useState(1);
    const [voucherSearch, setVoucherSearch] = useState('');
    const [voucherFilter, setVoucherFilter] = useState<'all' | 'used' | 'unused'>('all');
    const [loadingVouchers, setLoadingVouchers] = useState(false);

    const loadVouchers = async () => {
        setLoadingVouchers(true);
        try {
            const { WifiVoucherService } = await import('../../lib/WifiVoucherService');
            const { data, count } = await WifiVoucherService.getVouchers({
                page: voucherPage,
                pageSize: 10,
                branchId: localSettings.branch_id || 'default',
                isUsed: voucherFilter === 'all' ? undefined : voucherFilter === 'used',
                search: voucherSearch
            });
            setVouchers(data);
            setVoucherCount(count);
        } catch (e) {
            console.error("Failed to load vouchers", e);
        } finally {
            setLoadingVouchers(false);
        }
    };

    const loadVoucherStats = async () => {
        try {
            const { WifiVoucherService } = await import('../../lib/WifiVoucherService');
            const stats = await WifiVoucherService.getCounts(localSettings.branch_id || 'default');
            setVoucherStats(stats);
            loadVouchers();
        } catch (e) {
            console.error("Failed to load voucher stats", e);
        }
    };

    useEffect(() => {
        if (activeTab === 'wifi') {
            loadVoucherStats();
        }
    }, [activeTab, voucherPage, voucherFilter, voucherSearch]);

    const handleDeleteVoucher = async (id: number) => {
        if (!confirm('Hapus voucher ini?')) return;
        try {
            const { WifiVoucherService } = await import('../../lib/WifiVoucherService');
            await WifiVoucherService.deleteVoucher(id);
            toast.success('Voucher berhasil dihapus');
            loadVoucherStats();
        } catch (err: any) {
            toast.error('Gagal menghapus voucher: ' + err.message);
        }
    };

    const handleToggleVoucherStatus = async (voucher: any) => {
        try {
            const { WifiVoucherService } = await import('../../lib/WifiVoucherService');
            await WifiVoucherService.updateVoucher(voucher.id, { 
                is_used: !voucher.is_used,
                used_at: !voucher.is_used ? new Date().toISOString() : null
            });
            toast.success('Status voucher berhasil diupdate');
            loadVoucherStats();
        } catch (err: any) {
            toast.error('Gagal update status: ' + err.message);
        }
    };

    const handleDeleteUnusedVouchers = async () => {
        if (!confirm('Hapus semua voucher yang belum terpakai?')) return;
        try {
            const { WifiVoucherService } = await import('../../lib/WifiVoucherService');
            const count = await WifiVoucherService.deleteUnusedVouchers(localSettings.branch_id || 'default');
            toast.success(`${count} voucher belum terpakai berhasil dihapus`);
            loadVoucherStats();
        } catch (err: any) {
            toast.error('Gagal menghapus voucher: ' + err.message);
        }
    };

    const handleDeleteUsedVouchers = async () => {
        if (!confirm('Hapus semua voucher yang sudah terpakai?')) return;
        try {
            const { WifiVoucherService } = await import('../../lib/WifiVoucherService');
            const count = await WifiVoucherService.deleteUsedVouchers(localSettings.branch_id || 'default');
            toast.success(`${count} voucher sudah terpakai berhasil dihapus`);
            loadVoucherStats();
        } catch (err: any) {
            toast.error('Gagal menghapus voucher: ' + err.message);
        }
    };

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
                            <h3 className="text-lg font-bold text-gray-800">Absensi & Jam Kerja</h3>
                            <p className="text-sm text-gray-500">Konfigurasi metode absensi dan jam operasional perusahaan.</p>
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

                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4">
                            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-blue-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-50 p-2 rounded-xl border border-blue-100">
                                        <Shield className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800">Otorisasi Manager (PIN/Fingerprint)</h4>
                                        <p className="text-[10px] text-gray-400">Retur & Penghapusan transaksi memerlukan PIN atau Sidik Jari Manager.</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={localSettings.enable_manager_auth || false}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, enable_manager_auth: c })}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-100">
                                        <Zap className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-blue-800">Fingerprint Scanner (USB)</h4>
                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-bold rounded-md uppercase">SDK Mode</span>
                                        </div>
                                        <p className="text-[10px] text-blue-600/70 italic">Gunakan alat pemindai sidik jari DigitalPersona.</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={localSettings.enable_fingerprint || false}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, enable_fingerprint: c })}
                                />
                            </div>

                            {localSettings.enable_fingerprint && (
                                <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-100">
                                        <div>
                                            <p className="text-sm font-bold text-gray-700">Sembunyikan Kamera Scanner</p>
                                            <p className="text-[10px] text-gray-400">Gunakan fingerprint sebagai metode utama absensi.</p>
                                        </div>
                                        <Switch
                                            checked={localSettings.hide_camera_scanner || false}
                                            onCheckedChange={c => handleLocalChange({ ...localSettings, hide_camera_scanner: c })}
                                        />
                                    </div>
                                    <div className="p-3 bg-blue-100/30 rounded-xl border border-blue-100 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold text-blue-700 flex items-center gap-1.5">
                                                <Info className="w-3 h-3" /> Status SDK
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-[9px] bg-blue-600 text-white hover:bg-blue-700 rounded-md"
                                                disabled={sdkStatus === 'checking'}
                                                onClick={async () => {
                                                    setSdkStatus('checking');
                                                    const isAvailable = await fingerprint.checkServiceAvailability();
                                                    if (isAvailable) {
                                                        setSdkStatus('active');
                                                        toast.success('DigitalPersona SDK aktif dan terdeteksi.');
                                                    } else {
                                                        setSdkStatus('error');
                                                        toast.error('Gagal mendeteksi SDK. Cek instruksi di bawah.');
                                                    }
                                                }}
                                            >
                                                {sdkStatus === 'checking' ? <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> : null}
                                                Cek Status SDK
                                            </Button>
                                        </div>

                                        {sdkStatus === 'active' && (
                                            <p className="text-[10px] text-green-600 font-medium bg-green-50 p-2 rounded-lg border border-green-100">
                                                ✓ SDK Terdeteksi: Siap digunakan.
                                            </p>
                                        )}

                                        {sdkStatus === 'error' && (
                                            <div className="text-[10px] text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    <p className="font-bold uppercase tracking-tight">Koneksi Layanan Gagal (Production/Vercel)</p>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <p className="leading-relaxed font-medium">Browser memblokir akses ke hardware lokal dari situs publik (HTTPS). Silakan ikuti langkah berikut:</p>
                                                    
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {fingerprint.getServiceUrls().map((svc) => (
                                                            <a
                                                                key={svc.port}
                                                                href={svc.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center justify-between px-3 py-1.5 bg-white border border-red-100 rounded-lg hover:bg-red-50 transition-all group"
                                                            >
                                                                <span className="text-[9px] font-bold text-gray-500 uppercase">Izinkan SSL Port {svc.port}</span>
                                                                <ExternalLink className="w-3 h-3 text-red-400" />
                                                            </a>
                                                        ))}
                                                    </div>

                                                    <div className="p-2 bg-orange-100/50 rounded-lg border border-orange-200">
                                                        <p className="text-[9px] text-orange-700 font-bold mb-1">Akses Private Network (Chrome):</p>
                                                        <p className="text-[8px] text-orange-600 select-all font-mono">chrome://flags/#block-insecure-private-network-requests</p>
                                                        <p className="text-[8px] text-orange-600/70 mt-1 italic">Buka link di atas, set ke <b>Disabled</b>, lalu Restart Chrome.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                            <p className="text-[10px] text-blue-800 font-bold flex items-center gap-1.5 mb-1">
                                                <Info className="w-3 h-3" /> Tips Production
                                            </p>
                                            <p className="text-[9px] text-blue-600/80 leading-relaxed">
                                                Jika menggunakan <b>Vercel/HTTPS</b>, pastikan sertifikat lokal sudah diizinkan dengan mengklik link "Izinkan" di atas. Ini adalah prosedur standar keamanan browser untuk akses Hardware USB dari Web.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsPrintingTableQRs(true)}
                                    className="border-primary/20 text-primary hover:bg-primary/5"
                                >
                                    <QrCode className="w-4 h-4 mr-2" />
                                    Cetak QR Meja
                                </Button>
                                <Button onClick={() => handleOpenTableModal()}>
                                    <Plus className="w-4 h-4 mr-2" /> Tambah Meja
                                </Button>
                            </div>
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

                        <AnimatePresence>
                            {isPrintingTableQRs && (
                                <div className="fixed inset-0 z-[100] bg-white animate-in fade-in duration-300 overflow-hidden flex flex-col">
                                    <TableQRPrintView 
                                        tables={tables} 
                                        branchId={branchId} 
                                        onBack={() => setIsPrintingTableQRs(false)} 
                                    />
                                </div>
                            )}
                        </AnimatePresence>
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

                {activeTab === 'cashier' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Pengaturan Kasir</h3>
                            <p className="text-sm text-gray-500">Konfigurasi operasional kasir dan laci uang.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <h4 className="font-bold text-gray-800">Wajib Modal Awal</h4>
                                    <p className="text-xs text-gray-500">Kasir harus memasukkan nominal modal sebelum mulai transaksi.</p>
                                </div>
                                <Switch
                                    checked={localSettings.require_starting_cash ?? true}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, require_starting_cash: c })}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <h4 className="font-bold text-gray-800">Blind Close (Tutup Buta)</h4>
                                    <p className="text-xs text-gray-500">Kasir harus menghitung uang fisik sebelum melihat total sistem.</p>
                                </div>
                                <Switch
                                    checked={localSettings.require_blind_close ?? false}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, require_blind_close: c })}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <h4 className="font-bold text-gray-800">Auto Open Drawer</h4>
                                    <p className="text-xs text-gray-500">Buka laci otomatis setelah transaksi berhasil.</p>
                                </div>
                                <Switch
                                    checked={localSettings.auto_open_drawer ?? false}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, auto_open_drawer: c })}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-200">
                                <div>
                                    <h4 className="font-bold text-orange-800">Wajib Buka/Tutup Shift</h4>
                                    <p className="text-xs text-orange-600">Kasir harus membuka shift sebelum menggunakan aplikasi dan menutup shift sebelum logout.</p>
                                </div>
                                <Switch
                                    checked={localSettings.require_mandatory_session ?? true}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, require_mandatory_session: c })}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                                <div>
                                    <h4 className="font-bold text-blue-800">Cetak Dapur/Bar Saat Hold</h4>
                                    <p className="text-xs text-blue-600">Otomatis mencetak tiket dapur dan bar ketika pesanan di-hold.</p>
                                </div>
                                <Switch
                                    checked={localSettings.print_kds_on_hold ?? false}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, print_kds_on_hold: c })}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                                <div>
                                    <h4 className="font-bold text-gray-800">Manajemen Meja</h4>
                                    <p className="text-xs text-gray-500">Aktifkan untuk menggunakan sistem pemesanan per meja. Jika dimatikan, transaksi akan langsung ke produk.</p>
                                </div>
                                <Switch
                                    checked={localSettings.enable_table_management ?? true}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, enable_table_management: c })}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <h4 className="font-bold text-gray-800">Penomoran Invoice</h4>
                            <div className="grid gap-4">
                                <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                    <div>
                                        <h4 className="font-bold text-blue-800">Mode Penomoran</h4>
                                        <p className="text-xs text-blue-600">Pilih antara penomoran otomatis atau manual.</p>
                                    </div>
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => handleLocalChange({ ...localSettings, invoice_mode: 'auto' })}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${localSettings.invoice_mode === 'auto' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Otomatis
                                        </button>
                                        <button
                                            onClick={() => handleLocalChange({ ...localSettings, invoice_mode: 'manual' })}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${localSettings.invoice_mode === 'manual' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Manual
                                        </button>
                                    </div>
                                </div>

                                {localSettings.invoice_mode === 'auto' && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2"
                                    >
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-700">Prefix Invoice (Awal)</Label>
                                            <input
                                                type="text"
                                                value={localSettings.invoice_prefix || 'INV'}
                                                onChange={e => handleLocalChange({ ...localSettings, invoice_prefix: e.target.value.toUpperCase() })}
                                                className="w-full px-4 py-2 border border-blue-100 bg-white rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold"
                                                placeholder="Contoh: INV"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-700">Nomor Selanjutnya</Label>
                                            <input
                                                type="number"
                                                value={Number(localSettings.invoice_last_number || 0) + 1}
                                                onChange={e => handleLocalChange({ ...localSettings, invoice_last_number: Math.max(0, parseInt(e.target.value) - 1) })}
                                                className="w-full px-4 py-2 border border-blue-100 bg-white rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-mono"
                                                min="1"
                                            />
                                            <p className="text-[10px] text-gray-400 italic">Angka terakhir adalah {localSettings.invoice_last_number || 0}.</p>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-gray-800">Penomoran Invoice Offline</h4>
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold rounded-full uppercase tracking-wider">Web Offline Mode</span>
                            </div>
                            <div className="grid gap-4">
                                <div className="flex items-center justify-between p-4 bg-orange-50/30 rounded-xl border border-orange-100/50">
                                    <div>
                                        <h4 className="font-bold text-orange-800 text-sm">Mode Penomoran Offline</h4>
                                        <p className="text-[10px] text-orange-600">Digunakan saat aplikasi dalam mode offline/tanpa internet.</p>
                                    </div>
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => handleLocalChange({ ...localSettings, offline_invoice_mode: 'auto' })}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${localSettings.offline_invoice_mode === 'auto' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Otomatis
                                        </button>
                                        <button
                                            onClick={() => handleLocalChange({ ...localSettings, offline_invoice_mode: 'manual' })}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${localSettings.offline_invoice_mode === 'manual' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Manual
                                        </button>
                                    </div>
                                </div>

                                {localSettings.offline_invoice_mode === 'auto' && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2"
                                    >
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-700">Prefix Offline</Label>
                                            <input
                                                type="text"
                                                value={localSettings.offline_invoice_prefix || 'OFF'}
                                                onChange={e => handleLocalChange({ ...localSettings, offline_invoice_prefix: e.target.value.toUpperCase() })}
                                                className="w-full px-4 py-2 border border-orange-100 bg-white rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none text-sm font-bold"
                                                placeholder="Contoh: OFF"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-700">Nomor Selanjutnya (Offline)</Label>
                                            <input
                                                type="number"
                                                value={Number(localSettings.offline_invoice_last_number || 0) + 1}
                                                onChange={e => handleLocalChange({ ...localSettings, offline_invoice_last_number: Math.max(0, parseInt(e.target.value) - 1) })}
                                                className="w-full px-4 py-2 border border-orange-100 bg-white rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none text-sm font-mono"
                                                min="1"
                                            />
                                            <p className="text-[10px] text-gray-400 italic">Angka terakhir offline adalah {localSettings.offline_invoice_last_number || 0}.</p>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <h4 className="font-bold text-gray-800">Pecahan Uang Cepat</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {(localSettings.quick_cash_amounts || [10000, 20000, 50000, 100000]).map((amount: number, idx: number) => (
                                    <div key={idx} className="relative">
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => {
                                                const newAmounts = [...(localSettings.quick_cash_amounts || [10000, 20000, 50000, 100000])];
                                                newAmounts[idx] = Number(e.target.value);
                                                handleLocalChange({ ...localSettings, quick_cash_amounts: newAmounts });
                                            }}
                                            className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Rp</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'printer' && (
                    <div className="max-w-2xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                                    {connectedPrinters.Kitchen ? (
                                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {connectedPrinters.Kitchen}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400">Belum Terhubung</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await printerService.connect('Kitchen');
                                                refreshPrinters();
                                                toast.success('Printer Dapur terhubung!');
                                            } catch (e) {
                                                toast.error('Gagal menghubungkan printer. Pastikan Bluetooth aktif.');
                                            }
                                        }}
                                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                                    >
                                        Pair Printer Dapur
                                    </Button>
                                    {connectedPrinters.Kitchen && (
                                        <Button
                                            variant="outline"
                                            className="text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600 px-3"
                                            onClick={async () => {
                                                await printerService.disconnect('Kitchen');
                                                refreshPrinters();
                                                toast.success('Printer Dapur terputus');
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        disabled={!connectedPrinters.Kitchen}
                                        onClick={async () => {
                                            await printerService.printTicket('Kitchen', {
                                                orderNo: 'TEST-001',
                                                tableNo: 'T1',
                                                waiterName: 'Admin',
                                                cashierName: 'Admin',
                                                time: new Date().toLocaleTimeString(),
                                                items: [{ name: 'Test Print (Dapur)', quantity: 1 }]
                                            });
                                        }}
                                        variant="outline"
                                    >
                                        Test Print
                                    </Button>
                                    <div className="flex items-center gap-3 ml-auto px-3 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                                        <Label htmlFor="auto-print-kitchen" className="text-[10px] font-bold text-gray-400 uppercase cursor-pointer">Auto Cetak</Label>
                                        <Switch
                                            id="auto-print-kitchen"
                                            checked={localSettings.auto_print_kitchen || false}
                                            onCheckedChange={c => handleLocalChange({ ...localSettings, auto_print_kitchen: c })}
                                        />
                                    </div>
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
                                    {connectedPrinters.Bar ? (
                                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {connectedPrinters.Bar}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400">Belum Terhubung</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await printerService.connect('Bar');
                                                refreshPrinters();
                                                toast.success('Printer Bar terhubung!');
                                            } catch (e) {
                                                toast.error('Gagal menghubungkan printer.');
                                            }
                                        }}
                                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                                    >
                                        Pair Printer Bar
                                    </Button>
                                    {connectedPrinters.Bar && (
                                        <Button
                                            variant="outline"
                                            className="text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600 px-3"
                                            onClick={async () => {
                                                await printerService.disconnect('Bar');
                                                refreshPrinters();
                                                toast.success('Printer Bar terputus');
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        disabled={!connectedPrinters.Bar}
                                        onClick={async () => {
                                            await printerService.printTicket('Bar', {
                                                orderNo: 'TEST-001',
                                                tableNo: 'T1',
                                                waiterName: 'Admin',
                                                cashierName: 'Admin',
                                                time: new Date().toLocaleTimeString(),
                                                items: [{ name: 'Test Print (Bar)', quantity: 1 }]
                                            });
                                        }}
                                        variant="outline"
                                    >
                                        Test Print
                                    </Button>
                                    <div className="flex items-center gap-3 ml-auto px-3 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                                        <Label htmlFor="auto-print-bar" className="text-[10px] font-bold text-gray-400 uppercase cursor-pointer">Auto Cetak</Label>
                                        <Switch
                                            id="auto-print-bar"
                                            checked={localSettings.auto_print_bar || false}
                                            onCheckedChange={c => handleLocalChange({ ...localSettings, auto_print_bar: c })}
                                        />
                                    </div>
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
                                    {connectedPrinters.Cashier ? (
                                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {connectedPrinters.Cashier}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400">Belum Terhubung</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await printerService.connect('Cashier');
                                                refreshPrinters();
                                                toast.success('Printer Kasir terhubung!');
                                            } catch (e) {
                                                toast.error('Gagal menghubungkan printer.');
                                            }
                                        }}
                                        className="flex-1 bg-primary text-white hover:bg-primary/90 shadow-md"
                                    >
                                        Pair Printer Kasir
                                    </Button>
                                    {connectedPrinters.Cashier && (
                                        <Button
                                            variant="outline"
                                            className="text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600 px-3"
                                            onClick={async () => {
                                                await printerService.disconnect('Cashier');
                                                refreshPrinters();
                                                toast.success('Printer Kasir terputus');
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        disabled={!connectedPrinters.Cashier}
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
                                                change: 5000,
                                                wifiVoucher: localSettings?.enable_wifi_vouchers ? 'TEST-WIFI' : undefined,
                                                wifiNotice: localSettings?.wifi_voucher_notice
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
                    <div className="max-w-2xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Pengaturan Templat Struk</h3>
                            <p className="text-sm text-gray-500">Sesuaikan tampilan struk dan tiket pesanan.</p>
                        </div>

                        {/* Settings Sub-Tabs */}
                        <div className="flex bg-gray-100 p-1.5 rounded-xl self-start">
                            <button
                                onClick={() => { setSettingsSubTab('receipt'); setPreviewType('receipt'); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${settingsSubTab === 'receipt' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <FileText className="w-4 h-4" />
                                Struk Pelanggan
                            </button>
                            <button
                                onClick={() => { setSettingsSubTab('kitchen'); setPreviewType('kitchen'); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${settingsSubTab === 'kitchen' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Printer className="w-4 h-4" />
                                Tiket Dapur
                            </button>
                            <button
                                onClick={() => { setSettingsSubTab('bar'); setPreviewType('bar'); }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${settingsSubTab === 'bar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Printer className="w-4 h-4" />
                                Tiket Bar
                            </button>
                        </div>

                        {settingsSubTab === 'receipt' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Nama Toko (Header)</Label>
                                    <input
                                        type="text"
                                        value={localSettings.receipt_header || ''}
                                        onChange={e => handleLocalChange({ ...localSettings, receipt_header: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="Contoh: WINNY PANGERAN NATAKUSUMA"
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
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Baris Kosong Akhir Struk</Label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="number"
                                            value={localSettings.receipt_footer_feed ?? 4}
                                            onChange={e => handleLocalChange({ ...localSettings, receipt_footer_feed: parseInt(e.target.value) || 0 })}
                                            className="w-24 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                            min="0"
                                            max="20"
                                        />
                                        <span className="text-[10px] text-gray-500 italic">Jumlah baris kosong sebelum kertas dipotong (Default: 4).</span>
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
                                        <Label htmlFor="show-cashier-name" className="cursor-pointer">Tampilkan Nama Kasir</Label>
                                        <Switch
                                            id="show-cashier-name"
                                            checked={localSettings.show_cashier_name ?? true}
                                            onCheckedChange={checked => handleLocalChange({ ...localSettings, show_cashier_name: checked })}
                                        />
                                    </div>
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
                                        <Label htmlFor="show-customer-status" className="cursor-pointer text-gray-700 font-medium whitespace-nowrap">Tampilkan Status Pelanggan</Label>
                                        <Switch
                                            id="show-customer-status"
                                            checked={localSettings.show_customer_status}
                                            onCheckedChange={checked => handleLocalChange({ ...localSettings, show_customer_status: checked })}
                                        />
                                    </div>
                                    <div className="pt-2 border-t border-gray-100 mt-2">
                                        <div className="flex items-center justify-between py-2">
                                            <div className="space-y-0.5">
                                                <Label htmlFor="enable-wifi-vouchers" className="cursor-pointer font-bold text-blue-600">Tampilkan Voucher WiFi</Label>
                                                <p className="text-[10px] text-gray-400">Sisipkan kode voucher WiFi di bagian bawah struk</p>
                                            </div>
                                            <Switch
                                                id="enable-wifi-vouchers"
                                                checked={localSettings.enable_wifi_vouchers || false}
                                                onCheckedChange={checked => handleLocalChange({ ...localSettings, enable_wifi_vouchers: checked })}
                                            />
                                        </div>
                                        {localSettings.enable_wifi_vouchers && (
                                            <div className="space-y-4 mt-2 animate-in slide-in-from-top-2 duration-200">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-[11px] font-bold text-gray-500 uppercase">Minimal Belanja (Rp)</Label>
                                                        <input
                                                            type="number"
                                                            value={localSettings.wifi_voucher_min_amount || 0}
                                                            onChange={(e) => handleLocalChange({ ...localSettings, wifi_voucher_min_amount: parseInt(e.target.value) || 0 })}
                                                            placeholder="Contoh: 50000"
                                                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                                        />
                                                        <p className="text-[10px] text-gray-400">Voucher hanya muncul jika total belanja mencapai nilai ini.</p>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-[11px] font-bold text-gray-500 uppercase">Kelipatan Belanja (Rp)</Label>
                                                        <input
                                                            type="number"
                                                            value={localSettings.wifi_voucher_multiplier || 0}
                                                            onChange={(e) => handleLocalChange({ ...localSettings, wifi_voucher_multiplier: parseInt(e.target.value) || 0 })}
                                                            placeholder="Contoh: 50000"
                                                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                                        />
                                                        <p className="text-[10px] text-gray-400">Setiap kelipatan jumlah ini akan mendapatkan 1 voucher tambahan (0 = otomatis gunakan Minimal Belanja).</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[11px] font-bold text-gray-500 uppercase">Pesan WiFi (Notice)</Label>
                                                    <input
                                                        type="text"
                                                        value={localSettings.wifi_voucher_notice || ''}
                                                        onChange={(e) => handleLocalChange({ ...localSettings, wifi_voucher_notice: e.target.value })}
                                                        placeholder="Contoh: Gunakan kode ini untuk akses WiFi"
                                                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {settingsSubTab === 'kitchen' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700">Nama Dapur (Header)</Label>
                                        <input
                                            type="text"
                                            value={localSettings.kitchen_header || ''}
                                            onChange={e => handleLocalChange({ ...localSettings, kitchen_header: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                                            placeholder="Contoh: DAPUR UTAMA"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700">Pesan Penutup Dapur (Footer)</Label>
                                        <input
                                            type="text"
                                            value={localSettings.kitchen_footer || ''}
                                            onChange={e => handleLocalChange({ ...localSettings, kitchen_footer: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="Contoh: Segera disiapkan!"
                                        />
                                    </div>
                                </div>

                                <div className="p-6 bg-orange-50/50 rounded-2xl border border-orange-100 space-y-4">
                                    <h4 className="font-bold text-orange-800 text-sm">Opsi Informasi Tiket Dapur</h4>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="k-show-table" className="cursor-pointer text-gray-700 font-medium">Tampilkan Nomor Meja</Label>
                                            <Switch
                                                id="k-show-table"
                                                checked={localSettings.kitchen_show_table ?? true}
                                                onCheckedChange={checked => handleLocalChange({ ...localSettings, kitchen_show_table: checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="k-show-waiter" className="cursor-pointer text-gray-700 font-medium">Tampilkan Nama Pelayan</Label>
                                            <Switch
                                                id="k-show-waiter"
                                                checked={localSettings.kitchen_show_waiter ?? true}
                                                onCheckedChange={checked => handleLocalChange({ ...localSettings, kitchen_show_waiter: checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="k-show-date" className="cursor-pointer text-gray-700 font-medium">Tampilkan Waktu Pesanan</Label>
                                            <Switch
                                                id="k-show-date"
                                                checked={localSettings.kitchen_show_date ?? true}
                                                onCheckedChange={checked => handleLocalChange({ ...localSettings, kitchen_show_date: checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="k-show-cashier" className="cursor-pointer text-gray-700 font-medium">Tampilkan Nama Kasir</Label>
                                            <Switch
                                                id="k-show-cashier"
                                                checked={localSettings.kitchen_show_cashier ?? true}
                                                onCheckedChange={checked => handleLocalChange({ ...localSettings, kitchen_show_cashier: checked })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {settingsSubTab === 'bar' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700">Nama Bar (Header)</Label>
                                        <input
                                            type="text"
                                            value={localSettings.bar_header || ''}
                                            onChange={e => handleLocalChange({ ...localSettings, bar_header: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold text-blue-800"
                                            placeholder="Contoh: BAR & COFFEE"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700">Pesan Penutup Bar (Footer)</Label>
                                        <input
                                            type="text"
                                            value={localSettings.bar_footer || ''}
                                            onChange={e => handleLocalChange({ ...localSettings, bar_footer: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="Contoh: Selamat menikmati!"
                                        />
                                    </div>
                                </div>

                                <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
                                    <h4 className="font-bold text-blue-800 text-sm">Opsi Informasi Tiket Bar</h4>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="b-show-table" className="cursor-pointer text-gray-700 font-medium">Tampilkan Nomor Meja</Label>
                                            <Switch
                                                id="b-show-table"
                                                checked={localSettings.bar_show_table ?? true}
                                                onCheckedChange={checked => handleLocalChange({ ...localSettings, bar_show_table: checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="b-show-waiter" className="cursor-pointer text-gray-700 font-medium">Tampilkan Nama Pelayan</Label>
                                            <Switch
                                                id="b-show-waiter"
                                                checked={localSettings.bar_show_waiter ?? true}
                                                onCheckedChange={checked => handleLocalChange({ ...localSettings, bar_show_waiter: checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="b-show-date" className="cursor-pointer text-gray-700 font-medium">Tampilkan Waktu Pesanan</Label>
                                            <Switch
                                                id="b-show-date"
                                                checked={localSettings.bar_show_date ?? true}
                                                onCheckedChange={checked => handleLocalChange({ ...localSettings, bar_show_date: checked })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="b-show-cashier" className="cursor-pointer text-gray-700 font-medium">Tampilkan Nama Kasir</Label>
                                            <Switch
                                                id="b-show-cashier"
                                                checked={localSettings.bar_show_cashier ?? true}
                                                onCheckedChange={checked => handleLocalChange({ ...localSettings, bar_show_cashier: checked })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Preview */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-gray-800 text-sm">Pratinjau {previewType === 'receipt' ? 'Struk' : (previewType === 'kitchen' ? 'Tiket Dapur' : 'Tiket Bar')} ({localSettings.receipt_paper_width})</h4>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setPreviewType('receipt')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${previewType === 'receipt' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Struk
                                    </button>
                                    <button
                                        onClick={() => setPreviewType('kitchen')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${previewType === 'kitchen' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Dapur
                                    </button>
                                    <button
                                        onClick={() => setPreviewType('bar')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${previewType === 'bar' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Bar
                                    </button>
                                </div>
                            </div>

                            <div className={`border border-dashed border-gray-300 p-4 bg-gray-50/50 font-mono text-[10px] space-y-0.5 text-gray-600 mx-auto transition-all ${localSettings.receipt_paper_width === '80mm' ? 'max-w-xs' : 'max-w-[200px]'}`}>
                                {previewType === 'receipt' ? (
                                    <>
                                        {/* Logo */}
                                        {localSettings.show_logo && localSettings.receipt_logo_url && (
                                            <div className="flex justify-center mb-2">
                                                <img src={localSettings.receipt_logo_url} alt="Logo" className="w-12 h-12 object-contain grayscale" />
                                            </div>
                                        )}
                                        {/* Header */}
                                        <p className="font-bold text-xs uppercase text-gray-800 text-center">{localSettings.receipt_header || 'NAMA TOKO'}</p>
                                        {localSettings.address && <p className="text-center whitespace-pre-line">{localSettings.address}</p>}
                                        {localSettings.phone && <p className="text-center">Telp: {localSettings.phone}</p>}
                                        <p className="text-center">{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                        {/* Order Info */}
                                        <div className="text-left space-y-0.5">
                                            <p>No: {localSettings.offline_invoice_prefix || 'OFF'}-12345</p>
                                            {localSettings.show_date && <p>Waktu: {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>}
                                            {localSettings.show_table && <p>Meja: T-05</p>}
                                            {localSettings.show_customer_name && <p>Pelanggan: Winny</p>}
                                            {localSettings.show_customer_status && <p>Status: Member Gold</p>}
                                            {(localSettings.show_cashier_name ?? true) && <p>Kasir: Admin</p>}
                                            {localSettings.show_waiter && <p>Pelayan: Budi R.</p>}
                                        </div>
                                        <p className="text-center">{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                        {/* Items */}
                                        <div className="text-left">
                                            <div className="flex justify-between"><span>1x KOPI SUSU GULA AREN</span><span>25.000</span></div>
                                            <div className="flex justify-between"><span>2x PISANG GORENG</span><span>30.000</span></div>
                                        </div>
                                        <p className="text-center">{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                        {/* Totals */}
                                        <div className="space-y-0.5">
                                            <div className="flex justify-between"><span>Subtotal</span><span>55.000</span></div>
                                            <div className="flex justify-between text-red-500"><span>Diskon</span><span>0</span></div>
                                            {(localSettings.service_rate > 0) && <div className="flex justify-between"><span>Layanan ({localSettings.service_rate}%)</span><span>{Math.round(55000 * localSettings.service_rate / 100).toLocaleString('id-ID')}</span></div>}
                                            {(localSettings.tax_rate > 0) && <div className="flex justify-between"><span>Pajak ({localSettings.tax_rate}%)</span><span>{Math.round(55000 * localSettings.tax_rate / 100).toLocaleString('id-ID')}</span></div>}
                                            <div className="font-bold flex justify-between text-xs text-gray-800"><span>TOTAL</span><span>55.000</span></div>
                                        </div>
                                        <p className="text-center">{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                        {/* Payment */}
                                        <div className="space-y-0.5 text-left">
                                            <div className="flex justify-between"><span>CASH</span><span>60.000</span></div>
                                            <div className="flex justify-between"><span>Kembali</span><span>5.000</span></div>
                                        </div>
                                        <p className="text-center">{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                        {/* WiFi Voucher (if enabled) */}
                                        {localSettings.enable_wifi_vouchers && (
                                            <>
                                                <p className="text-center text-gray-500">{localSettings.wifi_voucher_notice || 'Gunakan kode ini untuk akses WiFi'}</p>
                                                <p className="font-bold text-center text-xs text-gray-800">WIFI-XXXX-XXXX</p>
                                                <p className="text-center">{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                            </>
                                        )}
                                        {/* Footer */}
                                        <p className="italic text-center text-gray-500 mt-2">{localSettings.receipt_footer || 'Terima Kasih'}</p>
                                        <p className="text-center text-gray-400">{localSettings.receipt_header || 'NAMA TOKO'}</p>
                                    </>
                                ) : (
                                    <>
                                        {/* Ticket Header */}
                                        <p className="font-bold text-base uppercase text-gray-800 text-center">{
                                             `PESANAN ${previewType === 'kitchen' ? 'DAPUR' : 'BAR'}`
                                        }</p>

                                        {/* Order Info */}
                                        <div className="text-center mt-2 space-y-0.5">
                                            <p>No: {localSettings.offline_invoice_prefix || 'OFF'}-12345</p>
                                            {(previewType === 'kitchen' ? (localSettings.kitchen_show_table ?? true) : (localSettings.bar_show_table ?? true)) && (
                                                <p className="font-bold text-base text-gray-900 mt-1">MEJA: T-05</p>
                                            )}
                                            {(previewType === 'kitchen' ? (localSettings.kitchen_show_waiter ?? true) : (localSettings.bar_show_waiter ?? true)) && <p>Pelayan: Budi R.</p>}
                                            {(previewType === 'kitchen' ? (localSettings.kitchen_show_cashier ?? true) : (localSettings.bar_show_cashier ?? true)) && <p>Kasir: Admin</p>}
                                            {(previewType === 'kitchen' ? (localSettings.kitchen_show_date ?? true) : (localSettings.bar_show_date ?? true)) && <p>Waktu: {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>}
                                        </div>
                                        <p className="text-center">{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>

                                        {/* Items */}
                                        <div className="text-left font-bold text-xs py-1">
                                            {previewType === 'kitchen' ? (
                                                <>
                                                    <p>2x NASI GORENG SPESIAL</p>
                                                    <p>1x MIE GORENG JAWA</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p>1x ES TEH MANIS</p>
                                                    <p>2x JUS ALPUKAT</p>
                                                </>
                                            )}
                                        </div>
                                        <p className="text-center">{localSettings.receipt_paper_width === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>

                                        {/* Footer */}
                                        {((previewType === 'kitchen' ? localSettings.kitchen_footer : localSettings.bar_footer)) && (
                                            <p className="italic text-center text-gray-500 mt-2">{(previewType === 'kitchen' ? localSettings.kitchen_footer : localSettings.bar_footer)}</p>
                                        )}

                                        <div className="h-8"></div> {/* Spacer for feed */}
                                    </>
                                )}
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
                                <div className="flex flex-wrap gap-3">
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
                                <div className="flex flex-wrap gap-3">
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
                                <div className="flex flex-wrap gap-3">
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
                            <div className="flex items-center justify-between p-4 rounded-xl bg-orange-50 border border-orange-100">
                                <div className="flex flex-wrap gap-3">
                                    <div className="bg-white p-2 rounded-lg border border-orange-200 shadow-sm">
                                        <Monitor className="w-4 h-4 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-orange-800">Matikan Auto-Open Kasir di Web</p>
                                        <p className="text-xs text-orange-600">Jangan buka drawer kasir otomatis saat ada pesanan masuk dari perangkat lain</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={localSettings.disable_web_kiosk_notifications || false}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, disable_web_kiosk_notifications: c })}
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

                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <div>
                                <h4 className="font-bold text-blue-800">Batasi Login Satu Perangkat</h4>
                                <p className="text-xs text-blue-600">User hanya bisa login di satu perangkat. Login di perangkat baru akan logout perangkat lama secara otomatis.</p>
                            </div>
                            <Switch
                                checked={localSettings.enforce_single_device ?? true}
                                onCheckedChange={c => handleLocalChange({ ...localSettings, enforce_single_device: c })}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'wifi' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">WiFi Voucher</h3>
                            <p className="text-sm text-gray-500">Kelola voucher WiFi yang akan dicetak pada struk belanja.</p>
                        </div>

                        {/* Stats Card */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm text-center">
                                <p className="text-xs text-gray-500 font-medium uppercase">Total Voucher</p>
                                <p className="text-2xl font-bold text-gray-800">{voucherStats.total}</p>
                            </div>
                            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm text-center">
                                <p className="text-xs text-gray-500 font-medium uppercase">Terpakai</p>
                                <p className="text-2xl font-bold text-orange-600">{voucherStats.used}</p>
                            </div>
                            <div className={`p-4 border rounded-xl shadow-sm text-center ${voucherStats.available < 10 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                <p className={`text-xs font-medium uppercase ${voucherStats.available < 10 ? 'text-red-600' : 'text-green-600'}`}>Tersedia</p>
                                <p className={`text-2xl font-bold ${voucherStats.available < 10 ? 'text-red-700' : 'text-green-700'}`}>{voucherStats.available}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                                <div>
                                    <h4 className="font-bold text-blue-800">Aktifkan WiFi Voucher</h4>
                                    <p className="text-xs text-blue-600">Cetak kode voucher WiFi secara otomatis pada struk pelanggan.</p>
                                </div>
                                <Switch
                                    checked={localSettings.enable_wifi_vouchers || false}
                                    onCheckedChange={c => handleLocalChange({ ...localSettings, enable_wifi_vouchers: c })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">Minimal Belanja (Rp)</Label>
                                    <input
                                        type="number"
                                        value={localSettings.wifi_voucher_min_amount || 0}
                                        onChange={e => handleLocalChange({ ...localSettings, wifi_voucher_min_amount: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="50000"
                                    />
                                    <p className="text-[10px] text-gray-400">Voucher hanya muncul jika total belanja mencapai nilai ini.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">Kelipatan Belanja (Rp)</Label>
                                    <input
                                        type="number"
                                        value={localSettings.wifi_voucher_multiplier || 0}
                                        onChange={e => handleLocalChange({ ...localSettings, wifi_voucher_multiplier: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="20000"
                                    />
                                    <p className="text-[10px] text-gray-400">Setiap kelipatan jumlah ini akan mendapatkan 1 voucher tambahan (0 = otomatis gunakan Minimal Belanja).</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">Pesan Header Voucher</Label>
                                    <input
                                        type="text"
                                        value={localSettings.wifi_voucher_notice || ''}
                                        onChange={e => handleLocalChange({ ...localSettings, wifi_voucher_notice: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="Gunakan kode ini untuk akses WiFi"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-bold text-gray-800">Import Voucher</h4>
                                <Button variant="outline" size="sm" onClick={loadVoucherStats}>
                                    <RotateCcw className="w-3 h-3 mr-2" /> Refresh Data
                                </Button>
                            </div>

                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-4 text-xs text-yellow-800 space-y-1">
                                <p className="font-bold"><Globe className="w-3 h-3 inline mr-1" /> Cara Export dari Mikrotik:</p>
                                <ul className="list-disc pl-5 space-y-0.5 opacity-90">
                                    <li>Buka <strong>Mikrotik User Manager</strong> / Hotspot Users.</li>
                                    <li>Select semua user yang ingin di-export.</li>
                                    <li>Klik kanan &gt; Export atau Copy username/password.</li>
                                    <li>Hanya perlu kolom <strong>Username (Kode Voucher)</strong>.</li>
                                    <li>Paste daftar kode tersebut di bawah ini (satu baris satu kode).</li>
                                </ul>
                            </div>

                            <div className="p-6 bg-gray-50 border border-dashed border-gray-200 rounded-2xl space-y-4">
                                <div className="text-center">
                                    <Globe className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600 font-medium">Tempel kode voucher di bawah atau unggah file (.txt, .csv)</p>
                                    <div className="mt-4 flex justify-center gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-8 text-[11px]"
                                            onClick={() => document.getElementById('voucher-file-upload')?.click()}
                                        >
                                            <Upload className="w-3 h-3 mr-2" /> Pilih File (.txt/.csv)
                                        </Button>
                                        <input 
                                            type="file" 
                                            id="voucher-file-upload" 
                                            className="hidden" 
                                            accept=".txt,.csv"
                                            onChange={handleVoucherFileUpload}
                                        />
                                    </div>
                                </div>
                                <textarea
                                    id="wifi-import-area"
                                    className="w-full h-40 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-mono text-sm"
                                    placeholder="WIFI-12345&#10;WIFI-67890&#10;..."
                                />
                                <Button
                                    onClick={async () => {
                                        const area = document.getElementById('wifi-import-area') as HTMLTextAreaElement;
                                        const rawCodes = area.value.split('\n').map(c => c.trim()).filter(c => c.length > 0);
                                        const uniqueCodes = Array.from(new Set(rawCodes));
                                        
                                        if (uniqueCodes.length === 0) return toast.error('Masukkan setidaknya satu kode!');
                                        
                                        if (uniqueCodes.length < rawCodes.length) {
                                            console.log(`[SettingsView] Found ${rawCodes.length - uniqueCodes.length} duplicates in import text. Filtering.`);
                                        }

                                        try {
                                            const { WifiVoucherService } = await import('../../lib/WifiVoucherService');
                                            const count = await WifiVoucherService.importVouchers(uniqueCodes, localSettings.branch_id || 'default');
                                            toast.success(`${count} voucher berhasil diimport!`);
                                            area.value = '';
                                            loadVoucherStats(); // Refresh stats
                                        } catch (err: any) {
                                            toast.error('Gagal import voucher: ' + err.message);
                                        }
                                    }}
                                    className="w-full bg-gray-900 text-white"
                                >
                                    Import Voucher Sekarang
                                </Button>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-gray-100 space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <h4 className="font-bold text-gray-800">Daftar Voucher Terimport</h4>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={voucherSearch}
                                            onChange={e => {
                                                setVoucherSearch(e.target.value);
                                                setVoucherPage(1);
                                            }}
                                            placeholder="Cari kode..."
                                            className="pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 w-40"
                                        />
                                    </div>
                                    <select
                                        value={voucherFilter}
                                        onChange={e => {
                                            setVoucherFilter(e.target.value as any);
                                            setVoucherPage(1);
                                        }}
                                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none bg-white font-medium"
                                    >
                                        <option value="all">Semua Status</option>
                                        <option value="unused">Belum Terpakai</option>
                                        <option value="used">Terpakai</option>
                                    </select>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 text-[10px] text-red-600 border-red-100 hover:bg-red-50"
                                        onClick={handleDeleteUnusedVouchers}
                                    >
                                        <Trash2 className="w-3 h-3 mr-1" /> Hapus Belum Terpakai
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 text-[10px] text-red-600 border-red-100 hover:bg-red-50"
                                        onClick={handleDeleteUsedVouchers}
                                    >
                                        <Trash2 className="w-3 h-3 mr-1" /> Hapus Sudah Terpakai
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-4 py-3 font-bold text-gray-600 uppercase tracking-wider">Kode Voucher</th>
                                                <th className="px-4 py-3 font-bold text-gray-600 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3 font-bold text-gray-600 uppercase tracking-wider">Dicetak Pada</th>
                                                <th className="px-4 py-3 font-bold text-gray-600 uppercase tracking-wider text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {loadingVouchers ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-10 text-center">
                                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-300 mb-2" />
                                                        <p className="text-gray-400">Memuat data voucher...</p>
                                                    </td>
                                                </tr>
                                            ) : vouchers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-10 text-center">
                                                        <p className="text-gray-400 font-medium">Tidak ada voucher ditemukan.</p>
                                                        <p className="text-[10px] text-gray-400 mt-1">Silakan import kode voucher di atas.</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                vouchers.map(v => (
                                                    <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <code className="bg-gray-100 px-2 py-1 rounded text-gray-800 font-mono font-bold select-all cursor-pointer" title="Klik untuk pilih koden">{v.code}</code>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[9px] ${v.is_used ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                                                {v.is_used ? (
                                                                    <>
                                                                        <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> TERPAKAI
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Zap className="w-2.5 h-2.5 mr-1" /> TERSEDIA
                                                                    </>
                                                                )}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500">
                                                            {v.used_at ? new Date(v.used_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => handleToggleVoucherStatus(v)}
                                                                    className={`p-1.5 rounded-lg transition-colors ${v.is_used ? 'text-green-600 hover:bg-green-50' : 'text-orange-600 hover:bg-orange-50'}`}
                                                                    title={v.is_used ? 'Tandai sebagai Belum Terpakai' : 'Tandai sebagai Terpakai'}
                                                                >
                                                                    {v.is_used ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteVoucher(v.id)}
                                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Hapus Voucher"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {voucherCount > 10 && (
                                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                        <p className="text-[10px] text-gray-500">
                                            Menampilkan {(voucherPage - 1) * 10 + 1} - {Math.min(voucherPage * 10, voucherCount)} dari {voucherCount} voucher
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-[10px]"
                                                disabled={voucherPage === 1}
                                                onClick={() => setVoucherPage(prev => prev - 1)}
                                            >
                                                Sebelumnya
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-[10px]"
                                                disabled={voucherPage * 10 >= voucherCount}
                                                onClick={() => setVoucherPage(prev => prev + 1)}
                                            >
                                                Berikutnya
                                            </Button>
                                        </div>
                                    </div>
                                )}
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
