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
    <div className="flex gap-3 items-center">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          type="text"
          placeholder="Cari produk..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-12 pr-4 py-6 rounded-2xl bg-white border-0 shadow-sm text-base"
        />
      </div>
      <button
        onClick={onScanClick}
        className="p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <ScanLine className="w-6 h-6 text-pos-charcoal" />
      </button>
    </div>
  );
}
