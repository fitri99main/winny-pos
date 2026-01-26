import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Mail, Phone, Briefcase, CreditCard, Printer, X, Settings2 } from 'lucide-react';
import { Button } from '../ui/button';
import { QRCard } from '../ui/QRCard';
import { toast } from 'sonner';

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.position) {
            toast.error('Nama dan Jabatan wajib diisi');
            return;
        }

        if (formData.id) {
            // Update
            onEmployeeCRUD('update', formData);
        } else {
            // Create
            const newEmp = {
                ...formData,
                // id: Date.now(), // Handled by DB or stripped in Home
                status: 'Active',
                joinDate: new Date().toISOString().split('T')[0],
                offDays: formData.offDays || []
            };
            onEmployeeCRUD('create', newEmp);
        }
        setIsFormOpen(false);
        setFormData({});
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
        const currentOffDays = formData.offDays || [];
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

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchQuery.toLowerCase())
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
                            placeholder="Cari karyawan atau departemen..."
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
                                        <div className="flex flex-wrap gap-1">
                                            {emp.offDays && emp.offDays.length > 0 ? (
                                                emp.offDays.slice().sort().map(d => (
                                                    <span key={d} className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[10px] font-black uppercase ring-1 ring-red-100">
                                                        {DAYS_NAME[d]}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-300 text-[10px] italic">Tidak ada hari libur</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setSelectedCard(emp)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors" title="Cetak ID Card"><CreditCard className="w-4.5 h-4.5" /></button>
                                        <button onClick={() => { setFormData(emp); setIsFormOpen(true); }} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors" title="Edit Data"><Edit className="w-4.5 h-4.5" /></button>
                                        <button onClick={() => handleDelete(emp.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors" title="Hapus"><Trash2 className="w-4.5 h-4.5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl p-10 space-y-8 animate-in zoom-in-95 duration-200">
                        <div>
                            <h3 className="text-2xl font-black text-gray-800 tracking-tight">{formData.id ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}</h3>
                            <p className="text-gray-500 text-sm font-medium">Lengkapi biodata dan tentukan departemen kerja.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Nama Lengkap Karyawan</label>
                                    <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-bold text-gray-800" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Jabatan / Role</label>
                                        <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold" value={formData.position || ''} onChange={e => setFormData({ ...formData, position: e.target.value })} placeholder="misal: Senior Barista" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Struktur Departemen</label>
                                        <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold text-gray-700" value={formData.department || ''} onChange={e => setFormData({ ...formData, department: e.target.value })}>
                                            <option value="">Pilih Departemen...</option>
                                            {departments.map(dept => (
                                                <option key={dept.id} value={dept.name}>{dept.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Alamat Email</label>
                                        <input type="email" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@winny.cafe" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Nomor WhatsApp</label>
                                        <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="08xx-xxxx-xxxx" />
                                    </div>
                                </div>

                                <div className="bg-gray-100/50 p-6 rounded-[32px] border border-gray-100/50">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4 ml-1">Jadwal Libur Tetap (Weekly Off Day)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS_NAME.map((day, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => toggleOffDay(idx)}
                                                className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-all border ${formData.offDays?.includes(idx)
                                                    ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-200'
                                                    : 'bg-white text-gray-400 border-gray-200 hover:border-red-200 hover:text-red-500'
                                                    }`}
                                            >
                                                {day.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-50">
                                <Button type="button" variant="outline" className="h-14 rounded-2xl px-8 font-bold" onClick={() => setIsFormOpen(false)}>Batal</Button>
                                <Button type="submit" className="h-14 rounded-2xl px-10 shadow-xl shadow-primary/20 font-black">Simpan Data</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Department Management Modal */}
            {isDeptModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
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
                                    placeholder="Nama Departemen Baru..."
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[44px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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
