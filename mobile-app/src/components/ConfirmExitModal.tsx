import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var StyleSheet = RN.StyleSheet;
import * as Lucide from 'lucide-react-native';
var AlertTriangle = Lucide.AlertTriangle;

export default function ConfirmExitModal(props) {
    var visible = props.visible;
    var onConfirm = props.onConfirm;
    var onCancel = props.onCancel || props.onClose;

    return React.createElement(Modal, { visible: visible, transparent: true, animationType: "fade", onRequestClose: onCancel },
        React.createElement(View, { style: styles.overlay },
            React.createElement(View, { style: styles.container },
                React.createElement(Text, { style: styles.title }, props.title || "Keluar?"),
                
                React.createElement(View, { style: styles.actionsRow },
                    React.createElement(TouchableOpacity, { style: styles.cancelBtnSlim, onPress: onCancel },
                        React.createElement(Text, { style: styles.cancelText }, props.cancelText || "Batal")
                    ),
                    React.createElement(TouchableOpacity, { style: styles.confirmBtnSlim, onPress: onConfirm },
                        React.createElement(Text, { style: styles.confirmText }, props.confirmText || "Keluar")
                    )
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 30 },
    container: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '90%', maxWidth: 320, alignItems: 'center' },
    title: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
    actionsRow: { flexDirection: 'row', width: '100%' },
    cancelBtnSlim: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', marginRight: 10 },
    cancelText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
    confirmBtnSlim: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center' },
    confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});
