import { useState } from 'react';
import { Clock, Plus, Search, Calendar, User, X, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface Shift {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    color: string;
}

interface Schedule {
    id: string;
    employee_name: string;
    shift_id: string;
    date: string;
}

interface Employee {
    id: string;
    name: string;
    position: string;
}

export function ShiftsView({
    shifts = [],
    schedules = [],
    employees = [],
    onShiftAction = async () => { },
    onScheduleAction = async () => { }
}: {
    shifts?: any[],
    schedules?: any[],
    employees?: any[],
    onShiftAction?: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>,
    onScheduleAction?: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>
}) {

    const [activeTab, setActiveTab] = useState<'schedule' | 'definitions'>('schedule');
    const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);
    const [isEditShiftModalOpen, setIsEditShiftModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isEditScheduleModalOpen, setIsEditScheduleModalOpen] = useState(false);

    // Form States
    const [newShift, setNewShift] = useState({ name: '', startTime: '', endTime: '' });
    const [editingShift, setEditingShift] = useState<any>(null); // Use any to be safe during transition or Shift
    const [editingSchedule, setEditingSchedule] = useState<any>(null);

    const [newAssignment, setNewAssignment] = useState({ employeeName: '', shiftId: '', date: new Date().toISOString().split('T')[0] });

    const handleAddShift = (e: React.FormEvent) => {
        e.preventDefault();
        onShiftAction('create', {
            name: newShift.name,
            start_time: newShift.startTime,
            end_time: newShift.endTime,
            color: 'bg-blue-100 text-blue-700' // Default color for now or let user pick
        });
        setIsAddShiftModalOpen(false);
        setNewShift({ name: '', startTime: '', endTime: '' });
    };

    const handleUpdateShift = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingShift) return;
        onShiftAction('update', {
            id: editingShift.id,
            name: editingShift.name,
            start_time: editingShift.start_time || editingShift.startTime,
            end_time: editingShift.end_time || editingShift.endTime
        });
        setIsEditShiftModalOpen(false);
        setEditingShift(null);
    };

    const handleAssignShift = (e: React.FormEvent) => {
        e.preventDefault();
        // Find employee object to get ID
        const emp = employees.find(e => e.name === newAssignment.employeeName);

        onScheduleAction('create', {
            employeeId: emp?.id,
            employeeName: newAssignment.employeeName,
            shiftId: newAssignment.shiftId,
            date: newAssignment.date
        });
        setIsAssignModalOpen(false);
        setNewAssignment({ employeeName: '', shiftId: '', date: new Date().toISOString().split('T')[0] });
    };

    const handleUpdateSchedule = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSchedule) return;

        onScheduleAction('update', {
            id: editingSchedule.id,
            employeeId: editingSchedule.employee_id, // Ensure this exists if needed, or matched lookup
            employeeName: editingSchedule.employee_name || editingSchedule.employeeName,
            shiftId: editingSchedule.shift_id || editingSchedule.shiftId,
            date: editingSchedule.date
        });
        setIsEditScheduleModalOpen(false);
        setEditingSchedule(null);
    };

    const handleDeleteSchedule = (id: string) => {
        if (confirm('Hapus jadwal ini?')) {
            onScheduleAction('delete', { id });
        }
    };

    const handleDeleteShift = (id: string) => {
        if (confirm('Hapus master shift ini? Peringatan: Jadwal terkait akan ikut terhapus.')) {
            onShiftAction('delete', { id });
        }
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
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-800">
                                {activeTab === 'schedule' ? 'Penjadwalan Karyawan' : 'Pengaturan Shift'}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {activeTab === 'schedule' ? 'Atur jadwal kerja harian staff Anda.' : 'Definisikan jam operasional kerja.'}
                            </p>
                        </div>
                        <Button
                            onClick={() => {
                                if (activeTab === 'schedule') setIsAssignModalOpen(true);
                                else if (activeTab === 'definitions') setIsAddShiftModalOpen(true);
                            }}
                            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-100 rounded-xl"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {activeTab === 'schedule' ? 'Tambah Jadwal' : 'Tambah Master Shift'}
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
                                        const shift = shifts.find(s => s.id === (sc.shift_id || sc.shiftId));
                                        return (
                                            <tr key={sc.id} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-4 font-bold text-gray-800">{sc.employee_name || sc.employeeName}</td>
                                                <td className="px-6 py-4 text-gray-500">{sc.date}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${shift?.color || 'bg-gray-100 text-gray-600'}`}>
                                                        {shift?.name || 'Shift Dihapus'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                                                    {shift?.start_time || shift?.startTime} - {shift?.end_time || shift?.endTime}
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
                                    <h4 className="font-bold text-gray-800 text-lg mb-1">{shift.name}</h4>
                                    <p className="text-gray-500 text-sm mb-4">Jam Kerja: <span className="font-mono font-bold text-primary">{shift.start_time || shift.startTime} - {shift.end_time || shift.endTime}</span></p>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg w-fit">
                                        <CheckCircle2 className="w-3 h-3" /> MASTER SHIFT
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Modal Assign Schedule */}
            {
                isAssignModalOpen && (
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
                )
            }
            {/* Modal Add Master Shift */}
            {
                isAddShiftModalOpen && (
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
                )
            }

            {/* Modal Edit Master Shift */}
            {
                isEditShiftModalOpen && editingShift && (
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
                                            value={editingShift.start_time || editingShift.startTime}
                                            onChange={e => setEditingShift({ ...editingShift, start_time: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Jam Selesai</label>
                                        <input
                                            type="time"
                                            required
                                            value={editingShift.end_time || editingShift.endTime}
                                            onChange={e => setEditingShift({ ...editingShift, end_time: e.target.value })}
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
                )
            }


            {/* Modal Edit Schedule */}
            {
                isEditScheduleModalOpen && editingSchedule && (
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
                                        value={editingSchedule.employee_name || editingSchedule.employeeName}
                                        onChange={e => setEditingSchedule({ ...editingSchedule, employee_name: e.target.value })}
                                    >
                                        {employees.map(e => <option key={e.id} value={e.name}>{e.name} ({e.position})</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Pilih Shift</label>
                                    <select
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
                                        value={editingSchedule.shift_id || editingSchedule.shiftId}
                                        onChange={e => setEditingSchedule({ ...editingSchedule, shift_id: e.target.value })}
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
                )
            }
        </div >
    );
}
