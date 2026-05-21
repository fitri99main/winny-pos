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
var Image = RN.Image;
var Animated = RN.Animated;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import ShiftSummaryPreviewModal from './ShiftSummaryPreviewModal';

export default function CashierClosingSummaryModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var data = props.data;
    var loading = props.loading;
    var onPrint = props.onPrint;
    var title = props.title || 'RINGKASAN SHIFT';

    var stateStoreSettings = React.useState(null);
    var storeSettings = stateStoreSettings[0];
    var setStoreSettings = stateStoreSettings[1];

    var stateShowPreview = React.useState(false);
    var showPreview = stateShowPreview[0];
    var setShowPreview = stateShowPreview[1];

    var fadeAnim = React.useRef(new Animated.Value(0)).current;

    var fetchStoreSettings = function() {
        return supabase.from('store_settings').select('*').single().then(function(res) {
            if (res.data) setStoreSettings(res.data);
        })['catch'](function(err) {});
    };

    React.useEffect(function() {
        if (visible) {
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            fetchStoreSettings();
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible]);
    
    var formatCurrency = function(val) {
        if (val === undefined || val === null) return 'Rp 0';
        var num = Math.floor(Number(val));
        return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    var buildNormalizedPaymentSummary = function(sourceData) {
        if (!sourceData) return [];

        var cashTotal = Number(sourceData.cash_sales || 0);
        var nonCashTotal = Number(sourceData.non_cash_sales || 0);
        var normalized = [];

        if (cashTotal > 0) {
            normalized.push({ method: 'Tunai', amount: cashTotal });
        }
        if (nonCashTotal > 0) {
            normalized.push({ method: 'QRIS / Non Tunai', amount: nonCashTotal });
        }

        if (normalized.length === 0 && Array.isArray(sourceData.payment_summary)) {
            return sourceData.payment_summary;
        }

        return normalized;
    };

    var formatDate = function(dateStr) {
        if (!dateStr) return '-';
        try {
            var date = new Date(dateStr);
            if (isNaN(date.getTime())) return '-';
            
            var d = String(date.getDate());
            if (d.length < 2) d = '0' + d;
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            var m = months[date.getMonth()];
            var h = String(date.getHours());
            if (h.length < 2) h = '0' + h;
            var min = String(date.getMinutes());
            if (min.length < 2) min = '0' + min;
            
            return d + ' ' + m + ' ' + h + ':' + min;
        } catch (e) {
            return '-';
        }
    };

    var handlePreview = function() {
        setShowPreview(true);
    };

    if (!visible) return null;

    var reportData = null;
    var normalizedPaymentSummary = buildNormalizedPaymentSummary(data);
    if (data) {
        reportData = {
            shopName: (storeSettings && storeSettings.store_name) ? storeSettings.store_name : 'WINNY COFFEE PNK',
            address: (storeSettings && storeSettings.address) ? storeSettings.address : '',
            phone: (storeSettings && storeSettings.phone) ? storeSettings.phone : '',
            dateRange: formatDate(data.opened_at) + ' - ' + (data.closed_at ? formatDate(data.closed_at) : formatDate(new Date().toISOString())),
            totalOrders: data.total_orders,
            totalSales: data.total_sales,
            totalTax: data.total_tax,
            totalDiscount: data.total_discount,
            cashTotal: data.cash_sales,
            qrTotal: data.non_cash_sales,
            paymentSummary: normalizedPaymentSummary,
            openingBalance: data.starting_cash,
            expectedCash: data.expected_cash,
            actualCash: data.actual_cash,
            variance: data.difference,
            generatedBy: data.employee_name,
            categorySummary: data.category_summary,
            paperWidth: (storeSettings && storeSettings.receipt_paper_width === '80mm') ? 48 : 32
        };
    }

    return React.createElement(Modal, { visible: visible, transparent: true, animationType: "none", onRequestClose: onClose },
        React.createElement(View, { style: styles.overlay },
            React.createElement(Animated.View, { style: [styles.container, { opacity: fadeAnim }] },
                React.createElement(View, { style: styles.header },
                    React.createElement(View, { style: styles.titleWrapper },
                        React.createElement(Text, { style: styles.title }, title)
                    ),
                    React.createElement(TouchableOpacity, { onPress: onClose, style: styles.closeBtn },
                        React.createElement(Text, { style: { fontSize: 24, color: '#94a3b8' } }, "\u2715")
                    )
                ),

                loading ? React.createElement(View, { style: styles.loadingContainer },
                    React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" }),
                    React.createElement(Text, { style: styles.loadingText }, "Menyusun Laporan...")
                ) : (!data ? React.createElement(View, { style: styles.errorContainer },
                    React.createElement(Text, { style: styles.errorText }, "Data tidak ditemukan")
                ) : React.createElement(ScrollView, { style: styles.content, showsVerticalScrollIndicator: false },
                    React.createElement(View, { style: styles.metaContainer },
                        React.createElement(View, { style: styles.metaRow },
                            React.createElement(Text, { style: styles.metaText }, "Kasir: " + (data.employee_name || 'Kasir'))
                        ),
                        React.createElement(View, { style: styles.metaRow },
                            React.createElement(Text, { style: styles.metaText }, formatDate(data.opened_at) + (data.closed_at ? ' - ' + formatDate(data.closed_at) : ' (Aktif)'))
                        )
                    ),

                    React.createElement(View, { style: styles.statsGrid },
                        React.createElement(View, { style: [styles.statCard, { marginRight: 10 }] },
                            React.createElement(Text, { style: styles.statLabel }, "Total Order"),
                            React.createElement(Text, { style: styles.statValue }, data.total_orders)
                        ),
                        React.createElement(View, { style: styles.statCard },
                            React.createElement(Text, { style: styles.statLabel }, "Total Sales"),
                            React.createElement(Text, { style: styles.statValue }, formatCurrency(data.total_sales))
                        )
                    ),

                    React.createElement(View, { style: [styles.statsGrid, { marginTop: 10 }] },
                        React.createElement(View, { style: styles.statCard },
                            React.createElement(Text, { style: styles.statLabel }, "Rata-rata Order"),
                            React.createElement(Text, { style: styles.statValue }, formatCurrency(data.total_orders > 0 ? Math.round(data.total_sales / data.total_orders) : 0))
                        )
                    ),

                    React.createElement(View, { style: styles.sectionCard },
                        React.createElement(Text, { style: styles.sectionTitle }, "DETAIL PEMBAYARAN"),
                        normalizedPaymentSummary.map(function(p, i) {
                            return React.createElement(View, { key: i, style: styles.itemRow },
                                React.createElement(Text, { style: styles.itemLabel }, String(p.method || '').toUpperCase()),
                                React.createElement(Text, { style: styles.itemValue }, formatCurrency(p.amount))
                            );
                        }),
                        (data.total_discount || 0) > 0 ? React.createElement(View, { style: styles.itemRow },
                            React.createElement(Text, { style: [styles.itemLabel, { color: '#ef4444' }] }, "TOTAL DISKON"),
                            React.createElement(Text, { style: [styles.itemValue, { color: '#ef4444' }] }, "- " + formatCurrency(data.total_discount))
                        ) : null,
                        (data.manual_total || 0) > 0 ? React.createElement(View, { style: styles.itemRow },
                            React.createElement(Text, { style: styles.itemLabel }, "TRANSAKSI MANUAL"),
                            React.createElement(Text, { style: styles.itemValue }, formatCurrency(data.manual_total))
                        ) : null,
                        (data.total_tax || 0) > 0 ? React.createElement(View, { style: styles.itemRow },
                            React.createElement(Text, { style: styles.itemLabel }, "TOTAL PAJAK"),
                            React.createElement(Text, { style: styles.itemValue }, formatCurrency(data.total_tax))
                        ) : null
                    ),

                    React.createElement(View, { style: [styles.sectionCard, styles.darkCard] },
                        React.createElement(Text, { style: [styles.sectionTitle, { color: '#f8fafc' }] }, "REKONSILIASI TUNAI"),
                        React.createElement(View, { style: styles.itemRow },
                            React.createElement(Text, { style: styles.itemLabelLight }, "TUNAI (SISTEM)"),
                            React.createElement(Text, { style: styles.itemValueLight }, formatCurrency(data.cash_sales))
                        ),
                        React.createElement(View, { style: styles.itemRow },
                            React.createElement(Text, { style: styles.itemLabelLight }, "MODAL AWAL"),
                            React.createElement(Text, { style: styles.itemValueLight }, formatCurrency(data.starting_cash))
                        ),
                        (data.cash_topups || 0) > 0 ? React.createElement(View, { style: styles.itemRow },
                            React.createElement(Text, { style: styles.itemLabelLight }, "TOP UP KAS"),
                            React.createElement(Text, { style: styles.itemValueLight }, formatCurrency(data.cash_topups))
                        ) : null,
                        ((data.cash_refunds || 0) > 0 || (data.cash_expenses || 0) > 0) ? React.createElement(View, { style: styles.itemRow },
                            React.createElement(Text, { style: [styles.itemLabelLight, { color: '#fca5a5' }] }, "RETUR & PENGELUARAN"),
                            React.createElement(Text, { style: [styles.itemValueLight, { color: '#fca5a5' }] }, "- " + formatCurrency((data.cash_refunds || 0) + (data.cash_expenses || 0)))
                        ) : null,
                        React.createElement(View, { style: styles.divider }),
                        React.createElement(View, { style: styles.itemRow },
                            React.createElement(Text, { style: styles.itemLabelHighlight }, "TOTAL (TUNAI+SISTEM)"),
                            React.createElement(Text, { style: styles.itemValueHighlight }, formatCurrency(data.expected_cash))
                        ),
                        data.actual_cash !== undefined ? React.createElement(React.Fragment, null,
                            React.createElement(View, { style: styles.itemRow },
                                React.createElement(Text, { style: styles.itemLabelLight }, "KAS FISIK KASIR (TUTUP KASIR)"),
                                React.createElement(Text, { style: styles.itemValueLight }, formatCurrency(data.actual_cash))
                            ),
                            React.createElement(View, { style: styles.itemRow },
                                React.createElement(Text, { style: [styles.itemLabelHighlight, { color: data.difference >= 0 ? '#4ade80' : '#f87171' }] }, "SELISIH"),
                                React.createElement(Text, { style: [styles.itemValueHighlight, { color: data.difference >= 0 ? '#4ade80' : '#f87171' }] }, formatCurrency(data.difference))
                            )
                        ) : null
                    ),

                    (data.category_summary && data.category_summary.length > 0) ? React.createElement(View, { style: styles.sectionCard },
                        React.createElement(Text, { style: styles.sectionTitle }, "PENJUALAN PER KATEGORI"),
                        data.category_summary.map(function(cat, i) {
                            return React.createElement(View, { key: i, style: styles.itemRow },
                                React.createElement(Text, { style: styles.itemLabel }, cat.name),
                                React.createElement(Text, { style: styles.itemValue }, formatCurrency(cat.amount))
                            );
                        })
                    ) : null,
                    React.createElement(View, { style: { height: 40 } })
                )),

                React.createElement(View, { style: styles.footer },
                    React.createElement(TouchableOpacity, { style: styles.closeBtnFooter, onPress: onClose },
                        React.createElement(Text, { style: styles.closeBtnText }, "Tutup")
                    ),
                    onPrint ? React.createElement(View, { style: { flex: 2, flexDirection: 'row' } },
                        React.createElement(TouchableOpacity, { style: [styles.printBtn, { backgroundColor: '#f1f5f9', flex: 1, marginRight: 10 }], onPress: handlePreview, disabled: loading },
                            React.createElement(Text, { style: [styles.printBtnText, { color: '#64748b', fontSize: 12 }] }, "Pratinjau")
                        ),
                        React.createElement(TouchableOpacity, { style: [styles.printBtn, { flex: 1.2 }], onPress: onPrint, disabled: loading },
                            React.createElement(Text, { style: [styles.printBtnText, { fontSize: 12 }] }, "Cetak")
                        )
                    ) : null
                )
            )
        ),
        React.createElement(ShiftSummaryPreviewModal, {
            visible: showPreview,
            onClose: function() { setShowPreview(false); },
            data: reportData,
            onPrint: function() {
                setShowPreview(false);
                onPrint();
            }
        })
    );
}

var styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'flex-end' },
    container: { backgroundColor: '#f8fafc', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '88%', width: '100%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
    titleWrapper: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
    closeBtn: { padding: 4 },
    content: { flex: 1, padding: 16 },
    metaContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, backgroundColor: 'white', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9' },
    metaRow: { flexDirection: 'row', alignItems: 'center' },
    metaText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    statsGrid: { flexDirection: 'row', marginBottom: 10 },
    statCard: { flex: 1, backgroundColor: 'white', padding: 14, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', elevation: 2 },
    statLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', marginTop: 6 },
    statValue: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginTop: 2 },
    sectionCard: { backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
    darkCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
    sectionTitle: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 12 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    itemLabel: { fontSize: 12, color: '#475569', fontWeight: '600' },
    itemValue: { fontSize: 12, color: '#1e293b', fontWeight: '700' },
    itemLabelLight: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
    itemValueLight: { fontSize: 12, color: '#f1f5f9', fontWeight: '600' },
    itemLabelHighlight: { fontSize: 13, color: '#f8fafc', fontWeight: '800' },
    itemValueHighlight: { fontSize: 13, color: '#fb923c', fontWeight: '800' },
    divider: { height: 1, backgroundColor: '#334155', marginVertical: 8 },
    footer: { flexDirection: 'row', padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    closeBtnFooter: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16, backgroundColor: '#f1f5f9', marginRight: 10 },
    closeBtnText: { fontSize: 13, fontWeight: '800', color: '#64748b' },
    printBtn: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: '#ea580c' },
    printBtnText: { fontSize: 13, fontWeight: '800', color: 'white' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#64748b', fontWeight: '600' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: '#ef4444', fontWeight: '700' }
});
