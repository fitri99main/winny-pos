import { ProductCategory } from '@/types/pos';
import { motion } from 'framer-motion';

interface CategoryTabsProps {
  categories: ProductCategory[];
  activeCategory: ProductCategory;
  onCategoryChange: (category: ProductCategory) => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
      {categories.map((category) => (
        <motion.button
          key={category}
          whileTap={{ scale: 0.95 }}
          onClick={() => onCategoryChange(category)}
          className={`px-6 py-2.5 rounded-full font-medium text-sm whitespace-nowrap transition-all duration-200 ${
            activeCategory === category
              ? 'bg-pos-coral text-white shadow-md'
              : 'bg-white text-pos-charcoal hover:bg-gray-50'
          }`}
        >
          {category}
        </motion.button>
      ))}
    </div>
  );
}
