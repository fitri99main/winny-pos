import { Search, ScanLine } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onScanClick: () => void;
}

export function SearchBar({
  searchQuery,
  onSearchChange,
  onScanClick,
}: SearchBarProps) {
  return (
    <div className="flex gap-2 sm:gap-3 items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
        <Input
          type="text"
          placeholder="Cari produk..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 sm:pl-12 pr-4 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-white border-0 shadow-sm text-xs sm:text-base"
        />
      </div>
      <button
        onClick={onScanClick}
        className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center bg-white rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-all shrink-0 active:scale-95"
      >
        <ScanLine className="w-5 h-5 sm:w-6 sm:h-6 text-pos-charcoal" />
      </button>
    </div>
  );
}
