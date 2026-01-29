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
  image_url?: string;
}

export interface OrderItem {
  id: string;
  product: Product;
  quantity: number;
  modifiers?: string[];
  selectedAddons?: Addon[];
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
