import { motion } from 'framer-motion';
import { Product } from '@/types/pos';

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
    }).format(price);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15, type: 'spring', stiffness: 400 }}
      onClick={() => onAddToCart(product)}
      className="relative bg-white rounded-2xl overflow-hidden soft-shadow hover:shadow-lg transition-shadow duration-200 group"
    >
      <div className="aspect-square overflow-hidden bg-gray-100">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-2 text-left">
        <h3 className="font-medium text-pos-charcoal text-xs mb-0.5 line-clamp-1">
          {product.name}
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
