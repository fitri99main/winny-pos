import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet } from 'react-native';

interface ManualItemModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (item: { name: string; price: number; notes?: string }) => void;
}

export default function ManualItemModal({ visible, onClose, onAdd }: ManualItemModalProps) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (visible) {
            setName('');
            setPrice('');
            setNotes('');
        }
    }, [visible]);

    const handleAdd = () => {
        const numericPrice = parseFloat(price.replace(/[^0-9]/g, '')) || 0;
        if (!name.trim()) return;
        
        onAdd({
            name: name.trim(),
            price: numericPrice,
            notes: notes.trim() || undefined
        });
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity style={styles.container} activeOpacity={1} onPress={e => e.stopPropagation()}>
                    <Text style={styles.title}>Item Manual</Text>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nama Item</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            autoFocus
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Harga (IDR)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0"
                            value={price}
                            onChangeText={setPrice}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Keterangan (Opsional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Tambahkan catatan..."
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                        />
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                            <Text style={styles.cancelText}>Batal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.button, styles.confirmButton, (!name || !price) && styles.disabledButton]} 
                            onPress={handleAdd}
                            disabled={!name || !price}
                        >
                            <Text style={styles.confirmText}>Tambah</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    container: { backgroundColor: 'white', borderRadius: 20, padding: 24 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#111827' },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, color: '#6b7280', marginBottom: 8, fontWeight: '600' },
    input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 16 },
    footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
    button: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
    cancelButton: { backgroundColor: '#f3f4f6' },
    confirmButton: { backgroundColor: '#ea580c' },
    disabledButton: { opacity: 0.5 },
    cancelText: { fontWeight: 'bold', color: '#4b5563' },
    confirmText: { fontWeight: 'bold', color: 'white' }
});
