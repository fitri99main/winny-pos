import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { FileText, Download, FileSpreadsheet, Printer, TrendingUp, DollarSign, ShoppingBag, CreditCard, Search, Calendar, Filter, X, ShoppingCart, Loader2, Archive, Eye } from 'lucide-react';
import { SalesOrder, SalesReturn } from '../pos/SalesView';
import { Button } from '../ui/button';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronRight, Cake, Activity } from 'lucide-react';
import { DateRangePicker } from '../shared/DateRangePicker';

interface ReportsViewProps {
    sales: SalesOrder[];
    returns: SalesReturn[];
    purchases: any[];
    purchaseReturns: any[];
    paymentMethods: any[];
    storeSettings?: any;
    branchId?: string;
}

const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeDateValue = (value: unknown) => {
    if (!value) return '';

    if (value instanceof Date) {
        return formatDateForInput(value);
    }

    const raw = String(value).trim();
    if (!raw) return '';

    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
        return match[1];
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return formatDateForInput(parsed);
    }

    return raw;
};

export function ReportsView({ sales: initialSales, returns: initialReturns, purchases: initialPurchases = [], purchaseReturns: initialPurchaseReturns = [], paymentMethods, storeSettings, branchId }: ReportsViewProps) {
    const { role } = useAuth();
    const isAdmin = useMemo(() => {
        const r = role?.toLowerCase() || '';
        return r === 'admin' || r === 'owner' || r === 'administrator' || r === 'superadmin';
    }, [role]);

    const [realSales, setRealSales] = useState<SalesOrder[]>([]);
    const [realReturns, setRealReturns] = useState<SalesReturn[]>([]);
    const [realPurchases, setRealPurchases] = useState<any[]>([]);
    const [isLoadingRealData, setIsLoadingRealData] = useState(false);
    console.log("ReportsView - Version 1.0.2 - Filter Updated");
    const [reportType, setReportType] = useState<'sales' | 'purchases'>('sales');

    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        return formatDateForInput(new Date(date.getFullYear(), date.getMonth(), 1));
    });
    const [endDate, setEndDate] = useState(() => formatDateForInput(new Date()));
    const [methodFilter, setMethodFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(false);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [selectedCategoryPreview, setSelectedCategoryPreview] = useState<null | {
        title: string;
        subtitle: string;
        items: { name: string; value: number; category: string }[];
    }>(null);

    // [Detail Modal States]
    const [selectedSaleDetail, setSelectedSaleDetail] = useState<SalesOrder | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedOrderRecipes, setSelectedOrderRecipes] = useState<any[]>([]);
    const [loadingRecipes, setLoadingRecipes] = useState(false);
    const [showHPPInDetail, setShowHPPInDetail] = useState(false);
    
    // [Part 25] Helper for quick date selection
    const handlePreset = (type: 'today' | 'yesterday' | 'week' | 'month') => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        let start = new Date(now);
        let end = new Date(now);

        if (type === 'today') {
            // Both same
        } else if (type === 'yesterday') {
            start.setDate(now.getDate() - 1);
            end.setDate(now.getDate() - 1);
        } else if (type === 'week') {
            start.setDate(now.getDate() - 6);
        } else if (type === 'month') {
            start.setDate(now.getDate() - 29);
        }

        const formatDate = (d: Date) => formatDateForInput(d);
        setStartDate(formatDate(start));
        setEndDate(formatDate(end));
    };

    const fetchRecipesForOrder = async (sale: SalesOrder) => {
        if (!sale) return;
        
        try {
            setLoadingRecipes(true);
            setSelectedOrderRecipes([]);
            
            let finalProductIds: number[] = [];
            
            // Try to get product IDs from productDetails
            const productIds = (sale.productDetails || []).map(p => (p as any).product_id).filter(Boolean);
            
            if (productIds.length > 0) {
                finalProductIds = productIds;
            } else if (sale.id) {
                // Fallback: Fetch from sale_items table
                const { data: items } = await supabase
                    .from('sale_items')
                    .select('product_id')
                    .eq('sale_id', sale.id);
                if (items) finalProductIds = items.map(i => i.product_id).filter(Boolean);
            }

            if (finalProductIds.length === 0) {
                setLoadingRecipes(false);
                return;
            }

            const { data: recipes, error } = await supabase
                .from('product_recipes')
                .select(`
                    product_id,
                    amount,
                    ingredient:ingredient_id (
                        id,
                        name,
                        unit,
                        cost_per_unit
                    )
                `)
                .in('product_id', finalProductIds);

            if (error) throw error;
            setSelectedOrderRecipes(recipes || []);
        } catch (err) {
            console.error('Error fetching recipes:', err);
        } finally {
            setLoadingRecipes(false);
        }
    };

    const handleViewDetails = (sale: SalesOrder) => {
        setSelectedSaleDetail(sale);
        setShowDetailModal(true);
        setShowHPPInDetail(false);
        fetchRecipesForOrder(sale);
    };

    const aggregatedIngredients = useMemo(() => {
        if (!selectedSaleDetail || !selectedOrderRecipes.length) return [];
        
        const summary: Record<number, { name: string, unit: string, amount: number, cost: number }> = {};
        
        (selectedSaleDetail.productDetails || []).forEach((item: any) => {
            const recipes = selectedOrderRecipes.filter(r => r.product_id === item.product_id);
            recipes.forEach(r => {
                if (!r.ingredient) return;
                const id = r.ingredient.id;
                const qty = r.amount * (item.quantity || 0);
                const cost = (r.ingredient.cost_per_unit || 0) * qty;
                
                if (summary[id]) {
                    summary[id].amount += qty;
                    summary[id].cost += cost;
                } else {
                    summary[id] = {
                        name: r.ingredient.name,
                        unit: r.ingredient.unit,
                        amount: qty,
                        cost: cost
                    };
                }
            });
        });
        
        return Object.values(summary).sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedSaleDetail, selectedOrderRecipes]);

    const fetchRealData = async () => {
        if (!branchId || !startDate || !endDate) return;
        setIsLoadingRealData(true);
        try {
            // 1. Fetch Sales with Pagination
            let allSales: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('sales')
                    .select('*, items:sale_items(*, product:product_id(category))')
                    .eq('branch_id', branchId)
                    .gte('date', startDate + 'T00:00:00')
                    .lte('date', endDate + 'T23:59:59')
                    .order('date', { ascending: false })
                    .range(from, from + pageSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allSales = [...allSales, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else from += pageSize;
                } else {
                    hasMore = false;
                }
            }

            const formattedSales = allSales.map(s => ({
                ...s,
                orderNo: s.order_no,
                totalAmount: Number(s.total_amount || 0),
                paymentMethod: s.payment_method,
                customerName: s.customer_name,
                cashierName: s.cashier_name,
                waiterName: s.waiter_name,
                productDetails: (s.items || []).map((i: any) => ({
                    name: i.product_name,
                    quantity: i.quantity,
                    price: i.price,
                    cost: i.cost || 0,
                    category: i.product?.category
                }))
            }));
            setRealSales(formattedSales);

            // 2. Fetch Returns with Pagination
            let allReturns: any[] = [];
            let retFrom = 0;
            let retHasMore = true;

            while (retHasMore) {
                const { data: retPage, error: retError } = await supabase
                    .from('sales_returns')
                    .select('*')
                    .gte('date', startDate + 'T00:00:00')
                    .lte('date', endDate + 'T23:59:59')
                    .range(retFrom, retFrom + pageSize - 1);
                
                if (retError) throw retError;

                if (retPage && retPage.length > 0) {
                    allReturns = [...allReturns, ...retPage];
                    if (retPage.length < pageSize) retHasMore = false;
                    else retFrom += pageSize;
                } else {
                    retHasMore = false;
                }
            }
            setRealReturns(allReturns.map(r => ({
                ...r,
                refundAmount: Number(r.refund_amount || 0)
            })));

            // 3. Fetch Purchases with Pagination
            let allPurchases: any[] = [];
            let purFrom = 0;
            let purHasMore = true;

            while (purHasMore) {
                const { data: purPage, error: purError } = await supabase
                    .from('purchases')
                    .select('*')
                    .eq('branch_id', branchId)
                    .gte('date', startDate + 'T00:00:00')
                    .lte('date', endDate + 'T23:59:59')
                    .range(purFrom, purFrom + pageSize - 1);
                
                if (purError) throw purError;

                if (purPage && purPage.length > 0) {
                    allPurchases = [...allPurchases, ...purPage];
                    if (purPage.length < pageSize) purHasMore = false;
                    else purFrom += pageSize;
                } else {
                    purHasMore = false;
                }
            }
            setRealPurchases(allPurchases);

        } catch (err) {
            console.error('Error fetching real data:', err);
            toast.error('Gagal mengambil data lengkap');
        } finally {
            setIsLoadingRealData(false);
        }
    };

    useEffect(() => {
        fetchRealData();
    }, [startDate, endDate, branchId]);

    const filteredSales = useMemo(() => {
        return realSales.filter(s => {
            const matchesSearch = s.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.cashierName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.waiterName || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesMethod = methodFilter === 'All' || s.paymentMethod === methodFilter;

            return matchesSearch && matchesMethod;
        });
    }, [realSales, searchQuery, methodFilter]);

    const filteredReturns = useMemo(() => {
        return realReturns;
    }, [realReturns]);

    const filteredPurchases = useMemo(() => {
        return realPurchases.filter(p => {
            const matchesSearch = (p.purchase_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.supplier_name || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            return matchesSearch;
        });
    }, [realPurchases, searchQuery]);

    const isCompletedSale = (status: string) => {
        const PAID_STATUSES = ['completed', 'selesai', 'paid', 'served', 'success', 'settlement', 'capture', 'ready'];
        return PAID_STATUSES.includes((status || '').toLowerCase());
    };

    const totalSales = filteredSales.reduce((sum, s) => sum + (isCompletedSale(s.status) ? s.totalAmount : 0), 0);
    
    const totalHPP = filteredSales.reduce((sum, s) => {
        if (!isCompletedSale(s.status)) return sum;
        const saleHPP = (s.productDetails || []).reduce((iSum, item) => iSum + ((item.cost || 0) * item.quantity), 0);
        return sum + saleHPP;
    }, 0);

    const grossProfit = totalSales - totalHPP;
    const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalTransactions = filteredSales.filter(s => isCompletedSale(s.status)).length;
    const totalPurchaseTrans = filteredPurchases.length;
    const totalReturned = filteredSales.filter(s => s.status === 'Returned').length;
    const totalRefunded = filteredReturns.reduce((sum, r) => sum + r.refundAmount, 0);


    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    // Calculate Sales by Payment Method
    const salesByPaymentMethod = useMemo(() => {
        const completedSales = filteredSales.filter(s => isCompletedSale(s.status));

        const breakdown = (paymentMethods || []).map(method => {
            const methodSales = completedSales.filter(s => s.paymentMethod === method.name);
            const total = methodSales.reduce((sum, s) => sum + s.totalAmount, 0);
            return {
                name: method.name,
                type: method.type,
                count: methodSales.length,
                total
            };
        }).filter(item => item.count > 0 || item.total > 0);

        // Handle any sales with methods not in the current list (legacy or deleted)
        const knownMethodNames = (paymentMethods || []).map(m => m.name);
        const unknownSales = completedSales.filter(s => !knownMethodNames.includes(s.paymentMethod));

        if (unknownSales.length > 0) {
            const unknownTotal = unknownSales.reduce((sum, s) => sum + s.totalAmount, 0);
            breakdown.push({
                name: 'Lainnya',
                type: 'digital',
                count: unknownSales.length,
                total: unknownTotal
            });
        }

        return breakdown.sort((a, b) => b.total - a.total);
    }, [filteredSales, paymentMethods]);

    // Calculate Best Sellers by Category for Reports (Kopi & Non-Kopi separated)
    const bestSellersByCategory = useMemo(() => {
        const productCounts: Record<string, { name: string, value: number, category: string }> = {};

        filteredSales.forEach(sale => {
                        if (!isCompletedSale(sale.status)) return;

            (sale.productDetails || []).forEach(item => {
                if (!item.name) return;
                const key = item.name;
                if (!productCounts[key]) {
                    productCounts[key] = { name: item.name, value: 0, category: (item.category || '').toLowerCase() };
                }
                productCounts[key].value += item.quantity || 1;
                if (!productCounts[key].category && item.category) {
                    productCounts[key].category = item.category.toLowerCase();
                }
            });
        });

        const list = Object.values(productCounts);

        // Coffee keyword detection (by product name)
        const coffeeNameKeywords = ['kopi', 'coffee', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'macchiato', 'affogato', 'lungo', 'ristretto', 'flat white', 'cold brew', 'v60', 'vietnam drip', 'frappe'];
        const isCoffeeByName = (name: string) => coffeeNameKeywords.some(kw => name.toLowerCase().includes(kw));

        // Drink-related category keywords
        const drinkCategoryKeywords = ['minum', 'teh', 'jus', 'juice', 'susu', 'milk', 'tea', 'soda', 'es ', 'ice', 'minuman', 'drink', 'beverage', 'smoothie', 'yogurt'];
        const isDrinkCategory = (cat: string) => drinkCategoryKeywords.some(kw => cat.includes(kw));

        const sortItems = (items: typeof list) => [...items].sort((a, b) => b.value - a.value);
        const takeTop = (items: typeof list) => sortItems(items).slice(0, 5);

        const kopiItems = sortItems(list.filter(p => {
            const cat = p.category || '';
            if (cat.includes('non kopi') || cat.includes('non-kopi')) return false;
            if (cat.includes('kopi') && !cat.includes('non')) return true;
            if (isDrinkCategory(cat)) return isCoffeeByName(p.name);
            return isCoffeeByName(p.name);
        }));

        const nonKopiItems = sortItems(list.filter(p => {
            const cat = p.category || '';
            if (cat.includes('non kopi') || cat.includes('non-kopi')) return true;
            if (cat.includes('kopi') && !cat.includes('non')) return false;
            if (isDrinkCategory(cat)) return !isCoffeeByName(p.name);
            return false;
        }));

        const makananItems = sortItems(list.filter(p => (p.category || '').includes('makan')));
        const snackItems = sortItems(list.filter(p => (p.category || '').includes('snack')));
        const produkItems = sortItems(list.filter(p => p.category.includes('kemasan') || p.category.includes('produk') || p.name.toLowerCase().includes('kemasan')));

        return {
            makanan: { all: makananItems, top: takeTop(makananItems) },
            kopi: { all: kopiItems, top: takeTop(kopiItems) },
            nonKopi: { all: nonKopiItems, top: takeTop(nonKopiItems) },
            snack: { all: snackItems, top: takeTop(snackItems) },
            produk: { all: produkItems, top: takeTop(produkItems) }
        };
    }, [filteredSales]);

    const openCategoryPreview = (
        title: string,
        subtitle: string,
        items: { name: string; value: number; category: string }[]
    ) => {
        setSelectedCategoryPreview({
            title,
            subtitle,
            items
        });
    };

    const exportToExcel = () => {
        try {
            let data: any[];
            let summaryData: any[];
            let fileName: string;

            if (reportType === 'sales') {
                data = filteredSales.map(s => ({
                    'No. Invoice': s.orderNo,
                    'Tanggal': s.date,
                    'Total Amount': s.totalAmount,
                    'HPP (Modal)': (s.productDetails || []).reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0),
                    'Laba Kotor': s.totalAmount - (s.productDetails || []).reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0),
                    'Metode Pembayaran': s.paymentMethod,
                    'Status': s.status === 'Completed' ? 'Selesai' : 'Retur',
                    'Kasir': s.cashierName || s.waiterName || '-',
                    'Meja': s.tableNo || '-'
                }));

                summaryData = salesByPaymentMethod.map(m => ({
                    'Metode Pembayaran': m.name,
                    'Tipe': m.type,
                    'Jumlah Transaksi': m.count,
                    'Total Penjualan': m.total
                }));
                fileName = `Laporan_Penjualan_${new Date().toISOString().split('T')[0]}.xlsx`;
            } else {
                data = filteredPurchases.map(p => ({
                    'No. PO': p.purchase_no,
                    'Tanggal': p.date,
                    'Supplier': p.supplier_name,
                    'Total Belanja': p.total_amount,
                    'Items': p.items_count,
                    'Status': p.status
                }));

                const supplierTotals: Record<string, number> = {};
                filteredPurchases.forEach(p => {
                    supplierTotals[p.supplier_name] = (supplierTotals[p.supplier_name] || 0) + (p.total_amount || 0);
                });
                summaryData = Object.entries(supplierTotals).map(([name, total]) => ({
                    'Supplier': name,
                    'Total Belanja': total
                }));
                fileName = `Laporan_Pembelian_${new Date().toISOString().split('T')[0]}.xlsx`;
            }

            const worksheet = XLSX.utils.json_to_sheet(data);
            const summarySheet = XLSX.utils.json_to_sheet(summaryData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, reportType === 'sales' ? "Detail Penjualan" : "Detail Pembelian");
            XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

            XLSX.writeFile(workbook, fileName);
            toast.success(`Laporan ${reportType === 'sales' ? 'Excel Penjualan' : 'Excel Pembelian'} berhasil diunduh`);
        } catch (error) {
            console.error('Excel Export Error:', error);
            toast.error('Gagal mengekspor ke Excel');
        }
    };

    const exportToPDF = () => {
        try {
            const doc = new jsPDF();
            const title = reportType === 'sales' ? 'Laporan Penjualan WinPOS' : 'Laporan Pembelian WinPOS';

            // Header
            doc.setFontSize(20);
            doc.text(title, 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 30);

            // Summary
            doc.setTextColor(0);
            if (reportType === 'sales') {
                doc.text(`Total Penjualan: ${formatCurrency(totalSales)}`, 14, 40);
                doc.text(`Total Modal (HPP): ${formatCurrency(totalHPP)}`, 14, 46);
                doc.setTextColor(34, 197, 94); // Green for profit
                doc.text(`Laba Kotor: ${formatCurrency(grossProfit)} (${profitMargin.toFixed(1)}%)`, 14, 52);
                doc.setTextColor(0);
                doc.text(`Total Transaksi: ${totalTransactions}`, 14, 58);

                const tableData = filteredSales.map(s => {
                    const hpp = (s.productDetails || []).reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
                    return [
                        s.orderNo,
                        s.date.substring(0, 10),
                        s.status === 'Returned' ? 'Retur' : 'Selesai',
                        formatCurrency(s.totalAmount),
                        formatCurrency(hpp),
                        formatCurrency(s.totalAmount - hpp)
                    ];
                });

                autoTable(doc, {
                    startY: 65,
                    head: [['No. Invoice', 'Tanggal', 'Status', 'Total', 'Modal', 'Laba']],
                    body: tableData as any,
                    theme: 'striped',
                    headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
                });
            } else {
                doc.text(`Total Pembelian: ${formatCurrency(totalPurchases)}`, 14, 40);
                doc.text(`Total Transaksi PO: ${totalPurchaseTrans}`, 14, 46);

                const tableData = filteredPurchases.map(p => [
                    p.purchase_no,
                    p.date,
                    p.supplier_name,
                    formatCurrency(p.total_amount)
                ]);

                autoTable(doc, {
                    startY: 55,
                    head: [['No. PO', 'Tanggal', 'Supplier', 'Total']],
                    body: tableData as any,
                    theme: 'striped',
                    headStyles: { fillColor: [249, 115, 22] }, // Orange-500
                });
            }

            doc.save(`${title.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success(`Laporan ${reportType === 'sales' ? 'PDF Penjualan' : 'PDF Pembelian'} berhasil diunduh`);
        } catch (error) {
            console.error('PDF Export Error:', error);
            toast.error('Gagal mengekspor ke PDF');
        }
    };


    const handlePrintReceipt = () => {
        window.print();
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Laporan Keuangan</h2>
                    <div className="flex gap-2 mt-2">
                        <Button 
                            variant={reportType === 'sales' ? 'default' : 'outline'}
                            onClick={() => setReportType('sales')}
                            className="rounded-full px-6"
                        >
                            Laporan Penjualan
                        </Button>
                        <Button 
                            variant={reportType === 'purchases' ? 'default' : 'outline'}
                            onClick={() => setReportType('purchases')}
                            className="rounded-full px-6"
                        >
                            Laporan Pembelian
                        </Button>
                    </div>
                </div>
                <div className="flex gap-3">

                    <Button
                        onClick={exportToExcel}
                        variant="outline"
                        className="flex items-center gap-2 border-green-200 hover:bg-green-50 text-green-700 font-semibold rounded-xl px-5 h-12"
                    >
                        <FileSpreadsheet className="w-5 h-5" />
                        Download Excel
                    </Button>
                    <Button
                        onClick={exportToPDF}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5 h-12 shadow-lg shadow-indigo-200"
                    >
                        <FileText className="w-5 h-5" />
                        Download PDF
                    </Button>
                    <Button
                        onClick={() => setShowReceiptPreview(true)}
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-5 h-12 shadow-lg shadow-orange-200"
                    >
                        <Printer className="w-5 h-5" />
                        Cetak Struk
                    </Button>
                </div>
            </div>

            {/* [NEW] Shared Date Filter Integration */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Cari transaksi (No. Invoice / Nama Kasir / Nama Pelanggan)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium"
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
                <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 font-bold text-gray-600 cursor-pointer outline-none"
                >
                    <option value="All">Semua Metode</option>
                    {(paymentMethods || []).map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                </select>
            </div>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">{reportType === 'sales' ? 'Total Penjualan' : 'Total Pembelian'}</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(reportType === 'sales' ? totalSales : totalPurchases)}</h3>
                    <p className="text-xs text-gray-400 mt-2 font-medium">Dari data yang difilter</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-4 text-purple-600">
                        <ShoppingBag className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Total Transaksi</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{reportType === 'sales' ? totalTransactions : totalPurchaseTrans}</h3>
                    <p className="text-xs text-gray-400 mt-2 font-medium">{reportType === 'sales' ? 'Transaksi berhasil selesai' : 'Transaksi pembelian barang'}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="w-16 h-16 text-emerald-600" />
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 text-emerald-600">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Laba Kotor (Estimasi)</p>
                    <h3 className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(grossProfit)}</h3>
                    <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase">Margin {profitMargin.toFixed(1)}%</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-4 text-amber-600">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">{reportType === 'sales' ? 'Rata-rata Order' : 'Rata-rata Belanja'}</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(reportType === 'sales' ? (totalTransactions > 0 ? totalSales / totalTransactions : 0) : (totalPurchaseTrans > 0 ? totalPurchases / totalPurchaseTrans : 0))}</h3>
                    <p className="text-xs text-gray-400 mt-2 font-medium">Nilai rata-rata per transaksi</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4 text-red-600">
                        <Printer className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">{reportType === 'sales' ? 'Retur & Refund' : 'Supplier Teraktif'}</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">
                        {reportType === 'sales' ? formatCurrency(totalRefunded) : (filteredPurchases.length > 0 ? [...new Set(filteredPurchases.map(p => p.supplier_name))].length : 0)}
                    </h3>
                    <p className="text-xs text-red-500 mt-2 font-medium">
                        {reportType === 'sales' ? `${totalReturned} Transaksi diretur` : 'Jumlah supplier berbeda'}
                    </p>
                </div>
            </div>

            {/* Best Sellers Sections - 2x2 Grid */}
            {reportType === 'sales' && (
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Produk Terlaris per Kategori</h3>
                                <p className="text-xs text-gray-400">Berdasarkan kuantitas yang terjual</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* Makanan */}
                        <button
                            type="button"
                            onClick={() => openCategoryPreview('Makanan Terlaris', 'Semua produk dalam kategori makanan', bestSellersByCategory.makanan.all)}
                            className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 text-left transition-all hover:shadow-md hover:border-red-200"
                        >
                            <h4 className="text-[10px] font-bold text-red-600 uppercase mb-3 tracking-widest pl-1">🍽️ Makanan Terlaris</h4>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={bestSellersByCategory.makanan.top} margin={{ left: -20, right: 30 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 'bold' }} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="value" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={12} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="mt-3 text-[11px] font-semibold text-red-500">Klik untuk lihat semua produk</p>
                        </button>

                        {/* Kopi */}
                        <button
                            type="button"
                            onClick={() => openCategoryPreview('Kopi Terlaris', 'Semua produk kopi dalam periode filter', bestSellersByCategory.kopi.all)}
                            className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 text-left transition-all hover:shadow-md hover:border-amber-200"
                        >
                            <h4 className="text-[10px] font-bold text-amber-800 uppercase mb-3 tracking-widest pl-1">☕ Kopi Terlaris</h4>
                            <div className="h-48">
                                {bestSellersByCategory.kopi.top.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={bestSellersByCategory.kopi.top} margin={{ left: -20, right: 30 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 'bold' }} />
                                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="value" fill="#92400e" radius={[0, 6, 6, 0]} barSize={12} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center gap-2 text-amber-400">
                                        <span className="text-3xl">☕</span>
                                        <p className="text-xs font-medium">Belum ada data kopi</p>
                                    </div>
                                )}
                            </div>
                            <p className="mt-3 text-[11px] font-semibold text-amber-700">Klik untuk lihat semua produk</p>
                        </button>

                        {/* Non-Kopi */}
                        <button
                            type="button"
                            onClick={() => openCategoryPreview('Non-Kopi Terlaris', 'Semua produk non-kopi dalam periode filter', bestSellersByCategory.nonKopi.all)}
                            className="bg-cyan-50/50 p-5 rounded-2xl border border-cyan-100 text-left transition-all hover:shadow-md hover:border-cyan-200"
                        >
                            <h4 className="text-[10px] font-bold text-cyan-700 uppercase mb-3 tracking-widest pl-1">🥤 Non-Kopi Terlaris</h4>
                            <div className="h-48">
                                {bestSellersByCategory.nonKopi.top.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={bestSellersByCategory.nonKopi.top} margin={{ left: -20, right: 30 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 'bold' }} />
                                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="value" fill="#06b6d4" radius={[0, 6, 6, 0]} barSize={12} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center gap-2 text-cyan-400">
                                        <span className="text-3xl">🥤</span>
                                        <p className="text-xs font-medium">Belum ada data non-kopi</p>
                                    </div>
                                )}
                            </div>
                            <p className="mt-3 text-[11px] font-semibold text-cyan-700">Klik untuk lihat semua produk</p>
                        </button>

                        {/* Snack */}
                        <button
                            type="button"
                            onClick={() => openCategoryPreview('Snack Terlaris', 'Semua produk snack dalam periode filter', bestSellersByCategory.snack.all)}
                            className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 text-left transition-all hover:shadow-md hover:border-orange-200"
                        >
                            <h4 className="text-[10px] font-bold text-orange-600 uppercase mb-3 tracking-widest pl-1">🍟 Snack Terlaris</h4>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={bestSellersByCategory.snack.top} margin={{ left: -20, right: 30 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 'bold' }} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="value" fill="#f97316" radius={[0, 6, 6, 0]} barSize={12} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="mt-3 text-[11px] font-semibold text-orange-600">Klik untuk lihat semua produk</p>
                        </button>

                        {/* Produk - spans 2 cols on xl */}
                        <button
                            type="button"
                            onClick={() => openCategoryPreview('Produk Kemasan Terlaris', 'Semua produk kemasan dalam periode filter', bestSellersByCategory.produk.all)}
                            className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 xl:col-span-2 text-left transition-all hover:shadow-md hover:border-purple-200"
                        >
                            <h4 className="text-[10px] font-bold text-purple-600 uppercase mb-3 tracking-widest pl-1">📦 Produk Kemasan Terlaris</h4>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={bestSellersByCategory.produk.top} margin={{ left: -20, right: 30 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 'bold' }} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={12} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="mt-3 text-[11px] font-semibold text-purple-600">Klik untuk lihat semua produk</p>
                        </button>
                    </div>
                </div>
            )}


            {/* Breakdown Section */}
            {reportType === 'sales' ? (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-50 flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">Breakdown per Metode Pembayaran</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-50">
                        {salesByPaymentMethod.map((method, idx) => (
                            <div key={idx} className="p-8 space-y-2 hover:bg-gray-50/50 transition-colors">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{method.name}</p>
                                <div className="flex items-baseline gap-2">
                                    <h4 className="text-2xl font-black text-gray-800">{formatCurrency(method.total)}</h4>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                                        {method.count} Transaksi
                                    </span>
                                    <span className="text-gray-400 font-medium">
                                        {((method.total / (totalSales || 1)) * 100).toFixed(1)}% Kontribusi
                                    </span>
                                </div>
                            </div>
                        ))}
                        {salesByPaymentMethod.length === 0 && (
                            <div className="col-span-full p-12 text-center text-gray-400">
                                Belum ada data pembayaran yang tercatat
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-50 flex items-center gap-3">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                            <ShoppingCart className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">Breakdown per Supplier</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-50">
                        {(() => {
                            const supplierTotals: Record<string, number> = {};
                            filteredPurchases.forEach(p => {
                                supplierTotals[p.supplier_name] = (supplierTotals[p.supplier_name] || 0) + (p.total_amount || 0);
                            });
                            return Object.entries(supplierTotals).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([name, total], idx) => (
                                <div key={idx} className="p-8 space-y-2 hover:bg-gray-50/50 transition-colors">
                                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{name}</p>
                                    <div className="flex items-baseline gap-2">
                                        <h4 className="text-2xl font-black text-gray-800">{formatCurrency(total)}</h4>
                                    </div>
                                    <div className="text-xs text-gray-400 font-medium">
                                        {((total / (totalPurchases || 1)) * 100).toFixed(1)}% Dari total belanja
                                    </div>
                                </div>
                            ));
                        })()}
                        {filteredPurchases.length === 0 && (
                            <div className="col-span-full p-12 text-center text-gray-400">
                                Belum ada data pembelian yang tercatat
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* List Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-800 text-lg">Riwayat Transaksi</h3>
                        {filteredSales.length < realSales.length && (
                            <span className="text-xs font-bold text-primary bg-primary/5 px-2 py-1 rounded-full animate-in fade-in zoom-in duration-300">
                                Menampilkan {filteredSales.length} dari {realSales.length}
                            </span>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                <th className="px-8 py-4">{reportType === 'sales' ? 'No. Invoice' : 'No. PO'}</th>
                                <th className="px-8 py-4">Tanggal</th>
                                <th className="px-8 py-4">{reportType === 'sales' ? 'Metode' : 'Supplier'}</th>
                                <th className="px-8 py-4 text-right">Total</th>
                                <th className="px-8 py-4 text-center">Status</th>
                                <th className="px-8 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {reportType === 'sales' ? (
                                filteredSales.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <Search className="w-8 h-8 opacity-20" />
                                                <p>Tidak ada transaksi yang sesuai dengan filter</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-8 py-5 font-mono text-sm font-bold text-gray-700">{sale.orderNo}</td>
                                            <td className="px-8 py-5 text-sm text-gray-500">{sale.date.substring(0, 16)}</td>
                                            <td className="px-8 py-5">
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                                                    sale.paymentMethod.toLowerCase().includes('tunai') || sale.paymentMethod.toLowerCase().includes('cash')
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    : sale.paymentMethod.toLowerCase().includes('qris') || sale.paymentMethod.toLowerCase().includes('digital')
                                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                                    : 'bg-gray-50 text-gray-400 border border-gray-100'
                                                }`}>
                                                    {sale.paymentMethod}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right font-bold text-gray-800">{formatCurrency(sale.totalAmount)}</td>
                                            <td className="px-8 py-5 text-center">
                                                <span className={`text-[10px] font-extrabold uppercase px-2 py-1 rounded-md border ${sale.status === 'Completed'
                                                    ? 'bg-green-50 text-green-700 border-green-100'
                                                    : 'bg-red-50 text-red-700 border-red-100'
                                                    }`}>
                                                    {sale.status === 'Completed' ? 'Selesai' : 'Retur'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <button
                                                    onClick={() => handleViewDetails(sale)}
                                                    className="p-2 hover:bg-primary/5 text-primary rounded-xl transition-colors"
                                                    title="Lihat Detail"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                filteredPurchases.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <Search className="w-8 h-8 opacity-20" />
                                                <p>Tidak ada data pembelian yang sesuai</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPurchases.map((p) => (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-8 py-5 font-mono text-sm font-bold text-gray-700">{p.purchase_no}</td>
                                            <td className="px-8 py-5 text-sm text-gray-500">{p.date}</td>
                                            <td className="px-8 py-5">
                                                <span className="text-sm font-bold text-gray-700">{p.supplier_name}</span>
                                            </td>
                                            <td className="px-8 py-5 text-right font-bold text-gray-800">{formatCurrency(p.total_amount)}</td>
                                            <td className="px-8 py-5 text-center">
                                                <span className={`text-[10px] font-extrabold uppercase px-2 py-1 rounded-md border ${p.status === 'Completed'
                                                    ? 'bg-green-50 text-green-700 border-green-100'
                                                    : 'bg-orange-50 text-orange-700 border-orange-100'
                                                    }`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedCategoryPreview && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[95] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] shadow-2xl overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-800">{selectedCategoryPreview.title}</h3>
                                <p className="text-sm text-gray-500">{selectedCategoryPreview.subtitle}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Periode: {startDate || '...'} s/d {endDate || '...'}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedCategoryPreview(null)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div className="bg-gray-100 p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
                            <div className="bg-white mx-auto max-w-2xl min-h-[70vh] shadow-sm border border-gray-200 p-8">
                                <div className="border-b border-gray-200 pb-4 mb-6">
                                    <h4 className="text-2xl font-bold text-gray-900">{selectedCategoryPreview.title}</h4>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {selectedCategoryPreview.items.length} produk dalam kategori ini
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Periode laporan: {startDate || '...'} s/d {endDate || '...'}
                                    </p>
                                </div>

                                {selectedCategoryPreview.items.length === 0 ? (
                                    <div className="flex items-center justify-center min-h-[40vh] text-gray-400 text-sm">
                                        Belum ada produk pada kategori ini untuk periode filter sekarang.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedCategoryPreview.items.map((item, index) => (
                                            <div
                                                key={`${selectedCategoryPreview.title}-${item.name}-${index}`}
                                                className="flex items-center justify-between border-b border-gray-100 pb-3"
                                            >
                                                <div className="pr-4">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {index + 1}. {item.name}
                                                    </p>
                                                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                                                        {(item.category || 'tanpa kategori').replace(/-/g, ' ')}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-lg font-bold text-gray-900">{item.value}</p>
                                                    <p className="text-xs text-gray-400">Qty Terjual</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Preview Modal */}
            {showReceiptPreview && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl relative print:shadow-none print:max-h-none print:w-full">
                        {/* Header Modal (Hidden on Print) */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between print:hidden">
                            <div>
                                <h3 className="font-bold text-gray-800">Pratinjau Struk Laporan</h3>
                                <p className="text-xs text-gray-500">Tampilan thermal 58mm/80mm</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowReceiptPreview(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Receipt Content */}
                        <div className="flex-1 overflow-y-auto p-8 print:p-0 bg-gray-100 print:bg-white scrollbar-thin scrollbar-thumb-gray-200">
                            <div className="bg-white p-8 shadow-sm mx-auto print:shadow-none print:p-0 print:m-0" 
                                 style={{ 
                                     width: storeSettings?.receipt_paper_width === '80mm' ? '400px' : '300px',
                                     maxWidth: '100%',
                                     fontFamily: 'monospace'
                                 }}>
                                
                                {/* Receipt Header */}
                                <div className="text-center space-y-1 mb-4">
                                    {storeSettings?.show_logo && storeSettings?.receipt_logo_url && (
                                        <div className="flex justify-center mb-3">
                                            <img src={storeSettings.receipt_logo_url} alt="Logo" className="w-16 h-16 object-contain grayscale" />
                                        </div>
                                    )}
                                    <h4 className="font-bold text-lg uppercase">{(storeSettings?.receipt_header || 'WINNY POS').toUpperCase()}</h4>
                                    {storeSettings?.address && <p className="text-[11px] whitespace-pre-line">{storeSettings.address}</p>}
                                    {storeSettings?.phone && <p className="text-[11px]">Telp: {storeSettings.phone}</p>}
                                    <div className="py-2">--------------------------------</div>
                                    <h5 className="font-bold text-sm">LAPORAN PENJUALAN</h5>
                                    <p className="text-[11px]">
                                        {startDate || endDate 
                                            ? `${startDate || '...'} s/d ${endDate || '...'}` 
                                            : 'Semua Periode'}
                                    </p>
                                    <div className="py-1">================================</div>
                                </div>

                                {/* Summary */}
                                <div className="space-y-1 text-[12px]">
                                    <div className="flex justify-between">
                                        <span className="font-bold tracking-tighter uppercase">RINGKASAN</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Total Transaksi:</span>
                                        <span>{totalTransactions}</span>
                                    </div>
                                    <div className="flex justify-between font-bold">
                                        <span>TOTAL NET:</span>
                                        <span>{totalSales.toLocaleString('id-ID')}</span>
                                    </div>
                                    
                                    {/* Conditional Tax/Discount */}
                                    {(storeSettings?.show_tax_on_report !== false) && (
                                        <div className="flex justify-between">
                                            <span>Total Pajak:</span>
                                            <span>{filteredSales.reduce((acc, s) => acc + (s.tax || 0), 0).toLocaleString('id-ID')}</span>
                                        </div>
                                    )}
                                    {(storeSettings?.show_discount_on_report !== false) && (
                                        <div className="flex justify-between">
                                            <span>Total Diskon:</span>
                                            <span>-{filteredSales.reduce((acc, s) => acc + (s.discount || 0), 0).toLocaleString('id-ID')}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="py-2 text-center">--------------------------------</div>

                                {/* Payment Breakdown */}
                                <div className="space-y-1 text-[12px]">
                                    <span className="font-bold tracking-tighter uppercase">PEMBAYARAN</span>
                                    {storeSettings?.show_qris_on_report === false ? (
                                        <>
                                            <div className="flex justify-between">
                                                <span>TUNAI:</span>
                                                <span>{(salesByPaymentMethod.find(m => m.name.toUpperCase() === 'TUNAI' || m.name.toUpperCase() === 'CASH')?.total || 0).toLocaleString('id-ID')}</span>
                                            </div>
                                            {(() => {
                                                const cashTotal = salesByPaymentMethod.find(m => m.name.toUpperCase() === 'TUNAI' || m.name.toUpperCase() === 'CASH')?.total || 0;
                                                const totalAll = salesByPaymentMethod.reduce((acc, m) => acc + m.total, 0);
                                                const nonCash = totalAll - cashTotal;
                                                return nonCash > 0 && (
                                                    <div className="flex justify-between">
                                                        <span>NON-TUNAI:</span>
                                                        <span>{nonCash.toLocaleString('id-ID')}</span>
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    ) : (
                                        salesByPaymentMethod.map((m, idx) => (
                                            <div key={idx} className="flex justify-between">
                                                <span>{m.name}:</span>
                                                <span>{m.total.toLocaleString('id-ID')}</span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="py-4 text-center">--------------------------------</div>

                                {/* Footer */}
                                <div className="text-center text-[10px] space-y-1 text-gray-500">
                                    <p>Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
                                    <p>Status Data: Sinkron</p>
                                    
                                    {storeSettings?.receipt_footer && (
                                        <div className="pt-4 text-black text-[11px]">
                                            <p>{storeSettings.receipt_footer}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Print Control (Hidden on Print) */}
                        <div className="p-6 border-t border-gray-100 flex gap-3 print:hidden">
                            <Button variant="outline" className="flex-1" onClick={() => setShowReceiptPreview(false)}>
                                Batal
                            </Button>
                            <Button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white" onClick={handlePrintReceipt}>
                                <Printer className="w-4 h-4 mr-2" />
                                Cetak Sekarang
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {/* Transaction Detail Modal */}
            {showDetailModal && selectedSaleDetail && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="font-bold text-gray-800">Detail Transaksi</h3>
                                <p className="text-xs font-mono text-blue-600">{selectedSaleDetail.orderNo}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowDetailModal(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-gray-100 max-h-[70vh]">
                            <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                                <div>
                                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-1">Tanggal</p>
                                    <p className="font-bold text-gray-700">{selectedSaleDetail.date.substring(0, 16).replace('T', ' ')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-1">Kasir</p>
                                    <p className="font-bold text-gray-700">{selectedSaleDetail.cashierName || '-'}</p>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] border-b border-gray-50 pb-2">Item Pesanan</p>
                                {(selectedSaleDetail.productDetails || []).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center font-bold text-gray-400 text-xs">
                                                {item.quantity}x
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-700">{item.name}</p>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.category}</p>
                                            </div>
                                        </div>
                                        <p className="font-bold text-gray-800">Rp {(item.price * item.quantity).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Aggregated Ingredients Section */}
                            {isAdmin && (aggregatedIngredients.length > 0 || loadingRecipes) && (
                                <div className="mb-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Archive className="w-4 h-4 text-blue-600" />
                                            <h4 className="text-xs font-black text-blue-800 uppercase tracking-widest">Estimasi Bahan Baku</h4>
                                            {loadingRecipes && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
                                        </div>
                                        <button 
                                            onClick={() => setShowHPPInDetail(!showHPPInDetail)}
                                            className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${showHPPInDetail ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200'}`}
                                        >
                                            {showHPPInDetail ? 'Sembunyikan HPP' : 'Lihat HPP'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {aggregatedIngredients.map((ing, i) => (
                                            <div key={i} className="bg-white/80 p-2.5 rounded-xl border border-blue-100/50 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase truncate mb-0.5" title={ing.name}>{ing.name}</p>
                                                <div className="flex items-baseline justify-between">
                                                    <p className="text-xs font-black text-blue-700">
                                                        {ing.amount % 1 === 0 ? ing.amount : ing.amount.toFixed(2)} {ing.unit}
                                                    </p>
                                                    {showHPPInDetail && (
                                                        <span className="text-[9px] font-bold text-blue-400">
                                                            Rp {ing.cost.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {showHPPInDetail && (
                                        <div className="mt-4 pt-4 border-t border-blue-100 flex justify-between items-center">
                                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">Total Estimasi HPP</span>
                                            <span className="text-sm font-black text-blue-900">
                                                Rp {aggregatedIngredients.reduce((sum, i) => sum + i.cost, 0).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!loadingRecipes && aggregatedIngredients.length === 0 && (
                                <div className="mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3">
                                    <Archive className="w-4 h-4 text-gray-300" />
                                    <p className="text-[11px] text-gray-400 font-medium italic">Resep bahan baku belum dikonfigurasi untuk transaksi ini.</p>
                                </div>
                            )}

                            <div className="space-y-2 pt-4 border-t border-gray-50">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Diskon</span>
                                    <span className="text-red-500 font-bold">- Rp {(selectedSaleDetail.discount || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Pajak</span>
                                    <span className="text-blue-500 font-bold">+ Rp {(selectedSaleDetail.tax || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="font-black text-gray-800 uppercase tracking-widest text-xs">Total Pembayaran</span>
                                    <span className="text-xl font-black text-gray-900">Rp {selectedSaleDetail.totalAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-gray-50 flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setShowDetailModal(false)}>Tutup</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
