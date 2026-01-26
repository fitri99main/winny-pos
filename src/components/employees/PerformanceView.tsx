import { useState } from 'react';
import { Award, TrendingUp, UserX, Plus, Search, Settings, Save, AlertCircle, CheckCircle, Calculator, UserCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface EmployeePerformance {
    id: number;
    name: string;
    position: string;
    totalSales: number;
    totalAttendance: number;
    totalLate: number;
    complaints: number;
}

export function PerformanceView({
    sales,
    attendanceLogs,
    rules,
    setRules,
    complaints,
    setComplaints,
    onSendToPayroll,
    employees = []
}: {
    sales: any[],
    attendanceLogs: any[],
    rules: any,
    setRules: any,
    complaints: Record<string, number>,
    setComplaints: any,
    onSendToPayroll: (data: any) => void,
    employees?: any[]
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEmp, setSelectedEmp] = useState<EmployeePerformance | null>(null);
    const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
    const [complaintReason, setComplaintReason] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Using real employees from props
    // We map the incoming employee data to the structure needed for calculation if necessary,
    // but the logic below simply iterates over 'employees' prop.

    const performanceData: EmployeePerformance[] = employees.map((emp, idx) => {
        const totalSales = sales
            .filter(s => s.waiterName === emp.name)
            .reduce((sum, s) => sum + s.totalAmount, 0);

        const totalAttendance = attendanceLogs
            .filter(l => l.employeeName === emp.name && (l.status === 'Present' || l.status === 'Late')).length;

        const totalLate = attendanceLogs
            .filter(l => l.employeeName === emp.name && l.status === 'Late').length;

        return {
            id: idx + 1,
            name: emp.name,
            position: emp.position,
            totalSales,
            totalAttendance,
            totalLate,
            complaints: complaints[emp.name] || 0
        };
    });

    const calculateReward = (emp: EmployeePerformance) => {
        const commission = (emp.totalSales * rules.commissionPercent) / 100;
        const attendance = emp.totalAttendance * rules.attendanceBonus;
        const latenessPenalty = emp.totalLate * (rules.latePenalty || 0);
        const penalty = emp.complaints * rules.complaintPenalty;
        return Math.max(0, commission + attendance - latenessPenalty - penalty);
    };

    const handleAddComplaint = (emp: EmployeePerformance) => {
        setSelectedEmp(emp);
        setIsComplaintModalOpen(true);
    };

    const confirmComplaint = () => {
        if (!selectedEmp) return;
        setComplaints({ ...complaints, [selectedEmp.name]: (complaints[selectedEmp.name] || 0) + 1 });
        toast.warning(`Komplain dicatat untuk ${selectedEmp.name}${complaintReason ? ': ' + complaintReason : ''}`);
        setIsComplaintModalOpen(false);
        setComplaintReason('');
        setSelectedEmp(null);
    };

    const handleSendToPayroll = (emp: EmployeePerformance) => {
        const totalReward = calculateReward(emp);
        onSendToPayroll({ ...emp, employeeName: emp.name, totalReward });
        toast.success(`Reward sebesar Rp ${totalReward.toLocaleString()} telah dikirim ke draft Payroll.`);
    };

    const filteredEmployees = performanceData.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-8 h-full bg-gray-50/50 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Performa & Reward Karyawan</h2>
                    <p className="text-gray-500">Pantau kinerja dan hitung insentif secara otomatis.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="gap-2">
                        <Settings className="w-4 h-4" /> Pengaturan Reward
                    </Button>
                </div>
            </div>

            {isSettingsOpen && (
                <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 mb-8 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-2 mb-4 text-primary">
                        <Settings className="w-5 h-5 font-bold" />
                        <h3 className="font-bold">Konfigurasi Reward & Penalty</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600">Komisi Penjualan (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full p-3 bg-white border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={rules.commissionPercent}
                                    onChange={e => setRules({ ...rules, commissionPercent: parseFloat(e.target.value) })}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600">Bonus Kehadiran / Hari</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
                                <input
                                    type="number"
                                    className="w-full pl-10 p-3 bg-white border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={rules.attendanceBonus}
                                    onChange={e => setRules({ ...rules, attendanceBonus: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600">Terlambat (Denda per Hari)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-300">Rp</span>
                                <input
                                    type="number"
                                    className="w-full pl-10 p-3 bg-white border border-red-50 rounded-2xl focus:ring-2 focus:ring-red-100 outline-none"
                                    value={rules.latePenalty}
                                    onChange={e => setRules({ ...rules, latePenalty: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-red-600">Denda per Komplain</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-300">Rp</span>
                                <input
                                    type="number"
                                    className="w-full pl-10 p-3 bg-white border border-red-100 rounded-2xl focus:ring-2 focus:ring-red-200 outline-none"
                                    value={rules.complaintPenalty}
                                    onChange={e => setRules({ ...rules, complaintPenalty: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button onClick={() => { setIsSettingsOpen(false); toast.success('Pengaturan reward disimpan'); }} className="bg-primary shadow-lg shadow-primary/20">
                            <Save className="w-4 h-4 mr-2" /> Simpan Perubahan
                        </Button>
                    </div>
                </div>
            )}

            {/* Performance List */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari karyawan..."
                            className="w-full pl-10 pr-4 py-2.5 text-sm border rounded-2xl"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-bold border border-emerald-100 flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" /> Transaksi Terintegrasi
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 bg-gray-50/50">
                                <th className="px-8 py-5 font-bold">Karyawan</th>
                                <th className="px-8 py-5 font-bold text-right">Penjualan</th>
                                <th className="px-8 py-5 font-bold text-center">Absensi</th>
                                <th className="px-8 py-5 font-bold text-center">Komplain</th>
                                <th className="px-8 py-5 font-bold text-right">Total Reward</th>
                                <th className="px-8 py-5 font-bold text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredEmployees.map(emp => {
                                const reward = calculateReward(emp);
                                return (
                                    <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{emp.name}</div>
                                                    <div className="text-xs text-gray-400">{emp.position}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="font-bold text-gray-700">Rp {emp.totalSales.toLocaleString()}</div>
                                            <div className="text-[10px] text-emerald-600 font-bold">{(emp.totalSales * rules.commissionPercent / 100).toLocaleString()} ({rules.commissionPercent}%)</div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-bold text-xs">
                                                    <UserCheck className="w-3 h-3" /> {emp.totalAttendance} Hari
                                                </div>
                                                {emp.totalLate > 0 && (
                                                    <span className="text-[10px] text-red-500 font-bold">-{emp.totalLate} Kali Terlambat</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <input
                                                    type="number"
                                                    className="w-16 p-1 text-center bg-gray-50 border border-gray-200 rounded-lg font-bold text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                                                    value={emp.complaints}
                                                    onChange={e => setComplaints({ ...complaints, [emp.name]: parseInt(e.target.value) || 0 })}
                                                />
                                                <span className="text-[10px] text-gray-400 font-medium">Klik untuk ubah</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="text-lg font-black text-primary">Rp {reward.toLocaleString()}</div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="flex justify-center gap-2">
                                                <Button
                                                    size="sm"
                                                    className="rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100 font-bold"
                                                    onClick={() => handleAddComplaint(emp)}
                                                >
                                                    <AlertCircle className="w-3 h-3 mr-1" /> Komplain
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100 font-bold"
                                                    onClick={() => handleSendToPayroll(emp)}
                                                >
                                                    <TrendingUp className="w-3 h-3 mr-1" /> Payroll
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredEmployees.length === 0 && (
                    <div className="p-20 text-center flex flex-col items-center gap-3">
                        <UserX className="w-12 h-12 text-gray-200" />
                        <p className="text-gray-400">Karyawan tidak ditemukan</p>
                    </div>
                )}
            </div>

            {/* Legend / Tips */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-3xl border border-gray-100 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                        <Award className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800">Tips Motivasi</h4>
                        <p className="text-sm text-gray-500 mt-1">Berikan reward tambahan untuk karyawan dengan 0 komplain selama satu bulan penuh untuk meningkatkan kualitas layanan.</p>
                    </div>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-gray-100 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                        <Calculator className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800">Kalkulasi Otomatis</h4>
                        <p className="text-sm text-gray-500 mt-1">Total reward dihitung dari: (Penjualan × %) + (Kehadiran × Bonus) - (Komplain × Denda).</p>
                    </div>
                </div>
            </div>

            {/* Complaint Modal */}
            {isComplaintModalOpen && selectedEmp && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-red-800">Catat Komplain</h3>
                                <p className="text-sm text-red-600 mt-1">{selectedEmp.name}</p>
                            </div>
                            <button onClick={() => setIsComplaintModalOpen(false)} className="p-2 hover:bg-red-100 rounded-xl text-red-400 hover:text-red-600 transition-colors">
                                <Plus className="w-5 h-5 rotate-45" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6 overflow-y-auto">
                            <p className="text-sm text-gray-500">Mencatat komplain akan memotong reward karyawan sebesar **Rp {rules.complaintPenalty.toLocaleString()}**.</p>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase">Alasan Komplain (Opsional)</label>
                                <textarea
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-red-100 outline-none h-24 resize-none"
                                    placeholder="Contoh: Salah pesanan, tidak ramah..."
                                    value={complaintReason}
                                    onChange={e => setComplaintReason(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsComplaintModalOpen(false)}>Batal</Button>
                                <Button className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700" onClick={confirmComplaint}>Konfirmasi</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
