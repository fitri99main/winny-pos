import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var TextInput = RN.TextInput;
var StyleSheet = RN.StyleSheet;
import * as Lucide from 'lucide-react-native';
var Save = Lucide.Save;
var X = Lucide.X;

export default function HoldNoteModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var onConfirm = props.onConfirm;

    var stateNote = React.useState('');
    var note = stateNote[0];
    var setNote = stateNote[1];

    var handleConfirm = function() {
        onConfirm(note);
        setNote('');
        onClose();
    };

    return React.createElement(Modal, { visible: visible, transparent: true, animationType: "fade" },
        React.createElement(View, { style: styles.overlay },
            React.createElement(View, { style: styles.container },
                React.createElement(View, { style: styles.header },
                    React.createElement(View, { style: styles.titleWrapper },
                        React.createElement(Save, { size: 20, color: "#ea580c" }),
                        React.createElement(Text, { style: styles.title }, "Simpan Pesanan")
                    ),
                    React.createElement(TouchableOpacity, { onPress: onClose },
                        React.createElement(X, { size: 24, color: "#64748b" })
                    )
                ),

                React.createElement(Text, { style: styles.label }, "Tambahkan catatan (opsional):"),
                React.createElement(TextInput, {
                    style: styles.input,
                    placeholder: "Contoh: Meja 5, Bungkus, dll",
                    value: note,
                    onChangeText: setNote,
                    multiline: true,
                    numberOfLines: 3,
                    autoFocus: true
                }),

                React.createElement(TouchableOpacity, { style: styles.confirmBtn, onPress: handleConfirm },
                    React.createElement(Text, { style: styles.confirmText }, "Simpan Pesanan")
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    container: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    titleWrapper: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginLeft: 8 },
    label: { fontSize: 14, color: '#64748b', marginBottom: 12 },
    input: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 16, fontSize: 16, textAlignVertical: 'top', height: 100, marginBottom: 24 },
    confirmBtn: { backgroundColor: '#ea580c', padding: 16, borderRadius: 12, alignItems: 'center' },
    confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
