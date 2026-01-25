import { useState } from 'react';
import { ShoppingCart, Plus, History, RotateCcw, Search, Calendar, FileText, CheckCircle, AlertTriangle, Trash2, Edit } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

// --- Types ---

interface PurchaseOrder {
    id: number;
    purchaseNo: string;
    supplierName: string;
    date: string;
    items: number;
    totalAmount: number;
    status: 'Pending' | 'Completed' | 'Returned';
}

interface PurchaseReturn {
    id: number;
    returnNo: string;
    purchaseNo: string; // Reference to original purchase
    date: string;
    reason: string;
    status: 'Processed' | 'Pending';
}

// --- Initial Data ---

const INITIAL_PURCHASES: PurchaseOrder[] = [
    { id: 1, purchaseNo: 'PO-2026-001', supplierName: 'PT. Kopi Nusantara', date: '2026-01-15', items: 3, totalAmount: 4500000, status: 'Completed' },
    { id: 2, purchaseNo: 'PO-2026-002', supplierName: 'CV. Susu Murni Jaya', date: '2026-01-18', items: 5, totalAmount: 1200000, status: 'Pending' },
];

const INITIAL_RETURNS: PurchaseReturn[] = [
    { id: 1, returnNo: 'RET-2026-001', purchaseNo: 'PO-2026-001', date: '2026-01-16', reason: 'Barang rusak saat pengiriman', status: 'Processed' },
];

export function PurchasesView() {
    const [activeTab, setActiveTab] = useState<'history' | 'input' | 'returns'>('history');

    // Lists
    const [purchases, setPurchases] = useState<PurchaseOrder[]>(INITIAL_PURCHASES);
    const [returns, setReturns] = useState<PurchaseReturn[]>(INITIAL_RETURNS);
    const [searchQuery, setSearchQuery] = useState('');
    const [returnSearchQuery, setReturnSearchQuery] = useState('');

    // Forms
    const [inputForm, setInputForm] = useState<Partial<PurchaseOrder>>({ date: new Date().toISOString().split('T')[0] });
    const [returnForm, setReturnForm] = useState<Partial<PurchaseReturn>>({ date: new Date().toISOString().split('T')[0] });

    // --- Handlers ---

    const handleInputSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputForm.supplierName || !inputForm.totalAmount) {
            toast.error('Mohon lengkapi data pembelian');
            return;
        }

        const newPurchase: PurchaseOrder = {
            id: Date.now(),
            purchaseNo: `PO-2026-${String(purchases.length + 1).padStart(3, '0')}`,
            supplierName: inputForm.supplierName,
            date: inputForm.date || new Date().toISOString().split('T')[0],
            items: inputForm.items || 1,
            totalAmount: Number(inputForm.totalAmount),
            status: 'Pending'
        };

        setPurchases([newPurchase, ...purchases]);
        toast.success(`Pembelian ${newPurchase.purchaseNo} berhasil dibuat`);
        setInputForm({ date: new Date().toISOString().split('T')[0], supplierName: '', totalAmount: 0 });
        setActiveTab('history');
    };

    const handleReturnSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!returnForm.purchaseNo || !returnForm.reason) {
            toast.error('Mohon lengkapi data retur');
            return;
        }

        const newReturn: PurchaseReturn = {
            id: Date.now(),
            returnNo: `RET-2026-${String(returns.length + 1).padStart(3, '0')}`,
            purchaseNo: returnForm.purchaseNo,
            date: returnForm.date || new Date().toISOString().split('T')[0],
            reason: returnForm.reason,
            status: 'Pending'
        };

        setReturns([newReturn, ...returns]);
        toast.success(`Retur ${newReturn.returnNo} berhasil diajukan`);
        setReturnForm({ date: new Date().toISOString().split('T')[0], purchaseNo: '', reason: '' });
    };

    const handleMarkCompleted = (id: number) => {
        setPurchases(purchases.map(p => p.id === id ? { ...p, status: 'Completed' } : p));
        toast.success('Status pembelian diubah menjadi Selesai');
    };

    const filteredPurchases = purchases.filter(p =>
        p.purchaseNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredReturns = returns.filter(r =>
        r.returnNo.toLowerCase().includes(returnSearchQuery.toLowerCase()) ||
        r.purchaseNo.toLowerCase().includes(returnSearchQuery.toLowerCase()) ||
        r.reason.toLowerCase().includes(returnSearchQuery.toLowerCase())
    );

    // --- Renderers ---

    const renderHistory = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Cari No. PO atau Supplier..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm border rounded-xl"
                    />
                </div>
            </div>
            <table className="w-full text-sm item-center">
                <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr>
                        <th className="px-6 py-4">No. PO</th>
                        <th className="px-6 py-4">Supplier</th>
                        <th className="px-6 py-4">Tanggal</th>
                        <th className="px-6 py-4 text-center">Items</th>
                        <th className="px-6 py-4 text-right">Total</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredPurchases.map(po => (
                        <tr key={po.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-mono font-medium text-blue-600">{po.purchaseNo}</td>
                            <td className="px-6 py-4 font-bold text-gray-700">{po.supplierName}</td>
                            <td className="px-6 py-4 text-gray-500">{po.date}</td>
                            <td className="px-6 py-4 text-center">{po.items}</td>
                            <td className="px-6 py-4 text-right font-bold">Rp {po.totalAmount.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${po.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                    po.status === 'Returned' ? 'bg-red-50 text-red-700 border-red-200' :
                                        'bg-orange-50 text-orange-700 border-orange-200'
                                    }`}>
                                    {po.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 flex justify-center gap-2">
                                {po.status === 'Pending' && (
                                    <button onClick={() => handleMarkCompleted(po.id)} className="p-2 hover:bg-green-50 text-green-600 rounded-lg" title="Tandai Selesai">
                                        <CheckCircle className="w-4 h-4" />
                                    </button>
                                )}
                                <button className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg" title="Detail">
                                    <FileText className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderInput = () => (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-800">Buat Pesanan Pembelian Baru (PO)</h3>
                <p className="text-sm text-gray-500">Isi form di bawah untuk membuat PO ke supplier.</p>
            </div>
            <form onSubmit={handleInputSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                className="w-full pl-10 p-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20"
                                value={inputForm.date}
                                onChange={e => setInputForm({ ...inputForm, date: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                        <input
                            className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20"
                            placeholder="Cari supplier..."
                            value={inputForm.supplierName || ''}
                            onChange={e => setInputForm({ ...inputForm, supplierName: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                    <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                        <div className="text-sm text-yellow-800">
                            Mode Ringkas: Detail item barang akan diinput setelah PO dibuat atau saat penerimaan barang. Masukkan total estimasi dulu.
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah Item</label>
                        <input
                            type="number"
                            className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20"
                            placeholder="0"
                            value={inputForm.items || ''}
                            onChange={e => setInputForm({ ...inputForm, items: parseInt(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Total Estimasi (Rp)</label>
                        <input
                            type="number"
                            className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20"
                            placeholder="0"
                            value={inputForm.totalAmount || ''}
                            onChange={e => setInputForm({ ...inputForm, totalAmount: parseFloat(e.target.value) })}
                            required
                        />
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setActiveTab('history')}>Batal</Button>
                    <Button type="submit">Buat Purchase Order</Button>
                </div>
            </form>
        </div>
    );

    const renderReturns = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Return Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-red-600 hover:animate-spin-slow cursor-pointer" /> Form Retur Pembelian
                </h3>
                <form onSubmit={handleReturnSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Retur</label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded-lg"
                            value={returnForm.date}
                            onChange={e => setReturnForm({ ...returnForm, date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">No. Purchase Order (Asal)</label>
                        <select
                            className="w-full p-2 border rounded-lg"
                            value={returnForm.purchaseNo || ''}
                            onChange={e => setReturnForm({ ...returnForm, purchaseNo: e.target.value })}
                        >
                            <option value="">Pilih PO...</option>
                            {purchases.filter(p => p.status === 'Completed').map(p => (
                                <option key={p.id} value={p.purchaseNo}>{p.purchaseNo} - {p.supplierName}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Retur</label>
                        <textarea
                            className="w-full p-2 border rounded-lg resize-none"
                            rows={3}
                            placeholder="Contoh: Barang rusak, kualitas buruk..."
                            value={returnForm.reason || ''}
                            onChange={e => setReturnForm({ ...returnForm, reason: e.target.value })}
                        />
                    </div>
                    <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white">Ajukan Retur</Button>
                </form>
            </div>

            {/* Returns History */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Riwayat Retur</h3>
                    <div className="relative max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari retur..."
                            value={returnSearchQuery}
                            onChange={(e) => setReturnSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg focus:ring-1 focus:ring-primary/20"
                        />
                    </div>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-6 py-4">No. Retur</th>
                            <th className="px-6 py-4">Ref. PO</th>
                            <th className="px-6 py-4">Tanggal</th>
                            <th className="px-6 py-4">Alasan</th>
                            <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredReturns.map(ret => (
                            <tr key={ret.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-mono text-red-600">{ret.returnNo}</td>
                                <td className="px-6 py-4 font-mono text-gray-600">{ret.purchaseNo}</td>
                                <td className="px-6 py-4 text-gray-500">{ret.date}</td>
                                <td className="px-6 py-4 text-gray-700">{ret.reason}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${ret.status === 'Processed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                        }`}>
                                        {ret.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="flex h-full bg-gray-50/50 relative">
            {/* Sidebar */}
            <div className="w-56 bg-white border-r border-gray-200 p-6 flex flex-col gap-2">
                <h2 className="text-xl font-bold text-gray-800 mb-6 px-2">Modul Pembelian</h2>
                {[
                    { id: 'history', label: 'Daftar Pembelian', icon: History },
                    { id: 'input', label: 'Input Pembelian', icon: Plus },
                    { id: 'returns', label: 'Retur Pembelian', icon: RotateCcw },
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? 'bg-orange-50 text-orange-700' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-orange-600' : 'text-gray-400'}`} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 capitalize">
                            {activeTab === 'history' ? 'Riwayat Pembelian' :
                                activeTab === 'input' ? 'Buat Pembelian Baru' : 'Retur Pembelian'}
                        </h2>
                        <p className="text-gray-500 text-sm">
                            {activeTab === 'history' ? 'Pantau semua transaksi pembelian ke supplier.' :
                                activeTab === 'input' ? 'Input PO untuk stok baru.' : 'Kelola pengembalian barang rusak/salah.'}
                        </p>
                    </div>
                </div>

                {activeTab === 'history' && renderHistory()}
                {activeTab === 'input' && renderInput()}
                {activeTab === 'returns' && renderReturns()}
            </div>
        </div>
    );
}
