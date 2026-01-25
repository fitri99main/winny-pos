import { useState } from 'react';
import { Package, Tags, Scale, Ticket, Plus, Search, Edit, Trash2, Filter, ChefHat, Info, Calculator, Puzzle, Settings2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

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
    ingredients: any[]; // Centralized Inventory Ingredients
    categories: Category[];
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    units: Unit[];
    setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
    brands: Brand[];
    setBrands: React.Dispatch<React.SetStateAction<Brand[]>>;
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
    setBrands
}: ProductsViewProps) {
    const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'units' | 'brands' | 'ingredients'>('products');

    // Form states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<any>({}); // Generic form data
    const [isRecipeOpen, setIsRecipeOpen] = useState(false);
    const [isAddonOpen, setIsAddonOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // --- Generic Handlers ---

    const handleOpenForm = (data: any = {}) => {
        setFormData(data);
        setIsFormOpen(true);
    };

    const handleDelete = (id: number, type: 'product' | 'category' | 'unit' | 'brand') => {
        if (!confirm('Yakin ingin menghapus data ini?')) return;

        if (type === 'product') setProducts(products.filter(p => p.id !== id));
        if (type === 'category') setCategories(categories.filter(c => c.id !== id));
        if (type === 'unit') setUnits(units.filter(u => u.id !== id));
        if (type === 'brand') setBrands(brands.filter(b => b.id !== id));

        toast.success('Data berhasil dihapus');
    };

    const calculateHPP = (recipe?: RecipeItem[]) => {
        if (!recipe || !Array.isArray(recipe) || recipe.length === 0) return 0;
        return recipe.reduce((total, item) => {
            const ingredient = ingredients.find(i => i.id === item.ingredientId);
            const cost = (ingredient?.costPerUnit || 0) * (item.amount || 0);
            return total + cost;
        }, 0);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (activeTab === 'products') {
            const product = formData as Product;
            if (!product.name || !product.code) return toast.error('Nama dan Kode Produk wajib diisi');

            const hpp = calculateHPP(product.recipe);
            const productWithHPP = { ...product, cost: hpp };

            if (product.id) {
                setProducts(products.map(p => p.id === product.id ? productWithHPP : p));
                toast.success('Produk diperbarui');
            } else {
                setProducts([{ ...productWithHPP, id: Date.now() }, ...products]);
                toast.success('Produk ditambahkan');
            }
        } else {
            const handleSimpleEntity = (
                list: any[],
                setList: (l: any[]) => void,
                item: any,
                label: string
            ) => {
                if (!item.name) return toast.error(`Nama ${label} wajib diisi`);
                if (item.id) {
                    setList(list.map(i => i.id === item.id ? item : i));
                    toast.success(`${label} diperbarui`);
                } else {
                    setList([{ ...item, id: Date.now() }, ...list]);
                    toast.success(`${label} ditambahkan`);
                }
            };

            if (activeTab === 'categories') handleSimpleEntity(categories, setCategories, formData, 'Kategori');
            if (activeTab === 'units') handleSimpleEntity(units, setUnits, formData, 'Satuan');
            if (activeTab === 'brands') handleSimpleEntity(brands, setBrands, formData, 'Merek');
        }

        setIsFormOpen(false);
        setFormData({});
    };

    // --- Renderers ---

    const renderProductsTable = () => (
        <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Cari kode atau nama produk..." className="w-full pl-12 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all" />
                </div>
                <Button onClick={() => handleOpenForm()} className="gap-2 h-12 rounded-2xl px-6"><Plus className="w-4 h-4" /> Tambah Produk</Button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50/50 text-gray-400 text-left border-b border-gray-100">
                        <tr>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Kode</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Nama Produk</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Kategori</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Modal (HPP)</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Harga Jual</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Stok</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {products.map(p => {
                            const currentHPP = calculateHPP(p.recipe);
                            const margin = p.price - currentHPP;
                            return (
                                <tr key={p.id} className="group hover:bg-gray-50/50 transition-all">
                                    <td className="px-8 py-5 font-mono text-gray-400 text-xs">{p.code}</td>
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-gray-800">{p.name}</div>
                                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{p.brand}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="px-2.5 py-1 bg-primary/5 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest ring-1 ring-primary/10">
                                            {p.category}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-orange-600">
                                        Rp {currentHPP.toLocaleString()}
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-blue-600">
                                        Rp {p.price.toLocaleString()}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <span className={`font-black ${p.stock < 10 ? 'text-red-500' : 'text-gray-700'}`}>{p.stock}</span>
                                        <span className="text-gray-400 text-[10px] ml-1 uppercase font-bold">{p.unit}</span>
                                    </td>
                                    <td className="px-8 py-5 flex justify-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="w-72 bg-white border-r border-gray-100 p-8 flex flex-col gap-3 shadow-[10px_0_30px_rgba(0,0,0,0.02)] z-20">
                <div className="mb-6">
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">Master Data</h2>
                    <p className="text-xs text-gray-400 font-medium tracking-wide">Katalog Produk & Inventaris</p>
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
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-[24px] transition-all group ${activeTab === item.id ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >
                        <div className={`p-2.5 rounded-xl transition-colors ${activeTab === item.id ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-white'}`}>
                            <item.icon className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <div className="text-sm font-black tracking-tight">{item.label}</div>
                            <div className={`text-[10px] font-medium opacity-60 ${activeTab === item.id ? 'text-white' : 'text-gray-400'}`}>{item.desc}</div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-10 overflow-y-auto">
                {activeTab === 'products' && renderProductsTable()}
                {activeTab === 'categories' && renderSimpleTable(categories, 'category', 'Kategori')}
                {activeTab === 'units' && renderSimpleTable(units, 'unit', 'Satuan')}
                {activeTab === 'brands' && renderSimpleTable(brands, 'brand', 'Merek')}
            </div>

            {/* Modal Form */}
            {isFormOpen && (() => {
                const currentLabel = activeTab === 'products' ? 'Produk' : activeTab === 'categories' ? 'Kategori' : activeTab === 'units' ? 'Satuan' : 'Merek';
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl animate-in zoom-in-95 duration-300 overflow-hidden">
                            <div className="px-10 py-8 border-b bg-gray-50/50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-black text-2xl text-gray-800 tracking-tight">
                                        {formData.id ? 'Edit Data' : 'Tambah'} {currentLabel}
                                    </h3>
                                    <p className="text-sm text-gray-500 font-medium">Lengkapi rincian informasi di bawah ini.</p>
                                </div>
                            </div>
                            <form onSubmit={handleSubmit} className="p-10 space-y-6">
                                {activeTab === 'products' ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Kode Produk (SKU)</label>
                                                <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-mono font-bold" value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: P001" required />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Nama Produk</label>
                                                <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-black" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Exp: Es Kopi Gula Aren" required />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Kategori Produk</label>
                                                <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                                    <option value="">Pilih Kategori...</option>
                                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Satuan Dasar</label>
                                                <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold" value={formData.unit || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                                                    <option value="">Pilih Satuan...</option>
                                                    {units.map(u => <option key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Merek</label>
                                                <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold" value={formData.brand || ''} onChange={e => setFormData({ ...formData, brand: e.target.value })}>
                                                    <option value="">Pilih Merek...</option>
                                                    {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Harga Jual (IDR)</label>
                                                <input type="number" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-black text-blue-600" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) })} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Stok Awal Inventaris</label>
                                            <input type="number" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-black" value={formData.stock || ''} onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Nama {currentLabel}</label>
                                            <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-bold" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                        </div>
                                        {activeTab === 'units' ? (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Singkatan Satuan</label>
                                                <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-bold" value={formData.abbreviation || ''} onChange={e => setFormData({ ...formData, abbreviation: e.target.value })} placeholder="cth: kg, L, pcs" />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Deskripsi Tambahan</label>
                                                <textarea className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm" rows={4} value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                            </div>
                                        )}
                                    </>
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
