import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var StyleSheet = RN.StyleSheet;
var ActivityIndicator = RN.ActivityIndicator;
var Platform = RN.Platform;
var Alert = RN.Alert;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import * as PrinterLib from '../lib/PrinterManager';
var PrinterManager = PrinterLib.PrinterManager;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;

export default function SalesReportModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    
    var session = useSession();
    var currentBranchId = session.currentBranchId;
    var branchName = session.branchName;
    var storeSettings = session.storeSettings;

    var stateLoading = React.useState(false);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var stateReportData = React.useState(null);
    var reportData = stateReportData[0];
    var setReportData = stateReportData[1];

    var fetchReport = function() {
        setLoading(true);
        var today = new Date().toISOString().split('T')[0];
        
        return supabase.rpc('get_daily_sales_summary', {
            p_branch_id: currentBranchId,
            p_date: today
        }).then(function(res) {
            if (res.error) throw res.error;
            setReportData(res.data);
        })['catch'](function(error) {
            console.error('Error fetching report:', error);
            Alert.alert('Error', 'Gagal memuat laporan harian');
        })['finally'](function() {
            setLoading(false);
        });
    };

    React.useEffect(function() {
        if (visible && currentBranchId) {
            fetchReport();
        }
    }, [visible, currentBranchId]);

    var handlePrint = function() {
        if (!reportData) return;
        
        var paperWidth = (storeSettings && storeSettings.receipt_paper_width === '80mm') ? 48 : 32;
        var printData = Object.assign({}, reportData, {
            branch_name: branchName,
            paperWidth: paperWidth
        });

        return PrinterManager.printSalesReport(printData).then(function(success) {
            if (success) Alert.alert('Sukses', 'Laporan dicetak');
        })['catch'](function(error) {
            Alert.alert('Error', 'Gagal mencetak laporan');
        });
    };

    var formatCurrency = function(val) {
        return 'Rp ' + (val || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    return React.createElement(Modal, { visible: visible, transparent: true, animationType: "slide", onRequestClose: onClose },
        React.createElement(View, { style: styles.overlay },
            React.createElement(View, { style: styles.container },
                React.createElement(View, { style: styles.header },
                    React.createElement(Text, { style: styles.title }, "Laporan Penjualan Hari Ini"),
                    React.createElement(TouchableOpacity, { onPress: onClose },
                        React.createElement(Text, { style: { fontSize: 24 } }, "\u2715")
                    )
                ),

                loading ? React.createElement(View, { style: styles.loadingContainer },
                    React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" })
                ) : (reportData ? React.createElement(ScrollView, { style: styles.content },
                    React.createElement(View, { style: styles.statCard },
                        React.createElement(Text, { style: styles.statLabel }, "Total Penjualan"),
                        React.createElement(Text, { style: styles.statValue }, formatCurrency(reportData.total_sales))
                    ),

                    React.createElement(View, { style: styles.grid },
                        React.createElement(View, { style: styles.smallCard },
                            React.createElement(Text, { style: styles.smallLabel }, "Total Order"),
                            React.createElement(Text, { style: styles.smallValue }, reportData.total_orders)
                        ),
                        React.createElement(View, { style: [styles.smallCard, { marginLeft: 12 }] },
                            React.createElement(Text, { style: styles.smallLabel }, "Rata-rata"),
                            React.createElement(Text, { style: styles.smallValue }, formatCurrency(reportData.avg_order))
                        )
                    ),

                    React.createElement(View, { style: styles.section },
                        React.createElement(Text, { style: styles.sectionTitle }, "Detail Transaksi"),
                        React.createElement(View, { style: styles.row },
                            React.createElement(Text, null, "Transaksi Manual"),
                            React.createElement(Text, { style: styles.bold }, formatCurrency(reportData.manual_total || 0))
                        ),
                        React.createElement(View, { style: styles.row },
                            React.createElement(Text, { style: { color: '#ef4444' } }, "Total Diskon"),
                            React.createElement(Text, { style: [styles.bold, { color: '#ef4444' }] }, "- " + formatCurrency(reportData.total_discount || 0))
                        )
                    ),

                    React.createElement(View, { style: styles.section },
                        React.createElement(Text, { style: styles.sectionTitle }, "Metode Pembayaran"),
                        React.createElement(View, { style: styles.row },
                            React.createElement(Text, null, "Tunai"),
                            React.createElement(Text, { style: styles.bold }, formatCurrency(reportData.cash_sales))
                        ),
                        React.createElement(View, { style: styles.row },
                            React.createElement(Text, null, "QRIS / Non-Tunai"),
                            React.createElement(Text, { style: styles.bold }, formatCurrency(reportData.qris_sales))
                        )
                    ),

                    React.createElement(TouchableOpacity, { style: styles.printBtn, onPress: handlePrint },
                        React.createElement(Text, { style: styles.printBtnText }, "Cetak Laporan")
                    )
                ) : React.createElement(View, { style: styles.emptyContainer },
                    React.createElement(Text, null, "Data tidak tersedia")
                ))
            )
        )
    );
}

var styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 18, fontWeight: 'bold' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1 },
    statCard: { backgroundColor: '#fff7ed', padding: 20, borderRadius: 16, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: '#ffedd5' },
    statLabel: { color: '#ea580c', fontWeight: '600' },
    statValue: { fontSize: 24, fontWeight: 'bold', color: '#ea580c', marginTop: 4 },
    grid: { flexDirection: 'row', marginBottom: 16 },
    smallCard: { flex: 1, backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    smallLabel: { fontSize: 12, color: '#64748b' },
    smallValue: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    section: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 20 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#64748b' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    bold: { fontWeight: 'bold' },
    printBtn: { backgroundColor: '#ea580c', padding: 16, borderRadius: 12, alignItems: 'center' },
    printBtnText: { color: '#fff', fontWeight: 'bold' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
