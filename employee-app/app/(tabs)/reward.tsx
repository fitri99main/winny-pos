import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Award, Trophy, Star, ChevronRight, TrendingUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function RewardScreen() {
    return (
        <View className="flex-1 bg-slate-50">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Gamified Header */}
                <LinearGradient
                    colors={['#8b5cf6', '#6d28d9']}
                    className="pt-12 pb-24 px-6 rounded-b-[50px] shadow-lg shadow-purple-500/30"
                >
                    <View className="flex-row justify-between items-center mb-8">
                        <View>
                            <Text className="text-purple-100 text-sm font-bold uppercase tracking-widest">Pencapaian</Text>
                            <Text className="text-white text-3xl font-black tracking-tight">Reward Saya</Text>
                        </View>
                        <View className="bg-white/20 p-3 rounded-2xl border border-white/30">
                            <Trophy color="white" size={28} />
                        </View>
                    </View>

                    {/* Reward Points Card */}
                    <View className="bg-white/10 p-6 rounded-[32px] border border-white/20 backdrop-blur-md">
                        <View className="flex-row justify-between items-end">
                            <View>
                                <Text className="text-purple-100 text-xs font-black uppercase tracking-widest mb-1">Total Poin</Text>
                                <Text className="text-white text-4xl font-black">2,450</Text>
                            </View>
                            <View className="bg-amber-400 px-4 py-2 rounded-2xl shadow-lg shadow-amber-500/50">
                                <Text className="text-amber-900 font-black text-xs uppercase">Gold Rank</Text>
                            </View>
                        </View>
                        <View className="h-2 bg-white/20 rounded-full mt-6 overflow-hidden">
                            <View className="h-full bg-amber-400 w-[75%] rounded-full" />
                        </View>
                        <Text className="text-purple-100 text-[10px] font-bold mt-2">550 pts lagi untuk Platinum Rank</Text>
                    </View>
                </LinearGradient>

                <View className="px-6 -mt-10">
                    {/* Bonus Section */}
                    <TouchableOpacity
                        activeOpacity={0.9}
                        className="bg-white p-6 rounded-[32px] mb-6 shadow-sm border border-slate-100"
                    >
                        <View className="flex-row justify-between items-center">
                            <View className="flex-row items-center">
                                <View className="bg-amber-50 w-12 h-12 rounded-2xl items-center justify-center mr-4">
                                    <TrendingUp color="#d97706" size={24} />
                                </View>
                                <View>
                                    <Text className="text-slate-900 font-black text-lg leading-tight">Bonus Bulan Ini</Text>
                                    <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Estimasi Bonus</Text>
                                </View>
                            </View>
                            <Text className="text-emerald-600 font-black text-lg">Rp 750.000</Text>
                        </View>
                    </TouchableOpacity>

                    <Text className="text-slate-900 font-black text-xl mb-4 ml-1">Lencana (Badges)</Text>

                    <View className="flex-row flex-wrap justify-between">
                        {[
                            { label: 'Terajin', icon: Clock, color: 'bg-blue-50', iconColor: '#2563eb' },
                            { label: 'Top Performer', icon: Trophy, color: 'bg-purple-50', iconColor: '#8b5cf6' },
                            { label: 'Team Player', icon: Star, color: 'bg-rose-50', iconColor: '#f43f5e' },
                            { label: 'Disciplined', icon: Award, color: 'bg-emerald-50', iconColor: '#10b981' },
                        ].map((item, i) => (
                            <View key={i} className="w-[48%] bg-white p-6 rounded-[32px] mb-4 items-center border border-slate-100 shadow-sm">
                                <View className={`${item.color} w-16 h-16 rounded-[24px] items-center justify-center mb-4`}>
                                    <item.icon color={item.iconColor} size={32} />
                                </View>
                                <Text className="text-slate-900 font-black text-sm text-center">{item.label}</Text>
                                <Text className="text-slate-400 text-[10px] font-bold mt-1 uppercase">Unlocked</Text>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity className="mt-4 bg-slate-900 py-6 rounded-[32px] items-center">
                        <Text className="text-white font-black text-base uppercase tracking-widest">Tukarkan Poin</Text>
                    </TouchableOpacity>

                    <View className="h-24" />
                </View>
            </ScrollView>
        </View>
    );
}
