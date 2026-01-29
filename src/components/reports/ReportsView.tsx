import { useMemo, useState } from 'react';
import { FileText, Download, FileSpreadsheet, Printer, TrendingUp, DollarSign, ShoppingBag, CreditCard, Search, Calendar, Filter, X } from 'lucide-react';
import { SalesOrder, SalesReturn } from '../pos/SalesView';
import { Button } from '../ui/button';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface ReportsViewProps {
    sales: SalesOrder[];
    returns: SalesReturn[];
    paymentMethods: any[];
}

export function ReportsView({ sales, returns, paymentMethods }: ReportsViewProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [methodFilter, setMethodFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(false);

    const filteredSales = useMemo(() => {
        return sales.filter(s => {
            const matchesSearch = s.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
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

    const totalSales = filteredSales.reduce((sum, s) => sum + (s.status === 'Completed' ? s.totalAmount : 0), 0);
    const totalTransactions = filteredSales.filter(s => s.status === 'Completed').length;
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
            const data = filteredSales.map(s => ({
                'No. Invoice': s.orderNo,
                'Tanggal': s.date,
                'Items': s.items,
                'Total Amount': s.totalAmount,
                'Metode Pembayaran': s.paymentMethod,
                'Status': s.status === 'Completed' ? 'Selesai' : 'Retur',
                'Pelayan': s.waiterName || '-',
                'Meja': s.tableNo || '-'
            }));

            // Add breakdown sheet
            const summaryData = salesByPaymentMethod.map(m => ({
                'Metode Pembayaran': m.name,
                'Tipe': m.type,
                'Jumlah Transaksi': m.count,
                'Total Penjualan': m.total
            }));

            const worksheet = XLSX.utils.json_to_sheet(data);
            const summarySheet = XLSX.utils.json_to_sheet(summaryData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Detail Penjualan");
            XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan Metode");

            // Auto-size columns
            const maxWidth = data.reduce((w, r) => Math.max(w, r['No. Invoice'].length), 10);
            worksheet['!cols'] = [{ wch: maxWidth + 5 }];

            XLSX.writeFile(workbook, `Laporan_Penjualan_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success('Laporan Excel berhasil diunduh');
        } catch (error) {
            console.error('Excel Export Error:', error);
            toast.error('Gagal mengekspor ke Excel');
        }
    };

    const exportToPDF = () => {
        try {
            const doc = new jsPDF();

            // Header
            doc.setFontSize(20);
            doc.text('Laporan Penjualan WinPOS', 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 30);

            // Summary
            doc.setTextColor(0);
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

            // Add Payment Breakdown Table
            const lastY = (doc as any).lastAutoTable.finalY + 15;
            doc.text('Ringkasan per Metode Pembayaran', 14, lastY);

            const breakdownData = salesByPaymentMethod.map(m => [
                m.name,
                m.count.toString(),
                formatCurrency(m.total)
            ]);

            autoTable(doc, {
                startY: lastY + 5,
                head: [['Metode', 'Transaksi', 'Total']],
                body: breakdownData,
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129] }, // Emerald-500
            });

            doc.save(`Laporan_Penjualan_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success('Laporan PDF berhasil diunduh');
        } catch (error) {
            console.error('PDF Export Error:', error);
            toast.error('Gagal mengekspor ke PDF');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Laporan Keuangan</h2>
                    <p className="text-gray-500 mt-1">Ringkasan performa penjualan dan transaksi bisnis Anda.</p>
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
                </div>
            </div>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Total Penjualan</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(totalSales)}</h3>
                    <p className="text-xs text-gray-400 mt-2 font-medium">Dari data yang difilter</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-4 text-purple-600">
                        <ShoppingBag className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Total Transaksi</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{totalTransactions}</h3>
                    <p className="text-xs text-gray-400 mt-2 font-medium">Transaksi berhasil selesai</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-4 text-orange-600">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Rata-rata Order</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(totalTransactions > 0 ? totalSales / totalTransactions : 0)}</h3>
                    <p className="text-xs text-gray-400 mt-2 font-medium">Nilai rata-rata per struk</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4 text-red-600">
                        <Printer className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Retur & Refund</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(totalRefunded)}</h3>
                    <p className="text-xs text-red-500 mt-2 font-medium">{totalReturned} Transaksi diretur</p>
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

            {/* Payment Method Breakdown */}
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
                                <th className="px-8 py-4">No. Invoice</th>
                                <th className="px-8 py-4">Tanggal</th>
                                <th className="px-8 py-4">Metode</th>
                                <th className="px-8 py-4 text-right">Total</th>
                                <th className="px-8 py-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredSales.length === 0 ? (
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
                                            <span className="text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg">
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
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
