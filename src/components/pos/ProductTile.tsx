import { motion } from 'framer-motion';
import { ShoppingCart, Coffee } from 'lucide-react';
import { Product } from '@/types/pos';
import { getAcronym } from '@/lib/utils';

interface ProductTileProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function ProductTile({ product, onAddToCart }: ProductTileProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price || 0);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15, type: 'spring', stiffness: 400 }}
      onClick={() => onAddToCart(product)}
      className="relative bg-white rounded-2xl overflow-hidden soft-shadow hover:shadow-lg transition-shadow duration-200 group"
    >
      <div className="aspect-square overflow-hidden bg-gray-50 flex items-center justify-center relative group">
        {product.image_url || product.image ? (
          <img
            src={product.image_url || product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full bg-primary/5 flex items-center justify-center relative">
            <span className="text-2xl font-black text-primary/40 font-mono tracking-tighter">
              {getAcronym(product?.name || '')}
            </span>
            {/* Keeping it simple like Kiosk - no acronym */}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div className="p-2 text-left">
        <h3 className="font-medium text-pos-charcoal text-xs mb-0.5 line-clamp-1">
          {product?.name || 'Unknown Product'}
        </h3>
        <p className="font-mono font-bold text-pos-coral text-sm">
          {formatPrice(product.price)}
        </p>
        {product.stock < 10 && product.stock > 0 && (
          <p className="text-[10px] text-orange-600 mt-0.5">
            Stok: {product.stock}
          </p>
        )}
      </div>
      {product.stock === 0 && (
        <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center">
          <span className="text-white font-bold text-sm px-4 py-2 bg-red-500 rounded-lg">
            Out of Stock
          </span>
        </div>
      )}
    </motion.button>
  );
}
