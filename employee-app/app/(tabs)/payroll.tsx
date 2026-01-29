import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Download, ChevronRight, TrendingUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function PayrollScreen() {
    const [payrolls, setPayrolls] = useState<any[]>([]);

    useEffect(() => {
        fetchPayroll();
    }, []);

    const fetchPayroll = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: emp } = await supabase.from('employees').select('id').eq('email', user.email).single();
        if (emp) {
            const { data } = await supabase.from('payrolls')
                .select('*')
                .eq('employee_id', emp.id)
                .order('period', { ascending: false });
            if (data) setPayrolls(data);
        }
    };

    const formatCurrency = (amount: number) => {
        return 'Rp ' + amount.toLocaleString('id-ID');
    };

    return (
        <View className="flex-1 bg-slate-50">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Modern Gradient Header */}
                <LinearGradient
                    colors={['#059669', '#10b981']}
                    className="pt-12 pb-24 px-6 rounded-b-[50px] shadow-lg shadow-emerald-500/30"
                >
                    <View className="flex-row justify-between items-center mb-8">
                        <View>
                            <Text className="text-emerald-50 text-sm font-bold uppercase tracking-widest">Keuangan Karyawan</Text>
                            <Text className="text-white text-3xl font-black tracking-tight">Slip Gaji</Text>
                        </View>
                        <View className="bg-white/20 p-3 rounded-2xl border border-white/30">
                            <TrendingUp color="white" size={28} />
                        </View>
                    </View>

                    {/* Glass Look Summary Card */}
                    <View className="bg-white/10 p-6 rounded-[32px] border border-white/20 backdrop-blur-md">
                        <Text className="text-emerald-50 text-[10px] font-black uppercase tracking-widest mb-1">Total Pendapatan (YTD)</Text>
                        <Text className="text-white text-3xl font-black">Rp 45.500.000</Text>
                    </View>
                </LinearGradient>

                <View className="px-6 -mt-10">
                    {payrolls.length === 0 ? (
                        <View className="bg-white p-12 rounded-[40px] border border-slate-100 items-center justify-center shadow-sm">
                            <FileText size={40} color="#e2e8f0" />
                            <Text className="text-slate-400 font-bold mt-4">Belum ada data gaji</Text>
                        </View>
                    ) : (
                        payrolls.map((payroll, i) => (
                            <View key={i} className="bg-white p-7 rounded-[40px] mb-6 shadow-sm border border-slate-100">
                                <View className="flex-row justify-between items-center mb-6">
                                    <View className="flex-row items-center">
                                        <View className="bg-emerald-50 w-14 h-14 rounded-2xl items-center justify-center mr-4">
                                            <FileText color="#10b981" size={28} />
                                        </View>
                                        <View>
                                            <Text className="font-black text-slate-900 text-lg tracking-tight">{payroll.period || 'Periode'}</Text>
                                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Gaji Terverifikasi</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity className="bg-slate-50 w-10 h-10 rounded-xl items-center justify-center border border-slate-100">
                                        <Download size={20} color="#64748b" />
                                    </TouchableOpacity>
                                </View>

                                <View className="space-y-4">
                                    <View className="flex-row justify-between items-center">
                                        <Text className="text-slate-500 font-bold">Gaji Pokok</Text>
                                        <Text className="text-slate-900 font-black">{formatCurrency(payroll.basic_salary || 0)}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center">
                                        <Text className="text-slate-500 font-bold">Tunjangan</Text>
                                        <Text className="text-emerald-600 font-black">+{formatCurrency(payroll.allowances || 0)}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center">
                                        <Text className="text-slate-500 font-bold">Potongan</Text>
                                        <Text className="text-rose-500 font-black">-{formatCurrency(payroll.deductions || 0)}</Text>
                                    </View>

                                    <View className="h-px bg-slate-100 my-2" />

                                    <LinearGradient
                                        colors={['#eff6ff', '#f8fafc']}
                                        className="p-6 rounded-[32px] border border-blue-100/50 flex-row justify-between items-center"
                                    >
                                        <View>
                                            <Text className="text-blue-900 font-black text-[10px] uppercase tracking-widest mb-1">Take Home Pay</Text>
                                            <Text className="text-blue-600 font-black text-2xl tracking-tighter">{formatCurrency(payroll.net_salary || 0)}</Text>
                                        </View>
                                        <View className="bg-blue-600 px-3 py-1.5 rounded-2xl shadow-lg shadow-blue-500/30">
                                            <Text className="text-white text-[10px] font-black uppercase">Paid</Text>
                                        </View>
                                    </LinearGradient>
                                </View>
                            </View>
                        ))
                    )}
                    <View className="h-20" />
                </View>
            </ScrollView>
        </View>
    );
}
