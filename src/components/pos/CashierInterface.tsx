import { useState, useMemo, useEffect } from 'react';
import { ProductCategory, OrderItem, Product } from '@/types/pos';
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
import { TableSelectionGrid, Table } from './TableSelectionGrid';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Store, ArrowLeft, ShoppingCart, Users, User, Cake, CreditCard, ChevronDown, Search, Star, Puzzle, Check } from 'lucide-react';
import { ContactData } from '../contacts/ContactsView';
import { Addon } from '@/types/pos';

// const categories: ProductCategory[] = ['Semua', 'Makanan', 'Minuman', 'Camilan', 'Pencuci Mulut']; // REMOVED

interface CashierInterfaceProps {
  onBack?: () => void;
  onAddSale?: (sale: {
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
  settings?: any;
  initialTable?: string;
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
  settings = {},
  initialTable = ''
}: CashierInterfaceProps) {
  // console.log('CashierInterface Props:', { productsLength: products?.length, categoriesLength: categories?.length }); 
  // Removed verbose log to prevent crash on undefined properties
  const [viewMode, setViewMode] = useState<'tables' | 'pos'>('tables');
  const [selectedTable, setSelectedTable] = useState<string>(initialTable || '');

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
  // const [selectedTable, setSelectedTable] = useState<string>(''); // Removed duplicate
  const [customerName, setCustomerName] = useState<string>('');
  const [waiterName, setWaiterName] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [addonPendingProduct, setAddonPendingProduct] = useState<Product | null>(null);
  const [tempSelectedAddons, setTempSelectedAddons] = useState<Addon[]>([]);

  // Calculate occupied tables based on active sales
  const occupiedTableNumbers = useMemo(() => {
    const occupied = new Set<string>();
    if (activeSales) {
      activeSales.forEach(sale => {
        if (sale && ['Unpaid', 'Pending'].includes(sale.status) && sale.tableNo) {
          occupied.add(sale.tableNo);
        }
      });
    }
    return occupied;
  }, [activeSales]);

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
      currentProducts = currentProducts.filter((p) => p.category === activeCategory);
    }

    // Filter by sellable status
    currentProducts = currentProducts.filter((p) => p.is_sellable !== false);

    if (searchQuery) {
      currentProducts = currentProducts.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return currentProducts;
  }, [activeCategory, searchQuery, products]);

  // Calculate totals
  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const addonsPrice = item.selectedAddons?.reduce((aSum, a) => aSum + a.price, 0) || 0;
      return sum + (item.product.price + addonsPrice) * item.quantity;
    }, 0);
  }, [orderItems]);

  const taxableAmount = Math.max(0, subtotal - orderDiscount);
  const taxRate = settings?.tax_rate || 0;
  const serviceRate = settings?.service_rate || 0;

  const taxAmount = (taxableAmount * taxRate) / 100;
  const serviceAmount = (taxableAmount * serviceRate) / 100;

  const total = taxableAmount + taxAmount + serviceAmount;

  // Hydrate order when table is selected
  useEffect(() => {
    if (selectedTable && activeSales) {
      const existingSale = activeSales.find(
        s => s && (s.status === 'Pending' || s.status === 'Unpaid') && s.tableNo === selectedTable
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
      } else {
        // New order for this table
        setOrderItems([]);
        setCustomerName('Guest');
        setWaiterName('');
        setOrderDiscount(0);
      }
    }
  }, [selectedTable, activeSales, products]);

  const handleClearTable = (tableNo: string) => {
    const saleToClear = activeSales?.find(
      s => s && (s.status === 'Pending' || s.status === 'Unpaid') && s.tableNo === tableNo
    );

    if (saleToClear && onDeleteSale) {
      if (confirm(`Kosongkan meja ${tableNo}? Pesanan yang belum lunas akan dihapus.`)) {
        onDeleteSale(saleToClear.id);
        toast.success(`Meja ${tableNo} Berhasil Dikosongkan`, {
          icon: <Check className="w-5 h-5 text-green-500" />,
          description: 'Status meja kini tersedia kembali.',
          duration: 3000,
        });
      }
    } else {
      toast.error('Gagal mengosongkan meja: Transaksi tidak ditemukan');
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
    if (product.stock === 0) {
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
    setLastPaymentChange(payment.change);
    setPaymentModalOpen(false);

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
      setSuccessModalOpen(true);
    }

    // Report sale to parent
    if (onAddSale) {
      const itemsToReport = isSplitPayment ? itemsToSplit : orderItems;
      const amountToReport = isSplitPayment
        ? itemsToSplit.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
        : total;

      onAddSale({
        items: itemsToReport.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: amountToReport,
        paymentMethod: payment.method,
        productDetails: itemsToReport.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          isManual: String(item.product.id).startsWith('manual-')
        })),
        tableNo: selectedTable,
        customerName: customerName,
        waiterName: waiterName,
        subtotal: isSplitPayment ? amountToReport : subtotal,
        discount: isSplitPayment ? 0 : orderDiscount,
        tax: isSplitPayment ? 0 : taxAmount,
        service: isSplitPayment ? 0 : serviceAmount,
        paidAmount: payment.amount || amountToReport,
        change: payment.change || 0
      });
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
          price: item.product.price
        }))
      });
    }

    setOrderItems([]);
    setOrderDiscount(0);
    toast.success('Pesanan dikirim ke Dapur & ditangguhkan');
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

  // Delete held order
  const handleDeleteHeldOrder = (id: string) => {
    setHeldOrders(heldOrders.filter((h) => h.id !== id));
    toast.info('Pesanan yang ditangguhkan dihapus');
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

  return (
    <div className="h-full flex flex-col bg-pos-cream noise-texture overflow-hidden relative">
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden pb-24">
        {/* Left: Product Grid (70%) */}
        <div className="flex-[0.7] flex flex-col p-6 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            {onBack && (
              <button
                onClick={() => setViewMode('tables')}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 bg-pos-coral rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-pos-charcoal leading-none">WinPOS</h1>
            </div>


          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onScanClick={handleScan}
            />
          </div>

          {/* Category Tabs */}
          <div className="mb-6">
            <CategoryTabs
              categories={['Semua', ...(categories || []).filter(c => c && c.name).map(c => c.name)]}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 pb-6">
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

        {/* Right: Order Panel (30%) */}
        <div className="flex-[0.3] p-6 pl-0 flex flex-col gap-4">
          {/* Info Bar (Moved from Left Footer) */}
          <div className="bg-white/40 backdrop-blur-md border border-white/50 rounded-2xl p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Table Selector */}
              <div className="bg-white/80 rounded-xl p-2.5 shadow-sm border border-white/50 flex flex-col justify-center relative group">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-md bg-orange-100 flex items-center justify-center text-orange-600">
                    <Store className="w-3 h-3" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Meja</span>
                </div>
                <div className="flex items-center justify-between">
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="bg-transparent font-bold text-pos-charcoal focus:outline-none text-sm w-full cursor-pointer hover:text-pos-coral transition-colors appearance-none"
                  >
                    <option value="">Pilih</option>
                    {(tables || []).map(t => (
                      <option key={t.id} value={t.number}>{t.number} ({t.capacity})</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-400 pointer-events-none absolute right-2 bottom-3" />
                </div>
              </div>

              {/* Customer Selector */}
              <div className="bg-white/80 rounded-xl p-2.5 shadow-sm border border-white/50 flex flex-col justify-center relative group">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center text-blue-600">
                    <Users className="w-3 h-3" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pelanggan</span>
                </div>
                <div className="flex items-center justify-between">
                  <select
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="bg-transparent font-bold text-pos-charcoal focus:outline-none text-sm w-full cursor-pointer hover:text-pos-coral transition-colors appearance-none"
                  >
                    <option value="Guest">Guest</option>
                    {(contacts || []).filter(c => c && c.type === 'Customer').map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-400 pointer-events-none absolute right-2 bottom-3" />
                </div>
              </div>
            </div>

            {/* Waiter Selector (Full Width) */}
            <div className="bg-white/80 rounded-xl p-2.5 shadow-sm border border-white/50 flex flex-col justify-center relative group">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center text-purple-600">
                  <User className="w-3 h-3" />
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pelayan</span>
              </div>
              <div className="flex items-center justify-between">
                <select
                  value={waiterName}
                  onChange={(e) => setWaiterName(e.target.value)}
                  className="bg-transparent font-bold text-pos-charcoal focus:outline-none text-sm w-full cursor-pointer hover:text-pos-coral transition-colors appearance-none"
                >
                  <option value="">-- Pilih Pelayan --</option>
                  {(employees || []).map(emp => (
                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-gray-400 pointer-events-none absolute right-3 bottom-3" />
              </div>
            </div>
          </div>

          <OrderPanel
            items={orderItems}
            subtotal={subtotal}
            discount={orderDiscount}
            total={total}
            tax={taxAmount}
            service={serviceAmount}
            onQuantityChange={handleQuantityChange}
            onRemoveItem={handleRemoveItem}
          />
        </div>
      </div>

      {/* Quick Actions Bar */}
      <QuickActionsBar
        hasItems={orderItems.length > 0}
        onManualItemClick={() => setManualItemModalOpen(true)}
        onDiscountClick={() => setDiscountModalOpen(true)}
        onSplitBillClick={handleSplitBill}
        onHoldOrderClick={handleHoldOrder}
        onPaymentClick={() => {
          setIsSplitPayment(false);
          setPaymentModalOpen(true);
        }}
        onHeldOrdersClick={() => setHeldOrdersModalOpen(true)}
        heldCount={heldOrders.length}
      />

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
        onDelete={handleDeleteHeldOrder}
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

      <SplitBillModal
        open={splitBillModalOpen}
        onOpenChange={setSplitBillModalOpen}
        items={orderItems}
        onSplit={onSplitCommit}
      />

      <DiscountModal
        open={discountModalOpen}
        onOpenChange={setDiscountModalOpen}
        currentTotal={subtotal}
        onApplyDiscount={handleApplyDiscount}
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
      />

      <SuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        total={total}
        change={lastPaymentChange}
        onNewTransaction={handleNewTransaction}
        onViewHistory={onBack}
      />
    </div>
  );
}
