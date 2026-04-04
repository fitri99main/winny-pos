import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Dimensions, Image } from 'react-native';
import { PrinterManager } from '../lib/PrinterManager';

interface ReceiptPreviewModalProps {
    visible: boolean;
    onClose: () => void;
    orderData: any;
    onPrint: () => void;
}

export default function ReceiptPreviewModal({ visible, onClose, orderData, onPrint }: ReceiptPreviewModalProps) {
    if (!orderData) return null;

    const { receipt_logo_url, show_logo, receipt_paper_width } = orderData;
    const is80mm = receipt_paper_width === '80mm';
    const paperWidth = is80mm ? 380 : 280;

    const rawText = PrinterManager.formatReceipt(orderData, true);
    
    // Simple parser for [C], [L], [R], [LOGO] tags to render in preview
    const renderLine = (line: string, index: number) => {
        if (line.trim() === '[LOGO]') {
            return (
                <View key={index} style={styles.logoContainer}>
                    {receipt_logo_url ? (
                        <Image 
                            source={{ uri: receipt_logo_url }} 
                            style={styles.receiptLogo} 
                            resizeMode="contain" 
                        />
                    ) : (
                        <View style={styles.logoPlaceholder} />
                    )}
                </View>
            );
        }

        if (!line.trim() && line === '') return <View key={index} style={{ height: 10 }} />;
        
        let alignment: 'center' | 'left' | 'right' = 'left';
        let text = line;
        let isBold = false;

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

        // Handle <b> tags
        if (text.includes('<b>')) {
            isBold = true;
            text = text.replace('<b>', '').replace('</b>', '');
        }

        // Handle Notes (detecting '  (' format from PrinterManager)
        const isNote = text.trim().startsWith('(');
        
        // Split by [R] for right-aligned parts in the middle
        const parts = text.split('[R]');
        
        return (
            <View key={index} style={[styles.lineWrapper, { justifyContent: alignment === 'center' ? 'center' : 'space-between' }]}>
                {parts.length > 1 ? (
                    <>
                        <Text style={[styles.receiptText, isBold && styles.boldText, isNote && styles.noteText]}>{parts[0]}</Text>
                        <Text style={[styles.receiptText, isBold && styles.boldText, isNote && styles.noteText]}>{parts[1]}</Text>
                    </>
                ) : (
                    <Text style={[
                        styles.receiptText, 
                        isBold && styles.boldText,
                        isNote && styles.noteText,
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
                    <View style={[styles.card, { maxWidth: is80mm ? 420 : 320 }]}>
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Pratinjau Struk ({receipt_paper_width || '58mm'})</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Text style={styles.closeBtnText}>✕</Text>
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
                            
                            {/* Decorative Jagged Edges (Bottom) */}
                            <View style={[styles.jaggedEdge, { width: paperWidth }]} />
                        </View>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                <Text style={styles.cancelBtnText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.printBtn} onPress={onPrint}>
                                <Text style={styles.printBtnText}>🖨️ Cetak Struk</Text>
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
    closeBtnText: {
        fontSize: 20,
        color: '#64748b',
    },
    paperWrapper: {
        padding: 20,
        backgroundColor: '#f1f5f9',
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
        backgroundColor: 'white',
        padding: 20,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    lineWrapper: {
        flexDirection: 'row',
        minHeight: 20,
        alignItems: 'center',
        marginBottom: 2,
    },
    receiptText: {
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#334155',
    },
    boldText: {
        fontWeight: 'bold',
        color: '#0f172a',
    },
    noteText: {
        color: '#ea580c',
        fontStyle: 'italic',
        fontSize: 10,
    },
    jaggedEdge: {
        height: 10,
        backgroundColor: 'white',
        marginTop: -1,
        // In a real app we'd use a background image or a svg for jagged edges
        // Here we just use a white strip to simulate the bottom of paper
    },
    logoContainer: {
        alignItems: 'center',
        paddingVertical: 10,
        width: '100%',
    },
    receiptLogo: {
        width: 80,
        height: 80,
    },
    logoPlaceholder: {
        width: 80,
        height: 80,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
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
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
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
