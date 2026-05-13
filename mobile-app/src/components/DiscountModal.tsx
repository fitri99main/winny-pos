import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var TextInput = RN.TextInput;
var StyleSheet = RN.StyleSheet;
import * as Lucide from 'lucide-react-native';
var Tag = Lucide.Tag;
var X = Lucide.X;

export default function DiscountModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var onApply = props.onApply;
    var subtotal = props.currentTotal || props.subtotal || 0;

    var stateType = React.useState('percentage'); // 'percentage' or 'amount'
    var type = stateType[0];
    var setType = stateType[1];

    var stateValue = React.useState('');
    var value = stateValue[0];
    var setValue = stateValue[1];

    var handleApply = function() {
        var val = Number(value);
        if (isNaN(val) || val <= 0) {
            onApply({ type: type, value: 0 });
            onClose();
            return;
        }

        onApply({ type: type, value: val });
        onClose();
    };

    return React.createElement(Modal, { visible: visible, transparent: true, animationType: "fade" },
        React.createElement(View, { style: styles.overlay },
            React.createElement(View, { style: styles.container },
                React.createElement(View, { style: styles.header },
                    React.createElement(View, { style: styles.titleWrapper },
                        React.createElement(Tag, { size: 20, color: "#ea580c" }),
                        React.createElement(Text, { style: styles.title }, "Tambah Diskon")
                    ),
                    React.createElement(TouchableOpacity, { onPress: onClose },
                        React.createElement(X, { size: 24, color: "#64748b" })
                    )
                ),

                React.createElement(View, { style: styles.typeSelector },
                    React.createElement(TouchableOpacity, {
                        style: [styles.typeBtn, type === 'percentage' && styles.typeBtnActive],
                        onPress: function() { setType('percentage'); }
                    },
                        React.createElement(Text, { style: [styles.typeText, type === 'percentage' && styles.typeTextActive] }, "Persen (%)")
                    ),
                    React.createElement(TouchableOpacity, {
                        style: [styles.typeBtn, type === 'amount' && styles.typeBtnActive],
                        onPress: function() { setType('amount'); }
                    },
                        React.createElement(Text, { style: [styles.typeText, type === 'amount' && styles.typeTextActive] }, "Nominal (Rp)")
                    )
                ),

                React.createElement(TextInput, {
                    style: styles.input,
                    placeholder: type === 'percentage' ? "0%" : "Rp 0",
                    keyboardType: "numeric",
                    value: value,
                    onChangeText: setValue,
                    autoFocus: true
                }),

                React.createElement(TouchableOpacity, { style: styles.applyBtn, onPress: handleApply },
                    React.createElement(Text, { style: styles.applyText }, "Terapkan Diskon")
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    container: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    titleWrapper: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginLeft: 8 },
    typeSelector: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20 },
    typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    typeBtnActive: { backgroundColor: '#fff', elevation: 2 },
    typeText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
    typeTextActive: { color: '#ea580c' },
    input: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 16, fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
    applyBtn: { backgroundColor: '#ea580c', padding: 16, borderRadius: 12, alignItems: 'center' },
    applyText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
