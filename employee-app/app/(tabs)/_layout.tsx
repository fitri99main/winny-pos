import React from 'react';
import { Tabs } from 'expo-router';
import { Home, CalendarCheck, Banknote, User, Clock, CalendarRange, Trophy } from 'lucide-react-native';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          paddingBottom: 25,
          paddingTop: 10,
          height: 90,
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 20,
          color: '#1e293b',
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Absensi',
          tabBarIcon: ({ color }) => <Clock size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shift"
        options={{
          title: 'Shift',
          tabBarIcon: ({ color }) => <CalendarRange size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="payroll"
        options={{
          title: 'Payroll',
          tabBarIcon: ({ color }) => <Banknote size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reward"
        options={{
          title: 'Reward',
          tabBarIcon: ({ color }) => <Trophy size={24} color={color} />,
        }}
      />
      {/* Hide deprecated screens from tab bar but keep them accessible if needed for now */}
      <Tabs.Screen
        name="leave"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
