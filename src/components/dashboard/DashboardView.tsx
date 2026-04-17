import {
    TrendingUp,
    Users,
    Package,
    ShoppingBag,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Cake,
    ChevronRight,
    DollarSign,
    Printer,
    X,
    Wifi
} from 'lucide-react';
import { ContactData } from '../contacts/ContactsView';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

import { SalesOrder, SalesReturn } from '../pos/SalesView';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';

interface CashierSessionReceipt {
    id: string;
    employee_name?: string | null;
    opened_at: string;
    closed_at?: string | null;
    starting_cash?: number | string | null;
    cash_sales?: number | string | null;
    expected_cash?: number | string | null;
    actual_cash?: number | string | null;
    difference?: number | string | null;
    status?: string | null;
}

const CLOSED_SESSION_PREVIEW_LIMIT = 15;
const CASHIER_SESSION_FETCH_LIMIT = 100;
const CASHIER_SESSION_CACHE_MS = 60_000;

export interface DashboardViewProps {
    contacts: ContactData[];
    sales: SalesOrder[];
    returns: SalesReturn[];
    products: any[];
    ingredients: any[];
    currentBranchId?: string;
    voucherStats?: { total: number; used: number; available: number };
    storeSettings?: any;
    onNavigate: (module: string, tab?: any) => void;
}

export function DashboardView({ 
    contacts = [], 
    sales = [], 
    returns = [], 
    products = [], 
    ingredients = [], 
    currentBranchId,
    voucherStats = { total: 0, used: 0, available: 0 }, 
    storeSettings,
    onNavigate 
}: DashboardViewProps) {
    const [showDailyReceipt, setShowDailyReceipt] = useState(false);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const [reportStartDate, setReportStartDate] = useState(todayStr);
    const [reportEndDate, setReportEndDate] = useState(todayStr);
    const [cashierSessions, setCashierSessions] = useState<CashierSessionReceipt[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const lastCashierSessionFetchRef = useRef<{ branchId: string; fetchedAt: number }>({
        branchId: '',
        fetchedAt: 0
    });
    const [cashProofSummary, setCashProofSummary] = useState({
        systemCash: 0,
        qrisSales: 0,
        openingCash: 0,
        totalCashSystem: 0,
        actualCashierCash: 0,
        difference: 0,
        sessionCount: 0
    });

    const parseTransactionDate = (value: string | null | undefined) => {
        if (!value) return null;

        const raw = String(value).trim();
        if (!raw) return null;

        const match = raw.match(
            /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2})(?::(\d{2}))?(?::(\d{2}))?)?/
        );

        if (match) {
            const [, year, month, day, hours = '0', minutes = '0', seconds = '0'] = match;
            return new Date(
                Number(year),
                Number(month) - 1,
                Number(day),
                Number(hours),
                Number(minutes),
                Number(seconds)
            );
        }

        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatDateOnly = (value: Date) => {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getSessionStatus = (session: CashierSessionReceipt) => String(session.status || '').trim().toLowerCase();

    const loadCashierSessions = async ({ force = false }: { force?: boolean } = {}) => {
        if (!currentBranchId) {
            setCashierSessions([]);
            setSelectedSessionId('');
            return;
        }

        const hasRecentCache =
            !force &&
            cashierSessions.length > 0 &&
            lastCashierSessionFetchRef.current.branchId === currentBranchId &&
            Date.now() - lastCashierSessionFetchRef.current.fetchedAt < CASHIER_SESSION_CACHE_MS;

        if (hasRecentCache) {
            return;
        }

        if (isLoadingSessions) {
            return;
        }

        setIsLoadingSessions(true);
        try {
            const { data, error } = await supabase
                .from('cashier_sessions')
                .select('id, employee_name, opened_at, closed_at, starting_cash, cash_sales, expected_cash, actual_cash, difference, status')
                .eq('branch_id', currentBranchId)
                .order('opened_at', { ascending: false })
                .limit(CASHIER_SESSION_FETCH_LIMIT);

            if (error) throw error;

            const sessions = (data || []).map(session => ({
                ...session,
                id: String(session.id)
            }));

            setCashierSessions(sessions);
            lastCashierSessionFetchRef.current = {
                branchId: currentBranchId,
                fetchedAt: Date.now()
            };

            const visibleSessions = [
                ...sessions.filter(session => getSessionStatus(session) === 'open'),
                ...sessions.filter(session => getSessionStatus(session) === 'closed').slice(0, CLOSED_SESSION_PREVIEW_LIMIT)
            ];

            if (visibleSessions.length === 0) {
                setSelectedSessionId('');
                return;
            }

            setSelectedSessionId(previousSessionId => {
                const hasPrevious = visibleSessions.some(session => session.id === previousSessionId);
                return hasPrevious ? previousSessionId : visibleSessions[0].id;
            });
        } catch (err) {
            console.error('Failed to fetch cashier sessions for receipt proof:', err);
            setCashierSessions([]);
            setSelectedSessionId('');
        } finally {
            setIsLoadingSessions(false);
        }
    };

    const selectedSession = useMemo(
        () => cashierSessions.find(session => String(session.id) === String(selectedSessionId)) || null,
        [cashierSessions, selectedSessionId]
    );

    const displayedCashierSessions = useMemo(() => {
        const sortedSessions = [...cashierSessions].sort(
            (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
        );
        const openSessions = sortedSessions.filter(session => getSessionStatus(session) === 'open');
        const closedSessions = sortedSessions
            .filter(session => getSessionStatus(session) === 'closed')
            .slice(0, CLOSED_SESSION_PREVIEW_LIMIT);
        const visibleSessions = [...openSessions, ...closedSessions];

        if (selectedSessionId && !visibleSessions.some(session => session.id === selectedSessionId)) {
            const selected = sortedSessions.find(session => session.id === selectedSessionId);
            if (selected) {
                return [selected, ...visibleSessions];
            }
        }

        return visibleSessions;
    }, [cashierSessions, selectedSessionId]);

    const hiddenClosedSessionsCount = Math.max(
        cashierSessions.filter(session => getSessionStatus(session) === 'closed').length -
        displayedCashierSessions.filter(session => getSessionStatus(session) === 'closed').length,
        0
    );

    const selectedSessionEnd = selectedSession?.closed_at || new Date().toISOString();

    useEffect(() => {
        if (!currentBranchId) {
            setCashierSessions([]);
            setSelectedSessionId('');
            lastCashierSessionFetchRef.current = {
                branchId: '',
                fetchedAt: 0
            };
            return;
        }

        void loadCashierSessions();
    }, [currentBranchId]);

    useEffect(() => {
        if (!showDailyReceipt || !currentBranchId) return;
        void loadCashierSessions();
    }, [showDailyReceipt, currentBranchId]);

    useEffect(() => {
        if (!selectedSession) return;

        const openedAt = new Date(selectedSession.opened_at);
        const closedAt = new Date(selectedSessionEnd);

        if (!Number.isNaN(openedAt.getTime())) {
            setReportStartDate(formatDateOnly(openedAt));
        }

        if (!Number.isNaN(closedAt.getTime())) {
            setReportEndDate(formatDateOnly(closedAt));
        }
    }, [selectedSession, selectedSessionEnd]);

    // --- Real Stats Calculation ---
    const salesToday = (sales || []).filter(s => s && s.date && s.date.startsWith(todayStr) && s.status !== 'Returned');
    const revenueToday = salesToday.reduce((sum, s) => sum + (s && s.totalAmount ? s.totalAmount : 0), 0);
    const transactionsToday = salesToday.length;

    // New Customers (mock data assumption: created at matches today? Or just count total for now)
    // Since contacts don't store "createdAt", we'll just show total active customers for now or diff
    // A better approach for "New Customers" would require a date field in ContactData.
    // For now, let's show Total Customers.
    const totalCustomers = (contacts || []).filter(c => c && c.type === 'Customer').length;

    const lowStockItems = [
        ...(products || []).filter(p => p && (p.stock || 0) <= 5),
        ...(ingredients || []).filter(i => i && (i.currentStock || 0) <= (i.minStock || 0))
    ];

    const birthdaysToday = (contacts || []).filter(c =>
        c &&
        c.type === 'Customer' &&
        c.birthday &&
        new Date(c.birthday).getMonth() === today.getMonth() &&
        new Date(c.birthday).getDate() === today.getDate()
    );

    // --- Chart Data (Last 7 Days) ---
    const chartData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        const daySales = (sales || []).filter(s => s && s.date && s.date.startsWith(dateStr) && s.status !== 'Returned');
        return {
            name: d.toLocaleDateString('id-ID', { weekday: 'short' }),
            total: daySales.reduce((sum, s) => sum + (s && s.totalAmount ? s.totalAmount : 0), 0)
        };
    });

    // --- Best Sellers Calculation ---
    const makananSales: Record<string, number> = {};
    const kopiSales: Record<string, number> = {};
    const nonKopiSales: Record<string, number> = {};
    const snackSales: Record<string, number> = {};
    const produkSales: Record<string, number> = {};

    // Keywords that indicate a coffee-based drink (check product name)
    const coffeeNameKeywords = ['kopi', 'coffee', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'macchiato', 'affogato', 'lungo', 'ristretto', 'flat white', 'cold brew', 'v60', 'vietnam drip', 'frappe'];
    const isCoffeeByName = (name: string) => coffeeNameKeywords.some(kw => name.toLowerCase().includes(kw));

    // Drink-related category keywords (other than specific kopi/non-kopi)
    const drinkCategoryKeywords = ['minum', 'teh', 'jus', 'juice', 'susu', 'milk', 'tea', 'soda', 'es ', 'ice', 'minuman', 'drink', 'beverage', 'smoothie', 'yogurt'];
    const isDrinkCategory = (cat: string) => drinkCategoryKeywords.some(kw => cat.includes(kw));

    (sales || []).forEach(sale => {
        if (sale.status !== 'Returned' && Array.isArray(sale.productDetails)) {
            sale.productDetails.forEach((item: any) => {
                if (item && item.name) {
                    const category = (item.category || '').toLowerCase();
                    const qty = item.quantity || 0;

                    if (category.includes('makan')) {
                        // Makanan
                        makananSales[item.name] = (makananSales[item.name] || 0) + qty;
                    } else if (category.includes('snack')) {
                        // Snack
                        snackSales[item.name] = (snackSales[item.name] || 0) + qty;
                    } else if (category.includes('kemasan')) {
                        // Produk Kemasan
                        produkSales[item.name] = (produkSales[item.name] || 0) + qty;
                    } else if (
                        // Category explicitly "non kopi" / "non-kopi" → always Non-Kopi
                        category.includes('non kopi') || category.includes('non-kopi')
                    ) {
                        nonKopiSales[item.name] = (nonKopiSales[item.name] || 0) + qty;
                    } else if (
                        // Category explicitly "kopi" (without "non") → always Kopi
                        category.includes('kopi') && !category.includes('non')
                    ) {
                        kopiSales[item.name] = (kopiSales[item.name] || 0) + qty;
                    } else if (
                        // Any other drink-related category → split by product name
                        isDrinkCategory(category)
                    ) {
                        if (isCoffeeByName(item.name)) {
                            kopiSales[item.name] = (kopiSales[item.name] || 0) + qty;
                        } else {
                            nonKopiSales[item.name] = (nonKopiSales[item.name] || 0) + qty;
                        }
                    } else if (
                        // Fallback: product name itself sounds like coffee/drink
                        // but no clear category — classify by name
                        isCoffeeByName(item.name)
                    ) {
                        kopiSales[item.name] = (kopiSales[item.name] || 0) + qty;
                    }
                }
            });
        }
    });

    const makananBestSellers = Object.entries(makananSales)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

    const kopiBestSellers = Object.entries(kopiSales)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

    const nonKopiBestSellers = Object.entries(nonKopiSales)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

    const snackBestSellers = Object.entries(snackSales)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

    const produkBestSellers = Object.entries(produkSales)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

    // --- Daily Receipt Calculations (Filtered by Date Range) ---
    const reportSales = useMemo(() => {
        if (selectedSession) {
            const openedAt = new Date(selectedSession.opened_at).getTime();
            const closedAt = new Date(selectedSessionEnd).getTime();

            return (sales || []).filter(s => {
                if (!s || !s.date || s.status === 'Returned') return false;
                const saleDate = parseTransactionDate(s.date);
                if (!saleDate) return false;
                const saleTime = saleDate.getTime();
                return saleTime >= openedAt && saleTime <= closedAt;
            });
        }

        return (sales || []).filter(s => {
            if (!s || !s.date || s.status === 'Returned') return false;
            const saleDate = s.date.split('T')[0];
            return saleDate >= reportStartDate && saleDate <= reportEndDate;
        });
    }, [sales, reportStartDate, reportEndDate, selectedSession, selectedSessionEnd]);

    const paymentBreakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        reportSales.forEach(s => {
            if (s.status === 'Completed') {
                counts[s.paymentMethod] = (counts[s.paymentMethod] || 0) + s.totalAmount;
            }
        });
        return Object.entries(counts).map(([name, total]) => ({ name, total }));
    }, [reportSales]);

    const paymentMethodSummary = useMemo(() => {
        return paymentBreakdown.reduce(
            (summary, item) => {
                const methodName = String(item.name || '').toLowerCase();
                const total = Number(item.total || 0);

                if (methodName.includes('tunai') || methodName.includes('cash')) {
                    summary.cash += total;
                } else if (methodName.includes('qris') || methodName.includes('digital')) {
                    summary.qris += total;
                }

                return summary;
            },
            { cash: 0, qris: 0 }
        );
    }, [paymentBreakdown]);

    useEffect(() => {
        if (!showDailyReceipt) {
            setCashProofSummary({
                systemCash: 0,
                qrisSales: 0,
                openingCash: 0,
                totalCashSystem: 0,
                actualCashierCash: 0,
                difference: 0,
                sessionCount: 0
            });
            return;
        }

        if (!selectedSession) {
            setCashProofSummary({
                systemCash: 0,
                qrisSales: 0,
                openingCash: 0,
                totalCashSystem: 0,
                actualCashierCash: 0,
                difference: 0,
                sessionCount: 0
            });
            return;
        }

        const fallbackSystemCash = paymentMethodSummary.cash;

        const openingCash = Number(selectedSession.starting_cash || 0);
        const systemCash = Number(selectedSession.cash_sales ?? fallbackSystemCash);
        const qrisSales = paymentMethodSummary.qris;
        const totalCashSystem = Number(selectedSession.expected_cash ?? (openingCash + systemCash));
        const actualCashierCash = Number(selectedSession.actual_cash || 0);
        const difference = Number(selectedSession.difference ?? (actualCashierCash - totalCashSystem));

        setCashProofSummary({
            systemCash,
            qrisSales,
            openingCash,
            totalCashSystem,
            actualCashierCash,
            difference,
            sessionCount: 1
        });
    }, [showDailyReceipt, selectedSession, paymentMethodSummary]);

    const selectedSessionLabel = selectedSession
        ? `${selectedSession.employee_name || 'Kasir'} • ${new Date(selectedSession.opened_at).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`
        : '';

    const selectedSessionRangeLabel = selectedSession
        ? `${new Date(selectedSession.opened_at).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })} s/d ${new Date(selectedSessionEnd).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`
        : '';

    const selectedSessionStatusLabel = selectedSession
        ? (getSessionStatus(selectedSession) === 'closed' ? 'Tutup' : 'Open')
        : '';

    const formatSessionOptionLabel = (session: CashierSessionReceipt) => {
        const statusLabel = getSessionStatus(session) === 'closed' ? 'Tutup' : 'Open';
        const openedAtLabel = new Date(session.opened_at).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `${session.employee_name || 'Kasir'} • ${openedAtLabel} • ${statusLabel}`;
    };

    const handlePrint = () => {
        window.print();
    };

    const stats = [
        {
            label: 'Total Penjualan Hari Ini',
            value: `Rp ${revenueToday.toLocaleString()}`,
            icon: DollarSign,
            trend: '+12.5%', // Needs historical data for real trend
            trendUp: true,
            gradient: 'from-green-500 to-emerald-600',
            shadow: 'shadow-green-500/20',
            module: 'pos',
            tab: 'history'
        },
        {
            label: 'Total Transaksi',
            value: transactionsToday.toString(),
            icon: ShoppingBag,
            trend: '+8.2%',
            trendUp: true,
            gradient: 'from-blue-500 to-indigo-600',
            shadow: 'shadow-blue-500/20',
            module: 'pos',
            tab: 'history'
        },
        {
            label: 'Total Pelanggan',
            value: totalCustomers.toString(),
            icon: Users,
            trend: '+2',
            trendUp: true,
            gradient: 'from-orange-500 to-pink-600',
            shadow: 'shadow-orange-500/20',
            module: 'contacts'
        },
        {
            label: 'Stok Menipis',
            value: lowStockItems.length.toString(),
            icon: Package,
            trend: lowStockItems.length > 0 ? 'Perlu Restock' : 'Aman',
            trendUp: lowStockItems.length === 0,
            gradient: 'from-red-500 to-rose-600',
            shadow: 'shadow-red-500/20',
            module: 'inventory'
        },
        {
            label: 'Voucher WiFi (Tersedia)',
            value: (voucherStats?.available || 0).toString(),
            icon: Wifi,
            trend: (voucherStats?.available || 0) < 10 ? 'Segera Import' : 'Stok Aman',
            trendUp: (voucherStats?.available || 0) >= 10,
            gradient: (voucherStats?.available || 0) < 10 ? 'from-red-500 to-orange-600' : 'from-cyan-500 to-blue-600',
            shadow: 'shadow-cyan-500/20',
            module: 'settings'
        },
    ];

    return (
        <div className="p-4 h-full flex flex-col gap-3 overflow-hidden">
            {/* 1. Header Section - Fixed Height */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Ringkasan</h2>
                    <p className="text-xs text-gray-500">Overview Toko</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setShowDailyReceipt(true)}
                        onMouseEnter={() => {
                            if (!cashierSessions.length && !isLoadingSessions) {
                                void loadCashierSessions();
                            }
                        }}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 h-9 rounded-xl shadow-lg shadow-orange-200 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Printer className="w-4 h-4" />
                        Cetak Laporan Hari Ini
                    </Button>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full shadow-sm border border-gray-100 text-[10px] font-bold text-gray-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        LIVE
                    </div>
                </div>
            </div>

            {/* Birthday Alert - Conditional */}
            {birthdaysToday.length > 0 && (
                <div className="bg-gradient-to-r from-pink-500/10 to-orange-500/10 border border-pink-200 rounded-xl p-2.5 flex items-center justify-between shrink-0 mb-1">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-pink-500 rounded-lg flex items-center justify-center text-white shadow-sm">
                            <Cake className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-[11px]">
                            <span className="font-bold text-gray-800">Ulang Tahun Hari Ini:</span> {birthdaysToday.map(c => c.name).join(', ')}
                        </div>
                    </div>
                </div>
            )}


            {/* 2. Stats Grid - Compact & Precise */}
            <div className="grid grid-cols-5 gap-3 shrink-0">
                {stats.map((stat, index) => (
                    <div 
                        key={index} 
                        onClick={() => stat.module && onNavigate(stat.module, stat.tab)}
                        className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2.5 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
                    >
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform`}>
                            <stat.icon className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider truncate">{stat.label}</p>
                            <h3 className="text-base font-bold text-gray-800 leading-tight">{stat.value}</h3>
                            <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded inline-block mt-0.5">{stat.trend}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* 3. Middle Section: Charts - FLEX GROW (Takes all remaining space) */}
            <div className="grid grid-cols-3 gap-3 min-h-0 flex-1">
                {/* Main Chart */}
                <div className="col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2 shrink-0">
                        <h3 className="text-sm font-bold text-gray-800">Analitik Penjualan</h3>
                        <Activity className="w-4 h-4 text-gray-300" />
                    </div>
                    <div className="flex-1 min-h-0 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={5} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(val) => `${val / 1000}k`} />
                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Best Sellers */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
                    <div className="mb-2 shrink-0 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-800">Top Produk</h3>
                        <button onClick={() => onNavigate('products')} className="text-[9px] font-bold text-primary flex items-center gap-0.5 hover:underline">
                            Lihat Semua <ChevronRight className="w-2.5 h-2.5" />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 w-full overflow-y-auto pr-1">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-4 mt-2">
                            {/* Makanan */}
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className="w-1 h-3 bg-red-500 rounded-full" />
                                    <h4 className="text-[11px] font-extrabold text-gray-800 uppercase tracking-wider">Makanan</h4>
                                </div>
                                <div className="h-24">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={makananBestSellers} margin={{ left: -10, right: 20 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 10, fill: '#374151', fontWeight: '600' }} />
                                            <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', fontSize: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={10} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Kopi */}
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className="w-1 h-3 bg-amber-700 rounded-full" />
                                    <h4 className="text-[11px] font-extrabold text-gray-800 uppercase tracking-wider">☕ Kopi</h4>
                                </div>
                                <div className="h-24">
                                    {kopiBestSellers.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart layout="vertical" data={kopiBestSellers} margin={{ left: -10, right: 20 }}>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 10, fill: '#374151', fontWeight: '600' }} />
                                                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', fontSize: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="value" fill="#92400e" radius={[0, 4, 4, 0]} barSize={10} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-[10px] text-gray-400 italic">Belum ada data</div>
                                    )}
                                </div>
                            </div>

                            {/* Non-Kopi */}
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className="w-1 h-3 bg-cyan-500 rounded-full" />
                                    <h4 className="text-[11px] font-extrabold text-gray-800 uppercase tracking-wider">🥤 Non-Kopi</h4>
                                </div>
                                <div className="h-24">
                                    {nonKopiBestSellers.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart layout="vertical" data={nonKopiBestSellers} margin={{ left: -10, right: 20 }}>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 10, fill: '#374151', fontWeight: '600' }} />
                                                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', fontSize: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={10} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-[10px] text-gray-400 italic">Belum ada data</div>
                                    )}
                                </div>
                            </div>

                            {/* Snack */}
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className="w-1 h-3 bg-orange-500 rounded-full" />
                                    <h4 className="text-[11px] font-extrabold text-gray-800 uppercase tracking-wider">Snack</h4>
                                </div>
                                <div className="h-24">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={snackBestSellers} margin={{ left: -10, right: 20 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 10, fill: '#374151', fontWeight: '600' }} />
                                            <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', fontSize: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} barSize={10} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Produk Kemasan - full width */}
                            <div className="flex flex-col col-span-2">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className="w-1 h-3 bg-purple-500 rounded-full" />
                                    <h4 className="text-[11px] font-extrabold text-gray-800 uppercase tracking-wider">Produk (Kemasan)</h4>
                                </div>
                                <div className="h-24">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={produkBestSellers} margin={{ left: -10, right: 20 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 10, fill: '#374151', fontWeight: '600' }} />
                                            <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', fontSize: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={10} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Bottom Section: Transactions - Fixed Height */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 shrink-0 h-[130px] flex flex-col">
                <div className="flex items-center justify-between mb-2 shrink-0">
                    <h3 className="text-sm font-bold text-gray-800">Transaksi Terkini</h3>
                    <button onClick={() => onNavigate('pos', 'history')} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                        Lihat Semua <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-3 overflow-hidden">
                    {sales.slice(0, 4).map((sale) => (
                        <div key={sale.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <div className="min-w-0 overflow-hidden">
                                <h5 className="font-bold text-gray-800 text-xs truncate">{sale.orderNo}</h5>
                                <span className="text-[10px] font-bold text-gray-500">Rp {(sale.totalAmount || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily Sales Receipt Modal */}
            {showDailyReceipt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl relative print:shadow-none print:max-h-none print:w-full">
                        {/* Header Modal (Hidden on Print) */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between print:hidden">
                            <div className="flex-1 mr-4">
                                <h3 className="font-bold text-gray-800">Ringkasan Tutup Kasir</h3>
                                <div className="mt-2 space-y-2">
                                    <p className="text-[11px] text-gray-500">
                                        Pilih shift kasir untuk lihat bukti kas secara ringkas.
                                    </p>
                                    <select
                                        value={selectedSessionId}
                                        onChange={(e) => setSelectedSessionId(e.target.value)}
                                        className="w-full text-[11px] px-3 py-2.5 border rounded-md focus:ring-1 focus:ring-orange-500 outline-none bg-white"
                                        disabled={(isLoadingSessions && displayedCashierSessions.length === 0) || displayedCashierSessions.length === 0}
                                    >
                                        {isLoadingSessions && displayedCashierSessions.length === 0 && <option>Memuat shift kasir...</option>}
                                        {!isLoadingSessions && displayedCashierSessions.length === 0 && <option>Tidak ada shift kasir</option>}
                                        {displayedCashierSessions.map((session) => (
                                            <option key={session.id} value={session.id}>
                                                {formatSessionOptionLabel(session)}
                                            </option>
                                        ))}
                                    </select>
                                    {hiddenClosedSessionsCount > 0 && (
                                        <div className="text-[10px] text-gray-400">
                                            Menampilkan shift aktif dan {CLOSED_SESSION_PREVIEW_LIMIT} shift tutup terbaru. {hiddenClosedSessionsCount} shift lain disembunyikan.
                                        </div>
                                    )}
                                    {isLoadingSessions && displayedCashierSessions.length > 0 && (
                                        <div className="text-[10px] text-gray-400">
                                            Memperbarui daftar kasir...
                                        </div>
                                    )}
                                    {selectedSession && (
                                        <div className="text-[11px] text-gray-500 leading-relaxed">
                                            <div>{selectedSessionLabel}</div>
                                            <div>{selectedSessionStatusLabel} • {selectedSessionRangeLabel}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowDailyReceipt(false)}>
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
                                    <h5 className="font-bold text-sm">RINGKASAN TUTUP KASIR</h5>
                                    <p className="text-[11px] font-bold">
                                        {selectedSessionRangeLabel || (
                                            reportStartDate === reportEndDate
                                                ? new Date(reportStartDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                                : `${new Date(reportStartDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })} s/d ${new Date(reportEndDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                                        )}
                                    </p>
                                    {selectedSession && (
                                        <>
                                            <p className="text-[11px]">Kasir: {selectedSession.employee_name || 'Kasir'}</p>
                                            <p className="text-[11px]">Status: {selectedSessionStatusLabel}</p>
                                        </>
                                    )}
                                    <div className="py-1">================================</div>
                                </div>

                                {/* Summary */}
                                <div className="space-y-1 text-[12px]">
                                    <div className="flex justify-between">
                                        <span className="font-bold tracking-tighter uppercase">RINGKASAN</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Total Transaksi:</span>
                                        <span>{reportSales.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Tunai:</span>
                                        <span>Rp {cashProofSummary.systemCash.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>QRis:</span>
                                        <span>Rp {cashProofSummary.qrisSales.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between font-bold border-t border-gray-200 mt-2 pt-1">
                                        <span>TOTAL BERSIH (NET):</span>
                                        <span>Rp {(reportSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0)).toLocaleString('id-ID')}</span>
                                    </div>
                                </div>

                                <div className="py-2 text-center">--------------------------------</div>

                                <div className="space-y-1 text-[12px]">
                                    <div className="flex justify-between">
                                        <span className="font-bold tracking-tighter uppercase">BUKTI FISIK KAS</span>
                                        <span>{cashProofSummary.sessionCount} sesi</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Tunai System:</span>
                                        <span>{cashProofSummary.systemCash.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Modal Awal:</span>
                                        <span>{cashProofSummary.openingCash.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between font-bold border-t border-gray-200 mt-2 pt-1">
                                        <span>Total:</span>
                                        <span>{cashProofSummary.totalCashSystem.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Kas Fisik Kasir:</span>
                                        <span>{cashProofSummary.actualCashierCash.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between font-bold">
                                        <span>Selisih:</span>
                                        <span>{cashProofSummary.difference.toLocaleString('id-ID')}</span>
                                    </div>
                                </div>

                                <div className="py-4 text-center">--------------------------------</div>

                                {/* Footer */}
                                <div className="text-center text-[10px] space-y-1 text-gray-500">
                                    <p>Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
                                    <p className="font-bold text-black border border-black p-1 inline-block mt-2">BUKTI FISIK SAH</p>
                                    
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
                            <Button variant="outline" className="flex-1" onClick={() => setShowDailyReceipt(false)}>
                                Batal
                            </Button>
                            <Button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold" onClick={handlePrint}>
                                <Printer className="w-4 h-4 mr-2" />
                                Cetak Struk Sekarang
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
