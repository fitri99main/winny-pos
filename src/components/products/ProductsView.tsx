import { useState } from 'react';
import { Package, Tags, Scale, Ticket, Plus, Search, Edit, Trash2, Filter, ChefHat, Info, Calculator, Puzzle, Settings2, X, Check, Coffee, Barcode, Printer, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { getAcronym } from '../../lib/utils';
import { printerService } from '../../lib/PrinterService';
import { ImageStorageService } from '../../lib/ImageStorageService';

// --- Types & Interfaces ---

export interface Product {
    id: number; // Changed to number for consistency
    code: string;
    name: string;
    category: string;
    brand: string;
    unit: string;
    price: number;
    cost: number;
    is_taxed?: boolean;
    is_stock_ready?: boolean;
    stock: number;
    min_stock?: number;
    image_url?: string;
    branch_id?: number | string;
    target?: 'Kitchen' | 'Bar';
    sort_order?: number;
    recipe?: RecipeItem[];
    addons?: Addon[];
    is_sellable?: boolean;
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
    sort_order?: number;
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
    onProductCRUD: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>;
    onCategoryCRUD: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>;
    onUnitCRUD: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>;
    onBrandCRUD: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>;
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
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printQty, setPrintQty] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [formTab, setFormTab] = useState<'info' | 'pricing'>('info');
    const [isAutoSKU, setIsAutoSKU] = useState(true);
    const [isStockReady, setIsStockReady] = useState(true);
    const [editingRecipeIdx, setEditingRecipeIdx] = useState<number | null>(null);


    // --- Generic Handlers ---

    // --- Helper Functions ---
    const generateNextSKU = (prefix = 'P') => {
        const existingCodes = products.map(p => p.code).filter(c => c && c.startsWith(prefix));
        if (existingCodes.length === 0) return `${prefix}001`;

        const maxNum = existingCodes.reduce((max, code) => {
            const num = parseInt(code.replace(prefix, ''));
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);

        return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    };

    const handleOpenForm = (data: any = {}) => {
        const isNew = !data.id;
        
        // Reset states for the form
        setFormTab('info');
        setIsFormOpen(true);
        
        if (activeTab === 'products') {
            // Determine stock status for editing
            const isStockReadySaved = data.is_stock_ready !== false; // Default true
            setIsStockReady(isStockReadySaved);
            setIsAutoSKU(isNew); 

            // Set form data for products
            if (isNew) {
                const nextCode = generateNextSKU();
                setFormData({
                    code: generateNextSKU(),
                    name: '',
                    is_sellable: true,
                    is_taxed: true,
                    is_stock_ready: true,
                    target: 'Kitchen',
                    stock: 0,
                    min_stock: 5,
                    category: '',
                    unit: '',
                    brand: '',
                    price: 0,
                    cost: 0
                });
            } else {
                setFormData({
                    ...data,
                    min_stock: data.min_stock ?? 5
                });
            }
        } else {
            // Master data (Category, Unit, Brand) only needs minimal fields
            if (isNew) {
                const initialData: any = { name: '', description: '' };
                if (activeTab === 'units') initialData.abbreviation = '';
                setFormData(initialData);
            } else {
                setFormData(data);
            }
        }
    };

    const handleDelete = (id: number, type: 'product' | 'category' | 'unit' | 'brand') => {
        const msg = type === 'product' 
            ? 'Yakin ingin menghapus produk ini? Jika produk sudah pernah terjual, maka produk akan diarsipkan (disembunyikan dari kasir) demi keamanan data.'
            : 'Yakin ingin menghapus data ini?';
            
        if (!confirm(msg)) return;

        if (type === 'product') onProductCRUD('delete', { id });
        if (type === 'category') onCategoryCRUD('delete', { id });
        if (type === 'unit') onUnitCRUD('delete', { id });
        if (type === 'brand') onBrandCRUD('delete', { id });
    };

    const calculateHPP = (recipe?: RecipeItem[]) => {
        if (!recipe || !Array.isArray(recipe) || recipe.length === 0) return 0;
        return recipe.reduce((total, item) => {
            const ingredient = ingredients.find(i => i.id === item.ingredientId);
            const cost = (ingredient?.cost_per_unit || 0) * (item.amount || 0);
            return total + cost;
        }, 0);
    };

    const handleMoveCategory = async (category: Category, direction: 'up' | 'down') => {
        const sortedCategories = [...categories].sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id));
        const currentIndex = sortedCategories.findIndex(c => c.id === category.id);
        
        if (direction === 'up' && currentIndex === 0) return;
        if (direction === 'down' && currentIndex === sortedCategories.length - 1) return;

        const neighborIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        const neighbor = sortedCategories[neighborIndex];

        // Swap sort_order values
        let currentOrder = (category.sort_order === null || category.sort_order === undefined) ? category.id : category.sort_order;
        let neighborOrder = (neighbor.sort_order === null || neighbor.sort_order === undefined) ? neighbor.id : neighbor.sort_order;

        // Force uniqueness if they happen to be the same (unsticking)
        if (currentOrder === neighborOrder) {
            if (direction === 'up') {
                neighborOrder = Math.max(0, currentOrder - 1);
            } else {
                neighborOrder = currentOrder + 1;
            }
        }

        try {
            const { error: err1 } = await supabase
                .from('categories')
                .update({ sort_order: neighborOrder })
                .eq('id', category.id);
            if (err1) throw err1;

            const { error: err2 } = await supabase
                .from('categories')
                .update({ sort_order: currentOrder })
                .eq('id', neighbor.id);
            if (err2) throw err2;

            toast.success('Urutan kategori diperbarui');
        } catch (error: any) {
            console.error('Swap error:', error);
            toast.error('Gagal mengubah urutan: ' + error.message);
        }
    };

    const handleMoveProduct = async (product: Product, direction: 'up' | 'down') => {
        // Find visible products and sort them to match potential UI sorting
        const visibleProducts = products
            .filter(p => !currentBranchId || String(p.branch_id) === String(currentBranchId) || !p.branch_id)
            .sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id));
            
        const currentIndex = visibleProducts.findIndex(p => p.id === product.id);
        if (direction === 'up' && currentIndex === 0) return;
        if (direction === 'down' && currentIndex === visibleProducts.length - 1) return;

        const neighborIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        const neighbor = visibleProducts[neighborIndex];

        let currentOrder = (product.sort_order === null || product.sort_order === undefined) ? product.id : product.sort_order;
        let neighborOrder = (neighbor.sort_order === null || neighbor.sort_order === undefined) ? neighbor.id : neighbor.sort_order;

        // Force uniqueness if stuck
        if (currentOrder === neighborOrder) {
            if (direction === 'up') {
                neighborOrder = Math.max(0, currentOrder - 1);
            } else {
                neighborOrder = currentOrder + 1;
            }
        }

        try {
            const { error: err1 } = await supabase
                .from('products')
                .update({ sort_order: neighborOrder })
                .eq('id', product.id);
            if (err1) throw err1;

            const { error: err2 } = await supabase
                .from('products')
                .update({ sort_order: currentOrder })
                .eq('id', neighbor.id);
            if (err2) throw err2;

            toast.success('Urutan produk diperbarui');
        } catch (error: any) {
            console.error('Swap error:', error);
            toast.error('Gagal mengubah urutan produk: ' + error.message);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith('image/')) {
            return toast.error('Pilih file gambar yang valid');
        }
        try {
            setUploadingImage(true);
            
            // Use ImageStorageService to handle replacement (deletes old image automatically)
            const publicUrl = await ImageStorageService.replaceImage(formData.image_url, file);

            setFormData({ ...formData, image_url: publicUrl });
            toast.success('Gambar berhasil diperbarui');
        } catch (error: any) {
            console.error('Error uploading:', error);
            toast.error('Gagal mengunggah gambar: ' + error.message);
        } finally {
            setUploadingImage(false);
        }
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Submitting Product Form:', { activeTab, formData });
        setIsSaving(true);

        try {
            if (activeTab === 'products') {
                const product = formData as Product;
                if (!product.name || !product.code) {
                    console.warn('Validation failed: Name or Code is missing');
                    setIsSaving(false);
                    return toast.error('Nama dan Kode Produk wajib diisi');
                }

                const manualHpp = parseFloat(product.cost as any) || 0;
                const calculatedHpp = calculateHPP(product.recipe);
                
                // If there's a recipe, use it. Otherwise, use the manual cost.
                const finalHpp = (product.recipe && product.recipe.length > 0) ? calculatedHpp : manualHpp;
                const productToSave: any = { ...product, cost: finalHpp };
                
                console.log('Calling onProductCRUD with:', productToSave);

                const action = product.id ? 'update' : 'create';
                
                // Set initial sort_order for new products
                if (action === 'create') {
                    const maxOrder = products.reduce((max, p) => Math.max(max, p.sort_order || 0), 0);
                    productToSave.sort_order = maxOrder + 1;
                }
                
                await onProductCRUD(action, productToSave);
                console.log('onProductCRUD success');
                setIsFormOpen(false);
            } else {
                if (!formData.name) {
                    console.warn('Validation failed: Name is missing');
                    setIsSaving(false);
                    return toast.error('Nama wajib diisi');
                }

                const crudMap = {
                    'categories': onCategoryCRUD,
                    'units': onUnitCRUD,
                    'brands': onBrandCRUD,
                    'ingredients': () => Promise.resolve()
                };

                const handler = (crudMap as any)[activeTab];
                if (activeTab !== 'ingredients' && handler) {
                    const action = formData.id ? 'update' : 'create';
                    
                    // Cleanup payload for Supabase (Remove non-existent columns)
                    const cleanPayload: any = { name: formData.name };
                    
                    if (activeTab === 'categories' || activeTab === 'brands') {
                        cleanPayload.description = formData.description || '';
                        // Set initial sort_order for new categories
                        if (activeTab === 'categories' && action === 'create') {
                            const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order || 0), 0);
                            cleanPayload.sort_order = maxOrder + 1;
                        }
                    } else if (activeTab === 'units') {
                        cleanPayload.abbreviation = formData.abbreviation || '';
                    }
                    
                    if (formData.id) cleanPayload.id = formData.id;
                    
                    console.log(`Calling ${activeTab} handler with clean payload:`, cleanPayload);
                    await handler(action, cleanPayload);
                    console.log(`${activeTab} handler success`);
                    setIsFormOpen(false);
                    setFormData({});
                }
            }
        } catch (error: any) {
            console.error('Submit error:', error);
            toast.error('Gagal menyimpan data: ' + (error.message || 'Error tidak dikenal'));
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrintBarcode = async () => {
        if (!selectedProduct) return;
        try {
            for (let i = 0; i < printQty; i++) {
                await printerService.printBarcode(selectedProduct.code);
                // Tiny delay for printer buffer stability
                if (printQty > 1) await new Promise((resolve) => setTimeout(resolve, 500));
            }
            toast.success(`${printQty} Label barcode dicetak untuk ${selectedProduct.name}`);
            setIsPrintModalOpen(false);
            setPrintQty(1);
        } catch (error: any) {
            toast.error('Gagal mencetak: ' + error.message);
        }
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

                            <th className="px-4 py-5 font-bold uppercase tracking-normal text-[10px]">Kode</th>
                            <th className="px-4 py-5 font-bold uppercase tracking-normal text-[10px]">Nama Produk</th>
                            <th className="px-4 py-5 font-bold uppercase tracking-normal text-[10px]">Kategori</th>
                            <th className="px-4 py-5 font-bold uppercase tracking-normal text-[10px] text-right">Modal</th>
                            <th className="px-4 py-5 font-bold uppercase tracking-normal text-[10px] text-right">Harga</th>
                            <th className="px-4 py-5 font-bold uppercase tracking-normal text-[10px] text-right">Stok</th>
                            <th className="px-4 py-5 font-bold uppercase tracking-normal text-[10px] text-center">Status</th>
                            <th className="px-4 py-5 font-bold uppercase tracking-normal text-[10px] text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {products
                            .filter(p => !currentBranchId || String(p.branch_id) === String(currentBranchId) || !p.branch_id)
                            .sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id))
                            .map((p, idx, filtered) => {
                                const currentHPP = (p.recipe && p.recipe.length > 0) ? calculateHPP(p.recipe) : (p.cost || 0);
                                const margin = p.price - currentHPP;
                                return (
                                    <tr key={p.id} className="group hover:bg-gray-50/50 transition-all">

                                        <td className="px-4 py-5 font-mono text-gray-400 text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1">
                                                    <GripVertical className="w-4 h-4 text-gray-200 cursor-move" />
                                                    <div className="flex flex-col gap-0.5">
                                                        <button 
                                                            disabled={idx === 0}
                                                            onClick={() => handleMoveProduct(p, 'up')}
                                                            className={`p-1 rounded hover:bg-gray-100 transition-colors ${idx === 0 ? 'text-gray-100' : 'text-gray-400 hover:text-primary'}`}
                                                            title="Geser Atas"
                                                        >
                                                            <ChevronUp className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            disabled={idx === filtered.length - 1}
                                                            onClick={() => handleMoveProduct(p, 'down')}
                                                            className={`p-1 rounded hover:bg-gray-100 transition-colors ${idx === filtered.length - 1 ? 'text-gray-100' : 'text-gray-400 hover:text-primary'}`}
                                                            title="Geser Bawah"
                                                        >
                                                            <ChevronDown className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {p.code}
                                            </div>
                                        </td>
                                        <td className="px-4 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100 flex-shrink-0">
                                                    {p.image_url ? (
                                                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[10px] font-black text-gray-400 capitalize">{getAcronym(p.name)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{p.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{p.brand}</div>
                                                </div>
                                            </div>
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
                                            <span className={`font-black ${(p.stock || 0) <= (p.min_stock ?? 5) ? 'text-red-500' : 'text-gray-700'}`}>{p.stock}</span>
                                            <span className="text-gray-400 text-[10px] ml-1 uppercase font-bold">{p.unit}</span>
                                            {(p.stock || 0) <= (p.min_stock ?? 5) && (
                                                <div className="text-[9px] text-red-400 font-bold leading-none mt-0.5">LOW STOCK</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${p.is_sellable !== false ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                {p.is_sellable !== false ? 'Dijual' : 'Berhenti'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-5 flex justify-center gap-1">
                                            <button onClick={() => { setSelectedProduct(p); setIsRecipeOpen(true); }} className="p-2.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-colors" title="Atur Resep & HPP"><ChefHat className="w-4.5 h-4.5" /></button>
                                            <button onClick={() => { setSelectedProduct(p); setIsAddonOpen(true); }} className="p-2.5 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors" title="Atur Toping / Add-ons"><Puzzle className="w-4.5 h-4.5" /></button>
                                            <button onClick={() => { setSelectedProduct(p); setIsPrintModalOpen(true); }} className="p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors" title="Cetak Barcode"><Barcode className="w-4.5 h-4.5" /></button>
                                            <button onClick={() => handleOpenForm(p)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors" title="Edit"><Edit className="w-4.5 h-4.5" /></button>
                                             <button onClick={() => handleDelete(p.id, 'product')} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors" title="Hapus / Arsipkan"><Trash2 className="w-4.5 h-4.5" /></button>
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
                        <th className="px-8 py-5 font-bold uppercase tracking-normal text-[10px]">Nama {label}</th>
                        <th className="px-8 py-5 font-bold uppercase tracking-normal text-[10px]">{type === 'unit' ? 'Singkatan' : 'Deskripsi'}</th>
                        <th className="px-8 py-5 font-bold uppercase tracking-normal text-[10px] text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {[...data].sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id)).map((item, idx) => (
                        <tr key={item.id} className="group hover:bg-gray-50/50 transition-all">
                            <td className="px-8 py-5 font-bold text-gray-700">
                                <div className="flex items-center gap-3">
                                    {type === 'category' && (
                                        <div className="flex items-center gap-1 mr-3">
                                            <GripVertical className="w-4 h-4 text-gray-200 cursor-move" />
                                            <div className="flex flex-col gap-0.5">
                                                <button 
                                                    disabled={idx === 0}
                                                    onClick={() => handleMoveCategory(item, 'up')}
                                                    className={`p-1 rounded hover:bg-gray-100 transition-colors ${idx === 0 ? 'text-gray-100' : 'text-gray-400 hover:text-primary'}`}
                                                    title="Geser Atas"
                                                >
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                    disabled={idx === data.length - 1}
                                                    onClick={() => handleMoveCategory(item, 'down')}
                                                    className={`p-1 rounded hover:bg-gray-100 transition-colors ${idx === data.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-primary'}`}
                                                    title="Geser Bawah"
                                                >
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {item.name}
                                </div>
                            </td>
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
        <div className="flex flex-col h-full bg-gray-50/50 relative overflow-hidden">
            {/* Top Navigation Header */}
            <div className="w-full bg-white border-b border-gray-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 z-20 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex-shrink-0">
                <div>
                    <h2 className="text-xl font-black text-gray-800 tracking-tight">Master Data</h2>
                    <p className="text-[10px] text-gray-400 font-medium tracking-wide">Katalog Produk & Inventaris</p>
                </div>

                <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-2xl overflow-x-auto no-scrollbar border border-gray-100">
                    {[
                        { id: 'products', label: 'Daftar Produk', icon: Package },
                        { id: 'categories', label: 'Kategori', icon: Filter },
                        { id: 'units', label: 'Satuan', icon: Scale },
                        { id: 'brands', label: 'Merek', icon: Ticket },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-xs whitespace-nowrap ${activeTab === item.id
                                ? 'bg-white text-primary shadow-sm ring-1 ring-gray-100'
                                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                }`}
                        >
                            <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-primary' : 'text-gray-400'}`} />
                            {item.label}
                        </button>
                    ))}
                </div>
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
                const isProduct = activeTab === 'products';

                return (
                    <div onClick={() => setIsFormOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl shadow-[0_32px_120px_-20px_rgba(0,0,0,0.3)] w-full max-w-2xl animate-in zoom-in-95 fade-in duration-300 overflow-hidden border border-white/20 flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b bg-gray-50/50 flex-shrink-0">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-xl text-gray-800">
                                            {formData.id ? 'Edit' : 'Tambah'} {currentLabel}
                                        </h3>
                                        <p className="text-xs text-gray-500 font-medium tracking-tight">Lengkapi rincian informasi di bawah ini.</p>
                                    </div>
                                    <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                                {/* Scrollable Form Content */}
                                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                                    {isProduct ? (
                                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {/* Row 1: Image & Basic Info (Combined) */}
                                            <div className="flex gap-5">
                                                {/* Image Section (left) */}
                                                <div className="relative group shrink-0">
                                                    <div className="w-32 h-32 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-100 flex items-center justify-center overflow-hidden shadow-inner group-hover:border-primary/30 transition-all">
                                                        {uploadingImage && (
                                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                                                                <div className="w-6 h-6 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                            </div>
                                                        )}

                                                        {formData.image_url ? (
                                                            <img src={formData.image_url} alt="Product" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="text-center p-2">
                                                                <Package className="w-8 h-8 text-gray-200 mx-auto mb-1" />
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase">GAMBAR</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-xl shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all text-white border-2 border-white">
                                                        <Plus className="w-5 h-5" />
                                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                                                    </label>
                                                    {formData.image_url && (
                                                        <button 
                                                            type="button"
                                                            onClick={async () => {
                                                                if (confirm('Hapus gambar produk?')) {
                                                                    await ImageStorageService.deleteImage(formData.image_url);
                                                                    setFormData(prev => ({ ...prev, image_url: null }));
                                                                    toast.success('Gambar dihapus dari penyimpanan');
                                                                }
                                                            }}
                                                            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-lg shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-white border border-white"
                                                            title="Hapus Gambar"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Core Info (right) */}
                                                <div className="flex-1 space-y-4">
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between items-center px-1">
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SKU / Kode</label>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase">Auto</span>
                                                                <div
                                                                    onClick={() => {
                                                                        setIsAutoSKU(prev => {
                                                                            const nextAuto = !prev;
                                                                            if (nextAuto) setFormData(curr => ({ ...curr, code: generateNextSKU() }));
                                                                            return nextAuto;
                                                                        });
                                                                    }}
                                                                    className={`w-7 h-4 rounded-full transition-all cursor-pointer relative p-0.5 ${isAutoSKU ? 'bg-primary' : 'bg-gray-200'}`}
                                                                >
                                                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-all transform ${isAutoSKU ? 'translate-x-3' : 'translate-x-0'}`}></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <input 
                                                            className={`w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-mono font-bold text-xs ${isAutoSKU ? 'bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50 border-gray-100 text-gray-800'}`} 
                                                            value={formData.code || ''} 
                                                            onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                                            placeholder="P001" 
                                                            required 
                                                            readOnly={isAutoSKU}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Nama Produk</label>
                                                        <input 
                                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-bold text-gray-800 text-xs" 
                                                            value={formData.name || ''} 
                                                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                            placeholder="Exp: Kopi Gula Aren" 
                                                            required 
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 2: Master Data Links */}
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Kategori</label>
                                                    <select className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-xs font-bold text-gray-800" value={formData.category || ''} onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}>
                                                        <option value="">Pilih...</option>
                                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Merek</label>
                                                    <select className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-xs font-bold text-gray-800" value={formData.brand || ''} onChange={e => setFormData(prev => ({ ...prev, brand: e.target.value }))}>
                                                        <option value="">Pilih...</option>
                                                        {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Satuan</label>
                                                    <select className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-xs font-bold text-gray-800" value={formData.unit || ''} onChange={e => setFormData(prev => ({ ...prev, unit: e.target.value }))}>
                                                        <option value="">Pilih...</option>
                                                        {units.map(u => <option key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Row 3: Pricing & Stock Readiness */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Harga Modal (HPP) (Rp)</label>
                                                    <input 
                                                        type="number" 
                                                        className="w-full px-4 py-2.5 bg-orange-50/30 border border-orange-100 rounded-xl outline-none focus:ring-4 focus:ring-orange-500/5 transition-all font-bold text-orange-600 text-xs" 
                                                        value={formData.cost === 0 ? '0' : (formData.cost || '')} 
                                                        onChange={e => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))} 
                                                        placeholder="0" 
                                                    />
                                                    <p className="text-[8px] text-gray-400 px-1 italic">Diabaikan jika menggunakan resep.</p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Harga Jual (Rp)</label>
                                                    <input 
                                                        type="number" 
                                                        className="w-full px-4 py-2.5 bg-blue-50/30 border border-blue-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-blue-600 text-xs" 
                                                        value={formData.price === 0 ? '0' : (formData.price || '')} 
                                                        onChange={e => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))} 
                                                        placeholder="0" 
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Stok Awal</label>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsStockReady(false);
                                                                setFormData(prev => ({ ...prev, stock: 0, is_stock_ready: false }));
                                                            }}
                                                            className={`flex-1 py-2 rounded-xl border-2 transition-all font-bold text-[10px] ${!isStockReady ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                                                        >
                                                            KOSONG
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsStockReady(true);
                                                                setFormData(prev => ({ ...prev, is_stock_ready: true }));
                                                            }}
                                                            className={`flex-1 py-2 rounded-xl border-2 transition-all font-bold text-[10px] ${isStockReady ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                                                        >
                                                            READY
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 4: Stock Quantity (Conditional) & Toggles */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    {isStockReady ? (
                                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200 grid grid-cols-2 gap-3">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Jumlah Stok</label>
                                                                <input 
                                                                    type="number" 
                                                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-bold text-gray-800 text-xs" 
                                                                    value={formData.stock === 0 ? '0' : (formData.stock || '')} 
                                                                    onChange={e => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))} 
                                                                    placeholder="0" 
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Batas Minimum</label>
                                                                <input 
                                                                    type="number" 
                                                                    className="w-full px-4 py-2.5 bg-red-50/50 border border-red-100 rounded-xl outline-none focus:ring-4 focus:ring-red-500/5 transition-all font-bold text-red-600 text-xs" 
                                                                    value={formData.min_stock === 0 ? '0' : (formData.min_stock || '')} 
                                                                    onChange={e => setFormData(prev => ({ ...prev, min_stock: parseInt(e.target.value) || 0 }))} 
                                                                    placeholder="5" 
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-3.5 bg-gray-50/50 rounded-xl border border-gray-100 border-dashed flex items-center justify-center opacity-40 h-full">
                                                            <span className="text-[10px] font-bold text-gray-300">STOK TIDAK AKTIF</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-gray-600 uppercase">Jual</span>
                                                        <div
                                                            onClick={() => setFormData(prev => ({ ...prev, is_sellable: !(prev.is_sellable !== false) }))}
                                                            className={`w-10 h-5.5 rounded-full transition-all cursor-pointer relative p-1 ${formData.is_sellable !== false ? 'bg-primary' : 'bg-gray-200'}`}
                                                        >
                                                            <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all transform ${formData.is_sellable !== false ? 'translate-x-4.5' : 'translate-x-0'}`}></div>
                                                        </div>
                                                    </div>
                                                    <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-gray-600 uppercase">Pajak</span>
                                                        <div
                                                            onClick={() => setFormData(prev => ({ ...prev, is_taxed: !(prev.is_taxed !== false) }))}
                                                            className={`w-10 h-5.5 rounded-full transition-all cursor-pointer relative p-1 ${formData.is_taxed !== false ? 'bg-blue-600' : 'bg-gray-200'}`}
                                                        >
                                                            <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all transform ${formData.is_taxed !== false ? 'translate-x-4.5' : 'translate-x-0'}`}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 5: KDS Target */}
                                            <div className="space-y-2 pt-2">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Target Pesanan (KDS)</label>
                                                <div className="flex gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, target: 'Kitchen' }))}
                                                        className={`flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${(!formData.target || formData.target === 'Kitchen') ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-gray-100 text-gray-400'}`}
                                                    >
                                                        <ChefHat className="w-4 h-4" />
                                                        <span className="text-[11px] font-bold">DAPUR</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, target: 'Bar' }))}
                                                        className={`flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${formData.target === 'Bar' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-100 text-gray-400'}`}
                                                    >
                                                        <Coffee className="w-4 h-4" />
                                                        <span className="text-[11px] font-bold">BAR</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Nama {currentLabel}</label>
                                                <input
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-bold text-gray-800 text-sm"
                                                    value={formData.name || ''}
                                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                    required
                                                />
                                            </div>
                                            {activeTab === 'units' ? (
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Singkatan</label>
                                                    <input
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all font-mono font-bold text-gray-800 text-sm"
                                                        value={formData.abbreviation || ''}
                                                        onChange={e => setFormData(prev => ({ ...prev, abbreviation: e.target.value }))}
                                                        placeholder="cth: kg, pcs"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Deskripsi</label>
                                                    <textarea
                                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-semibold text-gray-800 min-h-[100px] resize-none"
                                                        value={formData.description || ''}
                                                        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                                        placeholder="Keterangan opsional..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer (Sticky) */}
                                <div className="px-6 py-5 border-t border-gray-50 bg-white flex justify-end gap-3 flex-shrink-0">
                                    <Button type="button" variant="outline" className="h-11 px-6 rounded-xl font-bold text-xs" onClick={() => setIsFormOpen(false)}>Batal</Button>
                                    <Button
                                        type="submit"
                                        disabled={isSaving || uploadingImage}
                                        className="h-11 px-8 rounded-xl font-bold text-xs shadow-lg shadow-primary/10"
                                    >
                                        {isSaving ? 'Menyimpan...' : uploadingImage ? 'Mengunggah...' : 'Simpan Data'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

            {/* Recipe Modal */}
            {isRecipeOpen && selectedProduct && (
                <div onClick={() => setIsRecipeOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[44px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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
                                            const isEditing = editingRecipeIdx === idx;
                                            return (
                                                <div key={idx} className={`flex items-center justify-between p-4 rounded-[24px] border transition-all group ${isEditing ? 'bg-primary/5 border-primary/30 ring-2 ring-primary/10' : 'bg-gray-50 border-gray-100/50'}`}>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-gray-800">{ing?.name || 'Bahan tidak ditemukan'}</span>
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{item.amount} {ing?.unit} @ Rp {(ing?.cost_per_unit ?? 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-right mr-2">
                                                            <div className="text-sm font-black text-primary">Rp {(item.amount * (ing?.cost_per_unit || 0)).toLocaleString()}</div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingRecipeIdx(idx);
                                                                    const select = document.getElementById('ing-select') as HTMLSelectElement;
                                                                    const input = document.getElementById('ing-amount') as HTMLInputElement;
                                                                    if (select) select.value = String(item.ingredientId);
                                                                    if (input) input.value = String(item.amount);
                                                                }}
                                                                className="p-2 hover:bg-primary/10 text-primary rounded-xl transition-colors"
                                                                title="Edit Jumlah"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const newRecipe = selectedProduct.recipe?.filter((_, i) => i !== idx);
                                                                    const updated = { ...selectedProduct, recipe: newRecipe };
                                                                    setProducts(products.map(p => p.id === updated.id ? updated : p));
                                                                    setSelectedProduct(updated);
                                                                    if (editingRecipeIdx === idx) setEditingRecipeIdx(null);
                                                                }}
                                                                className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-xl transition-colors"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
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
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{editingRecipeIdx !== null ? 'Update Komposisi' : 'Tambahkan Komposisi'}</p>
                                            {editingRecipeIdx !== null && (
                                                <button 
                                                    onClick={() => {
                                                        setEditingRecipeIdx(null);
                                                        (document.getElementById('ing-select') as HTMLSelectElement).value = '';
                                                        (document.getElementById('ing-amount') as HTMLInputElement).value = '';
                                                    }}
                                                    className="text-[10px] font-bold text-red-500 hover:underline uppercase tracking-widest"
                                                >
                                                    Batal Edit
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <select 
                                                id="ing-select" 
                                                disabled={editingRecipeIdx !== null}
                                                className="w-full p-4 text-sm font-bold border-none bg-gray-50 rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                                            >
                                                <option value="">Pilih bahan...</option>
                                                {ingredients.map(i => (
                                                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                                ))}
                                            </select>
                                            <div className="flex gap-2">
                                                <input id="ing-amount" type="number" step="0.01" placeholder="Jumlah / Qty" className="flex-1 p-4 text-sm font-bold border-none bg-gray-50 rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 transition-all" />
                                                <Button
                                                    className={`h-14 px-6 rounded-2xl ${editingRecipeIdx !== null ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                                                    onClick={() => {
                                                        const id = parseInt((document.getElementById('ing-select') as HTMLSelectElement).value);
                                                        const amt = parseFloat((document.getElementById('ing-amount') as HTMLInputElement).value);
                                                        if (!id || isNaN(amt)) return toast.error('Lengkapi data bahan');

                                                        let newRecipe = [...(selectedProduct.recipe || [])];
                                                        
                                                        if (editingRecipeIdx !== null) {
                                                            // Update existing
                                                            newRecipe[editingRecipeIdx] = { ingredientId: id, amount: amt };
                                                            setEditingRecipeIdx(null);
                                                            toast.success('Bahan diperbarui');
                                                        } else {
                                                            // Add new or update duplicate
                                                            const existingIdx = newRecipe.findIndex(r => r.ingredientId === id);
                                                            if (existingIdx !== -1) {
                                                                newRecipe[existingIdx].amount += amt;
                                                                toast.success('Jumlah bahan ditambahkan');
                                                            } else {
                                                                newRecipe.push({ ingredientId: id, amount: amt });
                                                                toast.success('Bahan ditambahkan');
                                                            }
                                                        }

                                                        const updated = { ...selectedProduct, recipe: newRecipe };
                                                        setProducts(products.map(p => p.id === updated.id ? updated : p));
                                                        setSelectedProduct(updated);

                                                        (document.getElementById('ing-select') as HTMLSelectElement).value = '';
                                                        (document.getElementById('ing-amount') as HTMLInputElement).value = '';
                                                    }}
                                                >
                                                    {editingRecipeIdx !== null ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
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
                                    <Button                                         onClick={async () => {
                                            setIsRecipeOpen(false);
                                            if (selectedProduct) {
                                                const updatedHpp = calculateHPP(selectedProduct.recipe);
                                                await onProductCRUD('update', { ...selectedProduct, cost: updatedHpp });
                                                toast.success('HPP Produk diperbarui');
                                            }
                                        }} 
 className="w-full h-16 rounded-[24px] bg-gray-900 hover:bg-black text-white shadow-2xl shadow-gray-200 transition-all font-black text-lg">
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
                <div onClick={() => setIsAddonOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[44px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-gray-800 tracking-tight">Toping / Add-ons</h3>
                                <p className="text-sm text-gray-500 font-medium">{selectedProduct.name}</p>
                            </div>
                            <button 
                                onClick={async () => {
                                    setIsAddonOpen(false);
                                    if (selectedProduct) {
                                        await onProductCRUD('update', selectedProduct);
                                        toast.success('Pilihan Toping disimpan');
                                    }
                                }} 
                                className="p-3 hover:bg-gray-100 rounded-2xl"
                            >
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

            {/* Print Barcode Modal */}
            {isPrintModalOpen && selectedProduct && (
                <div onClick={() => setIsPrintModalOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[44px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 tracking-tight">Cetak Barcode</h3>
                                <p className="text-xs text-gray-500 font-medium">{selectedProduct.name}</p>
                            </div>
                            <button onClick={() => setIsPrintModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-2xl">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-[32px] border border-gray-100 mb-4">
                                <Barcode className="w-12 h-12 text-gray-300 mb-3" />
                                <div className="text-center">
                                    <p className="font-mono font-bold text-gray-800 text-lg uppercase">{selectedProduct.code}</p>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">SKU Produk</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Jumlah Label (Qty)</label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setPrintQty(Math.max(1, printQty - 1))}
                                        className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-all font-bold text-xl"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        value={printQty}
                                        onChange={(e) => setPrintQty(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="flex-1 h-14 bg-white border border-gray-200 rounded-2xl text-center font-black text-xl outline-none focus:ring-4 focus:ring-primary/5"
                                    />
                                    <button
                                        onClick={() => setPrintQty(printQty + 1)}
                                        className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-all font-bold text-xl"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button
                                    onClick={handlePrintBarcode}
                                    className="w-full h-16 rounded-[24px] bg-gray-900 hover:bg-black text-white shadow-xl shadow-gray-200 transition-all font-black flex items-center justify-center gap-3"
                                >
                                    <Printer className="w-5 h-5" />
                                    Cetak Label
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
