import { useMemo, useState } from 'react';
import { FileText, Download, FileSpreadsheet, Printer, TrendingUp, DollarSign, ShoppingBag, CreditCard, Search, Calendar, Filter, X, ShoppingCart } from 'lucide-react';
import { SalesOrder, SalesReturn } from '../pos/SalesView';
import { Button } from '../ui/button';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface ReportsViewProps {
    sales: SalesOrder[];
    returns: SalesReturn[];
    purchases: any[];
    purchaseReturns: any[];
    paymentMethods: any[];
    storeSettings?: any;
}

export function ReportsView({ sales, returns, purchases = [], purchaseReturns = [], paymentMethods, storeSettings }: ReportsViewProps) {
    const [reportType, setReportType] = useState<'sales' | 'purchases'>('sales');

    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [methodFilter, setMethodFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(false);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    
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
            start.setDate(now.getDate() - 7);
        } else if (type === 'month') {
            start.setMonth(now.getMonth() - 1);
        }

        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        setStartDate(formatDate(start));
        setEndDate(formatDate(end));
    };

    const filteredSales = useMemo(() => {
        return sales.filter(s => {
            const matchesSearch = s.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.cashierName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.waiterName || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesMethod = methodFilter === 'All' || s.paymentMethod === methodFilter;

            const saleDate = s.date.split(' ')[0]; // Assuming format "YYYY-MM-DD HH:mm:ss"
            const matchesStartDate = !startDate || saleDate >= startDate;
            const matchesEndDate = !endDate || saleDate <= endDate;

            return matchesSearch && matchesMethod && matchesStartDate && matchesEndDate;
        });
    }, [sales, searchQuery, methodFilter, startDate, endDate]);

    const filteredReturns = useMemo(() => {
        return returns.filter(r => {
            const saleDate = r.date.split(' ')[0];
            const matchesStartDate = !startDate || saleDate >= startDate;
            const matchesEndDate = !endDate || saleDate <= endDate;
            return matchesStartDate && matchesEndDate;
        });
    }, [returns, startDate, endDate]);

    const filteredPurchases = useMemo(() => {
        return (purchases || []).filter(p => {
            const matchesSearch = (p.purchase_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.supplier_name || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            const pDate = p.date; // Usually YYYY-MM-DD
            const matchesStartDate = !startDate || pDate >= startDate;
            const matchesEndDate = !endDate || pDate <= endDate;
            
            return matchesSearch && matchesStartDate && matchesEndDate;
        });
    }, [purchases, searchQuery, startDate, endDate]);

    const totalSales = filteredSales.reduce((sum, s) => sum + (s.status === 'Completed' ? s.totalAmount : 0), 0);
    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalTransactions = filteredSales.filter(s => s.status === 'Completed').length;
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
        const completedSales = filteredSales.filter(s => s.status === 'Completed');
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
    }, [sales, paymentMethods]);

    const exportToExcel = () => {
        try {
            let data: any[];
            let summaryData: any[];
            let fileName: string;

            if (reportType === 'sales') {
                data = filteredSales.map(s => ({
                    'No. Invoice': s.orderNo,
                    'Tanggal': s.date,
                    'Items': s.items,
                    'Total Amount': s.totalAmount,
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
                doc.text(`Total Transaksi: ${totalTransactions}`, 14, 46);

                const tableData = filteredSales.map(s => [
                    s.orderNo,
                    s.date,
                    s.status === 'Completed' ? 'Selesai' : 'Retur',
                    s.paymentMethod,
                    formatCurrency(s.totalAmount)
                ]);

                autoTable(doc, {
                    startY: 55,
                    head: [['No. Invoice', 'Tanggal', 'Status', 'Metode', 'Total']],
                    body: tableData,
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
                    body: tableData,
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

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-4 text-orange-600">
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

            {/* Filter Controls */}
            {showFilters && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-top-4 duration-300">
                    <div className="px-8 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-indigo-600" />
                            <span className="font-bold text-gray-700">Set Filter Laporan</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {(searchQuery || startDate || endDate || methodFilter !== 'All') && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStartDate('');
                                        setEndDate('');
                                        setMethodFilter('All');
                                    }}
                                    className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 font-bold gap-1"
                                >
                                    <X className="w-3 h-3" /> Reset
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
                                <X className="w-4 h-4 text-gray-400" />
                            </Button>
                        </div>
                    </div>
                    
                    {/* [Part 25] Quick Filters Bar */}
                    <div className="px-8 py-3 bg-gray-50 border-b border-gray-100 flex gap-2 overflow-x-auto no-scrollbar">
                        <Button variant="outline" size="sm" onClick={() => handlePreset('today')} className="text-xs font-bold rounded-lg h-8 bg-white hover:bg-indigo-50 border-gray-200">Hari Ini</Button>
                        <Button variant="outline" size="sm" onClick={() => handlePreset('yesterday')} className="text-xs font-bold rounded-lg h-8 bg-white hover:bg-indigo-50 border-gray-200">Kemarin</Button>
                        <Button variant="outline" size="sm" onClick={() => handlePreset('week')} className="text-xs font-bold rounded-lg h-8 bg-white hover:bg-indigo-50 border-gray-200">7 Hari Terakhir</Button>
                        <Button variant="outline" size="sm" onClick={() => handlePreset('month')} className="text-xs font-bold rounded-lg h-8 bg-white hover:bg-indigo-50 border-gray-200">30 Hari Terakhir</Button>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Cari Transaksi</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="No. Invoice / Nama..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Mulai Dari</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Sampai Dengan</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Metode Pembayaran</label>
                            <select
                                value={methodFilter}
                                onChange={(e) => setMethodFilter(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium appearance-none select-none cursor-pointer"
                            >
                                <option value="All">Semua Metode</option>
                                {(paymentMethods || []).map(m => (
                                    <option key={m.id} value={m.name}>{m.name}</option>
                                ))}
                            </select>
                        </div>
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
                        {filteredSales.length < sales.length && (
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full animate-in fade-in zoom-in duration-300">
                                Menampilkan {filteredSales.length} dari {sales.length}
                            </span>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`text-sm font-bold flex items-center gap-2 rounded-xl px-4 py-2 transition-all ${showFilters ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Search className="w-4 h-4" />
                        {showFilters ? 'Tutup Filter' : 'Filter & Cari'}
                    </Button>
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
        </div>
    );
}
