import * as React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var FlatList = RN.FlatList;
var StyleSheet = RN.StyleSheet;
var useWindowDimensions = RN.useWindowDimensions;
var ActivityIndicator = RN.ActivityIndicator;
var Alert = RN.Alert;
var Modal = RN.Modal;
var TextInput = RN.TextInput;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;
import CashierSessionModal from '../components/CashierSessionModal';
import CashierClosingSummaryModal from '../components/CashierClosingSummaryModal';
import ConfirmExitModal from '../components/ConfirmExitModal';
import StatusModal from '../components/StatusModal';
import * as PrinterLib from '../lib/PrinterManager';
var PrinterManager = PrinterLib.PrinterManager;
import * as DateLib from '../lib/dateUtils';
var getLocalISOString = DateLib.getLocalISOString;
var getLocalDateString = DateLib.getLocalDateString;

export default function CashierSessionHistoryScreen() {
    var navigation = useNavigation();
    var windowSize = useWindowDimensions();
    var width = windowSize.width;
    var height = windowSize.height;

    var stateLoading = React.useState(true);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var stateSessions = React.useState([]);
    var sessions = stateSessions[0];
    var setSessions = stateSessions[1];

    var stateSelectedSession = React.useState(null);
    var selectedSession = stateSelectedSession[0];
    var setSelectedSession = stateSelectedSession[1];

    var stateShowDetail = React.useState(false);
    var showDetail = stateShowDetail[0];
    var setShowDetail = stateShowDetail[1];

    var stateShowCloseModal = React.useState(false);
    var showCloseModal = stateShowCloseModal[0];
    var setShowCloseModal = stateShowCloseModal[1];

    var stateShowSummary = React.useState(false);
    var showSummary = stateShowSummary[0];
    var setShowSummary = stateShowSummary[1];

    var stateSummaryData = React.useState(null);
    var summaryData = stateSummaryData[0];
    var doSetSummaryData = stateSummaryData[1];

    var stateSummaryLoading = React.useState(false);
    var summaryLoading = stateSummaryLoading[0];
    var setSummaryLoading = stateSummaryLoading[1];
    
    var stateDateFilter = React.useState('today');
    var dateFilter = stateDateFilter[0];
    var setDateFilter = stateDateFilter[1];

    var stateStartDate = React.useState(getLocalDateString());
    var startDate = stateStartDate[0];
    var setStartDate = stateStartDate[1];

    var stateEndDate = React.useState(getLocalDateString());
    var endDate = stateEndDate[0];
    var setEndDate = stateEndDate[1];

    var stateStatusFilter = React.useState('all');
    var statusFilter = stateStatusFilter[0];
    var setStatusFilter = stateStatusFilter[1];

    var stateCashierFilter = React.useState('all');
    var cashierFilter = stateCashierFilter[0];
    var setCashierFilter = stateCashierFilter[1];

    var stateAvailableCashiers = React.useState([]);
    var availableCashiers = stateAvailableCashiers[0];
    var setAvailableCashiers = stateAvailableCashiers[1];

    var stateShowAdvancedFilter = React.useState(false);
    var showAdvancedFilter = stateShowAdvancedFilter[0];
    var setShowAdvancedFilter = stateShowAdvancedFilter[1];

    var stateShowDateRangeModal = React.useState(false);
    var showDateRangeModal = stateShowDateRangeModal[0];
    var setShowDateRangeModal = stateShowDateRangeModal[1];

    var sessionInfo = useSession();
    var currentBranchId = sessionInfo.currentBranchId;
    var isAdmin = sessionInfo.isAdmin;
    var storeSettings = sessionInfo.storeSettings;
    var sessionLoading = sessionInfo.loading;
    var branchAddress = sessionInfo.branchAddress;
    var branchPhone = sessionInfo.branchPhone;
    var userName = sessionInfo.userName;
    
    var stateShowEditModal = React.useState(false);
    var showEditModal = stateShowEditModal[0];
    var setShowEditModal = stateShowEditModal[1];

    var stateEditData = React.useState({ starting_cash: '', actual_cash: '', status: 'Closed' });
    var editData = stateEditData[0];
    var setEditData = stateEditData[1];

    var stateShowManualModal = React.useState(false);
    var showManualModal = stateShowManualModal[0];
    var setShowManualModal = stateShowManualModal[1];

    var stateManualData = React.useState({ employee_name: '', starting_cash: '', actual_cash: '', opened_at: getLocalISOString() });
    var manualData = stateManualData[0];
    var setManualData = stateManualData[1];

    var stateIsSaving = React.useState(false);
    var isSaving = stateIsSaving[0];
    var setIsSaving = stateIsSaving[1];

    var stateShowDeleteConfirm = React.useState(false);
    var showDeleteConfirm = stateShowDeleteConfirm[0];
    var setShowDeleteConfirm = stateShowDeleteConfirm[1];

    var stateStatusModal = React.useState({ visible: false, title: '', message: '', type: 'success' });
    var statusModal = stateStatusModal[0];
    var setStatusModal = stateStatusModal[1];

    var formatCurrency = function(value) {
        if (value === undefined || value === null) return 'Rp 0';
        var valNum = Math.floor(Number(value));
        return 'Rp ' + valNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    var formatDate = function(dateString) {
        if (!dateString) return '-';
        try {
            var dateObj = new Date(dateString);
            if (isNaN(dateObj.getTime())) return '-';
            var dd = dateObj.getDate().toString();
            if (dd.length < 2) dd = '0' + dd;
            var monthsArr = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            var mm = monthsArr[dateObj.getMonth()];
            var yy = dateObj.getFullYear();
            var hh = dateObj.getHours().toString();
            if (hh.length < 2) hh = '0' + hh;
            var mmin = dateObj.getMinutes().toString();
            if (mmin.length < 2) mmin = '0' + mmin;
            return dd + ' ' + mm + ' ' + yy + ' ' + hh + ':' + mmin;
        } catch (e) { return '-'; }
    };

    var fetchAvailableCashiers = function() {
        return supabase.from('cashier_sessions').select('employee_name').eq('branch_id', currentBranchId).then(function(res) {
            if (res.data) {
                var names = [];
                for (var i = 0; i < res.data.length; i++) {
                    var n = res.data[i].employee_name;
                    if (n && names.indexOf(n) === -1) names.push(n);
                }
                names.sort();
                setAvailableCashiers(names);
            }
        })['catch'](function(e) {});
    };

    var fetchSessions = function() {
        setLoading(true);
        var query = supabase.from('cashier_sessions').select('*').eq('branch_id', currentBranchId).order('opened_at', { ascending: false });
        if (dateFilter === 'today') {
            var start = new Date(); start.setHours(0, 0, 0, 0);
            query = query.gte('opened_at', start.toISOString());
        } else if (dateFilter === 'week') {
            var start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
            query = query.gte('opened_at', start.toISOString());
        } else if (dateFilter === 'month') {
            var start = new Date(); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
            query = query.gte('opened_at', start.toISOString());
        } else if (dateFilter === 'custom') {
            var sParts = startDate.split('-'); var s = new Date(Number(sParts[0]), Number(sParts[1]) - 1, Number(sParts[2]), 0, 0, 0, 0);
            var eParts = endDate.split('-'); var e = new Date(Number(eParts[0]), Number(eParts[1]) - 1, Number(eParts[2]), 23, 59, 59, 999);
            query = query.gte('opened_at', s.toISOString()).lte('opened_at', e.toISOString());
        }
        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (cashierFilter !== 'all') query = query.eq('employee_name', cashierFilter);

        return query.then(function(res) {
            if (res.data) setSessions(res.data);
        })['catch'](function(e) {
            Alert.alert('Error', 'Gagal memuat data');
        }).finally(function() {
            setLoading(false);
        });
    };

    React.useEffect(function() {
        if (currentBranchId) {
            fetchSessions();
            if (isAdmin) fetchAvailableCashiers();
        }
    }, [currentBranchId, dateFilter, startDate, endDate, statusFilter, cashierFilter]);

    var handleUpdateSession = function() {
        if (!selectedSession) return;
        setIsSaving(true);
        var start = parseFloat(editData.starting_cash) || 0;
        var actual = parseFloat(editData.actual_cash) || 0;
        var expected = (selectedSession.cash_sales || 0) + start;
        var diff = editData.status === 'Closed' ? (actual - expected) : 0;
        
        return supabase.from('cashier_sessions').update({
            starting_cash: start,
            actual_cash: editData.status === 'Closed' ? actual : null,
            expected_cash: expected,
            difference: diff
        }).eq('id', selectedSession.id).then(function(res) {
            if (res.error) throw res.error;
            setShowEditModal(false);
            setShowDetail(false);
            setStatusModal({ visible: true, title: 'Sukses', message: 'Data diperbarui', type: 'success' });
            return fetchSessions();
        })['catch'](function(e) {
            Alert.alert('Error', 'Gagal update');
        }).finally(function() {
            setIsSaving(false);
        });
    };

    var onConfirmDelete = function() {
        if (!selectedSession) return;
        setLoading(true);
        return supabase.from('cashier_sessions').delete().eq('id', selectedSession.id).then(function(res) {
            if (res.error) throw res.error;
            setShowDetail(false);
            setShowDeleteConfirm(false);
            setStatusModal({ visible: true, title: 'Sukses', message: 'Dihapus', type: 'success' });
            return fetchSessions();
        })['catch'](function(e) {
            Alert.alert('Error', 'Gagal hapus');
        }).finally(function() {
            setLoading(false);
        });
    };

    var handleViewSummary = function(session) {
        if (!session) return;
        setSummaryLoading(true);
        setShowSummary(true);
        var openedAt = session.opened_at;
        var closedAt = session.closed_at || new Date().toISOString();
        
        return supabase.from('sales').select('*').eq('branch_id', currentBranchId).gte('created_at', openedAt).lte('created_at', closedAt).then(function(salesRes) {
            if (salesRes.error) throw salesRes.error;
            var allSales = salesRes.data || [];
            var cash = 0, nonCash = 0, total = 0, totalTax = 0, totalDiscount = 0, count = 0;
            var paySummary = {};
            for (var i = 0; i < allSales.length; i++) {
                var s = allSales[i];
                if (s.status === 'Completed' || s.status === 'selesai' || s.status === 'Paid') {
                    count++;
                    var am = Number(s.total_amount || 0);
                    total += am;
                    totalTax += Number(s.tax || 0);
                    totalDiscount += Number(s.discount || 0);
                    var meth = s.payment_method || 'Tunai';
                    paySummary[meth] = (paySummary[meth] || 0) + am;
                    if (meth.toLowerCase() === 'tunai' || meth.toLowerCase() === 'cash') cash += am;
                    else nonCash += am;
                }
            }
            var finalPay = [];
            for (var k in paySummary) {
                finalPay.push({ method: k, amount: paySummary[k] });
            }
            doSetSummaryData({
                cash_sales: cash, non_cash_sales: nonCash, total_sales: total, total_tax: totalTax, total_discount: totalDiscount, total_orders: count,
                expected_cash: session.starting_cash + cash, starting_cash: session.starting_cash, actual_cash: session.actual_cash || 0,
                difference: session.difference || 0, employee_name: session.employee_name, opened_at: session.opened_at, closed_at: session.closed_at,
                payment_summary: finalPay, category_summary: []
            });
        })['catch'](function(e) {
            Alert.alert('Error', 'Gagal muat ringkasan');
        }).finally(function() {
            setSummaryLoading(false);
        });
    };

    var handlePrintSummary = function() {
        if (!summaryData) return;
        
        var reportData = {
            shopName: (storeSettings && storeSettings.store_name) ? storeSettings.store_name : 'WINNY COFFEE PNK',
            address: (storeSettings && storeSettings.address) ? storeSettings.address : (branchAddress || ''),
            phone: (storeSettings && storeSettings.phone) ? storeSettings.phone : (branchPhone || ''),
            dateRange: formatDate(summaryData.opened_at) + ' - ' + formatDate(summaryData.closed_at),
            totalOrders: summaryData.total_orders,
            totalSales: summaryData.total_sales,
            totalTax: summaryData.total_tax || 0,
            totalDiscount: summaryData.total_discount || 0,
            paymentSummary: summaryData.payment_summary,
            categorySummary: summaryData.category_summary || [],
            openingBalance: summaryData.starting_cash,
            cashTotal: summaryData.cash_sales,
            qrTotal: summaryData.non_cash_sales,
            expectedCash: summaryData.expected_cash,
            actualCash: summaryData.actual_cash,
            variance: summaryData.difference,
            generatedBy: summaryData.employee_name,
            paperWidth: (storeSettings && storeSettings.receipt_paper_width === '80mm') ? 48 : 32
        };

        PrinterManager.printSalesReport(reportData)['catch'](function(err) {
            console.error('[History] Print Error:', err);
            Alert.alert('Printer Error', 'Gagal mencetak.');
        });
    };

    var renderSessionItem = function(props) {
        var item = props.item;
        return React.createElement(TouchableOpacity, {
            style: styles.card,
            onPress: function() { setSelectedSession(item); setShowDetail(true); }
        },
            React.createElement(View, { style: styles.cardHeader },
                React.createElement(View, { style: styles.cashierInfo },
                    React.createElement(View, { style: styles.userIconContainer }, React.createElement(Text, null, "\uD83D\uDC64")),
                    React.createElement(Text, { style: styles.cashierName }, item.employee_name || 'Kasir')
                ),
                React.createElement(View, { style: [styles.statusBadge, item.status === 'Open' ? styles.statusOpen : styles.statusClosed] },
                    React.createElement(Text, { style: [styles.statusText, item.status === 'Open' ? styles.statusTextOpen : styles.statusTextClosed] }, item.status === 'Open' ? 'BUKA' : 'TUTUP')
                )
            ),
            React.createElement(View, { style: styles.timeInfo },
                React.createElement(View, { style: styles.timeRow }, React.createElement(Text, { style: styles.timeLabel }, "Buka:"), React.createElement(Text, { style: styles.timeValue }, formatDate(item.opened_at))),
                React.createElement(View, { style: styles.timeRow }, React.createElement(Text, { style: styles.timeLabel }, "Tutup:"), React.createElement(Text, { style: styles.timeValue }, formatDate(item.closed_at)))
            ),
            React.createElement(View, { style: styles.cardFooter },
                React.createElement(View, null, React.createElement(Text, { style: styles.footerLabel }, "Modal"), React.createElement(Text, { style: styles.footerValue }, formatCurrency(item.starting_cash))),
                React.createElement(View, null, React.createElement(Text, { style: styles.footerLabel }, "Sales"), React.createElement(Text, { style: [styles.footerValue, { color: '#16a34a' }] }, formatCurrency(item.total_sales))),
                React.createElement(View, { style: { alignItems: 'flex-end' } }, React.createElement(Text, { style: styles.footerLabel }, "Selisih"), React.createElement(Text, { style: [styles.footerValue, item.difference >= 0 ? { color: '#16a34a' } : { color: '#dc2626' }] }, formatCurrency(item.difference)))
            )
        );
    };

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(View, { style: styles.header },
            React.createElement(TouchableOpacity, { onPress: function() { navigation.goBack(); }, style: styles.backButton }, React.createElement(Text, { style: { fontSize: 24 } }, "\u25C0")),
            React.createElement(Text, { style: styles.headerTitle }, "Riwayat Kasir"),
            isAdmin ? React.createElement(TouchableOpacity, { style: styles.addManualBtn, onPress: function() { setShowManualModal(true); } }, React.createElement(Text, { style: { color: '#ea580c' } }, "+ Shift Manual")) : null
        ),
        React.createElement(View, { style: styles.filterBar },
            React.createElement(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: { padding: 12 } },
                ['today', 'week', 'month', 'custom'].map(function(f) {
                    return React.createElement(TouchableOpacity, { key: f, style: [styles.filterChip, dateFilter === f && styles.filterChipActive, { marginRight: 8 }], onPress: function() { if (f === 'custom') setShowDateRangeModal(true); else setDateFilter(f); } },
                        React.createElement(Text, { style: [styles.filterChipText, dateFilter === f && styles.filterChipTextActive] }, f === 'today' ? 'Hari Ini' : (f === 'week' ? '7 Hari' : (f === 'month' ? '30 Hari' : 'Kustom')))
                    );
                })
            )
        ),
        loading ? React.createElement(View, { style: { flex: 1, justifyContent: 'center' } }, React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" })) : React.createElement(FlatList, {
            data: sessions,
            keyExtractor: function(item, index) { return (item.id || index).toString(); },
            renderItem: renderSessionItem,
            contentContainerStyle: { padding: 12 }
        }),

        React.createElement(Modal, { visible: showDetail, transparent: true, animationType: "fade", onRequestClose: function() { setShowDetail(false); } },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(View, { style: styles.modalHeader },
                        React.createElement(Text, { style: styles.modalTitle }, "Detail Shift"),
                        React.createElement(TouchableOpacity, { onPress: function() { setShowDetail(false); } }, React.createElement(Text, { style: { fontSize: 24 } }, "\u2715"))
                    ),
                    selectedSession ? React.createElement(ScrollView, { style: { padding: 20 } },
                        React.createElement(View, { style: styles.detailRow }, React.createElement(Text, { style: styles.detailLabel }, "KASIR"), React.createElement(Text, { style: styles.detailValue }, selectedSession.employee_name)),
                        React.createElement(View, { style: styles.detailRow }, React.createElement(Text, { style: styles.detailLabel }, "BUKA"), React.createElement(Text, { style: styles.detailValue }, formatDate(selectedSession.opened_at))),
                        React.createElement(View, { style: styles.detailRow }, React.createElement(Text, { style: styles.detailLabel }, "TUTUP"), React.createElement(Text, { style: styles.detailValue }, formatDate(selectedSession.closed_at))),
                        React.createElement(View, { style: styles.detailRow }, React.createElement(Text, { style: styles.detailLabel }, "MODAL"), React.createElement(Text, { style: styles.detailValue }, formatCurrency(selectedSession.starting_cash))),
                        React.createElement(View, { style: styles.detailRow }, React.createElement(Text, { style: styles.detailLabel }, "SALES"), React.createElement(Text, { style: styles.detailValue }, formatCurrency(selectedSession.total_sales))),
                        React.createElement(View, { style: styles.detailRow }, React.createElement(Text, { style: styles.detailLabel }, "FISIK"), React.createElement(Text, { style: styles.detailValue }, formatCurrency(selectedSession.actual_cash))),
                        React.createElement(View, { style: styles.detailRow }, React.createElement(Text, { style: styles.detailLabel }, "SELISIH"), React.createElement(Text, { style: [styles.detailValue, selectedSession.difference >= 0 ? { color: '#16a34a' } : { color: '#dc2626' }] }, formatCurrency(selectedSession.difference))),
                        
                        React.createElement(TouchableOpacity, { style: [styles.printBtn, { marginTop: 20 }], onPress: function() { handleViewSummary(selectedSession); setShowDetail(false); } }, React.createElement(Text, { style: { color: 'white', fontWeight: 'bold' } }, "LIHAT RINGKASAN")),
                        isAdmin ? React.createElement(View, { style: { flexDirection: 'row', marginTop: 10 } },
                            React.createElement(TouchableOpacity, { style: [styles.printBtn, { flex: 1, backgroundColor: '#f1f5f9', marginRight: 10 }], onPress: function() { setEditData({ starting_cash: selectedSession.starting_cash.toString(), actual_cash: (selectedSession.actual_cash || 0).toString(), status: selectedSession.status }); setShowEditModal(true); } }, React.createElement(Text, { style: { color: '#4b5563' } }, "Edit")),
                            React.createElement(TouchableOpacity, { style: [styles.printBtn, { flex: 1, backgroundColor: '#fef2f2' }], onPress: function() { setShowDeleteConfirm(true); } }, React.createElement(Text, { style: { color: '#dc2626' } }, "Hapus"))
                        ) : null
                    ) : null,
                    React.createElement(TouchableOpacity, { style: { padding: 16, alignItems: 'center', backgroundColor: '#f3f4f6' }, onPress: function() { setShowDetail(false); } }, React.createElement(Text, null, "Tutup"))
                )
            )
        ),

        React.createElement(CashierClosingSummaryModal, { 
            visible: showSummary, 
            onClose: function() { setShowSummary(false); }, 
            data: summaryData, 
            loading: summaryLoading,
            onPrint: handlePrintSummary
        }),
        React.createElement(ConfirmExitModal, { visible: showDeleteConfirm, onClose: function() { setShowDeleteConfirm(false); }, onConfirm: onConfirmDelete, title: "Hapus Data?", message: "Data ini akan dihapus permanen.", confirmText: "Hapus", cancelText: "Batal", iconType: "trash" }),
        React.createElement(StatusModal, { visible: statusModal.visible, onClose: function() { setStatusModal(function(p) { return Object.assign({}, p, { visible: false }); }); }, title: statusModal.title, message: statusModal.message, type: statusModal.type }),

        React.createElement(Modal, { visible: showEditModal, transparent: true, animationType: "fade", onRequestClose: function() { setShowEditModal(false); } },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: [styles.modalContent, { padding: 20 }] },
                    React.createElement(Text, { style: styles.modalTitle }, "Edit Data Shift"),
                    React.createElement(TextInput, { style: styles.textInput, value: editData.starting_cash, onChangeText: function(v) { setEditData(Object.assign({}, editData, { starting_cash: v })); }, keyboardType: "numeric", placeholder: "Modal Awal" }),
                    React.createElement(TextInput, { style: [styles.textInput, { marginTop: 10 }], value: editData.actual_cash, onChangeText: function(v) { setEditData(Object.assign({}, editData, { actual_cash: v })); }, keyboardType: "numeric", placeholder: "Uang Fisik" }),
                    React.createElement(View, { style: { flexDirection: 'row', marginTop: 20 } },
                        React.createElement(TouchableOpacity, { style: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center', marginRight: 10 }, onPress: function() { setShowEditModal(false); } }, React.createElement(Text, null, "Batal")),
                        React.createElement(TouchableOpacity, { style: { flex: 1, padding: 12, backgroundColor: '#ea580c', borderRadius: 8, alignItems: 'center' }, onPress: handleUpdateSession }, React.createElement(Text, { style: { color: 'white' } }, "Simpan"))
                    )
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    header: { backgroundColor: 'white', padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 1 },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', flex: 1 },
    addManualBtn: { backgroundColor: '#fff7ed', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ffedd5' },
    filterBar: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    filterChipActive: { backgroundColor: '#fff7ed', borderColor: '#ea580c' },
    filterChipText: { fontSize: 12, color: '#6b7280' },
    filterChipTextActive: { color: '#ea580c', fontWeight: 'bold' },
    card: { backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 10, elevation: 1, marginHorizontal: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cashierInfo: { flexDirection: 'row', alignItems: 'center' },
    userIconContainer: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    cashierName: { fontWeight: 'bold', fontSize: 14 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusOpen: { backgroundColor: '#f0fdf4' },
    statusClosed: { backgroundColor: '#f3f4f6' },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    statusTextOpen: { color: '#16a34a' },
    statusTextClosed: { color: '#6b7280' },
    timeInfo: { paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f9fafb', marginBottom: 8 },
    timeRow: { flexDirection: 'row' },
    timeLabel: { fontSize: 11, color: '#6b7280', width: 40, marginRight: 8 },
    timeValue: { fontSize: 11, color: '#374151' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
    footerLabel: { fontSize: 10, color: '#9ca3af' },
    footerValue: { fontSize: 13, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 20, overflow: 'hidden' },
    modalHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    detailLabel: { fontSize: 12, color: '#9ca3af', fontWeight: 'bold' },
    detailValue: { fontSize: 14, color: '#1f2937' },
    printBtn: { backgroundColor: '#ea580c', padding: 14, borderRadius: 10, alignItems: 'center' },
    textInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12 }
});
