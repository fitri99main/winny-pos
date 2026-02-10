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
    deduction: number;
    status: 'Pending' | 'Paid';
    period: string;
    paymentDate?: string;
}

const INITIAL_PAYROLL: PayrollItem[] = [
    { id: 1, employeeName: 'Budi Santoso', position: 'Barista', basicSalary: 3500000, allowance: 500000, deduction: 0, status: 'Paid', period: 'Januari 2026', paymentDate: '2026-01-25' },
    { id: 2, employeeName: 'Siti Aminah', position: 'Cashier', basicSalary: 3200000, allowance: 400000, deduction: 100000, status: 'Pending', period: 'Januari 2026' },
];

export function PayrollView({
    payroll: payrollData,
    setPayroll: setPayrollData,
    employees = [], // Receive from Home
    onPayrollAction = async () => { },
    settings
}: {
    payroll: PayrollItem[],
    setPayroll: any,
    employees?: any[],
    onPayrollAction?: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>,
    settings?: any
}) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<PayrollItem>>({});
    const [filterPeriod, setFilterPeriod] = useState('Januari 2026');
    const [searchQuery, setSearchQuery] = useState('');
    const [previewItem, setPreviewItem] = useState<PayrollItem | null>(null);

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
        setPreviewItem(item);
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
                deduction: formData.deduction || 0
            };
            onPayrollAction('create', newItem);
        }
        setIsFormOpen(false);
        setFormData({});
    };

    const handleEmployeeSelect = (name: string) => {
        const emp = employees.find(e => e.name === name);
        if (emp) {
            setFormData({ ...formData, employeeName: emp.name, position: emp.position });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Hapus data gaji ini?')) {
            onPayrollAction('delete', { id });
        }
    };

    const filteredItems = payrollData.filter(item =>
        item.period === filterPeriod &&
        item.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const periodData = payrollData.filter(item => item.period === filterPeriod);
    const totalPayroll = periodData.reduce((acc, curr) => acc + curr.basicSalary + curr.allowance - curr.deduction, 0);

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
                                <option value="Januari 2026">Januari 2026</option>
                                <option value="Februari 2026">Februari 2026</option>
                                <option value="Maret 2026">Maret 2026</option>
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
                                        <th className="px-6 py-4 font-medium">Karyawan</th>
                                        <th className="px-6 py-4 font-medium text-right">Gaji Pokok</th>
                                        <th className="px-6 py-4 font-medium text-right">Tunjangan</th>
                                        <th className="px-6 py-4 font-medium text-right text-red-600">Potongan</th>
                                        <th className="px-6 py-4 font-medium text-right">Total Terima</th>
                                        <th className="px-6 py-4 font-medium text-center">Status</th>
                                        <th className="px-6 py-4 font-medium text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {periodData.map(item => {
                                        const total = item.basicSalary + item.allowance - item.deduction;
                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-800">{item.employeeName}</div>
                                                    <div className="text-xs text-gray-400">{item.position}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">Rp {item.basicSalary.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right text-green-600">+ Rp {item.allowance.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right text-red-600">- Rp {item.deduction.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-800">Rp {total.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${item.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                    {item.status === 'Paid' && <div className="text-[10px] text-gray-400 mt-1">{item.paymentDate}</div>}
                                                </td>
                                                <td className="px-6 py-4 flex justify-center gap-2 items-center">
                                                    {item.status === 'Pending' ? (
                                                        <>
                                                            <button onClick={() => { setFormData(item); setIsFormOpen(true); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Edit">
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <Button size="sm" onClick={() => handleProcessPayment(item.id)} className="bg-green-600 hover:bg-green-700 text-white gap-1 h-8 text-xs px-3">
                                                                <DollarSign className="w-3 h-3" /> Bayar
                                                            </Button>
                                                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" title="Hapus">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button size="sm" variant="outline" onClick={() => handlePrintSlip(item)} className="gap-2 h-8 text-xs text-gray-600 mr-2">
                                                                <Printer className="w-3 h-3" /> Slip
                                                            </Button>
                                                            {/* Allow deleting Paid items (will reverse Journal ideally, or just delete) */}
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
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-4">
                                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                                <Button type="submit">Simpan Data</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payslip Preview Modal - Only Visible when previewItem is set */}
            {previewItem && (
                <>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
                        <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95">
                            <div className="flex justify-between items-center p-4 border-b border-gray-200">
                                <h3 className="font-bold text-lg text-gray-800">Preview Slip Gaji</h3>
                                <button onClick={() => setPreviewItem(null)} className="p-2 hover:bg-gray-100 rounded-full">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 bg-gray-50" id="payslip-preview">
                                <div className="bg-white p-8 shadow-sm border border-gray-200 mx-auto max-w-xl">
                                    {/* SLIP CONTENT */}
                                    <div className="text-center mb-6">
                                        <h2 className="text-xl font-bold uppercase tracking-wider">{settings?.name || 'WINNY CAFE'}</h2>
                                        <p className="text-xs text-gray-500">{settings?.address || 'Jl. Contoh Alamat No. 123'}</p>
                                        <div className="w-full h-px bg-gray-300 my-4"></div>
                                        <h3 className="text-lg font-bold uppercase underline">SLIP GAJI KARYAWAN</h3>
                                        <p className="text-sm text-gray-600 mb-4">Periode: {previewItem.period}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                                        <div>
                                            <p className="text-gray-500">Nama Karyawan</p>
                                            <p className="font-bold">{previewItem.employeeName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-gray-500">Jabatan</p>
                                            <p className="font-bold">{previewItem.position}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Tanggal Bayar</p>
                                            <p className="font-bold">{previewItem.paymentDate || '-'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-gray-500">ID Referensi</p>
                                            <p className="font-mono text-xs">PAY-{previewItem.id}</p>
                                        </div>
                                    </div>

                                    <div className="border-t border-b border-gray-200 py-4 mb-6 space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Gaji Pokok</span>
                                            <span className="font-medium">Rp {previewItem.basicSalary.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-green-700">
                                            <span>Tunjangan & Bonus</span>
                                            <span className="font-medium">+ Rp {previewItem.allowance.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-red-600">
                                            <span>Potongan</span>
                                            <span className="font-medium">- Rp {previewItem.deduction.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center bg-gray-100 p-3 rounded-lg mb-8">
                                        <span className="font-bold text-gray-800">TOTAL DITERIMA</span>
                                        <span className="font-bold text-lg text-primary">
                                            Rp {(previewItem.basicSalary + previewItem.allowance - previewItem.deduction).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8 mt-12 text-center text-xs">
                                        <div>
                                            <p className="mb-16">Penerima,</p>
                                            <p className="font-bold underline">{previewItem.employeeName}</p>
                                        </div>
                                        <div>
                                            <p className="mb-16">Manager / HRD,</p>
                                            <p className="font-bold underline">Admin</p>
                                        </div>
                                    </div>
                                    <div className="mt-8 text-[10px] text-center text-gray-400 italic">
                                        Dicetak pada: {new Date().toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setPreviewItem(null)}>Tutup</Button>
                                <Button onClick={handlePrintBrowser} className="gap-2">
                                    <Printer className="w-4 h-4" /> Cetak Slip
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Hidden Print Area - Only visible when printing */}
                    <div className="hidden print:block fixed inset-0 bg-white z-[100] p-8">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold uppercase tracking-wider">{settings?.name || 'WINNY CAFE'}</h2>
                            <p className="text-sm text-gray-500">{settings?.address || 'Jl. Contoh Alamat No. 123'}</p>
                            <div className="w-full h-px bg-black my-4"></div>
                            <h3 className="text-xl font-bold uppercase underline mb-1">SLIP GAJI KARYAWAN</h3>
                            <p className="text-base text-gray-600 mb-6">Periode: {previewItem.period}</p>
                        </div>

                        <div className="flex justify-between text-base mb-6">
                            <div className="space-y-1">
                                <div><span className="text-gray-500 inline-block w-32">Nama</span> <span className="font-bold">: {previewItem.employeeName}</span></div>
                                <div><span className="text-gray-500 inline-block w-32">Jabatan</span> <span className="font-bold">: {previewItem.position}</span></div>
                            </div>
                            <div className="space-y-1 text-right">
                                <div><span className="text-gray-500">Tanggal Bayar :</span> <span className="font-bold">{previewItem.paymentDate || '-'}</span></div>
                                <div><span className="text-gray-500">No. Ref :</span> <span className="font-mono">PAY-{previewItem.id}</span></div>
                            </div>
                        </div>

                        <div className="border-t-2 border-b-2 border-gray-200 py-4 mb-6 space-y-3 text-base">
                            <div className="flex justify-between">
                                <span>Gaji Pokok</span>
                                <span className="font-medium">Rp {previewItem.basicSalary.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Tunjangan & Bonus</span>
                                <span className="font-medium">+ Rp {previewItem.allowance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Potongan</span>
                                <span className="font-medium">- Rp {previewItem.deduction.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center border border-gray-300 p-4 rounded mb-12">
                            <span className="font-bold text-lg">TOTAL DITERIMA</span>
                            <span className="font-bold text-2xl">
                                Rp {(previewItem.basicSalary + previewItem.allowance - previewItem.deduction).toLocaleString()}
                            </span>
                        </div>

                        <div className="flex justify-between mt-16 text-center">
                            <div className="w-40">
                                <p className="mb-20">Penerima,</p>
                                <p className="font-bold underline">{previewItem.employeeName}</p>
                            </div>
                            <div className="w-40">
                                <p className="mb-20">Disetujui Oleh,</p>
                                <p className="font-bold underline">Manager / HRD</p>
                            </div>
                        </div>

                        <div className="mt-12 text-xs text-center text-gray-400">
                            Dicetak otomatis oleh Sistem WinPOS pada {new Date().toLocaleString()}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
