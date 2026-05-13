import React from 'react';
var useState = React.useState;
var useEffect = React.useEffect;
var useRef = React.useRef;
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TextInput = RN.TextInput;
var TouchableOpacity = RN.TouchableOpacity;
var Alert = RN.Alert;
var ActivityIndicator = RN.ActivityIndicator;
var StyleSheet = RN.StyleSheet;
var Image = RN.Image;
var KeyboardAvoidingView = RN.KeyboardAvoidingView;
var Platform = RN.Platform;
var useWindowDimensions = RN.useWindowDimensions;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
import * as Lucide from 'lucide-react-native';
var Mail = Lucide.Mail;
var Lock = Lucide.Lock;
var Eye = Lucide.Eye;
var EyeOff = Lucide.EyeOff;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;

export default function LoginScreen() {
    var sessionContext = useSession();
    var branchName = sessionContext.branchName;
    
    var navigation = useNavigation();
    var dimensions = useWindowDimensions();
    var width = dimensions.width;
    var isSmallDevice = width < 380;
    
    var stateEmail = useState('');
    var email = stateEmail[0];
    var setEmail = stateEmail[1];

    var statePassword = useState('');
    var password = statePassword[0];
    var setPassword = statePassword[1];

    var stateShowPassword = useState(false);
    var showPassword = stateShowPassword[0];
    var setShowPassword = stateShowPassword[1];

    var stateLoading = useState(false);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var isMounted = useRef(true);

    useEffect(function() {
        isMounted.current = true;
        loadSavedEmail();
        return function() { isMounted.current = false; };
    }, []);

    var loadSavedEmail = function() {
        return AsyncStorage.getItem('last_login_email')
            .then(function(savedEmail) {
                if (savedEmail && isMounted.current) {
                    setEmail(savedEmail);
                }
            })['catch'](function(err) {
                console.warn('[Login] Error loading saved email:', err);
            });
    };

    var handleLogin = function() {
        if (!email || !password) {
            Alert.alert('Eror', 'Silakan isi email dan kata sandi');
            return;
        }

        console.log('[Login] Starting login for:', email);
        setLoading(true);

        var config = (supabase as any).supabaseUrl;
        if (!config || String(config).indexOf('undefined') !== -1) {
             console.error('[Login] Supabase configuration missing!');
             Alert.alert('Eror Konfigurasi', 'URL Supabase tidak ditemukan. Pastikan file .env sudah benar.');
             setLoading(false);
             return;
        }

        var timeoutId = setTimeout(function() {
            if (isMounted.current) {
                console.warn('[Login] Timeout reached (20s)');
                setLoading(false);
                Alert.alert('Waktu Habis', 'Proses login terlalu lama (20 detik). Periksa koneksi internet Anda.');
            }
        }, 20000);

        console.log('[Login] Attempting auth.signInWithPassword...');
        return supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        }).then(function(res) {
            var data = res.data;
            var error = res.error;

            console.log('[Login] signInWithPassword returned:', { hasError: !!error, hasSession: !!(data && data.session) });
            clearTimeout(timeoutId);

            if (isMounted.current) {
                if (error) {
                    setLoading(false);
                    console.warn('[Login] Gagal:', error.message);
                    Alert.alert('Gagal Masuk', 'Cek email atau password anda salah!!!');
                } else {
                    console.log('[Login] Sign-in successful. Saving email...');
                    return AsyncStorage.setItem('last_login_email', email.trim());
                }
            }
        })['catch'](function(err) {
            clearTimeout(timeoutId);
            console.warn('[Login] Unexpected system error:', (err && err.message) || err);
            if (isMounted.current) {
                setLoading(false);
                Alert.alert('Eror Sistem', 'Terjadi kesalahan saat login!!!');
            }
        });
    };

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(Image, { 
            source: require('../../assets/cafe-bg.jpg'),
            style: styles.watermarkBg,
            resizeMode: "cover"
        }),
        React.createElement(KeyboardAvoidingView, { 
            behavior: Platform.OS === 'ios' ? 'padding' : 'height',
            style: styles.flex1
        },
            React.createElement(View, { style: [styles.innerContainer, isSmallDevice && { paddingHorizontal: 20 }] },
                React.createElement(View, { style: [styles.header, isSmallDevice && { marginBottom: 20 }] },
                    React.createElement(View, { style: [styles.logoContainer, isSmallDevice && { width: 80, height: 80, borderRadius: 40, marginBottom: 12 }] },
                        React.createElement(Image, { 
                            source: require('../../assets/logo.png'), 
                            style: [styles.logoImage, isSmallDevice && { width: 55, height: 55 }],
                            resizeMode: "contain"
                        })
                    ),
                    React.createElement(Text, { style: [styles.subLogo, isSmallDevice && { fontSize: 14 }] }, branchName)
                ),

                React.createElement(View, { style: [styles.card, isSmallDevice && { padding: 20, borderRadius: 20 }] },
                    React.createElement(Text, { style: [styles.cardTitle, isSmallDevice && { fontSize: 18, marginBottom: 20 }] }, "Sign In"),

                    React.createElement(View, { style: styles.inputGroup },
                        React.createElement(Text, { style: styles.label }, "Email"),
                        React.createElement(View, { style: styles.inputWrapper },
                            React.createElement(Mail, { size: isSmallDevice ? 18 : 20, color: "#94a3b8", style: styles.inputIcon }),
                            React.createElement(TextInput, {
                                style: [styles.input, isSmallDevice && { paddingVertical: 12, fontSize: 14 }],
                                placeholder: "Enter your email",
                                value: email,
                                onChangeText: setEmail,
                                autoCapitalize: "none",
                                keyboardType: "email-address",
                                autoComplete: "email",
                                textContentType: "emailAddress"
                            })
                        )
                    ),

                    React.createElement(View, { style: styles.inputGroup },
                        React.createElement(Text, { style: styles.label }, "Password"),
                        React.createElement(View, { style: styles.inputWrapper },
                            React.createElement(Lock, { size: isSmallDevice ? 18 : 20, color: "#94a3b8", style: styles.inputIcon }),
                            React.createElement(TextInput, {
                                style: [styles.input, isSmallDevice && { paddingVertical: 12, fontSize: 14 }],
                                placeholder: "Enter your password",
                                value: password,
                                onChangeText: setPassword,
                                secureTextEntry: !showPassword,
                                autoComplete: "password",
                                textContentType: "password"
                            }),
                            React.createElement(TouchableOpacity, { 
                                onPress: function() { setShowPassword(!showPassword); },
                                style: styles.eyeIcon
                            },
                                showPassword ? (
                                    React.createElement(EyeOff, { size: isSmallDevice ? 18 : 20, color: "#94a3b8" })
                                ) : (
                                    React.createElement(Eye, { size: isSmallDevice ? 18 : 20, color: "#94a3b8" })
                                )
                            )
                        )
                    ),

                    React.createElement(TouchableOpacity, { 
                        style: [styles.button, loading && styles.buttonDisabled, isSmallDevice && { padding: 14, borderRadius: 14 }],
                        onPress: handleLogin,
                        disabled: loading
                    },
                        loading ? (
                            React.createElement(ActivityIndicator, { color: "white" })
                        ) : (
                            React.createElement(Text, { style: [styles.buttonText, isSmallDevice && { fontSize: 15 }] }, "Login")
                        )
                    )
                ),

                React.createElement(View, { style: [styles.footer, isSmallDevice && { marginTop: 20 }] },
                    React.createElement(Text, { style: styles.footerText }, "© 2026 " + branchName + " System")
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    flex1: { flex: 1 },
    watermarkBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04, width: '100%', height: '100%' },
    innerContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
    header: { alignItems: 'center', marginBottom: 32 },
    logoContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', marginBottom: 16, elevation: 6, borderWidth: 2, borderColor: '#f1f5f9' },
    logoImage: { width: 70, height: 70 },
    subLogo: { fontSize: 16, fontWeight: '600', color: '#64748b', letterSpacing: 0.5 },
    card: { backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: 28, borderRadius: 24, elevation: 5, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' },
    cardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 28, color: '#1e293b', textAlign: 'center' },
    inputGroup: { marginBottom: 20 },
    label: { color: '#64748b', marginBottom: 8, fontWeight: '600', fontSize: 13, marginLeft: 4 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 16 },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#0f172a' },
    eyeIcon: { padding: 8 },
    button: { width: '100%', backgroundColor: '#ea580c', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 12, elevation: 8 },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 },
    footer: { marginTop: 40, alignItems: 'center' },
    footerText: { color: '#94a3b8', fontSize: 13 }
});
