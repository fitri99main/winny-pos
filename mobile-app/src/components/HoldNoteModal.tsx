import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet } from 'react-native';

interface HoldNoteModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (note: string) => void;
}

export default function HoldNoteModal({ visible, onClose, onConfirm }: HoldNoteModalProps) {
    const [note, setNote] = useState('');

    useEffect(() => {
        if (visible) {
            setNote('');
        }
    }, [visible]);

    const handleConfirm = () => {
        onConfirm(note.trim());
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity style={styles.container} activeOpacity={1} onPress={e => e.stopPropagation()}>
                    <Text style={styles.title}>Catatan Hold Order</Text>
                    <Text style={styles.subtitle}>Masukkan alasan atau pengingat untuk pesanan ini.</Text>
                    
                    <TextInput
                        style={styles.input}
                        placeholder="Contoh: Meja 5 - Tunggu teman..."
                        value={note}
                        onChangeText={setNote}
                        autoFocus
                        multiline
                    />

                    <View style={styles.footer}>
                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                            <Text style={styles.cancelText}>Batal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.button, styles.confirmButton]} 
                            onPress={handleConfirm}
                        >
                            <Text style={styles.confirmText}>Simpan</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    container: { backgroundColor: 'white', borderRadius: 24, padding: 24, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
    input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 16, fontSize: 16, minHeight: 100, textAlignVertical: 'top', color: '#111827' },
    footer: { flexDirection: 'row', gap: 12, marginTop: 24 },
    button: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center' },
    cancelButton: { backgroundColor: '#f3f4f6' },
    confirmButton: { backgroundColor: '#0d9488' },
    cancelText: { fontWeight: 'bold', color: '#4b5563' },
    confirmText: { fontWeight: 'bold', color: 'white' }
});
