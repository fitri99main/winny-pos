import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { CalendarRange, Clock, MapPin, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ShiftScreen() {
    const [selectedDate, setSelectedDate] = useState('28 Jan');

    const shifts = [
        { id: 1, date: '28 Jan', day: 'Wed', type: 'Morning Shift', time: '08:00 - 17:00', location: 'Office A', status: 'Upcoming' },
        { id: 2, date: '29 Jan', day: 'Thu', type: 'Morning Shift', time: '08:00 - 17:00', location: 'Office A', status: 'Scheduled' },
        { id: 3, date: '30 Jan', day: 'Fri', type: 'Full Shift', time: '08:00 - 20:00', location: 'Office B', status: 'Scheduled' },
    ];

    return (
        <View className="flex-1 bg-slate-50">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Modern Header Section */}
                <LinearGradient
                    colors={['#2563eb', '#1d4ed8']}
                    className="pt-12 pb-20 px-6 rounded-b-[40px] shadow-lg shadow-blue-500/30"
                >
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-blue-100 text-sm font-bold uppercase tracking-widest">Jadwal Kerja</Text>
                            <Text className="text-white text-3xl font-black tracking-tight">Shift Anda</Text>
                        </View>
                        <View className="bg-white/20 p-3 rounded-2xl border border-white/30">
                            <CalendarRange color="white" size={24} />
                        </View>
                    </View>

                    {/* Weekly Selector (Simplified) */}
                    <View className="flex-row justify-between items-center bg-white/10 p-2 rounded-3xl border border-white/20">
                        {['26', '27', '28', '29', '30'].map((day, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => setSelectedDate(day + ' Jan')}
                                className={`w-14 py-3 rounded-2xl items-center ${selectedDate.startsWith(day) ? 'bg-white shadow-lg shadow-black/10' : ''}`}
                            >
                                <Text className={`text-[10px] font-black uppercase mb-1 ${selectedDate.startsWith(day) ? 'text-blue-600' : 'text-blue-100'}`}>
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i]}
                                </Text>
                                <Text className={`text-lg font-black ${selectedDate.startsWith(day) ? 'text-slate-900' : 'text-white'}`}>
                                    {day}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </LinearGradient>

                <View className="px-6 -mt-10">
                    <View className="flex-row justify-between items-center mb-4 px-1">
                        <Text className="text-slate-900 font-black text-xl">Detail Shift</Text>
                        <TouchableOpacity className="flex-row items-center">
                            <Text className="text-blue-600 font-bold text-sm">Lihat Kalender</Text>
                            <ChevronRight size={16} color="#2563eb" />
                        </TouchableOpacity>
                    </View>

                    {shifts.map((shift) => (
                        <TouchableOpacity
                            key={shift.id}
                            activeOpacity={0.9}
                            className="bg-white p-6 rounded-[32px] mb-4 shadow-sm border border-slate-100 flex-row items-center"
                        >
                            <View className={`w-3 h-12 rounded-full mr-4 ${shift.status === 'Upcoming' ? 'bg-blue-500' : 'bg-slate-200'}`} />
                            <View className="flex-1">
                                <View className="flex-row justify-between items-start mb-2">
                                    <View>
                                        <Text className="font-black text-slate-900 text-lg leading-tight">{shift.type}</Text>
                                        <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{shift.day}, {shift.date}</Text>
                                    </View>
                                    <View className="bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                        <Text className="text-slate-500 text-[10px] font-black uppercase">{shift.status}</Text>
                                    </View>
                                </View>

                                <View className="flex-row items-center mt-3 space-x-4">
                                    <View className="flex-row items-center">
                                        <Clock size={14} color="#64748b" />
                                        <Text className="text-slate-600 text-xs font-bold ml-1">{shift.time}</Text>
                                    </View>
                                    <View className="flex-row items-center ml-4">
                                        <MapPin size={14} color="#64748b" />
                                        <Text className="text-slate-600 text-xs font-bold ml-1">{shift.location}</Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}

                    <View className="h-20" />
                </View>
            </ScrollView>
        </View>
    );
}
