import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Users, ShoppingCart, Settings, Coffee, FileText,
  LogOut, Bell, Search, Menu, Calculator, ChefHat, MonitorCheck,
  Contact, Archive, MapPin, CalendarCheck, History as ClockHistory, Wallet, Award, Target,
  Store, ChevronLeft, ChevronRight, CheckCircle, Package, RefreshCw, ShieldCheck, Clock, History, Percent, Fingerprint
} from 'lucide-react';
import { printerService } from '../lib/PrinterService';
import { WifiVoucherService } from '../lib/WifiVoucherService';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { PettyCashService } from '../lib/PettyCashService';
import { useAuth } from './auth/AuthProvider';
import { useSessionGuard } from './auth/SessionGuardContext';
import { DashboardView } from './dashboard/DashboardView';
import { UsersView } from './users/UsersView';
import { ContactsView, ContactData } from './contacts/ContactsView';
import { ProductsView } from './products/ProductsView';
import { PurchasesView } from './purchases/PurchasesView';
import { ReportsView } from './reports/ReportsView';
import { AccountingView } from './accounting/AccountingView';
import { SettingsView } from './settings/SettingsView';
import { EmployeesView } from './employees/EmployeesView';
import { AttendanceView } from './attendance/AttendanceView';
import { PayrollView } from './payroll/PayrollView';
import { PerformanceIndicatorMasterView } from './employees/PerformanceIndicatorMasterView';
import { SalesView, SalesOrder, SalesReturn, INITIAL_SALES } from './pos/SalesView';
import { CashierInterface } from './pos/CashierInterface';
import { BranchesView } from './branches/BranchesView';
import { ShiftsView } from './shifts/ShiftsView';
import { InventoryView, Ingredient as InvIngredient, StockMovement } from './inventory/InventoryView';
import { KDSView } from './pos/KDSView';
import { PromosView } from './promos/PromosView';
import { SessionHistoryView } from './pos/SessionHistoryView';
import { DashboardSkeleton } from './skeletons/DashboardSkeleton';
import { PWAInstallButton } from './ui/PWAInstallButton';
import { OrderItem } from '@/types/pos';
import { mockProducts } from '@/data/products';
import { toast } from 'sonner';

type ModuleType = 'dashboard' | 'users' | 'contacts' | 'products' | 'purchases' | 'pos' | 'kds' | 'reports' | 'accounting' | 'settings' | 'employees' | 'attendance' | 'payroll' | 'branches' | 'shifts' | 'performance_indicators' | 'inventory' | 'session_history' | 'promos';

const formatLocalDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


function Home() {
  const { user, role, permissions, loading, profileEmail, profileName } = useAuth(); // Retrieve actual user data
  const { canLogout, currentSession, requireMandatorySession } = useSessionGuard();

  const [activeModule, setActiveModule] = useState<ModuleType>(
    (localStorage.getItem('winpos_active_module') as ModuleType) || 'dashboard'
  );
  const [salesViewTab, setSalesViewTab] = useState<'history' | 'returns'>('history');
  const [sales, setSales] = useState<SalesOrder[]>([]);

  // Persist active module
  useEffect(() => {
    if (activeModule) {
      localStorage.setItem('winpos_active_module', activeModule);
    }
  }, [activeModule]);
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  // const [userRole, setUserRole] = useState<string>('Administrator'); // Replaced by useAuth
  const [isOnline, setIsOnline] = useState(() => {
    return localStorage.getItem('force_offline') === 'true' ? false : navigator.onLine;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentBranchId, setCurrentBranchId] = useState(localStorage.getItem('winpos_current_branch') || '7');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [voucherStats, setVoucherStats] = useState({ total: 0, used: 0, available: 0 });
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [autoSelectedTable, setAutoSelectedTable] = useState<string>('');
  const [urlParamProcessed, setUrlParamProcessed] = useState(false); // Track if URL param was processed
  const [autoOpenPayment, setAutoOpenPayment] = useState(false);
  const [autoOpenSaleId, setAutoOpenSaleId] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0); // New state for badge
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const fetchTransactionsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const todayLocal = formatLocalDateForInput(new Date());

  const debouncedFetchTransactions = () => {
    if (fetchTransactionsDebounceRef.current) {
      clearTimeout(fetchTransactionsDebounceRef.current);
    }
    fetchTransactionsDebounceRef.current = setTimeout(() => {
      fetchTransactions();
    }, 1000); // 1s debounce
  };
  // Persist Branch Selection
  useEffect(() => {
    if (currentBranchId) {
      localStorage.setItem('winpos_current_branch', currentBranchId);
    }
  }, [currentBranchId]);

  const [employees, setEmployees] = useState<any[]>([]);

  // POS State
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [topSellingProducts, setTopSellingProducts] = useState<string[]>([]);

  // Restored Missing States
  const [units, setUnits] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);

  // Centralized State for Integration
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [performanceIndicators, setPerformanceIndicators] = useState<any[]>([]);
  const [performanceEvaluations, setPerformanceEvaluations] = useState<any[]>([]);

  // --- Handlers ---
  const handleTableCRUD = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        const { id, ...rest } = data;
        const payload = { ...rest, branch_id: currentBranchId };
        const { error } = await supabase.from('tables').insert([payload]);
        if (error) throw error;
        toast.success('Meja berhasil ditambahkan');
      } else if (action === 'update') {
        const { id, ...rest } = data;
        const { error } = await supabase.from('tables').update(rest).eq('id', id);
        if (error) throw error;
        toast.success('Meja berhasil diupdate');
      } else if (action === 'delete') {
        const { error } = await supabase.from('tables').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Meja berhasil dihapus');
      }
      if (currentBranchId) fetchBranchData(currentBranchId);
    } catch (err: any) {
      toast.error('Error Table: ' + err.message);
    }
  };

  const handlePaymentMethodCRUD = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        const { error } = await supabase.from('payment_methods').insert([data]);
        if (error) throw error;
        toast.success('Metode pembayaran ditambahkan');
      } else if (action === 'update') {
        const { id, ...rest } = data;
        const { error } = await supabase.from('payment_methods').update(rest).eq('id', id);
        if (error) throw error;
        toast.success('Metode pembayaran diperbarui');
      } else if (action === 'delete') {
        const { error } = await supabase.from('payment_methods').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Metode pembayaran dihapus');
      }
    } catch (err: any) {
      toast.error('Gagal memproses metode pembayaran: ' + err.message);
    }
  };

  const handleModuleClick = (moduleId: string) => {
    if (moduleId === 'kasir') {
      setIsCashierOpen(true);
    } else {
      setActiveModule(moduleId as ModuleType);
    }
  };



  const handleClearTableStatus = async (tableNo: string) => {
    try {
      const { error } = await supabase
        .from('tables')
        .update({ status: 'Available' })
        .eq('number', tableNo)
        .eq('branch_id', currentBranchId);

      if (error) throw error;
      toast.success(`Meja ${tableNo} sekarang tersedia`);
      if (currentBranchId) fetchBranchData(currentBranchId);
    } catch (err: any) {
      toast.error('Gagal update status meja: ' + err.message);
    }
  };

  const formatPeriod = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch (e) {
      return '';
    }
  };

  const syncPerformanceToPayroll = async (data: any, employeeId: number) => {
    try {
      const allowanceAmount = Math.round(data.base_salary * (data.total_score / 100));
      const period = formatPeriod(data.evaluation_date);
      const emp = employees.find(e => e.id === Number(employeeId));
      
      if (emp && period) {
        const { data: existingPayroll } = await supabase
          .from('payrolls')
          .select('id, status')
          .eq('employee_name', emp.name)
          .eq('period', period)
          .maybeSingle();

        if (existingPayroll) {
          if (existingPayroll.status === 'Pending') {
            await supabase.from('payrolls').update({ allowance: allowanceAmount }).eq('id', existingPayroll.id);
            toast.info(`Payroll ${emp.name} (${period}) diperbarui otomatis`);
          } else {
            toast.warning(`Payroll ${emp.name} (${period}) sudah berstatus PAID. Tunjangan kinerja tidak diubah.`);
          }
        } else {
          await supabase.from('payrolls').insert([{
            employee_name: emp.name,
            employee_id: emp.id,
            position: emp.position || '-',
            basic_salary: data.base_salary,
            allowance: allowanceAmount,
            deduction: 0,
            status: 'Pending',
            period: period,
            branch_id: currentBranchId ? Number(currentBranchId) : null
          }]);
          toast.success(`Draft Payroll ${emp.name} (${period}) dibuat otomatis`);
        }
      }
    } catch (syncErr: any) {
      console.error('Payroll sync error:', syncErr);
    }
  };

  // --- END HANDLERS ---

  // Inventory Handlers
  const handleIngredientCRUD = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        // Ensure numeric types
        const payload = {
          ...data,
          current_stock: Number(data.current_stock || 0),
          min_stock: Number(data.min_stock || 0),
          cost_per_unit: Number(data.cost_per_unit || 0),
          branch_id: currentBranchId
        };
        const { error } = await supabase.from('ingredients').insert([payload]);
        if (error) throw error;
        toast.success('Bahan baku berhasil ditambahkan');
      } else if (action === 'update') {
        const { id, ...payload } = data;
        const { error } = await supabase.from('ingredients').update(payload).eq('id', id);
        if (error) throw error;
        toast.success('Bahan baku berhasil diupdate');
      } else if (action === 'delete') {
        const { error } = await supabase.from('ingredients').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Bahan baku berhasil dihapus');
      }
      // Proactive re-fetch for immediate feedback
      if (currentBranchId) fetchBranchData(currentBranchId);
    } catch (err: any) {
      toast.error('Error Ingredient: ' + err.message);
    }
  };

  const handleStockAdjustment = async (adjustment: any) => {
    try {
      const { ingredientId, ingredientName, type, quantity, unit, reason, user } = adjustment;
      const qty = Number(quantity);

      // 1. Insert Movement
      const { error: moveError } = await supabase.from('stock_movements').insert([{
        ingredient_id: ingredientId,
        ingredient_name: ingredientName,
        branch_id: currentBranchId,
        type,
        quantity: qty,
        unit,
        reason,
        user: user || 'System'
      }]);
      if (moveError) throw moveError;

      // 2. Update Ingredient Stock
      const { data: ing } = await supabase.from('ingredients').select('current_stock').eq('id', ingredientId).single();
      if (ing) {
        let newStock = Number(ing.current_stock);
        if (type === 'IN') newStock += qty;
        else if (type === 'OUT') newStock -= qty;
        else if (type === 'ADJUSTMENT') newStock = qty;

        const { error: updateError } = await supabase.from('ingredients')
          .update({ current_stock: newStock, last_updated: new Date() })
          .eq('id', ingredientId);

        if (updateError) throw updateError;
      }

      toast.success('Stok berhasil disesuaikan');
    } catch (err: any) {
      toast.error('Gagal update stok: ' + err.message);
    }
  };

  // --- Payment Methods State ---
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);




  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftSchedules, setShiftSchedules] = useState<any[]>([]);



  // Inventory & HPP State

  const [inventoryIngredients, setInventoryIngredients] = useState<any[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<any[]>([]);


  // --- Master Data State ---


  // --- Accounting State ---
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);

  const [storeSettings, setStoreSettings] = useState<any>({
    store_name: 'Winny Pangeran Natakusuma',
    receipt_header: 'Winny Pangeran Natakusuma',
    receipt_footer: 'Thank You',
    receipt_paper_width: '58mm',
    show_date: true,
    show_waiter: true,
    show_table: true,
    show_customer_name: true,
    show_customer_status: true,
    show_logo: true,
    receipt_logo_url: '',
    address: '',
    enable_table_management: true
  });

  // --- WiFi Voucher State ---

  const fetchVoucherStats = async () => {
    if (!currentBranchId) return;
    const stats = await WifiVoucherService.getCounts(currentBranchId);
    setVoucherStats(stats);
  };

  useEffect(() => {
    fetchVoucherStats();
    // Refresh stats every 30 seconds or when branch changes
    const interval = setInterval(fetchVoucherStats, 30000);
    return () => clearInterval(interval);
  }, [currentBranchId]);

  // --- Master Data Integration ---
  const fetchGlobalData = async () => {
    // Fetch data that doesn't depend on branch
    const safeFetch = async (promise: any, name: string) => {
      try {
        const res = await promise;
        if (res.error) console.warn(`Error fetching ${name}:`, res.error.message);
        return res;
      } catch (err) {
        console.error(`Crash fetching ${name}:`, err);
        return { data: null, error: err };
      }
    };

    const results = await Promise.all([
      safeFetch(supabase.from('categories').select('*').order('sort_order'), 'categories'),
      safeFetch(supabase.from('units').select('*').order('name'), 'units'),
      safeFetch(supabase.from('brands').select('*').order('name'), 'brands'),
      safeFetch(supabase.from('contacts').select('*').order('name'), 'contacts'),
      safeFetch(supabase.from('branches').select('*').order('id'), 'branches'),
      safeFetch(supabase.from('shifts').select('*').order('id'), 'shifts'),
      safeFetch(supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(), 'settings'),
      safeFetch(supabase.from('payment_methods').select('*').order('name'), 'payment_methods')
    ]);

    const [categoriesRes, unitsRes, brandsRes, contactsRes,
      branchesRes, shiftsRes, settingsRes, paymentsRes] = results;

    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (unitsRes.data) setUnits(unitsRes.data);
    if (brandsRes.data) setBrands(brandsRes.data);
    if (contactsRes.data) setContacts(contactsRes.data);
    if (branchesRes.data) {
      setBranches(branchesRes.data);
      // Initialize branch if needed (or validate existing one)
      if (branchesRes.data.length > 0) {
        // If currentBranchId is set but not found in fetched branches, reset to default
        const isValid = branchesRes.data.find(b => String(b.id) === currentBranchId);

        if (!currentBranchId || !isValid) {
          const defaultBranchId = String(branchesRes.data[0].id);
          setCurrentBranchId(defaultBranchId);
          // localStorage will be updated by useEffect
        }
      }
    }
    if (shiftsRes.data) setShifts(shiftsRes.data);
    if (settingsRes.data) setStoreSettings(settingsRes.data);
    if (paymentsRes.data) setPaymentMethods(paymentsRes.data);
  };

  const fetchTopSellingProducts = async (branchId: string) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('sale_items')
        .select('product_name, quantity, sales!inner(date)')
        .eq('branch_id', branchId)
        .gte('sales.date', thirtyDaysAgo.toISOString());

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach(item => {
        const name = item.product_name;
        if (name) {
          counts[name] = (counts[name] || 0) + (Number(item.quantity) || 1);
        }
      });

      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 50) // Get top 50 names
        .map(([name]) => name);

      setTopSellingProducts(sorted);
    } catch (err) {
      console.error('Error fetching top products:', err);
    }
  };

  const fetchBranchData = async (branchId: string) => {
    if (!branchId) return;

    const safeFetch = async (promise: any, name: string) => {
      try {
        const res = await promise;
        if (res.error) console.warn(`Error fetching ${name}:`, res.error.message);
        return res;
      } catch (err) {
        console.error(`Crash fetching ${name}:`, err);
        return { data: null, error: err };
      }
    };

    const results = await Promise.all([
      safeFetch(supabase.from('products').select('*').eq('branch_id', branchId).order('sort_order', { ascending: true }), 'products'),
      safeFetch(supabase.from('shift_schedules').select('*').order('date'), 'schedules'), // Needs JS filtering or relation update
      safeFetch(supabase.from('tables').select('*').eq('branch_id', branchId).order('number'), 'tables'),
      safeFetch(supabase.from('ingredients').select('*').eq('branch_id', branchId).order('name'), 'ingredients'),
      safeFetch(supabase.from('stock_movements').select('*').eq('branch_id', branchId).order('date', { ascending: false }), 'movements'),
    ]);

    const [productsRes, schedulesRes, tablesRes, ingredientsRes, movementsRes] = results;

    if (productsRes.data) {
      setProducts(productsRes.data);
    }

    // Filter schedules for employees in this branch (done in employees fetch usually, or here if we have employees list?)
    // For now, setting all schedules. Ideally should filter.
    if (schedulesRes.data) setShiftSchedules(schedulesRes.data);

    if (tablesRes.data) setTables(tablesRes.data);
    if (ingredientsRes.data) setInventoryIngredients(ingredientsRes.data);
    if (movementsRes.data) setInventoryHistory(movementsRes.data);

    // Fetch Performance Indicators
    const { data: indicatorsData } = await supabase.from('performance_indicators').select('*').or(`branch_id.eq.${branchId},branch_id.is.null`).order('created_at', { ascending: true });
    if (indicatorsData) setPerformanceIndicators(indicatorsData);

    // Fetch Performance Evaluations
    const { data: evaluationsData } = await supabase.from('performance_evaluations').select('*').eq('branch_id', branchId).order('evaluation_date', { ascending: false });
    if (evaluationsData) setPerformanceEvaluations(evaluationsData);






  };

  useEffect(() => {
    fetchGlobalData();

    // Subscribe to global changes
    const globalChannels = [
      supabase.channel('categories_all').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchGlobalData).subscribe(),
      supabase.channel('units_all').on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchGlobalData).subscribe(),
      supabase.channel('brands_all').on('postgres_changes', { event: '*', schema: 'public', table: 'brands' }, fetchGlobalData).subscribe(),
      supabase.channel('contacts_all').on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetchGlobalData).subscribe(),
      supabase.channel('branches_all').on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, fetchGlobalData).subscribe(),
      supabase.channel('shifts_all').on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, fetchGlobalData).subscribe(),
      supabase.channel('settings_all').on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, fetchGlobalData).subscribe(),
      supabase.channel('payments_all').on('postgres_changes', { event: '*', schema: 'public', table: 'payment_methods' }, fetchGlobalData).subscribe(),
    ];

    return () => {
      globalChannels.forEach(ch => ch.unsubscribe());
    };
  }, []);

  useEffect(() => {
    if (currentBranchId) {
      fetchBranchData(currentBranchId);
      fetchTopSellingProducts(currentBranchId);
    }

    // Subscribe to branch-specific changes
    // Note: receiving all events then re-fetching filtered is acceptable for now.
    const branchChannels = [
      supabase.channel('products_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('schedules_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'shift_schedules' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('ingredients_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('movements_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('tables_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('employee_assessments').on('postgres_changes', { event: '*', schema: 'public', table: 'employee_assessments' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('assessment_criteria').on('postgres_changes', { event: '*', schema: 'public', table: 'assessment_criteria' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('wifi_vouchers_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'wifi_vouchers' }, () => fetchVoucherStats()).subscribe(),

    ];

    return () => {
      branchChannels.forEach(ch => ch.unsubscribe());
    };
  }, [currentBranchId]);

  // --- Purchases Integration ---
  const fetchPurchases = async () => {
    if (!currentBranchId) return;
    const { data: pData } = await supabase.from('purchases').select('*').eq('branch_id', currentBranchId).order('created_at', { ascending: false });
    // Returns likely need filtering by purchase -> branch, but for now assuming 'purchase_returns' might be global or we fetch all and filter in JS if branch link isn't direct. 
    // Actually assuming purchases are filtered, returns for them should be relevant.
    const { data: rData } = await supabase.from('purchase_returns').select('*').order('created_at', { ascending: false });

    if (pData) setPurchases(pData);
    if (rData) setPurchaseReturns(rData);
  };

  useEffect(() => {
    fetchPurchases();
    const purchaseChannels = [
      supabase.channel('purchases_all').on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => fetchPurchases()).subscribe(),
      supabase.channel('returns_all').on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_returns' }, () => fetchPurchases()).subscribe(),
    ];
    return () => {
      purchaseChannels.forEach(ch => ch.unsubscribe());
    };
  }, [currentBranchId]);

  // --- Sales & POS Integration ---

  // Polling for Kiosk Orders and Badge Count
  // Ref to track last processed order ID for immediate access in listeners
  const lastProcessedOrderIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!currentBranchId || loading) return;

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkNewOrders = async () => {
      try {
        // 1. Get Count of Pending Orders for Badge
        const { count, error: countError } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('branch_id', currentBranchId)
          .eq('status', 'Pending');

        if (isMounted && !countError) setPendingCount(count || 0);

        // 2. Check for NEW order to notify
        const { data } = await supabase
          .from('sales')
          .select('*, items:sale_items(id)')
          .eq('branch_id', currentBranchId)
          .eq('status', 'Pending')
          .gt('id', lastProcessedOrderIdRef.current || 0)
          .order('id', { ascending: false })
          .limit(1);

        if (isMounted && data && data.length > 0) {
          const latestOrder = data[0];
          const itemCount = (latestOrder.items || []).length;
          
          if (latestOrder.id > (lastProcessedOrderIdRef.current || 0) && itemCount > 0) {
            lastProcessedOrderIdRef.current = latestOrder.id;

            const targetTable = latestOrder.table_no || latestOrder.tableNo || latestOrder.table_number;

            // [NEW] Respect disable_web_kiosk_notifications for Web App
            // Suppress auto-open and popups for Display/Kiosk orders
            const isDisplayOrder = !latestOrder.waiter_name || latestOrder.waiter_name === 'Kiosk' || latestOrder.waiter_name === 'User Display';
            const shouldSuppress = storeSettings?.disable_web_kiosk_notifications || isDisplayOrder;

            if (shouldSuppress) {
              console.log('[Polling] Suppression active for display/settings. Skipping UI alerts.');
              // We still want to fetch transactions so the list is updated quietly
              await fetchTransactions();
              return;
            }

            console.log('[Polling] Auto-opening order:', latestOrder.id);
            
            const prepareAndOpen = async () => {
              await fetchTransactions();
              setTimeout(() => {
                if (targetTable) setAutoSelectedTable(String(targetTable));
                else setAutoSelectedTable('');
                
                setAutoOpenSaleId(latestOrder.id);
                setAutoOpenPayment(false); 
                setIsCashierOpen(true);
              }, 100);
            };

            prepareAndOpen();

            toast.success(`Order Baru Masuk #${latestOrder.order_no}`, {
              action: {
                label: 'Buka',
                onClick: () => {
                  setIsCashierOpen(true);
                  setAutoOpenSaleId(latestOrder.id);
                  if (targetTable) setAutoSelectedTable(String(targetTable));
                  setAutoOpenPayment(false);
                }
              }
            });
          }
        }
      } catch (err) {
        if (isMounted) console.error('Polling Error:', err);
      } finally {
        if (isMounted) {
          timeoutId = setTimeout(checkNewOrders, 3000);
        }
      }
    };

    checkNewOrders(); // Run immediately once
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [currentBranchId, role, loading, storeSettings]);


  const fetchTransactions = async () => {
    if (!currentBranchId) return;

    // Fetch all sales in batches because Supabase select() can otherwise
    // return only the default page and hide older transactions from history.
    const pageSize = 1000;
    let salesData: any[] = [];
    let from = 0;

    while (true) {
      const { data: pageData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          items:sale_items(
            *,
            product:product_id(category)
          )
        `)
        .eq('branch_id', currentBranchId)
        .order('date', { ascending: false })
        .range(from, from + pageSize - 1); // Sort by Payment Time (Date) not Creation Time

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        break;
      }

      if (!pageData || pageData.length === 0) {
        break;
      }

      salesData = [...salesData, ...pageData];

      if (pageData.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    if (salesData) {
      const formattedSales = salesData.map(s => ({
        ...s,
        items: (s.items || []).length,
        id: s.id,
        orderNo: s.order_no,
        date: s.date,
        totalAmount: Number(s.total_amount || 0),
        paymentMethod: s.payment_method,
        status: s.status,
        waitingTime: (() => {
          if (s.waiting_time) return s.waiting_time;
          // Calculate from created_at → date (payment time) if available
          if (s.created_at && s.date && (s.status === 'Paid' || s.status === 'Completed')) {
            const diffMs = new Date(s.date).getTime() - new Date(s.created_at).getTime();
            if (diffMs > 0) {
              const mins = Math.floor(diffMs / 60000);
              const secs = Math.floor((diffMs % 60000) / 1000);
              if (mins === 0) return `${secs}d`;
              if (mins < 60) return `${mins}m ${secs}d`;
              const hours = Math.floor(mins / 60);
              return `${hours}j ${mins % 60}m`;
            }
          }
          return null;
        })(),
        customerName: s.customer_name,
        discount: Number(s.discount || 0),
        notes: s.notes,
        branchId: s.branch_id,
        waiterName: s.waiter_name,
        cashierName: s.cashier_name,
        tableNo: s.table_no,
        productDetails: (s.items || []).map((i: any) => ({
          name: i.product_name,
          quantity: i.quantity,
          price: i.price,
          target: i.target,
          category: i.product?.category
        })),
        printCount: s.print_count || 0,
        lastPrintedAt: s.last_printed_at
      }));
      setSales(formattedSales);

      const pendingFromDB = salesData
        .filter(s => ['Pending', 'Paid', 'Preparing', 'Ready'].includes(s.status)) // [FIX] Include ALL active statuses for KDS
        .map(s => ({
          id: s.id,
          orderNo: s.order_no,
          date: s.date,
          tableNo: s.table_no || '-',
          waiterName: s.waiter_name || 'Kiosk',
          time: new Date(s.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          items: (s.items || []).map((i: any) => {
            const product = products.find(p => p.name === i.product_name);
            return {
              name: i.product_name,
              quantity: i.quantity,
              target: i.target || product?.target || 'Kitchen', // Prefer DB value, fallback to product data
              status: 'Pending'
            };
          })
        }));

      setPendingOrders(prev => {
        // [FIX] Strict Sync: Remove stale DB orders, Add new DB orders, Keep Local orders
        const localOnlyOrders = prev.filter(p => typeof p.id === 'string' && p.id.startsWith('HOLD-'));
        return [...localOnlyOrders, ...pendingFromDB];
      });
    }

    const { data: returnsData } = await supabase.from('sales_returns').select('*').order('created_at', { ascending: false });
    if (returnsData) {
      setReturns(returnsData.map(r => ({
        ...r,
        id: r.id,
        returnNo: r.return_no,
        orderNo: r.sale_id,
        date: r.date,
        reason: r.reason,
        refundAmount: Number(r.refund_amount || 0),
        status: r.status
      })));
    }
  };

  useEffect(() => {
    fetchTransactions();
    const transactionChannels = [
      supabase.channel('sales_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, debouncedFetchTransactions).subscribe(),
      supabase.channel('sale_items_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, debouncedFetchTransactions).subscribe(),
      supabase.channel('returns_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'sales_returns' }, debouncedFetchTransactions).subscribe(),
    ];
    return () => {
      transactionChannels.forEach(ch => ch.unsubscribe());
      if (fetchTransactionsDebounceRef.current) clearTimeout(fetchTransactionsDebounceRef.current);
    };
  }, [currentBranchId]);

  // --- Accounting Integration ---
  const fetchAccounting = async () => {
    // 1. Fetch Master Data
    const { data: accData } = await supabase.from('accounts').select('*').order('code');
    if (accData) setAccounts(accData);

    const { data: journalData } = await supabase.from('journal_entries').select('*').order('date', { ascending: false });
    
    // [NEW] Automated 'Ghost Hunter' Cleanup (Part 26 - Fix)
    const cleanupOrphans = async () => {
      if (!journalData) return;
      
      const orphanedIds: number[] = [];
      
      // 1. Precise Sync (via reference_id)
      const payrollReferenced = journalData.filter(j => j.source_type === 'payroll' && j.reference_id);
      const salesReferenced = journalData.filter(j => j.source_type === 'sale' && j.reference_id);

      if (payrollReferenced.length > 0) {
        const { data: activePayrolls } = await supabase.from('payrolls').select('id');
        const activeIds = new Set((activePayrolls || []).map(p => String(p.id)));
        payrollReferenced.forEach(j => {
          if (!activeIds.has(String(j.reference_id))) orphanedIds.push(j.id);
        });
      }

      if (salesReferenced.length > 0) {
        const { data: activeSales } = await supabase.from('sales').select('id');
        const activeIds = new Set((activeSales || []).map(s => String(s.id)));
        salesReferenced.forEach(j => {
          if (!activeIds.has(String(j.reference_id))) orphanedIds.push(j.id);
        });
      }

      // 2. Fuzzy Sync (via description - for OLD records without reference_id)
      const oldPayrollJournals = journalData.filter(j => !j.reference_id && (j.description?.startsWith('Gaji Karyawan:') || j.description?.startsWith('Potongan Gaji:')));
      if (oldPayrollJournals.length > 0) {
        const { data: currentPayrolls } = await supabase.from('payrolls').select('employee_name, period');
        const activeKeys = new Set((currentPayrolls || []).map(p => `${p.employee_name}|${p.period}`));
        
        oldPayrollJournals.forEach(j => {
          // Parse: "Gaji Karyawan: Name (Period)" or similar
          const match = j.description.match(/(?:Gaji Karyawan:|Potongan Gaji:) (.*) \((.*)\)/);
          if (match) {
            const [, name, period] = match;
            if (!activeKeys.has(`${name.trim()}|${period.trim()}`)) orphanedIds.push(j.id);
          }
        });
      }

      const oldSalesJournals = journalData.filter(j => !j.reference_id && (j.description?.startsWith('Penjualan INV-') || j.description?.startsWith('HPP Penjualan INV-')));
      if (oldSalesJournals.length > 0) {
        const { data: currentSales } = await supabase.from('sales').select('order_no');
        const activeOrders = new Set((currentSales || []).map(s => s.order_no));
        
        oldSalesJournals.forEach(j => {
          const match = j.description.match(/(?:Penjualan|HPP Penjualan) (INV-\d+)/);
          if (match) {
            const [, orderNo] = match;
            if (!activeOrders.has(orderNo)) orphanedIds.push(j.id);
          }
        });
      }

      if (orphanedIds.length > 0) {
        console.log(`Cleaning up ${orphanedIds.length} orphaned/persistent ghost journal entries...`);
        const { error: delError } = await supabase.from('journal_entries').delete().in('id', orphanedIds);
        if (!delError) {
          // Re-fetch clean data and update state
          const { data: cleanData } = await supabase.from('journal_entries').select('*').order('date', { ascending: false });
          processJournalData(cleanData);
        }
      }
    };

    const processJournalData = (data: any[] | null) => {
      if (data) {
        setJournalEntries(data.map(j => ({
          ...j,
          debitAccount: j.debit_account,
          creditAccount: j.credit_account,
          amount: Number(j.amount)
        })));
      }
    };

    processJournalData(journalData);
    cleanupOrphans(); // Run in background after initial render
  };

  useEffect(() => {
    fetchAccounting();
    const accountingChannels = [
      supabase.channel('accounts_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, fetchAccounting).subscribe(),
      supabase.channel('journal_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, fetchAccounting).subscribe(),
    ];
    return () => {
      accountingChannels.forEach(ch => ch.unsubscribe());
    };
  }, []);

  // --- Employees Integration ---
  const fetchEmployees = async () => {
    if (!currentBranchId) return;
    const branchIdNum = Number(currentBranchId); // [FIX] Ensure numeric comparison
    const { data: empData } = await supabase.from('employees').select('*').eq('branch_id', branchIdNum).order('name');
    if (empData) {
      setEmployees(empData.map(e => ({
        ...e,
        joinDate: e.join_date,
        offDays: e.off_days || []
      })));
    }

    const { data: deptData } = await supabase.from('departments').select('*').order('name');
    if (deptData) setDepartments(deptData);
  };

  useEffect(() => {
    fetchEmployees();
    const employeeChannels = [
      supabase.channel('employees_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, fetchEmployees).subscribe(),
      supabase.channel('departments_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, fetchEmployees).subscribe(),
    ];
    return () => {
      employeeChannels.forEach(ch => ch.unsubscribe());
    };
  }, [currentBranchId]);





  // --- Realtime Order Notifications for Cashier (Restored & Modified) ---
  // --- Realtime Order Notifications & Sync ---
  useEffect(() => {
    if (!currentBranchId || loading) return;

    const channel = supabase
      .channel('sales_realtime_sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales', filter: `branch_id=eq.${currentBranchId}` },
        async (payload) => {
          console.log('Realtime: New Sale Detected', payload.new);
          const newOrder = payload.new;

          // 1. Fetch Items for this sale (Wait a bit for items to be inserted)
          await new Promise(resolve => setTimeout(resolve, 800));

          const { data: items, error } = await supabase
            .from('sale_items')
            .select(`
              *,
              product:product_id(category)
            `)
            .eq('sale_id', newOrder.id);

          if (error) {
            console.error('Error fetching realtime items:', error);
            return;
          }

          // 2. Format to SalesOrder
          const formattedSale: SalesOrder = {
            id: newOrder.id,
            orderNo: newOrder.order_no,
            date: newOrder.date,
            items: items ? items.length : 0,
            productDetails: items?.map((i: any) => ({
              name: i.product_name,
              quantity: i.quantity,
              price: i.price,
              category: i.product?.category,
              isManual: false
            })) || [],
            subtotal: newOrder.subtotal,
            discount: newOrder.discount,
            totalAmount: newOrder.total_amount,
            paymentMethod: newOrder.payment_method,
            status: newOrder.status,
            tableNo: newOrder.table_no,
            customerName: newOrder.customer_name,
            branchId: newOrder.branch_id,
            waiterName: newOrder.waiter_name,
            syncStatus: 'synced',
            waitingTime: 'Baru'
          };

          // 3. Update Sales State
          setSales(prev => {
            if (prev.some(s => s.id === formattedSale.id)) return prev;
            return [formattedSale, ...prev];
          });

          // 4. Special Handling for Kiosk OR Cashier Role (Auto-Open Cashier)
          // ONLY for Pending/Unpaid orders. Paid orders go straight to KDS and shouldn't interrupt Cashier.
          const isPaidCompleted = newOrder.status === 'Paid' || newOrder.status === 'Completed';
          const isMyOwnOrder = newOrder.id === lastProcessedOrderIdRef.current;
          
          // [REFINED] Robust Kiosk Detection
          const isKioskOrder = (newOrder.status === 'Unpaid' || newOrder.status === 'Pending') && 
                              (!newOrder.waiter_name || newOrder.waiter_name === 'Kiosk' || newOrder.waiter_name === 'User Display');
          // Show notification for all incoming orders (respect suppression setting or specifically ignore Display/Kiosk)
          const shouldSuppress = storeSettings?.disable_web_kiosk_notifications || isKioskOrder;
          
          if (!shouldSuppress) {
            toast.info(`Pesanan Masuk: ${formattedSale.orderNo}`);
          }

          // [FIX] Auto-open for External Orders (Waitress/Display/Admin)
          // Web app should NOT auto-open cashier if the setting is enabled.
          if (!isPaidCompleted && !isMyOwnOrder && (newOrder.status === 'Pending' || newOrder.status === 'Unpaid')) {
            if (shouldSuppress) {
              console.log('[Auto-Open] Suppression active. Skipping auto-open for web cashier.');
              return;
            }

            const targetTable = newOrder.table_no || newOrder.tableNo;

            console.log('[Auto-Open] Opening cashier for table:', targetTable);
            setIsCashierOpen(true);
            setAutoOpenSaleId(newOrder.id);
            setAutoOpenPayment(false); 

            if (targetTable) {
              setAutoSelectedTable(String(targetTable));
            } else {
              setAutoSelectedTable('');
            }

            toast.success(`Order Masuk Meja ${targetTable || 'Baru'}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBranchId, loading, role]);

  // --- Attendance Integration ---
  const fetchAttendance = async () => {
    try {
      // 1. Fetch raw attendance logs first (Independence)
      const { data, error } = await supabase.from('attendance_logs').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Core Attendance Fetch Failed:', error);
        return;
      }

      // 2. Fetch branch names for metadata (Optional failure)
      const { data: bData } = await supabase.from('branches').select('id, name');
      
      console.log(`[DEBUG] SUPABASE URL: ${import.meta.env.VITE_SUPABASE_URL}`);
      console.log(`[DEBUG] RAW ATTENDANCE COUNT: ${data?.length || 0}`);

      if (data) {
        setAttendanceLogs(data.map(log => {
          const branch = bData?.find(b => b.id === log.branch_id);
          return {
            ...log,
            employeeName: log.employee_name,
            checkIn: log.check_in,
            checkOut: log.check_out,
            branchName: branch?.name || `Branch ${log.branch_id || '?'}`
          };
        }));
      }
    } catch (err: any) {
      console.error('Critical Fetch Error:', err);
    }
  };

  useEffect(() => {
    fetchAttendance();
    const subscription = supabase.channel('attendance_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        fetchAttendance();
      })
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  // --- Payroll Integration ---
  const fetchPayroll = async () => {
    try {
      const { data, error } = await supabase.from('payrolls').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setPayrollData(data.map(p => ({
          ...p,
          employeeName: p.employee_name,
          basicSalary: p.basic_salary,
          paymentDate: p.payment_date,
        })));
      }
    } catch (err: any) {
      console.error('Fetch Payroll Error:', err);
    }
  };

  useEffect(() => {
    fetchPayroll();
    const sub = supabase.channel('payroll_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payrolls' }, fetchPayroll)
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, []);

  // --- Performance Evaluations Integration ---
  const fetchPerformanceEvaluations = async () => {
    if (!currentBranchId) return;
    const { data } = await supabase
      .from('performance_evaluations')
      .select('*')
      .eq('branch_id', Number(currentBranchId))
      .order('evaluation_date', { ascending: false });
    if (data) setPerformanceEvaluations(data);
  };

  useEffect(() => {
    fetchPerformanceEvaluations();
    const sub = supabase.channel('performance_eval_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_evaluations' }, fetchPerformanceEvaluations)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [currentBranchId]);

  const handlePayrollAction = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        const { id, employeeName, basicSalary, paymentDate, receipt_header, receipt_logo, ...rest } = data;
        const emp = employees.find(e => e.name === employeeName);
        const payload = {
          ...rest,
          employee_name: employeeName,
          employee_id: emp?.id,
          basic_salary: basicSalary,
          payment_date: paymentDate
        };
        // [NEW] Accounting Integration for Create
        if (payload.status === 'Paid') {
          const { data: inserted, error: insertError } = await supabase.from('payrolls').insert([payload]).select().single();
          if (insertError) throw insertError;

          const totalAmount = Number(basicSalary) + Number(rest.allowance || 0) + Number(rest.overtime || 0) - Number(rest.deduction || 0);

          await supabase.from('journal_entries').insert([{
            date: new Date().toISOString(),
            description: `Gaji Karyawan: ${employeeName} (${rest.period || ''})`,
            debit_account: '502',
            credit_account: '101',
            amount: totalAmount,
            reference_id: String(inserted.id),
            source_type: 'payroll'
          }]);

          const deductionAmount = Number(rest.deduction || 0);
          if (deductionAmount > 0) {
            await supabase.from('journal_entries').insert([{
              date: new Date().toISOString(),
              description: `Potongan Gaji: ${employeeName}`,
              debit_account: '502',
              credit_account: '402',
              amount: deductionAmount,
              reference_id: String(inserted.id),
              source_type: 'payroll'
            }]);
          }
          toast.success('Gaji berhasil dibuat & dicatat');
        } else {
            const { error } = await supabase.from('payrolls').insert([payload]);
            if (error) throw error;
            toast.success('Gaji berhasil dibuat');
        }
        toast.success('Gaji berhasil dibuat');

        // [NEW] Auto-redirect to Accounting to verify posting
        if (payload.status === 'Paid') {
          setTimeout(() => setActiveModule('accounting'), 1500);
        }

      } else if (action === 'update') {
        const { id, employeeName, basicSalary, paymentDate, receipt_header, receipt_logo, ...rest } = data;
        const payload = {
          ...rest,
          employee_name: employeeName,
          basic_salary: basicSalary,
          payment_date: paymentDate
        };
        const { error } = await supabase.from('payrolls').update(payload).eq('id', id);
        if (error) throw error;

        // [NEW] Accounting Integration: Auto-Journal if Paid
        if (payload.status === 'Paid') {
          // Check for existing journal to avoid duplicates (Optional but recommended)
          // For now, simpler: Just insert.
          const totalAmount = Number(basicSalary) + Number(rest.allowance || 0) - Number(rest.deduction || 0);

          await supabase.from('journal_entries').insert([{
            date: new Date().toISOString(),
            description: `Gaji Karyawan: ${employeeName} (${rest.period || ''})`,
            debit_account: '502', // Beban Gaji
            credit_account: '101', // Kas
            amount: totalAmount
          }]);

          // Deduction Journal Entry
          const deductionAmount = Number(rest.deduction || 0);
          if (deductionAmount > 0) {
            await supabase.from('journal_entries').insert([{
              date: new Date().toISOString(),
              description: `Potongan Gaji: ${employeeName}`,
              debit_account: '502', // Beban Gaji (Debit full)
              credit_account: '402', // Pendapatan Lain-lain (Credit allocation)
              amount: deductionAmount
            }]);
          }
        }

        toast.success('Gaji berhasil diupdate & dicatat ke Jurnal');

        // [NEW] Auto-redirect to Accounting to verify posting
        if (payload.status === 'Paid') {
          setTimeout(() => setActiveModule('accounting'), 1500); // Delay slightly for toast visibility
        }

      } else if (action === 'delete') {
        // [NEW] Sync Deletion to Accounting
        // 1. Primary delete via reference_id
        const { error: refError } = await supabase.from('journal_entries').delete().eq('reference_id', String(data.id)).eq('source_type', 'payroll');
        if (refError) console.warn('Ref delete error:', refError);
        
        // 2. Fallback delete for older records via description (Aggressive cleaning)
        if (data.employee_name || data.employeeName) {
          const name = data.employee_name || data.employeeName;
          // Clean both salary and deduction entries
          await supabase.from('journal_entries').delete().ilike('description', `%Gaji%${name}%`);
          await supabase.from('journal_entries').delete().ilike('description', `%Potongan%${name}%`);
        }

        const { error } = await supabase.from('payrolls').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Gaji berhasil dihapus & catatan akuntansi dibersihkan');
        fetchAccounting(); // Ensure UI updates
      }
    } catch (err: any) {
      toast.error('Error Payroll: ' + err.message);
    }
  };

  const handleAttendanceLog = async (logData: any, action: 'create' | 'update' | 'delete' = 'create') => {
    try {
      if (action === 'delete') {
        const { error } = await supabase.from('attendance_logs').delete().eq('id', logData.id);
        if (error) throw error;
        toast.success('Riwayat absensi dihapus');
        return;
      }

      const employee = employees.find(e => e.name === logData.employeeName);
      const payload = {
        employee_id: employee?.id || logData.employee_id,
        employee_name: logData.employeeName || logData.employee_name,
        branch_id: currentBranchId ? Number(currentBranchId) : (employee?.branch_id || logData.branch_id),
        date: logData.date,
        check_in: logData.checkIn || logData.check_in,
        check_out: logData.checkOut || logData.check_out,
        status: logData.status || 'Present'
      };

      if (action === 'update' || (logData.id && !logData.isNew)) {
        const { error } = await supabase.from('attendance_logs')
          .update(payload)
          .eq('id', logData.id);
        if (error) throw error;
        toast.success(`Data absensi diperbarui`);
      } else {
        // [Part 22] Verify persistence with .select()
        const { data, error } = await supabase.from('attendance_logs').insert([payload]).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Database menerima data tapi gagal menyimpannya ke tabel permanen.');
        }
        toast.success(`Absensi berhasil dicatat (DB ID: ${data[0].id}, Branch: ${data[0].branch_id})`);
        fetchAttendance(); // Immediate re-fetch to sync
      }
    } catch (err: any) {
      console.error('Attendance error:', err);
      toast.error('Gagal memproses absensi: ' + err.message);
    }
  };

  // Generic CRUD Handler
  const syncPurchaseWithAccounting = async (po: any) => {
    // 1. Journal Entry
    const creditAcc = po.payment_method === 'Transfer' ? '102' : '101'; // Bank vs Kas
    await supabase.from('journal_entries').insert([{
      date: po.date || formatLocalDateForInput(new Date()),
      description: `Pembelian Bahan: ${po.purchase_no || ''} (${po.supplier_name || ''})`,
      debit_account: '501', // Beban Pembelian
      credit_account: creditAcc,
      amount: po.total_amount,
      reference_id: String(po.id),
      source_type: 'purchase'
    }]);

    // 2. Petty Cash Integration
    if (po.payment_method === 'Kas Kecil') {
      try {
        const activeSession = await PettyCashService.getActiveSession(po.branch_id);
        if (activeSession) {
          await PettyCashService.addTransaction({
            session_id: activeSession.id,
            type: 'SPEND',
            amount: po.total_amount,
            description: `Pembelian: ${po.purchase_no}`,
            reference_type: 'purchase',
            reference_id: po.purchase_no
          });
          toast.success('Saldo Kas Kecil terpotong otomatis');
        } else {
          toast.warning('Pembelian "Kas Kecil" berhasil, namun tidak ada sesi Kas Kecil aktif untuk memotong saldo.');
        }
      } catch (pcErr) {
        console.error('Petty Cash Sync Error:', pcErr);
      }
    }
  };

  const handleMasterDataCRUD = async (
    table: string,
    action: 'create' | 'update' | 'delete',
    data: any
  ) => {
    try {
      if (action === 'create') {
        const { id, ...payload } = data; // Strip ID for auto-generation

        // Inject branch_id for branch-specific tables managed by this generic handler
        if (table === 'purchases') {
          (payload as any).branch_id = currentBranchId;
        }

        const { data: insertedData, error } = await supabase.from(table).insert([payload]).select().single();
        if (error) throw error;
        toast.success(`Data berhasil ditambahkan`);

        // [NEW] Accounting Integration for New Purchases
        if (table === 'purchases' && insertedData?.status === 'Completed') {
          await syncPurchaseWithAccounting(insertedData);
        }
      } else if (action === 'update') {
        const { error } = await supabase.from(table).update(data).eq('id', data.id);
        if (error) throw error;

        // [NEW] Accounting Integration for Updated Purchases
        if (table === 'purchases' && data.status === 'Completed') {
          // Fetch full purchase data for journaling
          const { data: po } = await supabase.from('purchases').select('*').eq('id', data.id).single();
          if (po) {
            await syncPurchaseWithAccounting(po);
            toast.success('Pembelian dicatat ke Akuntansi');
          }
        }
        
        toast.success(`Data berhasil diperbarui`);
      } else if (action === 'delete') {
        // [NEW] Sync Deletion to Accounting
        if (table === 'purchases') {
          await supabase.from('journal_entries').delete().eq('reference_id', String(data.id)).eq('source_type', 'purchase');
        }

        // [MODIFIED] Archive fallback for products to prevent FK conflicts
        const { error } = await supabase.from(table).delete().eq('id', data.id);
        
        if (error) {
          if (table === 'products' && error.code === '23503') {
            console.log('Product still referenced, archiving instead of deletion...');
            const { error: archiveError } = await supabase
              .from('products')
              .update({ is_sellable: false })
              .eq('id', data.id);
            
            if (archiveError) throw archiveError;
            toast.success(`Produk diarsipkan karena memiliki riwayat stok/penjualan`);
            return;
          }
          throw error;
        }
        toast.success(`Data berhasil dihapus`);
      }
    } catch (err: any) {
      console.error(`Error ${action} ${table}:`, err);
      toast.error(`Gagal memproses data: ${err.message || ''}`);
    }
  };
  // const [receiptSettings, setReceiptSettings] = useState({ ... }); // REMOVED - Using storeSettings

  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load data from localStorage
    const safeLoad = (key: string, setter: (data: any) => void, fallback?: any) => {
      const item = localStorage.getItem(key);
      if (item) {
        try {
          setter(JSON.parse(item));
        } catch (e) {
          console.error(`Failed to parse ${key}`, e);
          if (fallback) setter(fallback);
        }
      } else if (fallback) {
        setter(fallback);
      }
    };

    safeLoad('winpos_sales', setSales, INITIAL_SALES);
    safeLoad('winpos_returns', setReturns);

    // Load other master data
    safeLoad('winpos_employees', setEmployees);
    safeLoad('winpos_departments', setDepartments);
    safeLoad('winpos_ingredients', setInventoryIngredients);
    safeLoad('winpos_inventory_history', setInventoryHistory);
    safeLoad('winpos_categories', setCategories);
    safeLoad('winpos_units', setUnits);
    safeLoad('winpos_brands', setBrands);
    safeLoad('winpos_products', setProducts);
    safeLoad('winpos_contacts', setContacts);
    safeLoad('winpos_pending_orders', setPendingOrders);

    // Load saved branch from localStorage
    const savedBranchId = localStorage.getItem('winpos_current_branch');
    if (savedBranchId) {
      setCurrentBranchId(savedBranchId);
    } else if (!currentBranchId && branches.length > 0) {
      // Auto-select first branch if none selected and branches exist
      setCurrentBranchId(String(branches[0].id));
    }


    // const savedReceipt = localStorage.getItem('winpos_receipt_settings'); // Removed
    // if (savedReceipt) setReceiptSettings(JSON.parse(savedReceipt));

    // Network status listeners
    // Network status listeners
    const handleOnline = () => {
      const forced = localStorage.getItem('force_offline') === 'true';
      if (!forced) setIsOnline(true);
    };
    const handleOffline = () => setIsOnline(false);

    // Listen to custom force_offline updates (from Settings)
    const handleForceOfflineChange = () => {
      const forced = localStorage.getItem('force_offline') === 'true';
      setIsOnline(!forced && navigator.onLine);
    };
    window.addEventListener('storage', handleForceOfflineChange);
    // We might need a custom event if storage event doesn't fire on same window
    window.addEventListener('force-offline-change', handleForceOfflineChange);

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
      window.removeEventListener('storage', handleForceOfflineChange);
      window.removeEventListener('force-offline-change', handleForceOfflineChange);
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

  // [NEW] Handle Table Direct Link (from Mobile Redirect) - Run after data is loaded
  useEffect(() => {
    // Only run once when component mounts and branch is set
    if (!currentBranchId || urlParamProcessed || loading) return;

    const lowerRole = role?.toLowerCase() || '';
    const isManager = lowerRole === 'admin' || lowerRole === 'administrator' || lowerRole === 'owner';
    if (isManager) return; // [FIX] Prevents Cashier loop for Admin roles on page load

    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');

    if (tableParam) {
      console.log('[URL Param] Detected Table Link:', tableParam);
      console.log('[URL Param] Current Branch:', currentBranchId);
      console.log('[URL Param] Sales Count:', sales.length);

      // Mark as processed immediately to prevent multiple runs
      setUrlParamProcessed(true);

      // Small delay to ensure data is fully loaded
      setTimeout(() => {
        console.log('[URL Param] Opening cashier for table:', tableParam);
        setAutoSelectedTable(tableParam);
        setIsCashierOpen(true);
        toast.success(`Membuka Kasir untuk Meja ${tableParam}`);

        // Clean up URL after opening cashier
        window.history.replaceState({}, '', window.location.pathname);
      }, 1000); // Increased to 1 second for better reliability
    }
  }, [currentBranchId, urlParamProcessed, loading, role]); // Run when branch is set

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

  // Persist currentBranchId to localStorage
  useEffect(() => {
    if (currentBranchId) {
      localStorage.setItem('winpos_current_branch', currentBranchId);
    }
  }, [currentBranchId]);

  // Sync receipt settings to PrinterService
  useEffect(() => {
    if (storeSettings) {
      printerService.setTemplate({
        header: storeSettings.receipt_header,
        address: storeSettings.address,
        footer: storeSettings.receipt_footer,
        paperWidth: storeSettings.receipt_paper_width,
        showDate: storeSettings.show_date,
        showWaiter: storeSettings.show_waiter,
        showTable: storeSettings.show_table,
        showCustomerName: storeSettings.show_customer_name,
        showCustomerStatus: storeSettings.show_customer_status,
        showCashierName: storeSettings.show_cashier_name ?? true,
        showLogo: storeSettings.show_logo,
        logoUrl: storeSettings.receipt_logo_url,
        // Kitchen Specifics
        kitchenHeader: storeSettings.kitchen_header,
        kitchenFooter: storeSettings.kitchen_footer,
        kitchenShowTable: storeSettings.kitchen_show_table,
        kitchenShowWaiter: storeSettings.kitchen_show_waiter,
        kitchenShowDate: storeSettings.kitchen_show_date,
        kitchenShowCashier: storeSettings.kitchen_show_cashier,
        // Bar Specifics
        barHeader: storeSettings.bar_header,
        barFooter: storeSettings.bar_footer,
        barShowTable: storeSettings.bar_show_table,
        barShowWaiter: storeSettings.bar_show_waiter,
        barShowDate: storeSettings.bar_show_date,
        barShowCashier: storeSettings.bar_show_cashier,
      });
    }
  }, [storeSettings]);

  // Background Sync Effect
  useEffect(() => {
    const syncData = async () => {
      if (!isOnline) return;

      const pendingSales = sales.filter(s => s.syncStatus === 'pending');
      // returns logic if needed, simplfied for now to focus on Sales as per user complaint
      // const pendingReturns = returns.filter(r => r.syncStatus === 'pending');

      if (pendingSales.length === 0) return;

      setIsSyncing(true);
      const toastId = toast.loading(`Menyinkronkan ${pendingSales.length} transaksi...`);
      let successCount = 0;

      const newSales = [...sales]; // Clone to mutate state locally after sync

      for (const sale of pendingSales) {
        try {
          // Mapping based on SalesOrder interface
          const salePayload = {
            order_no: sale.orderNo,
            date: sale.date,
            total_amount: sale.totalAmount,
            payment_method: sale.paymentMethod,
            status: 'Paid',
            waiter_name: sale.waiterName || 'Cashier',
            table_no: sale.tableNo || null,
            customer_name: sale.customerName || 'Guest',
            branch_id: currentBranchId,
            discount: sale.discount || 0,
            subtotal: sale.subtotal || sale.totalAmount,
            tax: sale.tax || 0,
            service_charge: 0 // Not explicitly in SalesOrder
          };

          // [IDEMPOTENCY CHECK] Check if Order No already exists (Idempotency)
          const { data: existingSale } = await supabase
            .from('sales')
            .select('id')
            .eq('order_no', sale.orderNo)
            .maybeSingle();

          let saleData;
          if (existingSale) {
            console.log('[Sync] Order already exists, skipping insert:', sale.orderNo);
            saleData = existingSale;
          } else {
            const { data, error: saleError } = await supabase
              .from('sales')
              .insert([salePayload])
              .select()
              .single();

            if (saleError) throw saleError;
            saleData = data;
          }

          // Items - Mapping from productDetails
          // CAUTION: productDetails might lack product_id. We'll try to use 'id' if present (casted) or 0.
          const itemsPayload = (sale.productDetails || []).map((item: any) => ({
            sale_id: saleData.id,
            product_id: item.id || 0, // Best effort fallback
            product_name: item.name,
            quantity: item.quantity,
            price: item.price,
            cost: 0,
            variant_id: null,
            note: ''
          }));

          const { error: itemsError } = await supabase.from('sale_items').insert(itemsPayload);
          if (itemsError) throw itemsError;

          // [NEW] Accounting Sync for Offline Orders
          if (sale.status === 'Paid') {
            await recordAccountingEntry(sale, itemsPayload);
          }

          // Update local state to synced
          const index = newSales.findIndex(s => s.id === sale.id);
          if (index !== -1) {
            newSales[index] = { ...newSales[index], syncStatus: 'synced' };
          }
          successCount++;

        } catch (err) {
          console.error("Sync error for sale:", sale.orderNo, err);
          // Keep as pending
        }
      }

      if (successCount > 0) {
        setSales(newSales);
        toast.success(`${successCount} transaksi berhasil disinkronkan!`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
      setIsSyncing(false);
    };

    if (isOnline) {
      // Debounce slightly
      const timer = setTimeout(() => syncData(), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, sales]);

  // Clock Effect
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const recordAccountingEntry = async (sale: any, items: any[], paymentType?: string) => {
    try {
      const orderNo = sale.order_no || sale.orderNo;
      const totalAmount = sale.total_amount || sale.totalAmount;
      const paymentMethod = (sale.payment_method || sale.paymentMethod || '').toLowerCase().trim();
      
      if (!orderNo || !totalAmount) return false;

      // [MODIFIED] Check by reference_id AND source_type instead of fuzzy description
      if (sale.id) {
        const { data: existing } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('reference_id', String(sale.id))
          .eq('source_type', 'sale')
          .maybeSingle();

        if (existing) {
          console.log('Accounting entry already exists for Sale ID:', sale.id);
          return true;
        }
      }

      const isCash =
        paymentType === 'cash' ||
        paymentMethod === 'cash' ||
        paymentMethod === 'tunai' ||
        paymentMethod.includes('tunai') ||
        paymentMethod.includes('cash');

      const debitAcc = isCash ? '101' : '102';

        // 1. Revenue Entry
        const { error: revError } = await supabase.from('journal_entries').insert([{
          date: formatLocalDateForInput(new Date()),
          description: `Penjualan ${orderNo}`,
          debit_account: debitAcc,
          credit_account: '401', // Pendapatan Penjualan
          amount: totalAmount,
          reference_id: String(sale.id),
          source_type: 'sale'
        }]);

        if (revError) {
          console.error('Revenue Sync Failed:', revError);
          // [DIAGNOSTIC] Show explicit error to user if columns are missing
          if (revError.code === '42703') {
            toast.error('Gagal Sinkron: Kolom reference_id belum ada di Database. Harap jalankan SQL script.');
          } else {
            toast.error('Gagal Sinkron Akuntansi: ' + revError.message);
          }
          return false;
        }

        // 2. COGS (HPP) Entry
        const totalCost = items.reduce((acc, item) => acc + ((item.cost || 0) * (item.quantity || 0)), 0);
        if (totalCost > 0) {
          const { error: hppError } = await supabase.from('journal_entries').insert([{
            date: formatLocalDateForInput(new Date()),
            description: `HPP Penjualan ${orderNo}`,
            debit_account: '501', // Beban Pembelian / HPP
            credit_account: '104', // Persediaan
            amount: totalCost,
            reference_id: String(sale.id),
            source_type: 'sale'
          }]);
          if (hppError) toast.error('HPP Gagal Sinkron: ' + hppError.message);
        }
      
      // Refresh the local accounting data after successful sync
      fetchAccounting();
      
      return true;
    } catch (err) {
      console.error('Accounting Error:', err);
      return false;
    }
  };

  const handleAddSale = async (saleData: Omit<SalesOrder, 'id' | 'orderNo' | 'date' | 'status'> & { id?: number, order_no?: string }) => {
    try {
      let sale;
      let targetId = saleData.id;

      // [SAFETY] If ID is missing, try to find by Order No to prevent duplicates
      if (!targetId && saleData.order_no) {
        const { data: existing } = await supabase
          .from('sales')
          .select('id')
          .eq('order_no', saleData.order_no)
          .maybeSingle();
        if (existing) {
          console.log('Found existing sale by Order No, switching to update mode:', existing.id);
          targetId = existing.id;
        }
      }

      if (targetId) {
        // [UPDATE EXISTING]
        console.log('Updating sale:', targetId);
        const { data, error } = await supabase
          .from('sales')
          .update({
            total_amount: saleData.totalAmount,
            payment_method: saleData.paymentMethod,
            status: 'Paid',
            waiter_name: saleData.waiterName,
            cashier_name: user?.user_metadata?.name || user?.email || role || 'Admin',
            customer_name: saleData.customerName,
            discount: saleData.discount || 0,
            tax: saleData.tax || 0,
            date: new Date().toISOString()
          })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;
        sale = data;
      } else {
        // [CREATE NEW] - Handle Invoice Numbering
        let finalOrderNo = saleData.order_no;

        // Function to generate offline invoice number
        const generateOfflineOrderNo = () => {
          const mode = storeSettings?.offline_invoice_mode || 'auto';
          const prefix = storeSettings?.offline_invoice_prefix || 'OFF';
          const lastNumber = Number(storeSettings?.offline_invoice_last_number) || 0;

          if (mode === 'auto') {
            const nextNumber = lastNumber + 1;
            const newNo = `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
            // Update local counter
            setStoreSettings(prev => prev ? { ...prev, offline_invoice_last_number: nextNumber } : null);
            // Non-blocking update to DB
            supabase.from('store_settings').update({ offline_invoice_last_number: nextNumber }).eq('id', 1).then(() => {});
            return newNo;
          } else {
            const timestamp = Date.now().toString().slice(-6);
            return `${prefix}-${new Date().getFullYear()}-${timestamp}`;
          }
        };

        if (!finalOrderNo) {
          if (isOnline) {
            const mode = storeSettings?.invoice_mode || 'auto';
            const prefix = storeSettings?.invoice_prefix || 'INV';
            const lastNumber = Number(storeSettings?.invoice_last_number) || 0;

            if (mode === 'auto') {
              const nextNumber = lastNumber + 1;
              finalOrderNo = `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
              // Increment the counter
              await supabase.from('store_settings').update({ invoice_last_number: nextNumber }).eq('id', 1);
              setStoreSettings(prev => prev ? { ...prev, invoice_last_number: nextNumber } : null);
            } else {
              const timestamp = Date.now().toString().slice(-6);
              finalOrderNo = `${prefix}-${new Date().getFullYear()}-${timestamp}`;
            }
          } else {
            finalOrderNo = generateOfflineOrderNo();
          }
        }

        const salePayload = {
          order_no: finalOrderNo,
          date: new Date().toISOString(),
          total_amount: saleData.totalAmount,
          payment_method: saleData.paymentMethod,
          status: 'Paid',
          branch_id: currentBranchId,
          waiter_name: saleData.waiterName,
          cashier_name: user?.user_metadata?.name || user?.email || role || 'Admin',
          table_no: saleData.tableNo,
          customer_name: saleData.customerName,
          discount: saleData.discount || 0,
          tax: saleData.tax || 0
        };

        if (isOnline) {
          try {
            const { data, error: saleError } = await supabase.from('sales').insert([salePayload]).select().single();
            if (saleError) throw saleError;
            sale = data;
          } catch (err) {
            console.error('Online save failed, falling back to offline:', err);
            
            // [REGENERATE FOR OFFLINE] If it was generated with online prefix, regenerate with offline prefix
            let offlineOrderNo = finalOrderNo;
            if (!saleData.order_no) { // Only if it was auto-generated
               offlineOrderNo = generateOfflineOrderNo();
               console.log('Regenerated Order No for offline fallback:', offlineOrderNo);
            }

            const tempId = Date.now();
            const offlineSale = { 
              ...salePayload, 
              id: tempId, 
              orderNo: offlineOrderNo, 
              order_no: offlineOrderNo,
              syncStatus: 'pending' as const 
            };
            setSales(prev => [offlineSale as any, ...prev]);
            sale = offlineSale;
            toast.info(`Transaksi disimpan offline (${offlineOrderNo})`);
          }
        } else {
          const tempId = Date.now();
          const offlineSale = { 
            ...salePayload, 
            id: tempId, 
            orderNo: finalOrderNo, 
            order_no: finalOrderNo, 
            syncStatus: 'pending' as const 
          };
          setSales(prev => [offlineSale as any, ...prev]);
          sale = offlineSale;
          toast.info('Transaksi disimpan offline');
        }
      }

      const orderNo = sale.order_no;

      if (!sale) throw new Error('Failed to save sale');

      // 2. Create Sale Items
      const saleItems = saleData.productDetails.map(item => {
        const product = products.find(p => p.name === item.name);
        return {
          sale_id: sale.id,
          product_id: product?.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          cost: product?.cost || 0,
          target: item.target || product?.target || 'Waitress',
          category: (item as any).category || product?.category || 'General'
        };
      });

      if (isOnline && sale.syncStatus !== 'pending') {
         const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
         if (itemsError) console.error('Sale items insert failed:', itemsError);

         // [NEW] Post to Accounting immediately for online sales
         if (saleData.totalAmount > 0) {
           await recordAccountingEntry(sale, saleItems, saleData.paymentMethod);
         }
      }

      toast.success(`Transaksi ${orderNo} berhasil disimpan`);
      
      // Update Ref for immediate listener availability
      lastProcessedOrderIdRef.current = sale.id;

      // Table Clearing (Manual stay Occupied)
      if (saleData.tableNo && isOnline) {
        await supabase.from('tables').update({ status: 'Occupied' }).eq('number', saleData.tableNo);
      }

      // --- Automatic Printing ---
      let wifiVoucher = undefined;
      const wifiMinSpend = Number(storeSettings?.wifi_voucher_min_amount) || 0;
      const saleTotal = Number(sale.total_amount) || 0;

      if (storeSettings?.enable_wifi_vouchers && isOnline && saleTotal >= wifiMinSpend) {
        try {
          const { WifiVoucherService } = await import('../lib/WifiVoucherService');
          
          let count = 1;
          const minSpend = Number(storeSettings?.wifi_voucher_min_amount) || 0;
          const multiplier = Number(storeSettings?.wifi_voucher_multiplier) || 0;
          const step = multiplier > 0 ? multiplier : minSpend;
          
          if (step > 0) {
            // Ensure at least 1 voucher if min amount is met, otherwise calculate multiples
            count = Math.max(1, Math.floor(saleTotal / step));
          }

          if (count > 0) {
            wifiVoucher = await WifiVoucherService.getVoucherForSale(sale.id, currentBranchId, count) || undefined;
          }
        } catch (e) { console.error('WiFi Voucher failed:', e); }
      }

      printerService.printReceipt({
        orderNo: orderNo,
        tableNo: saleData.tableNo,
        waiterName: saleData.waiterName || '',
        time: new Date().toLocaleString(),
        items: saleData.productDetails.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        subtotal: saleData.subtotal || saleData.totalAmount,
        discount: saleData.discount || 0,
        tax: saleData.tax || 0,
        total: saleData.totalAmount,
        paymentType: saleData.paymentMethod || 'Tunai',
        amountPaid: saleData.paidAmount || saleData.totalAmount,
        change: saleData.change || 0,
        customerName: saleData.customerName,
        cashierName: user?.user_metadata?.name || user?.email || role || 'Admin',
        wifiVoucher: wifiVoucher,
        wifiNotice: storeSettings?.wifi_voucher_notice
      });

      // Ticket Printing logic (Kitchen/Bar)
      const kitchenItems = saleItems.filter(item => {
        const target = (item.target || '').toLowerCase().trim();
        const nameLow = (item.product_name || '').toLowerCase();
        const categoryLow = (item.category || '').toLowerCase();
        const isDrink = ['minum', 'drink', 'beverage', 'juice', 'jus', 'tea', 'teh', 'coffee', 'kopi'].some(k => categoryLow.includes(k) || nameLow.includes(k));
        if (target === 'bar') return false; 
        if (target === 'kitchen' || target === 'dapur' || target === 'kds') return true;
        return !isDrink;
      });

      const barItems = saleItems.filter(item => {
        const target = (item.target || '').toLowerCase().trim();
        const nameLow = (item.product_name || '').toLowerCase();
        const categoryLow = (item.category || '').toLowerCase();
        const isDrink = ['minum', 'drink', 'beverage', 'juice', 'jus', 'tea', 'teh', 'coffee', 'kopi'].some(k => categoryLow.includes(k) || nameLow.includes(k));
        if (target === 'bar') return true;
        if (target === 'kitchen' || target === 'dapur' || target === 'kds') return false;
        return isDrink;
      });

      const cashierDisplayName = user?.user_metadata?.name || user?.email || role || 'Admin';

      if (kitchenItems.length > 0 && storeSettings?.auto_print_kitchen) {
        printerService.printTicket('Kitchen', {
            orderNo: orderNo,
            tableNo: saleData.tableNo || '-',
            waiterName: saleData.waiterName || '-',
            cashierName: cashierDisplayName,
            customerName: saleData.customerName,
            time: new Date().toLocaleTimeString(),
            items: kitchenItems.map(item => ({ name: item.product_name, quantity: item.quantity, note: (item as any).note })),
            notes: (saleData as any).note
        });
      }

      if (barItems.length > 0 && storeSettings?.auto_print_bar) {
        printerService.printTicket('Bar', {
            orderNo: orderNo,
            tableNo: saleData.tableNo || '-',
            waiterName: saleData.waiterName || '-',
            cashierName: cashierDisplayName,
            customerName: saleData.customerName,
            time: new Date().toLocaleTimeString(),
            items: barItems.map(item => ({ name: item.product_name, quantity: item.quantity, note: (item as any).note })),
            notes: (saleData as any).note
        });
      }

      if (isOnline) await fetchTransactions();
      if (isOnline) await recordAccountingEntry(sale, saleItems, saleData.paymentType);

      // Redirect to KDS
      setIsCashierOpen(false);
      setActiveModule('kds');

    } catch (err: any) {
      console.error('Transaction failed:', err);
      toast.error('Gagal menyimpan transaksi: ' + (err.message || 'Unknown error'));
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
        const product = products.find(p => p.name === item.name);
        return {
          ...item,
          target: item.target || product?.target || 'Waitress', // Use incoming target or fallback
          status: 'Pending'
        };
      })
    };
    setPendingOrders(prev => [kdsOrder, ...prev]);

    // --- Automatic Bluetooth Printing ---
    const kitchenItems = kdsOrder.items.filter(i => {
      const target = (i.target || '').toLowerCase().trim();
      return target === 'kitchen' || target === 'dapur' || target === 'kds' || target === 'waitress' || target === '' || target === 'null';
    });
    const barItems = kdsOrder.items.filter(i => (i.target || '').toLowerCase().trim() === 'bar');

    if (kitchenItems.length > 0 && storeSettings?.auto_print_kitchen && printerService.getConnectedPrinter('Kitchen')) {
      printerService.printTicket('Kitchen', {
        orderNo: kdsOrder.orderNo,
        tableNo: kdsOrder.tableNo,
        waiterName: kdsOrder.waiterName,
        cashierName: user?.user_metadata?.name || user?.email || role || 'Admin',
        customerName: orderData.customerName,
        time: kdsOrder.time,
        items: kitchenItems.map(i => ({
            name: i.name || i.product_name,
            quantity: i.quantity,
            note: i.note || i.notes
        })),
        notes: orderData.notes || orderData.note
      });
    }

    if (barItems.length > 0 && storeSettings?.auto_print_bar && printerService.getConnectedPrinter('Bar')) {
      printerService.printTicket('Bar', {
        orderNo: kdsOrder.orderNo,
        tableNo: kdsOrder.tableNo,
        waiterName: kdsOrder.waiterName,
        cashierName: user?.user_metadata?.name || user?.email || role || 'Admin',
        customerName: orderData.customerName,
        time: kdsOrder.time,
        items: barItems.map(i => ({
            name: i.name || i.product_name,
            quantity: i.quantity,
            note: i.note || i.notes
        })),
        notes: orderData.notes || orderData.note
      });
    }
  };

  const handleKDSUpdate = async (orderId: number, status: string, items?: any) => {
    // 1. Update LOCAL state for immediate UI response
    setPendingOrders(prev => prev.map(order =>
      order.id === orderId
        ? {
          ...order,
          status: status === 'Served' ? 'Served' : order.status,
          items: status === 'ItemUpdate' ? order.items.map((i: any) => i.name === items.itemName ? { ...i, status: items.newStatus } : i) : order.items
        }
        : order
    ).filter(order => status !== 'Served')); // Remove if served (optional, or keep for history)

    // 2. Update DB if it is a persisted order (id is number usually, or check valid ID)
    if (status === 'Served') {
      const order = pendingOrders.find(o => o.id === orderId);
      let waitingTimeUpdate = {};

      if (order?.date) {
        const start = new Date(order.date).getTime();
        const diff = Date.now() - start;
        const minutes = Math.floor(diff / 60000);
        waitingTimeUpdate = { waiting_time: `${minutes} mnt` };
      }

      const { error } = await supabase.from('sales').update({ status: 'Completed', ...waitingTimeUpdate }).eq('id', orderId);
      if (error) console.log('KDS update ignored for local/invalid order ID or DB error:', error.message);
      else toast.success('Pesanan selesai & disajikan');
    }
  };

  const handleAddReturn = async (returnData: Omit<SalesReturn, 'id' | 'returnNo' | 'date' | 'status'>) => {
    try {
      // 1. Find the original sale ID using orderNo
      // Logic: returnData.orderNo is likely the string 'INV-...'. We need to find the sale ID.
      // Since 'sales' state has both ID and orderNo, we can find it there.
      const originalSale = sales.find(s => s.orderNo === returnData.orderNo);

      if (!originalSale) {
        toast.error('Data transaksi asli tidak ditemukan locally, refresh halaman dan coba lagi.');
        return;
      }

      const { error } = await supabase.from('sales_returns').insert([{
        return_no: `RET-${returnData.orderNo}`,
        sale_id: originalSale.id,
        date: new Date().toISOString(),
        reason: returnData.reason,
        refund_amount: 0, // Should be calculated or passed
        status: 'Processed'
      }]);

      if (error) throw error;

      // Update original sale status if needed? 
      // Ideally we update status to 'Returned' or 'Partial Return'
      await supabase.from('sales').update({ status: 'Returned' }).eq('id', originalSale.id);

      toast.success('Retur berhasil diproses');

    } catch (err) {
      console.error('Return failed:', err);
      toast.error('Gagal memproses retur');
    }
  };

  const handleUpdateSale = async (updatedSale: SalesOrder) => {
    try {
      // Only allow updating specific fields for now to prevent integrity issues
      const { error } = await supabase.from('sales').update({
        payment_method: updatedSale.paymentMethod,
        branch_id: updatedSale.branchId,
        waiter_name: updatedSale.waiterName,
        status: updatedSale.status, // Allow status update for Pay First workflow
      }).eq('id', updatedSale.id);

      if (error) throw error;

      // 5. [NEW] Accounting Integration: Auto-Journal Entry
      if (updatedSale.status === 'Paid') {
        // Fetch FULL sale data to ensure we have order_no and total_amount for accounting
        const { data: fullSale } = await supabase.from('sales').select('*').eq('id', updatedSale.id).single();
        const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', updatedSale.id);
        
        if (fullSale && items) {
          await recordAccountingEntry(fullSale, items);
        }
      }

      // [CHANGED] Table Clearing is now MANUAL only (per user request)
      /*
      // Automatically clear table if sale is completed
      if (updatedSale.status === 'Completed' && updatedSale.tableNo) {
        const { error: tableError } = await supabase
          .from('tables')
          .update({ status: 'Empty' })
          .eq('number', updatedSale.tableNo);

        if (tableError) {
          console.error('Failed to clear table:', tableError);
          toast.warning('Transaksi sukses, tapi gagal mengosongkan meja.');
        } else {
          // Optionally refresh tables if needed, but realtime should handle it in other views
        }
      }
      */

      toast.success('Transaksi berhasil diupdate');

      // [FIX] Auto-redirect to KDS if payment is confirmed (Pending/Paid)
      if (['Paid', 'Pending'].includes(updatedSale.status)) {
        setIsCashierOpen(false);
        setActiveModule('kds');
      }
    } catch (err) {
      console.error('Update failed', err);
      toast.error('Gagal update transaksi');
    }
  };

  const handleDeleteSale = async (saleId: number) => {
    try {
      // [FIX] Get sale details first to know which table to clear and for Accounting ID
      const { data: sale } = await supabase.from('sales').select('table_no, order_no').eq('id', saleId).single();

      // [FIX] Manual Cascade Delete: Delete items first to avoid Foreign Key constraints
      const { error: itemsError } = await supabase.from('sale_items').delete().eq('sale_id', saleId);
      if (itemsError) console.warn('Failed to delete associated items (might be empty or already gone):', itemsError);

      // [FIX] Manual Cascade Delete: Delete returns if any
      const { error: returnsError } = await supabase.from('sales_returns').delete().eq('sale_id', saleId);
      if (returnsError) console.warn('Failed to delete associated returns:', returnsError);

      // [NEW] Sync Deletion to Accounting (Precise reference mapping)
      await supabase.from('journal_entries').delete().eq('reference_id', String(saleId)).eq('source_type', 'sale');

      // [OLD-BACKUP] Manual Cascade Delete: Delete associated Journal Entry via description if reference cleanup misses anything
      if (sale?.order_no) {
        await supabase.from('journal_entries').delete().ilike('description', `%${sale.order_no}%`);
      }

      // [FIX] Manual Cascade Delete: Unlink WiFi Vouchers (so they can be sold again)
      const { error: wifiError } = await supabase
        .from('wifi_vouchers')
        .update({ is_used: false, used_at: null, sale_id: null })
        .eq('sale_id', saleId);
      if (wifiError) console.warn('Failed to unlink WiFi vouchers:', wifiError);

      const { error } = await supabase.from('sales').delete().eq('id', saleId);
      if (error) throw error;

      // Update table to Empty if it exists
      if (sale?.table_no) {
        await supabase.from('tables').update({ status: 'Empty' }).eq('number', sale.table_no);
        if (currentBranchId) fetchBranchData(currentBranchId); // [FIX] Force refresh tables immediately
      }

      toast.success('Transaksi berhasil dihapus & Meja dikosongkan');
      fetchTransactions(); // Refresh sales list
    } catch (err: any) {
      console.error('Delete failed', err);
      toast.error('Gagal menghapus transaksi: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteSales = async (saleIds: number[]) => {
    if (saleIds.length === 0) return;

    try {
      const toastId = toast.loading(`Menghapus ${saleIds.length} transaksi...`);

      // 1. Get all sale details for table clearing and journal matching
      const { data: salesList } = await supabase
        .from('sales')
        .select('id, table_no, order_no')
        .in('id', saleIds);

      // 2. Cascade Deletes
      await supabase.from('sale_items').delete().in('sale_id', saleIds);
      await supabase.from('sales_returns').delete().in('sale_id', saleIds);
      
      // Journal entries matching by order_no patterns
      if (salesList && salesList.length > 0) {
        for (const s of salesList) {
          if (s.order_no) {
            await supabase.from('journal_entries').delete().ilike('description', `%${s.order_no}%`);
          }
        }
      }

      // WiFi Vouchers unlink
      await supabase.from('wifi_vouchers').update({ is_used: false, used_at: null, sale_id: null }).in('sale_id', saleIds);

      // 3. Delete Sales
      const { error } = await supabase.from('sales').delete().in('id', saleIds);
      if (error) throw error;

      // 4. Batch Clear Tables
      if (salesList) {
        const uniqueTables = Array.from(new Set(salesList.map(s => s.table_no).filter(Boolean)));
        if (uniqueTables.length > 0) {
          await supabase.from('tables').update({ status: 'Empty' }).in('number', uniqueTables);
          if (currentBranchId) fetchBranchData(currentBranchId);
        }
      }

      toast.success(`${saleIds.length} transaksi berhasil dihapus`, { id: toastId });
      fetchTransactions();
    } catch (err: any) {
      console.error('Bulk delete failed', err);
      toast.error('Gagal menghapus beberapa transaksi: ' + (err.message || 'Unknown error'));
    }
  };


  /* OLD ROLE-BASED LOGIC DEPRECATED
  const modules = [
    { id: 'dashboard', label: 'Winny Pangeran Natakusuma', icon: LayoutDashboard, color: 'bg-blue-600' },
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
  /* 
    3. 'dashboard' is always shown acting as Home.
  */
  // const { user, role, permissions } = useAuth(); // Duplicate removed
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);



  // NEW PERMISSION-BASED LOGIC WITH GROUPING
  // 1. Define groups
  const menuGroups = [
    {
      title: 'Utama',
      modules: [
        { id: 'dashboard', label: 'Winny Pangeran Natakusuma', icon: LayoutDashboard, color: 'text-blue-600', bgColor: 'bg-blue-50' },
        { id: 'pos', label: 'Penjualan', icon: MonitorCheck, color: 'text-pink-600', bgColor: 'bg-pink-50' },
        { id: 'kds', label: 'Dapur & Bar', icon: ChefHat, color: 'text-orange-500', bgColor: 'bg-orange-50' },
      ]
    },
    {
      title: 'Inventori & Produk',
      modules: [
        { id: 'products', label: 'Produk', icon: Coffee, color: 'text-green-600', bgColor: 'bg-green-50' },
        { id: 'inventory', label: 'Stok Bahan', icon: Archive, color: 'text-blue-700', bgColor: 'bg-blue-50' },
        { id: 'purchases', label: 'Pembelian', icon: ShoppingCart, color: 'text-orange-600', bgColor: 'bg-orange-50' },
        { id: 'contacts', label: 'Kontak', icon: Contact, color: 'text-purple-600', bgColor: 'bg-purple-50' },
        { id: 'promos', label: 'Promotion', icon: Percent, color: 'text-orange-500', bgColor: 'bg-orange-50' },
      ]
    },
    {
      title: 'HRD & Karyawan',
      modules: [
        { id: 'employees', label: 'Karyawan', icon: Users, color: 'text-rose-600', bgColor: 'bg-rose-50' },
        { id: 'attendance', label: 'Absensi', icon: CalendarCheck, color: 'text-violet-600', bgColor: 'bg-violet-50' },
        { id: 'shifts', label: 'Jadwal Shift', icon: ClockHistory, color: 'text-indigo-700', bgColor: 'bg-indigo-50' },
        { id: 'payroll', label: 'Payroll', icon: Wallet, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
      ]
    },
    {
      title: 'Keuangan',
      modules: [
        { id: 'reports', label: 'Laporan', icon: FileText, color: 'text-teal-600', bgColor: 'bg-teal-50' },
        { id: 'accounting', label: 'Akuntansi', icon: Calculator, color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
        { id: 'session_history', label: 'Riwayat Sesi', icon: ClockHistory, color: 'text-gray-600', bgColor: 'bg-gray-50' },
        { id: 'performance_indicators', label: 'Indikator Kinerja', icon: Target, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
      ]
    },
    {
      title: 'Administrasi',
      modules: [
        { id: 'branches', label: 'Cabang', icon: MapPin, color: 'text-amber-600', bgColor: 'bg-amber-50' },
        { id: 'users', label: 'Pengguna', icon: Users, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
        { id: 'settings', label: 'Pengaturan', icon: Settings, color: 'text-gray-600', bgColor: 'bg-gray-50' },
      ]
    }
  ];

  // Helper to check permission
  const hasPermission = (moduleId: string) => {
    // Debug Access
    // console.log(`Checking Access: Role=${role}, Module=${moduleId}`);

    if (moduleId === 'dashboard') return true;
    if (role && role.toLowerCase() === 'administrator') return true;

    // Special Permission: Cashier (or Kasir) can view KDS
    if (role && (role.toLowerCase() === 'cashier' || role.toLowerCase() === 'kasir') && moduleId === 'kds') return true;

    return permissions.includes(moduleId);
  };




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


  // --- Accounting Handlers ---
  const handleAddAccount = async (account: any) => {
    const { code, name, type } = account;
    const { error } = await supabase.from('accounts').insert([{ code, name, type }]);
    if (error) {
      toast.error('Gagal menambah akun: ' + error.message);
    } else {
      toast.success('Akun berhasil ditambahkan');
    }
  };

  const handleUpdateAccount = async (account: any) => {
    const { code, name, type } = account;
    const { error } = await supabase.from('accounts').update({ name, type }).eq('code', code);
    if (error) {
      toast.error('Gagal update akun: ' + error.message);
    } else {
      toast.success('Akun berhasil diupdate');
    }
  };

  const handleDeleteAccount = async (code: string) => {
    const { error } = await supabase.from('accounts').delete().eq('code', code);
    if (error) {
      toast.error('Gagal hapus akun: ' + error.message);
    } else {
      toast.success('Akun berhasil dihapus');
    }
  };

  const handleAddJournalEntry = async (entry: any) => {
    const { date, description, debitAccount, creditAccount, amount } = entry;
    // Removed branch_id to prevent "column does not exist" error
    const { error } = await supabase.from('journal_entries').insert([{
      date,
      description,
      debit_account: debitAccount,
      credit_account: creditAccount,
      amount
    }]);
    if (error) {
      toast.error('Gagal menambah jurnal: ' + error.message);
    } else {
      toast.success('Jurnal berhasil ditambahkan');
      fetchAccounting();
    }
  };

  const handleDeleteJournalEntry = async (id: number) => {
    try {
      const { error } = await supabase.from('journal_entries').delete().eq('id', id);
      if (error) throw error;

      toast.success('Jurnal berhasil dihapus');
      fetchAccounting();
    } catch (err: any) {
      console.error('Failed to delete journal entry:', err);
      toast.error('Gagal menghapus jurnal: ' + err.message);
    }
  };

  const handleResetJournalEntries = async () => {
    if (!window.confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA data jurnal akuntansi? Tindakan ini tidak dapat dibatalkan.')) return;

    try {
      // Removed branch_id filter because the column doesn't exist yet
      const { error } = await supabase.from('journal_entries').delete().neq('id', 0);
      if (error) throw error;

      toast.success('Semua data akuntansi berhasil di-reset');
      fetchAccounting();
    } catch (err: any) {
      console.error('Failed to reset journal entries:', err);
      toast.error('Gagal mereset jurnal: ' + err.message);
    }
  };

  // --- Employee Handlers ---
  const handleEmployeeCRUD = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        const { id, joinDate, offDays, system_role, ...rest } = data;
        const payload = { ...rest, join_date: joinDate, off_days: offDays, branch_id: currentBranchId, system_role: system_role };

        // 1. Insert Employee
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;

        // 2. Sync to Profiles (Pre-Approve User) if Role is Set
        if (system_role && data.email) {
          await supabase.from('profiles').upsert({
            email: data.email,
            name: data.name,
            role: system_role
          }, { onConflict: 'email' });
        }

        toast.success('Karyawan berhasil ditambahkan');
      } else if (action === 'update') {
        const { id, joinDate, offDays, system_role, ...rest } = data;
        const payload = { ...rest, join_date: joinDate, off_days: offDays, branch_id: currentBranchId, system_role: system_role };

        // 1. Update Employee
        const { error } = await supabase.from('employees').update(payload).eq('id', id);
        if (error) throw error;

        // 2. Sync to Profiles
        if (system_role && data.email) {
          await supabase.from('profiles').upsert({
            email: data.email,
            name: data.name,
            role: system_role
          }, { onConflict: 'email' });
          toast.success('Data & Akses Sistem diupdate');
        } else {
          toast.success('Data karyawan diupdate');
        }

      } else if (action === 'delete') {
        const { error } = await supabase.from('employees').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Karyawan dihapus');
      }
    } catch (err: any) {
      toast.error('Error Employee: ' + err.message);
    }
  };

  const handleDepartmentCRUD = async (action: 'create' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        const { id, ...rest } = data; // strip dummy id
        const { error } = await supabase.from('departments').insert([rest]);
        if (error) throw error;
        toast.success('Departemen ditambahkan');
      } else if (action === 'delete') {
        const { error } = await supabase.from('departments').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Departemen dihapus');
      }
    } catch (err: any) {
      toast.error('Error Dept: ' + err.message);
    }
  };

  // Settings Handler
  const handleUpdateSettings = async (newSettings: any) => {
    // Optimistic update for immediate UI feedback (especially for theme)
    const previousSettings = storeSettings;
    setStoreSettings({ ...storeSettings, ...newSettings });

    try {
      const { error } = await supabase.from('store_settings').upsert({
        id: 1,
        ...newSettings,
        updated_at: new Date()
      });
      if (error) {
        // Revert on error
        setStoreSettings(previousSettings);
        throw error;
      }
      toast.success('Pengaturan berhasil disimpan');
    } catch (err: any) {
      toast.error('Gagal simpan pengaturan: ' + err.message);
    }
  };

  // --- Branch Handlers ---
  const handleBranchAction = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        const { error } = await supabase.from('branches').insert([data]);
        if (error) throw error;
        toast.success('Cabang berhasil dibuat');
      } else if (action === 'update') {
        const { id, ...rest } = data;
        const { error } = await supabase.from('branches').update(rest).eq('id', id);
        if (error) throw error;
        toast.success('Cabang berhasil diupdate');
      } else if (action === 'delete') {
        const { error } = await supabase.from('branches').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Cabang berhasil dihapus');
      }
    } catch (err: any) {
      toast.error('Error Branch: ' + err.message);
    }
  };

  // --- Shift Handlers ---
  const handleShiftCRUD = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        const { error } = await supabase.from('shifts').insert([data]);
        if (error) throw error;
        toast.success('Master Shift berhasil dibuat');
      } else if (action === 'update') {
        const { id, ...rest } = data;
        const { error } = await supabase.from('shifts').update(rest).eq('id', id);
        if (error) throw error;
        toast.success('Master Shift berhasil diupdate');
      } else if (action === 'delete') {
        const { error } = await supabase.from('shifts').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Master Shift berhasil dihapus');
      }
    } catch (err: any) {
      toast.error('Error Shift: ' + err.message);
    }
  };

  const handleScheduleCRUD = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        // Transform camelCase to snake_case for DB
        const dbData = {
          employee_id: data.employeeId,
          employee_name: data.employeeName,
          shift_id: data.shiftId,
          date: data.date
        };
        const { error } = await supabase.from('shift_schedules').insert([dbData]);
        if (error) throw error;
        toast.success('Jadwal berhasil dibuat');
      } else if (action === 'update') {
        const dbData = {
          employee_id: data.employeeId,
          employee_name: data.employeeName,
          shift_id: data.shiftId,
          date: data.date
        };
        const { error } = await supabase.from('shift_schedules').update(dbData).eq('id', data.id);
        if (error) throw error;
        toast.success('Jadwal berhasil diupdate');
      } else if (action === 'delete') {
        const { error } = await supabase.from('shift_schedules').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Jadwal berhasil dihapus');
      }
    } catch (err: any) {
      toast.error('Error Schedule: ' + err.message);
    }
  };


  // Theme Effect (Sync on load)
  useEffect(() => {
    if (storeSettings?.theme_mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [storeSettings?.theme_mode]);

  // Sync Printer Template
  useEffect(() => {
    if (storeSettings) {
      printerService.setTemplate({
        ...storeSettings, // Spread all settings to ensure kitchen/bar keys are included
        header: storeSettings.receipt_header,
        address: storeSettings.address,
        footer: storeSettings.receipt_footer,
        paperWidth: storeSettings.receipt_paper_width,
        showDate: storeSettings.show_date,
        showWaiter: storeSettings.show_waiter,
        showTable: storeSettings.show_table,
        showCustomerName: storeSettings.show_customer_name,
        showLogo: storeSettings.show_logo,
        logoUrl: storeSettings.receipt_logo_url
      });
    }
  }, [storeSettings]);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'dashboard': return (
        <DashboardView
          contacts={contacts}
          sales={sales}
          returns={returns}
          products={products}
          ingredients={inventoryIngredients}
          currentBranchId={currentBranchId}
          voucherStats={voucherStats}
          storeSettings={storeSettings}
          onNavigate={(module, tab) => {
            setActiveModule(module as ModuleType);
            if (tab) setSalesViewTab(tab);
          }}
        />
      );
      case 'users': return (
        <UsersView branches={branches} />
      );
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
          onProductCRUD={async (action, data) => {
            try {
              console.log('onProductCRUD triggered:', { action, data });
              if (action === 'create' || action === 'update') {
                const { recipe, addons, id, ...rest } = data;
                const validColumns = ['code', 'name', 'category', 'brand', 'unit', 'price', 'cost', 'stock', 'image_url', 'is_sellable', 'is_taxed', 'is_stock_ready', 'target', 'branch_id', 'sort_order'];
                const productData: any = {};
                validColumns.forEach(col => {
                  if (rest[col] !== undefined) productData[col] = rest[col];
                });

                if (productData.price !== undefined) productData.price = Number(productData.price) || 0;
                if (productData.cost !== undefined) productData.cost = Number(productData.cost) || 0;
                if (productData.stock !== undefined) productData.stock = Number(productData.stock) || 0;

                let productId = id;
                if (action === 'create') {
                  productData.branch_id = currentBranchId;
                  const { data: newProd, error } = await supabase.from('products').insert([productData]).select().single();
                  if (error) throw error;
                  productId = newProd.id;
                } else {
                  const { error } = await supabase.from('products').update(productData).eq('id', id);
                  if (error) throw error;
                }

                if (recipe && Array.isArray(recipe) && recipe.length > 0) {
                  await supabase.from('product_recipes').delete().eq('product_id', productId);
                  const recipeItems = recipe.map((r: any) => ({
                    product_id: productId,
                    ingredient_id: r.ingredientId,
                    amount: r.amount
                  }));
                  const { error: recipeError } = await supabase.from('product_recipes').insert(recipeItems);
                  if (recipeError) console.error('Error saving recipe:', recipeError);
                }

                if (addons && Array.isArray(addons) && addons.length > 0) {
                  await supabase.from('product_addons').delete().eq('product_id', productId);
                  const addonItems = addons.map((a: any) => ({
                    product_id: productId,
                    name: a.name,
                    price: a.price
                  }));
                  const { error: addonError } = await supabase.from('product_addons').insert(addonItems);
                  if (addonError) console.error('Error saving addons:', addonError);
                }

                toast.success(`Produk berhasil ${action === 'create' ? 'dibuat' : 'diupdate'}`);
              } else if (action === 'delete') {
                await handleMasterDataCRUD('products', action, data);
              }
            } catch (err: any) {
              console.error('Error saving product:', err);
              toast.error(`Gagal menyimpan: ${err.message || 'Error'}`);
            }
          }}
          onCategoryCRUD={(action, data) => handleMasterDataCRUD('categories', action, data)}
          onUnitCRUD={(action, data) => handleMasterDataCRUD('units', action, data)}
          onBrandCRUD={(action, data) => handleMasterDataCRUD('brands', action, data)}
          currentBranchId={currentBranchId}
        />
      );
      case 'purchases': return (
        <PurchasesView
          purchases={purchases}
          returns={purchaseReturns}
          onCRUD={(table, action, data) => handleMasterDataCRUD(table, action, data)}
          currentBranchId={currentBranchId}
          contacts={contacts}
          products={products}
          ingredients={inventoryIngredients}
        />
      );



      case 'kds': return <KDSView orders={pendingOrders} onUpdateStatus={handleKDSUpdate} />;
      case 'pos':
        return (
          <SalesView
            sales={sales}
            returns={returns}
            onAddSale={handleAddSale}
            onAddReturn={handleAddReturn}
            onUpdateSale={handleUpdateSale}
            contacts={contacts}
            employees={employees}
            paymentMethods={paymentMethods}
            tables={tables} // Pass tables for occupancy check
            onDeleteSale={handleDeleteSale}
            onDeleteSales={handleDeleteSales}
            onOpenCashier={() => setIsCashierOpen(true)}
            onClearTableStatus={handleClearTableStatus}
            initialTab={salesViewTab}
            initialDateFilter={{ start: todayLocal, end: todayLocal }}
            currentBranchId={currentBranchId}
            onModeChange={(mode) => setSalesViewTab(mode)}
            onExit={() => setActiveModule('dashboard')}
            settings={storeSettings}
            userRole={role || ''}
          />
        );
      case 'reports': return <ReportsView sales={sales} returns={returns} purchases={purchases} purchaseReturns={purchaseReturns} paymentMethods={paymentMethods} storeSettings={storeSettings} />;
      case 'accounting': return (
        <AccountingView
          accounts={accounts}
          transactions={journalEntries}
          sales={sales}
          onAddAccount={handleAddAccount}
          onUpdateAccount={handleUpdateAccount}
          onDeleteAccount={handleDeleteAccount}
          onAddTransaction={handleAddJournalEntry}
          onDeleteTransaction={handleDeleteJournalEntry}
          onResetTransactions={handleResetJournalEntries}
          onPurchaseCRUD={(target, action, data) => handleMasterDataCRUD(target, action, data)}
          onRefresh={fetchAccounting}
          onBack={() => setActiveModule('payroll')}
          currentBranchId={currentBranchId}
          purchases={purchases}
        />
      );
      case 'session_history': return <SessionHistoryView />;
      case 'employees': return (
        <EmployeesView
          employees={employees}
          setEmployees={setEmployees}
          departments={departments}
          setDepartments={setDepartments}
          onEmployeeCRUD={handleEmployeeCRUD}
          onDepartmentCRUD={handleDepartmentCRUD}
        />
      );



      case 'performance_indicators': return (
        <PerformanceIndicatorMasterView 
          indicators={performanceIndicators}
          evaluations={performanceEvaluations}
          employees={employees}
          user={user}
          onCRUD={async (action, data) => {
            try {
              if (action === 'create') {
                const { error } = await supabase.from('performance_indicators').insert([{
                  ...data,
                  branch_id: currentBranchId ? Number(currentBranchId) : null
                }]);
                if (error) throw error;
                toast.success('Indikator berhasil ditambahkan');
              } else if (action === 'update') {
                const { id, ...rest } = data;
                const { error } = await supabase.from('performance_indicators').update(rest).eq('id', id);
                if (error) throw error;
                toast.success('Indikator berhasil diperbarui');
              } else if (action === 'delete') {
                const { error } = await supabase.from('performance_indicators').delete().eq('id', data.id);
                if (error) throw error;
                toast.success('Indikator berhasil dihapus');
              }
              // Refresh data
              const { data: fresh } = await supabase.from('performance_indicators').select('*').or(`branch_id.eq.${currentBranchId},branch_id.is.null`).order('created_at', { ascending: true });
              if (fresh) setPerformanceIndicators(fresh);
            } catch (err: any) {
              toast.error('Gagal memproses indikator: ' + err.message);
            }
          }}
          onEvaluationCRUD={async (action, data) => {
            try {
              if (action === 'create') {
                const { details, employeeId, ...rest } = data;
                const { data: evalData, error: evalError } = await supabase.from('performance_evaluations').insert([{
                  ...rest,
                  employee_id: Number(employeeId),
                  branch_id: currentBranchId ? Number(currentBranchId) : null
                }]).select().single();
                if (evalError) throw evalError;

                if (details && details.length > 0) {
                  const detailsPayload = details.map((d: any) => ({
                    ...d,
                    evaluation_id: evalData.id
                  }));
                  const { error: detailsError } = await supabase.from('performance_evaluation_details').insert(detailsPayload);
                  if (detailsError) throw detailsError;
                }
                
                // --- [NEW] Automatic Payroll Synchronization ---
                await syncPerformanceToPayroll(data, Number(employeeId));

                toast.success('Perhitungan nilai berhasil disimpan');
              } else if (action === 'update') {
                const { id, details, employeeId, ...rest } = data;
                
                // 1. Update main record
                const { error: evalError } = await supabase.from('performance_evaluations').update({
                  ...rest,
                  employee_id: Number(employeeId)
                }).eq('id', id);
                if (evalError) throw evalError;

                // 2. Refresh Details
                if (details && Array.isArray(details)) {
                  await supabase.from('performance_evaluation_details').delete().eq('evaluation_id', id);
                  const detailsPayload = details.map((d: any) => ({
                    ...d,
                    evaluation_id: id
                  }));
                  const { error: detailsError } = await supabase.from('performance_evaluation_details').insert(detailsPayload);
                  if (detailsError) throw detailsError;
                }

                // 3. Sync to Payroll
                await syncPerformanceToPayroll(data, Number(employeeId));

                toast.success('Perhitungan nilai berhasil diperbarui');
              } else if (action === 'delete') {
                const { error } = await supabase.from('performance_evaluations').delete().eq('id', data.id);
                if (error) throw error;
                toast.success('Riwayat perhitungan dihapus');
              }
              // Refresh evaluations
              const { data: fresh } = await supabase.from('performance_evaluations').select('*').eq('branch_id', currentBranchId).order('evaluation_date', { ascending: false });
              if (fresh) setPerformanceEvaluations(fresh);
            } catch (err: any) {
              toast.error('Gagal memproses perhitungan: ' + err.message);
            }
          }}
        />
      );

      case 'attendance':
        // [FINAL ALIGNMENT] Show logs from ALL branches in the Admin context
        // This ensures localhost and IP see the same 2 logs regardless of active branch
        const filteredLogs = attendanceLogs.filter(log => 
          employees.length === 0 || // Fallback
          employees.some(e => String(e.id) === String(log.employee_id) || e.name === log.employeeName) ||
          true // Always show in Admin view for consistency
        );
        
        return (
          <AttendanceView 
            logs={filteredLogs} 
            setLogs={setAttendanceLogs} 
            employees={employees} 
            onLogAttendance={handleAttendanceLog}
            settings={storeSettings} 
            userRole={role} 
            onRefresh={fetchAttendance}
            dbInfo={{ url: import.meta.env.VITE_SUPABASE_URL || 'Unknown', error: null }} 
            branchId={currentBranchId}
            shifts={shifts}
            schedules={shiftSchedules}
          />
        );
      case 'payroll':
        // [FIX] Robust ID Matching: Use String(id) to prevent Number/BigInt mismatch after refresh 
        const filteredPayroll = payrollData.filter(p => 
          employees.some(e => String(e.id) === String(p.employee_id) || e.name === p.employeeName)
        );
        return (
          <PayrollView
            payroll={filteredPayroll}
            setPayroll={setPayrollData}
            employees={employees} // Pass real employees for dropdown
            evaluations={performanceEvaluations} // Pass evaluations for auto-sync
            onPayrollAction={handlePayrollAction}
            settings={storeSettings}
          />
        );
      case 'branches': return (
        <BranchesView
          branches={branches}
          onBranchAction={handleBranchAction}
        />
      );
      case 'shifts': return (
        <ShiftsView
          shifts={shifts}
          schedules={shiftSchedules}
          employees={employees}
          onShiftAction={handleShiftCRUD}
          onScheduleAction={handleScheduleCRUD}
        />
      );
      case 'promos': return (
        <PromosView 
          currentBranchId={currentBranchId}
          products={products}
        />
      );
      case 'inventory': return (
        <InventoryView
          ingredients={inventoryIngredients}
          movements={inventoryHistory}
          onIngredientAction={handleIngredientCRUD}
          onStockAdjustment={handleStockAdjustment}
          categories={categories}
          units={units}
        />
      );
      case 'settings': return (
        <SettingsView
          settings={storeSettings}
          onUpdateSettings={handleUpdateSettings}
          tables={tables}
          onTableAction={handleTableCRUD}
          paymentMethods={paymentMethods}
          onPaymentMethodAction={handlePaymentMethodCRUD}
        />
      );
      default: return (
        <DashboardView
          contacts={contacts}
          sales={sales}
          returns={returns}
          products={products}
          ingredients={inventoryIngredients}
          currentBranchId={currentBranchId}
          voucherStats={voucherStats}
          onNavigate={(module) => setActiveModule(module as ModuleType)}
        />
      );
    }
  };


  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden font-sans relative transition-colors duration-300">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/20 pointer-events-none" />
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-56'} bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-r border-white/20 dark:border-gray-800 flex flex-col py-8 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.05)] z-20 transition-all duration-300 relative`}>

        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md hover:bg-gray-50 text-gray-500 z-50"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className={`mb-10 px-6 relative flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="bg-gradient-to-br from-primary to-orange-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 transform hover:scale-110 transition-transform duration-300 flex-shrink-0">
            <span className="font-extrabold text-[10px] text-white leading-none tracking-tight">POS</span>
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col animate-in fade-in duration-200">
              <span className="font-bold text-gray-800 dark:text-gray-100 text-sm tracking-tight leading-none">WINPOS</span>
              <span className="text-[10px] text-gray-400 font-medium">Enterprise Management</span>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
          {menuGroups.map((group, groupIdx) => {
            // Filter modules in this group based on permission
            const visibleModules = group.modules.filter(m => hasPermission(m.id));

            // If no modules are visible in this group, hide the group entirely
            if (visibleModules.length === 0) return null;

            return (
              <div key={groupIdx}>
                {!isSidebarCollapsed && (
                  <h3 className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    {group.title}
                  </h3>
                )}
                {isSidebarCollapsed && (
                  <div className="w-full h-px bg-gray-200 dark:bg-gray-700 my-2 mx-auto w-1/2" />
                )}
                <div className="space-y-1">
                  {visibleModules.map((module) => {
                    const Icon = module.icon;
                    const isActive = activeModule === module.id;
                    const colorClass = isActive ? 'text-white' : module.color;
                    const bgClass = isActive ? 'bg-primary' : `${module.bgColor} bg-opacity-30 group-hover:bg-opacity-100`;

                    return (
                      <button
                        key={module.id}
                        onClick={() => {
                          setActiveModule(module.id as ModuleType);
                        }}
                        className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-2.5'} gap-2.5 py-1.5 rounded-lg transition-all duration-200 group relative ${isActive
                          ? 'bg-blue-50/80 text-blue-700 shadow-sm ring-1 ring-blue-100/50'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        title={isSidebarCollapsed ? module.label : ''}
                      >
                        <div className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isActive ? 'bg-white text-blue-600 shadow-sm' : `${module.bgColor} bg-opacity-30 group-hover:bg-opacity-100 ${module.color} group-hover:text-white`}`}>
                          <Icon className="w-4.5 h-4.5 text-current" />
                        </div>
                        {!isSidebarCollapsed && (
                          <span className={`font-semibold text-xs truncate animate-in fade-in duration-200 ${isActive ? 'text-blue-700' : 'text-gray-600'}`}>
                            {module.label}
                          </span>
                        )}
                        {!isSidebarCollapsed && isActive && (
                          <div className="ml-auto w-1 h-1 rounded-full bg-blue-600 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* PROFILE FOOTER */}
        <div className="px-3 mt-auto">
          <div className={`flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm uppercase">
               {(profileName || user?.user_metadata?.name || 'U').charAt(0)}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">
                  {profileName || user?.user_metadata?.name || 'User'}
                </p>
                <p className="text-[10px] text-gray-400 font-medium truncate uppercase">
                  {role || 'Staff'}
                </p>
                {profileEmail && (
                  <p className="text-[9px] text-gray-400 truncate lowercase mt-0.5 italic">
                    {profileEmail}
                  </p>
                )}
              </div>
            )}
            {!isSidebarCollapsed && (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          {isSidebarCollapsed && (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="mt-2 w-full flex items-center justify-center p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

      </aside>

      <main className="flex-1 h-screen flex flex-col overflow-hidden bg-gray-50/50 dark:bg-gray-900/50 relative">
        {/* Header - Fixed Height, Flex None */}
        <header className="h-20 flex-none bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800 px-6 flex items-center justify-between shadow-sm z-50">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
              {menuGroups.flatMap(g => g.modules).find(m => m.id === activeModule)?.label || 'WinPOS'}
            </h1>
            <p className="text-[10px] text-gray-500 font-medium mt-0.5 tracking-wide uppercase opacity-80">Sistem Terintegrasi</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Branch Selector */}
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
              <Store className="w-3.5 h-3.5 text-primary" />
              <select
                value={currentBranchId}
                onChange={(e) => setCurrentBranchId(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer"
              >
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div className="h-6 w-[1px] bg-gray-200 hidden lg:block" />

            {/* Sync Status */}
            <div className="hidden sm:flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
              <button
                className="flex flex-col items-center hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg p-1 transition-colors cursor-pointer"
                title={isOnline ? "Klik untuk Paksa Offline" : "Klik untuk Coba Online"}
                onClick={() => {
                  const currentForce = localStorage.getItem('force_offline') === 'true';
                  // If currently Online, we want to Force Offline (true).
                  // If currently Offline, we want to Unforce (false) to try to connect.
                  // However, better logic is: Simply toggle the Force Offline flag based on INTENT.
                  // If user clicks GREEN (Online), they want OFFLINE -> set force=true.
                  // If user clicks RED (Offline), they want ONLINE -> set force=false.

                  // But wait, if internet is down, it shows RED. Clicking it sets force=false (correct).
                  // If force is ALREADY false (internet is just down), clicking it does nothing visible but that's fine.

                  // Simpler: Just toggle force_offline based on current state? 
                  // No, use the visual cues.

                  const targetForce = isOnline ? 'true' : 'false';

                  // Special Case: If it IS offline, and we click it, we assume user wants to go ONLINE.
                  // Even if force_offline was NOT set (just natural offline), setting it to false is safe.

                  localStorage.setItem('force_offline', targetForce);
                  window.dispatchEvent(new Event('force-offline-change'));

                  // Also must dispatch storage event manually for other tabs if needed? 
                  // window.dispatchEvent(new StorageEvent('storage', { key: 'force_offline', newValue: targetForce }));

                  if (targetForce === 'true') {
                    toast.warning('Mode Offline Diaktifkan Manual');
                  } else {
                    toast.info('Mode Online Diaktifkan (Mencoba hubungkan...)');
                  }
                }}
              >
                {isOnline ? (
                  <div className="flex items-center gap-1.5 text-green-600 font-bold text-[10px] uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Online
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-red-500 font-bold text-[10px] uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Offline
                  </div>
                )}
              </button>
              <div className="w-[1px] h-4 bg-gray-200" />
              <PWAInstallButton />
              <div className="w-[1px] h-4 bg-gray-200" />
              <div className="flex items-center gap-1.5">
                {sales.some(s => s.syncStatus === 'pending') ? (
                  <div className="flex items-center gap-1.5 text-orange-500 text-[10px] font-semibold">
                    <Clock className="w-3 h-3" />
                    <span>{sales.filter(s => s.syncStatus === 'pending').length} Pending</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-blue-600 text-[10px] font-semibold">
                    <CheckCircle className="w-3 h-3" />
                    <span>Sync</span>
                  </div>
                )}
              </div>
            </div>

            <div className="h-6 w-[1px] bg-gray-200 hidden lg:block" />



            <button
              onClick={() => setIsCashierOpen(true)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group"
              title="Buka Kasir"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20 group-hover:scale-105 transition-transform relative">
                <ShoppingCart className="w-4 h-4" />
                {pendingCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white">
                    {pendingCount}
                  </div>
                )}
              </div>
            </button>
          </div>
        </header >

        {/* Main Content Area - Scrollable */}
        <div className="flex-1 overflow-auto relative w-full">
          {renderActiveModule()}

          {/* Watermark inside scroll area if needed, or outside */}
          <div className="fixed inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none z-0">
            <h1 className="text-[20vw] font-bold text-gray-900 rotate-[-15deg]">WinPOS</h1>
          </div>
        </div>
      </main >

      {isCashierOpen && (
        <div className="fixed inset-0 z-[100] bg-white animate-in fade-in duration-200">
          <CashierInterface
            orderItems={orderItems}
            orderDiscount={orderDiscount}
            setOrderItems={setOrderItems}
            setOrderDiscount={setOrderDiscount}
            onAddSale={handleAddSale}
            onBack={() => { setIsCashierOpen(false); setAutoSelectedTable(''); }} // Clear selection on close
            contacts={contacts}
            employees={employees}
            onSendToKDS={handleSendToKDS}
            products={products}
            topSellingProducts={topSellingProducts}
            categories={categories}
            tables={tables}
            activeSales={sales}
            paymentMethods={paymentMethods}
            onDeleteSale={handleDeleteSale}
            onClearTableStatus={handleClearTableStatus}
            settings={storeSettings}
            initialTable={autoSelectedTable} // Pass the auto-selected table
            autoOpenPayment={autoOpenPayment}
            autoOpenSaleId={autoOpenSaleId}
            onAutoPaymentProcessed={() => { setAutoOpenPayment(false); setAutoOpenSaleId(null); }}
            onPaymentSuccess={() => {
              setIsCashierOpen(false);
              setAutoSelectedTable(''); // Clear the selected table to prevent re-opening on same order
              setAutoOpenPayment(false); // Clear auto-open
              setAutoOpenSaleId(null); // Clear auto-open ID
              setOrderItems([]); // Clear cart
              setOrderDiscount(0); // Clear discount
              setActiveModule('kds');
              toast.success('Pembayaran Selesai. Dialihkan ke Dapur.');
            }}
          />
        </div>
      )
      }

      {
        showLogoutConfirm && (
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
                  onClick={() => {
                    // Check if session guard prevents logout
                    if (!canLogout()) {
                      setShowLogoutConfirm(false);
                      toast.error('Tidak dapat logout!', {
                        description: 'Anda harus menutup shift kasir terlebih dahulu sebelum logout.',
                        duration: 5000
                      });
                      return;
                    }
                    supabase.auth.signOut();
                  }}
                >
                  Keluar
                </Button>
              </div>
            </div>
          </div>
        )
      }
      
      {/* Floating Quick Attendance Button */}
      {activeModule !== 'attendance' && !isCashierOpen && storeSettings?.show_attendance_fab !== false && (
        <button
          onClick={() => setActiveModule('attendance')}
          className="fixed bottom-8 right-8 z-[60] flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-full shadow-2xl shadow-blue-500/40 hover:scale-110 hover:-translate-y-1 active:scale-95 transition-all group animate-in slide-in-from-bottom-10 duration-500"
        >
          <div className="relative">
            <Fingerprint className="w-6 h-6" />
            <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
          </div>
          <span className="font-black text-sm uppercase tracking-widest">Absensi</span>
          
          {/* Tooltip-like decorative pulse */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-bounce"></div>
        </button>
      )}
    </div >
  );
}

export default Home;
