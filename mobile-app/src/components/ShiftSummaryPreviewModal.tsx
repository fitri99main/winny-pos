import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrinterManager } from '../lib/PrinterManager';
import { X, Printer, Eye } from 'lucide-react-native';

interface ShiftSummaryPreviewModalProps {
    visible: boolean;
    onClose: () => void;
    data: any;
    onPrint: () => void;
}

export default function ShiftSummaryPreviewModal({ visible, onClose, data, onPrint }: ShiftSummaryPreviewModalProps) {
    if (!data) return null;

    const paperWidthStr = data.paperWidth === 48 ? '80mm' : '58mm';
    const paperWidth = data.paperWidth === 48 ? 380 : 280;

    const rawText = PrinterManager.formatSalesReport(data, true);
    
    const renderLine = (line: string, index: number) => {
        if (!line.trim() && line === '') return <View key={index} style={{ height: 10 }} />;
        
        let alignment: 'center' | 'left' | 'right' = 'left';
        let text = line;
        let isBold = false;
        let isBig = false;

        if (text.includes('[BIG]')) {
            isBig = true;
            text = text.replace('[BIG]', '').replace('[/BIG]', '');
        }

        if (text.startsWith('[C]')) {
            alignment = 'center';
            text = text.substring(3);
        } else if (text.startsWith('[L]')) {
            alignment = 'left';
            text = text.substring(3);
        } else if (text.startsWith('[R]')) {
            alignment = 'right';
            text = text.substring(3);
        }

        if (text.includes('<b>')) {
            isBold = true;
            text = text.replace('<b>', '').replace('</b>', '');
        }

        const parts = text.split('[R]');
        
        return (
            <View key={index} style={[styles.lineWrapper, { justifyContent: alignment === 'center' ? 'center' : 'space-between' }]}>
                {parts.length > 1 ? (
                    <>
                        <Text style={[styles.receiptText, isBold && styles.boldText, isBig && styles.bigText]}>{parts[0]}</Text>
                        <Text style={[styles.receiptText, isBold && styles.boldText, isBig && styles.bigText]}>{parts[1]}</Text>
                    </>
                ) : (
                    <Text style={[
                        styles.receiptText, 
                        isBold && styles.boldText,
                        isBig && styles.bigText,
                        { textAlign: alignment, width: '100%' }
                    ]}>
                        {text}
                    </Text>
                )}
            </View>
        );
    };

    const lines = rawText.split('\n');

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.card}>
                        <View style={styles.header}>
                            <View style={styles.titleWrapper}>
                                <Eye size={20} color="#1e293b" />
                                <Text style={styles.headerTitle}>Pratinjau Struk ({paperWidthStr}) v2</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <X size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.paperWrapper}>
                            <ScrollView 
                                style={styles.previewScroll}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.receiptContainer}
                            >
                                <View style={[styles.receiptPaper, { width: paperWidth }]}>
                                    {lines.map((line, idx) => renderLine(line, idx))}
                                </View>
                            </ScrollView>
                        </View>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                <Text style={styles.cancelBtnText}>Kembali</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.printBtn} onPress={onPrint}>
                                <Printer size={18} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.printBtnText}>Cetak Struk</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
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
        gap: 10,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
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
        gap: 12,
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
