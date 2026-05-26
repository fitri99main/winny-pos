import React, { useState, Fragment } from 'react';
import { supabase } from '../../lib/supabase';
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
    Trash2,
    Edit,
    Calendar,
    Printer,
    FileText,
    RotateCcw
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    ingredient_id?: number;
    ingredientId?: number; // Support both for backward compatibility
    ingredient_name?: string;
    ingredientName?: string;
    type: 'IN' | 'OUT' | 'ADJUSTMENT';
    quantity: number;
    unit: string;
    reason: string;
    date: string;
    created_at?: string;
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
    onIngredientAction: (action: 'create' | 'update' | 'delete' | 'delete_movement' | 'update_movement', data: any) => Promise<void>;
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
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isEditMovementModalOpen, setIsEditMovementModalOpen] = useState(false);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [isStockCardOpen, setIsStockCardOpen] = useState(false);
    const [stockAction, setStockAction] = useState<'IN' | 'OUT' | 'RECONCILE'>('IN');
    const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
    const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
    const [selectedMovementIds, setSelectedMovementIds] = useState<number[]>([]);

    // Form states
    const [newIngredient, setNewIngredient] = useState<Partial<Ingredient>>({
        name: '', unit: 'kg', category: 'Coffee', min_stock: 1, cost_per_unit: 0
    });
    const [editFormData, setEditFormData] = useState<Partial<Ingredient>>({});

    const [stockForm, setStockForm] = useState({
        quantity: 0,
        reason: ''
    });

    const [editMovementForm, setEditMovementForm] = useState<{
        type: 'IN' | 'OUT' | 'ADJUSTMENT';
        quantity: number;
        reason: string;
    }>({
        type: 'IN',
        quantity: 0,
        reason: ''
    });

    const [stockCardStartDate, setStockCardStartDate] = useState('');
    const [stockCardEndDate, setStockCardEndDate] = useState('');
    const [isFetchingStockCard, setIsFetchingStockCard] = useState(false);
    const [directStockCardMovements, setDirectStockCardMovements] = useState<any[]>([]);

    const fetchStockCardData = async (ingredient: Ingredient) => {
        setIsFetchingStockCard(true);
        setDirectStockCardMovements([]);
        try {
            // 1. Fetch manual & trigger stock movements
            const { data: manualMovs } = await supabase
                .from('stock_movements')
                .select('*')
                .eq('ingredient_id', ingredient.id)
                .order('created_at', { ascending: false });

            const all = (manualMovs || []).map((m: any) => ({
                ...m,
                _source: 'manual'
            }));

            setDirectStockCardMovements(all);
        } catch (err) {
            console.error('Error fetching stock card data:', err);
        } finally {
            setIsFetchingStockCard(false);
        }
    };


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
        let finalType: 'IN' | 'OUT' | 'ADJUSTMENT' = stockAction === 'RECONCILE' ? 'ADJUSTMENT' : stockAction;
        let finalQty = qty;
        let finalReason = stockForm.reason;

        if (stockAction === 'RECONCILE') {
            const diff = qty - (selectedIngredient.current_stock || 0);
            if (diff === 0) {
                toast.info('Stok fisik sama dengan stok sistem. Tidak ada perubahan.');
                setIsStockModalOpen(false);
                return;
            }
            finalQty = Math.abs(diff);
            finalType = diff > 0 ? 'IN' : 'OUT';
            finalReason = stockForm.reason || `Stock Opname (Fisik: ${qty}, Sistem: ${selectedIngredient.current_stock})`;
        } else {
            finalReason = stockForm.reason || (stockAction === 'IN' ? 'Penyesuaian Masuk' : 'Pemakaian/Terbuang');
        }

        await onStockAdjustment({
            ingredientId: selectedIngredient.id,
            ingredientName: selectedIngredient.name,
            type: finalType,
            quantity: finalQty,
            unit: selectedIngredient.unit,
            reason: finalReason,
            user: 'Staff'
        });

        setIsStockModalOpen(false);
        setStockForm({ quantity: 0, reason: '' });
    };

    const handleUpdateMovement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMovement) return;

        await onIngredientAction('update_movement', {
            id: selectedMovement.id,
            type: editMovementForm.type,
            quantity: Number(editMovementForm.quantity),
            reason: editMovementForm.reason,
            user: selectedMovement.user
        });

        setIsEditMovementModalOpen(false);
        setSelectedMovement(null);
    };

    const openEditMovementModal = (mov: StockMovement) => {
        setSelectedMovement(mov);
        setEditMovementForm({
            type: mov.type as 'IN' | 'OUT' | 'ADJUSTMENT',
            quantity: mov.quantity,
            reason: mov.reason || ''
        });
        setIsEditMovementModalOpen(true);
    };

    const handleExportPDF = () => {
        if (!selectedIngredient) return;

        try {
            const doc = new jsPDF();
            const title = `Kartu Stok: ${selectedIngredient.name}`;
            const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

            // Calculate Totals
            const totalIn = stockCardMovements.reduce((sum, m) => m.type === 'IN' ? sum + Number(m.quantity) : sum, 0);
            const totalOut = stockCardMovements.reduce((sum, m) => m.type === 'OUT' ? sum + Number(m.quantity) : sum, 0);

            // Header
            doc.setFontSize(18);
            doc.text(title, 14, 22);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Kategori: ${selectedIngredient.category} | Unit: ${selectedIngredient.unit}`, 14, 30);
            doc.text(`Total Masuk: +${totalIn} | Total Keluar: -${totalOut}`, 14, 35);
            doc.text(`Stok Saat Ini: ${selectedIngredient.current_stock} | Tanggal Cetak: ${dateStr}`, 14, 40);
            doc.line(14, 43, 196, 43);

            // Table Data
            const tableData = stockCardMovements.map((mov, index) => [
                index + 1,
                new Date(mov.date || mov.created_at || 0).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                mov.type === 'IN' ? 'Barang Masuk' : (mov.type === 'OUT' ? 'Barang Keluar' : 'Penyesuaian'),
                `${mov.type === 'OUT' ? '-' : '+'}${mov.quantity} ${mov.unit}`,
                mov.reason || '-',
                mov.user || 'System'
            ]);

            autoTable(doc, {
                startY: 50,
                head: [['No', 'Waktu & Tanggal', 'Tipe', 'Jumlah', 'Keterangan', 'User']],
                body: tableData,
                foot: [['', '', 'GRAND TOTAL', `IN: +${totalIn} / OUT: -${totalOut}`, '', '']],
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                styles: { fontSize: 8, cellPadding: 3 },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    3: { halign: 'right' }
                }
            });

            doc.save(`Kartu_Stok_${selectedIngredient.name.replace(/\s+/g, '_')}_${dateStr}.pdf`);
            toast.success('PDF berhasil dibuat');
        } catch (err) {
            console.error('PDF Error:', err);
            toast.error('Gagal membuat PDF');
        }
    };

    const handleDeleteIngredient = async (ingredient: Ingredient) => {
        const isConfirmed = window.confirm(`Hapus bahan baku "${ingredient.name}"?`);
        if (!isConfirmed) return;

        await onIngredientAction('delete', { id: ingredient.id });

        if (selectedIngredient?.id === ingredient.id) {
            setSelectedIngredient(null);
            setIsStockModalOpen(false);
            setIsStockCardOpen(false);
        }
    };

    const handleBulkDeleteMovements = async () => {
        if (selectedMovementIds.length === 0) return;
        
        const isConfirmed = window.confirm(`Hapus ${selectedMovementIds.length} catatan mutasi yang dipilih? Stok akan dikembalikan otomatis.`);
        if (!isConfirmed) return;

        try {
            // Process in sequence or use a bulk endpoint if available
            // For now, we call the existing action for each ID
            for (const id of selectedMovementIds) {
                await onIngredientAction('delete_movement', { id });
            }
            setSelectedMovementIds([]);
            toast.success(`${selectedMovementIds.length} mutasi berhasil dihapus`);
        } catch (err) {
            console.error('Bulk Delete Error:', err);
            toast.error('Beberapa mutasi gagal dihapus');
        }
    };

    const toggleSelectMovement = (id: number) => {
        setSelectedMovementIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAllVisible = (visibleIds: number[]) => {
        if (selectedMovementIds.length === visibleIds.length) {
            setSelectedMovementIds([]);
        } else {
            setSelectedMovementIds(visibleIds);
        }
    };

    const filteredIngredients = ingredients.filter(ing => {
        const matchesBranch = !currentBranchId || String(ing.branch_id) === String(currentBranchId) || !ing.branch_id;
        const query = searchQuery.toLowerCase();
        const matchesQuery = 
            (ing.name?.toLowerCase() || '').includes(query) ||
            (ing.category?.toLowerCase() || '').includes(query) ||
            ((ing as any).code?.toLowerCase() || '').includes(query);
        
        return matchesBranch && matchesQuery;
    });

    const filteredMovements = (movements || []).filter(mov => {
        const query = searchQuery.toLowerCase();
        const ingName = (mov as any).ingredient_name || mov.ingredientName || '';
        const reason = mov.reason || '';
        const user = mov.user || '';
        
        return ingName.toLowerCase().includes(query) || 
               reason.toLowerCase().includes(query) || 
               user.toLowerCase().includes(query);
    });

    const stockCardMovements = (directStockCardMovements.length > 0 ? directStockCardMovements : (movements || []))
        .filter(m => {
            if (!selectedIngredient) return false;
            const mId = m.ingredient_id || m.ingredientId;
            const sId = selectedIngredient.id;
            
            const isMatch = mId != null && sId != null && String(mId) == String(sId);
            if (!isMatch) return false;

            const mDateObj = new Date(m.date || m.created_at || 0);
            if (!isNaN(mDateObj.getTime())) {
                const y = mDateObj.getFullYear();
                const m_ = String(mDateObj.getMonth() + 1).padStart(2, '0');
                const d = String(mDateObj.getDate()).padStart(2, '0');
                const mDateStr = `${y}-${m_}-${d}`;
                if (stockCardStartDate && mDateStr < stockCardStartDate) return false;
                if (stockCardEndDate && mDateStr > stockCardEndDate) return false;
            }
            return true;
        })
        .sort((a, b) => {
            const dateA = new Date(a.date || a.created_at || 0).getTime();
            const dateB = new Date(b.date || b.created_at || 0).getTime();
            return dateB - dateA;
        });


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
                        {activeTab === 'history' && selectedMovementIds.length > 0 && (
                            <button 
                                onClick={handleBulkDeleteMovements}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 animate-in fade-in zoom-in"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Hapus {selectedMovementIds.length} Terpilih
                            </button>
                        )}
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
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Jumlah</th>
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
                                            <div className="flex justify-center gap-2 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(ing)}
                                                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                                                    title="Edit Data"
                                                >
                                                    <Edit className="w-4 h-4" />
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
                                                    onClick={() => { 
                                                        setSelectedIngredient(ing); 
                                                        setStockCardStartDate('');
                                                        setStockCardEndDate('');
                                                        setDirectStockCardMovements([]);
                                                        setIsStockCardOpen(true);
                                                        fetchStockCardData(ing);
                                                    }}
                                                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                                                    title="Lihat Kartu Stok"
                                                >
                                                    <History className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedIngredient(ing); setStockAction('RECONCILE'); setIsStockModalOpen(true); }}
                                                    className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors"
                                                    title="Stock Opname (Penyesuaian Fisik)"
                                                >
                                                    <RotateCcw className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteIngredient(ing)}
                                                    className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                                                    title="Hapus Bahan"
                                                >
                                                    <Trash2 className="w-5 h-5" />
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
                                    <th className="px-6 py-5 text-center w-12">
                                        <input 
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedMovementIds.length > 0 && selectedMovementIds.length === filteredMovements.length}
                                            onChange={() => {
                                                const visibleIds = filteredMovements.map(m => m.id);
                                                toggleSelectAllVisible(visibleIds);
                                            }}
                                        />
                                    </th>
                                    <th className="px-6 py-5 text-center w-12">No</th>
                                    <th className="px-8 py-5">Waktu & Tanggal</th>
                                    <th className="px-8 py-5">Nama Bahan</th>
                                    <th className="px-8 py-5 text-center">Jenis</th>
                                    <th className="px-8 py-5 text-right">Jumlah</th>
                                    <th className="px-8 py-5">Keterangan</th>
                                    <th className="px-8 py-5 text-center">User</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                    {(() => {
                                        if (filteredMovements.length === 0) {
                                            return (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400 italic">Belum ada riwayat mutasi.</td>
                                                </tr>
                                            );
                                        }

                                        // Group by date
                                        const groups: { [key: string]: StockMovement[] } = {};
                                        filteredMovements.forEach(m => {
                                            const dateKey = new Date(m.date || m.created_at || 0).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                                            if (!groups[dateKey]) groups[dateKey] = [];
                                            groups[dateKey].push(m);
                                        });

                                        return Object.entries(groups).map(([date, dateMovements]) => {
                                            const totalIn = dateMovements.reduce((sum, m) => {
                                                const type = (m.type || 'ADJUSTMENT').toUpperCase();
                                                const isActuallyIn = type === 'IN' || (type === 'ADJUSTMENT' && (m.reason || '').toLowerCase().includes('mutasi'));
                                                return isActuallyIn ? sum + Number(m.quantity) : sum;
                                            }, 0);
                                            const totalOut = dateMovements.reduce((sum, m) => {
                                                const type = (m.type || 'ADJUSTMENT').toUpperCase();
                                                const isActuallyOut = type === 'OUT' || type.includes('KELUAR');
                                                return isActuallyOut ? sum + Number(m.quantity) : sum;
                                            }, 0);

                                            return (
                                                <Fragment key={date}>
                                                    <tr className="bg-gray-50/80 border-y border-gray-100">
                                                        <td colSpan={8} className="px-8 py-2">
                                                            <div className="flex justify-between items-center text-[10px]">
                                                                <span className="font-black text-gray-400 uppercase tracking-widest">{date}</span>
                                                                <div className="flex gap-4">
                                                                    <span className="text-emerald-600 font-bold">TOTAL MASUK: +{totalIn.toLocaleString()}</span>
                                                                    <span className="text-red-600 font-bold">TOTAL KELUAR: -{totalOut.toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {dateMovements.map(mov => {
                                                        const type = (mov.type || 'ADJUSTMENT').toUpperCase();
                                                        const isPositive = type === 'IN' || (type === 'ADJUSTMENT' && Number(mov.quantity) > 0);
                                                        const isNegative = type === 'OUT' || type.includes('KELUAR');

                                                        return (
                                                            <tr key={mov.id} className={`hover:bg-gray-50/50 transition-colors text-xs group ${selectedMovementIds.includes(mov.id) ? 'bg-blue-50/50' : ''}`}>
                                                                <td className="px-6 py-4 text-center w-12">
                                                                    <input 
                                                                        type="checkbox"
                                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                        checked={selectedMovementIds.includes(mov.id)}
                                                                        onChange={() => toggleSelectMovement(mov.id)}
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-4 text-center text-gray-400 font-medium">
                                                                    {filteredMovements.indexOf(mov) + 1}
                                                                </td>
                                                                <td className="px-8 py-4 text-gray-500 font-mono">
                                                                    {new Date(mov.date || mov.created_at || 0).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                                </td>
                                                                <td className="px-8 py-4 font-bold text-gray-800">{(mov as any).ingredient_name || mov.ingredientName}</td>
                                                                <td className="px-8 py-4 text-center">
                                                                    <span className={`px-2.5 py-1 rounded-lg font-black uppercase text-[9px] ${
                                                                        type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 
                                                                        ((type === 'OUT' || type.includes('KELUAR')) ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600')
                                                                    }`}>
                                                                        {type === 'IN' ? 'Barang Masuk' : ((type === 'OUT' || type.includes('KELUAR')) ? 'Barang Keluar' : 'Penyesuaian')}
                                                                    </span>
                                                                </td>
                                                                <td className={`px-8 py-4 text-right font-bold ${
                                                                    type === 'IN' ? 'text-emerald-600' : 
                                                                    (type === 'OUT' ? 'text-red-500' : 'text-blue-500')
                                                                }`}>
                                                                    {type === 'IN' ? '+' : (type === 'OUT' ? '-' : '')}{mov.quantity} {mov.unit}
                                                                </td>
                                                                <td className="px-8 py-4 text-gray-600 italic">"{mov.reason}"</td>
                                                                <td className="px-8 py-4">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                                                                {((mov as any).user || 'S').charAt(0)}
                                                                            </div>
                                                                            <span className="font-medium text-gray-500">{(mov as any).user || 'System'}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <button 
                                                                                onClick={() => openEditMovementModal(mov)}
                                                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-blue-400 hover:text-blue-600 transition-all"
                                                                                title="Edit Mutasi"
                                                                            >
                                                                                <Edit className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => {
                                                                                    if (window.confirm('Hapus catatan mutasi ini? Ini tidak akan mengembalikan stok secara otomatis.')) {
                                                                                        onIngredientAction('delete_movement', mov);
                                                                                    }
                                                                                }}
                                                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 transition-all"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </Fragment>
                                            );
                                        });
                                    })()}
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
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Stok Minimum (Batas Alert)</label>
                                        <input
                                            type="number"
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none"
                                            value={newIngredient.min_stock || 0}
                                            onChange={e => setNewIngredient({ ...newIngredient, min_stock: Number(e.target.value) })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Harga Beli / Unit</label>
                                        <input
                                            type="number"
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none font-bold text-gray-700"
                                            placeholder="Rp 0"
                                            value={newIngredient.cost_per_unit || 0}
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
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Stok Minimum (Batas Alert)</label>
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
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-amber-600 uppercase tracking-widest pl-1">Stok Saat Ini (Total Inventaris)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="w-full p-4 bg-amber-50 border-2 border-amber-200 rounded-[20px] outline-none font-black text-gray-800 focus:ring-4 focus:ring-amber-100 transition-all"
                                            placeholder="0"
                                            value={editFormData.current_stock ?? 0}
                                            onChange={e => setEditFormData({ ...editFormData, current_stock: Number(e.target.value) })}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500">
                                            {editFormData.unit || ''}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-amber-600 font-medium pl-1">
                                        ⚠ Mengubah nilai ini akan langsung menimpa stok. Gunakan Stok Masuk/Keluar untuk pencatatan mutasi.
                                    </p>
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
                        <div className={`p-10 space-y-8 ${
                            stockAction === 'IN' ? 'bg-emerald-50/30' : 
                            (stockAction === 'OUT' ? 'bg-red-50/30' : 'bg-purple-50/30')
                        }`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${
                                        stockAction === 'IN' ? 'bg-emerald-100 text-emerald-700' : 
                                        (stockAction === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700')
                                    }`}>
                                        {stockAction === 'IN' ? <ArrowUpCircle className="w-3 h-3" /> : (stockAction === 'OUT' ? <ArrowDownCircle className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />)}
                                        {stockAction === 'RECONCILE' ? 'Stock Opname' : `Mutasi ${stockAction === 'IN' ? 'Masuk' : 'Keluar'}`}
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-800 leading-tight">{selectedIngredient.name}</h3>
                                    <p className="text-gray-500 text-sm mt-1">
                                        {stockAction === 'RECONCILE' ? 'Sesuaikan jumlah fisik di gudang.' : 'Update stok aktual di gudang.'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stok Saat Ini</div>
                                    <div className="text-2xl font-black text-gray-800">{selectedIngredient.current_stock} <span className="text-sm font-medium text-gray-400">{selectedIngredient.unit}</span></div>
                                </div>
                            </div>

                            <form onSubmit={handleUpdateStock} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">
                                        {stockAction === 'RECONCILE' ? 'Total Stok Fisik Saat Ini' : `Jumlah ${stockAction === 'IN' ? 'Ditambah' : 'Dikurangi'}`} ({selectedIngredient.unit})
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`w-full text-3xl font-black p-6 bg-white border border-gray-100 rounded-[24px] focus:ring-8 outline-none transition-all text-center ${
                                            stockAction === 'RECONCILE' ? 'focus:ring-purple-100 border-purple-100 text-purple-600' : 'focus:ring-primary/5'
                                        }`}
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
                                        className={`flex-1 h-14 rounded-[20px] shadow-xl ${
                                            stockAction === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 
                                            (stockAction === 'OUT' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-200')
                                        }`}
                                    >
                                        Konfirmasi
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {/* Stock Card Modal (History per Ingredient) */}
            {isStockCardOpen && selectedIngredient && (
                <div onClick={() => setIsStockCardOpen(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                    <History className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-800">Kartu Stok: {selectedIngredient.name}</h3>
                                    <p className="text-gray-500 text-sm">Riwayat mutasi keluar masuk bahan baku.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stok Saat Ini</div>
                                    <div className="text-xl font-black text-blue-600">{selectedIngredient.current_stock} <span className="text-xs font-medium text-gray-400">{selectedIngredient.unit}</span></div>
                                </div>
                                <button onClick={() => setIsStockCardOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <Plus className="w-6 h-6 rotate-45 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        <div className="px-8 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                    <span className="text-[10px] font-black text-gray-400 uppercase">Dari Tanggal</span>
                                    <input 
                                        type="date" 
                                        value={stockCardStartDate}
                                        onChange={(e) => setStockCardStartDate(e.target.value)}
                                        className="text-xs font-bold text-gray-700 focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                                    <span className="text-[10px] font-black text-gray-400 uppercase">Sampai</span>
                                    <input 
                                        type="date" 
                                        value={stockCardEndDate}
                                        onChange={(e) => setStockCardEndDate(e.target.value)}
                                        className="text-xs font-bold text-gray-700 focus:outline-none"
                                    />
                                </div>
                                {(stockCardStartDate || stockCardEndDate) && (
                                    <button 
                                        onClick={() => { setStockCardStartDate(''); setStockCardEndDate(''); }}
                                        className="text-[10px] font-black text-red-500 hover:text-red-600 uppercase"
                                    >
                                        Tampilkan Semua
                                    </button>
                                )}
                            </div>
                            <div className="text-[10px] font-medium text-gray-400 italic">
                                {(stockCardStartDate || stockCardEndDate) ? `* Menampilkan mutasi untuk rentang tanggal yang dipilih` : '* Menampilkan semua riwayat mutasi'}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-center w-12">
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={selectedMovementIds.length > 0 && selectedMovementIds.length === (movements || []).filter(m => String(m.ingredient_id || m.ingredientId) === String(selectedIngredient.id)).length}
                                                onChange={() => {
                                                    const visibleIds = (movements || [])
                                                        .filter(m => String(m.ingredient_id || m.ingredientId) === String(selectedIngredient.id))
                                                        .map(m => m.id);
                                                    toggleSelectAllVisible(visibleIds);
                                                }}
                                            />
                                        </th>
                                        <th className="px-6 py-4 text-center w-12">No</th>
                                        <th className="px-8 py-4">Waktu</th>
                                        <th className="px-8 py-4 text-center">Tipe</th>
                                        <th className="px-8 py-4 text-right">Mutasi</th>
                                        <th className="px-8 py-4">Keterangan</th>
                                        <th className="px-8 py-4 text-center">Petugas</th>
                                        <th className="px-8 py-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(() => {
                                        try {
                                            if (isFetchingStockCard) {
                                                return (
                                                    <tr>
                                                        <td colSpan={8} className="px-8 py-20 text-center text-blue-400">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                                                                <p className="text-sm font-medium">Memuat riwayat mutasi...</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            if (stockCardMovements.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={8} className="px-8 py-20 text-center text-gray-400 italic">Belum ada riwayat mutasi untuk bahan ini.</td>
                                                    </tr>
                                                );
                                            }

                                            // Group by date string (YYYY-MM-DD)
                                            const groups: { [key: string]: { label: string, items: typeof stockCardMovements } } = {};
                                            stockCardMovements.forEach(m => {
                                                const d = new Date(m.date || m.created_at || Date.now());
                                                const key = isNaN(d.getTime()) ? 'unknown' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                                const label = isNaN(d.getTime()) ? 'Tanggal Tidak Diketahui' : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                                                if (!groups[key]) groups[key] = { label, items: [] };
                                                groups[key].items.push(m);
                                            });

                                            return Object.entries(groups).map(([key, group]) => {
                                                const totalIn = group.items.reduce((sum, m) => {
                                                    const type = (m.type || 'ADJUSTMENT').toUpperCase();
                                                    const isIn = type === 'IN' || (type === 'ADJUSTMENT' && (m.reason || '').toLowerCase().includes('mutasi'));
                                                    return isIn ? sum + Number(m.quantity) : sum;
                                                }, 0);
                                                const totalOut = group.items.reduce((sum, m) => {
                                                    const type = (m.type || 'ADJUSTMENT').toUpperCase();
                                                    const isOut = type === 'OUT' || type.includes('KELUAR');
                                                    return isOut ? sum + Number(m.quantity) : sum;
                                                }, 0);

                                                return (
                                                <Fragment key={key}>
                                                    <tr className="bg-slate-800 border-y-2 border-slate-900">
                                                        <td colSpan={8} className="px-8 py-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                                                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                                                                    {group.label}
                                                                </span>
                                                                <div className="flex gap-4 text-[11px] font-black">
                                                                    <div className="flex items-center gap-1.5 text-emerald-400 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                                                                        <ArrowUpCircle className="w-3 h-3" />
                                                                        TOTAL MASUK: +{totalIn.toLocaleString()} {selectedIngredient.unit}
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 text-red-400 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                                                                        <ArrowDownCircle className="w-3 h-3" />
                                                                        TOTAL KELUAR: -{totalOut.toLocaleString()} {selectedIngredient.unit}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                        {group.items.map(mov => {
                                                            const type = (mov.type || 'ADJUSTMENT').toUpperCase();
                                                            const isActuallyIn = type === 'IN' || (type === 'ADJUSTMENT' && (mov.reason || '').toLowerCase().includes('mutasi'));
                                                            const isActuallyOut = type === 'OUT' || type.includes('KELUAR');
                                                            
                                                            return (
                                                                <tr key={mov.id} className={`hover:bg-gray-50/50 transition-colors ${selectedMovementIds.includes(mov.id) ? 'bg-blue-50/50' : ''}`}>
                                                                    <td className="px-6 py-4 text-center w-12">
                                                                        <input 
                                                                            type="checkbox"
                                                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                            checked={selectedMovementIds.includes(mov.id)}
                                                                            onChange={() => toggleSelectMovement(mov.id)}
                                                                        />
                                                                    </td>
                                                                    <td className="px-6 py-4 text-center text-gray-400 font-medium text-xs">
                                                                        {stockCardMovements.indexOf(mov) + 1}
                                                                    </td>
                                                                    <td className="px-8 py-4 text-gray-500 font-mono text-xs">
                                                                        {(() => {
                                                                            const d = new Date(mov.date || mov.created_at || 0);
                                                                            return isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                                                                        })()}
                                                                    </td>
                                                                    <td className="px-8 py-4 text-center">
                                                                        <span className={`px-3 py-1 rounded-lg font-black uppercase text-[9px] ${
                                                                            isActuallyIn ? 'bg-emerald-50 text-emerald-600' : 
                                                                            (isActuallyOut ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600')
                                                                        }`}>
                                                                            {isActuallyIn ? 'Barang Masuk' : (isActuallyOut ? 'Barang Keluar' : 'Penyesuaian')}
                                                                        </span>
                                                                    </td>
                                                                    <td className={`px-8 py-4 text-right font-bold ${
                                                                        isActuallyIn ? 'text-emerald-600' : 
                                                                        (isActuallyOut ? 'text-red-500' : 'text-blue-500')
                                                                    }`}>
                                                                        {isActuallyIn ? '+' : (isActuallyOut ? '-' : '')}{mov.quantity} {mov.unit}
                                                                    </td>
                                                                    <td className="px-8 py-4 text-gray-600 italic text-xs">"{mov.reason}"</td>
                                                                    <td className="px-8 py-4 text-center">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                                                                {(mov.user || 'S').charAt(0)}
                                                                            </div>
                                                                            <span className="font-medium text-gray-500 text-xs">{mov.user || 'System'}</span>
                                                                        </div>
                                                                    </td>
                                                                <td className="px-8 py-4 text-center">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button 
                                                                            onClick={() => openEditMovementModal(mov)}
                                                                            className="p-2 hover:bg-blue-50 text-blue-400 hover:text-blue-600 rounded-lg transition-colors"
                                                                            title="Edit Mutasi"
                                                                        >
                                                                            <Edit className="w-4 h-4" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => {
                                                                                if (window.confirm('Yakin ingin menghapus mutasi ini? Stok akan dikembalikan otomatis.')) {
                                                                                    onIngredientAction('delete_movement', { id: mov.id });
                                                                                }
                                                                            }}
                                                                            className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors"
                                                                            title="Hapus Mutasi & Revert Stok"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </Fragment>
                                            );
                                        });
                                        } catch (e) {
                                            console.error('Stock Card Render Error:', e);
                                            return <tr><td colSpan={6} className="text-center text-red-500 py-4">Gagal menampilkan riwayat mutasi.</td></tr>;
                                        }
                                    })()}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <div className="flex gap-3 items-center">
                                {selectedMovementIds.length > 0 && (
                                    <button 
                                        onClick={handleBulkDeleteMovements}
                                        className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 animate-in fade-in slide-in-from-left-4"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                        Hapus {selectedMovementIds.length} Terpilih
                                    </button>
                                )}
                                <div className={`flex gap-3 transition-opacity duration-200 ${selectedMovementIds.length > 0 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                    <button 
                                        onClick={() => {
                                            setStockAction('IN');
                                            setStockForm({ quantity: 0, reason: '' });
                                            setIsStockModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Input Mutasi Baru
                                    </button>
                                    <button 
                                        onClick={handleExportPDF}
                                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                                    >
                                        <Printer className="w-5 h-5" />
                                        Cetak PDF
                                    </button>
                                </div>
                            </div>
                            <Button onClick={() => setIsStockCardOpen(false)}>Tutup</Button>
                        </div>
                    </div>
                </div>
            )}
            {/* Edit Movement Modal */}
            {isEditMovementModalOpen && selectedMovement && (
                <div onClick={() => setIsEditMovementModalOpen(false)} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-10 space-y-8">
                            <div>
                                <h3 className="text-2xl font-black text-gray-800">Edit Catatan Mutasi</h3>
                                <p className="text-gray-500 text-sm">Sesuaikan jenis, jumlah, atau alasan mutasi ini.</p>
                                <p className="text-[10px] text-amber-600 font-bold mt-2 uppercase tracking-widest">⚠ Stok akan disesuaikan otomatis setelah disimpan.</p>
                            </div>
                            <form onSubmit={handleUpdateMovement} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Jenis Mutasi</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setEditMovementForm({ ...editMovementForm, type: 'IN' })}
                                            className={`py-3 rounded-2xl font-bold border-2 transition-all ${editMovementForm.type === 'IN' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-transparent text-gray-400'}`}
                                        >
                                            Stok Masuk (+)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditMovementForm({ ...editMovementForm, type: 'OUT' })}
                                            className={`py-3 rounded-2xl font-bold border-2 transition-all ${editMovementForm.type === 'OUT' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-gray-50 border-transparent text-gray-400'}`}
                                        >
                                            Stok Keluar (-)
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Jumlah Mutasi</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full text-2xl font-black p-5 bg-gray-50 border border-gray-100 rounded-[24px] focus:ring-8 focus:ring-primary/5 outline-none transition-all text-center"
                                        value={editMovementForm.quantity}
                                        onChange={e => setEditMovementForm({ ...editMovementForm, quantity: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Alasan / Keterangan</label>
                                    <textarea
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] outline-none h-24 resize-none text-sm"
                                        value={editMovementForm.reason}
                                        onChange={e => setEditMovementForm({ ...editMovementForm, reason: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex gap-4 pt-2">
                                    <Button type="button" variant="outline" className="flex-1 h-14 rounded-[20px]" onClick={() => setIsEditMovementModalOpen(false)}>Batal</Button>
                                    <Button type="submit" className="flex-1 h-14 rounded-[20px] bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200">Simpan Perubahan</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
