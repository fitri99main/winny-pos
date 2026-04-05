import { useState } from 'react';
import { DollarSign, Download, Calendar, CheckCircle, Plus, Search, Edit, Trash2, Printer, X } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface PayrollItem {
    id: number;
    employeeName: string;
    position: string;
    basicSalary: number;
    allowance: number;
    overtime: number;
    deduction: number;
    status: 'Pending' | 'Paid';
    period: string;
    paymentDate?: string;
}

const INITIAL_PAYROLL: PayrollItem[] = [
    { id: 1, employeeName: 'Budi Santoso', position: 'Barista', basicSalary: 3500000, allowance: 500000, overtime: 0, deduction: 0, status: 'Paid', period: 'Januari 2026', paymentDate: '2026-01-25' },
    { id: 2, employeeName: 'Siti Aminah', position: 'Cashier', basicSalary: 3200000, allowance: 400000, overtime: 0, deduction: 100000, status: 'Pending', period: 'Januari 2026' },
];

export interface PayrollViewProps {
    payroll: PayrollItem[];
    setPayroll: any;
    employees?: any[];
    evaluations?: any[];
    onPayrollAction?: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>;
    settings?: any;
}

export function PayrollView({
    payroll: payrollData,
    setPayroll: setPayrollData,
    employees = [],
    evaluations = [],
    onPayrollAction = async () => { },
    settings
}: PayrollViewProps) {
    const getCurrentPeriod = () => {
        const date = new Date();
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    const getPeriodOptions = () => {
        const options = [];
        const date = new Date();
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        
        // Generate options for last 6 months and next 6 months
        for (let i = -6; i <= 6; i++) {
            const d = new Date(date.getFullYear(), date.getMonth() + i, 1);
            options.push(`${months[d.getMonth()]} ${d.getFullYear()}`);
        }
        return [...new Set(options)];
    };

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<PayrollItem>>({});
    const [filterPeriod, setFilterPeriod] = useState(getCurrentPeriod());
    const [searchQuery, setSearchQuery] = useState('');
    const [previewItem, setPreviewItem] = useState<PayrollItem | null>(null);
    const [waMessage, setWaMessage] = useState(''); // NEW: Editable WhatsApp Message

    // --- Mock Employees Removed, using props ---

    const handleProcessPayment = (id: number) => {
        if (!confirm('Konfirmasi pembayaran gaji untuk karyawan ini?')) return;
        const item = payrollData.find(p => p.id === id);
        if (item) {
            onPayrollAction('update', {
                ...item,
                status: 'Paid',
                paymentDate: new Date().toISOString().split('T')[0]
            });
        }
    };

    const handlePrintSlip = (item: PayrollItem) => {
        // [NEW] Generate Initial WA Message
        const total = item.basicSalary + item.allowance + (item.overtime || 0) - item.deduction;
        const msg = `*SLIP GAJI - WINNY COFFE PNK*\n` +
                   `---------------------------\n` +
                   `Nama: ${item.employeeName}\n` +
                   `Periode: ${item.period}\n\n` +
                   `Gaji Pokok: Rp ${item.basicSalary.toLocaleString()}\n` +
                   `Tunjangan: Rp ${item.allowance.toLocaleString()}\n` +
                   `Lembur: Rp ${(item.overtime || 0).toLocaleString()}\n` +
                   `Potongan: Rp ${item.deduction.toLocaleString()}\n` +
                   `---------------------------\n` +
                   `*TOTAL DITERIMA: Rp ${total.toLocaleString()}*\n\n` +
                   `Terima kasih atas kerja keras Anda!`;
        
        setWaMessage(msg);
        setPreviewItem(item);
    };

    const handleSendWhatsApp = () => {
        if (!previewItem) return;
        
        // [IMPROVED] Case-insensitive and trimmed matching
        const targetName = previewItem.employeeName.trim().toLowerCase();
        const emp = employees.find(e => e.name.trim().toLowerCase() === targetName);
        
        if (!emp) {
            toast.error(`Karyawan "${previewItem.employeeName}" tidak ditemukan di data Master Karyawan.`);
            return;
        }

        if (!emp.phone) {
            toast.error(`Nomor WA tidak ditemukan untuk "${emp.name}". Harap isi di menu Karyawan.`);
            return;
        }

        // Clean phone number (remove leading 0 and non-digits)
        let phone = emp.phone.replace(/\D/g, '');
        if (phone.startsWith('0')) phone = '62' + phone.substring(1);
        if (!phone.startsWith('62')) phone = '62' + phone;

        const url = `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`;
        window.open(url, '_blank');
    };

    const handlePrintBrowser = () => {
        window.print();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.employeeName || !formData.basicSalary) {
            toast.error('Nama dan Gaji Pokok wajib diisi');
            return;
        }

        if (formData.id) {
            onPayrollAction('update', formData);
        } else {
            // [NEW] Prevent Duplicate Payroll for same Period
            const existing = payrollData.find(p =>
                p.employeeName === formData.employeeName &&
                p.period === filterPeriod
            );

            if (existing) {
                if (existing.status === 'Paid') {
                    toast.error(`Gagal: Gaji ${formData.employeeName} periode ${filterPeriod} SUDAH DIBAYAR.`);
                } else {
                    toast.error(`Gagal: Data payroll ${formData.employeeName} sudah ada (Status: ${existing.status}). Silakan edit data yang ada.`);
                }
                return;
            }

            const newItem = {
                ...formData,
                status: 'Pending',
                period: filterPeriod,
                allowance: formData.allowance || 0,
                overtime: formData.overtime || 0,
                deduction: formData.deduction || 0
            };
            onPayrollAction('create', newItem);
        }
        setIsFormOpen(false);
        setFormData({});
    };

    const formatPeriod = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const months = [
                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
            ];
            return `${months[date.getMonth()]} ${date.getFullYear()}`;
        } catch (e) {
            return '';
        }
    };

    // Helper to get grade and multiplier (matched with PerformanceIndicatorMasterView)
    const getPerformanceGrade = (score: number) => {
        if (score >= 90) return { label: 'Sangat Baik', multiplier: 1.0 };
        if (score >= 80) return { label: 'Baik', multiplier: 0.8 };
        if (score >= 70) return { label: 'Cukup', multiplier: 0.6 };
        return { label: 'Kurang', multiplier: 0.4 };
    };

    const handleEmployeeSelect = (name: string) => {
        const emp = employees.find(e => e.name === name);
        if (emp) {
            let baseSalary = emp.base_salary || 0;
            let allowance = 0;

            // [NEW] Sync with Performance Evaluations
            if (evaluations && evaluations.length > 0) {
                const evalItem = evaluations.find((ev: any) => {
                    const evPeriod = formatPeriod(ev.evaluation_date);
                    // Match by employee_id or name
                    return (ev.employee_id === emp.id || ev.employee_name === emp.name) && evPeriod === filterPeriod;
                });

                if (evalItem) {
                    // Use the basis from evaluation if available, otherwise use employee master
                    const calcBasis = evalItem.base_salary || baseSalary;
                    const grade = getPerformanceGrade(evalItem.total_score);
                    allowance = Math.round(calcBasis * grade.multiplier);
                    
                    toast.success(`Sinkron: Grade ${grade.label} (${grade.multiplier * 100}%) untuk periode ${filterPeriod}`);
                }
            }

            setFormData({ 
                ...formData, 
                employeeName: emp.name, 
                position: emp.position,
                basicSalary: baseSalary,
                allowance: allowance
            });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Hapus data gaji ini?')) {
            onPayrollAction('delete', { id });
        }
    };

    const handlePreviewFromForm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.employeeName || !formData.basicSalary) {
            toast.error('Lengkapi data sebelum pratinjau');
            return;
        }
        handlePrintSlip(formData as PayrollItem);
    };

    const filteredItems = payrollData.filter(item =>
        item.period === filterPeriod &&
        item.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const periodData = payrollData.filter(item => item.period === filterPeriod);
    const totalPayroll = periodData.reduce((acc, curr) => acc + curr.basicSalary + curr.allowance + (curr.overtime || 0) - curr.deduction, 0);

    return (
        <div className="flex h-full bg-gray-50/50 relative">
            <div className="flex-1 p-8 overflow-y-auto print:hidden">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Payroll (Penggajian)</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-500 text-sm">Periode:</span>
                            <select
                                className="bg-transparent font-medium text-gray-700 border-none outline-none cursor-pointer hover:text-primary transition-colors"
                                value={filterPeriod}
                                onChange={(e) => setFilterPeriod(e.target.value)}
                            >
                                {getPeriodOptions().map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm flex flex-col items-end min-w-[150px]">
                            <span className="text-xs text-gray-500 uppercase font-bold">Total Gaji</span>
                            <span className="text-lg font-bold text-gray-800">Rp {totalPayroll.toLocaleString()}</span>
                        </div>
                        <Button onClick={() => { setFormData({ period: filterPeriod }); setIsFormOpen(true); }} className="h-auto">
                            <Plus className="w-4 h-4 mr-2" /> Buat Payroll
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari karyawan..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                    </div>

                    {filteredItems.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <p>Tidak ada data gaji yang sesuai untuk periode {filterPeriod}.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm item-center">
                                <thead className="bg-gray-50 text-gray-500 text-left">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">Karyawan</th>
                                        <th className="px-4 py-2 font-medium text-right">Gaji Pokok</th>
                                        <th className="px-4 py-2 font-medium text-right">Tunjangan</th>
                                        <th className="px-4 py-2 font-medium text-right">Lembur</th>
                                        <th className="px-4 py-2 font-medium text-right text-red-600">Potongan</th>
                                        <th className="px-4 py-2 font-medium text-right">Total Terima</th>
                                        <th className="px-4 py-2 font-medium text-center">Status</th>
                                        <th className="px-4 py-2 font-medium text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {periodData.map(item => {
                                        const total = item.basicSalary + item.allowance - item.deduction;
                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-2">
                                                    <div className="font-bold text-gray-800">{item.employeeName}</div>
                                                    <div className="text-xs text-gray-400">{item.position}</div>
                                                </td>
                                                <td className="px-4 py-2 text-right">Rp {item.basicSalary.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right text-green-600">+ Rp {item.allowance.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right text-blue-600">+ Rp {(item.overtime || 0).toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right text-red-600">- Rp {item.deduction.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right font-bold text-gray-800">Rp {(item.basicSalary + item.allowance + (item.overtime || 0) - item.deduction).toLocaleString()}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${item.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                    {item.status === 'Paid' && <div className="text-[10px] text-gray-400 mt-1">{item.paymentDate}</div>}
                                                </td>
                                                <td className="px-4 py-2 flex justify-center gap-1 items-center">
                                                    <Button size="sm" variant="outline" onClick={() => handlePrintSlip(item)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg border-none" title="Pratinjau Slip">
                                                        <Printer className="w-4 h-4" />
                                                    </Button>
                                                    {item.status === 'Pending' ? (
                                                        <>
                                                            <button onClick={() => { setFormData(item); setIsFormOpen(true); }} className="p-2 hover:bg-gray-50 text-gray-400 rounded-lg" title="Edit">
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <Button size="sm" onClick={() => handleProcessPayment(item.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-8 text-[10px] px-3 font-bold uppercase tracking-wider">
                                                                <DollarSign className="w-3 h-3" /> Bayar
                                                            </Button>
                                                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" title="Hapus">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" title="Hapus (Batalkan)">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Form Modal */}
            {isFormOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 print:hidden">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-lg text-gray-800">{formData.id ? 'Edit Data Gaji' : 'Input Gaji Baru'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {!formData.id && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Karyawan</label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        onChange={(e) => handleEmployeeSelect(e.target.value)}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>-- Pilih Karyawan --</option>
                                        {employees.map((emp, idx) => (
                                            <option key={idx} value={emp.name}>{emp.name} - {emp.position}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Karyawan</label>
                                    <input className="w-full p-2 border rounded-lg bg-gray-50" value={formData.employeeName || ''} readOnly placeholder="Otomatis" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Jabatan</label>
                                    <input className="w-full p-2 border rounded-lg bg-gray-50" value={formData.position || ''} readOnly placeholder="Otomatis" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gaji Pokok</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                                    <input
                                        type="number"
                                        className="w-full pl-10 p-2 border rounded-lg"
                                        value={formData.basicSalary || ''}
                                        onChange={e => setFormData({ ...formData, basicSalary: parseInt(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-green-700 mb-1">Tunjangan (+)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                                        <input type="number" className="w-full pl-10 p-2 border rounded-lg" value={formData.allowance || ''} onChange={e => setFormData({ ...formData, allowance: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-red-700 mb-1">Potongan (-)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                                        <input type="number" className="w-full pl-10 p-2 border rounded-lg" value={formData.deduction || ''} onChange={e => setFormData({ ...formData, deduction: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-blue-700 mb-1">Lembur (+)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                                        <input type="number" className="w-full pl-10 p-2 border rounded-lg" value={formData.overtime || ''} onChange={e => setFormData({ ...formData, overtime: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                            </div>

                             <div className="pt-4 flex justify-between gap-3 border-t border-gray-100 mt-4">
                                <Button type="button" variant="outline" onClick={handlePreviewFromForm} className="gap-2 text-primary border-primary/20 hover:bg-primary/5">
                                    <Printer className="w-4 h-4" /> Pratinjau Slip
                                </Button>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="border-none">Batal</Button>
                                    <Button type="submit" className="px-8 font-bold uppercase tracking-wider h-11">Simpan Data</Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payslip Preview Modal - Only Visible when previewItem is set */}
            {previewItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in zoom-in-95 overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white sticky top-0 z-10 font-bold uppercase tracking-widest text-xs text-gray-500">
                            <h3 className="flex items-center gap-2">
                                <Printer className="w-4 h-4" /> Pratinjau Slip Gaji
                            </h3>
                            <button onClick={() => setPreviewItem(null)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50 flex flex-col md:flex-row gap-8" id="payslip-preview">
                            <div className="flex-1">
                                <div className="bg-white p-6 sm:p-10 shadow-xl border border-gray-100 mx-auto max-w-xl rounded-sm print:shadow-none print:border-none print:p-0">
                                    {/* SLIP CONTENT */}
                                    <div className="text-center mb-8">
                                        <h2 className="text-2xl font-black uppercase tracking-widest text-gray-900">{settings?.name || 'WINNY COFFE PNK'}</h2>
                                        <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">{settings?.address || 'Pontiak, Indonesia'}</p>
                                        <div className="w-full h-1 bg-gray-900 my-6"></div>
                                        <h3 className="text-lg font-black uppercase tracking-[0.2em] underline underline-offset-8 mb-4">SLIP GAJI KARYAWAN</h3>
                                        <p className="text-xs font-bold text-gray-400">Periode: {previewItem.period}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 text-[10px] sm:text-xs mb-8 border-b border-gray-100 pb-8 uppercase font-bold tracking-wider">
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-gray-400 mb-1">Nama Karyawan</p>
                                                <p className="text-gray-900 border-l-4 border-primary pl-3">{previewItem.employeeName}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400 mb-1">Tanggal Bayar</p>
                                                <p className="text-gray-900 border-l-4 border-primary pl-3">{previewItem.paymentDate || '-'}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4 text-right">
                                            <div>
                                                <p className="text-gray-400 mb-1">Jabatan</p>
                                                <p className="text-gray-900 border-r-4 border-primary pr-3">{previewItem.position}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400 mb-1">ID Referensi</p>
                                                <p className="text-gray-900 border-r-4 border-primary pr-3 font-mono">PAY-{previewItem.id || 'TEMP'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-10 text-[11px] sm:text-sm">
                                        <div className="flex justify-between items-center text-gray-600 group">
                                            <span className="font-bold border-b border-transparent group-hover:border-gray-200 transition-all">GAJI POKOK</span>
                                            <span className="font-mono">Rp {previewItem.basicSalary.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-emerald-600 font-bold">
                                            <span className="bg-emerald-50 px-2 py-0.5 rounded">TUNJANGAN & BONUS</span>
                                            <span className="font-mono">+ Rp {previewItem.allowance.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-blue-600 font-bold">
                                            <span className="bg-blue-50 px-2 py-0.5 rounded">LEMBUR</span>
                                            <span className="font-mono">+ Rp {(previewItem.overtime || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-rose-600 font-bold">
                                            <span className="bg-rose-50 px-2 py-0.5 rounded">POTONGAN</span>
                                            <span className="font-mono">- Rp {previewItem.deduction.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center bg-gray-900 p-5 rounded-sm mb-10 text-white shadow-lg shadow-gray-200">
                                        <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest">TOTAL DITERIMA</span>
                                        <span className="font-black text-lg sm:text-2xl font-mono">
                                            Rp {(previewItem.basicSalary + previewItem.allowance + (previewItem.overtime || 0) - previewItem.deduction).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-12 mt-16 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        <div className="space-y-16">
                                            <p>Penerima,</p>
                                            <p className="text-gray-900 border-t-2 border-gray-900 pt-3">{previewItem.employeeName}</p>
                                        </div>
                                        <div className="space-y-16">
                                            <p>Manager / HRD,</p>
                                            <p className="text-gray-900 border-t-2 border-gray-900 pt-3">Admin</p>
                                        </div>
                                    </div>
                                    <div className="mt-12 text-[8px] sm:text-[9px] text-center text-gray-300 italic font-medium uppercase tracking-tighter">
                                        Dicetak via WINPOS pada: {new Date().toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div className="w-full md:w-80 space-y-6 print:hidden">
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-2.277 0-4.148 1.871-4.148 4.148s1.871 4.148 4.148 4.148c2.277 0 4.148-1.871 4.148-4.148s-1.871-4.148-4.148-4.148zm0-1c2.833 0 5.148 2.315 5.148 5.148s-2.315 5.148-5.148 5.148-5.148-2.315-5.148-5.148 2.315-5.148 5.148-5.148zm0-1c3.39 0 6.148 2.758 6.148 6.148s-2.758 6.148-6.148 6.148-6.148-2.758-6.148-6.148 2.758-6.148 6.148-6.148z"/></svg> 
                                        </div>
                                        <p className="font-black text-xs uppercase tracking-widest text-emerald-600">WhatsApp Message</p>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mb-3 font-bold uppercase tracking-widest">Pesan Slip Gaji (Edit Manual):</p>
                                    <textarea 
                                        value={waMessage}
                                        onChange={(e) => setWaMessage(e.target.value)}
                                        className="w-full h-64 p-4 bg-gray-50 border border-gray-100 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
                                        placeholder="Tulis pesan tambahan..."
                                    />
                                    <Button 
                                        onClick={handleSendWhatsApp}
                                        className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 h-14 rounded-xl flex items-center justify-center gap-3 font-black uppercase tracking-widest"
                                    >
                                        <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-2.277 0-4.148 1.871-4.148 4.148 0 2.277 1.871 4.148 4.148 4.148 2.277 0 4.148-1.871 4.148-4.148s-1.871-4.148-4.148-4.148zm0-1c2.833 0 5.148 2.315 5.148 5.148s-2.315 5.148-5.148 5.148-5.148-2.315-5.148-5.148 2.315-5.148 5.148-5.148zm0-1c3.39 0 6.148 2.758 6.148 6.148s-2.758 6.148-6.148 6.148-6.148-2.758-6.148-6.148 2.758-6.148 6.148-6.148zm.032 18.006l-.033.494v-.494zm0 .494c-5.514 0-10-4.486-10-10s4.486-10 10-10 10 4.486 10 10-4.486 10-10 10zm-9-10c0 4.962 4.037 9 9 9s9-4.038 9-9-4.037-9-9-9-9 4.038-9 9z"/></svg> 
                                        Kirim Ke WA
                                    </Button>
                                </div>

                                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                    <div className="flex items-start gap-3">
                                        <Printer className="w-5 h-5 text-blue-600 mt-1" />
                                        <div>
                                            <p className="font-bold text-blue-800 text-sm mb-1">Cetak Fisik</p>
                                            <p className="text-[10px] text-blue-600 font-medium">Gunakan tombol print browser jika ingin mencetak ke kertas fisik / PDF.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-3 sticky bottom-0 z-10 print:hidden">
                            <Button variant="outline" onClick={() => setPreviewItem(null)} className="h-12 px-8 rounded-xl font-bold border-none bg-gray-50 text-gray-500 hover:text-gray-900 transition-all">Tutup</Button>
                            <Button onClick={handlePrintBrowser} className="gap-2 h-12 px-8 rounded-xl bg-gray-900 hover:bg-black font-black uppercase tracking-widest text-xs">
                                <Printer className="w-4 h-4" /> Cetak Sekarang
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
