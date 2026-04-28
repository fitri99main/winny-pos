import { useState, useMemo, useEffect, useRef } from 'react';
import { ProductCategory, OrderItem, Product, Promo, PromoProduct } from '@/types/pos';
// import { mockProducts } from '@/data/products'; // REMOVED
import { SearchBar } from './SearchBar';
import { CategoryTabs } from './CategoryTabs';
import { ProductTile } from './ProductTile';
import { OrderPanel } from './OrderPanel';
import { QuickActionsBar } from './QuickActionsBar';
import { DiscountModal } from './DiscountModal';
import { PaymentModal } from './PaymentModal';
import { SuccessModal } from './SuccessModal';
import { ManualItemModal } from './ManualItemModal';
import { HeldOrdersModal } from './HeldOrdersModal';
import { SplitBillModal } from './SplitBillModal';
import { NewOrderModal } from './NewOrderModal'; // [NEW] Import NewOrderModal
import { TableSelectionGrid, Table } from './TableSelectionGrid';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { ArrowLeft, ShoppingCart, Store, User, Users, ChevronDown, Check, Puzzle, LogOut, Cake, CreditCard, Search, Star, FileText, Table2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { useSessionGuard } from '../auth/SessionGuardContext';
import { CashierSessionModal } from './CashierSessionModal';
import { printerService } from '../../lib/PrinterService';
import { ManagerAuthModal } from '../shared/ManagerAuthModal';
import { ContactData } from '../contacts/ContactsView';
import { Addon } from '@/types/pos';
import { useIsMobile } from '@/hooks/use-mobile';

// const categories: ProductCategory[] = ['Semua', 'Makanan', 'Minuman', 'Camilan', 'Pencuci Mulut']; // REMOVED

interface CashierInterfaceProps {
  onBack?: () => void;
  onAddSale?: (sale: {
    id?: number; // Optional ID for updating existing sales
    order_no?: string; // Optional order_no for safety checks
    items: number;
    totalAmount: number;
    paymentMethod: string;
    productDetails: { name: string; quantity: number; price: number; isManual?: boolean }[];
    tableNo?: string;
    customerName?: string;
    waiterName?: string;
    subtotal?: number;
    discount?: number;
    paidAmount?: number;
    change?: number;
    tax?: number;
    service?: number;
  }) => void;
  orderItems: OrderItem[];
  orderDiscount: number;
  setOrderItems: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  setOrderDiscount: React.Dispatch<React.SetStateAction<number>>;
  contacts: ContactData[];
  employees: any[];
  onSendToKDS?: (order: any) => void;
  products: Product[];
  categories: any[];
  tables: any[];
  activeSales?: any[]; // Passed from Home to determine occupancy
  paymentMethods?: any[];
  onDeleteSale?: (id: number) => void | Promise<void>;
  onClearTableStatus?: (tableNo: string) => void;
  settings?: any;
  initialTable?: string;
  onPaymentSuccess?: () => void;
  autoOpenPayment?: boolean;
  autoOpenSaleId?: number | null;
  onAutoPaymentProcessed?: () => void;
  topSellingProducts?: string[];
}

interface HeldOrder {
  id: string;
  items: OrderItem[];
  discount: number;
  total: number;
  createdAt: Date;
}

export function CashierInterface({
  onBack,
  onAddSale,
  orderItems,
  orderDiscount,
  setOrderItems,
  setOrderDiscount,
  contacts,
  employees,
  onSendToKDS,
  products = [],
  categories = [],
  tables = [],
  activeSales = [],
  paymentMethods = [],
  onDeleteSale,
  onClearTableStatus,
  settings = {},
  initialTable = '',
  onPaymentSuccess,
  autoOpenPayment,
  autoOpenSaleId,
  onAutoPaymentProcessed,
  topSellingProducts = []
}: CashierInterfaceProps) {
  const isMobile = useIsMobile();
  // console.log('CashierInterface Props:', { productsLength: products?.length, categoriesLength: categories?.length }); 
  // Removed verbose log to prevent crash on undefined properties
  const [viewMode, setViewMode] = useState<'tables' | 'pos'>(
    (settings?.enable_table_management === false && !initialTable) ? 'pos' : 'tables'
  );
  const [selectedTable, setSelectedTable] = useState<string>(initialTable || '');

  // Handle setting updates for viewMode
  useEffect(() => {
    if (settings?.enable_table_management === false && viewMode === 'tables') {
      setViewMode('pos');
    }
  }, [settings?.enable_table_management]);

  // Auto-switch to POS mode if table is provided initially
  useEffect(() => {
    console.log('CashierInterface Effect - initialTable:', initialTable);
    if (initialTable) {
      console.log('Setting selected table to:', initialTable);
      setSelectedTable(initialTable);
      setViewMode('pos');
    }
  }, [initialTable]);
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [manualItemModalOpen, setManualItemModalOpen] = useState(false);
  const [heldOrdersModalOpen, setHeldOrdersModalOpen] = useState(false);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [splitBillModalOpen, setSplitBillModalOpen] = useState(false);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [itemsToSplit, setItemsToSplit] = useState<OrderItem[]>([]);
  const [lastPaymentChange, setLastPaymentChange] = useState<number | undefined>();
  const [lastPaymentTotal, setLastPaymentTotal] = useState<number>(0);
  const [lastSaleData, setLastSaleData] = useState<any>(null); // [NEW] Track last sale for printing
  // const [selectedTable, setSelectedTable] = useState<string>(''); // Removed duplicate
  const [customerName, setCustomerName] = useState<string>('');
  const [waiterName, setWaiterName] = useState('');
  const [currentSaleId, setCurrentSaleId] = useState<number | undefined>(undefined); // Track ID of hydrated order
  const [currentOrderNo, setCurrentOrderNo] = useState<string | undefined>(undefined); // Track Order No
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [addonPendingProduct, setAddonPendingProduct] = useState<Product | null>(null);
  const [tempSelectedAddons, setTempSelectedAddons] = useState<Addon[]>([]);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false); // [NEW] State for incoming order modal
  const [managerAuthModalOpen, setManagerAuthModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState<{
    action: 'discount' | 'hold' | 'deleteHeld' | 'restoreHeld';
    data?: any;
  } | null>(null);

  // Helper to check if current user is manager/admin or if action is restricted
  const checkAuth = (action: 'discount' | 'hold' | 'deleteHeld' | 'restoreHeld'): boolean => {
    if (isAdmin) return true;

    // Check specific restrictions from settings
    const isRestricted = (
      (action === 'discount' && settings?.restrict_cashier_discount) ||
      (action === 'hold' && settings?.restrict_cashier_hold) ||
      (action === 'deleteHeld' && settings?.restrict_cashier_delete)
    );

    return !isRestricted;
  };

  // Shift Session State (Managed by Context)
  const { role, loading } = useAuth();
  const isAdmin = useMemo(() => {
    const lowerRole = role?.toLowerCase() || '';
    return lowerRole === 'admin' || lowerRole === 'administrator' || lowerRole === 'owner' || lowerRole === 'superadmin';
  }, [role]);
  const { currentSession, checkSession, requireMandatorySession } = useSessionGuard();
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionMode, setSessionMode] = useState<'open' | 'close'>('open');

  useEffect(() => {
    checkSession();
  }, []);
  
  // [NEW] Handle Auto-Open Payment for in-app orders
  useEffect(() => {
    if (orderItems.length > 0) {
      if (autoOpenPayment && !paymentModalOpen) {
        console.log('[Cashier] Items detected for auto-payment. Triggering modal in 500ms...');
        const timer = setTimeout(() => {
          // Double check status before opening
          if (autoOpenPayment && orderItems.length > 0) {
            console.log('[Cashier] Auto-opening payment modal now');
            setPaymentModalOpen(true);
            if (onAutoPaymentProcessed) onAutoPaymentProcessed();
          }
        }, 500); // 500ms stabilization delay
        return () => clearTimeout(timer);
      } else if (autoOpenSaleId && !autoOpenPayment && !newOrderModalOpen && !paymentModalOpen) {
        // [NEW] Auto-open the review modal instead
        console.log('[Cashier] Items detected for auto-review. Triggering confirmation modal in 500ms...');
        const timer = setTimeout(() => {
          if (autoOpenSaleId && !autoOpenPayment && orderItems.length > 0) {
            console.log('[Cashier] Auto-opening new order review modal now');
            setNewOrderModalOpen(true);
            if (onAutoPaymentProcessed) onAutoPaymentProcessed(); // Clear the flag so it only pops once
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    } else if ((autoOpenPayment || autoOpenSaleId) && orderItems.length === 0) {
      console.log('[Cashier] Auto-action pending... waiting for items to hydrate');
    }
  }, [autoOpenPayment, autoOpenSaleId, orderItems.length, paymentModalOpen, newOrderModalOpen, onAutoPaymentProcessed]);

  // Enforce Mandatory Session
  useEffect(() => {
    if (loading) return; // Tunggu hingga data user/role selesai dimuat
    const lowerRole = role?.toLowerCase() || '';
    const isAdmin = lowerRole === 'admin' || lowerRole === 'administrator' || lowerRole === 'owner';
    if (!currentSession && requireMandatorySession && !sessionModalOpen && !isAdmin) {
      setSessionMode('open');
      setSessionModalOpen(true);
    }
  }, [currentSession, requireMandatorySession, role, sessionModalOpen, loading]);

  // Calculate occupied tables based on active sales AND table status
  const occupiedTableNumbers = useMemo(() => {
    const occupied = new Set<string>();

    // 1. Check Active Sales (Pending/Unpaid)
    if (activeSales) {
      activeSales.forEach(sale => {
        if (sale && ['Unpaid', 'Pending'].includes(sale.status) && sale.tableNo) {
          occupied.add(String(sale.tableNo).trim().toUpperCase());
        }
      });
    }

    // 2. Check Table Status from DB (for tables manually cleared or forced occupied)
    if (tables) {
      tables.forEach(t => {
        if (t.status === 'Occupied') {
          occupied.add(t.number);
        }
      });
    }

    return occupied;
  }, [activeSales, tables]);

  const membershipDiscounts: Record<string, number> = {
    'Regular': 0,
    'Silver': 0.05,
    'Gold': 0.10,
    'Platinum': 0.15
  };

  const selectedCustomer = useMemo(() =>
    (contacts || []).find(c => c.id === selectedCustomerId),
    [selectedCustomerId, contacts]
  );

  // const tables = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'B1', 'B2', 'B3']; // REMOVED

  // Filter products
  const filteredProducts = useMemo(() => {
    let currentProducts = (products || []).filter(p => p && p.id); // SAFEGUARD: Remove invalid items early

    if (activeCategory !== 'Semua') {
      currentProducts = currentProducts.filter((p) => 
        (p.category || '').trim().toLowerCase() === activeCategory.trim().toLowerCase()
      );
    }

    // Filter by sellable status and stock readiness
    currentProducts = currentProducts.filter((p) => p.is_sellable !== false && p.is_stock_ready !== false);

    if (searchQuery) {
      currentProducts = currentProducts.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort: Best Selling first, then by sort_order
    return currentProducts
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [activeCategory, searchQuery, products, topSellingProducts]);

  const taxableSubtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      if (item.product.is_taxed === false) return sum;
      const addonsPrice = item.selectedAddons?.reduce((aSum, a) => aSum + a.price, 0) || 0;
      return sum + (item.product.price + addonsPrice) * item.quantity;
    }, 0);
  }, [orderItems]);

  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const addonsPrice = item.selectedAddons?.reduce((aSum, a) => aSum + a.price, 0) || 0;
      return sum + (item.product.price + addonsPrice) * item.quantity;
    }, 0);
  }, [orderItems]);

  // --- Promo Management ---
  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const { data: promosData, error: promosError } = await supabase
          .from('promos')
          .select('*')
          .eq('is_active', true);

        if (promosError) throw promosError;

        const { data: mappingData, error: mappingError } = await supabase
          .from('promo_products')
          .select('*');

        if (mappingError) throw mappingError;

        setPromos(promosData || []);
        setPromoProducts(mappingData || []);
      } catch (err) {
        console.error('Error fetching promos:', err);
      }
    };

    fetchPromos();
  }, []);

  // Automatic Promo Application
  useEffect(() => {
    if (orderItems.length === 0) {
      setAutomaticDiscount(0);
      return;
    }

    const activePromos = promos.filter(p => {
      if (p.type !== 'automatic') return false;
      const now = new Date();
      if (p.start_date && new Date(p.start_date) > now) return false;
      if (p.end_date && new Date(p.end_date) < now) return false;
      
      // Time check
      if (p.start_time || p.end_time) {
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        if (p.start_time) {
          const [h, m] = p.start_time.split(':').map(Number);
          const startTime = h * 60 + m;
          if (currentTime < startTime) return false;
        }
        
        if (p.end_time) {
          const [h, m] = p.end_time.split(':').map(Number);
          const endTime = h * 60 + m;
          if (currentTime > endTime) return false;
        }
      }

      return true;
    });

    let totalAutoDiscount = 0;

    activePromos.forEach(promo => {
      // Check min spend
      if (subtotal < promo.min_spend) return;

      // Check applicable products
      const applicableProductIds = promoProducts
        .filter(pp => pp.promo_id === promo.id)
        .map(pp => pp.product_id);

      let discountableAmount = 0;
      if (applicableProductIds.length === 0) {
        // Applies to all
        discountableAmount = subtotal;
      } else {
        // Applies only to specific products
        discountableAmount = orderItems.reduce((sum, item) => {
          if (applicableProductIds.includes(String(item.product.id))) {
            const addonsPrice = item.selectedAddons?.reduce((aSum, a) => aSum + a.price, 0) || 0;
            return sum + (item.product.price + addonsPrice) * item.quantity;
          }
          return sum;
        }, 0);
      }

      if (discountableAmount > 0) {
        if (promo.discount_type === 'percentage') {
          totalAutoDiscount += (discountableAmount * promo.discount_value) / 100;
        } else {
          totalAutoDiscount += promo.discount_value;
        }
      }
    });

    setAutomaticDiscount(totalAutoDiscount);
    // Note: Automatic discount is added to orderDiscount visually in the calculation
  }, [orderItems, promos, promoProducts, subtotal]);

  // Calculate totals

  const totalDiscount = orderDiscount + automaticDiscount;
  const discountRatio = subtotal > 0 ? (subtotal - totalDiscount) / subtotal : 0;
  const taxableAmount = taxableSubtotal * discountRatio;
  const taxRate = settings?.tax_rate || 0;
  const serviceRate = settings?.service_rate || 0;

  const taxAmount = (taxableAmount * taxRate) / 100;
  const serviceAmount = (taxableAmount * serviceRate) / 100;

  const total = (subtotal - totalDiscount) + taxAmount + serviceAmount;

  // Hydrate order when table or specific sale ID is selected
  useEffect(() => {
    if ((selectedTable || autoOpenSaleId) && activeSales) {
      const existingSale = autoOpenSaleId 
        ? activeSales.find(s => s && s.id === autoOpenSaleId)
        : activeSales.find(
          s => s && (s.status === 'Pending' || s.status === 'Unpaid') && 
              String(s.tableNo || '').trim().toUpperCase() === String(selectedTable || '').trim().toUpperCase()
        );

      if (existingSale) {
        // Reconstruct order items from sale
        const items = existingSale.productDetails.map((detail: any, index: number) => {
          // Find original product to get ID and image if possible, otherwise mock
          const originalProduct = products.find(p => p.name === detail.name);
          return {
            id: `${originalProduct?.id || 'restored'}-${index}`,
            product: originalProduct || {
              id: 0,
              name: detail.name,
              price: detail.price,
              category: 'Others',
              stock: 999
            },
            quantity: detail.quantity,
            selectedAddons: [] // Addons restoration would require more detailed data structure
          };
        });

        setOrderItems(items);
        setCustomerName(existingSale.customerName || 'Guest');
        setWaiterName(existingSale.waiterName || '');
        // If there's a discount, we might need to recalculate or restore it
        setOrderDiscount(existingSale.discount || 0);
        setCurrentSaleId(existingSale.id); // [NEW] Track the ID
        setCurrentOrderNo(existingSale.orderNo || (existingSale as any).order_no); // Track Order No
      } else {
        // New order for this table
        setOrderItems([]);
        setCustomerName('Guest');
        setWaiterName('');
        setOrderDiscount(0);
        setCurrentSaleId(undefined); // Reset ID
        setCurrentOrderNo(undefined);
      }
    }
  }, [selectedTable, autoOpenSaleId, activeSales, products]);

  const handleClearTable = (tableNo: string) => {
    const saleToClear = activeSales?.find(
      s => s && (s.status === 'Pending' || s.status === 'Unpaid') && s.tableNo === tableNo
    );

    // Case 1: Active Order found (Unpaid/Pending)
    if (saleToClear && onDeleteSale) {
      if (saleToClear.productDetails && saleToClear.productDetails.length > 0) {
        toast.error('Gagal Mengosongkan Meja', {
          description: 'Meja ini memiliki pesanan aktif yang belum dibayar. Mohon selesaikan pembayaran.',
          duration: 4000
        });
        return;
      }

      if (confirm(`Hapus pesanan kosong dan kosongkan meja ${tableNo}?`)) {
        onDeleteSale(saleToClear.id);
        toast.success(`Meja ${tableNo} Berhasil Dikosongkan`);
      }
    }
    // Case 2: No active order (Table status is Occupied but order is Paid/Completed) OR just forcing clear
    else if (onClearTableStatus) {
      if (confirm(`Kosongkan status meja ${tableNo}? (Pastikan pelanggan sudah meninggalkan meja)`)) {
        onClearTableStatus(tableNo);
      }
    }
    else {
      toast.error('Gagal mengosongkan meja: Fungsi tidak tersedia');
    }
  };

  // Render Table View if mode is 'tables'
  if (viewMode === 'tables') {
    return (
      <TableSelectionGrid
        tables={tables}
        occupiedTableNumbers={occupiedTableNumbers}
        onSelectTable={(table) => {
          setSelectedTable(table.number);
          setViewMode('pos');
        }}
        onClearTable={handleClearTable}
        onBack={onBack || (() => { })}
      />
    );
  }

  // Add to cart
  const handleAddToCart = (product: Product) => {
    if (product.stock === 0 && product.is_stock_ready === false) {
      toast.error('Produk kehabisan stok');
      return;
    }

    if (product.addons && product.addons.length > 0) {
      setAddonPendingProduct(product);
      setTempSelectedAddons([]);
      setIsAddonModalOpen(true);
      return;
    }

    const existingItem = orderItems.find((item) => item.product.id === product.id && (!item.selectedAddons || item.selectedAddons.length === 0));

    if (existingItem) {
      setOrderItems((prev) =>
        prev.map((item) =>
          (item.product.id === product.id && (!item.selectedAddons || item.selectedAddons.length === 0))
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      const newItem: OrderItem = {
        id: `${product.id}-${Date.now()}`,
        product,
        quantity: 1,
      };
      setOrderItems((prev) => [...prev, newItem]);
    }

    toast.success(`${product.name} telah masuk keranjang`);
  };

  const handleConfirmAddons = () => {
    if (!addonPendingProduct) return;

    const newItem: OrderItem = {
      id: `${addonPendingProduct.id}-${Date.now()}`,
      product: addonPendingProduct,
      quantity: 1,
      selectedAddons: tempSelectedAddons,
    };

    setOrderItems((prev) => [...prev, newItem]);
    setIsAddonModalOpen(false);
    setAddonPendingProduct(null);
    setTempSelectedAddons([]);
    toast.success(`${addonPendingProduct.name} dengan toping telah masuk keranjang`);
  };

  // Add manual item
  const handleAddManualItem = (item: { name: string; price: number }) => {
    const manualProduct: Product = {
      id: `manual-${Date.now()}`,
      name: item.name,
      price: item.price,
      category: 'Semua',
      image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=300&h=300', // Default placeholder
      stock: 999,
    };

    const newItem: OrderItem = {
      id: `${manualProduct.id}-${Date.now()}`,
      product: manualProduct,
      quantity: 1,
    };

    setOrderItems((prev) => [...prev, newItem]);
    toast.success(`Berhasil menambahkan: ${item.name}`, {
      description: `Harga: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.price)}`
    });
  };

  // Update quantity
  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      handleRemoveItem(itemId);
      return;
    }

    setOrderItems(
      orderItems.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  // Remove item
  const handleRemoveItem = (itemId: string) => {
    setOrderItems(orderItems.filter((item) => item.id !== itemId));
    toast.info('Item dihapus dari keranjang');
  };

  // Apply discount
  const handleApplyDiscount = (discount: {
    type: 'percentage' | 'fixed';
    value: number;
    reason: string;
  }) => {
    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (subtotal * discount.value) / 100;
    } else {
      discountAmount = discount.value;
    }

    setOrderDiscount(discountAmount);
    toast.success(`Diskon diterapkan: ${discount.reason}`);
  };

  // Handle payment completion
  const handlePaymentComplete = (payment: any) => {
    const transactionTotal = total; // Capture current total before clearing
    setLastPaymentTotal(transactionTotal);
    setLastPaymentChange(payment.change);
    setPaymentModalOpen(false);

    // Auto Open Drawer
    if (settings?.auto_open_drawer) {
      printerService.openDrawer();
    }

    if (isSplitPayment) {
      // Remove split items from main order
      const newItems = [...orderItems];
      itemsToSplit.forEach(splitItem => {
        const index = newItems.findIndex(item => item.id === splitItem.id);
        if (index !== -1) {
          if (newItems[index].quantity === splitItem.quantity) {
            newItems.splice(index, 1);
          } else {
            newItems[index] = {
              ...newItems[index],
              quantity: newItems[index].quantity - splitItem.quantity
            };
          }
        }
      });
      setOrderItems(newItems);
      setIsSplitPayment(false);
      setItemsToSplit([]);
    } else {
      // Regular payment complete - Clear Cart
      setOrderItems([]);
      setOrderDiscount(0);

      if (onPaymentSuccess) {
        onPaymentSuccess();
      } else {
        setSuccessModalOpen(true);
      }
    }

    // Report sale to parent
    if (onAddSale) {
      const itemsToReport = isSplitPayment ? itemsToSplit : orderItems;
      const amountToReport = isSplitPayment
        ? itemsToSplit.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
        : total;

      const salePayload = {
        id: currentSaleId, // Pass the existing ID if available
        order_no: currentOrderNo, // Pass the existing Order No
        items: itemsToReport.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: amountToReport,
        paymentMethod: payment.method,
        productDetails: itemsToReport.map(item => ({
          id: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          category: item.product.category, // [NEW] Pass category
          isManual: String(item.product.id).startsWith('manual-'),
          notes: item.notes,
          target: item.product.target // Pass the target for printing if needed
        })),
        tableNo: selectedTable,
        customerName: customerName,
        waiterName: waiterName,
        subtotal: isSplitPayment ? amountToReport : subtotal,
        discount: isSplitPayment ? 0 : orderDiscount,
        tax: isSplitPayment ? 0 : taxAmount,
        service: isSplitPayment ? 0 : serviceAmount,
        paidAmount: payment.amount || amountToReport,
        change: payment.change || 0,
        time: new Date().toLocaleTimeString()
      };

      setLastSaleData(salePayload);
      onAddSale(salePayload);
    }

    // Always show a small success toast for partial payments if not the full success modal
    if (isSplitPayment) {
      toast.success('Pembayaran Berhasil!', {
        description: 'Pembayaran sebagian telah diterima',
        duration: 3000,
      });
    }
  };

  // Start new transaction
  const handleNewTransaction = () => {
    setOrderItems([]);
    setOrderDiscount(0);
    setSearchQuery('');
    setActiveCategory('Semua');
    setLastPaymentChange(undefined);
  };

  // Hold order
  const handleHoldOrder = () => {
    if (orderItems.length === 0) return;

    const performHold = () => {
      const newHeldOrder: HeldOrder = {
        id: `held-${Date.now()}`,
        items: [...orderItems],
        discount: orderDiscount,
        total,
        createdAt: new Date(),
      };

      setHeldOrders([newHeldOrder, ...heldOrders]);

      // Send to KDS
      if (onSendToKDS) {
        onSendToKDS({
          orderNo: newHeldOrder.id, // Using held ID as temp ref
          tableNo: selectedTable,
          waiterName: waiterName,
          productDetails: orderItems.map(item => ({
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            target: item.product.target, // Pass the target attribute
            notes: item.notes
          }))
        });
      }

      // [NEW] Smart Production Printing on HOLD
      if (settings?.enable_print_at_hold) {
          const waiterShort = (waiterName || 'Cashier').split(' ')[0];
          const kitchenItems = orderItems.filter(item => item.product.target === 'Kitchen' || item.product.category?.toLowerCase().includes('makan'));
          const barItems = orderItems.filter(item => item.product.target === 'Bar' || item.product.category?.toLowerCase().includes('minum'));

          const commonTicketData = {
              orderNo: `HOLD-${Date.now().toString().slice(-4)}`,
              tableNo: selectedTable || 'TAKEAWAY',
              customerName: customerName || 'Guest',
              waiterName: waiterShort,
              time: new Date().toLocaleTimeString(),
              notes: '',
          };

          try {
              if (kitchenItems.length > 0) {
                  printerService.printTicket('Kitchen', {
                      ...commonTicketData,
                      items: kitchenItems.map(i => ({ name: i.product.name, quantity: i.quantity, notes: i.notes }))
                  });
              }
              if (barItems.length > 0) {
                  printerService.printTicket('Bar', {
                      ...commonTicketData,
                      items: barItems.map(i => ({ name: i.product.name, quantity: i.quantity, notes: i.notes }))
                  });
              }
              toast.success(`Berhasil HOLD & Cetak Produksi (${kitchenItems.length} Dapur, ${barItems.length} Bar)`);
          } catch (e) {
              console.error("Hold Print Error", e);
              toast.error('Gagal cetak produksi (Cek Koneksi Printer)');
          }
      } else {
          toast.success('Pesanan berhasil disimpan sementara');
      }

      setOrderItems([]);
      setOrderDiscount(0);
    };

    if (checkAuth('hold')) {
      performHold();
    } else {
      setPendingAuth({ action: 'hold' });
      setManagerAuthModalOpen(true);
    }
  };

  // Restore order
  const handleRestoreOrder = (order: HeldOrder) => {
    if (orderItems.length > 0) {
      toast.error('Clear current cart before restoring a held order');
      return;
    }

    setOrderItems(order.items);
    setOrderDiscount(order.discount);
    setHeldOrders(heldOrders.filter((h) => h.id !== order.id));
    setHeldOrdersModalOpen(false);
    toast.success('Pesanan dikembalikan');
  };

  // Delete held order (Requires Manager Auth)
  const handleDeleteHeldOrder = (id: string) => {
    setPendingAuth({ action: 'deleteHeld', data: id });
    setManagerAuthModalOpen(true);
  };

  const handleAuthSuccess = (manager: any) => {
    if (!pendingAuth) return;

    const { action, data } = pendingAuth;

    if (action === 'deleteHeld') {
      const targetId = data;
      // 1. Hapus dari state lokal
      setHeldOrders(heldOrders.filter((h) => h.id !== targetId));

      // 2. Hapus dari database pusat Kiosk jika berasal dari remote
      if (!targetId.startsWith('held-') && onDeleteSale) {
        const numericId = Number(targetId);
        if (!isNaN(numericId)) {
          onDeleteSale(numericId);
        }
      }
      toast.info(`Pesanan Dibatalkan oleh Manager: ${manager.name}`);
    } 
    else if (action === 'discount') {
      setDiscountModalOpen(true);
    } 
    else if (action === 'hold') {
      // Trigger hold logic again, now it should pass checkAuth if we handle it
      // Actually, easier to just call performHold logic here or force it
      handleHoldOrder(); 
    }

    setPendingAuth(null);
  };

  // Split bill
  const handleSplitBill = () => {
    // if (orderItems.length === 0) return; // Allow opening to see if modal works, or handled by UI
    setSplitBillModalOpen(true);
  };

  const onSplitCommit = (selectedItems: OrderItem[]) => {
    setItemsToSplit(selectedItems);
    setIsSplitPayment(true);
    setSplitBillModalOpen(false);
    setPaymentModalOpen(true);
  };

  // Scan barcode
  const handleScan = () => {
    toast.info('Pemindai barcode - Fitur segera hadir');
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setOrderItems(prev => prev.map(item => item.id === itemId ? { ...item, notes } : item));
  };

  return (
    <div className="h-full flex flex-col bg-pos-cream noise-texture overflow-hidden relative">
      {/* Main Content */}
      <div
        className="grid flex-1 min-w-0 overflow-hidden pb-6 md:pb-8"
        style={{
          direction: 'ltr',
          gridTemplateColumns: isMobile
            ? 'minmax(0, 1fr) minmax(164px, 42vw)'
            : 'minmax(0, 1fr) clamp(220px, 36vw, 420px)'
        }}
      >
        {/* Left: Product Grid (75%) */}
        <div className="order-1 min-w-0 flex flex-col overflow-hidden rounded-r-[28px] border-r border-orange-100 bg-white/35 p-2 md:p-4 lg:p-5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            {onBack && (
              <button
                onClick={() => {
                  if (settings?.enable_table_management === false) {
                    onBack();
                  } else {
                    setViewMode('tables');
                  }
                }}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="shrink-0 ml-2">
              <h1 className="text-2xl font-bold text-pos-charcoal leading-none">WinPOS</h1>
              <button
                onClick={() => {
                  setSessionMode(currentSession ? 'close' : 'open');
                  setSessionModalOpen(true);
                }}
                className={`text-[10px] font-bold transition-colors flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full border ${currentSession
                  ? 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100'
                  : 'text-red-500 border-red-200 bg-red-50 hover:bg-red-100'
                  }`}
              >
                {currentSession ? '🟢 Shift Aktif' : '🔴 Shift Tutup'}
              </button>
            </div>

            {/* NEW: Horizontal Info Bar */}
            <div className="flex-1 flex items-center gap-2 ml-6 pl-6 border-l border-gray-200 overflow-x-auto">

              {/* Table Selector */}
              {settings?.enable_table_management !== false && (
                <div className="flex items-center gap-2 bg-white/60 px-2 py-1.5 rounded-xl border border-white/50 shadow-sm shrink-0">
                  <div className="w-6 h-6 rounded-md bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Meja</span>
                    <div className="relative">
                      <select
                        value={selectedTable}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'MANUAL') {
                            const custom = prompt('Masukkan Nomor Meja Manual:');
                            if (custom) setSelectedTable(custom.toUpperCase());
                          } else {
                            setSelectedTable(val);
                          }
                        }}
                        className="bg-transparent border-none p-0 pr-6 text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer appearance-none min-w-[60px]"
                      >
                        <option value="">Pilih</option>
                        {Array.from(new Set([...(tables || []).map(t => t.number), selectedTable])).filter(Boolean).map(no => (
                          <option key={no} value={no}>{no}</option>
                        ))}
                        <option value="MANUAL">+ Manual</option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-gray-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Selector */}
              <div className="flex items-center gap-2 bg-white/60 px-2 py-1.5 rounded-xl border border-white/50 shadow-sm shrink-0">
                <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Pelanggan</span>
                  <div className="relative">
                    <select
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="bg-transparent font-bold text-pos-charcoal text-xs appearance-none pr-4 focus:outline-none cursor-pointer min-w-[80px]"
                    >
                      <option value="Guest">Guest</option>
                      {(contacts || []).filter(c => c && c.type === 'Customer').map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-gray-400 pointer-events-none absolute right-0 top-0.5" />
                  </div>
                </div>
              </div>

              {/* Waiter Selector */}
              <div className="flex items-center gap-2 bg-white/60 px-2 py-1.5 rounded-xl border border-white/50 shadow-sm shrink-0">
                <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">Pelayan</span>
                  <div className="relative">
                    <select
                      value={waiterName}
                      onChange={(e) => setWaiterName(e.target.value)}
                      className="bg-transparent font-bold text-pos-charcoal text-xs appearance-none pr-4 focus:outline-none cursor-pointer min-w-[80px]"
                    >
                      <option value="">Pilih</option>
                      {(employees || []).map(emp => (
                        <option key={emp.id} value={emp.name}>{emp.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-gray-400 pointer-events-none absolute right-0 top-0.5" />
                  </div>
                </div>
              </div>

            </div>
          </div>



          <div className="mb-4">
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onScanClick={handleScan}
            />
          </div>

          {/* Category Tabs */}
          <div className="mb-4">
            <CategoryTabs
              categories={['Semua', ...(categories || []).filter(c => c && c.name).map(c => c.name)]}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto">
            <div
              className="grid gap-2 pb-6 md:gap-3"
              style={{
                gridTemplateColumns: isMobile
                  ? 'repeat(auto-fill, minmax(104px, 1fr))'
                  : 'repeat(auto-fill, minmax(128px, 1fr))'
              }}
            >
              {filteredProducts.filter(p => p && p.id).map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-500 font-medium">Produk tidak ditemukan</p>
                <p className="text-sm text-gray-400 mt-2">
                  Coba pencarian atau kategori lain
                </p>
              </div>
            )}
          </div>


        </div>

        {/* Right: Order Panel (25%) */}
        <div
          className="order-2 min-w-0 flex flex-col gap-2 overflow-hidden border-l-2 border-orange-200 bg-orange-50/60 p-2 pl-2 md:p-3 md:pl-3"
          style={isMobile ? { minWidth: '164px' } : undefined}
        >
          <QuickActionsBar
            embedded
            hasItems={orderItems.length > 0}
            onManualItemClick={() => setManualItemModalOpen(true)}
            onDiscountClick={() => {
              if (checkAuth('discount')) {
                setDiscountModalOpen(true);
              } else {
                setPendingAuth({ action: 'discount' });
                setManagerAuthModalOpen(true);
              }
            }}
            onHoldOrderClick={handleHoldOrder}
            onPaymentClick={() => {
              setIsSplitPayment(false);
              setPaymentModalOpen(true);
            }}
            onHeldOrdersClick={() => setHeldOrdersModalOpen(true)}
            heldCount={heldOrders.length}
          />

          <div className="flex-1 min-h-0">
            <OrderPanel
              items={orderItems}
              subtotal={subtotal}
              discount={orderDiscount}
              total={total}
              tax={taxAmount}
              service={serviceAmount}
              onQuantityChange={handleQuantityChange}
              onRemoveItem={handleRemoveItem}
              onNotesChange={handleNotesChange}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <ManualItemModal
        open={manualItemModalOpen}
        onOpenChange={setManualItemModalOpen}
        onAdd={handleAddManualItem}
      />

      <HeldOrdersModal
        open={heldOrdersModalOpen}
        onOpenChange={setHeldOrdersModalOpen}
        heldOrders={heldOrders}
        onRestore={handleRestoreOrder}
        onDelete={(isAdmin || !settings?.restrict_cashier_delete) ? handleDeleteHeldOrder : undefined}
      />

      <ManagerAuthModal
        open={managerAuthModalOpen}
        onClose={() => {
          setManagerAuthModalOpen(false);
          setPendingAuth(null);
        }}
        onSuccess={handleAuthSuccess}
        employees={employees}
        title={
          pendingAuth?.action === 'discount' ? "Otorisasi Diskon" : 
          pendingAuth?.action === 'hold' ? "Otorisasi Tahan Bill" :
          "Otorisasi Manager"
        }
        description={
          pendingAuth?.action === 'discount' ? "Masukkan PIN Manager untuk memberikan diskon." :
          pendingAuth?.action === 'hold' ? "Masukkan PIN Manager untuk menangguhkan pesanan ini." :
          "Masukkan PIN Manager untuk melanjutkan aksi ini."
        }
      />

      {/* Addon Selection Modal */}
      {isAddonModalOpen && addonPendingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-primary/5">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Pilih Toping</h3>
                <p className="text-sm text-gray-500 mt-1">{addonPendingProduct.name}</p>
              </div>
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                <Puzzle className="w-6 h-6 text-primary" />
              </div>
            </div>

            <div className="p-8 space-y-4">
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {addonPendingProduct.addons?.map((addon) => {
                  const isSelected = tempSelectedAddons.some(a => a.id === addon.id);
                  return (
                    <button
                      key={addon.id}
                      onClick={() => {
                        if (isSelected) {
                          setTempSelectedAddons(prev => prev.filter(a => a.id !== addon.id));
                        } else {
                          setTempSelectedAddons(prev => [...prev, addon]);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-gray-100 bg-white hover:border-primary/30'
                        }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-gray-700'}`}>{addon.name}</span>
                        <span className="text-xs text-gray-400">+Rp {addon.price.toLocaleString()}</span>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-gray-100'
                        }`}>
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center mb-6 px-1">
                  <span className="text-sm text-gray-500 font-medium">Extra Total:</span>
                  <span className="text-lg font-bold text-primary">
                    +Rp {tempSelectedAddons.reduce((sum, a) => sum + a.price, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-xl"
                    onClick={() => {
                      setIsAddonModalOpen(false);
                      setAddonPendingProduct(null);
                    }}
                  >
                    Batal
                  </Button>
                  <Button
                    className="flex-1 h-12 rounded-xl bg-gray-900 group"
                    onClick={handleConfirmAddons}
                  >
                    Tambah Ke Order <ShoppingCart className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* [NEW] New Order Review Modal */}
      <NewOrderModal
        open={newOrderModalOpen}
        onOpenChange={setNewOrderModalOpen}
        orderId={autoOpenSaleId || undefined}
        tableNo={selectedTable}
        itemsCount={orderItems.length}
        onConfirm={() => {
          setNewOrderModalOpen(false);
          setPaymentModalOpen(true);
        }}
      />

      <SplitBillModal
        open={splitBillModalOpen}
        onOpenChange={setSplitBillModalOpen}
        items={orderItems}
        onSplit={onSplitCommit}
      />

      <DiscountModal
        open={discountModalOpen}
        onOpenChange={setDiscountModalOpen}
        onApplyDiscount={handleApplyDiscount}
        currentTotal={subtotal}
        availablePromos={promos.filter(p => {
          if (p.type !== 'manual') return false;
          if (!p.is_active) return false;
          
          const now = new Date();
          if (p.start_date && new Date(p.start_date) > now) return false;
          if (p.end_date && new Date(p.end_date) < now) return false;
          
          // Time check
          if (p.start_time || p.end_time) {
            const currentTime = now.getHours() * 60 + now.getMinutes();
            if (p.start_time) {
              const [h, m] = p.start_time.split(':').map(Number);
              const startTime = h * 60 + m;
              if (currentTime < startTime) return false;
            }
            if (p.end_time) {
              const [h, m] = p.end_time.split(':').map(Number);
              const endTime = h * 60 + m;
              if (currentTime > endTime) return false;
            }
          }
          return true;
        })}
      />

      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        totalAmount={isSplitPayment ? itemsToSplit.reduce((sum, item) => sum + item.product.price * item.quantity, 0) : total}
        subtotal={isSplitPayment ? itemsToSplit.reduce((sum, item) => sum + item.product.price * item.quantity, 0) : subtotal}
        discount={isSplitPayment ? 0 : orderDiscount}
        tax={isSplitPayment ? 0 : taxAmount}
        service={isSplitPayment ? 0 : serviceAmount}
        onPaymentComplete={handlePaymentComplete}
        paymentMethods={paymentMethods}
        settings={settings}
      />

      <SuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        total={lastPaymentTotal}
        change={lastPaymentChange}
        lastSaleData={lastSaleData}
        onNewTransaction={handleNewTransaction}
        onViewHistory={() => { }}
      />

      <CashierSessionModal
        open={sessionModalOpen}
        onOpenChange={setSessionModalOpen}
        mode={sessionMode}
        session={currentSession}
        settings={{ ...settings, require_mandatory_session: requireMandatorySession }}
        onSessionComplete={(session) => {
          checkSession();
        }}
      />
    </div>
  );
}
