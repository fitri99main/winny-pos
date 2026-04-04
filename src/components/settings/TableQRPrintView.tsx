import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';

interface Table {
    id: number;
    number: string;
    capacity?: number;
}

interface TableQRPrintViewProps {
    tables: Table[];
    branchId: string;
    onBack: () => void;
}

export function TableQRPrintView({ tables, branchId, onBack }: TableQRPrintViewProps) {
    const baseUrl = window.location.origin;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex flex-col h-full bg-white print:p-0">
            {/* Header - Hidden on Print */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50 print:hidden shrink-0">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={onBack}
                        className="hover:bg-white rounded-xl"
                    >
                        <RotateCcw className="w-5 h-5 mr-2" />
                        Kembali Ke Pengaturan
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Cetak QR Meja</h1>
                        <p className="text-gray-500 text-sm">Gunakan kertas A4 untuk mencetak semua kode QR meja.</p>
                    </div>
                </div>

                <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                    <Printer className="w-4 h-4 mr-2" />
                    Cetak Sekarang
                </Button>
            </div>

            {/* Print Layout */}
            <div className="flex-1 overflow-y-auto p-8 print:p-0">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 print:grid-cols-3 print:gap-4 max-w-5xl mx-auto">
                    {tables.map((table) => {
                        const qrUrl = `${baseUrl}/kiosk?branch_id=${branchId}&table_no=${table.number}`;
                        
                        return (
                            <div 
                                key={table.id} 
                                className="flex flex-col items-center p-6 border-2 border-gray-100 rounded-3xl bg-white print:border-gray-300 print:rounded-none print:p-4 print:break-inside-avoid"
                            >
                                <div className="mb-4 text-center">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Winny Pangeran Natakusuma</p>
                                    <h2 className="text-2xl font-black text-gray-900">MEJA {table.number}</h2>
                                </div>
                                
                                <div className="bg-white p-3 rounded-2xl border border-gray-50 shadow-sm print:shadow-none print:border-gray-200">
                                    <QRCodeSVG 
                                        value={qrUrl} 
                                        size={160}
                                        level="H"
                                        includeMargin={false}
                                    />
                                </div>
                                
                                <div className="mt-4 text-center space-y-1">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Scan untuk Pesan</p>
                                    <p className="text-[8px] text-gray-300 font-mono break-all max-w-[150px] mx-auto opacity-50">
                                        {qrUrl.replace('https://', '')}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 1cm;
                    }
                    body {
                        background: white !important;
                    }
                    nav, header, aside, .print\\:hidden {
                        display: none !important;
                    }
                    .flex-1 {
                        overflow: visible !important;
                        height: auto !important;
                    }
                }
            `}</style>
        </div>
    );
}
