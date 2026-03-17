import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DebugApp() {
    console.log('DebugApp Rendering...');
    return (
        <View style={styles.container}>
            <Text style={styles.title}>doitPOS Debug Mode</Text>
            <Text style={styles.status}>Jika Anda melihat ini, berarti Expo Go berhasil memuat aplikasi dasar.</Text>
            <Text style={styles.info}>Sedang mencari penyebab error di module utama...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
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
