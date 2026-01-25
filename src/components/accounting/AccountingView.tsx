import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, TrendingDown, DollarSign, Wallet, FileText, Plus, BookOpen, LayoutDashboard, Settings, Edit, Trash2, Download, CalendarCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types & Constants ---

type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';

interface Account {
    code: string;
    name: string;
    type: AccountType;
}

interface JournalEntry {
    id: number;
    date: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
}

const INITIAL_COA: Account[] = [
    // Assets
    { code: '101', name: 'Kas', type: 'Asset' },
    { code: '102', name: 'Bank', type: 'Asset' },
    { code: '103', name: 'Piutang Usaha', type: 'Asset' },
    { code: '104', name: 'Persediaan', type: 'Asset' },
    // Liabilities
    { code: '201', name: 'Hutang Usaha', type: 'Liability' },
    // Equity
    { code: '301', name: 'Modal', type: 'Equity' },
    { code: '302', name: 'Prive', type: 'Equity' },
    // Income
    { code: '401', name: 'Pendapatan Penjualan', type: 'Income' },
    { code: '402', name: 'Pendapatan Lain-lain', type: 'Income' },
    // Expenses
    { code: '501', name: 'Beban Pembelian', type: 'Expense' },
    { code: '502', name: 'Beban Gaji', type: 'Expense' },
    { code: '503', name: 'Beban Sewa', type: 'Expense' },
    { code: '504', name: 'Beban Listrik & Air', type: 'Expense' },
    { code: '505', name: 'Beban Lain-lain', type: 'Expense' },
];

const INITIAL_TRANSACTIONS: JournalEntry[] = [
    { id: 1, date: '2023-10-01', description: 'Setoran Modal Awal', debitAccount: '102', creditAccount: '301', amount: 100000000 },
    { id: 2, date: '2023-10-02', description: 'Pembelian Perlengkapan', debitAccount: '505', creditAccount: '101', amount: 500000 },
    { id: 3, date: '2023-10-03', description: 'Penjualan Tunai', debitAccount: '101', creditAccount: '401', amount: 2500000 },
    { id: 4, date: '2023-10-05', description: 'Bayar Listrik', debitAccount: '504', creditAccount: '102', amount: 1200000 },
];

// --- Sub-Components ---

function JournalTab({ transactions, accounts, onAddTransaction }: { transactions: JournalEntry[], accounts: Account[], onAddTransaction: (tx: JournalEntry) => void }) {
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], desc: '', debit: '', credit: '', amount: '' });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.debit || !formData.credit || !formData.amount) {
            toast.error('Mohon lengkapi data jurnal');
            return;
        }
        const newTx: JournalEntry = {
            id: Date.now(),
            date: formData.date,
            description: formData.desc,
            debitAccount: formData.debit,
            creditAccount: formData.credit,
            amount: parseInt(formData.amount),
        };
        onAddTransaction(newTx);
        setFormData({ ...formData, desc: '', amount: '' });
        toast.success('Jurnal berhasil disimpan');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
            {/* Input Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" /> Input Jurnal Baru
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                        <input type="date" className="w-full p-2 border rounded-lg" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                        <input type="text" className="w-full p-2 border rounded-lg" placeholder="Contoh: Bayar Listrik" value={formData.desc} onChange={e => setFormData({ ...formData, desc: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-green-700 mb-1">Akun Debit</label>
                            <select className="w-full p-2 border rounded-lg" value={formData.debit} onChange={e => setFormData({ ...formData, debit: e.target.value })}>
                                <option value="">Pilih Akun</option>
                                {accounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-red-700 mb-1">Akun Kredit</label>
                            <select className="w-full p-2 border rounded-lg" value={formData.credit} onChange={e => setFormData({ ...formData, credit: e.target.value })}>
                                <option value="">Pilih Akun</option>
                                {accounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp)</label>
                        <input type="number" className="w-full p-2 border rounded-lg" placeholder="0" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                    </div>
                    <Button type="submit" className="w-full">Simpan Transaksi</Button>
                </form>
            </div>

            {/* Journal Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">Riwayat Jurnal Umum</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                <th className="px-4 py-3 text-left">Tgl</th>
                                <th className="px-4 py-3 text-left">Keterangan</th>
                                <th className="px-4 py-3 text-left">Akun</th>
                                <th className="px-4 py-3 text-right">Debit</th>
                                <th className="px-4 py-3 text-right">Kredit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.slice().reverse().map(tx => {
                                const debitName = accounts.find(a => a.code === tx.debitAccount)?.name;
                                const creditName = accounts.find(a => a.code === tx.creditAccount)?.name;
                                return (
                                    <tr key={tx.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 align-top">{tx.date}</td>
                                        <td className="px-4 py-3 align-top font-medium">{tx.description}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-green-700">{tx.debitAccount} - {debitName}</div>
                                            <div className="text-red-700 pl-4">{tx.creditAccount} - {creditName}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right align-top">
                                            <div>Rp {tx.amount.toLocaleString()}</div>
                                            <div className="text-transparent">-</div>
                                        </td>
                                        <td className="px-4 py-3 text-right align-top">
                                            <div className="text-transparent">-</div>
                                            <div>Rp {tx.amount.toLocaleString()}</div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function AccountManagementTab({ accounts, getBalance, onAddAccount, onUpdateAccount, onDeleteAccount }: {
    accounts: Account[],
    getBalance: (code: string) => number,
    onAddAccount: (acc: Account) => void,
    onUpdateAccount: (acc: Account) => void,
    onDeleteAccount: (code: string) => void
}) {
    const [formData, setFormData] = useState<Account>({ code: '', name: '', type: 'Asset' });
    const [isEditing, setIsEditing] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name) {
            toast.error('Kode dan Nama Akun wajib diisi');
            return;
        }

        if (isEditing) {
            onUpdateAccount(formData);
            toast.success('Akun berhasil diperbarui');
            setIsEditing(false);
        } else {
            // Check formatted code uniqueness
            if (accounts.some(a => a.code === formData.code)) {
                toast.error('Kode akun sudah ada!');
                return;
            }
            onAddAccount(formData);
            toast.success('Akun baru berhasil ditambahkan');
        }
        setFormData({ code: '', name: '', type: 'Asset' });
    };

    const handleEdit = (acc: Account) => {
        setFormData(acc);
        setIsEditing(true);
    };

    const handleDelete = (code: string) => {
        if (confirm('Anda yakin ingin menghapus akun ini?')) {
            onDeleteAccount(code);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" /> {isEditing ? 'Edit Akun' : 'Tambah Akun Baru'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kode Akun</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded-lg disabled:bg-gray-100"
                            placeholder="Contoh: 101"
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            disabled={isEditing}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Akun</label>
                        <input type="text" className="w-full p-2 border rounded-lg" placeholder="Contoh: Kas Kecil" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Akun</label>
                        <select className="w-full p-2 border rounded-lg" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as AccountType })}>
                            <option value="Asset">Asset (Harta)</option>
                            <option value="Liability">Liability (Kewajiban)</option>
                            <option value="Equity">Equity (Modal)</option>
                            <option value="Income">Income (Pendapatan)</option>
                            <option value="Expense">Expense (Beban)</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" className="w-full">{isEditing ? 'Simpan Perubahan' : 'Tambah Akun'}</Button>
                        {isEditing && (
                            <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setFormData({ code: '', name: '', type: 'Asset' }); }}>Batal</Button>
                        )}
                    </div>
                </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">Daftar Akun (Chart of Accounts)</h3>
                </div>
                <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left">Kode</th>
                                <th className="px-4 py-3 text-left">Nama Akun</th>
                                <th className="px-4 py-3 text-left">Tipe</th>
                                <th className="px-4 py-3 text-right">Saldo</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accounts.sort((a, b) => a.code.localeCompare(b.code)).map(acc => (
                                <tr key={acc.code} className="border-b hover:bg-gray-50 font-medium">
                                    <td className="px-4 py-3 text-blue-600">{acc.code}</td>
                                    <td className="px-4 py-3">{acc.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs border ${acc.type === 'Asset' ? 'bg-green-50 text-green-700 border-green-200' :
                                            acc.type === 'Liability' ? 'bg-red-50 text-red-700 border-red-200' :
                                                acc.type === 'Equity' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    acc.type === 'Income' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                                        'bg-orange-50 text-orange-700 border-orange-200'
                                            }`}>
                                            {acc.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        Rp {getBalance(acc.code).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 flex justify-center gap-2">
                                        <button onClick={() => handleEdit(acc)} className="p-1 hover:bg-blue-50 text-blue-600 rounded">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(acc.code)} className="p-1 hover:bg-red-50 text-red-600 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// --- Main Component ---

export function AccountingView() {
    const [activeTab, setActiveTab] = useState('overview');
    const [accounts, setAccounts] = useState<Account[]>(INITIAL_COA);
    const [transactions, setTransactions] = useState<JournalEntry[]>(INITIAL_TRANSACTIONS);

    // --- Date Filtering State ---
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // --- Filtered Transactions for Reports ---
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => tx.date >= startDate && tx.date <= endDate);
    }, [transactions, startDate, endDate]);

    // --- CRUD Actions ---
    const addAccount = (acc: Account) => setAccounts([...accounts, acc]);
    const updateAccount = (updatedAcc: Account) => setAccounts(accounts.map(a => a.code === updatedAcc.code ? updatedAcc : a));
    const deleteAccount = (code: string) => {
        // Prevent deletion if account is used in transactions
        const isUsed = transactions.some(t => t.debitAccount === code || t.creditAccount === code);
        if (isUsed) {
            toast.error('Gagal menghapus: Akun ini sudah digunakan dalam transaksi.');
            return;
        }
        setAccounts(accounts.filter(a => a.code !== code));
        toast.success('Akun berhasil dihapus');
    };

    // --- Derived State for Reports ---
    const accountBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        accounts.forEach(acc => balances[acc.code] = 0);

        filteredTransactions.forEach(tx => {
            balances[tx.debitAccount] = (balances[tx.debitAccount] || 0) + tx.amount;
            balances[tx.creditAccount] = (balances[tx.creditAccount] || 0) - tx.amount;
        });
        return balances;
    }, [filteredTransactions, accounts]);

    const getBalance = (code: string) => accountBalances[code] || 0;

    const getDisplayBalance = (code: string) => {
        const raw = getBalance(code);
        const type = accounts.find(a => a.code === code)?.type;
        if (type === 'Asset' || type === 'Expense') return raw;
        return -raw; // Flip for Credit-normal accounts
    };

    const totalRevenue = accounts.filter(a => a.type === 'Income').reduce((sum, acc) => sum + getDisplayBalance(acc.code), 0);
    const totalExpenses = accounts.filter(a => a.type === 'Expense').reduce((sum, acc) => sum + getDisplayBalance(acc.code), 0);
    const netProfit = totalRevenue - totalExpenses;

    // --- Renderers ---

    const exportIncomeStatementToExcel = () => {
        try {
            const incomeAccounts = accounts.filter(a => a.type === 'Income');
            const expenseAccounts = accounts.filter(a => a.type === 'Expense');

            const data = [
                { 'Kategori': 'PENDAPATAN', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                ...incomeAccounts.map(a => ({ 'Kategori': '', 'Kode': a.code, 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'Total Pendapatan', 'Kode': '', 'Nama': '', 'Jumlah': totalRevenue },
                { 'Kategori': '', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'BEBAN OPERASIONAL', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                ...expenseAccounts.map(a => ({ 'Kategori': '', 'Kode': a.code, 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'Total Beban', 'Kode': '', 'Nama': '', 'Jumlah': totalExpenses },
                { 'Kategori': '', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'LABA BERSIH', 'Kode': '', 'Nama': '', 'Jumlah': netProfit }
            ];

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Laba Rugi");
            XLSX.writeFile(workbook, `Laba_Rugi_${startDate}_to_${endDate}.xlsx`);
            toast.success('Laporan Laba Rugi berhasil diunduh (Excel)');
        } catch (error) {
            toast.error('Gagal mengekspor laporan');
        }
    };

    const exportIncomeStatementToPDF = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text('LAPORAN LABA RUGI', 105, 20, { align: 'center' });
            doc.setFontSize(11);
            doc.text(`Periode: ${startDate} s/d ${endDate}`, 105, 28, { align: 'center' });

            const incomeData = accounts.filter(a => a.type === 'Income').map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]);
            const expenseData = accounts.filter(a => a.type === 'Expense').map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]);

            autoTable(doc, {
                startY: 40,
                head: [['Kode', 'Akun Pendapatan', 'Jumlah']],
                body: [
                    ...incomeData,
                    [{ content: 'Total Pendapatan', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${totalRevenue.toLocaleString()}`, styles: { fontStyle: 'bold' } }]
                ],
                theme: 'striped',
                headStyles: { fillColor: [22, 163, 74] }
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Kode', 'Akun Beban', 'Jumlah']],
                body: [
                    ...expenseData,
                    [{ content: 'Total Beban', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${totalExpenses.toLocaleString()}`, styles: { fontStyle: 'bold' } }]
                ],
                theme: 'striped',
                headStyles: { fillColor: [220, 38, 38] }
            });

            const finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('LABA BERSIH:', 14, finalY);
            doc.text(`Rp ${netProfit.toLocaleString()}`, 200, finalY, { align: 'right' });

            doc.save(`Laba_Rugi_${startDate}_to_${endDate}.pdf`);
            toast.success('Laporan Laba Rugi berhasil diunduh (PDF)');
        } catch (error) {
            toast.error('Gagal mengekspor laporan');
        }
    };

    const exportBalanceSheetToExcel = () => {
        try {
            const assetAccounts = accounts.filter(a => a.type === 'Asset');
            const liabilityAccounts = accounts.filter(a => a.type === 'Liability');
            const equityAccounts = accounts.filter(a => a.type === 'Equity');

            const data = [
                { 'Kategori': 'AKTIVA (ASSETS)', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                ...assetAccounts.map(a => ({ 'Kategori': '', 'Kode': a.code, 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'Total Aktiva', 'Kode': '', 'Nama': '', 'Jumlah': assetAccounts.reduce((s, a) => s + getDisplayBalance(a.code), 0) },
                { 'Kategori': '', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'KEWAJIBAN & EKUITAS', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                ...liabilityAccounts.map(a => ({ 'Kategori': 'Kewajiban', 'Kode': a.code, 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                ...equityAccounts.map(a => ({ 'Kategori': 'Ekuitas', 'Kode': a.code, 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'Laba Tahun Berjalan', 'Kode': '', 'Nama': '', 'Jumlah': netProfit },
                { 'Kategori': 'Total Pasiva', 'Kode': '', 'Nama': '', 'Jumlah': liabilityAccounts.reduce((s, a) => s + getDisplayBalance(a.code), 0) + equityAccounts.reduce((s, a) => s + getDisplayBalance(a.code), 0) + netProfit }
            ];

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Neraca");
            XLSX.writeFile(workbook, `Neraca_${startDate}_to_${endDate}.xlsx`);
            toast.success('Laporan Neraca berhasil diunduh (Excel)');
        } catch (error) {
            toast.error('Gagal mengekspor laporan');
        }
    };

    const exportBalanceSheetToPDF = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text('LAPORAN NERACA', 105, 20, { align: 'center' });
            doc.setFontSize(11);
            doc.text(`Periode: ${startDate} s/d ${endDate}`, 105, 28, { align: 'center' });

            const assetData = accounts.filter(a => a.type === 'Asset').map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]);
            const liabilityData = accounts.filter(a => a.type === 'Liability').map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]);
            const equityData = accounts.filter(a => a.type === 'Equity').map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]);

            autoTable(doc, {
                startY: 40,
                head: [['Kode', 'Aktiva (Assets)', 'Jumlah']],
                body: [
                    ...assetData,
                    [{ content: 'Total Aktiva', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${accounts.filter(a => a.type === 'Asset').reduce((s, a) => s + getDisplayBalance(a.code), 0).toLocaleString()}`, styles: { fontStyle: 'bold' } }]
                ],
                theme: 'striped',
                headStyles: { fillColor: [37, 99, 235] }
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Kode', 'Kewajiban & Ekuitas', 'Jumlah']],
                body: [
                    ...liabilityData,
                    ...equityData,
                    ['-', 'Laba Tahun Berjalan', `Rp ${netProfit.toLocaleString()}`],
                    [{ content: 'Total Pasiva', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${(accounts.filter(a => a.type === 'Liability' || a.type === 'Equity').reduce((s, a) => s + getDisplayBalance(a.code), 0) + netProfit).toLocaleString()}`, styles: { fontStyle: 'bold' } }]
                ],
                theme: 'striped',
                headStyles: { fillColor: [75, 85, 99] }
            });

            doc.save(`Neraca_${startDate}_to_${endDate}.pdf`);
            toast.success('Laporan Neraca berhasil diunduh (PDF)');
        } catch (error) {
            toast.error('Gagal mengekspor laporan');
        }
    };

    const renderOverview = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-50 rounded-xl"><TrendingUp className="w-6 h-6 text-green-600" /></div>
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
                    </div>
                    <p className="text-gray-500 text-sm">Total Pendapatan</p>
                    <h3 className="text-2xl font-bold text-gray-800">Rp {totalRevenue.toLocaleString()}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-50 rounded-xl"><TrendingDown className="w-6 h-6 text-red-600" /></div>
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">+5%</span>
                    </div>
                    <p className="text-gray-500 text-sm">Total Beban</p>
                    <h3 className="text-2xl font-bold text-gray-800">Rp {totalExpenses.toLocaleString()}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 rounded-xl"><Wallet className="w-6 h-6 text-blue-600" /></div>
                    </div>
                    <p className="text-gray-500 text-sm">Laba Bersih</p>
                    <h3 className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        Rp {netProfit.toLocaleString()}
                    </h3>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-6">
                <h3 className="font-bold text-gray-800 mb-4">Transaksi Terakhir</h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            <th className="pb-3">Tanggal</th>
                            <th className="pb-3">Keterangan</th>
                            <th className="pb-3 text-right">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTransactions.slice().reverse().slice(0, 5).map(tx => (
                            <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-3 text-gray-600">{tx.date}</td>
                                <td className="py-3 font-medium text-gray-800">{tx.description}</td>
                                <td className="py-3 text-right font-bold">Rp {tx.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderReports = (type: 'income' | 'balance') => {
        return (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">
                            {type === 'income' ? 'Laporan Laba Rugi' : 'Laporan Neraca'}
                        </h2>
                        <p className="text-gray-500">WinPOS Enterprise • {startDate} s/d {endDate}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
                            onClick={type === 'income' ? exportIncomeStatementToExcel : exportBalanceSheetToExcel}
                        >
                            <Download className="w-4 h-4" /> Excel
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
                            onClick={type === 'income' ? exportIncomeStatementToPDF : exportBalanceSheetToPDF}
                        >
                            <FileText className="w-4 h-4" /> PDF
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    {type === 'income' ? (
                        <>
                            <div>
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">Pendapatan</h3>
                                {accounts.filter(a => a.type === 'Income').map(acc => (
                                    <div key={acc.code} className="flex justify-between py-1 px-4 hover:bg-gray-50">
                                        <span>{acc.code} - {acc.name}</span>
                                        <span>Rp {getDisplayBalance(acc.code).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold text-green-700 mt-2 bg-green-50 p-2 rounded">
                                    <span>Total Pendapatan</span>
                                    <span>Rp {totalRevenue.toLocaleString()}</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">Beban Operasional</h3>
                                {accounts.filter(a => a.type === 'Expense').map(acc => (
                                    <div key={acc.code} className="flex justify-between py-1 px-4 hover:bg-gray-50">
                                        <span>{acc.code} - {acc.name}</span>
                                        <span>Rp {getDisplayBalance(acc.code).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold text-red-700 mt-2 bg-red-50 p-2 rounded">
                                    <span>Total Beban</span>
                                    <span>(Rp {totalExpenses.toLocaleString()})</span>
                                </div>
                            </div>
                            <div className="flex justify-between text-xl font-bold border-t-2 border-gray-800 pt-4 mt-8">
                                <span>Laba Bersih</span>
                                <span className={netProfit >= 0 ? 'text-blue-700' : 'text-red-700'}>Rp {netProfit.toLocaleString()}</span>
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 uppercase text-sm">Aktiva (Assets)</h3>
                                {accounts.filter(a => a.type === 'Asset').map(acc => (
                                    <div key={acc.code} className="flex justify-between py-1 text-sm">
                                        <span>{acc.name}</span>
                                        <span>Rp {getDisplayBalance(acc.code).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold mt-4 pt-2 border-t">
                                    <span>Total Aktiva</span>
                                    <span>Rp {accounts.filter(a => a.type === 'Asset').reduce((s, a) => s + getDisplayBalance(a.code), 0).toLocaleString()}</span>
                                </div>
                            </div>
                            <div>
                                <div className="mb-6">
                                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 uppercase text-sm">Kewajiban (Liabilities)</h3>
                                    {accounts.filter(a => a.type === 'Liability').map(acc => (
                                        <div key={acc.code} className="flex justify-between py-1 text-sm">
                                            <span>{acc.name}</span>
                                            <span>Rp {getDisplayBalance(acc.code).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 uppercase text-sm">Ekuitas & Modal</h3>
                                    {accounts.filter(a => a.type === 'Equity').map(acc => (
                                        <div key={acc.code} className="flex justify-between py-1 text-sm">
                                            <span>{acc.name}</span>
                                            <span>Rp {getDisplayBalance(acc.code).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between py-1 text-sm font-medium text-blue-600">
                                        <span>Laba Tahun Berjalan</span>
                                        <span>Rp {netProfit.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between font-bold mt-4 pt-2 border-t">
                                    <span>Total Pasiva</span>
                                    <span>Rp {(
                                        accounts.filter(a => a.type === 'Liability' || a.type === 'Equity').reduce((s, a) => s + getDisplayBalance(a.code), 0) + netProfit
                                    ).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
        { id: 'journal', label: 'Jurnal Umum', icon: Plus },
        { id: 'ledger', label: 'Buku Besar', icon: BookOpen },
        { id: 'income', label: 'Laba Rugi', icon: TrendingUp },
        { id: 'balance', label: 'Neraca', icon: FileText },
        { id: 'accounts', label: 'Daftar Akun', icon: Settings },
    ];

    return (
        <div className="p-8 space-y-8 min-h-full bg-gray-50/50">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Modul Akuntansi</h2>
                <p className="text-sm text-gray-500">Pencatatan keuangan standar akuntansi Indonesia.</p>
            </div>

            {/* Navigation Tabs & Date Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex space-x-1 bg-gray-200/50 p-1 rounded-xl w-fit">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-white text-primary shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                    <CalendarCheck className="w-4 h-4 text-gray-400 ml-2" />
                    <div className="flex items-center gap-1">
                        <input
                            type="date"
                            className="text-xs p-1 border-none focus:ring-0 cursor-pointer"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-gray-400 text-xs">-</span>
                        <input
                            type="date"
                            className="text-xs p-1 border-none focus:ring-0 cursor-pointer"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'journal' && <JournalTab transactions={filteredTransactions} accounts={accounts} onAddTransaction={(tx) => setTransactions([...transactions, tx])} />}
                {activeTab === 'ledger' && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border text-center">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-800">Buku Besar</h3>
                        <p className="text-gray-500">Pilih akun untuk melihat detail pergerakan saldo periode {startDate} s/d {endDate}.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 text-left">
                            {accounts.map(acc => (
                                <div key={acc.code} className="p-4 border rounded-xl hover:bg-gray-50 cursor-pointer group">
                                    <div className="font-bold text-gray-700 group-hover:text-primary">{acc.code} - {acc.name}</div>
                                    <div className="text-xs text-gray-400 uppercase mt-1">{acc.type}</div>
                                    <div className="text-right font-mono font-bold mt-2">Rp {getDisplayBalance(acc.code).toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTab === 'income' && renderReports('income')}
                {activeTab === 'balance' && renderReports('balance')}
                {activeTab === 'accounts' && (
                    <AccountManagementTab
                        accounts={accounts}
                        getBalance={getDisplayBalance}
                        onAddAccount={addAccount}
                        onUpdateAccount={updateAccount}
                        onDeleteAccount={deleteAccount}
                    />
                )}
            </div>
        </div>
    );
}
