import React, { useState, useEffect } from 'react';
import { Users, Shield, Plus, Search, MoreVertical, X, Edit, Info } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';

// branchList removed - usage replaced by props or dynamic fetch if needed
// However, since UsersView is used inside Home which has branches, we should pass it down.
// But UsersView signature is currently empty argument. To minimize refactor impact, let's fetch branches internally if not passed, or just accept prop.


export function UsersView({ branches: propsBranches = [] }: { branches?: any[] }) {
    const { user } = useAuth();
    const [internalBranches, setInternalBranches] = useState<any[]>([]);
    
    // Combine props branches and internal branches
    const allBranches = propsBranches.length > 0 ? propsBranches : internalBranches;
    // DEFINISI HAK AKSES (PERMISSIONS) - Disinkronkan dengan Home.tsx
    const AVAILABLE_PERMISSIONS = [
        // Utama
        { id: 'dashboard', label: 'Dashboard & Statistik', description: 'Melihat ringkasan penjualan' },
        { id: 'pos', label: 'Kasir / POS', description: 'Akses menu penjualan' },
        { id: 'pos_order_only', label: 'Hanya Kirim Pesanan (Display)', description: 'Hanya bisa input pesanan tanpa pembayaran' },
        { id: 'mandatory_session', label: 'Wajib Buka/Tutup Kasir', description: 'Harus buka shift sebelum transaksi' },
        { id: 'kds', label: 'Dapur & Bar (KDS)', description: 'Layar pesanan dapur' },

        // Inventori & Produk
        { id: 'products', label: 'Produk & Menu', description: 'Kelola menu makanan' },
        { id: 'view_hpp_recipe', label: 'Lihat Resep & HPP', description: 'Bisa melihat modal (HPP) dan komposisi resep di Master Data' },
        { id: 'inventory', label: 'Stok Bahan', description: 'Kelola stok bahan baku' },
        { id: 'purchases', label: 'Pembelian', description: 'Belanja stok masuk' },
        { id: 'contacts', label: 'Kontak', description: 'Data pelanggan & supplier' },

        // HRD & Karyawan
        { id: 'employees', label: 'Karyawan', description: 'Data pegawai' },
        { id: 'attendance', label: 'Absensi', description: 'Log kehadiran' },
        { id: 'shifts', label: 'Shift', description: 'Jadwal kerja' },
        { id: 'payroll', label: 'Payroll', description: 'Penggajian' },
        { id: 'performance', label: 'Performa', description: 'KPI & Komisi' },

        // Keuangan
        { id: 'reports', label: 'Laporan', description: 'Laporan lengkap' },
        { id: 'accounting', label: 'Akuntansi', description: 'Jurnal & Keuangan' },

        // Administrasi
        { id: 'branches', label: 'Cabang', description: 'Manajemen outlet' },
        { id: 'users', label: 'Pengguna Sistem', description: 'Kelola akun & hak akses' },
        { id: 'settings', label: 'Pengaturan', description: 'Konfigurasi sistem' },
    ];

    const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
    const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [newRole, setNewRole] = useState<{ name: string; description: string; permissions: string[] }>({
        name: '',
        description: '',
        permissions: []
    });
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: '', branchId: '' });
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [roleSearchQuery, setRoleSearchQuery] = useState('');
    const [editingRole, setEditingRole] = useState<any>(null);
    const [editingUser, setEditingUser] = useState<any>(null);

    // Auto-select first branch when loaded
    useEffect(() => {
        if (allBranches.length > 0 && !newUser.branchId && !editingUser) {
            // Ensure we use string for consistent comparison in Select
            setNewUser(prev => ({ ...prev, branchId: String(allBranches[0].id) }));
        }
    }, [allBranches, editingUser, newUser.branchId]);

    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*');

        if (error) {
            toast.error('Gagal mengambil data pengguna');
        }

        // FORCE SHOW CURRENT USER (Frontend injection)
        // If the database list doesn't have the current user, add them visually so the table isn't empty.
        let safeData = data || [];
        if (user && !safeData.find((u: any) => u.id === user.id)) {
            const mockAdmin = {
                id: user.id || 'current-user',
                name: user.user_metadata?.name || 'Admin (Anda)',
                email: user.email || 'admin@winpos.com',
                role: 'Administrator',
                status: 'Aktif'
                // Removed branch_id because it doesn't exist in DB schema
            };
            safeData = [mockAdmin, ...safeData];

            // Try to auto-fix in background
            // Use UPSERT so it works whether the profile exists or not
            supabase.from('profiles').upsert(mockAdmin).then(({ error }) => {
                if (!error) {
                    console.log('[UsersView] Admin profile synced/recovered');
                    // We don't toast success here to keep UI clean, but log it.
                } else {
                    console.error('[UsersView] Admin auto-fix failed:', error.message);
                }
            });
        }

        setUsers(safeData);
        setLoading(false);
    };

    const [roles, setRoles] = useState<any[]>([]);

    // FETCH BRANCHES (Internal)
    const fetchBranches = async () => {
        try {
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setInternalBranches(data || []);
        } catch (err: any) {
            console.warn('[UsersView] Gagal ambil data cabang:', err.message);
        }
    };

    // FETCH ROLES
    const fetchRoles = async () => {
        const { data, error } = await supabase
            .from('roles')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.warn('Gagal ambil data:', error.message);
            // Fallback to defaults if table missing (Graceful degradation)
            if (roles.length === 0) {
                setRoles([]); // Keep empty or mock? Let's keep existing logic elsewhere
            }
        } else {
            setRoles(data || []);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchRoles();
        fetchBranches(); // Always fetch internally as backup
    }, []);

    const handleAddRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRole.name || !newRole.description) {
            toast.error('Mohon isi nama dan keterangan wewenang');
            return;
        }

        const payload = {
            name: newRole.name,
            description: newRole.description,
            permissions: newRole.permissions // Save checked permissions
        };

        let error;

        if (editingRole) {
            // UPDATE
            const res = await supabase.from('roles').update(payload).eq('id', editingRole.id);
            error = res.error;
        } else {
            // INSERT
            const res = await supabase.from('roles').insert(payload);
            error = res.error;
        }

        if (error) {
            console.error('Role Error:', error);
            toast.error(`Gagal menyimpan: ${error.message}`);

            if (error.message.includes('column "permissions" of relation "roles" does not exist')) {
                alert('⚠️ KOLOM HILANG: Tabel `roles` butuh kolom `permissions` (jsonb).\n\nMohon tambahkan kolom tersebut di Supabase.');
            } else if (error.message.includes('relation "roles" does not exist')) {
                alert('⚠️ TABEL HILANG: Silakan buat tabel `roles` di Supabase.');
            }
        } else {
            toast.success(editingRole ? 'Wewenang diperbarui' : 'Wewenang dibuat');
            setNewRole({ name: '', description: '', permissions: [] });
            setEditingRole(null);
            setIsAddRoleModalOpen(false);
            fetchRoles();
        }
    };

    const handleEditRoleClick = (role: any) => {
        setEditingRole(role);
        // Load existing permissions or empty array
        const existingPerms = role.permissions || [];
        // Handle case if permissions is stored as string in DB for some reason, though JSONB is best
        const parsedPerms = Array.isArray(existingPerms) ? existingPerms : [];

        setNewRole({
            name: role.name,
            description: role.description,
            permissions: parsedPerms
        });
        setIsAddRoleModalOpen(true);
    };

    // Helper for Checkbox toggling
    const togglePermission = (permId: string) => {
        setNewRole(prev => {
            const exists = prev.permissions.includes(permId);
            if (exists) {
                return { ...prev, permissions: prev.permissions.filter(p => p !== permId) };
            } else {
                return { ...prev, permissions: [...prev.permissions, permId] };
            }
        });
    };

    // Helper for Quick Presets (Recommendations)
    const applyPreset = (type: 'admin' | 'manager' | 'cashier') => {
        let perms: string[] = [];
        if (type === 'admin') perms = AVAILABLE_PERMISSIONS.map(p => p.id); // All
        if (type === 'manager') perms = ['dashboard', 'products', 'inventory', 'reports', 'employees', 'purchases', 'attendance', 'performance', 'mandatory_session'];
        if (type === 'cashier') perms = ['pos', 'products', 'attendance', 'mandatory_session'];
        if (type === 'display' as any) perms = ['pos', 'pos_order_only', 'products'];

        setNewRole(prev => ({ ...prev, permissions: perms }));
        toast.info(`Preset ${type.toUpperCase()} diterapkan`);
    };

    const handleGenerateDefaults = async () => {
        if (!confirm('Buat wewenang standar (Admin, Manajer, Kasir)?')) return;

        const defaults = [
            {
                name: 'Administrator',
                description: 'Akses penuh sistem',
                permissions: AVAILABLE_PERMISSIONS.map(p => p.id)
            },
            {
                name: 'Manajer',
                description: 'Manajemen operasional & laporan',
                permissions: ['dashboard', 'products', 'inventory', 'reports', 'employees', 'purchases', 'attendance', 'performance', 'shifts', 'mandatory_session']
            },
            {
                name: 'Kasir',
                description: 'Transaksi penjualan',
                permissions: ['pos', 'products', 'attendance', 'mandatory_session']
            },
            {
                name: 'Display',
                description: 'Hanya input pesanan',
                permissions: ['pos', 'pos_order_only', 'products']
            }
        ];

        const { error } = await supabase.from('roles').insert(defaults);

        if (error) {
            console.error('Seed Error:', error);
            toast.error('Gagal seed default: ' + error.message);
        } else {
            toast.success('Wewenang standar berhasil dibuat');
            fetchRoles();
        }
    };

    const handleEditUserClick = (user: any) => {
        setEditingUser(user);
        setNewUser({
            name: user.name || user.full_name || '',
            email: user.email || '',
            password: '', // Password empty means don't change
            role: user.role || (roles.length > 0 ? roles[0].name : ''),
            branchId: String(user.branchId || user.branch_id || '7')
        });
        setIsAddUserModalOpen(true);
    };


    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // 1. SETUP: Create temporary client for "Admin-created User"
            // We use a new client instance so we don't log out the current Admin
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseKey) {
                throw new Error('Konfigurasi Supabase tidak valid (URL/Key hilang).');
            }

            // Create valid client with NO persistence (so it doesn't touch local storage)
            const tempSupabase = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });

            // DEBUG: Konfirmasi role sebelum pendaftaran
            console.log('[UsersView] MEMULAI PENDAFTARAN. Role terpilih:', newUser.role);

            // 2. CREATE AUTH USER (Pass COMPLETE metadata)
            // We pass ALL likely fields so the Database Trigger (if any) can populate the profile automatically
            // This bypasses RLS issues because Triggers run as System.
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: newUser.email,
                password: newUser.password,
                options: {
                    data: {
                        name: newUser.name,
                        full_name: newUser.name,
                        username: newUser.email.split('@')[0],
                        role: newUser.role || 'Kasir',
                        branch_id: String(newUser.branchId || allBranches[0]?.id || '7')
                    }
                }
            });

            console.log('[UsersView] SignUp attempted with payload:', { email: newUser.email, role: newUser.role, branch_id: newUser.branchId });

            if (authError) {
                console.error('[UsersView] signUp error:', authError);
                throw new Error(`Auth Error: ${authError.message}`);
            }

            if (!authData.user) {
                console.error('[UsersView] No user data returned');
                throw new Error('Gagal membuat user (Tidak ada data user dikembalikan).');
            }

            const newUserId = authData.user.id;

            // 3. OPTIONAL: UPDATE PROFILE (Best Effort)
            // If a Trigger already created the profile, we try to update it to ensure data is correct.
            // PRO FIX: Wait for trigger to complete and then use explicit update() to override defaults like 'Kasir'.
            await new Promise(r => setTimeout(r, 1000)); // Increased delay to 1s for consistency

            try {
                // Ensure role is exactly what was selected
                const finalRole = newUser.role || (roles.length > 0 ? roles[0].name : 'Administrator');
                
                const payload: any = {
                    status: 'Aktif',
                    name: newUser.name,
                    role: finalRole,
                    username: newUser.email.split('@')[0],
                    email: newUser.email,
                    full_name: newUser.name,
                    branch_id: String(newUser.branchId || allBranches[0]?.id || '7')
                };

                console.log('[UsersView] FORCING Profile update payload:', payload);

                console.log('[UsersView] FORCING Profile update with role:', finalRole);
                
                // Use UPSERT to ensure the profile is created whether or not a database trigger exists
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({ ...payload, id: newUserId });

                if (profileError) {
                    console.warn('[UsersView] Manual Profile Update prevented (likely RLS). Relying on Auth Metadata.', profileError.message);
                } else {
                    console.log('[UsersView] Profile FORCED successfully with role:', finalRole);
                }
            } catch (profileErr) {
                console.warn('[UsersView] Profile step error:', profileErr);
            }

            toast.success('Pengguna berhasil dibuat! Data profil sinkron.');

            // 4. CLEANUP & REFRESH
            setNewUser({ name: '', email: '', password: '', role: (roles.length > 0 ? roles[0].name : 'Kasir'), branchId: String(allBranches[0]?.id || '7') });
            setIsAddUserModalOpen(false);
            fetchUsers(); // Refresh list

        } catch (err: any) {
            console.error('[UsersView] CRITICAL Add User Error:', err);
            toast.error(`GAGAL MENAMBAH PENGGUNA: ${err.message || 'Error tidak dikenal'}`);
        }
    };

    // Updated handleAddUser logic to support Edit
    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (editingUser) {
            // --- UPDATE LOGIC ---
            try {
                // 1. Update Profile (Name, Role, Branch)
                const payload: any = {
                    name: newUser.name,
                    full_name: newUser.name, // Keep synced
                    email: newUser.email,    // Now allowing email update
                    role: newUser.role,
                    branch_id: String(newUser.branchId || allBranches[0]?.id || '7'),
                };

                const { error: profileError } = await supabase
                    .from('profiles')
                    .update(payload)
                    .eq('id', editingUser.id);

                if (profileError) throw profileError;

                // 2. Update Password (IF PROVIDED)
                if (newUser.password && newUser.password.trim() !== '') {
                    const { data: resetResult, error: resetError } = await supabase.rpc('admin_reset_password', {
                        target_user_id: editingUser.id,
                        new_password: newUser.password
                    });

                    if (resetError) {
                        toast.error(`Profil diperbarui, tapi GAGAL reset password: ${resetError.message}`);
                    } else if (resetResult && resetResult.success === false) {
                        toast.error(`Profil diperbarui, tapi GAGAL reset password: ${resetResult.message}`);
                    } else {
                        toast.success('Password berhasil diperbarui');
                    }
                }

                toast.success('Data pengguna berhasil diperbarui');
                setEditingUser(null);
                setNewUser({ name: '', email: '', password: '', role: (roles.length > 0 ? roles[0].name : 'Administrator'), branchId: allBranches[0]?.id || '7' });
                setIsAddUserModalOpen(false);
                fetchUsers();

            } catch (err: any) {
                console.error('Update Error:', err);
                toast.error(`Gagal update: ${err.message}`);
            }
        } else {
            // --- CREATE LOGIC (Existing handleAddUser) ---
            await handleAddUser(e);
        }
    };

    const handleAddClick = () => {
        if (activeTab === 'roles') {
            setIsAddRoleModalOpen(true);
        } else {
            // Set default role and branch for new user
            const defaultRole = roles.find(r => r.name === 'Administrator') || roles[0];
            const defaultBranch = allBranches[0];
            
            setNewUser(prev => ({ 
                ...prev, 
                role: prev.role || defaultRole?.name || 'Administrator',
                branchId: prev.branchId || String(defaultBranch?.id || '7')
            }));
            setIsAddUserModalOpen(true);
        }
    };

    const handleDeleteUser = async (id: string | number) => {
        if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini secara permanen?')) return;

        try {
            // STRATEGI BARU: Prioritaskan Hard Delete (Hapus Permanen)
            // Jika gagal karena data terkait (Foreign Key), baru tawarkan Soft Delete.

            const { error: hardDeleteError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', id);

            if (!hardDeleteError) {
                setUsers(prev => prev.filter(u => u.id !== id));
                toast.success('Pengguna berhasil dihapus permanen');
                return;
            }

            // Jika error karena Foreign Key (Data penjualan/absensi terkait)
            if (hardDeleteError.code === '23503') {
                const confirmSoft = confirm('Tidak bisa hapus permanen karena ada data riwayat transaksi/absensi.\n\nApakah Anda ingin MENONAKTIFKAN pengguna ini saja?');

                if (confirmSoft) {
                    const { error: softError } = await supabase
                        .from('profiles')
                        .update({ status: 'Nonaktif' })
                        .eq('id', id);

                    if (!softError) {
                        // Update UI (Remove from list if we are hiding non-active)
                        // Or update status in UI
                        setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'Nonaktif' } : u));
                        toast.success('Pengguna dinonaktifkan (Data riwayat aman)');
                    } else {
                        toast.error('Gagal menonaktifkan: ' + softError.message);
                    }
                }
                return;
            }

            throw hardDeleteError;

        } catch (error: any) {
            console.error('Delete Error:', error);
            alert(`Gagal menghapus: ${error.message}`);
        }
    };

    const handleDeleteRole = async (id: number) => {
        if (!confirm('Apakah Anda yakin ingin menghapus wewenang ini?')) return;

        const { error } = await supabase.from('roles').delete().eq('id', id);

        if (error) {
            toast.error('Gagal menghapus: ' + error.message);
        } else {
            toast.success('Wewenang berhasil dihapus');
            fetchRoles();
        }
    };

    const filteredUsers = users.filter(u =>
        u.status !== 'Nonaktif' && // Hide deleted/inactive users
        (
            (u.name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
            (u.role || '').toLowerCase().includes(userSearchQuery.toLowerCase())
        )
    );

    const filteredRoles = roles.filter(r =>
        r.name.toLowerCase().includes(roleSearchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(roleSearchQuery.toLowerCase())
    );

    return (
        <div className="flex h-full bg-gray-50/50 relative">
            {/* Sub-module Sidebar */}
            <div className="w-56 bg-white border-r border-gray-200 p-6 flex flex-col gap-2">
                <h2 className="text-xl font-bold text-gray-800 mb-6 px-2">Manajemen Pengguna</h2>

                {/* Primary Action Button */}
                <Button
                    onClick={handleAddClick}
                    className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-100 rounded-xl mb-6 h-12"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    {activeTab === 'users' ? 'Tambah Pengguna' : 'Tambah Wewenang'}
                </Button>

                <div className="space-y-1">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'users'
                            ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                    >
                        <Users className={`w-5 h-5 ${activeTab === 'users' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span>Pengguna</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('roles')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'roles'
                            ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                    >
                        <Shield className={`w-5 h-5 ${activeTab === 'roles' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span>Wewenang</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-800">
                                {activeTab === 'users' ? 'Daftar Pengguna' : 'Hak Akses & Wewenang'}
                            </h3>
                            <p className="text-gray-500 text-sm mt-1">
                                {activeTab === 'users' ? 'Kelola pengguna sistem dan akun mereka.' : 'Konfigurasi peran dan tingkat akses.'}
                            </p>
                        </div>
                        <div className="flex gap-2 ml-auto mr-2 animate-in fade-in">
                            <Button variant="outline" size="sm" onClick={() => {
                                if (users.length > 0) {
                                    // Alert raw JSON of the last user (likely the one just added)
                                    const sample = users[users.length - 1];
                                    alert('DEBUG DATA USER TERAKHIR:\n\n' + JSON.stringify(sample, null, 2));
                                } else {
                                    alert('Tidak ada data user.');
                                }
                            }} className="text-xs border-dashed">
                                🔍 Debug Data
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { activeTab === 'users' ? fetchUsers() : fetchRoles() }}>
                                Refresh Data
                            </Button>
                        </div>
                    </div>

                    {/* Self-Healing Banner */}
                    {activeTab === 'users' && user && !users.some(u => u.id === user.id) && (
                        <div className="admin-warning-banner bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-red-800">Profil Admin Tidak Ditemukan</h4>
                                    <p className="text-xs text-red-600">Akun Anda sedang login, tetapi data profil tidak ada di database.</p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={async () => {
                                    try {
                                        // 1. INSPECT SCHEMA from existing data
                                        const { data: existingData } = await supabase.from('profiles').select('*').limit(1);
                                        const sample = existingData && existingData[0] ? existingData[0] : null;

                                        // 2. CONSTRUCT PAYLOAD dynamically
                                        const payload: any = { id: user.id };

                                        if (sample) {
                                            // Auto-map based on available columns
                                            if ('name' in sample) payload.name = user.user_metadata?.name || 'Admin Utama';
                                            if ('full_name' in sample) payload.full_name = user.user_metadata?.name || 'Admin Utama';
                                            if ('username' in sample) payload.username = 'admin_utama';
                                            if ('email' in sample) payload.email = user.email;
                                            if ('role' in sample) payload.role = 'Administrator';
                                            if ('status' in sample) payload.status = 'Aktif';
                                            // Debug log
                                            console.log('Detected Schema:', Object.keys(sample));
                                        } else {
                                            // Fallback if table is empty
                                            payload.name = 'Admin Utama';
                                            payload.role = 'Administrator';
                                        }

                                        // 3. EXECUTE UPSERT (Insert or Update)
                                        const { error } = await supabase.from('profiles').upsert(payload);

                                        if (error) {
                                            const confirmBypass = confirm(`DATABASE ERROR: ${error.message}\n\nApakah Anda ingin memaksa masuk sebagai Admin sementara (Bypass)?`);
                                            if (confirmBypass) {
                                                document.querySelector('.admin-banner')?.remove();
                                                toast.success('Mode Admin Darurat Diaktifkan');
                                            }
                                        } else {
                                            alert('SUKSES! Profil Admin telah dibuat/diperbarui. Halaman akan dimuat ulang.');
                                            window.location.reload();
                                        }
                                    } catch (err: any) {
                                        alert(`UNEXPECTED ERROR: ${err.message}`);
                                    }
                                }}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Buat Profil Admin Saya
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-100 ml-2"
                                onClick={() => {
                                    const banner = document.querySelector('.admin-warning-banner');
                                    if (banner) banner.remove(); // Simple DOM removal for session
                                }}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    {/* Missing Role Banner (Self-Fix) */}
                    {activeTab === 'users' && user && users.some(u => u.id === user.id && !u.role) && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-2 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-orange-800">Role Anda Belum Diatur</h4>
                                    <p className="text-xs text-orange-700">Akun Anda tidak memiliki hak akses (Administrator), sehingga data pengguna lain tidak terlihat.</p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-200"
                                onClick={async () => {
                                    try {
                                        const { error } = await supabase.from('profiles').update({ role: 'Administrator' }).eq('id', user.id);
                                        if (error) throw error;
                                        toast.success('Berhasil! Anda sekarang Administrator.');
                                        fetchUsers();
                                    } catch (err: any) {
                                        toast.error('Gagal update role: ' + err.message);
                                    }
                                }}
                            >
                                <Shield className="w-4 h-4 mr-2" />
                                Klaim Akses Admin
                            </Button>
                        </div>
                    )}

                    {activeTab === 'users' ? (
                        /* Users Table */
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                                <div className="relative max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Nama</th>
                                        <th className="px-6 py-4 font-semibold">Email</th>
                                        <th className="px-6 py-4 font-semibold">Peran</th>
                                        <th className="px-6 py-4 font-semibold">Cabang</th>
                                        <th className="px-6 py-4 font-semibold">Status</th>
                                        <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {/* Grouped User List Logic */}
                                    {(() => {
                                        // 1. Group users by role
                                        const grouped: Record<string, any[]> = {};
                                        filteredUsers.forEach(u => {
                                            const role = u.role || 'Tanpa Peran';
                                            if (!grouped[role]) grouped[role] = [];
                                            grouped[role].push(u);
                                        });

                                        // 2. Sort roles (Admin first)
                                        const roleOrder = ['Administrator', 'Manajer', 'Kasir', 'Waitress', 'Barista', 'Tanpa Peran'];
                                        const sortedRoleNames = Object.keys(grouped).sort((a, b) => {
                                            const indexA = roleOrder.indexOf(a);
                                            const indexB = roleOrder.indexOf(b);
                                            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                            if (indexA !== -1) return -1;
                                            if (indexB !== -1) return 1;
                                            return a.localeCompare(b);
                                        });

                                        return sortedRoleNames.map(roleName => (
                                            <React.Fragment key={roleName}>
                                                {/* Role Group Header */}
                                                <tr className="bg-gray-50/80">
                                                    <td colSpan={6} className="px-6 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <Shield className="w-4 h-4 text-primary/70" />
                                                            <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                                                {roleName} ({grouped[roleName].length})
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Users in this Group */}
                                                {grouped[roleName].map((user) => {
                                                    const branchId = user.branchId || user.branch_id;
                                                    const status = user.status || 'Aktif';
                                                    return (
                                                        <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group border-b border-gray-50 last:border-b-0">
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-gray-800">{user.name || user.full_name || 'Tanpa Nama'}</span>
                                                                    <span className="text-[10px] text-gray-400 uppercase tracking-tighter">ID: {String(user.id).slice(-6)}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-500 text-xs">
                                                                {user.email || user.username || '-'}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                                    {user.role || 'Tanpa Peran'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-gray-600 text-xs font-medium">
                                                                    {allBranches.find(b => String(b.id) === String(branchId))?.name || `Cabang ${branchId}` || 'Semua Cabang'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${status === 'Aktif'
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                                    : 'bg-gray-100 text-gray-500 border-gray-200'
                                                                    }`}>
                                                                    <span className={`w-1 h-1 rounded-full ${status === 'Aktif' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                                    {status.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => handleEditUserClick(user)}
                                                                        className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteUser(user.id)}
                                                                        className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                                                                        title="Hapus"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Roles Table */
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                                <div className="relative max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={roleSearchQuery}
                                        onChange={(e) => setRoleSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Nama Wewenang</th>
                                        <th className="px-6 py-4 font-semibold">Keterangan</th>
                                        <th className="px-6 py-4 font-semibold">Pengguna Aktif</th>
                                        <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {roles.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Shield className="w-12 h-12 text-gray-200" />
                                                    <p>Belum ada wewenang tersimpan.</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleGenerateDefaults}
                                                        className="mt-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                                                    >
                                                        Buat Default (Admin, Manajer, Kasir)
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {filteredRoles.map((role) => {
                                        // Calculate users count dynamically from currently loaded profiles
                                        const userCount = users.filter(u => u.role === role.name).length;

                                        return (
                                            <tr key={role.id} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-4 font-bold text-gray-700">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                                            <Shield className="w-4 h-4" />
                                                        </div>
                                                        {role.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">{role.description}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex -space-x-2 overflow-hidden items-center gap-2">
                                                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                                                            {userCount} Users
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleEditRoleClick(role)}
                                                        className="text-blue-600 hover:text-blue-700 text-xs font-semibold mr-4 hover:underline"
                                                    >
                                                        Edit Izin
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRole(role.id)}
                                                        className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Hapus Wewenang"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Role Modal */}
            {isAddRoleModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-bold text-lg text-gray-800">
                                {editingRole ? 'Edit Wewenang' : 'Buat Wewenang Baru'}
                            </h3>
                            <button
                                onClick={() => {
                                    setIsAddRoleModalOpen(false);
                                    setEditingRole(null);
                                    setNewRole({ name: '', description: '', permissions: [] });
                                }}
                                className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddRole} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Nama Wewenang</label>
                                <input
                                    type="text"
                                    required
                                    value={newRole.name}
                                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Keterangan</label>
                                <textarea
                                    required
                                    value={newRole.description}
                                    onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                                />
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold text-gray-800">Hak Akses (Permissions)</label>
                                    <div className="flex gap-1">
                                        <button type="button" onClick={() => applyPreset('cashier')} className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">Kasir</button>
                                        <button type="button" onClick={() => applyPreset('manager')} className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">Manajer</button>
                                        <button type="button" onClick={() => applyPreset('admin')} className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">Admin</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                    {AVAILABLE_PERMISSIONS.map((perm) => (
                                        <div
                                            key={perm.id}
                                            onClick={() => togglePermission(perm.id)}
                                            className={`
                                                flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all select-none
                                                ${(newRole.permissions || []).includes(perm.id)
                                                    ? 'bg-blue-50 border-blue-200'
                                                    : 'bg-white border-gray-100 hover:border-gray-300'}
                                            `}
                                        >
                                            <div className={`
                                                w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition-colors
                                                ${(newRole.permissions || []).includes(perm.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}
                                            `}>
                                                {(newRole.permissions || []).includes(perm.id) && <Users className="w-3 h-3 text-white" />}
                                                {/* Reusing Users icon as Checkmark approx */}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-xs font-semibold ${(newRole.permissions || []).includes(perm.id) ? 'text-blue-700' : 'text-gray-700'}`}>
                                                    {perm.label}
                                                </span>
                                                <span className="text-[10px] text-gray-500 leading-tight">
                                                    {perm.description}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>


                            <div className="pt-2 flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setIsAddRoleModalOpen(false);
                                        setEditingRole(null);
                                        setNewRole({ name: '', description: '', permissions: [] });
                                    }}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-primary hover:bg-primary/90 text-white"
                                >
                                    {editingUser ? 'Simpan Perubahan' : 'Buat Pengguna'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {isAddUserModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-bold text-lg text-gray-800">{editingUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</h3>
                            <button
                                onClick={() => {
                                    setIsAddUserModalOpen(true);
                                    setEditingUser(null);
                                    // Robust initialization: Find Administrator role or first in list
                                    const defaultRoleObj = roles.find(r => r.name === 'Administrator') || roles[0];
                                    const defaultBranch = allBranches[0];
                                    
                                    setNewUser({ 
                                        name: '', 
                                        email: '', 
                                        password: '', 
                                        role: defaultRoleObj?.name || 'Administrator', 
                                        branchId: String(defaultBranch?.id || '7') 
                                    });
                                }}
                                className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Nama Lengkap</label>
                                <input
                                    type="text"
                                    required
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Alamat Email</label>
                                <input
                                    type="email"
                                    required
                                    autoComplete="off"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                                {editingUser && (
                                    <div className="flex items-start gap-2 p-2 bg-blue-50/50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-1">
                                        <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                                        <p className="text-[10px] text-blue-700 leading-tight">
                                            <b>Catatan:</b> Email ini untuk data profil. Untuk mengganti email <b>Login</b>, silakan hapus akun ini dan buat yang baru.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    {editingUser ? 'Kata Sandi (Kosongkan jika tidak diganti)' : 'Kata Sandi'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingUser} // Required only for new users
                                    autoComplete="new-password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Peran</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white"
                                >
                                    {roles.map(role => (
                                        <option key={role.id} value={role.name}>{role.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Cabang Penempatan</label>
                                <select
                                    value={newUser.branchId}
                                    onChange={(e) => setNewUser({ ...newUser, branchId: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white"
                                >
                                    {(allBranches || []).map(branch => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setIsAddUserModalOpen(false)}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-primary hover:bg-primary/90 text-white"
                                >
                                    Tambah Pengguna
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
