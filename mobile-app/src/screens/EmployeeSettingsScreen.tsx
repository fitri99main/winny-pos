import * as React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var StyleSheet = RN.StyleSheet;
var FlatList = RN.FlatList;
var Modal = RN.Modal;
var TextInput = RN.TextInput;
var ActivityIndicator = RN.ActivityIndicator;
var Alert = RN.Alert;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;

export default function EmployeeSettingsScreen() {
    var navigation = useNavigation();
    
    var stateWaiters = React.useState([]);
    var waiters = stateWaiters[0];
    var setWaiters = stateWaiters[1];

    var stateLoading = React.useState(true);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var stateModalVisible = React.useState(false);
    var modalVisible = stateModalVisible[0];
    var setModalVisible = stateModalVisible[1];

    var stateEditingWaiter = React.useState(null);
    var editingWaiter = stateEditingWaiter[0];
    var setEditingWaiter = stateEditingWaiter[1];

    var stateNewWaiterName = React.useState('');
    var newWaiterName = stateNewWaiterName[0];
    var setNewWaiterName = stateNewWaiterName[1];

    var fetchWaiters = function() {
        setLoading(true);
        return supabase
            .from('employees')
            .select('*')
            .or('position.ilike.%waiter%,position.ilike.%staff%,position.ilike.%pelayan%')
            .order('name', { ascending: true })
            .then(function(res) {
                if (res.error) throw res.error;
                setWaiters(res.data || []);
            })['catch'](function(error) {
                console.error('Error fetching waiters:', error);
            })
            .finally(function() {
                setLoading(false);
            });
    };

    React.useEffect(function() {
        fetchWaiters();
    }, []);

    var handleSave = function() {
        if (!newWaiterName.trim()) return;

        var queryPromise;
        if (editingWaiter) {
            queryPromise = supabase
                .from('employees')
                .update({ name: newWaiterName.trim() })
                .eq('id', editingWaiter.id);
        } else {
            queryPromise = supabase
                .from('employees')
                .insert([{
                    name: newWaiterName.trim(),
                    position: 'Waiter',
                    department: 'Operations',
                    status: 'Active'
                }]);
        }

        return queryPromise.then(function(res) {
            if (res.error) throw res.error;
            setModalVisible(false);
            setNewWaiterName('');
            setEditingWaiter(null);
            return fetchWaiters();
        })['catch'](function(error) {
            console.error('Error saving waiter:', error);
            Alert.alert('Error', 'Gagal menyimpan data pelayan');
        });
    };

    var handleDelete = function(waiter) {
        Alert.alert(
            'Hapus Pelayan',
            'Apakah Anda yakin ingin menghapus ' + waiter.name + '?',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: function() {
                        return supabase
                            .from('employees')
                            .delete()
                            .eq('id', waiter.id)
                            .then(function(delRes) {
                                if (delRes.error) throw delRes.error;
                                return fetchWaiters();
                            })['catch'](function(error) {
                                console.error('Error deleting waiter:', error);
                                Alert.alert('Error', 'Gagal menghapus pelayan');
                            });
                    }
                }
            ]
        );
    };

    var openEdit = function(waiter) {
        setEditingWaiter(waiter);
        setNewWaiterName(waiter.name);
        setModalVisible(true);
    };

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(View, { style: styles.header },
            React.createElement(TouchableOpacity, { onPress: function() { navigation.goBack(); }, style: styles.backButton },
                React.createElement(Text, { style: styles.backButtonText }, "\u2190")
            ),
            React.createElement(Text, { style: styles.headerTitle }, "Pengaturan Pelayan"),
            React.createElement(TouchableOpacity, {
                style: styles.addButton,
                onPress: function() {
                    setEditingWaiter(null);
                    setNewWaiterName('');
                    setModalVisible(true);
                }
            },
                React.createElement(Text, { style: styles.addButtonText }, "+ Tambah")
            )
        ),

        loading ? React.createElement(View, { style: styles.center },
            React.createElement(ActivityIndicator, { size: "large", color: "#2563eb" })
        ) : React.createElement(FlatList, {
            data: waiters,
            keyExtractor: function(item, index) { return (item && item.id ? item.id : index).toString(); },
            contentContainerStyle: styles.listContent,
            renderItem: function(data) {
                var item = data.item;
                return React.createElement(View, { style: styles.waiterItem },
                    React.createElement(View, { style: styles.waiterInfo },
                        React.createElement(Text, { style: styles.waiterName }, item.name),
                        React.createElement(Text, { style: styles.waiterPosition }, item.position)
                    ),
                    React.createElement(View, { style: styles.actions },
                        React.createElement(TouchableOpacity, { onPress: function() { openEdit(item); }, style: [styles.actionBtn, styles.editBtn] },
                            React.createElement(Text, { style: styles.actionText }, "Edit")
                        ),
                        React.createElement(TouchableOpacity, { onPress: function() { handleDelete(item); }, style: [styles.actionBtn, styles.deleteBtn] },
                            React.createElement(Text, { style: styles.actionText }, "Hapus")
                        )
                    )
                );
            },
            ListEmptyComponent: React.createElement(View, { style: styles.emptyContainer },
                React.createElement(Text, { style: styles.emptyText }, "Belum ada pelayan terdaftar")
            )
        }),

        React.createElement(Modal, { visible: modalVisible, transparent: true, animationType: "fade", onRequestClose: function() { setModalVisible(false); } },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(Text, { style: styles.modalTitle }, editingWaiter ? 'Edit Pelayan' : 'Tambah Pelayan'),
                    React.createElement(TextInput, {
                        style: styles.input,
                        value: newWaiterName,
                        onChangeText: setNewWaiterName,
                        autoFocus: true
                    }),
                    React.createElement(View, { style: styles.modalButtons },
                        React.createElement(TouchableOpacity, {
                            style: [styles.modalBtn, styles.cancelBtn],
                            onPress: function() { setModalVisible(false); }
                        },
                            React.createElement(Text, { style: styles.cancelBtnText }, "Batal")
                        ),
                        React.createElement(TouchableOpacity, {
                            style: [styles.modalBtn, styles.saveBtn],
                            onPress: handleSave
                        },
                            React.createElement(Text, { style: styles.saveBtnText }, "Simpan")
                        )
                    )
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    backButton: { marginRight: 16 },
    backButtonText: { fontSize: 24, color: '#1f2937' },
    headerTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    addButton: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    addButtonText: { color: 'white', fontWeight: 'bold' },
    listContent: { padding: 16 },
    waiterItem: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#f3f4f6' },
    waiterInfo: { flex: 1 },
    waiterName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    waiterPosition: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    actions: { flexDirection: 'row' },
    actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    editBtn: { backgroundColor: '#eff6ff' },
    deleteBtn: { backgroundColor: '#fef2f2' },
    actionText: { fontSize: 12, fontWeight: 'bold', color: '#374151' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: '#6b7280', fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#1f2937' },
    input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 24 },
    modalButtons: { flexDirection: 'row' },
    modalBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', marginRight: 12 },
    cancelBtn: { backgroundColor: '#f3f4f6' },
    saveBtn: { backgroundColor: '#2563eb' },
    cancelBtnText: { color: '#4b5563', fontWeight: 'bold' },
    saveBtnText: { color: 'white', fontWeight: 'bold' },
});
