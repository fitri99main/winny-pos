import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Mail, Phone, Briefcase, CreditCard, Printer, X, Settings2, Zap, AlertCircle, ExternalLink, RefreshCw, Shuffle } from 'lucide-react';
import { Button } from '../ui/button';
import { QRCard } from '../ui/QRCard';
import { toast } from 'sonner';
import { fingerprint, FingerprintResult } from '../../lib/fingerprint';

export interface Employee {
    id: number;
    name: string;
    position: string;
    department: string;
    email: string;
    phone: string;
    joinDate: string;
    status: 'Active' | 'On Leave' | 'Terminated';
    offDays: number[]; // [0-6] where 0 is Sunday
    pin?: string; // PIN for Kiosk Access
    system_role?: string; // NEW: System Role (Admin, Cashier, etc.)
    barcode?: string; // NEW: Barcode for Attendance
    fingerprint_template?: string; // NEW: Fingerprint Template (Base64)
    base_salary?: number; // NEW: Base Salary (Gaji Pokok)
}

export interface Department {
    id: number;
    name: string;
}

const DAYS_NAME = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

interface EmployeesViewProps {
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>; // Keep for compatibility or remove if unused
    departments: Department[];
    setDepartments: React.Dispatch<React.SetStateAction<Department[]>>; // Keep for compatibility
    onEmployeeCRUD?: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>;
    onDepartmentCRUD?: (action: 'create' | 'delete', data: any) => Promise<void>;
}

export function EmployeesView({
    employees,
    setEmployees,
    departments,
    setDepartments,
    onEmployeeCRUD = async () => { },
    onDepartmentCRUD = async () => { }
}: EmployeesViewProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Employee>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCard, setSelectedCard] = useState<Employee | null>(null);
    const [newDeptName, setNewDeptName] = useState('');
    const [formTab, setFormTab] = useState<'basic' | 'access'>('basic');
    const [isScanning, setIsScanning] = useState(false);
    const [fpStatus, setFpStatus] = useState('');
    const [fpError, setFpError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const handleFpRetry = () => {
        fingerprint.forceResetBusy();
        setRetryCount(prev => prev + 1);
        setIsScanning(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.position) {
            toast.error('Nama dan Jabatan wajib diisi');
            return;
        }

        try {
            if (formData.id) {
                // Update
                await onEmployeeCRUD('update', formData);
            } else {
                // Create
                const newEmp = {
                    ...formData,
                    // id: Date.now(), // Handled by DB or stripped in Home
                    status: formData.status || 'Active',
                    joinDate: formData.joinDate || new Date().toISOString().split('T')[0],
                    offDays: formData.offDays || [],
                    pin: formData.pin || '123456', // Default PIN if not set
                    base_salary: formData.base_salary || 0
                };
                await onEmployeeCRUD('create', newEmp);
            }
            setIsFormOpen(false);
            setFormData({});
        } catch (error) {
            console.error('Error in handleSubmit:', error);
            // toast.error is usually handled by onEmployeeCRUD in home.tsx
        }
    };

    const handleAddDept = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDeptName.trim()) return;
        const newDept = { name: newDeptName.trim() };
        onDepartmentCRUD('create', newDept);
        setNewDeptName('');
    };

    const handleDeleteDept = (id: number) => {
        const deptToDelete = departments.find(d => d.id === id);
        if (confirm(`Yakin ingin menghapus departemen ${deptToDelete?.name}?`)) {
            onDepartmentCRUD('delete', { id });
        }
    };

    const toggleOffDay = (dayIndex: number) => {
        const currentOffDays = Array.isArray(formData.offDays) ? formData.offDays : [];
        if (currentOffDays.includes(dayIndex)) {
            setFormData({ ...formData, offDays: currentOffDays.filter(d => d !== dayIndex) });
        } else {
            setFormData({ ...formData, offDays: [...currentOffDays, dayIndex] });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Yakin ingin menghapus data karyawan ini?')) {
            onEmployeeCRUD('delete', { id });
        }
    };

    const handleRandomizeAllOffDays = async () => {
        if (!confirm('Peringatan: Ini akan mengacak jadwal libur mingguan untuk SEMUA karyawan. Lanjutkan?')) return;

        try {
            toast.promise(
                Promise.all(employees.map(emp => {
                    // Pick 1 or 2 random unique days
                    const numDays = Math.floor(Math.random() * 2) + 1; // 1 to 2
                    const days = [0, 1, 2, 3, 4, 5, 6];
                    const shuffled = days.sort(() => 0.5 - Math.random());
                    const newOffDays = shuffled.slice(0, numDays);
                    
                    return onEmployeeCRUD('update', { ...emp, offDays: newOffDays });
                })),
                {
                    loading: 'Mengacak jadwal libur...',
                    success: 'Semua jadwal libur karyawan berhasil diacak!',
                    error: 'Gagal mengacak jadwal libur.'
                }
            );
        } catch (error) {
            console.error('Error randomizing off days:', error);
        }
    };

    const handleFingerprintEnroll = async (useMock: boolean = false) => {
        console.log(`Memulai Enrollment Fingerprint... (${useMock ? 'SIMULASI' : 'REAL'})`);
        setIsScanning(true);
        setFpStatus(useMock ? 'Simulasi: Tempel Jari...' : 'Menghubungkan ke Scanner...');

        const callback = (status: string, result?: FingerprintResult) => {
            console.log('Fingerprint Status:', status, result);
            if (status === 'SUCCESS' && result?.success) {
                console.log('Enrollment Berhasil, Template:', result.template?.substring(0, 20) + '...');
                setFormData(prev => ({ ...prev, fingerprint_template: result.template }));
                toast.success(`Sidik jari berhasil didaftarkan! (${useMock ? 'Simulasi' : 'Real'})`);
                setIsScanning(false);
                setFpStatus('');
            } else if (status === 'ERROR') {
                console.error('Enrollment Error:', result);
                const errorMessage = result?.message || 'Gagal mendaftarkan sidik jari';
                setFpError(errorMessage);
                toast.error(errorMessage);
                setIsScanning(false);
                setFpStatus('');
            } else {
                if (status === 'WAITING_FOR_FINGER') {
                    setFpStatus('Silakan Tempel Jari Anda');
                    setIsScanning(false);
                } else {
                    setFpStatus(status === 'ALAT_TERDETEKSI' ? 'Alat Terdeteksi! Menyiapkan...' : status);
                }
                if (status === 'ALAT_TERDETEKSI') setFpError(null);
            }
        };

        if (useMock) {
            fingerprint.mockCapture(callback);
        } else {
            await fingerprint.startCapture(callback, 'ENROLL');
        }
    };

    const filteredEmployees = (employees || []).filter(emp =>
        (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.position || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.department || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-8 h-full bg-gray-50/50 flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Manajemen Karyawan</h2>
                    <p className="text-gray-500 font-medium">Kelola data, jabatan, dan struktur departemen.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsDeptModalOpen(true)} className="gap-2 border-dashed">
                        <Settings2 className="w-4 h-4" /> Kelola Departemen
                    </Button>
                    <Button variant="outline" onClick={handleRandomizeAllOffDays} className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50">
                        <Shuffle className="w-4 h-4" /> Acak Libur
                    </Button>
                    <Button onClick={() => { setFormData({ offDays: [] }); setIsFormOpen(true); }} className="gap-2 shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4" /> Tambah Karyawan
                    </Button>
                </div>
            </div>

            {/* Employee List */}
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col">
                <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                    </div>
                </div>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 text-gray-400 text-left border-b border-gray-100">
                            <tr>
                                <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Nama Karyawan</th>
                                <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Jabatan & Departemen</th>
                                <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Kontak</th>
                                <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Biometrik</th>
                                <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Jadwal Libur (Off)</th>
                                <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id} className="group hover:bg-gray-50/50 transition-all">
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-gray-800 group-hover:text-primary transition-colors">{emp.name}</div>
                                        <div className="text-[10px] text-gray-400 font-medium tracking-tight italic">Join: {emp.joinDate}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2 text-gray-700 font-bold"><Briefcase className="w-3.5 h-3.5 text-primary/60" /> {emp.position}</div>
                                        <div className="text-[10px] text-gray-500 ml-5 font-black uppercase tracking-widest">{emp.department || '-'}</div>
                                    </td>
                                    <td className="px-8 py-5 space-y-1">
                                        <div className="flex items-center gap-2 text-gray-500 text-[11px] font-medium"><Mail className="w-3 h-3 opacity-50" /> {emp.email}</div>
                                        <div className="flex items-center gap-2 text-gray-500 text-[11px] font-medium"><Phone className="w-3 h-3 opacity-50" /> {emp.phone}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        {emp.fingerprint_template ? (
                                            <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit border border-emerald-100">
                                                <Zap className="w-3 h-3 fill-emerald-600" />
                                                <span className="text-[10px] font-black uppercase">Aktif</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 px-2 py-1 rounded-lg w-fit border border-gray-100">
                                                <Zap className="w-3 h-3" />
                                                <span className="text-[10px] font-black uppercase">Belum</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-wrap gap-1">
                                            {emp.offDays && Array.isArray(emp.offDays) && emp.offDays.length > 0 ? (
                                                [...emp.offDays].sort().map(d => (
                                                    <span key={d} className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[10px] font-black uppercase ring-1 ring-red-100">
                                                        {DAYS_NAME[d] || 'N/A'}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-300 text-[10px] italic">Tidak ada hari libur</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setSelectedCard(emp)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors" title="Cetak ID Card"><CreditCard className="w-4 h-4" /></button>
                                        <button
                                            onClick={() => {
                                                setFormData({
                                                    ...emp,
                                                    offDays: Array.isArray(emp.offDays) ? emp.offDays : []
                                                });
                                                setIsFormOpen(true);
                                            }}
                                            className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                                            title="Edit Data"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(emp.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form Modal */}
            {isFormOpen && (
                <div 
                    className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 md:p-20 overflow-y-auto cursor-pointer"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            console.log('[EmployeesView] Form Backdrop MouseDown');
                            setIsFormOpen(false);
                        }
                    }}
                >
                    <div 
                        className="bg-white rounded-[32px] md:rounded-[40px] shadow-2xl w-full max-w-xl max-h-fit overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col cursor-default"
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <div className="px-6 md:px-8 pt-6 md:pt-8 shrink-0">
                            <h3 className="text-xl font-bold text-gray-800">{formData.id ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}</h3>
                            <p className="text-gray-500 text-xs font-medium mt-1">Lengkapi biodata dan tentukan departemen kerja.</p>

                            {/* Tab Switcher */}
                            <div className="flex gap-1.5 mt-5 p-1 bg-gray-100/80 rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setFormTab('basic')}
                                    className={`px-5 py-2 rounded-lg text-[10px] font-bold transition-all ${formTab === 'basic' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    BIODATA
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormTab('access')}
                                    className={`px-5 py-2 rounded-lg text-[10px] font-bold transition-all ${formTab === 'access' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    AKSES & SISTEM
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="px-6 md:px-8 py-6 space-y-4 flex-1">
                            {formTab === 'basic' ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight pl-1">Nama Lengkap Karyawan</label>
                                        <input className="w-full p-2.5 md:p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-semibold text-gray-800 text-sm md:text-base shadow-sm" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight pl-1">Jabatan / Role</label>
                                            <input className="w-full p-2.5 md:p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-semibold" value={formData.position || ''} onChange={e => setFormData({ ...formData, position: e.target.value })} required />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight pl-1">Departemen</label>
                                            <select className="w-full p-2.5 md:p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-semibold text-gray-700" value={formData.department || ''} onChange={e => setFormData({ ...formData, department: e.target.value })}>
                                                <option value="">Pilih...</option>
                                                {(departments || []).map(dept => (
                                                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight pl-1">Email (Login ID)</label>
                                            <input type="email" className="w-full p-2.5 md:p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-semibold" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight pl-1">Nomor WhatsApp</label>
                                            <input className="w-full p-2.5 md:p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight pl-1">Tanggal Bergabung</label>
                                            <input type="date" className="w-full p-2.5 md:p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-semibold" value={formData.joinDate || ''} onChange={e => setFormData({ ...formData, joinDate: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight pl-1">Status Kepegawaian</label>
                                            <select className="w-full p-2.5 md:p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-semibold text-gray-700" value={formData.status || 'Active'} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                                <option value="Active">Aktif</option>
                                                <option value="On Leave">Cuti</option>
                                                <option value="Terminated">Berhenti</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5 col-span-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight pl-1">Gaji Pokok (Base Salary)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">Rp</span>
                                                <input 
                                                    type="number"
                                                    className="w-full pl-12 p-2.5 md:p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold text-gray-800" 
                                                    value={formData.base_salary || ''} 
                                                    onChange={e => setFormData({ ...formData, base_salary: Number(e.target.value) })} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight pl-1">PIN Akses Kiosk</label>
                                            <input
                                                type="text"
                                                pattern="[0-9]*"
                                                inputMode="numeric"
                                                maxLength={6}
                                                className="w-full p-2.5 md:p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold tracking-widest"
                                                value={formData.pin || ''}
                                                onChange={e => setFormData({ ...formData, pin: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight pl-1">Barcode ID</label>
                                            <input
                                                className="w-full p-2.5 md:p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-semibold"
                                                value={formData.barcode || ''}
                                                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-blue-500 uppercase tracking-tight pl-1">Sidik Jari (Fingerprint)</label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        className="w-full pl-10 p-2.5 bg-blue-50/30 border border-blue-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-[9px] font-mono tracking-tight font-semibold truncate"
                                                        value={formData.fingerprint_template ? 'REGISTERED' : ''}
                                                        readOnly
                                                    />
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                                        <Zap className={`w-4 h-4 ${formData.fingerprint_template ? 'text-emerald-500' : 'text-blue-400'}`} />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFpError(null);
                                                        handleFingerprintEnroll(false);
                                                    }}
                                                    disabled={isScanning}
                                                    className={`px-3 rounded-xl font-bold text-[9px] uppercase transition-all flex items-center gap-1.5 ${isScanning
                                                        ? 'bg-blue-100 text-blue-400'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                                                        }`}
                                                >
                                                    {isScanning ? (
                                                        <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                                    ) : <Plus className="w-3 h-3" />}
                                                    {isScanning ? 'Scan' : 'Daftar'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between pl-1">
                                                <label className="text-[10px] font-bold text-blue-400 uppercase tracking-tight">Level Akses Sistem</label>
                                                <span className="text-[8px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Bisa Otorisasi POS</span>
                                            </div>
                                            <select
                                                value={formData.system_role || ''}
                                                onChange={(e) => setFormData({ ...formData, system_role: e.target.value || undefined })}
                                                className="w-full p-2.5 md:p-3 bg-blue-50/50 border border-blue-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-semibold text-gray-700"
                                            >
                                                <option value="">Hanya Lapangan (Staff)</option>
                                                <option value="Cashier">Kasir (Cashier)</option>
                                                <option value="Supervisor">Supervisor (Auth)</option>
                                                <option value="Manager">Manager (Auth)</option>
                                                <option value="Owner">Owner (Auth)</option>
                                                <option value="Administrator">Administrator (Full)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-gray-100/50 p-4 rounded-2xl border border-gray-100/50">
                                        <div className="flex justify-between items-center mb-3 ml-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block">Libur mingguan (Weekly Off)</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const numDays = Math.floor(Math.random() * 2) + 1;
                                                    const days = [0, 1, 2, 3, 4, 5, 6];
                                                    const shuffled = days.sort(() => 0.5 - Math.random());
                                                    setFormData({ ...formData, offDays: shuffled.slice(0, numDays) });
                                                }}
                                                className="text-[9px] font-bold text-orange-600 uppercase flex items-center gap-1 hover:text-orange-700 transition-colors"
                                            >
                                                <Shuffle className="w-2.5 h-2.5" /> Acak
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {DAYS_NAME.map((day, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => toggleOffDay(idx)}
                                                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${Array.isArray(formData.offDays) && formData.offDays.includes(idx)
                                                        ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-100'
                                                        : 'bg-white text-gray-400 border-gray-200 hover:border-red-200'
                                                        }`}
                                                >
                                                    {day.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col-reverse md:flex-row justify-end gap-2.5 pt-4 border-t border-gray-50">
                                <Button type="button" variant="outline" className="h-11 md:h-12 rounded-xl px-6 font-bold w-full md:w-auto text-sm" onClick={() => setIsFormOpen(false)}>Batal</Button>
                                <Button type="submit" className="h-11 md:h-12 rounded-xl px-8 shadow-lg shadow-primary/10 font-bold w-full md:w-auto text-sm">Simpan Data</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Department Management Modal */}
            {isDeptModalOpen && (
                <div 
                    className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center bg-black/60 backdrop-blur-md p-4 md:p-20 overflow-y-auto cursor-pointer"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            console.log('[EmployeesView] Dept Backdrop MouseDown');
                            setIsDeptModalOpen(false);
                        }
                    }}
                >
                    <div 
                        className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 tracking-tight">Kelola Departemen</h3>
                                <p className="text-xs text-gray-500 font-medium tracking-tight">Tambah atau hapus struktur organisasi.</p>
                            </div>
                            <button onClick={() => setIsDeptModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <form onSubmit={handleAddDept} className="flex gap-3">
                                <input
                                    className="flex-1 p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold"
                                    value={newDeptName}
                                    onChange={e => setNewDeptName(e.target.value)}
                                />
                                <Button type="submit" className="h-14 px-5 rounded-2xl"><Plus className="w-5 h-5" /></Button>
                            </form>
                            <div className="space-y-2 max-h-[300px] overflow-auto pr-2">
                                {departments.map(dept => (
                                    <div key={dept.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl group hover:border-red-100 transition-all">
                                        <span className="font-bold text-gray-700 tracking-tight">{dept.name}</span>
                                        <button onClick={() => handleDeleteDept(dept.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-8 border-t border-gray-50 bg-gray-50/10">
                            <Button className="w-full h-14 rounded-2xl font-black" variant="outline" onClick={() => setIsDeptModalOpen(false)}>Selesai</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ID Card Preview Modal */}
            {selectedCard && (
                <div 
                    className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 md:p-20 overflow-y-auto cursor-pointer"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            console.log('[EmployeesView] Card Backdrop MouseDown');
                            setSelectedCard(null);
                        }
                    }}
                >
                    <div 
                        className="bg-white rounded-[44px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <div className="px-10 py-6 border-b flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-black text-gray-800 tracking-tight">ID Card Digital Karyawan</h3>
                            <button onClick={() => setSelectedCard(null)} className="p-2.5 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5.5 h-5.5 text-gray-400" /></button>
                        </div>
                        <div className="p-12 flex flex-col items-center gap-10">
                            <QRCard
                                type="Employee"
                                name={selectedCard.name}
                                id={`EMP-${selectedCard.id}`}
                                roleOrTier={selectedCard.position}
                                joinDateOrBirthday={selectedCard.joinDate}
                            />
                            <div className="flex gap-4 w-full">
                                <Button variant="outline" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => setSelectedCard(null)}>Tutup</Button>
                                <Button className="flex-1 h-14 rounded-2xl gap-3 shadow-xl shadow-primary/20 font-black" onClick={() => window.print()}>
                                    <Printer className="w-5 h-5" /> Cetak Sekarang
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
