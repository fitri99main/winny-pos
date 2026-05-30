import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var StyleSheet = RN.StyleSheet;
var Dimensions = RN.Dimensions;
var Image = RN.Image;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as PrinterLib from '../lib/PrinterManager';
var PrinterManager = PrinterLib.PrinterManager;

export default function ReceiptPreviewModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var orderData = props.orderData;
    var onPrint = props.onPrint;

    if (!orderData) return null;

    var receipt_logo_url = orderData.receipt_logo_url;
    var show_logo = orderData.show_logo;
    var receipt_paper_width = orderData.receipt_paper_width;
    var is80mm = receipt_paper_width === '80mm';
    var paperWidth = is80mm ? 380 : 280;

    var rawText = PrinterManager.formatReceipt(orderData, true);
    
    var renderLine = function(line, index) {
        if (line.trim().toUpperCase().indexOf('[LOGO]') !== -1) {
            if (show_logo === false) return null;
            var finalLogoUrl = receipt_logo_url ? 'https://wsrv.nl/?url=' + encodeURIComponent(receipt_logo_url) + '&w=200&fit=contain&bg=white&output=png' : null;
            return React.createElement(View, { key: index, style: styles.logoContainer },
                finalLogoUrl ? React.createElement(Image, {
                    source: { uri: finalLogoUrl },
                    style: styles.receiptLogo,
                    resizeMode: "contain",
                    onError: function(e) { console.warn('Logo preview error:', e.nativeEvent.error); }
                }) : React.createElement(View, { style: styles.logoPlaceholder })
            );
        }

        if (!line.trim() && line === '') return React.createElement(View, { key: index, style: { height: 10 } });
        
        var alignment = 'left';
        var text = line;
        var isBold = false;
        var isBig = false;
        var isTall = false;

        if (text.indexOf('[BIG]') !== -1) {
            isBig = true;
            text = text.replace('[BIG]', '').replace('[/BIG]', '');
        }
        
        if (text.indexOf('[TALL]') !== -1) {
            isTall = true;
            text = text.replace('[TALL]', '').replace('[/TALL]', '');
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

        var isNote = text.trim().indexOf('(') === 0;
        var parts = text.split('[R]');
        
        return React.createElement(View, { key: index, style: [styles.lineWrapper, { justifyContent: alignment === 'center' ? 'center' : 'space-between' }] },
            parts.length > 1 ? React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' } },
                React.createElement(Text, { style: [styles.receiptText, isBold ? styles.boldText : null, isBig ? styles.bigText : null, isTall ? styles.tallText : null, isNote ? styles.noteText : null] }, parts[0]),
                React.createElement(Text, { style: [styles.receiptText, isBold ? styles.boldText : null, isBig ? styles.bigText : null, isTall ? styles.tallText : null, isNote ? styles.noteText : null] }, parts[1])
            ) : React.createElement(Text, {
                style: [
                    styles.receiptText, 
                    isBold ? styles.boldText : null,
                    isBig ? styles.bigText : null,
                    isTall ? styles.tallText : null,
                    isNote ? styles.noteText : null,
                    { textAlign: (alignment === 'center' ? 'center' : alignment === 'right' ? 'right' : 'left'), width: '100%' }
                ]
            }, text)
        );
    };

    var lines = rawText.split('\n');
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
                React.createElement(View, { style: [styles.card, { maxWidth: is80mm ? 420 : 320 }] },
                    React.createElement(View, { style: styles.header },
                        React.createElement(Text, { style: styles.headerTitle }, "Pratinjau Struk (" + (receipt_paper_width || '58mm') + ")"),
                        React.createElement(TouchableOpacity, { onPress: onClose, style: styles.closeBtn },
                            React.createElement(Text, { style: styles.closeText }, "\u2715")
                        )
                    ),
                    React.createElement(View, { style: styles.paperWrapper },
                        React.createElement(ScrollView, {
                            style: styles.previewScroll,
                            showsVerticalScrollIndicator: false,
                            contentContainerStyle: styles.receiptContainer
                        },
                            React.createElement(View, { style: [styles.receiptPaper, { width: paperWidth }] }, renderedLines)
                        ),
                        React.createElement(View, { style: [styles.jaggedEdge, { width: paperWidth }] })
                    ),
                    React.createElement(View, { style: styles.footer },
                        React.createElement(TouchableOpacity, { style: styles.cancelBtn, onPress: onClose },
                            React.createElement(Text, { style: styles.cancelBtnText }, "Batal")
                        ),
                        React.createElement(TouchableOpacity, { style: styles.printBtn, onPress: onPrint },
                            React.createElement(Text, { style: styles.printBtnText }, "\uD83D\uDDA8\uFE0F Cetak Struk")
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
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    safeArea: {
        width: '100%',
        alignItems: 'center',
    },
    card: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#f8fafc',
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
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
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    closeBtn: {
        padding: 5,
    },
    closeText: {
        fontSize: 20,
        color: '#64748b',
    },
    paperWrapper: {
        padding: 20,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
    },
    previewScroll: {
        width: '100%',
        maxHeight: Dimensions.get('window').height * 0.6,
    },
    receiptContainer: {
        paddingBottom: 20,
    },
    receiptPaper: {
        backgroundColor: '#f8fafc',
        padding: 16,
        width: '100%',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        borderRadius: 4,
    },
    lineWrapper: {
        flexDirection: 'row',
        minHeight: 18,
        alignItems: 'center',
        marginBottom: 2,
    },
    receiptText: {
        fontFamily: 'monospace',
        fontSize: 10,
        color: '#475569',
    },
    boldText: {
        fontWeight: 'bold',
        color: '#1e293b',
    },
    bigText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
        lineHeight: 24,
        marginVertical: 4,
    },
    tallText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        lineHeight: 20,
    },
    noteText: {
        color: '#ea580c',
        fontStyle: 'italic',
        fontSize: 9,
    },
    jaggedEdge: {
        height: 0,
    },
    logoContainer: {
        alignItems: 'center',
        paddingVertical: 10,
        width: '100%',
    },
    receiptLogo: {
        width: 120,
        height: 60,
    },
    logoPlaceholder: {
        width: 60,
        height: 60,
        backgroundColor: '#e2e8f0',
        borderRadius: 30,
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
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 12
    },
    cancelBtnText: {
        fontWeight: 'bold',
        color: '#64748b',
        fontSize: 15,
    },
    printBtn: {
        flex: 2,
        backgroundColor: '#ea580c',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    printBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
});

