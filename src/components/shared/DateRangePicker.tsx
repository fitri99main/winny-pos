import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { Button } from '../ui/button';

interface DateRange {
    startDate: string;
    endDate: string;
}

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onChange: (range: DateRange) => void;
    className?: string;
}

const PRESETS = [
    { label: 'Hari Ini', id: 'today' },
    { label: 'Kemarin', id: 'yesterday' },
    { label: 'Minggu Ini', id: 'this_week' },
    { label: 'Bulan Ini', id: 'this_month' },
    { label: 'Bulan Lalu', id: 'last_month' },
    { label: 'Tahun Ini', id: 'this_year' },
    { label: 'Semua Waktu', id: 'all_time' },
];

const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export function DateRangePicker({ startDate, endDate, onChange, className = '' }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePresetClick = (id: string) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let start = new Date();
        let end = new Date();

        switch (id) {
            case 'today':
                // Already set to now/now
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            case 'this_week':
                const day = now.getDay(); // 0 is Sunday
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
                start = new Date(now.setDate(diff));
                end = new Date();
                break;
            case 'this_month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'this_year':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                break;
            case 'all_time':
                start = new Date(2020, 0, 1);
                end = new Date(2030, 11, 31);
                break;
        }

        onChange({
            startDate: formatDateForInput(start),
            endDate: formatDateForInput(end)
        });
        setIsOpen(false);
    };

    const activePreset = PRESETS.find(p => {
        // Logic to detect if current dates match a preset could go here, 
        // but for now we'll just show the menu
        return false;
    });

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded-lg transition-colors border-r"
                >
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-gray-700">Filter Tanggal</span>
                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className="flex items-center gap-1 px-2">
                    <input
                        type="date"
                        className="text-[10px] p-1 border-none focus:ring-0 cursor-pointer text-gray-600 font-medium"
                        value={startDate}
                        onChange={(e) => onChange({ startDate: e.target.value, endDate })}
                    />
                    <span className="text-gray-300 text-[10px]">-</span>
                    <input
                        type="date"
                        className="text-[10px] p-1 border-none focus:ring-0 cursor-pointer text-gray-600 font-medium"
                        value={endDate}
                        onChange={(e) => onChange({ startDate, endDate: e.target.value })}
                    />
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                    <div className="p-2 space-y-1">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => handlePresetClick(preset.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-600 hover:bg-primary/5 hover:text-primary rounded-lg transition-all text-left group"
                            >
                                <span className="font-medium">{preset.label}</span>
                                <Check className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
