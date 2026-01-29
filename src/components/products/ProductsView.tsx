import { useState } from 'react';
import { Package, Tags, Scale, Ticket, Plus, Search, Edit, Trash2, Filter, ChefHat, Info, Calculator, Puzzle, Settings2, X, Image as ImageIcon, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { getAcronym } from '../../lib/utils';

// --- Types ---

export interface Product {
    id: number; // Changed to number for consistency
    code: string;
    name: string;
    category: string;
    brand: string;
    unit: string;
    price: number;
    cost: number;
    stock: number;
    recipe?: RecipeItem[];
    addons?: Addon[];
    is_sellable?: boolean;
    image_url?: string;
    branch_id?: number | string;
}

export interface Addon {
    id: number;
    name: string;
    price: number;
}

export interface RecipeItem {
    ingredientId: number;
    amount: number;
}

export interface Category {
    id: number;
    name: string;
    description: string;
}

export interface Unit {
    id: number;
    name: string;
    abbreviation: string;
}

export interface Brand {
    id: number;
    name: string;
    description: string;
}

interface ProductsViewProps {
    products: Product[];
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
    ingredients: any[];
    categories: Category[];
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    units: Unit[];
    setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
    brands: Brand[];
    setBrands: React.Dispatch<React.SetStateAction<Brand[]>>;
    onProductCRUD: (action: 'create' | 'update' | 'delete', data: any) => void;
    onCategoryCRUD: (action: 'create' | 'update' | 'delete', data: any) => void;
    onUnitCRUD: (action: 'create' | 'update' | 'delete', data: any) => void;
    onBrandCRUD: (action: 'create' | 'update' | 'delete', data: any) => void;
    currentBranchId?: string;
}

export function ProductsView({
    products,
    setProducts,
    ingredients,
    categories,
    setCategories,
    units,
    setUnits,
    brands,
    setBrands,
    onProductCRUD,
    onCategoryCRUD,
    onUnitCRUD,
    onBrandCRUD,
    currentBranchId
}: ProductsViewProps) {
    const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'units' | 'brands' | 'ingredients'>('products');

    // Form states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<any>({}); // Generic form data
    const [isRecipeOpen, setIsRecipeOpen] = useState(false);
    const [isAddonOpen, setIsAddonOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // --- Generic Handlers ---

    const handleOpenForm = (data: any = {}) => {
        setFormData(data);
        setIsFormOpen(true);
    };

    const handleDelete = (id: number, type: 'product' | 'category' | 'unit' | 'brand') => {
        if (!confirm('Yakin ingin menghapus data ini?')) return;

        if (type === 'product') onProductCRUD('delete', { id });
        if (type === 'category') onCategoryCRUD('delete', { id });
        if (type === 'unit') onUnitCRUD('delete', { id });
        if (type === 'brand') onBrandCRUD('delete', { id });
    };

    const calculateHPP = (recipe?: RecipeItem[]) => {
        if (!recipe || !Array.isArray(recipe) || recipe.length === 0) return 0;
        return recipe.reduce((total, item) => {
            const ingredient = ingredients.find(i => i.id === item.ingredientId);
            const cost = (ingredient?.costPerUnit || 0) * (item.amount || 0);
            return total + cost;
        }, 0);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            return toast.error('File harus berupa gambar');
        }
        if (file.size > 2 * 1024 * 1024) {
            return toast.error('Ukuran gambar maksimal 2MB');
        }

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            setFormData({ ...formData, image_url: publicUrl });
            toast.success('Gambar berhasil diunggah');
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Gagal upload gambar: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (activeTab === 'products') {
            const product = formData as Product;
            if (!product.name || !product.code) return toast.error('Nama dan Kode Produk wajib diisi');

            const hpp = calculateHPP(product.recipe);
            const productWithHPP = { ...product, cost: hpp };

            if (product.id) {
                onProductCRUD('update', productWithHPP);
            } else {
                // Ensure new product doesn't have an ID that causes conflict if not generated by DB
                onProductCRUD('create', productWithHPP);
            }
        } else {
            if (!formData.name) return toast.error('Nama wajib diisi');

            const crudMap = {
                'categories': onCategoryCRUD,
                'units': onUnitCRUD,
                'brands': onBrandCRUD,
                'ingredients': () => { } // Shouldn't happen here
            };

            const handler = (crudMap as any)[activeTab];
            if (activeTab !== 'ingredients' && handler) {
                if (formData.id) {
                    handler('update', formData);
                } else {
                    handler('create', formData);
                }
            }
        }

        setIsFormOpen(false);
        setFormData({});
    };

    // --- Renderers ---

    const renderProductsTable = () => (
        <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex gap-4">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Cari..." className="w-full pl-12 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all" />
                </div>
                <Button onClick={() => handleOpenForm()} className="gap-2 h-12 rounded-2xl px-6"><Plus className="w-4 h-4" /> Tambah</Button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50/50 text-gray-400 text-left border-b border-gray-100">
                        <tr>
                            <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] text-center">Gambar</th>
                            <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px]">Kode</th>
                            <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px]">Nama Produk</th>
                            <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px]">Kategori</th>
                            <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] text-right">Modal</th>
                            <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] text-right">Harga</th>
                            <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] text-right">Stok</th>
                            <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] text-center">Status</th>
                            <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {products
                            .filter(p => !currentBranchId || String(p.branch_id) === String(currentBranchId) || !p.branch_id)
                            .map(p => {
                                const currentHPP = calculateHPP(p.recipe);
                                const margin = p.price - currentHPP;
                                return (
                                    <tr key={p.id} className="group hover:bg-gray-50/50 transition-all">
                                        <td className="px-4 py-5">
                                            <div className="w-12 h-12 rounded-xl bg-primary/5 overflow-hidden border border-primary/10 flex items-center justify-center relative">
                                                {p.image_url ? (
                                                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xs font-black text-primary">
                                                        {getAcronym(p.name)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 font-mono text-gray-400 text-xs">{p.code}</td>
                                        <td className="px-4 py-5">
                                            <div className="font-bold text-gray-800">{p.name}</div>
                                            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{p.brand}</div>
                                        </td>
                                        <td className="px-4 py-5">
                                            <span className="px-2.5 py-1 bg-primary/5 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest ring-1 ring-primary/10">
                                                {p.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-5 text-right font-black text-orange-600">
                                            Rp {currentHPP.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-5 text-right font-black text-blue-600">
                                            Rp {p.price.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-5 text-right">
                                            <span className={`font-black ${p.stock < 10 ? 'text-red-500' : 'text-gray-700'}`}>{p.stock}</span>
                                            <span className="text-gray-400 text-[10px] ml-1 uppercase font-bold">{p.unit}</span>
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${p.is_sellable !== false ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                {p.is_sellable !== false ? 'Dijual' : 'Berhenti'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-5 flex justify-center gap-1">
                                            <button onClick={() => { setSelectedProduct(p); setIsRecipeOpen(true); }} className="p-2.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-colors" title="Atur Resep & HPP"><ChefHat className="w-4.5 h-4.5" /></button>
                                            <button onClick={() => { setSelectedProduct(p); setIsAddonOpen(true); }} className="p-2.5 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors" title="Atur Toping / Add-ons"><Puzzle className="w-4.5 h-4.5" /></button>
                                            <button onClick={() => handleOpenForm(p)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors" title="Edit"><Edit className="w-4.5 h-4.5" /></button>
                                            <button onClick={() => handleDelete(p.id, 'product')} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors" title="Hapus"><Trash2 className="w-4.5 h-4.5" /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderSimpleTable = (data: any[], type: 'category' | 'unit' | 'brand', label: string) => (
        <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
                <div>
                    <h3 className="font-black text-gray-800 tracking-tight">Daftar {label}</h3>
                    <p className="text-xs text-gray-500 font-medium">Kelola data master untuk identitas produk.</p>
                </div>
                <Button onClick={() => handleOpenForm()} className="h-10 rounded-xl px-4 gap-2 text-xs"><Plus className="w-3.5 h-3.5" /> Tambah {label}</Button>
            </div>
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-400 border-b border-gray-50">
                    <tr>
                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Nama {label}</th>
                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">{type === 'unit' ? 'Singkatan' : 'Deskripsi'}</th>
                        <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {data.map(item => (
                        <tr key={item.id} className="group hover:bg-gray-50/50 transition-all">
                            <td className="px-8 py-5 font-bold text-gray-700">{item.name}</td>
                            <td className="px-8 py-5 text-gray-500 text-xs italic">{type === 'unit' ? item.abbreviation : item.description}</td>
                            <td className="px-8 py-5 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenForm(item)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(item.id, type)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="flex h-full bg-gray-50/50 relative overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-100 p-5 flex flex-col gap-2 shadow-[10px_0_30px_rgba(0,0,0,0.02)] z-20">
                <div className="mb-4">
                    <h2 className="text-xl font-black text-gray-800 tracking-tight">Master Data</h2>
                    <p className="text-[10px] text-gray-400 font-medium tracking-wide">Katalog Produk & Inventaris</p>
                </div>
                {[
                    { id: 'products', label: 'Daftar Produk', icon: Package, desc: 'Harga Jual & Stok' },
                    { id: 'categories', label: 'Kategori', icon: Filter, desc: 'Grouping Menu' },
                    { id: 'units', label: 'Satuan', icon: Scale, desc: 'Unit Takaran' },
                    { id: 'brands', label: 'Merek', icon: Ticket, desc: 'Brand / Vendor' },
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group ${activeTab === item.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >
                        <div className={`p-2 rounded-xl transition-colors ${activeTab === item.id ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-white'}`}>
                            <item.icon className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                            <div className="text-sm font-black tracking-tight">{item.label}</div>
                            <div className={`text-[10px] font-medium opacity-60 ${activeTab === item.id ? 'text-white' : 'text-gray-400'}`}>{item.desc}</div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                {activeTab === 'products' && renderProductsTable()}
                {activeTab === 'categories' && renderSimpleTable(categories, 'category', 'Kategori')}
                {activeTab === 'units' && renderSimpleTable(units, 'unit', 'Satuan')}
                {activeTab === 'brands' && renderSimpleTable(brands, 'brand', 'Merek')}
            </div>

            {/* Modal Form */}
            {isFormOpen && (() => {
                const currentLabel = activeTab === 'products' ? 'Produk' : activeTab === 'categories' ? 'Kategori' : activeTab === 'units' ? 'Satuan' : 'Merek';
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-[48px] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.3)] w-full max-w-2xl animate-in zoom-in-95 fade-in duration-300 overflow-hidden border border-white/20">
                            <div className="px-10 py-8 border-b bg-gray-50/50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-black text-2xl text-gray-800 tracking-tight">
                                        {formData.id ? 'Edit Data' : 'Tambah'} {currentLabel}
                                    </h3>
                                    <p className="text-sm text-gray-500 font-medium">Lengkapi rincian informasi di bawah ini.</p>
                                </div>
                            </div>
                            <form onSubmit={handleSubmit} className="p-10 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                                {activeTab === 'products' ? (
                                    <div className="space-y-10">
                                        {/* Image Section */}
                                        <div className="flex flex-col items-center gap-4 py-4 bg-gray-50/50 rounded-[32px] border-2 border-dashed border-gray-100 transition-all hover:bg-gray-50 hover:border-primary/20 group">
                                            <div className="relative">
                                                <div className="w-40 h-40 rounded-[40px] bg-white border border-gray-100 flex flex-col items-center justify-center overflow-hidden shadow-2xl shadow-gray-200/50 transition-all group-hover:scale-[1.02]">
                                                    {formData.image_url ? (
                                                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-primary/5 rounded-[24px]">
                                                                <Upload className="w-6 h-6 text-primary" />
                                                            </div>
                                                            <div className="text-center">
                                                                <span className="block text-[14px] font-black text-primary uppercase tracking-tighter mb-0.5">
                                                                    {getAcronym(formData.name || "") || "Pilih Foto"}
                                                                </span>
                                                                <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Maks 2MB</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {isUploading && (
                                                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                                                            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                                                            <span className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">Mengunggah...</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                                    disabled={isUploading}
                                                />
                                                {formData.image_url && !isUploading && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setFormData({ ...formData, image_url: '' });
                                                        }}
                                                        className="absolute -top-3 -right-3 p-2.5 bg-red-500 text-white rounded-2xl shadow-xl hover:bg-red-600 transition-all hover:scale-110 border-4 border-white"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Informasi Utama Section */}
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="h-px flex-1 bg-gray-100"></div>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Informasi Utama</span>
                                                <div className="h-px flex-1 bg-gray-100"></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2.5">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pl-1">
                                                        <div className="w-1 h-1 rounded-full bg-primary ring-2 ring-primary/20"></div>
                                                        Kode Produk (SKU)
                                                    </label>
                                                    <input className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all font-mono font-bold text-gray-800 placeholder:text-gray-300 shadow-sm" value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: P001" required />
                                                </div>
                                                <div className="space-y-2.5">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pl-1">
                                                        <div className="w-1 h-1 rounded-full bg-primary ring-2 ring-primary/20"></div>
                                                        Nama Produk
                                                    </label>
                                                    <input className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all font-black text-gray-800 placeholder:text-gray-300 shadow-sm" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Exp: Es Kopi Gula Aren" required />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2.5">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Kategori Produk</label>
                                                    <select className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all text-sm font-black text-gray-800 shadow-sm" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                                        <option value="">Pilih Kategori...</option>
                                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-2.5">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Satuan Dasar</label>
                                                    <select className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all text-sm font-black text-gray-800 shadow-sm" value={formData.unit || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                                                        <option value="">Pilih Satuan...</option>
                                                        {units.map(u => <option key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2.5">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Merek</label>
                                                    <select className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all text-sm font-black text-gray-800 shadow-sm" value={formData.brand || ''} onChange={e => setFormData({ ...formData, brand: e.target.value })}>
                                                        <option value="">Pilih Merek...</option>
                                                        {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Harga & Inventaris Section */}
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="h-px flex-1 bg-gray-100"></div>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Harga & Inventaris</span>
                                                <div className="h-px flex-1 bg-gray-100"></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2.5">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Harga Jual (IDR)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xs font-black text-blue-400">Rp</span>
                                                        <input type="number" className="w-full p-5 pl-12 bg-blue-50/30 border border-blue-100 rounded-[24px] outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500/20 transition-all font-black text-blue-600 shadow-sm" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) })} placeholder="0" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2.5">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Stok Awal</label>
                                                    <input type="number" className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 transition-all font-black text-gray-800 shadow-sm" value={formData.stock || ''} onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })} placeholder="0" />
                                                </div>
                                            </div>

                                            <div className="p-6 bg-primary/5 rounded-[32px] border border-primary/10 flex items-center justify-between group transition-all hover:bg-primary/10">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-primary group-hover:scale-110 transition-transform">
                                                        <Package className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-gray-800">Status Penjualan</p>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tampilkan Menu di Layar Kasir</p>
                                                    </div>
                                                </div>
                                                <div
                                                    onClick={() => setFormData({ ...formData, is_sellable: formData.is_sellable === false ? true : false })}
                                                    className={`w-14 h-8 rounded-full transition-all cursor-pointer relative p-1 ${formData.is_sellable !== false ? 'bg-primary' : 'bg-gray-200'}`}
                                                >
                                                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all transform ${formData.is_sellable !== false ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Nama {currentLabel}</label>
                                            <input className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/5 transition-all font-black text-gray-800 shadow-sm" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                        </div>
                                        {activeTab === 'units' ? (
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Singkatan Satuan</label>
                                                <input className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-[24px] outline-none focus:ring-4 focus:ring-primary/5 transition-all font-mono font-bold text-gray-800 shadow-sm" value={formData.abbreviation || ''} onChange={e => setFormData({ ...formData, abbreviation: e.target.value })} placeholder="cth: kg, L, pcs" />
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Deskripsi Tambahan</label>
                                                <textarea className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-[32px] outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold text-gray-800 shadow-sm min-h-[160px]" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Opsional..." />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-6 border-t border-gray-50">
                                    <Button type="button" variant="outline" className="h-14 px-8 rounded-2xl font-bold" onClick={() => setIsFormOpen(false)}>Batal</Button>
                                    <Button type="submit" className="h-14 px-10 rounded-2xl font-black shadow-xl shadow-primary/20">Simpan Data</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

            {/* Recipe Modal */}
            {isRecipeOpen && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[44px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-gray-800 tracking-tight">Resep & Kalkulasi HPP</h3>
                                <p className="text-sm text-gray-500 font-medium">{selectedProduct.name} <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded ml-1">{selectedProduct.code}</span></p>
                            </div>
                            <button onClick={() => setIsRecipeOpen(false)} className="p-3 hover:bg-gray-100 rounded-2xl transition-all">
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <ChefHat className="w-4 h-4 text-primary" /> Komposisi Bahan Baku
                                    </h4>
                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-3 -mr-3">
                                        {selectedProduct.recipe?.map((item, idx) => {
                                            const ing = ingredients.find(i => i.id === item.ingredientId);
                                            return (
                                                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-[24px] border border-gray-100/50 group">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-gray-800">{ing?.name}</span>
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{item.amount} {ing?.unit} @ Rp {ing?.costPerUnit.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-black text-primary">Rp {(item.amount * (ing?.costPerUnit || 0)).toLocaleString()}</span>
                                                        <button
                                                            onClick={() => {
                                                                const newRecipe = selectedProduct.recipe?.filter((_, i) => i !== idx);
                                                                const updated = { ...selectedProduct, recipe: newRecipe };
                                                                setProducts(products.map(p => p.id === updated.id ? updated : p));
                                                                setSelectedProduct(updated);
                                                            }}
                                                            className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(!selectedProduct.recipe || selectedProduct.recipe.length === 0) && (
                                            <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-[32px]">
                                                <Info className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                                <p className="text-gray-400 text-xs italic font-medium">Bahan belum ditentukan</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-6 border-t border-gray-50">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Tambahkan Komposisi</p>
                                        <div className="space-y-3">
                                            <select id="ing-select" className="w-full p-4 text-sm font-bold border-none bg-gray-50 rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 transition-all">
                                                <option value="">Pilih bahan...</option>
                                                {ingredients.map(i => (
                                                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                                ))}
                                            </select>
                                            <div className="flex gap-2">
                                                <input id="ing-amount" type="number" placeholder="Jumlah / Qty" className="flex-1 p-4 text-sm font-bold border-none bg-gray-50 rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 transition-all" />
                                                <Button
                                                    className="h-14 px-6 rounded-2xl"
                                                    onClick={() => {
                                                        const id = parseInt((document.getElementById('ing-select') as HTMLSelectElement).value);
                                                        const amt = parseFloat((document.getElementById('ing-amount') as HTMLInputElement).value);
                                                        if (!id || !amt) return toast.error('Lengkapi data bahan');

                                                        const newRecipe = [...(selectedProduct.recipe || []), { ingredientId: id, amount: amt }];
                                                        const updated = { ...selectedProduct, recipe: newRecipe };
                                                        setProducts(products.map(p => p.id === updated.id ? updated : p));
                                                        setSelectedProduct(updated);

                                                        (document.getElementById('ing-amount') as HTMLInputElement).value = '';
                                                        toast.success('Bahan ditambahkan');
                                                    }}
                                                >
                                                    <Plus className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-primary/5 rounded-[40px] p-10 flex flex-col justify-between border border-primary/10">
                                    <div className="space-y-8">
                                        <h4 className="font-black text-primary flex items-center gap-2">
                                            <Calculator className="w-5 h-5" /> Summary Harga
                                        </h4>
                                        <div className="space-y-5">
                                            <div className="flex justify-between items-center text-gray-500">
                                                <span className="text-sm font-medium">Total Biaya Bahan</span>
                                                <span className="text-lg font-black text-gray-800 font-mono">Rp {calculateHPP(selectedProduct.recipe).toLocaleString()}</span>
                                            </div>
                                            <div className="p-6 bg-white rounded-3xl border border-primary/10 shadow-sm space-y-2">
                                                <div className="flex justify-between items-center text-gray-400 text-[10px] font-black uppercase tracking-widest">
                                                    <span>Harga Jual</span>
                                                    <span>Profit Margin</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xl font-black text-primary font-mono">Rp {selectedProduct.price.toLocaleString()}</span>
                                                    <span className="text-xl font-black text-emerald-600 font-mono">Rp {(selectedProduct.price - calculateHPP(selectedProduct.recipe)).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="text-center pt-2">
                                                <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-2xl text-xs font-black uppercase tracking-widest">
                                                    Margin: {(((selectedProduct.price - calculateHPP(selectedProduct.recipe)) / selectedProduct.price) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button onClick={() => setIsRecipeOpen(false)} className="w-full h-16 rounded-[24px] bg-gray-900 hover:bg-black text-white shadow-2xl shadow-gray-200 transition-all font-black text-lg">
                                        Selesai & Simpan
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Addon Modal */}
            {isAddonOpen && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[44px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-gray-800 tracking-tight">Toping / Add-ons</h3>
                                <p className="text-sm text-gray-500 font-medium">{selectedProduct.name}</p>
                            </div>
                            <button onClick={() => setIsAddonOpen(false)} className="p-3 hover:bg-gray-100 rounded-2xl">
                                <Plus className="w-6 h-6 rotate-45 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="space-y-3 max-h-72 overflow-y-auto pr-2 -mr-2">
                                {selectedProduct.addons?.map((addon, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-5 bg-purple-50/50 rounded-[28px] border border-purple-100 group">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-purple-900">{addon.name}</span>
                                            <span className="text-xs text-purple-600 font-bold">+ Rp {addon.price.toLocaleString()}</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newAddons = selectedProduct.addons?.filter((_, i) => i !== idx);
                                                const updated = { ...selectedProduct, addons: newAddons };
                                                setProducts(products.map(p => p.id === updated.id ? updated : p));
                                                setSelectedProduct(updated);
                                            }}
                                            className="p-2.5 bg-white text-gray-300 hover:text-red-500 rounded-xl transition-all shadow-sm"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {(!selectedProduct.addons || selectedProduct.addons.length === 0) && (
                                    <div className="py-16 text-center border-2 border-dashed border-gray-100 rounded-[40px]">
                                        <Puzzle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                        <p className="text-gray-400 text-xs italic font-medium">Beri pilihan toping untuk menu ini</p>
                                    </div>
                                )}
                            </div>
                            <div className="pt-8 border-t border-gray-50 space-y-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Input Toping Baru</p>
                                <div className="space-y-3">
                                    <input id="addon-name" type="text" placeholder="Nama toping (cth: Keju)" className="w-full p-4 bg-gray-50 rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold" />
                                    <input id="addon-price" type="number" placeholder="Harga Jual Toping" className="w-full p-4 bg-gray-50 rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold" />
                                    <Button
                                        className="w-full h-14 rounded-2xl font-black mt-2"
                                        onClick={() => {
                                            const nameEl = (document.getElementById('addon-name') as HTMLInputElement);
                                            const priceEl = (document.getElementById('addon-price') as HTMLInputElement);
                                            const name = nameEl.value;
                                            const price = parseInt(priceEl.value);
                                            if (!name || isNaN(price)) return toast.error('Nama & harga wajib diisi');

                                            const newAddons = [...(selectedProduct.addons || []), { id: Date.now(), name, price }];
                                            const updated = { ...selectedProduct, addons: newAddons } as any;
                                            setProducts(products.map(p => p.id === updated.id ? updated : p));
                                            setSelectedProduct(updated);

                                            nameEl.value = '';
                                            priceEl.value = '';
                                            toast.success('Toping berhasil dibuat');
                                        }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Pasangkan Toping
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
