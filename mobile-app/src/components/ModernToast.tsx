import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface ModernToastProps {
    visible: boolean;
    message: string;
    type?: 'success' | 'info' | 'error';
    onHide: () => void;
}

export default function ModernToast({ visible, message, type = 'success', onHide }: ModernToastProps) {
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Show animation
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 20,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 8
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true
                })
            ]).start();

            // Auto hide after 3 seconds
            const timer = setTimeout(() => {
                hide();
            }, 3000);

            return () => clearTimeout(timer);
        } else {
            hide();
        }
    }, [visible]);

    const hide = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(() => {
            onHide();
        });
    };

    if (!visible && opacity._value === 0) return null;

    const getBgColor = () => {
        switch (type) {
            case 'success': return '#059669'; // Emerald 600
            case 'error': return '#dc2626'; // Red 600
            default: return '#3b82f6'; // Blue 500
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'success': return '✓';
            case 'error': return '✕';
            default: return 'ℹ';
        }
    };

    return (
        <Animated.View style={[
            styles.container, 
            { transform: [{ translateY }], opacity, backgroundColor: getBgColor() }
        ]}>
            <View style={styles.iconContainer}>
                <Text style={styles.icon}>{getIcon()}</Text>
            </View>
            <Text style={styles.message}>{message}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 40,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        zIndex: 9999,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    iconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    icon: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    message: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    }
});
