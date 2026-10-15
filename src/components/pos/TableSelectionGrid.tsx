import { useState } from 'react';
import { motion } from 'framer-motion';
import { Store, Users, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface Table {
    id: number;
    number: string;
    capacity?: number;
    status: string;
}

interface TableSelectionGridProps {
    tables: Table[];
    occupiedTableNumbers: Set<string>;
    onSelectTable: (table: Table) => void;
    onClearTable?: (tableNo: string) => void;
    onBack: () => void;
}

export function TableSelectionGrid({
    tables,
    occupiedTableNumbers,
    onSelectTable,
    onClearTable,
    onBack,
}: TableSelectionGridProps) {

    return (
        <div className="flex flex-col h-full bg-gray-50/50">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-6 bg-white border-b border-gray-200 gap-3">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        onClick={onBack}
                        className="hover:bg-gray-100 rounded-xl px-2.5 sm:px-4 h-9"
                    >
                        <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                        <span className="text-sm">Kembali</span>
                    </Button>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-gray-800">Pilih Meja</h1>
                        <p className="text-gray-500 text-xs sm:text-sm">Pilih meja untuk memulai pesanan</p>
                    </div>
                </div>

                {/* Manual & Legend */}
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 bg-gray-50 p-1 sm:p-1.5 rounded-xl border border-gray-200 flex-1 sm:flex-initial">
                        <input
                            id="manual-table-input"
                            type="text"
                            placeholder="Nomor Meja..."
                            className="bg-transparent border-none focus:ring-0 text-xs sm:text-sm px-2 w-full sm:w-32 outline-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value;
                                    if (val.trim()) {
                                        onSelectTable({ id: Date.now(), number: val.trim().toUpperCase(), status: 'Available' });
                                    }
                                }
                            }}
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs rounded-lg bg-white shadow-sm hover:bg-gray-100 shrink-0"
                            onClick={() => {
                                const input = document.getElementById('manual-table-input') as HTMLInputElement;
                                if (input && input.value.trim()) {
                                    onSelectTable({ id: Date.now(), number: input.value.trim().toUpperCase(), status: 'Available' });
                                }
                            }}
                        >
                            Pilih
                        </Button>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white border-2 border-green-500 shadow-sm" />
                            <span className="text-gray-600">Kosong</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-red-50 border-2 border-red-500 shadow-sm" />
                            <span className="text-gray-600">Terisi</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6">
                    {(tables || []).length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                            <Store className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">Belum ada meja</p>
                            <p className="text-sm">Konfigurasi meja untuk cabang ini di menu Pengaturan</p>
                        </div>
                    ) : (
                        (tables || []).filter(t => t && t.number).map((table) => {
                            const isOccupied = occupiedTableNumbers.has(table.number) || table.status === 'Occupied';

                            return (
                                <motion.div
                                    key={table.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => onSelectTable(table)}
                                    className={cn(
                                        "relative aspect-square rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center justify-center gap-2 sm:gap-3 transition-all p-2.5 sm:p-4 shadow-sm hover:shadow-md cursor-pointer",
                                        isOccupied
                                            ? "bg-red-50 border-red-200 text-red-700"
                                            : "bg-white border-green-100 hover:border-green-500 hover:bg-green-50/30 text-gray-700"
                                    )}
                                >
                                    <div className={cn(
                                        "w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-base sm:text-xl font-bold transition-colors",
                                        isOccupied
                                            ? "bg-red-100 text-red-600"
                                            : "bg-green-100 text-green-600 group-hover:bg-green-200"
                                    )}>
                                        {table.number}
                                    </div>

                                    <div className="text-center">
                                        <p className={cn(
                                            "font-bold text-xs sm:text-sm uppercase tracking-wider mb-0.5 sm:mb-1",
                                            isOccupied ? "text-red-600" : "text-gray-500"
                                        )}>
                                            {isOccupied ? 'Terisi' : 'Kosong'}
                                        </p>
                                        {table.capacity && (
                                            <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs opacity-60">
                                                <Users className="w-3 h-3" />
                                                <span>{table.capacity} Org</span>
                                            </div>
                                        )}
                                    </div>

                                    {isOccupied && (
                                        <>
                                            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                                            {onClearTable && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onClearTable(table.number);
                                                    }}
                                                    className="mt-1 sm:mt-2 w-full py-1.5 sm:py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-colors border border-red-200"
                                                >
                                                    Kosongkan
                                                </button>
                                            )}
                                        </>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
