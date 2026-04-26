import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated, Platform, Easing } from 'react-native';
import { CheckCircle2, AlertTriangle, Info, RefreshCw, X, ArrowUpCircle } from 'lucide-react-native';

interface StatusModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'warning' | 'info' | 'update';
    confirmText?: string;
    onConfirm?: () => void;
    showClose?: boolean;
}

export default function StatusModal({
    visible,
    onClose,
    title,
    message,
    type = 'success',
    confirmText = 'Tutup',
    onConfirm,
    showClose = true
}: StatusModalProps) {
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 9,
                    tension: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            if (type === 'update') {
                Animated.loop(
                    Animated.timing(rotateAnim, {
                        toValue: 1,
                        duration: 2000,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    })
                ).start();
            }
        } else {
            scaleAnim.setValue(0.8);
            opacityAnim.setValue(0);
            rotateAnim.setValue(0);
        }
    }, [visible, type]);

    if (!visible) return null;

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle2 size={42} color="#10b981" strokeWidth={2.5} />;
            case 'warning': return <AlertTriangle size={42} color="#f59e0b" strokeWidth={2.5} />;
            case 'update': return (
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <RefreshCw size={42} color="#3b82f6" strokeWidth={2.5} />
                </Animated.View>
            );
            default: return <Info size={42} color="#3b82f6" strokeWidth={2.5} />;
        }
    };

    const getIconBg = () => {
        switch (type) {
            case 'success': return '#f0fdf4';
            case 'warning': return '#fffbeb';
            case 'update': return '#f0f9ff';
            default: return '#f0f9ff';
        }
    };

    const getBtnBg = () => {
        switch (type) {
            case 'success': return '#10b981';
            case 'warning': return '#f59e0b';
            case 'update': return '#3b82f6';
            default: return '#3b82f6';
        }
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Animated.View style={[styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
                    {showClose && (
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <X size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                    
                    <View style={[styles.iconBox, { backgroundColor: getIconBg() }]}>
                        {getIcon()}
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <TouchableOpacity 
                        style={[styles.mainBtn, { backgroundColor: getBtnBg() }]} 
                        onPress={onConfirm || onClose}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.btnText}>{confirmText}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { 
        flex: 1, 
        backgroundColor: 'rgba(15, 23, 42, 0.75)', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 20 
    },
    container: { 
        backgroundColor: 'white', 
        borderRadius: 30, 
        width: '85%', 
        maxWidth: 280, 
        paddingVertical: 32, 
        paddingHorizontal: 24, 
        alignItems: 'center', 
        elevation: 20, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 12 }, 
        shadowOpacity: 0.12, 
        shadowRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    closeBtn: { 
        position: 'absolute', 
        top: 16, 
        right: 16, 
        padding: 4,
        zIndex: 10
    },
    iconBox: { 
        width: 68, 
        height: 68, 
        borderRadius: 34, 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: 20, 
        borderWidth: 6, 
        borderColor: '#f8fafc' 
    },
    title: { 
        fontSize: 20, 
        fontWeight: '800', 
        color: '#1e293b', 
        marginBottom: 8, 
        textAlign: 'center', 
        letterSpacing: -0.3 
    },
    message: { 
        fontSize: 13, 
        color: '#64748b', 
        textAlign: 'center', 
        lineHeight: 18, 
        marginBottom: 24, 
        fontWeight: '500' 
    },
    mainBtn: { 
        width: '100%', 
        paddingVertical: 14, 
        borderRadius: 16, 
        alignItems: 'center', 
        justifyContent: 'center', 
        elevation: 4, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.15, 
        shadowRadius: 8 
    },
    btnText: { 
        color: 'white', 
        fontSize: 15, 
        fontWeight: '700', 
        letterSpacing: 0.3 
    }
});

