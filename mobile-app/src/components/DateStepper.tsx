import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronUp, ChevronDown } from 'lucide-react-native';

interface DateStepperProps {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
    label?: string;
}

export default function DateStepper({ value, onChange, label }: DateStepperProps) {
    // Parse YYYY-MM-DD safely to avoid timezone shifts
    const parseLocalDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const date = parseLocalDate(value);
    
    // Safety check for invalid dates
    if (isNaN(date.getTime())) {
        const fallback = new Date();
        const fallbackStr = fallback.toISOString().split('T')[0];
        onChange(fallbackStr);
        return null;
    }

    const adjustDate = (days: number, months: number, years: number) => {
        const newDate = new Date(date);
        
        if (years !== 0) newDate.setFullYear(newDate.getFullYear() + years);
        if (months !== 0) newDate.setMonth(newDate.getMonth() + months);
        if (days !== 0) newDate.setDate(newDate.getDate() + days);
        
        const y = newDate.getFullYear();
        const m = String(newDate.getMonth() + 1).padStart(2, '0');
        const d = String(newDate.getDate()).padStart(2, '0');
        onChange(`${y}-${m}-${d}`);
    };

    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={styles.stepperRow}>
                {/* Day */}
                <View style={styles.column}>
                    <TouchableOpacity onPress={() => adjustDate(-1, 0, 0)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronDown size={16} color="#64748b" />
                    </TouchableOpacity>
                    <View style={styles.valueBox}>
                        <Text style={styles.valueText}>{String(day).padStart(2, '0')}</Text>
                        <Text style={styles.typeLabel}>Tgl</Text>
                    </View>
                    <TouchableOpacity onPress={() => adjustDate(1, 0, 0)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronUp size={16} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* Month */}
                <View style={[styles.column, { flex: 1.4 }]}>
                    <TouchableOpacity onPress={() => adjustDate(0, -1, 0)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronDown size={16} color="#64748b" />
                    </TouchableOpacity>
                    <View style={styles.valueBox}>
                        <Text style={styles.valueText}>{monthNames[month - 1]}</Text>
                        <Text style={styles.typeLabel}>Bln</Text>
                    </View>
                    <TouchableOpacity onPress={() => adjustDate(0, 1, 0)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronUp size={16} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* Year */}
                <View style={[styles.column, { flex: 1.6 }]}>
                    <TouchableOpacity onPress={() => adjustDate(0, 0, -1)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronDown size={16} color="#64748b" />
                    </TouchableOpacity>
                    <View style={styles.valueBox}>
                        <Text style={styles.valueText}>{year}</Text>
                        <Text style={styles.typeLabel}>Thn</Text>
                    </View>
                    <TouchableOpacity onPress={() => adjustDate(0, 0, 1)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronUp size={16} color="#64748b" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: 8 },
    label: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' },
    stepperRow: { flexDirection: 'row', gap: 4, height: 44 },
    column: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
    arrow: { width: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
    valueBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    valueText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    typeLabel: { fontSize: 7, color: '#94a3b8', fontWeight: 'bold', position: 'absolute', bottom: 2 }
});
