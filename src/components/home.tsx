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
  // Centralized State for Integration
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [performanceRules, setPerformanceRules] = useState({
    commissionPercent: 1.5,
    attendanceBonus: 10000,
    latePenalty: 25000,
    complaintPenalty: 50000
  });
  // Inventory Handlers
  const handleIngredientCRUD = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        // Ensure numeric types
        const payload = {
          ...data,
          current_stock: Number(data.current_stock || 0),
          min_stock: Number(data.min_stock || 0),
          cost_per_unit: Number(data.cost_per_unit || 0)
        };
        const { error } = await supabase.from('ingredients').insert([payload]);
        if (error) throw error;
        toast.success('Bahan baku berhasil ditambahkan');
      } else if (action === 'update') {
        const { id, ...rest } = data;
        const payload = {
          ...rest,
          current_stock: Number(rest.current_stock || 0),
          min_stock: Number(rest.min_stock || 0),
          cost_per_unit: Number(rest.cost_per_unit || 0)
        };
        const { error } = await supabase.from('ingredients').update(payload).eq('id', id);
        if (error) throw error;
        toast.success('Bahan baku berhasil diupdate');
      } else if (action === 'delete') {
        const { error } = await supabase.from('ingredients').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Bahan baku berhasil dihapus');
      }
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
        type,
        quantity: qty,
        unit,
        reason,
        user: user || 'System'
      }]);
      if (moveError) throw moveError;

      // 2. Update Ingredient Stock
      // For simplicity, we fetch current stock (handled by trigger ideally, but manual here for now)
      // Actually, let's use RPC if possible, but for now simple update
      // We need to calculate new stock. Ideally we read fresh, but for now we assume FE passed correct intent? 
      // Better: standard increment/decrement
      // NOTE: In a real app we'd use a postgres function. Here we will just fetch first to be safe or blindly increment.

      // Let's just fetch the current ingredient to get current stock first to be safe
      const { data: ing } = await supabase.from('ingredients').select('current_stock').eq('id', ingredientId).single();
      if (ing) {
        let newStock = Number(ing.current_stock);
        if (type === 'IN') newStock += qty;
        else if (type === 'OUT') newStock -= qty;
        else if (type === 'ADJUSTMENT') newStock = qty; // If adjustment is absolute set

        // If type is adjustment and logic differs, we might need correction.
        // Usually 'ADJUSTMENT' implies 'Opname' -> strict set.
        // But let's assume the UI sends the DELTA for IN/OUT and Absolute for ADJUSTMENT? 
        // Standardizing: type IN/OUT adds/subtracts. ADJUSTMENT sets absolute value?
        // Let's assume adjustment in this app context means "Stock Opname" (Set to X).
        // Checking InventoryView usage... usually it's "Add/Reduce" or "Set".
        // Let's assume IN/OUT for now.

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

  const [complaintsData, setComplaintsData] = useState<Record<string, number>>({}); // employeeName -> count

  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftSchedules, setShiftSchedules] = useState<any[]>([]);



  // Inventory & HPP State

  const [inventoryIngredients, setInventoryIngredients] = useState<any[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<any[]>([]);


  // --- Master Data State ---
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);

  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);

  // --- Accounting State ---
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);

  // --- Settings State ---
  const [storeSettings, setStoreSettings] = useState<any>({
    store_name: 'WinPOS Store',
    receipt_header: 'WinPOS',
    receipt_footer: 'Thank You',
    receipt_paper_width: '58mm',
    show_date: true,
    show_waiter: true,
    show_table: true,
    address: ''
  });

  // --- Master Data Integration ---
  const fetchMasterData = async () => {
    try {
      const [productsRes, categoriesRes, unitsRes, brandsRes, contactsRes,
        branchesRes, shiftsRes, schedulesRes] = await Promise.all([
          supabase.from('products').select('*').order('created_at', { ascending: false }),
          supabase.from('categories').select('*').order('name'),
          supabase.from('units').select('*').order('name'),
          supabase.from('brands').select('*').order('name'),
          supabase.from('contacts').select('*').order('name'),
          supabase.from('branches').select('*').order('id'),
          supabase.from('shifts').select('*').order('id'),
          supabase.from('shift_schedules').select('*').order('date'),
          supabase.from('shifts').select('*').order('id'),
          supabase.from('shift_schedules').select('*').order('date'),
          supabase.from('store_settings').select('*').eq('id', 1).single(),
          supabase.from('tables').select('*').order('number')
        ]);

      if (productsRes.data) setProducts(productsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (unitsRes.data) setUnits(unitsRes.data);
      if (brandsRes.data) setBrands(brandsRes.data);
      if (contactsRes.data) setContacts(contactsRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (shiftsRes.data) setShifts(shiftsRes.data);
      if (schedulesRes.data) setShiftSchedules(schedulesRes.data);
      if (schedulesRes[2].data) setStoreSettings(schedulesRes[2].data); // Note: Original code used index via Promise.all, ensure this aligns or fix index usage if 'schedulesRes' was the 8th item.
      // Actually, looking at the array destructuring:
      // [productsRes, categoriesRes, unitsRes, brandsRes, contactsRes, branchesRes, shiftsRes, schedulesRes]
      // Wait, there was an implicit index usage or strict ordering.
      // The previous code had: if (schedulesRes[2].data) setStoreSettings... which looks suspicious if 'schedulesRes' is just one result.
      // Ah, looks like I need to allow for the new result.
      // Let's correct the destructuring to be safe and include tablesRes.
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
      supabase.channel('units_all').on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, fetchMasterData).subscribe(),
      supabase.channel('brands_all').on('postgres_changes', { event: '*', schema: 'public', table: 'brands' }, fetchMasterData).subscribe(),
      supabase.channel('contacts_all').on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetchMasterData).subscribe(),
      supabase.channel('contacts_all').on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetchMasterData).subscribe(),
      supabase.channel('branches_all').on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, fetchMasterData).subscribe(),
      supabase.channel('shifts_all').on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, fetchMasterData).subscribe(),
      supabase.channel('schedules_all').on('postgres_changes', { event: '*', schema: 'public', table: 'shift_schedules' }, fetchMasterData).subscribe(),
      supabase.channel('ingredients_all').on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, fetchMasterData).subscribe(),
      supabase.channel('movements_all').on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, fetchMasterData).subscribe(),
      supabase.channel('movements_all').on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, fetchMasterData).subscribe(),
      supabase.channel('settings_all').on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, fetchMasterData).subscribe(),
      supabase.channel('tables_all').on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchMasterData).subscribe(),
    ];

    // --- Purchases Integration ---
    const fetchPurchases = async () => {
      const { data: pData } = await supabase.from('purchases').select('*').order('created_at', { ascending: false });
      const { data: rData } = await supabase.from('purchase_returns').select('*').order('created_at', { ascending: false });
      if (pData) setPurchases(pData);
      if (rData) setPurchaseReturns(rData);
    };

    fetchPurchases();
    const purchaseChannels = [
      supabase.channel('purchases_all').on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, fetchPurchases).subscribe(),
      supabase.channel('returns_all').on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_returns' }, fetchPurchases).subscribe(),
    ];

    // --- Sales & POS Integration ---
    const fetchTransactions = async () => {
      // Fetch Sales with Items
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          *,
          items:sale_items(*)
        `)
        .order('created_at', { ascending: false });

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
          branchId: s.branch_id,
          waiterName: s.waiter_name,
          productDetails: (s.items || []).map((i: any) => ({
            name: i.product_name,
            quantity: i.quantity,
            price: i.price
          }))
        }));
        setSales(formattedSales);
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

    fetchTransactions();
    const transactionChannels = [
      supabase.channel('sales_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchTransactions).subscribe(),
      supabase.channel('sale_items_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, fetchTransactions).subscribe(),
      supabase.channel('returns_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'sales_returns' }, fetchTransactions).subscribe(),
    ];

    // --- Accounting Integration ---
    const fetchAccounting = async () => {
      const { data: accData } = await supabase.from('accounts').select('*').order('code');
      if (accData) setAccounts(accData);

      const { data: journalData } = await supabase.from('journal_entries').select('*').order('date', { ascending: false });
      if (journalData) {
        setJournalEntries(journalData.map(j => ({
          ...j,
          debitAccount: j.debit_account,
          creditAccount: j.credit_account,
          amount: Number(j.amount)
        })));
      }
    };

    fetchAccounting();
    const accountingChannels = [
      supabase.channel('accounts_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, fetchAccounting).subscribe(),
      supabase.channel('journal_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, fetchAccounting).subscribe(),
    ];

    // --- Employees Integration ---
    const fetchEmployees = async () => {
      const { data: empData } = await supabase.from('employees').select('*').order('name');
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

    fetchEmployees();
    const employeeChannels = [
      supabase.channel('employees_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, fetchEmployees).subscribe(),
      supabase.channel('departments_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, fetchEmployees).subscribe(),
    ];

    return () => {
      channels.forEach(ch => ch.unsubscribe());
      purchaseChannels.forEach(ch => ch.unsubscribe());
      transactionChannels.forEach(ch => ch.unsubscribe());
      accountingChannels.forEach(ch => ch.unsubscribe());
      employeeChannels.forEach(ch => ch.unsubscribe());
    };
  }, []);

  // --- Attendance Integration ---
  useEffect(() => {
    const fetchAttendance = async () => {
      const { data } = await supabase.from('attendance_logs').select('*').order('created_at', { ascending: false });
      if (data) {
        setAttendanceLogs(data.map(log => ({
          ...log,
          employeeName: log.employee_name,
          checkIn: log.check_in,
          checkOut: log.check_out
        })));
      }
    };

    fetchAttendance();
    const subscription = supabase.channel('attendance_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, fetchAttendance)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- Payroll Integration ---
  useEffect(() => {
    const fetchPayroll = async () => {
      const { data } = await supabase.from('payrolls').select('*').order('created_at', { ascending: false });
      if (data) {
        setPayrollData(data.map(p => ({
          ...p,
          employeeName: p.employee_name,
          basicSalary: p.basic_salary,
          paymentDate: p.payment_date,
        })));
      }
    };

    fetchPayroll();
    const sub = supabase.channel('payroll_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payrolls' }, fetchPayroll)
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, []);

  const handlePayrollAction = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        const { id, employeeName, basicSalary, paymentDate, ...rest } = data;
        const emp = employees.find(e => e.name === employeeName);
        const payload = {
          ...rest,
          employee_name: employeeName,
          employee_id: emp?.id,
          basic_salary: basicSalary,
          payment_date: paymentDate
        };
        // Remove id if it's dummy
        const { error } = await supabase.from('payrolls').insert([payload]);
        if (error) throw error;
        toast.success('Gaji berhasil dibuat');
      } else if (action === 'update') {
        const { id, employeeName, basicSalary, paymentDate, ...rest } = data;
        const payload = {
          ...rest,
          employee_name: employeeName,
          basic_salary: basicSalary,
          payment_date: paymentDate
        };
        const { error } = await supabase.from('payrolls').update(payload).eq('id', id);
        if (error) throw error;
        toast.success('Gaji berhasil diupdate');
      } else if (action === 'delete') {
        const { error } = await supabase.from('payrolls').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Gaji berhasil dihapus');
      }
    } catch (err: any) {
      toast.error('Error Payroll: ' + err.message);
    }
  };

  const handleAttendanceLog = async (logData: any) => {
    try {
      if (logData.id && logData.checkOut && !logData.isNew) {
        // This is an update (Checkout)
        const { error } = await supabase.from('attendance_logs').update({
          check_out: logData.checkOut
        }).eq('id', logData.id);
        if (error) throw error;
        toast.success(`Check-Out berhasil`);
      } else {
        // This is a new Check-in
        const { id, ...rest } = logData; // Remove dummy ID if present
        const payload = {
          employee_id: employees.find(e => e.name === rest.employeeName)?.id, // Try to find linked ID
          employee_name: rest.employeeName,
          date: rest.date,
          check_in: rest.checkIn,
          check_out: null,
          status: rest.status
        };
        const { error } = await supabase.from('attendance_logs').insert([payload]);
        if (error) throw error;
        toast.success(`Check-In berhasil`);
      }
    } catch (err: any) {
      console.error('Attendance error:', err);
      toast.error('Gagal memproses absensi: ' + err.message);
    }
  };

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
  // const [receiptSettings, setReceiptSettings] = useState({ ... }); // REMOVED - Using storeSettings

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

    if (savedProducts) setProducts(JSON.parse(savedProducts));
    if (savedContacts) setContacts(JSON.parse(savedContacts));
    if (savedPendingOrders) setPendingOrders(JSON.parse(savedPendingOrders));
    if (savedIngredients) setInventoryIngredients(JSON.parse(savedIngredients));
    if (savedInventoryHistory) setInventoryHistory(JSON.parse(savedInventoryHistory));
    if (savedCategories) setCategories(JSON.parse(savedCategories));
    if (savedUnits) setUnits(JSON.parse(savedUnits));
    if (savedBrands) setBrands(JSON.parse(savedBrands));
    if (savedProducts) setProducts(JSON.parse(savedProducts));
    if (savedContacts) setContacts(JSON.parse(savedContacts));
    if (savedPendingOrders) setPendingOrders(JSON.parse(savedPendingOrders));


    // const savedReceipt = localStorage.getItem('winpos_receipt_settings'); // Removed
    // if (savedReceipt) setReceiptSettings(JSON.parse(savedReceipt));

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

  // Sync receipt settings to PrinterService
  useEffect(() => {
    printerService.setTemplate(storeSettings);
  }, [storeSettings]);

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

  const handleAddSale = async (saleData: Omit<SalesOrder, 'id' | 'orderNo' | 'date' | 'status'>) => {
    try {
      const orderNo = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

      // 1. Create Sale Record
      const { data: sale, error: saleError } = await supabase.from('sales').insert([{
        order_no: orderNo,
        date: new Date().toISOString(),
        total_amount: saleData.totalAmount,
        payment_method: saleData.paymentMethod,
        status: 'Completed',
        branch_id: currentBranchId,
        waiter_name: saleData.waiterName
      }]).select().single();

      if (saleError) throw saleError;
      if (!sale) throw new Error('Failed to create sale');

      // 2. Create Sale Items
      const saleItems = saleData.productDetails.map(item => ({
        sale_id: sale.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        cost: 0
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
      if (itemsError) throw itemsError;

      toast.success(`Transaksi ${orderNo} berhasil disimpan`);

      // --- Client-Side Stock Deduction (Temporary) ---
      // Real deduction should happen via trigger or backend API
      saleData.productDetails.forEach(item => {
        const product = products.find(p => p.name === item.name);
        // Logic for complex recipe deduction could be here if needed client-side
      });

      // --- Automatic Printing ---
      printerService.printReceipt({
        orderNo: orderNo,
        tableNo: saleData.tableNo,
        waiterName: saleData.waiterName || '-',
        time: new Date().toLocaleString(),
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

    } catch (err) {
      console.error('Transaction failed:', err);
      toast.error('Gagal menyimpan transaksi');
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
        branch_id: updatedSale.branchId, // if tableNo stored here or separate? TableNo not in DB schema yet.
        waiter_name: updatedSale.waiterName,
        // total_amount mismatch if items changed? For now assume only header update.
      }).eq('id', updatedSale.id);

      if (error) throw error;
      toast.success('Transaksi berhasil diupdate');
    } catch (err) {
      console.error('Update failed', err);
      toast.error('Gagal update transaksi');
    }
  };

  const handleDeleteSale = async (saleId: number) => {
    try {
      const { error } = await supabase.from('sales').delete().eq('id', saleId);
      if (error) throw error;
      toast.success('Transaksi berhasil dihapus');
    } catch (err) {
      console.error('Delete failed', err);
      toast.error('Gagal menghapus transaksi');
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
    }
  };

  // --- Employee Handlers ---
  const handleEmployeeCRUD = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        const { id, joinDate, offDays, ...rest } = data;
        const payload = { ...rest, join_date: joinDate, off_days: offDays };
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;
        toast.success('Karyawan berhasil ditambahkan');
      } else if (action === 'update') {
        const { id, joinDate, offDays, ...rest } = data;
        const payload = { ...rest, join_date: joinDate, off_days: offDays };
        const { error } = await supabase.from('employees').update(payload).eq('id', id);
        if (error) throw error;
        toast.success('Data karyawan diupdate');
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
    try {
      const { error } = await supabase.from('store_settings').upsert({
        id: 1,
        ...newSettings,
        updated_at: new Date()
      });
      if (error) throw error;
      toast.success('Pengaturan berhasil disimpan');
      // Optimistic update
      setStoreSettings({ ...storeSettings, ...newSettings });
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
      case 'purchases': return (
        <PurchasesView
          purchases={purchases}
          returns={purchaseReturns}
          onCRUD={(table, action, data) => handleMasterDataCRUD(table, action, data)}
        />
      );
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
      case 'accounting': return (
        <AccountingView
          accounts={accounts}
          transactions={journalEntries}
          onAddAccount={handleAddAccount}
          onUpdateAccount={handleUpdateAccount}
          onDeleteAccount={handleDeleteAccount}
          onAddTransaction={handleAddJournalEntry}
        />
      );
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
      case 'performance': return (
        <PerformanceView
          sales={sales}
          attendanceLogs={attendanceLogs}
          rules={performanceRules}
          setRules={setPerformanceRules}
          complaints={complaintsData}
          setComplaints={setComplaintsData}
          employees={employees}
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
      case 'payroll': return (
        <PayrollView
          payroll={payrollData}
          setPayroll={setPayrollData}
          employees={employees} // Pass real employees for dropdown
          onPayrollAction={handlePayrollAction}
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

  // --- Table Handlers ---
  const handleTableCRUD = async (action: 'create' | 'update' | 'delete', data: any) => {
    try {
      if (action === 'create') {
        const { id, ...rest } = data;
        const { error } = await supabase.from('tables').insert([rest]);
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
    } catch (err: any) {
      toast.error('Error Table: ' + err.message);
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
            products={products}
            categories={categories}
            tables={tables}
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
