import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Users, ShoppingCart, Settings, Coffee, FileText,
  LogOut, Bell, Search, Menu, Calculator, ChefHat, MonitorCheck,
  Contact, Archive, MapPin, CalendarCheck, History as ClockHistory, Wallet, Award,
  Store, ChevronLeft, ChevronRight, CheckCircle, Package, RefreshCw, ShieldCheck, Clock
} from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth/AuthProvider';
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
import { PerformanceView } from './employees/PerformanceView';
import { SalesView, SalesOrder, SalesReturn, INITIAL_SALES } from './pos/SalesView';
import { CashierInterface } from './pos/CashierInterface';
import { BranchesView } from './branches/BranchesView';
import { ShiftsView } from './shifts/ShiftsView';
import { InventoryView, Ingredient as InvIngredient, StockMovement } from './inventory/InventoryView';
import { KDSView } from './pos/KDSView';
import { DashboardSkeleton } from './skeletons/DashboardSkeleton';
import { OrderItem } from '@/types/pos';
import { mockProducts } from '@/data/products';
import { toast } from 'sonner';
import { printerService } from '../lib/PrinterService';

type ModuleType = 'dashboard' | 'users' | 'contacts' | 'products' | 'purchases' | 'pos' | 'kds' | 'reports' | 'accounting' | 'settings' | 'employees' | 'attendance' | 'payroll' | 'branches' | 'shifts' | 'performance' | 'inventory';



function Home() {
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
  const [userRole, setUserRole] = useState<string>('Administrator');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentBranchId, setCurrentBranchId] = useState(localStorage.getItem('winpos_current_branch') || '');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [contacts, setContacts] = useState<ContactData[]>([]);
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

  // Restored Missing States
  const [units, setUnits] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);

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
          cost_per_unit: Number(data.cost_per_unit || 0),
          branch_id: currentBranchId
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
        if (data.is_static) return toast.error('Metode sistem tidak dapat dihapus');
        const { error } = await supabase.from('payment_methods').delete().eq('id', data.id);
        if (error) throw error;
        toast.success('Metode pembayaran dihapus');
      }
    } catch (err: any) {
      toast.error('Gagal memproses metode pembayaran: ' + err.message);
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
    show_customer_name: true,
    show_customer_status: true,
    show_logo: true,
    receipt_logo_url: '',
    address: ''
  });

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
      safeFetch(supabase.from('categories').select('*').order('name'), 'categories'),
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
      safeFetch(supabase.from('products').select('*').eq('branch_id', branchId).order('created_at', { ascending: false }), 'products'),
      safeFetch(supabase.from('shift_schedules').select('*').order('date'), 'schedules'), // Needs JS filtering or relation update
      safeFetch(supabase.from('tables').select('*').eq('branch_id', branchId).order('number'), 'tables'),
      safeFetch(supabase.from('ingredients').select('*').eq('branch_id', branchId).order('name'), 'ingredients'),
      safeFetch(supabase.from('stock_movements').select('*').eq('branch_id', branchId).order('date', { ascending: false }), 'movements'),
    ]);

    const [productsRes, schedulesRes, tablesRes, ingredientsRes, movementsRes] = results;

    if (productsRes.data) setProducts(productsRes.data);

    // Filter schedules for employees in this branch (done in employees fetch usually, or here if we have employees list?)
    // For now, setting all schedules. Ideally should filter.
    if (schedulesRes.data) setShiftSchedules(schedulesRes.data);

    if (tablesRes.data) setTables(tablesRes.data);
    if (ingredientsRes.data) setInventoryIngredients(ingredientsRes.data);
    if (movementsRes.data) setInventoryHistory(movementsRes.data);
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
    }

    // Subscribe to branch-specific changes
    // Note: receiving all events then re-fetching filtered is acceptable for now.
    const branchChannels = [
      supabase.channel('products_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('schedules_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'shift_schedules' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('ingredients_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('movements_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
      supabase.channel('tables_branch').on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => currentBranchId && fetchBranchData(currentBranchId)).subscribe(),
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
      supabase.channel('purchases_all').on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, fetchPurchases).subscribe(),
      supabase.channel('returns_all').on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_returns' }, fetchPurchases).subscribe(),
    ];
    return () => {
      purchaseChannels.forEach(ch => ch.unsubscribe());
    };
  }, [currentBranchId]);

  // --- Sales & POS Integration ---
  const fetchTransactions = async () => {
    if (!currentBranchId) return;

    // Fetch Sales with Items
    const { data: salesData } = await supabase
      .from('sales')
      .select(`
        *,
        items:sale_items(*)
      `)
      .eq('branch_id', currentBranchId)
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
        waitingTime: s.waiting_time, // optional if exists
        customerName: s.customer_name,
        discount: Number(s.discount || 0),
        notes: s.notes,
        branchId: s.branch_id,
        waiterName: s.waiter_name,
        tableNo: s.table_no,
        productDetails: (s.items || []).map((i: any) => ({
          name: i.product_name,
          quantity: i.quantity,
          price: i.price
        })),
        printCount: s.print_count || 0,
        lastPrintedAt: s.last_printed_at
      }));
      setSales(formattedSales);

      const pendingFromDB = salesData
        .filter(s => s.status === 'Pending')
        .map(s => ({
          id: s.id,
          orderNo: s.order_no,
          tableNo: s.table_no || '-',
          waiterName: s.waiter_name || 'Kiosk',
          time: new Date(s.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          items: (s.items || []).map((i: any) => ({
            name: i.product_name,
            quantity: i.quantity,
            target: 'Kitchen',
            status: 'Pending'
          }))
        }));

      setPendingOrders(prev => {
        const newOrders = pendingFromDB.filter(p => !prev.some(existing => existing.id === p.id));
        if (newOrders.length > 0) return [...newOrders, ...prev];
        return prev;
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
      supabase.channel('sales_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchTransactions).subscribe(),
      supabase.channel('sale_items_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, fetchTransactions).subscribe(),
      supabase.channel('returns_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'sales_returns' }, fetchTransactions).subscribe(),
    ];
    return () => {
      transactionChannels.forEach(ch => ch.unsubscribe());
    };
  }, [currentBranchId]);

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
    const { data: empData } = await supabase.from('employees').select('*').eq('branch_id', currentBranchId).order('name');
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


  // --- Realtime Order Notifications for Cashier ---
  useEffect(() => {
    const channel = supabase
      .channel('new_kiosk_orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales' },
        (payload) => {
          const newOrder = payload.new;
          if (newOrder.waiter_name !== 'Self-Service Kiosk') return;

          toast.custom((t) => (
            <div className="bg-white rounded-xl shadow-2xl border border-blue-100 p-4 w-80 animate-in slide-in-from-top-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">Pesanan Baru Kiosk!</h4>
                  <p className="text-sm text-gray-500 mb-1">Meja {newOrder.table_no} • {newOrder.customer_name || 'Pelanggan'}</p>
                  <p className="text-xs font-mono text-gray-400 mb-3">{newOrder.order_no}</p>
                  <button
                    onClick={() => {
                      setActiveModule('pos');
                      setSalesViewTab('history');
                      toast.dismiss(t);
                    }}
                    className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold w-full hover:bg-blue-700 transition-colors"
                  >
                    Buka Kasir
                  </button>
                </div>
              </div>
            </div >
          ), { duration: 10000 });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

        // Inject branch_id for branch-specific tables managed by this generic handler
        if (table === 'purchases') {
          (payload as any).branch_id = currentBranchId;
        }

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
        showLogo: storeSettings.show_logo,
        logoUrl: storeSettings.receipt_logo_url,
      });
    }
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
        waiter_name: saleData.waiterName,
        table_no: saleData.tableNo,
        customer_name: saleData.customerName,
        discount: saleData.discount || 0
      }]).select().single();

      if (saleError) throw saleError;
      if (!sale) throw new Error('Failed to create sale');

      // 2. Create Sale Items
      const saleItems = saleData.productDetails.map(item => {
        const product = products.find(p => p.name === item.name);
        return {
          sale_id: sale.id,
          product_id: product?.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          cost: product?.cost || 0 // Snapshot Cost (HPP)
        };
      });

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
        tax: 0,
        total: saleData.totalAmount,
        paymentType: saleData.paymentMethod || 'Tunai',
        amountPaid: saleData.paidAmount || saleData.totalAmount,
        change: saleData.change || 0
      });

      // 4. Force refresh the transactions list to show the new sale immediately
      await fetchTransactions();

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
        branch_id: updatedSale.branchId,
        waiter_name: updatedSale.waiterName,
        status: updatedSale.status, // Allow status update for Pay First workflow
      }).eq('id', updatedSale.id);

      if (error) throw error;

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
  /* 
    3. 'dashboard' is always shown acting as Home.
  */
  const { user, role, permissions } = useAuth(); // Get extended auth info
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);



  // NEW PERMISSION-BASED LOGIC WITH GROUPING
  // 1. Define groups
  const menuGroups = [
    {
      title: 'Utama',
      modules: [
        { id: 'dashboard', label: 'Winny Cafe', icon: LayoutDashboard, color: 'text-blue-600', bgColor: 'bg-blue-50' },
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
      ]
    },
    {
      title: 'HRD & Karyawan',
      modules: [
        { id: 'employees', label: 'Karyawan', icon: Users, color: 'text-rose-600', bgColor: 'bg-rose-50' },
        { id: 'attendance', label: 'Absensi', icon: CalendarCheck, color: 'text-violet-600', bgColor: 'bg-violet-50' },
        { id: 'shifts', label: 'Jadwal Shift', icon: ClockHistory, color: 'text-indigo-700', bgColor: 'bg-indigo-50' },
        { id: 'payroll', label: 'Payroll', icon: Wallet, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
        { id: 'performance', label: 'Performa', icon: Award, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
      ]
    },
    {
      title: 'Keuangan',
      modules: [
        { id: 'reports', label: 'Laporan', icon: FileText, color: 'text-teal-600', bgColor: 'bg-teal-50' },
        { id: 'accounting', label: 'Akuntansi', icon: Calculator, color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
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
    if (moduleId === 'dashboard') return true;
    if (role && role.toLowerCase() === 'administrator') return true;
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
        const payload = { ...rest, join_date: joinDate, off_days: offDays, branch_id: currentBranchId };
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;
        toast.success('Karyawan berhasil ditambahkan');
      } else if (action === 'update') {
        const { id, joinDate, offDays, ...rest } = data;
        const payload = { ...rest, join_date: joinDate, off_days: offDays, branch_id: currentBranchId };
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
        header: storeSettings.receipt_header,
        address: storeSettings.address,
        footer: storeSettings.receipt_footer,
        paperWidth: storeSettings.receipt_paper_width,
        showDate: storeSettings.show_date,
        showWaiter: storeSettings.show_waiter,
        showTable: storeSettings.show_table,
        showCustomerName: storeSettings.show_customer_name,
        showCustomerStatus: storeSettings.show_customer_status,
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
          onNavigate={(module) => setActiveModule(module as ModuleType)}
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
              if (action === 'create' || action === 'update') {
                // Separate relation data from product data
                const { recipe, addons, id, ...rest } = data;

                // Whitelist only valid columns to avoid schema errors and strip undefined values
                const validColumns = ['code', 'name', 'category', 'brand', 'unit', 'price', 'cost', 'stock', 'image_url'];
                const productData: any = {};
                validColumns.forEach(col => {
                  if (rest[col] !== undefined) productData[col] = rest[col];
                });

                // Ensure numeric values are numbers
                if (productData.price) productData.price = Number(productData.price);
                if (productData.cost) productData.cost = Number(productData.cost);
                if (productData.stock) productData.stock = Number(productData.stock);

                console.log('Saving product data:', productData);

                // 1. Save Product
                let productId = id;
                if (action === 'create') {
                  // Auto-assign branch_id for new products
                  productData.branch_id = currentBranchId;
                  const { data: newProd, error } = await supabase.from('products').insert([productData]).select().single();
                  if (error) throw error;
                  productId = newProd.id;
                } else {
                  const { error } = await supabase.from('products').update(productData).eq('id', id);
                  if (error) throw error;
                }

                // 2. Handle Recipe
                if (recipe && Array.isArray(recipe)) {
                  // Delete existing
                  await supabase.from('product_recipes').delete().eq('product_id', productId);
                  // Insert new
                  if (recipe.length > 0) {
                    const recipeItems = recipe.map((r: any) => ({
                      product_id: productId,
                      ingredient_id: r.ingredientId,
                      amount: r.amount
                    }));
                    const { error: recipeError } = await supabase.from('product_recipes').insert(recipeItems);
                    if (recipeError) console.error('Error saving recipe:', recipeError);
                  }
                }

                if (addons && Array.isArray(addons)) {
                  await supabase.from('product_addons').delete().eq('product_id', productId);
                  if (addons.length > 0) {
                    const addonItems = addons.map((a: any) => ({
                      product_id: productId,
                      name: a.name,
                      price: a.price
                    }));
                    const { error: addonError } = await supabase.from('product_addons').insert(addonItems);
                    if (addonError) console.error('Error saving addons:', addonError);
                  }
                }

                toast.success(`Produk berhasil ${action === 'create' ? 'dibuat' : 'diupdate'}`);
                // fetchMasterData(); // Removed - handled by subscription
              } else if (action === 'delete') {
                await handleMasterDataCRUD('products', action, data);
              }
              // Refresh is handled by fetchBranchData via subscription
            } catch (err: any) {
              console.error('Error saving product:', err);
              // Show more detailed error
              const errorMessage = err.message || JSON.stringify(err);
              const errorDetails = err.details ? ` (${err.details})` : '';
              const errorHint = err.hint ? ` Hint: ${err.hint}` : '';
              toast.error(`Gagal menyimpan: ${errorMessage}${errorDetails}${errorHint}`);
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
        />
      );
      case 'kds': return <KDSView pendingOrders={pendingOrders} setPendingOrders={setPendingOrders} />;
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
            onDeleteSale={handleDeleteSale}
            onOpenCashier={() => setIsCashierOpen(true)}
            initialTab={salesViewTab}
            currentBranchId={currentBranchId}
            onModeChange={(mode) => setSalesViewTab(mode)}
            onExit={() => setActiveModule('dashboard')}
          />
        );
      case 'reports': return <ReportsView sales={sales} returns={returns} paymentMethods={paymentMethods} />;
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
      case 'attendance':
        // Filter logs to match employees in current branch
        const filteredLogs = attendanceLogs.filter(log => employees.some(e => e.id === log.employee_id || e.name === log.employeeName));
        return <AttendanceView logs={filteredLogs} setLogs={setAttendanceLogs} employees={employees} />;
      case 'payroll':
        // Filter payroll to match employees in current branch
        const filteredPayroll = payrollData.filter(p => employees.some(e => e.id === p.employee_id || e.name === p.employeeName));
        return (
          <PayrollView
            payroll={filteredPayroll}
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
          onNavigate={(module) => setActiveModule(module as ModuleType)}
        />
      );
    }
  };

  // --- Table Handlers ---
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
    } catch (err: any) {
      toast.error('Error Table: ' + err.message);
    }
  };



  const handleModuleClick = (moduleId: string) => {
    setActiveModule(moduleId as ModuleType);
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
                          // Close mobile drawer if open (not implemented but good practice)
                        }}
                        className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-3'} gap-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isActive
                          ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        title={isSidebarCollapsed ? module.label : ''}
                      >
                        <div className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isActive ? 'bg-white text-blue-600' : `${module.bgColor} bg-opacity-40 group-hover:bg-opacity-100 ${module.color} group-hover:text-gray-900`}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        {!isSidebarCollapsed && (
                          <span className="font-medium text-sm truncate animate-in fade-in duration-200">{module.label}</span>
                        )}
                        {!isSidebarCollapsed && isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
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
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
              {user?.user_metadata?.name?.charAt(0) || 'U'}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">{user?.user_metadata?.name || 'User'}</p>
                <p className="text-[10px] text-gray-400 font-medium truncate uppercase">{role || 'Staff'}</p>
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
              <div className="flex flex-col items-center">
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
              </div>
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
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20 group-hover:scale-105 transition-transform">
                <ShoppingCart className="w-4 h-4" />
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
            onBack={() => setIsCashierOpen(false)}
            contacts={contacts}
            employees={employees}
            onSendToKDS={handleSendToKDS}
            products={products}
            categories={categories}
            tables={tables}
            activeSales={sales}
            paymentMethods={paymentMethods}
            onDeleteSale={handleDeleteSale}
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
                  onClick={() => supabase.auth.signOut()}
                >
                  Keluar
                </Button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default Home;
