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
            <div className="flex items-center justify-between p-6 bg-white border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={onBack}
                        className="hover:bg-gray-100 rounded-xl"
                    >
                        <RotateCcw className="w-5 h-5 mr-2" />
                        Kembali
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Pilih Meja</h1>
                        <p className="text-gray-500 text-sm">Silakan pilih meja untuk memulai pesanan</p>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 text-sm font-medium">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-white border-2 border-green-500 shadow-sm" />
                        <span className="text-gray-600">Kosong</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-50 border-2 border-red-500 shadow-sm" />
                        <span className="text-gray-600">Terisi</span>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {(tables || []).filter(t => t && t.number).map((table) => {
                        const isOccupied = occupiedTableNumbers.has(table.number) || table.status === 'Occupied';

                        return (
                            <motion.button
                                key={table.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onSelectTable(table)}
                                className={cn(
                                    "relative aspect-square rounded-3xl border-2 flex flex-col items-center justify-center gap-3 transition-all p-4 shadow-sm hover:shadow-md",
                                    isOccupied
                                        ? "bg-red-50 border-red-200 text-red-700"
                                        : "bg-white border-green-100 hover:border-green-500 hover:bg-green-50/30 text-gray-700"
                                )}
                            >
                                <div className={cn(
                                    "w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold transition-colors",
                                    isOccupied
                                        ? "bg-red-100 text-red-600"
                                        : "bg-green-100 text-green-600 group-hover:bg-green-200"
                                )}>
                                    {table.number}
                                </div>

                                <div className="text-center">
                                    <p className={cn(
                                        "font-bold text-sm uppercase tracking-wider mb-1",
                                        isOccupied ? "text-red-600" : "text-gray-500"
                                    )}>
                                        {isOccupied ? 'Terisi' : 'Kosong'}
                                    </p>
                                    {table.capacity && (
                                        <div className="flex items-center justify-center gap-1 text-xs opacity-60">
                                            <Users className="w-3 h-3" />
                                            <span>{table.capacity} Org</span>
                                        </div>
                                    )}
                                </div>

                                {isOccupied && (
                                    <>
                                        <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                                        {onClearTable && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onClearTable(table.number);
                                                }}
                                                className="mt-2 w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-red-200"
                                            >
                                                Kosongkan
                                            </button>
                                        )}
                                    </>
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
