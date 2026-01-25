import { FileText } from 'lucide-react';

export function ReportsView() {
    return (
        <div className="p-8 flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Laporan</h2>
            <p className="text-gray-500 mt-2">Lihat laporan penjualan, keuangan, dan inventaris.</p>
        </div>
    );
}
