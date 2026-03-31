import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { LogOut, AlertTriangle, Trash2 } from 'lucide-react-native';

interface ConfirmExitModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    iconType?: 'logout' | 'alert' | 'trash';
    showCancel?: boolean;
}

const { width } = Dimensions.get('window');
const isSmallDevice = width < 380;

export default function ConfirmExitModal({
    visible,
    onClose,
    onConfirm,
    title = 'Konfirmasi Keluar',
    message = 'Apakah Anda yakin ingin keluar dari aplikasi?',
    confirmText = 'Keluar',
    cancelText = 'Batal',
    iconType = 'logout',
    showCancel = true
}: ConfirmExitModalProps) {
    const [scaleValue] = React.useState(new Animated.Value(0.95));
    const [opacityValue] = React.useState(new Animated.Value(0));

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(scaleValue, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityValue, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            scaleValue.setValue(0.95);
            opacityValue.setValue(0);
        }
    }, [visible, opacityValue, scaleValue]);

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Animated.View 
                    style={[
                        styles.modalContainer,
                        {
                            opacity: opacityValue,
                            transform: [{ scale: scaleValue }]
                        }
                    ]}
                >
                    <View style={styles.iconContainer}>
                        {iconType === 'logout' ? (
                            <LogOut size={32} color="#ea580c" />
                        ) : iconType === 'trash' ? (
                            <Trash2 size={32} color="#ef4444" />
                        ) : (
                            <AlertTriangle size={32} color="#ea580c" />
                        )}
                    </View>
                    
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.buttonContainer}>
                        {showCancel && (
                            <TouchableOpacity 
                                style={styles.cancelButton} 
                                onPress={onClose}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelText}>{cancelText}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            style={styles.confirmButton} 
                            onPress={onConfirm}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.confirmText}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)', // Slate-900 with opacity
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fff7ed', // Orange-50
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b', // Slate-800
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        color: '#64748b', // Slate-500
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#f1f5f9', // Slate-100
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748b', // Slate-500
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#ea580c', // Orange-600
        alignItems: 'center',
    },
    confirmText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#ffffff',
    },
});
