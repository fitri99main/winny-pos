import { useState, useEffect } from 'react';
import { History, RotateCcw, Search, FileText, CheckCircle, XCircle, X, ShoppingCart } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { ContactData } from '../contacts/ContactsView';

export interface SalesOrder {
    id: number;
    orderNo: string;
    date: string;
    items: number;
    productDetails: { name: string; quantity: number; price: number; isManual?: boolean }[];
    subtotal?: number;
    discount?: number;
    totalAmount: number;
    paymentMethod: string;
    paidAmount?: number;
    change?: number;
    status: 'Completed' | 'Returned';
    tableNo?: string;
    customerName?: string;
    branchId?: string;
    waiterName?: string;
    syncStatus?: 'synced' | 'pending' | 'syncing';
}

export interface SalesReturn {
    id: number;
    returnNo: string;
    orderNo: string;
    date: string;
    reason: string;
    refundAmount: number;
    status: 'Processed' | 'Pending';
    syncStatus?: 'synced' | 'pending' | 'syncing';
}

// --- Initial Data ---

export const INITIAL_SALES: SalesOrder[] = [
    {
        id: 1,
        orderNo: 'INV-2026-0001',
        date: '2026-01-20 09:30',
        items: 2,
        productDetails: [
            { name: 'Kopi Susu Gula Aren', quantity: 1, price: 20000 },
            { name: 'Croissant Chocolate', quantity: 1, price: 25000 },
        ],
        totalAmount: 45000,
        paymentMethod: 'Cash',
        status: 'Completed',
        branchId: 'b1'
    },
    {
        id: 2,
        orderNo: 'INV-2026-0002',
        date: '2026-01-20 10:15',
        items: 1,
        productDetails: [
            { name: 'Iced Americano', quantity: 1, price: 22000 },
        ],
        totalAmount: 22000,
        paymentMethod: 'QRIS',
        status: 'Completed',
        branchId: 'b1'
    },
    {
        id: 3,
        orderNo: 'INV-2026-0003',
        date: '2026-01-20 10:45',
        items: 3,
        productDetails: [
            { name: 'Nasi Goreng Spesial', quantity: 2, price: 45000 },
            { name: 'Teh Tarik', quantity: 1, price: 15000 },
        ],
        totalAmount: 105000,
        paymentMethod: 'Debit',
        status: 'Completed',
        branchId: 'b2'
    },
    {
        id: 4,
        orderNo: 'INV-2026-0004',
        date: '2026-01-20 11:20',
        items: 2,
        productDetails: [
            { name: 'Manual: Jasa Custom Packaging', quantity: 1, price: 15000, isManual: true },
            { name: 'Manual: Ongkos Kirim', quantity: 1, price: 10000, isManual: true },
        ],
        totalAmount: 25000,
        paymentMethod: 'Cash',
        status: 'Completed',
        branchId: 'b2'
    },
];

const INITIAL_RETURNS: SalesReturn[] = [];

interface SalesViewProps {
    initialTab?: 'history' | 'returns';
    currentBranchId?: string;
    onModeChange?: (mode: 'history' | 'returns') => void;
    onExit?: () => void;
    sales: SalesOrder[];
    returns: SalesReturn[];
    onAddSale: (sale: Omit<SalesOrder, 'id' | 'orderNo' | 'date' | 'status'>) => void;
    onAddReturn: (ret: Omit<SalesReturn, 'id' | 'returnNo' | 'date' | 'status'>) => void;
    onUpdateSale?: (sale: SalesOrder) => void;
    onDeleteSale?: (saleId: number) => void;
    contacts: ContactData[];
    employees: any[];
    onOpenCashier?: () => void;
}

export function SalesView({
    initialTab = 'history',
    currentBranchId,
    onModeChange,
    onExit,
    sales,
    returns,
    onAddSale,
    onAddReturn,
    onUpdateSale,
    onDeleteSale,
    contacts,
    employees,
    onOpenCashier
}: SalesViewProps) {
    const [activeTab, setActiveTab] = useState<'history' | 'returns'>(initialTab);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const handleTabChange = (newTab: 'history' | 'returns') => {
        setActiveTab(newTab);
        if (onModeChange) onModeChange(newTab);
    };

    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    const [returnReason, setReturnReason] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<SalesOrder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedOrderToEdit, setSelectedOrderToEdit] = useState<SalesOrder | null>(null);
    const [editForm, setEditForm] = useState<Partial<SalesOrder>>({});

    const filteredSales = sales.filter(sale =>
        (sale.branchId === currentBranchId || !sale.branchId) &&
        (sale.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.productDetails.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    const filteredReturns = returns.filter(ret =>
        ret.returnNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.reason.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handlePrintReceipt = (sale: SalesOrder) => {
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1500)),
            {
                loading: `Sedang mencetak struk ${sale.orderNo}...`,
                success: `Struk ${sale.orderNo} berhasil dicetak`,
                error: 'Gagal mencetak struk',
            }
        );
    };

    const handleViewDetails = (sale: SalesOrder) => {
        setSelectedOrderDetails(sale);
        setIsDetailsModalOpen(true);
    };

    const handleOpenReturn = (order: SalesOrder) => {
        setSelectedOrder(order);
        setReturnReason('');
        setIsReturnModalOpen(true);
    };

    const handleSubmitReturn = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder || !returnReason) return;

        onAddReturn({
            orderNo: selectedOrder.orderNo,
            reason: returnReason,
            refundAmount: selectedOrder.totalAmount,
        });

        setIsReturnModalOpen(false);
        toast.success('Retur penjualan berhasil diproses');
    };

    const handleEditClick = (sale: SalesOrder) => {
        setSelectedOrderToEdit(sale);
        setEditForm({ ...sale });
        setIsEditModalOpen(true);
    };

    const handleUpdateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onUpdateSale && selectedOrderToEdit) {
            onUpdateSale(editForm as SalesOrder);
            setIsEditModalOpen(false);
        }
    };

    const handleDeleteClick = (saleId: number) => {
        if (window.confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
            if (onDeleteSale) {
                onDeleteSale(saleId);
            }
        }
    };

    // --- Renderers ---

    const renderHistory = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-[13px]">
                    <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                        <tr>
                            <th className="px-3 py-3">No. Invoice</th>
                            <th className="px-3 py-3">Meja</th>
                            <th className="px-3 py-3">Pelanggan</th>
                            <th className="px-3 py-3">Tanggal</th>
                            <th className="px-3 py-3 text-center hidden xl:table-cell">Item</th>
                            <th className="px-3 py-3 text-right">Total</th>
                            <th className="px-3 py-3">Bayar</th>
                            <th className="px-3 py-3">Pelayan</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3 text-center hidden lg:table-cell">Sinkron</th>
                            <th className="px-3 py-3 text-center whitespace-nowrap">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredSales.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <History className="w-12 h-12 text-gray-200" />
                                        <p>Tidak ada riwayat penjualan ditemukan</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredSales.map(sale => (
                                <tr key={sale.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-3">
                                        <div className="font-mono text-blue-600 font-medium mb-1 whitespace-nowrap">{sale.orderNo}</div>
                                        <div className="text-[10px] text-gray-400 space-y-0.5 max-w-[120px] truncate">
                                            {sale.productDetails.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-1 truncate">
                                                    <span>• {item.name}</span>
                                                    <span className="text-gray-300">({item.quantity}x)</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        {sale.tableNo ? (
                                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono">
                                                {sale.tableNo}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        {sale.customerName ? (
                                            <span className="text-gray-900 font-medium whitespace-nowrap">
                                                {sale.customerName}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{sale.date.split(' ')[0]}</td>
                                    <td className="px-3 py-3 text-center hidden xl:table-cell">{sale.items}</td>
                                    <td className="px-3 py-3 text-right font-bold whitespace-nowrap">Rp {sale.totalAmount.toLocaleString()}</td>
                                    <td className="px-3 py-3 text-gray-600 truncate max-w-[80px]">{sale.paymentMethod}</td>
                                    <td className="px-3 py-3">
                                        {sale.waiterName ? (
                                            <span className="text-gray-700 text-[10px] font-medium bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                {sale.waiterName}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${sale.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                            {sale.status === 'Completed' ? 'Selesai' : 'Retur'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-center hidden lg:table-cell">
                                        {sale.syncStatus === 'synced' ? (
                                            <div className="flex justify-center" title="Tersinkron dengan cloud">
                                                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <CheckCircle className="w-3 h-3 text-blue-600" />
                                                </div>
                                            </div>
                                        ) : sale.syncStatus === 'syncing' ? (
                                            <div className="flex justify-center" title="Sedang menyinkronkan...">
                                                <RotateCcw className="w-3 h-3 text-orange-500 animate-spin" />
                                            </div>
                                        ) : (
                                            <div className="flex justify-center" title="Menunggu koneksi internet">
                                                <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <XCircle className="w-3 h-3 text-gray-400" />
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 flex justify-center gap-0.5 whitespace-nowrap">
                                        <button
                                            onClick={() => handleViewDetails(sale)}
                                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg group"
                                            title="Detail"
                                        >
                                            <Search className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        </button>
                                        {sale.status === 'Completed' && (
                                            <button
                                                onClick={() => handleOpenReturn(sale)}
                                                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg group"
                                                title="Retur"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-[-45deg] transition-transform" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handlePrintReceipt(sale)}
                                            className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg group"
                                            title="Struk"
                                        >
                                            <FileText className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        </button>
                                        <button
                                            onClick={() => handleEditClick(sale)}
                                            className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg group"
                                            title="Edit"
                                        >
                                            <ShoppingCart className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(sale.id)}
                                            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg group"
                                            title="Hapus"
                                        >
                                            <XCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderReturns = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                <h3 className="font-bold text-gray-800">Riwayat Retur Penjualan</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-[13px]">
                    <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                        <tr>
                            <th className="px-3 py-3">No. Retur</th>
                            <th className="px-3 py-3">Ref. Invoice</th>
                            <th className="px-3 py-3">Tanggal</th>
                            <th className="px-3 py-3">Alasan</th>
                            <th className="px-3 py-3 text-right">Refund</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {returns.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Belum ada data retur penjualan.</td>
                            </tr>
                        ) : (
                            filteredReturns.map(ret => (
                                <tr key={ret.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-3 font-mono text-red-600 whitespace-nowrap">{ret.returnNo}</td>
                                    <td className="px-3 py-3 font-mono text-gray-600 whitespace-nowrap">{ret.orderNo}</td>
                                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{ret.date}</td>
                                    <td className="px-3 py-3 text-gray-700 truncate max-w-[150px]">{ret.reason}</td>
                                    <td className="px-3 py-3 text-right font-bold text-red-600 whitespace-nowrap">Rp {ret.refundAmount.toLocaleString()}</td>
                                    <td className="px-3 py-3 text-center">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-green-50 text-green-700 border-green-200">
                                            {ret.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <button
                                            onClick={() => {
                                                const originalOrder = sales.find(s => s.orderNo === ret.orderNo);
                                                if (originalOrder) handleViewDetails(originalOrder);
                                                else toast.error('Data transaksi asli tidak ditemukan');
                                            }}
                                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg group"
                                            title="Detail Transaksi Asli"
                                        >
                                            <Search className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50/50 relative overflow-hidden">
            {/* Header & Tabs */}
            <div className="bg-white border-b border-gray-200 px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800">Modul Penjualan</h2>
                    <div className="h-6 w-px bg-gray-200 hidden md:block" />
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {[
                            { id: 'history', label: 'Riwayat Penjualan', icon: History },
                            { id: 'returns', label: 'Retur Penjualan', icon: RotateCcw },
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleTabChange(item.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === item.id
                                    ? 'bg-white text-blue-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-blue-600' : 'text-gray-400'}`} />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'history' ? "Cari invoice..." : "Cari retur/invoice..."}
                            className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {onOpenCashier && (
                        <Button
                            onClick={onOpenCashier}
                            className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-100"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            Buka Kasir Baru
                        </Button>
                    )}

                    {onExit && (
                        <button
                            onClick={onExit}
                            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-all"
                            title="Tutup Modul"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0">
                    {activeTab === 'history' && (
                        <div className="p-8 h-full">
                            {renderHistory()}
                        </div>
                    )}
                    {activeTab === 'returns' && (
                        <div className="p-8 h-full">
                            {renderReturns()}
                        </div>
                    )}
                </div>
            </div>

            {/* Return Modal */}
            {
                isReturnModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-bold text-lg text-gray-800">Proses Retur Penjualan</h3>
                                <p className="text-xs text-gray-500">{selectedOrder?.orderNo}</p>
                            </div>
                            <form onSubmit={handleSubmitReturn} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Retur</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg resize-none"
                                        rows={3}
                                        placeholder="Contoh: Salah kirim barang, barang cacat..."
                                        value={returnReason}
                                        onChange={e => setReturnReason(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="bg-red-50 p-3 rounded-lg flex justify-between items-center">
                                    <span className="text-sm text-red-700 font-medium">Total Refund:</span>
                                    <span className="text-lg font-bold text-red-700">Rp {selectedOrder?.totalAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setIsReturnModalOpen(false)}>Batal</Button>
                                    <Button type="submit" className="bg-red-600 hover:bg-red-700">Konfirmasi Retur</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Details Modal */}
            {
                isDetailsModalOpen && selectedOrderDetails && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-in zoom-in-95 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">Detail Transaksi</h3>
                                    <p className="text-xs text-gray-500 font-mono">{selectedOrderDetails.orderNo}</p>
                                </div>
                                <button onClick={() => setIsDetailsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="flex justify-between mb-6 text-sm">
                                    <div>
                                        <p className="text-gray-400 mb-1">Tanggal</p>
                                        <p className="font-semibold text-gray-700">{selectedOrderDetails.date}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-400 mb-1">Metode Bayar</p>
                                        <p className="font-semibold text-gray-700">{selectedOrderDetails.paymentMethod}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Item Pesanan</p>
                                    <div className="space-y-2 border-y border-gray-50 py-3">
                                        {selectedOrderDetails.productDetails.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <div className="flex gap-2">
                                                    <span className="text-gray-500">{item.quantity}x</span>
                                                    <span className="font-medium text-gray-800">{item.name}</span>
                                                </div>
                                                <span className="text-gray-600">Rp {(item.price * item.quantity).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-blue-50/50 p-4 rounded-xl space-y-2">
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>Subtotal</span>
                                        <span>Rp {selectedOrderDetails.totalAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-blue-700 pt-2 border-t border-blue-100">
                                        <span>Total Akhir</span>
                                        <span>Rp {selectedOrderDetails.totalAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                                <Button variant="outline" onClick={() => handlePrintReceipt(selectedOrderDetails)}>Cetak Struk</Button>
                                <Button className="bg-gray-800" onClick={() => setIsDetailsModalOpen(false)}>Tutup</Button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Edit Modal */}
            {
                isEditModalOpen && selectedOrderToEdit && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-bold text-lg text-gray-800">Edit Transaksi</h3>
                                <p className="text-xs text-gray-500">{selectedOrderToEdit.orderNo}</p>
                            </div>
                            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Meja</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded-lg"
                                            value={editForm.tableNo || ''}
                                            onChange={e => setEditForm({ ...editForm, tableNo: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pelanggan</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded-lg"
                                            value={editForm.customerName || ''}
                                            onChange={e => setEditForm({ ...editForm, customerName: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Pelayan</label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={editForm.waiterName || ''}
                                        onChange={e => setEditForm({ ...editForm, waiterName: e.target.value })}
                                    >
                                        <option value="">- Pilih Pelayan -</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.name}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={editForm.paymentMethod || ''}
                                        onChange={e => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                                    >
                                        <option value="Cash">Tunai</option>
                                        <option value="QRIS">QRIS</option>
                                        <option value="Debit">Debit</option>
                                        <option value="Credit">Credit Card</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
                                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Simpan Perubahan</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
