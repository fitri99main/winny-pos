import { useState, useMemo } from 'react';
import { ShoppingCart, Plus, History, RotateCcw, Search, Calendar, FileText, CheckCircle, AlertTriangle, Trash2, Edit, ScanLine } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { PettyCashService } from '../../lib/PettyCashService';
import { DateRangePicker } from '../shared/DateRangePicker';

// --- Types ---

interface PurchaseItem {
    id: string;
    itemId: number | string;
    name: string;
    quantity: number;
    price: number; // Purchase Cost
    sellingPrice?: number; // Target Selling Price
    unit?: string;
}

interface PurchaseOrder {
    id: number;
    purchaseNo: string;
    supplierInvoiceNo?: string; // New field
    supplierName: string;
    date: string;
    items: number;
    totalAmount: number;
    status: 'Pending' | 'Completed' | 'Returned';
    payment_method: string;
    itemsList?: PurchaseItem[];
}

interface PurchaseReturn {
    id: number;
    returnNo: string;
    purchaseNo: string; // Reference to original purchase
    date: string;
    reason: string;
    status: 'Processed' | 'Pending';
}

interface PurchasesViewProps {
    purchases: any[];
    returns: any[];
    onCRUD: (table: string, action: 'create' | 'update' | 'delete', data: any) => void;
    currentBranchId?: string;
    contacts?: any[];
    products?: any[];
    ingredients?: any[];
}

export function PurchasesView({
    purchases = [],
    returns = [],
    onCRUD,
    currentBranchId,
    contacts = [],
    products = [],
    ingredients = []
}: PurchasesViewProps) {
    const [activeTab, setActiveTab] = useState<'history' | 'input' | 'returns'>('history');
    const [searchQuery, setSearchQuery] = useState('');
    const [returnSearchQuery, setReturnSearchQuery] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Form Tracking
    const [inputForm, setInputForm] = useState<Partial<PurchaseOrder>>({
        date: new Date().toISOString().split('T')[0],
        supplierName: '',
        supplierInvoiceNo: '',
        purchaseNo: '',
        payment_method: 'Tunai'
    });
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
    const [returnForm, setReturnForm] = useState<Partial<PurchaseReturn>>({ date: new Date().toISOString().split('T')[0] });
    const [isManualSupplier, setIsManualSupplier] = useState(false);
    const [manualItemForm, setManualItemForm] = useState({ name: '', price: '', sellingPrice: '', selectedItemId: '' });

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);


    // Scanner Hook
    useBarcodeScanner({
        onScan: (code) => {
            if (activeTab !== 'input') return;

            // Try to find ingredient by code first (purchases usually involve ingredients)
            const ingredient = ingredients.find(i => i.code === code);
            if (ingredient) {
                handleAddItem({
                    itemId: ingredient.id,
                    name: ingredient.name,
                    price: ingredient.costPerUnit || 0
                });
                return;
            }

            // Fallback to products
            const product = products.find(p => p.code === code);
            if (product) {
                handleAddItem({
                    itemId: product.id,
                    name: product.name,
                    price: product.cost || 0,
                    sellingPrice: product.price || 0
                });
                return;
            }

            toast.error(`Item dengan kode ${code} tidak ditemukan`);
        },
        enabled: activeTab === 'input'
    });

    // --- Handlers ---

    const handleAddItem = (item: { itemId: number | string, name: string, price: number, sellingPrice?: number, unit?: string }) => {
        setPurchaseItems(prev => {
            const existing = prev.find(i => i.itemId === item.itemId);
            if (existing) {
                return prev.map(i => i.itemId === item.itemId ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                id: `pitem-${Date.now()}`,
                itemId: item.itemId,
                name: item.name,
                quantity: 1,
                price: item.price,
                sellingPrice: item.sellingPrice || item.price * 1.2, // Default 20% margin if not set
                unit: item.unit
            }];
        });
        toast.success(`Menambahkan ${item.name}`);
    };

    const handleUpdateQty = (id: string, qty: any) => {
        setPurchaseItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
    };

    const handleUpdatePrice = (id: string, price: any) => {
        setPurchaseItems(prev => prev.map(i => i.id === id ? { ...i, price } : i));
    };

    const handleUpdateSellingPrice = (id: string, sellingPrice: any) => {
        setPurchaseItems(prev => prev.map(i => i.id === id ? { ...i, sellingPrice } : i));
    };

    // Calculate total amount directly to ensure it's always fresh
    const totalAmount = purchaseItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    const totalItemsCount = purchaseItems.reduce((sum, item) => sum + (Number(item.quantity || 0)), 0);

    const handleInputSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputForm.supplierName) {
            toast.error('Mohon pilih supplier');
            return;
        }

        if (purchaseItems.length === 0) {
            toast.error('Mohon tambahkan setidaknya satu item');
            return;
        }

        const purchaseNoFinal = inputForm.purchaseNo || `PO-2026-${String(purchases.length + 1).padStart(3, '0')}`;
        const purchaseData = {
            purchase_no: purchaseNoFinal,
            supplier_invoice_no: inputForm.supplierInvoiceNo || '', // Add to payload
            supplier_name: inputForm.supplierName,
            date: inputForm.date || new Date().toISOString().split('T')[0],
            items_count: totalItemsCount,
            total_amount: totalAmount,
            status: isEditing ? inputForm.status : 'Pending',
            payment_method: inputForm.payment_method || 'Tunai',
            branch_id: currentBranchId,
            items_list: purchaseItems
        };

        try {
            if (isEditing && editingId) {
                await onCRUD('purchases', 'update', { id: editingId, ...purchaseData });
            } else {
                const result = await onCRUD('purchases', 'create', purchaseData);
                
                // Petty Cash Integration for new 'Kas Kecil' purchases
                if (purchaseData.payment_method === 'Kas Kecil' && currentBranchId) {
                    try {
                        const session = await PettyCashService.getActiveSession(currentBranchId);
                        if (session) {
                            await PettyCashService.addTransaction({
                                session_id: session.id,
                                type: 'SPEND',
                                amount: totalAmount,
                                description: `Pembelian: ${purchaseNoFinal}`,
                                reference_type: 'purchase',
                                reference_id: purchaseNoFinal
                            });
                            toast.success('Saldo Kas Kecil terpotong');
                        } else {
                            toast.error('PO Berhasil, namun Sesi Kas Kecil belum dibuka');
                        }
                    } catch (pcErr) {
                        console.error('Petty Cash Sync Error:', pcErr);
                        toast.error('Gagal potong saldo kas kecil');
                    }
                }
            }

            // Reset only on success
            setInputForm({ 
                date: new Date().toISOString().split('T')[0], 
                supplierName: '', 
                supplierInvoiceNo: '',
                purchaseNo: '',
                payment_method: 'Tunai'
            });
            setPurchaseItems([]);
            setIsEditing(false);
            setIsManualSupplier(false);
            setEditingId(null);
            setActiveTab('history');
        } catch (err) {
            // Error already handled/toasted by handleMasterDataCRUD
            console.error('Purchase submission failed:', err);
        }
    };


    const handleReturnSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!returnForm.purchaseNo || !returnForm.reason) {
            toast.error('Mohon lengkapi data retur');
            return;
        }

        const newReturn = {
            return_no: `RET-${Date.now().toString().slice(-4)}`,
            purchase_no: returnForm.purchaseNo,
            date: returnForm.date || new Date().toISOString().split('T')[0],
            reason: returnForm.reason,
            status: 'Pending'
        };

        onCRUD('purchase_returns', 'create', newReturn);
        setReturnForm({ date: new Date().toISOString().split('T')[0], purchaseNo: '', reason: '' });
    };

    const handleMarkCompleted = (po: any) => {
        onCRUD('purchases', 'update', { id: po.id, status: 'Completed' });
        toast.success('Status PO berhasil diupdate ke Selesai');
    };

    const handleEdit = (po: any) => {
        setIsEditing(true);
        setEditingId(po.id);
        setInputForm({
            date: po.date,
            supplierName: po.supplier_name,
            purchaseNo: po.purchase_no,
            supplierInvoiceNo: po.supplier_invoice_no || '',
            status: po.status,
            payment_method: po.payment_method || 'Tunai'
        });
        setPurchaseItems(po.items_list || []);
        setActiveTab('input');
    };

    const handleDelete = (po: any) => {
        if (window.confirm(`Hapus riwayat pembelian ${po.purchase_no}?`)) {
            onCRUD('purchases', 'delete', { id: po.id });
            toast.success('Data pembelian dihapus');
        }
    };


    const filteredPurchases = purchases.filter(p => {
        const matchesBranch = !currentBranchId || String(p.branch_id) === String(currentBranchId) || !p.branch_id;
        const matchesSearch = (p.purchase_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                             (p.supplier_name || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        const pDate = p.date ? String(p.date).split('T')[0] : '';
        const matchesDate = pDate >= startDate && pDate <= endDate;

        return matchesBranch && matchesSearch && matchesDate;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const filteredReturns = returns.filter(r =>
        (!currentBranchId || String(r.branch_id) === String(currentBranchId) || !r.branch_id) &&
        ((r.return_no || '').toLowerCase().includes(returnSearchQuery.toLowerCase()) ||
            (r.purchase_no || '').toLowerCase().includes(returnSearchQuery.toLowerCase()) ||
            (r.reason || '').toLowerCase().includes(returnSearchQuery.toLowerCase()))
    );

    const flatPurchaseHistory = useMemo(() => {
        const rows: any[] = [];
        filteredPurchases.forEach(po => {
            const items = po.items_list || [];
            if (items.length === 0) {
                rows.push({
                    ...po,
                    itemName: '-',
                    itemQty: 0,
                    itemPrice: 0,
                    itemUnit: '-',
                    isFirst: true,
                    rowSpan: 1
                });
            } else {
                items.forEach((item: any, idx: number) => {
                    rows.push({
                        ...po,
                        itemName: item.name,
                        itemQty: item.quantity,
                        itemPrice: item.price,
                        itemUnit: item.unit || '-',
                        isFirst: idx === 0,
                        rowSpan: items.length
                    });
                });
            }
        });
        return rows;
    }, [filteredPurchases]);

    // --- Renderers ---

    const renderHistory = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                <div className="flex justify-between items-center">
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <div className="relative max-w-xs w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari No. PO atau Supplier..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 text-sm border rounded-xl"
                            />
                        </div>
                        <DateRangePicker 
                            startDate={startDate}
                            endDate={endDate}
                            onChange={(range) => {
                                setStartDate(range.startDate);
                                setEndDate(range.endDate);
                            }}
                        />
                    </div>
                    <Button onClick={() => setActiveTab('input')} className="gap-2">
                        <Plus className="w-4 h-4" /> Tambah Pembelian
                    </Button>
                </div>
            </div>
            <table className="w-full text-sm item-center">
                <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr>
                        <th className="px-6 py-4 text-center">No</th>
                        <th className="px-6 py-4">No. Faktur (S)</th>
                        <th className="px-6 py-4">No. PO</th>
                        <th className="px-6 py-4">Tanggal</th>
                        <th className="px-6 py-4">Supplier</th>
                        <th className="px-6 py-4">Item</th>
                        <th className="px-6 py-4 text-right">Harga</th>
                        <th className="px-6 py-4 text-center">Jumlah</th>
                        <th className="px-6 py-4 text-right">Total</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {flatPurchaseHistory.map((row, idx) => (
                        <tr key={`${row.id}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                            <td className="px-6 py-4 font-bold text-gray-800">{row.supplier_invoice_no || '-'}</td>
                            <td className="px-6 py-4 font-mono font-medium text-blue-600">{row.purchase_no}</td>
                            <td className="px-6 py-4 text-gray-500">{row.date}</td>
                            <td className="px-6 py-4 font-bold text-gray-700">{row.supplier_name}</td>
                            <td className="px-6 py-4 text-gray-700">{row.itemName}</td>
                            <td className="px-6 py-4 text-right">Rp {(row.itemPrice || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 text-center font-bold">
                                {row.itemQty} <span className="text-[10px] text-gray-400 font-normal ml-1">{row.itemUnit}</span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-blue-700">Rp {((row.itemPrice || 0) * (row.itemQty || 0)).toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                                {row.isFirst && (
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${row.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                        row.status === 'Returned' ? 'bg-red-50 text-red-700 border-red-200' :
                                            'bg-orange-50 text-orange-700 border-orange-200'
                                        }`}>
                                        {row.status}
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 flex justify-center gap-2">
                                {row.isFirst && (
                                    <>
                                        {row.status === 'Pending' && (
                                            <button onClick={() => handleMarkCompleted(row)} className="p-2 hover:bg-green-50 text-green-600 rounded-lg" title="Tandai Selesai">
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleEdit(row)}
                                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" 
                                            title="Edit"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(row)}
                                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg" 
                                            title="Hapus"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                    {flatPurchaseHistory.length === 0 && (
                        <tr>
                            <td colSpan={10} className="px-6 py-10 text-center text-gray-400">Belum ada riwayat pembelian</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    const renderInput = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                {/* Header & Item List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-base font-black text-gray-800 uppercase tracking-tight">Daftar Item</h3>
                        </div>
                        <div className="flex items-center gap-2 bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-orange-100">
                            <ScanLine className="w-3.5 h-3.5 animate-pulse" />
                            SCANNER READY
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-left sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4">Item</th>
                                    <th className="px-6 py-4 text-center">kg/satuan</th>
                                    <th className="px-6 py-4 text-center">Jumlah</th>
                                    <th className="px-6 py-4 text-right">Harga Beli</th>
                                    <th className="px-6 py-4 text-right">Harga Jual Baru</th>
                                    <th className="px-6 py-4 text-right">Total</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {purchaseItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-bold text-gray-700 text-xs">{item.name}</td>
                                        <td className="px-4 py-3 text-center text-gray-400 text-[10px]">{item.unit || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button onClick={() => handleUpdateQty(item.id, (Number(item.quantity) || 0) - 1)} className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-xs font-bold">-</button>
                                                <input
                                                    type="text"
                                                    value={item.quantity}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === '' || /^\d+$/.test(val)) {
                                                            handleUpdateQty(item.id, val === '' ? '' : parseInt(val));
                                                        }
                                                    }}
                                                    className="w-10 text-center border-none bg-transparent font-black text-xs"
                                                />
                                                <button onClick={() => handleUpdateQty(item.id, (Number(item.quantity) || 0) + 1)} className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-xs font-bold">+</button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="text"
                                                value={item.price}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                        handleUpdatePrice(item.id, val);
                                                    }
                                                }}
                                                className="w-20 text-right border-gray-100 border rounded-lg px-2 py-1 bg-gray-50 font-bold text-xs"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="text"
                                                value={item.sellingPrice}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                        handleUpdateSellingPrice(item.id, val);
                                                    }
                                                }}
                                                className="w-20 text-right border-blue-50 border rounded-lg px-2 py-1 bg-blue-50 text-blue-700 font-bold text-xs"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-xs">Rp {(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleUpdateQty(item.id, 0)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {purchaseItems.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3 text-gray-300">
                                                <ScanLine className="w-12 h-12 opacity-20" />
                                                <p className="italic">Gunakan scanner atau pilih item dari menu pencarian di samping.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Form & Totals - Premium Redesign */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 bg-gray-900 text-white flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-blue-400" />
                            <h3 className="font-black text-sm uppercase tracking-tight">Ringkasan</h3>
                        </div>
                        {isEditing && (
                            <button 
                                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-all"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditingId(null);
                                    setInputForm({ date: new Date().toISOString().split('T')[0], supplierName: '' });
                                    setPurchaseItems([]);
                                }}
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Transaction Details Group */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 px-1">Tgl PO</label>
                                    <input
                                        type="date"
                                        className="w-full p-2.5 border border-gray-100 rounded-lg bg-gray-50/50 focus:bg-white text-xs outline-none"
                                        value={inputForm.date}
                                        onChange={e => setInputForm({ ...inputForm, date: e.target.value })}
                                    />
                                </div>
                                <div className="relative">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 px-1">No. Faktur (S)</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 border border-gray-100 rounded-lg bg-gray-50/50 focus:bg-white text-xs outline-none"
                                        placeholder="..."
                                        value={inputForm.supplierInvoiceNo}
                                        onChange={e => setInputForm({ ...inputForm, supplierInvoiceNo: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="relative">
                                <div className="flex justify-between items-center mb-1 px-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Supplier</label>
                                    <button 
                                        onClick={() => {
                                            setIsManualSupplier(!isManualSupplier);
                                            setInputForm({...inputForm, supplierName: ''});
                                        }}
                                        className="text-[9px] font-black text-blue-600 uppercase"
                                    >
                                        [{isManualSupplier ? 'Daftar' : 'Manual'}]
                                    </button>
                                </div>
                                {isManualSupplier ? (
                                    <input
                                        type="text"
                                        className="w-full p-2.5 border border-gray-100 rounded-lg bg-gray-50/50 focus:bg-white text-xs outline-none"
                                        placeholder="Ketik Nama Supplier..."
                                        value={inputForm.supplierName}
                                        onChange={e => setInputForm({ ...inputForm, supplierName: e.target.value })}
                                    />
                                ) : (
                                    <select
                                        className="w-full p-2.5 border border-gray-100 rounded-lg bg-gray-50/50 focus:bg-white text-xs outline-none cursor-pointer"
                                        value={inputForm.supplierName}
                                        onChange={e => setInputForm({ ...inputForm, supplierName: e.target.value })}
                                    >
                                        <option value="">Pilih Supplier...</option>
                                        {contacts.filter(c => c.type === 'Supplier').map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="relative">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 px-1">Metode</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {['Tunai', 'Transfer', 'Kas Kecil', 'Hutang'].map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setInputForm({ ...inputForm, payment_method: m })}
                                            className={`py-1.5 px-3 rounded-lg text-[10px] font-black transition-all border ${
                                                inputForm.payment_method === m 
                                                ? 'bg-blue-600 text-white border-blue-600' 
                                                : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-300'
                                            }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-dashed border-gray-100 space-y-3">
                            <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase">Total Bayar</span>
                                <span className="text-lg font-black text-gray-800">
                                    Rp {totalAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button 
                                variant="outline"
                                onClick={() => {
                                    setInputForm({ 
                                        date: new Date().toISOString().split('T')[0], 
                                        supplierName: '', 
                                        supplierInvoiceNo: '',
                                        purchaseNo: '',
                                        payment_method: 'Tunai'
                                    });
                                    setPurchaseItems([]);
                                    setIsEditing(false);
                                    setIsManualSupplier(false);
                                    setEditingId(null);
                                    setActiveTab('history');
                                }}
                                className="flex-1 h-12 rounded-xl text-sm font-black border-gray-200 text-gray-400 hover:bg-gray-50 transition-all"
                            >
                                BATAL
                            </Button>
                            <Button 
                                onClick={handleInputSubmit} 
                                className={`flex-[2] h-12 rounded-xl text-sm font-black shadow-lg transition-all ${
                                    isEditing 
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'
                                }`} 
                                disabled={purchaseItems.length === 0}
                            >
                                {isEditing ? 'UPDATE' : 'SIMPAN PEMBELIAN'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Manual Item Input - Slim Version */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Plus className="w-3 h-3 text-blue-600" /> Item Baru
                        </h3>
                        {(manualItemForm.name || manualItemForm.price) && (
                            <button 
                                onClick={() => setManualItemForm({ name: '', price: '', sellingPrice: '', selectedItemId: '' })}
                                className="text-[9px] font-bold text-red-500 hover:text-red-700 uppercase"
                            >
                                [Hapus Draft]
                            </button>
                        )}
                    </div>
                    <div className="space-y-2">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Cari atau Ketik Nama..."
                                className="w-full p-2 text-xs border border-gray-100 rounded-lg outline-none focus:border-blue-500 pr-8"
                                value={manualItemForm.name}
                                onChange={e => {
                                    const val = e.target.value;
                                    setManualItemForm({ ...manualItemForm, name: val, selectedItemId: '', sellingPrice: '' });
                                }}
                            />
                            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />

                            {/* Autocomplete Suggestions */}
                            {manualItemForm.name.length >= 2 && !manualItemForm.selectedItemId && (
                                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-xl max-h-48 overflow-auto py-2">
                                    {ingredients.concat(products)
                                        .filter(item => item.name.toLowerCase().includes(manualItemForm.name.toLowerCase()))
                                        .slice(0, 10)
                                        .map(item => (
                                            <button
                                                key={item.id}
                                                className="w-full px-4 py-2 text-left hover:bg-blue-50 flex justify-between items-center group"
                                                onClick={() => {
                                                    setManualItemForm({
                                                        name: item.name,
                                                        price: String(item.cost || item.cost_per_unit || ''),
                                                        sellingPrice: String(item.price || ''),
                                                        selectedItemId: String(item.id)
                                                    });
                                                }}
                                            >
                                                <div>
                                                    <div className="text-sm font-bold text-gray-700">{item.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">{item.code || 'Bahan Baku'}</div>
                                                </div>
                                                <div className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold group-hover:bg-blue-100">Hubungkan Stok</div>
                                            </button>
                                        ))
                                    }
                                    {ingredients.concat(products).filter(item => item.name.toLowerCase().includes(manualItemForm.name.toLowerCase())).length === 0 && (
                                        <div className="px-4 py-2 text-xs text-gray-400 italic">Item tidak ditemukan di inventori (akan dicatat sebagai item manual murni)</div>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {manualItemForm.selectedItemId && (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-center gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-[10px] font-bold text-blue-700 uppercase">Terhubung ke Inventori (Stok akan otomatis bertambah)</span>
                                <button 
                                    onClick={() => setManualItemForm({...manualItemForm, selectedItemId: ''})}
                                    className="ml-auto text-[10px] text-red-500 font-bold hover:underline"
                                >
                                    Lepas
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                placeholder="Harga Beli"
                                className="w-full p-2 text-xs border border-gray-100 rounded-lg outline-none"
                                value={manualItemForm.price}
                                onChange={e => setManualItemForm({ ...manualItemForm, price: e.target.value })}
                            />
                            <input
                                type="number"
                                placeholder="Harga Jual"
                                className="w-full p-2 text-xs border border-gray-100 rounded-lg outline-none bg-blue-50/30"
                                value={manualItemForm.sellingPrice}
                                onChange={e => setManualItemForm({ ...manualItemForm, sellingPrice: e.target.value })}
                            />
                        </div>
                        <Button 
                            variant="outline" 
                            className="w-full h-10 text-[10px] font-black tracking-widest uppercase border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                            onClick={() => {
                                if (!manualItemForm.name || !manualItemForm.price) {
                                    toast.error('Lengkapi Nama & Harga Item');
                                    return;
                                }
                                handleAddItem({
                                    itemId: manualItemForm.selectedItemId || `manual-${Date.now()}`,
                                    name: manualItemForm.name,
                                    price: Number(manualItemForm.price),
                                    sellingPrice: Number(manualItemForm.sellingPrice) || undefined
                                });
                                setManualItemForm({ name: '', price: '', sellingPrice: '', selectedItemId: '' });
                            }}
                        >
                            TAMBAH ITEM
                        </Button>
                    </div>
                </div>

            </div>
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
                                <option key={p.id} value={p.purchase_no}>{p.purchase_no} - {p.supplier_name}</option>
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
                                <td className="px-6 py-4 font-mono text-red-600">{ret.return_no}</td>
                                <td className="px-6 py-4 font-mono text-gray-600">{ret.purchase_no}</td>
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
                    { id: 'history', label: 'Riwayat Pembelian', icon: History },
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
