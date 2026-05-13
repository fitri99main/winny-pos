import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DebugApp() {
    return React.createElement(View, { style: styles.container },
        React.createElement(Text, { style: styles.title }, "doitPOS"),
        React.createElement(Text, { style: styles.status }, "Aplikasi berhasil dimuat dalam mode cadangan."),
        React.createElement(Text, { style: styles.info }, "Periksa konfigurasi utama aplikasi sebelum digunakan.")
    );
}

var styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f9ff',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0369a1',
        marginBottom: 10,
    },
    status: {
        fontSize: 16,
        textAlign: 'center',
        color: '#0f172a',
        marginBottom: 20,
    },
    info: {
        fontSize: 14,
        color: '#64748b',
    },
});
