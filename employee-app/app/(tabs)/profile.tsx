import { View, Text, TouchableOpacity, Alert, Image, ScrollView, Dimensions } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { LogOut, User, Award, Shield, ChevronLeft, Mail, Phone, MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
    const router = useRouter();
    const [employee, setEmployee] = useState<any>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('employees').select('*').eq('email', user.email).single();
            setEmployee(data);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace('/login');
    };

    return (
        <View className="flex-1 bg-slate-50">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Modern Gradient Header */}
                <LinearGradient
                    colors={['#1e293b', '#0f172a']}
                    className="pt-12 pb-32 px-6 rounded-b-[60px] shadow-2xl shadow-slate-900/40"
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="bg-white/10 w-10 h-10 rounded-full items-center justify-center border border-white/20 mb-6"
                    >
                        <ChevronLeft color="white" size={20} />
                    </TouchableOpacity>

                    <View className="items-center">
                        <View className="w-28 h-28 bg-white/20 rounded-[40px] items-center justify-center border-4 border-white/30 mb-4 shadow-2xl">
                            <Text className="text-white text-5xl font-black">{employee?.name?.[0] || 'K'}</Text>
                        </View>
                        <Text className="text-white text-3xl font-black tracking-tight">{employee?.name || 'Karyawan'}</Text>
                        <View className="bg-blue-600/50 px-4 py-1 rounded-full mt-2 border border-blue-500/30">
                            <Text className="text-blue-100 font-black text-xs uppercase tracking-widest">{employee?.role || 'Staff'}</Text>
                        </View>
                    </View>
                </LinearGradient>

                <View className="px-6 -mt-16">
                    {/* Info Card Grid */}
                    <View className="bg-white p-8 rounded-[48px] shadow-sm border border-slate-100 mb-6">
                        <Text className="text-slate-900 font-black text-xl mb-6 ml-1">Informasi Personal</Text>

                        <View className="space-y-6">
                            <View className="flex-row items-center">
                                <View className="bg-slate-50 w-12 h-12 rounded-2xl items-center justify-center mr-4">
                                    <Mail color="#64748b" size={20} />
                                </View>
                                <View>
                                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Email Resmi</Text>
                                    <Text className="text-slate-900 font-black text-base">{employee?.email || '-'}</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center">
                                <View className="bg-slate-50 w-12 h-12 rounded-2xl items-center justify-center mr-4">
                                    <Phone color="#64748b" size={20} />
                                </View>
                                <View>
                                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Nomor HP</Text>
                                    <Text className="text-slate-900 font-black text-base">+62 812 3456 7890</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center">
                                <View className="bg-slate-50 w-12 h-12 rounded-2xl items-center justify-center mr-4">
                                    <MapPin color="#64748b" size={20} />
                                </View>
                                <View>
                                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Lokasi Kantor</Text>
                                    <Text className="text-slate-900 font-black text-base">Head Office, Jakarta</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Stats & Status */}
                    <View className="flex-row justify-between mb-8">
                        <View className="bg-white w-[48%] p-6 rounded-[32px] border border-slate-100 items-center shadow-sm">
                            <View className="bg-purple-50 w-12 h-12 rounded-2xl items-center justify-center mb-3">
                                <Award color="#8b5cf6" size={24} />
                            </View>
                            <Text className="text-slate-400 text-[10px] font-black uppercase mb-1">Total Poin</Text>
                            <Text className="text-slate-900 font-black text-xl">2,450 pts</Text>
                        </View>
                        <View className="bg-white w-[48%] p-6 rounded-[32px] border border-slate-100 items-center shadow-sm">
                            <View className="bg-emerald-50 w-12 h-12 rounded-2xl items-center justify-center mb-3">
                                <Shield color="#10b981" size={24} />
                            </View>
                            <Text className="text-slate-400 text-[10px] font-black uppercase mb-1">Status</Text>
                            <Text className="text-emerald-600 font-black text-xl">Permanent</Text>
                        </View>
                    </View>

                    {/* Security & Action */}
                    <View className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-100 mb-8">
                        <TouchableOpacity
                            onPress={handleLogout}
                            activeOpacity={0.8}
                            className="bg-rose-50 flex-row items-center justify-center py-6 rounded-[28px] border border-rose-100"
                        >
                            <LogOut color="#e11d48" size={22} />
                            <Text className="text-rose-600 font-black ml-3 text-lg uppercase tracking-widest">Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
