import { useState, useEffect } from 'react';
import { History, RotateCcw, Search, FileText, CheckCircle, XCircle, X, ShoppingCart, Printer, ChevronDown, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { ContactData } from '../contacts/ContactsView';
import { PaymentModal } from './PaymentModal';
import { PaymentMethod } from '@/types/pos';
import { printerService } from '../../lib/PrinterService';
import { FingerprintAuthModal } from '../shared/FingerprintAuthModal';

export interface SalesOrder {
    id: number;
    orderNo: string;
    order_no?: string;
    date: string;
    items: number;
    productDetails: { name: string; quantity: number; price: number; isManual?: boolean }[];
    subtotal?: number;
    discount?: number;
    tax?: number;
    totalAmount: number;
    paymentMethod: string;
    paymentType?: 'cash' | 'card' | 'e-wallet' | 'qris';
    tableNo?: string;
    waiterName?: string;
    customerName?: string;
    branchId?: string;
    status: 'Completed' | 'Returned' | 'Unpaid' | 'Pending' | 'Served' | 'Paid';
    printCount?: number;
    paidAmount?: number;
    change?: number;
    waitingTime?: string;
    syncStatus?: 'synced' | 'pending' | 'syncing';
    lastPrintedAt?: string;
}

export interface SalesReturn {
    id: number;
    returnNo: string;
    orderNo: string;
    date: string;
    reason: string;
    refundAmount: number;
    status: 'Processed' | 'Pending';
    syncStatus?: 'synced' | 'pending' | 'syncing';
}

// --- Initial Data ---

export const INITIAL_SALES: SalesOrder[] = [
    {
        id: 1,
        orderNo: 'INV-2026-0001',
        date: '2026-01-20 09:30',
        items: 2,
        productDetails: [
            { name: 'Kopi Susu Gula Aren', quantity: 1, price: 20000 },
            { name: 'Croissant Chocolate', quantity: 1, price: 25000 },
        ],
        totalAmount: 45000,
        paymentMethod: 'Cash',
        status: 'Completed',
        branchId: 'b1'
    },
    {
        id: 2,
        orderNo: 'INV-2026-0002',
        date: '2026-01-20 10:15',
        items: 1,
        productDetails: [
            { name: 'Iced Americano', quantity: 1, price: 22000 },
        ],
        totalAmount: 22000,
        paymentMethod: 'QRIS',
        status: 'Completed',
        branchId: 'b1'
    },
    {
        id: 3,
        orderNo: 'INV-2026-0003',
        date: '2026-01-20 10:45',
        items: 3,
        productDetails: [
            { name: 'Nasi Goreng Spesial', quantity: 2, price: 45000 },
            { name: 'Teh Tarik', quantity: 1, price: 15000 },
        ],
        totalAmount: 105000,
        paymentMethod: 'Debit',
        status: 'Completed',
        branchId: 'b2'
    },
    {
        id: 4,
        orderNo: 'INV-2026-0004',
        date: '2026-01-20 11:20',
        items: 2,
        productDetails: [
            { name: 'Manual: Jasa Custom Packaging', quantity: 1, price: 15000, isManual: true },
            { name: 'Manual: Ongkos Kirim', quantity: 1, price: 10000, isManual: true },
        ],
        totalAmount: 25000,
        paymentMethod: 'Cash',
        status: 'Completed',
        branchId: 'b2'
    },
];

const INITIAL_RETURNS: SalesReturn[] = [];

interface SalesViewProps {
    initialTab?: 'history' | 'returns';
    currentBranchId?: string;
    onModeChange?: (mode: 'history' | 'returns') => void;
    onExit?: () => void;
    sales: SalesOrder[];
    returns: SalesReturn[];
    onAddSale: (sale: Omit<SalesOrder, 'id' | 'orderNo' | 'date' | 'status'>) => void;
    onAddReturn: (ret: Omit<SalesReturn, 'id' | 'returnNo' | 'date' | 'status'>) => void;
    onUpdateSale?: (sale: SalesOrder) => void;
    onDeleteSale?: (saleId: number) => void;
    contacts: ContactData[];
    employees: any[];
    onOpenCashier?: () => void;
    paymentMethods?: any[];
    tables?: any[];
    onClearTableStatus?: (tableNo: string) => void;
    settings?: any;
}

export function SalesView({
    initialTab = 'history',
    currentBranchId,
    onModeChange,
    onExit,
    sales,
    returns,
    onAddSale,
    onAddReturn,
    onUpdateSale,
    onDeleteSale,
    contacts,
    employees,
    onOpenCashier,
    paymentMethods = [],
    tables = [],
    onClearTableStatus,
    settings = {}
}: SalesViewProps) {
    const [activeTab, setActiveTab] = useState<'history' | 'returns'>(initialTab);
    // Date Filter State
    const [dateFilter, setDateFilter] = useState({
        // Fix: Use Local Time for default date to avoid UTC "yesterday" issue in early morning (WIB)
        start: new Date().toLocaleDateString('en-CA'), // Returns YYYY-MM-DD in local time
        end: new Date().toLocaleDateString('en-CA')
    });

    // Stats State
    const [statsPeriod, setStatsPeriod] = useState<'daily' | 'monthly' | 'yearly' | 'filtered'>('filtered');

    // Cashier Filter State
    const [selectedCashier, setSelectedCashier] = useState('');

    const getStatsTotal = () => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let targetSales = sales || [];

        // If 'filtered', use the already filtered list (respects search & date picker)
        if (statsPeriod === 'filtered') {
            // We need to re-apply filter or use 'filteredSales' if accessible here?
            // filteredSales is defined below. We might need to move this function or use the var.
            // Since 'filteredSales' is derived closer to render, let's use a standard calculation here 
            // OR move 'filteredSales' up. 
            // EASIER: Calculate 'Filtered' inside the render or just duplicate logic if small.
            // Actually, we can move 'filteredSales' definition up above this function? 
            // No, 'filteredSales' uses 'searchQuery' etc.
            // Let's defer 'filtered' calc to the reducer in render?
            // BETTER: Just return 0 here and handle in render? No.
            // Let's filter 'sales' right here for consistency if easy.
            return filteredSales.reduce((sum, sale) => sum + (sale.status !== 'Returned' ? sale.totalAmount : 0), 0);
        }

        // For other periods, filter ALL sales
        return targetSales.reduce((sum, sale) => {
            if (sale.status === 'Returned') return sum;
            // Branch check
            if (currentBranchId && sale.branchId && String(sale.branchId) !== String(currentBranchId)) return sum;

            const saleDate = new Date(sale.date);
            const saleDateStr = sale.date.split('T')[0]; // Simple string check if format is ISO

            if (statsPeriod === 'daily') {
                // Check YYYY-MM-DD
                // Assuming sale.date is standard timestamp string
                const d = new Date(sale.date);
                if (d.getDate() !== now.getDate() || d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return sum;
            } else if (statsPeriod === 'monthly') {
                if (saleDate.getMonth() !== currentMonth || saleDate.getFullYear() !== currentYear) return sum;
            } else if (statsPeriod === 'yearly') {
                if (saleDate.getFullYear() !== currentYear) return sum;
            }
            return sum + sale.totalAmount;
        }, 0);
    };

    // Payment Modal State
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<SalesOrder | null>(null);

    const handlePaymentClick = (sale: SalesOrder) => {
        if (sale.status !== 'Unpaid') return;
        setSelectedSaleForPayment(sale);
        setPaymentModalOpen(true);
    };

    const handlePaymentComplete = (payment: { method: PaymentMethod; amount: number; change?: number; eWalletProvider?: string }) => {
        // Capture safe reference
        const saleToProcess = selectedSaleForPayment;
        if (!saleToProcess) return;

        const updatedSale = {
            ...saleToProcess,
            status: 'Pending' as const,
            paymentMethod: payment.method, // Keep specific name (e.g. "BCA", "Tunai")
            // @ts-ignore
            paymentType: payment.type, // Pass strict type
            paidAmount: payment.amount,
            change: payment.change
        };

        // 1. Update DB (triggers KDS sync)
        if (onUpdateSale) {
            onUpdateSale(updatedSale);
        }

        // 2. Close UI Immediately (Optimistic)
        setPaymentModalOpen(false);
        setSelectedSaleForPayment(null);
        toast.success(`Pembayaran berhasil!`);

        // 3. Print Receipt in Background (Non-blocking)
        const printReceiptData = async () => {
            let wifiVoucher = undefined;
            if (settings?.enable_wifi_vouchers) {
                const { WifiVoucherService } = await import('../../lib/WifiVoucherService');
                wifiVoucher = await WifiVoucherService.getVoucherForSale(saleToProcess.id, saleToProcess.branchId || 'default') || undefined;
            }

            try {
                await printerService.printReceipt({
                    orderNo: saleToProcess.orderNo,
                    tableNo: saleToProcess.tableNo || '-',
                    waiterName: saleToProcess.waiterName || '-',
                    time: new Date().toLocaleString(),
                    items: saleToProcess.productDetails.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price
                    })),
                    subtotal: saleToProcess.totalAmount + (saleToProcess.discount || 0),
                    discount: saleToProcess.discount || 0,
                    tax: saleToProcess.tax || 0,
                    total: saleToProcess.totalAmount,
                    paymentType: updatedSale.paymentMethod,
                    amountPaid: payment.amount,
                    change: payment.change || 0,
                    customerName: saleToProcess.customerName,
                    customerLevel: contacts.find(c => c.name === saleToProcess.customerName)?.tier,
                    wifiVoucher: wifiVoucher,
                    wifiNotice: settings?.wifi_voucher_notice
                });
            } catch (error) {
                console.error('Background print failed:', error);
                toast.error('Gagal mencetak struk otomatis.');
            }
        };

        printReceiptData();
    };

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    const [returnReason, setReturnReason] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<SalesOrder | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedOrderToEdit, setSelectedOrderToEdit] = useState<SalesOrder | null>(null);
    const [editForm, setEditForm] = useState<Partial<SalesOrder>>({});
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [pendingReturnAction, setPendingReturnAction] = useState<(() => void) | null>(null);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // F2: Focus Search
            if (e.key === 'F2') {
                e.preventDefault();
                const searchInput = document.getElementById('sales-search-input');
                if (searchInput) searchInput.focus();
            }
            // F9: Open Cashier (Equivalent to space if requested, but F9 is safer global)
            // User asked for "F9 or Space". Space is risky if typing. Let's use F9 for "Open Cashier" context.
            // Or if we are in "Add Sale" mode, F9 could mean pay.
            // Here "Open Cashier" opens the Sales Mode.
            if (e.key === 'F9') {
                e.preventDefault();
                if (onOpenCashier) onOpenCashier();
            }
            // Escape: Close Modals
            if (e.key === 'Escape') {
                if (isReturnModalOpen) setIsReturnModalOpen(false);
                if (isDetailsModalOpen) setIsDetailsModalOpen(false);
                if (isEditModalOpen) setIsEditModalOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onOpenCashier, isReturnModalOpen, isDetailsModalOpen, isEditModalOpen]);

    const filteredSales = (sales || []).filter(sale => {
        const matchesBranch = (String(sale.branchId) === String(currentBranchId) || !sale.branchId);
        const matchesSearch = (sale.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.productDetails.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())));

        // Date Logic
        if (!processDateFilter(sale.date)) return false;

        // Cashier Logic
        if (selectedCashier && sale.waiterName !== selectedCashier) return false;

        return matchesBranch && matchesSearch;
    });

    function processDateFilter(dateStr: string) {
        if (!dateFilter.start && !dateFilter.end) return true;
        const saleDate = new Date(dateStr);
        saleDate.setHours(0, 0, 0, 0); // Compare dates only

        if (dateFilter.start) {
            // Force Local Time parsing by replacing - with / (Browser standard behavior for Local vs UTC)
            const startDate = new Date(dateFilter.start.replace(/-/g, '/'));
            startDate.setHours(0, 0, 0, 0);
            if (saleDate < startDate) return false;
        }
        if (dateFilter.end) {
            // Force Local Time parsing by replacing - with /
            const endDate = new Date(dateFilter.end.replace(/-/g, '/'));
            endDate.setHours(0, 0, 0, 0);
            if (saleDate > endDate) return false;
        }
        return true;
    }

    const filteredReturns = (returns || []).filter(ret =>
        ret.returnNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.reason.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
    const [receiptPreviewData, setReceiptPreviewData] = useState<SalesOrder | null>(null);

    const handlePrintReceipt = (sale: SalesOrder) => {
        setReceiptPreviewData(sale);
        setIsReceiptPreviewOpen(true);
    };

    const handleConfirmPrint = () => {
        if (!receiptPreviewData) return;
        const sale = receiptPreviewData;
        const loadingToast = toast.loading(`Sedang mencetak struk ${sale.orderNo}...`);

        const printReceiptData = async () => {
            let wifiVoucher = undefined;
            if (settings?.enable_wifi_vouchers) {
                const { WifiVoucherService } = await import('../../lib/WifiVoucherService');
                wifiVoucher = await WifiVoucherService.getVoucherForSale(sale.id, sale.branchId || 'default') || undefined;
            }

            try {
                await printerService.printReceipt({
                    orderNo: sale.orderNo,
                    tableNo: sale.tableNo || '-',
                    waiterName: sale.waiterName || '-',
                    time: new Date(sale.date).toLocaleString(),
                    items: sale.productDetails.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price
                    })),
                    subtotal: sale.totalAmount + (sale.discount || 0),
                    discount: sale.discount || 0,
                    tax: sale.tax || 0,
                    total: sale.totalAmount,
                    paymentType: sale.paymentMethod,
                    amountPaid: sale.paidAmount || sale.totalAmount,
                    change: sale.change || 0,
                    customerName: sale.customerName,
                    customerLevel: contacts.find(c => c.name === sale.customerName)?.tier,
                    wifiVoucher: wifiVoucher,
                    wifiNotice: settings?.wifi_voucher_notice
                });

                if (onUpdateSale) {
                    onUpdateSale({
                        ...sale,
                        printCount: (sale.printCount || 0) + 1,
                        lastPrintedAt: new Date().toISOString()
                    });
                }
                toast.dismiss(loadingToast);
                setIsReceiptPreviewOpen(false);
                setReceiptPreviewData(null);
                toast.success(`Struk ${sale.orderNo} berhasil dicetak`);
            } catch (error: any) {
                toast.dismiss(loadingToast);
                toast.error('Gagal mencetak struk: ' + error.message);
            }
        };

        printReceiptData();
    };

    const handleViewDetails = (sale: SalesOrder) => {
        setSelectedOrderDetails(sale);
        setIsDetailsModalOpen(true);
    };

    const handleOpenReturn = (order: SalesOrder) => {
        setSelectedOrder(order);
        setReturnReason('');
        setIsReturnModalOpen(true);
    };

    const handleSubmitReturn = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder || !returnReason) return;

        const processReturn = () => {
            onAddReturn({
                orderNo: selectedOrder.orderNo,
                reason: returnReason,
                refundAmount: selectedOrder.totalAmount,
            });
            setIsReturnModalOpen(false);
            toast.success('Retur penjualan berhasil diproses');
        };

        if (settings?.enable_manager_auth) {
            setPendingReturnAction(() => processReturn);
            setIsAuthModalOpen(true);
        } else {
            processReturn();
        }
    };

    const handleEditClick = (sale: SalesOrder) => {
        setSelectedOrderToEdit(sale);
        setEditForm({ ...sale });
        setIsEditModalOpen(true);
    };

    const handleUpdateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onUpdateSale && selectedOrderToEdit) {
            onUpdateSale(editForm as SalesOrder);
            setIsEditModalOpen(false);
        }
    };

    const handleDeleteClick = (saleId: number) => {
        if (window.confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
            if (onDeleteSale) {
                onDeleteSale(saleId);
            }
        }
    };

    // --- Renderers ---

    const renderHistory = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-[13px]">
                    <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                        <tr>
                            <th className="px-3 py-2">No. Invoice</th>
                            <th className="px-3 py-2">Meja</th>
                            <th className="px-3 py-2">Pelanggan</th>
                            <th className="px-3 py-2">Tanggal</th>
                            <th className="px-3 py-2 text-center hidden xl:table-cell">Item</th>
                            <th className="px-3 py-2 text-right">Diskon</th>
                            <th className="px-3 py-2 text-right">Total</th>
                            <th className="px-3 py-2">Bayar</th>
                            <th className="px-3 py-2">Pelayan</th>
                            <th className="px-3 py-2 text-center">Cetak</th>
                            <th className="px-3 py-2 text-center">Status</th>
                            <th className="px-3 py-2 text-center hidden lg:table-cell">Sinkron</th>
                            <th className="px-3 py-2 text-center">Durasi Saji</th>
                            <th className="px-3 py-2 text-center whitespace-nowrap">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredSales.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <History className="w-12 h-12 text-gray-200" />
                                        <p>Tidak ada riwayat penjualan ditemukan</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredSales.map(sale => (
                                <tr key={sale.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2">
                                        <div className="font-mono text-blue-600 font-medium mb-1 whitespace-nowrap">{sale.orderNo}</div>
                                        <div className="text-[10px] text-gray-400 space-y-0.5 max-w-[120px] truncate">
                                            {sale.productDetails.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-1 truncate">
                                                    <span>• {item.name}</span>
                                                    <span className="text-gray-300">({item.quantity}x)</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        {sale.tableNo ? (
                                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono">
                                                {sale.tableNo}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        {sale.customerName ? (
                                            <span className="text-gray-900 font-medium whitespace-nowrap">
                                                {sale.customerName}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                                        {new Date(sale.date).toLocaleString('id-ID', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                            // Removed explicit timeZone to rely on Browser Local Time which seems to be what user wants (WIB)
                                            // actually, better to be safe? User is in WIB.
                                            // timeZone: 'Asia/Jakarta' 
                                        })}
                                    </td>
                                    <td className="px-3 py-2 text-center hidden xl:table-cell">{sale.items}</td>
                                    <td className="px-3 py-2 text-right text-red-500 font-medium whitespace-nowrap">
                                        {sale.discount ? `- Rp ${sale.discount.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold whitespace-nowrap">Rp {sale.totalAmount.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-gray-600 truncate max-w-[80px]">{sale.paymentMethod}</td>
                                    <td className="px-3 py-2">
                                        {sale.waiterName ? (
                                            <span className="text-gray-700 text-[10px] font-medium bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                {sale.waiterName}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <div className="flex justify-center" title={sale.printCount ? `Dicetak ${sale.printCount}x\nTerakhir: ${new Date(sale.lastPrintedAt!).toLocaleString()}` : "Belum dicetak"}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${!sale.printCount ? 'bg-gray-50 border-gray-200 text-gray-300' :
                                                sale.printCount === 1 ? 'bg-green-50 border-green-200 text-green-600' :
                                                    'bg-orange-50 border-orange-200 text-orange-600'
                                                }`}>
                                                <Printer className="w-3.5 h-3.5" />
                                            </div>
                                            {sale.printCount && sale.printCount > 1 && (
                                                <span className="ml-1 text-[10px] bg-orange-100 text-orange-700 px-1 rounded-full">{sale.printCount}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${sale.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                            sale.status === 'Served' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                sale.status === 'Pending' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                    sale.status === 'Paid' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                                        sale.status === 'Unpaid' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                            sale.status === 'Returned' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                'bg-gray-50 text-gray-700 border-gray-200'
                                            }`}>
                                            {sale.status === 'Completed' ? 'Selesai' :
                                                sale.status === 'Served' ? 'Disajikan' :
                                                    sale.status === 'Pending' ? 'Diproses' :
                                                        sale.status === 'Paid' ? 'Dibayar' :
                                                            sale.status === 'Unpaid' ? 'Belum Bayar' :
                                                                sale.status === 'Returned' ? 'Retur' : sale.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center hidden lg:table-cell">
                                        {sale.syncStatus === 'synced' ? (
                                            <div className="flex justify-center" title="Tersinkron dengan cloud">
                                                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <CheckCircle className="w-3 h-3 text-blue-600" />
                                                </div>
                                            </div>
                                        ) : sale.syncStatus === 'syncing' ? (
                                            <div className="flex justify-center" title="Sedang menyinkronkan...">
                                                <RotateCcw className="w-3 h-3 text-orange-500 animate-spin" />
                                            </div>
                                        ) : (
                                            <div className="flex justify-center" title="Menunggu koneksi internet">
                                                <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <XCircle className="w-3 h-3 text-gray-400" />
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className="text-xs font-mono text-gray-500">{sale.waitingTime || '-'}</span>
                                    </td>
                                    <td className="px-3 py-2 flex justify-center gap-0.5 whitespace-nowrap">
                                        <button
                                            onClick={() => handleViewDetails(sale)}
                                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg group"
                                            title="Detail"
                                        >
                                            <Search className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        </button>
                                        {sale.status === 'Unpaid' && (
                                            <button
                                                onClick={() => handlePaymentClick(sale)}
                                                className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg group font-bold"
                                                title="Bayar & Proses ke Dapur"
                                            >
                                                <span className="text-[10px] w-4 h-4 flex items-center justify-center border border-green-600 rounded-md">$</span>
                                            </button>
                                        )}
                                        {['Completed', 'Paid', 'Served'].includes(sale.status) && (
                                            <button
                                                onClick={() => handleOpenReturn(sale)}
                                                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg group"
                                                title="Retur"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-[-45deg] transition-transform" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handlePrintReceipt(sale)}
                                            className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg group"
                                            title="Struk"
                                        >
                                            <FileText className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        </button>
                                        {/* DEBUG: Table {sale.tableNo} Status: {tables.find(t => String(t.number) === String(sale.tableNo))?.status || 'Not Found'} */}
                                        {((sale.status === 'Pending' || sale.status === 'Served') || (sale.status === 'Completed' && tables.find(t => String(t.number) === String(sale.tableNo) && t.status === 'Occupied'))) && (
                                            <button
                                                onClick={() => {
                                                    // Determine the table number securely
                                                    const tableNo = sale.tableNo;
                                                    if (!tableNo) return;

                                                    if (onClearTableStatus) {
                                                        onClearTableStatus(tableNo);
                                                        // toast handled in parent
                                                    } else if (onUpdateSale) {
                                                        // Fallback (Depreacated logic but kept for safety)
                                                        onUpdateSale({ ...sale, status: 'Completed' });
                                                        toast.success('Meja berhasil dikosongkan.');
                                                    }
                                                }}
                                                className={`p-1.5 rounded-lg group ${sale.status === 'Completed' ? 'hover:bg-orange-50 text-orange-600' : 'hover:bg-green-50 text-green-600'}`}
                                                title={sale.status === 'Completed' ? "Fix: Kosongkan Status Meja" : "Selesaikan & Kosongkan Meja"}
                                            >
                                                <CheckCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleEditClick(sale)}
                                            className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg group"
                                            title="Edit"
                                        >
                                            <ShoppingCart className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(sale.id)}
                                            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg group"
                                            title="Hapus"
                                        >
                                            <XCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderReturns = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                <h3 className="font-bold text-gray-800">Riwayat Retur Penjualan</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-[13px]">
                    <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                        <tr>
                            <th className="px-3 py-3">No. Retur</th>
                            <th className="px-3 py-3">Ref. Invoice</th>
                            <th className="px-3 py-3">Tanggal</th>
                            <th className="px-3 py-3">Alasan</th>
                            <th className="px-3 py-3 text-right">Refund</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {returns.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Belum ada data retur penjualan.</td>
                            </tr>
                        ) : (
                            filteredReturns.map(ret => (
                                <tr key={ret.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-3 font-mono text-red-600 whitespace-nowrap">{ret.returnNo}</td>
                                    <td className="px-3 py-3 font-mono text-gray-600 whitespace-nowrap">{ret.orderNo}</td>
                                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{ret.date}</td>
                                    <td className="px-3 py-3 text-gray-700 truncate max-w-[150px]">{ret.reason}</td>
                                    <td className="px-3 py-3 text-right font-bold text-red-600 whitespace-nowrap">Rp {ret.refundAmount.toLocaleString()}</td>
                                    <td className="px-3 py-3 text-center">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-green-50 text-green-700 border-green-200">
                                            {ret.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <button
                                            onClick={() => {
                                                const originalOrder = sales.find(s => s.orderNo === ret.orderNo);
                                                if (originalOrder) handleViewDetails(originalOrder);
                                                else toast.error('Data transaksi asli tidak ditemukan');
                                            }}
                                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg group"
                                            title="Detail Transaksi Asli"
                                        >
                                            <Search className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50/50 relative overflow-hidden">
            {/* Header & Tabs */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 flex-shrink-0">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">Modul Penjualan</h2>
                        <div className="h-6 w-px bg-gray-200 hidden md:block" />
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto">
                        {[
                            { id: 'history', label: 'Riwayat', icon: History },
                            { id: 'returns', label: 'Retur', icon: RotateCcw },
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id as any);
                                    if (onModeChange) onModeChange(item.id as any);
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === item.id
                                    ? 'bg-white text-blue-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <item.icon className={`w-3.5 h-3.5 ${activeTab === item.id ? 'text-blue-600' : 'text-gray-400'}`} />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 justify-end">
                    {/* Date Picker Range */}
                    {activeTab === 'history' && (
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 order-2 md:order-1">
                            <input
                                type="date"
                                className="bg-transparent text-xs font-bold text-gray-600 outline-none px-2 w-[110px]"
                                value={dateFilter.start}
                                onChange={e => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                className="bg-transparent text-xs font-bold text-gray-600 outline-none px-2 w-[110px]"
                                value={dateFilter.end}
                                onChange={e => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                            />
                            {(dateFilter.start || dateFilter.end) && (
                                <button
                                    onClick={() => setDateFilter({ start: '', end: '' })}
                                    className="p-1 hover:bg-gray-200 rounded-full text-gray-400"
                                    title="Reset Tanggal"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}


                    {/* Cashier Filter Dropdown */}
                    {activeTab === 'history' && (
                        <div className="relative order-2 md:order-2">
                            <div className="relative">
                                <Users className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <select
                                    className="pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer min-w-[130px]"
                                    value={selectedCashier}
                                    onChange={(e) => setSelectedCashier(e.target.value)}
                                >
                                    <option value="">Semua Kasir</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.name}>{emp.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    )}

                    <div className="relative order-3 md:order-2">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'history' ? "Cari invoice..." : "Cari retur..."}
                            className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-32 md:w-48 transition-all focus:w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            id="sales-search-input"
                        />
                    </div>


                    <div className="flex flex-col items-end gap-1 order-1 md:order-3">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl flex flex-col items-end min-w-[140px] relative group cursor-pointer transition-all hover:shadow-md hover:border-blue-300">
                            {/* Dropdown/Selector Logic embedded in hover or click could be complex, using simple select for now or sticking to click-to-cycle */}
                            <select
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                value={statsPeriod}
                                onChange={(e) => setStatsPeriod(e.target.value as any)}
                            >
                                <option value="filtered">Total (Tampil)</option>
                                <option value="daily">Hari Ini</option>
                                <option value="monthly">Bulan Ini</option>
                                <option value="yearly">Tahun Ini</option>
                            </select>

                            <div className="px-3 py-1.5 w-full flex flex-col items-end pointer-events-none">
                                <div className="flex items-center gap-1 text-[9px] uppercase font-bold text-blue-600 tracking-wider">
                                    <span>
                                        {statsPeriod === 'daily' ? 'Hari Ini' :
                                            statsPeriod === 'monthly' ? 'Bulan Ini' :
                                                statsPeriod === 'yearly' ? 'Tahun Ini' : 'Total (Filter)'}
                                    </span>
                                    <ChevronDown className="w-3 h-3 text-blue-400" />
                                </div>
                                <span className="text-sm font-bold text-blue-800">
                                    Rp {getStatsTotal().toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {onOpenCashier && (
                        <Button
                            onClick={onOpenCashier}
                            className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-100"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            Buka Kasir Baru
                        </Button>
                    )}

                    {onExit && (
                        <button
                            onClick={onExit}
                            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-all"
                            title="Tutup Modul"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0">
                    {activeTab === 'history' && (
                        <div className="p-8 h-full">
                            {renderHistory()}
                        </div>
                    )}
                    {activeTab === 'returns' && (
                        <div className="p-8 h-full">
                            {renderReturns()}
                        </div>
                    )}
                </div>
            </div>

            {/* Return Modal */}
            {
                isReturnModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-bold text-lg text-gray-800">Proses Retur Penjualan</h3>
                                <p className="text-xs text-gray-500">{selectedOrder?.orderNo}</p>
                            </div>
                            <form onSubmit={handleSubmitReturn} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Retur</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg resize-none"
                                        rows={3}
                                        placeholder="Contoh: Salah kirim barang, barang cacat..."
                                        value={returnReason}
                                        onChange={e => setReturnReason(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="bg-red-50 p-3 rounded-lg flex justify-between items-center">
                                    <span className="text-sm text-red-700 font-medium">Total Refund:</span>
                                    <span className="text-lg font-bold text-red-700">Rp {selectedOrder?.totalAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setIsReturnModalOpen(false)}>Batal</Button>
                                    <Button type="submit" className="bg-red-600 hover:bg-red-700">Konfirmasi Retur</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Details Modal */}
            {
                isDetailsModalOpen && selectedOrderDetails && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-in zoom-in-95 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">Detail Transaksi</h3>
                                    <p className="text-xs text-gray-500 font-mono">{selectedOrderDetails.orderNo}</p>
                                </div>
                                <button onClick={() => setIsDetailsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="flex justify-between mb-6 text-sm">
                                    <div>
                                        <p className="text-gray-400 mb-1">Tanggal</p>
                                        <p className="font-semibold text-gray-700">{selectedOrderDetails.date}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-400 mb-1">Metode Bayar</p>
                                        <p className="font-semibold text-gray-700">{selectedOrderDetails.paymentMethod}</p>
                                    </div>
                                </div>
                                {selectedOrderDetails.customerName && (
                                    <div className="mb-6 text-sm">
                                        <p className="text-gray-400 mb-1">Pelanggan</p>
                                        <p className="font-semibold text-gray-700">{selectedOrderDetails.customerName}</p>
                                    </div>
                                )}

                                <div className="space-y-3 mb-6">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Item Pesanan</p>
                                    <div className="space-y-2 border-y border-gray-50 py-3">
                                        {selectedOrderDetails.productDetails.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <div className="flex gap-2">
                                                    <span className="text-gray-500">{item.quantity}x</span>
                                                    <span className="font-medium text-gray-800">{item.name}</span>
                                                </div>
                                                <span className="text-gray-600">Rp {(item.price * item.quantity).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-blue-50/50 p-4 rounded-xl space-y-2">
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>Subtotal</span>
                                        <span>Rp {(selectedOrderDetails.totalAmount + (selectedOrderDetails.discount || 0)).toLocaleString()}</span>
                                    </div>
                                    {selectedOrderDetails.discount > 0 && (
                                        <div className="flex justify-between text-sm text-red-500 font-medium">
                                            <span>Diskon</span>
                                            <span>- Rp {selectedOrderDetails.discount.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-bold text-blue-700 pt-2 border-t border-blue-100">
                                        <span>Total Akhir</span>
                                        <span>Rp {selectedOrderDetails.totalAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                                <Button variant="outline" onClick={() => handlePrintReceipt(selectedOrderDetails)}>Cetak Struk</Button>
                                <Button className="bg-gray-800" onClick={() => setIsDetailsModalOpen(false)}>Tutup</Button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Edit Modal */}
            {
                isEditModalOpen && selectedOrderToEdit && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-bold text-lg text-gray-800">Edit Transaksi</h3>
                                <p className="text-xs text-gray-500">{selectedOrderToEdit.orderNo}</p>
                            </div>
                            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Meja</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded-lg"
                                            value={editForm.tableNo || ''}
                                            onChange={e => setEditForm({ ...editForm, tableNo: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pelanggan</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded-lg"
                                            value={editForm.customerName || ''}
                                            onChange={e => setEditForm({ ...editForm, customerName: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Pelayan</label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={editForm.waiterName || ''}
                                        onChange={e => setEditForm({ ...editForm, waiterName: e.target.value })}
                                    >
                                        <option value="">- Pilih Pelayan -</option>
                                        {(employees || []).map(emp => (
                                            <option key={emp.id} value={emp.name}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={editForm.paymentMethod || ''}
                                        onChange={e => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                                    >
                                        <option value="">- Pilih Metode -</option>
                                        {(paymentMethods || []).filter(m => m.is_active).map(m => (
                                            <option key={m.id} value={m.name}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
                                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Simpan Perubahan</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Receipt Preview Modal */}
            {isReceiptPreviewOpen && receiptPreviewData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Printer className="w-4 h-4" />
                                Pratinjau Struk
                            </h3>
                            <button onClick={() => setIsReceiptPreviewOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-white/50">
                            {/* Inner Container scaled by paper width - EXACT MATCH with SettingsView */}
                            <div className={`border border-dashed border-gray-300 p-6 bg-gray-50/50 text-center font-mono text-[10px] space-y-1 text-gray-600 mx-auto transition-all ${printerService.getTemplate().paperWidth === '80mm' ? 'max-w-xs' : 'max-w-[200px]'}`}>
                                {/* Logo */}
                                {printerService.getTemplate().showLogo && printerService.getTemplate().logoUrl && (
                                    <div className="flex justify-center mb-2">
                                        <img
                                            src={printerService.getTemplate().logoUrl}
                                            alt="Logo"
                                            className="w-12 h-12 object-contain grayscale"
                                        />
                                    </div>
                                )}
                                {/* Header */}
                                <div className="space-y-0.5">
                                    <div className="font-bold text-xs uppercase text-gray-800">
                                        {printerService.getTemplate().header || 'WINNY PANGERAN NATAKUSUMA'}
                                    </div>
                                    <div className="whitespace-pre-line">
                                        {printerService.getTemplate().address || ''}
                                    </div>
                                </div>

                                <p>{printerService.getTemplate().paperWidth === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>

                                {/* Info */}
                                <div className="text-left space-y-0.5 text-gray-600">
                                    <div className="flex justify-between"><span>No:</span><span>{receiptPreviewData.orderNo}</span></div>
                                    {printerService.getTemplate().showDate && (
                                        <div className="flex justify-between"><span>Waktu:</span><span>{new Date(receiptPreviewData.date).toLocaleString()}</span></div>
                                    )}
                                    {printerService.getTemplate().showTable && (
                                        <div className="flex justify-between"><span>Meja:</span><span>{receiptPreviewData.tableNo || '-'}</span></div>
                                    )}
                                    {printerService.getTemplate().showCustomerName && receiptPreviewData.customerName && (
                                        <div className="flex justify-between"><span>Pelanggan:</span><span>{receiptPreviewData.customerName}</span></div>
                                    )}
                                    {printerService.getTemplate().showCustomerStatus && contacts.find(c => c.name === receiptPreviewData.customerName)?.tier && (
                                        <div className="flex justify-between">
                                            <span>Status:</span>
                                            <span>{contacts.find(c => c.name === receiptPreviewData.customerName)?.tier}</span>
                                        </div>
                                    )}
                                    {printerService.getTemplate().showWaiter && (
                                        <div className="flex justify-between"><span>Pelayan:</span><span>{receiptPreviewData.waiterName || '-'}</span></div>
                                    )}
                                </div>

                                <p>{printerService.getTemplate().paperWidth === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>

                                {/* Items */}
                                <div className="space-y-0.5">
                                    {(receiptPreviewData.productDetails || []).map((item, i) => (
                                        <div key={i} className="flex justify-between text-left">
                                            <span className="truncate flex-1 mr-2">{item.quantity}x {item.name}</span>
                                            <span>{(item.price * item.quantity).toLocaleString('id-ID')}</span>
                                        </div>
                                    ))}
                                </div>

                                <p>{printerService.getTemplate().paperWidth === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>

                                {/* Totals */}
                                <div className="space-y-0.5 text-gray-600">
                                    <div className="flex justify-between"><span>Subtotal</span><span>{(receiptPreviewData.totalAmount + (receiptPreviewData.discount || 0)).toLocaleString('id-ID')}</span></div>
                                    {(receiptPreviewData.discount || 0) > 0 && (
                                        <div className="flex justify-between text-red-500"><span>Diskon</span><span>-{(receiptPreviewData.discount || 0).toLocaleString('id-ID')}</span></div>
                                    )}
                                    <div className="flex justify-between"><span>Pajak (0%)</span><span>0</span></div>
                                    <div className="flex justify-between font-bold text-xs text-gray-800"><span>TOTAL</span><span>{receiptPreviewData.totalAmount.toLocaleString('id-ID')}</span></div>
                                </div>

                                <p>{printerService.getTemplate().paperWidth === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>

                                {/* Payment */}
                                <div className="space-y-0.5">
                                    <div className="flex justify-between"><span>{receiptPreviewData.paymentMethod}</span><span>{(receiptPreviewData.paidAmount || receiptPreviewData.totalAmount).toLocaleString('id-ID')}</span></div>
                                    <div className="flex justify-between"><span>Kembali</span><span>{(receiptPreviewData.change || 0).toLocaleString('id-ID')}</span></div>
                                </div>

                                <p>{printerService.getTemplate().paperWidth === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>

                                {/* Footer */}
                                <div className="italic mt-4 text-gray-500">
                                    {printerService.getTemplate().footer || 'Terima Kasih'}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-white rounded-b-lg flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setIsReceiptPreviewOpen(false)}>Batal</Button>
                            <Button className="flex-1 gap-2" onClick={handleConfirmPrint}>
                                <Printer className="w-4 h-4" />
                                Cetak Sekarang
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <PaymentModal
                open={paymentModalOpen}
                onOpenChange={setPaymentModalOpen}
                totalAmount={selectedSaleForPayment?.totalAmount || 0}
                onPaymentComplete={handlePaymentComplete}
                paymentMethods={paymentMethods}
            />

            <FingerprintAuthModal
                open={isAuthModalOpen}
                onClose={() => {
                    setIsAuthModalOpen(false);
                    setPendingReturnAction(null);
                }}
                onSuccess={(manager) => {
                    toast.success(`Diizinkan oleh ${manager.name}`);
                    if (pendingReturnAction) {
                        pendingReturnAction();
                    }
                }}
                employees={employees}
            />
        </div>
    );
}
