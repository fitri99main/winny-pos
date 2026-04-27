import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Users, ShoppingCart, Settings, Coffee, FileText,
  LogOut, Bell, Search, Menu, Calculator, ChefHat, MonitorCheck,
  Contact, Archive, MapPin, CalendarCheck, History as ClockHistory, Wallet, Award, Target,
  Store, ChevronLeft, ChevronRight, CheckCircle, Package, RefreshCw, ShieldCheck, Clock, Percent, Fingerprint
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
