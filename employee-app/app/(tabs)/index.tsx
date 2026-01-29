import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';
import { Clock, CalendarRange, Banknote, Trophy, ChevronRight, Bell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const [employee, setEmployee] = useState<any>(null);

  useEffect(() => {
    fetchEmployee();
  }, []);

  const fetchEmployee = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('employees').select('*').eq('email', user.email).single();
      setEmployee(data);
    }
  };

  const menuItems = [
    { title: 'Absensi', icon: Clock, color: '#3b82f6', bg: 'bg-blue-50', route: '/(tabs)/attendance' },
    { title: 'Shift', icon: CalendarRange, color: '#8b5cf6', bg: 'bg-purple-50', route: '/(tabs)/shift' },
    { title: 'Payroll', icon: Banknote, color: '#10b981', bg: 'bg-emerald-50', route: '/(tabs)/payroll' },
    { title: 'Reward', icon: Trophy, color: '#f59e0b', bg: 'bg-amber-50', route: '/(tabs)/reward' },
  ];

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Massive Gradient Header */}
        <LinearGradient
          colors={['#2563eb', '#1d4ed8', '#1e40af']}
          className="pt-14 pb-28 px-6 rounded-b-[60px] shadow-2xl shadow-blue-500/40"
        >
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-row items-center">
              <View className="w-14 h-14 bg-white/20 rounded-[24px] items-center justify-center border border-white/30 mr-4">
                <Text className="text-white text-2xl font-black">{employee?.name?.[0] || 'K'}</Text>
              </View>
              <View>
                <Text className="text-blue-100 text-[10px] font-black uppercase tracking-widest">Selamat Pagi</Text>
                <Text className="text-white text-2xl font-black tracking-tight">{employee?.name?.split(' ')[0] || 'Karyawan'} ✨</Text>
              </View>
            </View>
            <TouchableOpacity className="bg-white/10 w-12 h-12 rounded-2xl items-center justify-center border border-white/20">
              <Bell color="white" size={24} />
            </TouchableOpacity>
          </View>

          {/* Glass Look Info Card */}
          <View className="bg-white/10 p-5 rounded-[32px] border border-white/20 backdrop-blur-md flex-row justify-between items-center">
            <View>
              <Text className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1">Status Kepegawaian</Text>
              <Text className="text-white font-bold text-lg">{employee?.role || 'Staff Pratama'}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              className="bg-white px-4 py-2 rounded-2xl shadow-lg shadow-black/5"
            >
              <Text className="text-blue-600 font-black text-[10px] uppercase tracking-wider">Profil Detail</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View className="px-6 -mt-12">
          {/* Quick Glance Shift Card */}
          <View className="bg-white p-7 rounded-[40px] shadow-sm border border-slate-100 mb-8">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-slate-900 font-black text-xl">Tugas Hari Ini</Text>
              <View className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <Text className="text-emerald-600 text-[10px] font-black uppercase">Aktif</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/shift')}
              className="bg-slate-50 p-5 rounded-[32px] border border-slate-100 flex-row items-center"
            >
              <View className="bg-white w-14 h-14 rounded-2xl items-center justify-center shadow-sm mr-4">
                <Clock color="#2563eb" size={28} />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-black text-base">Morning Shift</Text>
                <Text className="text-slate-400 text-xs font-bold uppercase mt-1 tracking-tight">08:00 - 17:00 • Head Office</Text>
              </View>
              <ChevronRight color="#cbd5e1" size={20} />
            </TouchableOpacity>
          </View>

          {/* High-Impact Menu Grid */}
          <Text className="text-slate-900 font-black text-xl mb-6 ml-1">Portal Mandiri</Text>
          <View className="flex-row flex-wrap justify-between">
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.9}
                className="w-[48%] mb-4"
              >
                <View className="bg-white p-8 rounded-[40px] items-center border border-slate-100 shadow-sm">
                  <View className={`${item.bg} w-16 h-16 rounded-[28px] items-center justify-center mb-4`}>
                    <item.icon color={item.color} size={32} />
                  </View>
                  <Text className="text-slate-900 font-black text-sm uppercase tracking-wider">{item.title}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Announcement (Polished) */}
          <View className="mt-4 mb-10 bg-slate-900 p-8 rounded-[50px] overflow-hidden">
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'transparent']}
              className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-10 -mt-10"
            />
            <Text className="text-blue-400 font-black text-[10px] uppercase tracking-widest mb-2">Informasi HRD</Text>
            <Text className="text-white font-bold text-lg leading-snug">Update: Kebijakan Shift Malam & Tunjangan Operasional terbaru.</Text>
            <TouchableOpacity className="mt-4 self-start">
              <Text className="text-blue-400 font-black text-xs border-b-2 border-blue-400 pb-1 uppercase tracking-widest">Detail</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
