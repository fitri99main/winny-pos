import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import POSScreen from '../screens/POSScreen';
import { View, Text } from 'react-native';

import HistoryScreen from '../screens/HistoryScreen';
import ProductScreen from '../screens/ProductScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AccountingScreen from '../screens/AccountingScreen';
import StoreSettingsScreen from '../screens/StoreSettingsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Main" component={HomeScreen} />
                <Stack.Screen name="POS" component={POSScreen} />
                <Stack.Screen name="History" component={HistoryScreen} />
                <Stack.Screen name="Products" component={ProductScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Accounting" component={AccountingScreen} />
                <Stack.Screen name="StoreSettings" component={StoreSettingsScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
