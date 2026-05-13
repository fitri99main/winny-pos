import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var StyleSheet = RN.StyleSheet;
var Alert = RN.Alert;
var ActivityIndicator = RN.ActivityIndicator;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ManagerAuthModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var onSuccess = props.onSuccess;
    var title = props.title || 'Otorisasi Manager';

    var statePin = React.useState('');
    var pin = statePin[0];
    var setPin = statePin[1];

    var stateLoading = React.useState(false);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var stateError = React.useState(null);
    var error = stateError[0];
    var setError = stateError[1];

    React.useEffect(function() {
        if (visible) {
            setPin('');
            setError(null);
        }
    }, [visible]);

    var handleNumberPress = function(num) {
        if (pin.length < 6) {
            setPin(function(prev) { return prev + num; });
        }
    };

    var handleDelete = function() {
        setPin(function(prev) { return prev.slice(0, -1); });
    };

    var handleVerify = function() {
        if (pin.length < 4) return;

        setLoading(true);
        setError(null);

        var authorizedRoles = ['Manager', 'Manajer', 'Owner', 'Administrator', 'Admin', 'Supervisor', 'Admin Kantor'];
        
        supabase
            .from('employees')
            .select('id, name, position, system_role, pin')
            .eq('pin', pin)
            .maybeSingle()
            .then(function(res) {
                var data = res.data;
                var isAuthorized = false;

                if (data) {
                    var pos = (data.position || '').toLowerCase();
                    var sys = (data.system_role || '').toLowerCase();
                    
                    for (var i = 0; i < authorizedRoles.length; i++) {
                        var role = authorizedRoles[i].toLowerCase();
                        if (pos.indexOf(role) !== -1 || sys.indexOf(role) !== -1) {
                            isAuthorized = true;
                            break;
                        }
                    }
                }

                if (isAuthorized) {
                    onClose();
                    setTimeout(function() {
                        onSuccess();
                    }, 400);
                    setLoading(false);
                } else {
                    AsyncStorage.getItem('cached_manager_pins').then(function(cachedManagersRaw) {
                        if (cachedManagersRaw) {
                            var cachedManagers = JSON.parse(cachedManagersRaw);
                            var matched = null;
                            for (var j = 0; j < cachedManagers.length; j++) {
                                if (cachedManagers[j].pin === pin) {
                                    matched = cachedManagers[j];
                                    break;
                                }
                            }
                            
                            if (matched) {
                                onClose();
                                setTimeout(function() {
                                    onSuccess();
                                }, 400);
                                setLoading(false);
                                return;
                            }
                        }
                        setError(data ? 'Anda tidak memiliki otoritas Manager' : 'PIN Salah');
                        setPin('');
                        setLoading(false);
                    })['catch'](function() {
                        setError(data ? 'Anda tidak memiliki otoritas Manager' : 'PIN Salah');
                        setPin('');
                        setLoading(false);
                    });
                }
            })['catch'](function(err) {
                AsyncStorage.getItem('cached_manager_pins').then(function(cachedManagersRawError) {
                    if (cachedManagersRawError) {
                        var cachedManagersError = JSON.parse(cachedManagersRawError);
                        var matchedError = null;
                        for (var k = 0; k < cachedManagersError.length; k++) {
                            if (cachedManagersError[k].pin === pin) {
                                matchedError = cachedManagersError[k];
                                break;
                            }
                        }

                        if (matchedError) {
                            onClose();
                            setTimeout(function() {
                                onSuccess();
                            }, 400);
                            setLoading(false);
                            return;
                        }
                    }
                    setError('Gagal verifikasi. Periksa koneksi.');
                    setLoading(false);
                })['catch'](function() {
                    setError('Gagal verifikasi. Periksa koneksi.');
                    setLoading(false);
                });
            });
    };

    React.useEffect(function() {
        if (pin.length === 6) {
            handleVerify();
        }
    }, [pin]);

    return React.createElement(Modal, {
        visible: visible,
        transparent: true,
        animationType: "slide",
        onRequestClose: onClose
    }, React.createElement(View, { style: styles.overlay },
        React.createElement(View, { style: styles.container },
            React.createElement(View, { style: styles.header },
                React.createElement(Text, { style: styles.title }, title),
                React.createElement(TouchableOpacity, { onPress: onClose, style: styles.closeBtn },
                    React.createElement(Text, { style: styles.closeText }, "\u2715")
                )
            ),
            React.createElement(Text, { style: styles.subtitle }, "Masukkan PIN Manager untuk melanjutkan"),
            React.createElement(View, { style: styles.pinDisplay },
                [0, 1, 2, 3, 4, 5].map(function(i) {
                    return React.createElement(View, {
                        key: i,
                        style: [styles.pinDot, pin.length > i && styles.pinDotFilled, { marginLeft: i === 0 ? 0 : 12 }]
                    });
                })
            ),
            error ? React.createElement(Text, { style: styles.errorText }, error) : null,
            React.createElement(View, { style: styles.numpad },
                [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '\u232B'].map(function(item, idx) {
                    return React.createElement(TouchableOpacity, {
                        key: item.toString(),
                        style: [styles.numBtn, item === 'C' && styles.clearBtn, { marginLeft: idx % 3 === 0 ? 0 : 12, marginTop: idx < 3 ? 0 : 12 }],
                        onPress: function() {
                            if (item === 'C') setPin('');
                            else if (item === '\u232B') handleDelete();
                            else handleNumberPress((item || '').toString());
                        },
                        disabled: loading
                    }, React.createElement(Text, { style: [styles.numText, (item === 'C' || item === '\u232B') && styles.actionNumText] }, item));
                })
            ),
            React.createElement(TouchableOpacity, {
                style: [styles.verifyBtn, (pin.length < 4 || loading) && styles.disabledBtn],
                onPress: handleVerify,
                disabled: pin.length < 4 || loading
            }, loading ? React.createElement(ActivityIndicator, { color: "white" }) : React.createElement(Text, { style: styles.verifyText }, "VERIFIKASI"))
        )
    ));
}

var styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    container: { backgroundColor: 'white', borderRadius: 24, padding: 24, width: '90%', maxWidth: 400 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    closeBtn: { padding: 8 },
    closeText: { fontSize: 18, color: '#9ca3af' },
    subtitle: { textAlign: 'center', color: '#6b7280', marginBottom: 24, fontSize: 14 },
    pinDisplay: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24 },
    pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#e5e7eb' },
    pinDotFilled: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
    errorText: { color: '#ef4444', textAlign: 'center', marginBottom: 16, fontWeight: '600' },
    numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    numBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
    numText: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
    clearBtn: { backgroundColor: '#fee2e2' },
    actionNumText: { color: '#ef4444' },
    verifyBtn: { backgroundColor: '#ea580c', padding: 18, borderRadius: 16, marginTop: 24, alignItems: 'center' },
    verifyText: { color: 'white', fontWeight: 'bold', fontSize: 18, letterSpacing: 1 },
    disabledBtn: { opacity: 0.5 }
});
