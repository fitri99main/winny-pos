import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var StyleSheet = RN.StyleSheet;
var Animated = RN.Animated;
import * as Lucide from 'lucide-react-native';
var CheckCircle = Lucide.CheckCircle;
var AlertCircle = Lucide.AlertCircle;
var Info = Lucide.Info;

export default function ModernToast(props) {
    var visible = props.visible;
    var message = props.message;
    var type = props.type || 'success';
    var onHide = props.onHide;
    
    var stateOpacity = React.useRef(new Animated.Value(0));
    var opacity = stateOpacity.current;

    React.useEffect(function() {
        if (visible) {
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.delay(2000),
                Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true })
            ]).start(function() {
                if (onHide) onHide();
            });
        }
    }, [visible]);

    if (!visible) return null;

    var getIcon = function() {
        switch (type) {
            case 'success': return React.createElement(CheckCircle, { size: 20, color: "#16a34a" });
            case 'error': return React.createElement(AlertCircle, { size: 20, color: "#ef4444" });
            default: return React.createElement(Info, { size: 20, color: "#3b82f6" });
        }
    };

    var getStyle = function() {
        switch (type) {
            case 'success': return styles.success;
            case 'error': return styles.error;
            default: return styles.info;
        }
    };

    return React.createElement(Animated.View, { style: [styles.container, getStyle(), { opacity: opacity }] },
        getIcon(),
        React.createElement(Text, { style: styles.message }, message)
    );
}

var styles = StyleSheet.create({
    container: { 
        position: 'absolute', 
        bottom: 100, 
        left: 20, 
        right: 20, 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 16, 
        borderRadius: 12, 
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4
    },
    message: { marginLeft: 12, fontSize: 14, fontWeight: '600', color: '#1e293b' },
    success: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bcf0da' },
    error: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
    info: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }
});
