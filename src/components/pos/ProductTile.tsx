import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Coffee } from 'lucide-react';
import { Product } from '@/types/pos';
import { getAcronym } from '@/lib/utils';

interface ProductTileProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function ProductTile({ product, onAddToCart }: ProductTileProps) {
  const imageSources = useMemo(
    () => [product.image_url, product.image].filter((source): source is string => Boolean(source && source.trim())),
    [product.image_url, product.image]
  );
  const [imageIndex, setImageIndex] = useState(0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price || 0);
  };

  const activeImage = imageSources[imageIndex];
  const hasImage = Boolean(activeImage);

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15, type: 'spring', stiffness: 400 }}
      onClick={() => onAddToCart(product)}
      className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-white soft-shadow transition-shadow duration-200 group hover:shadow-lg"
    >
      <div className="relative aspect-square min-h-[104px] overflow-hidden bg-gray-50">
        {hasImage ? (
          <img
            src={activeImage}
            alt={product.name}
            loading="lazy"
            onError={() => setImageIndex((current) => current + 1)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-orange-50 via-amber-50 to-white px-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
              <Coffee className="h-6 w-6 text-orange-500" />
            </div>
            <span className="text-lg font-black tracking-tight text-orange-400">
              {getAcronym(product?.name || '')}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div className="flex flex-1 flex-col p-2 text-left sm:p-3">
        <h3 className="mb-0.5 line-clamp-2 text-xs font-medium text-pos-charcoal sm:text-sm">
          {product?.name || 'Unknown Product'}
        </h3>
        <p className="font-mono text-sm font-bold text-pos-coral sm:text-base">
          {formatPrice(product.price)}
        </p>
        {product.stock < 10 && product.stock > 0 && (
          <p className="mt-0.5 text-[10px] text-orange-600">
            Stok: {product.stock}
          </p>
        )}
      </div>
      {(product.stock === 0 && !product.is_stock_ready) && (
        <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center">
          <span className="text-white font-bold text-sm px-4 py-2 bg-red-500 rounded-lg">
            Out of Stock
          </span>
        </div>
      )}
    </motion.button>
  );
}
