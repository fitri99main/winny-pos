import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var StyleSheet = RN.StyleSheet;

export default function HeldOrdersModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var orders = props.orders || [];
    var onRestore = props.onRestore;
    var onDelete = props.onDelete;
    var onRefresh = props.onRefresh;
    var isRefreshing = props.isRefreshing;

    var formatCurrency = function(val) {
        if (val === undefined || val === null) return 'Rp 0';
        var num = Math.floor(Number(val));
        return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    var formatTime = function(date) {
        try {
            var d = new Date(date);
            var h = d.getHours().toString();
            if (h.length < 2) h = '0' + h;
            var m = d.getMinutes().toString();
            if (m.length < 2) m = '0' + m;
            return h + ':' + m;
        } catch (e) {
            return '--:--';
        }
    };

    var renderedOrders = [];
    if (orders.length === 0) {
        renderedOrders.push(
            React.createElement(View, { key: "empty", style: styles.empty },
                React.createElement(Text, { style: styles.emptyIcon }, "\u23F0"),
                React.createElement(Text, { style: styles.emptyText }, "Tidak ada pesanan ditangguhkan")
            )
        );
    } else {
        for (var i = 0; i < orders.length; i++) {
            (function() {
                var order = orders[i];
                var orderIdLabel = order.isRemote ? "☁️ Remote #" + (order.orderNo || order.id).slice(-4) : "📝 Draft #" + order.id.slice(-4);
                
                renderedOrders.push(
                    React.createElement(View, { key: order.id, style: [styles.orderCard, order.isRemote ? styles.remoteCard : null] },
                        React.createElement(View, { style: styles.orderHeader },
                            React.createElement(View, { style: { flex: 1 } },
                                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                                    React.createElement(Text, { style: styles.orderId }, orderIdLabel),
                                    order.isRemote ? React.createElement(View, { style: [styles.remoteBadge, { marginLeft: 6 }] },
                                        React.createElement(Text, { style: styles.remoteBadgeText }, "UNPAID")
                                    ) : null
                                ),
                                React.createElement(Text, { style: styles.orderTime }, formatTime(order.createdAt) + " - " + (order.isRemote ? 'Cloud Sync' : (order.items ? order.items.length : 0) + " item")),
                                React.createElement(Text, { style: styles.orderTable }, "Meja: " + (order.tableNo || '-')),
                                order.note ? React.createElement(Text, { style: styles.orderNote }, "Catatan: " + order.note) : null
                            ),
                            React.createElement(Text, { style: styles.orderTotal }, formatCurrency(order.total))
                        ),
                        React.createElement(View, { style: styles.actions },
                            React.createElement(TouchableOpacity, {
                                style: [styles.restoreBtn, order.isRemote ? styles.remoteRestoreBtn : null],
                                onPress: function() { onRestore(order); }
                            },
                                React.createElement(Text, { style: styles.restoreText }, order.isRemote ? '⚡ Terima & Bayar' : '▶ Kembalikan')
                            ),
                            onDelete ? React.createElement(TouchableOpacity, { style: [styles.deleteBtn, { marginLeft: 12 }], onPress: function() { onDelete(order.id); } },
                                React.createElement(Text, { style: styles.deleteText }, "\uD83D\uDDD1\uFE0F")
                            ) : null
                        )
                    )
                );
            })();
        }
    }

    return React.createElement(Modal, { visible: visible, transparent: true, animationType: "slide", onRequestClose: onClose },
        React.createElement(View, { style: styles.overlay },
            React.createElement(View, { style: styles.container },
                React.createElement(View, { style: styles.header },
                    React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                        React.createElement(Text, { style: styles.title }, "Pesanan Ditangguhkan"),
                        onRefresh ? React.createElement(TouchableOpacity, { onPress: onRefresh, style: [styles.refreshBtn, { marginLeft: 12 }], disabled: isRefreshing },
                            React.createElement(Text, { style: styles.refreshIcon }, isRefreshing ? "\u23F3" : "\uD83D\uDD04")
                        ) : null
                    ),
                    React.createElement(TouchableOpacity, { onPress: onClose },
                        React.createElement(Text, { style: styles.closeIcon }, "\u2715")
                    )
                ),
                React.createElement(ScrollView, { style: styles.content }, renderedOrders)
            )
        )
    );
}

var styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    refreshBtn: { padding: 4, backgroundColor: '#f3f4f6', borderRadius: 8 },
    refreshIcon: { fontSize: 16 },
    closeIcon: { fontSize: 20, color: '#6b7280' },
    content: { padding: 20 },
    empty: { padding: 40, alignItems: 'center' },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { color: '#6b7280', fontSize: 14 },
    orderCard: { backgroundColor: '#f9fafb', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f3f4f6' },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    orderId: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
    orderTime: { fontSize: 11, color: '#6b7280', marginTop: 2 },
    orderTable: { fontSize: 11, fontWeight: 'bold', color: '#ea580c', marginTop: 2 },
    orderNote: { fontSize: 11, color: '#4b5563', fontStyle: 'italic', marginTop: 2 },
    orderTotal: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    actions: { flexDirection: 'row' },
    restoreBtn: { flex: 1, backgroundColor: '#0d9488', padding: 12, borderRadius: 8, alignItems: 'center' },
    restoreText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    deleteBtn: { width: 44, height: 44, backgroundColor: '#fee2e2', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    deleteText: { fontSize: 16 },
    remoteCard: { borderColor: '#0d9488', borderLeftWidth: 4 },
    remoteBadge: { backgroundColor: '#0d9488', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    remoteBadgeText: { color: 'white', fontSize: 8, fontWeight: 'bold' },
    remoteRestoreBtn: { backgroundColor: '#ea580c' }
});

