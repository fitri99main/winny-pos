import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, StyleSheet, Alert } from 'react-native';

interface PaymentModalProps {
    visible: boolean;
    onClose: () => void;
    total: number;
    onConfirm: (paymentData: {
        method: string;
        amount: number;
        change: number;
    }) => void;
}

const PAYMENT_METHODS = [
    { id: 'cash', name: 'Tunai', icon: '💵', color: '#10b981' },
    { id: 'debit', name: 'Debit', icon: '💳', color: '#3b82f6' },
    { id: 'credit', name: 'Kredit', icon: '💳', color: '#8b5cf6' },
    { id: 'qris', name: 'QRIS', icon: '📱', color: '#f59e0b' },
    { id: 'transfer', name: 'Transfer', icon: '🏦', color: '#06b6d4' },
];

export default function PaymentModal({ visible, onClose, total, onConfirm }: PaymentModalProps) {
    const [selectedMethod, setSelectedMethod] = useState('cash');
    const [paidAmount, setPaidAmount] = useState('');
    const [change, setChange] = useState(0);

    // Calculate change whenever paid amount changes
    useEffect(() => {
        const paid = parseFloat(paidAmount.replace(/,/g, '')) || 0;
        const changeAmount = paid - total;
        setChange(changeAmount >= 0 ? changeAmount : 0);
    }, [paidAmount, total]);

    // Reset when modal opens
    useEffect(() => {
        if (visible) {
            setSelectedMethod('cash');
            setPaidAmount('');
            setChange(0);
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
            Alert.alert('Error', 'Jumlah pembayaran kurang dari total');
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
                        <View style={styles.totalSection}>
                            <Text style={styles.totalLabel}>Total Pembayaran</Text>
                            <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
                        </View>

                        {/* Payment Methods */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
                            <View style={styles.methodsGrid}>
                                {PAYMENT_METHODS.map(method => (
                                    <TouchableOpacity
                                        key={method.id}
                                        style={[
                                            styles.methodButton,
                                            selectedMethod === method.id && {
                                                backgroundColor: method.color,
                                                borderColor: method.color
                                            }
                                        ]}
                                        onPress={() => setSelectedMethod(method.id)}
                                    >
                                        <Text style={styles.methodIcon}>{method.icon}</Text>
                                        <Text style={[
                                            styles.methodName,
                                            selectedMethod === method.id && styles.methodNameActive
                                        ]}>
                                            {method.name}
                                        </Text>
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
                            <View style={styles.numberPad}>
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'].map(num => (
                                    <TouchableOpacity
                                        key={num}
                                        style={styles.numberButton}
                                        onPress={() => handleNumberPad(num)}
                                    >
                                        <Text style={styles.numberText}>{num}</Text>
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
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    title: {
        fontSize: 24,
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
        padding: 20,
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        margin: 20,
        marginBottom: 10,
    },
    totalLabel: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
    },
    totalAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111827',
    },
    section: {
        padding: 20,
        paddingTop: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    methodsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    methodButton: {
        flex: 1,
        minWidth: '30%',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    methodIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    methodName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    methodNameActive: {
        color: '#fff',
    },
    amountInput: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#f9fafb',
        borderWidth: 2,
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
        padding: 20,
        paddingTop: 0,
        gap: 10,
    },
    numberButton: {
        width: '30%',
        aspectRatio: 1.5,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    numberText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#374151',
    },
    confirmButton: {
        margin: 20,
        marginTop: 0,
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
});
