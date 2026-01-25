import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Clock,
  Users,
  Contact,
  Package,
  ShoppingCart,
  Store,
  FileText,
  Calculator,
  Settings,
  LogOut,
  CheckCircle,
  RefreshCw,
  Award,
  ShieldCheck,
  Coffee,
  Wallet,
  MapPin,
  Archive,
  CalendarCheck,
  MonitorCheck,
  History as ClockHistory,
  ChefHat
} from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth/AuthProvider';
import { DashboardView } from './dashboard/DashboardView';
import { UsersView, branchList } from './users/UsersView';
import { ContactsView, ContactData } from './contacts/ContactsView';
import { ProductsView } from './products/ProductsView';
import { PurchasesView } from './purchases/PurchasesView';
import { ReportsView } from './reports/ReportsView';
import { AccountingView } from './accounting/AccountingView';
import { SettingsView } from './settings/SettingsView';
import { EmployeesView } from './employees/EmployeesView';
import { AttendanceView } from './attendance/AttendanceView';
import { PayrollView } from './payroll/PayrollView';
import { PerformanceView } from './employees/PerformanceView';
import { SalesView, SalesOrder, SalesReturn, INITIAL_SALES } from './pos/SalesView';
import { CashierInterface } from './pos/CashierInterface';
import { BranchesView } from './branches/BranchesView';
import { ShiftsView } from './shifts/ShiftsView';
import { InventoryView, Ingredient as InvIngredient, StockMovement } from './inventory/InventoryView';
import { KDSView } from './pos/KDSView';
import { OrderItem } from '@/types/pos';
import { mockProducts } from '@/data/products';
import { toast } from 'sonner';
import { printerService } from '../lib/PrinterService';

type ModuleType = 'dashboard' | 'users' | 'contacts' | 'products' | 'purchases' | 'pos' | 'kds' | 'reports' | 'accounting' | 'settings' | 'employees' | 'attendance' | 'payroll' | 'branches' | 'shifts' | 'performance' | 'inventory';

const DEFAULT_EMPLOYEES = [
  { id: 1, name: 'Andi S.', position: 'Waitress', status: 'Shift Siang' },
  { id: 2, name: 'Budi R.', position: 'Barista', status: 'Shift Malam' },
];

function Home() {
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  const [salesViewTab, setSalesViewTab] = useState<'history' | 'returns'>('history');
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [userRole, setUserRole] = useState<string>('Administrator');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentBranchId, setCurrentBranchId] = useState('b1');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [contacts, setContacts] = useState<ContactData[]>([]);

  // Centralized State for Integration
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([
    { id: 1, employeeName: 'Budi Santoso', date: '2026-01-20', checkIn: '07:55', checkOut: '16:05', status: 'Present' },
    { id: 2, employeeName: 'Siti Aminah', date: '2026-01-20', checkIn: '08:10', status: 'Late' },
  ]);
  const [performanceRules, setPerformanceRules] = useState({
    commissionPercent: 1.5,
    attendanceBonus: 10000,
    latePenalty: 25000,
    complaintPenalty: 50000
  });
  const [complaintsData, setComplaintsData] = useState<Record<string, number>>({}); // employeeName -> count
  const [payrollData, setPayrollData] = useState<any[]>([
    { id: 1, employeeName: 'Budi Santoso', position: 'Barista', basicSalary: 3500000, allowance: 500000, deduction: 0, status: 'Paid', period: 'Januari 2026', paymentDate: '2026-01-25' },
    { id: 2, employeeName: 'Siti Aminah', position: 'Cashier', basicSalary: 3200000, allowance: 400000, deduction: 100000, status: 'Pending', period: 'Januari 2026' },
  ]);

  const [employees, setEmployees] = useState<any[]>(DEFAULT_EMPLOYEES);

  // Inventory & HPP State
  const [inventoryIngredients, setInventoryIngredients] = useState<InvIngredient[]>([
    { id: 1, name: 'Kopi Arabika (Beans)', unit: 'kg', category: 'Coffee', currentStock: 25.5, minStock: 5, lastUpdated: '2026-01-24', costPerUnit: 150000 },
    { id: 2, name: 'Susu Fresh Milk', unit: 'Liter', category: 'Dairy', currentStock: 12, minStock: 10, lastUpdated: '2026-01-25', costPerUnit: 18000 },
    { id: 3, name: 'Gula Aren Cair', unit: 'Liter', category: 'Sweetener', currentStock: 3.5, minStock: 5, lastUpdated: '2026-01-23', costPerUnit: 25000 },
    { id: 4, name: 'Bubuk Cokelat Premium', unit: 'kg', category: 'Other', currentStock: 8, minStock: 2, lastUpdated: '2026-01-20', costPerUnit: 120000 },
  ]);
  const [inventoryHistory, setInventoryHistory] = useState<StockMovement[]>([
    { id: 1, ingredientId: 1, ingredientName: 'Kopi Arabika (Beans)', type: 'IN', quantity: 10, unit: 'kg', reason: 'Pembelian PO-2026-001', date: '2026-01-24 10:30', user: 'Admin' },
    { id: 2, ingredientId: 2, ingredientName: 'Susu Fresh Milk', type: 'OUT', quantity: 4, unit: 'Liter', reason: 'Pemakaian Harian', date: '2026-01-25 08:15', user: 'Barista' },
  ]);

  // --- Master Data State ---
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // --- Master Data Integration ---
  const fetchMasterData = async () => {
    try {
      const [productsRes, categoriesRes, unitsRes, brandsRes] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('units').select('*').order('name'),
        supabase.from('brands').select('*').order('name')
      ]);

      if (productsRes.data) setProducts(productsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (unitsRes.data) setUnits(unitsRes.data);
      if (brandsRes.data) setBrands(brandsRes.data);
    } catch (err) {
      console.error('Error loading master data:', err);
    }
  };

  useEffect(() => {
    fetchMasterData();

    // Subscribe to all master data changes
    const channels = [
      supabase.channel('products_all').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchMasterData).subscribe(),
      supabase.channel('categories_all').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchMasterData).subscribe(),
      supabase.channel('units_all').on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchMasterData).subscribe(),
      supabase.channel('brands_all').on('postgres_changes', { event: '*', schema: 'public', table: 'brands' }, fetchMasterData).subscribe(),
    ];

    return () => {
      channels.forEach(ch => ch.unsubscribe());
    };
  }, []);

  // Generic CRUD Handler
  const handleMasterDataCRUD = async (
    table: string,
    action: 'create' | 'update' | 'delete',
    data: any
  ) => {
    try {
      if (action === 'create') {
        const { id, ...payload } = data; // Strip ID for auto-generation
        const { error } = await supabase.from(table).insert([payload]);
        if (error) throw error;
        toast.success(`Data berhasil ditambahkan`);
      } else if (action === 'update') {
        const { error } = await supabase.from(table).update(data).eq('id', data.id);
        if (error) throw error;
        toast.success(`Data berhasil diperbarui`);
      } else if (action === 'delete') {
        const { error } = await supabase.from(table).delete().eq('id', data.id);
        if (error) throw error;
        toast.success(`Data berhasil dihapus`);
      }
    } catch (err) {
      console.error(`Error ${action} ${table}:`, err);
      toast.error(`Gagal memproses data`);
    }
  };
  const [receiptSettings, setReceiptSettings] = useState({
    header: 'WINNY CAFE',
    address: 'Jl. Contoh No. 123, Kota',
    footer: 'Terima Kasih Atas Kunjungan Anda',
    paperWidth: '58mm',
    showDate: true,
    showWaiter: true,
    showTable: true
  });

  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load data from localStorage
    const savedSales = localStorage.getItem('winpos_sales');
    const savedReturns = localStorage.getItem('winpos_returns');

    if (savedSales) setSales(JSON.parse(savedSales));
    else setSales(INITIAL_SALES);

    if (savedReturns) setReturns(JSON.parse(savedReturns));

    // Load other master data
    const savedEmployees = localStorage.getItem('winpos_employees');
    const savedDepts = localStorage.getItem('winpos_departments');
    const savedIngredients = localStorage.getItem('winpos_ingredients');
    const savedInventoryHistory = localStorage.getItem('winpos_inventory_history');
    const savedCategories = localStorage.getItem('winpos_categories');
    const savedUnits = localStorage.getItem('winpos_units');
    const savedBrands = localStorage.getItem('winpos_brands');
    const savedProducts = localStorage.getItem('winpos_products');
    const savedContacts = localStorage.getItem('winpos_contacts');
    const savedPendingOrders = localStorage.getItem('winpos_pending_orders');

    if (savedEmployees) setEmployees(JSON.parse(savedEmployees));
    if (savedDepts) setDepartments(JSON.parse(savedDepts));
    if (savedIngredients) setInventoryIngredients(JSON.parse(savedIngredients));
    if (savedInventoryHistory) setInventoryHistory(JSON.parse(savedInventoryHistory));
    if (savedCategories) setCategories(JSON.parse(savedCategories));
    if (savedUnits) setUnits(JSON.parse(savedUnits));
    if (savedBrands) setBrands(JSON.parse(savedBrands));
    if (savedProducts) setProducts(JSON.parse(savedProducts));
    if (savedContacts) setContacts(JSON.parse(savedContacts));
    if (savedPendingOrders) setPendingOrders(JSON.parse(savedPendingOrders));

    const savedReceipt = localStorage.getItem('winpos_receipt_settings');
    if (savedReceipt) setReceiptSettings(JSON.parse(savedReceipt));

    // Network status listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Save to localStorage whenever sales or returns change
  useEffect(() => {
    if (sales.length > 0) {
      localStorage.setItem('winpos_sales', JSON.stringify(sales));
    }
  }, [sales]);

  useEffect(() => {
    if (returns.length > 0) localStorage.setItem('winpos_returns', JSON.stringify(returns));
  }, [returns]);

  // Persist all other states
  useEffect(() => { localStorage.setItem('winpos_employees', JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem('winpos_departments', JSON.stringify(departments)); }, [departments]);
  useEffect(() => { localStorage.setItem('winpos_ingredients', JSON.stringify(inventoryIngredients)); }, [inventoryIngredients]);
  useEffect(() => { localStorage.setItem('winpos_inventory_history', JSON.stringify(inventoryHistory)); }, [inventoryHistory]);
  useEffect(() => { localStorage.setItem('winpos_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('winpos_units', JSON.stringify(units)); }, [units]);
  useEffect(() => { localStorage.setItem('winpos_brands', JSON.stringify(brands)); }, [brands]);
  useEffect(() => { localStorage.setItem('winpos_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('winpos_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { localStorage.setItem('winpos_pending_orders', JSON.stringify(pendingOrders)); }, [pendingOrders]);
  useEffect(() => { localStorage.setItem('winpos_receipt_settings', JSON.stringify(receiptSettings)); }, [receiptSettings]);

  // Sync receipt settings to PrinterService
  useEffect(() => {
    printerService.setTemplate(receiptSettings);
  }, [receiptSettings]);

  // Background Sync Effect
  useEffect(() => {
    if (isOnline && (sales.some(s => s.syncStatus === 'pending') || returns.some(r => r.syncStatus === 'pending'))) {
      setIsSyncing(true);

      // Simulate batch syncing
      setTimeout(() => {
        setSales(prev => prev.map(s => s.syncStatus === 'pending' ? { ...s, syncStatus: 'synced' } : s));
        setReturns(prev => prev.map(r => r.syncStatus === 'pending' ? { ...r, syncStatus: 'synced' } : r));
        setIsSyncing(false);
        toast.success('Semua data offline berhasil disinkronkan ke cloud');
      }, 3000);
    }
  }, [isOnline, sales, returns]);

  // Clock Effect
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAddSale = (saleData: Omit<SalesOrder, 'id' | 'orderNo' | 'date' | 'status'>) => {
    const newSale: SalesOrder = {
      ...saleData,
      id: Date.now(),
      orderNo: `INV-${new Date().getFullYear()}-${(sales.length + 1).toString().padStart(4, '0')}`,
      date: new Date().toLocaleString('sv-SE').slice(0, 16).replace('T', ' '),
      status: 'Completed',
      branchId: currentBranchId,
      waiterName: saleData.waiterName,
      syncStatus: isOnline ? 'syncing' : 'pending'
    };
    setSales([newSale, ...sales]);

    // --- Add to Pending Orders (KDS) ---
    const kitchenItems = saleData.productDetails.filter(item => {
      const product = mockProducts.find(p => p.name === item.name);
      return product?.target === 'Kitchen';
    });
    const barItems = saleData.productDetails.filter(item => {
      const product = mockProducts.find(p => p.name === item.name);
      return product?.target === 'Bar';
    });

    if (kitchenItems.length > 0 || barItems.length > 0) {
      const kdsOrder = {
        id: Date.now(),
        orderNo: newSale.orderNo,
        tableNo: newSale.tableNo,
        waiterName: newSale.waiterName,
        time: newSale.date.split(' ')[1],
        items: saleData.productDetails.map(item => {
          const product = mockProducts.find(p => p.name === item.name);
          return { ...item, target: product?.target || 'Waitress', status: 'Pending' };
        })
      };
      setPendingOrders(prev => [kdsOrder, ...prev]);
    }

    // --- Automatic Stock Deduction based on Recipe (HPP) ---
    const newMovements: StockMovement[] = [];
    let updatedIngredients = [...inventoryIngredients];

    saleData.productDetails.forEach(item => {
      // Find product in mockData to get recipe
      const product = mockProducts.find(p => p.name === item.name);
      if (product && product.recipe && product.recipe.length > 0) {
        product.recipe.forEach(recipeItem => {
          // Decrement stock
          updatedIngredients = updatedIngredients.map(ing => {
            if (ing.id === recipeItem.ingredientId) {
              const deductQty = recipeItem.amount * item.quantity;

              // Record movement
              newMovements.push({
                id: Date.now() + Math.random(),
                ingredientId: ing.id,
                ingredientName: ing.name,
                type: 'OUT',
                quantity: deductQty,
                unit: ing.unit,
                reason: `Penjualan ${newSale.orderNo}`,
                date: newSale.date,
                user: 'System (POS)'
              });

              return { ...ing, currentStock: ing.currentStock - deductQty, lastUpdated: newSale.date.split(' ')[0] };
            }
            return ing;
          });
        });
      }
    });

    if (newMovements.length > 0) {
      setInventoryIngredients(updatedIngredients);
      setInventoryHistory(prev => [...newMovements, ...prev]);
    }

    if (isOnline) {
      setTimeout(() => {
        setSales(prev => prev.map(s => s.id === newSale.id ? { ...s, syncStatus: 'synced' } : s));
        toast.success(`Transaksi ${newSale.orderNo} berhasil disinkronkan`);
      }, 2000);
    } else {
      toast.info('Transaksi disimpan secara offline');
    }

    // --- Automatic Printing ---
    // 1. Customer Receipt (Printer Kasir)
    printerService.printReceipt({
      orderNo: newSale.orderNo,
      tableNo: newSale.tableNo,
      waiterName: newSale.waiterName || '-',
      time: newSale.date,
      items: saleData.productDetails.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      subtotal: saleData.subtotal || saleData.totalAmount,
      discount: saleData.discount || 0,
      total: saleData.totalAmount,
      paymentType: saleData.paymentMethod || 'Tunai',
      amountPaid: saleData.paidAmount || saleData.totalAmount,
      change: saleData.change || 0
    });

    // 2. Preparation Tickets (Kitchen/Bar)
    if (kitchenItems.length > 0) {
      printerService.printTicket('Kitchen', {
        orderNo: newSale.orderNo,
        tableNo: newSale.tableNo,
        waiterName: newSale.waiterName || '-',
        time: newSale.date.split(' ')[1],
        items: kitchenItems
      });
    }
    if (barItems.length > 0) {
      printerService.printTicket('Bar', {
        orderNo: newSale.orderNo,
        tableNo: newSale.tableNo,
        waiterName: newSale.waiterName || '-',
        time: newSale.date.split(' ')[1],
        items: barItems
      });
    }
  };
  const handleSendToKDS = (orderData: any) => {
    const kdsOrder = {
      id: Date.now(),
      orderNo: orderData.orderNo || `HLD-${Date.now().toString().slice(-4)}`,
      tableNo: orderData.tableNo || '-',
      waiterName: orderData.waiterName || '-',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      items: orderData.productDetails.map((item: any) => {
        const product = mockProducts.find(p => p.name === item.name);
        return { ...item, target: product?.target || 'Waitress', status: 'Pending' };
      })
    };
    setPendingOrders(prev => [kdsOrder, ...prev]);

    // --- Automatic Bluetooth Printing ---
    const kitchenItems = kdsOrder.items.filter(i => i.target === 'Kitchen');
    const barItems = kdsOrder.items.filter(i => i.target === 'Bar');

    if (kitchenItems.length > 0) {
      printerService.printTicket('Kitchen', {
        orderNo: kdsOrder.orderNo,
        tableNo: kdsOrder.tableNo,
        waiterName: kdsOrder.waiterName,
        time: kdsOrder.time,
        items: kitchenItems
      });
    }

    if (barItems.length > 0) {
      printerService.printTicket('Bar', {
        orderNo: kdsOrder.orderNo,
        tableNo: kdsOrder.tableNo,
        waiterName: kdsOrder.waiterName,
        time: kdsOrder.time,
        items: barItems
      });
    }
  };

  const handleAddReturn = (returnData: Omit<SalesReturn, 'id' | 'returnNo' | 'date' | 'status'>) => {
    const newReturn: SalesReturn = {
      ...returnData,
      id: Date.now(),
      returnNo: `RET-${returnData.orderNo}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Processed',
      syncStatus: isOnline ? 'syncing' : 'pending'
    };
    setReturns([newReturn, ...returns]);
    setSales(sales.map(s => s.orderNo === returnData.orderNo ? { ...s, status: 'Returned', syncStatus: isOnline ? 'syncing' : 'pending' } : s));

    if (isOnline) {
      setTimeout(() => {
        setReturns(prev => prev.map(r => r.id === newReturn.id ? { ...r, syncStatus: 'synced' } : r));
        setSales(prev => prev.map(s => s.orderNo === returnData.orderNo ? { ...s, syncStatus: 'synced' } : s));
      }, 2000);
    }
  };

  /* OLD ROLE-BASED LOGIC DEPRECATED
  const modules = [
    { id: 'dashboard', label: 'Winny Cafe', icon: LayoutDashboard, color: 'bg-blue-600' },
    { id: 'users', label: 'Pengguna', icon: ShieldCheck, color: 'bg-indigo-600', roles: ['Administrator'] },
    // ...
  ];
  */

  /* 
    PERMISSION RULES:
    1. Administrator role gets EVERYTHING automatically.
    2. Other roles get only what is in their 'permissions' list.
    3. 'dashboard' is always shown acting as Home.
  */
  const { user, role, permissions } = useAuth(); // Get extended auth info

  // RESTORED FUNCTIONS
  const handleUpdateSale = (updatedSale: SalesOrder) => {
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
    toast.success(`Transaksi ${updatedSale.orderNo} berhasil diperbarui`);
  };

  const handleDeleteSale = (saleId: number) => {
    setSales(prev => prev.filter(s => s.id !== saleId));
    toast.success('Transaksi berhasil dihapus');
  };

  // NEW PERMISSION-BASED LOGIC
  // We check if the user has the specific permission ID.
  const allModules = [
    { id: 'dashboard', label: 'Winny Cafe', icon: LayoutDashboard, color: 'bg-blue-600' },
    { id: 'users', label: 'Pengguna', icon: ShieldCheck, color: 'bg-indigo-600' },
    { id: 'contacts', label: 'Kontak', icon: Contact, color: 'bg-purple-600' },
    { id: 'products', label: 'Produk', icon: Coffee, color: 'bg-green-600' },
    { id: 'purchases', label: 'Pembelian', icon: ShoppingCart, color: 'bg-orange-600' },
    { id: 'pos', label: 'Penjualan', icon: MonitorCheck, color: 'bg-pink-600' },
    { id: 'kds', label: 'Dapur & Bar', icon: ChefHat, color: 'bg-orange-500' },
    { id: 'reports', label: 'Laporan', icon: FileText, color: 'bg-teal-600' },
    { id: 'accounting', label: 'Akuntansi', icon: Calculator, color: 'bg-cyan-600' },
    { id: 'employees', label: 'Karyawan', icon: Users, color: 'bg-rose-600' },
    { id: 'attendance', label: 'Absensi', icon: CalendarCheck, color: 'bg-violet-600' },
    { id: 'payroll', label: 'Payroll', icon: Wallet, color: 'bg-emerald-600' },
    { id: 'branches', label: 'Cabang', icon: MapPin, color: 'bg-amber-600' },
    { id: 'performance', label: 'Performa', icon: Award, color: 'bg-yellow-600' },
    { id: 'shifts', label: 'Shift', icon: ClockHistory, color: 'bg-indigo-700' },
    { id: 'inventory', label: 'Stok Bahan', icon: Archive, color: 'bg-blue-700' },
    { id: 'settings', label: 'Pengaturan', icon: Settings, color: 'bg-gray-600' },
  ];

  const allowedModules = allModules.filter(m => {
    if (m.id === 'dashboard') return true; // Always show Dashboard
    // Case-insensitive check for admin
    if (role && role.toLowerCase() === 'administrator') return true;

    // Check if permission exists
    return permissions.includes(m.id);
  });


  // --- Contacts Integration ---
  const fetchContacts = async () => {
    const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Gagal memuat kontak');
    } else {
      setContacts(data || []);
    }
  };

  useEffect(() => {
    fetchContacts();

    // Subscribe to realtime changes
    const subscription = supabase
      .channel('contacts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchContacts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleCreateContact = async (newContact: any) => {
    // Remove id if it's a placeholder (like Date.now()) to let DB generate it, 
    // BUT since the UI might pass 'id' from formData, we should sanitize it.
    // Actually, ContactsView passes everything including Date.now() id if we don't change it there.
    // Let's expect the view to pass data without ID for new creation, OR we strip it here.
    const { id, ...contactData } = newContact;

    const { error } = await supabase.from('contacts').insert([contactData]);
    if (error) {
      console.error('Error creating contact:', error);
      toast.error('Gagal membuat kontak');
    } else {
      toast.success('Kontak berhasil dibuat');
    }
  };

  const handleUpdateContact = async (updatedContact: any) => {
    const { error } = await supabase.from('contacts').update(updatedContact).eq('id', updatedContact.id);
    if (error) {
      console.error('Error updating contact:', error);
      toast.error('Gagal memperbarui kontak');
    } else {
      toast.success('Kontak berhasil diperbarui');
    }
  };

  const handleDeleteContact = async (id: number) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) {
      console.error('Error deleting contact:', error);
      toast.error('Gagal menghapus kontak');
    } else {
      toast.success('Kontak berhasil dihapus');
    }
  };

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'dashboard': return (
        <DashboardView
          contacts={contacts}
          sales={sales}
          returns={returns}
          products={products}
          ingredients={inventoryIngredients}
          onNavigate={(module) => setActiveModule(module)}
        />
      );
      case 'users': return <UsersView />;
      case 'contacts': return (
        <ContactsView
          contacts={contacts}
          setContacts={setContacts}
          onAdd={handleCreateContact}
          onUpdate={handleUpdateContact}
          onDelete={handleDeleteContact}
        />
      );
      case 'products': return (
        <ProductsView
          products={products}
          setProducts={setProducts}
          ingredients={inventoryIngredients}
          categories={categories}
          setCategories={setCategories}
          units={units}
          setUnits={setUnits}
          brands={brands}
          setBrands={setBrands}
          onProductCRUD={(action, data) => handleMasterDataCRUD('products', action, data)}
          onCategoryCRUD={(action, data) => handleMasterDataCRUD('categories', action, data)}
          onUnitCRUD={(action, data) => handleMasterDataCRUD('units', action, data)}
          onBrandCRUD={(action, data) => handleMasterDataCRUD('brands', action, data)}
        />
      );
      case 'purchases': return <PurchasesView />;
      case 'kds': return <KDSView pendingOrders={pendingOrders} setPendingOrders={setPendingOrders} />;
      case 'pos':
        return (
          <SalesView
            initialTab={salesViewTab}
            currentBranchId={currentBranchId}
            sales={sales}
            returns={returns}
            contacts={contacts}
            employees={employees}
            onAddSale={handleAddSale}
            onAddReturn={handleAddReturn}
            onUpdateSale={handleUpdateSale}
            onDeleteSale={handleDeleteSale}
            onModeChange={(mode) => setSalesViewTab(mode)}
            onOpenCashier={() => setIsCashierOpen(true)}
            onExit={() => setActiveModule('dashboard')}
          />
        );
      case 'reports': return <ReportsView sales={sales} returns={returns} />;
      case 'accounting': return <AccountingView />;
      case 'employees': return (
        <EmployeesView
          employees={employees}
          setEmployees={setEmployees}
          departments={departments}
          setDepartments={setDepartments}
        />
      );
      case 'performance': return (
        <PerformanceView
          sales={sales}
          attendanceLogs={attendanceLogs}
          rules={performanceRules}
          setRules={setPerformanceRules}
          complaints={complaintsData}
          setComplaints={setComplaintsData}
          onSendToPayroll={(data) => {
            // Logic to update payrollData
            setPayrollData(prev => {
              const existing = prev.find(p => p.employeeName === data.employeeName && p.period === 'Januari 2026');
              if (existing) {
                return prev.map(p => p.id === existing.id ? { ...p, allowance: data.totalReward } : p);
              }
              return [...prev, {
                id: Date.now(),
                employeeName: data.employeeName,
                position: data.position,
                basicSalary: 3000000, // Default or fetch
                allowance: data.totalReward,
                deduction: 0,
                status: 'Pending',
                period: 'Januari 2026'
              }];
            });
          }}
        />
      );
      case 'attendance': return <AttendanceView logs={attendanceLogs} setLogs={setAttendanceLogs} employees={employees} />;
      case 'payroll': return <PayrollView payroll={payrollData} setPayroll={setPayrollData} />;
      case 'branches': return <BranchesView />;
      case 'shifts': return <ShiftsView />;
      case 'inventory': return (
        <InventoryView
          ingredients={inventoryIngredients}
          movements={inventoryHistory}
          onUpdateIngredients={setInventoryIngredients}
          onUpdateHistory={setInventoryHistory}
          categories={categories}
          units={units}
        />
      );
      case 'settings': return (
        <SettingsView
          settings={receiptSettings}
          onUpdateSettings={setReceiptSettings}
        />
      );
      default: return (
        <DashboardView
          contacts={contacts}
          sales={sales}
          returns={returns}
          products={products}
          ingredients={inventoryIngredients}
          onNavigate={(module) => setActiveModule(module)}
        />
      );
    }
  };

  const handleModuleClick = (moduleId: string) => {
    setActiveModule(moduleId as ModuleType);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans relative">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />
      <aside className="w-56 bg-white/70 backdrop-blur-xl border-r border-white/20 flex flex-col py-8 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.05)] z-20">
        <div className="mb-10 px-6 relative flex items-center gap-3">
          <div className="bg-gradient-to-br from-primary to-orange-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 transform hover:scale-110 transition-transform duration-300 flex-shrink-0">
            <span className="font-extrabold text-[10px] text-white leading-none tracking-tight">POS</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-gray-800 text-sm tracking-tight leading-none">WINPOS</span>
            <span className="text-[10px] text-gray-400 font-medium">Enterprise Management</span>
          </div>
        </div>
        <nav className="flex-1 w-full px-4 space-y-1 overflow-y-auto min-h-0 pb-2">
          {allowedModules.map((module) => {
            const isActive = activeModule === module.id;
            return (
              <button
                key={module.id}
                onClick={() => handleModuleClick(module.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-300 group relative ${isActive ? 'bg-white shadow-sm ring-1 ring-gray-100' : 'hover:bg-white/50 hover:translate-x-1'}`}
              >
                {isActive && <div className="absolute inset-0 bg-primary/5 rounded-2xl" />}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 relative overflow-hidden flex-shrink-0 ${isActive ? 'bg-gradient-to-br from-primary to-orange-600 text-white shadow-lg shadow-orange-500/20' : 'text-gray-400 group-hover:text-primary bg-white shadow-sm border border-gray-100'}`}>
                  <module.icon className="w-4 h-4 relative z-10" />
                </div>
                <span className={`text-[13px] font-semibold tracking-tight transition-colors duration-300 ${isActive ? 'text-gray-800' : 'text-gray-500 group-hover:text-gray-900'}`}>
                  {module.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto relative z-10">
        <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-white/20 px-10 py-5 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
              {allModules.find(m => m.id === activeModule)?.label || 'WinPOS'}
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-1 tracking-wide uppercase opacity-80">Sistem Terintegrasi</p>
          </div>

          <div className="flex items-center gap-6">
            {/* Branch Selector */}
            <div className="hidden md:flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
              <Store className="w-4 h-4 text-primary" />
              <select
                value={currentBranchId}
                onChange={(e) => setCurrentBranchId(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
              >
                {branchList.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div className="h-8 w-[1px] bg-gray-200 hidden lg:block" />

            {/* Sync Status Info */}
            <div className="hidden sm:flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
              <div className="flex flex-col items-center">
                {isOnline ? (
                  <div className="flex items-center gap-2 text-green-600 font-bold text-[10px] uppercase">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Online
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-500 font-bold text-[10px] uppercase">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Offline
                  </div>
                )}
              </div>
              <div className="w-[1px] h-6 bg-gray-200" />
              <div className="flex items-center gap-2">
                {sales.some(s => s.syncStatus === 'pending') ? (
                  <div className="flex items-center gap-2 text-orange-500 text-xs font-semibold">
                    <Clock className="w-4 h-4" />
                    <span>{sales.filter(s => s.syncStatus === 'pending').length} Menunggu</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    <span>Sinkron</span>
                  </div>
                )}
              </div>
            </div>

            <div className="h-8 w-[1px] bg-gray-200 hidden lg:block" />

            <button
              onClick={() => setIsCashierOpen(true)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all"
              title="Buka Kasir"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-blue-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
                  A
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-gray-700">{user?.user_metadata?.name || 'User'}</p>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-wider">
                    {role || 'Memuat...'}
                  </p>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-50 mb-2">
                    <p className="text-sm font-bold text-gray-800">Akun Saya</p>
                    <p className="text-xs text-gray-500 truncate">admin@winpos.com</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setActiveModule('settings');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Pengaturan
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="h-[calc(100vh-80px)] overflow-auto">
          {renderActiveModule()}
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none z-0">
          <h1 className="text-[20vw] font-bold text-gray-900 rotate-[-15deg]">WinPOS</h1>
        </div>
      </main>

      {isCashierOpen && (
        <div className="fixed inset-0 z-[40] bg-white animate-in fade-in duration-200">
          <CashierInterface
            orderItems={orderItems}
            orderDiscount={orderDiscount}
            setOrderItems={setOrderItems}
            setOrderDiscount={setOrderDiscount}
            onAddSale={handleAddSale}
            onBack={() => setIsCashierOpen(false)}
            contacts={contacts}
            employees={employees}
            onSendToKDS={handleSendToKDS}
          />
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <LogOut className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-800 mb-2">Konfirmasi Keluar</h3>
            <p className="text-gray-500 text-center mb-8">Apakah Anda yakin ingin keluar dari sistem? Pastikan semua transaksi sudah tersimpan.</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Batal
              </Button>
              <Button
                className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-100"
                onClick={() => supabase.auth.signOut()}
              >
                Keluar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
