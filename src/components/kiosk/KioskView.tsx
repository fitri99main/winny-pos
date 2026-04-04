import { useEffect, useRef, useState } from 'react';
import { ShoppingCart, User, ChevronRight, Minus, Plus, X, Coffee, CheckCircle, Scan, Phone, CreditCard, QrCode } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { PWAInstallButton } from '../ui/PWAInstallButton';
import { QRCodeCanvas } from 'qrcode.react';


// Types
import { getAcronym } from '../../lib/utils';
interface Product {
    id: number;
    name: string;
    price: number;
    category: string;
    image_url?: string;
    stock: number;
    cost?: number;
    target?: 'Kitchen' | 'Bar' | 'Waitress';
}

interface Member {
    id: string;
    name: string;
    phone: string;
    level: 'Silver' | 'Gold' | 'Platinum';
    discount: number; // Percentage (e.g., 10 for 10%)

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
    const [step, setStep] = useState<'table' | 'member_check' | 'menu' | 'success'>('table');
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [member, setMember] = useState<Member | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(false);
    const [occupiedTables, setOccupiedTables] = useState<Set<string>>(new Set());
    const [customerName, setCustomerName] = useState('');
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(localStorage.getItem('kiosk_branch_id'));
    const [successCountdown, setSuccessCountdown] = useState(2);
    const [isUrlForcedDisplay, setIsUrlForcedDisplay] = useState(false);

    // --- OFFLINE & SYNC LOGIC ---
    const [isOnline, setIsOnline] = useState(() => {
        return localStorage.getItem('force_offline') === 'true' ? false : navigator.onLine;
    });
    const [isSyncing, setIsSyncing] = useState(false);
    const syncingRef = useRef(false);
    const submittingRef = useRef(false);
    const [pendingOrders, setPendingOrders] = useState<any[]>(() => {
        const saved = localStorage.getItem('kiosk_pending_orders');
        return saved ? JSON.parse(saved) : [];
    });
    const [storeSettings, setStoreSettings] = useState<any>(() => {
        const saved = localStorage.getItem('kiosk_store_settings');
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        const handleOnline = () => {
            const forced = localStorage.getItem('force_offline') === 'true';
            if (!forced) {
                setIsOnline(true);
                processOfflineOrders();
            }
        };
        const handleOffline = () => setIsOnline(false);

        // Listen for Force Offline Toggle
        const handleForceOffline = () => {
            const forced = localStorage.getItem('force_offline') === 'true';
            setIsOnline(!forced && navigator.onLine);
        };
        window.addEventListener('storage', handleForceOffline);
        window.addEventListener('force-offline-change', handleForceOffline);

        // Set Kiosk Mode Flag
        localStorage.setItem('app_mode', 'kiosk');

        // Check for URL Parameters (Deep Linking)
        const urlParams = new URLSearchParams(window.location.search);
        const branchParam = urlParams.get('branch_id');
        const tableParam = urlParams.get('table_no');

        if (branchParam) {
            handleSetBranch(branchParam);
        }

        if (urlParams.get('mode') === 'display') {
            setIsUrlForcedDisplay(true);
            setStep('menu');
        } else if (tableParam) {
            setSelectedTable({ id: 0, number: tableParam, status: 'Available' });
            setStep('menu');
        }

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('storage', handleForceOffline);
            window.removeEventListener('force-offline-change', handleForceOffline);
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('kiosk_pending_orders', JSON.stringify(pendingOrders));
    }, [pendingOrders]);

    // Process Sync
    const processOfflineOrders = async () => {
        if (!navigator.onLine || syncingRef.current || pendingOrders.length === 0) return;

        syncingRef.current = true;
        setIsSyncing(true);
        const toastId = toast.loading('Mensinkronisasi pesanan offline...');

        // Take a snapshot of orders to process and de-duplicate by order_no to be safe
        const ordersToSync: any[] = [];
        const seenOrderNos = new Set<string>();
        for (const o of pendingOrders) {
            if (o?.sale?.order_no && !seenOrderNos.has(o.sale.order_no)) {
                ordersToSync.push(o);
                seenOrderNos.add(o.sale.order_no);
            }
        }
        const successfulOrderIds = new Set<number>(); 

        let successCount = 0;
        let failCount = 0;

        for (const order of ordersToSync) {
            try {
                // 1. Check if Order No already exists (Idempotency)
                const { data: existingSale } = await supabase
                    .from('sales')
                    .select('id')
                    .eq('order_no', order.sale.order_no)
                    .maybeSingle();

                let saleId;
                if (existingSale) {
                    // Check if items already exist to avoid duplicating items on existing sale
                    const { count } = await supabase
                        .from('sale_items')
                        .select('id', { count: 'exact', head: true })
                        .eq('sale_id', existingSale.id);
                    
                    if (count && count > 0) {
                        console.log("[KioskView] Order and items already exist, skipping entirely:", order.sale.order_no);
                        successfulOrderIds.add(order.timestamp);
                        successCount++;
                        continue; 
                    }
                    console.log("[KioskView] Sale exists but no items, proceeding to insert items for:", order.sale.order_no);
                    saleId = existingSale.id;
                } else {
                    // 2. Create Sale Record
                    const { data, error: saleError } = await supabase
                        .from('sales')
                        .insert([order.sale])
                        .select()
                        .single();

                    if (saleError) throw saleError;
                    saleId = data.id;
                }

                // 3. Create Sale Items
                const saleItems = order.items.map((item: any) => ({
                    ...item,
                    sale_id: saleId
                }));

                const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
                if (itemsError) throw itemsError;

                // Mark success (using timestamp as unique key for offline orders)
                successfulOrderIds.add(order.timestamp);
                successCount++;

            } catch (error: any) {
                console.error("Sync failed for order", order, error);
                failCount++;
                // If it's a validation error (not network), maybe we should alert? 
                // For now, we leave it in pending to be safe, but this risks blocking queue.
            }
        }

        // Update state: Remove successful ones
        if (successCount > 0) {
            setPendingOrders(prev => prev.filter(o => !successfulOrderIds.has(o.timestamp)));
            toast.success(`${successCount} pesanan terkirim!`, { id: toastId });
        } else if (failCount > 0) {
            toast.error(`Gagal mengirim ${failCount} pesanan. Akan dicoba lagi nanti.`, { id: toastId });
        } else {
            toast.dismiss(toastId);
        }

        setIsSyncing(false);
        syncingRef.current = false;
    };

    // Auto-sync when pending orders change (and we are online)
    useEffect(() => {
        if (isOnline && pendingOrders.length > 0) {
            // Debounce slightly to allow state to settle
            const timer = setTimeout(() => {
                processOfflineOrders();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, pendingOrders.length]); // depend on length to trigger when new added
    // --- END OFFLINE LOGIC ---

    // Wrapper to save to local storage
    const handleSetBranch = (id: string) => {
        setSelectedBranchId(id);
        localStorage.setItem('kiosk_branch_id', id);
    };

    // Initial Data Fetch
    useEffect(() => {
        if (selectedBranchId) {
            fetchOccupancy();
            fetchTables();
            fetchProducts(); // Refetch products when branch changes
            fetchStoreSettings();
        }
    }, [selectedBranchId]);

    const fetchStoreSettings = async () => {
        const { data } = await supabase.from('store_settings').select('*').eq('id', 1).single();
        if (data) {
            setStoreSettings(data);
            localStorage.setItem('kiosk_store_settings', JSON.stringify(data));
        }
    };

    // Initial Data Fetch
    useEffect(() => {
        // fetchProducts(); // Removed: Handled by branch effect
        fetchBranches();

        // Realtime Subscription (Best effort)
        const subscription = supabase
            .channel('kiosk_occupancy')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
                fetchOccupancy(); // This will use the current selectedBranchId from state closure? careful.
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Polling Effect
    useEffect(() => {
        if (!selectedBranchId) return;
        const intervalId = setInterval(fetchOccupancy, 5000);
        return () => clearInterval(intervalId);
    }, [selectedBranchId]);

    const fetchOccupancy = async () => {
        if (!selectedBranchId) return;

        try {
            const { data, error } = await supabase
                .from('sales')
                .select('table_no')
                .eq('branch_id', selectedBranchId) // Filter by branch!
                .in('status', ['Unpaid', 'Pending'])
                .not('table_no', 'is', null);

            if (error) {
                console.error('Error fetching occupancy:', error);
                return;
            }

            if (data) {
                const occupied = new Set(data.map((item: any) => String(item.table_no)));
                setOccupiedTables(occupied);
            }
        } catch (error) {
            console.error('Exception fetching occupancy:', error);
        }
    };

    const fetchProducts = async () => {
        if (!selectedBranchId) return;
        
        // Parallel fetch for speed
        const [productsRes, categoriesRes] = await Promise.all([
            supabase.from('products').select('*').eq('branch_id', selectedBranchId).order('sort_order', { ascending: true }),
            supabase.from('categories').select('name').order('sort_order')
        ]);

        if (productsRes.data) {
            setProducts(productsRes.data);
            
            if (categoriesRes.data && categoriesRes.data.length > 0) {
                const orderedCats = Array.from(new Set(categoriesRes.data.map(c => c.name)));
                setCategories(['All', ...orderedCats]);
            } else {
                const cats = Array.from(new Set(productsRes.data.map(p => p.category || 'Other')));
                setCategories(['All', ...cats]);
            }
        } else {
            setProducts([]);
            setCategories(['All']);
        }
    };

    const fetchTables = async () => {
        if (!selectedBranchId) return;
        const { data } = await supabase
            .from('tables')
            .select('*')
            .eq('branch_id', selectedBranchId)
            .order('number', { ascending: true });
        if (data) setTables(data);
    };

    const fetchBranches = async () => {
        const { data } = await supabase.from('branches').select('*').order('id');
        if (data && data.length > 0) {
            setBranches(data);
            const savedBranch = localStorage.getItem('kiosk_branch_id');
            if (savedBranch && data.find(b => String(b.id) === savedBranch)) {
                setSelectedBranchId(savedBranch);
            } else {
                setSelectedBranchId(String(data[0].id));
            }
        }
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

    const handleSuccessCheckout = (msg?: string) => {
        setSuccessCountdown(2);
        setStep('success');
        if (msg) toast.success(msg);
        setLoading(false);
    };

    // Auto-reset Effect for Success Step
    useEffect(() => {
        let timer: any;
        if (step === 'success') {
            timer = setInterval(() => {
                setSuccessCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        // Reset all state
                        setStep('table');
                        setCart([]);
                        setSelectedTable(null);
                        setMember(null);
                        setCustomerName('');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [step]);

    const handleCheckout = async () => {
        if (submittingRef.current || !selectedTable || cart.length === 0) return;

        if (!selectedBranchId) {
            toast.error('Data Cabang belum dimuat. Mohon tunggu sebentar atau muat ulang halaman.');
            fetchBranches();
            return;
        }

        submittingRef.current = true;
        setLoading(true);

        // Prepare Data
        let finalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let discountAmount = 0;
        if (member) {
            discountAmount = Math.round(finalAmount * (member.discount / 100));
            finalAmount -= discountAmount;
        }

        const offlinePrefix = storeSettings?.offline_invoice_prefix || 'OFF';
        const salePayload = {
            order_no: `${offlinePrefix}-${Date.now()}`,
            date: new Date().toISOString(),
            total_amount: finalAmount,
            payment_method: 'Pay at Cashier',
            status: 'Unpaid',
            waiter_name: 'Self-Service Kiosk',
            table_no: selectedTable.number,
            customer_name: member ? `${member.name} (${member.level})` : (customerName || 'Pelanggan Kiosk'),
            branch_id: selectedBranchId,
            discount: discountAmount,
            notes: member ? `Member: ${member.name} (${member.phone}) - ${member.discount}% Off` : undefined
        };

        const saleItemsPayload = cart.map(item => ({
            product_id: item.id,
            product_name: item.name,
            quantity: item.quantity,
            price: item.price,
            cost: item.cost || 0,
            target: item.target || 'Waitress' // Persist target
        }));

        const saveOffline = () => {
            const offlineOrder = {
                sale: salePayload,
                items: saleItemsPayload,
                timestamp: Date.now()
            };
            setPendingOrders(prev => {
                const exists = prev.some(o => o.sale.order_no === salePayload.order_no);
                if (exists) return prev;
                return [...prev, offlineOrder];
            });
        };

        // 1. Check Explicit Offline Mode
        if (!isOnline) {
            saveOffline();
            handleSuccessCheckout("Mode Offline: Pesanan disimpan & akan dikirim saat online.");
            return;
        }

        try {
            // 2. Try Online Submission
            const { data: saleData, error: saleError } = await supabase
                .from('sales')
                .insert([salePayload])
                .select()
                .single();

            if (saleError) throw saleError;

            const saleItems = saleItemsPayload.map(item => ({
                ...item,
                sale_id: saleData.id
            }));

            const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
            if (itemsError) throw itemsError;

            handleSuccessCheckout();

        } catch (error: any) {
            console.error('Checkout error details:', error);

            // 3. Fallback if Network Error detected during request
            if (error.message && (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('connection'))) {
                saveOffline();
                handleSuccessCheckout("Jaringan tidak stabil. Pesanan disimpan offline.");
                return;
            }

            const detail = error.details || error.hint || '';
            toast.error('Gagal membuat pesanan: ' + error.message + (detail ? ` (${detail})` : ''));
            setLoading(false);
        } finally {
            submittingRef.current = false;
        }
    };

    // --- RENDER STEPS ---

    if (step === 'table') {
        return (
            <div className="h-screen w-full bg-gray-50 px-4 py-10 md:px-10 md:py-20 flex flex-col items-center justify-start overflow-y-auto">
                <div className="max-w-7xl w-full text-center">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Winny Pangeran Natakusuma</h1>

                    <div className="flex justify-center mb-4">
                        <PWAInstallButton />
                    </div>

                    {/* Branch Selector */}
                    <div className="flex justify-center mb-6">
                        <select
                            value={selectedBranchId || ''}
                            onChange={(e) => {
                                setSelectedBranchId(e.target.value);
                                setCart([]); // Clear cart on branch change to avoid mixed stock
                                setStep('table'); // Reset step
                            }}
                            className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 shadow-sm"
                        >
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    📍 {branch.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <p className="text-gray-500 mb-8 md:mb-12 text-sm md:text-lg">Silakan pilih meja Anda untuk memulai pesanan</p>
                    
                    {/* Scan to Order QR Card */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-12">
                        <div className="bg-white p-6 rounded-3xl border-2 border-primary/10 shadow-xl shadow-primary/5 flex flex-col items-center gap-4 max-w-sm w-full">
                            <div className="text-center">
                                <h3 className="font-bold text-gray-800">Antri Panjang?</h3>
                                <p className="text-[10px] text-gray-500">Scan QR ini untuk pesan langsung dari HP Anda</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <QRCodeCanvas 
                                    value={`${window.location.origin}/kiosk?branch_id=${selectedBranchId}`}
                                    size={140}
                                    level="H"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-primary font-bold text-xs">
                                <Scan className="w-4 h-4" />
                                <span>Scan & Pesan Mandiri</span>
                            </div>
                        </div>

                        <div className="hidden md:block h-32 w-[1px] bg-gray-200" />

                        <div className="text-left hidden md:block max-w-xs">
                            <h4 className="font-bold text-gray-700 mb-2">Cara Pesan:</h4>
                            <ul className="text-xs text-gray-500 space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">1</span>
                                    <span>Pilih nomor meja di bawah ini atau scan QR di samping.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">2</span>
                                    <span>Pilih menu favorit Anda dan tambahkan ke keranjang.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">3</span>
                                    <span>Klik Checkout dan bayar di kasir saat pesanan tiba.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 pb-20">
                        {tables.map(table => {
                            const isOccupied = occupiedTables.has(table.number) || table.status === 'Occupied';
                            return (
                                <button
                                    key={table.id}
                                    disabled={isOccupied}
                                    onClick={() => {
                                        setSelectedTable(table);
                                        setStep('member_check');
                                    }}
                                    className={`
                                    p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 flex flex-col items-center gap-2 md:gap-3 transition-all
                                    ${isOccupied
                                            ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                                            : 'bg-white border-gray-200 hover:border-primary hover:shadow-xl cursor-pointer scale-100 hover:scale-105 active:scale-95'
                                        }
                                `}
                                >
                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg font-bold
                                    ${isOccupied ? 'bg-gray-200 text-gray-400' : 'bg-primary/10 text-primary'}
                                `}>
                                        {table.number}
                                    </div>
                                    <span className="font-bold text-gray-700 text-xs md:text-sm">{isOccupied ? 'Terisi' : 'Kosong'}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'member_check') {
        return (
            <MemberCheckView
                onSkip={() => {
                    setMember(null);
                    setStep('menu');
                }}
                onMemberVerified={(m) => {
                    setMember(m);
                    toast.success(`Selamat datang, ${m.name}! Diskon member ${m.discount}% aktif.`);
                    setStep('menu');
                }}
            />
        );
    }

    if (step === 'success') {
        return (
            <div className="min-h-screen bg-green-500 flex flex-col items-center justify-center text-white p-10 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-full flex items-center justify-center mb-6 md:mb-8 shadow-2xl">
                    <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-green-500" />
                </div>
                <h1 className="text-3xl md:text-5xl font-bold mb-4">Pesanan Diterima!</h1>
                <p className="text-lg md:text-2xl opacity-90">Mohon tunggu sebentar, kami sedang menyiapkan pesanan Anda.</p>
                
                <button
                    onClick={() => {
                        if ((window as any)._kioskResetTimer) clearTimeout((window as any)._kioskResetTimer);
                        setStep('table');
                        setCart([]);
                        setSelectedTable(null);
                        setMember(null);
                        setCustomerName('');
                    }}
                    className="mt-10 bg-white text-green-600 px-8 py-3 rounded-full font-bold text-lg shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                    Pesan Lagi Sekarang
                </button>

                <div className="mt-8 text-2xl md:text-3xl font-black opacity-90 scale-110 animate-pulse">
                    {successCountdown}
                </div>
                <div className="mt-2 text-xs md:text-sm opacity-75">
                    Kembali otomatis dalam {successCountdown} detik...
                </div>
            </div>
        );
    }

    const isDisplayOnly = storeSettings?.kiosk_display_mode || isUrlForcedDisplay;
    const selfOrderUrl = `${window.location.origin}/kiosk?branch_id=${selectedBranchId}&table_no=${selectedTable?.number}`;

    // MENU STEP
    // Safety check: if no table selected, go back (unless in display-only mode)
    if (step === 'menu' && !selectedTable && !isDisplayOnly) {
        setStep('table');
        return null;
    }

    const filteredProducts = activeCategory === 'All'
        ? products
        : products.filter(p => p.category === activeCategory);

    const subTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = member ? Math.round(subTotal * (member.discount / 100)) : 0;
    const cartTotal = subTotal - discountAmount;

    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const showCart = cart.length > 0 && !isDisplayOnly;

    return (
        // Layout: Fixed Fullscreen for Mobile Scrolling
        <div className="fixed inset-0 w-full bg-gray-50 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white shadow-sm px-4 py-3 md:px-6 md:py-4 flex items-center justify-between shrink-0 z-20">
                <div className="flex items-center gap-3 md:gap-4">
                    <button onClick={() => setStep('table')} className="p-2 hover:bg-gray-100 rounded-full">
                        <ChevronRight className="w-5 h-5 md:w-6 md:h-6 rotate-180" />
                    </button>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-gray-800">Meja {selectedTable?.number}</h1>
                        <p className="text-xs text-gray-500 hidden md:block">Silakan pilih menu kesukaanmu</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <PWAInstallButton />
                    {pendingOrders.length > 0 && (
                        <button
                            onClick={processOfflineOrders}
                            disabled={!isOnline || isSyncing}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSyncing ? 'bg-blue-100 text-blue-700' :
                                !isOnline ? 'bg-orange-100 text-orange-700' :
                                    'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 cursor-pointer'
                                }`}
                        >
                            {isSyncing ? (
                                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            ) : !isOnline ? (
                                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                            ) : (
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            )}
                            {isSyncing ? 'Sending...' : !isOnline ? `${pendingOrders.length} Offline` : `${pendingOrders.length} Pending`}
                        </button>
                    )}
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm md:text-base">
                        Win
                    </div>
                    <button
                        onClick={() => {
                            if (confirm('Keluar dari Mode Kiosk?')) {
                                localStorage.removeItem('app_mode');
                                window.location.href = '/';
                            }
                        }}
                        className="text-[10px] text-gray-400 hover:text-primary transition-colors opacity-20 hover:opacity-100 uppercase tracking-widest font-bold px-1"
                    >
                        Exit
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0 bg-gray-50/50">

                {/* Left Sidebar: Categories (Desktop/Tablet) */}
                <aside className="hidden md:flex flex-col w-[180px] lg:w-[220px] bg-white border-r border-gray-100 overflow-y-auto p-4 gap-2 z-10 shrink-0 h-full">
                    <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-2 px-2">Menu Kategori</h3>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`
                                w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between group
                                ${activeCategory === cat
                                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                    : 'bg-transparent text-gray-600 hover:bg-gray-50 hover:text-primary'
                                }
                            `}
                        >
                            <span>{cat}</span>
                            {activeCategory === cat && <ChevronRight className="w-4 h-4" />}
                        </button>
                    ))}
                </aside>

                {/* Product Grid Area */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide touch-pan-y w-full">
                    {/* Mobile Categories (Horizontal Scroll) - Visible only on mobile/small tablet */}
                    <div className="md:hidden flex gap-2 md:gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`
                                    px-4 md:px-6 py-2 md:py-3 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all
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

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 lg:gap-4 pb-24 lg:pb-0">
                        {filteredProducts.map(product => (
                            <div key={product.id} className="bg-white rounded-lg md:rounded-xl p-1.5 md:p-2 shadow-sm hover:shadow-md transition-all border border-transparent hover:border-primary/20 flex flex-col gap-1.5 group">
                                <div className="aspect-[4/3] rounded-lg md:rounded-xl bg-gray-100 overflow-hidden relative">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-primary/5">
                                            <span className="text-2xl font-black text-primary/40 font-mono tracking-tighter">
                                                {getAcronym(product.name)}
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => !isDisplayOnly && handleAddToCart(product)}
                                        className={`absolute bottom-1.5 right-1.5 md:bottom-2 md:right-2 w-7 h-7 md:w-9 md:h-9 lg:w-10 lg:h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-800 transition-colors border border-gray-100 ${isDisplayOnly ? 'opacity-0 scale-0 pointer-events-none' : 'hover:bg-primary hover:text-white'}`}
                                    >
                                        <Plus className="w-4 h-4 md:w-5 h-5" />
                                    </button>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 line-clamp-2 text-sm md:text-base leading-tight mb-1">{product.name}</h3>
                                    <p className="text-primary font-bold text-sm md:text-base lg:text-lg">Rp {product.price.toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isDisplayOnly && (
                        <div className="absolute bottom-8 right-8 z-50 bg-white p-6 rounded-3xl shadow-2xl border border-indigo-100 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-[280px]">
                            <div className="bg-indigo-50 p-4 rounded-2xl w-full flex flex-col items-center gap-3">
                                <QRCodeCanvas 
                                    value={selfOrderUrl} 
                                    size={180}
                                    level="H"
                                    includeMargin={true}
                                    imageSettings={{
                                        src: storeSettings?.receipt_logo_url || '',
                                        x: undefined,
                                        y: undefined,
                                        height: 30,
                                        width: 30,
                                        excavate: true,
                                    }}
                                />
                                <div className="text-center">
                                    <p className="font-bold text-indigo-900 text-sm">Scan untuk Pesan</p>
                                    <p className="text-[10px] text-indigo-500">Pesan dari HP Anda lebih praktis!</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50/50 px-4 py-2 rounded-full w-full justify-center">
                                <Scan className="w-4 h-4" />
                                Meja {selectedTable?.number}
                            </div>
                        </div>
                    )}
                </main>

                {/* Cart Sidebar (Fixed Bottom Sheet on Mobile/Tablet, Sidebar on Desktop) */}
                {showCart && (
                    <div className="w-full md:w-[300px] lg:w-[400px] xl:w-[450px] bg-white border-t md:border-t-0 md:border-l border-gray-100 shadow-[0_-5px_25px_-5px_rgba(0,0,0,0.1)] lg:shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom md:slide-in-from-right duration-300 max-h-[85vh] md:max-h-full">
                        <div className="p-3 lg:p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 cursor-pointer md:cursor-default"
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                        >
                            <h2 className="font-bold text-base lg:text-lg flex items-center gap-2">
                                <ShoppingCart className="w-4 h-4 lg:w-5 lg:h-5" /> Keranjang
                            </h2>
                            <span className="bg-primary text-white text-[10px] lg:text-xs font-bold px-2 py-1 rounded-full">{cartCount} Items</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 min-h-0 touch-pan-y overscroll-contain">
                            {cart.map(item => (
                                <div key={item.id} className="flex gap-3 items-center">
                                    <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                        {item.image_url && <img src={item.image_url} className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-800 text-xs lg:text-sm truncate">{item.name}</h4>
                                        <p className="text-[10px] lg:text-xs text-gray-500">Rp {item.price.toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2 lg:gap-3 bg-gray-50 rounded-lg p-1.5">
                                        <button onClick={() => handleUpdateQuantity(item.id, -1)} className="w-7 h-7 lg:w-9 lg:h-9 flex items-center justify-center bg-white rounded-md shadow-sm hover:text-red-500 active:scale-95 transition-all"><Minus className="w-4 h-4 lg:w-5 lg:h-5" /></button>
                                        <span className="text-sm lg:text-base font-bold w-6 text-center">{item.quantity}</span>
                                        <button onClick={() => handleUpdateQuantity(item.id, 1)} className="w-7 h-7 lg:w-9 lg:h-9 flex items-center justify-center bg-white rounded-md shadow-sm hover:text-green-500 active:scale-95 transition-all"><Plus className="w-4 h-4 lg:w-5 lg:h-5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 lg:p-6 border-t border-gray-100 bg-gray-50">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-500 text-xs lg:text-base">Subtotal</span>
                                <span className="text-sm lg:text-base font-medium text-gray-800">Rp {subTotal.toLocaleString()}</span>
                            </div>
                            {member && (
                                <div className="flex justify-between items-center mb-1 text-green-600">
                                    <span className="text-xs lg:text-base flex items-center gap-1"><User className="w-3 h-3" /> Member ({member.level})</span>
                                    <span className="text-sm lg:text-base font-medium">-Rp {discountAmount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center mb-2 lg:mb-4 pt-2 border-t border-gray-200">
                                <span className="text-gray-800 font-bold text-sm lg:text-lg">Total Pembayaran</span>
                                <span className="text-lg lg:text-2xl font-bold text-primary">Rp {cartTotal.toLocaleString()}</span>
                            </div>

                            <div className="mb-2 lg:mb-4">
                                <label className="block text-[10px] lg:text-sm font-medium text-gray-700 mb-1">Nama Pemesan {member && '(Member)'}</label>
                                {member ? (
                                    <div className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-green-200 bg-green-50 rounded-xl flex items-center gap-2 text-green-800 font-medium">
                                        <CheckCircle className="w-4 h-4" />
                                        {member.name}
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Masukkan nama Anda..."
                                        className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-xs lg:text-sm"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                    />
                                )}
                            </div>
                            <button
                                onClick={handleCheckout}
                                disabled={loading}
                                className="w-full bg-primary text-white py-3 lg:py-4 rounded-xl font-bold text-sm lg:text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? 'Memproses...' : 'Pesan Sekarang'}
                                {!loading && <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// --- SUB COMPONENTS ---

// MemberCheckView now searches Supabase
function MemberCheckView({ onSkip, onMemberVerified }: { onSkip: () => void, onMemberVerified: (m: Member) => void }) {
    const [phone, setPhone] = useState('');
    const [scanError, setScanError] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Start Scanner when `isScanning` is true
    useEffect(() => {
        if (isScanning && !scannerRef.current) {
            const html5QrCode = new Html5Qrcode("reader");
            scannerRef.current = html5QrCode;

            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    // Success callback
                    handleScan(decodedText);
                },
                (errorMessage) => {
                    // Error callback (ignore for now as it fires on every frame no QR is found)
                }
            ).catch(err => {
                console.error("Error starting scanner", err);
                setScanError("Kamera tidak dapat diakses.");
                setIsScanning(false);
            });
        }

        return () => {
            // Cleanup handled by ref check
            if (scannerRef.current) {
                scannerRef.current.stop().catch(err => console.error(err));
                scannerRef.current = null;
            }
        };
    }, [isScanning]);

    const handleCheckPhone = async () => {
        // Search by phone in contacts
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('phone', phone)
            .eq('type', 'Customer')
            .maybeSingle();

        if (data) {
            const m: Member = {
                id: String(data.id),
                name: data.name,
                phone: data.phone,
                level: data.tier || 'Regular',
                discount: data.tier === 'Platinum' ? 15 : data.tier === 'Gold' ? 10 : data.tier === 'Silver' ? 5 : 0
            };
            onMemberVerified(m);
        } else {
            toast.error('Member tidak ditemukan!');
        }
    };

    const handleScan = async (decodedText: string) => {
        // Search by member_id or phone from QR
        // QR content could be raw ID or JSON. Assuming just string ID for now as per QRCard.

        // 1. Try to find by member_id
        let { data, error } = await supabase
            .from('contacts')
            .select('*')
            .or(`member_id.eq.${decodedText},phone.eq.${decodedText}`)
            .eq('type', 'Customer')
            .maybeSingle();

        if (data) {
            const m: Member = {
                id: String(data.id),
                name: data.name,
                phone: data.phone,
                level: data.tier || 'Regular',
                discount: data.tier === 'Platinum' ? 15 : data.tier === 'Gold' ? 10 : data.tier === 'Silver' ? 5 : 0
            };

            if (scannerRef.current) {
                await scannerRef.current.stop();
                scannerRef.current = null;
            }
            onMemberVerified(m);
        } else {
            // Not found
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white max-w-md md:max-w-3xl w-full rounded-3xl shadow-2xl p-6 md:p-10 text-center animate-in zoom-in duration-300">

                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
                    <User className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                    Member Login
                </h2>
                <p className="text-gray-500 mb-8 md:text-lg">Dapatkan poin & diskon khusus member!</p>

                <div className="flex flex-col md:flex-row md:items-stretch gap-6 md:gap-10">

                    {/* Left: QR Scanner */}
                    <div className="flex-1 flex flex-col justify-center">
                        {isScanning ? (
                            <div className="relative overflow-hidden rounded-2xl bg-black aspect-square shadow-inner">
                                <div id="reader" className="w-full h-full"></div>
                                <button
                                    onClick={() => setIsScanning(false)}
                                    className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 backdrop-blur-sm transition-all"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                                <div className="absolute inset-0 border-2 border-primary/50 pointer-events-none rounded-2xl"></div>
                                <div className="absolute top-0 left-0 w-full h-1 bg-primary/80 shadow-[0_0_15px_rgba(var(--primary),1)] animate-[scan_2s_ease-in-out_infinite]"></div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsScanning(true)}
                                className="w-full h-full min-h-[200px] md:min-h-[250px] bg-gray-900 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl group"
                            >
                                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                    <Scan className="w-8 h-8" />
                                </div>
                                <span className="text-lg">Scan QR Member</span>
                            </button>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="relative flex md:flex-col items-center justify-center py-2 md:py-0">
                        <div className="flex-grow border-t md:border-t-0 md:border-l-2 border-dashed border-gray-200 w-full md:w-0 md:h-full"></div>
                        <span className="flex-shrink-0 mx-4 md:mx-0 md:my-4 text-gray-400 text-sm font-bold bg-white p-2">ATAU</span>
                        <div className="flex-grow border-t md:border-t-0 md:border-l-2 border-dashed border-gray-200 w-full md:w-0 md:h-full"></div>
                    </div>

                    {/* Right: Phone Input */}
                    <div className="flex-1 flex flex-col justify-center gap-4">
                        <div className="text-left">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Input Nomor HP</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Phone className="h-6 w-6 text-gray-400" />
                                </div>
                                <input
                                    type="tel"
                                    className="block w-full pl-12 pr-4 py-4 md:py-5 border-2 border-gray-100 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-lg transition-all"
                                    placeholder="08xxx"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCheckPhone()}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleCheckPhone}
                            disabled={!phone}
                            className="w-full py-4 md:py-5 bg-primary text-white font-bold text-lg rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none transition-all"
                        >
                            Cek Member
                        </button>

                        <div className="mt-4 pt-6 border-t border-gray-100 pb-2">
                            <button
                                onClick={onSkip}
                                className="w-full py-3 text-gray-400 hover:text-gray-600 font-medium flex items-center justify-center gap-2 transition-colors hover:bg-gray-50 rounded-lg"
                            >
                                Lewati, Lanjut sebagai Tamu <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

// Add CSS keyframes for scan animation if not exists (Tailwind config might not have it)
// We'll rely on global css or simple style injection if needed, but for now standard classes.
