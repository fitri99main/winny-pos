import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Clock, Calendar, CheckCircle, Navigation } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function AttendanceScreen() {
    const [status, setStatus] = useState<'In' | 'Out'>('Out');
    const [lastLog, setLastLog] = useState<any>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: emp } = await supabase.from('employees').select('id').eq('email', user.email).single();
            if (emp) {
                const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).order('check_in', { ascending: false }).limit(1);
                if (logs && logs.length > 0) {
                    const log = logs[0];
                    setLastLog(log);
                    setStatus(log.check_out ? 'Out' : 'In');
                }
            }
        }
    };

    const handleAttendance = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: emp } = await supabase.from('employees').select('id').eq('email', user.email).single();
        if (!emp) return;

        if (status === 'Out') {
            const { error } = await supabase.from('attendance_logs').insert([{
                employee_id: emp.id,
                check_in: new Date().toISOString(),
                status: 'Hadir'
            }]);
            if (!error) {
                Alert.alert('Sukses', 'Berhasil Check In');
                fetchStatus();
            }
        } else {
            const { error } = await supabase.from('attendance_logs').update({
                check_out: new Date().toISOString()
            }).eq('id', lastLog.id);
            if (!error) {
                Alert.alert('Sukses', 'Berhasil Check Out');
                fetchStatus();
            }
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <View className="flex-1 bg-slate-50">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Modern Gradient Header */}
                <LinearGradient
                    colors={['#2563eb', '#1d4ed8']}
                    className="pt-12 pb-24 px-6 rounded-b-[50px] shadow-lg shadow-blue-500/30 items-center"
                >
                    <Text className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1">{formatDate(currentTime)}</Text>
                    <Text className="text-white text-6xl font-black tracking-tighter mb-4">{formatTime(currentTime)}</Text>

                    {/* Glass Location Indicator */}
                    <View className="bg-white/10 px-5 py-2.5 rounded-full border border-white/20 flex-row items-center backdrop-blur-md">
                        <Navigation size={16} color="#bef264" />
                        <Text className="text-white text-[10px] font-black ml-2 uppercase tracking-wider">Verified: Office Radius</Text>
                    </View>
                </LinearGradient>

                <View className="px-6 -mt-16">
                    {/* Main Interaction Card */}
                    <View className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 items-center justify-center mb-8">
                        <TouchableOpacity
                            onPress={handleAttendance}
                            activeOpacity={0.8}
                            className="w-48 h-48 rounded-full items-center justify-center p-2 shadow-2xl shadow-blue-500/20"
                        >
                            <LinearGradient
                                colors={status === 'Out' ? ['#3b82f6', '#2563eb'] : ['#f43f5e', '#e11d48']}
                                className="w-full h-full rounded-full items-center justify-center border-[8px] border-slate-50"
                            >
                                <Clock color="white" size={56} strokeWidth={3} />
                                <Text className="text-white font-black text-xl mt-2 uppercase tracking-tighter">Clock {status === 'Out' ? 'In' : 'Out'}</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <View className="flex-row mt-8 space-x-12">
                            <View className="items-center">
                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Check In</Text>
                                <Text className="text-slate-900 font-black text-xl">{lastLog?.check_in ? new Date(lastLog.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</Text>
                            </View>
                            <View className="w-px h-10 bg-slate-100 mx-2" />
                            <View className="items-center">
                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Check Out</Text>
                                <Text className="text-slate-900 font-black text-xl">{lastLog?.check_out ? new Date(lastLog.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</Text>
                            </View>
                        </View>
                    </View>

                    <Text className="text-slate-900 font-black text-xl mb-4 ml-1">Riwayat Hari Ini</Text>

                    {lastLog ? (
                        <View className="bg-white p-7 rounded-[40px] shadow-sm border border-slate-100">
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className="bg-emerald-50 w-14 h-14 rounded-2xl items-center justify-center mr-4">
                                        <CheckCircle color="#059669" size={28} />
                                    </View>
                                    <View>
                                        <Text className="text-slate-900 font-black text-lg">{lastLog.status}</Text>
                                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Berhasil Tercatat</Text>
                                    </View>
                                </View>
                                <TouchableOpacity className="bg-slate-50 w-10 h-10 rounded-xl items-center justify-center border border-slate-100">
                                    <ChevronRight size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View className="bg-white p-12 rounded-[40px] border border-slate-100 items-center justify-center">
                            <Clock size={40} color="#e2e8f0" />
                            <Text className="text-slate-400 font-bold mt-4">Belum ada absen hari ini</Text>
                        </View>
                    )}

                    <View className="h-20" />
                </View>
            </ScrollView>
        </View>
    );
}
