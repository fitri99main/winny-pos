import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var TextInput = RN.TextInput;
var StyleSheet = RN.StyleSheet;
import * as Lucide from 'lucide-react-native';
var Plus = Lucide.Plus;
var X = Lucide.X;

export default function ManualItemModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var onAdd = props.onAdd;

    var stateName = React.useState('');
    var name = stateName[0];
    var setName = stateName[1];

    var statePrice = React.useState('');
    var price = statePrice[0];
    var setPrice = statePrice[1];

    var handleAdd = function() {
        if (!name || !price) return;
        
        onAdd({
            id: 'manual-' + Date.now(),
            name: name,
            price: Number(price),
            category: 'Manual',
            is_manual: true
        });

        setName('');
        setPrice('');
        onClose();
    };

    return React.createElement(Modal, { visible: visible, transparent: true, animationType: "fade" },
        React.createElement(View, { style: styles.overlay },
            React.createElement(View, { style: styles.container },
                React.createElement(View, { style: styles.header },
                    React.createElement(View, { style: styles.titleWrapper },
                        React.createElement(Plus, { size: 20, color: "#ea580c" }),
                        React.createElement(Text, { style: styles.title }, "Item Manual")
                    ),
                    React.createElement(TouchableOpacity, { onPress: onClose },
                        React.createElement(X, { size: 24, color: "#64748b" })
                    )
                ),

                React.createElement(TextInput, {
                    style: styles.input,
                    placeholder: "Nama Item (contoh: Parkir)",
                    value: name,
                    onChangeText: setName
                }),

                React.createElement(TextInput, {
                    style: styles.input,
                    placeholder: "Harga (Rp)",
                    keyboardType: "numeric",
                    value: price,
                    onChangeText: setPrice
                }),

                React.createElement(TouchableOpacity, { style: styles.addBtn, onPress: handleAdd },
                    React.createElement(Text, { style: styles.addText }, "Tambah ke Keranjang")
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
    input: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
    addBtn: { backgroundColor: '#ea580c', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    addText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
