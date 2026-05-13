import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var StyleSheet = RN.StyleSheet;
var Dimensions = RN.Dimensions;
var Platform = RN.Platform;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as PrinterLib from '../lib/PrinterManager';
var PrinterManager = PrinterLib.PrinterManager;

export default function ShiftSummaryPreviewModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var data = props.data;
    var onPrint = props.onPrint;

    if (!data) return null;

    var paperWidthStr = (data && data.paperWidth === 48) ? '80mm' : '58mm';
    var paperWidth = (data && data.paperWidth === 48) ? 380 : 280;

    var rawText = PrinterManager.formatSalesReport(data, true);
    
    var renderLine = function(line, index) {
        if (!line.trim() && line === '') return React.createElement(View, { key: index, style: { height: 10 } });
        
        var alignment = 'left';
        var text = line;
        var isBold = false;
        var isBig = false;

        if (text.indexOf('[BIG]') !== -1) {
            isBig = true;
            text = text.replace('[BIG]', '').replace('[/BIG]', '');
        }

        if (text.indexOf('[C]') === 0) {
            alignment = 'center';
            text = text.substring(3);
        } else if (text.indexOf('[L]') === 0) {
            alignment = 'left';
            text = text.substring(3);
        } else if (text.indexOf('[R]') === 0) {
            alignment = 'right';
            text = text.substring(3);
        }

        if (text.indexOf('<b>') !== -1) {
            isBold = true;
            text = text.replace('<b>', '').replace('</b>', '');
        }

        var parts = text.split('[R]');
        
        return React.createElement(View, { key: index, style: [styles.lineWrapper, { justifyContent: alignment === 'center' ? 'center' : 'space-between' }] },
            parts.length > 1 ? React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' } },
                React.createElement(Text, { style: [styles.receiptText, isBold ? styles.boldText : null, isBig ? styles.bigText : null] }, parts[0]),
                React.createElement(Text, { style: [styles.receiptText, isBold ? styles.boldText : null, isBig ? styles.bigText : null] }, parts[1])
            ) : React.createElement(Text, {
                style: [
                    styles.receiptText, 
                    isBold ? styles.boldText : null,
                    isBig ? styles.bigText : null,
                    { textAlign: alignment, width: '100%' }
                ]
            }, text)
        );
    };

    var lines = (rawText || "").split('\n');
    var renderedLines = [];
    for (var i = 0; i < lines.length; i++) {
        renderedLines.push(renderLine(lines[i], i));
    }

    return React.createElement(Modal, {
        visible: visible,
        transparent: true,
        animationType: "fade",
        onRequestClose: onClose
    },
        React.createElement(View, { style: styles.overlay },
            React.createElement(SafeAreaView, { style: styles.safeArea },
                React.createElement(View, { style: styles.card },
                    React.createElement(View, { style: styles.header },
                        React.createElement(View, { style: styles.titleWrapper },
                            React.createElement(Text, { style: styles.headerTitle }, "Pratinjau Struk (" + String(paperWidthStr) + ")")
                        ),
                        React.createElement(TouchableOpacity, { onPress: onClose, style: styles.closeBtn },
                            React.createElement(Text, { style: { fontSize: 24, color: '#94a3b8' } }, "\u2715")
                        )
                    ),
                    React.createElement(View, { style: styles.paperWrapper },
                        React.createElement(ScrollView, {
                            style: styles.previewScroll,
                            showsVerticalScrollIndicator: false,
                            contentContainerStyle: styles.receiptContainer
                        },
                            React.createElement(View, { style: [styles.receiptPaper, { width: paperWidth }] }, renderedLines)
                        )
                    ),
                    React.createElement(View, { style: styles.footer },
                        React.createElement(TouchableOpacity, { style: styles.cancelBtn, onPress: onClose },
                            React.createElement(Text, { style: styles.cancelBtnText }, "Kembali")
                        ),
                        React.createElement(TouchableOpacity, { style: [styles.printBtn, { marginLeft: 12 }], onPress: onPrint },
                            React.createElement(Text, { style: styles.printBtnText }, "Cetak Struk")
                        )
                    )
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    safeArea: {
        width: '100%',
        alignItems: 'center',
    },
    card: {
        width: '90%',
        maxWidth: 420,
        backgroundColor: '#f8fafc',
        borderRadius: 28,
        overflow: 'hidden',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    titleWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
        marginLeft: 10
    },
    closeBtn: {
        padding: 4,
    },
    paperWrapper: {
        padding: 20,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    previewScroll: {
        width: '100%',
        maxHeight: Dimensions.get('window').height * 0.65,
    },
    receiptContainer: {
        paddingBottom: 20,
    },
    receiptPaper: {
        backgroundColor: 'white',
        padding: 20,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    lineWrapper: {
        flexDirection: 'row',
        minHeight: 18,
        alignItems: 'center',
        marginBottom: 1,
    },
    receiptText: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 11,
        color: '#334155',
        lineHeight: 16,
    },
    boldText: {
        fontWeight: 'bold',
        color: '#0f172a',
    },
    bigText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#000',
        lineHeight: 24,
        marginVertical: 4,
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
    },
    cancelBtnText: {
        fontWeight: '800',
        color: '#64748b',
        fontSize: 14,
    },
    printBtn: {
        flex: 1.5,
        backgroundColor: '#ea580c',
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    printBtnText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 14,
    },
});
