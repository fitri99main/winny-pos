import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var StyleSheet = RN.StyleSheet;
import * as Lucide from 'lucide-react-native';
var ChevronUp = Lucide.ChevronUp;
var ChevronDown = Lucide.ChevronDown;

export default function DateStepper(props) {
    var value = props.value;
    var onChange = props.onChange;
    var label = props.label;

    var parseLocalDate = function(dateStr) {
        var parts = dateStr.split('-');
        var year = Number(parts[0]);
        var month = Number(parts[1]);
        var day = Number(parts[2]);
        return new Date(year, month - 1, day);
    };

    var date = parseLocalDate(value);
    
    if (isNaN(date.getTime())) {
        var fallback = new Date();
        var fallbackStr = fallback.toISOString().split('T')[0];
        onChange(fallbackStr);
        return null;
    }

    var adjustDate = function(days, months, years) {
        var newDate = new Date(date);
        
        if (years !== 0) newDate.setFullYear(newDate.getFullYear() + years);
        if (months !== 0) newDate.setMonth(newDate.getMonth() + months);
        if (days !== 0) newDate.setDate(newDate.getDate() + days);
        
        var y = newDate.getFullYear();
        var m = (newDate.getMonth() + 1).toString();
        if (m.length < 2) m = '0' + m;
        var d = newDate.getDate().toString();
        if (d.length < 2) d = '0' + d;
        onChange(y + '-' + m + '-' + d);
    };

    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();

    var monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    return React.createElement(View, { style: styles.container },
        label ? React.createElement(Text, { style: styles.label }, label) : null,
        React.createElement(View, { style: styles.stepperRow },
            React.createElement(View, { style: styles.column },
                React.createElement(TouchableOpacity, { onPress: function() { adjustDate(-1, 0, 0); }, style: styles.arrow, activeOpacity: 0.6 },
                    React.createElement(ChevronDown, { size: 16, color: "#64748b" })
                ),
                React.createElement(View, { style: styles.valueBox },
                    React.createElement(Text, { style: styles.valueText }, (day < 10 ? '0' : '') + day),
                    React.createElement(Text, { style: styles.typeLabel }, "Tgl")
                ),
                React.createElement(TouchableOpacity, { onPress: function() { adjustDate(1, 0, 0); }, style: styles.arrow, activeOpacity: 0.6 },
                    React.createElement(ChevronUp, { size: 16, color: "#64748b" })
                )
            ),
            React.createElement(View, { style: [styles.column, { flex: 1.4, marginLeft: 4 }] },
                React.createElement(TouchableOpacity, { onPress: function() { adjustDate(0, -1, 0); }, style: styles.arrow, activeOpacity: 0.6 },
                    React.createElement(ChevronDown, { size: 16, color: "#64748b" })
                ),
                React.createElement(View, { style: styles.valueBox },
                    React.createElement(Text, { style: styles.valueText }, monthNames[month - 1]),
                    React.createElement(Text, { style: styles.typeLabel }, "Bln")
                ),
                React.createElement(TouchableOpacity, { onPress: function() { adjustDate(0, 1, 0); }, style: styles.arrow, activeOpacity: 0.6 },
                    React.createElement(ChevronUp, { size: 16, color: "#64748b" })
                )
            ),
            React.createElement(View, { style: [styles.column, { flex: 1.6, marginLeft: 4 }] },
                React.createElement(TouchableOpacity, { onPress: function() { adjustDate(0, 0, -1); }, style: styles.arrow, activeOpacity: 0.6 },
                    React.createElement(ChevronDown, { size: 16, color: "#64748b" })
                ),
                React.createElement(View, { style: styles.valueBox },
                    React.createElement(Text, { style: styles.valueText }, year),
                    React.createElement(Text, { style: styles.typeLabel }, "Thn")
                ),
                React.createElement(TouchableOpacity, { onPress: function() { adjustDate(0, 0, 1); }, style: styles.arrow, activeOpacity: 0.6 },
                    React.createElement(ChevronUp, { size: 16, color: "#64748b" })
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    container: { marginBottom: 8 },
    label: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' },
    stepperRow: { flexDirection: 'row', height: 44 },
    column: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
    arrow: { width: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
    valueBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    valueText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    typeLabel: { fontSize: 7, color: '#94a3b8', fontWeight: 'bold', position: 'absolute', bottom: 2 }
});

