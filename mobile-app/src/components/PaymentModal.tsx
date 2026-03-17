import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, StyleSheet, Alert, useWindowDimensions } from 'react-native';

interface PaymentModalProps {
    visible: boolean;
    onClose: () => void;
    total: number;
    onConfirm: (paymentData: {
        method: string;
        amount: number;
        change: number;
    }) => void;
    onManualItem?: () => void;
    onDiscount?: () => void;
    onSplitBill?: () => void;
    onHold?: () => void;
}

const PAYMENT_METHODS = [
    { id: 'cash', name: 'Tunai', icon: '💵', color: '#10b981' },
    { id: 'debit', name: 'Debit', icon: '💳', color: '#3b82f6' },
    { id: 'credit', name: 'Kredit', icon: '💳', color: '#8b5cf6' },
    { id: 'qris', name: 'QRIS', icon: '📱', color: '#f59e0b' },
    { id: 'transfer', name: 'Transfer', icon: '🏦', color: '#06b6d4' },
    { id: 'cek', name: 'Cek', icon: '📝', color: '#6366f1' },
];

export default function PaymentModal({
    visible,
    onClose,
    total,
    onConfirm,
    onManualItem,
    onDiscount,
    onSplitBill,
    onHold
}: PaymentModalProps) {
    const { width } = useWindowDimensions();
    const isSmallDevice = width < 380;
    const [selectedMethod, setSelectedMethod] = useState('cash');
    const [paidAmount, setPaidAmount] = useState('');
    const [change, setChange] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Calculate change whenever paid amount changes
    useEffect(() => {
        const paid = parseFloat(paidAmount.replace(/,/g, '')) || 0;
        const changeAmount = paid - total;
        setChange(changeAmount >= 0 ? changeAmount : 0);
        if (error) setError(null); // Clear error when amount changes
    }, [paidAmount, total]);

    // Reset when modal opens
    useEffect(() => {
        if (visible) {
            setSelectedMethod('cash');
            setPaidAmount('');
            setChange(0);
            setError(null);
        }
    }, [visible]);

    const handleNumberPad = (value: string) => {
        if (value === 'C') {
            setPaidAmount('');
        } else if (value === '⌫') {
            setPaidAmount(prev => prev.slice(0, -1));
        } else {
            setPaidAmount(prev => prev + value);
        }
    };

    const handleQuickAmount = (amount: number) => {
        setPaidAmount(amount.toString());
    };

    const handleConfirm = () => {
        const paid = parseFloat(paidAmount.replace(/,/g, '')) || 0;

        if (selectedMethod === 'cash' && paid < total) {
            setError('Jumlah pembayaran kurang dari total');
            return;
        }

        onConfirm({
            method: PAYMENT_METHODS.find(m => m.id === selectedMethod)?.name || 'Tunai',
            amount: paid || total,
            change: selectedMethod === 'cash' ? change : 0
        });
        onClose();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Pembayaran</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Total */}
                    <View style={[
                        styles.totalSection,
                        isSmallDevice && { padding: 12, margin: 12, marginBottom: 4 }
                    ]}>
                        <Text style={styles.totalLabel}>Total Pembayaran</Text>
                        <Text style={[
                            styles.totalAmount,
                            isSmallDevice && { fontSize: 22 }
                        ]}>{formatCurrency(total)}</Text>
                    </View>

                        {/* Payment Quick Actions */}
                        <View style={[
                            styles.paymentActionsRow,
                            isSmallDevice && { paddingHorizontal: 12, paddingBottom: 8, gap: 6 }
                        ]}>
                            <TouchableOpacity style={styles.payActionBtn} onPress={onManualItem}>
                                <Text style={[styles.payActionIcon, isSmallDevice && { fontSize: 14 }]}>➕</Text>
                                <Text style={styles.payActionText}>Manual</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.payActionBtn} onPress={onDiscount}>
                                <Text style={[styles.payActionIcon, isSmallDevice && { fontSize: 14 }]}>🏷️</Text>
                                <Text style={styles.payActionText}>Diskon</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.payActionBtn} onPress={onSplitBill}>
                                <Text style={[styles.payActionIcon, isSmallDevice && { fontSize: 14 }]}>✂️</Text>
                                <Text style={styles.payActionText}>Split</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.payActionBtn} onPress={onHold}>
                                <Text style={[styles.payActionIcon, isSmallDevice && { fontSize: 14 }]}>⏸️</Text>
                                <Text style={styles.payActionText}>Hold</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Payment Methods */}
                        <View style={[
                            styles.section,
                            isSmallDevice && { paddingHorizontal: 12 }
                        ]}>
                            <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
                            <View style={[
                                styles.methodsGrid,
                                isSmallDevice && { gap: 6 }
                            ]}>
                                {PAYMENT_METHODS.map(method => (
                                    <TouchableOpacity
                                        key={method.id}
                                        style={[
                                            styles.methodButton,
                                            isSmallDevice && { minWidth: '48%', paddingVertical: 8 },
                                            selectedMethod === method.id && {
                                                backgroundColor: method.color,
                                                borderColor: method.color
                                            }
                                        ]}
                                        onPress={() => setSelectedMethod(method.id)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={[styles.methodIcon, isSmallDevice && { fontSize: 18, marginBottom: 0 }]}>{method.icon}</Text>
                                            <Text style={[
                                                styles.methodName,
                                                selectedMethod === method.id && styles.methodNameActive
                                            ]}>
                                                {method.name}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Amount Input (for Cash only) */}
                        {selectedMethod === 'cash' && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Jumlah Dibayar</Text>
                                <TextInput
                                    style={styles.amountInput}
                                    value={paidAmount}
                                    onChangeText={setPaidAmount}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#9ca3af"
                                />

                                {/* Quick Amount Buttons */}
                                <View style={styles.quickAmounts}>
                                    {[total, 50000, 100000, 200000].map(amount => (
                                        <TouchableOpacity
                                            key={amount}
                                            style={styles.quickButton}
                                            onPress={() => handleQuickAmount(amount)}
                                        >
                                            <Text style={styles.quickButtonText}>
                                                {formatCurrency(amount)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {error && (
                                    <View style={styles.errorBanner}>
                                        <Text style={styles.errorText}>⚠️ {error}</Text>
                                    </View>
                                )}

                                {/* Change Display */}
                                {change > 0 && (
                                    <View style={styles.changeSection}>
                                        <Text style={styles.changeLabel}>Kembalian</Text>
                                        <Text style={styles.changeAmount}>{formatCurrency(change)}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Number Pad */}
                        {selectedMethod === 'cash' && (
                            <View style={[
                                styles.numberPad,
                                isSmallDevice && { padding: 12, gap: 6 }
                            ]}>
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'].map(num => (
                                    <TouchableOpacity
                                        key={num}
                                        style={[
                                            styles.numberButton,
                                            isSmallDevice && { height: 42, borderRadius: 10 }
                                        ]}
                                        onPress={() => handleNumberPad(num)}
                                    >
                                        <Text style={[
                                            styles.numberText,
                                            isSmallDevice && { fontSize: 16 }
                                        ]}>{num}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </ScrollView>

                    {/* Confirm Button */}
                    <TouchableOpacity
                        style={[
                            styles.confirmButton,
                            { backgroundColor: PAYMENT_METHODS.find(m => m.id === selectedMethod)?.color || '#10b981' }
                        ]}
                        onPress={handleConfirm}
                    >
                        <Text style={styles.confirmText}>
                            Konfirmasi Pembayaran
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 24,
        maxHeight: '90%',
        maxWidth: 500,
        width: '100%',
        alignSelf: 'center',
        overflow: 'hidden',
        paddingBottom: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    paymentActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        gap: 8,
    },
    payActionBtn: {
        flex: 1,
        backgroundColor: '#f8fafc',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    payActionIcon: {
        fontSize: 16,
        marginBottom: 2,
    },
    payActionText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748b',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        fontSize: 18,
        color: '#6b7280',
    },
    totalSection: {
        padding: 16,
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        margin: 16,
        marginBottom: 8,
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 2,
    },
    totalAmount: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
    },
    section: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    methodsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    methodButton: {
        flex: 1,
        minWidth: '30%',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    methodIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    methodName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
    },
    methodNameActive: {
        color: '#fff',
    },
    amountInput: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#f9fafb',
        borderWidth: 1.5,
        borderColor: '#e5e7eb',
        textAlign: 'center',
    },
    quickAmounts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    quickButton: {
        flex: 1,
        minWidth: '22%',
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
    },
    quickButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
    },
    changeSection: {
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#dcfce7',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    changeLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#166534',
    },
    changeAmount: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#166534',
    },
    numberPad: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        paddingTop: 0,
        gap: 8,
    },
    numberButton: {
        width: '31%',
        height: 50,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    numberText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#374151',
    },
    confirmButton: {
        margin: 16,
        marginTop: 4,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    errorBanner: {
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fee2e2',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 13,
        color: '#dc2626',
        fontWeight: '600',
    },
});
