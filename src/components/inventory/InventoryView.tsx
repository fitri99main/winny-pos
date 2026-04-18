import { useState } from 'react';
import {
    Package,
    Plus,
    ArrowUpCircle,
    ArrowDownCircle,
    History,
    Search,
    AlertTriangle,
    MoreVertical,
    CheckCircle2,
    Filter
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

// --- Types ---

export interface Ingredient {
    id: number;
    name: string;
    unit: string;
    category: string;
    current_stock: number;
    min_stock: number;
    last_updated: string;
    cost_per_unit: number;
    branch_id?: number | string;
}

export interface StockMovement {
    id: number;
    ingredientId: number;
    ingredientName: string;
    type: 'IN' | 'OUT';
    quantity: number;
    unit: string;
    reason: string;
    date: string;
    user: string;
}

// --- Initial Mock Data ---

const INITIAL_INGREDIENTS: Ingredient[] = [
    { id: 1, name: 'Kopi Arabika (Beans)', unit: 'kg', category: 'Coffee', current_stock: 25.5, min_stock: 5, last_updated: '2026-01-24', cost_per_unit: 120000 },
    { id: 2, name: 'Susu Fresh Milk', unit: 'Liter', category: 'Dairy', current_stock: 12, min_stock: 10, last_updated: '2026-01-25', cost_per_unit: 18000 },
    { id: 3, name: 'Gula Aren Cair', unit: 'Liter', category: 'Sweetener', current_stock: 3.5, min_stock: 5, last_updated: '2026-01-23', cost_per_unit: 25000 },
    { id: 4, name: 'Bubuk Cokelat Premium', unit: 'kg', category: 'Other', current_stock: 8, min_stock: 2, last_updated: '2026-01-20', cost_per_unit: 85000 },
];

const INITIAL_MOVEMENTS: StockMovement[] = [
    { id: 1, ingredientId: 1, ingredientName: 'Kopi Arabika (Beans)', type: 'IN', quantity: 10, unit: 'kg', reason: 'Pembelian PO-2026-001', date: '2026-01-24 10:30', user: 'Admin' },
    { id: 2, ingredientId: 2, ingredientName: 'Susu Fresh Milk', type: 'OUT', quantity: 4, unit: 'Liter', reason: 'Pemakaian Harian', date: '2026-01-25 08:15', user: 'Barista' },
];

interface InventoryViewProps {
    ingredients: Ingredient[];
    movements: StockMovement[];
    onIngredientAction: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>;
    onStockAdjustment: (adjustment: any) => Promise<void>;
    categories: any[];
    units: any[];
    currentBranchId?: string;
}

export function InventoryView({
    ingredients,
    movements,
    onIngredientAction,
    onStockAdjustment,
    categories,
    units,
    currentBranchId
}: InventoryViewProps) {
    const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // NEW
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [isStockCardOpen, setIsStockCardOpen] = useState(false);
    const [stockAction, setStockAction] = useState<'IN' | 'OUT'>('IN');
    const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

    // Form states
    const [newIngredient, setNewIngredient] = useState<Partial<Ingredient>>({
        name: '', unit: 'kg', category: 'Coffee', min_stock: 1, cost_per_unit: 0
    });
    const [editFormData, setEditFormData] = useState<Partial<Ingredient>>({}); // NEW

    const [stockForm, setStockForm] = useState({
        quantity: 0,
        reason: ''
    });

    const getUnitOptionValue = (unitOption: any) => {
        const abbreviation = String(unitOption?.abbreviation || '').trim();
        const name = String(unitOption?.name || '').trim();
        return abbreviation || name;
    };

    const getUnitOptionLabel = (unitOption: any) => {
        const abbreviation = String(unitOption?.abbreviation || '').trim();
        const name = String(unitOption?.name || '').trim();
        return abbreviation ? `${name} (${abbreviation})` : name;
    };

    const normalizeUnitValue = (value?: string) => {
        const rawValue = String(value || '').trim();
        if (!rawValue) return '';

        const matchedUnit = units.find((unitOption) => {
            const optionValue = getUnitOptionValue(unitOption).toLowerCase();
            const abbreviation = String(unitOption?.abbreviation || '').trim().toLowerCase();
            const name = String(unitOption?.name || '').trim().toLowerCase();
            const compareValue = rawValue.toLowerCase();

            return compareValue === optionValue || compareValue === abbreviation || compareValue === name;
        });

        return matchedUnit ? getUnitOptionValue(matchedUnit) : rawValue;
    };

    const openEditModal = (ingredient: Ingredient) => {
        setEditFormData({
            ...ingredient,
            unit: normalizeUnitValue(ingredient.unit)
        });
        setIsEditModalOpen(true);
    };

    const handleAddIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        await onIngredientAction('create', {
            name: newIngredient.name,
            unit: newIngredient.unit,
            category: newIngredient.category,
            min_stock: newIngredient.min_stock,
            current_stock: 0,
            cost_per_unit: newIngredient.cost_per_unit,
            branch_id: currentBranchId
        });
        setIsAddModalOpen(false);
        setNewIngredient({ name: '', unit: 'kg', category: 'Coffee', min_stock: 1, cost_per_unit: 0 });
    };

    const handleEditIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editFormData.id) return;

        await onIngredientAction('update', {
            id: editFormData.id,
            name: editFormData.name,
            unit: normalizeUnitValue(editFormData.unit),
            category: editFormData.category,
            min_stock: editFormData.min_stock,
            cost_per_unit: editFormData.cost_per_unit,
            current_stock: editFormData.current_stock
        });
        setIsEditModalOpen(false);
        setEditFormData({});
    };

    const handleUpdateStock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedIngredient) return;

        const qty = Number(stockForm.quantity);

        await onStockAdjustment({
            ingredientId: selectedIngredient.id,
            ingredientName: selectedIngredient.name,
            type: stockAction,
            quantity: qty,
            unit: selectedIngredient.unit,
            reason: stockForm.reason || (stockAction === 'IN' ? 'Penyesuaian Masuk' : 'Pemakaian/Terbuang'),
            user: 'Staff' // Ideally from prop or context
        });

        setIsStockModalOpen(false);
        setStockForm({ quantity: 0, reason: '' });
    };

    const filteredIngredients = ingredients.filter(ing =>
        (!currentBranchId || String(ing.branch_id) === String(currentBranchId) || !ing.branch_id) &&
        (ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ing.category.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="p-8 h-full bg-gray-50/50 flex flex-col space-y-8 overflow-hidden">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 tracking-tight">Manajemen Inventaris</h2>
                    <p className="text-gray-500 font-medium">Pantau ketersediaan bahan baku dan mutasi barang.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setActiveTab('stock')}
                        className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'stock' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                    >
                        Stok Bahan
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                    >
                        Riwayat Mutasi
                    </button>
                    <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 ml-4">
                        <Plus className="w-4 h-4" /> Bahan Baru
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-white rounded-[32px] shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari nama bahan atau kategori..."
                            className="w-full pl-12 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-primary/5 outline-none transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-xl border border-yellow-100/50 text-xs font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {ingredients.filter(i => i.current_stock <= i.min_stock).length} Bahan Stok Rendah
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {activeTab === 'stock' ? (
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10">
                                <tr className="text-gray-400 border-b border-gray-50">
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Nama Bahan</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Kategori</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-center">Unit</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Harga Beli (HPP)</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Min. Stok</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Stok Aktif</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-center">Status</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-center">Tindakan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredIngredients.map(ing => (
                                    <tr key={ing.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="font-bold text-gray-800">{ing.name}</div>
                                            <div className="text-[10px] text-gray-400 font-medium">Update: {ing.last_updated}</div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[11px] font-bold uppercase">{ing.category}</span>
                                        </td>
                                        <td className="px-8 py-5 text-center text-gray-500 font-medium">{ing.unit}</td>
                                        <td className="px-8 py-5 text-right font-black text-gray-600">
                                            Rp {(ing.cost_per_unit || 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">/{ing.unit}</span>
                                        </td>
                                        <td className="px-8 py-5 text-right text-gray-400 font-bold">{ing.min_stock}</td>
                                        <td className={`px-8 py-5 text-right font-black text-lg ${ing.current_stock <= ing.min_stock ? 'text-red-500' : 'text-gray-800'}`}>
                                            {ing.current_stock}
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            {ing.current_stock <= ing.min_stock ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase ring-1 ring-red-100">
                                                    <AlertTriangle className="w-3 h-3" /> Re-stock
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase ring-1 ring-emerald-100">
                                                    <CheckCircle2 className="w-3 h-3" /> Aman
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(ing)}
                                                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                                                    title="Edit Data"
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedIngredient(ing); setStockAction('IN'); setIsStockModalOpen(true); }}
                                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                                                    title="Stok Masuk"
                                                >
                                                    <ArrowUpCircle className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedIngredient(ing); setStockAction('OUT'); setIsStockModalOpen(true); }}
                                                    className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                                                    title="Stok Keluar"
                                                >
                                                    <ArrowDownCircle className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedIngredient(ing); setIsStockCardOpen(true); }}
                                                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                                                    title="Lihat Kartu Stok"
                                                >
                                                    <History className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50">
                                <tr>
                                    <th className="px-8 py-5">Waktu & Tanggal</th>
                                    <th className="px-8 py-5">Nama Bahan</th>
                                    <th className="px-8 py-5 text-center">Jenis</th>
                                    <th className="px-8 py-5 text-right">Jumlah</th>
                                    <th className="px-8 py-5">Keterangan</th>
                                    <th className="px-8 py-5 text-center">User</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {movements.map(mov => (
                                    <tr key={mov.id} className="hover:bg-gray-50/50 transition-colors text-xs">
                                        <td className="px-8 py-4 text-gray-500 font-mono">{mov.date}</td>
                                        <td className="px-8 py-4 font-bold text-gray-800">{mov.ingredientName}</td>
                                        <td className="px-8 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg font-black uppercase text-[9px] ${mov.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                {mov.type === 'IN' ? 'Barang Masuk' : 'Barang Keluar'}
                                            </span>
                                        </td>
                                        <td className={`px-8 py-4 text-right font-bold ${mov.type === 'IN' ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {mov.type === 'IN' ? '+' : '-'}{mov.quantity} {mov.unit}
                                        </td>
                                        <td className="px-8 py-4 text-gray-600 italic">"{mov.reason}"</td>
                                        <td className="px-8 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                                    {mov.user.charAt(0)}
                                                </div>
                                                <span className="font-medium text-gray-500">{mov.user}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add Ingredient Modal */}
            {isAddModalOpen && (
                <div onClick={() => setIsAddModalOpen(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-10 space-y-8">
                            <div>
                                <h3 className="text-2xl font-black text-gray-800">Tambah Bahan Baku</h3>
                                <p className="text-gray-500">Daftarkan item bahan baru ke sistem.</p>
                            </div>
                            <form onSubmit={handleAddIngredient} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Nama Bahan</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] focus:ring-4 focus:ring-primary/5 outline-none transition-all"
                                        placeholder="Contoh: Kopi Bubuk 500g"
                                        value={newIngredient.name}
                                        onChange={e => setNewIngredient({ ...newIngredient, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Kategori</label>
                                        <select
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none"
                                            value={newIngredient.category}
                                            onChange={e => setNewIngredient({ ...newIngredient, category: e.target.value })}
                                        >
                                            <option value="">Pilih Kategori...</option>
                                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                            <option value="Other">Lainnya</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Satuan/Unit</label>
                                        <select
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none"
                                            value={newIngredient.unit}
                                            onChange={e => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                                            required
                                        >
                                            <option value="">Pilih Satuan...</option>
                                            {units.map(u => (
                                                <option key={u.id} value={getUnitOptionValue(u)}>
                                                    {getUnitOptionLabel(u)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Minimum Stok untuk Alert</label>
                                        <input
                                            type="number"
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none"
                                            value={newIngredient.min_stock}
                                            onChange={e => setNewIngredient({ ...newIngredient, min_stock: Number(e.target.value) })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Harga Beli / Unit (HPP)</label>
                                        <input
                                            type="number"
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none font-bold text-gray-700"
                                            placeholder="Rp 0"
                                            value={newIngredient.cost_per_unit || ''}
                                            onChange={e => setNewIngredient({ ...newIngredient, cost_per_unit: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <Button type="button" variant="outline" className="flex-1 h-14 rounded-[20px]" onClick={() => setIsAddModalOpen(false)}>Batal</Button>
                                    <Button type="submit" className="flex-1 h-14 rounded-[20px] shadow-xl shadow-primary/20">Simpan Bahan</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Ingredient Modal */}
            {isEditModalOpen && (
                <div onClick={() => setIsEditModalOpen(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-10 space-y-8">
                            <div>
                                <h3 className="text-2xl font-black text-gray-800">Edit Bahan Baku</h3>
                                <p className="text-gray-500">Perbarui informasi bahan baku.</p>
                            </div>
                            <form onSubmit={handleEditIngredient} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Nama Bahan</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] focus:ring-4 focus:ring-primary/5 outline-none transition-all"
                                        value={editFormData.name || ''}
                                        onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Kategori</label>
                                        <select
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none"
                                            value={editFormData.category || ''}
                                            onChange={e => setEditFormData({ ...editFormData, category: e.target.value })}
                                        >
                                            <option value="">Pilih Kategori...</option>
                                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                            <option value="Other">Lainnya</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Satuan/Unit</label>
                                        <select
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none"
                                            value={normalizeUnitValue(editFormData.unit)}
                                            onChange={e => setEditFormData({ ...editFormData, unit: e.target.value })}
                                            required
                                        >
                                            <option value="">Pilih Satuan...</option>
                                            {units.map(u => (
                                                <option key={u.id} value={getUnitOptionValue(u)}>
                                                    {getUnitOptionLabel(u)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Minimum Stok</label>
                                        <input
                                            type="number"
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none"
                                            value={editFormData.min_stock || 0}
                                            onChange={e => setEditFormData({ ...editFormData, min_stock: Number(e.target.value) })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Harga Beli / Unit</label>
                                        <input
                                            type="number"
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none font-bold text-gray-700"
                                            placeholder="Rp 0"
                                            value={editFormData.cost_per_unit || 0}
                                            onChange={e => setEditFormData({ ...editFormData, cost_per_unit: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <Button type="button" variant="outline" className="flex-1 h-14 rounded-[20px]" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
                                    <Button type="submit" className="flex-1 h-14 rounded-[20px] shadow-xl shadow-primary/20">Update Bahan</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Update Stock Modal (IN/OUT) */}
            {isStockModalOpen && selectedIngredient && (
                <div onClick={() => setIsStockModalOpen(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className={`p-10 space-y-8 ${stockAction === 'IN' ? 'bg-emerald-50/30' : 'bg-red-50/30'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${stockAction === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {stockAction === 'IN' ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                                        Mutasi {stockAction === 'IN' ? 'Masuk' : 'Keluar'}
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-800 leading-tight">{selectedIngredient.name}</h3>
                                    <p className="text-gray-500 text-sm mt-1">Update stok aktual di gudang.</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stok Saat Ini</div>
                                    <div className="text-2xl font-black text-gray-800">{selectedIngredient.current_stock} <span className="text-sm font-medium text-gray-400">{selectedIngredient.unit}</span></div>
                                </div>
                            </div>

                            <form onSubmit={handleUpdateStock} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Jumlah {stockAction === 'IN' ? 'Ditambah' : 'Dikurangi'} ({selectedIngredient.unit})</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full text-3xl font-black p-6 bg-white border border-gray-100 rounded-[24px] focus:ring-8 focus:ring-primary/5 outline-none transition-all text-center"
                                        placeholder="0.00"
                                        autoFocus
                                        value={stockForm.quantity || ''}
                                        onChange={e => setStockForm({ ...stockForm, quantity: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Alasan Penyesuaian</label>
                                    <textarea
                                        className="w-full p-4 bg-white border border-gray-100 rounded-[20px] outline-none h-24 resize-none text-sm"
                                        placeholder={stockAction === 'IN' ? "Contoh: Pembelian baru, bonus supplier..." : "Contoh: Pemakaian harian, kedaluwarsa, tumpah..."}
                                        value={stockForm.reason}
                                        onChange={e => setStockForm({ ...stockForm, reason: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex gap-4 pt-2">
                                    <Button type="button" variant="outline" className="flex-1 h-14 rounded-[20px]" onClick={() => setIsStockModalOpen(false)}>Batal</Button>
                                    <Button
                                        type="submit"
                                        className={`flex-1 h-14 rounded-[20px] shadow-xl ${stockAction === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                                    >
                                        Konfirmasi
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
