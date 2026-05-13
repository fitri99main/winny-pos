import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var StyleSheet = RN.StyleSheet;
var Animated = RN.Animated;
var Platform = RN.Platform;
var Easing = RN.Easing;
import * as Lucide from 'lucide-react-native';
var CheckCircle2 = Lucide.CheckCircle2;
var AlertTriangle = Lucide.AlertTriangle;
var Info = Lucide.Info;
var RefreshCw = Lucide.RefreshCw;
var X = Lucide.X;

export default function StatusModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var title = props.title;
    var message = props.message;
    var type = props.type || 'success';
    var confirmText = props.confirmText || 'Tutup';
    var onConfirm = props.onConfirm;
    var showClose = props.showClose !== undefined ? props.showClose : true;

    var scaleAnim = React.useRef(new Animated.Value(0.8)).current;
    var opacityAnim = React.useRef(new Animated.Value(0)).current;
    var rotateAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(function() {
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

    var spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    var getIcon = function() {
        if (type === 'success') return React.createElement(CheckCircle2, { size: 42, color: "#10b981", strokeWidth: 2.5 });
        if (type === 'warning') return React.createElement(AlertTriangle, { size: 42, color: "#f59e0b", strokeWidth: 2.5 });
        if (type === 'update') {
            return React.createElement(Animated.View, { style: { transform: [{ rotate: spin }] } },
                React.createElement(RefreshCw, { size: 42, color: "#3b82f6", strokeWidth: 2.5 })
            );
        }
        return React.createElement(Info, { size: 42, color: "#3b82f6", strokeWidth: 2.5 });
    };

    var getIconBg = function() {
        if (type === 'success') return '#f0fdf4';
        if (type === 'warning') return '#fffbeb';
        if (type === 'update') return '#f0f9ff';
        return '#f0f9ff';
    };

    var getBtnBg = function() {
        if (type === 'success') return '#10b981';
        if (type === 'warning') return '#f59e0b';
        if (type === 'update') return '#3b82f6';
        return '#3b82f6';
    };

    return React.createElement(Modal, { transparent: true, visible: visible, animationType: "fade", onRequestClose: onClose },
        React.createElement(View, { style: styles.overlay },
            React.createElement(Animated.View, { style: [styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }] },
                showClose ? React.createElement(TouchableOpacity, { style: styles.closeBtn, onPress: onClose },
                    React.createElement(X, { size: 18, color: "#94a3b8" })
                ) : null,
                
                React.createElement(View, { style: [styles.iconBox, { backgroundColor: getIconBg() }] },
                    getIcon()
                ),

                React.createElement(Text, { style: styles.title }, title),
                React.createElement(Text, { style: styles.message }, message),

                React.createElement(TouchableOpacity, {
                    style: [styles.mainBtn, { backgroundColor: getBtnBg() }],
                    onPress: onConfirm || onClose,
                    activeOpacity: 0.7
                },
                    React.createElement(Text, { style: styles.btnText }, confirmText)
                )
            )
        )
    );
}

var styles = StyleSheet.create({
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


