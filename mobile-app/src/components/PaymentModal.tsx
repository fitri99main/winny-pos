import React from 'react';
import * as RN from 'react-native';

var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var TextInput = RN.TextInput;
var ScrollView = RN.ScrollView;
var StyleSheet = RN.StyleSheet;
var Alert = RN.Alert;
var useWindowDimensions = RN.useWindowDimensions;
var ActivityIndicator = RN.ActivityIndicator;

var DEFAULT_METHODS = [
    { id: 'cash', name: 'Tunai', icon: '💵', color: '#10b981', type: 'cash' },
    { id: 'qris', name: 'QRIS', icon: '📱', color: '#f59e0b', type: 'digital' },
    { id: 'debit', name: 'Debit', icon: '💳', color: '#3b82f6', type: 'card' }
];

var getMethodIconAndColor = function(type) {
    switch (type) {
        case 'cash': return { icon: '💵', color: '#10b981' };
        case 'card': return { icon: '💳', color: '#3b82f6' };
        case 'digital': return { icon: '📱', color: '#f59e0b' };
        default: return { icon: '📝', color: '#6366f1' };
    }
};

export default function PaymentModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var total = props.total;
    var subtotal = props.subtotal;
    var tax = props.tax;
    var serviceCharge = props.serviceCharge;
    var discount = props.discount;
    var onConfirm = props.onConfirm;
    var onManualItem = props.onManualItem;
    var onDiscount = props.onDiscount;
    var onSplitBill = props.onSplitBill;
    var onHold = props.onHold;
    var paymentMethods = props.paymentMethods;

    var windowSize = useWindowDimensions();
    var width = windowSize.width;
    var isSmallDevice = width < 380;
    
    var displayMethods = [];
    if (paymentMethods && paymentMethods.length > 0) {
        for (var i = 0; i < paymentMethods.length; i++) {
            var m = paymentMethods[i];
            var styles_icon_color = getMethodIconAndColor(m.type);
            displayMethods.push({
                id: String(m.id || m.name),
                name: m.name,
                type: m.type,
                icon: styles_icon_color.icon,
                color: styles_icon_color.color
            });
        }
    } else {
        displayMethods = DEFAULT_METHODS;
    }

    var stateSelectedMethod = React.useState(displayMethods[0] ? displayMethods[0].id : 'cash');
    var selectedMethod = stateSelectedMethod[0];
    var setSelectedMethod = stateSelectedMethod[1];

    var statePaidAmount = React.useState('');
    var paidAmount = statePaidAmount[0];
    var setPaidAmount = statePaidAmount[1];

    var stateChange = React.useState(0);
    var change = stateChange[0];
    var setChange = stateChange[1];

    var stateError = React.useState(null);
    var error = stateError[0];
    var setError = stateError[1];

    var stateLoading = React.useState(false);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    React.useEffect(function() {
        var paidValue = parseFloat(paidAmount.replace(/,/g, '')) || 0;
        var changeAmount = paidValue - total;
        setChange(changeAmount >= 0 ? changeAmount : 0);
        if (error) setError(null);
    }, [paidAmount, total]);

    React.useEffect(function() {
        if (visible) {
            setSelectedMethod(displayMethods[0] ? displayMethods[0].id : 'cash');
            setPaidAmount('');
            setChange(0);
            setError(null);
            setLoading(false);
        }
    }, [visible]);

    var handleNumberPad = function(value) {
        if (value === 'C') {
            setPaidAmount('');
        } else if (value === '⌫') {
            setPaidAmount(function(prev) { return prev.slice(0, -1); });
        } else {
            setPaidAmount(function(prev) { return prev + value; });
        }
    };

    var handleQuickAmount = function(amount) {
        setPaidAmount((amount || 0).toString());
    };

    var paid = parseFloat(paidAmount.replace(/,/g, '')) || 0;
    
    var selectedObj = null;
    for (var j = 0; j < displayMethods.length; j++) {
        if (displayMethods[j].id === selectedMethod) {
            selectedObj = displayMethods[j];
            break;
        }
    }

    var isCashType = selectedObj ? (selectedObj.type === 'cash' || selectedMethod === 'cash') : false;

    var handleConfirm = function() {
        if (isCashType && paid < total) {
            setError('Jumlah pembayaran kurang dari total');
            return;
        }

        if (loading) return; // Prevent double-tap

        setLoading(true);
        setError(null);

        var timeoutId = setTimeout(function() {
            setLoading(false);
            setError('Koneksi lambat: Transaksi sedang diproses di server. Harap tunggu sebentar atau cek riwayat pesanan.');
        }, 18000);

        var paymentData = {
            method: selectedObj ? selectedObj.name : 'Tunai',
            amount: paid || total,
            change: isCashType ? change : 0
        };

        try {
            var promise = onConfirm(paymentData);

            if (promise && typeof promise.then === 'function') {
                promise.then(function() {
                    clearTimeout(timeoutId);
                    setLoading(false);
                })['catch'](function(err) {
                    clearTimeout(timeoutId);
                    setError(err && err.message ? err.message : 'Gagal memproses pembayaran');
                    setLoading(false);
                });
            } else {
                clearTimeout(timeoutId);
                setLoading(false);
            }
        } catch (syncErr) {
            clearTimeout(timeoutId);
            setError(syncErr && syncErr.message ? syncErr.message : 'Terjadi kesalahan sinkron');
            setLoading(false);
        }
    };

    var formatCurrency = function(amount) {
        var valNum = Math.floor(Number(amount));
        return 'Rp ' + valNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    var renderedMethods = displayMethods.map(function(method) {
        return React.createElement(TouchableOpacity, {
            key: method.id,
            style: [
                styles.methodButton,
                isSmallDevice ? { minWidth: '48%', paddingVertical: 8 } : null,
                selectedMethod === method.id ? {
                    backgroundColor: method.color,
                    borderColor: method.color
                } : null
            ],
            onPress: function() { setSelectedMethod(method.id); }
        },
            React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                React.createElement(Text, { style: [styles.methodIcon, isSmallDevice ? { fontSize: 18, marginBottom: 0 } : null, { marginRight: 6 }] }, method.icon),
                React.createElement(Text, { style: [styles.methodName, selectedMethod === method.id ? styles.methodNameActive : null] }, method.name)
            )
        );
    });

    var renderedQuickAmounts = [total, 50000, 100000, 200000].map(function(amount) {
        return React.createElement(TouchableOpacity, {
            key: amount,
            style: styles.quickButton,
            onPress: function() { handleQuickAmount(amount); }
        },
            React.createElement(Text, { style: styles.quickButtonText }, formatCurrency(amount))
        );
    });

    var renderedNumberPad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '\u232B'].map(function(num) {
        return React.createElement(TouchableOpacity, {
            key: num,
            style: [styles.numberButton, isSmallDevice ? { height: 42, borderRadius: 10 } : null],
            onPress: function() { handleNumberPad(num === '\u232B' ? '⌫' : num); }
        },
            React.createElement(Text, { style: [styles.numberText, isSmallDevice ? { fontSize: 16 } : null] }, num)
        );
    });

    return React.createElement(Modal, { visible: visible, transparent: true, animationType: "slide", onRequestClose: onClose },
        React.createElement(View, { style: styles.overlay },
            React.createElement(View, { style: styles.container },
                React.createElement(View, { style: styles.header },
                    React.createElement(Text, { style: styles.title }, "Pembayaran"),
                    React.createElement(TouchableOpacity, { onPress: onClose, style: styles.closeButton },
                        React.createElement(Text, { style: styles.closeText }, "\u2715")
                    )
                ),
                React.createElement(ScrollView, { showsVerticalScrollIndicator: false },
                    React.createElement(View, { style: [styles.totalSection, isSmallDevice ? { padding: 12, margin: 12, marginBottom: 4 } : null] },
                        React.createElement(View, { style: { width: '100%', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8 } },
                            React.createElement(View, { style: styles.breakdownRow },
                                React.createElement(Text, { style: styles.breakdownLabel }, "Subtotal"),
                                React.createElement(Text, { style: styles.breakdownValue }, formatCurrency(subtotal || 0))
                            ),
                            (serviceCharge || 0) > 0 ? React.createElement(View, { style: styles.breakdownRow },
                                React.createElement(Text, { style: styles.breakdownLabel }, "Layanan"),
                                React.createElement(Text, { style: styles.breakdownValue }, "+" + formatCurrency(serviceCharge || 0))
                            ) : null,
                            (tax || 0) > 0 ? React.createElement(View, { style: styles.breakdownRow },
                                React.createElement(Text, { style: styles.breakdownLabel }, "Pajak"),
                                React.createElement(Text, { style: styles.breakdownValue }, "+" + formatCurrency(tax || 0))
                            ) : null,
                            (discount || 0) > 0 ? React.createElement(View, { style: styles.breakdownRow },
                                React.createElement(Text, { style: styles.breakdownLabel }, "Diskon"),
                                React.createElement(Text, { style: [styles.breakdownValue, { color: '#ef4444' }] }, "-" + formatCurrency(discount || 0))
                            ) : null
                        ),
                        React.createElement(Text, { style: styles.totalLabel }, "Total Pembayaran"),
                        React.createElement(Text, { style: [styles.totalAmount, isSmallDevice ? { fontSize: 22 } : null] }, formatCurrency(total))
                    ),
                    React.createElement(View, { style: [styles.paymentActionsRow, isSmallDevice ? { paddingHorizontal: 12, paddingBottom: 8 } : null] },
                        React.createElement(TouchableOpacity, { style: [styles.payActionBtn, { marginRight: (isSmallDevice ? 6 : 8) }], onPress: onManualItem },
                            React.createElement(Text, { style: [styles.payActionIcon, isSmallDevice ? { fontSize: 14 } : null] }, "\u2795"),
                            React.createElement(Text, { style: styles.payActionText }, "Manual")
                        ),
                        React.createElement(TouchableOpacity, { style: [styles.payActionBtn, { marginRight: (isSmallDevice ? 6 : 8) }], onPress: onDiscount },
                            React.createElement(Text, { style: [styles.payActionIcon, isSmallDevice ? { fontSize: 14 } : null] }, "\uD83C\uDFF7\uFE0F"),
                            React.createElement(Text, { style: styles.payActionText }, "Diskon")
                        ),
                        React.createElement(TouchableOpacity, { style: [styles.payActionBtn, { marginRight: (isSmallDevice ? 6 : 8) }], onPress: onSplitBill },
                            React.createElement(Text, { style: [styles.payActionIcon, isSmallDevice ? { fontSize: 14 } : null] }, "\u2702\uFE0F"),
                            React.createElement(Text, { style: styles.payActionText }, "Split")
                        ),
                        props.canHold !== false && React.createElement(TouchableOpacity, { style: [styles.payActionBtn, { marginRight: (isSmallDevice ? 6 : 8) }], onPress: onHold },
                            React.createElement(Text, { style: [styles.payActionIcon, isSmallDevice ? { fontSize: 14 } : null] }, "\u23F8\uFE0F"),
                            React.createElement(Text, { style: styles.payActionText }, "Hold")
                        ),
                        React.createElement(TouchableOpacity, { style: [styles.payActionBtn, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }], onPress: props.onPreview },
                            React.createElement(Text, { style: [styles.payActionIcon, isSmallDevice ? { fontSize: 14 } : null] }, "\uD83D\uDCC4"),
                            React.createElement(Text, { style: [styles.payActionText, { color: '#166534' }] }, "Preview")
                        )
                    ),
                    React.createElement(View, { style: [styles.section, isSmallDevice ? { paddingHorizontal: 12 } : null] },
                        React.createElement(Text, { style: styles.sectionTitle }, "Metode Pembayaran"),
                        React.createElement(View, { style: [styles.methodsGrid] }, renderedMethods)
                    ),
                    isCashType ? React.createElement(View, { style: styles.section },
                        React.createElement(Text, { style: styles.sectionTitle }, "Jumlah Dibayar"),
                        React.createElement(TextInput, {
                            style: styles.amountInput,
                            value: paidAmount,
                            onChangeText: setPaidAmount,
                            keyboardType: "numeric",
                            placeholder: "0",
                            placeholderTextColor: "#9ca3af"
                        }),
                        React.createElement(View, { style: styles.quickAmounts }, renderedQuickAmounts),
                        change > 0 ? React.createElement(View, { style: styles.changeSection },
                            React.createElement(Text, { style: styles.changeLabel }, "Kembalian"),
                            React.createElement(Text, { style: styles.changeAmount }, formatCurrency(change))
                        ) : null
                    ) : null,
                    isCashType ? React.createElement(View, { style: [styles.numberPad, isSmallDevice ? { padding: 12 } : null] }, renderedNumberPad) : null
                ),
                error ? React.createElement(View, { style: [styles.errorBanner, { marginHorizontal: 16, marginBottom: 8 }] },
                    React.createElement(Text, { style: styles.errorText }, "\u26A0\uFE0F " + error),
                    React.createElement(TouchableOpacity, { 
                        style: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 16, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' },
                        onPress: function() { setError(null); setLoading(false); }
                    },
                        React.createElement(Text, { style: { fontSize: 12, fontWeight: 'bold', color: '#dc2626' } }, "Coba Lagi")
                    )
                ) : null,
                React.createElement(TouchableOpacity, {
                    style: [
                        styles.confirmButton,
                        { backgroundColor: (selectedObj ? selectedObj.color : '#10b981') },
                        (loading || (isCashType && paid < total)) ? { opacity: 0.6 } : null
                    ],
                    onPress: handleConfirm,
                    disabled: loading || (isCashType && paid < total)
                },
                    loading ? React.createElement(ActivityIndicator, { color: "white", size: "small" }) : React.createElement(Text, { style: styles.confirmText }, "Konfirmasi Pembayaran")
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: 20 },
    container: { backgroundColor: '#fff', borderRadius: 24, maxHeight: '90%', maxWidth: 500, width: '100%', alignSelf: 'center', overflow: 'hidden', paddingBottom: 10 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    paymentActionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
    payActionBtn: { flex: 1, backgroundColor: '#f8fafc', paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    payActionIcon: { fontSize: 16, marginBottom: 2 },
    payActionText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
    closeText: { fontSize: 18, color: '#6b7280' },
    totalSection: { padding: 16, backgroundColor: '#f9fafb', borderRadius: 16, margin: 16, marginBottom: 8, alignItems: 'center' },
    totalLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
    totalAmount: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
    section: { paddingHorizontal: 16, paddingBottom: 12 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    methodsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    methodButton: { flex: 1, minWidth: '30%', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center', margin: 4 },
    methodIcon: { fontSize: 24, marginBottom: 4 },
    methodName: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
    methodNameActive: { color: '#fff' },
    amountInput: { fontSize: 24, fontWeight: 'bold', color: '#111827', padding: 12, borderRadius: 12, backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', textAlign: 'center' },
    quickAmounts: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
    quickButton: { flex: 1, minWidth: '22%', padding: 12, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', margin: 4 },
    quickButtonText: { fontSize: 11, fontWeight: '600', color: '#374151' },
    changeSection: { marginTop: 16, padding: 16, borderRadius: 12, backgroundColor: '#dcfce7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    changeLabel: { fontSize: 16, fontWeight: '600', color: '#166534' },
    changeAmount: { fontSize: 24, fontWeight: 'bold', color: '#166534' },
    numberPad: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, paddingTop: 0 },
    numberButton: { width: '31%', height: 50, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', margin: '1%' },
    numberText: { fontSize: 20, fontWeight: '600', color: '#374151' },
    confirmButton: { margin: 16, marginTop: 4, padding: 14, borderRadius: 12, alignItems: 'center' },
    confirmText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    errorBanner: { marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fee2e2', alignItems: 'center' },
    errorText: { fontSize: 13, color: '#dc2626', fontWeight: '600' },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, width: '100%' },
    breakdownLabel: { fontSize: 12, color: '#64748b' },
    breakdownValue: { fontSize: 12, fontWeight: 'bold', color: '#1e293b' },
});

