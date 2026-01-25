import { useState } from 'react';
import { Clock, Plus, Search, Calendar, User, X, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface Shift {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string;
}

interface Schedule {
    id: string;
    employeeName: string;
    shiftId: string;
    date: string;
}

interface Employee {
    id: string;
    name: string;
    position: string;
}

export function ShiftsView() {
    const [shifts, setShifts] = useState<Shift[]>([
        { id: 's1', name: 'Shift Pagi', startTime: '07:00', endTime: '15:00', color: 'bg-blue-100 text-blue-700' },
        { id: 's2', name: 'Shift Sore', startTime: '15:00', endTime: '23:00', color: 'bg-orange-100 text-orange-700' },
        { id: 's3', name: 'Full Day', startTime: '08:00', endTime: '20:00', color: 'bg-purple-100 text-purple-700' },
    ]);

    const [schedules, setSchedules] = useState<Schedule[]>([
        { id: 'sc1', employeeName: 'Budi Santoso', shiftId: 's1', date: new Date().toISOString().split('T')[0] },
        { id: 'sc2', employeeName: 'Siti Aminah', shiftId: 's1', date: new Date().toISOString().split('T')[0] },
        { id: 'sc3', employeeName: 'Rudi Hermawan', shiftId: 's2', date: new Date().toISOString().split('T')[0] },
    ]);

    const [employees, setEmployees] = useState<Employee[]>([
        { id: 'e1', name: 'Budi Santoso', position: 'Barista' },
        { id: 'e2', name: 'Siti Aminah', position: 'Kasir' },
        { id: 'e3', name: 'Rudi Hermawan', position: 'Kitchen' },
    ]);

    const [activeTab, setActiveTab] = useState<'schedule' | 'definitions' | 'staff'>('schedule');
    const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);
    const [isEditShiftModalOpen, setIsEditShiftModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isEditScheduleModalOpen, setIsEditScheduleModalOpen] = useState(false);
    const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
    const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
    const [newShift, setNewShift] = useState({ name: '', startTime: '', endTime: '' });
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [newEmployee, setNewEmployee] = useState({ name: '', position: '' });
    const [newAssignment, setNewAssignment] = useState({ employeeName: '', shiftId: 's1', date: new Date().toISOString().split('T')[0] });

    const handleAddShift = (e: React.FormEvent) => {
        e.preventDefault();
        const shift: Shift = {
            id: `s${Date.now()}`,
            name: newShift.name,
            startTime: newShift.startTime,
            endTime: newShift.endTime,
            color: 'bg-gray-100 text-gray-700'
        };
        setShifts([...shifts, shift]);
        setIsAddShiftModalOpen(false);
        setNewShift({ name: '', startTime: '', endTime: '' });
        toast.success(`Shift ${newShift.name} berhasil dibuat`);
    };

    const handleUpdateShift = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingShift) return;
        setShifts(shifts.map(s => s.id === editingShift.id ? editingShift : s));
        setIsEditShiftModalOpen(false);
        setEditingShift(null);
        toast.success(`Shift ${editingShift.name} berhasil diperbarui`);
    };

    const handleAssignShift = (e: React.FormEvent) => {
        e.preventDefault();
        const schedule: Schedule = {
            id: `sc${Date.now()}`,
            ...newAssignment
        };
        setSchedules([...schedules, schedule]);
        setIsAssignModalOpen(false);
        setNewAssignment({ employeeName: '', shiftId: 's1', date: new Date().toISOString().split('T')[0] });
        toast.success(`Jadwal untuk ${newAssignment.employeeName} berhasil disimpan`);
    };

    const handleUpdateSchedule = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSchedule) return;
        setSchedules(schedules.map(sc => sc.id === editingSchedule.id ? editingSchedule : sc));
        setIsEditScheduleModalOpen(false);
        setEditingSchedule(null);
        toast.success(`Jadwal untuk ${editingSchedule.employeeName} berhasil diperbarui`);
    };

    const handleDeleteSchedule = (id: string) => {
        setSchedules(schedules.filter(s => s.id !== id));
        toast.success('Jadwal berhasil dihapus');
    };

    const handleDeleteShift = (id: string) => {
        setShifts(shifts.filter(s => s.id !== id));
        setSchedules(schedules.filter(s => s.shiftId !== id)); // Cleanup schedules
        toast.success('Master shift berhasil dihapus');
    };

    const handleAddEmployee = (e: React.FormEvent) => {
        e.preventDefault();
        const employee: Employee = {
            id: `e${Date.now()}`,
            name: newEmployee.name,
            position: newEmployee.position
        };
        setEmployees([...employees, employee]);
        setIsAddEmployeeModalOpen(false);
        setNewEmployee({ name: '', position: '' });
        toast.success(`Staff ${newEmployee.name} berhasil ditambahkan`);
    };

    const handleUpdateEmployee = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEmployee) return;
        setEmployees(employees.map(emp => emp.id === editingEmployee.id ? editingEmployee : emp));
        setIsEditEmployeeModalOpen(false);
        setEditingEmployee(null);
        toast.success(`Data staff ${editingEmployee.name} berhasil diperbarui`);
    };

    const handleDeleteEmployee = (id: string) => {
        setEmployees(employees.filter(e => e.id !== id));
        toast.success('Data staff berhasil dihapus');
    };

    return (
        <div className="flex h-full bg-gray-50/50">
            {/* Sidebar Manajemen Shift */}
            <div className="w-56 bg-white border-r border-gray-200 p-6 flex flex-col gap-2">
                <h2 className="text-xl font-bold text-gray-800 mb-6 px-2">Sistem Shift</h2>

                <div className="space-y-1">
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'schedule' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Calendar className="w-5 h-5" />
                        <span>Jadwal Kerja</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('definitions')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'definitions' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Clock className="w-5 h-5" />
                        <span>Master Shift</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('staff')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'staff' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <User className="w-5 h-5" />
                        <span>Data Staff</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-800">
                                {activeTab === 'schedule' ? 'Penjadwalan Karyawan' : activeTab === 'definitions' ? 'Pengaturan Shift' : 'Manajemen Staff'}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {activeTab === 'schedule' ? 'Atur jadwal kerja harian staff Anda.' : activeTab === 'definitions' ? 'Definisikan jam operasional kerja.' : 'Daftar karyawan yang tersedia untuk shift.'}
                            </p>
                        </div>
                        <Button
                            onClick={() => {
                                if (activeTab === 'schedule') setIsAssignModalOpen(true);
                                else if (activeTab === 'definitions') setIsAddShiftModalOpen(true);
                                else setIsAddEmployeeModalOpen(true);
                            }}
                            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-100 rounded-xl"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {activeTab === 'schedule' ? 'Tambah Jadwal' : activeTab === 'definitions' ? 'Tambah Master Shift' : 'Tambah Staff'}
                        </Button>
                    </div>

                    {activeTab === 'schedule' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Karyawan</th>
                                        <th className="px-6 py-4">Tanggal</th>
                                        <th className="px-6 py-4">Shift</th>
                                        <th className="px-6 py-4">Jam Kerja</th>
                                        <th className="px-6 py-4 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {schedules.map(sc => {
                                        const shift = shifts.find(s => s.id === sc.shiftId);
                                        return (
                                            <tr key={sc.id} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-4 font-bold text-gray-800">{sc.employeeName}</td>
                                                <td className="px-6 py-4 text-gray-500">{sc.date}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${shift?.color || 'bg-gray-100 text-gray-600'}`}>
                                                        {shift?.name}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                                                    {shift?.startTime} - {shift?.endTime}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            onClick={() => { setEditingSchedule(sc); setIsEditScheduleModalOpen(true); }}
                                                            className="p-2 hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSchedule(sc.id)}
                                                            className="p-2 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : activeTab === 'definitions' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {shifts.map(shift => (
                                <div key={shift.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${shift.color.split(' ')[0]}`}>
                                            <Clock className={`w-6 h-6 ${shift.color.split(' ')[1]}`} />
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => { setEditingShift(shift); setIsEditShiftModalOpen(true); }}
                                                className="p-2 hover:bg-gray-50 rounded-lg text-gray-400"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteShift(shift.id)}
                                                className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-lg mb-1">{shift.name}</h4>
                                    <p className="text-gray-500 text-sm mb-4">Jam Kerja: <span className="font-mono font-bold text-primary">{shift.startTime} - {shift.endTime}</span></p>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg w-fit">
                                        <CheckCircle2 className="w-3 h-3" /> MASTER SHIFT
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Nama Staff</th>
                                        <th className="px-6 py-4">Posisi / Jabatan</th>
                                        <th className="px-6 py-4 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {employees.map(emp => (
                                        <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-800">{emp.name}</td>
                                            <td className="px-6 py-4 text-gray-500">{emp.position}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        onClick={() => { setEditingEmployee(emp); setIsEditEmployeeModalOpen(true); }}
                                                        className="p-2 hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteEmployee(emp.id)}
                                                        className="p-2 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {employees.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center text-gray-400 italic">Belum ada data staff.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Assign Schedule */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-xl text-gray-800">Tambah Jadwal Kerja</h3>
                            <button onClick={() => setIsAssignModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAssignShift} className="p-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Pilih Karyawan</label>
                                <select
                                    required
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
                                    value={newAssignment.employeeName}
                                    onChange={e => setNewAssignment({ ...newAssignment, employeeName: e.target.value })}
                                >
                                    <option value="">-- Pilih Staff --</option>
                                    {employees.map(e => <option key={e.id} value={e.name}>{e.name} ({e.position})</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Pilih Shift</label>
                                <select
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
                                    value={newAssignment.shiftId}
                                    onChange={e => setNewAssignment({ ...newAssignment, shiftId: e.target.value })}
                                >
                                    {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Tanggal</label>
                                <input
                                    type="date"
                                    required
                                    value={newAssignment.date}
                                    onChange={e => setNewAssignment({ ...newAssignment, date: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setIsAssignModalOpen(false)}>Batal</Button>
                                <Button type="submit" className="flex-1 h-12 bg-primary text-white">Simpan Jadwal</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal Add Master Shift */}
            {isAddShiftModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-xl text-gray-800">Tambah Master Shift</h3>
                            <button onClick={() => setIsAddShiftModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddShift} className="p-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Nama Shift</label>
                                <input
                                    type="text"
                                    required
                                    value={newShift.name}
                                    onChange={e => setNewShift({ ...newShift, name: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                    placeholder="contoh: Shift Malam"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Jam Mulai</label>
                                    <input
                                        type="time"
                                        required
                                        value={newShift.startTime}
                                        onChange={e => setNewShift({ ...newShift, startTime: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Jam Selesai</label>
                                    <input
                                        type="time"
                                        required
                                        value={newShift.endTime}
                                        onChange={e => setNewShift({ ...newShift, endTime: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setIsAddShiftModalOpen(false)}>Batal</Button>
                                <Button type="submit" className="flex-1 h-12 bg-primary text-white">Simpan Master Shift</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Edit Master Shift */}
            {isEditShiftModalOpen && editingShift && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-xl text-gray-800">Edit Master Shift</h3>
                            <button onClick={() => setIsEditShiftModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateShift} className="p-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Nama Shift</label>
                                <input
                                    type="text"
                                    required
                                    value={editingShift.name}
                                    onChange={e => setEditingShift({ ...editingShift, name: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Jam Mulai</label>
                                    <input
                                        type="time"
                                        required
                                        value={editingShift.startTime}
                                        onChange={e => setEditingShift({ ...editingShift, startTime: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Jam Selesai</label>
                                    <input
                                        type="time"
                                        required
                                        value={editingShift.endTime}
                                        onChange={e => setEditingShift({ ...editingShift, endTime: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setIsEditShiftModalOpen(false)}>Batal</Button>
                                <Button type="submit" className="flex-1 h-12 bg-primary text-white">Update Shift</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Add Staff */}
            {isAddEmployeeModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-xl text-gray-800">Tambah Staff Baru</h3>
                            <button onClick={() => setIsAddEmployeeModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddEmployee} className="p-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Nama Lengkap</label>
                                <input
                                    type="text"
                                    required
                                    value={newEmployee.name}
                                    onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                    placeholder="contoh: Andi Wijaya"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Jabatan / Posisi</label>
                                <input
                                    type="text"
                                    required
                                    value={newEmployee.position}
                                    onChange={e => setNewEmployee({ ...newEmployee, position: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                    placeholder="contoh: Barista"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setIsAddEmployeeModalOpen(false)}>Batal</Button>
                                <Button type="submit" className="flex-1 h-12 bg-primary text-white">Simpan Staff</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Edit Staff */}
            {isEditEmployeeModalOpen && editingEmployee && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-xl text-gray-800">Edit Data Staff</h3>
                            <button onClick={() => setIsEditEmployeeModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateEmployee} className="p-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Nama Lengkap</label>
                                <input
                                    type="text"
                                    required
                                    value={editingEmployee.name}
                                    onChange={e => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Jabatan / Posisi</label>
                                <input
                                    type="text"
                                    required
                                    value={editingEmployee.position}
                                    onChange={e => setEditingEmployee({ ...editingEmployee, position: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setIsEditEmployeeModalOpen(false)}>Batal</Button>
                                <Button type="submit" className="flex-1 h-12 bg-primary text-white">Update Staff</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Edit Schedule */}
            {isEditScheduleModalOpen && editingSchedule && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-xl text-gray-800">Edit Jadwal Kerja</h3>
                            <button onClick={() => setIsEditScheduleModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateSchedule} className="p-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Karyawan</label>
                                <select
                                    required
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
                                    value={editingSchedule.employeeName}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, employeeName: e.target.value })}
                                >
                                    {employees.map(e => <option key={e.id} value={e.name}>{e.name} ({e.position})</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Pilih Shift</label>
                                <select
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
                                    value={editingSchedule.shiftId}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, shiftId: e.target.value })}
                                >
                                    {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Tanggal</label>
                                <input
                                    type="date"
                                    required
                                    value={editingSchedule.date}
                                    onChange={e => setEditingSchedule({ ...editingSchedule, date: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setIsEditScheduleModalOpen(false)}>Batal</Button>
                                <Button type="submit" className="flex-1 h-12 bg-primary text-white">Update Jadwal</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
