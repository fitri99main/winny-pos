import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var StyleSheet = RN.StyleSheet;

export default function SplitBillModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var items = props.items || [];
    var onSplit = props.onSplit;
    var orderDiscount = props.orderDiscount || 0;
    var totalSubtotal = props.totalSubtotal || 0;

    var stateSelectedQuantities = React.useState({});
    var selectedQuantities = stateSelectedQuantities[0];
    var setSelectedQuantities = stateSelectedQuantities[1];

    React.useEffect(function() {
        if (visible) {
            setSelectedQuantities({});
        }
    }, [visible]);

    var handleQtyChange = function(itemId, maxQty, delta) {
        var current = selectedQuantities[itemId] || 0;
        var next = Math.max(0, Math.min(maxQty, current + delta));
        var newSelected = {};
        for (var key in selectedQuantities) {
            newSelected[key] = selectedQuantities[key];
        }
        newSelected[itemId] = next;
        setSelectedQuantities(newSelected);
    };

    var getSplitItems = function() {
        var ratio = totalSubtotal > 0 ? (totalSubtotal - orderDiscount) / totalSubtotal : 1;
        var filtered = items.filter(function(item) {
            return (selectedQuantities[item.id] || 0) > 0;
        });
        return filtered.map(function(item) {
            var newItem = {};
            for (var key in item) { newItem[key] = item[key]; }
            newItem.original_price = item.price;
            newItem.price = Math.round(item.price * ratio);
            newItem.quantity = selectedQuantities[item.id];
            return newItem;
        });
    };

    var calculateSplitTotal = function() {
        var splitItems = getSplitItems();
        var sum = 0;
        for (var i = 0; i < splitItems.length; i++) {
            sum += splitItems[i].price * splitItems[i].quantity;
        }
        return sum;
    };

    var formatCurrency = function(val) {
        if (val === undefined || val === null) return 'Rp 0';
        var num = Math.floor(Number(val));
        return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    var renderedItems = items.map(function(item) {
        var ratio = totalSubtotal > 0 ? (totalSubtotal - orderDiscount) / totalSubtotal : 1;
        var discountedPrice = Math.round(item.price * ratio);
        
        return React.createElement(View, { key: item.id, style: styles.itemRow },
            React.createElement(View, { style: styles.itemInfo },
                React.createElement(Text, { style: styles.itemName }, item.name),
                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                    orderDiscount > 0 ? React.createElement(Text, { style: [styles.itemPrice, { textDecorationLine: 'line-through', opacity: 0.6 }] },
                        formatCurrency(item.price)
                    ) : null,
                    React.createElement(Text, { style: [styles.itemPrice, { marginLeft: orderDiscount > 0 ? 6 : 0 }] }, formatCurrency(discountedPrice)),
                    React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', marginLeft: 6 } }, "(Tersedia: " + item.quantity + ")")
                )
            ),
            React.createElement(View, { style: styles.controls },
                React.createElement(TouchableOpacity, {
                    style: styles.controlBtn,
                    onPress: function() { handleQtyChange(item.id, item.quantity, -1); }
                },
                    React.createElement(Text, { style: styles.controlText }, "-")
                ),
                React.createElement(Text, { style: [styles.qtyText, { marginHorizontal: 12 }] }, selectedQuantities[item.id] || 0),
                React.createElement(TouchableOpacity, {
                    style: styles.controlBtn,
                    onPress: function() { handleQtyChange(item.id, item.quantity, 1); }
                },
                    React.createElement(Text, { style: styles.controlText }, "+")
                )
            )
        );
    });

    return React.createElement(Modal, { visible: visible, transparent: true, animationType: "slide", onRequestClose: onClose },
        React.createElement(View, { style: styles.overlay },
            React.createElement(View, { style: styles.container },
                React.createElement(View, { style: styles.header },
                    React.createElement(Text, { style: styles.title }, "Pisah Tagihan"),
                    React.createElement(TouchableOpacity, { onPress: onClose },
                        React.createElement(Text, { style: styles.closeIcon }, "\u2715")
                    )
                ),
                React.createElement(ScrollView, { style: styles.content }, renderedItems),
                React.createElement(View, { style: styles.footer },
                    React.createElement(View, { style: styles.totalRow },
                        React.createElement(Text, { style: styles.totalLabel }, "Total Terpisah"),
                        React.createElement(Text, { style: styles.totalValue }, formatCurrency(calculateSplitTotal()))
                    ),
                    React.createElement(TouchableOpacity, {
                        style: [styles.payBtn, calculateSplitTotal() === 0 ? styles.disabledBtn : null],
                        disabled: calculateSplitTotal() === 0,
                        onPress: function() {
                            onSplit(getSplitItems());
                            onClose();
                        }
                    },
                        React.createElement(Text, { style: styles.payBtnText }, "Bayar Item Terpilih")
                    )
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    closeIcon: { fontSize: 20, color: '#6b7280' },
    content: { padding: 20 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#f9fafb', padding: 12, borderRadius: 12 },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
    itemPrice: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    controls: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 4, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
    controlBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    controlText: { fontSize: 18, fontWeight: 'bold' },
    qtyText: { fontSize: 14, fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    totalLabel: { fontSize: 14, color: '#6b7280', fontWeight: 'bold' },
    totalValue: { fontSize: 20, fontWeight: 'bold', color: '#ea580c' },
    payBtn: { backgroundColor: '#0d9488', padding: 16, borderRadius: 12, alignItems: 'center' },
    payBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    disabledBtn: { opacity: 0.5 }
});

