export type ProductCategory = string;

export interface Addon {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: ProductCategory;
  image: string;
  stock: number;
  target?: 'Kitchen' | 'Bar' | 'Waitress';
  recipe?: { ingredientId: number; amount: number }[];
  addons?: Addon[];
  is_sellable?: boolean;
  is_taxed?: boolean;
  is_stock_ready?: boolean;
  image_url?: string;
  sort_order?: number;
  is_best_seller?: boolean;
}

export interface OrderItem {
  id: string;
  product: Product;
  quantity: number;
  modifiers?: string[];
  selectedAddons?: Addon[];
  notes?: string;
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
    reason?: string;
  };
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'active' | 'held' | 'completed';
  tableNo?: string;
  customerName?: string;
  createdAt: Date;
}

export type PaymentMethod = 'cash' | 'card' | 'e-wallet';

export interface Payment {
  method: PaymentMethod;
  amount: number;
  change?: number;
  eWalletProvider?: 'GoPay' | 'OVO' | 'DANA' | 'ShopeePay';
}

export interface Transaction {
  orderId: string;
  payment: Payment;
  receipt: {
    items: OrderItem[];
    subtotal: number;
    discount: number;
    total: number;
    tableNo?: string;
    customerName?: string;
    timestamp: Date;
  };
}
export interface Promo {
  id: number;
  name: string;
  description: string | null;
  type: 'manual' | 'automatic';
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_spend: number;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  branch_id: number | null;
  created_at?: string;
}

export interface PromoProduct {
  promo_id: number;
  product_id: string;
}
