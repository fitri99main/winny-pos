import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronUp, ChevronDown } from 'lucide-react-native';

interface DateStepperProps {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
    label?: string;
}

export default function DateStepper({ value, onChange, label }: DateStepperProps) {
    // Current date representation
    const date = new Date(value);
    
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
        
        onChange(newDate.toISOString().split('T')[0]);
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
                    <TouchableOpacity onPress={() => adjustDate(1, 0, 0)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronUp size={18} color="#64748b" />
                    </TouchableOpacity>
                    <View style={styles.valueBox}>
                        <Text style={styles.valueText}>{String(day).padStart(2, '0')}</Text>
                        <Text style={styles.typeLabel}>Tgl</Text>
                    </View>
                    <TouchableOpacity onPress={() => adjustDate(-1, 0, 0)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronDown size={18} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* Month */}
                <View style={[styles.column, { flex: 1.5 }]}>
                    <TouchableOpacity onPress={() => adjustDate(0, 1, 0)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronUp size={18} color="#64748b" />
                    </TouchableOpacity>
                    <View style={styles.valueBox}>
                        <Text style={styles.valueText}>{monthNames[month - 1]}</Text>
                        <Text style={styles.typeLabel}>Bln</Text>
                    </View>
                    <TouchableOpacity onPress={() => adjustDate(0, -1, 0)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronDown size={18} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* Year */}
                <View style={[styles.column, { flex: 1.8 }]}>
                    <TouchableOpacity onPress={() => adjustDate(0, 0, 1)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronUp size={18} color="#64748b" />
                    </TouchableOpacity>
                    <View style={styles.valueBox}>
                        <Text style={styles.valueText}>{year}</Text>
                        <Text style={styles.typeLabel}>Thn</Text>
                    </View>
                    <TouchableOpacity onPress={() => adjustDate(0, 0, -1)} style={styles.arrow} activeOpacity={0.6}>
                        <ChevronDown size={18} color="#64748b" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: 12 },
    label: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    stepperRow: { flexDirection: 'row', gap: 6, height: 100 },
    column: { flex: 1, backgroundColor: '#fcfdfe', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 1 },
    arrow: { height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
    valueBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 2 },
    valueText: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
    typeLabel: { fontSize: 9, color: '#94a3b8', fontWeight: 'bold', marginTop: -2 }
});
