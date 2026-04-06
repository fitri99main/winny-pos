import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import POSScreen from '../screens/POSScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProductScreen from '../screens/ProductScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AccountingScreen from '../screens/AccountingScreen';
import StoreSettingsScreen from '../screens/StoreSettingsScreen';
import EmployeeSettingsScreen from '../screens/EmployeeSettingsScreen';

import CashierSessionHistoryScreen from '../screens/CashierSessionHistoryScreen';
import KDSScreen from '../screens/KDSScreen';
import { useSession } from '../context/SessionContext';
import { View, ActivityIndicator } from 'react-native';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    const { authSession, loading } = useSession();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
                <ActivityIndicator size="large" color="#ea580c" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!authSession ? (
                    <Stack.Screen name="Login" component={LoginScreen} />
                ) : (
                    <>
                        <Stack.Screen name="Main" component={HomeScreen} />
                        <Stack.Screen name="POS" component={POSScreen} />
                        <Stack.Screen name="History" component={HistoryScreen} />
                        <Stack.Screen name="CashierSessionHistory" component={CashierSessionHistoryScreen} />
                        <Stack.Screen name="Products" component={ProductScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="Accounting" component={AccountingScreen} />
                        <Stack.Screen name="StoreSettings" component={StoreSettingsScreen} />
                        <Stack.Screen name="EmployeeSettings" component={EmployeeSettingsScreen} />
                        <Stack.Screen name="KDS" component={KDSScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
