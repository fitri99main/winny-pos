import { FileText, Download, FileSpreadsheet, Printer, TrendingUp, DollarSign, ShoppingBag } from 'lucide-react';
import { SalesOrder, SalesReturn } from '../pos/SalesView';
import { Button } from '../ui/button';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface ReportsViewProps {
    sales: SalesOrder[];
    returns: SalesReturn[];
}

export function ReportsView({ sales, returns }: ReportsViewProps) {
    const totalSales = sales.reduce((sum, s) => sum + (s.status === 'Completed' ? s.totalAmount : 0), 0);
    const totalTransactions = sales.filter(s => s.status === 'Completed').length;
    const totalReturned = sales.filter(s => s.status === 'Returned').length;
    const totalRefunded = returns.reduce((sum, r) => sum + r.refundAmount, 0);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const exportToExcel = () => {
        try {
            const data = sales.map(s => ({
                'No. Invoice': s.orderNo,
                'Tanggal': s.date,
                'Items': s.items,
                'Total Amount': s.totalAmount,
                'Metode Pembayaran': s.paymentMethod,
                'Status': s.status === 'Completed' ? 'Selesai' : 'Retur',
                'Pelayan': s.waiterName || '-',
                'Meja': s.tableNo || '-'
            }));

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Penjualan");

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

            const tableData = sales.map(s => [
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
                    <div className="flex items-center gap-1 mt-2 text-xs text-green-600 font-bold">
                        <span>+12.5%</span>
                        <span className="text-gray-400 font-medium">dari bulan lalu</span>
                    </div>
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

            {/* List Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 text-lg">Riwayat Transaksi Terakhir</h3>
                    <Button variant="ghost" className="text-sm text-indigo-600 font-bold hover:bg-indigo-50">Filter & Cari</Button>
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
                            {sales.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-12 text-center text-gray-400">Belum ada data transaksi</td>
                                </tr>
                            ) : (
                                sales.slice(0, 10).map((sale) => (
                                    <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-8 py-5 font-mono text-sm font-bold text-gray-700">{sale.orderNo}</td>
                                        <td className="px-8 py-5 text-sm text-gray-500">{sale.date}</td>
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
