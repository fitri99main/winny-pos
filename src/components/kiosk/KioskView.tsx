import { useState, useEffect } from 'react';
import { ShoppingCart, User, ChevronRight, Minus, Plus, X, Coffee } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

// Types
interface Product {
    id: number;
    name: string;
    price: number;
    category: string;
    image_url?: string;
    stock: number;
}

interface CartItem extends Product {
    quantity: number;
}

interface Table {
    id: number;
    number: string;
    status: string;
}

export function KioskView() {
    const [step, setStep] = useState<'table' | 'menu' | 'success'>('table');
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(false);

    // Initial Data Fetch
    useEffect(() => {
        fetchProducts();
        fetchTables();
    }, []);

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('*');
        if (data) {
            setProducts(data);
            const cats = Array.from(new Set(data.map(p => p.category || 'Other')));
            setCategories(['All', ...cats]);
        }
    };

    const fetchTables = async () => {
        // Fetch only available tables or all tables? For now all.
        const { data } = await supabase.from('tables').select('*').order('number', { ascending: true });
        if (data) setTables(data);
    };

    const handleAddToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        toast.success('Added to cart');
    };

    const handleUpdateQuantity = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, quantity: Math.max(0, item.quantity + delta) };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const handleCheckout = async () => {
        if (!selectedTable || cart.length === 0) return;
        setLoading(true);

        try {
            const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // 1. Create Sale Record
            const { data: saleData, error: saleError } = await supabase
                .from('sales')
                .insert({
                    order_no: `ORD-${Date.now()}`, // Simple ID generation
                    date: new Date().toISOString(),
                    total_amount: totalAmount,
                    payment_method: 'Pay at Cashier',
                    status: 'Pending', // Important: Pending status for Kitchen/Cashier
                    waiter_name: 'Self-Service Kiosk',
                    // We might need to store table info. 
                    // If backend doesn't have table_no column yet, we might skip or put in notes.
                    // Assuming 'order_no' can hold "Table X" or we add a note?
                    // For now let's just create the sale.
                })
                .select()
                .single();

            if (saleError) throw saleError;

            // 2. Create Sale Items
            const saleItems = cart.map(item => ({
                sale_id: saleData.id,
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                price: item.price,
                cost: 0 // Ideally fetch cost
            }));

            const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
            if (itemsError) throw itemsError;

            setStep('success');
            setTimeout(() => {
                // Reset flow after 5 seconds
                setStep('table');
                setCart([]);
                setSelectedTable(null);
            }, 5000);

        } catch (error: any) {
            toast.error('Gagal membuat pesanan: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER STEPS ---

    if (step === 'table') {
        return (
            <div className="min-h-screen bg-gray-50 p-10 flex flex-col items-center justify-center">
                <div className="max-w-4xl w-full text-center">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Selamat Datang di Winny Cafe</h1>
                    <p className="text-gray-500 mb-12 text-lg">Silakan pilih meja Anda untuk memulai pesanan</p>

                    <div className="grid grid-cols-3 md:grid-cols-5 gap-6">
                        {tables.map(table => (
                            <button
                                key={table.id}
                                disabled={table.status === 'Occupied'}
                                onClick={() => {
                                    setSelectedTable(table);
                                    setStep('menu');
                                }}
                                className={`
                                    p-8 rounded-3xl border-2 flex flex-col items-center gap-4 transition-all
                                    ${table.status === 'Occupied'
                                        ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                                        : 'bg-white border-gray-200 hover:border-primary hover:shadow-xl cursor-pointer scale-100 hover:scale-105 active:scale-95'
                                    }
                                `}
                            >
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold
                                    ${table.status === 'Occupied' ? 'bg-gray-200 text-gray-400' : 'bg-primary/10 text-primary'}
                                `}>
                                    {table.number}
                                </div>
                                <span className="font-bold text-gray-700">{table.status === 'Occupied' ? 'Terisi' : 'Kosong'}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="min-h-screen bg-green-500 flex flex-col items-center justify-center text-white p-10 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl">
                    <CheckCircle className="w-16 h-16 text-green-500" />
                </div>
                <h1 className="text-5xl font-bold mb-4">Pesanan Diterima!</h1>
                <p className="text-2xl opacity-90">Mohon tunggu sebentar, kami sedang menyiapkan pesanan Anda.</p>
                <div className="mt-12 text-sm opacity-75">
                    Layar akan kembali ke awal dalam 5 detik...
                </div>
            </div>
        );
    }

    // MENU STEP
    const filteredProducts = activeCategory === 'All'
        ? products
        : products.filter(p => p.category === activeCategory);

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">
            {/* Header */}
            <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setStep('table')} className="p-2 hover:bg-gray-100 rounded-full">
                        <ChevronRight className="w-6 h-6 rotate-180" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Meja {selectedTable?.number}</h1>
                        <p className="text-xs text-gray-500">Silakan pilih menu kesukaanmu</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                        Win
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {/* Categories */}
                    <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`
                                    px-6 py-3 rounded-full text-sm font-bold whitespace-nowrap transition-all
                                    ${activeCategory === cat
                                        ? 'bg-gray-900 text-white shadow-lg scale-105'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                    }
                                `}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-32">
                        {filteredProducts.map(product => (
                            <div key={product.id} className="bg-white rounded-3xl p-4 shadow-sm hover:shadow-md transition-all border border-transparent hover:border-primary/20 flex flex-col gap-3 group">
                                <div className="aspect-square rounded-2xl bg-gray-100 overflow-hidden relative">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <Coffee className="w-12 h-12" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => handleAddToCart(product)}
                                        className="absolute bottom-3 right-3 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-800 hover:bg-primary hover:text-white transition-colors"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 line-clamp-1">{product.name}</h3>
                                    <p className="text-primary font-bold">Rp {product.price.toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Cart Sidebar (or Bottom Sheet on Mobile) */}
                {cart.length > 0 && (
                    <div className="w-96 bg-white border-l border-gray-100 shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-300">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5" /> Keranjang
                            </h2>
                            <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">{cartCount} Items</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cart.map(item => (
                                <div key={item.id} className="flex gap-4 items-center">
                                    <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                                        {item.image_url && <img src={item.image_url} className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-800 text-sm truncate">{item.name}</h4>
                                        <p className="text-xs text-gray-500">Rp {item.price.toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1">
                                        <button onClick={() => handleUpdateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm hover:text-red-500"><Minus className="w-3 h-3" /></button>
                                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => handleUpdateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm hover:text-green-500"><Plus className="w-3 h-3" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-gray-500">Total Pembayaran</span>
                                <span className="text-2xl font-bold text-gray-800">Rp {cartTotal.toLocaleString()}</span>
                            </div>
                            <button
                                onClick={handleCheckout}
                                disabled={loading}
                                className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? 'Memproses...' : 'Pesan Sekarang'}
                                {!loading && <ChevronRight className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function CheckCircle({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    )
}
